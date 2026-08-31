---
name: demo-warmup
description: >-
  Check demo cluster health layer-by-layer and auto-fix after AWS shutdown
  (relaunch OpenClaw, reset demo-initial state). Use when the user says
  revisa el estado del cluster, estado cluster, cluster status, cómo está el
  cluster, prepara el cluster, arrancar entorno, OpenClaw 502, or waking
  the cluster after it was stopped.
---

# Demo Warmup

**Canonical script:** [`scripts/demo-warmup.sh`](../../scripts/demo-warmup.sh)

When the user asks to **review cluster state** for this demo (`revisa el estado del cluster`, `estado cluster`, `prepara el cluster`, etc.), follow this skill — do not improvise with raw `oc get pods` alone.

## Agent workflow (mandatory)

```
1. Read this skill immediately
2. Run: ./scripts/demo-warmup.sh status
3. Show the layer summary table to the user
4. If exit 1 → run ./scripts/demo-warmup.sh fix WITHOUT asking
5. If exit 2 → report platform broken; suggest demo-backstage-install
6. After fix → status again + Control UI / MLflow URLs + "New session" reminder
```

**Exception:** user explicitly says *solo revisa* / *no toques nada* → only `status`, skip `fix`.

Prefer MCP `openshift-mcp` for read-only pod inspection **after** the scripted layer checks if you need extra detail.

## Commands

| Command | Purpose |
|---|---|
| `./scripts/demo-warmup.sh status` | Diagnosis only |
| `./scripts/demo-warmup.sh fix` | Remediate + re-check (default) |
| `./scripts/cluster-lifecycle.sh status` | Alias → `demo-warmup.sh status` |
| `./scripts/cluster-lifecycle.sh warmup` | Alias → `demo-warmup.sh fix` |

Optional: `./scripts/demo-warmup.sh fix --full-verify` → adds `VERIFY_PROFILE=demo SKIP_E2E=1 ./scripts/verify.sh`

## Layers checked

| Layer | Check | Auto-fix on `fix` |
|---|---|---|
| 1 Session | `oc whoami` | No — user runs `oc login` |
| 2 Platform RHOAI | `make validate` | No → `demo-backstage-install` |
| 3 OpenShell | `validate-openshell` + CLI Connected | Re-register gateway |
| 4 NeMo | `validate-guardrails` | Warn only |
| 5 OpenClaw | `validate-openclaw` + Control UI HTTP | `launch-openclaw` |
| 6 Demo initial | `maas-direct` + `validate-demo-initial` | `demo-reset.sh` |

## When to use vs other skills

| Situation | Skill |
|---|---|
| Cluster already deployed; AWS sleep / morning startup | **demo-warmup** |
| Fresh cluster, first install | `demo-backstage-install` |
| Before going on stage (panels, URLs) | `demo-backstage-prep` |
| Between rehearsals (already running) | `demo-reset` |
| Full Playwright narrative test | `demo-verify` |

## Expected result after fix

| Component | State |
|---|---|
| RHOAI + MLflow + EvalHub | Deployed (unchanged) |
| NeMo Guardrails | Ready (not in inference path) |
| OpenShell gateway | Connected |
| OpenClaw sandbox | `default.yaml` — MLflow-only egress; google.com blocked |
| Inference | `inference.local` → MaaS direct |
| Control UI | HTTP 200 |

Control UI: `https://openclaw-gw--openclaw-ui.<APPS_DOMAIN>/`

## Troubleshooting

| Symptom | Action |
|---|---|
| Exit 2 from status | `demo-backstage-install` |
| OpenShell validate fails | `openshell-cluster-install` |
| NeMo not Ready | `guardrails-cluster-install` |
| Still 502 after fix | Re-run `fix`; check `openshell logs openclaw-gw` |
| User not logged in | `oc login` then re-run |

## Related

- Install: `demo-backstage-install`
- Pre-stage: `demo-backstage-prep`
- Present: `demo-present`
- Narrative: [`docs/demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md)
