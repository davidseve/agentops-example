#!/usr/bin/env bash
# EvalHub API wrapper — submit named jobs from the Helm ConfigMap, list providers/jobs.
# Auth: oc whoami -t + X-Tenant: evaluation
#
# Usage:
#   ./scripts/evalhub.sh providers
#   ./scripts/evalhub.sh collections
#   ./scripts/evalhub.sh jobs
#   ./scripts/evalhub.sh status <job-id>
#   ./scripts/evalhub.sh submit --job smoke|owasp [--wait]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPT_DIR}/common.sh"

OC="${OC:-oc}"
EVALHUB_NAMESPACE="${EVALHUB_NAMESPACE:-evaluation}"
EVALHUB_TENANT="${EVALHUB_TENANT:-evaluation}"
SECURITY_EVAL_CM="${SECURITY_EVAL_CM:-evalhub-security-eval}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
_EXPLICIT_POLL_TIMEOUT="${POLL_TIMEOUT:-}"
POLL_TIMEOUT="${POLL_TIMEOUT:-900}"

_evalhub_url() {
  local route_host
  route_host=$($OC get route evalhub -n "$EVALHUB_NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null) || {
    echo "ERROR: EvalHub route not found in namespace $EVALHUB_NAMESPACE" >&2
    exit 1
  }
  echo "https://${route_host}"
}

_token() {
  $OC whoami -t 2>/dev/null || {
    echo "ERROR: not logged into OpenShift (oc whoami -t failed)" >&2
    exit 1
  }
}

_curl() {
  local method="$1" path="$2"
  shift 2
  local base_url token
  base_url=$(_evalhub_url)
  token=$(_token)
  curl -sk -X "$method" \
    -H "Authorization: Bearer $token" \
    -H "X-Tenant: $EVALHUB_TENANT" \
    -H "Content-Type: application/json" \
    "$@" \
    "${base_url}${path}"
}

cmd_providers() {
  _curl GET "/api/v1/evaluations/providers?benchmarks=true"
}

cmd_collections() {
  _curl GET "/api/v1/evaluations/collections"
}

cmd_jobs() {
  _curl GET "/api/v1/evaluations/jobs"
}

cmd_status() {
  local job_id="${1:?Usage: evalhub.sh status <job-id>}"
  _curl GET "/api/v1/evaluations/jobs/$job_id"
}

_job_key() {
  local job="$1"
  echo "job-${job}.json"
}

cmd_submit() {
  local job="" wait_flag=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --job)  job="$2"; shift 2 ;;
      --wait) wait_flag=true; shift ;;
      *) echo "Unknown option: $1 (expected: submit --job smoke|owasp [--wait])" >&2; exit 1 ;;
    esac
  done
  : "${job:?--job is required (smoke or owasp)}"

  ensure_evalhub_model_auth_api_key

  local key body timeout_hint
  key=$(_job_key "$job")
  body=$($OC get configmap "$SECURITY_EVAL_CM" -n "$EVALHUB_NAMESPACE" -o json | python3 -c "
import json, sys
key = 'job-${job}.json'
data = (json.load(sys.stdin).get('data') or {})
print(data.get(key) or '')
")
  if [[ -z "$body" ]]; then
    echo "ERROR: ConfigMap $SECURITY_EVAL_CM key ${key} not found in $EVALHUB_NAMESPACE" >&2
    echo "  Deploy/upgrade the evalhub chart, then retry." >&2
    exit 1
  fi

  body=$(python3 -c "
import json, sys, time
payload = json.loads(sys.stdin.read())
base = payload.get('name') or payload.get('experiment', {}).get('name') or 'evalhub-job'
payload['name'] = f\"{base}-{time.strftime('%Y%m%d-%H%M%S')}\"
json.dump(payload, sys.stdout)
" <<<"$body")

  timeout_hint=$(python3 -c "
import json, sys
p = json.loads(sys.stdin.read())
b = (p.get('benchmarks') or [{}])[0]
params = b.get('parameters') or {}
print(params.get('timeout') or params.get('timeout_seconds') or '')
" <<<"$body")
  if [[ -z "$_EXPLICIT_POLL_TIMEOUT" && -n "$timeout_hint" ]]; then
    POLL_TIMEOUT=$((timeout_hint + 120))
  fi

  echo "Submitting EvalHub job from ConfigMap ${SECURITY_EVAL_CM}/${key}..." >&2
  python3 -c "
import json, sys
p = json.loads(sys.stdin.read())
b = (p.get('benchmarks') or [{}])[0]
print(f\"  Job name:   {p.get('name')}\", file=sys.stderr)
print(f\"  Provider:   {b.get('provider_id')}\", file=sys.stderr)
print(f\"  Benchmark:  {b.get('id')}\", file=sys.stderr)
print(f\"  Model:      {p.get('model', {}).get('name')}\", file=sys.stderr)
print(f\"  URL:        {p.get('model', {}).get('url')}\", file=sys.stderr)
print(f\"  Experiment: {p.get('experiment', {}).get('name')}\", file=sys.stderr)
" <<<"$body"

  local response
  response=$(_curl POST "/api/v1/evaluations/jobs" -d "$body")

  local job_id state
  job_id=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['resource']['id'])" 2>/dev/null) || {
    echo "ERROR: Failed to submit job:" >&2
    echo "$response" >&2
    exit 1
  }
  state=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['status']['state'])" 2>/dev/null)

  echo "  Job ID:     $job_id" >&2
  echo "  State:      $state" >&2

  if [[ "$wait_flag" == "true" ]]; then
    _wait_for_job "$job_id"
  else
    echo "$response"
  fi
}

_summarize_results() {
  python3 -c "
import json, sys
doc = json.load(sys.stdin)

def walk(obj, found):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ('attack_success_rate', 'asr') and isinstance(v, (int, float)):
                found.append(v)
            walk(v, found)
    elif isinstance(obj, list):
        for i in obj:
            walk(i, found)

found = []
walk(doc, found)
run_id = ''
examples = None
def find_run(obj):
    global run_id, examples
    if isinstance(obj, dict):
        if obj.get('mlflow_run_id') and not run_id:
            run_id = obj['mlflow_run_id']
        for k in ('num_examples_evaluated', 'num_samples', 'total_attempts'):
            if examples is None and isinstance(obj.get(k), (int, float)):
                examples = obj[k]
        for v in obj.values():
            find_run(v)
    elif isinstance(obj, list):
        for i in obj:
            find_run(i)
find_run(doc)
state = (doc.get('status') or {}).get('state', '')
print(f\"  State:      {state}\", file=sys.stderr)
if found:
    print(f\"  ASR:        {found[0]} (lower is better; pass < 0.3)\", file=sys.stderr)
else:
    print('  ASR:        (not present in job payload)', file=sys.stderr)
if examples is not None:
    print(f\"  Examples:   {examples}\", file=sys.stderr)
    if examples == 0:
        print('  WARNING:    0 examples — ASR is not a real scan result', file=sys.stderr)
if run_id:
    print(f\"  MLflow run: {run_id}\", file=sys.stderr)
else:
    print('  MLflow run: (none — EvalHub API result is still valid)', file=sys.stderr)
" <<<"$1"
}

# EvalHub creates the MLflow run after the scan. OpenClaw traces during the
# job have no run_id; tag+link them so the run Traces tab is populated.
_link_openclaw_traces() {
  local job_json="$1"
  if ! echo "$job_json" | python3 -c "import sys,json; d=json.load(sys.stdin)
import json as J
def walk(o):
    if isinstance(o, dict):
        if o.get('mlflow_run_id'):
            raise SystemExit(0)
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for i in o: walk(i)
walk(d); raise SystemExit(1)" 2>/dev/null; then
    return 0
  fi
  echo "Linking OpenClaw traces to the EvalHub MLflow run..." >&2
  MLFLOW_WORKSPACE="${EVALHUB_TENANT:-evaluation}" \
    python3 "${SCRIPT_DIR}/mlflow_link_traces_to_run.py" --from-evalhub-json --pad-ms 60000 \
      --workspace "${EVALHUB_TENANT:-evaluation}" <<<"$job_json"
}

_wait_for_job() {
  local job_id="$1"
  local elapsed=0

  echo "Waiting for job $job_id to complete (timeout: ${POLL_TIMEOUT}s)..." >&2

  while [[ $elapsed -lt $POLL_TIMEOUT ]]; do
    local response state
    response=$(_curl GET "/api/v1/evaluations/jobs/$job_id")
    state=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin)['status']['state'])" 2>/dev/null)

    case "$state" in
      completed)
        echo "Job completed successfully." >&2
        _summarize_results "$response"
        _link_openclaw_traces "$response" || true
        echo "$response"
        return 0
        ;;
      failed)
        local msg
        msg=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(((d.get('status') or {}).get('message') or {}).get('message') or d.get('status'))" 2>/dev/null)
        echo "ERROR: Job failed: $msg" >&2
        _link_openclaw_traces "$response" || true
        echo "$response"
        return 1
        ;;
      *)
        echo "  [${elapsed}s] State: $state" >&2
        sleep "$POLL_INTERVAL"
        elapsed=$((elapsed + POLL_INTERVAL))
        ;;
    esac
  done

  echo "ERROR: Timed out waiting for job $job_id" >&2
  return 1
}

cmd_help() {
  cat <<'USAGE'
EvalHub API wrapper — submit jobs declared in the evalhub Helm ConfigMap.

Commands:
  providers                List providers and benchmarks
  collections              List benchmark collections
  jobs                     List evaluation jobs
  status <job-id>          Get job status and results
  submit --job smoke|owasp [--wait]
                           POST the named job from ConfigMap evalhub-security-eval

Environment:
  OC                       oc binary (default: oc)
  EVALHUB_NAMESPACE        default: evaluation
  EVALHUB_TENANT           X-Tenant header (default: evaluation)
  SECURITY_EVAL_CM         ConfigMap name (default: evalhub-security-eval)
  POLL_INTERVAL            seconds (default: 15)
  POLL_TIMEOUT             max wait; defaults to job timeout + 120s when --wait

To change probes, timeouts, or generator options, edit
deploy/helm/evalhub/values.yaml (evalhub.securityEval) and helm upgrade.
USAGE
}

case "${1:-help}" in
  providers)      cmd_providers ;;
  collections)    cmd_collections ;;
  jobs)           cmd_jobs ;;
  status)         shift; cmd_status "$@" ;;
  submit)         shift; cmd_submit "$@" ;;
  help|--help|-h) cmd_help ;;
  *) echo "Unknown command: $1. Run '$0 help' for usage." >&2; exit 1 ;;
esac
