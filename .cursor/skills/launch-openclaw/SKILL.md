---
name: launch-openclaw
description: >-
  Launch OpenClaw inside an OpenShell sandbox with MaaS providers and MLflow
  tracing. Use when running launch-openclaw, creating the sandbox, starting
  the agent gateway, or preparing the demo — demo v1 uses
  config/openshell/default.yaml (MLflow-only egress).
---

# Launch OpenClaw

Imperative runtime step: register CLI gateway, create sandbox (if missing), wire MLflow plugin, start OpenClaw gateway.

**Script:** [`scripts/launch-openclaw.sh`](../../scripts/launch-openclaw.sh)

## Prerequisites

- `openshell-cluster-install` complete (`make -C deploy deploy-openshell`)
- `deploy-openclaw-ui-proxy` complete (for Control UI — ADR-0011)
- `secrets-setup` complete
- `openshell` CLI connected (`openshell status` → Connected)

## Demo v1 (required env)

For [`demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md), use the MLflow-only default policy and direct MaaS:

```bash
POLICY_FILE=config/openshell/default.yaml \
INFERENCE_BACKEND=direct \
make -C deploy launch-openclaw
```

Or from repo root:

```bash
POLICY_FILE=config/openshell/default.yaml \
INFERENCE_BACKEND=direct \
APPS_DOMAIN=$(oc get ingress.config.openshift.io cluster -o jsonpath='{.spec.domain}') \
./scripts/launch-openclaw.sh
```

| Variable | Demo v1 value | Post–Cambio 1 (live only) |
|---|---|---|
| `POLICY_FILE` | `config/openshell/default.yaml` | `google-egress.yaml` via `demo-allow-google-egress.sh` |
| `INFERENCE_BACKEND` | `direct` | `direct` at launch; guardrailed only via demo script |

Constants in [`scripts/common.sh`](../../scripts/common.sh): `POLICY_GOOGLE_EGRESS`, `POLICY_DEFAULT`.

## CI / default launch

```bash
make -C deploy launch-openclaw
```

Default `POLICY_FILE` is `config/openshell/default.yaml` (google.com and github.com blocked).

## Verify

```bash
make -C deploy validate-openclaw
openshell sandbox list
```

Control UI: `https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/`

## Expected result

- Sandbox `openclaw-gw` (default) running OpenClaw gateway
- Providers `maas-direct` and `maas-guardrailed` registered
- Active inference: `maas-direct` / `INFERENCE_MODEL` for demo v1
- MLflow tracing active (plugin `mlflow-openclaw`)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Policy file not found | Run from repo root; check `POLICY_FILE` path |
| Provider not found at demo | Re-run launch with demo env vars |
| Control UI password missing | Set `OPENCLAW_GATEWAY_PASSWORD` in secrets.env |
| google.com reachable before Test C | Wrong policy — run `./scripts/demo-reset.sh` |
| MLflow `No Experiment with id=1` | Run `./scripts/ensure-mlflow-experiment.sh` then re-launch |
| Test B: agent refuses `cat /etc/shadow` | Re-run launch (uploads `agent/workspace/AGENTS.md`); start **new chat** (`/new`) — default OpenClaw bootstrap refuses sensitive probes at LLM layer |

## Workspace bootstrap

Demo probes (A–D) require `agent/workspace/AGENTS.md` uploaded to `/sandbox/workspace/`. Config sets `agents.defaults.skipBootstrap: true` so OpenClaw does not overwrite with default templates that refuse exfiltration-style commands. Landlock/egress/guardrails are the intended defenses, not model refusal.

## Related skills

- Orchestrator: `demo-backstage-install`
- Verify demo state: `demo-verify`
- Doc sync: `sync-agent-sandbox-doc`
- Architecture: [`docs/AGENT-SANDBOX-AND-OPENSHELL.md`](../../docs/AGENT-SANDBOX-AND-OPENSHELL.md)
