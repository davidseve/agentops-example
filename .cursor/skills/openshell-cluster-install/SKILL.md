---
name: openshell-cluster-install
description: >-
  Deploy OpenShell gateway on OpenShift/RHOAI using the project Helm wrapper
  chart and deploy Makefile. Use when the user asks to install, deploy, or set
  up OpenShell on the cluster, OpenShift, OCP, or RHOAI — not local workstation
  install.
---

# OpenShell Cluster Install

Deploy the OpenShell **gateway** on OpenShift using `deploy/Makefile` and
`deploy/helm/openshell/`. This is **one Helm release** (`openshell`, in namespace
`openshell`): the wrapper chart declares the upstream OCI chart as a real Helm subchart
dependency (aliased `openshell` in `Chart.yaml`), so one `helm upgrade --install` renders
the namespace extras (SCC RoleBinding, Route) and the gateway itself together. After
install, the Makefile syncs the cluster mTLS client bundle to the local CLI. Requires `oc`
and `helm` on the workstation.

For cluster operations prefer the `openshift-mcp` skill; fall back to `oc`/`make` when MCP is unavailable.

## When to use

| User intent | Action |
|---|---|
| Deploy **full demo v1 stack** (narrative-v1 backstage) | **`demo-backstage-install`** skill — not `cluster-lifecycle full` alone |
| Deploy **CI full stack** (RHOAI + OpenShell + hardened policy) | `./scripts/cluster-lifecycle.sh full` |
| Deploy OpenShell on OpenShift only | `APPS_DOMAIN=<domain> make -C deploy deploy-openshell` |
| First-time cluster setup | `make -C deploy deploy-operators` then deploy (must come after RHOAI — ADR-0003) |
| Re-register local CLI gateway + mTLS | `make -C deploy openshell-register-gateway` (default alias `ocp`) |
| Refresh local mTLS certs only | `GATEWAY_NAME=<name> make -C deploy openshell-sync-mtls` |
| Browser UI proxy (nginx mTLS bridge) | `APPS_DOMAIN=<domain> make -C deploy deploy-openclaw-ui-proxy` |
| Launch OpenClaw (creates sandbox if needed) | `./scripts/launch-openclaw.sh` |
| Check deployment | `make -C deploy validate-openshell` |
| Remove everything | `make -C deploy undeploy-openshell` |

## Workflow

**One-shot (recommended):** `./scripts/cluster-lifecycle.sh preflight` then `./scripts/cluster-lifecycle.sh full`.

Manual steps below are for partial deploy or troubleshooting only.

1. **Verify cluster context** — correct OpenShift cluster/project (`configuration_contexts_list` or `oc config current-context`).
2. **Prerequisites (once per cluster, and must come first)** — RHOAI + Agent Sandbox Operator are installed via OLM as part of the operators chart, and OpenShell's MLflow RBAC integration depends on RHOAI namespaces/ClusterRoles existing first:

```bash
make -C deploy deploy-all   # or at minimum: deploy-operators, deploy-platform
```

Idempotent.

3. **Install OpenShell** (one release; Agent Sandbox CRDs already provided by OLM from step 2):

```bash
APPS_DOMAIN=<apps-domain, e.g. apps.ocp.example.com> make -C deploy deploy-openshell
```

Runs: wait for `sandboxes.agents.x-k8s.io` CRD from the Red Hat build of Agent
Sandbox Operator (OLM, sole source — ADR-0003 / OSC 1.13) → `helm dependency build`
(resolves the pinned OCI chart per `Chart.lock`) →
one `helm upgrade --install openshell deploy/helm/openshell --namespace openshell
--create-namespace` (namespace extras + the actual gateway
StatefulSet together, pinned `0.0.83` in `Chart.yaml`) → `oc label namespace` (RHOAI
Dashboard opt-in) → wait for rollout/PKI secrets → MLflow RBAC wiring
(`deploy-mlflow-openclaw-integration`, which also runs `ensure-mlflow-experiment`
for the `openclaw-tracing` workspace experiment) → **CLI gateway register + mTLS**
(`openshell-register-gateway`, alias `GATEWAY_NAME` default `ocp`).

4. **Deploy the browser UI proxy** (nginx mTLS bridge — required for the Control UI, see ADR-0011):

```bash
APPS_DOMAIN=<apps-domain> make -C deploy deploy-openclaw-ui-proxy
```

5. **Launch OpenClaw** (creates the sandbox if missing, then starts the gateway).
   Requires `MAAS_API_KEY` and `OPENCLAW_GATEWAY_PASSWORD` in `secrets/secrets.env`.

   **Demo v1** (default deny egress — use `launch-openclaw` skill):

```bash
POLICY_FILE=config/openshell/default.yaml INFERENCE_BACKEND=direct make -C deploy launch-openclaw
```

   **CI / hardened policy** (default):

```bash
./scripts/launch-openclaw.sh
```

6. **Verify**:

```bash
make -C deploy validate-openshell
openshell status   # Status: Connected (alias GATEWAY_NAME, default ocp)
oc -n openshell get rolebinding | grep privileged
oc -n openshell get sa openshell-sandbox
oc -n openshell get route openclaw-ui
```

Expect secrets: `openshell-jwt-keys`, `openshell-server-tls`, `openshell-client-tls`.
Expect RoleBinding: `openshell-sandbox-privileged-scc`, targeting SA `openshell-sandbox`.
Expect logs: `TLS enabled — listening on encrypted HTTPS`.
Control UI: `https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/` — enter the gateway password
(or open with `/?password=...`).

Re-register CLI only (idempotent, usually unnecessary after `deploy-openshell`):

```bash
make -C deploy openshell-register-gateway   # GATEWAY_NAME=ocp by default
```

## Chart values (pinned)

| Setting | Value |
|---|---|
| Wrapper chart | `deploy/helm/openshell/` (`0.3.0`) |
| Upstream OCI chart (real Helm dependency, alias `openshell`) | `oci://ghcr.io/nvidia/openshell` chart `helm-chart`, `0.0.83` — pinned in `Chart.yaml`'s `dependencies[].version` + committed `Chart.lock`, **not** a Makefile variable |
| UI proxy chart | `deploy/helm/openclaw-ui-proxy/` (`0.1.0`) — nginx sole entrypoint |
| `server.disableTls` | `false` |
| `pkiInitJob.enabled` | `true` (default — do not disable) |
| `server.auth.allowUnauthenticatedUsers` | `true` (mTLS-only endpoint; means no *additional* bearer token) |
| `openshift.scc.privilegedSandbox` | `true` (in `values.yaml`) |
| `openshift.scc.serviceAccount` | unset — resolves automatically to `openshell-sandbox` since the release is always named `openshell` |

## Safety rules

- **Do not** set `pkiInitJob.enabled=false` without external JWT secret bootstrap.
- **Confirm namespace** — always `openshell` (created via `--create-namespace`, not a chart-owned `Namespace` template — see chart README for why).
- **Agent Sandbox** is installed solely via the Red Hat build of Agent Sandbox Operator (OLM, channel `preview-0.9`, namespace `agent-sandbox-system`) — the upstream raw-manifest path was retired (ADR-0003 / OSC 1.13). Operator teardown is via `cleanup-orphans` / `undeploy-all`, not `undeploy-openshell`.
- **Helm OCI on Podman hosts** — Makefile sets `DOCKER_CONFIG` automatically for the dependency build step.
- **mTLS / CLI registration** writes only under `~/.config/openshell/` (never into the git repo). `deploy-openshell` and `launch-openclaw.sh` run `openshell-register-gateway` automatically (idempotent).
- **Browser auth** is OpenClaw password mode (`OPENCLAW_GATEWAY_PASSWORD`), not OCP OAuth (ADR-0011).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `helm template`/`install` fails: "found in Chart.yaml, but missing in charts/ directory" | `charts/` is gitignored and rebuilt by `deploy-openshell`'s `helm dependency build` step — if running `helm template` manually, run `helm dependency build deploy/helm/openshell` first |
| OCI dependency 404s on pull | `repository:` in `Chart.yaml` must be the chart's *parent* path (`oci://ghcr.io/nvidia/openshell`), not the full chart path (`.../helm-chart`) — Helm appends `name` itself |
| `openshell-jwt-keys not found` | Reinstall without disabling `pkiInitJob`; see [issue #2089](https://github.com/NVIDIA/OpenShell/issues/2089) |
| Sandbox pods fail | Re-run `make -C deploy deploy-openshell` (Helm re-applies SCC) |
| Helm OCI pull fails | Fix `~/.docker/config.json` (unset `credsStore: desktop` or point `DOCKER_CONFIG` elsewhere) |
| certgen Job failed | `oc -n openshell logs job/openshell-certgen` |
| `invalid peer certificate: BadSignature` | `make -C deploy openshell-register-gateway` then `openshell status` — must match the registered gateway name (`GATEWAY_NAME`, default `ocp`) |
| `invalid peer certificate: certificate not valid for name "openshell-gw-openshell.<domain>"` | Server cert is missing the Route hostname SAN (`deploy-openshell` sets it via `--set openshell.pkiInitJob.serverDnsNames[N]`, but certgen doesn't rotate an existing cert on `helm upgrade`) — `make -C deploy undeploy-openshell` then redeploy against the clean namespace |
| Control UI "gateway password missing" | Set `OPENCLAW_GATEWAY_PASSWORD` in `secrets/secrets.env`, re-run `launch-openclaw.sh`, open UI with `/?password=...` |

## Token-efficient execution

Follow global skill **`long-running-scripts`**. For this repo:

- **Full stack:** `./scripts/cluster-lifecycle.sh full` — one Shell call; read `.agent-status/cluster-lifecycle-full.json`
- **OpenShell only:** `make -C deploy deploy-openshell` — one Shell call, no polling
- Quick check: `./scripts/cluster-lifecycle.sh verify --smoke`
- Full validation: `./scripts/cluster-lifecycle.sh verify`

## Related

- Demo v1 backstage: `demo-backstage-install`, `launch-openclaw` skills
- Cluster cleanup: `openshell-cluster-cleanup` skill, or `make -C deploy undeploy-openshell`
- Local CLI install: `openshell-local-install` skill
- Guide: [docs/openshell-installation.md](../../../docs/openshell-installation.md#openshift--rhoai-cluster-deployment)
- Architecture: [docs/AGENT-SANDBOX-AND-OPENSHELL.md](../../../docs/AGENT-SANDBOX-AND-OPENSHELL.md) — Agent Sandbox + OpenShell + OpenClaw launch flow (keep in sync via `sync-agent-sandbox-doc` skill)
- Chart: [deploy/helm/openshell/README.md](../../../deploy/helm/openshell/README.md)
- UI proxy: [deploy/helm/openclaw-ui-proxy/](../../../deploy/helm/openclaw-ui-proxy/)
- Sync / register: [scripts/openshift-openshell-register-gateway.sh](../../../scripts/openshift-openshell-register-gateway.sh), [scripts/openshift-openshell-sync-mtls.sh](../../../scripts/openshift-openshell-sync-mtls.sh)
- Launch: [scripts/launch-openclaw.sh](../../../scripts/launch-openclaw.sh)
- ADR: [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md) — includes the full history of this chart's architecture and a list of bugs found and fixed on 2026-08-05
- Auth ADR: [ADR-0011](../../../docs/adr/0011-openclaw-ui-auth-nginx-bridge-password.md)
