# Cluster Bootstrap Guide

This guide documents how to deploy the RHOAI platform stack for the AgentOps demo on OpenShift:

| Scenario | Use case | Section |
|---|---|---|
| **Full platform deploy** | RHOAI operator, MLflow, TrustyAI, PostgreSQL, EvalHub | [Deploy](#deploy) |
| **Health validation** | Post-deploy checks before the demo | [Validate](#validate) |
| **Teardown** | Reset cluster to a clean state | [Teardown](#teardown) |

The bootstrap deploys the **platform layer** (RHOAI 3.x and dependencies). OpenShell is deployed separately — see [OpenShell Installation Guide](openshell-installation.md).

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
│  rhoai-operators  →  RHOAI subscription + CSV     │
│  rhoai-platform   →  DataScienceCluster + Dashboard│
│  rhoai-database   →  PostgreSQL (maas-db)           │
│  rhoai-mlflow     →  MLflow CR + Route            │
│  rhoai-evalhub    →  EvalHub CR                   │
└───────────────────────────────────────────────────┘
        │
        ▼
  redhat-ods-operator / redhat-ods-applications / evaluation
```

In **Cursor**, use the cluster bootstrap skills — see [Deploy via Cursor skills](#deploy-via-cursor-skills).

| Scenario | Skill |
|---|---|
| **Deploy platform** | `cluster-bootstrap` |
| **Teardown platform** | `cluster-cleanup` |

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

## Deploy

Three ways to deploy, from easiest to most manual:

| Method | Best for | Command |
|---|---|---|
| **Cursor skill** | Agent-driven deploy via Makefile | `cluster-bootstrap` skill |
| **Makefile (recommended)** | Terminal / CI | `make -C deploy deploy-all` |
| **Step-by-step Makefile** | Debugging a failed step | Individual targets (see [Manual step-by-step deploy](#manual-step-by-step-deploy)) |

> **Important**: Use `make deploy-all` for the happy path. Do **not** run raw `helm upgrade --install` without the corresponding Makefile target — the Makefile blocks between steps until CSV, DSCI, CRDs, and namespaces are ready.

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

From the repo root:

```bash
cd deploy && make deploy-all
```

**Makefile:** [`deploy/Makefile`](../deploy/Makefile)

`make deploy-all` installs five Helm releases in order and **blocks between steps** until OpenShift dependencies are ready.

#### Install order (with built-in waits)

| Step | Make target | Helm release | Waits before proceeding |
|---|---|---|---|
| 1 | `wait-operators` → `deploy-platform` | `rhoai-operators`, `rhoai-platform` | CSV Succeeded, operator pods Ready, DSCI Ready, `redhat-ods-applications` namespace, `datascienceclusters` CRD (`OdhDashboardConfig` CRD appears only after DSC enables Dashboard — do not wait for it here) |
| 2 | `deploy-database` | `rhoai-database` | — |
| 3 | `wait-mlflow-crd` → `deploy-mlflow` | `rhoai-mlflow` | `mlflows.mlflow.opendatahub.io` CRD |
| 4 | `wait-evalhub-crd` → `deploy-evalhub` | `rhoai-evalhub` | `evalhubs.trustyai.opendatahub.io` CRD |

These waits are **required** for a reliable install. Without them, Helm fails with missing CRDs or unprocessed finalizers.

#### What gets enabled in DataScienceCluster

The platform chart (`helm/platform`) manages these components as **Managed**:

| Component | Purpose |
|---|---|
| `dashboard` | RHOAI dashboard |
| `mlflowoperator` | MLflow operator |
| `trustyai` | NeMo Guardrails path |
| `kserve` | Model serving (TrustyAI dependency) |
| `modelsAsService` | MaaS integration (gateway not deployed in this demo) |

Components explicitly set to **Removed** to reduce cluster footprint: workbenches, model registry, Ray, trainer, feast, kueue, spark, AI pipelines.

> **Note**: DataScienceCluster may show phase **Not Ready** because `modelsAsService` requires a Gateway we do not deploy. Individual components (TrustyAI, MLflow, Dashboard) are still functional. `make validate` treats this as a WARN, not a failure.

#### Optional: skip EvalHub

EvalHub is optional for the core demo. To deploy without it:

```bash
cd deploy
make deploy-platform
make deploy-database
make deploy-mlflow
make validate
```

## Validate

After `deploy-all` completes, run the full health check:

```bash
cd deploy && make validate
```

Or from the repo root:

```bash
./tests/health-check.sh
```

**Script:** [`tests/health-check.sh`](../tests/health-check.sh) (wraps `make validate`)

`make validate` checks:

- 5 `rhoai-*` Helm releases deployed
- RHOAI operator CSV Succeeded, pods Ready
- DSC conditions: MLflow operator, TrustyAI, Dashboard ready
- PostgreSQL `maas-db` Available
- MLflow CR Available with route URL
- EvalHub Ready

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

### Expected result

| Component | Status |
|---|---|
| RHOAI Operator 3.4.x | CSV Succeeded |
| Dashboard | Ready |
| MLflow Operator | Ready |
| TrustyAI | Ready |
| KServe | Ready |
| PostgreSQL | Running |
| MLflow | Available, Route accessible |
| EvalHub | Ready |

## Teardown

Remove all platform components to reset the cluster:

```bash
cd deploy && make undeploy-all
```

`make undeploy-all` handles teardown in the **correct order**:

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
cd deploy && make validate-cleanup
```

`make validate-cleanup` checks:

- No `rhoai-*` Helm releases remain
- No DSCInitialization or DataScienceCluster resources
- Demo namespaces removed (`redhat-ods-operator`, `redhat-ods-applications`, `redhat-ods-monitoring`, `evaluation`, `models-as-a-service`, `rhoai-model-registries`, `agent-sandbox-system`)

Wait ~2 minutes after full cleanup before re-bootstrapping to allow namespaces to finish terminating.

## Helm charts

All manifests live under [`deploy/helm/`](../deploy/helm/):

| Chart | Release name | Purpose |
|---|---|---|
| `helm/operators` | `rhoai-operators` | Operator subscription (`stable-3.4` channel) |
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
| Operator chart appVersion | `3.4` | `deploy/helm/operators/Chart.yaml` |
| PostgreSQL image | `registry.redhat.io/rhel9/postgresql-16:latest` | `deploy/helm/database/values.yaml` |

Bump versions deliberately and re-test on the target cluster before updating manifests. See [AGENTS.md](../AGENTS.md) for the full version pinning policy.

## Troubleshooting

Only use these steps when `make deploy-all` or `make validate` fails. Do not run them as part of the normal flow — the Makefile waits already cover CSV, DSCI, and CRD synchronization.

| Symptom | Cause | Fix |
|---|---|---|
| Helm fails with missing CRD | Chart installed before operator reconciled | Re-run the failing Makefile target (includes waits) |
| `OdhDashboardConfig` conflict | Operator auto-created resource before Helm | Annotate and label for Helm ownership, then re-run platform chart (see below) |
| DSC components still reconciling | Normal during first ~60s | `sleep 60 && make validate` |
| DSCI stuck in Terminating after cleanup | Operator removed before DSCI | `oc patch dscinitialization default-dsci --type=merge -p '{"metadata":{"finalizers":[]}}'` |
| Namespace stuck in Terminating | Residual finalizers | See [cluster-cleanup skill](../.cursor/skills/cluster-cleanup/SKILL.md) namespace cleanup |
| Orphan pods after cleanup | Dashboard redirect, maas-controller | `oc delete deployment --all -n redhat-ods-applications` |

### Platform: OdhDashboardConfig conflict

If the operator auto-created `odh-dashboard-config` before Helm could manage it:

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
make deploy-platform    # includes wait-operators
make deploy-database
make deploy-mlflow      # includes wait-mlflow-crd
make deploy-evalhub     # includes wait-evalhub-crd
make validate
```

Do **not** call bare `helm upgrade --install` without the corresponding `make` target — you will skip the required waits.

## Next steps

After the platform stack is healthy:

1. **OpenShell** — deploy the sandbox gateway: [OpenShell Installation Guide § OpenShift](openshell-installation.md#openshift--rhoai-cluster-deployment)
2. **Agent** — implement and deploy the BYOA agent (Phase 3 in [ROADMAP.md](ROADMAP.md))
3. **Pre-demo check** — run `./tests/health-check.sh` before every presentation

## Related demo docs

- [`.cursor/skills/cluster-bootstrap/`](../.cursor/skills/cluster-bootstrap/SKILL.md) — deploy platform stack
- [`.cursor/skills/cluster-cleanup/`](../.cursor/skills/cluster-cleanup/SKILL.md) — teardown platform stack
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
