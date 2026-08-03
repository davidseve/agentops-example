# ADR-0003: MLflow Tracing from OpenClaw via OTEL

**Status**: Accepted  
**Date**: 2026-08-03  
**Source**: open-claw-in-openshell (ADR-0017, ADR-0018, constraints #15, #22)

## Context

OpenClaw generates traces for agent interactions (tool calls, model inference,
reasoning steps). These traces must reach RHOAI's MLflow instance for
visibility in the Dashboard's Gen AI Studio.

The open-claw-in-openshell project solved this with:
- A `kubernetes.io/service-account-token` Secret for long-lived auth
- The `diagnostics-otel` OpenClaw plugin sending OTLP to MLflow
- Direct pod-to-Service networking (tls:skip in sandbox policy)
- A post-install Job that creates the MLflow experiment

## Decision

### Transport: OpenClaw → MLflow (in-cluster, direct)

- Endpoint: `https://mlflow.redhat-ods-applications.svc:8443`
- Auth: Bearer token from `openshell-sandbox-mlflow-token` Secret
- TLS: Skip verification (self-signed in-cluster cert, constraint #15)
- Workspace header: `X-MLFLOW-WORKSPACE: openshell`

### Auth mechanism

Use `kubernetes.io/service-account-token` annotation on a Secret bound to the
`openshell-sandbox` SA. This gives a long-lived token (no expiry unless SA/Secret
deleted). Trade-off accepted for declarative reproducibility.

Rotation: delete the Secret and re-run `helm upgrade` (recreates with fresh token).

### Plugin: diagnostics-otel

Installed via `npm` through `oc exec` (unrestricted network), since the sandbox
policy blocks npm registry. Plugin is explicitly allowed in config.

### Experiment provisioning

A Helm post-install/post-upgrade Job (`openclaw-mlflow-experiment-*`) creates
the MLflow experiment via REST API. Idempotent get-by-name-or-create logic.

## Consequences

- Traces appear in Gen AI Studio under experiment `openclaw-tracing`
- No external networking needed (sandbox → in-cluster Service)
- Token rotation requires manual Secret deletion + helm upgrade
- Plugin install requires `oc exec` (can't use sandbox's restricted network)

## References

- RHOAI MLflow RBAC: `mlflow-operator-mlflow-integration` ClusterRole
- open-claw-in-openshell: docs/constraints.md #15, #22
- open-claw-in-openshell: charts/rhoai/mlflow/templates/openclaw-integration-*
