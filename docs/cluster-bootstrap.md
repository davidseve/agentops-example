# Cluster Bootstrap Guide

This guide documents how to deploy and verify the RHOAI platform stack for the AgentOps demo on OpenShift.

| Scenario | Use case | Section |
|---|---|---|
| **Full stack (one-shot)** | Deploy + verify everything | [End-to-end workflow](#end-to-end-workflow) |
| **Platform deploy only** | RHOAI operator, MLflow, TrustyAI, PostgreSQL, EvalHub | [Deploy](#deploy) |
| **Platform health check** | Confirm RHOAI layer is healthy | [Validate platform](#validate-platform) |
| **Full demo verification** | OpenShell + OpenClaw + E2E + traces | [Full verification](#full-verification) |
| **Teardown** | Reset cluster to a clean state | [Teardown](#teardown) |

The bootstrap deploys the **platform layer** (RHOAI 3.x and dependencies). OpenShell and OpenClaw are deployed in a second phase — see [OpenShell Installation Guide](openshell-installation.md).

**Official references**:

- [Red Hat OpenShift AI Self-Managed 3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/)
- [RHOAI Supported Configurations 3.x](https://access.redhat.com/articles/rhoai-supported-configs-3.x)
- [MLflow on RHOAI](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/monitoring_and_tracing/monitoring-and-tracing)
- [TrustyAI / EvalHub](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/serving_models/serving-large-models_serving-large-models#about-trustyai-operator)

## Overview

A working AgentOps platform stack on OpenShift includes:

| Component | Role in demo |
|---|---|
| RHOAI Operator 3.4.x | Installs and manages platform components via DataScienceCluster |
| Agent Sandbox Operator | Required for OpenShell sandboxes (installed with operators chart) |
| Dashboard | RHOAI UI for operators and data scientists |
| MLflow Operator + instance | Tracing and prompt registry |
| TrustyAI | NeMo Guardrails deployment path |
| KServe | Model serving infrastructure (required by TrustyAI) |
| PostgreSQL (`maas-db`) | Shared database for MLflow and EvalHub |
| EvalHub | Red teaming / evaluation (nice-to-have for demo) |

```
Helm charts (deploy/helm/)
        │
        ▼
┌───────────────────────────────────────────────────┐
│  rhoai-operators  →  RHOAI + Agent Sandbox CSV    │
│  rhoai-platform   →  DataScienceCluster + Dashboard│
│  rhoai-database   →  PostgreSQL (maas-db)           │
│  rhoai-mlflow     →  MLflow CR + Route            │
│  rhoai-evalhub    →  EvalHub CR                   │
└───────────────────────────────────────────────────┘
        │
        ▼
  redhat-ods-operator / redhat-ods-applications / evaluation
        │
        ▼ (Phase 2 — separate from deploy-all)
  openshell / openclaw-ui-proxy / sandbox
```

In **Cursor**, use the cluster bootstrap skills — see [Deploy via Cursor skills](#deploy-via-cursor-skills).

| Scenario | Skill |
|---|---|
| **Deploy platform** | `cluster-bootstrap` |
| **Teardown platform** | `cluster-cleanup` |

## End-to-end workflow

Everything is launchable from the **repo root** via `make`:

```bash
# Full demo: RHOAI + OpenShell + OpenClaw + verification (recommended)
make demo

# Platform only (what you already ran successfully)
make deploy-all
make validate

# Agent layer only (after platform validate)
make deploy-agent
make validate-full
```

> **Path trap**: Run `make demo` from the repo root (`agentops-example/`). If your shell is already in `deploy/`, use `make demo` there — **not** `make -C deploy demo` (that looks for `deploy/deploy/` and fails).

`make demo` chains:

| Step | Make target | What it does |
|---|---|---|
| 1 | `deploy-all` | Five `rhoai-*` Helm releases + built-in waits |
| 2 | `deploy-openshell` | Gateway, PKI, MLflow RBAC integration |
| 3 | `deploy-openclaw-ui-proxy` | Browser entrypoint (nginx mTLS bridge) |
| 4 | `launch-openclaw` | Sandbox create, OpenClaw install, gateway start |
| 5 | `validate-full` | All checks (`validate` → `validate-openshell` → Playwright → traces) |

`APPS_DOMAIN` is auto-detected from the cluster ingress when unset. Override explicitly if needed:

```bash
APPS_DOMAIN=apps.ocp.sandbox337.opentlc.com make demo
```

### Alternative orchestrators

| Entry point | When to use |
|---|---|
| `make demo` | **Default** — single Makefile, run from repo root |
| `./scripts/cluster-lifecycle.sh full` | Same flow with preflight checks and `.agent-status/*.json` for agents |
| Individual targets | Debugging a failed step (see table below) |

`cluster-lifecycle.sh` and `verify.sh` still exist for agent automation and structured output; `make demo` calls the same underlying scripts for phases 4–5 (`launch-openclaw.sh`, `verify.sh`).

### Granular targets (debugging)

| Phase | Command | Owner |
|---|---|---|
| 1 — Platform | `make deploy-all` | Makefile |
| 2 — Platform check | `make validate` | Makefile |
| 3 — OpenShell | `make deploy-openshell` | Makefile |
| 4 — UI proxy | `make deploy-openclaw-ui-proxy` | Makefile |
| 5 — OpenClaw | `make launch-openclaw` | Makefile → `scripts/launch-openclaw.sh` |
| 6 — Full verify | `make validate-full` | Makefile → `scripts/verify.sh` |

Shorthand: `make deploy-agent` = phases 3–5. `make deploy-demo` = phases 1–5.

Fast subsets when iterating:

```bash
make validate                    # RHOAI only (after deploy-all)
make validate-smoke              # OpenShell infra + sandbox policy
VERIFY_PROFILE=smoke make validate-full
SKIP_E2E=1 make validate-full    # Makefile checks, no Playwright
./tests/health-check.sh          # Alias for verify --smoke
```

## Prerequisites

| Requirement | Notes |
|---|---|
| OpenShift 4.x cluster | Validated on demo.redhat.com / RHPDS |
| `oc` CLI authenticated | Cluster admin or sufficient permissions to create namespaces, subscriptions, and CRs |
| `helm` 3.x | Used by all deploy targets in `deploy/Makefile` |
| Network access | Pull from `registry.redhat.io`, `redhat-operators`, and OpenShift marketplace |

Verify your session before starting:

```bash
oc whoami
oc get nodes
helm version
```

For the full demo (Phases 3–6), you also need `openshell` CLI and `secrets/secrets.env` — see [cluster-lifecycle.sh preflight](../scripts/cluster-lifecycle.sh).

## Deploy

Three ways to deploy the **platform layer**, from easiest to most manual:

| Method | Best for | Command |
|---|---|---|
| **One command** | Full demo from repo root | `make demo` |
| **Lifecycle script** | Agent automation + preflight | `./scripts/cluster-lifecycle.sh full` |
| **Cursor skill** | Agent-driven deploy via Makefile | `cluster-bootstrap` skill |
| **Makefile (platform only)** | Terminal / CI | `make deploy-all` |
| **Step-by-step Makefile** | Debugging a failed step | Individual targets (see [Manual step-by-step deploy](#manual-step-by-step-deploy)) |

> **Important**: Use `make deploy-all` for the platform happy path. Do **not** run raw `helm upgrade --install` without the corresponding Makefile target — the Makefile blocks between steps until CSV, DSCI, CRDs, namespaces, and Dashboard ownership are ready.

### Deploy via Cursor skills

| Skill | Path | Use when you want to… |
|---|---|---|
| `cluster-bootstrap` | [`.cursor/skills/cluster-bootstrap/`](../.cursor/skills/cluster-bootstrap/SKILL.md) | Deploy the full RHOAI platform stack |
| `cluster-cleanup` | [`.cursor/skills/cluster-cleanup/`](../.cursor/skills/cluster-cleanup/SKILL.md) | Remove all platform components and reset the cluster |

**Example prompts:**

```
Bootstrap the demo cluster with RHOAI
```

```
Clean up the demo cluster
```

### Quick deploy (Makefile)

From the **repo root**:

```bash
make deploy-all      # platform only
make demo            # platform + OpenShell + OpenClaw + verify
```

**Makefile:** [`deploy/Makefile`](../deploy/Makefile) (repo root [`Makefile`](../Makefile) forwards to it)

`make deploy-all` installs five Helm releases in order and **blocks between steps** until OpenShift dependencies are ready. Typical runtime: 5–15 minutes depending on cluster image pulls and InstallPlan approval.

#### Install order (with built-in waits)

| Step | Make target | Helm release | Waits before proceeding |
|---|---|---|---|
| 1a | `wait-operators` | `rhoai-operators` | RHOAI CSV Succeeded (auto-approves Manual InstallPlan), operator pods Ready, DSCI Ready, `redhat-ods-applications` namespace, `datascienceclusters` CRD |
| 1b | (inside `wait-operators`) | — | Agent Sandbox Operator CSV Succeeded (auto-approves InstallPlan), `sandboxes.agents.x-k8s.io` CRD |
| 1c | `deploy-platform` | `rhoai-platform` | `adopt-dashboard-config` (before and after Helm), `OdhDashboardConfig` CRD, `odh-dashboard-config` singleton |
| 2 | `deploy-database` | `rhoai-database` | — |
| 3 | `wait-mlflow-crd` → `deploy-mlflow` | `rhoai-mlflow` | `mlflows.mlflow.opendatahub.io` CRD |
| 4 | `wait-evalhub-crd` → `deploy-evalhub` | `rhoai-evalhub` | `evalhubs.trustyai.opendatahub.io` CRD |

These waits are **required** for a reliable install. Without them, Helm fails with missing CRDs or unprocessed finalizers.

On success, `deploy-all` prints:

```
All RHOAI components deployed.
Next: make deploy-openshell HELM_OPTS='--set global.appsDomain=<your-apps-domain>'
```

#### What gets enabled in DataScienceCluster

The platform chart (`helm/platform`) manages these components as **Managed**:

| Component | Purpose |
|---|---|
| `dashboard` | RHOAI dashboard |
| `mlflowoperator` | MLflow operator |
| `trustyai` | NeMo Guardrails path |
| `kserve` | Model serving (TrustyAI dependency) |

Components explicitly set to **Removed** to reduce cluster footprint: `modelsAsService` (demo uses external MaaS via OpenShell, not RHOAI's native MaaS gateway), workbenches, model registry, Ray, trainer, feast, kueue, spark, AI pipelines.

> **Note**: `make validate` requires DataScienceCluster phase **Ready**. If validation fails on DSC phase, wait 60s and re-run — components may still be reconciling after the Helm install completes.

#### Optional: skip EvalHub

EvalHub is optional for the core demo. To deploy without it:

```bash
cd deploy
make deploy-platform
make deploy-database
make deploy-mlflow
make validate
```

## Validate platform

After `deploy-all` completes, **always** run the platform health check before proceeding to OpenShell:

```bash
make -C deploy validate
```

`make validate` checks:

| Check | What it verifies |
|---|---|
| Helm releases | All 5 `rhoai-*` releases deployed |
| RHOAI operator | CSV Succeeded, pods Ready |
| Platform components | MLflow operator, TrustyAI, Dashboard conditions True |
| DataScienceCluster | Phase `Ready` (hard fail if not) |
| Database | PostgreSQL `maas-db` Available |
| MLflow | CR Available, route URL printed |
| EvalHub | Phase Ready, `status.ready` True |

### Expected output

When all checks pass:

```
=== Helm releases ===
OK: all 5 expected rhoai-* releases deployed
=== RHOAI operator ===
OK: operator CSV Succeeded, pods Ready
=== Platform components ===
OK: MLflow operator, TrustyAI, Dashboard ready
OK: DataScienceCluster phase Ready
=== Database ===
OK: PostgreSQL maas-db Available
=== MLflow ===
OK: MLflow Available (https://rh-ai.apps.<cluster-domain>/mlflow)
=== EvalHub ===
OK: EvalHub Ready

All validation checks passed.
```

If platform components are still reconciling (common in the first ~60s after deploy), wait and re-run:

```bash
sleep 60 && make -C deploy validate
```

### Optional: inspect individual resources

```bash
oc get datasciencecluster default-dsc -o jsonpath='{.status.phase}{"\n"}'
oc get mlflow mlflow -n redhat-ods-applications
oc get evalhub evalhub -n evaluation
```

These `oc get` commands are for human inspection only — they are not a substitute for `make validate`.

### Expected component status

| Component | Status |
|---|---|
| RHOAI Operator 3.4.x | CSV Succeeded |
| Dashboard | Ready |
| MLflow Operator | Ready |
| TrustyAI | Ready |
| KServe | Ready |
| DataScienceCluster | Phase Ready |
| PostgreSQL | Running |
| MLflow | Available, Route accessible |
| EvalHub | Ready |

## Full verification

Platform validation (`make validate`) is only **check layer 1**. After deploying OpenShell and launching OpenClaw, run the full verification script — or let `cluster-lifecycle.sh verify` call it for you:

```bash
./scripts/verify.sh
# equivalent:
./scripts/cluster-lifecycle.sh verify
```

**Script:** [`scripts/verify.sh`](../scripts/verify.sh) — internally runs `make -C deploy <target>` for each layer.

Verification layers (checks live in Makefile; orchestration in `verify.sh`):

| Layer | Implemented as | Invoked by `verify.sh` | When required |
|---|---|---|---|
| 1 — RHOAI platform | `deploy/Makefile` | `make validate` | After `deploy-all` |
| 2 — OpenShell infra | `deploy/Makefile` | `make validate-openshell` | After `deploy-openshell` |
| 3 — OpenClaw + MaaS | `deploy/Makefile` | `make validate-openclaw` | After `launch-openclaw.sh` (may WARN on embedded CLI fallback) |
| 4 — Sandbox policy | `deploy/Makefile` | `make validate-security` | After sandbox is running |
| 5 — Playwright E2E | `deploy/Makefile` | `make test-e2e` | Full demo (browser → UI → gateway → model) |
| 6 — MLflow traces | `deploy/Makefile` | `make validate-traces` | After at least one agent interaction |

Profiles:

```bash
./scripts/verify.sh              # full (default)
./scripts/verify.sh --smoke      # validate-smoke only (OpenShell + security)
./scripts/verify.sh --skip-e2e   # Layers 1–4 without Playwright/traces
```

Or via the lifecycle wrapper:

```bash
./scripts/cluster-lifecycle.sh verify
./scripts/cluster-lifecycle.sh verify --smoke
./scripts/cluster-lifecycle.sh verify --skip-e2e
```

Pre-demo smoke check (fast, no Playwright):

```bash
./tests/health-check.sh    # runs verify --smoke
```

## Teardown

Remove all platform components to reset the cluster:

```bash
make -C deploy undeploy-all
```

For the full stack (OpenShell + RHOAI + operators):

```bash
make -C deploy undeploy-everything
```

`make undeploy-all` handles RHOAI teardown in the **correct order**:

| Step | Make target | What it does |
|---|---|---|
| 1 | `undeploy-apps` | Helm uninstall: evalhub, mlflow, database, platform |
| 2 | `purge-dsci` | Delete DSCInitialization while operator can still process finalizers |
| 3 | `undeploy-operators` | Helm uninstall: operators |
| 4 | `cleanup-orphans` | Remove residual subscription/CSV, orphan deployments, and namespaces |

The order is **critical**: DSCI must be deleted before the operator CSV is removed. If the operator is gone first, the DSCI finalizer cannot be processed and gets stuck in `Terminating`. The Makefile enforces this order and includes a finalizer patch fallback if the DSCI delete times out.

### Validate cleanup

After teardown:

```bash
make -C deploy validate-cleanup
```

`make validate-cleanup` checks:

- No `rhoai-*` Helm releases remain
- No OpenShell / openclaw-ui-proxy releases
- No DSCInitialization or DataScienceCluster resources
- Demo namespaces removed (`redhat-ods-operator`, `redhat-ods-applications`, `redhat-ods-monitoring`, `evaluation`, `models-as-a-service`, `rhoai-model-registries`, `agent-sandbox-system`, `openshell`)

Wait ~2 minutes after full cleanup before re-bootstrapping to allow namespaces to finish terminating.

## Helm charts

All manifests live under [`deploy/helm/`](../deploy/helm/):

| Chart | Release name | Purpose |
|---|---|---|
| `helm/operators` | `rhoai-operators` | RHOAI + Agent Sandbox operator subscriptions (`stable-3.4` / `preview-0.9`) |
| `helm/platform` | `rhoai-platform` | DataScienceCluster + Dashboard config |
| `helm/database` | `rhoai-database` | PostgreSQL for MLflow and EvalHub |
| `helm/mlflow` | `rhoai-mlflow` | MLflow CR, route, DB secret |
| `helm/evalhub` | `rhoai-evalhub` | EvalHub CR, namespace, DB secret |

Lint and template locally:

```bash
cd deploy && make lint
cd deploy && make template
```

## Version pinning

All operators and components use **explicit pinned versions**. We upgrade deliberately and test before bumping.

| Setting | Current value | Location |
|---|---|---|
| RHOAI operator channel | `stable-3.4` | `deploy/helm/operators/values.yaml` |
| Agent Sandbox channel | `preview-0.9` | `deploy/helm/operators/values.yaml` |
| Operator chart appVersion | `3.4` | `deploy/helm/operators/Chart.yaml` |
| PostgreSQL image | `registry.redhat.io/rhel9/postgresql-16:latest` | `deploy/helm/database/values.yaml` |

Bump versions deliberately and re-test on the target cluster before updating manifests. See [AGENTS.md](../AGENTS.md) for the full version pinning policy.

## Troubleshooting

Only use these steps when `make deploy-all` or `make validate` fails. Do not run them as part of the normal flow — the Makefile waits already cover CSV, DSCI, CRD synchronization, and Dashboard race conditions.

| Symptom | Cause | Fix |
|---|---|---|
| Helm fails with missing CRD | Chart installed before operator reconciled | Re-run the failing Makefile target (includes waits) |
| `OdhDashboardConfig` conflict | Operator auto-created resource before Helm | Handled by `adopt-dashboard-config` in `deploy-platform`; see below if interrupted |
| DSC phase not Ready | Components still reconciling | `sleep 60 && make -C deploy validate` |
| DSCI stuck in Terminating after cleanup | Operator removed before DSCI | `oc patch dscinitialization default-dsci --type=merge -p '{"metadata":{"finalizers":[]}}'` |
| Namespace stuck in Terminating | Residual finalizers | See [cluster-cleanup skill](../.cursor/skills/cluster-cleanup/SKILL.md) namespace cleanup |
| Orphan pods after cleanup | Dashboard redirect, maas-controller | `oc delete deployment --all -n redhat-ods-applications` |

### Platform: OdhDashboardConfig conflict

Normally handled automatically by `make deploy-platform` (`adopt-dashboard-config` target). If a partial/interrupted deploy left the singleton without Helm ownership:

```bash
oc annotate odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  meta.helm.sh/release-name=rhoai-platform meta.helm.sh/release-namespace=default --overwrite
oc label odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  app.kubernetes.io/managed-by=Helm --overwrite
helm upgrade --install rhoai-platform deploy/helm/platform
```

### Platform: CRD not ready on first attempt

Re-run the platform chart after DSC reconciles:

```bash
helm upgrade --install rhoai-platform deploy/helm/platform
```

### Manual step-by-step deploy

If `deploy-all` fails repeatedly, deploy individual Makefile targets in order:

```bash
cd deploy
make deploy-platform    # includes wait-operators + adopt-dashboard-config
make deploy-database
make deploy-mlflow      # includes wait-mlflow-crd
make deploy-evalhub     # includes wait-evalhub-crd
make validate
```

Do **not** call bare `helm upgrade --install` without the corresponding `make` target — you will skip the required waits.

## Next steps

| Goal | Command |
|---|---|
| Full demo (deploy + verify) | `make demo` |
| Platform only | `make deploy-all && make validate` |
| Agent layer (after platform) | `make deploy-agent` |
| Verify full stack | `make validate-full` |
| Pre-demo smoke | `./tests/health-check.sh` |

With agent automation and preflight: `./scripts/cluster-lifecycle.sh preflight && ./scripts/cluster-lifecycle.sh full`

See [OpenShell Installation Guide § OpenShift](openshell-installation.md#openshift--rhoai-cluster-deployment) for OpenShell details.

## Related demo docs

- [`.cursor/skills/cluster-bootstrap/`](../.cursor/skills/cluster-bootstrap/SKILL.md) — deploy platform stack
- [`.cursor/skills/cluster-cleanup/`](../.cursor/skills/cluster-cleanup/SKILL.md) — teardown platform stack
- [`scripts/cluster-lifecycle.sh`](../scripts/cluster-lifecycle.sh) — preflight, deploy, verify, teardown orchestration
- [`scripts/verify.sh`](../scripts/verify.sh) — layered verification (platform → OpenShell → E2E → traces)
- [`deploy/Makefile`](../deploy/Makefile) — all deploy, validate, and teardown targets
- [`deploy/helm/`](../deploy/helm/) — Helm charts for RHOAI platform
- [OpenShell Installation Guide](openshell-installation.md) — sandbox gateway (separate from platform bootstrap)
- [AGENTS.md](../AGENTS.md) — platform stack and architecture
- [ROADMAP.md](ROADMAP.md) — Phase 1 validation tasks

## References

- [Red Hat OpenShift AI Self-Managed 3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/)
- [RHOAI Supported Configurations 3.x](https://access.redhat.com/articles/rhoai-supported-configs-3.x)
- [RHOAI Release Notes 3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/release_notes/)
- [MLflow Operator (upstream)](https://github.com/opendatahub-io/mlflow-operator)
- [TrustyAI Operator](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/serving_models/serving-large-models_serving-large-models#about-trustyai-operator)
- [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails)
