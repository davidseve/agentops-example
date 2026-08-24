---
name: mlflow-tracing-validate
description: >-
  Validate and present MLflow traces from the OpenClaw demo session: validate-
  traces, test-mlflow, GenAI Studio. Use during demo-narrativa-v1 phase 4,
  show MLflow traces, observability block, or verify mlflow-openclaw plugin.
---

# MLflow Tracing Validate

Show that **every** demo attempt (success and failure) is traced via the `mlflow-openclaw` plugin ([ADR-0010](../../docs/adr/0010-mlflow-tracing-otel.md)).

## When to use

- Phase 4 of `demo-present` (~1–2 min)
- After tests A–D in the same Control UI session
- Backstage verify (optional): `VERIFY_PROFILE=demo` includes `validate-traces`

## Infra check (CLI)

```bash
make -C deploy validate-traces
```

Requires a recent chat in the same session (traces emitted by running gateway).

## Browser check (Playwright)

```bash
make -C deploy test-mlflow
```

Requires Playwright deps and `OCP_TEST_USERNAME` / `OCP_TEST_PASSWORD` for MLflow UI OAuth.

## Live presentation (GenAI Studio)

1. Open RHOAI Dashboard → Gen AI Studio → MLflow traces
2. Select experiment **`openclaw-tracing`** (workspace from sandbox SA token wiring)
3. Find trace for the **same chat session** used in Control UI

**Show in one trace timeline:**

| Attempt | What audience saw |
|---|---|
| Test A | Key exfiltration probe — no key exposed |
| Test B | `/etc/shadow` blocked |
| Test C (before) | curl to github succeeded |
| Test C (after) | curl blocked |
| Test D (before) | Jailbreak may succeed |
| Test D (after) | Jailbreak blocked by NeMo |

**Say:** MLflow is not an add-on — observability from the first token.

## Timing options (narrative v1)

| Option | When |
|---|---|
| A | Quick peek after A/B and again at phase 4 |
| B (default if tight) | Single block at phase 4 only |

## Troubleshooting

| Symptom | Fix |
|---|---|
| No traces found | Confirm gateway running; plugin experiment ID matches workspace |
| Empty Request/Response | Must use `mlflow-openclaw` plugin, not diagnostics-otel (ADR-0010) |
| Playwright OAuth fails | Set `OCP_TEST_*` in secrets.env |

## Related skills

- Launch (tracing wired): `launch-openclaw`
- Full runbook: `demo-present`
- Verify: `demo-verify`
