---
name: openshell-cluster-install
description: >-
  Deploy OpenShell gateway on OpenShift/RHOAI using the project Helm wrapper
  chart and deploy Makefile. Use when the user asks to install, deploy, or set
  up OpenShell on the cluster, OpenShift, OCP, or RHOAI — not local workstation
  install.
---

# OpenShell Cluster Install

Deploy the OpenShell **gateway** on OpenShift using `deploy/Makefile` and `deploy/helm/openshell/`. Requires `oc` and `helm` on the workstation.

For cluster operations prefer the `openshift-mcp` skill; fall back to `oc`/`make` when MCP is unavailable.

## When to use

| User intent | Action |
|---|---|
| Deploy OpenShell on OpenShift | `make -C deploy openshell-install` |
| First-time cluster setup | `make -C deploy openshell-prereqs` then install |
| Check deployment | `make -C deploy openshell-status` |
| Upgrade release | `make -C deploy openshell-upgrade` |

## Workflow

1. **Verify cluster context** — correct OpenShift cluster/project (`configuration_contexts_list` or `oc config current-context`).
2. **Prerequisites (once per cluster)**:

```bash
make -C deploy openshell-prereqs
```

Installs Agent Sandbox controller + namespace. Idempotent.

3. **Install gateway**:

```bash
make -C deploy openshell-install
```

Runs: Helm wrapper chart (`0.0.80`), certgen hook (JWT + TLS), SCC grant for `openshell-sandbox`.

4. **Verify**:

```bash
make -C deploy openshell-status
oc -n openshell rollout status statefulset/openshell
```

Expect secrets: `openshell-jwt-keys`, `openshell-server-tls`, `openshell-client-tls`.  
Expect logs: `TLS enabled — listening on encrypted HTTPS`.

5. **Optional — connect local CLI** (requires `openshell-local-install` on workstation):

```bash
oc -n openshell port-forward svc/openshell 8080:8080
openshell gateway add https://127.0.0.1:8080 --local --name openshift
openshell status
```

## Chart values (pinned)

| Setting | Value |
|---|---|
| Wrapper chart | `deploy/helm/openshell/` |
| Upstream | `oci://ghcr.io/nvidia/openshell/helm-chart:0.0.80` |
| `server.disableTls` | `false` |
| `pkiInitJob.enabled` | `true` (default — do not disable) |
| OpenShift overrides | `values-openshift.yaml` |

## Safety rules

- **Do not** set `pkiInitJob.enabled=false` without external JWT secret bootstrap.
- **Confirm namespace** — default `openshell`.
- **Agent Sandbox** is cluster-wide; prereqs install it once, not per release.
- **Helm OCI on Podman hosts** — Makefile sets `DOCKER_CONFIG` automatically.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `openshell-jwt-keys not found` | Reinstall without disabling `pkiInitJob`; see [issue #2089](https://github.com/NVIDIA/OpenShell/issues/2089) |
| Sandbox pods fail | `make -C deploy openshell-scc` |
| Helm OCI pull fails | `make -C deploy helm-env` or fix `~/.docker/config.json` |
| certgen Job failed | `oc -n openshell logs job/openshell-certgen` |

## Related

- Cluster cleanup: `openshell-cluster-cleanup` skill
- Local CLI install: `openshell-local-install` skill
- Guide: [docs/openshell-installation.md § OpenShift](../../../docs/openshell-installation.md#openshift--rhoai-cluster-deployment)
- Chart: [deploy/helm/openshell/README.md](../../../deploy/helm/openshell/README.md)
