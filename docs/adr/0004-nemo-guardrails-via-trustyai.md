# ADR-0004: NeMo Guardrails via TrustyAI

## Status

Accepted

## Date

2026-07-13

## Layer

Platform

## Context

The demo requires input/output guardrails — jailbreak prevention, topic control, and data exfiltration blocking — integrated with RHOAI on OpenShift. The guardrails component is central to the "Security Attack" portion of the live demo narrative.

RHOAI 3.x provides the TrustyAI operator as the supported path for deploying NeMo Guardrails on OpenShift.

## Options Considered

### Option 1: Standalone NeMo Guardrails sidecar

- **Pros:** Flexible deployment, can run outside OpenShift.
- **Cons:** No operator lifecycle management on OCP; must handle TLS, networking, and upgrades manually.
- **GA / support status:** Community only; not covered by Red Hat support.

### Option 2: NeMo Guardrails deployed through TrustyAI operator

- **Pros:** Operator-managed lifecycle on OCP; integrated with RHOAI DataScienceCluster; Red Hat support path.
- **Cons:** Tied to TrustyAI operator release cadence; requires RHOAI 3.x.
- **GA / support status:** Supported via [RHOAI TrustyAI docs](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/serving_models/serving-large-models_serving-large-models#about-trustyai-operator).

## Decision

Deploy NeMo Guardrails through the TrustyAI operator on OCP. This aligns with the BYOA principle: Red Hat manages the guardrails infrastructure, the customer configures the policies.

## Consequences

### Positive

- Guardrails lifecycle is managed by the RHOAI operator stack.
- Consistent with the demo message: "Your Agent, Our Platform, Production-Ready."
- TLS and service mesh integration handled by the operator.

### Negative

- Guardrails configuration options are limited to what TrustyAI exposes.
- Requires the full RHOAI operator stack to be deployed first.

## Version Pinning

| Component | Pinned version | Where enforced |
|---|---|---|
| TrustyAI operator | <!-- TODO: pin CSV --> | `deploy/helm/` |
| NeMo Guardrails | <!-- TODO: pin version --> | TrustyAI operator config |

## Demo Impact

The "Security Attack" demo segment (4-5 min) depends on NeMo Guardrails blocking prompt injection and data exfiltration attempts. Guardrails configuration (rails, policies) is defined in Phase 3.

## Validation

- **TrustyAI operator:** `trustyai: Managed` in the DataScienceCluster (`deploy/helm/platform/values.yaml`); `TrustyAIReady` confirmed during platform bootstrap.
- **NeMo Guardrails rails/policies:** not yet deployed — Phase 3 implementation pending (see [ROADMAP.md](../ROADMAP.md)). The architectural decision (TrustyAI path, not standalone sidecar) remains Accepted.

## References

- [TrustyAI on RHOAI 3.4](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/serving_models/serving-large-models_serving-large-models#about-trustyai-operator)
- [NeMo Guardrails GitHub](https://github.com/NVIDIA/NeMo-Guardrails)
- [NeMo Guardrails Docs](https://docs.nvidia.com/nemo/guardrails/)
