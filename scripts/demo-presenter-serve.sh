#!/usr/bin/env bash
# Start the live companion static server and the local observability proxy.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

DOCS_DIR="${PROJECT_DIR}/docs"
PROXY_SCRIPT="${SCRIPT_DIR}/demo-observability-proxy.py"
HTTP_PORT="${DEMO_HTTP_PORT:-8765}"
PROXY_PORT="${DEMO_PROXY_PORT:-8766}"

CHECK_ONLY=false
PIDS=()

usage() {
  cat <<EOF
Usage: $0 [--check-only]

  Start the live companion UI (port ${HTTP_PORT}) and observability proxy (${PROXY_PORT}).

  Runs a light cluster preflight (oc, openshell, sandbox + gateway pods) before binding ports.

Options:
  --check-only   Run preflight and port checks only; do not start servers.
  -h, --help     Show this help.

Environment:
  DEMO_HTTP_PORT   Static UI port (default: 8765)
  DEMO_PROXY_PORT  Observability proxy port (default: 8766)
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --check-only)
        CHECK_ONLY=true
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        error "Unknown argument: $1"
        usage >&2
        exit 1
        ;;
    esac
  done
}

cleanup() {
  local pid
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}

port_in_use() {
  local port="$1"
  if ! command -v lsof >/dev/null 2>&1; then
    warn "lsof not found — skipping listen check for port ${port}"
    return 1
  fi
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

check_port_free() {
  local port="$1"
  if port_in_use "$port"; then
    local pids
    pids="$(lsof -ti ":${port}" 2>/dev/null | tr '\n' ' ' | sed 's/[[:space:]]*$//' || true)"
    error "Port ${port} is already in use${pids:+ (PID: ${pids})}"
    echo "    Free it with: lsof -ti :${port} | xargs kill" >&2
    return 1
  fi
  pass "port ${port} is free"
}

run_preflight() {
  step "Preflight: cluster connectivity"
  require_cmd python3 || return 1
  require_cmd oc || return 1
  require_cmd openshell || return 1

  if ! oc whoami &>/dev/null; then
    error "Not logged into OpenShift — run: oc login <cluster-url>"
    return 1
  fi
  info "oc: $(oc whoami) @ $(oc whoami --show-server)"

  detect_apps_domain || return 1

  if oc -n "$NAMESPACE" get pod "$SANDBOX_NAME" >/dev/null 2>&1; then
    pass "sandbox pod ${SANDBOX_NAME}"
  else
    fail "sandbox pod ${SANDBOX_NAME} not found in namespace ${NAMESPACE}"
    return 1
  fi

  local gateway_pod="${OPENSHELL_RELEASE_NAME}-0"
  if oc -n "$NAMESPACE" get pod "$gateway_pod" >/dev/null 2>&1; then
    pass "gateway pod ${gateway_pod}"
  else
    fail "gateway pod ${gateway_pod} not found in namespace ${NAMESPACE}"
    return 1
  fi
}

check_ports() {
  step "Preflight: local ports"
  check_port_free "$HTTP_PORT" || return 1
  check_port_free "$PROXY_PORT" || return 1
}

wait_for_health() {
  local url="http://127.0.0.1:${PROXY_PORT}/api/health"
  local attempt
  for attempt in $(seq 1 15); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

print_health_summary() {
  local health_json
  health_json="$(curl -sf "http://127.0.0.1:${PROXY_PORT}/api/health" 2>/dev/null || echo "{}")"

  step "Ready"
  python3 - <<'PY' "$health_json" "$HTTP_PORT" "$PROXY_PORT" "$APPS_DOMAIN" "$SANDBOX_NAME"
import json, sys
health = json.loads(sys.argv[1])
http_port = sys.argv[2]
proxy_port = sys.argv[3]
apps_domain = sys.argv[4]
sandbox_name = sys.argv[5]

oc_user = health.get("ocUser") or "—"
sandbox = "yes" if health.get("sandboxReachable") else "no"
mlflow_exp = health.get("mlflowExperimentId") or "—"
mlflow_url = health.get("mlflowBaseUrl") or ""

print(f"    Cluster: {oc_user} · sandbox reachable: {sandbox} · MLflow experiment: {mlflow_exp}")
if mlflow_url:
    print(f"    MLflow UI: {mlflow_url}")
print()
print(f"    Launcher:            http://127.0.0.1:{http_port}/demo/index.html")
print(f"    Live companion (v3, recommended): http://127.0.0.1:{http_port}/demo/v3/live.html")
print(f"    Live companion (v1, deprecated):  http://127.0.0.1:{http_port}/demo/v1/live.html")
print(f"    Live companion (v2, deprecated):  http://127.0.0.1:{http_port}/demo/v2/live.html")
print(f"    Script runner API:   http://127.0.0.1:{proxy_port}/api/demo/run")
print(f"    Architecture map: http://127.0.0.1:{http_port}/demo/overall-demo-architecture.html")
if apps_domain:
    print(f"    Control UI:       https://{sandbox_name}--openclaw-ui.{apps_domain}/")
print()
print("Press Ctrl+C to stop both servers.")
PY
}

start_servers() {
  trap cleanup EXIT INT TERM

  echo "==> Observability proxy: http://127.0.0.1:${PROXY_PORT}"
  python3 "${PROXY_SCRIPT}" --port "${PROXY_PORT}" &
  PIDS+=("$!")

  echo "==> Demo UI: http://127.0.0.1:${HTTP_PORT}/demo/v3/live.html (launcher: /demo/index.html)"
  (
    cd "${DOCS_DIR}"
    python3 -m http.server "${HTTP_PORT}"
  ) &
  PIDS+=("$!")

  step "Waiting for observability proxy"
  if ! wait_for_health; then
    error "Observability proxy did not become healthy on port ${PROXY_PORT}"
    cleanup
    exit 1
  fi
  pass "proxy /api/health OK"

  print_health_summary
  wait
}

main() {
  parse_args "$@"

  run_preflight || exit 1
  check_ports || exit 1

  if [[ "$CHECK_ONLY" == "true" ]]; then
    step "Preflight complete"
    info "Cluster and ports are ready — run without --check-only to start servers."
    exit 0
  fi

  start_servers
}

main "$@"
