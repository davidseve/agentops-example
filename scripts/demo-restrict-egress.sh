#!/usr/bin/env bash
# demo-restrict-egress.sh — Live demo Cambio 1: apply final sandbox network policy (block unauthorized egress).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

POLICY_FINAL="${POLICY_FINAL:-${PROJECT_DIR}/policies/openclaw-sandbox.yaml}"

command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }
[[ -f "$POLICY_FINAL" ]] || { error "Policy file not found: $POLICY_FINAL"; exit 1; }

openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true

step "Restricting sandbox egress (Cambio 1)"
info "Sandbox: ${SANDBOX_NAME}"
info "Policy: $(basename "$POLICY_FINAL")"

openshell policy set "${SANDBOX_NAME}" --policy "$POLICY_FINAL" --wait
pass "Egress restricted — unauthorized curl (e.g. github.com) should now be blocked"
