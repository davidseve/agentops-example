# ADR-0003: MLflow Tracing from OpenClaw via mlflow-openclaw Plugin

**Status**: Accepted (supersedes initial OTEL-only approach)  
**Date**: 2026-08-04  
**Source**: open-claw-in-openshell (ADR-0017, ADR-0018, constraints #15, #22)

## Context

OpenClaw generates traces for agent interactions (tool calls, model inference,
reasoning steps). These traces must reach RHOAI's MLflow instance with **full
Request/Response content** visible in the Gen AI Studio.

### Initial approach (diagnostics-otel) — rejected

The `diagnostics-otel` plugin exports raw OTEL spans. While these reach MLflow,
they appear as generic traces with `null` for Request and Response columns in
the UI. This is because the plugin doesn't hook into OpenClaw's agent lifecycle
events — it only produces transport-level spans.

### Reference project approach (mlflow-openclaw) — adopted

The open-claw-in-openshell project uses `@mlflow/mlflow-openclaw@0.2.0-rc.0`
which hooks into OpenClaw's `llm_input`, `llm_output`, and `agent_end` events.
This produces rich traces containing:
- Full user message (Request)
- Full assistant reply (Response)
- Model, provider, token usage
- Session/run metadata

## Decision

### Plugin: mlflow-openclaw (sole trace source)

- `diagnostics-otel` is explicitly **disabled** in config
- `OTEL_TRACES_EXPORTER=none` and `OTEL_METRICS_EXPORTER=none` set as env vars
- `mlflow-openclaw` is installed as an extension, patched for compatibility

### Compatibility patches required

`@mlflow/mlflow-openclaw@0.2.0-rc.0` was built for a newer OpenClaw SDK:
1. `service.ts`: Remove import of `openclaw/plugin-sdk/diagnostics-otel` (no-op)
2. `index.ts`: Replace `definePluginEntry()` with plain object export
3. `@mlflow/core/dist/auth/index.js`: Backport `X-MLFLOW-WORKSPACE` header
   (upstream fix in mlflow/mlflow#23927, landed in @mlflow/core@0.3.0)

These patches are applied by `scripts/patch-mlflow-plugin.py`.

### Plugin ownership constraint

OpenClaw's security model requires extension plugins to be **root-owned**.
Non-root ownership triggers "suspicious ownership" rejection. The config file,
however, must be owned by the sandbox UID.

### Transport: OpenClaw → MLflow (in-cluster, direct)

- Endpoint: `https://mlflow.redhat-ods-applications.svc:8443`
- Auth: Bearer token via `MLFLOW_TRACKING_TOKEN` env var (read from Secret)
- TLS: Combined CA bundle (OpenShell proxy CA + RHOAI service-ca)
- Workspace header: Injected by patched `@mlflow/core` via `MLFLOW_WORKSPACE` env var

### Auth mechanism

Use `kubernetes.io/service-account-token` annotation on a Secret bound to the
`openshell-sandbox` SA. Long-lived token (no expiry unless SA/Secret deleted).
Rotation: delete Secret + helm upgrade.

### Gateway env vars at launch

```
MLFLOW_TRACKING_TOKEN=<SA token from Secret>
MLFLOW_WORKSPACE=openshell
NODE_EXTRA_CA_CERTS=/sandbox/workspace/.combined-ca-bundle.pem
NODE_TLS_REJECT_UNAUTHORIZED=0
OTEL_TRACES_EXPORTER=none
OTEL_METRICS_EXPORTER=none
```

### Experiment provisioning

A Helm post-install/post-upgrade Job creates the MLflow experiment via REST API.
Idempotent get-by-name-or-create logic.

## Consequences

- Traces appear in Gen AI Studio with **full Request/Response content**
- `diagnostics-otel` no longer used for traces (only metrics if needed later)
- Plugin requires patching on install (fragile to version upgrades)
- Plugin install + patch requires `oc exec` (can't use sandbox restricted network)
- Token rotation requires manual Secret deletion + helm upgrade

## References

- RHOAI MLflow RBAC: `mlflow-operator-mlflow-integration` ClusterRole
- open-claw-in-openshell: docs/constraints.md #15, #22
- open-claw-in-openshell: scripts/patch-mlflow-plugin.py
- open-claw-in-openshell: scripts/launch-openclaw.sh (Step 6-7)
- mlflow/mlflow#23927 (X-MLFLOW-WORKSPACE header fix)
