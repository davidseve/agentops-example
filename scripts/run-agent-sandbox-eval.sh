#!/usr/bin/env bash
# Create an ephemeral venv and run evals/agent_sandbox_eval.py.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPT_DIR}/common.sh"

load_secrets
detect_apps_domain || true
if [[ -z "${OPENCLAW_BASE_URL:-}" ]]; then
  export OPENCLAW_BASE_URL="https://${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}"
fi
# After export_playwright_env (workspace=openshell). Track 2 demo results go to evaluation.
export_eval_mlflow_env

VENV_DIR="${PROJECT_DIR}/evals/.venv"
REQ="${PROJECT_DIR}/evals/requirements.txt"
PY="${PROJECT_DIR}/evals/agent_sandbox_eval.py"

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
  "${VENV_DIR}/bin/pip" install -q --upgrade pip
  "${VENV_DIR}/bin/pip" install -q -r "$REQ"
fi

exec "${VENV_DIR}/bin/python" "$PY" "$@"
