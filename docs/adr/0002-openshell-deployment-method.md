# ADR-0002: OpenShell Deployment Method

**Status**: Accepted  
**Date**: 2026-08-03  
**Source**: Migrated from open-claw-in-openshell (deploy-openshell.sh, constraints #10, #12, #19)

## Context

OpenShell provides the sandbox platform for running AI agents in isolation.
It is distributed as an OCI Helm chart from `ghcr.io/nvidia/openshell/helm-chart`.

Key deployment requirements learned from open-claw-in-openshell:
- OpenShell must be deployed AFTER RHOAI (RBAC dependencies, constraint #10)
- PKI init job creates mTLS secrets on first install
- A passthrough TLS Route is needed for gateway access
- The sandbox ServiceAccount needs `privileged` SCC (for nftables, Landlock)
- mTLS registration is fragile after helm upgrade (constraint #19)
- Template rendering with `__APPS_DOMAIN__` was bash-heavy; replaced with Helm values

## Decision

### Deployment approach

1. A local Helm chart (`deploy/helm/openshell/`) manages infrastructure:
   - Namespace with `opendatahub.io/dashboard: "true"` label
   - SCC ClusterRoleBinding for sandbox SA
   - Passthrough TLS Route
   - ConfigMap with rendered values for the OCI chart

2. The Makefile `deploy-openshell` target:
   - Installs the local chart first (namespace, SCC, route)
   - Pulls and installs the OCI chart with values from the ConfigMap
   - Waits for StatefulSet rollout
   - Registers the gateway with the CLI (mTLS)

3. `global.appsDomain` replaces all `__APPS_DOMAIN__` template placeholders.
   Set once in HELM_OPTS: `--set global.appsDomain=apps.ocp.sandbox701.opentlc.com`

### Version pinning

- OpenShell chart: `0.0.83` (image + supervisor tags locked together)
- Agent Sandbox CRDs: `v0.5.1`

### Auth strategy (initial)

Start with `allowUnauthenticatedUsers: true` for CLI access (mTLS only).
OIDC (Keycloak) and browser auth (oauth2-proxy) configured in Phase 3/4
after the base deployment is validated.

## Consequences

- Single `global.appsDomain` value flows into all OpenShell configuration
- No bash template rendering needed (fully declarative via Helm)
- OCI chart is pulled at deploy time (requires internet access on deployer)
- mTLS certificates are managed by OpenShell's PKI init job (not by us)

## References

- OpenShell Helm chart docs: https://docs.nvidia.com/openshell/latest/kubernetes/setup
- open-claw-in-openshell: scripts/deploy-openshell.sh
- open-claw-in-openshell: docs/constraints.md #10, #12, #19
