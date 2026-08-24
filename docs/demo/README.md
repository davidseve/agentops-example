# Demo presentation UI

Interactive FlowStory panel for the AgentOps talk. Not slides.

## Page 1 — Intro (this pass)

Two variants of the same hop map:

- [layers.html](layers.html) — text boxes (default)
- [layers-logos.html](layers-logos.html) — same hops with product marks (OpenClaw, OpenShell, OpenShift AI, NVIDIA, Landlock, MLflow, Internet)

```bash
cd docs/demo
python3 -m http.server 8765
# http://127.0.0.1:8765/layers.html
# http://127.0.0.1:8765/layers-logos.html
```

Marks are vendored under [assets/icons/](assets/icons/); sources in [assets/icons/NOTICE.txt](assets/icons/NOTICE.txt). FlowStory has no node-logo field, so [logo-renderer.js](logo-renderer.js) paints them on the canvas.

## Cursor skills

| Page / phase | Skill |
|---|---|
| Serve panels | `demo-presenter-panel` |
| Live runbook (A–D) | `demo-present` |
| Cambio 1 / 2 / reset | `demo-restrict-egress`, `demo-enable-guardrails`, `demo-reset` |

See [AGENTS.md](../AGENTS.md) § Demo v1 skills and [demo-script.md](../demo-script.md).


Advance **one hop at a time** with a presentation clicker (Page Down / right) or **← →**. Prev is Page Up / left. **Start** still auto-plays the whole flow; **Reset** (or Home) clears the map.

Hops in order:

1. Usuario → **OpenShell Gateway** → OpenClaw (Usuario sits outside OpenShift, aligned with the gateway)
2. OpenClaw → `inference.local` → **OpenShell Gateway** (both inside **OpenShell**, outside the Agent Sandbox) → NeMo → MaaS → LLM
3. Response walks back through the Gateway to OpenClaw — the model told the agent to read a file
4. OpenClaw ↔ Landlock (round trip — files locked)
5. OpenClaw → Gateway → Internet (egress and back — Usuario and Internet sit outside OpenShift)
6. OpenClaw → Usuario
7. OpenClaw → Gateway → MLflow (traces; MLflow sits under the Gateway, outside OpenShell). NeMo / MaaS / LLM sit under `inference.local`, outside OpenShell.

Garak and EvalHub are out of this diagram. A later variant may use Garak as the user UI.

Loop stays off. Click a box for product / owner details.

## Page 2 — Live companion

[live.html](live.html) — Tests A–D with copy-paste prompts, security layer board, and demo script commands. Split screen with the OpenClaw Control UI.

```bash
cd docs/demo
python3 -m http.server 8765
# http://127.0.0.1:8765/live.html
```

Narrative (Spanish): [demo-narrativa-v1.md](../demo-narrativa-v1.md). Timed script (English): [demo-script.md](../demo-script.md).

## Vendor

`vendor/` is a snapshot of [FlowStory](https://github.com/noyitz/flowstory) (Apache 2.0). See [vendor/NOTICE.txt](vendor/NOTICE.txt).
