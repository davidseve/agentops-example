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
- [x] NeMo Guardrails integration: via TrustyAI operator (decided)
- [x] OGX: confirmed GA
- [x] InstallPlan approval: Manual policy with auto-approve in Makefile (ADR-0001)
- [x] Dashboard race fixes: wait-dashboard-crd, adopt-dashboard-config (ADR-0001)
- [x] Gen AI Studio: llamastackoperator sequencing before dashboard (ADR-0001)
- [x] MLflow chart: OpenClaw integration RBAC + experiment Job (gated, Phase 5 activates)
- [ ] Document MaaS options available in demo.redhat.com
- [ ] Map each demo feature to Red Hat product/component (study guide)
- [ ] Document initial pinned versions manifest (operator CSVs, image tags/digests)

## Phase 1.5 - OpenShell + OpenClaw Integration (from open-claw-in-openshell)

- [ ] Deploy OpenShell from OCI Helm chart (ADR-0002)
- [ ] Define OpenShell auth strategy: Keycloak vs OpenShift OAuth (ADR-0003)
- [ ] Configure Agent Sandbox SCC requirements (ADR-0004)
- [ ] Deploy OpenClaw as agent harness inside sandbox (ADR-0005)
- [ ] Configure sandbox network policy (ADR-0006)
- [ ] Configure MaaS provider and credential injection (ADR-0007)
- [ ] Validate access, MaaS connectivity, and sandbox enforcement (ADR-0008)
- [ ] Wire MLflow tracing from OpenClaw plugin (ADR-0009)
- [ ] Secrets management strategy (ADR-0010)
- [ ] Validate traces visible in RHOAI Dashboard Gen AI Studio

## Phase 2 - Architecture and Agent Design

- [x] Decide agent harness: OpenClaw (validated in open-claw-in-openshell)
- [ ] Decide agent use case (what the agent actually does)
- [ ] Create detailed architecture document with deployment topology
- [ ] Define guardrails policies (topic control, jailbreak prevention, data protection)
- [ ] Design the demo narrative and attack scenarios

## Phase 3 - Implementation

- [ ] Implement agent configuration with OpenClaw harness
- [ ] Configure NeMo Guardrails (rails, actions, policies)
- [ ] Configure MLflow tracing integration
- [ ] Deploy and validate on RHOAI 3.x cluster
- [ ] Implement attack scenarios for the security demo
- [ ] (Nice-to-have) EvalHub + GARC red teaming setup
- [ ] (Nice-to-have) Cost tracking dashboard

## Phase 4 - Packaging and Polish

- [x] Scaffold Helm charts for one-command deployment
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
- What is the agent use case?
