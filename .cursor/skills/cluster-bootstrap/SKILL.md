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

This installs in order: operators -> platform -> database -> mlflow -> evalhub.

After deploy, wait for operators to reconcile and validate:

```bash
# Wait for RHOAI operator
oc wait --for=condition=Ready pod -l name=rhods-operator \
  -n redhat-ods-operator --timeout=300s

# Wait for database
oc wait --for=condition=Available deployment/maas-db \
  -n redhat-ods-applications --timeout=120s

# Wait for MLflow
oc wait --for=condition=Ready pod -l app=mlflow \
  -n redhat-ods-applications --timeout=300s

# Validate
oc get datasciencecluster default-dsc -o jsonpath='{.status.phase}'
oc get mlflow mlflow
oc get evalhub evalhub -n evaluation
```

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
This is expected -- the individual components (TrustyAI, MLflow, OGX) are all functional.

## Troubleshooting

If `make deploy-all` fails, deploy step by step:

### Step 1: Operators

```bash
cd deploy
helm upgrade --install rhoai-operators helm/operators
```

Wait for CSV to succeed:

```bash
until oc get csv -n redhat-ods-operator 2>/dev/null | grep -q Succeeded; do sleep 15; done
```

### Step 2: Platform

Wait for DSCI to be auto-created, then deploy:

```bash
sleep 30
helm upgrade --install rhoai-platform helm/platform
```

On first install, `OdhDashboardConfig` may fail if the CRD isn't ready yet. Run the
upgrade again after DSC reconciles:

```bash
helm upgrade --install rhoai-platform helm/platform
```

If the dashboard config resource already exists (operator auto-created it), adopt it:

```bash
oc annotate odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  meta.helm.sh/release-name=rhoai-platform meta.helm.sh/release-namespace=default --overwrite
oc label odhdashboardconfig odh-dashboard-config -n redhat-ods-applications \
  app.kubernetes.io/managed-by=Helm --overwrite
helm upgrade --install rhoai-platform helm/platform
```

### Step 3: Database

```bash
helm upgrade --install rhoai-database helm/database
oc wait --for=condition=Available deployment/maas-db \
  -n redhat-ods-applications --timeout=120s
```

### Step 4: MLflow

```bash
helm upgrade --install rhoai-mlflow helm/mlflow
```

### Step 5: EvalHub (optional)

```bash
helm upgrade --install rhoai-evalhub helm/evalhub
```

## Notes

- The RHOAI operator auto-creates DSCInitialization on startup (no COO needed)
- `llamastackoperator: Managed` enables the OGX operator for API abstraction
- TrustyAI requires `kserve` and `modelsAsService` to be Managed (CRD dependency)
- MLflow requires the database to be ready first (dependency in Makefile)
- EvalHub is optional and can be skipped with `make deploy-mlflow` instead of `make deploy-all`
