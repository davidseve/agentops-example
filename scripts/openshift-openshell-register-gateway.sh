#!/usr/bin/env bash
# Register the cluster OpenShell gateway with the local CLI (mTLS).
#
# Idempotent: skips remove+add when this GATEWAY_NAME is already registered
# and `openshell status` succeeds after an explicit select. Always selects
# GATEWAY_NAME before status checks — required when another project's
# gateway alias is active on the same machine (shared-cluster coexistence).
#
# Called automatically by: make -C deploy deploy-openshell
# Standalone:              GATEWAY_NAME=ocp ./scripts/openshift-openshell-register-gateway.sh
#
# Pattern adapted from open-claw-in-openshell/scripts/deploy-openshell.sh
# (constraints around gateway add invalidating client.p12, and status
# reporting on the *active* alias only).
set -euo pipefail

NAMESPACE="${NAMESPACE:-openshell}"
GATEWAY_NAME="${GATEWAY_NAME:-ocp}"
SECRET="${OPENSHELL_CLIENT_TLS_SECRET:-openshell-client-tls}"
OPENSHELL_CONFIG_DIR="${OPENSHELL_CONFIG_DIR:-${HOME}/.config/openshell}"
MTLS_DIR="${OPENSHELL_CONFIG_DIR}/gateways/${GATEWAY_NAME}/mtls"
STATUS_RETRIES="${STATUS_RETRIES:-40}"
STATUS_SLEEP="${STATUS_SLEEP:-5}"

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
# ours first so a healthy peer project gateway cannot fake "already connected".
GATEWAY_ALREADY_REGISTERED=false
if gateway_listed; then
  GATEWAY_ALREADY_REGISTERED=true
  openshell gateway select "${GATEWAY_NAME}" &>/dev/null || true
fi

if [[ "${GATEWAY_ALREADY_REGISTERED}" != "true" ]] || ! openshell status &>/dev/null; then
  log "Extracting mTLS client certificates → ${MTLS_DIR}"
  # Wipe stale bundle first (e.g. leftover from a previous cluster CA).
  rm -rf "${MTLS_DIR}"
  mkdir -p "${MTLS_DIR}"
  chmod 700 "${OPENSHELL_CONFIG_DIR}/gateways/${GATEWAY_NAME}" 2>/dev/null || true
  chmod 700 "${MTLS_DIR}"

  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' EXIT
  oc -n "${NAMESPACE}" get secret "${SECRET}" -o jsonpath='{.data.ca\.crt}'  | base64 -d > "${tmp}/ca.crt"
  oc -n "${NAMESPACE}" get secret "${SECRET}" -o jsonpath='{.data.tls\.crt}' | base64 -d > "${tmp}/tls.crt"
  oc -n "${NAMESPACE}" get secret "${SECRET}" -o jsonpath='{.data.tls\.key}' | base64 -d > "${tmp}/tls.key"
  grep -q 'BEGIN CERTIFICATE' "${tmp}/ca.crt"  || die "ca.crt from ${SECRET} is not a PEM certificate"
  grep -q 'BEGIN CERTIFICATE' "${tmp}/tls.crt" || die "tls.crt from ${SECRET} is not a PEM certificate"
  grep -q 'BEGIN .*PRIVATE KEY' "${tmp}/tls.key" || die "tls.key from ${SECRET} is not a PEM private key"
  # Place certs *before* gateway add so the CLI builds client.p12 from the
  # cluster secret (not package-managed Podman/Docker certs).
  install -m 0644 "${tmp}/ca.crt"  "${MTLS_DIR}/ca.crt"
  install -m 0644 "${tmp}/tls.crt" "${MTLS_DIR}/tls.crt"
  install -m 0600 "${tmp}/tls.key" "${MTLS_DIR}/tls.key"
  rm -rf "${tmp}"
  trap - EXIT

  openshell gateway remove "${GATEWAY_NAME}" 2>/dev/null || true
  openshell gateway add "https://${GW_ROUTE}" --local --name "${GATEWAY_NAME}"
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
