#!/usr/bin/env bash
# launch-openclaw.sh — Launch OpenClaw gateway inside an OpenShell sandbox.
#
# This is the one imperative step that cannot be expressed as a Helm chart
# because it requires runtime interaction with the sandbox process namespace.
#
# Automates (idempotent):
#   - CLI gateway select / register+mTLS if missing (openshift-openshell-register-gateway.sh)
#   - Sandbox create if missing (openshell sandbox create)
#
# Key design decisions (from the reference project):
#   - mlflow-openclaw plugin is the sole trace source (not diagnostics-otel)
#   - Plugin requires patching for OpenClaw 2026.7.1 compat (patch-mlflow-plugin.py)
#   - Extensions must be root-owned (OpenClaw "suspicious ownership" check)
#   - Config file must be owned by sandbox UID (OpenClaw reads as sandbox user)
#   - Combined CA bundle (OpenShell proxy + RHOAI service-ca) for TLS trust
#   - OTEL exporters disabled (OTEL_*_EXPORTER=none) — mlflow-openclaw handles traces
#
# Usage: ./scripts/launch-openclaw.sh
# Prereqs: OpenShell deployed (make -C deploy deploy-openshell), secrets/secrets.env
#   (MAAS_API_KEY, OPENCLAW_GATEWAY_PASSWORD; INFERENCE_MODEL, MAAS_BASE_URL, INFERENCE_BACKEND, NEMO_*)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NAMESPACE="${NAMESPACE:-openshell}"
SANDBOX_NAME="${SANDBOX_NAME:-openclaw-gw}"
GATEWAY_NAME="${GATEWAY_NAME:-ocp}"
OPENSHELL_RELEASE_NAME="${OPENSHELL_RELEASE_NAME:-openshell}"
SANDBOX_SA_NAME="${SANDBOX_SA_NAME:-${OPENSHELL_RELEASE_NAME}-sandbox}"
APPS_DOMAIN="${APPS_DOMAIN:-}"
RHOAI_NS="${RHOAI_NS:-redhat-ods-applications}"
POLICY_FILE="${POLICY_FILE:-${PROJECT_DIR}/policies/openclaw-sandbox.yaml}"
if [[ "$POLICY_FILE" != /* ]]; then
  POLICY_FILE="${PROJECT_DIR}/${POLICY_FILE#./}"
fi

info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*"; }
error() { echo "[ERROR] $*" >&2; }
pass()  { echo "[PASS]  $*"; }
step()  { echo ""; echo "── $* ──"; }

# Load secrets + inference config (single source: secrets/secrets.env)
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"
load_inference_config || exit 1

command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }
command -v oc >/dev/null 2>&1 || { error "oc is required"; exit 1; }

if [[ -z "$APPS_DOMAIN" ]]; then
  APPS_DOMAIN=$(oc get ingress.config.openshift.io cluster -o jsonpath='{.spec.domain}')
fi
UI_HOST="${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}"
MLFLOW_TOKEN_SECRET="${SANDBOX_SA_NAME}-mlflow-token"

# ─── Ensure local CLI points at this project's gateway ────────────────────────
step "Ensuring OpenShell CLI gateway '${GATEWAY_NAME}'"
NAMESPACE="${NAMESPACE}" GATEWAY_NAME="${GATEWAY_NAME}" \
  "${SCRIPT_DIR}/openshift-openshell-register-gateway.sh"

# ─── MLflow wiring ────────────────────────────────────────────────────────────
step "Reading MLflow wiring"
MLFLOW_TOKEN="${MLFLOW_TOKEN:-}"
if [[ -z "$MLFLOW_TOKEN" ]]; then
  MLFLOW_TOKEN=$(oc -n "$NAMESPACE" get secret "${MLFLOW_TOKEN_SECRET}" \
    -o jsonpath='{.data.token}' 2>/dev/null | base64 -d 2>/dev/null || true)
fi
if [[ -z "$MLFLOW_TOKEN" ]]; then
  error "MLflow token not available. Run: make -C deploy deploy-openshell"
  exit 1
fi
info "MLflow SA token read from Secret"

MLFLOW_SVC_URL="https://mlflow.${RHOAI_NS}.svc:8443"
MLFLOW_EXPERIMENT_NAME="${MLFLOW_EXPERIMENT_NAME:-openclaw-tracing}"
# Placeholder until sandbox exists and we can resolve by name (per-workspace ids differ).
MLFLOW_EXPERIMENT_ID="${MLFLOW_EXPERIMENT_ID:-__RESOLVE__}"
info "MLflow tracking URI: ${MLFLOW_SVC_URL} (experiment id resolved after sandbox is ready)"

# ─── Render config ────────────────────────────────────────────────────────────
# NOTE: config/openclaw.json.tpl uses apiKey: "unused" and
# baseUrl: https://inference.local/v1 with model: router. LLM credentials
# are handled by OpenShell's inference router — the real API key lives in
# the gateway's provider record, never in the sandbox environment.
step "Rendering openclaw.json"
CONFIG_RENDERED="${PROJECT_DIR}/.rendered/openclaw.json"
mkdir -p "$(dirname "$CONFIG_RENDERED")"
sed -e "s|__APPS_DOMAIN__|${APPS_DOMAIN}|g" \
    -e "s|__UI_HOST__|${UI_HOST}|g" \
    -e "s|__MLFLOW_EXPERIMENT_ID__|${MLFLOW_EXPERIMENT_ID}|g" \
    -e "s|__OPENCLAW_GATEWAY_PASSWORD__|${OPENCLAW_GATEWAY_PASSWORD}|g" \
    "${PROJECT_DIR}/config/openclaw.json.tpl" > "$CONFIG_RENDERED"
pass "Rendered config (password auth, mlflow-openclaw plugin, experiment=${MLFLOW_EXPERIMENT_ID})"

# ─── Enable providers_v2 and configure inference route ────────────────────────
step "Configuring inference router (providers_v2 + dual providers)"

ensure_inference_provider() {
  local name="$1" base_url="$2"
  if openshell provider list 2>/dev/null | grep -q "$name"; then
    info "Provider '$name' already exists"
  else
    openshell provider create \
      --name "$name" \
      --type openai \
      --credential "OPENAI_API_KEY=${MAAS_API_KEY}" \
      --config "OPENAI_BASE_URL=${base_url}"
    info "Provider '$name' created (type=openai, base=${base_url})"
  fi
}

openshell settings set --global --key providers_v2_enabled --value true --yes 2>/dev/null || true
info "providers_v2_enabled = true"

ensure_inference_provider "$PROVIDER_DIRECT" "$MAAS_BASE_URL"
ensure_inference_provider "$PROVIDER_GUARDRAILED" "$NEMO_GUARDRAILS_URL"

ACTIVE_PROVIDER="$PROVIDER_DIRECT"
if [[ "$INFERENCE_BACKEND" == "guardrailed" ]]; then
  ACTIVE_PROVIDER="$PROVIDER_GUARDRAILED"
fi

openshell inference set --provider "$ACTIVE_PROVIDER" --model "$INFERENCE_MODEL" --no-verify 2>/dev/null \
  && pass "Inference route: $ACTIVE_PROVIDER / $INFERENCE_MODEL (backend=${INFERENCE_BACKEND})" \
  || warn "Inference route configuration failed"

# ─── Create sandbox if missing ────────────────────────────────────────────────
# inference.local handles LLM routing — sandbox create does not need --provider.
SANDBOX_POD="${SANDBOX_NAME}"
step "Ensuring sandbox '${SANDBOX_NAME}'"
if openshell sandbox list 2>/dev/null | awk -v n="$SANDBOX_NAME" 'index($0, n) { found=1 } END { exit !found }'; then
  info "Sandbox '$SANDBOX_NAME' already exists"
else
  [[ -f "$POLICY_FILE" ]] || { error "Policy file not found: $POLICY_FILE"; exit 1; }
  info "Creating sandbox (policy=$(basename "$POLICY_FILE"))..."
  # NOTE: no --upload here. policies/openclaw-sandbox.yaml lists /sandbox
  # itself under filesystem_policy.read_only (only /sandbox/workspace is
  # read_write), so `--upload ...:/sandbox/.openclaw/config.json` is DOA —
  # the CLI's tar-over-ssh extraction always fails with "Permission denied"
  # under this policy, every single run (confirmed live 2026-08-14, and in
  # every prior launch log back to 2026-08-10). It's cosmetic-only: Step 3
  # below (`oc cp` to /sandbox/workspace/.openclaw/openclaw.json, which IS
  # writable) is the real and only config path OpenClaw reads (HOME is set
  # to /sandbox/workspace for the gateway process). Sandbox creation still
  # succeeds fine without it — dropping the flag just removes a scary but
  # meaningless red error from every deploy log.
  openshell sandbox create \
    --from openclaw \
    --name "$SANDBOX_NAME" \
    --policy "$POLICY_FILE" \
    --no-tty &
  CREATE_PID=$!

  info "Waiting for sandbox to be ready..."
  retries=0
  while [[ $retries -lt 120 ]]; do
    # Match name + Ready on the same list line (ANSI-safe; avoid bare
    # "${NAME}.*Ready" which is wrong if NAME is empty / multiline).
    if openshell sandbox list 2>/dev/null | awk -v n="$SANDBOX_NAME" '
        index($0, n) && /Ready/ { found=1 }
        END { exit !found }
      '; then
      info "Sandbox is Ready"
      break
    fi
    # Fallback: pod exists and Ready even if list formatting differs
    if oc -n "$NAMESPACE" get pod "$SANDBOX_NAME" -o jsonpath='{.status.phase}' 2>/dev/null | grep -q Running; then
      ready=$(oc -n "$NAMESPACE" get pod "$SANDBOX_NAME" -o jsonpath='{.status.containerStatuses[?(@.name=="agent")].ready}' 2>/dev/null || true)
      if [[ "$ready" == "true" ]]; then
        info "Sandbox pod Running/Ready"
        break
      fi
    fi
    sleep 5
    retries=$((retries + 1))
  done
  kill "$CREATE_PID" 2>/dev/null || true
  wait "$CREATE_PID" 2>/dev/null || true

  if [[ $retries -ge 120 ]]; then
    error "Sandbox did not become ready within 10 minutes"
    exit 1
  fi
  pass "Sandbox created"
fi

if ! oc -n "$NAMESPACE" get pod "$SANDBOX_POD" &>/dev/null; then
  error "Sandbox pod '$SANDBOX_POD' not found after create"
  exit 1
fi
info "Sandbox pod: $SANDBOX_POD"

# Detect sandbox UID (OpenShift assigns arbitrary UIDs). Note: `oc exec`
# without an explicit user runs as the container's default user (root in
# the "agent" container), NOT the "sandbox" user the actual OpenClaw
# process runs as (via `openshell sandbox exec`) — so `id -u` alone would
# wrongly report 0. Query the named "sandbox" user explicitly instead.
SANDBOX_UID=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- id -u sandbox 2>/dev/null || echo "1000820000")
SANDBOX_GID=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- id -g sandbox 2>/dev/null || echo "1000820000")
info "Sandbox UID:GID = ${SANDBOX_UID}:${SANDBOX_GID}"

# ─── Resolve MLflow experiment id (per-workspace on shared MLflow) ────────────
if [[ "$MLFLOW_EXPERIMENT_ID" == "__RESOLVE__" ]]; then
  step "Resolving MLflow experiment '${MLFLOW_EXPERIMENT_NAME}' in workspace ${NAMESPACE}"
  EXP_JSON=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- \
    bash -c "curl -sk '${MLFLOW_SVC_URL}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${MLFLOW_EXPERIMENT_NAME}' \
      -H 'Authorization: Bearer ${MLFLOW_TOKEN}' \
      -H 'X-MLFLOW-WORKSPACE: ${NAMESPACE}'" 2>/dev/null || true)
  MLFLOW_EXPERIMENT_ID=$(echo "$EXP_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('experiment',{}).get('experiment_id',''))" 2>/dev/null || true)
  if [[ -z "$MLFLOW_EXPERIMENT_ID" ]]; then
    warn "Could not resolve experiment by name; defaulting to 1 (override with MLFLOW_EXPERIMENT_ID)"
    MLFLOW_EXPERIMENT_ID=1
  else
    pass "Resolved experiment ${MLFLOW_EXPERIMENT_NAME} → id=${MLFLOW_EXPERIMENT_ID}"
  fi
fi
# Re-render so experimentId is concrete before upload.
sed -e "s|__APPS_DOMAIN__|${APPS_DOMAIN}|g" \
    -e "s|__UI_HOST__|${UI_HOST}|g" \
    -e "s|__MLFLOW_EXPERIMENT_ID__|${MLFLOW_EXPERIMENT_ID}|g" \
    -e "s|__OPENCLAW_GATEWAY_PASSWORD__|${OPENCLAW_GATEWAY_PASSWORD}|g" \
    "${PROJECT_DIR}/config/openclaw.json.tpl" > "$CONFIG_RENDERED"

# ─── Step 1: Kill stale gateway processes ─────────────────────────────────────
# MUST kill via `openshell sandbox exec`, NOT `oc exec -c agent` — the gateway
# is started with `openshell sandbox exec` (Step 9), which runs in a
# different PID namespace than plain `oc exec`. Killing via `oc exec` makes
# `pgrep -f "openclaw|node"` find nothing there, so the kill silently no-ops
# while the real gateway process keeps running untouched — every subsequent
# "restart" then just starts a second gateway on top of the first (or fails
# to bind :18789), still serving whatever stale config/env it started with.
# Verify the process list is empty afterwards — don't trust exit code alone.
step "Cleaning stale gateway processes"
kill_stale_openclaw_gateway() {
  openshell sandbox exec -n "$SANDBOX_POD" --no-tty --timeout 15 -- bash -c '
    for p in $(pgrep -f "openclaw gateway" 2>/dev/null); do
      kill -9 "$p" 2>/dev/null
    done
    sleep 2
    rm -f /sandbox/workspace/.openclaw/state/*.lock /tmp/openclaw*/*.lock 2>/dev/null
    pgrep -af "openclaw gateway" 2>/dev/null
    true
  ' 2>&1
  return 0
}
STALE_CHECK="$(kill_stale_openclaw_gateway)"
if echo "$STALE_CHECK" | grep -q "openclaw gateway"; then
  warn "Stale gateway process(es) survived first kill attempt — retrying:"
  echo "$STALE_CHECK" | while IFS= read -r line; do info "  $line"; done
  STALE_CHECK="$(kill_stale_openclaw_gateway)"
fi
if echo "$STALE_CHECK" | grep -q "openclaw gateway"; then
  error "Could not kill stale OpenClaw gateway process(es) after 2 attempts — refusing to start a second gateway on top of a live one:"
  echo "$STALE_CHECK" | while IFS= read -r line; do error "  $line"; done
  error "Fix: openshell sandbox connect ${SANDBOX_POD}, then manually 'kill -9 <pid>' for each, then re-run this script."
  exit 1
fi
info "Confirmed no stale gateway processes remain"
# Our template is the single source of truth (declarative, GitOps-style) —
# stale openclaw.json.bak* files from prior runs have no `meta.lastTouchedVersion`
# match with our fresh upload, which trips OpenClaw's "missing-meta-vs-last-good"
# anomaly detector and can make it silently *restore config from an old backup*
# instead of using what we just uploaded (bit us with a backup carrying a
# stale `auth.mode: token` + `bind: auto`, from an env var we no longer pass).
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c \
  'rm -f /sandbox/workspace/.openclaw/openclaw.json.bak*' 2>/dev/null || true
pass "Stale processes cleaned"

# ─── Step 2: Install OpenClaw (pinned — ADR-0006) ────────────────────────────
# Unpinned `npm install -g openclaw` installs whatever "latest" resolves to
# at exec time — not reproducible, and a real config schema (e.g.
# `gateway.terminal`) can silently change between versions, breaking gateway
# startup with "Invalid config". The reference project pins 2026.7.1, but
# that release requires Node >=22.22.3 while this sandbox image ships
# v22.22.1 — so we pin 2026.6.34 instead: the newest release still
# compatible with this Node (engines >=22.19.0) whose config validation
# tolerates our template (2026.6.33 rejects `gateway.terminal` as unknown).
OPENCLAW_PIN="${OPENCLAW_PIN:-2026.6.34}"
step "Ensuring OpenClaw ${OPENCLAW_PIN} is installed"
CURRENT_VERSION=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- openclaw --version 2>/dev/null | head -1 || true)
if [[ "$CURRENT_VERSION" != *"$OPENCLAW_PIN"* ]]; then
  info "Installing openclaw@${OPENCLAW_PIN} (found: ${CURRENT_VERSION:-none})..."
  oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- npm install -g "openclaw@${OPENCLAW_PIN}"
fi
OPENCLAW_VERSION=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- openclaw --version 2>&1 | head -1)
pass "OpenClaw version: $OPENCLAW_VERSION"

# ─── Step 3: Upload config ────────────────────────────────────────────────────
step "Uploading rendered config to sandbox"
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- mkdir -p /sandbox/workspace/.openclaw
oc -n "$NAMESPACE" cp "$CONFIG_RENDERED" "${SANDBOX_POD}:/sandbox/workspace/.openclaw/openclaw.json" -c agent
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- \
  chown "${SANDBOX_UID}:${SANDBOX_GID}" /sandbox/workspace/.openclaw/openclaw.json
pass "Config uploaded (owned by sandbox UID ${SANDBOX_UID})"

# ─── Step 4: Install mlflow-openclaw plugin ───────────────────────────────────
# This plugin hooks into OpenClaw's agent lifecycle events and creates MLflow
# traces with full Request/Response content (unlike diagnostics-otel which only
# sends generic OTEL spans).
step "Installing mlflow-openclaw plugin"
PLUGIN_DIR="/sandbox/workspace/.openclaw/extensions/mlflow-openclaw"
PLUGIN_INSTALLED=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- \
  test -f "${PLUGIN_DIR}/openclaw.plugin.json" 2>/dev/null && echo "YES" || echo "NO")
if [[ "$PLUGIN_INSTALLED" == "YES" ]]; then
  info "mlflow-openclaw plugin already installed"
else
  info "Installing mlflow-openclaw plugin..."
  oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c "
    mkdir -p ${PLUGIN_DIR} && cd ${PLUGIN_DIR}
    npm init -y 2>/dev/null
    npm install @mlflow/mlflow-openclaw@0.2.0-rc.0 2>/dev/null
    cp node_modules/@mlflow/mlflow-openclaw/openclaw.plugin.json . 2>/dev/null || true
    echo 'export { default } from \"@mlflow/mlflow-openclaw\";' > index.ts
    python3 -c \"
import json
with open('package.json','r') as f: d=json.load(f)
d['main']='./node_modules/@mlflow/mlflow-openclaw/index.ts'
d['type']='module'
with open('package.json','w') as f: json.dump(d,f,indent=2)
\"
  "
  pass "mlflow-openclaw plugin installed"
fi

# ─── Step 5: Patch plugin for OpenClaw compatibility ──────────────────────────
# @mlflow/mlflow-openclaw@0.2.0-rc.0 was built for a newer OpenClaw SDK.
# Patches: service.ts (diagnostics-otel no-op), index.ts (definePluginEntry),
# @mlflow/core auth/index.js (X-MLFLOW-WORKSPACE header backport).
step "Patching mlflow-openclaw plugin for compatibility"
oc -n "$NAMESPACE" cp "${PROJECT_DIR}/scripts/patch-mlflow-plugin.py" \
  "${SANDBOX_POD}:/tmp/patch-mlflow-plugin.py" -c agent
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- python3 /tmp/patch-mlflow-plugin.py 2>&1 \
  | while IFS= read -r line; do info "$line"; done
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- \
  chown -R root:root "${PLUGIN_DIR}" 2>/dev/null || true
pass "Plugin installed and patched (root-owned)"

# ─── Step 6: Stage CA bundle ──────────────────────────────────────────────────
# The mlflow-openclaw plugin needs TLS trust for RHOAI MLflow's service-ca-signed
# certificate. We combine OpenShell's proxy CA with RHOAI's service-ca.
COMBINED_CA="/sandbox/workspace/.combined-ca-bundle.pem"
step "Staging combined CA bundle for TLS trust"
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c \
  "cat /etc/openshell-tls/openshell-ca.pem > ${COMBINED_CA} 2>/dev/null || true"
oc get configmap -n "$NAMESPACE" openshift-service-ca.crt -o jsonpath='{.data.service-ca\.crt}' 2>/dev/null \
  | oc -n "$NAMESPACE" exec -i "$SANDBOX_POD" -c agent -- bash -c "cat >> ${COMBINED_CA}"
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- \
  chown "${SANDBOX_UID}:${SANDBOX_GID}" "${COMBINED_CA}"
pass "Combined CA bundle staged at ${COMBINED_CA}"

# ─── Step 7: Setup workspace dirs with correct ownership ─────────────────────
step "Setting up workspace directories"
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c "
  mkdir -p /sandbox/workspace/.openclaw/tmp \
           /sandbox/workspace/.openclaw/logs/stability \
           /sandbox/workspace/.openclaw/agents/main/sessions \
           /sandbox/workspace/.openclaw/state
  chown -R ${SANDBOX_UID}:${SANDBOX_GID} /sandbox/workspace/.openclaw/tmp \
    /sandbox/workspace/.openclaw/logs \
    /sandbox/workspace/.openclaw/agents \
    /sandbox/workspace/.openclaw/state \
    /sandbox/workspace/.openclaw/openclaw.json
  # Extensions MUST remain root-owned
  chown -R root:root /sandbox/workspace/.openclaw/extensions 2>/dev/null || true
"
pass "Workspace directories ready"

# ─── Step 8: Expose service via relay ────────────────────────────────────────
step "Registering service route in OpenShell relay"
openshell service expose "$SANDBOX_NAME" 18789 openclaw-ui 2>&1 || true
pass "Service openclaw-ui exposed → https://${UI_HOST}/"

# ─── Step 9: Start gateway ────────────────────────────────────────────────────
# No LITELLM_API_KEY injection: inference uses the inference router
# (inference.local), which injects credentials from the gateway's provider
# record. The sandbox process never sees the real API key.
step "Starting OpenClaw gateway"
openshell sandbox exec -n "$SANDBOX_POD" --no-tty --timeout 15 \
  --env "HOME=/sandbox/workspace" \
  --env "OPENCLAW_TEMP=/sandbox/workspace/.openclaw/tmp" \
  --env "OTEL_TRACES_EXPORTER=none" \
  --env "OTEL_METRICS_EXPORTER=none" \
  --env "MLFLOW_TRACKING_TOKEN=${MLFLOW_TOKEN}" \
  --env "MLFLOW_WORKSPACE=${NAMESPACE}" \
  --env "NODE_EXTRA_CA_CERTS=${COMBINED_CA}" \
  --env "NODE_TLS_REJECT_UNAUTHORIZED=0" \
  -- bash -c '
    nohup openclaw gateway run > /sandbox/workspace/openclaw.log 2>&1 &
    disown
    sleep 8
    if pgrep -f "openclaw gateway" >/dev/null; then
      echo "OK"
    else
      echo "FAIL"
      tail -20 /sandbox/workspace/openclaw.log
      exit 1
    fi
  '

# ─── Step 10: Verify health + plugin loaded ───────────────────────────────────
step "Verifying gateway health"
sleep 3
openshell sandbox exec -n "$SANDBOX_POD" --no-tty --timeout 10 \
  --env "HOME=/sandbox/workspace" \
  -- bash -c 'curl -sf http://127.0.0.1:18789/health || exit 1' && \
  pass "Gateway healthy on :18789" || \
  { error "Health check failed — check: openshell sandbox exec -n $SANDBOX_POD -- tail -50 /sandbox/workspace/openclaw.log"; exit 1; }

PLUGIN_CHECK=$(openshell sandbox exec -n "$SANDBOX_POD" --no-tty --timeout 5 \
  --env "HOME=/sandbox/workspace" \
  -- bash -c 'grep "http server listening" /sandbox/workspace/openclaw.log | tail -1' 2>/dev/null || true)
if echo "$PLUGIN_CHECK" | grep -q "mlflow-openclaw"; then
  pass "mlflow-openclaw plugin loaded"
else
  warn "mlflow-openclaw plugin may not have loaded — check gateway log"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
step "OpenClaw launch complete"
echo ""
info "Gateway UI (nginx mTLS bridge): https://${UI_HOST}/"
info "Auth: enter OPENCLAW_GATEWAY_PASSWORD (from secrets/secrets.env) in Control UI settings"
info "      or open: https://${UI_HOST}/?password=<password>"
info "Tracing:  mlflow-openclaw → ${MLFLOW_SVC_URL} (workspace=${NAMESPACE}, experiment=${MLFLOW_EXPERIMENT_ID})"
info "Plugins:  memory-core, mlflow-openclaw"
info ""
info "Validate: make validate-openclaw validate-traces"
info "UI proxy: APPS_DOMAIN=${APPS_DOMAIN} make -C deploy deploy-openclaw-ui-proxy"
