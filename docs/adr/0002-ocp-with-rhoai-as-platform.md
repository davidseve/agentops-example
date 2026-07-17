# ADR-0002: OpenShift Container Platform with RHOAI Add-on as Base Platform

## Status

Accepted

## Date

2026-07-13

## Layer

Infrastructure

## Context

The AgentOps demo needs a container platform that supports the full AI agent lifecycle: model serving, guardrails, sandboxing, tracing, and prompt management. The platform must be provisionable on demand (demo.redhat.com / RHPDS) and support operator-managed components with enterprise-grade security.

Red Hat OpenShift AI (RHOAI) is an add-on to OpenShift Container Platform (OCP) that provides AI/ML-specific capabilities — DataScienceCluster CRD, model serving, MLflow, TrustyAI, and EvalHub — all managed through operators on top of OCP.

## Options Considered

### Option 1: Vanilla Kubernetes with manual AI tooling

- **Pros:** Platform-agnostic; no vendor dependency.
- **Cons:** No operator lifecycle management for AI components; must build and maintain MLflow, guardrails, model serving integration manually; no Red Hat support; cannot use demo.redhat.com.

### Option 2: OpenShift Container Platform (OCP) without RHOAI

- **Pros:** Enterprise Kubernetes with built-in security (SCCs, OAuth, network policies); available on demo.redhat.com.
- **Cons:** AI components (MLflow, TrustyAI) must be deployed and managed manually without operator support; no DataScienceCluster abstraction.

### Option 3: OpenShift Container Platform (OCP) with RHOAI 3.x add-on

- **Pros:** Full operator-managed AI stack; DataScienceCluster CRD orchestrates MLflow, TrustyAI, and model serving; Red Hat supported; available on demo.redhat.com/RHPDS; aligns with BYOA strategy.
- **Cons:** Requires RHOAI operator subscription; tied to RHOAI release cadence.
- **GA / support status:** GA — [RHOAI 3.4 docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/), [supported configs](https://access.redhat.com/articles/rhoai-supported-configs-3.x).

## Decision

Use OpenShift Container Platform as the base infrastructure with Red Hat OpenShift AI (RHOAI) 3.x as the AI platform add-on. OCP provides the enterprise Kubernetes foundation (security, networking, storage, operator lifecycle), and RHOAI adds the AI-specific layer (MLflow, TrustyAI, model serving) managed through the DataScienceCluster CRD.

This is the foundation that every other ADR builds upon: OpenShell ([ADR-0003](0003-openshell-deployment-on-openshift.md)), guardrails ([ADR-0004](0004-nemo-guardrails-via-trustyai.md)), and version pinning ([ADR-0006](0006-explicit-version-pinning.md)) all depend on OCP + RHOAI being the target platform.

## Consequences

### Positive

- All platform components (MLflow, TrustyAI, EvalHub) are managed by operators with a single DataScienceCluster entry point.
- Demo clusters are provisionable on demand from demo.redhat.com / RHPDS.
- Consistent with the Red Hat AI Agentic Strategy 2026 and the BYOA message.
- Enterprise security primitives (SCCs, OAuth, network policies, audit logging) are built in.

### Negative

- Requires an OpenShift subscription (covered by demo.redhat.com for this project).
- RHOAI release cadence may lag behind upstream components.
- The demo is not portable to non-OpenShift Kubernetes distributions.

## Version Pinning

| Component | Pinned version | Where enforced |
|---|---|---|
| OCP | 4.x (demo.redhat.com provisioned) | Cluster provision |
| RHOAI operator | <!-- TODO: pin CSV --> | `deploy/helm/` Subscription |

## Demo Impact

The "Setup" segment (1-2 min) begins by showing the deployed OCP cluster with RHOAI active — the DataScienceCluster status, installed operators, and the RHOAI dashboard. This establishes the "Our Platform" part of the demo message before the agent is introduced.

## Validation

Cluster bootstrap validated on demo.redhat.com. Full deploy, validate, and teardown procedure documented in [cluster-bootstrap.md](../cluster-bootstrap.md).

## Related Decisions

- [ADR-0003: OpenShell on OpenShift](0003-openshell-deployment-on-openshift.md) — depends on OCP SCCs and Kubernetes driver
- [ADR-0004: NeMo Guardrails via TrustyAI](0004-nemo-guardrails-via-trustyai.md) — depends on RHOAI TrustyAI operator
- [ADR-0006: Explicit version pinning](0006-explicit-version-pinning.md) — RHOAI operator CSV is pinned

## References

- [Red Hat OpenShift AI Self-Managed 3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/)
- [RHOAI Supported Configurations 3.x](https://access.redhat.com/articles/rhoai-supported-configs-3.x)
- [RHOAI 3.4 Release Notes](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/release_notes/)
- [OpenShift Container Platform](https://docs.redhat.com/en/documentation/openshift_container_platform/)
- [BYOA Blog Post](https://www.redhat.com/en/blog/operationalizing-bring-your-own-agent-red-hat-ai-openclaw-edition)
