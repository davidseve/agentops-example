---
name: openshell-local-cleanup
description: >-
  Remove the local OpenShell stack (CLI, gateway, user config) from macOS or
  Linux. Use when the user asks to uninstall, remove, or clean up OpenShell
  locally on their workstation — not cluster/OpenShift teardown.
---

# OpenShell Local Cleanup

Remove the **workstation** OpenShell stack using `scripts/uninstall-openshell.sh`. Destructive — confirm before `--yes`.

**Podman is never removed.** For cluster teardown use `openshell-cluster-cleanup`.

## When to use

| User intent | Action |
|---|---|
| Uninstall local OpenShell | `scripts/uninstall-openshell.sh --yes` |
| Preview removal | `--dry-run` |
| Remove Homebrew tap (macOS) | `REMOVE_BREW_TAP=1` |

## Workflow

1. **Confirm** — local uninstall, not cluster.
2. **Dry-run** — `./scripts/uninstall-openshell.sh --dry-run`
3. **Uninstall**:

```bash
./scripts/uninstall-openshell.sh --yes
```

4. **Verify** — `command -v openshell` fails; `~/.config/openshell` gone; Podman still present.

## What is removed

- OpenShell CLI and local gateway packages
- Gateway service (brew / systemd user)
- `~/.config/openshell/`

## What is NOT removed

- Podman, Docker, or other runtimes
- OpenShift cluster release (use `openshell-cluster-cleanup`)

## Related

- Local reinstall: `openshell-local-install` skill
- Cluster cleanup: `openshell-cluster-cleanup` skill
- Full guide: [docs/openshell-installation.md](../../../docs/openshell-installation.md) § Uninstall
