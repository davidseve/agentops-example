# AgentOps Example - Enterprise Secure Agent Platform

Demo showcasing a complete enterprise-grade platform for deploying, securing, and observing AI agents on Red Hat OpenShift AI 3.x.

## What is this?

This project demonstrates the **BYOA (Bring Your Own Agent)** approach from the Red Hat AI Agentic Strategy 2026: customers choose any agent framework, Red Hat provides the production-ready infrastructure underneath.

**Key message**: *Your Agent. Our Platform. Production-Ready.*

## Platform Stack

```
Customer Agent (any framework) ─── BYOA
        │
        ├── NeMo Guardrails ─────── Input/Output security
        ├── OGX ─────────────────── API abstraction
        ├── MLflow ──────────────── Tracing + Prompt Registry
        ├── OpenShell ───────────── Sandboxed execution
        │
        └── OpenShift + RHOAI 3.x ───── Infrastructure
```

## Version Pinning

All operators and components use **explicit pinned versions**. We upgrade deliberately and test before bumping to avoid surprises from upstream releases. See [AGENTS.md](AGENTS.md) for the full version pinning policy.

## Demo Highlights

- **Security**: NeMo Guardrails block prompt injection, topic deviation, and data exfiltration
- **Isolation**: OpenShell sandboxes agent execution with zero-trust principles
- **Observability**: MLflow captures full agent execution traces via OpenTelemetry
- **Prompt Management**: Versioned prompts in MLflow Prompt Registry enable A/B testing
- **Platform Agnostic**: The agent framework is interchangeable - the platform works regardless

## Quick Start

> **Note**: Implementation in progress. See [docs/ROADMAP.md](docs/ROADMAP.md) for current status.

```bash
# Prerequisites: oc logged in to an OpenShift cluster, helm 3.x installed

# Deploy the full stack (includes waits between steps)
cd deploy && make deploy-all

# Verify all components are healthy
./tests/health-check.sh        # or: cd deploy && make validate

# Teardown (deletes DSCI before operator to avoid stuck finalizers)
cd deploy && make undeploy-all
```

## Project Structure

```
├── AGENTS.md              # AI agent context (for Cursor/Claude)
├── README.md              # This file
├── docs/                  # Documentation
│   └── ROADMAP.md         # Task tracking
├── deploy/                # Deployment manifests (Helm, Kustomize)
├── agent/                 # Agent source code, prompts, guardrails config
├── tests/                 # Health checks, red teaming
└── scripts/               # Utility scripts
```

## Documentation

- [AGENTS.md](AGENTS.md) - Full project context and tech stack definition
- [docs/ROADMAP.md](docs/ROADMAP.md) - Development roadmap and task tracking

## Target Environment

- **Platform**: Red Hat OpenShift AI (RHOAI) 3.x
- **Cluster**: demo.redhat.com / RHPDS
- **Inference**: External MaaS endpoint
- **Version Policy**: All operators pinned to explicit versions (no automatic updates)

## Contributing

This is a collaborative project. See [AGENTS.md](AGENTS.md) for the full context on architecture decisions and constraints.

## License

Apache-2.0
