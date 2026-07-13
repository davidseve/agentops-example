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

| Step | Guide |
|---|---|
| Bootstrap RHOAI platform on OpenShift | [docs/cluster-bootstrap.md](docs/cluster-bootstrap.md) |
| Install OpenShell (local or cluster) | [docs/openshell-installation.md](docs/openshell-installation.md) |

## Project Structure

```
├── AGENTS.md              # AI agent context (for Cursor/Claude)
├── README.md              # This file
├── docs/                  # Documentation
│   ├── ROADMAP.md         # Task tracking
│   ├── stack-decisions.md # Architecture decisions (executive summary)
│   ├── adr/               # Architecture Decision Records
│   ├── cluster-bootstrap.md   # RHOAI platform deploy on OpenShift
│   └── openshell-installation.md  # OpenShell install (local + cluster)
├── deploy/                # Deployment manifests (Helm, Kustomize)
│   ├── Makefile           # Cluster deploy targets (deploy-all, openshell-install, …)
│   └── helm/              # RHOAI platform + OpenShell wrapper charts
├── agent/                 # Agent source code, prompts, guardrails config
├── tests/                 # Health checks, red teaming
└── scripts/               # Utility scripts
```

## Documentation

- [AGENTS.md](AGENTS.md) - Full project context and tech stack definition
- [docs/ROADMAP.md](docs/ROADMAP.md) - Development roadmap and task tracking
- [docs/cluster-bootstrap.md](docs/cluster-bootstrap.md) - RHOAI platform deploy, validate, and teardown on OpenShift
- [docs/openshell-installation.md](docs/openshell-installation.md) - OpenShell install (local macOS/Linux + OpenShift Helm chart)
- [docs/stack-decisions.md](docs/stack-decisions.md) - Architecture decisions executive summary
- [docs/adr/](docs/adr/) - Full Architecture Decision Records

## Target Environment

- **Platform**: Red Hat OpenShift AI (RHOAI) 3.x
- **Cluster**: demo.redhat.com / RHPDS
- **Inference**: External MaaS endpoint
- **Version Policy**: All operators pinned to explicit versions (no automatic updates)

## Contributing

This is a collaborative project. See [AGENTS.md](AGENTS.md) for the full context on architecture decisions and constraints.

## License

Apache-2.0
