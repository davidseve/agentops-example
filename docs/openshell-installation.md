# OpenShell Installation Guide

This guide documents how to install [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) for the AgentOps demo:

| Target | Use case | Section |
|---|---|---|
| **macOS / Linux workstation** | Local dev, CLI, Podman sandboxes | [Local install](#install) |
| **OpenShift / RHOAI cluster** | Demo gateway on OCP with Kubernetes driver | [OpenShift cluster deployment](#openshift--rhoai-cluster-deployment) |

OpenShell provides sandboxed, zero-trust execution for AI agents.

**Official references**:

- [OpenShell Installation](https://docs.nvidia.com/openshell/latest/about/installation) (CLI)
- [OpenShift install guide](https://docs.nvidia.com/openshell/latest/kubernetes/openshift) (Helm chart)
- [Helm chart README — Secret bootstrap](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md#secret-bootstrap)

## Overview

A working OpenShell setup has two components:

| Component | Role |
|---|---|
| `openshell` CLI | Creates sandboxes, applies policies, manages providers |
| `openshell-gateway` | Daemon that talks to the compute driver (Podman, Docker, MicroVM, Kubernetes) |

**Local:** the project installer (`scripts/install-openshell.sh`) installs both components, configures Podman as the compute driver, and starts a gateway on `https://127.0.0.1:17670`.

**Cluster:** the Helm chart deploys the gateway into OpenShift; sandboxes are provisioned by the Kubernetes driver via the [Red Hat build of Agent Sandbox](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_red_hat_build_of_agent_sandbox/) Operator.

In **Cursor**, use the OpenShell skills for each scenario — see [Install via Cursor skills](#install-via-cursor-skills).

| Scenario | Install skill | Cleanup skill |
|---|---|---|
| **Local** (macOS/Linux workstation) | `openshell-local-install` | `openshell-local-cleanup` |
| **Cluster** (OpenShift/RHOAI) | `openshell-cluster-install` | `openshell-cluster-cleanup` |

> **Important**: `openshell` is **not** in Homebrew core. Do not run `brew install openshell` directly. Use the official install script, which adds the `nvidia/openshell` tap on macOS.

## Prerequisites

### All platforms

- Network access to GitHub releases and container registries (for sandbox images)
- A supported **compute driver** for creating sandboxes (see [Compute Drivers](#compute-drivers))

### macOS (Apple Silicon)

- macOS on Apple Silicon (`arm64`)
- [Homebrew](https://brew.sh/)
- One of: Podman 5.x, Docker Desktop 28+, or host virtualization for MicroVM

### Linux

- glibc **2.28+** (Debian/Ubuntu, RHEL/Fedora; Alpine/musl not supported by packages)
- Package manager: `dnf`/`yum` (RPM) or `apt` (Debian package)
- For Podman driver: Podman 5.x, cgroups v2, rootless networking, active user socket

## Install

Three ways to install or remove the local OpenShell stack, from easiest to most manual:

| Method | Best for | Install | Uninstall |
|---|---|---|---|
| **Cursor skills (local)** | Workstation setup via agent | `openshell-local-install` | `openshell-local-cleanup` |
| **Cursor skills (cluster)** | OpenShift deploy via agent | `openshell-cluster-install` | `openshell-cluster-cleanup` |
| **Project scripts** | Terminal / CI (local) | `scripts/install-openshell.sh` | `scripts/uninstall-openshell.sh` |
| **Deploy Makefile** | Terminal / CI (cluster) | `make -C deploy openshell-install` | `make -C deploy openshell-uninstall` |
| **Manual steps** | Custom setups | [Official NVIDIA script](#macos-manual-official-script) | Package manager + manual cleanup |

### Install via Cursor skills

| Skill | Path | Use when you want to… |
|---|---|---|
| `openshell-local-install` | [`.cursor/skills/openshell-local-install/`](../.cursor/skills/openshell-local-install/SKILL.md) | Install OpenShell on your Mac/Linux workstation |
| `openshell-local-cleanup` | [`.cursor/skills/openshell-local-cleanup/`](../.cursor/skills/openshell-local-cleanup/SKILL.md) | Remove local OpenShell (CLI, gateway, config) |
| `openshell-cluster-install` | [`.cursor/skills/openshell-cluster-install/`](../.cursor/skills/openshell-cluster-install/SKILL.md) | Deploy OpenShell gateway on OpenShift |
| `openshell-cluster-cleanup` | [`.cursor/skills/openshell-cluster-cleanup/`](../.cursor/skills/openshell-cluster-cleanup/SKILL.md) | Uninstall OpenShell from OpenShift |

**Example prompts (local):**

```
Install OpenShell on my Mac
```

```
Uninstall OpenShell locally
```

**Example prompts (cluster):**

```
Deploy OpenShell on OpenShift
```

```
Remove OpenShell from the cluster
```

### Quick install (scripts)

From the repo root, run the project installer:

```bash
./scripts/install-openshell.sh
```

**Script:** [`scripts/install-openshell.sh`](../scripts/install-openshell.sh)

The installer wraps the [official NVIDIA OpenShell install script](#macos-manual-official-script) and automates the full local stack setup for the AgentOps demo.

#### What it does

| Step | macOS | Linux |
|---|---|---|
| Install OpenShell CLI + gateway | Homebrew tap `nvidia/openshell` | RPM (dnf/yum) or `.deb` (apt) |
| Install Podman (default driver) | `brew install podman` + `podman machine` | `dnf`/`yum`/`apt` install |
| Configure compute driver | Writes `~/.config/openshell/gateway.env` | Same |
| Start / restart gateway | `brew services restart openshell` | `systemctl --user` + `loginctl enable-linger` |
| Register local gateway | `openshell gateway add --local` | Same |
| Smoke test | `openshell status` (with retries) | Same |

#### Options and environment variables

| Variable / flag | Default | Description |
|---|---|---|
| `--help` | — | Show usage |
| `--dry-run` | off | Print planned actions without making changes |
| `OPENSHELL_VERSION` | latest | Pin OpenShell release (e.g. `0.0.58`) |
| `OPENSHELL_DRIVER` | `podman` | Compute driver: `podman`, `docker`, or `vm` |
| `SKIP_PODMAN` | `0` | Set to `1` to skip Podman install and machine setup |
| `LOCAL_GATEWAY_URL` | `https://127.0.0.1:17670` | Gateway endpoint to register |

#### Examples

Pin a specific OpenShell version:

```bash
OPENSHELL_VERSION=0.0.58 ./scripts/install-openshell.sh
```

Use Docker instead of Podman:

```bash
OPENSHELL_DRIVER=docker SKIP_PODMAN=1 ./scripts/install-openshell.sh
```

Preview planned actions without making changes:

```bash
./scripts/install-openshell.sh --dry-run
```

### Uninstall

To remove everything installed by the project installer, use a **Cursor skill** (see [Install via Cursor skills](#install-via-cursor-skills-no-manual-steps)) or run the script directly:

**Via Cursor:** ask the agent to uninstall locally — it uses the `openshell-local-cleanup` skill.

**Via script:**

```bash
./scripts/uninstall-openshell.sh --yes
```

**Script:** [`scripts/uninstall-openshell.sh`](../scripts/uninstall-openshell.sh)

Preview planned actions without making changes:

```bash
./scripts/uninstall-openshell.sh --dry-run
```

Remove the Homebrew tap on macOS:

```bash
REMOVE_BREW_TAP=1 ./scripts/uninstall-openshell.sh --yes
```

#### What it removes

| Component | macOS | Linux |
|---|---|---|
| Gateway registration | `openshell gateway remove` | Same |
| Gateway service | `brew services stop openshell` | `systemctl --user disable --now openshell-gateway` |
| OpenShell packages | `brew uninstall openshell` | `dnf`/`yum`/`apt` remove `openshell`, `openshell-gateway` |
| User configuration | `~/.config/openshell/` | Same |
| Runtime data | `$(brew --prefix)/var/openshell` | — |

> **Note:** `--yes` is required to perform the uninstall. **Podman is never removed** — it may be used outside this demo.

### macOS (manual: official script)

```bash
curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh
```

The script:

1. Adds the Homebrew tap `nvidia/openshell`
2. Installs the `openshell` formula (CLI + gateway)
3. Starts the gateway via `brew services`
4. Generates mTLS certificates under `~/.config/openshell/gateways/openshell/mtls/`

Install a specific version:

```bash
OPENSHELL_VERSION=0.0.58 curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh
```

#### macOS (alternative: PyPI)

Requires [uv](https://docs.astral.sh/uv/):

```bash
uv tool install -U openshell
```

You must run and register the gateway separately when installing from PyPI.

#### macOS (Intel)

The official install script targets **Apple Silicon** with a generated Homebrew formula. On Intel Macs, prefer the PyPI install or download release artifacts from [GitHub Releases](https://github.com/NVIDIA/OpenShell/releases).

### Linux (manual: official script)

```bash
curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh
```

The script detects the OS and installs:

| Distribution | Package | Service |
|---|---|---|
| RHEL / Fedora | RPM | `openshell-gateway` (systemd user unit) |
| Debian / Ubuntu | `.deb` | `openshell-gateway` (systemd user unit) |

Enable the gateway to survive logout (recommended on servers and workstations):

```bash
sudo loginctl enable-linger "$USER"
systemctl --user enable --now openshell-gateway
```

Install a specific version:

```bash
OPENSHELL_VERSION=0.0.58 curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh
```

#### Linux (manual RPM quick start)

After `dnf install` of the RPM packages:

```bash
systemctl --user enable --now openshell-gateway
openshell gateway add --local https://127.0.0.1:17670
openshell status
```

See [OpenShell RPM Quick Start](https://github.com/NVIDIA/OpenShell/blob/main/deploy/rpm/QUICKSTART.md).

## Post-install configuration

### 1. Register the local gateway

Required on first use:

```bash
openshell gateway add --local https://127.0.0.1:17670
```

### 2. Verify connectivity

```bash
openshell status
```

### 3. Choose a compute driver

If auto-detection fails or you want a specific runtime, configure the gateway before creating sandboxes.

**Option A — environment file** (works well on macOS with Homebrew service):

```bash
mkdir -p ~/.config/openshell
echo 'OPENSHELL_DRIVERS=podman' > ~/.config/openshell/gateway.env
```

Restart the gateway:

```bash
# macOS
brew services restart openshell

# Linux
systemctl --user restart openshell-gateway
```

**Option B — gateway TOML**:

```toml
# ~/.config/openshell/gateway.toml
[openshell.gateway]
compute_drivers = ["podman"]
```

Gateway config reference: [Gateway Configuration](https://docs.nvidia.com/openshell/latest/reference/gateway-configuration).

## Compute drivers

OpenShell supports one compute driver per gateway. Auto-detection order (when unset): Kubernetes → Podman → Docker. MicroVM (`vm`) is never auto-detected.

| Driver | macOS | Linux (RHEL/Fedora) | Notes |
|---|---|---|---|
| **Podman** | Yes (via `podman machine`) | Yes (native rootless) | Preferred for demo clusters aligned with OpenShift/Podman workflows |
| **Docker** | Yes (Docker Desktop) | Yes | Common for local dev |
| **MicroVM** (`vm`) | Yes (Hypervisor.framework) | Yes (KVM) | VM-backed sandboxes; set explicitly |
| **Kubernetes** | N/A (gateway on cluster) | Yes (Helm chart) | Production / cluster deployment |

Full driver reference: [Sandbox Compute Drivers](https://docs.nvidia.com/openshell/latest/reference/sandbox-compute-drivers)

### Podman on macOS

Podman on Mac runs inside a Linux VM (`podman machine`). OpenShell connects to the Podman API socket on the host.

```bash
brew install podman
podman machine init    # first time only
podman machine start
podman machine list    # should show "Currently running"
podman info
```

Force the Podman driver (auto-detection on macOS may skip Podman if Docker is absent):

```bash
mkdir -p ~/.config/openshell
echo 'OPENSHELL_DRIVERS=podman' > ~/.config/openshell/gateway.env
brew services restart openshell
```

If the socket is not found automatically:

```bash
podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}'
# Typical: $HOME/.local/share/containers/podman/machine/podman.sock
```

On macOS, the Podman driver defaults `host_gateway_ip` to `192.168.127.254` (gvproxy) so sandboxes can reach the gateway host.

### Podman on Linux (RHEL / Fedora)

```bash
sudo dnf install -y podman
podman info   # confirm rootless socket is active
```

Configure OpenShell:

```toml
[openshell.gateway]
compute_drivers = ["podman"]
```

Or:

```bash
echo 'OPENSHELL_DRIVERS=podman' > ~/.config/openshell/gateway.env
systemctl --user restart openshell-gateway
```

### Docker

```bash
# macOS
brew install --cask docker
# Start Docker Desktop, then:
openshell status

# Linux — use Docker Engine 28+ or Podman with docker.sock compatibility
```

Set explicitly if needed:

```toml
[openshell.gateway]
compute_drivers = ["docker"]
```

### MicroVM

```toml
[openshell.gateway]
compute_drivers = ["vm"]
```

Requires host virtualization (Hypervisor.framework on macOS, KVM on Linux).

## Service management

### macOS (Homebrew)

```bash
brew services list
brew services restart openshell
brew services stop openshell
```

Logs and config:

- Gateway listen address: `https://127.0.0.1:17670`
- Optional config: `~/.config/openshell/gateway.toml`
- Homebrew fallback config: `/opt/homebrew/var/openshell/gateway.toml`
- CLI mTLS bundle: `~/.config/openshell/gateways/openshell/mtls/`

### Linux (systemd user)

```bash
systemctl --user status openshell-gateway
systemctl --user restart openshell-gateway
journalctl --user -u openshell-gateway -f
```

## Smoke test

After install and driver configuration:

```bash
openshell status
openshell sandbox list

# Example: create a sandbox (requires a configured inference provider / API key)
export ANTHROPIC_API_KEY=sk-...
openshell sandbox create -- claude
```

Provider setup: [Manage Providers](https://docs.nvidia.com/openshell/latest/how-to/manage-providers)

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `No available formula with the name "openshell"` | OpenShell not installed; tap missing | Run [`./scripts/install-openshell.sh`](#quick-install-recommended) or the [official install script](#macos-manual-official-script), not `brew install openshell` |
| `brew services restart openshell` fails | Gateway never installed via Homebrew | Run [`./scripts/install-openshell.sh`](#quick-install-recommended) first |
| `openshell status` shows Connection refused right after install | Gateway still starting after service restart | Wait a few seconds and retry; the project installer retries automatically |
| `no compute driver configured and auto-detection found no suitable driver` | No Docker/Podman/K8s detected | Set `OPENSHELL_DRIVERS=podman` in `~/.config/openshell/gateway.env` and restart gateway |
| Podman running but gateway does not see it (macOS) | Socket path / auto-detect bug | Set `OPENSHELL_DRIVERS=podman`; confirm `podman machine` is running |
| `openshell doctor` only checks Docker | Known limitation on some versions | Verify `podman info` manually and set driver explicitly |
| Gateway not reachable after logout (Linux) | User systemd session ended | `sudo loginctl enable-linger "$USER"` |

## OpenShift / RHOAI cluster deployment

> **This section describes an older single-chart flow kept for reference.** The
> actually-deployed flow (validated via a from-scratch redeploy 2026-08-05) is
> `make -C deploy deploy-openshell` — a single Helm release from
> `deploy/helm/openshell/`, which declares the upstream OCI chart as a real
> Helm subchart dependency (see its `Chart.yaml`) rather than the two-chart
> setup described below. See [ADR-0003](adr/0003-openshell-deployment-on-openshift.md)
> for the accurate, up-to-date architecture and its full history. The pinned
> chart version below (`0.0.80`) is also stale; the real, enforced pin is
> `0.0.83`, declared in `deploy/helm/openshell/Chart.yaml`'s
> `dependencies[].version` + committed `Chart.lock` — see
> [ADR-0006](adr/0006-explicit-version-pinning.md).

Deploy the OpenShell gateway on OpenShift with the official Helm chart (OCI). This path is **validated** on RHOAI demo clusters (OpenShift 4.x, chart `0.0.80`).

> **Experimental**: the Kubernetes/OpenShift deployment path is under active development upstream. Pin chart and image versions deliberately.

### Architecture on OpenShift

```
openshell CLI  ──HTTPS──►  openshell-gateway (StatefulSet)
                                │
                                ▼
                     Agent Sandbox controller
                                │
                                ▼
                     Sandbox pods (privileged SCC)
```

### Prerequisites

| Requirement | Notes |
|---|---|
| OpenShift 4.x with `oc` configured | Cluster admin or sufficient RBAC in target namespace |
| Helm 3.x | For OCI chart install from GHCR |
| [Red Hat build of Agent Sandbox Operator](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_red_hat_build_of_agent_sandbox/) | Installed via OLM with `make deploy-operators` or `make deploy-all` |
| Pinned chart version | `0.0.80` (see [Version pinning](#version-pinning-cluster)) |

The Agent Sandbox Operator is deployed as an OLM Subscription alongside RHOAI through the `deploy/helm/operators/` chart:

```bash
make -C deploy deploy-operators   # installs RHOAI + Agent Sandbox operators
```

Verify:

```bash
oc get csv -n agent-sandbox-system
oc get pods -n agent-sandbox-system
```

### Step 1 — Install the Helm chart

The wrapper chart (`deploy/helm/openshell/`, version `0.2.0`) manages the full release lifecycle: namespace creation, upstream gateway subchart (`0.0.80`), and privileged SCC RoleBinding for the sandbox service account.

**Recommended (project wrapper chart):**

```bash
make -C deploy deploy-operators    # RHOAI + Agent Sandbox operators (once per cluster)
make -C deploy openshell-install
```

Chart location: [`deploy/helm/openshell/`](../deploy/helm/openshell/). Pins upstream `0.0.80` and applies OpenShift values from `values-openshift.yaml` (namespace creation, SCC binding, SCC-compatible security context).

**Manual install (upstream OCI chart directly):**

```bash
helm install openshell oci://ghcr.io/nvidia/openshell/helm-chart \
  --version 0.0.80 \
  --namespace openshell \
  --set server.disableTls=false \
  --set podSecurityContext.fsGroup=null \
  --set securityContext.runAsUser=null
```

| Value | Setting | Reason |
|---|---|---|
| `server.disableTls` | `false` | Gateway listens on HTTPS; certgen creates TLS secrets |
| `podSecurityContext.fsGroup` | `null` | Let OpenShift SCC assign fsGroup |
| `securityContext.runAsUser` | `null` | Let OpenShift SCC assign UID |
| `pkiInitJob.enabled` | **default `true`** | Do **not** disable — see [Secret bootstrap](#secret-bootstrap) |

On macOS with Podman (no Docker Desktop), Helm may fail pulling OCI charts with `docker-credential-desktop not found`. Work around:

```bash
mkdir -p /tmp/helm-nodocker && printf '{}' > /tmp/helm-nodocker/config.json
export DOCKER_CONFIG=/tmp/helm-nodocker
```

Or remove `"credsStore": "desktop"` from `~/.docker/config.json` if you do not use Docker Desktop.

### Secret bootstrap

By default, a pre-install Helm hook Job runs `openshell-gateway generate-certs` and creates:

| Secret | Purpose |
|---|---|
| `openshell-jwt-keys` | Ed25519 signing key for sandbox JWTs (`signing.pem`, `public.pem`, `kid`) |
| `openshell-server-tls` | Gateway server certificate |
| `openshell-client-tls` | Client mTLS certificate for sandboxes |

This works on OpenShift **without** disabling `pkiInitJob`. The certgen Job security context is compatible with the `restricted` SCC ([NVIDIA/OpenShell#2089](https://github.com/NVIDIA/OpenShell/issues/2089)).

**Do not** set `pkiInitJob.enabled=false` unless you manage TLS and JWT secrets externally. If you disable it without pre-creating `openshell-jwt-keys`, the gateway pod fails with:

```text
MountVolume.SetUp failed for volume "sandbox-jwt" : secret "openshell-jwt-keys" not found
```

Upstream reference: [Helm README — Secret bootstrap](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md#secret-bootstrap).

### Step 2 — Verify deployment

Wait for the certgen hook and gateway:

```bash
oc -n openshell get jobs,pods,secret | grep -E 'NAME|openshell'
oc -n openshell rollout status statefulset/openshell
```

Expected secrets: `openshell-jwt-keys`, `openshell-server-tls`, `openshell-client-tls`.

Expected gateway logs:

```text
TLS enabled — listening on encrypted HTTPS
gateway-minted sandbox JWT enabled
```

Verify the SCC RoleBinding (created by Helm post-install hook):

```bash
oc -n openshell get rolebinding | grep privileged
```

### Step 3 — Connect from your workstation

`make openshell-install` (and `openshell-upgrade`) automatically sync the cluster mTLS client bundle from secret `openshell-client-tls` into:

```text
~/.config/openshell/gateways/openshift/mtls/{ca.crt,tls.crt,tls.key}
```

This matches the upstream [Kubernetes setup — Install the TLS client bundle](https://docs.nvidia.com/openshell/kubernetes/setup) flow. Re-run sync anytime with:

```bash
make -C deploy openshell-sync-mtls
```

Port-forward the gateway service:

```bash
oc -n openshell port-forward svc/openshell 8080:8080
```

Register with the local CLI (requires [local OpenShell install](#install)):

```bash
openshell gateway add https://127.0.0.1:8080 --local --name openshift
# `gateway add --local` may overwrite the mTLS dir with Podman/Docker package certs — re-sync:
make -C deploy openshell-sync-mtls
openshell status
```

Expected: `Status: Connected`, `Version: 0.0.80`.

### Version pinning (cluster)

| Artifact | Pinned value |
|---|---|
| Wrapper chart | `agentops-openshell:0.2.0` (`deploy/helm/openshell/`) |
| Upstream Helm chart | `oci://ghcr.io/nvidia/openshell/helm-chart:0.0.80` |
| Gateway image | `ghcr.io/nvidia/openshell/gateway:0.0.80` (from chart `appVersion`) |
| Supervisor image | `ghcr.io/nvidia/openshell/supervisor:0.0.80` |
| Agent Sandbox Operator | `stable` channel, OLM (`deploy/helm/operators/values.yaml`) |

Bump versions deliberately and re-test on the target cluster before updating manifests.

### Uninstall (cluster)

```bash
make -C deploy openshell-uninstall
```

Or with Helm directly:

```bash
helm uninstall openshell -n openshell
```

PVCs created by the StatefulSet are retained by default. To remove all namespace resources:

```bash
oc delete ns openshell
```

### Cluster troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `secret "openshell-jwt-keys" not found` | `pkiInitJob.enabled=false` without manual JWT secret | Reinstall with default `pkiInitJob` or pre-create the secret via `openshell-gateway generate-certs --jwt-only` |
| `docker-credential-desktop not found` (Helm OCI pull) | Stale Docker Desktop config on macOS/Podman host | Set `DOCKER_CONFIG` to an empty config or remove `credsStore: desktop` from `~/.docker/config.json` |
| certgen Job `Failed` | RBAC or image pull issues | `oc -n openshell logs job/openshell-certgen`; verify gateway image is pullable |
| Sandbox pods `Failed` | Missing `privileged` SCC on `openshell-sandbox` | Re-run `make -C deploy openshell-install` (Helm hook re-applies the RoleBinding), or manually: `oc adm policy add-scc-to-user privileged -z openshell-sandbox -n openshell` |
| Gateway `Connection refused` over HTTP | TLS is enabled (`disableTls=false`) | Use `https://` when registering the gateway |
| `invalid peer certificate: BadSignature` | Local CLI mTLS CA does not match cluster `openshell-client-tls` (stale after redeploy, or overwritten by `gateway add --local`) | `make -C deploy openshell-sync-mtls`, then `openshell status` |

### Observability

Sandbox activity is logged in OCSF format inside each sandbox pod at `/var/log/`. From your workstation:

```bash
openshell logs <sandbox-name> --tail --source sandbox
```

See [Sandbox Logging](https://docs.nvidia.com/openshell/observability/logging) for shorthand format and JSON export.

## Related demo docs

- [`.cursor/skills/openshell-local-install/`](../.cursor/skills/openshell-local-install/SKILL.md) — local install
- [`.cursor/skills/openshell-local-cleanup/`](../.cursor/skills/openshell-local-cleanup/SKILL.md) — local uninstall
- [`.cursor/skills/openshell-cluster-install/`](../.cursor/skills/openshell-cluster-install/SKILL.md) — OpenShift deploy
- [`.cursor/skills/openshell-cluster-cleanup/`](../.cursor/skills/openshell-cluster-cleanup/SKILL.md) — OpenShift uninstall
- [`deploy/helm/openshell/`](../deploy/helm/openshell/) — wrapper chart for OpenShift cluster deploy
- [`deploy/Makefile`](../deploy/Makefile) — `make -C deploy openshell-install`
- [AGENTS.md](../AGENTS.md) — platform stack and OpenShell role in the demo
- [Cluster Bootstrap Guide](cluster-bootstrap.md) — RHOAI platform deploy (prerequisite for OpenShell on cluster)
- [ROADMAP.md](ROADMAP.md) — Phase 1 validation tasks

## References

- [OpenShell Installation](https://docs.nvidia.com/openshell/latest/about/installation) (CLI)
- [OpenShell on OpenShift](https://docs.nvidia.com/openshell/latest/kubernetes/openshift)
- [Red Hat build of Agent Sandbox — Install](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_red_hat_build_of_agent_sandbox/)
- [Kubernetes Setup (Agent Sandbox)](https://docs.nvidia.com/openshell/kubernetes/setup)
- [Kubernetes Setup — TLS client bundle](https://docs.nvidia.com/openshell/kubernetes/setup) (copy `openshell-client-tls` for CLI port-forward access)
- [Helm chart — Secret bootstrap](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md#secret-bootstrap)
- [OpenShell#2089](https://github.com/NVIDIA/OpenShell/issues/2089) — certgen hook on OpenShift without `pkiInitJob.enabled=false`
- [Sandbox Compute Drivers](https://docs.nvidia.com/openshell/latest/reference/sandbox-compute-drivers)
- [Sandbox Logging](https://docs.nvidia.com/openshell/observability/logging)
- [Support Matrix](https://docs.nvidia.com/openshell/reference/support-matrix)
- [OpenShell GitHub](https://github.com/NVIDIA/OpenShell)
- [Quickstart](https://docs.nvidia.com/openshell/latest/getting-started/quickstart)
