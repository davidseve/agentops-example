---
name: cluster-cleanup
description: "Clean up the demo cluster, removing deployed operators and platform components."
---

# Cluster Cleanup

Remove all platform components from the cluster to reset it to a clean state.

**Full guide:** [docs/cluster-bootstrap.md](../../docs/cluster-bootstrap.md) (Teardown section)

## Prerequisites

- `oc` CLI authenticated against the target cluster
- Cluster admin permissions
- `helm` CLI installed (v3.x)

## Cleanup

```bash
cd deploy && make undeploy-all
```

`make undeploy-all` handles the full teardown in the correct order:

| Step | Make target | What it does |
|------|-------------|-------------|
| 1 | `undeploy-apps` | Helm uninstall: evalhub, mlflow, database, platform |
| 2 | `purge-dsci` | Delete DSCInitialization while operator can still process finalizers |
| 3 | `undeploy-operators` | Helm uninstall: operators |
| 4 | `cleanup-orphans` | Remove residual subscription/CSV, orphan deployments, and namespaces |

The order is **critical**: DSCI must be deleted before the operator CSV is removed.
If the operator is gone first, the DSCI finalizer cannot be processed and gets stuck
in `Terminating`. The Makefile enforces this order automatically and includes a
finalizer patch fallback if the DSCI delete times out.

## Validate

After cleanup, verify the cluster is clean:

```bash
cd deploy && make validate-cleanup
```

`make validate-cleanup` checks:

- No `rhoai-*` Helm releases remain
- No DSCInitialization or DataScienceCluster resources
- Demo namespaces removed (`redhat-ods-operator`, `redhat-ods-applications`, `redhat-ods-monitoring`, `evaluation`, `models-as-a-service`, `rhoai-model-registries`, `agent-sandbox-system`)

## Troubleshooting

Only use these steps when `make undeploy-all` or `make validate-cleanup` reports
failures. Do not run them as part of the normal flow.

### DSCI stuck in Terminating

If the operator CSV was deleted before DSCI (should not happen with current Makefile):

```bash
oc patch dscinitialization default-dsci --type=merge -p '{"metadata":{"finalizers":[]}}'
```

### Namespace stuck in Terminating

```bash
for ns in redhat-ods-operator redhat-ods-applications redhat-ods-monitoring evaluation models-as-a-service rhoai-model-registries agent-sandbox-system; do
  PHASE=$(oc get namespace "$ns" -o jsonpath='{.status.phase}' 2>/dev/null)
  if [ "$PHASE" = "Terminating" ]; then
    echo "Removing finalizers from stuck namespace: $ns"
    oc get namespace "$ns" -o json | \
      jq '.spec.finalizers = []' | \
      oc replace --raw "/api/v1/namespaces/$ns/finalize" -f -
  fi
done
```

### Orphan pods still running

After removing the operator, some pods (dashboard-redirect, maas-controller) may linger:

```bash
oc delete deployment --all -n redhat-ods-applications 2>/dev/null || true
```

## Notes

- Cleanup order is enforced by Makefile dependencies: apps, then DSCI, then operator, then orphans
- After full cleanup, wait ~2 minutes for all pods to terminate before re-bootstrapping
- `purge-dsci` automatically patches finalizers if the delete times out (60s)
