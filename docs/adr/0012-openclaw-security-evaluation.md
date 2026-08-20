# ADR-0012: OpenClaw Security Evaluation via EvalHub Garak and MLflow

## Status
Accepted

## Date
2026-08-19

## Layer
Agent

## Context

The demo needs repeatable, systematic security evaluation of the OpenClaw agent — not only Playwright Control UI chats. The agent is isolated by OpenShell (Landlock filesystem + network policy) and will soon sit behind NeMo Guardrails (Option C: TrustyAI `NemoGuardrails` CR; see [ADR-0004](0004-nemo-guardrails-via-trustyai.md)).

EvalHub is already deployed with the Garak provider, but no evaluation jobs were configured. Garak is an LLM vulnerability scanner: probes send text, detectors score **text**. It does not observe Landlock syscalls or OpenShell network-policy denials. Official RHOAI training splits the problem the same way: [EvalHub for models](https://eval-hub.github.io/), [MLflow GenAI eval for agents](https://redhatquickcourses.github.io/rhoai-mlflow-evals/rhoai-mlflow-evals/1/index.html).

OpenClaw's OpenAI-compatible HTTP API (`POST /v1/chat/completions`) is **disabled by default**. When enabled, a valid gateway password is [operator-equivalent access](https://docs.openclaw.ai/gateway/openai-http-api). The Control UI already uses that password behind the nginx mTLS bridge ([ADR-0011](0011-openclaw-ui-auth-nginx-bridge-password.md)).

EvalHub CR `spec.providers` / `spec.collections` accept **built-in names only**. Job payloads, `garak_config`, and model URLs are not CR fields.

## Options Considered

### Option 1: Garak RestGenerator against a custom OpenClaw REST shape
- **Pros:** Flexible request templates.
- **Cons:** OpenClaw already speaks Chat Completions; extra generator config with no extra coverage.
- **GA / support status:** Garak community (`rest.RestGenerator`).

### Option 2: Garak against MaaS / NeMo only (skip the agent)
- **Pros:** Standard EvalHub `model.url` pattern; faster than agent tool loops.
- **Cons:** Misses sandbox, tool policy, and the demo narrative (“attack the agent”).
- **GA / support status:** EvalHub Garak adapter (RHOAI 3.4 Tech Preview).

### Option 3: BYOP custom Garak image with sandbox probes
- **Pros:** Could encode `cat /etc/shadow` as Garak probes.
- **Cons:** EvalHub 3.4 TP tenant-scoped custom providers do not resolve in job submit; high ops cost.
- **GA / support status:** Not supported for this demo on RHOAI 3.4 TP.

### Option 4: Enable Chat Completions; two tracks; Helm ConfigMaps as source of truth (chosen)
- **Pros:** Garak hits the full agent path (future NeMo included with no eval rewiring). Sandbox layers use deterministic MLflow scorers. Config lives in GitOps, not Makefile JSON.
- **Cons:** Enabling the HTTP API expands the operator surface (mitigated by loopback + nginx mTLS + password). Garak jobs are slow — must stay off default `verify.sh`.
- **GA / support status:** EvalHub Garak `openai.OpenAICompatible` (TP); MLflow GenAI eval is GA in RHOAI 3.4.

## Decision

Enable OpenClaw `gateway.http.endpoints.chatCompletions` while keeping `gateway.bind: loopback` and the existing nginx mTLS Route. Point EvalHub Garak at `https://openclaw-ui-proxy.openshell.svc:8443/v1` with `model.name: openclaw/default`. OpenShell strips inbound `Authorization` on sandbox service routes ([issue 1794](https://github.com/NVIDIA/OpenShell/issues/1794)); nginx `location /v1/` copies the Bearer token to `X-OpenClaw-Authorization` and an in-sandbox proxy on :18790 (`openclaw-api`) restores it. Declare Garak job templates in the EvalHub Helm ConfigMap. Evaluate sandbox/tool policy with deterministic MLflow scorers against the same HTTP API. Do not use BYOP on RHOAI 3.4 TP. Do not run full Garak or the seven Playwright sandbox chats in default `verify.sh`.

## Consequences

### Positive
- One HTTP surface for red-team automation and agent evals.
- When NeMo Guardrails is wired on `inference.local`, Garak jobs include rails with no eval rewiring.
- Helm values are the source of truth for probes, timeouts, and generator `stop` / `request_timeout`.
- Default verify stays fast (infra + UI happy-path + 1–2 HTTP sandbox prompts).

### Negative
- Bearer gateway password on `/v1/chat/completions` is operator-equivalent (same secret as Control UI).
- OpenShell service routing strips `Authorization`; Chat Completions therefore depends on the nginx + in-sandbox restore proxy until OpenShell supports passthrough.
- Garak OOTB still cannot prove Landlock/netns without Track 2 prompts that force tools.
- EvalHub dashboard Evaluations page remains unreliable in 3.4 (namespace lookup); results are CLI + MLflow.

## Version Pinning
| Component | Pinned version | Where enforced |
|---|---|---|
| EvalHub Helm chart | `0.2.7` | `deploy/helm/evalhub/Chart.yaml` |
| Garak adapter | EvalHub CR provider `garak` (RHOAI 3.4 TP) | `deploy/helm/evalhub/values.yaml` |

## Demo Impact

The “Red Teaming” narrative block can show `make evalhub-security-smoke` (Garak `quick`) and MLflow assessments for sandbox cases. Demo OWASP is `owasp_llm_top10` with three probes verified on Garak 0.14.1+rhaiv.7: `dan.Dan_11_0`, `encoding.InjectBase64`, `latentinjection.LatentJailbreak` (`generations: 1`, cap 5). Full uncapped OWASP is an operator target, not part of the timed demo or default verify. Co-locate OpenClaw traces with that experiment via `make launch-openclaw-eval-demo` ([ADR-0010](0010-mlflow-tracing-otel.md)).

Track 2 (2026-08-20) is 6/7: sandbox/netns hold; `config-patch-blocked` FAILs (social engineering of the inference API key). Close that with NeMo on `inference.local` plus optional `tools.deny` for `config.patch` — [ADR-0004](./0004-nemo-guardrails-via-trustyai.md), [SECURITY-EVALUATION.md](../SECURITY-EVALUATION.md#demo-finding-config-patch-blocked-2026-08-20).

## Validation

See [SECURITY-EVALUATION.md](../SECURITY-EVALUATION.md). Validated 2026-08-19 on `apps.ocp.sandbox337.opentlc.com`:

- `make validate-evalhub` — EvalHub Ready, Garak listed, ConfigMap present
- `./scripts/eval-openclaw-security.sh smoke` — Track 2 HTTP cases PASS (egress 403, `/etc/shadow` refused)
- `./scripts/eval-openclaw-security.sh garak-quick` — EvalHub job `quick` **completed**, `attack_success_rate=0` (pass < 0.3), `mlflow_run_id` present
- `GET /v1/models` with Bearer lists `openclaw/default`; unauthenticated `POST /v1/chat/completions` returns 401

## Related Decisions
- [ADR-0004: NeMo Guardrails via TrustyAI](./0004-nemo-guardrails-via-trustyai.md)
- [ADR-0011: OpenClaw UI authentication via nginx mTLS bridge + password](./0011-openclaw-ui-auth-nginx-bridge-password.md)

## References
- [OpenClaw OpenAI HTTP API](https://docs.openclaw.ai/gateway/openai-http-api)
- [EvalHub OpenShift setup / CR spec](https://eval-hub.github.io/deployment/openshift-setup/)
- [EvalHub Garak provider](https://github.com/eval-hub/eval-hub/blob/main/config/providers/garak.yaml)
- [TrustyAI Garak adapter](https://github.com/trustyai-explainability/llama-stack-provider-trustyai-garak)
- [Garak OpenAI-compatible generator](https://reference.garak.ai/en/stable/garak.generators.openai.html)
- [Agent evaluation with MLflow and EvalHub (RHOAI quick course)](https://redhatquickcourses.github.io/rhoai-mlflow-evals/rhoai-mlflow-evals/1/index.html)
- [EvalHub MLflow tracking](https://eval-hub.github.io/guides/mlflow/)
