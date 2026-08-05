# Stack Decisions (Executive Summary)

One-paragraph overview of each accepted architecture decision, grouped by layer. Each entry links to the full ADR in [docs/adr/](adr/).

For the full decision log with options considered, trade-offs, and references, see the [ADR index](adr/README.md).

## Cross-cutting

- **ADR process** — [ADR-0001](adr/0001-adopt-adr-process.md): Decisions are recorded as individual files in `docs/adr/` with a dual index (technical README + this executive summary) to keep rationale traceable without cluttering `AGENTS.md`.

- **Explicit version pinning** — [ADR-0006](adr/0006-explicit-version-pinning.md): All operators, Helm charts, and container images are pinned to explicit versions. Upgrades are deliberate commits — no automatic channel updates — so the demo is reproducible across cluster provisions.

## Infrastructure

- **OCP with RHOAI as base platform** — [ADR-0002](adr/0002-ocp-with-rhoai-as-platform.md): The demo runs on OpenShift Container Platform with Red Hat OpenShift AI (RHOAI) 3.x as the AI add-on, providing operator-managed MLflow, TrustyAI, and model serving through the DataScienceCluster CRD.

- **RHOAI DataScienceCluster component selection** — [ADR-0008](adr/0008-rhoai-dsc-component-selection.md): Only the components the demo actually uses (dashboard, llamastackoperator, mlflowoperator, trustyai, kserve, modelsAsService) are enabled, with explicit deployment-ordering fixes (CRD waits, Helm-ownership adoption) for known RHOAI Dashboard/Gen AI Studio races.

## Platform Layer

- **OpenShell on OpenShift** — [ADR-0003](adr/0003-openshell-deployment-on-openshift.md): Agent sandboxing runs on the cluster via two Helm releases: a local wrapper chart (`0.2.0`, namespace + privileged SCC RoleBinding + a ConfigMap of rendered values) and a separate install of the upstream OCI chart pinned `0.0.83` (matching ADR-0006 — corrected 2026-08-05; an earlier version of this doc wrongly claimed `0.0.80` was deliberately pinned instead), with TLS, certgen hook, and `global.appsDomain` replacing all bash-templated placeholders. Uses the [Red Hat build of Agent Sandbox Operator](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.12/html/deploying_red_hat_build_of_agent_sandbox/) (OLM). (Merges what was briefly a separate ADR-0009, since retired as a duplicate.)

- **NeMo Guardrails via TrustyAI** — [ADR-0004](adr/0004-nemo-guardrails-via-trustyai.md): Guardrails are deployed through the TrustyAI operator on OCP rather than a standalone sidecar, keeping lifecycle management within the RHOAI operator stack.

## Agent Layer

- **MLflow tracing via mlflow-openclaw plugin** — [ADR-0010](adr/0010-mlflow-tracing-otel.md): OpenClaw traces reach RHOAI's MLflow through the `mlflow-openclaw` plugin (patched for SDK compatibility), not the generic `diagnostics-otel` exporter — the latter produced traces with `null` Request/Response content, while the plugin hooks OpenClaw's own lifecycle events for full content.

- **OpenClaw UI authentication via OpenShift-native OAuth proxy** — [ADR-0011](adr/0011-ui-auth-openshift-oauth-proxy.md): The Control UI is authenticated with `oauth-proxy` (`--provider=openshift`) instead of Keycloak, using an nginx sidecar to bridge to OpenShell's mTLS-only relay. The gateway trusts proxied identity (`gateway.auth.mode: trusted-proxy`) restricted to the cluster's pod/service network CIDRs.
