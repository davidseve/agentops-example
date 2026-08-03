#!/usr/bin/env bash
# DEPRECATED: SCC is now managed by the Helm wrapper chart (deploy/helm/openshell/).
# The chart creates a post-install RoleBinding to system:openshift:scc:privileged.
# Use: make -C deploy openshell-install
echo "DEPRECATED: SCC is managed by the Helm chart. Run 'make -C deploy openshell-install' instead." >&2
exit 0
