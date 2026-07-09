# AGENTS.md - AgentOps Demo

> Single source of truth for AI-assisted development on this project.
> Any AI tool (Cursor, Claude Code, etc.) working on this repo should read this file first.

## Project Overview

**Name**: Enterprise Secure Agent Platform - AgentOps Demo  
**Repo**: https://github.com/davidseve/agentops-example  
**Target Platform**: Red Hat OpenShift AI (RHOAI) 3.x  
**Language**: English  
**Presentation Format**: 20 min total (5-8 min theory + 10-13 min live demo)

This project demonstrates a complete enterprise-grade platform for deploying, securing, and observing AI agents on OpenShift. It follows the Red Hat AI "Bring Your Own Agent" (BYOA) strategy: customers choose any agent framework, Red Hat provides the production infrastructure underneath.

**Reference**: [Operationalizing BYOA with Red Hat AI](https://www.redhat.com/en/blog/operationalizing-bring-your-own-agent-red-hat-ai-openclaw-edition)

## Version Pinning Policy

All operators and components are deployed with **explicit pinned versions**. We upgrade deliberately and test before bumping. No automatic channel updates.

- RHOAI operator: pinned to specific CSV version
- All dependent operators: pinned to specific CSV version
- Helm chart versions: locked in `Chart.lock`
- Container images: referenced by digest where possible, tag as fallback

This prevents unexpected breakage from upstream releases. Version bumps are tracked as explicit commits in this repo.

## Architecture

The demo implements the Red Hat AI Agentic Strategy 2026 platform stack:

```
┌─────────────────────────────────────────────────────────────┐
│  USER LAYER                                                  │
│  UI (TBD) → interacts with the agent                        │
├─────────────────────────────────────────────────────────────┤
│  AGENT LAYER (BYOA - customer chooses)                      │
│  Agent Framework/Harness (TBD) + NeMo Guardrails            │
├─────────────────────────────────────────────────────────────┤
│  PLATFORM LAYER (Red Hat owns)                              │
│  OGX (API abstraction) │ MLflow (tracing + prompt registry) │
│  OpenShell (sandbox)   │ MCP Gateway (nice-to-have)         │
├─────────────────────────────────────────────────────────────┤
│  INFERENCE LAYER                                            │
│  MaaS Externo (model serving)                               │
├─────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                             │
│  OpenShift + RHOAI 3.x (demo.redhat.com / RHPDS)            │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### MUST HAVE (core demo)

| Component | Product/Technology | Purpose |
|---|---|---|
| Infrastructure | OpenShift (demo.redhat.com/RHPDS) | Container platform |
| AI Platform | RHOAI 3.x (pinned version) | ML/AI platform on OpenShift |
| Model Serving | MaaS externo | LLM inference (external endpoint) |
| LLM | TBD (best available with tool-calling) | Agent brain |
| Guardrails | NeMo Guardrails via TrustyAI | Deployed through TrustyAI operator on OCP |
| Sandbox | OpenShell | Agent execution isolation, zero-trust sandboxing |
| API Abstraction | OGX (GA) | Unified API between agent and model services |
| Observability | MLflow (tracing) | OpenTelemetry-based agent execution traces |
| Prompt Management | MLflow (prompt registry) | Versioned prompts, A/B testing |
| Agent | TBD framework or harness | See options below |

### Agent Framework/Harness Options (not decided yet)

Frameworks (code-level):
- LangGraph
- CrewAI
- Google ADK
- AWS Strands

Agent Harnesses (pre-built agents):
- OpenClaw
- NemoClaw
- Hermes

### NICE-TO-HAVE (if time permits)

| Component | Product/Technology | Purpose |
|---|---|---|
| Red Teaming | EvalHub + GARC | Automated adversarial prompt testing |
| Cost Tracking | MaaS Dashboard | Token consumption per department/tenant |
| Secure MCP | MCP Gateway | Auth, rate limiting on tool calls |

### EXPLICITLY EXCLUDED

- **Kagenti**: Not using lifecycle management (manual deploy)
- **llm-d**: Not needed (using external MaaS, not self-hosted vLLM)
- **SPIFFE/SPIRE**: Identity management too complex without Kagenti

## Technology-to-Product Mapping

This maps demo features to specific Red Hat products/components:

| Demo Feature | Red Hat Product | Component/Operator |
|---|---|---|
| Container Platform | OpenShift Container Platform | OCP 4.x |
| AI Platform | Red Hat OpenShift AI | RHOAI 3.x Operator (pinned version) |
| Agent Tracing | RHOAI - MLflow | MLflow + OpenTelemetry |
| Prompt Registry | RHOAI - MLflow | MLflow Prompt Registry |
| Guardrails | NeMo Guardrails (NVIDIA partnership) | Deployed via TrustyAI operator on OCP |
| Agent Sandboxing | OpenShell | Sandboxed execution environment |
| API Gateway | OGX (GA) | API abstraction for model access |
| Model Serving | MaaS (external) | External model endpoint |
| Red Teaming | RHOAI - EvalHub | GARC integration (nice-to-have) |
| Cost Governance | MaaS Dashboard | Token billing/showback (nice-to-have) |

## Demo Narrative (proposed)

1. **Setup** (1-2 min): Show the deployed stack on OpenShift
2. **Happy Path** (3-4 min): Agent performs its task, show traces in MLflow, show prompt version in registry
3. **Security Attack** (4-5 min): Prompt injection, data exfiltration attempts - show NeMo blocking, OpenShell containing, traces capturing everything
4. **Red Teaming** (2-3 min, if time): Automated GARC scan
5. **Wrap-up** (1 min): "Your Agent, Our Platform, Production-Ready"

## Project Structure

```
agentops-example/
├── AGENTS.md                  # This file - AI agent context
├── README.md                  # Project overview, quick start
├── docs/
│   ├── ROADMAP.md             # Phased task list
│   ├── architecture.md        # Detailed architecture (Phase 2)
│   ├── demo-script.md         # Step-by-step demo script (Phase 4)
│   └── stack-decisions.md     # ADR-style tech decisions (Phase 1-2)
├── deploy/
│   ├── helm/                  # Helm charts (Phase 4)
│   ├── kustomize/             # Kustomize overlays (Phase 4)
│   └── Makefile               # One-command deploy/teardown
├── agent/
│   ├── src/                   # Agent source code (Phase 3)
│   ├── prompts/               # Versioned prompts (Phase 3)
│   └── guardrails/            # NeMo Guardrails config (Phase 3)
├── tests/
│   ├── health-check.sh        # Pre-demo health verification
│   └── red-teaming/           # GARC configs (Phase 3, nice-to-have)
└── scripts/
    ├── warm-up.sh             # Pre-warm model
    └── demo-reset.sh          # Reset demo state
```

## Constraints and Rules

- **Target platform**: RHOAI 3.x on demo.redhat.com - everything must be deployable there
- **Pinned versions**: All operators and components use explicit version pinning. No automatic updates. Version bumps are deliberate and tested.
- **No secrets in repo**: This is a public repo. Use environment variables, sealed secrets, or external secret management
- **English**: All code, comments, docs, and demo content in English
- **GitOps**: All configuration as code, no manual cluster changes
- **Idempotent**: Deploy/teardown must be repeatable with a single command
- **BYOA principle**: The agent layer is intentionally decoupled from the platform. The platform works regardless of which framework/harness is chosen

## Open Questions

- MaaS endpoints available in demo.redhat.com (models, rate limits, auth)
- Which agent framework/harness to use
- What the agent's actual use case will be
- Initial pinned version manifest (CSV versions for all operators)

## References

- [Red Hat AI Agentic Strategy 2026](assets/strategy-image.png)
- [BYOA Blog Post](https://www.redhat.com/en/blog/operationalizing-bring-your-own-agent-red-hat-ai-openclaw-edition)
- [RHOAI Documentation](https://docs.redhat.com/en/documentation/red_hat_openshift_ai/)
- [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails)
- [MLflow](https://mlflow.org/)
