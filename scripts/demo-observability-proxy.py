#!/usr/bin/env python3
"""
Local observability proxy for the v1 live companion demo panel.

Serves cluster logs and MLflow traces to the static UI via REST on 127.0.0.1 only.
Requires logged-in oc and openshell CLI on the presenter's workstation.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
COMMON_SH = os.path.join(ROOT_DIR, "scripts", "common.sh")

_bash_executable: str | None = None

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8766
ALLOWED_ORIGINS = frozenset(
    {"http://127.0.0.1:8765", "http://localhost:8765"}
)

LOG_COMPONENT_IDS = frozenset({"openclaw", "sandbox", "openshell", "nemo"})

DEMO_ACTIONS: dict[str, dict[str, Any]] = {
    "demo-reset": {
        "script": "scripts/demo-reset.sh",
        "timeout": 120,
        "label": "Run reset",
    },
    "demo-allow-google-egress": {
        "script": "scripts/demo-allow-google-egress.sh",
        "timeout": 90,
        "label": "Allow google.com egress",
    },
    "demo-enable-guardrails": {
        "script": "scripts/demo-enable-guardrails.sh",
        "timeout": 60,
        "label": "Enable NeMo Guardrails",
    },
}

_demo_run_lock = threading.Lock()

COMPONENTS: list[dict[str, Any]] = [
    {
        "id": "openclaw",
        "label": "OpenClaw",
        "type": "logs",
        "description": "Gateway log inside the sandbox (/sandbox/workspace/openclaw.log via oc exec)",
    },
    {
        "id": "sandbox",
        "label": "Sandbox (OCSF)",
        "type": "logs",
        "description": "OpenShell sandbox OCSF audit log (/var/log/openshell.YYYY-MM-DD.log via oc exec)",
    },
    {
        "id": "openshell",
        "label": "OpenShell Gateway",
        "type": "logs",
        "description": "OpenShell gateway pod (openshell-0)",
    },
    {
        "id": "nemo",
        "label": "NeMo Guardrails",
        "type": "logs",
        "description": "TrustyAI-managed NeMo deployment pod logs",
    },
    {
        "id": "mlflow",
        "label": "MLflow",
        "type": "traces",
        "description": "Recent traces from experiment openclaw-tracing",
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def resolve_bash_executable() -> str:
    """Pick bash 4+ (common.sh uses associative arrays; macOS /bin/bash is 3.2)."""
    global _bash_executable
    if _bash_executable:
        return _bash_executable

    candidates: list[str] = []
    bash_env = os.environ.get("BASH")
    if bash_env:
        candidates.append(bash_env)
    which_bash = shutil.which("bash")
    if which_bash:
        candidates.append(which_bash)
    candidates.extend(
        [
            "/opt/homebrew/bin/bash",
            "/usr/local/bin/bash",
            "/opt/local/bin/bash",
            "/bin/bash",
        ]
    )

    seen: set[str] = set()
    for path in candidates:
        if not path or path in seen:
            continue
        seen.add(path)
        if not os.path.isfile(path):
            continue
        try:
            result = subprocess.run(
                [path, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        version_line = result.stdout.splitlines()[0] if result.stdout else ""
        match = re.search(r"version (\d+)", version_line)
        if match and int(match.group(1)) >= 4:
            _bash_executable = path
            return path

    _bash_executable = which_bash or "bash"
    return _bash_executable


def run_bash(script: str, timeout: int = 45) -> tuple[int, str, str]:
    wrapped = f"set -euo pipefail; source '{COMMON_SH}'; {script}"
    bash_bin = resolve_bash_executable()
    try:
        result = subprocess.run(
            [bash_bin, "-lc", wrapped],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=ROOT_DIR,
        )
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout or ""
        err = (exc.stderr or "") + "\nCommand timed out"
        return 124, out, err
    return result.returncode, result.stdout or "", result.stderr or ""


def run_demo_script(script_path: str, timeout: int) -> tuple[int, str, str]:
    """Run a repo demo script; script sources common.sh itself (no double-source)."""
    bash_bin = resolve_bash_executable()
    try:
        result = subprocess.run(
            [bash_bin, script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=ROOT_DIR,
        )
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout or ""
        err = (exc.stderr or "") + "\nCommand timed out"
        return 124, out, err
    return result.returncode, result.stdout or "", result.stderr or ""


def command_exists(name: str) -> bool:
    code, _, _ = run_bash(f"command -v {name} >/dev/null")
    return code == 0


def clamp_lines(value: str | None, default: int = 100, maximum: int = 500) -> int:
    try:
        lines = int(value) if value is not None else default
    except ValueError:
        lines = default
    return max(1, min(lines, maximum))


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    origin = handler.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.end_headers()
    handler.wfile.write(body)


def text_blob(stdout: str, stderr: str) -> str:
    parts = []
    if stdout.strip():
        parts.append(stdout.rstrip("\n"))
    if stderr.strip():
        parts.append(stderr.rstrip("\n"))
    return "\n".join(parts) if parts else ""


def sanitize_log_content(content: str, component_id: str) -> str:
    """Normalize log text: strip null-byte padding and CRLF artifacts."""
    if not content or component_id not in LOG_COMPONENT_IDS:
        return content
    cleaned = content.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    # Drop blank lines left by sparse/truncated log files.
    lines = [line for line in cleaned.split("\n") if line.strip()]
    return "\n".join(lines)


def detect_apps_domain() -> str | None:
    code, out, _ = run_bash("detect_apps_domain >/dev/null 2>&1; echo \"$APPS_DOMAIN\"")
    domain = out.strip()
    return domain if code == 0 and domain else None


def resolve_mlflow_context() -> dict[str, Any]:
    script = r"""
if [[ -f "$SECRETS_FILE" ]]; then set -a; source "$SECRETS_FILE"; set +a; fi
detect_apps_domain >/dev/null 2>&1 || true
resolve_mlflow_experiment_id >/dev/null 2>&1 || true
MLFLOW_TOKEN=""
if oc -n "$NAMESPACE" get secret "${SANDBOX_SA_NAME}-mlflow-token" >/dev/null 2>&1; then
  MLFLOW_TOKEN="$(oc -n "$NAMESPACE" get secret "${SANDBOX_SA_NAME}-mlflow-token" -o jsonpath='{.data.token}' | base64 -d)"
fi
export MLFLOW_TOKEN
python3 - <<'PY'
import json, os
print(json.dumps({
  "namespace": os.environ.get("NAMESPACE", "openshell"),
  "sandbox_name": os.environ.get("SANDBOX_NAME", "openclaw-gw"),
  "workspace": os.environ.get("MLFLOW_WORKSPACE", os.environ.get("NAMESPACE", "openshell")),
  "experiment_id": os.environ.get("MLFLOW_EXPERIMENT_ID", ""),
  "experiment_name": os.environ.get("MLFLOW_EXPERIMENT_NAME", "openclaw-tracing"),
  "rhoai_ns": os.environ.get("RHOAI_NS", "redhat-ods-applications"),
  "token": os.environ.get("MLFLOW_TOKEN", ""),
  "apps_domain": os.environ.get("APPS_DOMAIN", ""),
}))
PY
"""
    code, out, err = run_bash(script)
    if code != 0:
        return {"error": text_blob(out, err) or "Failed to resolve MLflow context"}
    try:
        ctx = json.loads(out.strip() or "{}")
    except json.JSONDecodeError:
        return {"error": "Invalid MLflow context JSON"}
    if ctx.get("apps_domain"):
        ctx["mlflow_base_url"] = f"https://rh-ai.{ctx['apps_domain']}/mlflow"
    else:
        ctx["mlflow_base_url"] = ""
    return ctx


SANDBOX_SIGNAL_GREP = (
    r"ssh relay|OCSF SSH:OPEN|OCSF NET:CLOSE.*ssh|OCSF CONFIG:(APPLYING|BUILT).*Landlock"
)
SANDBOX_C_SIGNAL_GREP = (
    r"google\.com|/usr/bin/curl|OCSF HTTP:|OCSF PROC:LAUNCH.*curl|"
    r"demo_egress_google|demo-permissive-google|no matching policy|OCSF NET:.*DENIED"
)
OPENCLAW_STEP_B_GREP = (
    r"/etc/shadow|Permission denied|operation not permitted|cannot open"
    r"|\[session tool exec\]|\[session tool result\]"
)
VALID_DEMO_STEPS = frozenset({"A", "B", "C-pre", "C-post", "D"})


def sandbox_oc_exec_bash(inner: str) -> str:
    """Run a bash script in the sandbox agent container via oc exec."""
    # shlex.quote keeps $vars and $(...) literal for the local shell (run_bash uses set -u).
    return (
        f'oc -n "$NAMESPACE" exec "$SANDBOX_NAME" -c agent -- bash -lc {shlex.quote(inner)}'
    )


# Runs inside the sandbox pod. Shell tool stdout/stderr live in the session JSONL transcript,
# not in openclaw.log (gateway console). Merge both for the observability panel.
_OPENCLAW_SESSION_TAIL_PY = r"""
import json, os, sys
SESSIONS_INDEX = "/sandbox/workspace/.openclaw/agents/main/sessions/sessions.json"
SESSIONS_DIR = "/sandbox/workspace/.openclaw/agents/main/sessions"

def session_path():
    try:
        with open(SESSIONS_INDEX) as f:
            idx = json.load(f)
        if not idx:
            return None
        # Control UI webchat stores sessions under agent:main:dashboard:* keys.
        # agent:main:main is often stale — pick the most recently active session.
        best_sid = None
        best_ts = -1
        for entry in idx.values():
            if not isinstance(entry, dict):
                continue
            sid = entry.get("sessionId")
            if not sid:
                continue
            ts = entry.get("lastInteractionAt") or entry.get("updatedAt") or 0
            if ts >= best_ts:
                best_ts = ts
                best_sid = sid
        if not best_sid:
            best_sid = idx.get("agent:main:main", {}).get("sessionId")
        if not best_sid:
            return None
        path = os.path.join(SESSIONS_DIR, f"{best_sid}.jsonl")
        return path if os.path.isfile(path) else None
    except OSError:
        return None

def text_from_content(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text":
                parts.append(str(item.get("text", "")))
            elif item.get("type") == "toolCall":
                args = item.get("arguments") or {}
                cmd = args.get("command") if isinstance(args, dict) else str(args)
                parts.append(f"toolCall {item.get('name')}: {cmd}")
        return " | ".join(parts)
    return ""

def sanitize_exec_output(text):
    import re
    if not text:
        return text
    text = re.sub(
        r"/bin/bash:\s*\d+:\s*cannot create /proc/self/oom_score_adj:\s*Permission denied\s*",
        "",
        text,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", text).strip()

def format_session_line(obj):
    ts = obj.get("timestamp", "")
    msg = obj.get("message", {})
    role = msg.get("role", "")
    if role == "user":
        text = text_from_content(msg.get("content"))
        if text:
            return f"{ts} [session user] {text[:500]}"
    if role == "assistant":
        content = msg.get("content")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "toolCall":
                    args = item.get("arguments") or {}
                    cmd = args.get("command") if isinstance(args, dict) else str(args)
                    return f"{ts} [session tool exec] {item.get('name')}: {cmd}"
        text = text_from_content(content)
        if text:
            return f"{ts} [session assistant] {text[:500]}"
        return ""
    if role == "toolResult":
        name = msg.get("toolName", "tool")
        text = sanitize_exec_output(text_from_content(msg.get("content")))
        return f"{ts} [session tool result] {name}: {text[:500]}"
    return ""

def main(limit):
    import re
    step = os.environ.get("DEMO_OBS_STEP", "").strip().upper()
    step_b = step == "B"
    step_c = step in ("C-PRE", "C-POST")
    step_b_re = re.compile(
        r"/etc/shadow|Permission denied|operation not permitted|cannot open"
        r"|\[session tool exec\]|\[session tool result\]",
        re.I,
    ) if step_b else None
    step_c_re = re.compile(
        r"curl|github\.com|HTTP/\d|200 OK|no matching policy|DENIED|blocked|timeout|"
        r"\[session tool exec\]|\[session tool result\]",
        re.I,
    ) if step_c else None
    path = session_path()
    if not path:
        return
    with open(path) as f:
        rows = f.readlines()
    for line in rows[-limit:]:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        formatted = format_session_line(obj)
        if not formatted:
            continue
        formatted = formatted.replace("\n", " ").replace("\r", " ")
        if step_b_re and not step_b_re.search(formatted):
            continue
        if step_c_re and not step_c_re.search(formatted):
            continue
        print(formatted)

if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 80)
"""


def openclaw_fetch_inner(lines: int, demo_step: str = "") -> str:
    session_lines = max(40, lines)
    if demo_step == "B":
        return f"""
session_lines={session_lines}
echo "--- session transcript (Test B — shell tool calls & Landlock) ---"
DEMO_OBS_STEP=B python3 - "$session_lines" <<'PY'
{_OPENCLAW_SESSION_TAIL_PY}
PY
"""
    if demo_step in ("C-pre", "C-post"):
        return f"""
session_lines={session_lines}
echo "--- session transcript (Test C — curl egress) ---"
DEMO_OBS_STEP={demo_step.upper()} python3 - "$session_lines" <<'PY'
{_OPENCLAW_SESSION_TAIL_PY}
PY
"""
    gw_lines = max(20, lines // 2)
    return f"""
gw_lines={gw_lines}
session_lines={session_lines}
echo "--- gateway log ---"
if [[ -f /sandbox/workspace/openclaw.log ]]; then
  tail -n "$gw_lines" /sandbox/workspace/openclaw.log 2>/dev/null | tr -d '\\0'
else
  echo "openclaw.log not found or empty"
fi
echo "--- session transcript (shell tool calls & results) ---"
python3 - "$session_lines" <<'PY'
{_OPENCLAW_SESSION_TAIL_PY}
PY
"""


def fetch_component_logs(
    component_id: str, lines: int, log_filter: str = "all", demo_step: str = ""
) -> dict[str, Any]:
    if demo_step and demo_step not in VALID_DEMO_STEPS:
        demo_step = ""
    if component_id == "openclaw":
        # oc exec avoids SSH relay noise in the OCSF log (openshell sandbox exec writes OCSF events).
        script = sandbox_oc_exec_bash(openclaw_fetch_inner(lines, demo_step))
    elif component_id == "sandbox":
        # Tail pod log file for ISO timestamps. Do NOT use `openshell logs --tail` (streams forever).
        tail_cmd = f'tail -n {lines} "$log"'
        if log_filter == "signal":
            tail_cmd += f' | grep -vE "{SANDBOX_SIGNAL_GREP}" || true'
            if demo_step in ("C-pre", "C-post"):
                tail_cmd += f' | grep -Ei "{SANDBOX_C_SIGNAL_GREP}" || true'
        inner = (
            'log="/var/log/openshell.$(date -u +%Y-%m-%d).log"; '
            'if [[ -f "$log" ]]; then '
            f"{tail_cmd}; "
            'else echo "sandbox log not found: $log"; fi'
        )
        script = sandbox_oc_exec_bash(inner)
    elif component_id == "openshell":
        script = f"""
pod="${{OPENSHELL_RELEASE_NAME:-openshell}}-0"
oc -n "$NAMESPACE" logs "$pod" --tail={lines} 2>&1
"""
    elif component_id == "nemo":
        script = f"""
load_inference_config >/dev/null 2>&1 || true
NEMO_NS="${{NEMO_GUARDRAILS_NAMESPACE:-openshell}}"
discover_nemo_pod() {{
  local pod=""
  pod="$(oc get pods -n "$NEMO_NS" \
    -l app.kubernetes.io/name=nemo-guardrails \
    -o jsonpath='{{.items[?(@.status.phase=="Running")].metadata.name}}' 2>/dev/null | awk '{{print $1}}')"
  if [[ -z "$pod" ]]; then
    pod="$(oc get pods -n "$NEMO_NS" -o name 2>/dev/null \
      | grep '^pod/nemo-guardrails-' \
      | grep -vE -- '-(safe|jail|stream)-' \
      | head -1 | cut -d/ -f2)"
  fi
  echo "$pod"
}}
pod="$(discover_nemo_pod)"
if [[ -z "$pod" ]]; then
  echo "NeMo pod not found in namespace $NEMO_NS" >&2
  exit 1
fi
echo "source: pod/$pod" >&2
oc -n "$NEMO_NS" logs "$pod" --tail={lines} 2>&1
"""
    else:
        return {"ok": False, "error": f"Unknown log component: {component_id}"}

    timeout = 45
    code, out, err = run_bash(script, timeout=timeout)
    content = sanitize_log_content(text_blob(out, err), component_id)
    return {
        "ok": code == 0 or bool(content.strip()),
        "component": component_id,
        "lines": lines,
        "filter": log_filter if component_id == "sandbox" else "all",
        "step": demo_step or None,
        "content": content or "(no output)",
        "fetchedAt": utc_now(),
        "exitCode": code,
    }


def fetch_mlflow_traces(max_results: int) -> dict[str, Any]:
    ctx = resolve_mlflow_context()
    if ctx.get("error"):
        return {"ok": False, "error": ctx["error"], "fetchedAt": utc_now()}

    experiment_id = ctx.get("experiment_id", "")
    token = ctx.get("token", "")
    if not experiment_id:
        return {
            "ok": False,
            "error": "MLFLOW_EXPERIMENT_ID not resolved — run an agent interaction first",
            "fetchedAt": utc_now(),
            "mlflowBaseUrl": ctx.get("mlflow_base_url", ""),
        }
    if not token:
        return {
            "ok": False,
            "error": f"Secret {ctx.get('sandbox_name', 'sandbox')}-mlflow-token not found",
            "fetchedAt": utc_now(),
            "mlflowBaseUrl": ctx.get("mlflow_base_url", ""),
        }

    rhoai_ns = ctx.get("rhoai_ns", "redhat-ods-applications")
    workspace = ctx.get("workspace", ctx.get("namespace", "openshell"))
    sandbox = ctx.get("sandbox_name", "openclaw-gw")
    namespace = ctx.get("namespace", "openshell")

    curl_script = (
        f"curl -sk 'https://mlflow.{rhoai_ns}.svc:8443/api/2.0/mlflow/traces"
        f"?experiment_ids={experiment_id}&max_results={max_results}' "
        f"-H 'Authorization: Bearer {token}' "
        f"-H 'X-MLFLOW-WORKSPACE: {workspace}'"
    )
    script = f"""
oc -n "{namespace}" exec "{sandbox}" -c agent -- bash -lc {json.dumps(curl_script)}
"""
    code, out, err = run_bash(script)
    raw = out.strip()
    if code != 0 or not raw:
        return {
            "ok": False,
            "error": text_blob(out, err) or "MLflow traces request failed",
            "fetchedAt": utc_now(),
            "mlflowBaseUrl": ctx.get("mlflow_base_url", ""),
            "experimentId": experiment_id,
        }

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {
            "ok": False,
            "error": f"Invalid MLflow API response: {raw[:300]}",
            "fetchedAt": utc_now(),
            "mlflowBaseUrl": ctx.get("mlflow_base_url", ""),
            "experimentId": experiment_id,
        }

    traces = []
    for item in payload.get("traces", []):
        info = item.get("trace_info") or item
        traces.append(
            {
                "traceId": (
                    info.get("trace_id")
                    or info.get("traceId")
                    or item.get("trace_id")
                    or ""
                ),
                "requestId": info.get("request_id") or info.get("requestId") or "",
                "status": info.get("status") or info.get("state") or "",
                "timestampMs": info.get("timestamp_ms") or info.get("timestampMs"),
                "executionTimeMs": info.get("execution_time_ms")
                or info.get("executionTimeMs"),
            }
        )

    return {
        "ok": True,
        "component": "mlflow",
        "fetchedAt": utc_now(),
        "mlflowBaseUrl": ctx.get("mlflow_base_url", ""),
        "experimentId": experiment_id,
        "experimentName": ctx.get("experiment_name", "openclaw-tracing"),
        "traces": traces,
        "count": len(traces),
    }


def build_demo_actions() -> list[dict[str, Any]]:
    return [
        {
            "id": action_id,
            "label": meta["label"],
            "script": meta["script"],
            "timeout": meta["timeout"],
        }
        for action_id, meta in DEMO_ACTIONS.items()
    ]


def run_demo_action(action_id: str) -> tuple[int, dict[str, Any]]:
    meta = DEMO_ACTIONS.get(action_id)
    if not meta:
        return 400, {"ok": False, "error": f"Unknown action: {action_id}"}

    if not _demo_run_lock.acquire(blocking=False):
        return 409, {"ok": False, "error": "Another demo script is already running"}

    health = build_health()
    if not health.get("ok"):
        _demo_run_lock.release()
        return 503, {
            "ok": False,
            "error": "Cluster preflight failed — ensure oc login and openshell are available",
            "health": health,
        }

    script_path = os.path.join(ROOT_DIR, meta["script"])
    if not os.path.isfile(script_path):
        _demo_run_lock.release()
        return 500, {
            "ok": False,
            "error": f"Script not found: {meta['script']}",
        }

    started_at = utc_now()
    started_ms = time.monotonic()
    print(
        f"[demo-run] {started_at} starting action={action_id} script={meta['script']}",
        file=sys.stderr,
    )

    try:
        code, stdout, stderr = run_demo_script(
            script_path,
            timeout=int(meta["timeout"]),
        )
    finally:
        _demo_run_lock.release()

    finished_at = utc_now()
    duration_ms = int((time.monotonic() - started_ms) * 1000)
    print(
        f"[demo-run] {finished_at} finished action={action_id} exitCode={code} durationMs={duration_ms}",
        file=sys.stderr,
    )

    return 200, {
        "ok": code == 0,
        "action": action_id,
        "exitCode": code,
        "stdout": stdout,
        "stderr": stderr,
        "startedAt": started_at,
        "finishedAt": finished_at,
        "durationMs": duration_ms,
    }


def build_health() -> dict[str, Any]:
    oc_ok = command_exists("oc")
    openshell_ok = command_exists("openshell")
    oc_user = ""
    if oc_ok:
        code, out, _ = run_bash("oc whoami 2>/dev/null || true")
        if code == 0:
            oc_user = out.strip()

    sandbox_reachable = False
    if oc_ok:
        code, _, _ = run_bash(
            'oc -n "$NAMESPACE" get pod "$SANDBOX_NAME" >/dev/null 2>&1'
        )
        sandbox_reachable = code == 0

    apps_domain = detect_apps_domain()
    mlflow_ctx = resolve_mlflow_context()
    return {
        "ok": oc_ok and openshell_ok and bool(oc_user),
        "fetchedAt": utc_now(),
        "oc": oc_ok,
        "openshell": openshell_ok,
        "ocUser": oc_user or None,
        "sandboxReachable": sandbox_reachable,
        "appsDomain": apps_domain,
        "mlflowExperimentId": mlflow_ctx.get("experiment_id") or None,
        "mlflowBaseUrl": mlflow_ctx.get("mlflow_base_url") or None,
    }


class ObservabilityHandler(BaseHTTPRequestHandler):
    server_version = "AgentOpsObservabilityProxy/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path != "/api/demo/run":
            json_response(self, 404, {"ok": False, "error": "Not found"})
            return

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            json_response(self, 400, {"ok": False, "error": "Missing request body"})
            return

        try:
            raw = self.rfile.read(content_length)
            body = json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            json_response(self, 400, {"ok": False, "error": "Invalid JSON body"})
            return

        action_id = body.get("action")
        if not isinstance(action_id, str) or not action_id.strip():
            json_response(self, 400, {"ok": False, "error": "Missing or invalid action"})
            return

        status, payload = run_demo_action(action_id.strip())
        json_response(self, status, payload)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if path == "/api/health":
            json_response(self, 200, build_health())
            return

        if path == "/api/demo/actions":
            json_response(
                self,
                200,
                {
                    "actions": build_demo_actions(),
                    "fetchedAt": utc_now(),
                },
            )
            return

        if path == "/api/components":
            ctx = resolve_mlflow_context()
            json_response(
                self,
                200,
                {
                    "components": COMPONENTS,
                    "mlflowBaseUrl": ctx.get("mlflow_base_url", ""),
                    "fetchedAt": utc_now(),
                },
            )
            return

        logs_match = re.fullmatch(r"/api/logs/([a-z]+)", path)
        if logs_match:
            component_id = logs_match.group(1)
            if component_id not in LOG_COMPONENT_IDS:
                json_response(
                    self,
                    404,
                    {"ok": False, "error": f"Unknown component: {component_id}"},
                )
                return
            lines = clamp_lines(query.get("lines", [None])[0])
            log_filter = query.get("filter", ["all"])[0]
            if log_filter not in ("all", "signal"):
                log_filter = "all"
            demo_step = (query.get("step", [""])[0] or "").strip()
            payload = fetch_component_logs(component_id, lines, log_filter, demo_step)
            json_response(self, 200 if payload.get("ok") else 502, payload)
            return

        if path == "/api/traces/mlflow":
            max_results = clamp_lines(query.get("max", ["5"])[0], default=5, maximum=20)
            payload = fetch_mlflow_traces(max_results)
            json_response(self, 200 if payload.get("ok") else 502, payload)
            return

        json_response(self, 404, {"ok": False, "error": "Not found"})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    if args.host not in ("127.0.0.1", "localhost", "::1"):
        print("Refusing to bind outside localhost", file=sys.stderr)
        return 1

    httpd = ThreadingHTTPServer((args.host, args.port), ObservabilityHandler)
    print(f"Observability proxy listening on http://{args.host}:{args.port}", file=sys.stderr)
    print(
        "Endpoints: /api/health /api/components /api/logs/{id} /api/traces/mlflow "
        "/api/demo/actions /api/demo/run",
        file=sys.stderr,
    )
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.", file=sys.stderr)
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
