---
name: demo-presenter-panel
description: >-
  Serve and open the FlowStory demo panels (layers.html intro and live.html
  companion) for demo-narrativa-v1. Use when starting the architecture walk-
  through, opening demo panels, pantalla partida, or docs/demo presentation UI.
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
| Architecture intro | `http://127.0.0.1:8765/layers.html` | Phase 0 — walk through hops |
| Logos variant | `http://127.0.0.1:8765/layers-logos.html` | Optional — product marks |
| Live companion | `http://127.0.0.1:8765/live.html` | Phases 1–4 — prompts A–D + layer board |

## Split screen layout

| Window | Content |
|---|---|
| Primary | OpenClaw Control UI (`https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/`) |
| Secondary | `live.html` — copy prompts, update layer states after Cambio 1 and 2 |

Optional third monitor: `layers.html` for Phase 0 only.

## Layer board updates (live.html)

After each live change, mark on the companion panel:

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
