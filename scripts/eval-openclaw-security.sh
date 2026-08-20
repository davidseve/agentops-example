#!/usr/bin/env bash
# eval-openclaw-security.sh — operator entry point for OpenClaw security evals.
#
# Usage:
#   ./scripts/eval-openclaw-security.sh smoke         # Track 2 HTTP, 1–2 YAML cases
#   ./scripts/eval-openclaw-security.sh sandbox       # Track 2 full YAML dataset
#   ./scripts/eval-openclaw-security.sh garak-quick   # EvalHub Garak 'quick' from Helm CM
#   ./scripts/eval-openclaw-security.sh garak-owasp   # EvalHub Garak owasp_llm_top10
#   ./scripts/eval-openclaw-security.sh all           # smoke + sandbox + garak-quick
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPT_DIR}/common.sh"

cmd="${1:-help}"

run_sandbox() {
  local extra=()
  if [[ "${1:-}" == "--smoke" ]]; then
    extra+=(--smoke)
  fi
  load_secrets
  detect_apps_domain
  export_playwright_env || true
  "${SCRIPT_DIR}/run-agent-sandbox-eval.sh" "${extra[@]}"
}

run_garak() {
  local job="$1"
  load_secrets
  ensure_evalhub_model_auth_api_key
  "${SCRIPT_DIR}/evalhub.sh" submit --job "$job" --wait
}

cmd_help() {
  cat <<'USAGE'
OpenClaw security evaluation (EvalHub Garak + MLflow sandbox scorers).

  smoke         Track 2 HTTP sandbox smoke (1–2 cases). Default verify uses this.
  sandbox       Track 2 full YAML dataset (evals/sandbox-cases.yaml)
  garak-quick   Track 1 EvalHub Garak benchmark 'quick' (Helm job smoke)
  garak-owasp   Track 1 EvalHub Garak owasp_llm_top10 (Helm job owasp)
  all           smoke + sandbox + garak-quick (not owasp)

Garak job templates live in deploy/helm/evalhub/values.yaml (evalhub.securityEval).
See docs/SECURITY-EVALUATION.md.
USAGE
}

case "$cmd" in
  smoke)       run_sandbox --smoke ;;
  sandbox)     run_sandbox ;;
  garak-quick) run_garak smoke ;;
  garak-owasp) run_garak owasp ;;
  all)
    run_sandbox --smoke
    run_sandbox
    run_garak smoke
    ;;
  help|--help|-h) cmd_help ;;
  *) echo "Unknown command: $cmd" >&2; cmd_help; exit 1 ;;
esac
