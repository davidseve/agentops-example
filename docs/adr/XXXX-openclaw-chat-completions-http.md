# ADR-XXXX: OpenClaw Chat Completions HTTP API via nginx and Authorization Restore Proxy

> **Numbering:** `XXXX` is a placeholder. Assign the next free ADR number when merging to `main` (rename this file and update indexes). Do not assume `0012`.

## Status
Accepted

## Date
2026-08-21

## Layer
Agent

## Context

Automation (evals, CI, other agents) needs OpenClaw’s OpenAI-compatible HTTP API (`POST /v1/chat/completions`, `GET /v1/models`). The Control UI already reaches the gateway through nginx + mTLS + password auth ([ADR-0011](0011-openclaw-ui-auth-nginx-bridge-password.md)). `gateway.http.endpoints.chatCompletions` is **disabled by default**; enabling it with a valid gateway password is [operator-equivalent access](https://docs.openclaw.ai/gateway/openai-http-api).

The public Route already terminates at nginx (`openclaw-gw--openclaw-ui.<APPS_DOMAIN>`). A naive extra expose of sandbox port `18789` as a second OpenShell service does not work: OpenShell **strips `Authorization`** (and other gateway-auth headers) on sandbox service routes ([OpenShell#1794](https://github.com/NVIDIA/OpenShell/issues/1794)), so Chat Completions calls return 401 even with a correct Bearer token.

Keep `gateway.bind: loopback`. Do not put the gateway on the pod network.

## Options Considered

### Option 1: Expose OpenClaw `:18789` as a second OpenShell service
- **Pros:** One process; no extra proxy.
- **Cons:** OpenShell drops `Authorization` before the request reaches OpenClaw (#1794). Clients cannot authenticate.
- **GA / support status:** OpenShell community limitation; not a Red Hat product API.

### Option 2: Proxy `/v1/` on the UI Host without restoring Authorization
- **Pros:** Single hostname; no second OpenShell service.
- **Cons:** Same 401: the relay still strips the header on the way to the sandbox.
- **GA / support status:** Same as Option 1.

### Option 3: nginx copies Bearer to `X-OpenClaw-Authorization`; in-sandbox restore proxy on `:18790` (chosen)
- **Pros:** Reuses the existing Route and password. nginx `location /v1/` sets Host to `{sandbox}--openclaw-api.{domain}` and copies `Authorization` to `X-OpenClaw-Authorization` (then clears `Authorization` so OpenShell has nothing to strip). `scripts/openclaw-auth-proxy.py` on loopback `:18790` restores `Authorization` and forwards to `:18789`.
- **Cons:** Extra process in the sandbox; depends on OpenShell continuing to forward the custom header. Bearer password remains operator-equivalent (same secret as Control UI).
- **GA / support status:** Workaround until OpenShell passthrough exists. nginx chart is this repo; OpenClaw HTTP API is upstream OpenClaw.

### Option 4: Wait for OpenShell to stop stripping Authorization
- **Pros:** Deletes the restore proxy and the second service.
- **Cons:** Blocks the HTTP API until upstream ships and this repo rebases the OpenShell chart pin.
- **GA / support status:** Track [OpenShell#1794](https://github.com/NVIDIA/OpenShell/issues/1794).

## Decision

Enable OpenClaw `gateway.http.endpoints.chatCompletions` while keeping `gateway.bind: loopback` and the existing nginx mTLS Route. Serve `/v1/` through nginx with Host `{sandbox}--openclaw-api.{domain}`. Copy the client Bearer token to `X-OpenClaw-Authorization`. Run an in-sandbox restore proxy on `:18790` (`openshell service expose … openclaw-api`) that reconstructs `Authorization` for the gateway on `:18789`. Use the same `OPENCLAW_GATEWAY_PASSWORD` as the Control UI ([ADR-0011](0011-openclaw-ui-auth-nginx-bridge-password.md)).

## Consequences

### Positive
- One public HTTPS surface for UI and Chat Completions (`https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/v1/...`).
- Clients that speak OpenAI Chat Completions can target the agent without the Control UI.
- When NeMo Guardrails is on `inference.local` ([ADR-0004](0004-nemo-guardrails-via-trustyai.md)), HTTP API traffic includes rails with no extra wiring.

### Negative
- Bearer gateway password on `/v1/chat/completions` is operator-equivalent (same secret as Control UI).
- Depends on nginx + restore proxy until OpenShell supports `Authorization` passthrough (#1794).
- Second sandbox port (`18790`) and process to operate and health-check.

## Version Pinning
| Component | Pinned version | Where enforced |
|---|---|---|
| openclaw-ui-proxy chart | `0.1.1` | `deploy/helm/openclaw-ui-proxy/Chart.yaml` |

## Demo Impact

Playwright `tests/openclaw-ui.spec.ts` expects unauthenticated `/v1/chat/completions` → 401/403 and authenticated `GET /v1/models` to list `openclaw/default`. Reland after `openclaw.json.tpl` or nginx `/v1/` changes: `make -C deploy deploy-openclaw-ui-proxy` then `make -C deploy launch-openclaw`.

## Validation

Validated 2026-08-20 on `apps.ocp.sandbox337.opentlc.com`: `GET /v1/models` with Bearer lists `openclaw/default`; unauthenticated `POST /v1/chat/completions` returns 401.

## Related Decisions
- [ADR-0011: OpenClaw UI authentication via nginx mTLS bridge + password](./0011-openclaw-ui-auth-nginx-bridge-password.md)
- [ADR-0004: NeMo Guardrails via TrustyAI](./0004-nemo-guardrails-via-trustyai.md)

## References
- [OpenClaw OpenAI HTTP API](https://docs.openclaw.ai/gateway/openai-http-api)
- [OpenShell issue 1794 — Authorization stripped on sandbox service routes](https://github.com/NVIDIA/OpenShell/issues/1794)
- Chart: [`deploy/helm/openclaw-ui-proxy/`](../../deploy/helm/openclaw-ui-proxy/)
- Proxy: [`scripts/openclaw-auth-proxy.py`](../../scripts/openclaw-auth-proxy.py)
- Launch: [`scripts/launch-openclaw.sh`](../../scripts/launch-openclaw.sh)
