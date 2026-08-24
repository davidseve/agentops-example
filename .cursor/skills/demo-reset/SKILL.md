---
name: demo-reset
description: >-
  Reset the live demo to initial v1 state: direct MaaS inference and permissive
  demo-initial egress policy. Use between rehearsals, ensayo, reset demo, or
  before re-running tests A-D after a full presentation run.
---

# Demo Reset

Restore backstage initial state for [`demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md).

**Script:** [`scripts/demo-reset.sh`](../../scripts/demo-reset.sh)

## When to use

- Between rehearsal runs
- After completing full A–D presentation
- Before starting a fresh timed run

## Run

```bash
./scripts/demo-reset.sh
```

This calls:

1. `demo-disable-guardrails.sh` → direct MaaS
2. `openshell policy set` → [`policies/openclaw-demo-initial.yaml`](../../policies/openclaw-demo-initial.yaml)

## Required follow-up

**New session** in OpenClaw Control UI before re-running tests A–D.

The script reminds: `start New session in Control UI before re-running A–D`

## Expected result

| Setting | Value |
|---|---|
| Inference | `maas-direct` / `INFERENCE_MODEL` |
| Egress policy | Permissive (github.com reachable for Test C) |
| NeMo | Deployed but not in inference path |

Optional verify:

```bash
VERIFY_PROFILE=demo SKIP_E2E=1 ./scripts/verify.sh
```

## Related skills

- Full install: `demo-backstage-install`
- Present: `demo-present`
- Cambio 1 only undo | Re-run reset (no partial undo for egress alone)
