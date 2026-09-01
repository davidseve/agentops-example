---
name: demo-external-css
description: >-
  Enforce external CSS for the demo presentation UI under docs/demo/. Use
  when adding or editing demo HTML/JS/CSS, refactoring embedded styles,
  externalizing inline CSS, or when the user asks to validate demo styling
  conventions. Runs validate-demo-external-css.sh before finishing.
---

# Demo External CSS

Keep all presentation styling in `.css` files under `docs/demo/`. The always-on rule `demo-external-css.mdc` applies when editing matching files; this skill adds the refactor workflow and validation gate.

## When to run

| Trigger | Action |
|---|---|
| New or edited `docs/demo/**/*.html` or `*.js` | External CSS only; run validator |
| User asks to externalize / refactor CSS | Follow workflow below |
| Before commit/PR touching demo UI | Run validator |

## Workflow

```
External CSS check:
- [ ] 1. Identify embedded CSS (<style>, style="...")
- [ ] 2. Place rules in the correct stylesheet (see map)
- [ ] 3. Replace inline markup with semantic classes
- [ ] 4. Run ./scripts/validate-demo-external-css.sh
- [ ] 5. Pass → done / Fail → fix and re-run
```

### Stylesheet placement

| Content | Target file |
|---|---|
| FlowStory chrome (overlay, loop, hints) | `docs/demo/shared/demo.css` |
| Launcher tables, badges, checklist | `docs/demo/index.css` |
| Narrative layout, meta, stub pages | `docs/demo/v1/narrative.css` |
| v2 baseline embed / overlay | `docs/demo/v2/baseline-embed.css` |
| v2-only narrative tweaks | `docs/demo/v2/narrative-v2.css` |
| Page-specific (rare) | New `docs/demo/<area>/<name>.css` + `<link>` |

Reuse existing modifier classes when possible: `.fs-steps-hint`, `.nr-meta--top`, `.nr-meta--tight`, `.fs-load-error`.

### JS template strings

Move `style="..."` from HTML fragments in `.js` files to CSS classes — same rules as static HTML.

Runtime toggles (`el.style.display`, `el.style.height`) stay in JS.

### Exceptions (do not flag)

- `docs/demo/shared/assets/**` (SVG presentation attributes)
- `docs/demo/shared/vendor/**` (third-party)
- JS `.style.` property assignments (not HTML attributes)

## Validation

From repo root:

```bash
./scripts/validate-demo-external-css.sh
```

Exit code `0` = pass. Non-zero = list violations and fix before finishing.

## Outcome

**Pass** — continue commit/PR or close the task.

**Fail** — report file:line, move CSS to the appropriate sheet, re-run until clean.
