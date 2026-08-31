#!/usr/bin/env bash
# common.sh — shared helpers for cluster-lifecycle.sh and verify.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${PROJECT_DIR}/deploy"

NAMESPACE="${NAMESPACE:-openshell}"
SANDBOX_NAME="${SANDBOX_NAME:-openclaw-gw}"
GATEWAY_NAME="${GATEWAY_NAME:-ocp}"
OPENSHELL_RELEASE_NAME="${OPENSHELL_RELEASE_NAME:-openshell}"
SANDBOX_SA_NAME="${SANDBOX_SA_NAME:-${OPENSHELL_RELEASE_NAME}-sandbox}"
RHOAI_NS="${RHOAI_NS:-redhat-ods-applications}"
MLFLOW_EXPERIMENT_NAME="${MLFLOW_EXPERIMENT_NAME:-openclaw-tracing}"
APPS_DOMAIN="${APPS_DOMAIN:-}"

SECRETS_FILE="${SECRETS_FILE:-${PROJECT_DIR}/secrets/secrets.env}"
POLICY_GITHUB_EGRESS="${POLICY_GITHUB_EGRESS:-${PROJECT_DIR}/config/openshell/github-egress.yaml}"
POLICY_DEFAULT="${POLICY_DEFAULT:-${PROJECT_DIR}/config/openshell/default.yaml}"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

CURRENT_LAYER="unclassified"
declare -A LAYER_STATUS
declare -A LAYER_PASS
declare -A LAYER_FAIL
declare -A LAYER_WARN
declare -a LAYER_ORDER

condition() {
  local kind="$1" layer="$2"
  if [[ -z "${LAYER_STATUS[$layer]+x}" ]]; then
    LAYER_STATUS["$layer"]="True"
    LAYER_PASS["$layer"]=0
    LAYER_FAIL["$layer"]=0
    LAYER_WARN["$layer"]=0
    LAYER_ORDER+=("$layer")
  fi
  case "$kind" in
    fail)
      LAYER_STATUS["$layer"]="False"
      LAYER_FAIL["$layer"]=$((LAYER_FAIL[$layer] + 1))
      ;;
    pass)
      LAYER_PASS["$layer"]=$((LAYER_PASS[$layer] + 1))
      ;;
    warn)
      LAYER_WARN["$layer"]=$((LAYER_WARN[$layer] + 1))
      ;;
  esac
}

emit_conditions_json() {
  local out="$1"
  {
    echo "{"
    echo "  \"generatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"summary\": {\"pass\": ${PASS_COUNT}, \"fail\": ${FAIL_COUNT}, \"warn\": ${WARN_COUNT}},"
    echo "  \"conditions\": ["
    local i=0 n=${#LAYER_ORDER[@]}
    for layer in "${LAYER_ORDER[@]}"; do
      i=$((i + 1))
      local escaped_layer=${layer//\"/\\\"}
      printf '    {"type": "%s", "status": "%s", "pass": %d, "fail": %d, "warn": %d}' \
        "$escaped_layer" "${LAYER_STATUS[$layer]}" "${LAYER_PASS[$layer]}" "${LAYER_FAIL[$layer]}" "${LAYER_WARN[$layer]}"
      [[ $i -lt $n ]] && echo "," || echo ""
    done
    echo "  ]"
    echo "}"
  } >"$out"
  info "Structured conditions written to $out"
}

step()  { echo "==> $*"; CURRENT_LAYER="$*"; }
info()  { echo "    $*"; }
warn()  { echo "    [WARN] $*"; WARN_COUNT=$((WARN_COUNT + 1)); condition warn "$CURRENT_LAYER"; }
error() { echo "    [ERROR] $*" >&2; }
pass()  { echo "    [PASS] $*"; PASS_COUNT=$((PASS_COUNT + 1)); condition pass "$CURRENT_LAYER"; }
fail()  { echo "    [FAIL] $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); condition fail "$CURRENT_LAYER"; }

detect_apps_domain() {
  local detected
  detected=$(oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}' 2>/dev/null || true)
  if [[ -n "$APPS_DOMAIN" ]]; then
    if [[ -n "$detected" && "$APPS_DOMAIN" != "$detected" ]]; then
      warn "APPS_DOMAIN=$APPS_DOMAIN does not match cluster ingress $detected — using cluster domain"
      APPS_DOMAIN="$detected"
    else
      info "APPS_DOMAIN already set: $APPS_DOMAIN"
    fi
  else
    APPS_DOMAIN="$detected"
    if [[ -z "$APPS_DOMAIN" ]]; then
      error "Could not detect apps domain from cluster. Set APPS_DOMAIN manually."
      return 1
    fi
    info "Detected APPS_DOMAIN: $APPS_DOMAIN"
  fi
  export APPS_DOMAIN
}

load_secrets() {
  if [[ ! -f "$SECRETS_FILE" ]]; then
    error "Missing secrets file: $SECRETS_FILE"
    error "Copy secrets/secrets.template.env to secrets/secrets.env and fill in values."
    return 1
  fi
  set -a
  # shellcheck source=/dev/null
  source "$SECRETS_FILE"
  set +a
  if [[ -z "${MAAS_API_KEY:-}" ]]; then
    error "MAAS_API_KEY not set in $SECRETS_FILE"
    return 1
  fi
  if [[ -z "${OPENCLAW_GATEWAY_PASSWORD:-}" ]]; then
    error "OPENCLAW_GATEWAY_PASSWORD not set in $SECRETS_FILE"
    return 1
  fi
  info "Secrets loaded from $SECRETS_FILE"
}

# Single source of truth for inference + NeMo wiring (secrets/secrets.env).
load_inference_config() {
  load_secrets || return 1

  INFERENCE_MODEL="${INFERENCE_MODEL:-claude-sonnet-4-6}"
  MAAS_BASE_URL="${MAAS_BASE_URL:-https://maas-rhdp.apps.maas.redhatworkshops.io/v1}"
  INFERENCE_BACKEND="${INFERENCE_BACKEND:-direct}"
  NEMO_GUARDRAILS_SERVICE="${NEMO_GUARDRAILS_SERVICE:-nemo-guardrails}"
  NEMO_GUARDRAILS_NAMESPACE="${NEMO_GUARDRAILS_NAMESPACE:-openshell}"
  NEMO_GUARDRAILS_PORT="${NEMO_GUARDRAILS_PORT:-80}"
  PROVIDER_DIRECT="${PROVIDER_DIRECT:-maas-direct}"
  PROVIDER_GUARDRAILED="${PROVIDER_GUARDRAILED:-maas-guardrailed}"

  if [[ -z "${NEMO_GUARDRAILS_URL:-}" ]]; then
    NEMO_GUARDRAILS_URL="http://${NEMO_GUARDRAILS_SERVICE}.${NEMO_GUARDRAILS_NAMESPACE}.svc.cluster.local:${NEMO_GUARDRAILS_PORT}/v1"
  fi

  case "$INFERENCE_BACKEND" in
    direct|guardrailed) ;;
    *)
      error "INFERENCE_BACKEND must be 'direct' or 'guardrailed' (got: ${INFERENCE_BACKEND})"
      return 1
      ;;
  esac

  export INFERENCE_MODEL MAAS_BASE_URL INFERENCE_BACKEND
  export NEMO_GUARDRAILS_SERVICE NEMO_GUARDRAILS_NAMESPACE NEMO_GUARDRAILS_PORT NEMO_GUARDRAILS_URL
  export PROVIDER_DIRECT PROVIDER_GUARDRAILED
  info "Inference config: model=${INFERENCE_MODEL} backend=${INFERENCE_BACKEND} maas=${MAAS_BASE_URL}"
  info "NeMo service URL: ${NEMO_GUARDRAILS_URL}"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" &>/dev/null; then
    error "Required command not found: $cmd"
    return 1
  fi
  info "$cmd: $(command -v "$cmd")"
}

export_playwright_env() {
  detect_apps_domain || return 1
  if [[ -f "$SECRETS_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$SECRETS_FILE"
    set +a
  fi
  export OPENCLAW_BASE_URL="https://${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}"
  export MLFLOW_BASE_URL="https://rh-ai.${APPS_DOMAIN}/mlflow"
  export MLFLOW_WORKSPACE="$NAMESPACE"
  if [[ -n "${OCP_TEST_USERNAME:-}" ]]; then
    export OCP_TEST_USERNAME
  fi
  if [[ -n "${OCP_TEST_PASSWORD:-}" ]]; then
    export OCP_TEST_PASSWORD
  fi
  if oc -n "$NAMESPACE" get secret "${SANDBOX_SA_NAME}-mlflow-token" &>/dev/null; then
    export MLFLOW_AUTH_TOKEN
    MLFLOW_AUTH_TOKEN="$(oc -n "$NAMESPACE" get secret "${SANDBOX_SA_NAME}-mlflow-token" \
      -o jsonpath='{.data.token}' | base64 -d)"
  else
    warn "Secret ${SANDBOX_SA_NAME}-mlflow-token not found — MLflow API tests may fail"
  fi
  info "OPENCLAW_BASE_URL=$OPENCLAW_BASE_URL"
  info "MLFLOW_BASE_URL=$MLFLOW_BASE_URL"
  info "MLFLOW_WORKSPACE=$MLFLOW_WORKSPACE"
  resolve_mlflow_experiment_id || warn "MLFLOW_EXPERIMENT_ID not resolved — mlflow-ui-tests may fail"
}

# Pick a pod that can reach mlflow.<rhoai-ns>.svc from inside the cluster.
_mlflow_exec_target() {
  if oc -n "$NAMESPACE" get pod "$SANDBOX_NAME" &>/dev/null 2>&1; then
    _MLFLOW_EXEC_POD="$SANDBOX_NAME"
    _MLFLOW_EXEC_CONTAINER="agent"
    return 0
  fi
  local gw_pod
  gw_pod="$(oc -n "$NAMESPACE" get pods -l app.kubernetes.io/name=openshell \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -n "$gw_pod" ]]; then
    _MLFLOW_EXEC_POD="$gw_pod"
    _MLFLOW_EXEC_CONTAINER=""
    return 0
  fi
  return 1
}

_mlflow_cluster_curl() {
  local curl_cmd="$1"
  if ! _mlflow_exec_target; then
    warn "No sandbox or OpenShell pod in ${NAMESPACE} for MLflow API calls"
    return 1
  fi
  if [[ -n "$_MLFLOW_EXEC_CONTAINER" ]]; then
    oc -n "$NAMESPACE" exec "$_MLFLOW_EXEC_POD" -c "$_MLFLOW_EXEC_CONTAINER" -- \
      bash -c "$curl_cmd" 2>/dev/null || true
  else
    oc -n "$NAMESPACE" exec "$_MLFLOW_EXEC_POD" -- \
      bash -c "$curl_cmd" 2>/dev/null || true
  fi
}

read_mlflow_sa_token() {
  if [[ -n "${MLFLOW_TOKEN:-}" ]]; then
    return 0
  fi
  if ! oc -n "$NAMESPACE" get secret "${SANDBOX_SA_NAME}-mlflow-token" &>/dev/null; then
    warn "Secret ${SANDBOX_SA_NAME}-mlflow-token not found"
    return 1
  fi
  MLFLOW_TOKEN="$(oc -n "$NAMESPACE" get secret "${SANDBOX_SA_NAME}-mlflow-token" \
    -o jsonpath='{.data.token}' | base64 -d)"
  export MLFLOW_TOKEN
  return 0
}

# Get-or-create openclaw-tracing in the target workspace (ids are per-workspace).
ensure_mlflow_experiment() {
  local experiment_name="${MLFLOW_EXPERIMENT_NAME:-openclaw-tracing}"
  local workspace="${MLFLOW_WORKSPACE:-$NAMESPACE}"
  local mlflow_url="https://mlflow.${RHOAI_NS}.svc:8443"
  local exp_json exp_id token

  if [[ -n "${MLFLOW_EXPERIMENT_ID:-}" && "${MLFLOW_EXPERIMENT_ID}" != "__RESOLVE__" ]]; then
    info "MLFLOW_EXPERIMENT_ID=${MLFLOW_EXPERIMENT_ID}"
    return 0
  fi

  if ! read_mlflow_sa_token; then
    return 1
  fi
  token="$MLFLOW_TOKEN"

  exp_json="$(_mlflow_cluster_curl \
    "curl -sk '${mlflow_url}/api/2.0/mlflow/experiments/get-by-name?experiment_name=${experiment_name}' \
      -H 'Authorization: Bearer ${token}' \
      -H 'X-MLFLOW-WORKSPACE: ${workspace}'")"
  exp_id="$(echo "$exp_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('experiment',{}).get('experiment_id',''))" 2>/dev/null || true)"

  if [[ -z "$exp_id" ]]; then
    info "Creating MLflow experiment '${experiment_name}' in workspace ${workspace}"
    exp_json="$(_mlflow_cluster_curl \
      "curl -sk -X POST \
        -H 'Authorization: Bearer ${token}' \
        -H 'X-MLFLOW-WORKSPACE: ${workspace}' \
        -H 'Content-Type: application/json' \
        -d '{\"name\": \"${experiment_name}\"}' \
        '${mlflow_url}/api/2.0/mlflow/experiments/create'")"
    exp_id="$(echo "$exp_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('experiment',{}).get('experiment_id',''))" 2>/dev/null || true)"
  fi

  if [[ -z "$exp_id" ]]; then
    warn "Could not get or create experiment '${experiment_name}' in workspace ${workspace}"
    warn "Last MLflow response: ${exp_json:-<empty>}"
    return 1
  fi

  export MLFLOW_EXPERIMENT_ID="$exp_id"
  info "MLflow experiment ${experiment_name} → id=${MLFLOW_EXPERIMENT_ID} (workspace=${workspace})"
  return 0
}

# Resolve openclaw-tracing experiment id for the target workspace (ids are per-workspace).
resolve_mlflow_experiment_id() {
  ensure_mlflow_experiment
}

warn_playwright_mlflow_oauth_missing() {
  local ocp_username="${OCP_TEST_USERNAME:-}"
  local ocp_password="${OCP_TEST_PASSWORD:-}"
  if [[ -f "$SECRETS_FILE" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$SECRETS_FILE"
    set +a
    ocp_username="${OCP_TEST_USERNAME:-}"
    ocp_password="${OCP_TEST_PASSWORD:-}"
  fi
  if [[ -z "$ocp_username" || -z "$ocp_password" ]]; then
    warn "OCP_TEST_USERNAME and OCP_TEST_PASSWORD must be set in secrets/secrets.env for mlflow-ui-tests"
    warn "Use the OpenShift web login credentials for the MLflow UI route"
  fi
}

ensure_playwright_deps() {
  local tests_dir="${PROJECT_DIR}/tests"
  if [[ ! -d "$tests_dir/node_modules" ]]; then
    step "Installing Playwright test dependencies"
    (cd "$tests_dir" && npm install)
  fi
  if [[ ! -d "$HOME/.cache/ms-playwright" ]] && [[ ! -d "${tests_dir}/node_modules/playwright-core/.local-browsers" ]]; then
    step "Installing Playwright chromium"
    (cd "$tests_dir" && npx playwright install chromium)
  else
    info "Playwright dependencies present"
  fi
}
