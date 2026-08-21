# NeMo Guardrails config files

Edit these files to change NeMo input/output rails for the demo:

- `prompts.yml` — self-check prompts (jailbreak / moderation)
- `rails.co` — Colang flows (built-in self-check rails)

`config.yaml` is **not** stored here; Helm renders it in
[`templates/configmap-nemo-config.yaml`](../templates/configmap-nemo-config.yaml)
from `values.yaml` and secrets (`MAAS_BASE_URL`, `INFERENCE_MODEL`, etc.).

After changes, redeploy:

```bash
make -C deploy deploy-guardrails
```

See [nemo-guardrails-installation.md](../../../../docs/nemo-guardrails-installation.md).
