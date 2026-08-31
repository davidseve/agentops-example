"""
patch-mlflow-plugin.py — Patch @mlflow/mlflow-openclaw@0.2.0-rc.0 for OpenClaw 2026.7.1 compatibility.

Three incompatibilities must be resolved:
  1. service.ts imports 'openclaw/plugin-sdk/diagnostics-otel' (doesn't exist in 2026.7.1)
  2. index.ts uses definePluginEntry() (not exported in 2026.7.1)
  3. @mlflow/core@0.2.0 headersProvider doesn't emit X-MLFLOW-WORKSPACE (required by RHOAI)

This script is copied into the sandbox and run after npm install.
"""
import re

PKG = '/sandbox/workspace/.openclaw/extensions/mlflow-openclaw/node_modules/@mlflow/mlflow-openclaw'

SVC = PKG + '/src/service.ts'
with open(SVC, 'r') as f:
    content = f.read()
if 'diagnostics-otel' in content:
    old_import = re.compile(
        r"import\s*\{[^}]*onDiagnosticEvent[^}]*\}\s*from\s*['\"]openclaw/plugin-sdk/diagnostics-otel['\"];",
        re.DOTALL
    )
    replacement = ('// diagnostics-otel replaced with no-op (not available in OpenClaw 2026.7.1)\n'
                   'const onDiagnosticEvent = (fn: any) => (() => {});\n'
                   'type DiagnosticEventPayload = any;')
    content = old_import.sub(replacement, content)
    with open(SVC, 'w') as f:
        f.write(content)
    print('service.ts patched')
else:
    print('service.ts already patched')

IDX = PKG + '/index.ts'
with open(IDX, 'r') as f:
    content = f.read()
if 'definePluginEntry' in content:
    content = content.replace(
        "import { definePluginEntry, type OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';",
        '// definePluginEntry replaced for OpenClaw 2026.7.1 compat'
    )
    content = re.sub(r'export\s+default\s+definePluginEntry\(\{', 'const mlflowPlugin = ({', content)
    content = content.replace('OpenClawPluginApi', 'any')
    if not content.rstrip().endswith('export default mlflowPlugin;'):
        content = content.rstrip()
        if content.endswith('});'):
            content = content[:-3] + '});\nexport default mlflowPlugin;\n'
    with open(IDX, 'w') as f:
        f.write(content)
    print('index.ts patched')
else:
    print('index.ts already patched')

# RHOAI MLflow requires X-MLFLOW-WORKSPACE on every REST call. The gateway
# process often loses MLFLOW_WORKSPACE from its environment after restarts, so
# read it from a sidecar file written at launch (openclaw.json schema rejects
# a workspace field in plugin config).
SVC_WORKSPACE_PATCH = """    const experimentId =
      (typeof pluginConfig.experimentId === 'string' ? pluginConfig.experimentId : '') ||
      process.env.MLFLOW_EXPERIMENT_ID;

    if (!trackingUri || !experimentId) {
      return;
    }

    try {
      init({ trackingUri, experimentId });"""
SVC_WORKSPACE_REPLACEMENT = """    const experimentId =
      (typeof pluginConfig.experimentId === 'string' ? pluginConfig.experimentId : '') ||
      process.env.MLFLOW_EXPERIMENT_ID;

    if (!trackingUri || !experimentId) {
      return;
    }

    let workspace = process.env.MLFLOW_WORKSPACE;
    if (!workspace) {
      try {
        workspace = require('fs').readFileSync('/sandbox/workspace/.openclaw/mlflow-workspace', 'utf8').trim();
      } catch {}
    }
    if (workspace) {
      process.env.MLFLOW_WORKSPACE = workspace;
    }

    try {
      const trackingServerToken = process.env.MLFLOW_TRACKING_TOKEN;
      init({
        trackingUri,
        experimentId,
        ...(trackingServerToken ? { trackingServerToken } : {}),
      });"""

with open(SVC, 'r') as f:
    svc_content = f.read()
if 'mlflow-workspace' in svc_content:
    print('service.ts workspace init already patched')
elif 'pluginConfig.workspace' in svc_content:
    svc_content = re.sub(
        r"""    const workspace =
      \(typeof pluginConfig\.workspace === 'string' \? pluginConfig\.workspace : ''\) \|\|
      process\.env\.MLFLOW_WORKSPACE;

    if \(!trackingUri \|\| !experimentId\) \{
      return;
    \}

    if \(workspace\) \{
      process\.env\.MLFLOW_WORKSPACE = workspace;
    \}""",
        """    if (!trackingUri || !experimentId) {
      return;
    }

    let workspace = process.env.MLFLOW_WORKSPACE;
    if (!workspace) {
      try {
        workspace = require('fs').readFileSync('/sandbox/workspace/.openclaw/mlflow-workspace', 'utf8').trim();
      } catch {}
    }
    if (workspace) {
      process.env.MLFLOW_WORKSPACE = workspace;
    }""",
        svc_content,
        count=1,
    )
    with open(SVC, 'w') as f:
        f.write(svc_content)
    print('service.ts upgraded (workspace sidecar file)')
elif SVC_WORKSPACE_PATCH not in svc_content:
    raise SystemExit(
        'service.ts: expected init block not found (package version drift?) — '
        'refusing to patch blindly. Inspect ' + SVC
    )
else:
    svc_content = svc_content.replace(SVC_WORKSPACE_PATCH, SVC_WORKSPACE_REPLACEMENT)
    with open(SVC, 'w') as f:
        f.write(svc_content)
    print('service.ts patched (workspace sidecar + trackingServerToken before init)')

# Backport of mlflow/mlflow#23927 for pinned @mlflow/core@0.2.0.
# createOssAuth()'s headersProvider builds Content-Type/Authorization but
# never X-MLFLOW-WORKSPACE — RHOAI-managed MLflow rejects every request
# without it once workspaces are enabled.
CORE_AUTH = '/sandbox/workspace/.openclaw/extensions/mlflow-openclaw/node_modules/@mlflow/core/dist/auth/index.js'
with open(CORE_AUTH, 'r') as f:
    content = f.read()
if 'X-MLFLOW-WORKSPACE' in content:
    print('@mlflow/core auth/index.js already patched')
else:
    old = """    const headersProvider = async () => {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        return headers;
    };"""
    new = """    const headersProvider = async () => {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }
        const workspace = options.workspace || process.env.MLFLOW_WORKSPACE;
        if (workspace) {
            headers['X-MLFLOW-WORKSPACE'] = workspace;
        }
        return headers;
    };"""
    if old not in content:
        raise SystemExit(
            '@mlflow/core auth/index.js: expected headersProvider block not found '
            '(package version drift?) — refusing to patch blindly. Inspect ' + CORE_AUTH
        )
    content = content.replace(old, new)
    with open(CORE_AUTH, 'w') as f:
        f.write(content)
    print('@mlflow/core auth/index.js patched (X-MLFLOW-WORKSPACE backport)')
