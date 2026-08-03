#!/usr/bin/env bash
# launch-openclaw.sh — Launch OpenClaw gateway inside an OpenShell sandbox.
#
# This is the one imperative step that cannot be expressed as a Helm chart
# because it requires runtime interaction with the sandbox process namespace.
#
# Key design decisions (from open-claw-in-openshell reference):
#   - mlflow-openclaw plugin is the sole trace source (not diagnostics-otel)
#   - Plugin requires patching for OpenClaw 2026.7.1 compat (patch-mlflow-plugin.py)
#   - Extensions must be root-owned (OpenClaw "suspicious ownership" check)
#   - Config file must be owned by sandbox UID (OpenClaw reads as sandbox user)
#   - Combined CA bundle (OpenShell proxy + RHOAI service-ca) for TLS trust
#   - OTEL exporters disabled (OTEL_*_EXPORTER=none) — mlflow-openclaw handles traces
#
# Usage: ./scripts/launch-openclaw.sh
# Prereqs: openshell CLI configured, sandbox created, secrets/secrets.env exists
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NAMESPACE="${NAMESPACE:-openshell}"
SANDBOX_NAME="${SANDBOX_NAME:-openclaw-gw}"
APPS_DOMAIN="${APPS_DOMAIN:-}"
RHOAI_NS="${RHOAI_NS:-redhat-ods-applications}"

info()  { echo "[INFO]  $*"; }
warn()  { echo "[WARN]  $*"; }
error() { echo "[ERROR] $*" >&2; }
pass()  { echo "[PASS]  $*"; }
step()  { echo ""; echo "── $* ──"; }

# Load secrets
if [[ -f "${PROJECT_DIR}/secrets/secrets.env" ]]; then
  set -a; source "${PROJECT_DIR}/secrets/secrets.env"; set +a
fi
: "${MAAS_API_KEY:?MAAS_API_KEY required (set in secrets/secrets.env)}"

if [[ -z "$APPS_DOMAIN" ]]; then
  APPS_DOMAIN=$(oc get ingress.config.openshift.io cluster -o jsonpath='{.spec.domain}')
fi

# ─── MLflow wiring ────────────────────────────────────────────────────────────
step "Reading MLflow wiring"
MLFLOW_TOKEN="${MLFLOW_TOKEN:-}"
if [[ -z "$MLFLOW_TOKEN" ]]; then
  MLFLOW_TOKEN=$(oc -n "$NAMESPACE" get secret openshell-sandbox-mlflow-token \
    -o jsonpath='{.data.token}' 2>/dev/null | base64 -d 2>/dev/null || true)
fi
if [[ -z "$MLFLOW_TOKEN" ]]; then
  error "MLflow token not available. Deploy MLflow RBAC first (Phase 5)."
  exit 1
fi
info "MLflow SA token read from Secret"

MLFLOW_EXPERIMENT_ID="${MLFLOW_EXPERIMENT_ID:-1}"
MLFLOW_SVC_URL="https://mlflow.${RHOAI_NS}.svc:8443"
info "MLflow tracking URI: ${MLFLOW_SVC_URL} (experiment=${MLFLOW_EXPERIMENT_ID})"

# ─── Render config ────────────────────────────────────────────────────────────
step "Rendering openclaw.json"
CONFIG_RENDERED="${PROJECT_DIR}/.rendered/openclaw.json"
mkdir -p "$(dirname "$CONFIG_RENDERED")"
sed -e "s|__MAAS_API_KEY__|${MAAS_API_KEY}|g" \
    -e "s|__APPS_DOMAIN__|${APPS_DOMAIN}|g" \
    -e "s|__MLFLOW_EXPERIMENT_ID__|${MLFLOW_EXPERIMENT_ID}|g" \
    "${PROJECT_DIR}/config/openclaw.json.tpl" > "$CONFIG_RENDERED"
pass "Rendered config (mlflow-openclaw plugin enabled, experiment=${MLFLOW_EXPERIMENT_ID})"

# ─── Validate sandbox pod ─────────────────────────────────────────────────────
SANDBOX_POD="${SANDBOX_NAME}"
if ! oc -n "$NAMESPACE" get pod "$SANDBOX_POD" &>/dev/null; then
  error "Sandbox pod '$SANDBOX_POD' not found. Create it first:"
  error "  openshell sandbox create --name $SANDBOX_NAME --policy policies/openclaw-sandbox.yaml"
  exit 1
fi
info "Sandbox pod: $SANDBOX_POD"

# Detect sandbox UID (OpenShift assigns arbitrary UIDs)
SANDBOX_UID=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- id -u 2>/dev/null || echo "1000820000")
SANDBOX_GID=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- id -g 2>/dev/null || echo "0")
info "Sandbox UID:GID = ${SANDBOX_UID}:${SANDBOX_GID}"

# ─── Step 1: Kill stale gateway processes ─────────────────────────────────────
step "Cleaning stale gateway processes"
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c \
  'for p in $(pgrep -f "openclaw|node" 2>/dev/null); do kill -9 $p 2>/dev/null; done; sleep 2; rm -f /sandbox/workspace/.openclaw/state/*.lock /tmp/openclaw*/*.lock' 2>/dev/null || true
pass "Stale processes cleaned"

# ─── Step 2: Install OpenClaw ─────────────────────────────────────────────────
step "Ensuring OpenClaw is installed"
if ! oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- which openclaw &>/dev/null; then
  info "Installing OpenClaw via npm..."
  oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- npm install -g openclaw
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
pass "Service openclaw-ui exposed → https://openclaw-gw--openclaw-ui.${APPS_DOMAIN}/"

# ─── Step 9: Start gateway ────────────────────────────────────────────────────
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
info "Gateway:  https://openclaw-gw-${NAMESPACE}.${APPS_DOMAIN}/"
info "Tracing:  mlflow-openclaw → ${MLFLOW_SVC_URL} (workspace=${NAMESPACE}, experiment=${MLFLOW_EXPERIMENT_ID})"
info "Plugins:  memory-core, mlflow-openclaw"
info ""
info "Validate: make validate-openclaw validate-traces"
