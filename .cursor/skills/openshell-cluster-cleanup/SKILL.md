---
name: openshell-cluster-cleanup
description: >-
  Remove the OpenShell Helm release from OpenShift/RHOAI. Use when the user
  asks to uninstall, tear down, or clean up OpenShell on the cluster — not local
  workstation uninstall.
---

# OpenShell Cluster Cleanup

Remove OpenShell + oauth2-proxy + the Agent Sandbox raw-manifest install from OpenShift.
Destructive for the namespace workload — confirm with the user first.

Does **not** remove local CLI (`openshell-local-cleanup`) or the RHOAI/Agent Sandbox
operators installed via OLM (`make -C deploy undeploy-all`, a separate, RHOAI-wide
teardown).

## When to use

| User intent | Action |
|---|---|
| Uninstall OpenShell (+ oauth2-proxy, + Agent Sandbox raw manifest) from cluster | `make -C deploy undeploy-openshell` |
| Full reset: OpenShell + RHOAI stack | `make -C deploy undeploy-everything` |
| Preview what exists | `make -C deploy validate-openshell` (fails loudly if missing) or `helm list -A \| grep openshell` |
| Confirm cleanup was complete | `make -C deploy validate-cleanup` |

## Workflow

1. **Confirm intent** — cluster teardown, not local uninstall.
2. **Show current state**:

```bash
helm list -A | grep -E 'openshell|oauth2-proxy'
oc get ns openshell agent-sandbox-system 2>&1
```

3. **Uninstall**:

```bash
make -C deploy undeploy-openshell
```

Removes, in order: `oauth2-proxy` release, `openshell` release (single release: namespace
extras + gateway StatefulSet, in namespace `openshell`), the `openshell` namespace itself,
and the Agent Sandbox raw manifest (`oc delete -f manifests/agent-sandbox-v0.5.1.yaml` — CRD
`sandboxes.agents.x-k8s.io`, `ClusterRole`/`ClusterRoleBinding agent-sandbox-controller`,
namespace `agent-sandbox-system`).

4. **Verify**:

```bash
make -C deploy validate-cleanup
```

Checks: no `openshell`/`oauth2-proxy` Helm releases, no Agent Sandbox cluster-scoped
leftovers, namespace `openshell` gone (or draining — namespaces stuck in `Terminating` due
to an orphaned finalizer, e.g. on a `tenants.maas.opendatahub.io` resource after its owning
controller is already gone, need a manual
`oc patch <resource> --type=merge -p '{"metadata":{"finalizers":[]}}'`; `cleanup-orphans`
already does this for the known `models-as-a-service` case).

Note: the OLM-installed Agent Sandbox Operator (in `agent-sandbox-system`, from
`make -C deploy deploy-operators`) is a separate, RHOAI-wide concern — removed by
`make -C deploy cleanup-orphans` (part of `undeploy-all`/`undeploy-everything`), not by
this skill alone.

## What is removed

| Component | Removed by `undeploy-openshell` |
|---|---|
| `openshell` Helm release (namespace extras + gateway StatefulSet, TLS/JWT secrets) | Yes |
| `oauth2-proxy` Helm release | Yes |
| Namespace `openshell` (+ PVC data) | Yes |
| Agent Sandbox raw manifest (CRD, cluster-scoped RBAC, `agent-sandbox-system` namespace) | Yes |
| Agent Sandbox Operator (OLM Subscription/CSV) | No — use `make -C deploy cleanup-orphans` |
| Local `openshell` CLI | No |

## Safety rules

- **Always confirm** before uninstall unless user explicitly requested immediate removal.
- **Do not** run `openshell-local-cleanup` for cluster requests.
- **PVC warning** — namespace deletion removes all PVCs; mention this when confirming.

## Related

- Cluster reinstall: `openshell-cluster-install` skill
- Local cleanup: `openshell-local-cleanup` skill
- Full RHOAI + OpenShell reset: `make -C deploy undeploy-everything`
- ADR: [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md)
