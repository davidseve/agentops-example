# Stack Decisions (Executive Summary)

One-paragraph overview of each accepted architecture decision, grouped by layer. Each entry links to the full ADR in [docs/adr/](adr/).

For the full decision log with options considered, trade-offs, and references, see the [ADR index](adr/README.md).

## Cross-cutting

- **ADR process** — [ADR-0001](adr/0001-adopt-adr-process.md): Decisions are recorded as individual files in `docs/adr/` with a dual index (technical README + this executive summary) to keep rationale traceable without cluttering `AGENTS.md`.

- **Explicit version pinning** — [ADR-0006](adr/0006-explicit-version-pinning.md): All operators, Helm charts, and container images are pinned to explicit versions. Upgrades are deliberate commits — no automatic channel updates — so the demo is reproducible across cluster provisions.

- **Exclude Kagenti, llm-d, SPIFFE/SPIRE** — [ADR-0007](adr/0007-exclude-kagenti-llmd-spiffe.md): These components add complexity beyond the 20-minute demo scope. The demo deploys agents manually, uses external MaaS, and relies on OpenShift service accounts for identity.

## Infrastructure

- **OCP with RHOAI as base platform** — [ADR-0002](adr/0002-ocp-with-rhoai-as-platform.md): The demo runs on OpenShift Container Platform with Red Hat OpenShift AI (RHOAI) 3.x as the AI add-on, providing operator-managed MLflow, TrustyAI, OGX, and model serving through the DataScienceCluster CRD.

## Platform Layer

- **OpenShell on OpenShift** — [ADR-0003](adr/0003-openshell-deployment-on-openshift.md): Agent sandboxing runs on the cluster via Helm chart `0.0.80` with TLS, certgen hook, and Agent Sandbox controller. Privileged SCC is required for the sandbox service account.

- **NeMo Guardrails via TrustyAI** — [ADR-0004](adr/0004-nemo-guardrails-via-trustyai.md): Guardrails are deployed through the TrustyAI operator on OCP rather than a standalone sidecar, keeping lifecycle management within the RHOAI operator stack.

- **OGX as API abstraction** *(Proposed)* — [ADR-0005](adr/0005-ogx-api-abstraction.md): OGX (GA in RHOAI 3.x) provides a unified API layer between the agent and model services, decoupling the agent framework from specific endpoints.
