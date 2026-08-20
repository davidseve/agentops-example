# Stack Decisions (Executive Summary)

One-paragraph overview of each accepted architecture decision, grouped by layer. Each entry links to the full ADR in [docs/adr/](adr/).

For the full decision log with options considered, trade-offs, and references, see the [ADR index](adr/README.md).

## Cross-cutting

- **ADR process** — [ADR-0001](adr/0001-adopt-adr-process.md): Decisions are recorded as individual files in `docs/adr/` with a dual index (technical README + this executive summary) to keep rationale traceable without cluttering `AGENTS.md`.

- **Explicit version pinning** — [ADR-0006](adr/0006-explicit-version-pinning.md): All operators, Helm charts, and container images are pinned to explicit versions. Upgrades are deliberate commits — no automatic channel updates — so the demo is reproducible across cluster provisions.

## Infrastructure

- **OCP with RHOAI as base platform** — [ADR-0002](adr/0002-ocp-with-rhoai-as-platform.md): The demo runs on OpenShift Container Platform with Red Hat OpenShift AI (RHOAI) 3.x as the AI add-on, providing operator-managed MLflow, TrustyAI, and model serving through the DataScienceCluster CRD.

- **RHOAI DataScienceCluster component selection** — [ADR-0008](adr/0008-rhoai-dsc-component-selection.md): The demo enables `dashboard`, `mlflowoperator`, `trustyai`, and `kserve` (required for TrustyAI readiness). Deployment ordering fixes (Dashboard CRD wait, Helm-ownership adoption for `odh-dashboard-config`) are implemented in `deploy/Makefile`.

## Platform Layer

- **OpenShell on OpenShift** — [ADR-0003](adr/0003-openshell-deployment-on-openshift.md): Agent sandboxing runs on the cluster via a single Helm release (wrapper chart `0.3.0`, declaring the upstream OCI chart as a real Helm subchart dependency pinned `0.0.83` in `Chart.yaml`/`Chart.lock` — matching ADR-0006, corrected 2026-08-05 after two earlier, abandoned designs: first a dead unused dependency, then briefly a two-release `ConfigMap` round-trip), with TLS, certgen hook, and `global.appsDomain` replacing all bash-templated placeholders. Uses the [Red Hat build of Agent Sandbox Operator](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_red_hat_build_of_agent_sandbox/) (OLM, OSC 1.13 TP, package `agent-sandbox-operator` channel `preview-0.9`) as the **sole** source of the sandbox controller/router/CRDs — the upstream raw `v0.5.1` manifest path was retired 2026-08-06. (Merges what was briefly a separate ADR-0009, since retired as a duplicate.)

- **NeMo Guardrails via TrustyAI** — [ADR-0004](adr/0004-nemo-guardrails-via-trustyai.md): Guardrails are deployed through the TrustyAI operator on OCP rather than a standalone sidecar, keeping lifecycle management within the RHOAI operator stack.

## Agent Layer

- **OpenClaw as demo agent harness** — This demo runs OpenClaw inside an OpenShell sandbox ([AGENT-SANDBOX-AND-OPENSHELL.md](AGENT-SANDBOX-AND-OPENSHELL.md), [ROADMAP.md](ROADMAP.md) Phase 1.5/2). The BYOA principle is unchanged: the platform stack works regardless of which agent framework a customer chooses.

- **MLflow tracing via mlflow-openclaw plugin** — [ADR-0010](adr/0010-mlflow-tracing-otel.md): OpenClaw traces reach RHOAI's MLflow through the `mlflow-openclaw` plugin (patched for SDK compatibility), not the generic `diagnostics-otel` exporter — the latter produced traces with `null` Request/Response content, while the plugin hooks OpenClaw's own lifecycle events for full content.

- **OpenClaw UI authentication via nginx mTLS bridge + password** — [ADR-0011](adr/0011-openclaw-ui-auth-nginx-bridge-password.md): The Control UI is reached through an nginx reverse proxy that presents mTLS client certificates to the OpenShell relay. OpenClaw `gateway.auth.mode: password` protects the WebSocket (shared `OPENCLAW_GATEWAY_PASSWORD`). Per-user OCP SSO via oauth-proxy was dropped — not a current requirement.

- **OpenClaw security evaluation via EvalHub Garak and MLflow** — [ADR-0012](adr/0012-openclaw-security-evaluation.md): Enable OpenClaw Chat Completions behind the existing nginx mTLS Route; Garak (EvalHub) red-teams content/jailbreak via `openclaw/default`; MLflow deterministic scorers cover sandbox file/network/tool policy. Helm ConfigMaps are the source of truth for Garak jobs.
