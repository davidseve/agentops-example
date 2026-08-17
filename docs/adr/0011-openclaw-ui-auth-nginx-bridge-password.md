# ADR-0011: OpenClaw UI Authentication via nginx mTLS Bridge + Password

> **File rename (2026-08-17):** formerly `0011-ui-auth-openshift-oauth-proxy.md`. The slug reflected an abandoned oauth-proxy approach; the accepted decision is nginx mTLS bridge + OpenClaw password auth.

**Status**: Accepted (updated 2026-08-06)  
**Date**: 2026-08-04  
**Layer**: Agent  
**Source**: Migrated learnings from a reference OpenShell/OpenClaw deployment (its ADR-0016); revised 2026-08-06 to drop oauth-proxy

## Context

The OpenClaw Control UI (WebSocket-based browser app) needs authentication.
Without it, anyone with the route URL can connect to the gateway.

The OpenShell relay additionally requires **mTLS client certificates** when a
client CA is configured and no OIDC issuer is set
(`require_client_auth = has_client_ca && !has_oidc`). Browsers cannot present
those certs, so something in front of the relay must.

### Options considered

1. **Keycloak** — Full OIDC IdP, federation with OCP users via broker
2. **OpenShift-native oauth-proxy + nginx mTLS bridge** — OCP SSO for the
   browser, nginx presents client certs to the relay, OpenClaw
   `trusted-proxy` trusts `X-Forwarded-Email` (initial 2026-08-04 decision)
3. **Gateway token only** — `OPENCLAW_GATEWAY_TOKEN` in the browser (no SSO)
4. **nginx sole entrypoint + OpenClaw password** — drop oauth-proxy; nginx
   keeps mTLS to the relay; OpenClaw `gateway.auth.mode: password` protects
   the WebSocket (chosen 2026-08-06)
5. **Direct Route to OpenShell (drop mTLS)** — empty `clientCaSecretName` or
   point `server.oidc.issuer` at OCP OAuth — **not viable** with the current
   OpenShell chart / OCP OAuth (see "Rejected alternatives" below)

## Decision (2026-08-06)

Use **nginx as the sole browser entrypoint** with mTLS to the OpenShell
relay, and **OpenClaw password auth** for the Control UI WebSocket.

Per-user OCP identity is **not** a current requirement. Keeping
`ose-oauth-proxy` solely to inject `X-Forwarded-Email` added a fragile
stack (OpenShift oauth-proxy fork with an unfixed WebSocket Host-header
bug, session secrets, SA OAuth annotations, hostname unification) without
buying a needed capability.

### Architecture

```
Browser → Route (reencrypt, openclaw-gw--openclaw-ui.<APPS_DOMAIN>)
       → nginx openclaw-ui-proxy (:8443, service-CA TLS)
       → OpenShell relay (:8080, mTLS client cert)
       → sandbox openclaw-gw → OpenClaw gateway :18789 (password auth)
```

Chart: [`deploy/helm/openclaw-ui-proxy/`](../../deploy/helm/openclaw-ui-proxy/)  
Deploy: `APPS_DOMAIN=<domain> make -C deploy deploy-openclaw-ui-proxy`

### Key implementation details

- **Route hostname**: `openclaw-gw--openclaw-ui.{APPS_DOMAIN}` — matches
  OpenShell's `{sandbox}--{service}` routing pattern. nginx overwrites
  `Host` before forwarding to the relay.
- **nginx mTLS bridge**: Listens on `:8443` with an OpenShift
  service-serving certificate. Proxies to the openshell Service ClusterIP
  with `openshell-client-tls` cert/key and `openshell-server-tls` CA.
- **Gateway auth mode**: `password` — shared secret from
  `OPENCLAW_GATEWAY_PASSWORD` (injected into `config/openclaw.json.tpl` by
  `launch-openclaw.sh`). Users enter it in Control UI settings or open
  `/?password=...`. Passwords are **not** persisted across Control UI
  reloads (OpenClaw behaviour); Playwright uses `/?password=` via
  [`tests/helpers.ts`](../../tests/helpers.ts).
- **TLS**: Route uses `reencrypt` (nginx terminates with service-CA cert;
  the OpenShift router presents the cluster edge cert to the browser).
- **Service exposure**: `openshell service expose openclaw-gw 18789 openclaw-ui`
  registers the service in the relay's routing table.
- **No oauth-proxy**: No ServiceAccount OAuth client, no session cookie
  secret, no OCP login redirect.

### Why keep nginx (and mTLS)?

The relay still requires client certificates with the default OpenShell
Helm install (`pkiInitJob.enabled=true` always mounts a client CA and
always sets `client_ca_path` in `gateway.toml`). Dropping nginx without
also disabling that requirement leaves the browser unable to complete the
TLS handshake to the relay.

nginx is a small, self-contained bridge (~32Mi RAM) that solves exactly
that transport problem. OpenClaw password auth is the application-layer
gate for chat, tools, and MaaS.

### Rejected alternatives (2026-08-06 investigation)

| Alternative | Why rejected |
|---|---|
| `server.tls.clientCaSecretName: ""` with `pkiInitJob` | Chart still mounts the server CA as client CA and always emits `client_ca_path` — mTLS stays required. Docs that say "set to empty to disable mTLS" only apply to the cert-manager volume path, and even that leaves a broken config path. Unfixed through OpenShell chart `0.0.90`. |
| Point `server.oidc.issuer` at OpenShift OAuth | OCP OAuth is **not** OIDC-compatible with OpenShell's `OidcAuthenticator` (needs `/.well-known/openid-configuration` + JWKS + RS256 JWTs; OCP provides OAuth 2.0 discovery + opaque tokens). Gateway fails at startup. Confirmed in the reference project's ADR-0010 / ADR-0016. |
| Deploy Keycloak solely to flip `require_client_auth` | Works technically (real OIDC → client certs optional → direct Route), but reintroduces the IdP complexity this project deliberately avoided. Revisit if Keycloak is needed for CLI/gRPC for other reasons. |
| Post-renderer strip of `client_ca_path` | Would enable a direct Route without nginx, but is a Helm-bypass hack that `helm upgrade` can overwrite. Acceptable for a lab spike; not chosen while nginx already exists and is well understood. |
| Keep oauth-proxy + `trusted-proxy` | Per-user OCP identity is not required; oauth-proxy's WebSocket Host-header bug forced hostname unification workarounds. Complexity without benefit. |

### What we lose vs the previous oauth-proxy design

- **Per-user identity / audit trail** in OpenClaw — all browser users share
  one password.
- **OCP SSO** — users type a password (or use `/?password=`) instead of
  clicking through the cluster login.

### Historical note: oauth-proxy era (2026-08-04 → 2026-08-06)

The previous architecture was:

```
Browser → oauth-proxy (OCP OAuth) → nginx (loopback :8090) → relay (mTLS) → gateway (trusted-proxy)
```

Notable findings from that period that remain true and should not be
re-litigated without new upstream evidence:

- **mTLS formula**: `require_client_auth = has_client_ca && !has_oidc`
  in OpenShell `crates/openshell-server/src/cli.rs` / `tls.rs`.
- **service_routing has no app-layer auth**: enabling OIDC on OpenShell
  only makes client certs optional on the browser path; it does **not**
  authenticate HTTP/WebSocket service routing
  (`crates/openshell-server/src/service_routing.rs` → `proxy_to_endpoint`).
- **nginx as an *internal* bridge must bind loopback** (fixed 2026-08-05).
  The current chart listens on `:8443` intentionally — that port *is* the
  external entrypoint, exposed only via Service/Route.
- **Misattributed auth failures** (2026-08-05): `allowedOrigins`, sandbox
  UID detection, unpinned OpenClaw version, stale `openclaw.json.bak*` —
  fixes remain in `launch-openclaw.sh`.

## Consequences

- Browser users share one `OPENCLAW_GATEWAY_PASSWORD` (no per-user OCP identity)
- Static Control UI assets are reachable without the password; chat / tools /
  MaaS require an authenticated WebSocket
- CLI/gRPC path unchanged: mTLS client certs + `allowUnauthenticatedUsers: true`
- No Keycloak, no oauth-proxy, no OAuth session secret
- WebSocket works through nginx without the oauth-proxy Host-header bug
- Playwright tests authenticate via `/?password=` (`tests/helpers.ts`)

---

## Future improvement map (revisit when upstream changes)

This section is the playbook for simplifying or hardening auth later.
Do **not** re-open rejected paths unless one of the triggers below fires
with concrete evidence (chart version, commit, or OpenClaw release notes).

### Current pain points (what we would like to delete)

| Pain | Why it exists today | Ideal end state |
|---|---|---|
| nginx `openclaw-ui-proxy` Deployment | OpenShell requires client certs; browsers cannot present them | Direct Route → `openshell` Service (HTTPS only) |
| Shared `OPENCLAW_GATEWAY_PASSWORD` | Per-user identity not required; simplest OpenClaw gate | Per-user identity *if* the product needs it (SSO / trusted-proxy / OIDC) |
| Password not persisted in Control UI | OpenClaw stores tokens, not passwords, across reloads | Persist password, or prefer token/OIDC UX for demos |
| ClusterIP baked into nginx ConfigMap via Helm `lookup` | nginx upstream needs the openshell Service IP at render time | Service DNS name if TLS/SNI allows, or drop nginx entirely |

### Desired target architectures (ranked simplest → richest)

**A — Direct Route + OpenClaw password** (best simplicity win)

```
Browser → Route → OpenShell relay (TLS, no client cert) → gateway (password)
```

Requires OpenShell to run HTTPS **without** mandatory client auth while
keeping `pkiInitJob` for JWT/server certs. Deletes
`deploy/helm/openclaw-ui-proxy/` entirely.

**B — Direct Route + OpenClaw trusted-proxy behind a thin IdP** (SSO)

```
Browser → IdP/proxy → OpenShell relay → gateway (trusted-proxy)
```

Only if per-user identity becomes a requirement. Prefer a proxy that
handles WebSocket Host correctly (community oauth2-proxy after the
Host-header fix, or nginx `auth_request`). Do **not** revive
`ose-oauth-proxy` until its WebSocket `passHostHeader` bug is fixed.

**C — OpenShell-native browser auth** (upstream feature, not available today)

```
Browser → Route → OpenShell relay (validates identity on service_routing) → gateway
```

Would require OpenShell to authenticate HTTP/WS in `service_routing.rs`
(today it only routes by Host). Watch for that; it would change this ADR's
threat model.

### Trigger table — OpenShell

Check these against the **pinned** chart/version in
[`deploy/helm/openshell/Chart.yaml`](../../deploy/helm/openshell/Chart.yaml)
(and the local OpenShell clone under `../OpenShell` when investigating).

| # | Upstream change to watch | Where to look | What becomes possible | Suggested action |
|---|---|---|---|---|
| OS-1 | Helm gates `client_ca_path` on `server.tls.clientCaSecretName` (omit when empty), **and** stops forcing the client-CA volume when `pkiInitJob` is on | `deploy/helm/openshell/templates/gateway-config.yaml` (today always emits `client_ca_path`); `_gateway-workload.tpl` (volume condition includes `pkiInitJob.enabled`) | Values-only HTTPS-without-mTLS: `clientCaSecretName: ""` | Move to **target A**: delete `openclaw-ui-proxy`, add UI Route on openshell chart, keep OpenClaw password |
| OS-2 | Documented, supported "HTTPS-only / disable client CA" mode that works with `pkiInitJob` (JWT + server TLS, no client CA) | Chart README + values comments vs actual templates (they disagree today through at least `0.0.90`) | Same as OS-1, but official | Same as OS-1; bump pin per ADR-0006 and test |
| OS-3 | Real OIDC issuer usable without Keycloak (e.g. native OCP TokenReview authenticator, or OCP gains OIDC discovery + JWKS + JWT access tokens) | `crates/openshell-server/src/auth/oidc.rs`; reference ADR-0010/0016 wall | `require_client_auth` becomes false via `has_oidc`; optional client certs | Evaluate **target A** via OIDC side-effect **only if** we also accept that service_routing still has no app auth — password (or a front proxy) remains the browser gate unless OS-5 lands |
| OS-4 | `service_routing` / `proxy_to_endpoint` validates caller identity (OIDC/mTLS user mapping) on HTTP/WS | `crates/openshell-server/src/service_routing.rs` | Relay itself becomes the browser auth boundary | Re-architecture: may drop OpenClaw password or nginx depending on the new contract; write a new ADR section |
| OS-5 | Chart supports `extraConfig` / omitting TLS client CA without post-renderer hacks | Helm values schema | Cleaner than OS-1 workarounds | Prefer chart-native path over Makefile post-processors |
| OS-6 | Built-in ingress / Route templates that expose sandbox services without a sidecar | Upstream chart templates | Possibly replace our wrapper Route + nginx | Compare with our `{sandbox}--{service}` hostname pattern before adopting |

**Do not treat as a fix (already disproven):**

- Setting `clientCaSecretName: ""` alone on chart ≤ `0.0.90` with `pkiInitJob`
- Pointing `server.oidc.issuer` at `https://oauth-openshift.apps.<domain>`

### Trigger table — OpenClaw

Pinned version today: see `OPENCLAW_PIN` in
[`scripts/launch-openclaw.sh`](../../scripts/launch-openclaw.sh) (ADR-0006).

| # | Upstream change to watch | Where to look | What becomes possible | Suggested action |
|---|---|---|---|---|
| OC-1 | Control UI persists password across reloads (or first-class login gate UX) | OpenClaw Control UI / dashboard docs; issues around password not in `localStorage` | Better demo UX without `/?password=` | Update `tests/helpers.ts` and launch summary URL; keep password mode |
| OC-2 | Stronger shared-secret UX (token deep-links that stay stable, rateLimit defaults) | `gateway.auth` schema / docs.openclaw.ai | Safer shared-secret demos | Enable `gateway.auth.rateLimit` in `openclaw.json.tpl` if not already set |
| OC-3 | First-class OIDC / SSO mode for Control UI (not just trusted-proxy headers) | OpenClaw gateway auth docs | True SSO without inventing header contracts | Prefer over reviving oauth-proxy if SSO becomes required |
| OC-4 | trusted-proxy improvements (required headers, deny-by-default, no `allowLoopback` footguns) | OpenClaw `gateway.auth.trustedProxy` | Safer path if we return to identity-from-proxy | Only with a WebSocket-correct front proxy (**target B**) |
| OC-5 | Breaking change to `gateway.auth.mode: password` or `/?password=` query handling | Release notes for the pinned OpenClaw version | May break Playwright / launch instructions | Pin bump must include auth.setup + helpers regression |

### Trigger table — product / demo requirements (not upstream)

| # | Requirement change | Suggested direction |
|---|---|---|
| REQ-1 | Demo needs per-user audit / "who sent this prompt?" | **Target B** (SSO + trusted-proxy) or OC-3; update this ADR |
| REQ-2 | Demo must use OCP login (no shared password) | Same as REQ-1; do not use Keycloak only to flip OpenShell mTLS |
| REQ-3 | Shared cluster / hostile multi-tenant | Revisit `allowUnauthenticatedUsers`, NetworkPolicies on the UI Route, password rotation; consider dropping password for stronger auth |

### How to re-validate before changing this ADR

1. Confirm the trigger with a **specific** upstream version/commit (link it).
2. Prove the new behaviour against our pin path:
   - OpenShell: `helm template` the wrapper chart and assert presence/absence of
     `client_ca_path` and the `tls-client-ca` volume.
   - OpenClaw: render `config/openclaw.json.tpl` and run Control UI + Playwright
     smoke (`make -C deploy test-ui` with `OPENCLAW_GATEWAY_PASSWORD` set).
3. Prefer deleting components (`openclaw-ui-proxy`) over adding new ones.
4. Update this ADR (status note + date), [`docs/stack-decisions.md`](../stack-decisions.md),
   [`docs/ROADMAP.md`](../ROADMAP.md) Deferred section, and the
   `openshell-cluster-install` skill in the same change.

### Quick "is OS-1 fixed yet?" checklist

Against a candidate OpenShell chart version:

```bash
# From agentops-example after helm dependency build / against OpenShell clone:
rg -n 'client_ca_path' deploy/helm/openshell/charts/*/templates/gateway-config.yaml \
  ../OpenShell/deploy/helm/openshell/templates/gateway-config.yaml

rg -n 'clientCaSecretName|tls-client-ca|pkiInitJob.enabled' \
  ../OpenShell/deploy/helm/openshell/templates/_gateway-workload.tpl
```

Expected for OS-1 fixed: `client_ca_path` only rendered when a non-empty
client CA secret is configured; volume omitted when secret name is `""`
even with `pkiInitJob.enabled=true`.

---

## References

- Chart: [`deploy/helm/openclaw-ui-proxy/`](../../deploy/helm/openclaw-ui-proxy/)
- Config: [`config/openclaw.json.tpl`](../../config/openclaw.json.tpl) (`gateway.auth.mode: password`)
- Launch: [`scripts/launch-openclaw.sh`](../../scripts/launch-openclaw.sh)
- Tests: [`tests/helpers.ts`](../../tests/helpers.ts), [`tests/auth.setup.ts`](../../tests/auth.setup.ts)
- [ADR-0006: Explicit Version Pinning](0006-explicit-version-pinning.md)
- Roadmap deferred: [docs/ROADMAP.md](../ROADMAP.md) — "Multi-user browser identity / OCP SSO"
- Reference project: ADR-0016 (OpenShift-native OAuth spike), ADR-0010 (OIDC / why OCP OAuth ≠ OpenShell OIDC), ADR-0012 (trusted-proxy)
- OpenShell source (local clone `../OpenShell`):
  - `crates/openshell-server/src/cli.rs` — `require_client_auth = has_client_ca && !has_oidc`
  - `crates/openshell-server/src/tls.rs` — client verifier modes
  - `crates/openshell-server/src/service_routing.rs` — no app-layer auth on browser path
  - `crates/openshell-server/src/auth/oidc.rs` — JWKS / openid-configuration discovery
  - `deploy/helm/openshell/templates/gateway-config.yaml` — unconditional `client_ca_path`
  - `deploy/helm/openshell/templates/_gateway-workload.tpl` — client CA volume conditions
- Community oauth2-proxy WebSocket Host fix (relevant only if returning to SSO proxies):
  [oauth2-proxy PR #3290](https://github.com/oauth2-proxy/oauth2-proxy/pull/3290)
