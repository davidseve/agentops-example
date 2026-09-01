#!/usr/bin/env bash
# Fail if docs/demo HTML/JS embed presentation CSS (<style> or style=" attributes).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="${SCRIPT_DIR}/../docs/demo"

shopt -s globstar nullglob

fail=0
violations=()

check_grep() {
  local label="$1"
  local pattern="$2"
  shift 2
  local matches
  matches="$(rg -n "$pattern" "$@" 2>/dev/null || true)"
  if [[ -n "$matches" ]]; then
    fail=1
    violations+=("$label")
    echo "=== $label ==="
    echo "$matches"
    echo
  fi
}

echo "Validating external CSS conventions under docs/demo/ ..."

check_grep "Embedded <style> in HTML" \
  '<style' \
  "$DEMO_DIR" \
  --glob '*.html'

check_grep 'Inline style=" in HTML' \
  'style="' \
  "$DEMO_DIR" \
  --glob '*.html'

check_grep 'Inline style=" in JS templates' \
  'style="' \
  "$DEMO_DIR" \
  --glob '*.js' \
  --glob '!**/vendor/**'

if [[ "$fail" -ne 0 ]]; then
  echo "FAIL: demo UI must use external CSS only."
  echo "Move rules to docs/demo/**/*.css and replace inline attributes with classes."
  echo "See .cursor/rules/demo-external-css.mdc and skill demo-external-css."
  exit 1
fi

echo "OK: no embedded presentation CSS found in docs/demo HTML/JS."
