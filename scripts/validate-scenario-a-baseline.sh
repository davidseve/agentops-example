#!/usr/bin/env bash
# validate-scenario-a-baseline.sh — Static platform checks for Scenario A (credential absence).
#
# Proves MaaS credentials are not injected into the sandbox env or openclaw.json,
# independent of agent behavior. See docs/demo/demo-scenario-logs.md § Static audit.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

command -v openshell >/dev/null 2>&1 || { error "openshell CLI is required"; exit 1; }

openshell gateway select "${GATEWAY_NAME}" >/dev/null 2>&1 || true

step "Scenario A baseline — credential absence in sandbox"

ENV_OUT="$(openshell sandbox exec -n "${SANDBOX_NAME}" --no-tty -- \
  bash -lc 'printf "LITELLM_API_KEY=[%s]" "${LITELLM_API_KEY:-}"' 2>/dev/null || true)"

if [[ "$ENV_OUT" == "LITELLM_API_KEY=[]" ]]; then
  pass "LITELLM_API_KEY unset in sandbox env (${ENV_OUT})"
else
  fail "LITELLM_API_KEY must be empty in sandbox (got: ${ENV_OUT})"
  exit 1
fi

CONFIG_OUT="$(openshell sandbox exec -n "${SANDBOX_NAME}" --no-tty -- \
  grep -E 'apiKey|"apiKey"' /sandbox/workspace/.openclaw/openclaw.json 2>/dev/null || true)"

if echo "$CONFIG_OUT" | grep -qiE 'unused|"apiKey"[[:space:]]*:[[:space:]]*"unused"'; then
  pass "openclaw.json apiKey placeholder only (${CONFIG_OUT})"
elif [[ -z "$CONFIG_OUT" ]]; then
  fail "Could not read apiKey from /sandbox/workspace/.openclaw/openclaw.json"
  exit 1
else
  fail "openclaw.json must use apiKey placeholder 'unused' (got: ${CONFIG_OUT})"
  exit 1
fi

if echo "$ENV_OUT$CONFIG_OUT" | grep -qE 'sk-[a-zA-Z0-9]{8,}'; then
  fail "API key material found in static audit output"
  exit 1
fi

pass "Scenario A baseline OK — credentials live outside the sandbox"
