# Demo presentation UI

Interactive FlowStory panel for the AgentOps talk. Not slides.

## Launcher

```bash
# Preflight + static UI + local observability proxy (recommended for live companion)
./scripts/demo-presenter-serve.sh
# http://127.0.0.1:8765/v3/live.html

# Preflight only (oc/openshell/sandbox/gateway + port check)
./scripts/demo-presenter-serve.sh --check-only
```

Requires logged-in `oc` and `openshell`. Fails fast if ports `8765`/`8766` are already in use (free with `lsof -ti :8765 | xargs kill`).

Static UI only (offline / no observability panel):

```bash
cd docs/demo
python3 -m http.server 8765
# http://127.0.0.1:8765/index.html
```

## Structure

```
docs/demo/
├── index.html           # Launcher (v1–v3 flows)
├── index.css            # Launcher-only styles
├── overall-demo-architecture.html  # Phase 0 — full stack map (+ links to A–D)
├── scenarios/           # Focused FlowStory panels per test A–D
│   ├── shared-scenario.js
│   ├── scenario-layout.js      # Pure layout constants (no FlowStory/DOM; unit-test import)
│   ├── overall-flows.js        # SCENARIO_* (test-*) + OVERALL_SCENARIO_* (overall dropdown)
│   ├── overall-response-maps.js  # Overall-map inference/trace response offsets
│   ├── test-a-credentials.html   # Security-focused
│   ├── test-b-files.html
│   ├── test-c-egress.html
│   └── test-d-guardrails.html
├── shared/              # vendor/, assets/, demo.css, logo-renderer.js
├── v1/                  # Split panel (deprecated)
│   ├── live.html
│   ├── narrative.css
│   ├── narrative-data.js
│   ├── narrative-ui.js
│   ├── observability-panel.js
│   └── observability-log-rules.js
├── v2/                  # Compact panel (deprecated)
│   ├── live.html
│   ├── narrative-v2.css
│   ├── narrative-v2-ui.js
│   ├── script-runner.js
│   ├── baseline-diagram.js
│   ├── baseline-embed.css
│   └── baseline-layout-variants.css
└── v3/                  # Recommended — step 0 = full overall map; tabs A–D = scenario canvas
    ├── live.html
    ├── narrative-v3.css
    ├── narrative-v3-ui.js
    ├── overall-embed.js
    ├── scenario-canvas-embed.js
    ├── scenario-canvas-embed.css
    └── script-runner.js
```

## CSS conventions

Presentation styles live in external `.css` files — no `<style>` blocks or `style="..."` in HTML/JS templates. Shared FlowStory chrome: `shared/demo.css`; launcher: `index.css`; narrative: `v1/narrative.css` (+ v2 sheets).

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

### Cluster observability (v3 live companion)

`v3/live.html` (and legacy `v1/live.html`) can show live cluster logs and MLflow traces when the local proxy is running:

```bash
./scripts/demo-presenter-serve.sh   # UI :8765 + proxy :8766
```

| Component | Proxy endpoint | Cluster source | Tail lines |
|-----------|----------------|----------------|------------|
| OpenClaw | `/api/logs/openclaw` | `oc exec` → `openclaw.log` | 120 |
| Sandbox | `/api/logs/sandbox?filter=signal` | `oc exec` → `/var/log/openshell.YYYY-MM-DD.log` | 300 |
| OpenShell | `/api/logs/openshell` | `oc logs openshell-0` | 120 |
| NeMo | `/api/logs/nemo` | `oc logs` on `nemo-guardrails-*` pod (dynamic discovery) | 120 |
| MLflow | `/api/traces/mlflow` | MLflow REST API from sandbox pod ([ADR-0010](../adr/0010-mlflow-tracing-otel.md)) | — |

Tail line limits are tuned in `LOG_LINES_BY_COMPONENT` in [`v1/observability-panel.js`](v1/observability-panel.js) (proxy accepts `?lines=1..500`, sandbox `?filter=all|signal`). Three-tier classification (signal/warn/noise), focus Filter (default ON), step-aware sandbox overrides (e.g. github.com green on C-before only), and step hints: [`v1/observability-log-rules.js`](v1/observability-log-rules.js).

**Runbook:** [demo-scenario-logs.md](demo-scenario-logs.md) — what to search for in each component during Tests A–D; [§ Sandbox panel highlight rules](demo-scenario-logs.md#sandbox-panel-highlight-rules) documents green/amber/gray tiers and step-aware overrides.

**Panel controls (per tab):**
- **Clear** — snapshot current tail; show only new lines/traces after click (toggle off to restore full log). Does not modify cluster logs.
- **Filter** — focus mode: show signal (green) and warn (amber) only (default ON); disable to see full log in gray
- **↓** — pause/resume live updates (each tab remembers its own state)

Proxy implementation: [`scripts/demo-observability-proxy.py`](../../scripts/demo-observability-proxy.py). Requires `oc` and `openshell` on the presenter laptop; binds to `127.0.0.1` only. v3 script runner uses `POST /api/demo/run` (allowlisted actions only).

## Phase 0 — Overall demo architecture

- [overall-demo-architecture.html](overall-demo-architecture.html) — full stack map with **7 flows** in the panel dropdown:

| Flow | Layer board highlight |
|------|----------------------|
| Overall Demo | egress open, guardrails **off** |
| A · Credentials | gateway key vault |
| B · Files | Landlock |
| C · Egress (before/after) | egress open → blocked |
| D · Guardrails (before/after) | guardrails off → NeMo on |

**Shortcuts:** `0` baseline · `a`/`b`/`c`/`d` jump to scenario (C/D open **before** variant) · nav A–D switches flow **in-panel** (no new tab) · `←`/`→` or clicker advances hops.

The **layer board** stays a fixed panel below the hop list; only the **dropdown** selects the scenario flow.

**Hop bands** on overall-map scenario flows: `1` user path · `2` security story · `3` inference · `4` MLflow trace (`oc → gw → mlflow`).

## Scenario diagrams (tests A–D)

| Test | Security (`test-*`) | Full flow (overall map) | Notes |
|------|---------------------|-------------------------|-------|
| A | [test-a-credentials.html](scenarios/test-a-credentials.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `a` | 12 hops aligned with overall map; layer board shows applicable layers only |
| B | [test-b-files.html](scenarios/test-b-files.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `b` | Landlock focus vs full stack |
| C | [test-c-egress.html](scenarios/test-c-egress.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `c` | Before/After in overall dropdown; test page has its own toggle |
| D | [test-d-guardrails.html](scenarios/test-d-guardrails.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `d` | Before/After in overall dropdown; test page has its own toggle |

- **`test-*`**: self-contained pages derived from `OVERALL_SCENARIO_*` in [`overall-flows.js`](scenarios/overall-flows.js) via `buildScenarioPageDiagram()` — same hop routing as the overall map, with layer board filtered to applicable layers. Tests A and B are implemented; C–D still use inline definitions until migrated.

Open from the overall architecture nav bar, scenario header nav, or launcher.

## Live companion flows

| Flow | URL | When |
|------|-----|------|
| v3 | [v3/live.html](v3/live.html) | **Recommended** — tab **Overall Demo** embeds the baseline stack map in-card (layers dock, legend; flow chosen via step nav); tabs **A–D** (C/D sub-steps before/after) mount in-card FlowStory canvas maps (`scenario-a` … `scenario-d-after`) plus baseline/change YAML panels; **MLflow** and **close** keep narrative + observability + script runner |
| v1 | [v1/live.html](v1/live.html) | Deprecated — split panel: narrative steps, matrix, diagram, YAML, cluster observability |
| v2 | [v2/live.html](v2/live.html) | Deprecated — compact variant; step 0 embeds FlowStory baseline map + **layout lab** (`?layout=`); superseded by v3 |

**v3 script runner** — run allowlisted demo scripts from the panel (no terminal switch). Requires `./scripts/demo-presenter-serve.sh` so the observability proxy is up on `127.0.0.1:8766`. Binds localhost only; actions are allowlisted in [`demo-observability-proxy.py`](../../scripts/demo-observability-proxy.py).

| Step | Action | Script |
|------|--------|--------|
| C-after | Change 1 — allow google.com | `./scripts/demo-allow-google-egress.sh` |
| D-after | Change 2 — enable NeMo | `./scripts/demo-enable-guardrails.sh` |

Proxy endpoints: `GET /api/demo/actions`, `POST /api/demo/run` with body `{"action":"<id>"}`. On success the observability panel refreshes automatically. Deprecated v1 panel still shows commands as text only.

**v2 layout lab** (deprecated; v3 uses full overall embed on step 0): dropdown on step 0 or `?layout=<id>`. IDs: `current`, `stack`, `unified`, `legend-footer`, `legend-inset`. Persists in `localStorage` (`v2-baseline-layout`).

Narrative (Spanish): [demo-narrative-v1.md](../demo-narrative-v1.md). Timed script (English): [demo-script.md](../demo-script.md).

## Design notes

Living analysis of what each scenario proves, gaps vs narrative, and live-demo viability: [demo-scenario-considerations.md](../demo-scenario-considerations.md).

## Cursor skills

| Page / phase | Skill |
|---|---|
| Serve panels | `demo-presenter-panel` |
| Live runbook (A–D) | `demo-present` |
| Change 1 / 2 / reset | `demo-allow-google-egress`, `demo-enable-guardrails`, `demo-reset` |

See [AGENTS.md](../AGENTS.md) § Demo v1 skills.

## Vendor

`shared/vendor/` is a snapshot of [FlowStory](https://github.com/noyitz/flowstory) (Apache 2.0). See [shared/vendor/NOTICE.txt](shared/vendor/NOTICE.txt).
