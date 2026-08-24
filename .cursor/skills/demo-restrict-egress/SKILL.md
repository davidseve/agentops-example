---
name: demo-restrict-egress
description: >-
  Live demo Cambio 1: apply hardened sandbox network policy to block unauthorized
  egress (Test C after). Use during demo-narrativa-v1 phase 2, cerrar egress,
  demo-restrict-egress, or after curl to github succeeds on stage.
---

# Demo Restrict Egress (Cambio 1)

Apply the final sandbox policy live — [`policies/openclaw-sandbox.yaml`](../../policies/openclaw-sandbox.yaml).

**Script:** [`scripts/demo-restrict-egress.sh`](../../scripts/demo-restrict-egress.sh)

## When to use

- **After** Test C shows github.com **succeeds** (demo-initial policy)
- **Before** repeating Test C (expect block)
- Phase 2 of `demo-present` runbook

## Run

```bash
./scripts/demo-restrict-egress.sh
```

Requires `openshell` CLI with gateway selected (default alias `ocp`).

## Expected result

```
Egress restricted — unauthorized curl (e.g. github.com) should now be blocked
```

Repeat Test C prompt in Control UI — curl should fail / network denied.

Update `live.html` layer board → egress **closed**.

## Verify (optional, post-change)

```bash
make -C deploy validate-security
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Policy file not found | Run from repo root |
| Still reachable after script | Wait for `--wait`; check sandbox name (`SANDBOX_NAME`) |
| Live failure on stage | Use pre-recorded fallback clip (see demo-script.md) |

## Related skills

- Reset to initial: `demo-reset`
- Full runbook: `demo-present`
- CI policy reference: [`policies/openclaw-sandbox.yaml`](../../policies/openclaw-sandbox.yaml)
