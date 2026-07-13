# ADR-0007: Exclude Kagenti, llm-d, and SPIFFE/SPIRE

## Status

Accepted

## Date

2026-07-13

## Layer

Cross-cutting

## Context

The Red Hat AI Agentic Strategy 2026 includes several components beyond what this 20-minute demo can cover. The demo focuses on the BYOA principle: agent framework decoupled from platform infrastructure. Some components add complexity without contributing to the demo narrative.

## Options Considered

### Kagenti (agent lifecycle management)

- **Include:** Provides declarative agent lifecycle management on Kubernetes.
- **Exclude:** The demo deploys agents manually to keep the setup transparent and debuggable. Kagenti adds an abstraction layer that obscures the platform components being demonstrated.

### llm-d (distributed vLLM on Kubernetes)

- **Include:** Self-hosted inference on the cluster.
- **Exclude:** The demo uses external MaaS endpoints. Self-hosting inference adds GPU scheduling complexity and provisioning time that exceeds the demo scope.

### SPIFFE/SPIRE (workload identity)

- **Include:** Zero-trust workload identity between agent components.
- **Exclude:** Requires Kagenti for meaningful integration. Without Kagenti, SPIFFE/SPIRE adds setup complexity without a clear demo payoff in 20 minutes.

## Decision

Exclude all three. The demo deploys agents manually (no Kagenti), uses external MaaS (no llm-d), and relies on OpenShift service accounts and network policies for workload identity (no SPIFFE/SPIRE).

## Consequences

### Positive

- Simpler platform stack with fewer moving parts.
- Demo stays within the 20-minute time budget.
- Each included component gets enough screen time to demonstrate its value.

### Negative

- Does not showcase the full Red Hat AI stack.
- Manual agent deployment is less representative of production workflows.

## Demo Impact

These exclusions simplify the "Setup" segment (1-2 min) and allow more time for the "Security Attack" and observability segments.

## References

- [BYOA Blog Post](https://www.redhat.com/en/blog/operationalizing-bring-your-own-agent-red-hat-ai-openclaw-edition)
- [RHOAI Documentation](https://docs.redhat.com/en/documentation/red_hat_openshift_ai/)
