---
name: demo-verify
description: >-
  Validate the demo v1 backstage initial state: platform, NeMo Ready, OpenClaw
  on default.yaml (MLflow-only egress) and direct MaaS. Use after
  demo-backstage-install, VERIFY_PROFILE=demo, or before going on stage —
  not for CI hardened policy checks alone.
---

# Demo Verify

Validate deployment matches [`demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md) **initial state** (before live Change 1 and 2).

**Do not** use `VERIFY_PROFILE=full` alone for demo backstage prep — it runs the full E2E suite with hardened egress expectations.

## Run

```bash
VERIFY_PROFILE=demo ./scripts/verify.sh
```

Or:

```bash
./scripts/verify.sh --demo
```

Skip MLflow trace check (infra only):

```bash
VERIFY_PROFILE=demo SKIP_E2E=1 ./scripts/verify.sh
```

## What the demo profile checks

| Layer | Target | Pass criteria |
|---|---|---|
| 1 | RHOAI platform | `make validate` |
| 1 | NeMo Guardrails | `make validate-guardrails` (infra Ready) |
| 2 | OpenShell | `make validate-openshell` |
| 3 | OpenClaw + MaaS | `make validate-openclaw` |
| 4 | Demo initial policy | `make validate-demo-initial` — **google.com and github.com blocked** |
| 5 | Demo narrative E2E | `make test-demo` — Tests A–D + Change 1/2 (unless `SKIP_E2E=1`) |
| 6 | MLflow traces | `make validate-traces` (unless `SKIP_E2E=1`) |

**Skipped in demo profile:** `sandbox-security.spec.ts` (expects hardened egress after Change 1).

## Automated rehearsal (full narrative)

```bash
make -C deploy test-demo
```

Runs [`tests/demo-narrative.spec.ts`](../../tests/demo-narrative.spec.ts): resets to demo-initial, walks Tests A–D in one Control UI session, applies Change 1/2 via shell scripts, then resets backstage. Included in `VERIFY_PROFILE=demo ./scripts/verify.sh` (layer 5).

## CI vs demo profiles

| Profile | google.com (initial) | Playwright |
|---|---|---|
| `full` | Must be blocked | Full suite (`test-e2e`) |
| `demo` | Must be blocked at backstage | `test-demo` + `validate-traces` |
| `smoke` | OpenShell infra only | Skipped |

Post–Change 1 validation: `make -C deploy validate-demo-google-egress` (google allowed, github blocked).

## Troubleshooting

| Fail | Fix |
|---|---|
| `validate-demo-initial` | Re-run `./scripts/demo-reset.sh` or re-launch with `POLICY_FILE=config/openshell/default.yaml` |
| `validate-guardrails` | `guardrails-cluster-install` |
| `validate-openclaw` | `launch-openclaw` with demo env vars |
| Still on guardrailed path | `./scripts/demo-disable-guardrails.sh` |
| MLflow experiment / trace export | `./scripts/ensure-mlflow-experiment.sh` then re-launch OpenClaw |

## Related skills

- Install: `demo-backstage-install`
- Pre-stage: `demo-backstage-prep`
- CI verify: `./scripts/cluster-lifecycle.sh verify` (full profile)
