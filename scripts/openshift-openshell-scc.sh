#!/usr/bin/env bash
# Grant privileged SCC to openshift sandbox pods after Helm creates the service account.
set -euo pipefail

NAMESPACE="${OPENSHIFT_NAMESPACE:-openshell}"
SANDBOX_SA="${OPENSHIFT_SANDBOX_SA:-openshell-sandbox}"

command -v oc >/dev/null 2>&1 || { echo "oc is required" >&2; exit 1; }

oc get sa "${SANDBOX_SA}" -n "${NAMESPACE}" >/dev/null 2>&1 || {
  echo "ServiceAccount ${SANDBOX_SA} not found in ${NAMESPACE}. Install the chart first." >&2
  exit 1
}

oc adm policy add-scc-to-user privileged -z "${SANDBOX_SA}" -n "${NAMESPACE}"
echo "Granted privileged SCC to ${SANDBOX_SA} in ${NAMESPACE}"
