/**
 * v5: run allowlisted demo scripts against the cluster via local proxy.
 */

import { DEMO_SCRIPT_ACTIONS, getStep } from "../v1/narrative-data.js";
import { showProxyOfflineToast } from "../shared/proxy-offline-toast.js";

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

function applyRunResultToBlock(wrap, result, err = null) {
  if (!wrap) return;

  const statusEl = wrap.querySelector(".nr-script-run-status");
  const outputDetails = wrap.querySelector(".nr-script-run-output");
  const outputPre = wrap.querySelector(".nr-script-run-pre");

  if (err) {
    wrap.classList.remove("success");
    wrap.classList.add("error");
    if (outputPre) outputPre.textContent = err?.message || String(err);
    if (outputDetails) {
      outputDetails.hidden = false;
      outputDetails.open = true;
    }
    if (statusEl) {
      statusEl.className = "nr-script-run-status error";
      statusEl.textContent = "Error";
    }
    return;
  }

  const output = formatOutput(result.stdout, result.stderr);
  if (outputPre) outputPre.textContent = output;
  if (outputDetails) {
    outputDetails.hidden = false;
    outputDetails.open = true;
  }

  if (result.ok) {
    wrap.classList.remove("error");
    wrap.classList.add("success");
    if (statusEl) {
      statusEl.className = "nr-script-run-status success";
      statusEl.textContent = `Done (${result.durationMs ?? 0}ms)`;
    }
  } else {
    wrap.classList.remove("success");
    wrap.classList.add("error");
    if (statusEl) {
      statusEl.className = "nr-script-run-status error";
      statusEl.textContent = `Failed (exit ${result.exitCode ?? "?"})`;
    }
  }
}

function findRunBlockForAction(root, actionId) {
  return root.querySelector(`.nr-script-run[data-action-id="${actionId}"]`);
}

function applyProxyStateToRunBlock(wrap, proxyState) {
  const runBtn = wrap.querySelector(".nr-script-run-btn");
  const statusEl = wrap.querySelector(".nr-script-run-status");
  if (!runBtn || !statusEl) return;

  wrap.dataset.proxyState = proxyState;

  if (proxyState === "checking") {
    runBtn.disabled = true;
    runBtn.title = "";
    statusEl.textContent = "Checking proxy…";
    statusEl.className = "nr-script-run-status checking";
    return;
  }

  if (proxyState === "healthy") {
    runBtn.disabled = false;
    runBtn.title = "";
    statusEl.textContent = "";
    statusEl.className = "nr-script-run-status";
    return;
  }

  runBtn.disabled = true;
  runBtn.title = PROXY_OFFLINE_TITLE;
  statusEl.textContent = "Proxy offline";
  statusEl.className = "nr-script-run-status offline";
}

function applyProxyStateToQuickRunHeader(actionsWrap, proxyState) {
  const statusEl = actionsWrap?.querySelector(".nr-quick-run-proxy-status");
  const runBtn = actionsWrap?.querySelector(".nr-run-cluster-quick");
  if (!statusEl || !runBtn) return;

  actionsWrap.dataset.proxyState = proxyState;
  runBtn.dataset.proxyState = proxyState;

  if (proxyState === "checking") {
    runBtn.disabled = true;
    runBtn.title = "";
    statusEl.hidden = false;
    statusEl.textContent = "Checking proxy…";
    statusEl.className = "nr-quick-run-proxy-status checking";
    return;
  }

  if (proxyState === "healthy") {
    runBtn.disabled = false;
    runBtn.title = "";
    statusEl.textContent = "";
    statusEl.className = "nr-quick-run-proxy-status";
    statusEl.hidden = true;
    return;
  }

  runBtn.disabled = true;
  runBtn.title = PROXY_OFFLINE_TITLE;
  statusEl.hidden = false;
  statusEl.textContent = "Proxy offline";
  statusEl.className = "nr-quick-run-proxy-status offline";
}

function applyProxyStateToAllRunBlocks(root, proxyState) {
  root.querySelectorAll(".nr-script-run").forEach((wrap) => {
    applyProxyStateToRunBlock(wrap, proxyState);
  });
  root.querySelectorAll(".nr-instructions-quick-actions").forEach((wrap) => {
    applyProxyStateToQuickRunHeader(wrap, proxyState);
  });
}

function createRunBlock(commandText, actionMeta, { proxyState, onRunComplete }) {
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
  const statusEl = wrap.querySelector(".nr-script-run-status");
  const outputDetails = wrap.querySelector(".nr-script-run-output");

  applyProxyStateToRunBlock(wrap, proxyState);

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(commandText).then(() => {
      copyBtn.textContent = "Copied";
      setTimeout(() => {
        copyBtn.textContent = "Copy command";
      }, 1500);
    });
  });

  runBtn.addEventListener("click", async () => {
    if (actionMeta.confirm && !window.confirm(actionMeta.confirm)) {
      return;
    }

    runBtn.disabled = true;
    copyBtn.disabled = true;
    statusEl.className = "nr-script-run-status running";
    statusEl.textContent = "Running…";
    outputDetails.hidden = true;

    try {
      const result = await onRunComplete(actionMeta.id);
      applyRunResultToBlock(wrap, result);
    } catch (err) {
      applyRunResultToBlock(wrap, null, err);
    } finally {
      copyBtn.disabled = false;
      if (wrap.dataset.proxyState === "healthy") {
        runBtn.disabled = false;
      }
    }
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
  { proxyState, proxyUrl, observability, quickRunHeaderSteps },
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

  const statusEl = document.createElement("span");
  statusEl.className = "nr-quick-run-proxy-status";
  statusEl.setAttribute("aria-live", "polite");

  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "nr-run-cluster-quick";
  runBtn.textContent = QUICK_RUN_LABEL;

  actionsWrap.insertBefore(statusEl, copyBtn);
  actionsWrap.insertBefore(runBtn, copyBtn);

  applyProxyStateToQuickRunHeader(actionsWrap, proxyState);

  runBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (runBtn.disabled) return;
    if (actionMeta.confirm && !window.confirm(actionMeta.confirm)) {
      return;
    }

    const bodyRunBlock = findRunBlockForAction(root, actionMeta.id);
    const bodyRunBtn = bodyRunBlock?.querySelector(".nr-script-run-btn");
    const bodyCopyBtn = bodyRunBlock?.querySelector(".nr-script-copy-btn");
    const bodyStatusEl = bodyRunBlock?.querySelector(".nr-script-run-status");
    const bodyOutputDetails = bodyRunBlock?.querySelector(".nr-script-run-output");

    runBtn.disabled = true;
    runBtn.textContent = "Running…";
    if (bodyRunBtn) bodyRunBtn.disabled = true;
    if (bodyCopyBtn) bodyCopyBtn.disabled = true;
    if (bodyStatusEl) {
      bodyStatusEl.className = "nr-script-run-status running";
      bodyStatusEl.textContent = "Running…";
    }
    if (bodyOutputDetails) bodyOutputDetails.hidden = true;

    try {
      const result = await executeDemoAction(actionMeta.id, { proxyUrl, observability });
      applyRunResultToBlock(bodyRunBlock, result);
      runBtn.textContent = result.ok ? "Done" : "Failed";
    } catch (err) {
      applyRunResultToBlock(bodyRunBlock, null, err);
      runBtn.textContent = "Failed";
    } finally {
      if (bodyCopyBtn) bodyCopyBtn.disabled = false;
      if (bodyRunBtn && bodyRunBlock?.dataset.proxyState === "healthy") {
        bodyRunBtn.disabled = false;
      }
      setTimeout(() => {
        runBtn.textContent = QUICK_RUN_LABEL;
        applyProxyStateToQuickRunHeader(actionsWrap, actionsWrap.dataset.proxyState ?? "offline");
      }, 1500);
    }
  });
}

function wireCommandElements(
  root,
  { proxyState, proxyUrl, observability, runnerEnabled, quickRunHeaderSteps, stepId },
) {
  const containers = commandContainers(root);
  if (!containers.length) return;

  containers.forEach((container) => {
    container.querySelectorAll(".nr-script-run").forEach((el) => el.remove());
  });

  const onRunComplete = (actionId) => executeDemoAction(actionId, { proxyUrl, observability });

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
          onRunComplete,
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
  quickRunHeaderSteps = ["C-after"],
} = {}) {
  const skipStepIds = new Set(skipSteps);
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
