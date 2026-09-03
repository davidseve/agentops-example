---
name: demo-presenter-panel
description: >-
  Serve and open the FlowStory demo panels (overall-demo-architecture.html + v3 live companion)
  for demo-narrative-v1. Use when starting the architecture walk-through,
  opening demo panels, pantalla partida, or docs/demo presentation UI.
---

# Demo Presenter Panel

Interactive FlowStory panels — not slides. See [`docs/demo/README.md`](../../docs/demo/README.md).

## Start servers

From repo root (recommended — preflight + static UI + cluster observability proxy):

```bash
./scripts/demo-presenter-serve.sh
```

Preflight only (cluster + ports, no servers started):

```bash
./scripts/demo-presenter-serve.sh --check-only
```

The script checks `oc` login, `openshell`, sandbox pod (`openclaw-gw`), gateway pod (`openshell-0`), and that ports `8765`/`8766` are free before binding. If a port is in use:

```bash
lsof -ti :8765 | xargs kill   # or :8766
```

Static UI only (no live logs/traces panel; skips cluster preflight):

```bash
cd docs/demo && python3 -m http.server 8765
```

Observability proxy only:

```bash
python3 scripts/demo-observability-proxy.py
# http://127.0.0.1:8766/api/health
```

Requires logged-in `oc` and `openshell` on the presenter's workstation. The proxy binds to `127.0.0.1` only.

## URLs

| Page | URL | When |
|---|---|---|
| Launcher | `http://127.0.0.1:8765/index.html` | Pick flow v1–v3 (v3 recommended) |
| Overall demo architecture | `http://127.0.0.1:8765/overall-demo-architecture.html` | Phase 0 + full flows A–D (security + inference + MLflow) |
| Scenario A (credentials) | `http://127.0.0.1:8765/scenarios/test-a-credentials.html` | Test A — security only (~8 hops) |
| Scenario B (files) | `http://127.0.0.1:8765/scenarios/test-b-files.html` | Test B — Landlock / `/etc/shadow` |
| Scenario C (egress) | `http://127.0.0.1:8765/scenarios/test-c-egress.html` | Test C — Before/After Change 1 (`1`/`2` or `b`/`a`) |
| Scenario D (guardrails) | `http://127.0.0.1:8765/scenarios/test-d-guardrails.html` | Test D — Before/After Change 2 |
| Live companion (v3) | `http://127.0.0.1:8765/v3/live.html` | **Recommended** — step 0 embeds overall map; A–D in-card FlowStory + observability + script runner |
| Live companion (v1) | `http://127.0.0.1:8765/v1/live.html` | Deprecated — split panel |
| Live companion (v2) | `http://127.0.0.1:8765/v2/live.html` | Deprecated — compact panel (superseded by v3) |

## Cluster observability (v3)

When using `demo-presenter-serve.sh`, `v3/live.html` includes a **Cluster observability** panel below the step card (shared implementation with deprecated v1):

| Tab | Source |
|---|---|
| OpenClaw | `/sandbox/workspace/openclaw.log` via `openshell sandbox exec` |
| Sandbox (OCSF) | `/var/log/openshell.YYYY-MM-DD.log` via `openshell sandbox exec` |
| OpenShell Gateway | `oc logs openshell-0` |
| NeMo Guardrails | TrustyAI-managed pod (`nemo-guardrails-*`) |
| MLflow | Recent traces from experiment `openclaw-tracing` |

The panel polls `http://127.0.0.1:8766` and suggests a tab when you advance demo steps (A/B → OpenClaw, C → OpenShell, D → NeMo, MLflow step → MLflow). Per tab: **↓** pauses live updates (remembered per component).

## Split screen layout

| Window | Content |
|---|---|
| Primary | OpenClaw Control UI (`https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/`) |
| Secondary | `v3/live.html` — copy prompts; embedded FlowStory maps update on step nav |

Optional third monitor: `overall-demo-architecture.html` for Phase 0 only (v3 step 0 embeds this in-panel). Use `test-*` for security-only rehearsal.

Deprecated split-screen companions: `v1/live.html`, `v2/live.html`.

## Overall map controls

| Control | Action |
|---|---|
| Dropdown (top of panel) | Select among 7 flows (baseline + A–D before/after) |
| Nav A–D | Jump to scenario flow in-panel |
| `0` / `a` / `b` / `c` / `d` | Keyboard shortcuts to flows |
| `←` / `→` / clicker | Advance hops within active flow |
| Layer board (fixed panel) | Updates per flow — not a dropdown |

## Layer board (v3 embedded maps)

`v3/live.html` step 0 and scenario tabs mount FlowStory maps that update layer state when advancing steps:

| After | Update |
|---|---|
| Test C (before) | Egress **closed** (default deny) |
| `demo-allow-google-egress` | Egress **open** (google.com allowlisted) |
| Test D (before) | Guardrails **off** (grey) |
| `demo-enable-guardrails` | Guardrails **on** (green) |

Deprecated `v1/live.html` had a fixed sidebar layer board with the same state transitions.

## Related skills

- Full runbook: `demo-present`
- Pre-stage: `demo-backstage-prep`
- Narrative: [`docs/demo-narrative-v1.md`](../../docs/demo-narrative-v1.md)
