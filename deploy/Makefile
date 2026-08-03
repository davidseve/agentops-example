# deploy/Makefile - RHOAI installation for agentops-example
# Usage: make deploy-all    (full stack)
#        make validate      (post-deploy health checks)
#        make undeploy-all  (teardown)
#
# Race condition fixes from open-claw-in-openshell (constraints #21, #23):
# - wait-dashboard-crd: Dashboard CRD doesn't exist on first helm upgrade
# - adopt-dashboard-config: operator auto-creates singleton without Helm ownership
# - wait-llamastack: Gen AI Studio nav requires LlamaStackOperatorReady=True
# See docs/adr/0001-rhoai-dsc-component-selection.md

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

# Release names
OPERATORS_RELEASE := rhoai-operators
PLATFORM_RELEASE  := rhoai-platform
DATABASE_RELEASE  := rhoai-database
MLFLOW_RELEASE    := rhoai-mlflow
EVALHUB_RELEASE   := rhoai-evalhub
OPENSHELL_RELEASE := openshell-infra

# OpenShell OCI chart
OPENSHELL_OCI_CHART := oci://ghcr.io/nvidia/openshell/helm-chart
OPENSHELL_OCI_VERSION := 0.0.83
OPENSHELL_NAMESPACE := openshell

.PHONY: deploy-operators wait-operators deploy-platform deploy-database
.PHONY: wait-dashboard-crd adopt-dashboard-config wait-llamastack wait-llamastack-and-refresh-dashboard
.PHONY: wait-mlflow-crd deploy-mlflow wait-evalhub-crd deploy-evalhub deploy-all
.PHONY: deploy-openshell-infra deploy-openshell-oci deploy-openshell validate-openshell
.PHONY: undeploy-apps purge-dsci undeploy-operators cleanup-orphans undeploy-all
.PHONY: template lint validate validate-cleanup

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

deploy-platform: wait-operators
	@CURRENT_DASHBOARD=$$(oc get datasciencecluster default-dsc -o jsonpath='{.spec.components.dashboard.managementState}' 2>/dev/null || true); \
	if [ "$$CURRENT_DASHBOARD" != "Managed" ]; then \
		echo "Fresh Dashboard enable: sequencing llamastackoperator BEFORE dashboard"; \
		echo "(see docs/adr/0001-rhoai-dsc-component-selection.md, constraint #23)"; \
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
	$(HELM) upgrade --install $(DATABASE_RELEASE) $(DATABASE_CHART) $(HELM_OPTS)

wait-mlflow-crd:
	@echo "Waiting for MLflow CRD..."
	@until oc get crd mlflows.mlflow.opendatahub.io >/dev/null 2>&1; do \
		echo "  MLflow CRD not ready yet..."; sleep 10; \
	done

deploy-mlflow: deploy-database wait-mlflow-crd
	$(HELM) upgrade --install $(MLFLOW_RELEASE) $(MLFLOW_CHART) $(HELM_OPTS)

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

# --- OpenShell targets (Phase 2) ---
# OpenShell MUST be deployed AFTER RHOAI (constraint #10: MLflow RBAC depends on
# the redhat-ods-applications namespace and mlflow-integration ClusterRole).

deploy-openshell-infra:
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
	$(HELM) upgrade --install $(OPENSHELL_RELEASE) $(OPENSHELL_CHART) \
		$(if $(APPS_DOMAIN),--set global.appsDomain=$(APPS_DOMAIN)) $(HELM_OPTS)

deploy-openshell-oci: deploy-openshell-infra
	@echo "Extracting rendered values from ConfigMap..."
	@oc -n $(OPENSHELL_NAMESPACE) get configmap openshell-helm-values \
		-o jsonpath='{.data.values\.yaml}' > /tmp/openshell-values.yaml
	@echo "Installing OpenShell OCI chart v$(OPENSHELL_OCI_VERSION)..."
	$(HELM) upgrade --install openshell $(OPENSHELL_OCI_CHART) \
		--version $(OPENSHELL_OCI_VERSION) \
		--namespace $(OPENSHELL_NAMESPACE) \
		-f /tmp/openshell-values.yaml $(HELM_OPTS)

deploy-openshell: deploy-openshell-oci
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
	@echo "OpenShell deployed successfully."
	@echo "Next: register gateway with CLI (see docs/adr/0002-openshell-deployment-method.md)"

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
	@echo "Orphan cleanup complete."

undeploy-all: undeploy-apps purge-dsci undeploy-operators cleanup-orphans
	@echo "All components undeployed."

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
	@oc get datasciencecluster default-dsc -o jsonpath='{.status.conditions[?(@.type=="LlamaStackOperatorReady")].status}{"\n"}' | grep -q True
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
	@echo "=== Helm releases ==="
	@RHOAI_COUNT=$$(helm list -f '^rhoai-' -q 2>/dev/null | wc -l | tr -d ' '); \
	if [ "$$RHOAI_COUNT" -eq 0 ]; then \
		echo "OK: no rhoai-* releases"; \
	else \
		echo "FAIL: $$RHOAI_COUNT rhoai-* releases still present"; exit 1; \
	fi
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
	@echo "=== Namespaces ==="
	@ALL_CLEAN=true; \
	for ns in redhat-ods-operator redhat-ods-applications redhat-ods-monitoring evaluation; do \
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
