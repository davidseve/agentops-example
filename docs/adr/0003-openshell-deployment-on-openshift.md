# ADR-0003: OpenShell Deployment on OpenShift

## Status

Accepted (updated 2026-07-17)

## Date

2026-07-13

## Layer

Platform

## Context

The demo needs a sandboxed execution environment for AI agents to demonstrate zero-trust isolation. OpenShell provides container-based sandboxes with policy enforcement.

Deployment on OpenShift requires the Helm chart with TLS enabled and the certgen pre-install hook, plus the Agent Sandbox controller from `kubernetes-sigs/agent-sandbox`. OpenShift SCCs must be configured to allow the sandbox service account to run privileged containers.

The original deployment used a hybrid approach: a thin Helm wrapper chart for the gateway, plus imperative scripts (`openshift-openshell-scc.sh`) and kustomize overlays (`deploy/openshift/openshell/`) for the namespace and SCC grant. This split complicated the install flow and prevented Helm from managing the full release lifecycle (SCC bindings were invisible to `helm uninstall`).

## Options Considered

### Option 1: Local-only OpenShell (Podman driver)

- **Pros:** Simple setup; works without a cluster.
- **Cons:** Cannot demonstrate sandboxing on the OpenShift platform; no Kubernetes driver.

### Option 2: OpenShell on OpenShift via Helm chart

- **Pros:** Demonstrates agent sandboxing on the target platform; uses Kubernetes driver with Agent Sandbox; TLS via certgen hook.
- **Cons:** Requires privileged SCC for the sandbox service account; chart `0.0.80` is pre-1.0.

### Option 3: Helm chart with namespace and SCC managed declaratively (chosen)

- **Pros:** All release-scoped resources (namespace, SCC RoleBinding, gateway) are managed by Helm; `helm uninstall` cleans up fully; single `helm upgrade --install` replaces multi-step scripts.
- **Cons:** Same as Option 2; installer still needs RBAC to bind `system:openshift:scc:privileged`.

## Decision

Deploy OpenShell on OpenShift using the wrapper Helm chart (`deploy/helm/openshell/`). The chart:

1. Creates the `openshell` namespace (gated by `openshift.namespace.create`).
2. Installs the upstream OCI subchart (`0.0.80`) with TLS and certgen hook.
3. Grants privileged SCC to the sandbox service account via a post-install/post-upgrade RoleBinding to `system:openshift:scc:privileged` (gated by `openshift.scc.privilegedSandbox`).

Agent Sandbox controller remains a cluster-scoped prerequisite installed once via `make openshell-prereqs`, pinned to a specific release manifest.

## Consequences

### Positive

- Agent sandboxing runs on the same platform as the rest of the demo stack.
- Demonstrates a real enterprise deployment topology.
- SCC binding is declarative and lifecycle-managed by Helm (cleaned up on uninstall).
- Single install command: `make openshell-install` runs only `helm upgrade --install`.

### Negative

- Privileged SCC is required, which may not be acceptable in all production environments.
- Chart `0.0.80` is pre-1.0 and may introduce breaking changes.

## Version Pinning

| Component | Pinned version | Where enforced |
|---|---|---|
| OpenShell Helm chart | `0.0.80` | `deploy/helm/openshell/Chart.yaml` |
| Wrapper chart | `0.2.0` | `deploy/helm/openshell/Chart.yaml` |
| Agent Sandbox controller | `v0.5.1` | `scripts/openshift-openshell-prereqs.sh` |

## Validation

Validated on OpenShift with chart `0.0.80`, TLS + certgen hook, SCC via Helm RoleBinding, and post-install mTLS client bundle sync to the local CLI (`scripts/openshift-openshell-sync-mtls.sh`, invoked by `make openshell-install` / `openshell-upgrade`). Full procedure documented in [openshell-installation.md](../openshell-installation.md#openshift--rhoai-cluster-deployment).

Post-install verification:

```bash
oc -n openshell get rolebinding | grep privileged
oc -n openshell rollout status statefulset/openshell
helm list -n openshell
make -C deploy openshell-sync-mtls   # refreshes ~/.config/openshell/gateways/openshift/mtls/
```

## Demo Impact

The "Security Attack" demo segment uses OpenShell to show agent execution isolation — the sandbox prevents data exfiltration even when the guardrails are bypassed.

## Related Decisions

- [ADR-0006: Explicit version pinning](0006-explicit-version-pinning.md) — chart version is pinned per this policy.

## References

- [OpenShell on OpenShift](https://docs.nvidia.com/openshell/latest/kubernetes/openshift)
- [Helm chart README — Secret bootstrap](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md#secret-bootstrap)
- [Kubernetes Setup — TLS client bundle](https://docs.nvidia.com/openshell/kubernetes/setup)
- [Agent Sandbox v0.5.1](https://github.com/kubernetes-sigs/agent-sandbox/releases/tag/v0.5.1)
