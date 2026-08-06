# ADR-0006: Explicit Version Pinning Policy

## Status

Accepted

## Date

2026-07-13

## Layer

Cross-cutting

## Context

The demo runs on demo.redhat.com / RHPDS environments where operator catalog updates can arrive at any time. An unexpected operator upgrade during or before a live demo could break the platform stack. The demo must be reproducible across different cluster provisions.

## Options Considered

### Option 1: Follow operator default channels (automatic updates)

- **Pros:** Always on the latest version; no manual maintenance.
- **Cons:** Upgrades can break the demo without warning; not reproducible across cluster provisions.

### Option 2: Pin all operator CSVs, chart versions, and image tags

- **Pros:** Fully reproducible; upgrades are deliberate and tested; each version bump is an explicit commit.
- **Cons:** Requires manual tracking of upstream releases; may fall behind security patches.

## Decision

Pin every operator, Helm chart, and container image to an explicit version. Upgrades are tracked as individual commits in the repo. No automatic channel updates.

## Consequences

### Positive

- Demo is reproducible regardless of when the cluster was provisioned.
- No surprise breakage from upstream releases.
- Version history is traceable in git.

### Negative

- Must manually monitor upstream releases for security patches and new features.
- Risk of running stale versions if not actively maintained.

## Version Pinning

| Component | Pinned version | Where enforced |
|---|---|---|
| RHOAI operator | <!-- TODO: pin CSV --> | `deploy/helm/` Subscription |
| OpenShell OCI chart (gateway) | `0.0.83` | `deploy/helm/openshell/Chart.yaml` (`dependencies[].version`) + committed `Chart.lock` — the actual, enforced pin (moved here 2026-08-05, see note below; previously a Makefile variable, and briefly a dead, unenforced `dependencies:` entry before that) |
| Agent Sandbox Operator (OLM) | channel `preview-0.9`, CSV `agent-sandbox-operator.v0.9.0` | `deploy/helm/operators/values.yaml` — sole source of controller/router/CRDs (OSC 1.13 TP; raw upstream manifest retired 2026-08-06) |
| OpenClaw (npm, in-sandbox) | `2026.6.34` | `scripts/launch-openclaw.sh` (`OPENCLAW_PIN`) |
| `@mlflow/mlflow-openclaw` (npm, in-sandbox) | `0.2.0-rc.0` | `scripts/launch-openclaw.sh` |
| Dependent operators | <!-- TODO: pin CSVs --> | `deploy/helm/` Subscriptions |
| Container images | digest where possible, tag as fallback | `deploy/` values files |

**Reviewed and not applicable (Aug 2026 OSC 1.13 blog):** Confidential AI on bare metal GA, Red Hat build of Trustee 1.2, and post-quantum attestation readiness — this project does not use Trustee or confidential computing. Tracked only so future readers know the release was evaluated.

**Found unpinned during ADR-0011 investigation (2026-08-05)**: `launch-openclaw.sh`
ran unpinned `npm install -g openclaw` (whatever "latest" resolved to at exec
time), which had drifted to `2026.6.33` — a release whose gateway config
validation rejects `gateway.terminal` as an unrecognized key
(`gateway: Unrecognized key: "terminal"`), causing gateway startup to fail
with "Invalid config". The reference project pins `2026.7.1`, but that
release raised its Node engine requirement to `>=22.22.3` while this
sandbox's base image ships Node `v22.22.1` — installing it makes `openclaw`
refuse to run at all. Settled on `2026.6.34`: newest release compatible with
this sandbox's Node (`engines: >=22.19.0`) whose `openclaw doctor` accepts
`gateway.terminal` without complaint. This is exactly the failure mode this
ADR exists to prevent — a lesson learned the hard way, not just a
hypothetical, and a reminder that reference-project pins can't be copied
blindly when the runtime environment differs (see also ADR-0011's `auth.mode`
investigation for the same lesson applied to config, not just versions).

**Follow-on config gap**: `2026.6.34`'s `gateway` schema has no `terminal`
property at all (confirmed via `openclaw config schema`) — it's a
`2026.7.x`-only hardening knob (`gateway.terminal.enabled: false`, disables
the gateway's built-in web terminal) that the reference project sets and
we copied verbatim. On `2026.6.34` the runtime's strict Zod validation
rejects it outright (`gateway: Invalid input`, only surfaced at actual
gateway startup — `openclaw doctor` does not catch it), so it was removed
from `config/openclaw.json.tpl`. **TODO**: re-add `gateway.terminal.enabled:
false` once the sandbox base image ships Node `>=22.22.3` and `OPENCLAW_PIN`
can move to `2026.7.1`+.

**Found a self-contradicting pin during a from-scratch redeploy test (2026-08-05)**:
this ADR, `docs/stack-decisions.md`, and `docs/openshell-installation.md` all
claimed the OpenShell chart was pinned to `0.0.80` — even asserting this was
*deliberately different* from the reference project's `0.0.83`. In reality,
`deploy/Makefile`'s `OPENSHELL_OCI_VERSION` (the variable that actually drives
the live `helm upgrade --install openshell oci://.../helm-chart --version
...` command) has always been `0.0.83`; `0.0.80` only ever existed as a dead
`dependencies:` entry in `deploy/helm/openshell/Chart.yaml` that no template
in that chart actually rendered (removed — see ADR-0003). Nobody had verified
the "0.0.80, not 0.0.83" claim against what actually gets installed — a
textbook case of exactly what this ADR exists to prevent, and a repeat of the
OpenClaw npm-pin lesson above: written-down pins drift from reality unless a
from-scratch deploy periodically proves them.

**Pin relocated to the chart itself (2026-08-05, later the same day)**: the dead
`dependencies:` entry above was dead because of one specific mistake (an OCI `repository:`
path pointing at the chart instead of its parent — see ADR-0003's "Chart architecture" section
for the fix), not because a real Helm dependency can't work here. With that fixed, the
version pin now lives in `Chart.yaml`'s `dependencies[].version` plus the committed
`Chart.lock` (Helm's own digest-pinning mechanism) — visible by reading the chart alone,
instead of a Makefile variable a reader would have no reason to cross-check against the
chart. `deploy/Makefile`'s `deploy-openshell` target no longer has its own version variable
for this component at all.

## Related Decisions

- [ADR-0003: OpenShell deployment](0003-openshell-deployment-on-openshift.md) — chart version pinned per this policy.

## References

- [RHOAI Supported Configurations 3.x](https://access.redhat.com/articles/rhoai-supported-configs-3.x)
