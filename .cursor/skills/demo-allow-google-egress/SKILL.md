---
name: demo-allow-google-egress
description: >-
  Live demo Change 1: allowlist google.com egress for Test C after default deny.
  Use during demo-narrative-v1 phase 2, selective egress change,
  demo-allow-google-egress, or after curl to google.com is blocked on stage.
---

# Demo Allow Google Egress (Change 1)

Apply the selective sandbox policy live — [`config/openshell/google-egress.yaml`](../../config/openshell/google-egress.yaml).

**Script:** [`scripts/demo-allow-google-egress.sh`](../../scripts/demo-allow-google-egress.sh)

## When to use

- **After** Test C shows google.com **blocked** (default deny / `default.yaml`)
- **Before** repeating Test C (expect HTTP 200 to google.com; github.com still blocked)
- Phase 2 of `demo-present` runbook

## Run

```bash
./scripts/demo-allow-google-egress.sh
```

Requires `openshell` CLI with gateway selected (default alias `ocp`).

## Expected result

```
Google egress allowed — curl to google.com should succeed; github.com remains blocked
```

Repeat Test C prompt in Control UI — `curl -sI https://google.com` should succeed.

Update `v3/live.html` step nav → egress **open** (selective allowlist; auto-updates).

## Verify (optional, post-change)

```bash
make -C deploy validate-demo-google-egress
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Policy file not found | Run from repo root |
| Still blocked after script | Wait for `--wait`; check sandbox name (`SANDBOX_NAME`) |
| github.com also reachable | Wrong policy — should only allow google.com |
| Live failure on stage | Use pre-recorded fallback clip (see demo-script.md) |

## Related skills

- Reset to initial: `demo-reset`
- Full runbook: `demo-present`
- CI / backstage baseline: [`config/openshell/default.yaml`](../../config/openshell/default.yaml)
