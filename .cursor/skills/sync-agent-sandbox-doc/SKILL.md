---
name: sync-agent-sandbox-doc
description: >-
  Keep docs/AGENT-SANDBOX-AND-OPENSHELL.md in sync when Agent Sandbox,
  OpenShell, OpenClaw launch, sandbox policies, or related deploy paths
  change. Use after modifying launch-openclaw.sh, openshell/operators Helm
  charts, policies/openclaw-sandbox.yaml, policies/openclaw-demo-initial.yaml,
  scripts/demo-*.sh, version pins, or validation targets
  — or when the user asks to update the sandbox architecture guide.
---

# Sync Agent Sandbox Guide

Maintain [docs/AGENT-SANDBOX-AND-OPENSHELL.md](../../../docs/AGENT-SANDBOX-AND-OPENSHELL.md) when the Agent Sandbox + OpenShell + OpenClaw procedure or architecture changes.

**Canonical guide:** `docs/AGENT-SANDBOX-AND-OPENSHELL.md`  
**Install procedures (commands):** `docs/openshell-installation.md`  
**Decisions:** `docs/adr/` + `docs/stack-decisions.md`

Triggered automatically by the `agent-sandbox-doc-sync` rule when matched files change. Also run when the user asks to refresh or extend the sandbox guide.

## When to run

| Trigger | Example |
|---------|---------|
| `scripts/launch-openclaw.sh` changed | New setup step, env var, `OPENCLAW_PIN`, image `--from` |
| Helm openshell/operators/ui-proxy changed | Chart version, SCC, values, new template |
| `policies/openclaw-sandbox.yaml` changed | Network/filesystem policy (CI final state) |
| `policies/openclaw-demo-initial.yaml` or `scripts/demo-*.sh` changed | Demo v1 policy / live scripts — also update [`docs/demo-narrativa-v1.md`](../../docs/demo-narrativa-v1.md), [`docs/demo-script.md`](../../docs/demo-script.md) |
| `deploy/Makefile` validate/deploy targets changed | `validate-openclaw`, `deploy-openshell` waits |
| Version pin bumped | Operator CSV, OpenShell chart, npm pin |
| First validation of a new topology | e.g. switching to `sidecar` supervisor topology |

**Not required** for typo-only doc edits or changes that do not affect the sandbox stack.

## Workflow

```
Sync progress:
- [ ] 1. Identify which guide sections are affected (map below)
- [ ] 2. Read current source files — do not update from memory
- [ ] 3. Edit docs/AGENT-SANDBOX-AND-OPENSHELL.md (affected sections only)
- [ ] 4. Cross-link if a new major topic was added (README, AGENTS.md)
- [ ] 5. If architectural: update ADR Validation or create ADR (adr skill)
- [ ] 6. Verify formatting: full-width paragraphs, intact tables/code blocks
```

### Step 1 — File → section map

| Changed artifact | Update section(s) in the guide |
|------------------|--------------------------------|
| `deploy/helm/operators/` (Agent Sandbox OLM) | §2 Deployment YAML, §3 Phase 1, §6 Version Pinning |
| `deploy/helm/openshell/` (gateway, SCC) | §2 Infrastructure, §4 Pod topology, §6 Version Pinning |
| `deploy/helm/openclaw-ui-proxy/` | §5 Step 8 / Traffic flow (browser path) |
| `deploy/Makefile` (`deploy-openshell`, `validate-*`) | §2 How deploy-openshell works, §8 Validation, §9 Quick Reference |
| `scripts/launch-openclaw.sh` | §3 Phase 6, **§5 Launch Script** (primary) |
| `policies/openclaw-sandbox.yaml` | §1 Landlock / policy, §7 Policy anatomy (CI final) |
| `policies/openclaw-demo-initial.yaml` | §7 Policy anatomy (demo initial — link to demo-narrativa-v1) |
| `scripts/demo-*.sh` | §7 Policy anatomy, §9 Quick Reference (demo live scripts) |
| `config/openclaw.json.tpl` | §5 (auth, plugins, tracing env) |
| `OPENCLAW_PIN` / image `--from` | §6 Version Pinning |
| OpenShell upstream behavior (driver, `service expose`) | §3 End-to-end flow, §4 Inside pod, §5 steps |
| New ADR for sandbox/SCC/openshell | §1 Key concepts, §10 Further Reading |

### Step 2 — What to verify in source before editing

Read the actual files — especially:

- `scripts/launch-openclaw.sh` — step order, env vars, pins, commands
- `deploy/helm/operators/values.yaml` — channel, CSV, namespace
- `deploy/helm/openshell/Chart.yaml` + `Chart.lock` — chart pin
- `deploy/helm/openshell/values-openshift.yaml` — SCC, security context
- `policies/openclaw-sandbox.yaml` — CI final policy (github blocked)
- `policies/openclaw-demo-initial.yaml` — demo v1 initial policy (github allowed for Test C)
- `deploy/Makefile` — `validate-openclaw`, `validate-security`, `validate-demo-initial`, deploy sequence

### Step 3 — Editing rules

1. **English only** for committed markdown.
2. **Full-width paragraphs** — one line per paragraph (match `cluster-bootstrap.md`).
3. **Preserve structure** — numbered sections 1–10; do not flatten into a changelog.
4. **Diagrams** — update ASCII/mermaid only when topology actually changed.
5. **Version table (§6)** — must match ADR-0006 and live pins in scripts/Helm.
6. **Do not** copy entire ADRs — link to `docs/adr/NNNN-*.md`.
7. **Do not** duplicate `openshell-installation.md` install steps — link there for command-only updates.

### Step 4 — Cross-links

| File | When to update |
|------|----------------|
| `README.md` | Add/link under Documentation if guide is new or renamed |
| `AGENTS.md` | References section if the guide becomes a primary onboarding path |
| `docs/openshell-installation.md` | One-line pointer to this guide for architecture depth |
| `openshell-cluster-install` skill | "Further reading" link if deploy flow changed |

### Step 5 — ADR alignment

Per `adr-alignment` rule:

- Pinning or operator channel changes → update ADR-0006 table **and** guide §6
- OpenShell deploy topology → ADR-0003 Validation section
- SCC / privileged binding → reference ADR-0006 (reference project) or local ADR-0003
- UI auth path → ADR-0011

### Step 6 — Formatting check

After editing, confirm:

- No accidental hard wrap (~80 chars) in prose paragraphs
- List items are single lines (no orphaned continuation lines)
- Code fences and tables unchanged unless content changed

## Relationship to other skills

| Skill / rule | Role |
|--------------|------|
| `document-feature` | General doc workflow; add a row for this guide when feature type is sandbox architecture |
| `agent-sandbox-doc-sync` rule | Auto-reminder when globs match |
| `openshell-cluster-install` | Deploy commands; link to this guide for "how it works" |
| `adr` | Architectural decisions — guide links to ADRs, does not replace them |

## Example session

**Change:** Bump `OPENCLAW_PIN` to `2026.7.1` and update `--from` to a tagged image.

**Actions:**

1. Update `scripts/launch-openclaw.sh` (implementation)
2. Update ADR-0006 pinning table if policy requires
3. Run this skill → edit guide §6 (both npm and image rows), §5 Step 2 if install command changed
4. Note Node engine requirement in §6 if image pin enables newer OpenClaw

## Do not

- Rewrite the entire guide for a one-line script change
- Document from training data — read the repo files
- Store secrets or example passwords in the guide
- Remove sections without confirming the feature was removed from the project
