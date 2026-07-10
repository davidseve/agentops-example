---
name: cluster-cleanup
description: "Clean up the demo cluster, removing deployed operators and platform components."
---

# Cluster Cleanup

Remove all platform components from the cluster to reset it to a clean state.

## Prerequisites

- `oc` CLI authenticated against the target cluster
- Cluster admin permissions
- `helm` CLI installed (v3.x)

## Cleanup

```bash
cd deploy && make undeploy-all
```

Then remove the operator and its managed resources:

```bash
# Delete DSCI while operator can still process the finalizer
oc delete dscinitialization --all --timeout=60s 2>/dev/null || true

# Remove subscription and CSV
oc delete subscription rhods-operator -n redhat-ods-operator 2>/dev/null || true
CSV=$(oc get csv -n redhat-ods-operator -o name 2>/dev/null | grep rhods)
[ -n "$CSV" ] && oc delete "$CSV" -n redhat-ods-operator

# Remove orphan deployments left by the operator
oc delete deployment --all -n redhat-ods-applications 2>/dev/null || true
oc delete service --all -n redhat-ods-applications 2>/dev/null || true

# Remove operator namespace
oc delete namespace redhat-ods-operator --wait=false 2>/dev/null || true
oc delete namespace evaluation --wait=false 2>/dev/null || true
```

Validate:

```bash
helm list -A | grep rhoai
oc get dscinitialization --no-headers 2>/dev/null
oc get datasciencecluster --no-headers 2>/dev/null
oc get pods -n redhat-ods-applications --no-headers 2>/dev/null
```

## Troubleshooting

### DSCI stuck in Terminating

If the operator CSV was deleted before DSCI, the finalizer can't be processed:

```bash
oc patch dscinitialization default-dsci --type=merge -p '{"metadata":{"finalizers":[]}}'
```

### Namespace stuck in Terminating

```bash
for ns in redhat-ods-operator redhat-ods-applications redhat-ods-monitoring evaluation; do
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

- Cleanup order: EvalHub/MLflow first, then database, then platform, then operator
- CRITICAL: Always delete DSCI BEFORE removing the operator CSV
- After full cleanup, wait ~2 minutes for all pods to terminate before re-bootstrapping
