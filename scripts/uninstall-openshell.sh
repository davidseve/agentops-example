#!/usr/bin/env bash
# Remove the OpenShell stack installed by install-openshell.sh on macOS and Linux.
#
# Removes:
#   - OpenShell CLI and gateway (Homebrew formula or Linux packages)
#   - Gateway service (brew services / systemd user unit)
#   - User configuration under ~/.config/openshell
#   - Homebrew runtime data under $(brew --prefix)/var/openshell (macOS)
#
# Does NOT remove Podman (it may be used outside this demo).
#
# Usage:
#   ./scripts/uninstall-openshell.sh --yes
#   ./scripts/uninstall-openshell.sh --dry-run
#
# See docs/openshell-installation.md for details.

set -euo pipefail

readonly SCRIPT_NAME="uninstall-openshell"
readonly OPENSHELL_CONFIG_DIR="${HOME}/.config/openshell"
readonly LOCAL_GATEWAY_NAME="${LOCAL_GATEWAY_NAME:-openshell}"
readonly REMOVE_BREW_TAP="${REMOVE_BREW_TAP:-0}"

info()  { printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2; }
warn()  { printf '%s: warning: %s\n' "$SCRIPT_NAME" "$*" >&2; }
error() { printf '%s: error: %s\n' "$SCRIPT_NAME" "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Remove the OpenShell stack (CLI, gateway, user config) on macOS or Linux.

Usage:
  uninstall-openshell.sh [options]

Options:
  -h, --help    Show this help message
  --dry-run     Print planned actions without making changes
  -y, --yes     Confirm uninstall (required to make changes)

Environment:
  REMOVE_BREW_TAP   Set to 1 to untap nvidia/openshell on macOS (default: keep)
  LOCAL_GATEWAY_NAME  Gateway registration name (default: openshell)

Examples:
  ./scripts/uninstall-openshell.sh --dry-run
  ./scripts/uninstall-openshell.sh --yes
EOF
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
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

run_or_dry() {
  local description="$1"
  shift

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would run: $description"
    return 0
  fi

  info "$description"
  "$@"
}

remove_path_if_exists() {
  local path="$1"

  if [[ ! -e "$path" ]]; then
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] would remove: ${path}"
    return 0
  fi

  rm -rf "$path"
  info "removed ${path}"
}

remove_gateway_registration() {
  if ! has_cmd openshell; then
    info "openshell CLI not found; skipping gateway registration removal"
    return 0
  fi

  if ! NO_COLOR=1 openshell gateway info -g "$LOCAL_GATEWAY_NAME" >/dev/null 2>&1; then
    info "gateway registration '${LOCAL_GATEWAY_NAME}' not found"
    return 0
  fi

  run_or_dry "removing gateway registration '${LOCAL_GATEWAY_NAME}'" \
    openshell gateway remove "$LOCAL_GATEWAY_NAME"
}

stop_gateway_macos() {
  if ! has_cmd brew; then
    return 0
  fi

  if brew services list 2>/dev/null | awk '{print $1}' | grep -qx openshell; then
    run_or_dry "stopping openshell Homebrew service" brew services stop openshell
  else
    info "openshell Homebrew service not registered"
  fi
}

uninstall_openshell_macos() {
  if ! has_cmd brew; then
    warn "Homebrew not found; skipping formula uninstall"
    return 0
  fi

  if brew list --formula openshell >/dev/null 2>&1; then
    run_or_dry "uninstalling openshell Homebrew formula" brew uninstall --force openshell
  else
    info "openshell Homebrew formula not installed"
  fi

  if [[ "$REMOVE_BREW_TAP" -eq 1 ]]; then
    if brew tap 2>/dev/null | grep -qx "nvidia/openshell"; then
      run_or_dry "removing Homebrew tap nvidia/openshell" brew untap nvidia/openshell
    fi
  fi

  local brew_prefix
  brew_prefix="$(brew --prefix 2>/dev/null || true)"
  if [[ -n "$brew_prefix" ]]; then
    remove_path_if_exists "${brew_prefix}/var/openshell"
    remove_path_if_exists "${brew_prefix}/var/log/openshell"
  fi

  remove_path_if_exists "${HOME}/Library/LaunchAgents/homebrew.mxcl.openshell.plist"
}

stop_gateway_linux() {
  if ! has_cmd systemctl; then
    return 0
  fi

  if systemctl --user list-unit-files openshell-gateway.service >/dev/null 2>&1; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      info "[dry-run] would run: systemctl --user disable --now openshell-gateway"
    else
      info "stopping and disabling openshell-gateway user service"
      systemctl --user disable --now openshell-gateway 2>/dev/null || true
    fi
  else
    info "openshell-gateway systemd user unit not found"
  fi
}

linux_packages_installed() {
  local pkg_manager="$1"
  local pkg

  for pkg in openshell openshell-gateway; do
    case "$pkg_manager" in
      dnf|yum)
        if rpm -q "$pkg" >/dev/null 2>&1; then
          printf '%s\n' "$pkg"
        fi
        ;;
      apt)
        if dpkg -s "$pkg" >/dev/null 2>&1; then
          printf '%s\n' "$pkg"
        fi
        ;;
    esac
  done
}

uninstall_openshell_linux() {
  local pkg_manager
  pkg_manager="$(detect_linux_pkg_manager)"
  local packages=()
  local pkg

  while IFS= read -r pkg; do
    [[ -n "$pkg" ]] && packages+=("$pkg")
  done < <(linux_packages_installed "$pkg_manager")

  if [[ "${#packages[@]}" -eq 0 ]]; then
    info "OpenShell Linux packages not installed"
    return 0
  fi

  case "$pkg_manager" in
    dnf|yum)
      run_or_dry "removing OpenShell RPM packages" run_as_root "$pkg_manager" remove -y "${packages[@]}"
      ;;
    apt)
      run_or_dry "removing OpenShell Debian packages" run_as_root apt-get remove -y "${packages[@]}"
      run_or_dry "purging OpenShell Debian packages" run_as_root apt-get purge -y "${packages[@]}"
      ;;
    *)
      warn "could not detect dnf/yum/apt; remove OpenShell packages manually: ${packages[*]}"
      ;;
  esac
}

remove_user_config() {
  remove_path_if_exists "$OPENSHELL_CONFIG_DIR"
}

remove_pypi_install() {
  local pypi_bin="${HOME}/.local/bin/openshell"

  if [[ -x "$pypi_bin" ]]; then
    if has_cmd uv; then
      run_or_dry "removing openshell PyPI tool via uv" uv tool uninstall openshell
    else
      warn "found ${pypi_bin} but uv is not installed; remove the PyPI install manually"
    fi
  fi
}

verify_removal() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[dry-run] uninstall plan complete"
    return 0
  fi

  if has_cmd openshell; then
    warn "openshell binary is still present in PATH"
  else
    info "openshell CLI removed"
  fi

  if [[ -d "$OPENSHELL_CONFIG_DIR" ]]; then
    warn "configuration directory still exists: ${OPENSHELL_CONFIG_DIR}"
  else
    info "user configuration removed"
  fi

  info "OpenShell stack uninstall complete"
}

main() {
  local dry_run=0
  local confirm=0

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
      -y|--yes)
        confirm=1
        shift
        ;;
      *)
        error "unknown option: $1 (use --help)"
        ;;
    esac
  done

  DRY_RUN="$dry_run"

  if [[ "$DRY_RUN" -eq 0 && "$confirm" -ne 1 ]]; then
    error "refusing to uninstall without confirmation; pass --yes or use --dry-run"
  fi

  local os
  os="$(detect_os)"
  info "detected platform: ${os}"

  remove_gateway_registration

  case "$os" in
    macos)
      stop_gateway_macos
      uninstall_openshell_macos
      ;;
    linux)
      stop_gateway_linux
      uninstall_openshell_linux
      ;;
  esac

  remove_pypi_install
  remove_user_config
  verify_removal
}

main "$@"
