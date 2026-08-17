# ADR-0008: RHOAI DataScienceCluster Component Selection

**Status**: Accepted (revised 2026-08-06)  
**Date**: 2026-08-03  
**Layer**: Infrastructure  
**Source**: Migrated learnings from a reference OpenShell/OpenClaw deployment (its ADR-0017, ADR-0018, constraints #20-#21)

## Context

RHOAI 3.4's DataScienceCluster supports many components. Enabling all of them
wastes cluster resources and introduces race conditions during deployment.
The reference project discovered (live on AWS OCP) that:

1. The `OdhDashboardConfig` CRD does not exist until the Dashboard operator
   starts reconciling — a first `helm upgrade` races against CRD registration
   (constraint #21).
2. The Dashboard operator auto-creates the `odh-dashboard-config` singleton
   without Helm ownership metadata, requiring explicit adoption before Helm
   can manage it (constraint #21, race #2).

## Decision

Enable only the components required for this demo. All others stay at
`managementState: Removed` in [`deploy/helm/platform/values.yaml`](../../deploy/helm/platform/values.yaml).

### Enabled components (Managed)

| Component | Rationale |
|---|---|
| dashboard | UI for MLflow traces and experiment management |
| mlflowoperator | Agent tracing backend (sole backend — no standalone MLflow) |
| trustyai | NeMo Guardrails deployment path (EvalHub for red teaming) |
| kserve | Required for TrustyAI's eval/lmeval readiness — `TrustyAIReady` blocks on the `InferenceServices` CRD until `kserve` is `Managed` (found 2026-08-14, see ROADMAP.md). Not otherwise consumed directly by this project yet. |

### Deployment ordering fixes

The Makefile must implement:
- `wait-dashboard-crd`: wait for CRD + singleton object to exist
- `adopt-dashboard-config`: annotate/label for Helm ownership

### Operator approval policy

`installPlanApproval: Manual` in the Subscription, with auto-approval of
the pinned channel/version in the Makefile wait loop. This preserves the
security audit trail (version pinned in git = reviewed) while avoiding
interactive approval clicks in automation.

## Consequences

- Fresh deploys take slightly longer (~15-30s extra for CRD wait)
- Helm upgrades are idempotent: adopt + re-apply handles all race states
- The operator version is explicitly controlled via git (no surprise upgrades)
- Fewer DSC components = faster reconciliation and lower resource usage

## References

- Red Hat RHOAI 3.4 documentation: DataScienceCluster API
- Reference project: constraints #20, #21
- Reference project: its own RHOAI Makefile (wait-dashboard-crd, adopt-dashboard-config)
