---
name: demo-verify
description: >-
  Validate the demo v1 backstage initial state: platform, NeMo Ready, OpenClaw
  on demo-initial policy with permissive egress and direct MaaS. Use after
  demo-backstage-install, VERIFY_PROFILE=demo, or verificar demo antes de
  presentar — not for CI hardened policy checks.
---

# Demo Verify

Validate deployment matches [`demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md) **initial state** (before live Cambio 1 and 2).

**Do not** use `VERIFY_PROFILE=full` for demo backstage — it expects github.com **blocked**.

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
| 4 | Demo initial policy | `make validate-demo-initial` — **github.com reachable** |
| 5 | MLflow traces | `make validate-traces` (unless `SKIP_E2E=1`) |

**Skipped:** Playwright E2E (`sandbox-security.spec.ts` expects hardened egress).

## CI vs demo profiles

| Profile | github.com | Playwright |
|---|---|---|
| `full` | Must be blocked | Full suite |
| `demo` | Must be reachable | Skipped |
| `smoke` | OpenShell infra only | Skipped |

## Troubleshooting

| Fail | Fix |
|---|---|
| `validate-demo-initial` | Re-launch with `POLICY_FILE=policies/openclaw-demo-initial.yaml` |
| `validate-guardrails` | `guardrails-cluster-install` |
| `validate-openclaw` | `launch-openclaw` with demo env vars |
| Still on guardrailed path | `./scripts/demo-disable-guardrails.sh` |

## Related skills

- Install: `demo-backstage-install`
- Pre-stage: `demo-backstage-prep`
- CI verify: `./scripts/cluster-lifecycle.sh verify` (full profile)
