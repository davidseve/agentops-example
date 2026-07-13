---
name: openshell-local-install
description: >-
  Install the local OpenShell stack (CLI, gateway, Podman driver) on macOS or
  Linux for the AgentOps demo. Use when the user asks to install OpenShell
  locally, on their workstation, Mac, or laptop — not on OpenShift/cluster.
  Also for configuring openshell-gateway locally or preparing local sandboxes.
---

# OpenShell Local Install

Install the **workstation** OpenShell stack using `scripts/install-openshell.sh`. Do **not** use this skill for OpenShift/cluster deploy — use `openshell-cluster-install` instead.

Do **not** run `brew install openshell` directly — OpenShell is not in Homebrew core.

## When to use

| User intent | Action |
|---|---|
| Install OpenShell on my Mac/laptop | Run `scripts/install-openshell.sh` |
| Pin a version | Set `OPENSHELL_VERSION` |
| Use Docker instead of Podman | Set `OPENSHELL_DRIVER=docker SKIP_PODMAN=1` |
| Preview changes | Run with `--dry-run` |
| Verify install | Run `openshell status` |

## Workflow

1. **Confirm platform** — macOS or Linux workstation (not cluster-only request).
2. **Dry-run if uncertain** — `./scripts/install-openshell.sh --dry-run`
3. **Install** — from repo root:

```bash
./scripts/install-openshell.sh
```

4. **Verify** — expect `Connected` from `openshell status`.
5. **Report** — version, gateway URL (`https://127.0.0.1:17670`), compute driver, service status.

## Script options

| Variable / flag | Default | Purpose |
|---|---|---|
| `OPENSHELL_VERSION` | latest | Pin release (e.g. `0.0.80`) |
| `OPENSHELL_DRIVER` | `podman` | `podman`, `docker`, or `vm` |
| `SKIP_PODMAN` | `0` | Set to `1` to skip Podman install |
| `LOCAL_GATEWAY_URL` | `https://127.0.0.1:17670` | Gateway endpoint |
| `--dry-run` | off | Print planned actions only |

## What the script does

1. Runs the official NVIDIA OpenShell install script
2. Installs and starts Podman (unless skipped)
3. Writes `~/.config/openshell/gateway.env`
4. Restarts the gateway service (`brew services` / `systemctl --user`)
5. Registers the local gateway and runs `openshell status`

## Safety rules

- **Prefer the project script** over manual `curl | sh`.
- **Do not** run `brew install openshell` — use the official tap via the install script.
- **Cluster deploy is separate** — use `openshell-cluster-install` for OpenShift.

## Post-install checks

```bash
openshell status
openshell sandbox list
```

## Related

- Local uninstall: `openshell-local-cleanup` skill
- Cluster install: `openshell-cluster-install` skill
- Full guide: [docs/openshell-installation.md](../../../docs/openshell-installation.md)
