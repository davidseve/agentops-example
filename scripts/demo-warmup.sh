#!/usr/bin/env bash
# demo-warmup.sh — Demo cluster health check and post-AWS wake remediation.
#
# Usage:
#   ./scripts/demo-warmup.sh status       # layer-by-layer diagnosis only
#   ./scripts/demo-warmup.sh fix          # remediate + re-check (default)
#   ./scripts/demo-warmup.sh              # alias for fix
#   ./scripts/demo-warmup.sh fix --full-verify   # + VERIFY_PROFILE=demo SKIP_E2E=1 verify
#
# Exit codes (status and fix final pass):
#   0 — ready for demo backstage
#   1 — remediable issues remain (OpenClaw, demo policy, inference)
#   2 — platform broken; run demo-backstage-install
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

SUBCOMMAND="${1:-fix}"
shift || true

FULL_VERIFY=false
STATUS_ONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --full-verify) FULL_VERIFY=true; shift ;;
    --status-only) STATUS_ONLY=true; shift ;;
    fix|status)
      SUBCOMMAND="$1"
      shift
      ;;
    *)
      error "Unknown argument: $1"
      echo "Usage: $0 {status|fix} [--full-verify] [--status-only]" >&2
      exit 2
      ;;
  esac
done

if [[ "$STATUS_ONLY" == "true" ]]; then
  SUBCOMMAND="status"
fi

STATUS_JSON="${AGENT_STATUS_DIR:-${PROJECT_DIR}/.agent-status}/demo-warmup-status.json"
PLATFORM_OK=false
REMEDIABLE_FAIL=false

control_ui_url() {
  echo "https://${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}/"
}

mlflow_url() {
  echo "https://rh-ai.${APPS_DOMAIN}/mlflow"
}

print_summary_table() {
  echo ""
  echo "| Layer | Status |"
  echo "|---|---|"
  for layer in "${LAYER_ORDER[@]}"; do
    local icon="OK"
    case "${LAYER_STATUS[$layer]:-True}" in
      False) icon="FAIL" ;;
      *) icon="OK" ;;
    esac
    echo "| ${layer} | ${icon} |"
  done
  echo ""
}

require_tools() {
  step "Prerequisites"
  require_cmd oc
  require_cmd openshell
  load_secrets || return 1
  detect_apps_domain || return 1
  pass "CLI tools and secrets OK"
}

check_session() {
  step "Layer 1: Session"
  if oc whoami &>/dev/null; then
    pass "Logged in as $(oc whoami) ($(oc whoami --show-server))"
    return 0
  fi
  fail "Not logged into OpenShift — run oc login first"
  return 1
}

check_platform() {
  step "Layer 2: Platform RHOAI"
  if make -C "$DEPLOY_DIR" validate >/dev/null 2>&1; then
    PLATFORM_OK=true
    pass "RHOAI platform validate OK"
    return 0
  fi
  PLATFORM_OK=false
  fail "RHOAI platform validate failed — run demo-backstage-install (make -C deploy deploy-all)"
  return 1
}

check_openshell() {
  step "Layer 3: OpenShell"
  local ok=true
  if ! make -C "$DEPLOY_DIR" validate-openshell >/dev/null 2>&1; then
    fail "OpenShell validate-openshell failed"
    ok=false
  else
    pass "OpenShell infrastructure OK"
  fi
  openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true
  if openshell status 2>/dev/null | grep -q "Connected"; then
    pass "OpenShell CLI connected to gateway ${GATEWAY_NAME}"
  else
    fail "OpenShell CLI not connected — will re-register on fix"
    ok=false
  fi
  [[ "$ok" == "true" ]]
}

check_guardrails() {
  step "Layer 4: NeMo Guardrails"
  if make -C "$DEPLOY_DIR" validate-guardrails >/dev/null 2>&1; then
    pass "NeMo Guardrails Ready"
    return 0
  fi
  warn "NeMo Guardrails validate failed — use guardrails-cluster-install if needed for Cambio 2"
  return 0
}

check_openclaw() {
  step "Layer 5: OpenClaw gateway"
  local ok=true
  openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true
  if make -C "$DEPLOY_DIR" validate-openclaw >/dev/null 2>&1; then
    pass "OpenClaw gateway healthy"
  else
    fail "OpenClaw gateway down or unreachable"
    REMEDIABLE_FAIL=true
    ok=false
  fi
  local ui_code
  ui_code=$(curl -sk -o /dev/null -w "%{http_code}" "$(control_ui_url)" 2>/dev/null || echo "000")
  case "$ui_code" in
    200|301|302)
      pass "Control UI HTTP ${ui_code}"
      ;;
    *)
      fail "Control UI HTTP ${ui_code} (expected 200) — $(control_ui_url)"
      REMEDIABLE_FAIL=true
      ok=false
      ;;
  esac
  [[ "$ok" == "true" ]]
}

check_demo_initial() {
  step "Layer 6: Demo initial state"
  local ok=true
  openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true
  local provider
  provider=$(openshell inference get 2>/dev/null | awk '/Provider:/ {print $2; exit}' || true)
  if [[ "$provider" == "maas-direct" ]]; then
    pass "Inference provider maas-direct"
  else
    fail "Inference provider is '${provider:-unknown}' (expected maas-direct)"
    REMEDIABLE_FAIL=true
    ok=false
  fi
  if make -C "$DEPLOY_DIR" validate-demo-initial >/dev/null 2>&1; then
    pass "Demo-initial policy (MLflow-only egress + inference.local)"
  else
    fail "Demo-initial policy check failed"
    REMEDIABLE_FAIL=true
    ok=false
  fi
  [[ "$ok" == "true" ]]
}

cmd_status() {
  require_tools || return 2
  check_session || true
  check_platform || true
  if [[ "$PLATFORM_OK" == "true" ]]; then
    check_openshell || REMEDIABLE_FAIL=true
    check_guardrails || true
    check_openclaw || true
    check_demo_initial || true
  fi

  mkdir -p "$(dirname "$STATUS_JSON")"
  emit_conditions_json "$STATUS_JSON"
  print_summary_table

  info "Control UI: $(control_ui_url)"
  info "MLflow: $(mlflow_url)"

  if [[ "$PLATFORM_OK" != "true" ]]; then
    return 2
  fi
  if [[ "$REMEDIABLE_FAIL" == "true" || "$FAIL_COUNT" -gt 0 ]]; then
    return 1
  fi
  return 0
}

cmd_fix() {
  local status_before=0
  cmd_status || status_before=$?

  if [[ "$status_before" -eq 0 ]]; then
    step "Demo warmup"
    pass "Cluster already ready for demo — no remediation needed"
    return 0
  fi

  if [[ "$status_before" -eq 2 ]]; then
    error "Platform not healthy — run demo-backstage-install before warmup fix"
    return 2
  fi

  step "Remediating demo runtime (post-AWS wake)"
  make -C "$DEPLOY_DIR" openshell-register-gateway
  pass "OpenShell gateway registered"

  POLICY_FILE="$POLICY_DEFAULT" \
    INFERENCE_BACKEND=direct \
    APPS_DOMAIN="$APPS_DOMAIN" \
    make -C "$DEPLOY_DIR" launch-openclaw
  pass "OpenClaw relaunched"

  "${SCRIPT_DIR}/demo-reset.sh"
  pass "Demo reset applied"

  if [[ "$FULL_VERIFY" == "true" ]]; then
    step "Full verify (demo profile, skip Playwright E2E)"
    VERIFY_PROFILE=demo SKIP_E2E=1 "${SCRIPT_DIR}/verify.sh"
  fi

  step "Re-check after remediation"
  REMEDIABLE_FAIL=false
  FAIL_COUNT=0
  PASS_COUNT=0
  WARN_COUNT=0
  LAYER_ORDER=()
  unset LAYER_STATUS LAYER_PASS LAYER_FAIL LAYER_WARN
  declare -gA LAYER_STATUS LAYER_PASS LAYER_FAIL LAYER_WARN
  declare -ga LAYER_ORDER

  local final=0
  cmd_status || final=$?

  if [[ "$final" -eq 0 ]]; then
    pass "Demo cluster ready — start a New session in Control UI before Tests A–D"
  fi
  return "$final"
}

_started_at=""
_finished_at=""
_exit_code=0

if [[ -f "${SCRIPT_DIR}/lib/agent-run.sh" ]]; then
  # shellcheck source=lib/agent-run.sh
  source "${SCRIPT_DIR}/lib/agent-run.sh"
  _started_at="$(agent_run_now)"
fi

case "$SUBCOMMAND" in
  status)
    cmd_status || _exit_code=$?
    ;;
  fix)
    cmd_fix || _exit_code=$?
    ;;
  *)
    error "Unknown subcommand: $SUBCOMMAND"
    echo "Usage: $0 {status|fix} [--full-verify] [--status-only]" >&2
    _exit_code=2
    ;;
esac

if [[ -f "${SCRIPT_DIR}/lib/agent-run.sh" ]]; then
  _finished_at="$(agent_run_now)"
  agent_run_finish "demo-warmup-${SUBCOMMAND}" "$_exit_code" "$_started_at" "$_finished_at" "" "$0 $SUBCOMMAND" ""
fi

exit "$_exit_code"
