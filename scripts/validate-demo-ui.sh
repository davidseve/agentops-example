#!/usr/bin/env bash
# Validate demo presentation UI: external CSS conventions + no-cluster unit tests.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Demo UI: external CSS"
"${SCRIPT_DIR}/validate-demo-external-css.sh"

echo "==> Demo UI: unit tests"
(
  cd "${ROOT_DIR}/tests"
  npm run test:demo-unit
)

echo "OK: demo UI validation passed."
