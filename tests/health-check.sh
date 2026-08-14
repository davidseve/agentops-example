#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/cluster-lifecycle.sh verify --smoke
