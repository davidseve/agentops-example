# agentops-openshell

Wrapper Helm chart (`0.2.0`) that prepares the OpenShift-side pieces for deploying
[NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) on OpenShift / RHOAI for the
AgentOps demo: the `openshell` namespace, a privileged SCC `RoleBinding` for the sandbox
ServiceAccount, and a `Route` for gRPC/CLI access.

**This chart does NOT install the OpenShell gateway itself.** It has no Helm
`dependencies:` on the upstream OCI chart — it only renders a `ConfigMap`
(`openshell-helm-values`) of values, which `make deploy-openshell-oci` extracts and feeds
via `-f` into a *separate* `helm upgrade --install` of the upstream OCI chart
(`oci://ghcr.io/nvidia/openshell/helm-chart`, pinned `0.0.83` — see
[ADR-0006](../../../docs/adr/0006-explicit-version-pinning.md); the Makefile's
`OPENSHELL_OCI_VERSION` is the single source of truth for that pin, not anything in this
chart). This split exists so `global.appsDomain` (one Helm value) can flow into both the
gateway's own values *and* this chart's namespace/SCC/Route, replacing what the reference
project did with bash `__APPS_DOMAIN__` templating.

## Quick start

```bash
# From repo root
make -C deploy deploy-operators                       # once per cluster (RHOAI + Agent Sandbox operators via OLM)
APPS_DOMAIN=apps.example.com make -C deploy deploy-openshell   # runs deploy-openshell-infra + deploy-openshell-oci
make -C deploy deploy-oauth2-proxy                     # browser auth for the Control UI (ADR-0011)
```

`deploy-openshell-infra` (this chart) always renders with `-f values-openshift.yaml` —
there is no non-OpenShift use case for this chart, so that overlay isn't optional.

After install, sync the mTLS client bundle to the local CLI (gateway name must match
whatever `openshell gateway list` shows — commonly `ocp` for a Route-based connection, or
`openshift` per the upstream port-forward convention):

```bash
GATEWAY_NAME=ocp make -C deploy openshell-sync-mtls
```

## Values files

| File | Purpose |
|---|---|
| `values.yaml` | This chart's own defaults: namespace name, image tag override (must match `OPENSHELL_OCI_VERSION` in `deploy/Makefile`), `openshift.*` off by default |
| `values-openshift.yaml` | OpenShift overlay: namespace creation, SCC RoleBinding — always applied by `deploy-openshell-infra` |

## Wrapper templates

| Template | Purpose | Gate |
|---|---|---|
| `namespace.yaml` | Creates the fixed `openshell` namespace (`.Values.namespace`, not `.Release.Namespace` — this release isn't installed with `--namespace`) with demo labels | `openshift.namespace.create` |
| `openshell-values-cm.yaml` | Renders the values `deploy-openshell-oci` feeds to the separate OCI install | `global.appsDomain` required |
| `route.yaml` | gRPC/CLI passthrough Route | `route.enabled` |
| `scc-rolebinding.yaml` | Grants `privileged` SCC to the sandbox SA created by the *other* (OCI) release — `openshift.scc.serviceAccount` must be set explicitly since it can't be derived from this release's own name | `openshift.scc.privilegedSandbox` |
| `_helpers.tpl` | Labels and sandbox SA name helper | — |

## Uninstall

```bash
make -C deploy undeploy-openshell
```

Reverses `deploy-openshell` + `deploy-oauth2-proxy`: uninstalls `oauth2-proxy`,
`openshell` (OCI gateway release), and `openshell-infra` (this chart), deletes the
`openshell` namespace, and removes the Agent Sandbox raw manifest (CRD + cluster-scoped
RBAC) applied by `deploy-openshell-infra`.

## Documentation

- [docs/openshell-installation.md](../../../docs/openshell-installation.md) — still
  describes an older single-chart flow in places; treat `deploy/Makefile`'s
  `deploy-openshell-infra`/`deploy-openshell-oci` targets as the source of truth for
  what's actually deployed.
- [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md) — full decision
  record, including a list of real chart bugs found and fixed on 2026-08-05 during a
  from-scratch redeploy test.
- [Upstream Helm README](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md)
