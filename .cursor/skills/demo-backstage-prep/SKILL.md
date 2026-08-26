---
name: demo-backstage-prep
description: >-
  Pre-stage checklist before going live with demo-narrativa-v1: confirm direct
  MaaS, open presenter panels, Control UI URL. Use before the demo, pre-escena,
  ensayo final, or "before you go on stage".
---

# Demo Backstage Prep

Final checks after `demo-backstage-install`, before opening to the audience.

**Script companion:** [`docs/demo-script.md`](../../docs/demo-script.md) § Before you go on stage

## Checklist

```
Pre-stage prep:
- [ ] 1. Confirm direct MaaS (no NeMo in path)
- [ ] 2. Confirm demo-initial egress (github reachable)
- [ ] 3. Start presenter HTTP server
- [ ] 4. Open Control UI + panels (split screen)
- [ ] 5. Optional rehearsal reset
```

### 1. Confirm direct MaaS

```bash
./scripts/demo-disable-guardrails.sh
```

Expected: `Inference route: maas-direct / <model> (direct MaaS)`

### 2. Confirm demo-initial policy

```bash
make -C deploy validate-demo-initial
```

Expected: `github.com reachable for demo Test C`

If sandbox was created with hardened policy, re-launch:

```bash
POLICY_FILE=policies/openclaw-demo-initial.yaml INFERENCE_BACKEND=direct make -C deploy launch-openclaw
```

### 3. Start presenter panels

Use `demo-presenter-panel` skill or:

```bash
cd docs/demo && python3 -m http.server 8765
```

- Overall demo architecture: `http://127.0.0.1:8765/overall-demo-architecture.html`
- Live companion (v1): `http://127.0.0.1:8765/v1/live.html`
- Launcher: `http://127.0.0.1:8765/index.html`

### 4. Open Control UI

```
https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/
```

Split screen: Control UI + `v1/live.html`.

### 5. Optional rehearsal reset

```bash
./scripts/demo-reset.sh
```

Then **New session** in Control UI before running tests A–D.

## Expected result

- Three browser targets ready: `overall-demo-architecture.html` (optional phase 0 recap), `v1/live.html`, Control UI
- Sandbox on demo-initial policy with direct MaaS
- No live config changes needed until Test C (egress) and Test D (NeMo)

## Related skills

- Install: `demo-backstage-install`
- Present: `demo-present`
- Verify: `demo-verify`
