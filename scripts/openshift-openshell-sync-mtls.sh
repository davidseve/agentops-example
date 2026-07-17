#!/usr/bin/env bash
# Sync OpenShell mTLS client bundle from the cluster secret to the local CLI
# config so `openshell status` trusts the gateway after install/upgrade.
#
# Upstream: https://docs.nvidia.com/openshell/kubernetes/setup
#   ("Install the TLS client bundle" — copy openshell-client-tls into
#    ~/.config/openshell/gateways/<name>/mtls/)
#
# Called automatically by: make -C deploy openshell-install | openshell-upgrade
# Standalone:              make -C deploy openshell-sync-mtls
#
# Important: `openshell gateway add --local` may overwrite this directory with
# a package-managed (Podman/Docker) bundle. Re-run this script after gateway add.
set -euo pipefail

NAMESPACE="${NAMESPACE:-openshell}"
SECRET="${OPENSHELL_CLIENT_TLS_SECRET:-openshell-client-tls}"
GATEWAY_NAME="${GATEWAY_NAME:-openshift}"
OPENSHELL_CONFIG_DIR="${OPENSHELL_CONFIG_DIR:-${HOME}/.config/openshell}"
MTLS_DIR="${OPENSHELL_CONFIG_DIR}/gateways/${GATEWAY_NAME}/mtls"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-120}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v oc >/dev/null 2>&1 || die "oc is required"
command -v base64 >/dev/null 2>&1 || die "base64 is required"

log "Waiting for secret ${NAMESPACE}/${SECRET}"
deadline=$((SECONDS + WAIT_TIMEOUT))
until oc -n "${NAMESPACE}" get secret "${SECRET}" >/dev/null 2>&1; do
	if (( SECONDS >= deadline )); then
		die "secret ${NAMESPACE}/${SECRET} not found within ${WAIT_TIMEOUT}s"
	fi
	sleep 2
done

mkdir -p "${MTLS_DIR}"
chmod 700 "${OPENSHELL_CONFIG_DIR}/gateways/${GATEWAY_NAME}" 2>/dev/null || true
chmod 700 "${MTLS_DIR}"

# Write to temp files then replace — avoids partial bundles if oc fails mid-way.
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

# macOS and GNU coreutils both accept -d
oc -n "${NAMESPACE}" get secret "${SECRET}" -o jsonpath='{.data.ca\.crt}'  | base64 -d > "${tmp}/ca.crt"
oc -n "${NAMESPACE}" get secret "${SECRET}" -o jsonpath='{.data.tls\.crt}' | base64 -d > "${tmp}/tls.crt"
oc -n "${NAMESPACE}" get secret "${SECRET}" -o jsonpath='{.data.tls\.key}' | base64 -d > "${tmp}/tls.key"

# Sanity: PEM headers present
grep -q 'BEGIN CERTIFICATE' "${tmp}/ca.crt"  || die "ca.crt from ${SECRET} is not a PEM certificate"
grep -q 'BEGIN CERTIFICATE' "${tmp}/tls.crt" || die "tls.crt from ${SECRET} is not a PEM certificate"
grep -q 'BEGIN .*PRIVATE KEY' "${tmp}/tls.key" || die "tls.key from ${SECRET} is not a PEM private key"

install -m 0644 "${tmp}/ca.crt"  "${MTLS_DIR}/ca.crt"
install -m 0644 "${tmp}/tls.crt" "${MTLS_DIR}/tls.crt"
install -m 0600 "${tmp}/tls.key" "${MTLS_DIR}/tls.key"

log "Synced mTLS bundle → ${MTLS_DIR}"
if command -v openssl >/dev/null 2>&1; then
	fp="$(openssl x509 -in "${MTLS_DIR}/ca.crt" -noout -fingerprint -sha256 2>/dev/null | sed 's/^.*=//')"
	printf '    CA SHA256: %s\n' "${fp}"
fi

cat <<EOF
Next (CLI connect):
  oc -n ${NAMESPACE} port-forward svc/openshell 8080:8080
  openshell gateway add https://127.0.0.1:8080 --local --name ${GATEWAY_NAME}
  # Re-sync if gateway add overwrote the bundle with local Podman/Docker certs:
  make -C deploy openshell-sync-mtls
  openshell status
EOF
