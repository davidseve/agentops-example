# deploy/Makefile - AgentOps demo deploy targets
#
# RHOAI (full platform):
#   make deploy-all    (full stack)
#   make validate      (post-deploy health checks)
#   make undeploy-all  (teardown)
#
# OpenShell (cluster):
#   make openshell-prereqs    # Agent Sandbox + namespace (once per cluster)
#   make openshell-install    # Helm install wrapper chart
#   make openshell-scc        # Grant SCC after install (if prereqs ran before Helm)
#   make openshell-status
#   make openshell-uninstall

SHELL := /bin/bash
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

# Release names
OPERATORS_RELEASE := rhoai-operators
PLATFORM_RELEASE  := rhoai-platform
DATABASE_RELEASE  := rhoai-database
MLFLOW_RELEASE    := rhoai-mlflow
EVALHUB_RELEASE   := rhoai-evalhub

.PHONY: deploy-operators wait-operators deploy-platform deploy-database
.PHONY: wait-mlflow-crd deploy-mlflow wait-evalhub-crd deploy-evalhub deploy-all
.PHONY: undeploy-apps purge-dsci undeploy-operators cleanup-orphans undeploy-all
.PHONY: template lint validate validate-cleanup

# --- Deploy targets (ordered) ---

deploy-operators:
	$(HELM) upgrade --install $(OPERATORS_RELEASE) $(OPERATORS_CHART) $(HELM_OPTS)

wait-operators: deploy-operators
	@echo "Waiting for RHOAI operator CSV..."
	@until oc get csv -n redhat-ods-operator -o jsonpath='{.items[?(@.spec.displayName=="Red Hat OpenShift AI")].status.phase}' 2>/dev/null | grep -q Succeeded; do \
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
	@until oc get crd datascienceclusters.datasciencecluster.opendatahub.io odhdashboardconfigs.opendatahub.io >/dev/null 2>&1; do \
		echo "  platform CRDs not ready yet..."; sleep 10; \
	done

deploy-platform: wait-operators
	$(HELM) upgrade --install $(PLATFORM_RELEASE) $(PLATFORM_CHART) $(HELM_OPTS)

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
	@echo "All components deployed."
	@echo "Note: DataScienceCluster may show Not Ready if modelsAsService gateway is missing (expected for this demo)."

# --- Undeploy targets ---
# CRITICAL: DSCI must be deleted while the operator is still running,
# otherwise the finalizer cannot be processed and DSCI gets stuck in Terminating.
# Order: apps (evalhub/mlflow/db/platform) → DSCI → operator → orphan cleanup.

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

# --- OpenShell (cluster) ---

HELM_CHART_DIR := $(ROOT_DIR)/deploy/helm/openshell
OPENSHIFT_KUSTOMIZE := $(ROOT_DIR)/deploy/openshift/openshell

RELEASE_NAME ?= openshell
NAMESPACE ?= openshell
HELM_TIMEOUT ?= 10m
DOCKER_CONFIG ?= /tmp/helm-nodocker-agentops

.PHONY: help openshell-deps openshell-prereqs openshell-scc openshell-install openshell-upgrade openshell-status openshell-uninstall helm-env

helm-env:
	@mkdir -p $(DOCKER_CONFIG)
	@test -f $(DOCKER_CONFIG)/config.json || printf '{}' > $(DOCKER_CONFIG)/config.json

help:
	@echo "OpenShell cluster targets:"
	@echo "  make openshell-deps       Update Helm chart dependencies (Chart.lock)"
	@echo "  make openshell-prereqs    Install Agent Sandbox + namespace"
	@echo "  make openshell-install    Install OpenShell gateway (Helm)"
	@echo "  make openshell-scc        Grant privileged SCC to sandbox SA"
	@echo "  make openshell-upgrade    Upgrade release with current values"
	@echo "  make openshell-status     Show release and pod status"
	@echo "  make openshell-uninstall  Remove Helm release"

openshell-deps: helm-env
	cd $(HELM_CHART_DIR) && DOCKER_CONFIG=$(DOCKER_CONFIG) helm dependency update

openshell-prereqs:
	$(ROOT_DIR)/scripts/openshift-openshell-prereqs.sh

openshell-scc:
	$(ROOT_DIR)/scripts/openshift-openshell-scc.sh

openshell-install: helm-env openshell-deps
	oc apply -k $(OPENSHIFT_KUSTOMIZE)
	cd $(HELM_CHART_DIR) && DOCKER_CONFIG=$(DOCKER_CONFIG) helm upgrade --install $(RELEASE_NAME) . \
		--namespace $(NAMESPACE) \
		--create-namespace \
		-f values.yaml \
		-f values-openshift.yaml \
		--wait \
		--timeout $(HELM_TIMEOUT)
	$(ROOT_DIR)/scripts/openshift-openshell-scc.sh
	@$(MAKE) openshell-status

openshell-upgrade: helm-env openshell-deps
	cd $(HELM_CHART_DIR) && DOCKER_CONFIG=$(DOCKER_CONFIG) helm upgrade $(RELEASE_NAME) . \
		--namespace $(NAMESPACE) \
		-f values.yaml \
		-f values-openshift.yaml \
		--wait \
		--timeout $(HELM_TIMEOUT)
	@$(MAKE) openshell-status

openshell-status:
	@echo "--- Helm ---"
	@DOCKER_CONFIG=$(DOCKER_CONFIG) helm list -n $(NAMESPACE) 2>/dev/null || true
	@echo "--- Workloads ---"
	@oc -n $(NAMESPACE) get statefulset,pods,svc,secret 2>/dev/null | grep -E 'NAME|openshell' || true

openshell-uninstall: helm-env
	cd $(HELM_CHART_DIR) && DOCKER_CONFIG=$(DOCKER_CONFIG) helm uninstall $(RELEASE_NAME) -n $(NAMESPACE) || true
	@echo "Deleting namespace $(NAMESPACE)..."
	-@oc delete ns $(NAMESPACE) --wait=false 2>/dev/null || true
	@echo "OpenShell cluster cleanup complete."
