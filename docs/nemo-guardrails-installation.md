# NeMo Guardrails Installation

Deploy NeMo Guardrails on OpenShift via the TrustyAI `NemoGuardrails` CR ([ADR-0004](adr/0004-nemo-guardrails-via-trustyai.md)). OpenClaw continues calling `inference.local`; the OpenShell privacy router forwards to NeMo (when enabled), which applies input/output rails before calling MaaS.

## Architecture

```
OpenClaw → inference.local → [maas-direct | maas-guardrailed] → MaaS
                                    └─ guardrailed → NeMo Guardrails → MaaS
```

For the live demo narrative, inference starts on **direct MaaS** (`INFERENCE_BACKEND=direct`). NeMo is deployed in backstage; the presenter runs `./scripts/demo-enable-guardrails.sh` for Cambio 2 (jailbreak blocked by self-check rails).

## Prerequisites

- RHOAI platform deployed with `trustyai: Managed` (`make -C deploy deploy-all`)
- `secrets/secrets.env` copied from [`secrets/secrets.template.env`](../secrets/secrets.template.env)
- Required keys: `MAAS_API_KEY`, `OPENCLAW_GATEWAY_PASSWORD`, `INFERENCE_MODEL`, `MAAS_BASE_URL`

All inference-related variables are read from `secrets/secrets.env` via `scripts/common.sh` → `load_inference_config()`.

| Variable | Default | Purpose |
|---|---|---|
| `INFERENCE_MODEL` | `claude-sonnet-4-6` | OpenShell inference route + NeMo `model_name` |
| `MAAS_BASE_URL` | MaaS workshops URL | Direct provider + NeMo upstream `openai_api_base` |
| `INFERENCE_BACKEND` | `direct` | Active provider at launch (`direct` or `guardrailed`) |
| `NEMO_GUARDRAILS_SERVICE` | `nemo-guardrails` | CR / Service name |
| `NEMO_GUARDRAILS_NAMESPACE` | `openshell` | Namespace for NeMo CR |
| `NEMO_GUARDRAILS_PORT` | `80` | Kubernetes Service port (maps to container 8000) |

## Deploy

From the repo root (requires logged-in `oc` and `helm`):

```bash
make -C deploy deploy-guardrails
```

This:

1. Waits for `nemoguardrails.trustyai.opendatahub.io` CRD
2. Installs `rhoai-guardrails` with values from `secrets/secrets.env`
3. Waits until the CR `status.phase` is `Ready`

`deploy-guardrails` is also invoked by `make -C deploy deploy-all` and `deploy-agent`.

## Verify

Infra smoke (cluster-side, includes streaming jailbreak curl):

```bash
make -C deploy validate-guardrails
```

Checks CR phase, safe chat completion, jailbreak prompt (non-streaming), and jailbreak with `stream: true` (OpenClaw path).

E2E via Control UI (browser, guardrails enabled for the spec only):

```bash
make -C deploy test-guardrails
```

Runs `tests/guardrails-ui.spec.ts`: enables NeMo path, asserts jailbreak is refused (not *Internal server error*), benign PONG still works, then restores direct MaaS. Included in `make -C deploy test-e2e` after security tests.

After OpenShell is up:

```bash
make -C deploy launch-openclaw   # creates maas-direct + maas-guardrailed providers
./scripts/demo-enable-guardrails.sh   # live demo: switch to NeMo path
./scripts/demo-disable-guardrails.sh  # reset to direct MaaS
```

## Configuration

Rails config lives in [`deploy/helm/guardrails/files/`](../deploy/helm/guardrails/files/):

- `prompts.yml` — Red Hat RHOAI 3.4 self-check prompts (jailbreak / moderation)
- `rails.co` — built-in self-check flows

`config.yaml` is rendered by Helm (`model_name`, `openai_api_base`, rail flows from `values.yaml`). Helm chart: [`deploy/helm/guardrails/`](../deploy/helm/guardrails/).

## Teardown

```bash
make -C deploy undeploy-guardrails
```

Also runs as part of `make -C deploy undeploy-openshell`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| CRD not found | TrustyAI not Managed | `make -C deploy deploy-platform`, confirm DSC |
| CR stuck not Ready | Bad MaaS key/URL or model name | Check `secrets.env`; `oc logs` on NeMo deployment |
| Provider not found at demo | Skipped `launch-openclaw` | `make -C deploy launch-openclaw` |
| Jailbreak not blocked | Still on `maas-direct` | `./scripts/demo-enable-guardrails.sh` |
| Chat shows "Internal server error" on jailbreak | OpenClaw streams responses; output rails need `rails.output.streaming.enabled: true` | Redeploy guardrails (chart sets this); run `make -C deploy test-guardrails` as regression; see [NeMo output rail streaming](https://docs.nvidia.com/nemo/guardrails/configure-guardrails/yaml-schema/streaming/output-rail-streaming) |
| `validate-guardrails` appears hung | Wrong Service port (`8000` vs TrustyAI `80`), or `oc run -i` after curl timeout | Set `NEMO_GUARDRAILS_PORT=80`; redeploy guardrails; allow ~3 min for self-check rails |
| Model mismatch errors | `INFERENCE_MODEL` differs from MaaS catalog | Set same model in `secrets.env` and redeploy guardrails |

## References

- [ADR-0004: NeMo Guardrails via TrustyAI](adr/0004-nemo-guardrails-via-trustyai.md)
- [RHOAI 3.4 — Enabling AI safety with NeMo Guardrails](https://docs.redhat.com/en/documentation/red_hat_openshift_ai_self-managed/3.4/html/enabling_ai_safety_with_guardrails/enabling-ai-safety-with-nemo-guardrails_nemo-guardrails)
- [NeMo Guardrails docs](https://docs.nvidia.com/nemo/guardrails/)
