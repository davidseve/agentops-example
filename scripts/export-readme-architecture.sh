#!/usr/bin/env bash
# Export docs/demo/v3/live.html step 0 (Overall Demo) to assets/overall-architecture.png (README).
# CI validates this PNG on linux/amd64 — on macOS we re-export via Podman so bytes match GitHub Actions.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TESTS_DIR="${ROOT_DIR}/tests"
EXPORT_CONTAINER_IMAGE="${EXPORT_CONTAINER_IMAGE:-ubuntu:24.04}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

export_via_linux_container() {
  require_cmd podman
  echo "==> Exporting via Podman (${EXPORT_CONTAINER_IMAGE}, linux/amd64 — matches CI)"
  podman run --platform linux/amd64 --rm \
    -v "${ROOT_DIR}:/work:Z" \
    -w /work \
    "${EXPORT_CONTAINER_IMAGE}" \
    bash -lc "set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates python3 >/dev/null
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y -qq nodejs >/dev/null
rm -rf tests/node_modules/playwright-core/.local-browsers
cd tests && npm ci
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install-deps chromium
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
cd .. && ./scripts/export-readme-architecture.sh --native"
}

export_native() {
  require_cmd python3
  require_cmd node
  require_cmd npm

  if [[ ! -d "${TESTS_DIR}/node_modules/@playwright/test" ]]; then
    echo "==> Installing test dependencies"
    (cd "${TESTS_DIR}" && npm ci)
  fi

  echo "==> Ensuring Playwright Chromium is installed (project-local)"
  export PLAYWRIGHT_BROWSERS_PATH=0
  (cd "${TESTS_DIR}" && npx playwright install chromium)

  echo "==> Exporting README architecture diagram"
  (cd "${TESTS_DIR}" && PLAYWRIGHT_BROWSERS_PATH=0 node export-architecture-diagram.mjs)
}

if [[ "${1:-}" == "--native" ]]; then
  export_native
  exit 0
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  if command -v podman >/dev/null 2>&1; then
    export_via_linux_container
    exit 0
  fi
  echo "warning: Podman not found — exporting on macOS; PNG may differ from CI (use Podman or commit from Linux)" >&2
fi

export_native
