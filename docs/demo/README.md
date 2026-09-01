# Demo presentation UI

Interactive FlowStory panel for the AgentOps talk. Not slides.

## Launcher

```bash
# Preflight + static UI + local observability proxy (recommended for v1 live companion)
./scripts/demo-presenter-serve.sh
# http://127.0.0.1:8765/v1/live.html

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
├── overall-demo-architecture.html  # Phase 0 — full stack map (+ links to A–D)
├── scenarios/           # Focused FlowStory panels per test A–D
│   ├── shared-scenario.js
│   ├── overall-flows.js        # SCENARIO_* (test-*) + OVERALL_SCENARIO_* (overall dropdown)
│   ├── overall-response-maps.js  # Overall-map inference/trace response offsets
│   ├── test-a-credentials.html   # Security-focused
│   ├── test-b-files.html
│   ├── test-c-egress.html
│   └── test-d-guardrails.html
├── shared/              # vendor/, assets/, demo.css, logo-renderer.js
├── v1/                  # Split panel (recommended for rehearsal)
│   ├── live.html
│   ├── narrative.css
│   ├── narrative-data.js
│   ├── narrative-ui.js
│   ├── observability-panel.js
│   └── observability-log-rules.js
├── v2/                  # Compact panel (no sidebar; script runner)
│   ├── live.html
│   ├── narrative-v2.css
│   ├── narrative-v2-ui.js
│   ├── script-runner.js
│   ├── baseline-diagram.js
│   ├── baseline-embed.css
│   └── baseline-layout-variants.css
└── v3/live.html         # Stub — FlowStory narrative mode (future)
```

### v1 cluster observability

`v1/live.html` can show live cluster logs and MLflow traces when the local proxy is running:

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

Tail line limits are tuned in `LOG_LINES_BY_COMPONENT` in [`v1/observability-panel.js`](v1/observability-panel.js) (proxy accepts `?lines=1..500`, sandbox `?filter=all|signal`). Three-tier classification (signal/warn/noise), focus Filter (default ON), step-aware sandbox overrides (e.g. github.com green on C-pre only), and step hints: [`v1/observability-log-rules.js`](v1/observability-log-rules.js).

**Runbook:** [demo-scenario-logs.md](demo-scenario-logs.md) — what to search for in each component during Tests A–D; [§ Sandbox panel highlight rules](demo-scenario-logs.md#sandbox-panel-highlight-rules) documents green/amber/gray tiers and step-aware overrides.

**Panel controls (per tab):**
- **Clear** — snapshot current tail; show only new lines/traces after click (toggle off to restore full log). Does not modify cluster logs.
- **Filter** — focus mode: show signal (green) and warn (amber) only (default ON); disable to see full log in gray
- **↓** — pause/resume live updates (each tab remembers its own state)

Proxy implementation: [`scripts/demo-observability-proxy.py`](../../scripts/demo-observability-proxy.py). Requires `oc` and `openshell` on the presenter laptop; binds to `127.0.0.1` only. v2 script runner uses `POST /api/demo/run` (allowlisted actions only).

## Phase 0 — Overall demo architecture

- [overall-demo-architecture.html](overall-demo-architecture.html) — full stack map with **7 flows** in the panel dropdown:

| Flow | Layer board highlight |
|------|----------------------|
| Baseline · demo initial | egress open, guardrails **off** |
| A · Credentials | gateway key vault |
| B · Files | Landlock |
| C · Egress (before/after) | egress open → blocked |
| D · Guardrails (before/after) | guardrails off → NeMo on |

**Shortcuts:** `0` baseline · `a`/`b`/`c`/`d` jump to scenario (C/D open **before** variant) · nav A–D switches flow **in-panel** (no new tab) · `←`/`→` or clicker advances hops.

The **layer board** stays a fixed panel below the hop list; only the **dropdown** selects the scenario flow.

**Hop bands** on overall-map scenario flows (not on deep-link pages): `1` user path · `2` security story · `3` inference · `4` MLflow trace (`oc → mlflow` direct).

## Scenario diagrams (tests A–D)

| Test | Security (`test-*`) | Full flow (overall map) | Notes |
|------|---------------------|-------------------------|-------|
| A | [test-a-credentials.html](scenarios/test-a-credentials.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `a` | ~8 hops vs ~11 (inference + MLflow trace) |
| B | [test-b-files.html](scenarios/test-b-files.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `b` | Landlock focus vs full stack |
| C | [test-c-egress.html](scenarios/test-c-egress.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `c` | Before/After in overall dropdown; test page has its own toggle |
| D | [test-d-guardrails.html](scenarios/test-d-guardrails.html) | [overall-demo-architecture.html](overall-demo-architecture.html) — shortcut `d` | Before/After in overall dropdown; test page has its own toggle |

- **`test-*`**: self-contained pages — security story only (~6–8 hops).
- **Overall map**: single source of truth for full flows (`OVERALL_SCENARIO_*` in [`overall-flows.js`](scenarios/overall-flows.js)) — security + inference + MLflow trace.

Open from the overall architecture nav bar, scenario header nav, or launcher.

## Live companion flows

| Flow | URL | When |
|------|-----|------|
| v1 | [v1/live.html](v1/live.html) | Recommended — narrative steps, matrix, diagram, YAML, cluster observability |
| v2 | [v2/live.html](v2/live.html) | Compact variant — no sidebar; step 0 embeds FlowStory baseline map + **layout lab** (`?layout=`); **Run against cluster** buttons on Cambio 1/2 (C-post, D-post); full-width narrative + observability on steps A–MLflow |

**v2 script runner** — run allowlisted demo scripts from the panel (no terminal switch). Requires `./scripts/demo-presenter-serve.sh` so the observability proxy is up on `127.0.0.1:8766`. Binds localhost only; actions are allowlisted in [`demo-observability-proxy.py`](../../scripts/demo-observability-proxy.py).

| Step | Action | Script |
|------|--------|--------|
| C-post | Cambio 1 — allow google.com | `./scripts/demo-allow-google-egress.sh` |
| D-post | Cambio 2 — enable NeMo | `./scripts/demo-enable-guardrails.sh` |

Proxy endpoints: `GET /api/demo/actions`, `POST /api/demo/run` with body `{"action":"<id>"}`. On success the observability panel refreshes automatically. v1 panel still shows commands as text only.

**v2 step 0 layout lab** (compare variants live): dropdown on step 0 or `?layout=<id>`. IDs: `current`, `stack`, `unified`, `legend-footer`, `legend-inset`. Persists in `localStorage` (`v2-baseline-layout`).
| v3 | [v3/live.html](v3/live.html) | Coming soon (FlowStory narrative) |

Narrative (Spanish): [demo-narrativa-v1.md](../demo-narrativa-v1.md). Timed script (English): [demo-script.md](../demo-script.md).

## Design notes

Living analysis of what each scenario proves, gaps vs narrative, and live-demo viability: [demo-scenario-considerations.md](../demo-scenario-considerations.md).

## Cursor skills

| Page / phase | Skill |
|---|---|
| Serve panels | `demo-presenter-panel` |
| Live runbook (A–D) | `demo-present` |
| Cambio 1 / 2 / reset | `demo-allow-google-egress`, `demo-enable-guardrails`, `demo-reset` |

See [AGENTS.md](../AGENTS.md) § Demo v1 skills.

## Vendor

`shared/vendor/` is a snapshot of [FlowStory](https://github.com/noyitz/flowstory) (Apache 2.0). See [shared/vendor/NOTICE.txt](shared/vendor/NOTICE.txt).
