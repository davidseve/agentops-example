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
| OpenShell Helm chart | `0.0.80` | `deploy/helm/openshell/Chart.yaml` |
| Dependent operators | <!-- TODO: pin CSVs --> | `deploy/helm/` Subscriptions |
| Container images | digest where possible, tag as fallback | `deploy/` values files |

## Related Decisions

- [ADR-0003: OpenShell deployment](0003-openshell-deployment-on-openshift.md) — chart version pinned per this policy.

## References

- [RHOAI Supported Configurations 3.x](https://access.redhat.com/articles/rhoai-supported-configs-3.x)
