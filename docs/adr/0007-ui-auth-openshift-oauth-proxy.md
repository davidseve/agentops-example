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
Browser → oauth-proxy (reencrypt Route, OCP OAuth)
       → nginx sidecar (mTLS with client cert to relay)
       → OpenShell relay (port 8080, service-routing by Host header)
       → sandbox openclaw-gw → OpenClaw gateway :18789 (loopback)
```

### Key implementation details

- **Route hostname**: `openclaw-gw--openclaw-ui.{APPS_DOMAIN}` — matches OpenShell's
  `{sandbox}--{service}` routing pattern
- **nginx mTLS bridge**: The oauth-proxy upstream is `http://127.0.0.1:8090` (nginx sidecar).
  Nginx handles mTLS with the OpenShell relay using `openshell-client-tls` cert/key and
  `openshell-server-tls` CA. This is required because the relay enforces client certificate
  authentication and `ose-oauth-proxy` doesn't support `--upstream-client-cert-file`.
- **Gateway auth mode**: `none` — safe because the gateway binds to `loopback` only; all
  external access passes through OCP OAuth + mTLS. No `OPENCLAW_GATEWAY_TOKEN` needed.
- **TLS**: Route uses `reencrypt` (oauth-proxy terminates TLS with service-CA cert)
- **Session**: Cookie-based, 168h expiry, 1h refresh
- **Service exposure**: `openshell service expose openclaw-gw 18789 openclaw-ui` registers
  the service in the relay's routing table.

### Session secret

Created out-of-band via `oc create secret generic` (not Helm-templated) so it
survives `helm uninstall`. Generated from `openssl rand -base64 32`.

## Consequences

- Any OCP cluster user can log in to the UI (HTPasswd, LDAP, any configured IdP)
- No Keycloak deployment needed (simpler, fewer moving parts)
- The direct `openclaw-gw` route (without auth) is removed
- WebSocket connections work through the proxy after OAuth login
- Gateway binds to loopback with `auth: none` — secured by the proxy chain, not by token
- nginx sidecar adds minimal overhead (~32Mi RAM) but solves mTLS without custom proxy builds

## References

- open-claw-in-openshell: ADR-0016 (OpenShift-native OAuth spike)
- open-claw-in-openshell: charts/oauth2-proxy/
- OpenShift docs: Using service accounts as OAuth clients
