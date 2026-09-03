---
name: guardrails-cluster-install
description: >-
  Deploy, validate, and remove NeMo Guardrails on OpenShift via the TrustyAI
  NemoGuardrails CR. Use when installing guardrails, deploy-guardrails,
  validate-guardrails, NeMo backstage setup, or TrustyAI guardrails on the
  cluster — not for live demo provider switch (use demo-enable-guardrails).
---

# Guardrails Cluster Install

Deploy NeMo Guardrails through the TrustyAI operator. For the **live demo v1** narrative, NeMo is deployed backstage but inference starts on **direct MaaS** until `./scripts/demo-enable-guardrails.sh`.

**Guide:** [`docs/nemo-guardrails-installation.md`](../../docs/nemo-guardrails-installation.md)

## Prerequisites

- RHOAI platform with `trustyai: Managed` (`make -C deploy deploy-all` or `cluster-bootstrap`)
- `secrets-setup` complete (`secrets/secrets.env`)
- `oc` and `helm` on PATH

## Deploy

```bash
make -C deploy deploy-guardrails
```

This waits for the `NemoGuardrails` CRD, installs `rhoai-guardrails`, and waits until `status.phase=Ready`.

Also runs as part of `make deploy-all` and `make deploy-agent`.

## Verify (infra)

```bash
make -C deploy validate-guardrails
```

Checks CR Ready, safe completion, jailbreak blocked (streaming + non-streaming).

## E2E (browser, guardrails path enabled in spec only)

```bash
make -C deploy test-guardrails
```

## Teardown

```bash
make -C deploy undeploy-guardrails
```

## Demo v1 notes

| Phase | Inference path |
|---|---|
| Backstage / minute 0 | `INFERENCE_BACKEND=direct` — NeMo deployed but not in live path |
| Live Change 2 | `demo-enable-guardrails` skill → `./scripts/demo-enable-guardrails.sh` |
| Reset rehearsal | `demo-reset` skill |

## Troubleshooting

| Symptom | Fix |
|---|---|
| CRD not found | `make -C deploy deploy-platform`; confirm TrustyAI Managed |
| CR not Ready | Check `MAAS_API_KEY`, `MAAS_BASE_URL`, `INFERENCE_MODEL` in secrets.env |
| Jailbreak Internal server error | Redeploy chart (streaming output rails); see installation guide |

## Related skills

- Live switch: `demo-enable-guardrails`, `demo-disable-guardrails`
- Full stack: `demo-backstage-install`
- ADR: [ADR-0004](../../docs/adr/0004-nemo-guardrails-via-trustyai.md)
