# ADR-0007: OpenClaw UI Authentication via OpenShift-native OAuth Proxy

**Status**: Accepted  
**Date**: 2026-08-04  
**Source**: open-claw-in-openshell (ADR-0016)

## Context

The OpenClaw Control UI (WebSocket-based browser app) needs authentication.
Without it, anyone with the route URL can connect to the gateway.

Options considered:
1. **Keycloak** — Full OIDC IdP, federation with OCP users via broker
2. **OpenShift-native oauth-proxy** — Lightweight proxy using OCP's built-in OAuth
3. **Gateway token only** — OPENCLAW_GATEWAY_TOKEN in the browser (no SSO)

## Decision

Use **OpenShift-native oauth-proxy** (`registry.redhat.io/openshift4/ose-oauth-proxy`)
with `--provider=openshift`. This fork supports SA-based OAuth clients via the
`serviceaccounts.openshift.io/oauth-redirectreference` annotation — no cluster-scoped
`OAuthClient` and no Keycloak needed.

### Why not Keycloak?

- Keycloak adds operational complexity (Postgres, Realm config, broker setup)
- The browser UI only needs "is this user allowed on this cluster?" — OCP OAuth answers that directly
- Keycloak was only needed in the reference project for CLI/gRPC OIDC (which we don't use)

### Architecture

```
Browser → oauth-proxy (reencrypt Route) → OpenShift OAuth login → callback
       → oauth-proxy proxies to openshell:8080 (Host: openclaw-gw--openclaw-ui)
       → OpenShell service-routing → sandbox openclaw-gw → OpenClaw gateway :18789
```

### Key implementation details

- **Route hostname**: `openclaw-gw--openclaw-ui.{APPS_DOMAIN}` — matches OpenShell's
  `{sandbox}--{service}` routing pattern (works around a WebSocket Host-header bug
  in the OpenShift oauth-proxy fork)
- **hostAlias**: Deployment uses Helm `lookup` to resolve `openshell` Service ClusterIP
  so the upstream dials the gateway directly without looping through the Route
- **TLS**: Route uses `reencrypt` (oauth-proxy terminates TLS with service-CA cert)
- **Session**: Cookie-based, 168h expiry, 1h refresh
- **Auth headers**: `--pass-user-headers=true` passes `X-Forwarded-Email` etc. to
  the gateway (matches OpenClaw's `trusted-proxy` auth mode with `userHeader: x-forwarded-email`)

### Session secret

Created out-of-band via `oc create secret generic` (not Helm-templated) so it
survives `helm uninstall`. Generated from `openssl rand -base64 32`.

## Consequences

- Any OCP cluster user can log in to the UI (HTPasswd, LDAP, any configured IdP)
- No Keycloak deployment needed (simpler, fewer moving parts)
- The direct `openclaw-gw` route (without auth) is removed
- WebSocket connections work through the proxy after OAuth login
- CLI access still uses `OPENCLAW_GATEWAY_TOKEN` via `openshell sandbox exec`

## References

- open-claw-in-openshell: ADR-0016 (OpenShift-native OAuth spike)
- open-claw-in-openshell: charts/oauth2-proxy/
- OpenShift docs: Using service accounts as OAuth clients
