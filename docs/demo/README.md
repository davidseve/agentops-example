# Demo presentation UI

Interactive FlowStory panel for the AgentOps talk. Not slides.

## On stage (default)

Split screen: **OpenClaw Control UI** (primary) + **[v3/live.html](v3/live.html)** (secondary).

```bash
# Preflight + static UI + local observability proxy (required for live companion)
./scripts/demo-presenter-serve.sh
# http://127.0.0.1:8765/demo/v3/live.html

# Preflight only (oc/openshell/sandbox/gateway + port check)
./scripts/demo-presenter-serve.sh --check-only
```

Requires logged-in `oc` and `openshell`. Fails fast if ports `8765`/`8766` are already in use (free with `lsof -ti :8765 | xargs kill`).

**v3 step nav:** step **0 Overall Demo** embeds the full stack map in-card; steps **A–D** (C/D split into before/after) mount in-card FlowStory canvas maps, copy-paste prompts, YAML diff panels on Change 1/2, cluster observability, and script runner on C-after / D-after.

| Keyboard | Action |
|----------|--------|
| `→` / `Page Down` | Next step (C/D: before → after) |
| `←` / `Page Up` | Previous step |
| `←` / `→` (embedded map) | Advance hops within the FlowStory canvas |
| URL hash | `#step-C-before`, `#step-D-after`, etc. |

**Layer board** (embedded maps): egress **closed** on C-before → **open** after Change 1; guardrails **off** on D-before → **on** after Change 2.

| Flow (embedded map) | Layer board highlight |
|---------------------|----------------------|
| Overall Demo | egress open, guardrails **off** |
| A · Credentials | gateway key vault |
| B · Files | Landlock |
| C · Egress (before/after) | egress closed (default deny) → open (google.com) |
| D · Guardrails (before/after) | guardrails off → NeMo on |

Hop bands on scenario flows: `1` user path · `2` security story · `3` inference · `4` MLflow trace (`oc → gw → mlflow`).

**Script runner** — run allowlisted demo scripts from the panel (no terminal switch). Requires the observability proxy on `127.0.0.1:8766`.

| Step | Action | Script |
|------|--------|--------|
| C-after | Change 1 — allow google.com | `./scripts/demo-allow-google-egress.sh` |
| D-after | Change 2 — enable NeMo | `./scripts/demo-enable-guardrails.sh` |

Proxy endpoints: `GET /api/demo/actions`, `POST /api/demo/run` with body `{"action":"<id>"}`. On success the observability panel refreshes automatically. Actions are allowlisted in [`demo-observability-proxy.py`](../../scripts/demo-observability-proxy.py).

**Presenter runbooks (repo / IDE only)** — do not open raw markdown URLs during the live demo.

- Narrative (Spanish): [demo-narrative-v1.md](../demo-narrative-v1.md)
- Timed script (English): [demo-script.md](../demo-script.md)

## Offline rehearsal

Static UI only (no cluster logs/traces, no script runner):

```bash
cd docs
python3 -m http.server 8765
# http://127.0.0.1:8765/demo/index.html
```

The [launcher](index.html) links to v3 and lists deprecated flows for reference.

## Structure

```
docs/demo/
├── index.html                      # Launcher (v3 recommended)
├── index.css
├── overall-in-doc.css              # Shared in-card embed chrome
├── overall-demo-architecture.html  # Deprecated standalone map (use v3 step 0)
├── layers-logos.html               # Deprecated legacy map with logos
├── scenarios/                      # FlowStory data + deprecated standalone test pages
│   ├── shared-scenario.js
│   ├── scenario-layout.js          # Pure layout constants (unit-test import)
│   ├── overall-flows.js            # OVERALL_SCENARIO_* flow definitions
│   ├── overall-diagram-config.js   # buildScenarioPageDiagram() for v3/v4 embeds
│   ├── overall-response-maps.js
│   ├── scenario-responses.js       # Inline responses for deprecated test-c/d pages
│   ├── test-a-credentials.html     # Deprecated standalone (dev/rehearsal)
│   ├── test-b-files.html
│   ├── test-c-egress.html
│   └── test-d-guardrails.html
├── shared/                         # vendor/, assets/, demo.css, proxy-offline-toast.js
├── v1/                             # Shared narrative + observability modules (used by v3/v4)
│   ├── live.html                   # Deprecated UI shell
│   ├── narrative.css               # Base styles (imported by v3)
│   ├── narrative-data.js           # Step nav, prompts, observability step config
│   ├── narrative-ui.js
│   ├── observability-panel.js
│   └── observability-log-rules.js
├── v2/                             # Deprecated UI shell + layout lab
├── v3/                             # Recommended live companion
│   ├── live.html
│   ├── narrative-v3.css
│   ├── narrative-v3-ui.js
│   ├── overall-embed.js
│   ├── scenario-canvas-embed.js
│   ├── scenario-canvas-config.js
│   ├── in-doc-embed-html.js
│   └── script-runner.js
└── v4/                             # Experimental compact canvas (not for live demos)
```

## Cluster observability

`v3/live.html` shows live cluster logs and MLflow traces when the local proxy is running (`demo-presenter-serve.sh` binds UI `:8765` + proxy `:8766`).

| Component | Proxy endpoint | Cluster source | Tail lines |
|-----------|----------------|----------------|------------|
| OpenClaw | `/api/logs/openclaw` | `oc exec` → `openclaw.log` | 120 |
| Sandbox | `/api/logs/sandbox?filter=signal` | `oc exec` → `/var/log/openshell.YYYY-MM-DD.log` | 300 |
| OpenShell | `/api/logs/openshell` | `oc logs openshell-0` | 120 |
| NeMo | `/api/logs/nemo` | `oc logs` on `nemo-guardrails-*` pod (dynamic discovery) | 120 |
| MLflow | `/api/traces/mlflow` | MLflow REST API from sandbox pod ([ADR-0010](../adr/0010-mlflow-tracing-otel.md)) | — |

Implementation lives under `v1/` (shared modules, not deprecated): tail limits in `LOG_LINES_BY_COMPONENT` in [`v1/observability-panel.js`](v1/observability-panel.js); signal/warn/noise classification, focus Filter (default ON), step-aware sandbox overrides, and step hints in [`v1/observability-log-rules.js`](v1/observability-log-rules.js). Step-aware tab visibility is configured in [`v1/narrative-data.js`](v1/narrative-data.js).

**Runbook:** [demo-scenario-logs.md](demo-scenario-logs.md) — what to search for in each component during Tests A–D; [§ Sandbox panel highlight rules](demo-scenario-logs.md#sandbox-panel-highlight-rules) documents green/amber/gray tiers and step-aware overrides.

**Panel controls (per tab):**
- **Clear** — snapshot current tail; show only new lines/traces after click (toggle off to restore full log). Does not modify cluster logs.
- **Filter** — focus mode: show signal (green) and warn (amber) only (default ON); disable to see full log in gray
- **↓** — pause/resume live updates (each tab remembers its own state)

Proxy: [`scripts/demo-observability-proxy.py`](../../scripts/demo-observability-proxy.py). Requires `oc` and `openshell` on the presenter laptop; binds to `127.0.0.1` only.

## Data layer

| Module | Role |
|--------|------|
| [`scenarios/overall-flows.js`](scenarios/overall-flows.js) | `OVERALL_SCENARIO_*` hop definitions for all flows |
| [`scenarios/overall-diagram-config.js`](scenarios/overall-diagram-config.js) | `buildScenarioPageDiagram()` — used by v3/v4 in-card embeds |
| [`scenarios/overall-response-maps.js`](scenarios/overall-response-maps.js) | Inference/trace response offsets on the overall map |
| [`v1/narrative-data.js`](v1/narrative-data.js) | Live companion step nav, prompts, observability focus per step |

Deprecated standalone `test-*` pages: A/B use `buildScenarioPageDiagram()`; C/D still use inline definitions in [`scenario-responses.js`](scenarios/scenario-responses.js). Prefer v3 step nav for rehearsal — same flows, single panel.

## CSS conventions

Presentation styles live in external `.css` files — no `<style>` blocks or `style="..."` in HTML/JS templates. Shared FlowStory chrome: `shared/demo.css`; launcher: `index.css`; live companion: `v1/narrative.css` + `v3/narrative-v3.css` (v4: `narrative-v4.css`).

Validate after edits:

```bash
./scripts/validate-demo-external-css.sh
```

Cursor: rule `.cursor/rules/demo-external-css.mdc`, skill `demo-external-css`.

## Testing

Demo presentation logic is covered by **no-cluster** unit tests (also run in CI):

```bash
./scripts/validate-demo-ui.sh
```

| Module | Spec |
|--------|------|
| `v1/observability-log-rules.js` | `tests/observability-log-rules.spec.ts` |
| `scenarios/overall-flows.js`, `overall-response-maps.js`, `v1/narrative-data.js`, `tests/demo-prompts.ts` | `tests/demo-scenario-consistency.spec.ts` |
| `tests/ui-helpers.ts` (assertion helpers) | `tests/ui-helpers.unit.spec.ts` |
| HTML/JS presentation CSS | `scripts/validate-demo-external-css.sh` |

Cursor: rule `.cursor/rules/demo-ui-tests.mdc`, skill `demo-ui-tests`. Pure layout constants (importable in Node tests): `scenarios/scenario-layout.js`.

## README architecture image

The repo root [README.md](../../README.md) embeds a static PNG of the v3 live companion step **Overall Demo** ([v3/live.html](v3/live.html)). Regenerate after edits to `scenarios/overall-diagram-config.js`, `overall-flows.js`, or related FlowStory layout:

```bash
make export-architecture
# or: ./scripts/export-readme-architecture.sh
```

Output: [`assets/overall-architecture.png`](../../assets/overall-architecture.png) (baseline flow with all hops revealed). CI re-exports and fails if the committed file is stale.

## Deprecated (dev / bookmarks only)

Do not use these on stage — v3 embeds the same maps in-card.

| Page | URL | Notes |
|------|-----|-------|
| Standalone architecture map | [overall-demo-architecture.html](overall-demo-architecture.html) | Superseded by v3 step **Overall Demo** |
| Legacy map with logos | [layers-logos.html](layers-logos.html) | Early FlowStory prototype |
| Standalone test A–D | [scenarios/test-a-credentials.html](scenarios/test-a-credentials.html) … D | Superseded by v3 steps A–D |
| Live companion v1 | [v1/live.html](v1/live.html) | Split panel; script runner shows commands as text only |
| Live companion v2 | [v2/live.html](v2/live.html) | Compact panel + layout lab (`?layout=`) |
| Live companion v4 | [v4/live.html](v4/live.html) | Experimental compact canvas — use v3 for live demos |

## Cursor skills

| Page / phase | Skill |
|---|---|
| Serve panels | `demo-presenter-panel` |
| Live runbook (A–D) | `demo-present` |
| Change 1 / 2 / reset | `demo-allow-google-egress`, `demo-enable-guardrails`, `demo-reset` |

See [AGENTS.md](../AGENTS.md) § Demo narrative skills (`demo-narrative-v1`).

## Vendor

`shared/vendor/` is a snapshot of [FlowStory](https://github.com/noyitz/flowstory) (Apache 2.0). See [shared/vendor/NOTICE.txt](shared/vendor/NOTICE.txt).
