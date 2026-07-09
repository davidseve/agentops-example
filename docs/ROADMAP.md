# Roadmap - AgentOps Demo

## Phase 0 - Foundation

- [x] Generate `AGENTS.md` - project context, stack, constraints
- [x] Generate `docs/ROADMAP.md` - this roadmap
- [x] Create `README.md` with project overview
- [ ] Initial commit and push to GitHub

## Phase 1 - Research and Validation

- [ ] Research RHOAI 3.x component availability and versions
- [ ] Deploy RHOAI 3.x with required dependencies on target cluster
- [ ] Validate OpenShell deployment method and constraints
- [x] NeMo Guardrails integration: via TrustyAI operator (decided)
- [x] OGX: confirmed GA
- [ ] Validate MLflow tracing + prompt registry capabilities
- [ ] Document MaaS options available in demo.redhat.com
- [ ] Map each demo feature to Red Hat product/component (study guide)
- [ ] Document initial pinned versions manifest (operator CSVs, image tags/digests)

## Phase 2 - Architecture and Agent Design

- [ ] Decide agent framework or harness (LangGraph, CrewAI, ADK, Strands, OpenClaw, NemoClaw, Hermes, or custom)
- [ ] Decide agent use case (what the agent actually does)
- [ ] Create detailed architecture document with deployment topology
- [ ] Define guardrails policies (topic control, jailbreak prevention, data protection)
- [ ] Define prompt versions for the prompt registry
- [ ] Design the demo narrative and attack scenarios

## Phase 3 - Implementation

- [ ] Implement agent source code with chosen framework/harness
- [ ] Configure NeMo Guardrails (rails, actions, policies)
- [ ] Configure MLflow tracing integration
- [ ] Configure MLflow prompt registry with versioned prompts
- [ ] Deploy and validate on RHOAI 3.x cluster
- [ ] Implement attack scenarios for the security demo
- [ ] (Nice-to-have) EvalHub + GARC red teaming setup
- [ ] (Nice-to-have) Cost tracking dashboard

## Phase 4 - Packaging and Polish

- [ ] Scaffold Helm charts for one-command deployment
- [ ] Write step-by-step demo script with timing marks (10-13 min)
- [ ] Create health-check and warm-up scripts
- [ ] Record fallback video
- [ ] Build presentation slides (5-8 min theory)
- [ ] Rehearsal runs (minimum 3x full run-throughs)
- [ ] Final polish and edge-case handling

## Open Questions

- demo.redhat.com catalog: which RHOAI demos exist that we can reuse as base?
- MaaS endpoints available: which models, rate limits, auth method?
- Which agent framework/harness to use?
- What is the agent use case?
