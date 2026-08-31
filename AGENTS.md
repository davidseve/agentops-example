# AGENTS.md - AgentOps Demo

> Single source of truth for AI-assisted development on this project.
> Any AI tool (Cursor, Claude Code, etc.) working on this repo should read this file first.

## Project Overview

**Name**: Enterprise Secure Agent Platform - AgentOps Demo  
**Repo**: https://github.com/davidseve/agentops-showcase  
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
│  OpenClaw Control UI (openclaw-ui-proxy)                    │
├─────────────────────────────────────────────────────────────┤
│  AGENT LAYER (BYOA - customer chooses)                      │
│  OpenClaw harness (in sandbox) + NeMo Guardrails            │
├─────────────────────────────────────────────────────────────┤
│  PLATFORM LAYER (Red Hat owns)                              │
│  MLflow (tracing + prompt registry)                         │
│  OpenShell (sandbox)   │ MCP Gateway (nice-to-have)         │
├─────────────────────────────────────────────────────────────┤
│  INFERENCE LAYER                                            │
│  OpenShell inference.local → MaaS (model serving)           │
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
| Model Serving | External MaaS via OpenShell inference router | LLM inference (`inference.local` → MaaS) |
| LLM | External MaaS | Default model `claude-sonnet-4-6` (override via `INFERENCE_MODEL`); requires tool-calling |
| Guardrails | NeMo Guardrails via TrustyAI | Deployed through TrustyAI operator on OCP |
| Sandbox | OpenShell | Agent execution isolation, zero-trust sandboxing |
| Observability | MLflow (tracing via mlflow-openclaw plugin) | Full Request/Response content in RHOAI MLflow — see [ADR-0010](docs/adr/0010-mlflow-tracing-otel.md) |
| Prompt Management | MLflow (prompt registry) | Versioned prompts, A/B testing |
| Agent | OpenClaw harness | Runs inside Agent Sandbox — see [AGENT-SANDBOX-AND-OPENSHELL.md](docs/AGENT-SANDBOX-AND-OPENSHELL.md) |

### Agent harness (demo choice)

This demo uses **OpenClaw** inside an OpenShell sandbox (validated in Phase 1.5/2 — see [ROADMAP.md](docs/ROADMAP.md)). The platform remains BYOA: customers can swap in LangGraph, CrewAI, or another harness without changing the RHOAI/OpenShell/MLflow stack underneath.

### NICE-TO-HAVE (if time permits)

| Component | Product/Technology | Purpose |
|---|---|---|
| Red Teaming | EvalHub + GARC | Automated adversarial prompt testing |
| Cost Tracking | MaaS Dashboard | Token consumption per department/tenant |
| Secure MCP | MCP Gateway | Auth, rate limiting on tool calls |

## Technology-to-Product Mapping

This maps demo features to specific Red Hat products/components:

| Demo Feature | Red Hat Product | Component/Operator |
|---|---|---|
| Container Platform | OpenShift Container Platform | OCP 4.x |
| AI Platform | Red Hat OpenShift AI | RHOAI 3.x Operator (pinned version) |
| Agent Tracing | RHOAI - MLflow | MLflow via mlflow-openclaw plugin ([ADR-0010](docs/adr/0010-mlflow-tracing-otel.md)) |
| Prompt Registry | RHOAI - MLflow | MLflow Prompt Registry |
| Guardrails | NeMo Guardrails (NVIDIA partnership) | Deployed via TrustyAI operator on OCP |
| Agent harness | OpenClaw (BYOA) | Runs in OpenShell sandbox via `launch-openclaw.sh` |
| Agent Sandboxing | OpenShell | Sandboxed execution environment |
| Model Serving | MaaS via OpenShell inference router | inference.local → MaaS external endpoint |
| Red Teaming | RHOAI - EvalHub | GARC integration (nice-to-have) |
| Cost Governance | MaaS Dashboard | Token billing/showback (nice-to-have) |

## Demo Narrative

Active live script (~9–10 min): [`docs/demo-narrativa-v1.md`](docs/demo-narrativa-v1.md) (Spanish) + [`docs/demo-script.md`](docs/demo-script.md) (English).

1. **Context** (1–2 min): Architecture map via [`docs/demo/layers.html`](docs/demo/layers.html) — skill: `demo-presenter-panel`
2. **Tests A & B** (2–3 min): API key not in sandbox; `/etc/shadow` blocked — skill: `demo-present`
3. **Test C + Cambio 1** (2 min): Unauthorized `curl` succeeds, then restrict egress — skill: `demo-restrict-egress`
4. **Test D + Cambio 2** (2–3 min): Jailbreak on direct MaaS, then NeMo blocks — skill: `demo-enable-guardrails`
5. **MLflow** (1–2 min): Same session trace — skill: `mlflow-tracing-validate`
6. **Close**: *Your Agent. Our Platform. Production-Ready.* — skill: `demo-present`

Backstage install (before stage): `demo-backstage-install` → `demo-backstage-prep` → `demo-verify`. Reset between rehearsals: `demo-reset`.

EvalHub/Garak extension (second namespace, precomputed evals): [`docs/demo-narrativa-v2.md`](docs/demo-narrativa-v2.md) — nice-to-have, not part of the active script.

## Cursor Skills

Project-level skills live in `.cursor/skills/`. Use them when the task matches their description:

### Infrastructure and platform

| Skill | When to use |
|---|---|
| `openshift-mcp` | Any OpenShift/Kubernetes cluster operation — prefer MCP (`user-kubernetes`) over `oc`/`kubectl` |
| `secrets-setup` | Create/validate `secrets/secrets.env` before deploy |
| `cluster-bootstrap` | Deploy RHOAI platform stack — see [cluster-bootstrap.md](docs/cluster-bootstrap.md) |
| `cluster-cleanup` | Remove RHOAI platform stack — see [cluster-bootstrap.md](docs/cluster-bootstrap.md) |
| `openshell-local-install` | Install OpenShell CLI + local gateway on macOS/Linux — see [openshell-installation.md](docs/openshell-installation.md) |
| `openshell-local-cleanup` | Uninstall local OpenShell stack on macOS/Linux |
| `openshell-cluster-install` | Deploy OpenShell gateway on OpenShift via `make -C deploy deploy-openshell` |
| `openshell-cluster-cleanup` | Remove OpenShell Helm release from OpenShift |
| `guardrails-cluster-install` | Deploy/validate/undeploy NeMo Guardrails (TrustyAI) — see [nemo-guardrails-installation.md](docs/nemo-guardrails-installation.md) |
| `launch-openclaw` | Launch OpenClaw in sandbox — use demo-initial policy for v1 narrative |

### Demo v1 ([demo-narrativa-v1.md](docs/demo-narrativa-v1.md))

| Skill | When to use |
|---|---|
| `demo-backstage-install` | One-shot backstage install (RHOAI + OpenShell + OpenClaw demo state) |
| `demo-backstage-prep` | Pre-stage checklist before going live |
| `demo-verify` | Validate demo initial state (`VERIFY_PROFILE=demo`) |
| `demo-present` | Master live runbook (phases 0–5) |
| `demo-presenter-panel` | Serve `layers.html` + `live.html` panels |
| `demo-restrict-egress` | Live Cambio 1 — block unauthorized egress |
| `demo-enable-guardrails` | Live Cambio 2 — switch inference to NeMo |
| `demo-reset` | Reset between rehearsals (direct MaaS + demo-initial policy) |
| `mlflow-tracing-validate` | MLflow traces block (phase 4) |

### Docs, governance, utilities

| Skill | When to use |
|---|---|
| `sync-agent-sandbox-doc` | Keep [docs/AGENT-SANDBOX-AND-OPENSHELL.md](docs/AGENT-SANDBOX-AND-OPENSHELL.md) in sync when sandbox/openshell/launch paths change |
| `document-feature` | After adding or validating a component — document in `docs/`, update ROADMAP, README, AGENTS.md |
| `adr` | Create or update an Architecture Decision Record — see [docs/adr/](docs/adr/) |
| `create-pr` | Create GitHub PRs — use [PR #1](https://github.com/davidseve/agentops-showcase/pull/1) structure |
| `no-secrets` | Scan for credentials before commit or PR |
| `redhat-kb` | Search Red Hat Knowledge Base for official troubleshooting |

## Project Structure

```
agentops-example/
├── .cursor/skills/            # Project-level Cursor agent skills
│   ├── document-feature/      # Document new components after implementation
├── AGENTS.md                  # This file - AI agent context
├── README.md                  # Project overview, quick start
├── docs/
│   ├── ROADMAP.md                 # Phased task list
│   ├── cluster-bootstrap.md       # RHOAI platform deploy on OpenShift
│   ├── openshell-installation.md  # OpenShell install (local + OpenShift Helm)
│   ├── adr/                       # Architecture Decision Records
│   │   ├── README.md              # ADR index (technical)
│   │   └── NNNN-<slug>.md         # Individual ADRs
│   ├── stack-decisions.md         # ADR executive summary (by layer)
│   ├── architecture.md            # Detailed architecture (Phase 2)
│   ├── demo-narrativa-v1.md       # Active live demo narrative (Spanish)
│   ├── demo-narrativa-v2.md       # EvalHub/Garak extension (future)
│   └── demo-script.md             # Step-by-step demo script with timing (English)
├── deploy/
│   ├── helm/guardrails/       # NemoGuardrails CR (TrustyAI); rails in files/
│   ├── Makefile               # make deploy-all, validate, deploy-openshell, …
│   ├── helm/                  # RHOAI platform + OpenShell wrapper charts
│   ├── kustomize/             # Kustomize overlays (Phase 4)
│   └── openshift/             # OpenShift-specific manifests (non-Helm)
├── agent/
│   ├── src/                   # Agent source code (Phase 3)
│   └── prompts/               # Versioned prompts (Phase 3)
├── tests/
│   ├── health-check.sh        # Pre-demo health verification
│   └── red-teaming/           # GARC configs (Phase 3, nice-to-have)
└── scripts/
    ├── cluster-lifecycle.sh           # deploy / verify / full / teardown / status / preflight
    ├── verify.sh                      # Layered validation (Makefile + Playwright); .verify-status.json
    ├── common.sh                      # Shared helpers (APPS_DOMAIN, secrets, logging)
    ├── install-openshell.sh          # OpenShell CLI/gateway + Podman stack (macOS, Linux)
    ├── uninstall-openshell.sh        # Remove local OpenShell stack (macOS, Linux)
    ├── openshift-openshell-register-gateway.sh # Register CLI gateway + mTLS (auto from deploy-openshell)
    ├── openshift-openshell-sync-mtls.sh # Sync openshell-client-tls → local CLI mTLS bundle
    ├── launch-openclaw.sh             # Create sandbox if needed + start OpenClaw gateway
    ├── demo-enable-guardrails.sh      # Live demo Cambio 2: NeMo inference path
    ├── demo-disable-guardrails.sh     # Reset to direct MaaS
    ├── demo-restrict-egress.sh        # Live demo Cambio 1: apply final sandbox policy
    ├── demo-reset.sh                  # Reset demo (direct MaaS + demo-initial policy)
    └── openshift-openshell-scc.sh    # DEPRECATED — SCC managed by Helm chart
```

## Architecture Decisions (ADRs)

Binding stack decisions live in [docs/adr/](docs/adr/). Read [stack-decisions.md](docs/stack-decisions.md) before changing platform components, deploy manifests, or version pins.

| Rule | Detail |
|---|---|
| **Accepted ADRs** | Must be followed. Conflicts require an ADR update via the `adr` skill — do not override silently. |
| **Proposed ADRs** | Directional only; flag conflicts with Accepted ADRs. |
| **New decisions** | Use the `adr` skill; update both indexes (`docs/adr/README.md`, `docs/stack-decisions.md`). |
| **Rationale location** | Keep the "why" in ADRs; link from here and other docs instead of duplicating. |

The `.cursor/rules/adr-alignment.mdc` rule enforces this for all agent sessions.

## Constraints and Rules

- **ADR alignment**: Consult [stack-decisions.md](docs/stack-decisions.md) and relevant Accepted ADRs before architectural or deploy changes
- **Target platform**: RHOAI 3.x on demo.redhat.com - everything must be deployable there
- **Pinned versions**: All operators and components use explicit version pinning (see [ADR-0006](docs/adr/0006-explicit-version-pinning.md)). No automatic updates. Version bumps are deliberate and tested.
- **No secrets in repo**: This is a public repo. Use environment variables, sealed secrets, or external secret management. Enforced by `.cursor/rules/no-secrets.mdc` and the `no-secrets` skill (scan before commit/PR).
- **Browser UI auth**: OpenClaw `gateway.auth.mode: password` behind the nginx mTLS bridge (`deploy-openclaw-ui-proxy`). Do not reintroduce oauth-proxy / `trusted-proxy` without updating [ADR-0011](docs/adr/0011-openclaw-ui-auth-nginx-bridge-password.md).
- **English**: All code, comments, docs, and demo content in English
- **GitOps**: All configuration as code, no manual cluster changes
- **Idempotent**: Deploy/teardown must be repeatable with a single command
- **BYOA principle**: The agent layer is intentionally decoupled from the platform. The platform works regardless of which framework/harness is chosen
- **Document new or modified functionality**: After adding or modifying a stack technology (version, deploy path, prereqs, verify steps), the `technology-usage-docs` rule requires running the `document-feature` skill in the same session — create or update guides in `docs/`, cross-link `ROADMAP.md`, `README.md`, and `AGENTS.md`
- **Pull requests**: Use the `create-pr` skill — body must follow [PR #1](https://github.com/davidseve/agentops-showcase/pull/1) structure (`Summary`, `Details`, `Test plan`); no default assignee unless the user requests one

## Open Questions

- MaaS endpoints available in demo.redhat.com (models, rate limits, auth)
- What the agent's actual use case will be

## References

- [Red Hat AI Agentic Strategy 2026](assets/strategy-image.png)
- [BYOA Blog Post](https://www.redhat.com/en/blog/operationalizing-bring-your-own-agent-red-hat-ai-openclaw-edition)
- [RHOAI Documentation](https://docs.redhat.com/en/documentation/red_hat_openshift_ai/)
- [NeMo Guardrails Installation](docs/nemo-guardrails-installation.md)
- [Cluster Bootstrap Guide](docs/cluster-bootstrap.md) — RHOAI platform deploy, validate, teardown
- [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails)
- [MLflow](https://mlflow.org/)
- [OpenShell on OpenShift](https://docs.nvidia.com/openshell/latest/kubernetes/openshift) — cluster deployment; validated flow in [docs/openshell-installation.md](docs/openshell-installation.md)
- [Architecture Decision Records](docs/adr/README.md) — full ADR index; executive summary in [docs/stack-decisions.md](docs/stack-decisions.md)
