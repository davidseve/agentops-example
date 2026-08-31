#!/usr/bin/env bash
# demo-reset.sh — Reset live demo to initial state (direct MaaS + MLflow-only egress policy).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }
[[ -f "$POLICY_DEFAULT" ]] || { error "Policy file not found: $POLICY_DEFAULT"; exit 1; }

openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true

step "Resetting demo to initial state"
info "Sandbox: ${SANDBOX_NAME}"
info "Policy: $(basename "$POLICY_DEFAULT")"

"${SCRIPT_DIR}/demo-disable-guardrails.sh"

openshell policy set "${SANDBOX_NAME}" --policy "$POLICY_DEFAULT" --wait
pass "Demo reset complete — direct MaaS + MLflow-only egress (start New session in Control UI before Scenario C)"
