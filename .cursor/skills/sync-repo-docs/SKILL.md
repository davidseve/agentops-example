---
name: sync-repo-docs
description: >-
  Audit and sync README, AGENTS.md, ROADMAP, and cross-links with the actual
  repository layout, scripts, skills, and Makefile targets. Use when the user
  asks to align or review documentation, after adding/removing paths or skills,
  or when the docs-repo-alignment rule applies.
---

# Sync Repository Documentation

Keep **index docs** aligned with the repo. Component install guides are handled
by `document-feature`; this skill covers structure, skills tables, and links.

## Quick audit commands

From repo root:

```bash
# Skills vs AGENTS.md table
ls -1 .cursor/skills/

# Scripts
ls -1 scripts/*.{sh,py} 2>/dev/null

# Helm charts
ls -1 deploy/helm/

# Make targets
make help
make -C deploy help

# Stale path grep (should return nothing after a clean audit)
rg -n 'deploy/kustomize|agent/src|agent/prompts|docs/architecture\.md' --glob '*.md'
```

## Checklist

Copy and complete:

```
Repo docs sync:
- [ ] 1. Read docs-repo-alignment rule
- [ ] 2. Compare AGENTS.md § Project Structure with filesystem
- [ ] 3. Compare README.md § Project Structure (shorter) with filesystem
- [ ] 4. Compare AGENTS.md § Cursor Skills with .cursor/skills/
- [ ] 5. Verify scripts/ list in AGENTS.md (demo + deploy critical)
- [ ] 6. Fix ROADMAP.md links to non-existent paths
- [ ] 7. Verify README.md § Documentation links resolve
- [ ] 8. Update document-feature/reference.md file map if layout changed
- [ ] 9. Run stale-path grep; fix any hits
```

## Project structure template (AGENTS.md)

Use this as the baseline when rewriting § Project Structure:

```
agentops-showcase/
├── Makefile                     # Wrapper → deploy/Makefile (make demo, deploy-all, …)
├── .cursor/rules/               # Agent rules (adr-alignment, docs-repo-alignment, …)
├── .cursor/skills/              # Project skills (see § Cursor Skills)
├── AGENTS.md / README.md
├── assets/                      # Diagrams (e.g. strategy-image.png)
├── config/
│   ├── openclaw.json.tpl
│   └── openshell/               # Sandbox policies (default.yaml, google-egress.yaml)
├── docs/                        # Guides, ADRs, demo narrative, ROADMAP
├── deploy/
│   ├── Makefile
│   ├── helm/                    # operators, platform, database, mlflow, evalhub,
│   │                            # guardrails, openshell, openclaw-ui-proxy
├── agent/workspace/             # OpenClaw workspace identity (not app source)
├── tests/                       # Playwright specs, health-check.sh
├── scripts/                     # cluster-lifecycle, demo-*, openshift-*, launch-openclaw, …
├── secrets/                     # secrets.env (gitignored)
└── .github/workflows/
```

**Retired** (do not document as current): `deploy/kustomize/`, `agent/src/`,
`agent/prompts/`, raw Agent Sandbox `v0.5.1` manifest path.

**Architecture docs** (use instead of a single `docs/architecture.md`):

- [docs/AGENT-SANDBOX-AND-OPENSHELL.md](../../docs/AGENT-SANDBOX-AND-OPENSHELL.md)
- [docs/demo/overall-demo-architecture.html](../../docs/demo/overall-demo-architecture.html)
- [docs/stack-decisions.md](../../docs/stack-decisions.md) + [docs/adr/](../../docs/adr/)

## ROADMAP link fixes

| Stale reference | Replace with |
|---|---|
| `docs/architecture.md` | `AGENT-SANDBOX-AND-OPENSHELL.md` + `AGENTS.md` § Technology-to-Product Mapping |
| `agent/guardrails/` | `deploy/helm/guardrails/files/` |

## After syncing

- Do not create new markdown files unless the user asked or `document-feature` requires it
- English for all committed `.md` files
