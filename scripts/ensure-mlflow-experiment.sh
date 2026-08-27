#!/usr/bin/env bash
# ensure-mlflow-experiment.sh — Get-or-create the openclaw-tracing MLflow experiment
# in the OpenShell workspace. Idempotent; safe to run before launch-openclaw or demo prep.
#
# Usage: ./scripts/ensure-mlflow-experiment.sh
# Prereqs: deploy-mlflow-openclaw-integration (SA token Secret), OpenShell or sandbox pod
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

command -v oc >/dev/null 2>&1 || { error "oc is required"; exit 1; }

step "Ensuring MLflow experiment for OpenClaw tracing"
info "Workspace: ${NAMESPACE}"
info "Experiment: ${MLFLOW_EXPERIMENT_NAME}"

MLFLOW_EXPERIMENT_ID="${MLFLOW_EXPERIMENT_ID:-__RESOLVE__}"
MLFLOW_WORKSPACE="${MLFLOW_WORKSPACE:-$NAMESPACE}"

if ensure_mlflow_experiment; then
  pass "MLflow experiment ready (id=${MLFLOW_EXPERIMENT_ID})"
else
  error "Failed to ensure MLflow experiment — run: make -C deploy deploy-mlflow-openclaw-integration"
  exit 1
fi
