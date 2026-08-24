---
name: launch-openclaw
description: >-
  Launch OpenClaw inside an OpenShell sandbox with MaaS providers and MLflow
  tracing. Use when running launch-openclaw, creating the sandbox, starting
  the agent gateway, or preparing the demo — always set POLICY_FILE to
  openclaw-demo-initial.yaml for demo v1.
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

For [`demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md), **always** use the demo-initial policy and direct MaaS:

```bash
POLICY_FILE=policies/openclaw-demo-initial.yaml \
INFERENCE_BACKEND=direct \
make -C deploy launch-openclaw
```

Or from repo root:

```bash
POLICY_FILE=policies/openclaw-demo-initial.yaml \
INFERENCE_BACKEND=direct \
APPS_DOMAIN=$(oc get ingress.config.openshift.io cluster -o jsonpath='{.spec.domain}') \
./scripts/launch-openclaw.sh
```

| Variable | Demo v1 value | CI / final state |
|---|---|---|
| `POLICY_FILE` | `policies/openclaw-demo-initial.yaml` | `policies/openclaw-sandbox.yaml` |
| `INFERENCE_BACKEND` | `direct` | `direct` at launch; guardrailed only via demo script |

Constants in [`scripts/common.sh`](../../scripts/common.sh): `POLICY_DEMO_INITIAL`, `POLICY_FINAL`.

## CI / hardened policy (not demo initial state)

```bash
make -C deploy launch-openclaw
```

Default `POLICY_FILE` is `policies/openclaw-sandbox.yaml` (github.com blocked).

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
| github.com blocked before Test C | Wrong policy — use `openclaw-demo-initial.yaml` |

## Related skills

- Orchestrator: `demo-backstage-install`
- Verify demo state: `demo-verify`
- Doc sync: `sync-agent-sandbox-doc`
- Architecture: [`docs/AGENT-SANDBOX-AND-OPENSHELL.md`](../../docs/AGENT-SANDBOX-AND-OPENSHELL.md)
