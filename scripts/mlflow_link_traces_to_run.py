#!/usr/bin/env python3
"""Attach OpenClaw MLflow traces to an EvalHub run.

mlflow-openclaw logs spans while Garak chats. EvalHub creates the MLflow run
only after the scan, so those traces have no run_id and the run Traces tab
is empty. This script tags traces in the job time window with mlflow.runId /
mlflow.sourceRun and calls traces/link-to-run.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any


def _oc_route_host() -> str:
    ns = os.environ.get("RHOAI_NS", "redhat-ods-applications")
    return subprocess.check_output(
        ["oc", "-n", ns, "get", "route", "mlflow", "-o", "jsonpath={.spec.host}"],
        text=True,
    ).strip()


def _token() -> str:
    tok = os.environ.get("MLFLOW_TRACKING_TOKEN") or os.environ.get("MLFLOW_AUTH_TOKEN")
    if tok:
        return tok
    return subprocess.check_output(["oc", "whoami", "-t"], text=True).strip()


def _base_url() -> str:
    uri = os.environ.get("MLFLOW_TRACKING_URI", "").rstrip("/")
    if uri:
        return uri
    return "https://" + _oc_route_host()


def _headers(workspace: str) -> dict[str, str]:
    tok = _token()
    return {
        "Authorization": f"Bearer {tok}",
        "Content-Type": "application/json",
        "x-mlflow-workspace": workspace,
        "X-MLFLOW-WORKSPACE": workspace,
    }


def call(method: str, path: str, workspace: str, body: Any | None = None, timeout: int = 30) -> Any:
    ctx = ssl.create_default_context()
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        _base_url() + path, data=data, headers=_headers(workspace), method=method
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err = exc.read().decode()[:400]
        raise SystemExit(f"MLflow {method} {path} -> {exc.code} {err}") from exc


def parse_iso_ms(value: str) -> int:
    value = value.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def list_trace_ids(experiment_id: str, workspace: str, since_ms: int, until_ms: int) -> list[str]:
    ids: list[str] = []
    token = None
    while True:
        q = f"/api/2.0/mlflow/traces?experiment_ids={urllib.parse.quote(experiment_id)}&max_results=100"
        if token:
            q += f"&page_token={urllib.parse.quote(token)}"
        payload = call("GET", q, workspace)
        for tr in payload.get("traces") or []:
            ts = int(tr.get("timestamp_ms") or 0)
            tid = tr.get("request_id")
            if tid and since_ms <= ts <= until_ms:
                ids.append(tid)
        token = payload.get("next_page_token")
        if not token:
            break
    return ids


def wait_for_ids(
    experiment_id: str, workspace: str, since_ms: int, until_ms: int, wait_s: int
) -> list[str]:
    """Traces can land a few seconds after EvalHub marks the job complete."""
    deadline = time.time() + wait_s
    delay = 2.0
    ids: list[str] = []
    while True:
        ids = list_trace_ids(experiment_id, workspace, since_ms, until_ms)
        if ids or time.time() >= deadline:
            return ids
        time.sleep(delay)
        delay = min(delay * 1.5, 8.0)


def link_ids(run_id: str, workspace: str, ids: list[str]) -> None:
    for i in range(0, len(ids), 100):
        chunk = ids[i : i + 100]
        call(
            "POST",
            "/api/2.0/mlflow/traces/link-to-run",
            workspace,
            {"run_id": run_id, "trace_ids": chunk},
        )
        for tid in chunk:
            for key in ("mlflow.runId", "mlflow.sourceRun"):
                call(
                    "PATCH",
                    f"/api/2.0/mlflow/traces/{tid}/tags",
                    workspace,
                    {"key": key, "value": run_id},
                )


def from_evalhub_job(doc: dict[str, Any], pad_ms: int) -> tuple[str, str, int, int]:
    run_id = ""

    def find_run(obj: Any) -> None:
        nonlocal run_id
        if run_id:
            return
        if isinstance(obj, dict):
            if obj.get("mlflow_run_id"):
                run_id = str(obj["mlflow_run_id"])
                return
            for v in obj.values():
                find_run(v)
        elif isinstance(obj, list):
            for v in obj:
                find_run(v)

    find_run(doc)
    if not run_id:
        raise SystemExit("No mlflow_run_id in EvalHub job payload")
    exp = str((doc.get("resource") or {}).get("mlflow_experiment_id") or "")
    if not exp:
        raise SystemExit("No resource.mlflow_experiment_id in EvalHub job payload")
    created = (doc.get("resource") or {}).get("created_at") or ""
    updated = (doc.get("resource") or {}).get("updated_at") or created
    since_ms = parse_iso_ms(created) - pad_ms
    until_ms = parse_iso_ms(updated) + pad_ms
    return run_id, exp, since_ms, until_ms


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-evalhub-json", action="store_true",
                        help="Read EvalHub job JSON from stdin")
    parser.add_argument("--run-id")
    parser.add_argument("--experiment-id")
    parser.add_argument("--since-ms", type=int)
    parser.add_argument("--until-ms", type=int)
    parser.add_argument("--pad-ms", type=int, default=60_000)
    parser.add_argument("--wait-s", type=int, default=30,
                        help="Retry listing traces this long (ingest lag after job complete)")
    parser.add_argument("--workspace", default="evaluation")
    args = parser.parse_args()

    if args.from_evalhub_json:
        doc = json.load(sys.stdin)
        run_id, exp, since_ms, until_ms = from_evalhub_job(doc, args.pad_ms)
    else:
        if not (args.run_id and args.experiment_id and args.since_ms and args.until_ms):
            parser.error("need --from-evalhub-json or --run-id --experiment-id --since-ms --until-ms")
        run_id, exp, since_ms, until_ms = args.run_id, args.experiment_id, args.since_ms, args.until_ms

    ids = wait_for_ids(exp, args.workspace, since_ms, until_ms, args.wait_s)
    if not ids:
        print(f"No traces in experiment {exp} between {since_ms} and {until_ms}", file=sys.stderr)
        return 0
    link_ids(run_id, args.workspace, ids)
    print(f"Linked {len(ids)} traces to run {run_id} (experiment {exp})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
