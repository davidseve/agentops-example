---
name: cluster-bootstrap
description: "Bootstrap the demo cluster with all required operators and platform components."
---

# Cluster Bootstrap

Deploy all platform components to a fresh OpenShift cluster for the AgentOps demo.

## Prerequisites

- `oc` CLI authenticated against the target cluster
- Cluster admin permissions
- `helm` CLI installed (v3.x)

## Deploy

```bash
cd deploy && make deploy-all
```

`make deploy-all` is the single entry point. It installs charts in order and **blocks
between steps** until OpenShift dependencies are ready. Do not run raw `helm` commands
for the happy path — the Makefile handles synchronization.

### Install order (with built-in waits)

| Step | Make target | Waits before proceeding |
|------|-------------|-------------------------|
| 1 | `wait-operators` → `deploy-platform` | CSV Succeeded (auto-approves Manual InstallPlan), operator pods Ready, DSCI Ready, `redhat-ods-applications` namespace, platform CRDs |
| 1b | (inside deploy-platform) | LlamaStackOperatorReady, Dashboard CRD, adopt-dashboard-config, genAiStudio patch |
| 2 | `deploy-database` | — |
| 3 | `wait-mlflow-crd` → `deploy-mlflow` | `mlflows.mlflow.opendatahub.io` CRD |
| 4 | `wait-evalhub-crd` → `deploy-evalhub` | `evalhubs.trustyai.opendatahub.io` CRD |

These waits are **required** for a reliable install. Without them, Helm fails with
missing CRDs or unprocessed finalizers. The skill does not duplicate this logic —
it relies on the Makefile.

### Race condition handling (ADR-0001)

The `deploy-platform` target handles three documented races:
1. **LlamaStack before Dashboard**: On fresh clusters, applies DSC with dashboard=Removed first,
   waits for LlamaStackOperatorReady, then re-applies with dashboard=Managed.
2. **Dashboard CRD race**: Waits for `OdhDashboardConfig` CRD registration after enabling dashboard.
3. **Helm ownership adoption**: The operator auto-creates `odh-dashboard-config` without Helm metadata.
   The Makefile adopts it before the second `helm upgrade` attempt.

## Validate

After `deploy-all` completes, run the full health check:

```bash
cd deploy && make validate
```

`make validate` checks:

- 5 `rhoai-*` Helm releases deployed
- RHOAI operator CSV Succeeded, pods Ready
- DSC conditions: OGX, MLflow operator, TrustyAI, Dashboard ready
- PostgreSQL `maas-db` Available
- MLflow CR Available with route URL
- EvalHub Ready

If platform components are still reconciling (common in the first ~60s after deploy),
wait and re-run `make validate`.

### Optional: inspect individual resources

```bash
oc get datasciencecluster default-dsc -o jsonpath='{.status.phase}{"\n"}'
oc get mlflow mlflow -n redhat-ods-applications
oc get evalhub evalhub -n evaluation
```

These `oc get` commands are for human inspection only — they are not a substitute
for `make validate`.

## Expected Result

| Component | Status |
|---|---|
| RHOAI Operator 3.4.x | CSV Succeeded |
| Dashboard | Ready |
| LlamaStack/OGX Operator | Ready |
| MLflow Operator | Ready |
| TrustyAI | Ready |
| KServe | Ready |
| PostgreSQL | Running |
| MLflow | Available, Route accessible |
| EvalHub | Ready |

Note: DSC may show "Not Ready" because `modelsAsService` requires a Gateway we don't deploy.
`make validate` treats this as a WARN, not a failure. Individual components (TrustyAI,
MLflow, OGX, Dashboard) are all functional.

## Troubleshooting

Only use these steps when `make deploy-all` or `make validate` fails. Do not run them
as part of the normal flow — the Makefile waits already cover CSV, DSCI, CRD
synchronization, and Dashboard race conditions automatically.

### Platform: OdhDashboardConfig conflict

Handled automatically by `make deploy-platform` (adopt-dashboard-config target).
If it still fails after a partial/interrupted deploy:

```bash
oc annotate odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  meta.helm.sh/release-name=rhoai-platform meta.helm.sh/release-namespace=default --overwrite
oc label odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  app.kubernetes.io/managed-by=Helm --overwrite
helm upgrade --install rhoai-platform helm/platform
```

### Platform: CRD not ready on first attempt

Re-run the platform chart after DSC reconciles:

```bash
helm upgrade --install rhoai-platform helm/platform
```

### DSC components still reconciling

Wait 60s and re-run validation:

```bash
sleep 60 && make validate
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

Do **not** call bare `helm upgrade --install` without the corresponding `make` target —
you will skip the required waits.

## Notes

- The RHOAI operator auto-creates DSCInitialization on startup (no COO needed)
- `llamastackoperator: Managed` enables the OGX operator for API abstraction
- TrustyAI requires `kserve` and `modelsAsService` to be Managed (CRD dependency)
- MLflow requires the database to be ready first (dependency in Makefile)
- EvalHub is optional and can be skipped with `make deploy-mlflow` instead of `make deploy-all`
