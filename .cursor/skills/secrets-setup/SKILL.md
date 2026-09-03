---
name: secrets-setup
description: >-
  Create and validate secrets/secrets.env from secrets.template.env for the
  AgentOps demo. Use when setting up the cluster, before deploy, when the user
  asks to configure secrets, credenciales, MAAS_API_KEY, or preflight fails
  on missing secrets.env.
---

# Secrets Setup

Bootstrap local credentials for deploy, OpenClaw launch, and Playwright tests.
**Never commit** `secrets/secrets.env` — it is gitignored.

**Template:** [`secrets/secrets.template.env`](../../secrets/secrets.template.env)

## When to use

| Trigger | Action |
|---|---|
| First cluster deploy | Copy template → fill required keys |
| `load_secrets` / preflight fails | Validate missing keys |
| User asks "configure secrets" / "credenciales" | Run this workflow |

## Workflow

```
Secrets setup:
- [ ] 1. Copy template to secrets.env (if missing)
- [ ] 2. Fill required keys
- [ ] 3. Validate with load_secrets (no values printed)
- [ ] 4. Confirm file is gitignored
```

### 1. Copy template

```bash
cp secrets/secrets.template.env secrets/secrets.env
chmod 600 secrets/secrets.env
```

### 2. Required keys

| Variable | Purpose |
|---|---|
| `MAAS_API_KEY` | MaaS inference (direct provider + NeMo upstream) |
| `OPENCLAW_GATEWAY_PASSWORD` | Control UI password (`gateway.auth.mode: password`) |
| `INFERENCE_MODEL` | Default `claude-sonnet-4-6` — must match MaaS catalog |
| `MAAS_BASE_URL` | OpenAI-compatible MaaS endpoint |
| `INFERENCE_BACKEND` | Use `direct` for demo v1 initial state |

Generate a gateway password:

```bash
openssl rand -base64 24
```

Optional (Playwright MLflow UI tests only):

| Variable | Purpose |
|---|---|
| `OCP_TEST_USERNAME` | OpenShift OAuth for MLflow UI |
| `OCP_TEST_PASSWORD` | OpenShift OAuth for MLflow UI |

### 3. Validate (no secret values in output)

```bash
source scripts/common.sh
load_secrets && load_inference_config
```

Expected: `[INFO] Secrets loaded from .../secrets/secrets.env` and inference config lines without key material.

### 4. Pre-commit gate

Before any commit touching env files, run the `no-secrets` skill.

## Expected result

- `secrets/secrets.env` exists locally with all required keys set
- `make -C deploy deploy-guardrails` and `launch-openclaw` succeed
- File is **not** tracked by git (`git status` must not show `secrets/secrets.env` as staged)

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MAAS_API_KEY not set` | Edit `secrets/secrets.env`; do not export in shell only |
| Model errors at runtime | Align `INFERENCE_MODEL` with MaaS catalog |
| Playwright MLflow tests skip OAuth | Set `OCP_TEST_USERNAME` / `OCP_TEST_PASSWORD` |

## Related skills

- Next: `demo-backstage-install` or `cluster-bootstrap`
- Scan before commit: `no-secrets`
- Narrative: [`docs/demo-narrative-v1.md`](../../docs/demo-narrative-v1.md)
