# deploy/Makefile - AgentOps demo deploy targets
#
# Run from repo root (recommended):  make demo
# Or explicitly:                    make -C deploy demo
# Do NOT run `make -C deploy` while your cwd is already deploy/ — that looks for deploy/deploy/.
#
# Full demo (deploy + verify):
#   make demo                              (APPS_DOMAIN auto-detected from cluster ingress)
#   APPS_DOMAIN=apps.ocp.example.com make demo
#
# RHOAI platform only:
#   make deploy-all                        (five rhoai-* Helm releases)
#   make validate                          (post-deploy health checks)
#   make undeploy-all                      (teardown: RHOAI stack only)
#
# OpenShell + OpenClaw (after deploy-all + validate):
#   make deploy-agent                      (openshell + ui-proxy + launch-openclaw)
#   make launch-openclaw                   (sandbox runtime only)
#   make validate-full                     (all layers: Makefile + Playwright + traces)
#
# Granular OpenShell targets:
#   make deploy-openshell APPS_DOMAIN=<domain>
#   make deploy-openclaw-ui-proxy APPS_DOMAIN=<domain>
#   make undeploy-openshell                (teardown: OpenShell + openclaw-ui-proxy)
#
# Full reset:
#   make undeploy-everything               (OpenShell/ui-proxy -> RHOAI -> operators -> orphans)
#   make validate-cleanup                  (confirm cluster is clean before redeploying)
#
# deploy-openshell installs OpenShell as a single Helm release: this repo's
# wrapper chart (deploy/helm/openshell) declares the upstream OCI chart as a
# real Helm subchart dependency (see its Chart.yaml), so one
# `helm upgrade --install` renders the namespace extras (SCC RoleBinding,
# Route) and the gateway itself together. See docs/adr/0003 for the history
# of two earlier, abandoned approaches (a dead unused dependency, then a
# two-release ConfigMap round-trip) that this replaced on 2026-08-05.
#
# Race condition fixes carried over from the reference project's lessons (constraint #21):
# - wait-dashboard-crd: Dashboard CRD doesn't exist on first helm upgrade
# - adopt-dashboard-config: operator auto-creates singleton without Helm ownership
# See docs/adr/0008-rhoai-dsc-component-selection.md

SHELL := /bin/bash
# NOTE: dir() must wrap ONLY the Makefile path; appending "/.." *inside* dir()
# (as this used to read) makes `dir` treat the literal string "Makefile/.." as
# the path and return "Makefile/", so abspath resolved to ".../deploy/Makefile"
# instead of the repo root — silently breaking openshell-sync-mtls and every
# test-* target that references $(ROOT_DIR). Found + fixed 2026-08-05 during a
# from-scratch redeploy test.
ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)


HELM := helm
HELM_OPTS ?=
WAIT_TIMEOUT ?= 300s

# Chart paths
OPERATORS_CHART := helm/operators
PLATFORM_CHART  := helm/platform
DATABASE_CHART  := helm/database
MLFLOW_CHART    := helm/mlflow
EVALHUB_CHART   := helm/evalhub
OPENSHELL_CHART := helm/openshell
OPENCLAW_UI_PROXY_CHART := helm/openclaw-ui-proxy

# Release names
OPERATORS_RELEASE := rhoai-operators
PLATFORM_RELEASE  := rhoai-platform
DATABASE_RELEASE  := rhoai-database
MLFLOW_RELEASE    := rhoai-mlflow
EVALHUB_RELEASE   := rhoai-evalhub
OPENSHELL_RELEASE ?= openshell
OPENCLAW_UI_PROXY_RELEASE := openclaw-ui-proxy

OPENSHELL_NAMESPACE ?= openshell
# Local CLI gateway alias.
GATEWAY_NAME ?= ocp
# Sandbox + public UI hostname prefix ({SANDBOX_NAME}--openclaw-ui.<domain>).
SANDBOX_NAME ?= openclaw-gw
# ServiceAccount created by the OpenShell subchart: <release>-sandbox.
SANDBOX_SA_NAME ?= $(OPENSHELL_RELEASE)-sandbox
# JWT signing secret minted by the subchart init job: <release>-jwt-keys
# (server/client TLS secret names stay fixed literals in upstream values).
JWT_SECRET_NAME ?= $(OPENSHELL_RELEASE)-jwt-keys

# Empty Docker config to avoid `credsStore: desktop`/keychain lookups when
# pulling the OpenShell OCI chart dependency on Podman-based hosts.
DOCKER_CONFIG ?= /tmp/helm-nodocker-agentops

# Auto-detect from OpenShift ingress when unset (same as scripts/common.sh).
APPS_DOMAIN ?= $(shell oc get ingress.config.openshift.io cluster -o jsonpath='{.spec.domain}' 2>/dev/null)

# verify.sh profiles (full | smoke); SKIP_E2E=1 skips Playwright + validate-traces.
VERIFY_PROFILE ?=
SKIP_E2E ?=

.PHONY: help demo deploy-agent launch-openclaw validate-full deploy-demo deploy-and-verify
.PHONY: deploy-operators wait-operators deploy-platform deploy-database
.PHONY: wait-dashboard-crd adopt-dashboard-config
.PHONY: wait-mlflow-crd deploy-mlflow wait-evalhub-crd deploy-evalhub deploy-all
.PHONY: helm-env deploy-openshell deploy-mlflow-openclaw-integration validate-openshell
.PHONY: validate-openclaw validate-traces validate-security
.PHONY: test-e2e test-ui test-security test-mlflow
.PHONY: undeploy-apps purge-dsci undeploy-operators cleanup-orphans undeploy-all
.PHONY: deploy-openclaw-ui-proxy undeploy-openshell undeploy-everything
.PHONY: openshell-sync-mtls openshell-register-gateway
.PHONY: validate validate-cleanup validate-smoke deploy-all-quiet

# --- Top-level demo targets ---

help:
	@echo "AgentOps demo — run from repo root: make demo"
	@echo ""
	@echo "Full stack:"
	@echo "  make demo                 Deploy RHOAI + OpenShell + OpenClaw, then verify"
	@echo "  make deploy-demo            Deploy only (no verify)"
	@echo "  make validate-full          Verify only (after deploy-demo)"
	@echo ""
	@echo "Layers:"
	@echo "  make deploy-all             RHOAI platform (Helm)"
	@echo "  make validate               RHOAI health check"
	@echo "  make deploy-agent           OpenShell + UI proxy + launch-openclaw"
	@echo "  make launch-openclaw        Sandbox runtime (requires deploy-openshell)"
	@echo ""
	@echo "Teardown:"
	@echo "  make undeploy-everything    Full reset"
	@echo "  make validate-cleanup       Confirm cluster is clean"
	@echo ""
	@echo "Variables: APPS_DOMAIN (auto-detected), VERIFY_PROFILE=smoke, SKIP_E2E=1"

require-apps-domain:
	@if [ -z "$(APPS_DOMAIN)" ]; then \
		echo "ERROR: APPS_DOMAIN required. Usage:"; \
		echo "  APPS_DOMAIN=apps.ocp.example.com make $@"; \
		echo "  or log into a cluster where oc can read ingress.config cluster domain"; \
		exit 1; \
	fi
	@echo "Using APPS_DOMAIN=$(APPS_DOMAIN)"

launch-openclaw:
	@test -f $(ROOT_DIR)/secrets/secrets.env || { \
		echo "ERROR: $(ROOT_DIR)/secrets/secrets.env required"; exit 1; }
	@command -v openshell >/dev/null 2>&1 || { \
		echo "ERROR: openshell CLI required on PATH"; exit 1; }
	NAMESPACE=$(OPENSHELL_NAMESPACE) SANDBOX_NAME=$(SANDBOX_NAME) GATEWAY_NAME=$(GATEWAY_NAME) \
		OPENSHELL_RELEASE_NAME=$(OPENSHELL_RELEASE) SANDBOX_SA_NAME=$(SANDBOX_SA_NAME) \
		APPS_DOMAIN=$(APPS_DOMAIN) \
		$(ROOT_DIR)/scripts/launch-openclaw.sh

# OpenShell Helm + UI proxy + sandbox runtime (requires RHOAI platform first).
deploy-agent: require-apps-domain deploy-openshell deploy-openclaw-ui-proxy launch-openclaw
	@echo "Agent stack deployed."
	@echo "Control UI: https://$(SANDBOX_NAME)--openclaw-ui.$(APPS_DOMAIN)/"
	@echo "Next: make validate-full"

deploy-demo: deploy-all deploy-agent
	@echo "Full demo stack deployed (RHOAI + OpenShell + OpenClaw)."

validate-full:
	@VERIFY_PROFILE=$(VERIFY_PROFILE) SKIP_E2E=$(SKIP_E2E) \
		$(ROOT_DIR)/scripts/verify.sh \
		$(if $(filter smoke,$(VERIFY_PROFILE)),--smoke,) \
		$(if $(filter 1,$(SKIP_E2E)),--skip-e2e,)

# One-shot: deploy everything, then run the full verification suite.
demo: deploy-demo validate-full
	@echo ""
	@echo "Demo deployed and verified."
	@echo "Control UI: https://$(SANDBOX_NAME)--openclaw-ui.$(APPS_DOMAIN)/"

deploy-and-verify: demo

# --- Deploy targets (ordered) ---

deploy-operators:
	$(HELM) upgrade --install $(OPERATORS_RELEASE) $(OPERATORS_CHART) $(HELM_OPTS)

wait-operators: deploy-operators
	@echo "Waiting for RHOAI operator CSV..."
	@until oc get csv -n redhat-ods-operator -o jsonpath='{.items[?(@.spec.displayName=="Red Hat OpenShift AI")].status.phase}' 2>/dev/null | grep -q Succeeded; do \
		PLAN=$$(oc get subscription rhods-operator -n redhat-ods-operator -o jsonpath='{.status.installplan.name}' 2>/dev/null || true); \
		if [ -n "$$PLAN" ]; then \
			APPROVED=$$(oc get installplan "$$PLAN" -n redhat-ods-operator -o jsonpath='{.spec.approved}' 2>/dev/null || true); \
			if [ "$$APPROVED" != "true" ]; then \
				echo "  Auto-approving InstallPlan $$PLAN (pinned channel in git = already reviewed)"; \
				oc -n redhat-ods-operator patch installplan "$$PLAN" --type merge -p '{"spec":{"approved":true}}' >/dev/null; \
			fi; \
		fi; \
		echo "  CSV not ready yet..."; sleep 15; \
	done
	@echo "Waiting for operator pods..."
	oc wait --for=condition=Ready pod -l name=rhods-operator -n redhat-ods-operator --timeout=$(WAIT_TIMEOUT)
	@echo "Waiting for DSCInitialization..."
	@until oc get dscinitialization default-dsci -o jsonpath='{.status.phase}' 2>/dev/null | grep -q Ready; do \
		echo "  DSCI not ready yet..."; sleep 10; \
	done
	@echo "Waiting for applications namespace..."
	@until oc get namespace redhat-ods-applications >/dev/null 2>&1; do \
		echo "  redhat-ods-applications not created yet..."; sleep 10; \
	done
	@echo "Waiting for platform CRDs..."
	@until oc get crd datascienceclusters.datasciencecluster.opendatahub.io >/dev/null 2>&1; do \
		echo "  platform CRDs not ready yet..."; sleep 10; \
	done
	@echo "Waiting for Agent Sandbox Operator CSV..."
	@# Match by displayName — a bare `{.items[*].status.phase}` can also surface
	@# Succeeded CSVs from other operators in this namespace view, exiting the
	@# wait before approving the Manual InstallPlan (sandbox stuck Provisioning).
	@until oc get csv -n agent-sandbox-system -o jsonpath='{.items[?(@.spec.displayName=="Red Hat build of Agent Sandbox")].status.phase}' 2>/dev/null | grep -q Succeeded; do \
		PLAN=$$(oc get subscription agent-sandbox-operator -n agent-sandbox-system -o jsonpath='{.status.installplan.name}' 2>/dev/null || true); \
		if [ -n "$$PLAN" ]; then \
			APPROVED=$$(oc get installplan "$$PLAN" -n agent-sandbox-system -o jsonpath='{.spec.approved}' 2>/dev/null || true); \
			if [ "$$APPROVED" != "true" ]; then \
				echo "  Auto-approving InstallPlan $$PLAN (pinned channel in git = already reviewed)"; \
				oc -n agent-sandbox-system patch installplan "$$PLAN" --type merge -p '{"spec":{"approved":true}}' >/dev/null; \
			fi; \
		fi; \
		echo "  Agent Sandbox CSV not ready yet..."; sleep 15; \
	done
	@echo "Waiting for Agent Sandbox CRDs..."
	@until oc get crd sandboxes.agents.x-k8s.io >/dev/null 2>&1; do \
		echo "  sandboxes.agents.x-k8s.io not ready yet..."; sleep 5; \
	done

# OdhDashboardConfig CRD appears only after DSC enables Dashboard — wait only for DSC CRD.
deploy-platform: wait-operators
	@$(MAKE) adopt-dashboard-config
	$(HELM) upgrade --install $(PLATFORM_RELEASE) $(PLATFORM_CHART) $(HELM_OPTS) --reset-values
	@$(MAKE) wait-dashboard-crd
	@$(MAKE) adopt-dashboard-config

wait-dashboard-crd:
	@echo "Waiting for OdhDashboardConfig CRD..."
	@i=0; until oc get crd odhdashboardconfigs.opendatahub.io >/dev/null 2>&1; do \
		i=$$((i+1)); if [ $$i -ge 30 ]; then echo "  WARNING: CRD not registered after 150s"; break; fi; \
		echo "  OdhDashboardConfig CRD not registered yet..."; sleep 5; \
	done
	@echo "Waiting for odh-dashboard-config singleton..."
	@i=0; until oc get odhdashboardconfig odh-dashboard-config -n redhat-ods-applications >/dev/null 2>&1; do \
		i=$$((i+1)); if [ $$i -ge 18 ]; then echo "  WARNING: odh-dashboard-config not created after 90s"; break; fi; \
		echo "  odh-dashboard-config not created yet..."; sleep 5; \
	done

adopt-dashboard-config:
	@if oc get odhdashboardconfig odh-dashboard-config -n redhat-ods-applications >/dev/null 2>&1; then \
		echo "Adopting odh-dashboard-config into $(PLATFORM_RELEASE) Helm release..."; \
		oc annotate odhdashboardconfig odh-dashboard-config -n redhat-ods-applications --overwrite \
			meta.helm.sh/release-name=$(PLATFORM_RELEASE) meta.helm.sh/release-namespace=default; \
		oc label odhdashboardconfig odh-dashboard-config -n redhat-ods-applications --overwrite \
			app.kubernetes.io/managed-by=Helm; \
	fi

deploy-database:
	$(HELM) upgrade --install $(DATABASE_RELEASE) $(DATABASE_CHART) $(HELM_OPTS)

wait-mlflow-crd:
	@echo "Waiting for MLflow CRD..."
	@until oc get crd mlflows.mlflow.opendatahub.io >/dev/null 2>&1; do \
		echo "  MLflow CRD not ready yet..."; sleep 10; \
	done

deploy-mlflow: deploy-database wait-mlflow-crd
	$(HELM) upgrade --install $(MLFLOW_RELEASE) $(MLFLOW_CHART) $(HELM_OPTS)

# EvalHub is provisioned by TrustyAI (this project's own values.yaml sets
# trustyai: Managed in deploy-platform), so the CRD always shows up — just
# a registration race like wait-mlflow-crd/wait-dashboard-crd above.
wait-evalhub-crd:
	@echo "Waiting for EvalHub CRD..."
	@until oc get crd evalhubs.trustyai.opendatahub.io >/dev/null 2>&1; do \
		echo "  EvalHub CRD not ready yet..."; sleep 10; \
	done

deploy-evalhub: deploy-database wait-evalhub-crd
	$(HELM) upgrade --install $(EVALHUB_RELEASE) $(EVALHUB_CHART) $(HELM_OPTS)

deploy-all: deploy-platform deploy-database deploy-mlflow deploy-evalhub
	@echo "All RHOAI components deployed."
	@echo "Next: make validate && make deploy-agent"
	@echo "  (or full stack: make demo)"

# Agent token-efficient: quiet logs + .agent-status/deploy-all.json (long-running-scripts skill)
deploy-all-quiet:
	@bash -c 'source $(ROOT_DIR)/scripts/lib/agent-run.sh && agent_run "deploy-all" $(MAKE) deploy-all'

# --- OpenShell targets (Phase 2) ---
# OpenShell MUST be deployed AFTER RHOAI (constraint #10: MLflow RBAC depends on
# the redhat-ods-applications namespace and mlflow-integration ClusterRole).

helm-env:
	@mkdir -p $(DOCKER_CONFIG)
	@test -f $(DOCKER_CONFIG)/config.json || printf '{}' > $(DOCKER_CONFIG)/config.json

deploy-openshell: helm-env
	@if [ -z "$(findstring global.appsDomain,$(HELM_OPTS))" ] && [ -z "$(APPS_DOMAIN)" ]; then \
		echo "ERROR: global.appsDomain required. Usage:"; \
		echo "  make deploy-openshell HELM_OPTS='--set global.appsDomain=apps.ocp.example.com'"; \
		echo "  or: APPS_DOMAIN=apps.ocp.example.com make deploy-openshell"; \
		exit 1; \
	fi
	@echo "Waiting for Agent Sandbox CRDs from OLM operator (agent-sandbox-operator)..."
	@# Sole source: Red Hat build of Agent Sandbox Operator (installed by
	@# deploy-operators). Do NOT apply upstream kubernetes-sigs/agent-sandbox
	@# manifests — that path was retired (ADR-0003, OSC 1.13).
	@i=0; until oc get crd sandboxes.agents.x-k8s.io >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ $$i -ge 60 ]; then \
			echo "FAIL: CRD sandboxes.agents.x-k8s.io not available."; \
			echo "  Ensure 'make deploy-operators' installed agent-sandbox-operator"; \
			echo "  and its InstallPlan was approved (channel preview-0.9)."; \
			exit 1; \
		fi; \
		echo "  Agent Sandbox CRD not ready yet..."; sleep 5; \
	done
	@echo "OK: Agent Sandbox CRD present"
	@echo "Resolving OpenShell chart dependency (pinned in Chart.yaml/Chart.lock)..."
	DOCKER_CONFIG=$(DOCKER_CONFIG) $(HELM) dependency build $(OPENSHELL_CHART)
	@echo "Installing OpenShell (single release: namespace extras + gateway)..."
	@# The server's mTLS cert is minted by the subchart's own certgen Job with
	@# only default SANs (localhost/cluster-internal names) — the external
	@# Route hostname must be added explicitly via pkiInitJob.serverDnsNames,
	@# or CLI/gRPC clients connecting through the Route fail with "certificate
	@# not valid for name ...". Route host follows OpenShift's default
	@# "<route.name>-<namespace>.<appsDomain>" pattern (no explicit host set
	@# in route.yaml). Found 2026-08-05 during a from-scratch redeploy test.
	@# NOTE: each SAN is its own --set with an indexed path (serverDnsNames[N]=...)
	@# rather than one --set with a brace list ({a,b}) -- a literal comma inside
	@# a single Make "if" function argument below is parsed by Make itself as
	@# the condition/true-text/false-text separator, silently truncating the
	@# value. Found 2026-08-05 while wiring this up.
	$(HELM) upgrade --install $(OPENSHELL_RELEASE) $(OPENSHELL_CHART) \
		--namespace $(OPENSHELL_NAMESPACE) --create-namespace \
		-f $(OPENSHELL_CHART)/values-openshift.yaml \
		$(if $(APPS_DOMAIN),--set global.appsDomain=$(APPS_DOMAIN)) \
		$(if $(APPS_DOMAIN),--set "openshell.pkiInitJob.serverDnsNames[0]=openshell-gw-$(OPENSHELL_NAMESPACE).$(APPS_DOMAIN)") \
		$(if $(APPS_DOMAIN),--set "openshell.pkiInitJob.serverDnsNames[1]=*.$(APPS_DOMAIN)") \
		$(HELM_OPTS)
	@echo "Labeling namespace for RHOAI Dashboard (Data Science Project)..."
	oc label namespace $(OPENSHELL_NAMESPACE) opendatahub.io/dashboard=true --overwrite
	@echo "Waiting for OpenShell gateway rollout..."
	oc -n $(OPENSHELL_NAMESPACE) rollout status statefulset/$(OPENSHELL_RELEASE) --timeout=600s
	@echo "Waiting for PKI secrets..."
	@for secret in openshell-server-tls openshell-client-tls $(JWT_SECRET_NAME); do \
		i=0; while ! oc -n $(OPENSHELL_NAMESPACE) get secret "$$secret" &>/dev/null; do \
			i=$$((i+1)); if [ $$i -ge 60 ]; then echo "FAIL: $$secret not created"; exit 1; fi; \
			sleep 2; \
		done; \
		echo "  $$secret exists"; \
	done
	@$(MAKE) deploy-mlflow-openclaw-integration
	@$(MAKE) openshell-register-gateway
	@echo "OpenShell deployed successfully."
	@echo "Next: make deploy-agent  (ui-proxy + launch-openclaw)"
	@echo "  or: make deploy-openclaw-ui-proxy && make launch-openclaw"

# MLflow's openclawIntegration RBAC needs the sandbox ServiceAccount, which is
# created by deploy-openshell above, so it can't run as part of
# deploy-mlflow/deploy-all (constraint #10, ADR-0003).
# Run automatically as the last step of deploy-openshell.
# --reuse-values: this is a narrow, --set-only follow-up upgrade (just flips
# openclawIntegration.*); without --reuse-values it would silently reset any
# other values the initial `deploy-mlflow` call was given (e.g. a
# non-default postgresql.password via HELM_OPTS) back to chart defaults.
deploy-mlflow-openclaw-integration:
	@echo "Waiting for $(SANDBOX_SA_NAME) ServiceAccount..."
	@i=0; while ! oc -n $(OPENSHELL_NAMESPACE) get sa $(SANDBOX_SA_NAME) &>/dev/null; do \
		i=$$((i+1)); if [ $$i -ge 60 ]; then echo "FAIL: $(SANDBOX_SA_NAME) SA not found in time"; exit 1; fi; \
		sleep 2; \
	done
	@echo "Enabling MLflow RBAC integration for OpenClaw tracing..."
	$(HELM) upgrade --install $(MLFLOW_RELEASE) $(MLFLOW_CHART) \
		--reuse-values \
		--set openclawIntegration.enabled=true \
		--set openclawIntegration.namespace=$(OPENSHELL_NAMESPACE) \
		--set openclawIntegration.serviceAccountName=$(SANDBOX_SA_NAME) \
		--set openclawIntegration.jobImage=docker.io/curlimages/curl:8.10.1 \
		--set openclawIntegration.experimentName=openclaw-tracing \
		--set openclawIntegration.mlflowNamespace=redhat-ods-applications \
		$(HELM_OPTS)
	@oc -n $(OPENSHELL_NAMESPACE) get secret $(SANDBOX_SA_NAME)-mlflow-token >/dev/null \
		&& echo "OK: $(SANDBOX_SA_NAME)-mlflow-token created" \
		|| echo "WARN: $(SANDBOX_SA_NAME)-mlflow-token not found yet (token controller may still be catching up)"

# --- openclaw-ui-proxy (nginx mTLS bridge for OpenClaw Control UI) ---
# Sole browser entrypoint: Route → nginx (TLS + mTLS to relay) → OpenShell → gateway.
# OpenClaw password auth protects the WebSocket session (ADR-0011).
# Prereq: OpenShell deployed (needs the openshell Service ClusterIP for nginx upstream).
deploy-openclaw-ui-proxy:
	@if [ -z "$(APPS_DOMAIN)" ]; then \
		echo "ERROR: APPS_DOMAIN required. Usage: APPS_DOMAIN=apps.ocp.example.com make deploy-openclaw-ui-proxy"; \
		exit 1; \
	fi
	@echo "Deploying openclaw-ui-proxy (nginx mTLS bridge)..."
	$(HELM) upgrade --install $(OPENCLAW_UI_PROXY_RELEASE) $(OPENCLAW_UI_PROXY_CHART) \
		--namespace $(OPENSHELL_NAMESPACE) \
		--set appsDomain=$(APPS_DOMAIN) \
		--set namespace=$(OPENSHELL_NAMESPACE) \
		--set sandboxName=$(SANDBOX_NAME) \
		--set openshellServiceName=$(OPENSHELL_RELEASE) \
		--wait --timeout 120s
	@echo "Verifying UI Route..."
	@sleep 3
	@HTTP_CODE=$$(curl -sk -o /dev/null -w '%{http_code}' \
		"https://$(SANDBOX_NAME)--openclaw-ui.$(APPS_DOMAIN)/" 2>/dev/null || echo "000"); \
	if [ "$$HTTP_CODE" = "200" ] || [ "$$HTTP_CODE" = "301" ] || [ "$$HTTP_CODE" = "302" ]; then \
		echo "OK: Control UI reachable via nginx bridge (HTTP $$HTTP_CODE)"; \
	else \
		echo "WARN: Expected 200/3xx, got HTTP $$HTTP_CODE (sandbox may not be launched yet)"; \
	fi
	@echo "UI URL: https://$(SANDBOX_NAME)--openclaw-ui.$(APPS_DOMAIN)"
	@echo "Auth: enter OPENCLAW_GATEWAY_PASSWORD from secrets/secrets.env in Control UI settings"

# Fast smoke checks for agent iteration (no Playwright / full E2E — see long-running-scripts skill)
validate-smoke: validate-openshell validate-security
	@echo "Smoke validation complete (infra + security only)."

# --- OpenShell + openclaw-ui-proxy teardown ---
# Reverse of deploy-openshell/deploy-openclaw-ui-proxy. Order: ui-proxy (depends on
# openshell Service) -> openshell (single release: namespace extras + gateway)
# -> namespace. Agent Sandbox Operator (OLM) is cluster-scoped infra — tear it
# down via cleanup-orphans / undeploy-all, not here.
undeploy-openshell:
	-$(HELM) uninstall $(OPENCLAW_UI_PROXY_RELEASE) -n $(OPENSHELL_NAMESPACE)
	-$(HELM) uninstall $(OPENSHELL_RELEASE) -n $(OPENSHELL_NAMESPACE)
	-@oc delete namespace $(OPENSHELL_NAMESPACE) --wait=false 2>/dev/null || true
	@echo "OpenShell + openclaw-ui-proxy teardown complete."
	@echo "NOTE: Agent Sandbox Operator (agent-sandbox-system) was NOT removed — use 'make cleanup-orphans' / 'make undeploy-all'."

validate-openshell:
	@echo "=== OpenShell ==="
	@oc -n $(OPENSHELL_NAMESPACE) get statefulset $(OPENSHELL_RELEASE) -o jsonpath='{.status.readyReplicas}{"\n"}' | grep -q 1
	@echo "OK: OpenShell StatefulSet ready"
	@for secret in openshell-server-tls openshell-client-tls $(JWT_SECRET_NAME); do \
		oc -n $(OPENSHELL_NAMESPACE) get secret "$$secret" >/dev/null 2>&1 || \
			{ echo "FAIL: $$secret missing"; exit 1; }; \
	done
	@echo "OK: PKI secrets present"
	@oc -n $(OPENSHELL_NAMESPACE) get route openshell-gw -o jsonpath='{.spec.host}{"\n"}' >/dev/null
	@echo "OK: Route exists ($$(oc -n $(OPENSHELL_NAMESPACE) get route openshell-gw -o jsonpath='{.spec.host}'))"

validate-openclaw:
	@echo "=== OpenClaw Gateway Health ==="
	@# The gateway listens on a loopback bound *inside* the sandbox's own network
	@# namespace (isolated from the "agent" container's netns) — must reach it via
	@# `openshell sandbox exec`, not a plain `oc exec -c agent`, which gets
	@# "curl: (7) Failed to connect" even though the process is alive. Same
	@# mechanism launch-openclaw.sh already uses for its own health check.
	@# Found + fixed 2026-08-05 during a from-scratch redeploy test.
	@openshell gateway select $(GATEWAY_NAME) >/dev/null 2>&1 || true
	@openshell sandbox exec -n $(SANDBOX_NAME) --no-tty --timeout 10 \
		--env "HOME=/sandbox/workspace" \
		-- bash -c 'curl -sf http://127.0.0.1:18789/health' >/dev/null
	@echo "OK: Gateway process alive"
	@echo "=== CLI: openclaw agent → inference.local → Response ==="
	@# NOTE: this bare `openclaw agent` CLI invocation cannot present the device
	@# identity the running gateway process expects over its WebSocket, so it
	@# silently falls back to an "embedded" in-process agent run (not routed
	@# through the gateway) — confirmed by `executionTrace.runner: "embedded"` /
	@# `fallbackFrom: "gateway"` in its own JSON output, and by MLflow export
	@# failures since the embedded run doesn't inherit the gateway's
	@# MLFLOW_TRACKING_TOKEN/NODE_EXTRA_CA_CERTS env. So this only proves
	@# MaaS/model connectivity, NOT the gateway-mediated path the UI actually
	@# uses. Real gateway+trace validation is `test-ui` (Playwright, browser
	@# WebSocket session) + validate-traces. Previously this target also parsed
	@# JSON fields ("status", "result.payloads") that don't exist in the CLI's
	@# actual output shape (payloads is top-level, there is no "status") and so
	@# always reported FAIL even on a successful reply — fixed 2026-08-05.
	@RESULT=$$(openshell sandbox exec -n $(SANDBOX_NAME) --no-tty --timeout 65 \
		--env "HOME=/sandbox/workspace" \
		--env "OPENCLAW_TEMP=/sandbox/workspace/.openclaw/tmp" \
		-- bash -c 'openclaw agent --agent main --message "Reply with exactly: TRACE_OK" --json --timeout 60 2>/dev/null'); \
	REPLY=$$(echo "$$RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('payloads',[{}])[0].get('text',''))" 2>/dev/null); \
	if [ -n "$$REPLY" ]; then \
		echo "OK: inference.local round-trip succeeded (reply: $$REPLY)"; \
	else \
		echo "WARN: bare CLI agent failed (often missing operator.write / embedded fallback) — gateway health OK; use test-ui + validate-traces for the real path"; \
		echo "$$RESULT" | tail -3; \
	fi

validate-traces:
	@echo "=== MLflow Trace Validation ==="
	@bash -ec 'source $(ROOT_DIR)/scripts/common.sh; \
		[[ -f $(ROOT_DIR)/secrets/secrets.env ]] && set -a && source $(ROOT_DIR)/secrets/secrets.env && set +a; \
		resolve_mlflow_experiment_id || { echo "FAIL: could not resolve MLflow experiment id"; exit 1; }; \
		MLFLOW_TOKEN=$$(oc -n $(OPENSHELL_NAMESPACE) get secret $(SANDBOX_SA_NAME)-mlflow-token -o jsonpath='"'"'{.data.token}'"'"' | base64 -d); \
		TRACES=$$(oc -n $(OPENSHELL_NAMESPACE) exec $(SANDBOX_NAME) -c agent -- \
			bash -c "curl -sk '"'"'https://mlflow.redhat-ods-applications.svc:8443/api/2.0/mlflow/traces?experiment_ids=$${MLFLOW_EXPERIMENT_ID}&max_results=1'"'"' \
			-H '"'"'Authorization: Bearer $${MLFLOW_TOKEN}'"'"' \
			-H '"'"'X-MLFLOW-WORKSPACE: $(OPENSHELL_NAMESPACE)'"'"'" 2>/dev/null); \
		COUNT=$$(echo "$$TRACES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('"'"'traces'"'"',[])))" 2>/dev/null); \
		if [ "$$COUNT" -gt 0 ] 2>/dev/null; then \
			echo "OK: MLflow has traces in experiment openclaw-tracing (id=$$MLFLOW_EXPERIMENT_ID, found $$COUNT)"; \
		else \
			echo "FAIL: No traces found in MLflow experiment openclaw-tracing (id=$$MLFLOW_EXPERIMENT_ID)"; \
			echo "  Response: $$TRACES"; \
			echo "  Ensure gateway is running with NODE_TLS_REJECT_UNAUTHORIZED=0"; \
			echo "  and plugins.entries.mlflow-openclaw.config.experimentId matches this workspace"; \
			exit 1; \
		fi'

validate-security:
	@echo "=== Sandbox Policy Enforcement ==="
	@openshell gateway select $(GATEWAY_NAME) >/dev/null 2>&1 || true
	@RESULT=$$(openshell sandbox exec -n $(SANDBOX_NAME) --no-tty -- \
		bash -c 'curl -s -m 5 -o /dev/null -w "%{http_code}" https://github.com 2>/dev/null; echo'); \
	RESULT=$$(echo "$$RESULT" | tr -d '[:space:]'); \
	if [ "$$RESULT" = "000" ] || [ "$$RESULT" = "403" ] || [ -z "$$RESULT" ]; then \
		echo "OK: github.com blocked by sandbox policy (code: $${RESULT:-timeout})"; \
	else \
		echo "FAIL: github.com reachable (HTTP $$RESULT) — policy not enforcing"; exit 1; \
	fi
	@RESULT=$$(openshell sandbox exec -n $(SANDBOX_NAME) --no-tty -- \
		bash -c 'curl -s -m 5 -o /dev/null -w "%{http_code}" https://inference.local/v1/models 2>/dev/null; echo'); \
	RESULT=$$(echo "$$RESULT" | tr -d '[:space:]'); \
	if [ "$$RESULT" = "200" ]; then \
		echo "OK: inference.local reachable (HTTP $$RESULT)"; \
	else \
		echo "FAIL: inference.local not reachable (HTTP $$RESULT)"; exit 1; \
	fi

# --- Playwright E2E Tests ---
# These test the REAL user experience: browser → UI → gateway → model → MLflow traces.
# Unlike Makefile validate-* targets (which test infra from inside the cluster),
# these tests run from outside and verify what the user actually sees.
#
# Prereqs: cd tests && npm install && npx playwright install chromium
# Env vars: OPENCLAW_BASE_URL, MLFLOW_BASE_URL, MLFLOW_AUTH_TOKEN, MLFLOW_WORKSPACE
#           MLFLOW_EXPERIMENT_ID (auto-resolved by scripts/run-playwright-tests.sh)
#           OCP_TEST_USERNAME, OCP_TEST_PASSWORD (OpenShift OAuth for MLflow UI tests)
#           PLAYWRIGHT_WORKERS (default 1; optional 2 for parallel auth setups)
# APPS_DOMAIN is auto-detected when unset (same as verify.sh / scripts/common.sh).

test-e2e:
	@$(ROOT_DIR)/scripts/run-playwright-tests.sh

test-ui:
	@$(ROOT_DIR)/scripts/run-playwright-tests.sh openclaw-ui.spec.ts

test-security:
	@$(ROOT_DIR)/scripts/run-playwright-tests.sh sandbox-security.spec.ts

test-mlflow:
	@$(ROOT_DIR)/scripts/run-playwright-tests.sh mlflow-ui.spec.ts

# --- Undeploy targets ---
# CRITICAL: DSCI must be deleted while the operator is still running,
# otherwise the finalizer cannot be processed and DSCI gets stuck in Terminating.
# Order: apps (evalhub/mlflow/db/platform) -> DSCI -> operator -> orphan cleanup.

undeploy-apps:
	-$(HELM) uninstall $(EVALHUB_RELEASE)
	-$(HELM) uninstall $(MLFLOW_RELEASE)
	-$(HELM) uninstall $(DATABASE_RELEASE)
	-$(HELM) uninstall $(PLATFORM_RELEASE)

purge-dsci:
	@echo "Deleting DSCInitialization (operator must still be running)..."
	@oc delete dscinitialization --all --timeout=60s 2>/dev/null || \
		(echo "DSCI delete timed out, patching finalizers..." && \
		 oc patch dscinitialization default-dsci --type=merge \
		   -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true)

undeploy-operators:
	-$(HELM) uninstall $(OPERATORS_RELEASE)

cleanup-orphans:
	@echo "Cleaning up residual operator resources..."
	-@oc delete subscription rhods-operator -n redhat-ods-operator 2>/dev/null || true
	-@CSV=$$(oc get csv -n redhat-ods-operator -o name 2>/dev/null | grep rhods); \
		[ -n "$$CSV" ] && oc delete "$$CSV" -n redhat-ods-operator || true
	-@oc delete deployment --all -n redhat-ods-applications 2>/dev/null || true
	-@oc delete service --all -n redhat-ods-applications 2>/dev/null || true
	-@oc delete namespace redhat-ods-operator --wait=false 2>/dev/null || true
	-@oc delete namespace redhat-ods-applications --wait=false 2>/dev/null || true
	-@oc delete namespace redhat-ods-monitoring --wait=false 2>/dev/null || true
	-@oc delete namespace evaluation --wait=false 2>/dev/null || true
	@echo "Clearing orphaned MaaS tenant finalizers (maas-controller is already gone by this point)..."
	-@for t in $$(oc get tenants.maas.opendatahub.io -n models-as-a-service -o name 2>/dev/null); do \
		oc patch "$$t" -n models-as-a-service --type=merge -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true; \
	done
	-@oc delete namespace models-as-a-service --wait=false 2>/dev/null || true
	-@oc delete namespace rhoai-model-registries --wait=false 2>/dev/null || true
	-@oc delete subscription agent-sandbox-operator -n agent-sandbox-system 2>/dev/null || true
	-@CSV=$$(oc get csv -n agent-sandbox-system -o name 2>/dev/null | grep agent-sandbox); \
		[ -n "$$CSV" ] && oc delete "$$CSV" -n agent-sandbox-system || true
	-@oc delete namespace agent-sandbox-system --wait=false 2>/dev/null || true
	@echo "Orphan cleanup complete."

undeploy-all: undeploy-apps purge-dsci undeploy-operators cleanup-orphans
	@echo "All components undeployed."

# Full-stack reset: everything this Makefile knows how to deploy, torn down in
# reverse dependency order (see docs/adr/0003-openshell-deployment-on-openshift.md
# for why OpenShell depends on RHOAI -- so it must come down first).
# Run `make validate-cleanup` afterwards to confirm before redeploying from scratch.
undeploy-everything: undeploy-openshell undeploy-all
	@echo "Full reset complete: OpenShell, openclaw-ui-proxy, Agent Sandbox, RHOAI stack, and operators removed."
	@echo "Run 'make validate-cleanup' to confirm, then 'make deploy-all' to redeploy from scratch."

# --- Validation ---

template:
	$(HELM) template $(OPERATORS_RELEASE) $(OPERATORS_CHART)
	$(HELM) template $(PLATFORM_RELEASE) $(PLATFORM_CHART)
	$(HELM) template $(DATABASE_RELEASE) $(DATABASE_CHART)
	$(HELM) template $(MLFLOW_RELEASE) $(MLFLOW_CHART)
	$(HELM) template $(EVALHUB_RELEASE) $(EVALHUB_CHART)

lint:
	$(HELM) lint $(OPERATORS_CHART)
	$(HELM) lint $(PLATFORM_CHART)
	$(HELM) lint $(DATABASE_CHART)
	$(HELM) lint $(MLFLOW_CHART)
	$(HELM) lint $(EVALHUB_CHART)

validate:
	@echo "=== Helm releases ==="
	@for rel in $(OPERATORS_RELEASE) $(PLATFORM_RELEASE) $(DATABASE_RELEASE) $(MLFLOW_RELEASE) $(EVALHUB_RELEASE); do \
		helm status "$$rel" >/dev/null 2>&1 || { echo "FAIL: release $$rel not deployed"; exit 1; }; \
	done
	@echo "OK: all 5 expected rhoai-* releases deployed"
	@echo "=== RHOAI operator ==="
	@oc get csv -n redhat-ods-operator -o jsonpath='{.items[?(@.spec.displayName=="Red Hat OpenShift AI")].status.phase}{"\n"}' | grep -q Succeeded
	@oc wait --for=condition=Ready pod -l name=rhods-operator -n redhat-ods-operator --timeout=60s >/dev/null
	@echo "OK: operator CSV Succeeded, pods Ready"
	@echo "=== Platform components ==="
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="MLflowOperatorReady")].status}{"\n"}' | grep -q True
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="TrustyAIReady")].status}{"\n"}' | grep -q True
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="DashboardReady")].status}{"\n"}' | grep -q True
	@echo "OK: MLflow operator, TrustyAI, Dashboard ready"
	@DSC_PHASE=$$(oc get datasciencecluster default-dsc -o jsonpath='{.status.phase}'); \
	DSC_MSG=$$(oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}'); \
	if [ "$$DSC_PHASE" = "Ready" ]; then \
		echo "OK: DataScienceCluster phase Ready"; \
	else \
		echo "FAIL: DataScienceCluster phase $$DSC_PHASE ($$DSC_MSG)"; exit 1; \
	fi
	@echo "=== Database ==="
	@oc wait --for=condition=Available deployment/maas-db -n redhat-ods-applications --timeout=60s >/dev/null
	@echo "OK: PostgreSQL maas-db Available"
	@echo "=== MLflow ==="
	@oc wait --for=condition=Ready pod -l app=mlflow -n redhat-ods-applications --timeout=120s >/dev/null
	@oc get mlflow mlflow -n redhat-ods-applications -o jsonpath='{.status.conditions[?(@.type=="Available")].status}{"\n"}' | grep -q True
	@echo "OK: MLflow Available ($$(oc get mlflow mlflow -n redhat-ods-applications -o jsonpath='{.status.url}'))"
	@echo "=== EvalHub ==="
	@oc get evalhub evalhub -n evaluation -o jsonpath='{.status.phase}{"\n"}' | grep -q Ready
	@oc get evalhub evalhub -n evaluation -o jsonpath='{.status.ready}{"\n"}' | grep -q True
	@echo "OK: EvalHub Ready"
	@echo ""
	@echo "All validation checks passed."

validate-cleanup:
	@echo "=== Helm releases (RHOAI) ==="
	@LEFTOVER_RHOAI=false; \
	for rel in $(OPERATORS_RELEASE) $(PLATFORM_RELEASE) $(DATABASE_RELEASE) $(MLFLOW_RELEASE) $(EVALHUB_RELEASE); do \
		if helm status "$$rel" >/dev/null 2>&1; then \
			echo "FAIL: release $$rel still deployed"; LEFTOVER_RHOAI=true; \
		fi; \
	done; \
	if [ "$$LEFTOVER_RHOAI" = "false" ]; then \
		echo "OK: all rhoai-* releases are gone"; \
	else \
		exit 1; \
	fi
	@echo "=== Helm releases (OpenShell / openclaw-ui-proxy) ==="
	@LEFTOVER=false; \
	for rel_ns in "$(OPENSHELL_RELEASE):$(OPENSHELL_NAMESPACE)" "$(OPENCLAW_UI_PROXY_RELEASE):$(OPENSHELL_NAMESPACE)"; do \
		REL=$${rel_ns%%:*}; NS=$${rel_ns##*:}; \
		if helm status "$$REL" -n "$$NS" >/dev/null 2>&1; then \
			echo "FAIL: release $$REL still deployed in ns $$NS"; LEFTOVER=true; \
		fi; \
	done; \
	if [ "$$LEFTOVER" = "true" ]; then exit 1; else echo "OK: no openshell/openclaw-ui-proxy releases"; fi
	@echo "=== DSCInitialization ==="
	@if oc get dscinitialization --no-headers 2>/dev/null | grep -q .; then \
		echo "FAIL: DSCInitialization still exists"; exit 1; \
	else \
		echo "OK: no DSCInitialization"; \
	fi
	@echo "=== DataScienceCluster ==="
	@if oc get datasciencecluster --no-headers 2>/dev/null | grep -q .; then \
		echo "FAIL: DataScienceCluster still exists"; exit 1; \
	else \
		echo "OK: no DataScienceCluster"; \
	fi
	@echo "=== Agent Sandbox Operator (OLM) ==="
	@AS_LEFTOVER=false; \
	oc get subscription agent-sandbox-operator -n agent-sandbox-system >/dev/null 2>&1 && { echo "WARN: Subscription agent-sandbox-operator still present"; AS_LEFTOVER=true; }; \
	oc get crd sandboxes.agents.x-k8s.io >/dev/null 2>&1 && { echo "WARN: CRD sandboxes.agents.x-k8s.io still present"; AS_LEFTOVER=true; }; \
	if [ "$$AS_LEFTOVER" = "false" ]; then echo "OK: no Agent Sandbox Operator leftovers"; fi
	@echo "=== Namespaces ==="
	@ALL_CLEAN=true; \
	for ns in redhat-ods-operator redhat-ods-applications redhat-ods-monitoring evaluation models-as-a-service rhoai-model-registries agent-sandbox-system $(OPENSHELL_NAMESPACE); do \
		PHASE=$$(oc get namespace "$$ns" -o jsonpath='{.status.phase}' 2>/dev/null); \
		if [ -n "$$PHASE" ]; then \
			echo "WARN: namespace $$ns still $$PHASE"; ALL_CLEAN=false; \
		fi; \
	done; \
	if [ "$$ALL_CLEAN" = "true" ]; then \
		echo "OK: all demo namespaces removed"; \
	else \
		echo "NOTE: namespaces in Terminating state will disappear shortly"; \
	fi
	@echo ""
	@echo "Cleanup validation complete."

# --- OpenShell (cluster) ---
# mTLS client bundle sync + gateway CLI registration. Install/upgrade/uninstall
# are the deploy-openshell/undeploy-openshell/validate-openshell targets above.

openshell-register-gateway:
	NAMESPACE=$(OPENSHELL_NAMESPACE) GATEWAY_NAME=$(GATEWAY_NAME) \
		$(ROOT_DIR)/scripts/openshift-openshell-register-gateway.sh

openshell-sync-mtls:
	NAMESPACE=$(OPENSHELL_NAMESPACE) GATEWAY_NAME=$(GATEWAY_NAME) \
		$(ROOT_DIR)/scripts/openshift-openshell-sync-mtls.sh
