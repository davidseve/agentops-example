---
name: openshell-cluster-install
description: >-
  Deploy OpenShell gateway on OpenShift/RHOAI using the project Helm wrapper
  chart and deploy Makefile. Use when the user asks to install, deploy, or set
  up OpenShell on the cluster, OpenShift, OCP, or RHOAI — not local workstation
  install.
---

# OpenShell Cluster Install

Deploy the OpenShell **gateway** on OpenShift using `deploy/Makefile` and `deploy/helm/openshell/`. This is **two separate Helm releases**, not one: `openshell-infra` (namespace, privileged SCC RoleBinding, Route, and a ConfigMap of rendered values — no gateway resources of its own) and `openshell` (the upstream OCI chart, pinned `0.0.83`, installed directly using that ConfigMap's values). After install, the Makefile syncs the cluster mTLS client bundle to the local CLI. Requires `oc` and `helm` on the workstation.

> **Do not use `make -C deploy openshell-install`.** That target (and
> `openshell-upgrade`/`openshell-uninstall`) is an older single-chart flow
> kept in the Makefile for reference only — it is not what's actually
> deployed, and as of 2026-08-05 has an unrelated broken-path bug
> (`ROOT_DIR`) in its dependency chain. Use `deploy-openshell` /
> `undeploy-openshell` below instead.

For cluster operations prefer the `openshift-mcp` skill; fall back to `oc`/`make` when MCP is unavailable.

## When to use

| User intent | Action |
|---|---|
| Deploy OpenShell on OpenShift | `APPS_DOMAIN=<domain> make -C deploy deploy-openshell` |
| First-time cluster setup | `make -C deploy deploy-operators` then deploy (must come after RHOAI — ADR-0003) |
| Refresh local mTLS certs only | `GATEWAY_NAME=<name> make -C deploy openshell-sync-mtls` (gateway name must match `openshell gateway list`, commonly `ocp`) |
| Check deployment | `make -C deploy validate-openshell` |
| Remove everything | `make -C deploy undeploy-openshell` |

## Workflow

1. **Verify cluster context** — correct OpenShift cluster/project (`configuration_contexts_list` or `oc config current-context`).
2. **Prerequisites (once per cluster, and must come first)** — RHOAI + Agent Sandbox Operator are installed via OLM as part of the operators chart, and OpenShell's MLflow RBAC integration depends on RHOAI namespaces/ClusterRoles existing first:

```bash
make -C deploy deploy-all   # or at minimum: deploy-operators, deploy-platform
```

Idempotent.

3. **Install OpenShell** (both releases, plus the Agent Sandbox raw manifest):

```bash
APPS_DOMAIN=<apps-domain, e.g. apps.ocp.example.com> make -C deploy deploy-openshell
```

Runs: `oc apply -f manifests/agent-sandbox-v0.5.1.yaml` (Agent Sandbox controller
raw path — coexists with the OLM path from step 2, a known unreconciled gap, see
ADR-0003) → `deploy-openshell-infra` (Helm release `openshell-infra`: namespace,
privileged SCC RoleBinding, Route, rendered-values ConfigMap; always applies
`values-openshift.yaml`) → `deploy-openshell-oci` (Helm release `openshell`: the
actual gateway StatefulSet, from the ConfigMap's values, `--version 0.0.83`).

4. **Deploy the browser-auth proxy** (required for the Control UI, see ADR-0011):

```bash
APPS_DOMAIN=<apps-domain> make -C deploy deploy-oauth2-proxy
```

5. **Verify**:

```bash
make -C deploy validate-openshell
oc -n openshell get rolebinding | grep privileged
oc -n openshell get sa openshell-sandbox
```

Expect secrets: `openshell-jwt-keys`, `openshell-server-tls`, `openshell-client-tls`.
Expect RoleBinding: `openshell-infra-sandbox-privileged-scc`, targeting SA `openshell-sandbox`.
Expect logs: `TLS enabled — listening on encrypted HTTPS`.

6. **Optional — connect local CLI**:

```bash
openshell gateway add https://openshell-gw-openshell.<apps-domain> --name ocp
GATEWAY_NAME=ocp make -C deploy openshell-sync-mtls
openshell status   # Status: Connected
```

(Or port-forward instead of using the Route — either way, `GATEWAY_NAME` passed to
`openshell-sync-mtls` must match the name shown by `openshell gateway list`.)

## Chart values (pinned)

| Setting | Value |
|---|---|
| Wrapper chart (`openshell-infra` release) | `deploy/helm/openshell/` (`0.2.0`) |
| Upstream OCI chart (`openshell` release) | `oci://ghcr.io/nvidia/openshell/helm-chart:0.0.83` — enforced by `deploy/Makefile`'s `OPENSHELL_OCI_VERSION`, **not** anything in the wrapper chart |
| `server.disableTls` | `false` |
| `pkiInitJob.enabled` | `true` (default — do not disable) |
| `server.auth.allowUnauthenticatedUsers` | `true` (mTLS-only endpoint; means no *additional* bearer token) |
| `openshift.namespace.create` | `true` (in `values-openshift.yaml`, always applied by `deploy-openshell-infra`) |
| `openshift.scc.privilegedSandbox` | `true` (in `values-openshift.yaml`) |
| `openshift.scc.serviceAccount` | `openshell-sandbox` (explicit — the sandbox SA belongs to the *other* release) |

## Safety rules

- **Do not** set `pkiInitJob.enabled=false` without external JWT secret bootstrap.
- **Confirm namespace** — always `openshell` (fixed, not derived from either release's own name).
- **Agent Sandbox** currently has two coexisting install paths (OLM + raw manifest) — a known, still-open gap (ADR-0003). Both are cleaned up by `undeploy-openshell` + `cleanup-orphans`.
- **Helm OCI on Podman hosts** — Makefile sets `DOCKER_CONFIG` automatically.
- **mTLS sync** writes only under `~/.config/openshell/` (never into the git repo). Re-run after every redeploy or after `gateway add`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `helm template`/`install` fails: "found in Chart.yaml, but missing in charts/ directory" | Stale local state from an old manual `helm dependency update` — the wrapper chart has no dependency anymore (fixed 2026-08-05); `rm -rf deploy/helm/openshell/charts` if it exists |
| `openshell-jwt-keys not found` | Reinstall without disabling `pkiInitJob`; see [issue #2089](https://github.com/NVIDIA/OpenShell/issues/2089) |
| Sandbox pods fail | Re-run `make -C deploy deploy-openshell-infra` (Helm hook re-applies SCC) |
| Helm OCI pull fails | Fix `~/.docker/config.json` (unset `credsStore: desktop` or point `DOCKER_CONFIG` elsewhere) |
| certgen Job failed | `oc -n openshell logs job/openshell-certgen` |
| `invalid peer certificate: BadSignature` | `GATEWAY_NAME=<name> make -C deploy openshell-sync-mtls` then `openshell status` — must match the registered gateway name |
| `openshell-sync-mtls` fails with a path containing `deploy/Makefile/scripts/...` | Old `ROOT_DIR` bug in `deploy/Makefile`, fixed 2026-08-05; pull latest |

## Related

- Cluster cleanup: `openshell-cluster-cleanup` skill, or `make -C deploy undeploy-openshell`
- Local CLI install: `openshell-local-install` skill
- Guide: [docs/openshell-installation.md § OpenShift](../../../docs/openshell-installation.md#openshift--rhoai-cluster-deployment) (partially stale — see the banner at the top of that section)
- Chart: [deploy/helm/openshell/README.md](../../../deploy/helm/openshell/README.md)
- Sync script: [scripts/openshift-openshell-sync-mtls.sh](../../../scripts/openshift-openshell-sync-mtls.sh)
- ADR: [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md) — includes a full list of chart/Makefile bugs found and fixed on 2026-08-05
