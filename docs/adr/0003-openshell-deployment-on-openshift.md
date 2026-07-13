# ADR-0003: OpenShell Deployment on OpenShift

## Status

Accepted

## Date

2026-07-13

## Layer

Platform

## Context

The demo needs a sandboxed execution environment for AI agents to demonstrate zero-trust isolation. OpenShell provides container-based sandboxes with policy enforcement.

Deployment on OpenShift requires the Helm chart with TLS enabled and the certgen pre-install hook, plus the Agent Sandbox controller from `kubernetes-sigs/agent-sandbox`. OpenShift SCCs must be configured to allow the sandbox service account to run privileged containers.

## Options Considered

### Option 1: Local-only OpenShell (Podman driver)

- **Pros:** Simple setup; works without a cluster.
- **Cons:** Cannot demonstrate sandboxing on the OpenShift platform; no Kubernetes driver.

### Option 2: OpenShell on OpenShift via Helm chart

- **Pros:** Demonstrates agent sandboxing on the target platform; uses Kubernetes driver with Agent Sandbox; TLS via certgen hook.
- **Cons:** Requires privileged SCC for the sandbox service account; chart `0.0.80` is pre-1.0.

## Decision

Deploy OpenShell on OpenShift using the Helm chart with TLS and certgen hook. Use the Kubernetes driver backed by Agent Sandbox. Grant privileged SCC to the sandbox service account via `scripts/openshift-openshell-scc.sh`.

## Consequences

### Positive

- Agent sandboxing runs on the same platform as the rest of the demo stack.
- Demonstrates a real enterprise deployment topology.

### Negative

- Privileged SCC is required, which may not be acceptable in all production environments.
- Chart `0.0.80` is pre-1.0 and may introduce breaking changes.

## Version Pinning

| Component | Pinned version | Where enforced |
|---|---|---|
| OpenShell Helm chart | `0.0.80` | `deploy/helm/openshell/Chart.yaml` |
| Agent Sandbox controller | <!-- TODO: pin version --> | Cluster prereqs |

## Validation

Validated on OpenShift with chart `0.0.80`, TLS + certgen hook, and SCC overrides. Full procedure documented in [openshell-installation.md](../openshell-installation.md#openshift--rhoai-cluster-deployment).

## Demo Impact

The "Security Attack" demo segment uses OpenShell to show agent execution isolation — the sandbox prevents data exfiltration even when the guardrails are bypassed.

## Related Decisions

- [ADR-0006: Explicit version pinning](0006-explicit-version-pinning.md) — chart version is pinned per this policy.

## References

- [OpenShell on OpenShift](https://docs.nvidia.com/openshell/latest/kubernetes/openshift)
- [Helm chart README — Secret bootstrap](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md#secret-bootstrap)
- [Agent Sandbox](https://github.com/kubernetes-sigs/agent-sandbox)
