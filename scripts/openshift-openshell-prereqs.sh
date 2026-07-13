#!/usr/bin/env bash
# OpenShift prerequisites for OpenShell (Agent Sandbox + namespace + SCC).
# Run once per cluster before: make -C deploy openshell-install
set -euo pipefail

NAMESPACE="${OPENSHIFT_NAMESPACE:-openshell}"
SANDBOX_SA="${OPENSHIFT_SANDBOX_SA:-openshell-sandbox}"
AGENT_SANDBOX_MANIFEST="${AGENT_SANDBOX_MANIFEST:-https://github.com/kubernetes-sigs/agent-sandbox/releases/latest/download/manifest.yaml}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v oc >/dev/null 2>&1 || die "oc is required"

log "Applying Agent Sandbox controller and CRDs"
oc apply -f "${AGENT_SANDBOX_MANIFEST}"

log "Applying namespace manifest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
oc apply -k "${SCRIPT_DIR}/../deploy/openshift/openshell"

log "Waiting for Agent Sandbox controller"
oc -n agent-sandbox-system rollout status deployment/agent-sandbox-controller --timeout=120s

log "Granting privileged SCC to ${SANDBOX_SA} in ${NAMESPACE}"
if ! oc get sa "${SANDBOX_SA}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  log "ServiceAccount ${SANDBOX_SA} not found yet (created by Helm on install). Skipping SCC grant."
  log "After helm install, run: oc adm policy add-scc-to-user privileged -z ${SANDBOX_SA} -n ${NAMESPACE}"
else
  oc adm policy add-scc-to-user privileged -z "${SANDBOX_SA}" -n "${NAMESPACE}"
fi

log "Prerequisites applied. Verify:"
echo "  oc get crd sandboxes.agents.x-k8s.io"
echo "  oc get pods -n agent-sandbox-system"
