#!/usr/bin/env bash
# Install the OpenShell stack for the AgentOps demo on macOS and Linux.
#
# Components installed:
#   - OpenShell CLI and local gateway (official NVIDIA install script)
#   - Podman compute driver (preferred for OpenShift-aligned workflows)
#   - Gateway registration and driver configuration
#
# Usage:
#   ./scripts/install-openshell.sh
#   OPENSHELL_VERSION=0.0.58 ./scripts/install-openshell.sh
#   OPENSHELL_DRIVER=docker ./scripts/install-openshell.sh
#   SKIP_PODMAN=1 ./scripts/install-openshell.sh
#
# Environment variables:
#   OPENSHELL_VERSION   Pin OpenShell release (e.g. 0.0.58). Default: latest.
#   OPENSHELL_DRIVER    Compute driver: podman (default), docker, or vm.
#   SKIP_PODMAN         Set to 1 to skip Podman installation and machine setup.
#   LOCAL_GATEWAY_URL   Gateway URL. Default: https://127.0.0.1:17670
#
# See docs/openshell-installation.md for troubleshooting and manual steps.
# To uninstall: ./scripts/uninstall-openshell.sh --yes

set -euo pipefail

readonly SCRIPT_NAME="install-openshell"
readonly OPENSHELL_INSTALL_URL="https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh"
readonly LOCAL_GATEWAY_URL="${LOCAL_GATEWAY_URL:-https://127.0.0.1:17670}"
readonly OPENSHELL_DRIVER="${OPENSHELL_DRIVER:-podman}"
readonly SKIP_PODMAN="${SKIP_PODMAN:-0}"
readonly GATEWAY_ENV_FILE="${HOME}/.config/openshell/gateway.env"

info()  { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; }
warn()  { printf '%s: warning: %s\n' "$SCRIPT_NAME" "$*" >&2; }
error() { printf '%s: error: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Install the OpenShell stack (CLI, gateway, compute driver) on macOS or Linux.

Usage:
  install-openshell.sh [options]

Options:
  -h, --help    Show this help message
  --dry-run     Print planned actions without making changes

Environment:
  OPENSHELL_VERSION   Pin OpenShell release (default: latest)
  OPENSHELL_DRIVER    podman | docker | vm (default: podman)
  SKIP_PODMAN         Set to 1 to skip Podman install
  LOCAL_GATEWAY_URL   Gateway URL (default: https://127.0.0.1:17670)

Examples:
  ./scripts/install-openshell.sh
  OPENSHELL_VERSION=0.0.58 ./scripts/install-openshell.sh
  OPENSHELL_DRIVER=docker SKIP_PODMAN=1 ./scripts/install-openshell.sh
EOF
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  has_cmd "$1" || error "'$1' is required but not found in PATH"
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      error "unsupported operating system: $(uname -s)" ;;
  esac
}

detect_linux_pkg_manager() {
  if has_cmd dnf; then
    echo "dnf"
  elif has_cmd yum; then
    echo "yum"
  elif has_cmd apt-get; then
    echo "apt"
  else
    echo "unknown"
  fi
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif has_cmd sudo; then
    sudo "$@"
  else
    error "root privileges required to run: $*"
  fi
}

install_openshell() {
  info "installing OpenShell CLI and gateway"
  require_cmd curl

  local env_args=()
  if [[ -n "${OPENSHELL_VERSION:-}" ]]; then
    env_args+=(OPENSHELL_VERSION="${OPENSHELL_VERSION}")
    info "pinning OpenShell version to ${OPENSHELL_VERSION}"
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run official OpenShell install script"
    return 0
  fi

  env "${env_args[@]}" sh -c "curl -LsSf '${OPENSHELL_INSTALL_URL}' | sh"
}

install_podman_macos() {
  if [[ "$SKIP_PODMAN" -eq 1 || "$OPENSHELL_DRIVER" != "podman" ]]; then
    info "skipping Podman installation"
    return 0
  fi

  require_cmd brew

  if ! has_cmd podman; then
    info "installing Podman via Homebrew"
    if [[ "$DRY_RUN" -eq 1 ]]; then
      info "[dry-run] would run: brew install podman"
    else
      brew install podman
    fi
  else
    info "Podman already installed"
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would initialize and start podman machine if needed"
    return 0
  fi

  if ! podman machine list --format '{{.Name}}' 2>/dev/null | grep -q .; then
    info "initializing Podman machine (first run)"
    podman machine init
  fi

  if ! podman machine list --format '{{.Running}}' 2>/dev/null | grep -q true; then
    info "starting Podman machine"
    podman machine start
  else
    info "Podman machine already running"
  fi

  podman info >/dev/null
  info "Podman is ready"
}

install_podman_linux() {
  if [[ "$SKIP_PODMAN" -eq 1 || "$OPENSHELL_DRIVER" != "podman" ]]; then
    info "skipping Podman installation"
    return 0
  fi

  if has_cmd podman; then
    info "Podman already installed"
    podman info >/dev/null
    return 0
  fi

  local pkg_manager
  pkg_manager="$(detect_linux_pkg_manager)"

  case "$pkg_manager" in
    dnf|yum)
      info "installing Podman via ${pkg_manager}"
      if [[ "$DRY_RUN" -eq 1 ]]; then
        info "[dry-run] would run: ${pkg_manager} install -y podman"
      else
        run_as_root "$pkg_manager" install -y podman
      fi
      ;;
    apt)
      info "installing Podman via apt"
      if [[ "$DRY_RUN" -eq 1 ]]; then
        info "[dry-run] would run: apt-get update && apt-get install -y podman"
      else
        run_as_root apt-get update -qq
        run_as_root apt-get install -y podman
      fi
      ;;
    *)
      warn "could not detect dnf/yum/apt; install Podman manually and re-run"
      return 0
      ;;
  esac

  podman info >/dev/null
  info "Podman is ready"
}

configure_gateway_driver() {
  info "configuring gateway compute driver: ${OPENSHELL_DRIVER}"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would write ${GATEWAY_ENV_FILE}"
    return 0
  fi

  mkdir -p "$(dirname "$GATEWAY_ENV_FILE")"
  printf 'OPENSHELL_DRIVERS=%s\n' "$OPENSHELL_DRIVER" >"$GATEWAY_ENV_FILE"
  info "wrote ${GATEWAY_ENV_FILE}"
}

restart_gateway_macos() {
  if ! has_cmd brew; then
    warn "Homebrew not found; restart the OpenShell gateway manually"
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run: brew services restart openshell"
    return 0
  fi

  if brew services list 2>/dev/null | awk '{print $1}' | grep -qx openshell; then
    brew services restart openshell
    info "restarted openshell gateway (Homebrew service)"
  else
    warn "openshell Homebrew service not found; gateway may need manual start"
  fi
}

restart_gateway_linux() {
  if ! has_cmd systemctl; then
    warn "systemctl not found; restart openshell-gateway manually"
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run: systemctl --user enable --now openshell-gateway"
    info "[dry-run] would run: systemctl --user restart openshell-gateway"
    return 0
  fi

  systemctl --user enable --now openshell-gateway
  systemctl --user restart openshell-gateway
  info "restarted openshell-gateway (systemd user unit)"
}

enable_linger_linux() {
  if ! has_cmd loginctl; then
    warn "loginctl not found; skip linger setup"
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run: loginctl enable-linger ${USER}"
    return 0
  fi

  if loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
    info "systemd linger already enabled for ${USER}"
  else
    info "enabling systemd linger for ${USER} (gateway survives logout)"
    run_as_root loginctl enable-linger "$USER"
  fi
}

register_local_gateway() {
  require_cmd openshell

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run: openshell gateway add --local ${LOCAL_GATEWAY_URL}"
    return 0
  fi

  if openshell gateway list 2>/dev/null | grep -qF "$LOCAL_GATEWAY_URL"; then
    info "local gateway already registered at ${LOCAL_GATEWAY_URL}"
    return 0
  fi

  openshell gateway add --local "$LOCAL_GATEWAY_URL"
  info "registered local gateway at ${LOCAL_GATEWAY_URL}"
}

verify_installation() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run: openshell status"
    return 0
  fi

  require_cmd openshell
  info "running smoke test: openshell status"

  local attempt
  for attempt in 1 2 3 4 5; do
    if openshell status 2>/dev/null | grep -q 'Connected'; then
      openshell status
      info "OpenShell stack installation complete"
      return 0
    fi
    if [[ "$attempt" -lt 5 ]]; then
      info "gateway not ready yet, retrying (${attempt}/5)..."
      sleep 3
    fi
  done

  openshell status
  info "OpenShell stack installation complete"
}

preflight_checks() {
  local os="$1"

  require_cmd curl

  case "$OPENSHELL_DRIVER" in
    podman|docker|vm) ;;
    *) error "unsupported OPENSHELL_DRIVER '${OPENSHELL_DRIVER}' (use podman, docker, or vm)" ;;
  esac

  if [[ "$os" == "macos" ]]; then
    if [[ "$(uname -m)" != "arm64" ]]; then
      warn "official OpenShell install script targets Apple Silicon; Intel Macs may need PyPI or release artifacts"
    fi
    if ! has_cmd brew; then
      error "Homebrew is required on macOS; install from https://brew.sh"
    fi
  fi

  if [[ "$os" == "linux" ]]; then
    local libc
    libc="$(ldd --version 2>&1 | head -n1 || true)"
    if echo "$libc" | grep -qiE 'musl|alpine'; then
      error "OpenShell Linux packages require glibc >= 2.28; musl/Alpine is not supported"
    fi
  fi
}

main() {
  local dry_run=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      --dry-run)
        dry_run=1
        shift
        ;;
      *)
        error "unknown option: $1 (use --help)"
        ;;
    esac
  done

  DRY_RUN="$dry_run"
  local os
  os="$(detect_os)"

  info "detected platform: ${os}"
  preflight_checks "$os"

  install_openshell

  case "$os" in
    macos)
      install_podman_macos
      configure_gateway_driver
      restart_gateway_macos
      ;;
    linux)
      install_podman_linux
      configure_gateway_driver
      enable_linger_linux
      restart_gateway_linux
      ;;
  esac

  register_local_gateway
  verify_installation
}

main "$@"
