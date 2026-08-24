#!/usr/bin/env bash
# demo-reset.sh — Reset live demo to initial state (direct MaaS + permissive demo egress policy).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

POLICY_INITIAL="${POLICY_DEMO_INITIAL:-${PROJECT_DIR}/policies/openclaw-demo-initial.yaml}"

command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }
[[ -f "$POLICY_INITIAL" ]] || { error "Policy file not found: $POLICY_INITIAL"; exit 1; }

openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true

step "Resetting demo to initial state"
info "Sandbox: ${SANDBOX_NAME}"
info "Policy: $(basename "$POLICY_INITIAL")"

"${SCRIPT_DIR}/demo-disable-guardrails.sh"

openshell policy set "${SANDBOX_NAME}" --policy "$POLICY_INITIAL" --wait
pass "Demo reset complete — direct MaaS + permissive egress (start New session in Control UI before re-running A–D)"
