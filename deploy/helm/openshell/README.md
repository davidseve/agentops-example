# agentops-openshell

Wrapper Helm chart (`0.3.0`) that deploys
[NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) on OpenShift / RHOAI for the
AgentOps demo as a **single Helm release**: the OpenShift-side pieces (a privileged SCC
`RoleBinding` for the sandbox ServiceAccount, and a `Route` for gRPC/CLI access) plus the
upstream gateway itself, rendered together.

**This chart has a real Helm `dependencies:` entry** on the upstream OCI chart
(`oci://ghcr.io/nvidia/openshell`, chart `helm-chart`, aliased `openshell` — see
`Chart.yaml`). The pinned `dependencies[].version` + the committed `Chart.lock` are the
single source of truth for the deployed OpenShell version (see
[ADR-0006](../../../docs/adr/0006-explicit-version-pinning.md)) — not a Makefile variable.
Upstream values are set directly under the `openshell:` key in this chart's own
`values.yaml`/`values-openshift.yaml`, which Helm passes straight through to the subchart
via the alias.

> History: this chart went through two earlier, abandoned designs on 2026-08-05 — first an
> unused `dependencies:` declaration that no template ever rendered (dead weight, broke
> every `helm template`/`install`), then a two-release split with a `ConfigMap` carrying
> rendered values between them (avoided the OCI registry path issue, but reintroduced a
> live-cluster round-trip and lost git as the source of truth for install values). Both are
> superseded by the real, working dependency described above — see
> [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md) for the full history.

## Quick start

```bash
# From repo root
make -C deploy deploy-operators                          # once per cluster (RHOAI + Agent Sandbox operators via OLM)
APPS_DOMAIN=apps.example.com make -C deploy deploy-openshell   # single helm upgrade --install
make -C deploy deploy-oauth2-proxy                        # browser auth for the Control UI (ADR-0011)
```

`deploy-openshell` always renders with `-f values-openshift.yaml` — there is no
non-OpenShift use case for this chart, so that overlay isn't optional. It also runs
`helm dependency build` first (pulls the pinned OCI chart per `Chart.lock`, cached locally
after the first run) and installs with `--create-namespace` (the chart does **not** template
its own `Namespace` object — see "Namespace" below for why). It additionally passes two
`--set openshell.pkiInitJob.serverDnsNames[N]=...` flags (Route host + `*.<appsDomain>`
wildcard) so the server's mTLS certificate is valid for the external Route, not just
in-cluster service names — see ADR-0003 if a client ever reports `invalid peer certificate:
certificate not valid for name ...`. The underlying certgen step does **not** rotate an
already-issued certificate on `helm upgrade`, so a SAN change only takes effect against a
clean namespace (`undeploy-openshell` then `deploy-openshell`).

After install, `deploy-openshell` registers the local CLI gateway and syncs mTLS
automatically (`openshell-register-gateway`, alias `GATEWAY_NAME` default `ocp`).
To re-run only that step:

```bash
make -C deploy openshell-register-gateway
# or: GATEWAY_NAME=my-alias make -C deploy openshell-register-gateway
```

Then launch OpenClaw (creates the sandbox if missing):

```bash
./scripts/launch-openclaw.sh
```

## Values files

| File | Purpose |
|---|---|
| `values.yaml` | This chart's own defaults, plus upstream overrides under `openshell:` (image tags — keep in sync with `Chart.yaml`'s `dependencies[].version`) |
| `values-openshift.yaml` | OpenShift overlay: SCC RoleBinding, UID/fsGroup left to SCC admission — always applied by `deploy-openshell` |

## Namespace

Deliberately **not** a chart-owned template. Helm refuses to adopt a pre-existing
`Namespace` object into a release unless it already carries Helm's own ownership
annotations, so combining `--create-namespace` (needed so the release itself can install
into `openshell` before that namespace exists) with a chart template for that same
namespace fails on a first, truly-clean install ("exists and cannot be imported... invalid
ownership metadata"). Namespace creation is left entirely to the `--create-namespace` flag;
the one extra label this project needs (RHOAI Dashboard opt-in,
`opendatahub.io/dashboard: "true"`) is applied by a single idempotent `oc label` line in
`deploy/Makefile`'s `deploy-openshell` target, right after the Helm install.

## Wrapper templates

| Template | Purpose | Gate |
|---|---|---|
| `route.yaml` | gRPC/CLI passthrough Route | `route.enabled` |
| `scc-rolebinding.yaml` | Grants `privileged` SCC to the sandbox SA (`<release name>-sandbox`, resolved automatically since the release is always named `openshell`) | `openshift.scc.privilegedSandbox` |
| `_helpers.tpl` | Labels and sandbox SA name helper | — |

## Uninstall

```bash
make -C deploy undeploy-openshell
```

Reverses `deploy-openshell` + `deploy-oauth2-proxy`: uninstalls `oauth2-proxy` and
`openshell` (this one release), deletes the `openshell` namespace, and removes the Agent
Sandbox raw manifest (CRD + cluster-scoped RBAC).

## Documentation

- [docs/openshell-installation.md](../../../docs/openshell-installation.md) — still
  describes an older single-chart flow in places; treat `deploy/Makefile`'s
  `deploy-openshell` target as the source of truth for what's actually deployed.
- [ADR-0003](../../../docs/adr/0003-openshell-deployment-on-openshift.md) — full decision
  record, including the history of the two abandoned designs and a list of real chart bugs
  found and fixed on 2026-08-05 during a from-scratch redeploy test.
- [Upstream Helm README](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md)
