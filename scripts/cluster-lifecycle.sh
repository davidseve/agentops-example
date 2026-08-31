#!/usr/bin/env bash
#
# Cluster lifecycle manager for AgentOps demo (agentops-showcase).
#
# Usage:
#   ./scripts/cluster-lifecycle.sh preflight   # tools, secrets, cluster clean, playwright deps
#   ./scripts/cluster-lifecycle.sh deploy      # RHOAI + OpenShell + UI proxy + OpenClaw
#   ./scripts/cluster-lifecycle.sh verify      # full validation (Makefile + Playwright)
#   ./scripts/cluster-lifecycle.sh full        # deploy + verify (one-shot)
#   ./scripts/cluster-lifecycle.sh teardown    # undeploy everything
#   ./scripts/cluster-lifecycle.sh status        # cluster + stack summary
#
# Verify flags (forwarded to verify.sh):
#   --smoke      fast subset (validate-smoke only)
#   --demo       demo v1 initial state (permissive egress, no Playwright security)
#   --skip-e2e   infra Makefile checks without Playwright/traces
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPT_DIR}/common.sh"

SMOKE=false
DEMO=false
SKIP_E2E=false

parse_flags() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --smoke)     SMOKE=true; shift ;;
      --demo)      DEMO=true; shift ;;
      --skip-e2e)  SKIP_E2E=true; shift ;;
      *) break ;;
    esac
  done
}

cmd_preflight() {
  step "Preflight: CLI tools"
  require_cmd oc
  require_cmd helm
  require_cmd openshell

  if ! oc whoami &>/dev/null; then
    error "Not logged into OpenShift — run oc login first"
    return 1
  fi
  info "Logged in as $(oc whoami) at $(oc whoami --show-server)"

  step "Preflight: secrets"
  load_secrets

  step "Preflight: cluster clean (validate-cleanup)"
  if make -C "$DEPLOY_DIR" validate-cleanup; then
    info "Cluster is clean — ready for deploy"
  else
    warn "Cluster has leftover resources from a prior deploy"
    warn "Run: make -C deploy undeploy-everything  (or ./scripts/cluster-lifecycle.sh teardown)"
    return 1
  fi

  step "Preflight: Playwright dependencies"
  ensure_playwright_deps

  detect_apps_domain
  step "Preflight complete"
  info "APPS_DOMAIN=$APPS_DOMAIN"
  info "Next: ./scripts/cluster-lifecycle.sh full"
}

cmd_deploy() {
  load_secrets
  detect_apps_domain

  step "Phase 1: RHOAI platform (make deploy-all)"
  make -C "$DEPLOY_DIR" deploy-all

  step "Phase 2: OpenShell gateway (make deploy-openshell)"
  make -C "$DEPLOY_DIR" deploy-openshell "APPS_DOMAIN=$APPS_DOMAIN"

  step "Phase 3: Browser UI proxy (make deploy-openclaw-ui-proxy)"
  make -C "$DEPLOY_DIR" deploy-openclaw-ui-proxy "APPS_DOMAIN=$APPS_DOMAIN"

  step "Phase 4: Launch OpenClaw in sandbox"
  export APPS_DOMAIN NAMESPACE SANDBOX_NAME GATEWAY_NAME OPENSHELL_RELEASE_NAME SANDBOX_SA_NAME
  "${SCRIPT_DIR}/launch-openclaw.sh"

  step "Deployment complete"
  info "Control UI: https://${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}/"
  info "Validate: ./scripts/cluster-lifecycle.sh verify"
}

cmd_verify() {
  local verify_args=()
  if [[ "$SMOKE" == "true" ]]; then
    verify_args+=(--smoke)
  fi
  if [[ "$DEMO" == "true" ]]; then
    export VERIFY_PROFILE=demo
    verify_args+=(--demo)
  fi
  if [[ "$SKIP_E2E" == "true" ]]; then
    verify_args+=(--skip-e2e)
  fi
  export SKIP_E2E="$([[ "$SKIP_E2E" == "true" ]] && echo 1 || echo 0)"
  "${SCRIPT_DIR}/verify.sh" "${verify_args[@]}"
}

cmd_teardown() {
  step "Teardown: undeploy everything"
  make -C "$DEPLOY_DIR" undeploy-everything
  step "Teardown complete"
  info "Run preflight to confirm: ./scripts/cluster-lifecycle.sh preflight"
}

cmd_status() {
  detect_apps_domain || true

  step "Cluster"
  oc whoami --show-server 2>/dev/null && info "User: $(oc whoami 2>/dev/null)" || warn "Not logged in"

  step "Helm releases (rhoai-*)"
  for rel in rhoai-operators rhoai-platform rhoai-database rhoai-mlflow rhoai-evalhub; do
    if helm status "$rel" &>/dev/null; then
      info "  $rel: deployed"
    else
      info "  $rel: not deployed"
    fi
  done

  step "OpenShell namespace ($NAMESPACE)"
  if oc get namespace "$NAMESPACE" &>/dev/null; then
    oc get pods -n "$NAMESPACE" 2>/dev/null || true
    if [[ -n "${APPS_DOMAIN:-}" ]]; then
      info "Control UI: https://${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}/"
    fi
  else
    info "Namespace $NAMESPACE not found"
  fi

  if oc get datasciencecluster default-dsc &>/dev/null; then
    step "DataScienceCluster"
    oc get datasciencecluster default-dsc -o jsonpath='{.status.phase}{"\n"}' 2>/dev/null || true
  fi
}

cmd_full() {
  cmd_deploy
  SMOKE=false
  SKIP_E2E=false
  cmd_verify
  echo ""
  step "Full lifecycle complete"
  info "Control UI: https://${SANDBOX_NAME}--openclaw-ui.${APPS_DOMAIN}/"
  info "Teardown: ./scripts/cluster-lifecycle.sh teardown"
}

# --- Main ---

_ORIG_ARGS=("$@")
COMMAND="${1:-help}"
shift || true
parse_flags "$@"

# Token-efficient agent wrapper (long-running-scripts skill).
if [[ -f "${SCRIPT_DIR}/lib/agent-run.sh" && "${CLUSTER_LIFECYCLE_AGENT_RUN:-}" != "1" ]]; then
  case "$COMMAND" in
    deploy|verify|full|preflight)
      # shellcheck source=scripts/lib/agent-run.sh
      source "${SCRIPT_DIR}/lib/agent-run.sh"
      agent_run "cluster-lifecycle-${COMMAND}" env CLUSTER_LIFECYCLE_AGENT_RUN=1 "$0" "${_ORIG_ARGS[@]}"
      exit $?
      ;;
  esac
fi

case "$COMMAND" in
  preflight) cmd_preflight ;;
  deploy)    cmd_deploy ;;
  verify)    cmd_verify ;;
  teardown)  cmd_teardown ;;
  status)    cmd_status ;;
  full)      cmd_full ;;
  help|--help|-h)
    echo "Usage: $0 {preflight|deploy|verify|full|teardown|status} [--smoke] [--demo] [--skip-e2e]"
    echo ""
    echo "Commands:"
    echo "  preflight   Verify tools, secrets, cluster clean, Playwright deps"
    echo "  deploy      Deploy full stack (RHOAI + OpenShell + OpenClaw)"
    echo "  verify      Run verification suite (default: full profile)"
    echo "  full        deploy + verify (one-shot)"
    echo "  teardown    Remove all deployed resources"
    echo "  status      Show cluster and stack status"
    echo ""
    echo "Verify flags:"
    echo "  --smoke     Fast subset (validate-smoke only)"
    echo "  --demo      Demo v1 initial state (VERIFY_PROFILE=demo)"
    echo "  --skip-e2e  Skip Playwright E2E and validate-traces"
    ;;
  *)
    error "Unknown command: $COMMAND"
    echo "Run: $0 help"
    exit 1
    ;;
esac
