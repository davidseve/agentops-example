---
name: demo-reset
description: >-
  Reset the live demo to initial v1 state: direct MaaS inference and MLflow-only
  egress policy (default.yaml). Use between rehearsals, ensayo, reset demo, or
  before re-running tests A-D after a full presentation run.
---

# Demo Reset

Restore backstage initial state for [`demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md).

**Script:** [`scripts/demo-reset.sh`](../../scripts/demo-reset.sh)

## When to use

- Between rehearsal runs
- After completing full A–D presentation
- Before starting a fresh timed run
- Before Scenario C (confirms default deny egress)

## Run

```bash
./scripts/demo-reset.sh
```

This calls:

1. `demo-disable-guardrails.sh` → direct MaaS
2. `openshell policy set` → [`config/openshell/default.yaml`](../../config/openshell/default.yaml)

## Required follow-up

**New session** in OpenClaw Control UI before re-running tests A–D.

The script reminds: `start New session in Control UI before Scenario C`

## Expected result

| Setting | Value |
|---|---|
| Inference | `maas-direct` / `INFERENCE_MODEL` |
| Egress policy | MLflow only (`default.yaml`); google.com and github.com blocked |
| NeMo | Deployed but not in inference path |

Optional verify:

```bash
VERIFY_PROFILE=demo SKIP_E2E=1 ./scripts/verify.sh
```

## Related skills

- Full install: `demo-backstage-install`
- Present: `demo-present`
- Change 1 only | Run `demo-allow-google-egress` (no partial undo for egress alone except reset)
