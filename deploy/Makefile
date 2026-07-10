# deploy/Makefile - RHOAI installation for agentops-example
# Usage: make deploy-all    (full stack)
#        make undeploy-all  (teardown)

HELM := helm
HELM_OPTS ?=

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

.PHONY: deploy-operators deploy-platform deploy-database deploy-mlflow deploy-evalhub deploy-all
.PHONY: undeploy-operators undeploy-platform undeploy-database undeploy-mlflow undeploy-evalhub undeploy-all
.PHONY: template lint

# --- Deploy targets (ordered) ---

deploy-operators:
	$(HELM) upgrade --install $(OPERATORS_RELEASE) $(OPERATORS_CHART) $(HELM_OPTS)
	@echo "Waiting for RHOAI operator to be ready..."
	@echo "Run: oc wait --for=condition=CatalogSourcesUnhealthy=False sub/rhods-operator -n redhat-ods-operator --timeout=300s"

deploy-platform: deploy-operators
	$(HELM) upgrade --install $(PLATFORM_RELEASE) $(PLATFORM_CHART) $(HELM_OPTS)

deploy-database:
	$(HELM) upgrade --install $(DATABASE_RELEASE) $(DATABASE_CHART) $(HELM_OPTS)

deploy-mlflow: deploy-database
	$(HELM) upgrade --install $(MLFLOW_RELEASE) $(MLFLOW_CHART) $(HELM_OPTS)

deploy-evalhub: deploy-database
	$(HELM) upgrade --install $(EVALHUB_RELEASE) $(EVALHUB_CHART) $(HELM_OPTS)

deploy-all: deploy-operators deploy-platform deploy-database deploy-mlflow deploy-evalhub
	@echo "All components deployed."

# --- Undeploy targets (reverse order) ---

undeploy-evalhub:
	-$(HELM) uninstall $(EVALHUB_RELEASE)

undeploy-mlflow:
	-$(HELM) uninstall $(MLFLOW_RELEASE)

undeploy-database:
	-$(HELM) uninstall $(DATABASE_RELEASE)

undeploy-platform:
	-$(HELM) uninstall $(PLATFORM_RELEASE)

undeploy-operators:
	-$(HELM) uninstall $(OPERATORS_RELEASE)

undeploy-all: undeploy-evalhub undeploy-mlflow undeploy-database undeploy-platform undeploy-operators
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
