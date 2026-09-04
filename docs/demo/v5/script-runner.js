/**
 * v5: run allowlisted demo scripts against the cluster via local proxy.
 */

import { DEMO_SCRIPT_ACTIONS, getStep } from "../v1/narrative-data.js";
import { showProxyOfflineToast } from "../shared/proxy-offline-toast.js";
import { buildYamlSnippetsHtml, resolveYamlPanelForStep } from "./yaml-snippet-html.js";

const DEFAULT_PROXY_URL = "http://127.0.0.1:8766";
const FETCH_TIMEOUT_MS = 130_000;
const PROXY_OFFLINE_TITLE = "Start ./scripts/demo-presenter-serve.sh to enable script runner";
const PROXY_OFFLINE_TOAST =
  "Script runner requires ./scripts/demo-presenter-serve.sh (observability proxy on :8766).";
const QUICK_RUN_LABEL = "Run against cluster";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchJson(url, options = {}) {
  const signal = options.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const res = await fetch(url, { cache: "no-store", ...options, signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function formatOutput(stdout, stderr) {
  const parts = [];
  if (stdout?.trim()) parts.push(stdout.trimEnd());
  if (stderr?.trim()) parts.push(stderr.trimEnd());
  return parts.join("\n\n") || "(no output)";
}

export function isQuickRunHeaderStep(stepId, quickRunHeaderSteps) {
  return quickRunHeaderSteps.includes(stepId);
}

async function executeDemoAction(actionId, { proxyUrl, observability }) {
  const result = await fetchJson(`${proxyUrl}/api/demo/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: actionId }),
  });
  if (result.ok) {
    observability?.refresh?.();
  }
  return result;
}

function findRunBlockForAction(root, actionId) {
  return root.querySelector(`.nr-script-run[data-action-id="${actionId}"]`);
}

function findQuickRunHeaderWrap(root) {
  return root.querySelector("[data-nr-instructions] .nr-instructions-quick-actions");
}

function getLinkedRunTargets(root, actionId) {
  const bodyBlock = findRunBlockForAction(root, actionId);
  const headerWrap = findQuickRunHeaderWrap(root);
  const headerActionId = headerWrap?.dataset.actionId;
  const headerMatches = !actionId || !headerActionId || headerActionId === actionId;

  return {
    actionId,
    bodyBlock,
    bodyRunBtn: bodyBlock?.querySelector(".nr-script-run-btn"),
    bodyCopyBtn: bodyBlock?.querySelector(".nr-script-copy-btn"),
    bodyStatusEl: bodyBlock?.querySelector(".nr-script-run-status"),
    bodyOutputDetails: bodyBlock?.querySelector(".nr-script-run-output"),
    headerWrap: headerMatches ? headerWrap : null,
    headerRunBtn: headerMatches ? headerWrap?.querySelector(".nr-run-cluster-quick") : null,
    headerStatusEl: headerMatches ? headerWrap?.querySelector(".nr-quick-run-proxy-status") : null,
  };
}

function headerStatusClassFromBody(bodyClassName) {
  const suffix = bodyClassName.replace(/^nr-script-run-status\s*/, "").trim();
  return suffix ? `nr-quick-run-proxy-status ${suffix}` : "nr-quick-run-proxy-status";
}

function setLinkedRunStatus(targets, { text, bodyClassName, hideWhenIdle = false }) {
  if (targets.bodyStatusEl) {
    targets.bodyStatusEl.textContent = text;
    targets.bodyStatusEl.className = bodyClassName || "nr-script-run-status";
  }

  if (!targets.headerStatusEl) return;

  const showHeaderStatus = Boolean(text) && !hideWhenIdle;
  targets.headerStatusEl.hidden = !showHeaderStatus;
  if (!showHeaderStatus) {
    targets.headerStatusEl.textContent = "";
    targets.headerStatusEl.className = "nr-quick-run-proxy-status";
    return;
  }

  targets.headerStatusEl.textContent = text;
  targets.headerStatusEl.className = headerStatusClassFromBody(bodyClassName || "nr-script-run-status");
}

function applyLinkedProxyState(targets, proxyState) {
  if (targets.bodyBlock) targets.bodyBlock.dataset.proxyState = proxyState;
  if (targets.headerWrap) targets.headerWrap.dataset.proxyState = proxyState;
  if (targets.headerRunBtn) targets.headerRunBtn.dataset.proxyState = proxyState;

  if (proxyState === "checking") {
    if (targets.bodyRunBtn) {
      targets.bodyRunBtn.disabled = true;
      targets.bodyRunBtn.title = "";
    }
    if (targets.headerRunBtn) {
      targets.headerRunBtn.disabled = true;
      targets.headerRunBtn.title = "";
    }
    setLinkedRunStatus(targets, {
      text: "Checking proxy…",
      bodyClassName: "nr-script-run-status checking",
    });
    return;
  }

  if (proxyState === "healthy") {
    if (targets.bodyRunBtn) {
      targets.bodyRunBtn.disabled = false;
      targets.bodyRunBtn.title = "";
    }
    if (targets.headerRunBtn) {
      targets.headerRunBtn.disabled = false;
      targets.headerRunBtn.title = "";
    }
    setLinkedRunStatus(targets, {
      text: "",
      bodyClassName: "nr-script-run-status",
      hideWhenIdle: true,
    });
    return;
  }

  if (targets.bodyRunBtn) {
    targets.bodyRunBtn.disabled = true;
    targets.bodyRunBtn.title = PROXY_OFFLINE_TITLE;
  }
  if (targets.headerRunBtn) {
    targets.headerRunBtn.disabled = true;
    targets.headerRunBtn.title = PROXY_OFFLINE_TITLE;
  }
  setLinkedRunStatus(targets, {
    text: "Proxy offline",
    bodyClassName: "nr-script-run-status offline",
  });
}

function applyRunResultToLinkedTargets(targets, result, err = null) {
  const wrap = targets.bodyBlock;

  if (err) {
    if (wrap) {
      wrap.classList.remove("success");
      wrap.classList.add("error");
    }
    const outputPre = wrap?.querySelector(".nr-script-run-pre");
    const outputDetails = wrap?.querySelector(".nr-script-run-output");
    if (outputPre) outputPre.textContent = err?.message || String(err);
    if (outputDetails) {
      outputDetails.hidden = false;
      outputDetails.open = true;
    }
    setLinkedRunStatus(targets, {
      text: "Error",
      bodyClassName: "nr-script-run-status error",
    });
    return;
  }

  const output = formatOutput(result.stdout, result.stderr);
  const outputPre = wrap?.querySelector(".nr-script-run-pre");
  const outputDetails = wrap?.querySelector(".nr-script-run-output");
  if (outputPre) outputPre.textContent = output;
  if (outputDetails) {
    outputDetails.hidden = false;
    outputDetails.open = true;
  }

  if (result.ok) {
    if (wrap) {
      wrap.classList.remove("error");
      wrap.classList.add("success");
    }
    setLinkedRunStatus(targets, {
      text: `Done (${result.durationMs ?? 0}ms)`,
      bodyClassName: "nr-script-run-status success",
    });
    return;
  }

  if (wrap) {
    wrap.classList.remove("success");
    wrap.classList.add("error");
  }
  setLinkedRunStatus(targets, {
    text: `Failed (exit ${result.exitCode ?? "?"})`,
    bodyClassName: "nr-script-run-status error",
  });
}

function openLinkedRunOutput(targets, placeholder = "Running…") {
  const outputDetails = targets.bodyOutputDetails;
  const outputPre = targets.bodyBlock?.querySelector(".nr-script-run-pre");
  if (outputDetails) {
    outputDetails.hidden = false;
    outputDetails.open = true;
  }
  if (outputPre) outputPre.textContent = placeholder;
}

function expandInstructionsPanel(root) {
  const panel = root.querySelector("[data-nr-instructions] .nr-instructions-panel");
  if (panel) panel.open = true;
}

function clearInstructionsRunSnippets(root) {
  root.querySelectorAll("[data-nr-instructions] .nr-instructions-run-snippets").forEach((slot) => {
    slot.remove();
  });
}

function ensureInstructionsSnippetSlot(panel) {
  let slot = panel.querySelector(".nr-instructions-run-snippets");
  if (!slot) {
    slot = document.createElement("div");
    slot.className = "nr-instructions-run-snippets";
    slot.hidden = true;
    panel.appendChild(slot);
  }
  return slot;
}

function showInstructionsRunSnippets(root, stepId, quickRunHeaderSteps) {
  if (!isQuickRunHeaderStep(stepId, quickRunHeaderSteps)) return;

  const step = getStep(stepId);
  const yamlPanel = resolveYamlPanelForStep(step);
  const html = buildYamlSnippetsHtml(yamlPanel);
  if (!html) return;

  const panel = root.querySelector("[data-nr-instructions] .nr-instructions-panel");
  if (!panel) return;

  const slot = ensureInstructionsSnippetSlot(panel);
  slot.innerHTML = html;
  slot.hidden = false;

  expandInstructionsPanel(root);
}

function applyProxyStateToAllRunBlocks(root, proxyState) {
  const linkedActionIds = new Set();

  root.querySelectorAll(".nr-script-run").forEach((wrap) => {
    const actionId = wrap.dataset.actionId;
    if (!actionId) return;
    linkedActionIds.add(actionId);
    applyLinkedProxyState(getLinkedRunTargets(root, actionId), proxyState);
  });

  const headerWrap = findQuickRunHeaderWrap(root);
  const headerActionId = headerWrap?.dataset.actionId;
  if (headerActionId && !linkedActionIds.has(headerActionId)) {
    applyLinkedProxyState(getLinkedRunTargets(root, headerActionId), proxyState);
  }
}

async function runLinkedAction({
  root,
  actionMeta,
  proxyUrl,
  observability,
  runningActions,
  stepId,
  quickRunHeaderSteps,
}) {
  const targets = getLinkedRunTargets(root, actionMeta.id);
  const proxyState = targets.bodyBlock?.dataset.proxyState ?? targets.headerWrap?.dataset.proxyState;

  if (proxyState !== "healthy") return;
  if (runningActions.has(actionMeta.id)) return;
  if (actionMeta.confirm && !window.confirm(actionMeta.confirm)) return;

  runningActions.add(actionMeta.id);

  if (targets.bodyRunBtn) targets.bodyRunBtn.disabled = true;
  if (targets.headerRunBtn) targets.headerRunBtn.disabled = true;
  if (targets.bodyCopyBtn) targets.bodyCopyBtn.disabled = true;

  expandInstructionsPanel(root);
  openLinkedRunOutput(targets);
  showInstructionsRunSnippets(root, stepId, quickRunHeaderSteps);

  setLinkedRunStatus(targets, {
    text: "Running…",
    bodyClassName: "nr-script-run-status running",
  });

  try {
    const result = await executeDemoAction(actionMeta.id, { proxyUrl, observability });
    applyRunResultToLinkedTargets(targets, result);
  } catch (err) {
    applyRunResultToLinkedTargets(targets, null, err);
  } finally {
    if (targets.bodyCopyBtn) targets.bodyCopyBtn.disabled = false;
    const resolvedProxyState =
      targets.bodyBlock?.dataset.proxyState ?? targets.headerWrap?.dataset.proxyState ?? "offline";
    if (resolvedProxyState === "healthy") {
      if (targets.bodyRunBtn) targets.bodyRunBtn.disabled = false;
      if (targets.headerRunBtn) targets.headerRunBtn.disabled = false;
    }
    runningActions.delete(actionMeta.id);
  }
}

function createRunBlock(
  commandText,
  actionMeta,
  { proxyState, root, proxyUrl, observability, runningActions, stepId, quickRunHeaderSteps },
) {
  const wrap = document.createElement("div");
  wrap.className = "nr-script-run";
  wrap.dataset.actionId = actionMeta.id;

  wrap.innerHTML = `
    <div class="nr-script-run-cmd">
      <code class="nr-cmd">${escapeHtml(commandText)}</code>
    </div>
    <div class="nr-script-run-actions">
      <button type="button" class="nr-script-run-btn" data-run-action="${escapeHtml(actionMeta.id)}">
        ${escapeHtml(QUICK_RUN_LABEL)}
      </button>
      <button type="button" class="nr-script-copy-btn">Copy command</button>
      <span class="nr-script-run-status" aria-live="polite"></span>
    </div>
    <details class="nr-script-run-output" hidden>
      <summary>Script output</summary>
      <pre class="nr-script-run-pre"></pre>
    </details>`;

  const runBtn = wrap.querySelector(".nr-script-run-btn");
  const copyBtn = wrap.querySelector(".nr-script-copy-btn");

  applyLinkedProxyState(getLinkedRunTargets(root, actionMeta.id), proxyState);

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(commandText).then(() => {
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = "Copy command";
      }, 1500);
    });
  });

  runBtn.addEventListener("click", () => {
    void runLinkedAction({
      root,
      actionMeta,
      proxyUrl,
      observability,
      runningActions,
      stepId,
      quickRunHeaderSteps,
    });
  });

  return wrap;
}

/** v5 relocates instructions (and YAML may sit) outside [data-nr-card]. */
function commandContainers(root) {
  return [
    root.querySelector("[data-nr-card]"),
    root.querySelector("[data-nr-instructions]"),
    root.querySelector("[data-nr-yaml]"),
  ].filter(Boolean);
}

function wireQuickRunHeaderButton(
  root,
  stepId,
  { proxyState, proxyUrl, observability, quickRunHeaderSteps, runningActions },
) {
  root.querySelectorAll(".nr-quick-run-proxy-status").forEach((el) => el.remove());
  root.querySelectorAll(".nr-run-cluster-quick").forEach((el) => el.remove());
  root.querySelectorAll(".nr-instructions-quick-actions").forEach((el) => {
    const copyBtn = el.querySelector("#nr-copy-prompt");
    if (copyBtn && el.parentElement) {
      el.parentElement.insertBefore(copyBtn, el);
    }
    el.remove();
  });

  if (!isQuickRunHeaderStep(stepId, quickRunHeaderSteps)) return;

  const step = getStep(stepId);
  const actionMeta = step?.command ? DEMO_SCRIPT_ACTIONS[step.command] : null;
  if (!actionMeta) return;

  const copyBtn = root.querySelector(
    "[data-nr-instructions] .nr-instructions-summary #nr-copy-prompt",
  );
  if (!copyBtn) return;

  let actionsWrap = copyBtn.closest(".nr-instructions-quick-actions");
  if (!actionsWrap) {
    actionsWrap = document.createElement("div");
    actionsWrap.className = "nr-instructions-quick-actions";
    copyBtn.parentElement.insertBefore(actionsWrap, copyBtn);
    actionsWrap.append(copyBtn);
  }

  actionsWrap.dataset.actionId = actionMeta.id;

  const statusEl = document.createElement("span");
  statusEl.className = "nr-quick-run-proxy-status";
  statusEl.setAttribute("aria-live", "polite");

  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "nr-run-cluster-quick";
  runBtn.textContent = QUICK_RUN_LABEL;

  actionsWrap.insertBefore(statusEl, copyBtn);
  actionsWrap.insertBefore(runBtn, copyBtn);

  applyLinkedProxyState(getLinkedRunTargets(root, actionMeta.id), proxyState);

  runBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void runLinkedAction({
      root,
      actionMeta,
      proxyUrl,
      observability,
      runningActions,
      stepId,
      quickRunHeaderSteps,
    });
  });
}

function wireCommandElements(
  root,
  { proxyState, proxyUrl, observability, runnerEnabled, quickRunHeaderSteps, stepId, runningActions },
) {
  const containers = commandContainers(root);
  if (!containers.length) return;

  clearInstructionsRunSnippets(root);

  containers.forEach((container) => {
    container.querySelectorAll(".nr-script-run").forEach((el) => el.remove());
  });

  if (runnerEnabled) {
    containers.forEach((container) => {
      container.querySelectorAll(".nr-cmd").forEach((cmdEl) => {
        const commandText = cmdEl.textContent?.trim();
        const actionMeta = commandText ? DEMO_SCRIPT_ACTIONS[commandText] : null;
        if (!actionMeta) return;

        const parent = cmdEl.parentElement;
        if (!parent || parent.classList.contains("nr-script-run-cmd")) return;

        const runBlock = createRunBlock(commandText, actionMeta, {
          proxyState,
          root,
          proxyUrl,
          observability,
          runningActions,
          stepId,
          quickRunHeaderSteps,
        });
        parent.replaceChild(runBlock, cmdEl);
      });
    });
  }

  wireQuickRunHeaderButton(root, stepId, {
    proxyState,
    proxyUrl,
    observability,
    quickRunHeaderSteps,
    runningActions,
  });
}

function maybeShowProxyOfflineToast(proxyState, runnerEnabled, quickRunHeaderActive) {
  if (proxyState === "offline" && (runnerEnabled || quickRunHeaderActive)) {
    showProxyOfflineToast(PROXY_OFFLINE_TOAST);
  }
}

function parseStepIdFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
  const m = hash.match(/^step-(.+)$/);
  if (m) return m[1];
  return hash || "0";
}

function isRunnerStep(stepId, skipSteps) {
  return !skipSteps.has(stepId);
}

async function checkProxyHealth(proxyUrl) {
  try {
    const health = await fetchJson(`${proxyUrl}/api/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    return Boolean(health.ok) ? "healthy" : "offline";
  } catch {
    return "offline";
  }
}

export async function initScriptRunner({
  root,
  navEl = null,
  proxyUrl = DEFAULT_PROXY_URL,
  observability = null,
  /** Narrative step ids where script runner UI is suppressed. */
  skipSteps = ["0"],
  /** Step ids that show Run against cluster in the instructions header. */
  quickRunHeaderSteps = ["C-after", "D-after"],
} = {}) {
  const skipStepIds = new Set(skipSteps);
  const runningActions = new Set();
  let currentStepId = parseStepIdFromHash();
  let proxyState = "checking";

  const syncRunnerUi = ({ showToast = false } = {}) => {
    const runnerEnabled = isRunnerStep(currentStepId, skipStepIds);
    const quickRunHeaderActive = isQuickRunHeaderStep(currentStepId, quickRunHeaderSteps);
    if (showToast) {
      maybeShowProxyOfflineToast(proxyState, runnerEnabled, quickRunHeaderActive);
    }
    wireCommandElements(root, {
      proxyState,
      proxyUrl,
      observability,
      runnerEnabled,
      quickRunHeaderSteps,
      stepId: currentStepId,
      runningActions,
    });
  };

  syncRunnerUi();

  checkProxyHealth(proxyUrl).then((resolvedState) => {
    proxyState = resolvedState;
    const runnerEnabled = isRunnerStep(currentStepId, skipStepIds);
    const quickRunHeaderActive = isQuickRunHeaderStep(currentStepId, quickRunHeaderSteps);
    if (runnerEnabled || quickRunHeaderActive) {
      maybeShowProxyOfflineToast(proxyState, runnerEnabled, quickRunHeaderActive);
    }
    applyProxyStateToAllRunBlocks(root, proxyState);
  });

  root.addEventListener("nr:step-change", (event) => {
    currentStepId = event.detail?.stepId ?? parseStepIdFromHash();
    syncRunnerUi({ showToast: true });
  });

  return {
    refresh: syncRunnerUi,
    getProxyHealthy: () => proxyState === "healthy",
    getProxyState: () => proxyState,
  };
}
