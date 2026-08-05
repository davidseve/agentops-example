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
- **Gateway auth mode**: `trusted-proxy` — the gateway trusts the
  `x-forwarded-email` identity header set by the proxy chain, but only from
  the pod/service network CIDRs (see "Gateway auth mode" investigation
  below for why this replaced an initial `none` decision).
- **TLS**: Route uses `reencrypt` (oauth-proxy terminates TLS with service-CA cert)
- **Session**: Cookie-based, 168h expiry, 1h refresh
- **Service exposure**: `openshell service expose openclaw-gw 18789 openclaw-ui` registers
  the service in the relay's routing table.

### Session secret

Created out-of-band via `oc create secret generic` (not Helm-templated) so it
survives `helm uninstall`. Generated from `openssl rand -base64 32`.

### What `oauth-proxy` actually does (and does not do)

`oauth-proxy` is generic — it knows nothing about OpenClaw or sandboxes. Per
request:

1. Route (`reencrypt` TLS) → Service `https` → container port `8443`
   (`--https-address=:8443`, `--http-address=` disables plaintext).
2. No valid session cookie → redirects to OCP's own OAuth login, using the
   `openclaw-ui-oauth-proxy` ServiceAccount as an OAuth client (via the
   `oauth-redirectreference.primary` annotation — no cluster-scoped
   `OAuthClient` needed). `--skip-provider-button=true` skips the
   "choose provider" screen (only one IdP is registered).
   `--email-domain=*` accepts **any** authenticated cluster user — there is
   no additional group/role restriction today (tracked as a follow-up, same
   gap noted in the reference project's ADR-0016).
3. Valid session → forwards to `--upstream=http://127.0.0.1:8090` (the nginx
   bridge, see below), injecting identity headers via
   `--pass-user-headers=true` (`X-Forwarded-Email`, `X-Forwarded-User`,
   `X-Forwarded-Preferred-Username`) and `--pass-access-token=true`.
   nginx unconditionally overwrites `Host` before forwarding to the relay,
   regardless of what it receives from oauth-proxy.
4. Session cookie: signed with `--cookie-secret-file`, `--cookie-expire=168h`,
   `--cookie-refresh=1h`.

`oauth-proxy` only answers "is this a real, authenticated cluster user?". It
does **not** do mTLS to its upstream, and does **not** perform any
per-action authorization (that lives in `tools.deny` / `policies/openclaw-sandbox.yaml`).

### Root cause of why mTLS (and therefore nginx) is required here

Investigated directly in the OpenShell gateway source
(`/home/dseveria/git/ai/agents/OpenShell`), not assumed. The relay's TLS
listener decides whether to require a client certificate with a single
formula:

```300:301:crates/openshell-server/src/cli.rs
require_client_auth: has_client_ca && !has_oidc,
```

i.e. **mTLS is required only when a client CA is configured AND no OIDC
issuer is configured.** Confirmed in `crates/openshell-server/src/tls.rs`:
with `require_client_auth: false`, client certs are validated if presented
but not required (`allow_unauthenticated()` on the verifier); with
`client_ca_path: None`, no client cert is requested at all.

This exactly explains the difference from the reference project:

| | agentops-example | open-claw-in-openshell |
|---|---|---|
| Client CA (PKI) | Yes | Yes |
| `server.oidc.issuer` | Not configured (no Keycloak) | Configured (Keycloak) |
| `require_client_auth` | `true` → mTLS mandatory | `false` → client cert optional |
| `oauth-proxy` upstream | Needs client cert → nginx bridge | Direct HTTPS + `--upstream-ca`, no bridge |

### Why we rejected "just add Keycloak/OIDC to remove the nginx bridge"

This was explicitly considered and rejected after reading
`crates/openshell-server/src/service_routing.rs`'s `proxy_to_endpoint`
(the function that handles all browser HTTP/WebSocket traffic to an exposed
sandbox service — exactly the path `oauth-proxy` uses). It resolves the
`Host` header to a `ServiceEndpoint`, checks the sandbox is `Ready`, and
opens a relay tunnel — **it performs no token/JWT/identity check anywhere**.
The only header handling present is stripping inbound `Authorization`/
`CF-Access-*` headers before forwarding (hygiene, not authentication).

Consequence: enabling OIDC on OpenShell to flip `require_client_auth` to
`false` would remove the mTLS requirement on this path **without
substituting any equivalent check** — this specific HTTP browser path has
no application-layer authentication in OpenShell itself, unlike the
gRPC/CLI management API (`sandbox create/connect`, etc.), which does gain a
real JWT check under OIDC. The only remaining gate for the browser path in
that scenario would be whatever `NetworkPolicy` restricts reaching the
`openshell` Service, plus `oauth-proxy` itself (unchanged either way).

**Decision**: keep the nginx mTLS bridge. It preserves a real, mandatory
transport-level authentication boundary (mTLS) on the relay for the
browser/service-routing path, at the cost of one small, self-contained
sidecar (ConfigMap + container, ~32Mi RAM) — cheaper and more secure than
trading it for a whole new Keycloak deployment that provides no equivalent
protection on this specific path. Revisit only if OpenShell adds an
application-layer auth check to `service_routing.rs` itself, or if Keycloak
gets adopted anyway for the CLI/gRPC path for unrelated reasons (in which
case removing the bridge becomes a safe side effect).

### Security finding and fix (2026-08-05): mTLS bridge was reachable from any pod in the cluster

The nginx bridge's `listen 8090;` directive (no bind address) listened on
**all interfaces** (`0.0.0.0:8090`) inside the `oauth-proxy` Pod. The
`oauth-proxy` Service only exposes port `8443` — port `8090` has no
Service/Route — but that alone does not block Pod-IP-level traffic in
Kubernetes: absent a `NetworkPolicy`, any other Pod in the cluster that
could reach the `oauth-proxy` Pod's IP could connect directly to
`<pod-ip>:8090` and tunnel through the mTLS bridge straight to the
OpenShell relay, **completely bypassing `oauth-proxy`'s OCP OAuth check**.
Verified live: an ephemeral test Pod (`oc run curl-test ...`) could reach
`http://<oauth-proxy-pod-ip>:8090/health` before the fix, and got connection
refused after it.

**Fix**: bind nginx explicitly to loopback — `listen 127.0.0.1:8090;`
(`deploy/helm/oauth2-proxy/templates/nginx-configmap.yaml`). Since both
containers share the Pod's network namespace, `oauth-proxy` can still reach
nginx via `127.0.0.1`, but no other Pod can, regardless of `NetworkPolicy`.
Verified post-fix: `ss -tlnp` inside the bridge container shows
`127.0.0.1:8090` (was `0.0.0.0:8090`); `oauth-proxy` → nginx health check
still succeeds; an external test Pod hitting the Pod IP on `8090` now gets
connection refused.

**Residual gap**: there is still no `NetworkPolicy` restricting ingress to
the `oauth-proxy` Pod on port `8443` (the externally-routed port) from
arbitrary in-cluster sources — today this relies on the Route/Service being
the only intended path. Loopback-binding the *internal* bridge port closes
the specific lateral-movement bypass found here; a `NetworkPolicy` for
defense-in-depth on `8443` is a reasonable future hardening step, not yet
implemented.

### Gateway auth mode: why we tried `none`, then reverted to `trusted-proxy` (2026-08-05)

While debugging an "Auth required" error in the Control UI, `gateway.auth.mode`
was changed from `trusted-proxy` to `none` (with `bind: loopback`) as a
pragmatic fix under time pressure. This was **wrong to leave in place** —
`trusted-proxy` is strictly better (it forwards real per-user identity from
`x-forwarded-email` into OpenClaw's audit/ownership model instead of every
request looking like an anonymous local user) and was already validated as
working in `open-claw-in-openshell` (its ADR-0012 covers the same header
contract in depth). Re-investigated instead of assuming either config was
right, per this project's restrictive-credentials principle:

- **What `auth: none` actually bought us**: nothing that `trusted-proxy`
  doesn't also provide, since both configurations already require `bind:
  loopback` (only reachable via the proxy chain). `none` additionally
  discards the caller's real identity, which is a strict regression for
  audit/ownership — not an acceptable trade even temporarily.
- **The real failures were elsewhere**, and `auth: none` only masked them by
  coincidence of timing. Root-caused each one directly from gateway logs and
  fixed at the source instead of re-reaching for `auth: none`:
  1. **`allowedOrigins` mismatch** — the WebSocket handshake's `Origin` header
     (the Control UI's own route hostname) wasn't in
     `gateway.controlUi.allowedOrigins`, causing "Browser origin not allowed".
     Fixed by adding the actual route hostname to the template.
  2. **Sandbox UID misdetection** — `launch-openclaw.sh` used `id -u` inside
     the sandbox pod's `agent` container (returns `0`/root, the `exec`
     process's own UID) instead of `id -u sandbox` (the actual `sandbox` user
     OpenClaw runs as). Ownership fixups then chowned files to root, and the
     `sandbox` user's subsequent write attempts failed with permission errors
     that surfaced as opaque gateway startup failures.
  3. **Unpinned OpenClaw version drift** — `npm install -g openclaw` (no
     version pin) had drifted to a release whose stricter gateway config
     validation rejected `gateway.terminal` as an unrecognized key. See
     ADR-0006 for the full fix (pin `2026.6.34`, remove the unsupported key).
  4. **Stale `openclaw.json.bak*` files** — from earlier iteration days, with
     no `meta.lastTouchedVersion`. OpenClaw's own config-integrity check
     compared our fresh (also meta-less) upload against these backups,
     flagged a `missing-meta-vs-last-good` anomaly, and on one run silently
     **restored the stale backup** — which had `auth.mode: token` and
     `bind: auto`, depending on an `OPENCLAW_GATEWAY_TOKEN` env var we'd
     since stopped passing. Fixed by having `launch-openclaw.sh` delete
     `openclaw.json.bak*` before every fresh upload — our template is the
     single declarative source of truth, so a stale backup silently winning
     is itself a bug, not a feature, for this project's GitOps approach.
- **Verified `trusted-proxy` end-to-end** after each fix: confirmed via nginx
  bridge logs that `x-forwarded-email`, `x-forwarded-proto`, and
  `x-forwarded-host` all reach the gateway correctly on WebSocket upgrades
  (not just plain HTTP), including through the full chain (browser →
  oauth-proxy → nginx mTLS bridge → OpenShell relay → gateway). Full
  Playwright suite (19 tests: auth, UI, security, MLflow tracing) passes
  against `trusted-proxy`.
- `gateway.trustedProxies` CIDRs are now injected dynamically by
  `launch-openclaw.sh` from `oc get network.config cluster` (pod/service
  network) rather than hardcoded — the original hardcoded values were
  copied from the reference project's CRC cluster and didn't match this
  OCP sandbox's actual network ranges (another instance of not blindly
  trusting a reference-project config value).

## Consequences

- Any OCP cluster user can log in to the UI (HTPasswd, LDAP, any configured IdP)
  — no additional group/role restriction yet (see "What oauth-proxy does" above)
- No Keycloak deployment needed (simpler, fewer moving parts) — and, per the
  investigation above, adding it later would **not** actually remove the
  need for a transport-level authentication boundary on the browser path,
  since OpenShell's service-routing has no application-layer auth check of
  its own
- The direct `openclaw-gw` route (without auth) is removed
- WebSocket connections work through the proxy after OAuth login, including
  header propagation (`x-forwarded-email` etc.) required by `trusted-proxy`
- Gateway binds to loopback with `auth: trusted-proxy` — the proxy chain is
  still the only reachability path (unchanged from the `none` alternative),
  but the gateway now also receives and trusts real per-user identity
  instead of treating every request as anonymous
- nginx sidecar adds minimal overhead (~32Mi RAM) but solves mTLS without custom proxy builds;
  it **must** bind to `127.0.0.1` only (see security finding above) — any future edit to
  `nginx-configmap.yaml` must preserve `listen 127.0.0.1:8090;`
- No `NetworkPolicy` yet restricts ingress to the `oauth-proxy` Pod itself (tracked as a
  follow-up; not currently exploitable the way the nginx bridge was, since `8443` is the
  intended external entry point, but still a defense-in-depth gap)

## References

- [ADR-0006: Explicit Version Pinning](0006-explicit-version-pinning.md) — OpenClaw npm version pin, found missing during this investigation
- open-claw-in-openshell: ADR-0016 (OpenShift-native OAuth spike)
- open-claw-in-openshell: ADR-0012 (Trusted-Proxy Auth — `x-forwarded-email` header contract)
- open-claw-in-openshell: charts/oauth2-proxy/
- OpenShift docs: Using service accounts as OAuth clients
- OpenShell source: `crates/openshell-server/src/cli.rs` (`require_client_auth` formula),
  `crates/openshell-server/src/tls.rs` (client-cert verifier modes),
  `crates/openshell-server/src/service_routing.rs` (`proxy_to_endpoint` — no app-layer auth
  on the browser/service-routing path)
