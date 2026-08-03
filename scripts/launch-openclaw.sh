#!/usr/bin/env bash
# Minimal script to launch OpenClaw gateway inside an OpenShell sandbox.
# This is the one imperative step that cannot be expressed as a Helm chart
# because it requires runtime interaction with the sandbox process namespace.
#
# Usage: ./scripts/launch-openclaw.sh
# Prereqs: openshell CLI configured, sandbox created, secrets/secrets.env exists
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NAMESPACE="${NAMESPACE:-openshell}"
SANDBOX_NAME="${SANDBOX_NAME:-openclaw-gw}"
APPS_DOMAIN="${APPS_DOMAIN:-}"

# Load secrets
if [[ -f "${PROJECT_DIR}/secrets/secrets.env" ]]; then
  source "${PROJECT_DIR}/secrets/secrets.env"
fi
: "${MAAS_API_KEY:?MAAS_API_KEY required (set in secrets/secrets.env)}"

if [[ -z "$APPS_DOMAIN" ]]; then
  APPS_DOMAIN=$(oc get ingress.config.openshift.io cluster -o jsonpath='{.spec.domain}')
fi

# Get MLflow SA token for OTEL tracing (Phase 5)
MLFLOW_TOKEN="${MLFLOW_TOKEN:-}"
if [[ -z "$MLFLOW_TOKEN" ]]; then
  MLFLOW_TOKEN=$(oc -n "$NAMESPACE" get secret openshell-sandbox-mlflow-token \
    -o jsonpath='{.data.token}' 2>/dev/null | base64 -d 2>/dev/null || true)
fi
if [[ -z "$MLFLOW_TOKEN" ]]; then
  echo "[WARNING] MLflow token not available (tracing will not work until Phase 5 RBAC is deployed)"
  MLFLOW_TOKEN="placeholder-no-tracing"
fi

info() { echo "[INFO] $*"; }
error() { echo "[ERROR] $*" >&2; }

# Render openclaw.json from template
info "Rendering openclaw.json (injecting MAAS_API_KEY + APPS_DOMAIN + MLFLOW_TOKEN)"
CONFIG_RENDERED="${PROJECT_DIR}/.rendered/openclaw.json"
mkdir -p "$(dirname "$CONFIG_RENDERED")"
sed -e "s|__MAAS_API_KEY__|${MAAS_API_KEY}|g" \
    -e "s|__APPS_DOMAIN__|${APPS_DOMAIN}|g" \
    -e "s|__MLFLOW_TOKEN__|${MLFLOW_TOKEN}|g" \
    -e "s|__MLFLOW_EXPERIMENT_ID__|${MLFLOW_EXPERIMENT_ID:-1}|g" \
    "${PROJECT_DIR}/config/openclaw.json.tpl" > "$CONFIG_RENDERED"

# Identify the sandbox pod
SANDBOX_POD="${SANDBOX_NAME}"
if ! oc -n "$NAMESPACE" get pod "$SANDBOX_POD" &>/dev/null; then
  error "Sandbox pod '$SANDBOX_POD' not found. Create it first:"
  error "  openshell sandbox create --name $SANDBOX_NAME --policy policies/openclaw-sandbox.yaml"
  exit 1
fi
info "Using sandbox pod: $SANDBOX_POD"

# Step 1: Kill any existing gateway process (constraint #6)
info "Cleaning stale gateway processes..."
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c \
  'for p in $(pgrep -f "openclaw|node" 2>/dev/null); do kill -9 $p 2>/dev/null; done; sleep 2; rm -f /sandbox/workspace/.openclaw/state/*.lock /tmp/openclaw*/*.lock' 2>/dev/null || true

# Step 1b: Ensure OpenClaw is installed (oc exec has unrestricted network)
info "Ensuring OpenClaw is installed..."
if ! oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- which openclaw &>/dev/null; then
  info "Installing OpenClaw via npm..."
  oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- npm install -g openclaw
fi
OPENCLAW_VERSION=$(oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- openclaw --version 2>&1)
info "OpenClaw version: $OPENCLAW_VERSION"

# Step 1c: Install diagnostics-otel plugin (needs unrestricted network)
# Plugin ownership must be root (OpenClaw security check blocks non-root plugins)
info "Ensuring diagnostics-otel plugin is installed..."
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c \
  "HOME=/sandbox/workspace openclaw plugins install @openclaw/diagnostics-otel 2>&1 || true" | grep -v "already installed" || true
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- \
  chown -R root:root /sandbox/workspace/.openclaw/npm 2>/dev/null || true

# Step 2: Upload config to the correct path (constraint #1: workspace is writable)
# OpenClaw reads config from $HOME/.openclaw/openclaw.json
info "Uploading openclaw.json to sandbox..."
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- mkdir -p /sandbox/workspace/.openclaw
oc -n "$NAMESPACE" cp "$CONFIG_RENDERED" "${SANDBOX_POD}:/sandbox/workspace/.openclaw/openclaw.json" -c agent

# Step 3: Ensure workspace directories exist with correct ownership (constraint #13)
info "Setting up workspace directories and ownership..."
oc -n "$NAMESPACE" exec "$SANDBOX_POD" -c agent -- bash -c '
  mkdir -p /sandbox/workspace/.openclaw/state /sandbox/workspace/.openclaw/agents /sandbox/workspace/.openclaw/extensions
  chown -R sandbox:sandbox /sandbox/workspace/.openclaw
  touch /sandbox/workspace/openclaw-workspace-state.json
  chown sandbox:sandbox /sandbox/workspace/openclaw-workspace-state.json
'

# Step 4: Start the gateway in the sandbox network namespace (constraint #11)
# OPENCLAW_TEMP override: OpenShell assigns arbitrary UIDs (1000820000) which fail
# the "unsafe temp dir" ownership check. Redirect to a writable workspace path.
# NODE_TLS_REJECT_UNAUTHORIZED=0: Required for OTEL export to MLflow (internal TLS cert).
# OPENCLAW_GATEWAY_TOKEN: Required for CLI WebSocket auth to the gateway.
info "Starting OpenClaw gateway via sandbox exec..."
openshell sandbox exec -n "$SANDBOX_POD" --no-tty \
  --env HOME=/sandbox/workspace \
  -- bash -c 'export OPENCLAW_TEMP=/sandbox/workspace/.openclaw/tmp NODE_TLS_REJECT_UNAUTHORIZED=0 OPENCLAW_GATEWAY_TOKEN=sandbox-gw-token-2026 && mkdir -p /sandbox/workspace/.openclaw/tmp && cd /sandbox/workspace && nohup openclaw gateway run --force > openclaw.log 2>&1 & disown && echo "gateway-started:pid=$!"'

# Step 5: Verify gateway is running
sleep 5
info "Verifying gateway health..."
openshell sandbox exec -n "$SANDBOX_POD" --no-tty \
  -- bash -c 'curl -sf http://127.0.0.1:18789/health || exit 1' && \
  info "OpenClaw gateway running on :18789" || \
  { error "Gateway health check failed. Check: openshell sandbox exec -n $SANDBOX_POD -- cat /sandbox/workspace/openclaw.log"; exit 1; }

info "OpenClaw launched successfully in sandbox '$SANDBOX_NAME'"
info "Access UI: https://openclaw-gw-${NAMESPACE}.${APPS_DOMAIN}"
