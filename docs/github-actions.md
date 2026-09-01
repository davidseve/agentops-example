# GitHub Actions

Pull-request CI runs **static checks and unit tests** on GitHub-hosted runners — no OpenShift cluster or secrets required.

Cluster Playwright E2E will be added in a follow-up workflow.

## Workflow

| Workflow | File | Trigger | Cluster |
|----------|------|---------|---------|
| **CI** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Every PR and push to `main` | Not required |

### CI (automatic)

Runs on `ubuntu-latest`:

1. Secret-pattern scan on tracked files (`scripts/ci-secret-scan.sh`; complements the `no-secrets` skill)
2. `./scripts/validate-demo-ui.sh` — external CSS lint + demo unit tests (log rules, scenario consistency, ui-helpers; no cluster)
3. `make -C deploy lint template` — Helm chart lint and render

Local equivalent:

```bash
cd tests && npm ci
./scripts/validate-demo-ui.sh
make -C deploy lint template
```

## Branch protection

Recommended required check for `main`: **CI / Static checks + unit tests**.

## Related

- Demo UI validation: [`scripts/validate-demo-ui.sh`](../scripts/validate-demo-ui.sh)
- Unit test sources: [`tests/observability-log-rules.spec.ts`](../tests/observability-log-rules.spec.ts), [`tests/demo-scenario-consistency.spec.ts`](../tests/demo-scenario-consistency.spec.ts), [`tests/ui-helpers.unit.spec.ts`](../tests/ui-helpers.unit.spec.ts)
- Local E2E (cluster): `make -C deploy test-e2e` — not wired to GitHub Actions yet
- Full verify profiles: [`scripts/verify.sh`](../scripts/verify.sh)
