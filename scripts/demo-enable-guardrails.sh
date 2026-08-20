#!/usr/bin/env bash
# demo-enable-guardrails.sh — Live demo Cambio 2: route inference.local via NeMo Guardrails.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

load_inference_config || exit 1
command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }

openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true

step "Enabling NeMo Guardrails inference path"
info "Provider: ${PROVIDER_GUARDRAILED} → ${NEMO_GUARDRAILS_URL}"
info "Model: ${INFERENCE_MODEL}"

if ! openshell provider list 2>/dev/null | grep -q "${PROVIDER_GUARDRAILED}"; then
  error "Provider '${PROVIDER_GUARDRAILED}' not found. Run: make -C deploy launch-openclaw"
  exit 1
fi

openshell inference set --provider "${PROVIDER_GUARDRAILED}" --model "${INFERENCE_MODEL}" --no-verify
pass "Inference route: ${PROVIDER_GUARDRAILED} / ${INFERENCE_MODEL} (NeMo Guardrails active)"
