# agentops-openshell

Wrapper Helm chart (`0.2.0`) for deploying [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) on OpenShift / RHOAI for the AgentOps demo.

Pins upstream chart `oci://ghcr.io/nvidia/openshell/helm-chart:0.0.80` and manages the full release lifecycle: namespace, upstream gateway subchart, and privileged SCC RoleBinding for sandbox pods.

## Quick start

```bash
# From repo root
make -C deploy deploy-operators    # once per cluster (RHOAI + Agent Sandbox operators via OLM)
make -C deploy openshell-install   # Helm + sync mTLS client bundle to local CLI
```

`openshell-install` / `openshell-upgrade` call `make openshell-sync-mtls`, which copies secret `openshell-client-tls` into `~/.config/openshell/gateways/openshift/mtls/` ([upstream TLS client bundle](https://docs.nvidia.com/openshell/kubernetes/setup)).

## Manual install

```bash
# 1. Prerequisites — Agent Sandbox Operator via OLM (once per cluster)
make -C deploy deploy-operators

# 2. Resolve dependencies
cd deploy/helm/openshell
helm dependency update

# 3. Install (namespace + gateway + SCC in one step)
helm upgrade --install openshell . \
  --namespace openshell \
  --create-namespace \
  -f values.yaml \
  -f values-openshift.yaml \
  --wait
```

## Values files

| File | Purpose |
|---|---|
| `values.yaml` | Base pins (images `0.0.80`, TLS on, certgen enabled), wrapper defaults (`openshift.*` off) |
| `values-openshift.yaml` | OpenShift overlay: namespace creation, SCC RoleBinding, `fsGroup`/`runAsUser` null |

## Wrapper templates

| Template | Purpose | Gate |
|---|---|---|
| `namespace.yaml` | Creates the release namespace with demo labels | `openshift.namespace.create` |
| `scc-rolebinding.yaml` | Grants `privileged` SCC to sandbox SA (post-install hook) | `openshift.scc.privilegedSandbox` |
| `_helpers.tpl` | Labels and sandbox SA name helper | — |

## Uninstall

```bash
make -C deploy openshell-uninstall
```

Helm uninstall removes the SCC RoleBinding automatically. PVCs from the StatefulSet are retained by default.

## Documentation

- [docs/openshell-installation.md](../../../docs/openshell-installation.md)
- [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md)
- [Upstream Helm README](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md)
