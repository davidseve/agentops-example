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
- [x] Validate OpenShell deployment method and constraints on target cluster — see [openshell-installation.md § OpenShift](openshell-installation.md#openshift--rhoai-cluster-deployment) (chart `0.0.83`, TLS + certgen hook on OCP; post-install mTLS sync via `make openshell-sync-mtls`)
- [x] NeMo Guardrails integration: via TrustyAI operator — see [ADR-0004](adr/0004-nemo-guardrails-via-trustyai.md)
- [x] Establish ADR process and retroactive records — see [docs/adr/](adr/README.md)
- [x] OGX: confirmed GA
- [x] InstallPlan approval: Manual policy with auto-approve in Makefile (ADR-0008)
- [x] Dashboard race fixes: wait-dashboard-crd, adopt-dashboard-config (ADR-0008)
- [x] MLflow chart: OpenClaw integration RBAC + experiment Job (gated, Phase 5 activates)
- [x] Document MaaS options available in demo.redhat.com
- [x] Map each demo feature to Red Hat product/component (study guide / `docs/architecture.md`) — partial mapping in [AGENTS.md](../AGENTS.md) § Technology-to-Product Mapping
- [x] Document initial pinned versions manifest (operator CSVs, image tags/digests)



## Phase 1.5 - OpenShell + OpenClaw Integration

- [x] Deploy OpenShell from OCI Helm chart (ADR-0003)
- [x] Define OpenShell auth strategy: nginx mTLS bridge + OpenClaw password auth (ADR-0011; oauth-proxy dropped 2026-08-06)
- [x] Configure Agent Sandbox SCC requirements
- [x] Deploy OpenClaw as agent harness inside sandbox
- [x] Configure sandbox network policy
- [x] Configure MaaS provider and credential injection
- [x] Validate access, MaaS connectivity, and sandbox enforcement
- [x] Wire MLflow tracing from OpenClaw plugin (ADR-0010)
- [x] Secrets management strategy: `secrets/secrets.env` gitignored (never committed — verified clean history). Migrated to OpenShell's inference router (`inference.local`): LLM credentials now live exclusively in the gateway's provider record, injected by the inference router at the gateway layer. The sandbox process uses `apiKey: "unused"` and never sees the real key. Previously used OpenClaw's `${LITELLM_API_KEY}` SecretRef (2026-08-13), now superseded by inference router (2026-08-14). Also fixed: stale-gateway kill step used `oc exec` (wrong PID namespace vs. the `openshell sandbox exec`-started gateway), so old processes were never actually killed on restart — see [AGENT-SANDBOX-AND-OPENSHELL.md § Step 1](AGENT-SANDBOX-AND-OPENSHELL.md#step-1--clean-stale-gateway-processes-via-openshell-sandbox-exec-sandbox-context).
- [x] Validate traces visible in RHOAI Dashboard Gen AI Studio — confirmed via Playwright (`tests/mlflow-ui.spec.ts`), including full Request/Response content from a live E2E chat
- [x] TrustyAI + kserve set to `Managed` on the shared DataScienceCluster ahead of need (EvalHub red-teaming, Phase 3 guardrails, future model serving) — both confirmed `Ready: True` end-to-end (2026-08-14), applied via a one-off `oc apply`/`oc patch` against the live cluster. `values.yaml` was updated so `kserve.managementState: Managed` (alongside the already-`Managed` `trustyai`/`mlflowoperator`) reflects the real desired state declaratively for any future `make deploy-platform` from-scratch install. One operational note from getting it to `Ready`: after flipping `kserve` from `Removed → Managed`, the `TrustyAI` component CR's own controller only re-evaluated its `InferenceServices CRD does not exist` precondition failure once (at the moment `kserve`'s CRDs were still being installed) and then sat requeue-backed-off; annotating the parent `DataScienceCluster` didn't re-trigger it, but annotating the child `trustyai.components.platform.opendatahub.io/default-trustyai` CR directly did force an immediate re-reconcile, after which it went `Ready: True` in ~20s. One-off unblock, not automated (CRDs won't disappear again once installed).
- [x] Removed all shared-cluster/"coexisting project" special-casing from `deploy/Makefile` end-to-end (2026-08-14). This went through a few iterations the same day: first per-field `oc patch` reconciliation, then a git-tracked `oc apply` manifest (`manifests/dsc-shared-overrides.yaml`), both trying to make this project's `trustyai`/`kserve`/`mlflowoperator` desired state survive a shared `rhoai-platform` Helm release owned by the coexisting `open-claw-in-openshell` project. All of it was removed once the real workflow was clarified: `make cluster-cleanup` (full teardown) before switching which project's stack is deployed on a given cluster — not indefinite side-by-side coexistence with divergent component sets. With that workflow, every `deploy-*` target's "skip if release already exists" branch (`deploy-operators`, `deploy-database`, `deploy-mlflow`, `deploy-evalhub`, and `deploy-platform`/`deploy-platform-fresh`, the latter two now merged into one target) was also unnecessary complexity: plain `helm upgrade --install` is already idempotent, so every one of those targets now just runs it unconditionally, no "already deployed" check at all. Also simplified: `wait-evalhub-crd` no longer treats a missing CRD as an expected "TrustyAI Removed on a shared DSC" outcome to silently skip (this project's own `deploy-platform` always sets `trustyai: Managed`, so the CRD reliably appears — same plain registration-race wait as `wait-mlflow-crd`/`wait-dashboard-crd`). Coexistence-flavored comments were also cleaned up in `values.yaml` (openclaw-ui-proxy, openshell route), `scripts/openshift-openshell-register-gateway.sh`, and [ADR-0008](adr/0008-rhoai-dsc-component-selection.md) (which was additionally stale — still listed `kserve` as `Removed`). Net effect: this project's deploy scripts no longer reference or reason about `open-claw-in-openshell` (or any other coexisting project) anywhere; if you want two independent stacks live on the same cluster at once, that's back to being a manual, unsolved concern, not something this Makefile tries to paper over.



## Phase 2 - Architecture and Agent Design

- [x] Decide agent harness: OpenClaw (validated against a reference deployment)
- [x] Decide agent use case (what the agent actually does)
- [x] Create detailed architecture document with deployment topology
- [x] Define guardrails policies (self-check input/output, jailbreak) — [agent/guardrails/](../agent/guardrails/)
- [ ] Design the demo narrative and attack scenarios



## Phase 3 - Implementation

- [x] Implement agent configuration with OpenClaw harness
- [x] Configure NeMo Guardrails (rails, actions, policies) — see [nemo-guardrails-installation.md](nemo-guardrails-installation.md)
- [x] Playwright guardrails E2E (`tests/guardrails-ui.spec.ts`, `make -C deploy test-guardrails`)
- [x] Configure MLflow tracing integration
- [x] Deploy and validate on RHOAI 3.x cluster
- [ ] Implement attack scenarios for the security demo — including the progressive network-policy unlock narrative, see [Deferred § Progressive network-policy unlock](#progressive-network-policy-unlock-for-the-security-attack-demo)
- [ ] (Nice-to-have) EvalHub + GARC red teaming setup
- [ ] (Nice-to-have) Cost tracking dashboard



## Phase 4 - Packaging and Polish

- [x] Scaffold Helm charts for one-command deployment — RHOAI + OpenShell: `[deploy/helm/openshell/](../deploy/helm/openshell/)` + `make -C deploy deploy-openshell`
- [x] Refactor OpenShell wrapper chart (`0.3.0`): absorb namespace + SCC RoleBinding into Helm; Agent Sandbox via OLM only (OSC 1.13); retire kustomize + SCC script + raw `v0.5.1` manifest — see [ADR-0003](adr/0003-openshell-deployment-on-openshift.md)
- [ ] Write step-by-step demo script with timing marks (10-13 min)
- [x] Create health-check script (`tests/health-check.sh`)
- [ ] Create warm-up script
- [ ] Record fallback video
- [ ] Build presentation slides (5-8 min theory)
- [ ] Rename github proyect.
- [ ] Name conventions refactor.



## Deferred



### Progressive network-policy unlock for the Security Attack demo

Found while comparing this project against a related OpenShell/OpenCode reference demo
([r3v5/agent-ops,](https://github.com/r3v5/agent-ops/tree/opencode-in-openshell-with-mlflow-on-openshift-demo/demos/opencode-vertex-tracing) `opencode-vertex-tracing`).
That demo's narrative starts from a fully default-deny sandbox, shows a tool call fail live,
then unlocks endpoints one at a time with `openshell policy update <sandbox> --add-endpoint <host>:443 --binary <path> --wait` — a strong "zero-trust, progressively opened" visual for a
live audience.

Today, `[scripts/launch-openclaw.sh](../scripts/launch-openclaw.sh)` applies the full
`[policies/openclaw-sandbox.yaml](../policies/openclaw-sandbox.yaml)` at `sandbox create --policy ...` time — MaaS and MLflow egress are both already open before the demo starts, so
we lose the "default-deny → live unlock" moment that [ADR-0003](adr/0003-openshell-deployment-on-openshift.md)'s
"Demo Impact" section and `AGENTS.md`'s "Security Attack" narrative block both call for.

- [ ] Add a minimal (or empty) default policy for the `openclaw-demo` sandbox creation step,
  ```
  instead of the full `openclaw-sandbox.yaml`
  ```
- [ ] Script (or document as manual demo steps) the live `openshell policy update
  ```
  <SANDBOX_NAME> --add-endpoint <host>:443 --binary <path> --wait` calls for, in order:
  MaaS inference, then MLflow tracing — mirroring the two `network_policies` blocks
  already defined in `policies/openclaw-sandbox.yaml` (`maas_inference`, `mlflow_direct`)
  ```
- [ ] Verify the expected failure mode first (agent chat / MaaS call fails cleanly with the
  ```
  egress not yet granted) before recording or presenting
  ```
- [ ] Update the demo script / narrative docs (Phase 4's step-by-step demo script, once written)
  ```
  with the exact `openshell policy update` commands and expected before/after behavior
  ```
- [ ] Keep `policies/openclaw-sandbox.yaml` as the "final state" reference / fallback for
  ```
  non-interactive (e.g. CI, `make validate-*`) runs that need full connectivity immediately
  ```



