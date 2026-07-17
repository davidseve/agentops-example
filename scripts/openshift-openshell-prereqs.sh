#!/usr/bin/env bash
# OpenShift prerequisites for OpenShell: Agent Sandbox controller only.
# Run once per cluster before: make -C deploy openshell-install
#
# Namespace and SCC are managed by the Helm wrapper chart (deploy/helm/openshell/).
set -euo pipefail

AGENT_SANDBOX_VERSION="${AGENT_SANDBOX_VERSION:-v0.5.1}"
AGENT_SANDBOX_MANIFEST="${AGENT_SANDBOX_MANIFEST:-https://github.com/kubernetes-sigs/agent-sandbox/releases/download/${AGENT_SANDBOX_VERSION}/manifest.yaml}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v oc >/dev/null 2>&1 || die "oc is required"

log "Applying Agent Sandbox controller and CRDs (${AGENT_SANDBOX_VERSION})"
oc apply -f "${AGENT_SANDBOX_MANIFEST}"

log "Waiting for Agent Sandbox controller"
oc -n agent-sandbox-system rollout status deployment/agent-sandbox-controller --timeout=120s

log "Prerequisites applied. Verify:"
echo "  oc get crd sandboxes.agents.x-k8s.io"
echo "  oc get pods -n agent-sandbox-system"
