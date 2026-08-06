# deploy/Makefile - AgentOps demo deploy targets
#
# RHOAI (full platform):
#   make deploy-all    (full stack)
#   make validate      (post-deploy health checks)
#   make undeploy-all  (teardown: RHOAI stack only)
#
# OpenShell + OpenClaw:
#   make deploy-openshell HELM_OPTS='--set global.appsDomain=<domain>'
#   make deploy-oauth2-proxy APPS_DOMAIN=<domain>
#   make undeploy-openshell   (teardown: OpenShell + oauth2-proxy + Agent Sandbox)
#
# Full reset (everything this Makefile can deploy, in one shot):
#   make undeploy-everything  (OpenShell/oauth2-proxy -> RHOAI apps -> DSCI -> operators -> orphans)
#   make validate-cleanup     (confirm the cluster is actually clean before redeploying)
#
# deploy-openshell installs OpenShell as a single Helm release: this repo's
# wrapper chart (deploy/helm/openshell) declares the upstream OCI chart as a
# real Helm subchart dependency (see its Chart.yaml), so one
# `helm upgrade --install` renders the namespace extras (SCC RoleBinding,
# Route) and the gateway itself together. See docs/adr/0003 for the history
# of two earlier, abandoned approaches (a dead unused dependency, then a
# two-release ConfigMap round-trip) that this replaced on 2026-08-05.
#
# Race condition fixes carried over from the reference project's lessons (constraints #21, #23):
# - wait-dashboard-crd: Dashboard CRD doesn't exist on first helm upgrade
# - adopt-dashboard-config: operator auto-creates singleton without Helm ownership
# - wait-llamastack: Gen AI Studio nav requires LlamaStackOperatorReady=True
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
OAUTH2_PROXY_CHART := helm/oauth2-proxy

# Release names
OPERATORS_RELEASE := rhoai-operators
PLATFORM_RELEASE  := rhoai-platform
DATABASE_RELEASE  := rhoai-database
MLFLOW_RELEASE    := rhoai-mlflow
EVALHUB_RELEASE   := rhoai-evalhub
OPENSHELL_RELEASE := openshell
OAUTH2_PROXY_RELEASE := oauth2-proxy

OPENSHELL_NAMESPACE := openshell

# Empty Docker config to avoid `credsStore: desktop`/keychain lookups when
# pulling the OpenShell OCI chart dependency on Podman-based hosts.
DOCKER_CONFIG ?= /tmp/helm-nodocker-agentops

.PHONY: deploy-operators wait-operators deploy-platform deploy-platform-fresh ensure-mlflowoperator-managed deploy-database
.PHONY: wait-dashboard-crd adopt-dashboard-config wait-llamastack wait-llamastack-and-refresh-dashboard
.PHONY: wait-mlflow-crd deploy-mlflow wait-evalhub-crd deploy-evalhub deploy-all
.PHONY: helm-env deploy-openshell deploy-mlflow-openclaw-integration validate-openshell
.PHONY: validate-openclaw validate-traces validate-security
.PHONY: test-e2e test-ui test-security test-mlflow
.PHONY: undeploy-apps purge-dsci undeploy-operators cleanup-orphans undeploy-all
.PHONY: deploy-oauth2-proxy undeploy-openshell undeploy-everything
.PHONY: openshell-sync-mtls
.PHONY: validate validate-cleanup validate-smoke deploy-all-quiet

# --- Deploy targets (ordered) ---
#
# Cluster coexistence (see ADR-0002's addendum, docs/adr/0002-ocp-with-rhoai-as-platform.md):
# RHOAI, its DataScienceCluster, the Postgres backend, and MLflow itself are
# cluster-wide/shared resources. Another, independent OpenShell/OpenClaw
# deployment project may install them under the exact same Helm release
# names on this same cluster. If that already happened, skip re-installing
# here and reuse the shared instance instead of a redundant/values-resetting
# `helm upgrade`.

deploy-operators:
	@if $(HELM) status $(OPERATORS_RELEASE) >/dev/null 2>&1; then \
		echo "Release '$(OPERATORS_RELEASE)' already deployed (shared cluster resource) — skipping install."; \
	else \
		$(HELM) upgrade --install $(OPERATORS_RELEASE) $(OPERATORS_CHART) $(HELM_OPTS); \
	fi

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

deploy-platform: wait-operators
	@if $(HELM) status $(PLATFORM_RELEASE) >/dev/null 2>&1; then \
		echo "Release '$(PLATFORM_RELEASE)' already deployed (shared cluster resource) — skipping helm upgrade, reconciling mlflowoperator only."; \
		$(MAKE) ensure-mlflowoperator-managed; \
	else \
		$(MAKE) deploy-platform-fresh; \
	fi

# Minimal, non-destructive reconciliation for a DataScienceCluster this
# project doesn't own the Helm release for: only touches
# spec.components.mlflowoperator, not a full `helm upgrade` with this
# project's own values (which could flip a component the other project
# configured, e.g. dashboard/genAiStudio).
ensure-mlflowoperator-managed:
	@CURRENT=$$(oc get datasciencecluster default-dsc -o jsonpath='{.spec.components.mlflowoperator.managementState}' 2>/dev/null || true); \
	if [ "$$CURRENT" = "Managed" ]; then \
		echo "mlflowoperator already Managed on the shared DataScienceCluster."; \
	else \
		echo "Patching shared DataScienceCluster: mlflowoperator -> Managed (was '$$CURRENT')..."; \
		oc patch datasciencecluster default-dsc --type merge -p '{"spec":{"components":{"mlflowoperator":{"managementState":"Managed"}}}}'; \
	fi

deploy-platform-fresh:
	@CURRENT_DASHBOARD=$$(oc get datasciencecluster default-dsc -o jsonpath='{.spec.components.dashboard.managementState}' 2>/dev/null || true); \
	if [ "$$CURRENT_DASHBOARD" != "Managed" ]; then \
		echo "Fresh Dashboard enable: sequencing llamastackoperator BEFORE dashboard"; \
		echo "(see docs/adr/0008-rhoai-dsc-component-selection.md, constraint #23)"; \
		$(HELM) upgrade --install $(PLATFORM_RELEASE) $(PLATFORM_CHART) $(HELM_OPTS) \
			--set-string datasciencecluster.components.dashboard.managementState=Removed; \
		$(MAKE) wait-llamastack; \
	fi
	@$(MAKE) adopt-dashboard-config
	$(HELM) upgrade --install $(PLATFORM_RELEASE) $(PLATFORM_CHART) $(HELM_OPTS) --reset-values
	@$(MAKE) wait-dashboard-crd
	@$(MAKE) adopt-dashboard-config
	@echo "Re-applying platform chart (genAiStudio patch now renders after CRD exists)..."
	$(HELM) upgrade --install $(PLATFORM_RELEASE) $(PLATFORM_CHART) $(HELM_OPTS) --reset-values
	@$(MAKE) wait-llamastack-and-refresh-dashboard

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

wait-llamastack:
	@echo "Waiting for LlamaStackOperatorReady (required for Gen AI Studio nav)..."
	@i=0; until oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="LlamaStackOperatorReady")].status}{"\n"}' 2>/dev/null | grep -q True; do \
		i=$$((i+1)); if [ $$i -ge 24 ]; then echo "  WARNING: LlamaStackOperatorReady not True after 120s"; break; fi; \
		echo "  LlamaStackOperatorReady not True yet..."; sleep 5; \
	done

wait-llamastack-and-refresh-dashboard: wait-llamastack
	@if oc get deployment rhods-dashboard -n redhat-ods-applications >/dev/null 2>&1; then \
		echo "Restarting rhods-dashboard (re-evaluate LlamaStackOperator capability)..."; \
		oc rollout restart deployment/rhods-dashboard -n redhat-ods-applications; \
		oc rollout status deployment/rhods-dashboard -n redhat-ods-applications --timeout=120s; \
	fi

deploy-database:
	@if $(HELM) status $(DATABASE_RELEASE) >/dev/null 2>&1; then \
		echo "Release '$(DATABASE_RELEASE)' already deployed (shared cluster resource) — skipping install."; \
	else \
		$(HELM) upgrade --install $(DATABASE_RELEASE) $(DATABASE_CHART) $(HELM_OPTS); \
	fi

wait-mlflow-crd:
	@echo "Waiting for MLflow CRD..."
	@until oc get crd mlflows.mlflow.opendatahub.io >/dev/null 2>&1; do \
		echo "  MLflow CRD not ready yet..."; sleep 10; \
	done

deploy-mlflow: deploy-database wait-mlflow-crd
	@if $(HELM) status $(MLFLOW_RELEASE) >/dev/null 2>&1; then \
		echo "Release '$(MLFLOW_RELEASE)' already deployed (shared cluster resource) — skipping install, reusing shared MLflow instance."; \
	else \
		$(HELM) upgrade --install $(MLFLOW_RELEASE) $(MLFLOW_CHART) $(HELM_OPTS); \
	fi

wait-evalhub-crd:
	@echo "Waiting for EvalHub CRD..."
	@until oc get crd evalhubs.trustyai.opendatahub.io >/dev/null 2>&1; do \
		echo "  EvalHub CRD not ready yet..."; sleep 10; \
	done

deploy-evalhub: deploy-database wait-evalhub-crd
	$(HELM) upgrade --install $(EVALHUB_RELEASE) $(EVALHUB_CHART) $(HELM_OPTS)

deploy-all: deploy-platform deploy-database deploy-mlflow deploy-evalhub
	@echo "All RHOAI components deployed."
	@echo "Next: make deploy-openshell HELM_OPTS='--set global.appsDomain=<your-apps-domain>'"

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
	@echo "Applying Agent Sandbox CRDs + controller..."
	oc apply -f manifests/agent-sandbox-v0.5.1.yaml
	@echo "Waiting for Agent Sandbox CRD..."
	@until oc get crd sandboxes.agents.x-k8s.io >/dev/null 2>&1; do sleep 3; done
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
	oc -n $(OPENSHELL_NAMESPACE) rollout status statefulset/openshell --timeout=600s
	@echo "Waiting for PKI secrets..."
	@for secret in openshell-server-tls openshell-client-tls openshell-jwt-keys; do \
		i=0; while ! oc -n $(OPENSHELL_NAMESPACE) get secret "$$secret" &>/dev/null; do \
			i=$$((i+1)); if [ $$i -ge 60 ]; then echo "FAIL: $$secret not created"; exit 1; fi; \
			sleep 2; \
		done; \
		echo "  $$secret exists"; \
	done
	@$(MAKE) deploy-mlflow-openclaw-integration
	@echo "OpenShell deployed successfully."
	@echo "Next: register gateway with CLI (see docs/adr/0003-openshell-deployment-on-openshift.md)"

# MLflow's openclawIntegration RBAC (see deploy/helm/mlflow/values.yaml) needs the
# openshell-sandbox ServiceAccount, which is created by deploy-openshell above,
# so it can't run as part of deploy-mlflow/deploy-all (constraint #10, ADR-0003).
# Run automatically as the last step of deploy-openshell.
deploy-mlflow-openclaw-integration:
	@echo "Waiting for openshell-sandbox ServiceAccount..."
	@i=0; while ! oc -n $(OPENSHELL_NAMESPACE) get sa openshell-sandbox &>/dev/null; do \
		i=$$((i+1)); if [ $$i -ge 60 ]; then echo "FAIL: openshell-sandbox SA not found in time"; exit 1; fi; \
		sleep 2; \
	done
	@echo "Enabling MLflow RBAC integration for OpenClaw tracing..."
	$(HELM) upgrade --install $(MLFLOW_RELEASE) $(MLFLOW_CHART) \
		--set openclawIntegration.enabled=true $(HELM_OPTS)
	@oc -n $(OPENSHELL_NAMESPACE) get secret openshell-sandbox-mlflow-token >/dev/null \
		&& echo "OK: openshell-sandbox-mlflow-token created" \
		|| echo "WARN: openshell-sandbox-mlflow-token not found yet (token controller may still be catching up)"

# --- oauth2-proxy (browser auth for OpenClaw Control UI) ---
# Deploys OpenShift-native oauth-proxy so OCP users can log in to the UI.
# Prereq: OpenShell deployed (needs the openshell Service for hostAlias lookup).
deploy-oauth2-proxy:
	@if [ -z "$(APPS_DOMAIN)" ]; then \
		echo "ERROR: APPS_DOMAIN required. Usage: APPS_DOMAIN=apps.ocp.example.com make deploy-oauth2-proxy"; \
		exit 1; \
	fi
	@echo "Ensuring oauth-proxy session secret exists..."
	@oc -n $(OPENSHELL_NAMESPACE) get secret oauth-proxy-session-secret &>/dev/null || \
		oc -n $(OPENSHELL_NAMESPACE) create secret generic oauth-proxy-session-secret \
			--from-literal=session_secret=$$(openssl rand -base64 32 | head -c 32)
	@echo "Deploying oauth2-proxy..."
	$(HELM) upgrade --install $(OAUTH2_PROXY_RELEASE) $(OAUTH2_PROXY_CHART) \
		--namespace $(OPENSHELL_NAMESPACE) \
		--set appsDomain=$(APPS_DOMAIN) \
		--set namespace=$(OPENSHELL_NAMESPACE) \
		--wait --timeout 120s
	@echo "Verifying OAuth redirect..."
	@sleep 3
	@HTTP_CODE=$$(curl -sk -o /dev/null -w '%{http_code}' \
		"https://openclaw-gw--openclaw-ui.$(APPS_DOMAIN)/" 2>/dev/null || echo "000"); \
	if [ "$$HTTP_CODE" = "302" ] || [ "$$HTTP_CODE" = "303" ]; then \
		echo "OK: oauth-proxy redirects to OCP OAuth (HTTP $$HTTP_CODE)"; \
	else \
		echo "WARN: Expected 302/303, got HTTP $$HTTP_CODE (may need a few seconds)"; \
	fi
	@echo "UI URL: https://openclaw-gw--openclaw-ui.$(APPS_DOMAIN)"

# Fast smoke checks for agent iteration (no Playwright / full E2E — see long-running-scripts skill)
validate-smoke: validate-openshell validate-security
	@echo "Smoke validation complete (infra + security only)."

# --- OpenShell + oauth2-proxy + Agent Sandbox teardown ---
# Reverse of deploy-openshell/deploy-oauth2-proxy. Order: oauth2-proxy (depends on
# openshell Service) -> openshell (single release: namespace extras + gateway)
# -> namespace -> Agent Sandbox raw manifest (CRD + cluster-scoped RBAC).
undeploy-openshell:
	-$(HELM) uninstall $(OAUTH2_PROXY_RELEASE) -n $(OPENSHELL_NAMESPACE)
	-$(HELM) uninstall $(OPENSHELL_RELEASE) -n $(OPENSHELL_NAMESPACE)
	-@oc delete namespace $(OPENSHELL_NAMESPACE) --wait=false 2>/dev/null || true
	@echo "Removing Agent Sandbox raw manifest (CRD + cluster-scoped RBAC)..."
	-@oc delete -f manifests/agent-sandbox-v0.5.1.yaml --ignore-not-found --wait=false 2>/dev/null || true
	@echo "OpenShell + oauth2-proxy + Agent Sandbox (raw manifest) teardown complete."

validate-openshell:
	@echo "=== OpenShell ==="
	@oc -n $(OPENSHELL_NAMESPACE) get statefulset openshell -o jsonpath='{.status.readyReplicas}{"\n"}' | grep -q 1
	@echo "OK: OpenShell StatefulSet ready"
	@for secret in openshell-server-tls openshell-client-tls openshell-jwt-keys; do \
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
	@openshell sandbox exec -n openclaw-gw --no-tty --timeout 10 \
		--env "HOME=/sandbox/workspace" \
		-- bash -c 'curl -sf http://127.0.0.1:18789/health' >/dev/null
	@echo "OK: Gateway process alive"
	@echo "=== CLI: openclaw agent → MaaS → Response ==="
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
	@RESULT=$$(openshell sandbox exec -n openclaw-gw --no-tty --timeout 65 \
		--env "HOME=/sandbox/workspace" \
		--env "OPENCLAW_TEMP=/sandbox/workspace/.openclaw/tmp" \
		-- bash -c 'openclaw agent --agent main --message "Reply with exactly: TRACE_OK" --json --timeout 60 2>/dev/null'); \
	REPLY=$$(echo "$$RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('payloads',[{}])[0].get('text',''))" 2>/dev/null); \
	if [ -n "$$REPLY" ]; then \
		echo "OK: MaaS round-trip succeeded (reply: $$REPLY)"; \
	else \
		echo "FAIL: Gateway agent request failed"; \
		echo "$$RESULT" | tail -5; exit 1; \
	fi

validate-traces:
	@echo "=== MLflow Trace Validation ==="
	@MLFLOW_TOKEN=$$(oc -n $(OPENSHELL_NAMESPACE) get secret openshell-sandbox-mlflow-token -o jsonpath='{.data.token}' | base64 -d); \
	TRACES=$$(oc -n $(OPENSHELL_NAMESPACE) exec openclaw-gw -c agent -- \
		bash -c "curl -sk 'https://mlflow.redhat-ods-applications.svc:8443/api/2.0/mlflow/traces?experiment_ids=1&max_results=1' \
		-H 'Authorization: Bearer $${MLFLOW_TOKEN}' \
		-H 'X-MLFLOW-WORKSPACE: openshell'" 2>/dev/null); \
	COUNT=$$(echo "$$TRACES" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('traces',[])))" 2>/dev/null); \
	if [ "$$COUNT" -gt 0 ] 2>/dev/null; then \
		echo "OK: MLflow has traces in experiment openclaw-tracing (found $$COUNT)"; \
	else \
		echo "FAIL: No traces found in MLflow experiment openclaw-tracing"; \
		echo "  Response: $$TRACES"; \
		echo "  Ensure gateway is running with NODE_TLS_REJECT_UNAUTHORIZED=0"; \
		echo "  and diagnostics.otel.headers.x-mlflow-experiment-id is set"; \
		exit 1; \
	fi

validate-security:
	@echo "=== Sandbox Policy Enforcement ==="
	@RESULT=$$(openshell sandbox exec -n openclaw-gw --no-tty -- \
		bash -c 'curl -s -m 5 -o /dev/null -w "%{http_code}" https://github.com 2>/dev/null; echo'); \
	RESULT=$$(echo "$$RESULT" | tr -d '[:space:]'); \
	if [ "$$RESULT" = "000" ] || [ "$$RESULT" = "403" ] || [ -z "$$RESULT" ]; then \
		echo "OK: github.com blocked by sandbox policy (code: $${RESULT:-timeout})"; \
	else \
		echo "FAIL: github.com reachable (HTTP $$RESULT) — policy not enforcing"; exit 1; \
	fi
	@RESULT=$$(openshell sandbox exec -n openclaw-gw --no-tty -- \
		bash -c 'curl -s -m 5 -o /dev/null -w "%{http_code}" https://maas-rhdp.apps.maas.redhatworkshops.io/v1/models 2>/dev/null; echo'); \
	RESULT=$$(echo "$$RESULT" | tr -d '[:space:]'); \
	if [ "$$RESULT" = "200" ] || [ "$$RESULT" = "401" ]; then \
		echo "OK: MaaS endpoint reachable (HTTP $$RESULT)"; \
	else \
		echo "FAIL: MaaS endpoint not reachable (HTTP $$RESULT)"; exit 1; \
	fi

# --- Playwright E2E Tests ---
# These test the REAL user experience: browser → UI → gateway → model → MLflow traces.
# Unlike Makefile validate-* targets (which test infra from inside the cluster),
# these tests run from outside and verify what the user actually sees.
#
# Prereqs: cd tests && npm install && npx playwright install chromium
# Env vars: OPENCLAW_BASE_URL, MLFLOW_BASE_URL, MLFLOW_AUTH_TOKEN, MLFLOW_WORKSPACE

test-e2e:
	cd $(ROOT_DIR)/tests && npx playwright test

test-ui:
	cd $(ROOT_DIR)/tests && npx playwright test openclaw-ui.spec.ts

test-security:
	cd $(ROOT_DIR)/tests && npx playwright test sandbox-security.spec.ts

test-mlflow:
	cd $(ROOT_DIR)/tests && npx playwright test mlflow-ui.spec.ts

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
	@echo "Full reset complete: OpenShell, oauth2-proxy, Agent Sandbox, RHOAI stack, and operators removed."
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
	@test $$(helm list -f '^rhoai-' -q | wc -l | tr -d ' ') -eq 5
	@echo "OK: 5 rhoai-* releases deployed"
	@echo "=== RHOAI operator ==="
	@oc get csv -n redhat-ods-operator -o jsonpath='{.items[?(@.spec.displayName=="Red Hat OpenShift AI")].status.phase}{"\n"}' | grep -q Succeeded
	@oc wait --for=condition=Ready pod -l name=rhods-operator -n redhat-ods-operator --timeout=60s >/dev/null
	@echo "OK: operator CSV Succeeded, pods Ready"
	@echo "=== Platform components ==="
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="MLflowOperatorReady")].status}{"\n"}' | grep -q True
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="TrustyAIReady")].status}{"\n"}' | grep -q True
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="DashboardReady")].status}{"\n"}' | grep -q True
	@echo "OK: OGX, MLflow operator, TrustyAI, Dashboard ready"
	@echo "=== Dashboard genAiStudio ==="
	@GENAI=$$(oc get odhdashboardconfig odh-dashboard-config -n redhat-ods-applications -o jsonpath='{.spec.dashboardConfig.genAiStudio}' 2>/dev/null); \
	if [ "$$GENAI" = "true" ]; then \
		echo "OK: genAiStudio enabled"; \
	else \
		echo "FAIL: genAiStudio not true (got: '$$GENAI')"; exit 1; \
	fi
	@DSC_PHASE=$$(oc get datasciencecluster default-dsc -o jsonpath='{.status.phase}'); \
	DSC_MSG=$$(oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="Ready")].message}'); \
	if [ "$$DSC_PHASE" = "Ready" ]; then \
		echo "OK: DataScienceCluster phase Ready"; \
	elif echo "$$DSC_MSG" | grep -q 'modelsasservice'; then \
		echo "WARN: DataScienceCluster phase $$DSC_PHASE ($$DSC_MSG) — expected without MaaS gateway"; \
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
	@RHOAI_COUNT=$$(helm list -f '^rhoai-' -q 2>/dev/null | wc -l | tr -d ' '); \
	if [ "$$RHOAI_COUNT" -eq 0 ]; then \
		echo "OK: no rhoai-* releases"; \
	else \
		echo "FAIL: $$RHOAI_COUNT rhoai-* releases still present"; exit 1; \
	fi
	@echo "=== Helm releases (OpenShell / oauth2-proxy) ==="
	@LEFTOVER=false; \
	for rel_ns in "$(OPENSHELL_RELEASE):$(OPENSHELL_NAMESPACE)" "$(OAUTH2_PROXY_RELEASE):$(OPENSHELL_NAMESPACE)"; do \
		REL=$${rel_ns%%:*}; NS=$${rel_ns##*:}; \
		if helm status "$$REL" -n "$$NS" >/dev/null 2>&1; then \
			echo "FAIL: release $$REL still deployed in ns $$NS"; LEFTOVER=true; \
		fi; \
	done; \
	if [ "$$LEFTOVER" = "true" ]; then exit 1; else echo "OK: no openshell/oauth2-proxy releases"; fi
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
	@echo "=== Agent Sandbox (raw manifest cluster-scoped resources) ==="
	@AS_LEFTOVER=false; \
	oc get crd sandboxes.agents.x-k8s.io >/dev/null 2>&1 && { echo "WARN: CRD sandboxes.agents.x-k8s.io still present"; AS_LEFTOVER=true; }; \
	oc get clusterrole agent-sandbox-controller >/dev/null 2>&1 && { echo "WARN: ClusterRole agent-sandbox-controller still present"; AS_LEFTOVER=true; }; \
	oc get clusterrolebinding agent-sandbox-controller >/dev/null 2>&1 && { echo "WARN: ClusterRoleBinding agent-sandbox-controller still present"; AS_LEFTOVER=true; }; \
	if [ "$$AS_LEFTOVER" = "false" ]; then echo "OK: no Agent Sandbox cluster-scoped leftovers"; fi
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
# mTLS client bundle sync only. Install/upgrade/uninstall/status are the
# deploy-openshell/undeploy-openshell/validate-openshell targets above — this
# used to be a separate, since-removed "legacy" single-chart flow
# (openshell-install/-upgrade/-uninstall/-status/-deps) that briefly diverged
# from deploy-openshell's two-release split; both are now the same single
# release, so there is nothing left for that duplicate flow to do.

openshell-sync-mtls:
	NAMESPACE=$(OPENSHELL_NAMESPACE) $(ROOT_DIR)/scripts/openshift-openshell-sync-mtls.sh
