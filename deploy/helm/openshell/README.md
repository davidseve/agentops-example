# agentops-openshell

Wrapper Helm chart for deploying [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) on OpenShift / RHOAI for the AgentOps demo.

Pins upstream chart `oci://ghcr.io/nvidia/openshell/helm-chart:0.0.80` and applies OpenShift-validated values (TLS enabled, certgen hook, SCC-compatible security context).

## Quick start

```bash
# From repo root
make -C deploy openshell-prereqs   # once per cluster
make -C deploy openshell-install
```

## Manual install

```bash
# 1. Prerequisites
./scripts/openshift-openshell-prereqs.sh

# 2. Resolve dependencies
cd deploy/helm/openshell
helm dependency update

# 3. Install
helm upgrade --install openshell . \
  --namespace openshell \
  --create-namespace \
  -f values.yaml \
  -f values-openshift.yaml \
  --wait

# 4. SCC for sandbox pods (after Helm creates openshift-sandbox SA)
../../scripts/openshift-openshell-scc.sh
```

## Values files

| File | Purpose |
|---|---|
| `values.yaml` | Base pins (images `0.0.80`, TLS on, certgen enabled) |
| `values-openshift.yaml` | OpenShift SCC overrides (`fsGroup`/`runAsUser` null) |

## Uninstall

```bash
make -C deploy openshell-uninstall
```

PVCs from the StatefulSet are retained by default.

## Documentation

- [docs/openshell-installation.md](../../../docs/openshell-installation.md)
- [Upstream Helm README](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md)
