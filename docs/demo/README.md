# Demo presentation UI

Interactive FlowStory panel for the AgentOps talk. Not slides.

## Launcher

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
│   └── narrative-ui.js
├── v2/live.html         # Stub — unified panel (future)
└── v3/live.html         # Stub — FlowStory narrative mode (future)
```

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
| v1 | [v1/live.html](v1/live.html) | Recommended — narrative steps, matrix, diagram, YAML |
| v2 | [v2/live.html](v2/live.html) | Coming soon (unified panel) |
| v3 | [v3/live.html](v3/live.html) | Coming soon (FlowStory narrative) |

Narrative (Spanish): [demo-narrativa-v1.md](../demo-narrativa-v1.md). Timed script (English): [demo-script.md](../demo-script.md).

## Design notes

Living analysis of what each scenario proves, gaps vs narrative, and live-demo viability: [demo-scenario-considerations.md](../demo-scenario-considerations.md).

## Cursor skills

| Page / phase | Skill |
|---|---|
| Serve panels | `demo-presenter-panel` |
| Live runbook (A–D) | `demo-present` |
| Cambio 1 / 2 / reset | `demo-restrict-egress`, `demo-enable-guardrails`, `demo-reset` |

See [AGENTS.md](../AGENTS.md) § Demo v1 skills.

## Vendor

`shared/vendor/` is a snapshot of [FlowStory](https://github.com/noyitz/flowstory) (Apache 2.0). See [shared/vendor/NOTICE.txt](shared/vendor/NOTICE.txt).
