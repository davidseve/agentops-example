# ADR-0010: MLflow Tracing from OpenClaw via mlflow-openclaw Plugin

**Status**: Accepted (supersedes initial OTEL-only approach)  
**Date**: 2026-08-04  
**Layer**: Agent  
**Source**: Migrated learnings from a reference OpenShell/OpenClaw deployment (its ADR-0017, ADR-0018, constraints #15, #22)

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

The reference project uses `@mlflow/mlflow-openclaw@0.2.0-rc.0`
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
Rotation: delete Secret + helm upgrade. This token can write the **openshell**
MLflow workspace.

Cross-workspace writes (demo: traces into **evaluation** /
`openclaw-garak-owasp`) need a **bound TokenRequest** (`kubectl create token`
or the TokenRequest API). The long-lived Secret uses issuer
`kubernetes/serviceaccount` with no `aud` and is **403 PERMISSION_DENIED** on
other workspaces even when a RoleBinding grants `mlflow-operator-mlflow-integration`
in that namespace. `launch-openclaw.sh` mints a 24h TokenRequest when
`MLFLOW_WORKSPACE` is not the sandbox namespace. EvalHub chart RoleBinding:
`deploy/helm/evalhub/templates/openclaw-traces-rbac.yaml`. Demo launch:
`make launch-openclaw-eval-demo`.

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

## Declarative bootstrap of the RBAC integration (fixed 2026-08-05)

The `openshell-sandbox-mlflow-token` Secret and its `RoleBinding` (in
`deploy/helm/mlflow/templates/openclaw-integration-rbac.yaml`) are gated by
`openclawIntegration.enabled` (default `false`), because the `openshell-sandbox`
SA doesn't exist until OpenShell is deployed — and OpenShell must be deployed
*after* RHOAI/MLflow (constraint #10, ADR-0003). This is a real chicken-and-egg
ordering constraint, not a bug by itself.

However, during a from-scratch redeploy on 2026-08-05, two related gaps were
found that made this step silently manual rather than declarative, contradicting
the project's "no scripts, no manual steps" goal:

1. **No automated re-run.** Nothing in `deploy/Makefile` ever set
   `openclawIntegration.enabled=true` — a manual
   `helm upgrade ... --set openclawIntegration.enabled=true` was required after
   `deploy-openshell`, and was undocumented anywhere. **Fix**: added
   `deploy-mlflow-openclaw-integration` to `deploy/Makefile`, which waits for the
   `openshell-sandbox` SA and re-runs the MLflow chart with the flag enabled. It
   now runs automatically as the last step of `deploy-openshell`.
2. **Manual ClusterRole name lookup.** `openclawIntegration.clusterRoleName` had
   no default because the RHOAI MLflow operator generates the
   `mlflow-integration` `ClusterRole` name at install time (no stable name across
   builds), requiring `oc get clusterroles | grep mlflow-integration` and a
   manual `--set`. **Fix**: `openclaw-integration-rbac.yaml` now auto-detects it
   via Helm's `lookup` function (matches any `ClusterRole` whose name contains
   `mlflow-integration`), falling back to the explicit value only as an override
   (also required for `helm template`/dry-run, where `lookup` always returns
   empty).

With both fixes, `make deploy-openshell` alone is now sufficient to wire up
OpenClaw's MLflow tracing end-to-end — no manual `--set` flags needed.

## Inference path (updated 2026-08-14)

LLM calls from OpenClaw no longer reach MaaS directly from the sandbox. The
agent uses OpenShell's **inference router** (`https://inference.local/v1`,
`model: router` in `config/openclaw.json.tpl`). The real API key is registered
only on the OpenShell gateway (`providers_v2` in `scripts/launch-openclaw.sh`);
the sandbox process uses `apiKey: "unused"` and never sees the credential.

This ADR covers **tracing only** — the inference router is an OpenShell gateway
concern, not part of the MLflow transport path. Traces still flow via the
`mlflow-openclaw` plugin to `mlflow.redhat-ods-applications.svc:8443` as
described above. MLflow trace metadata may show `model: router` rather than the
resolved upstream model name — a known upstream gap, not a tracing regression.

## Consequences

- Traces appear in Gen AI Studio with **full Request/Response content**
- `diagnostics` / `diagnostics-otel` fully disabled — no OTEL collector in this stack;
  traces go only through `mlflow-openclaw`
- Plugin requires patching on install (fragile to version upgrades)
- Plugin install + patch requires `oc exec` (can't use sandbox restricted network)
- Token rotation requires manual Secret deletion + helm upgrade

## References

- RHOAI MLflow RBAC: `mlflow-operator-mlflow-integration` ClusterRole
- Reference project: constraints #15, #22 (mlflow-openclaw plugin patching and transport)
- Reference project: its own MLflow plugin patch script and gateway launch steps (Step 6-7)
- mlflow/mlflow#23927 (X-MLFLOW-WORKSPACE header fix)
