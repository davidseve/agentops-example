#!/usr/bin/env bash
# Register the cluster OpenShell gateway with the local CLI (mTLS).
#
# Idempotent: skips remove+add when this GATEWAY_NAME is already registered
# and `openshell status` succeeds after an explicit select. Always selects
# GATEWAY_NAME before status checks — `openshell status` only reports on
# whichever alias is currently selected, and a different alias may be
# selected locally from a previous run/gateway.
#
# Called automatically by: make -C deploy deploy-openshell
# Standalone:              GATEWAY_NAME=ocp ./scripts/openshift-openshell-register-gateway.sh
set -euo pipefail

NAMESPACE="${NAMESPACE:-openshell}"
GATEWAY_NAME="${GATEWAY_NAME:-ocp}"
SECRET="${OPENSHELL_CLIENT_TLS_SECRET:-openshell-client-tls}"
OPENSHELL_CONFIG_DIR="${OPENSHELL_CONFIG_DIR:-${HOME}/.config/openshell}"
MTLS_DIR="${OPENSHELL_CONFIG_DIR}/gateways/${GATEWAY_NAME}/mtls"
STATUS_RETRIES="${STATUS_RETRIES:-40}"
STATUS_SLEEP="${STATUS_SLEEP:-5}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '==> %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v oc >/dev/null 2>&1 || die "oc is required"
command -v openshell >/dev/null 2>&1 || die "openshell CLI is required"
command -v base64 >/dev/null 2>&1 || die "base64 is required"

# Global OPENSHELL_GATEWAY_INSECURE breaks client-cert mTLS.
unset OPENSHELL_GATEWAY_INSECURE || true

GW_ROUTE="$(oc -n "${NAMESPACE}" get route openshell-gw -o jsonpath='{.spec.host}' 2>/dev/null || true)"
[[ -n "${GW_ROUTE}" ]] || die "Route openshell-gw not found in namespace ${NAMESPACE} (deploy OpenShell first)"
log "Gateway Route: https://${GW_ROUTE}"

gateway_listed() {
  openshell gateway list 2>/dev/null | awk -v n="${GATEWAY_NAME}" '
    NR>1 { g=$1; sub(/^\*/,"",g); if (g==n) found=1 }
    END { exit !found }
  '
}

# openshell status only reports on the *currently selected* alias — select
# ours first so a different, healthy alias selected locally cannot fake
# "already connected".
GATEWAY_ALREADY_REGISTERED=false
if gateway_listed; then
  GATEWAY_ALREADY_REGISTERED=true
  openshell gateway select "${GATEWAY_NAME}" &>/dev/null || true
fi

if [[ "${GATEWAY_ALREADY_REGISTERED}" != "true" ]] || ! openshell status &>/dev/null; then
  openshell gateway remove "${GATEWAY_NAME}" 2>/dev/null || true
  openshell gateway add "https://${GW_ROUTE}" --local --name "${GATEWAY_NAME}"
  openshell gateway select "${GATEWAY_NAME}"
  # gateway add overwrites mtls/ with a local Podman bundle — restore cluster certs.
  NAMESPACE="${NAMESPACE}" GATEWAY_NAME="${GATEWAY_NAME}" \
    "${SCRIPT_DIR}/openshift-openshell-sync-mtls.sh"
  openshell gateway select "${GATEWAY_NAME}"
else
  log "Gateway '${GATEWAY_NAME}' already registered and reachable — skipping re-register"
fi

log "Waiting for openshell status"
retries=0
until openshell status; do
  retries=$((retries + 1))
  if [[ ${retries} -ge ${STATUS_RETRIES} ]]; then
    die "openshell status failed after ${retries} attempts"
  fi
  info "Gateway connection not ready yet, retrying (${retries}/${STATUS_RETRIES})..."
  sleep "${STATUS_SLEEP}"
done

log "CLI registered: alias '${GATEWAY_NAME}' → https://${GW_ROUTE}"
