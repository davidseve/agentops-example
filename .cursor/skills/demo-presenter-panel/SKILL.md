---
name: demo-presenter-panel
description: >-
  Serve and open the v3 live companion (docs/demo/v3/live.html) for demo-narrative-v1.
  Use when starting the architecture walk-through, opening demo panels,
  pantalla partida, or docs/demo presentation UI.
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
cd docs && python3 -m http.server 8765
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
| Live companion (v3) | `http://127.0.0.1:8765/demo/v3/live.html` | **On stage** — step 0 embeds overall map; A–D in-card FlowStory + observability + script runner |
| Live companion (v4) | `http://127.0.0.1:8765/demo/v4/live.html` | Experimental compact canvas — not for live demos |
| Launcher | `http://127.0.0.1:8765/demo/index.html` | Offline rehearsal; links to v3, v4, and deprecated flows |

Deprecated (dev/bookmarks only): `overall-demo-architecture.html`, `scenarios/test-*.html`, `v1/live.html`, `v2/live.html`. See [`docs/demo/README.md`](../../docs/demo/README.md) § Deprecated.

## Cluster observability (v3)

When using `demo-presenter-serve.sh`, `v3/live.html` includes a **Cluster observability** panel below the step card (shared modules under `v1/`):

| Tab | Source |
|---|---|
| OpenClaw | `/sandbox/workspace/openclaw.log` via `openshell sandbox exec` |
| Sandbox (OCSF) | `/var/log/openshell.YYYY-MM-DD.log` via `openshell sandbox exec` |
| OpenShell Gateway | `oc logs openshell-0` |
| NeMo Guardrails | TrustyAI-managed pod (`nemo-guardrails-*`) |
| MLflow | Recent traces from experiment `openclaw-tracing` |

The panel polls `http://127.0.0.1:8766` and suggests a tab when you advance demo steps (A/B → OpenClaw, C → OpenShell, D → NeMo). Open the **MLflow** tab from the panel at any scenario step to review traces (no dedicated ML nav item in v3/v4). Per tab: **↓** pauses live updates (remembered per component).

## Split screen layout

| Window | Content |
|---|---|
| Primary | OpenClaw Control UI (`https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/`) |
| Secondary | `v3/live.html` — copy prompts; embedded FlowStory maps update on step nav |

## Embedded map controls (v3)

| Control | Action |
|---|---|
| Step nav | Overall Demo (step 0) + tests A–D (C/D before/after sub-steps) |
| `←` / `→` / clicker | Advance hops within the embedded FlowStory canvas |
| Layer board | Updates per step — egress closed/open, guardrails off/on |

## Layer board (v3 embedded maps)

`v3/live.html` step 0 and scenario tabs mount FlowStory maps that update layer state when advancing steps:

| After | Update |
|---|---|
| Test C (before) | Egress **closed** (default deny) |
| `demo-allow-google-egress` | Egress **open** (google.com allowlisted) |
| Test D (before) | Guardrails **off** (grey) |
| `demo-enable-guardrails` | Guardrails **on** (green) |

## Related skills

- Full runbook: `demo-present`
- Pre-stage: `demo-backstage-prep`
- Narrative: [`docs/demo-narrative-v1.md`](../../docs/demo-narrative-v1.md)
