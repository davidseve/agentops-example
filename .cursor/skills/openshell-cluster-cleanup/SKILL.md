---
name: openshell-cluster-cleanup
description: >-
  Remove the OpenShell Helm release from OpenShift/RHOAI. Use when the user
  asks to uninstall, tear down, or clean up OpenShell on the cluster — not local
  workstation uninstall.
---

# OpenShell Cluster Cleanup

Remove OpenShell + openclaw-ui-proxy from OpenShift.
Destructive for the namespace workload — confirm with the user first.

Does **not** remove local CLI (`openshell-local-cleanup`) or the RHOAI/Agent Sandbox
operators installed via OLM (`make -C deploy undeploy-all`, a separate, RHOAI-wide
teardown).

## When to use

| User intent | Action |
|---|---|
| Uninstall OpenShell (+ openclaw-ui-proxy) from cluster | `make -C deploy undeploy-openshell` |
| Full reset: OpenShell + RHOAI stack (+ Agent Sandbox Operator) | `make -C deploy undeploy-everything` |
| Preview what exists | `make -C deploy validate-openshell` (fails loudly if missing) or `helm list -A \| grep openshell` |
| Confirm cleanup was complete | `make -C deploy validate-cleanup` |

## Workflow

1. **Confirm intent** — cluster teardown, not local uninstall.
2. **Show current state**:

```bash
helm list -A | grep -E 'openshell|openclaw-ui-proxy'
oc get ns openshell agent-sandbox-system 2>&1
```

3. **Uninstall**:

```bash
make -C deploy undeploy-openshell
```

Removes, in order: `openclaw-ui-proxy` release, `openshell` release (single release: namespace
extras + gateway StatefulSet, in namespace `openshell`), and the `openshell` namespace itself.
Does **not** remove the Agent Sandbox Operator (shared OLM install in `agent-sandbox-system`).

4. **Verify**:

```bash
make -C deploy validate-cleanup
```

Checks: no `openshell`/`openclaw-ui-proxy` Helm releases, namespace `openshell` gone (or draining — namespaces stuck in `Terminating` due
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
| `openclaw-ui-proxy` Helm release (nginx mTLS bridge + UI Route) | Yes |
| Namespace `openshell` (+ PVC data) | Yes |
| Agent Sandbox Operator (OLM Subscription/CSV, CRDs, `agent-sandbox-system`) | No — use `make -C deploy cleanup-orphans` |
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
