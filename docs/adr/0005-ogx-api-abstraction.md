# ADR-0005: OGX as API Abstraction (GA)

## Status

Proposed

## Date

2026-07-13

## Layer

Platform

## Context

The demo agent needs a unified API layer between its framework and the model serving backends. This abstraction must decouple the agent from specific model endpoints, enabling the BYOA principle: swap models or providers without changing agent code.

OGX reached GA status in RHOAI 3.x, providing a supported API gateway for model access on OpenShift.

## Options Considered

### Option 1: Direct model endpoint calls

- **Pros:** Simplest setup; no extra component.
- **Cons:** Agent code is coupled to specific model URLs and auth; no centralized routing, rate limiting, or observability.

### Option 2: OGX (GA) as API abstraction layer

- **Pros:** GA and supported on RHOAI; provides unified API, routing, and model abstraction; aligns with Red Hat platform ownership of the gateway layer.
- **Cons:** Adds a component to deploy and configure; limited to what OGX supports for routing policies.
- **GA / support status:** GA in RHOAI 3.x — confirmed in [RHOAI release notes](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/release_notes/).

## Decision

Use OGX as the API abstraction layer between the agent and model services. The agent calls OGX; OGX routes to MaaS or other backends.

## Consequences

### Positive

- Agent framework is fully decoupled from model endpoints.
- Centralized point for observability and access control.
- Demonstrates a key Red Hat platform capability in the demo.

### Negative

- OGX must be deployed and healthy before the agent can operate.
- Routing configuration must be maintained as models change.

## Demo Impact

OGX sits in the critical path of every agent-to-model call. The "Happy Path" demo segment shows requests flowing through OGX to the model endpoint.

## References

- [RHOAI 3.4 Release Notes](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/release_notes/)
- [RHOAI Supported Configurations 3.x](https://access.redhat.com/articles/rhoai-supported-configs-3.x)
