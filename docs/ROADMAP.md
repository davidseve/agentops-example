# Roadmap - AgentOps Demo

## Phase 0 - Foundation

- [x] Generate `AGENTS.md` - project context, stack, constraints
- [x] Generate `docs/ROADMAP.md` - this roadmap
- [x] Create `README.md` with project overview
- [x] Initial commit and push to GitHub

## Phase 1 - Research and Validation

- [x] Research RHOAI 3.x component availability and versions
- [x] Deploy RHOAI 3.x with required dependencies on target cluster
- [x] Add deploy waits (CSV, DSCI, CRDs) and post-deploy validation (`make validate`)
- [x] Fix cleanup order (DSCI before operator) and add cleanup validation (`make validate-cleanup`)
- [x] Document OpenShell local install (macOS and Linux) — see [openshell-installation.md](openshell-installation.md)
- [x] Add `scripts/install-openshell.sh` — one-command local stack installer (macOS and Linux)
- [x] Add `scripts/uninstall-openshell.sh` — remove local OpenShell stack (macOS and Linux)
- [x] Validate OpenShell deployment method and constraints on target cluster — see [openshell-installation.md § OpenShift](openshell-installation.md#openshift--rhoai-cluster-deployment) (chart `0.0.80`, TLS + certgen hook on OCP)
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

- [x] Scaffold Helm charts for one-command deployment — RHOAI + OpenShell: [`deploy/helm/openshell/`](../deploy/helm/openshell/) + `make -C deploy openshell-install`
- [ ] Write step-by-step demo script with timing marks (10-13 min)
- [x] Create health-check script (`tests/health-check.sh`)
- [ ] Create warm-up script
- [ ] Record fallback video
- [ ] Build presentation slides (5-8 min theory)
- [ ] Rehearsal runs (minimum 3x full run-throughs)
- [ ] Final polish and edge-case handling

## Open Questions

- demo.redhat.com catalog: which RHOAI demos exist that we can reuse as base?
- MaaS endpoints available: which models, rate limits, auth method?
- Which agent framework/harness to use?
- What is the agent use case?
