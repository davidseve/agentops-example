---
name: demo-presenter-panel
description: >-
  Serve and open the FlowStory demo panels (overall-demo-architecture.html + v1 live companion)
  for demo-narrativa-v1. Use when starting the architecture walk-through,
  opening demo panels, pantalla partida, or docs/demo presentation UI.
---

# Demo Presenter Panel

Interactive FlowStory panels — not slides. See [`docs/demo/README.md`](../../docs/demo/README.md).

## Start HTTP server

From repo root:

```bash
cd docs/demo && python3 -m http.server 8765
```

## URLs

| Page | URL | When |
|---|---|---|
| Launcher | `http://127.0.0.1:8765/index.html` | Pick flow v1–v3 |
| Overall demo architecture | `http://127.0.0.1:8765/overall-demo-architecture.html` | Phase 0 + full flows A–D (security + inference + MLflow) |
| Scenario A (credentials) | `http://127.0.0.1:8765/scenarios/test-a-credentials.html` | Test A — security only (~8 hops) |
| Scenario B (files) | `http://127.0.0.1:8765/scenarios/test-b-files.html` | Test B — Landlock / `/etc/shadow` |
| Scenario C (egress) | `http://127.0.0.1:8765/scenarios/test-c-egress.html` | Test C — Before/After Cambio 1 (`1`/`2` or `b`/`a`) |
| Scenario D (guardrails) | `http://127.0.0.1:8765/scenarios/test-d-guardrails.html` | Test D — Before/After Cambio 2 |
| Live companion (v1) | `http://127.0.0.1:8765/v1/live.html` | Recommended — phases 1–5 |

## Split screen layout

| Window | Content |
|---|---|
| Primary | OpenClaw Control UI (`https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/`) |
| Secondary | `v1/live.html` — copy prompts; layer board updates on step nav |

Optional third monitor: `overall-demo-architecture.html` for Phase 0 and full flows (dropdown / nav A–D / shortcuts `0`/`a`–`d`). Use `test-*` for security-only rehearsal.

## Overall map controls

| Control | Action |
|---|---|
| Dropdown (top of panel) | Select among 7 flows (baseline + A–D before/after) |
| Nav A–D | Jump to scenario flow in-panel |
| `0` / `a` / `b` / `c` / `d` | Keyboard shortcuts to flows |
| `←` / `→` / clicker | Advance hops within active flow |
| Layer board (fixed panel) | Updates per flow — not a dropdown |

## Layer board (v1)

`v1/live.html` updates automatically when advancing steps:

| After | Update |
|---|---|
| Test C (before) | Egress **open** (risk visible) |
| `demo-restrict-egress` | Egress **closed** |
| Test D (before) | Guardrails **off** (grey) |
| `demo-enable-guardrails` | Guardrails **on** (green) |

## Related skills

- Full runbook: `demo-present`
- Pre-stage: `demo-backstage-prep`
- Narrative: [`docs/demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md)
