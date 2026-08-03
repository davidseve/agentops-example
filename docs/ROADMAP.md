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
- [x] Document cluster bootstrap (RHOAI platform deploy) — see [cluster-bootstrap.md](cluster-bootstrap.md)
- [x] Document OpenShell local install (macOS and Linux) — see [openshell-installation.md](openshell-installation.md)
- [x] Add `scripts/install-openshell.sh` — one-command local stack installer (macOS and Linux)
- [x] Add `scripts/uninstall-openshell.sh` — remove local OpenShell stack (macOS and Linux)
- [x] Validate OpenShell deployment method and constraints on target cluster — see [openshell-installation.md § OpenShift](openshell-installation.md#openshift--rhoai-cluster-deployment) (chart `0.0.80`, TLS + certgen hook on OCP; post-install mTLS sync via `make openshell-sync-mtls`)
- [x] NeMo Guardrails integration: via TrustyAI operator — see [ADR-0004](adr/0004-nemo-guardrails-via-trustyai.md)
- [x] Establish ADR process and retroactive records — see [docs/adr/](adr/README.md)
- [x] OGX: confirmed GA
- [x] InstallPlan approval: Manual policy with auto-approve in Makefile (ADR-0001)
- [x] Dashboard race fixes: wait-dashboard-crd, adopt-dashboard-config (ADR-0001)
- [x] Gen AI Studio: llamastackoperator sequencing before dashboard (ADR-0001)
- [x] MLflow chart: OpenClaw integration RBAC + experiment Job (gated, Phase 5 activates)
- [ ] Validate MLflow tracing + prompt registry capabilities
- [ ] Document MaaS options available in demo.redhat.com
- [ ] Map each demo feature to Red Hat product/component (study guide)
- [ ] Document initial pinned versions manifest (operator CSVs, image tags/digests)

## Phase 1.5 - OpenShell + OpenClaw Integration (from open-claw-in-openshell)

- [x] Deploy OpenShell from OCI Helm chart (ADR-0002)
- [ ] Define OpenShell auth strategy: Keycloak vs OpenShift OAuth
- [x] Configure Agent Sandbox SCC requirements
- [x] Deploy OpenClaw as agent harness inside sandbox
- [x] Configure sandbox network policy
- [x] Configure MaaS provider and credential injection
- [x] Validate access, MaaS connectivity, and sandbox enforcement
- [x] Wire MLflow tracing from OpenClaw plugin (ADR-0003)
- [ ] Secrets management strategy
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

- [x] Scaffold Helm charts for one-command deployment — RHOAI + OpenShell: [`deploy/helm/openshell/`](../deploy/helm/openshell/) + `make -C deploy openshell-install`
- [x] Refactor OpenShell wrapper chart (`0.2.0`): absorb namespace + SCC RoleBinding into Helm; pin Agent Sandbox `v0.5.1`; retire kustomize + SCC script — see [ADR-0003](adr/0003-openshell-deployment-on-openshift.md)
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
