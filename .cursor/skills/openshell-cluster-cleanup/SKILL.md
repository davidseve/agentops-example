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
| Full namespace teardown | `helm uninstall` + optional `oc delete ns openshell` |
| Preview what exists | `make -C deploy openshell-status` |

## Workflow

1. **Confirm intent** — cluster teardown, not local uninstall.
2. **Show current state**:

```bash
make -C deploy openshell-status
```

3. **Uninstall Helm release** (default — keeps namespace and PVCs):

```bash
make -C deploy openshell-uninstall
```

4. **Verify**:

```bash
make -C deploy openshell-status   # release should be gone
oc -n openshell get pods          # gateway pod terminated
```

5. **Optional full cleanup** — only if user explicitly requests namespace removal:

```bash
oc delete ns openshell
```

Warn: deletes PVCs, secrets, and sandbox SA. Agent Sandbox controller in `agent-sandbox-system` remains.

## What is removed

| Component | Default uninstall | + `oc delete ns` |
|---|---|---|
| Helm release / gateway StatefulSet | Yes | Yes |
| TLS/JWT secrets | Yes | Yes |
| Namespace | No | Yes |
| PVC data | Retained | Deleted |
| Agent Sandbox controller | No | No |
| Local `openshell` CLI | No | No |

## Safety rules

- **Always confirm** before uninstall unless user explicitly requested immediate removal.
- **Do not** delete `agent-sandbox-system` unless user asks to remove Agent Sandbox cluster-wide.
- **Do not** run `openshell-local-cleanup` for cluster requests.
- **PVC retention** — mention that default uninstall keeps PVCs; namespace delete removes them.

## Related

- Cluster reinstall: `openshell-cluster-install` skill
- Local cleanup: `openshell-local-cleanup` skill
- Guide: [docs/openshell-installation.md § Uninstall (cluster)](../../../docs/openshell-installation.md#uninstall-cluster)
