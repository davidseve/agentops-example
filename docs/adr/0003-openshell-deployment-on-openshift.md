# ADR-0003: OpenShell Deployment on OpenShift

## Status

Accepted (updated 2026-08-05 — merged in duplicate content from a since-retired ADR, previously numbered 0009, that documented the same deployment decision independently, see "Note on merged ADR" at the end of this file; updated again the same day after a from-scratch redeploy test found and fixed several real chart/Makefile bugs, see "Chart bugs found and fixed"; updated a third time the same day to replace the two-release/ConfigMap design from that fix with a real, working Helm dependency — see "Chart architecture: from two releases back to one" below)

## Date

2026-07-13

## Layer

Platform

## Context

The demo needs a sandboxed execution environment for AI agents to demonstrate zero-trust isolation. OpenShell provides container-based sandboxes with policy enforcement.

Deployment on OpenShift requires the Helm chart with TLS enabled and the certgen pre-install hook, plus the Agent Sandbox controller. OpenShift SCCs must be configured to allow the sandbox service account to run privileged containers.

The Agent Sandbox controller was originally installed from the upstream `kubernetes-sigs/agent-sandbox` manifests (`v0.5.1`) via `oc apply -f`. Red Hat now ships a productised build — the [Red Hat build of Agent Sandbox Operator](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.12/html/deploying_red_hat_build_of_agent_sandbox/) — installable via OLM Subscription from the `redhat-operators` catalog. Using the Red Hat operator aligns lifecycle management with the rest of the RHOAI stack.

The original deployment used a hybrid approach: a thin Helm wrapper chart for the gateway, plus imperative scripts (`openshift-openshell-scc.sh`) and kustomize overlays (`deploy/openshift/openshell/`) for the namespace and SCC grant. This split complicated the install flow and prevented Helm from managing the full release lifecycle (SCC bindings were invisible to `helm uninstall`).

**Ordering and templating lessons carried over from the reference project** (its own deployment script and constraints documentation #10, #12, #19; merged in from a since-retired duplicate ADR, 2026-08-05):

- OpenShell must be deployed **after** RHOAI — the MLflow integration RBAC (used by the agent tracing path) depends on the `redhat-ods-applications` namespace and the `mlflow-integration` ClusterRole existing first (constraint #10). The Makefile enforces this ordering (`deploy-openshell` is never invoked before `deploy-all`/`deploy-platform`).
- mTLS client-bundle registration is fragile across `helm upgrade` (constraint #19) — this is why a dedicated post-install sync step exists (see Validation below) rather than assuming the client bundle survives an upgrade untouched.
- Template rendering with `__APPS_DOMAIN__` placeholders (the reference project's approach) was bash-heavy and error-prone; this project instead exposes a single Helm value, `global.appsDomain`, that flows into every templated resource (Route host, `trustedProxies`, OAuth redirect URIs, etc.) — see Decision below.

## Options Considered

### Option 1: Local-only OpenShell (Podman driver)

- **Pros:** Simple setup; works without a cluster.
- **Cons:** Cannot demonstrate sandboxing on the OpenShift platform; no Kubernetes driver.

### Option 2: OpenShell on OpenShift via Helm chart

- **Pros:** Demonstrates agent sandboxing on the target platform; uses Kubernetes driver with Agent Sandbox; TLS via certgen hook.
- **Cons:** Requires privileged SCC for the sandbox service account; chart `0.0.83` is pre-1.0.

### Option 3: Helm chart with namespace and SCC managed declaratively (chosen)

- **Pros:** All release-scoped resources (namespace, SCC RoleBinding, gateway) are managed by Helm; `helm uninstall` cleans up fully; single `helm upgrade --install` replaces multi-step scripts.
- **Cons:** Same as Option 2; installer still needs RBAC to bind `system:openshift:scc:privileged`.

## Decision

Deploy OpenShell on OpenShift using the wrapper Helm chart (`deploy/helm/openshell/`) as a
**single Helm release**. The chart:

1. Declares the upstream OCI chart (`oci://ghcr.io/nvidia/openshell`, chart `helm-chart`) as
   a real Helm subchart dependency, aliased `openshell` in `Chart.yaml`. `global.appsDomain`
   (a single Helm value, set once via `HELM_OPTS` or `APPS_DOMAIN`) and every other upstream
   value live directly under the `openshell:` key in this chart's own
   `values.yaml`/`values-openshift.yaml` and flow straight into the subchart via the alias —
   this is how a single value replaces every `__APPS_DOMAIN__` placeholder the reference
   project rendered with bash instead. No `ConfigMap` round-trip, no second `helm install`.
2. Installs with `--create-namespace` (see "Chart architecture" below for why the chart does
   *not* also template its own `Namespace` object), and applies the
   `opendatahub.io/dashboard: "true"` label (so the namespace surfaces in the RHOAI
   Dashboard) via one idempotent `oc label` line in `deploy/Makefile`'s `deploy-openshell`
   target, right after the Helm install.
3. Grants privileged SCC to the sandbox service account via a `RoleBinding` to
   `system:openshift:scc:privileged` (gated by `openshift.scc.privilegedSandbox`), targeting
   the sandbox ServiceAccount the subchart itself creates (`openshell-sandbox` — resolved
   automatically from the release name, since this chart is always installed as release
   `openshell`; no manual override needed since both are now the same release).
4. Sets `server.auth.allowUnauthenticatedUsers: true` under `openshell:` in `values.yaml`,
   allowing CLI/gRPC access without a bearer token since that endpoint is mTLS-only (client
   cert required — "unauthenticated" here means no *additional* token, not no auth). This is
   orthogonal to the OpenClaw Control UI's browser auth, which goes through a separate OAuth
   proxy (see [ADR-0011](0011-ui-auth-openshift-oauth-proxy.md)).

Agent Sandbox controller — **two install paths currently coexist, not fully reconciled**:

- The Red Hat build of Agent Sandbox Operator is installed via OLM Subscription (channel `preview-0.9`) through the `deploy/helm/operators/` chart alongside the RHOAI operator (`make deploy-operators`, Phase 1).
- Separately, `make deploy-openshell` (Phase 2) also runs `oc apply -f manifests/agent-sandbox-v0.5.1.yaml` as its first step — the raw upstream `kubernetes-sigs/agent-sandbox` manifest, installing its own controller Deployment and CRDs directly, then waits on `crd sandboxes.agents.x-k8s.io` before proceeding to the Helm install.

Both paths were carried forward from earlier iterations without verifying whether the raw manifest apply is still necessary once the OLM operator is present, or whether running both risks two competing controllers reconciling the same CRD. **This needs dedicated follow-up investigation** (out of scope for this ADR merge) before being treated as an intentional, validated design.

## Consequences

### Positive

- Agent sandboxing runs on the same platform as the rest of the demo stack.
- Demonstrates a real enterprise deployment topology.
- SCC binding is declarative and lifecycle-managed by Helm (cleaned up on uninstall).
- Single install command: `make deploy-openshell` (`deploy/Makefile`) runs exactly one
  `helm upgrade --install`, rendering namespace extras and the gateway itself together, plus
  the Agent Sandbox raw-manifest apply, PKI-secret wait, and the MLflow RBAC wiring step
  (`deploy-mlflow-openclaw-integration`) — no `ConfigMap` round-trip, no second release.

### Negative

- Privileged SCC is required, which may not be acceptable in all production environments.
- Chart `0.0.83` is pre-1.0 and may introduce breaking changes.
- **Known gap (still open)**: the Agent Sandbox controller currently gets installed twice — once via the OLM Subscription (Phase 1) and once via the raw `v0.5.1` manifest (`deploy-openshell`'s first step, Phase 2). Not yet resolved; tracked as follow-up work rather than silently documented as correct. (Teardown now correctly reverses both paths — see `deploy/Makefile`'s `undeploy-openshell` + `cleanup-orphans`.)

## Version Pinning

| Component | Pinned version | Where enforced |
|---|---|---|
| OpenShell OCI chart (gateway) | `0.0.83` | `deploy/helm/openshell/Chart.yaml` (`dependencies[].version`) + committed `Chart.lock` (digest-pinned) — see ADR-0006 for the history of this pin living in the wrong place (a Makefile variable, then briefly a dead dependency) before landing here |
| Wrapper chart | `0.3.0` | `deploy/helm/openshell/Chart.yaml` |
| Agent Sandbox Operator (OLM) | `preview-0.9` channel | `deploy/helm/operators/values.yaml` |
| Agent Sandbox controller (raw manifest) | `v0.5.1` | `deploy/manifests/agent-sandbox-v0.5.1.yaml`, applied by `make deploy-openshell` — see "Known gap" above |

## Chart bugs found and fixed during a from-scratch redeploy (2026-08-05)

This chart (and the Makefile targets around it) had never actually been exercised
against a truly empty cluster before — every prior "successful" deployment
silently relied on leftover state from an earlier manual or legacy run. A full
teardown + redeploy test (`make undeploy-everything` then `make deploy-all
deploy-openshell deploy-oauth2-proxy`) surfaced and fixed a chain of real bugs,
each masked by the others or by that leftover state:

1. **Dead Helm dependency broke every render.** `Chart.yaml` declared the
   upstream OCI chart as a `dependencies:` entry pinned `0.0.80`, but no
   template in this chart ever renders it (the actual gateway install is the
   *separate* `deploy-openshell-oci` step). Since `charts/` is gitignored and
   never vendored by any Makefile target for this flow, `helm template`/
   `install` failed outright with "found in Chart.yaml, but missing in
   charts/ directory" unless someone had manually run `helm dependency
   update` out-of-band. Removed the dependency entirely (later the same day,
   restored as a *working* dependency instead of leaving it removed — see
   "Chart architecture: from two releases back to one" below).
2. **`.Values.openshell.chartVersion` and `.Values.openshell.workloadKind`
   don't exist** — the ConfigMap template referenced these instead of the
   real paths (`.Values.openshell.image.tag`, `.Values.openshell.workload.kind`),
   so the rendered `image.tag`/`workload.kind` overrides silently evaluated to
   empty strings. Fixed the references.
3. **`values.yaml` pinned images to `0.0.80`**, contradicting the Makefile's
   real `0.0.83` pin (see ADR-0006) — moot anyway because of bug #2, but fixed
   to `0.0.83` for when #2 is fixed.
4. **`scc-binding.yaml` was dead, unguarded, duplicate code** from before the
   "phase 2" ConfigMap-based refactor (superseded by `scc-rolebinding.yaml`),
   referencing a nonexistent `.Values.scc.serviceAccount` — crashed every
   render with a nil-pointer error. Deleted.
5. **`server.auth.allowUnauthenticatedUsers` had no default at all** — not
   just "renders empty" as this ADR previously (wrongly) assumed, but a hard
   nil-pointer crash on `helm template`/`install`. Added an explicit default
   (`true`, see Decision above for why that's safe).
6. **`deploy-openshell-infra` never passed `values-openshift.yaml`** — without
   it, `openshift.namespace.create` and `openshift.scc.privilegedSandbox`
   both default to `false`, so neither the `openshell` namespace nor the
   privileged SCC RoleBinding were ever created by this chart. Fixed the
   Makefile target to always pass `-f values-openshift.yaml` (this chart has
   no non-OpenShift use case).
7. **`namespace.yaml` and `scc-rolebinding.yaml` used `{{ .Release.Namespace
   }}`** instead of the fixed `{{ .Values.namespace }}` ("openshell") — since
   this release (`openshell-infra`) isn't installed with `--namespace`, that
   silently created/targeted the wrong namespace (usually `default`) and left
   `openshell` never created by this chart at all. The SCC RoleBinding's
   ServiceAccount subject also derived its name from *this* release
   (`openshell-infra` → `openshell-infra-sandbox`) instead of the separate
   `deploy-openshell-oci` release that actually owns the sandbox SA
   (`openshell` → `openshell-sandbox`) — fixed by setting
   `openshift.scc.serviceAccount` explicitly (see Decision #3 above).
8. **`deploy/Makefile`'s `ROOT_DIR` was miscomputed** (`dir` wrapped the
   wrong sub-expression), silently resolving to `.../deploy/Makefile`
   instead of the repo root — broke `openshell-sync-mtls` and every
   `test-*` target. Fixed the parenthesization.
9. **`validate-openclaw` used `oc exec -c agent`** to reach the gateway's
   health/CLI endpoints, but the gateway binds inside the sandbox's own
   isolated network namespace (unreachable from the "agent" container's
   netns) — always failed with "curl: (7) Failed to connect" even when the
   gateway was healthy. Switched to `openshell sandbox exec` (same mechanism
   `scripts/launch-openclaw.sh` already used for its own health check). Its
   JSON-parsing also checked fields (`status`, `result.payloads`) that don't
   exist in `openclaw agent --json`'s actual output shape, and mixed stderr
   into the JSON via `2>&1` — both fixed. Also documented that this CLI path
   runs OpenClaw's "embedded" fallback (no gateway device identity available
   to a bare CLI invocation), so it only proves MaaS connectivity, not the
   gateway+MLflow-trace path the UI actually exercises — that needs
   `make test-ui` + `validate-traces`.

None of these were caught earlier because a namespace, SCC RoleBinding, or
`charts/` vendor directory from an earlier manual/legacy run was always
already present, masking the fact that a truly fresh `helm install` of this
chart, with only the documented `make` targets, had only ever worked.

## Chart architecture: from two releases back to one (2026-08-05, later the same day)

Bug #1 above removed the dead `dependencies:` declaration rather than fixing it, and the
Decision section (at the time) described the resulting two-release/`ConfigMap` split as the
intended design, not a stopgap. On review, that split traded one problem for a worse one:

- Install values for the actual gateway lived only in a live `ConfigMap` in the cluster,
  extracted at deploy time (`oc get configmap ... -o jsonpath ... > /tmp/openshell-values.yaml`)
  rather than in a file in git — the opposite of this project's "declarative, no scripts"
  goal, and impossible to diff/review in a PR.
- The version pin moved to a Makefile variable (`OPENSHELL_OCI_VERSION`) invisible from the
  chart itself — exactly the kind of split-source-of-truth pin ADR-0006 exists to prevent.
- Two releases in two different namespaces (`openshell-infra` in `default`, `openshell` in
  `openshell`) for what is conceptually one deployable unit, needing two `helm uninstall`
  calls to tear down and a workaround (`.Values.namespace` instead of `.Release.Namespace`
  everywhere) to keep resource namespacing correct.

The original `dependencies:` declaration was dead not because a real Helm dependency can't
work here, but because of one specific mistake: `repository: oci://ghcr.io/nvidia/openshell/helm-chart`
pointed at the chart itself instead of its *parent* path — Helm's OCI dependency resolver
appends `name` (`helm-chart`) to `repository` itself, so that URL 404s
(`.../helm-chart/helm-chart`). The fix is `repository: oci://ghcr.io/nvidia/openshell` with
`name: helm-chart`. With that corrected, plus `alias: openshell` (so the existing
`openshell:`-nested values in `values.yaml` pass straight through, no restructuring needed),
`helm dependency build` resolves correctly and `helm template`/`install` render the whole
release — namespace extras and the gateway — as one unit. Verified: the subchart's own
sandbox ServiceAccount name already resolves to `openshell-sandbox` automatically (the
upstream chart bakes in `nameOverride: "openshell"`, combined with this chart's release
always being named `openshell`), so the manual `openshift.scc.serviceAccount` override from
bug #7 is no longer needed.

One genuine wrinkle from merging into a single release: Helm refuses to adopt a
pre-existing `Namespace` object into a release unless it already carries Helm's own
ownership annotations, so a chart-owned `Namespace` template combined with
`--create-namespace` (needed so the release can install into `openshell` before that
namespace exists) fails on a truly fresh install ("exists and cannot be imported... invalid
ownership metadata"). Resolved by dropping the chart's `namespace.yaml` template entirely,
installing with `--create-namespace`, and applying the one extra label this project needs
(`opendatahub.io/dashboard: "true"`) via a single idempotent `oc label` line in
`deploy/Makefile`'s `deploy-openshell` target instead of a chart-managed resource.

Net effect: `deploy-openshell-infra` and `deploy-openshell-oci` no longer exist as separate
Makefile targets — `deploy-openshell` is now the one target, installing the one release
(`openshell`, in namespace `openshell`), with the version pin living solely in
`Chart.yaml`'s `dependencies[].version` + the committed `Chart.lock`.

### One real bug surfaced by this merge: missing server certificate SANs

The old two-release ConfigMap design (bug list above) templated
`pkiInitJob.serverDnsNames` with the Route hostname
(`openshell-gw-openshell.<appsDomain>`) and a `*.<appsDomain>` wildcard — logic that
disappeared along with the ConfigMap when it was deleted, and was not initially replicated
in the merged single-release design. Without it, the subchart's certgen Job only signs the
server certificate for its own default SANs (in-cluster service names, `localhost`,
Podman/Docker-Desktop hostnames) — any client connecting through the external Route (the
`openshell` CLI over mTLS, `oc exec`-less CLI validation) fails with `invalid peer
certificate: certificate not valid for name "openshell-gw-openshell.<domain>"`. Fixed by
passing `openshell.pkiInitJob.serverDnsNames[0]`/`[1]` as two separate `--set` flags in
`deploy-openshell` (Route host + wildcard) — found and fixed 2026-08-05 during this same
merge's live validation pass.

One Make-specific pitfall hit while fixing this: `$(if $(APPS_DOMAIN),--set
"...{a,b}")` — a single `--set` with a brace-list value — silently truncates, because
Make's own `if` function treats a literal comma inside its argument as the
condition/true-text/false-text separator, not something `--set`'s syntax controls. Using
one `--set "...[N]=..."` per list element side-steps this entirely.

Also found in the same pass: the certgen Job's underlying `generate-certs` step is
idempotent and does **not** rotate an already-existing `openshell-server-tls` secret, even
across a `helm upgrade` that changes `serverDnsNames` — consistent with the mTLS
client-bundle fragility this ADR already documents (Context, constraint #19), just applying
to the server cert too. A `helm upgrade` alone will not pick up a SAN change on a
pre-existing release; a full `undeploy-openshell` + `deploy-openshell` (or manually deleting
the `openshell-server-tls` secret first) is required. Not a new gap this ADR needs to solve
— just a reminder that certificate changes to this chart need a clean namespace to actually
take effect, same as any other mTLS-affecting change.

## Validation

Validated on OpenShift with chart `0.0.83`, TLS + certgen hook, SCC via Helm RoleBinding, and post-install mTLS client bundle sync to the local CLI (`scripts/openshift-openshell-sync-mtls.sh`). Full procedure documented in [openshell-installation.md](../openshell-installation.md#openshift--rhoai-cluster-deployment) (that doc still describes an older single-chart flow in places — see `deploy/Makefile`'s `deploy-openshell` target as the source of truth for what's actually live).

Post-install verification:

```bash
oc -n openshell get rolebinding | grep privileged
oc -n openshell rollout status statefulset/openshell
helm list -n openshell
GATEWAY_NAME=<name shown in `openshell gateway list`> make -C deploy openshell-sync-mtls
```

## Demo Impact

The "Security Attack" demo segment uses OpenShell to show agent execution isolation — the sandbox prevents data exfiltration even when the guardrails are bypassed.

## Related Decisions

- [ADR-0006: Explicit version pinning](0006-explicit-version-pinning.md) — chart version is pinned per this policy.
- [ADR-0011: OpenClaw UI authentication](0011-ui-auth-openshift-oauth-proxy.md) — covers browser auth for the Control UI, separate from this ADR's mTLS-only CLI/gRPC auth.

## References

- [OpenShell on OpenShift](https://docs.nvidia.com/openshell/latest/kubernetes/openshift)
- [Helm chart README — Secret bootstrap](https://github.com/NVIDIA/OpenShell/blob/main/deploy/helm/openshell/README.md#secret-bootstrap)
- [Kubernetes Setup — TLS client bundle](https://docs.nvidia.com/openshell/kubernetes/setup)
- [Red Hat build of Agent Sandbox — Install](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.12/html/deploying_red_hat_build_of_agent_sandbox/install-agent-sandbox-overview_agent-sandbox)
- [Agent Sandbox upstream](https://github.com/kubernetes-sigs/agent-sandbox)
- Reference project: deployment-ordering and mTLS-fragility lessons (constraints #10, #12, #19), merged in from a since-retired duplicate ADR — see note below

## Note on merged ADR (2026-08-05)

This ADR and a second one — written independently during the initial
migration of learnings from the reference project and (after a numbering-collision fix)
numbered `0009-openshell-deployment-method.md` — ended up documenting the
same decision: deploying OpenShell via this project's wrapper Helm chart.
Neither ADR was cross-checked against the other when written. The unique,
accurate content from `0009` (deployment ordering vs. RHOAI, mTLS-upgrade
fragility, and the `ConfigMap`/`global.appsDomain` mechanism) has been
merged into this ADR — along with two gaps this merge review uncovered
that neither original ADR had flagged: an unset `allowUnauthenticatedUsers`
default, and an Agent Sandbox controller that gets installed via two
different, unreconciled paths. `0009` itself has been deleted; per the
"sequential, never reused" convention in
[docs/adr/README.md](README.md), `0009` is now permanently retired
alongside `0005` and the original `0007`, not reassigned.
