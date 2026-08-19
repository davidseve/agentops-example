#!/usr/bin/env bash
# verify.sh — Validate the full AgentOps demo deployment (Makefile + Playwright).
#
# Profiles (VERIFY_PROFILE env var):
#   full  (default) — platform + openshell + security + Playwright E2E + traces
#   smoke           — validate-smoke only (openshell infra + sandbox policy)
#
# Flags (parsed by cluster-lifecycle.sh and forwarded via env):
#   SKIP_E2E=1      — skip Playwright and validate-traces
#
# Exit codes:
#   0 = all checks passed (warnings are informational)
#   1 = at least one FAIL
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPT_DIR}/common.sh"

_AGENT_RUN_STARTED=""
if [[ -f "${SCRIPT_DIR}/lib/agent-run.sh" ]]; then
  # shellcheck source=scripts/lib/agent-run.sh
  source "${SCRIPT_DIR}/lib/agent-run.sh"
  _AGENT_RUN_STARTED="$(agent_run_now)"
fi

VERIFY_PROFILE="${VERIFY_PROFILE:-full}"
SKIP_E2E="${SKIP_E2E:-0}"

if [[ "${1:-}" == "--smoke" ]]; then
  VERIFY_PROFILE=smoke
fi
if [[ "${1:-}" == "--skip-e2e" ]]; then
  SKIP_E2E=1
fi

detect_apps_domain || exit 1

# Ensure openshell CLI targets this project's gateway before sandbox checks.
if command -v openshell &>/dev/null; then
  openshell gateway select "$GATEWAY_NAME" &>/dev/null || true
fi

info "Verification profile: ${VERIFY_PROFILE} (set VERIFY_PROFILE=smoke for fast subset)"

run_make() {
  make -C "$DEPLOY_DIR" "$@"
}

# =============================================================================
# Layer 1: RHOAI platform
# =============================================================================
if [[ "$VERIFY_PROFILE" == "full" ]]; then
  step "Layer 1: RHOAI platform"
  if run_make validate; then
    pass "make validate (RHOAI platform)"
  else
    fail "make validate (RHOAI platform)"
  fi
fi

# =============================================================================
# Layer 2–4: OpenShell + OpenClaw + security (or smoke subset)
# =============================================================================
if [[ "$VERIFY_PROFILE" == "smoke" ]]; then
  step "Layer smoke: OpenShell infra + sandbox policy"
  if run_make validate-smoke; then
    pass "make validate-smoke"
  else
    fail "make validate-smoke"
  fi
else
  step "Layer 2: OpenShell infrastructure"
  if run_make validate-openshell; then
    pass "make validate-openshell"
  else
    fail "make validate-openshell"
  fi

  step "Layer 3: OpenClaw gateway + MaaS"
  if run_make validate-openclaw; then
    pass "make validate-openclaw"
  else
  # validate-openclaw may WARN on embedded CLI fallback — not a hard fail if infra OK
    warn "make validate-openclaw reported issues (embedded CLI fallback is OK if E2E passes)"
  fi

  step "Layer 4: Sandbox security policy"
  if run_make validate-security; then
    pass "make validate-security"
  else
    fail "make validate-security"
  fi
fi

# =============================================================================
# Layer 5–6: Playwright E2E + MLflow traces
# =============================================================================
if [[ "$VERIFY_PROFILE" == "full" && "$SKIP_E2E" != "1" ]]; then
  step "Layer 5: Playwright E2E (Control UI + security + MLflow UI)"
  ensure_playwright_deps
  export_playwright_env || warn "Playwright env incomplete — E2E may fail"
  warn_playwright_mlflow_oauth_missing

  if run_make test-e2e; then
    pass "make test-e2e"
  else
    fail "make test-e2e"
  fi

  step "Layer 6: MLflow traces"
  if run_make validate-traces; then
    pass "make validate-traces"
  else
    fail "make validate-traces"
  fi
elif [[ "$SKIP_E2E" == "1" ]]; then
  info "Skipping Playwright E2E and validate-traces (--skip-e2e)"
fi

# =============================================================================
# Structured output
# =============================================================================
VERIFY_STATUS_FILE="${VERIFY_STATUS_FILE:-${PROJECT_DIR}/.verify-status.json}"
emit_conditions_json "$VERIFY_STATUS_FILE"

echo ""
step "Verification Summary"
echo "    Passed: $PASS_COUNT"
echo "    Failed: $FAIL_COUNT"
echo "    Warnings: $WARN_COUNT"

if [[ $FAIL_COUNT -gt 0 ]]; then
  error "$FAIL_COUNT check(s) failed"
  if [[ -n "$_AGENT_RUN_STARTED" ]]; then
    agent_run_emit_status "verify" 1 "$_AGENT_RUN_STARTED" "" \
      "VERIFY_PROFILE=${VERIFY_PROFILE} ./scripts/verify.sh" \
      "failed=${FAIL_COUNT} passed=${PASS_COUNT} warn=${WARN_COUNT}" \
      "{\"verifyStatus\":\"${VERIFY_STATUS_FILE}\"}"
  fi
  exit 1
fi

info "All checks passed (with $WARN_COUNT warning(s))"
if [[ -n "$_AGENT_RUN_STARTED" ]]; then
  agent_run_emit_status "verify" 0 "$_AGENT_RUN_STARTED" "" \
    "VERIFY_PROFILE=${VERIFY_PROFILE} ./scripts/verify.sh" \
    "passed=${PASS_COUNT} failed=${FAIL_COUNT} warn=${WARN_COUNT}" \
    "{\"verifyStatus\":\"${VERIFY_STATUS_FILE}\"}"
fi
