# ADR-0008: RHOAI DataScienceCluster Component Selection

**Status**: Accepted  
**Date**: 2026-08-03  
**Layer**: Infrastructure  
**Source**: Migrated learnings from a reference OpenShell/OpenClaw deployment (its ADR-0017, ADR-0018, constraints #20-#23)

## Context

RHOAI 3.4's DataScienceCluster supports many components. Enabling all of them
wastes cluster resources and introduces race conditions during deployment.
The reference project discovered (live on AWS OCP) that:

1. The Dashboard's `genAiStudio` feature requires `llamastackoperator: Managed`
   (constraint #23 — the `gen-ai-ui` micro-frontend self-gates on
   `requiredComponents:[LLAMA_STACK_OPERATOR]`).
2. The `OdhDashboardConfig` CRD does not exist until the Dashboard operator
   starts reconciling — a first `helm upgrade` that tries to set `genAiStudio`
   races against CRD registration (constraint #21).
3. The Dashboard operator auto-creates the `odh-dashboard-config` singleton
   without Helm ownership metadata, requiring explicit adoption before Helm
   can manage it (constraint #21, race #2).

## Decision

### Enabled components (Managed)

| Component | Rationale |
|---|---|
| dashboard | UI for MLflow traces, Gen AI Studio, experiment management |
| llamastackoperator (OGX) | Required by Gen AI Studio nav; provides API abstraction |
| mlflowoperator | Agent tracing backend (sole backend — no standalone MLflow) |
| trustyai | NeMo Guardrails deployment path (EvalHub for red teaming) |
| kserve | Required for modelsAsService (MaaS gateway infrastructure) |
| modelsAsService | External model endpoint integration |

### Disabled components (Removed)

aipipelines, feastoperator, kueue, modelregistry, ray, trainer,
trainingoperator, sparkoperator, workbenches — no use case in this demo.

### Deployment ordering fixes

The Makefile must implement:
- `wait-dashboard-crd`: wait for CRD + singleton object to exist
- `adopt-dashboard-config`: annotate/label for Helm ownership
- `wait-llamastack`: wait for LlamaStackOperatorReady=True
- Sequenced deploy: on fresh clusters, apply llamastackoperator before
  dashboard so the pod's one-time capability check sees it as Ready on first boot

### Operator approval policy

`installPlanApproval: Manual` in the Subscription, with auto-approval of
the pinned channel/version in the Makefile wait loop. This preserves the
security audit trail (version pinned in git = reviewed) while avoiding
interactive approval clicks in automation.

## Consequences

- Fresh deploys take slightly longer (~30-60s extra for CRD/capability waits)
- Helm upgrades are idempotent: adopt + re-apply handles all race states
- The operator version is explicitly controlled via git (no surprise upgrades)

## Bug found and fixed: `llamastackoperator` defaulted to `Removed` (2026-08-05)

A from-scratch redeploy test found `deploy/helm/platform/values.yaml` actually
shipped `datasciencecluster.components.llamastackoperator.managementState:
Removed` — directly contradicting this ADR's own decision table above (row 2:
`llamastackoperator (OGX) | Required by Gen AI Studio nav`). Since
`dashboard.genAiStudio: true` is also set by default, this meant a plain `make
deploy-platform` (no extra `HELM_OPTS`) would run the entire `wait-llamastack`
loop every time, always time out with `WARNING: LlamaStackOperatorReady not
True after 120s`, and leave Gen AI Studio non-functional — while still
reporting `deploy-platform`/`validate` as passing, since neither hard-fails on
that particular condition. Fixed by changing the default to `Managed`. Not
caught earlier because every prior deploy happened against a DataScienceCluster
that was already `Managed` from an earlier, differently-valued run.

## References

- Red Hat RHOAI 3.4 documentation: DataScienceCluster API
- Reference project: constraints #20, #21, #23
- Reference project: its own RHOAI Makefile (wait-dashboard-crd, adopt-dashboard-config)
