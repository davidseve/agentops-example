---
name: openshell-cluster-cleanup
description: >-
  Remove the OpenShell Helm release from OpenShift/RHOAI. Use when the user
  asks to uninstall, tear down, or clean up OpenShell on the cluster — not local
  workstation uninstall.
---

# OpenShell Cluster Cleanup

Remove the OpenShell **gateway Helm release** from OpenShift. Destructive for the namespace workload — confirm with the user first.

Does **not** remove local CLI (`openshell-local-cleanup`) or Agent Sandbox controller (cluster-wide prereq).

## When to use

| User intent | Action |
|---|---|
| Uninstall OpenShell from cluster | `make -C deploy openshell-uninstall` |
| Preview what exists | `make -C deploy openshell-status` |

## Workflow

1. **Confirm intent** — cluster teardown, not local uninstall.
2. **Show current state**:

```bash
make -C deploy openshell-status
```

3. **Uninstall** (removes Helm release + namespace):

```bash
make -C deploy openshell-uninstall
```

4. **Verify**:

```bash
make -C deploy openshell-status   # release should be gone
oc get ns openshell 2>&1          # namespace should be gone or Terminating
```

Note: Agent Sandbox controller in `agent-sandbox-system` remains.

## What is removed

| Component | Removed |
|---|---|
| Helm release / gateway StatefulSet | Yes |
| TLS/JWT secrets | Yes |
| Namespace `openshell` | Yes |
| PVC data | Yes (with namespace) |
| Agent Sandbox controller | No |
| Local `openshell` CLI | No |

## Safety rules

- **Always confirm** before uninstall unless user explicitly requested immediate removal.
- **Do not** delete `agent-sandbox-system` unless user asks to remove Agent Sandbox cluster-wide.
- **Do not** run `openshell-local-cleanup` for cluster requests.
- **PVC warning** — namespace deletion removes all PVCs; mention this when confirming.

## Related

- Cluster reinstall: `openshell-cluster-install` skill
- Local cleanup: `openshell-local-cleanup` skill
- Guide: [docs/openshell-installation.md § Uninstall (cluster)](../../../docs/openshell-installation.md#uninstall-cluster)
