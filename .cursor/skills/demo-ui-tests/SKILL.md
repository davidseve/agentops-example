---
name: demo-ui-tests
description: >-
  Add or update unit tests when demo test logic changes (log rules, scenario
  flows, prompts, E2E assertion helpers). Use when editing observability-log-rules.js,
  overall-flows.js, narrative-data.js, ui-helpers.ts, or when the user asks to
  validate demo UI tests. Runs validate-demo-ui.sh before finishing.
---

# Demo UI Tests

Keep demo **test logic** covered by no-cluster unit tests. The always-on rule `demo-ui-tests.mdc` applies when editing matching files; this skill adds the workflow and validation gate.

## When to run

| Trigger | Action |
|---|---|
| New/changed log classification or presenter hints | Update `observability-log-rules.spec.ts` |
| New/changed scenario hops, responses, prompts | Update `demo-scenario-consistency.spec.ts` |
| New/changed E2E assertion helpers | Update `ui-helpers.unit.spec.ts` |
| Before commit/PR touching demo test logic | Run `validate-demo-ui.sh` |

## Workflow

```
Demo UI test check:
- [ ] 1. Identify which module changed (see map below)
- [ ] 2. Add/update fixtures or invariants in the matching spec
- [ ] 3. Run ./scripts/validate-demo-ui.sh
- [ ] 4. Pass → done / Fail → fix and re-run
```

### Module → spec map

| Source | Test file |
|---|---|
| `docs/demo/v1/observability-log-rules.js` | `tests/observability-log-rules.spec.ts` |
| `docs/demo/scenarios/overall-flows.js`, `overall-response-maps.js` | `tests/demo-scenario-consistency.spec.ts` |
| `docs/demo/v1/narrative-data.js` + `tests/demo-prompts.ts` | `tests/demo-scenario-consistency.spec.ts` |
| `tests/ui-helpers.ts` (pure assertion functions) | `tests/ui-helpers.unit.spec.ts` |
| `docs/demo/**/*.html`, `*.js` (presentation CSS) | `scripts/validate-demo-external-css.sh` — skill `demo-external-css` |

### Adding a new scenario (E, F, …)

1. `tests/demo-prompts.ts` — `PROMPT_E`
2. `docs/demo/v1/narrative-data.js` — step + prompt
3. `docs/demo/scenarios/overall-flows.js` — `SCENARIO_E_*`, `OVERALL_SCENARIO_E`
4. `docs/demo/scenarios/scenario-responses.js` / `overall-response-maps.js` — messages
5. Extend `EXPECTED_FLOW_IDS` and invariants in `demo-scenario-consistency.spec.ts`
6. Add log-rule fixtures if the observability panel behavior changes

## Validation

From repo root:

```bash
./scripts/validate-demo-ui.sh
```

Runs external CSS lint + `npm run test:demo-unit` (log rules, scenario consistency, ui-helpers).

Local partial:

```bash
cd tests && npm run test:demo-unit
```

## Outcome

**Pass** — continue commit/PR or close the task.

**Fail** — report failing spec and file; fix source or tests; re-run until clean.
