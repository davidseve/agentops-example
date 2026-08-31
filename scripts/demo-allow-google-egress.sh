#!/usr/bin/env bash
# demo-allow-google-egress.sh — Live demo Cambio 1: allowlist google.com egress for Test C.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }
[[ -f "$POLICY_GOOGLE_EGRESS" ]] || { error "Policy file not found: $POLICY_GOOGLE_EGRESS"; exit 1; }

openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true

step "Allowing google.com egress (Cambio 1)"
info "Sandbox: ${SANDBOX_NAME}"
info "Policy: $(basename "$POLICY_GOOGLE_EGRESS")"

openshell policy set "${SANDBOX_NAME}" --policy "$POLICY_GOOGLE_EGRESS" --wait
pass "Google egress allowed — curl to google.com should succeed; github.com remains blocked"
