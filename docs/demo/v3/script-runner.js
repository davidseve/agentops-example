/**
 * v3: run allowlisted demo scripts against the cluster via local proxy.
 */

import { DEMO_SCRIPT_ACTIONS } from "../v1/narrative-data.js";

const DEFAULT_PROXY_URL = "http://127.0.0.1:8766";
const FETCH_TIMEOUT_MS = 130_000;
const PROXY_OFFLINE_TITLE = "Start ./scripts/demo-presenter-serve.sh to enable script runner";

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

function applyProxyStateToAllRunBlocks(root, proxyState) {
  root.querySelectorAll(".nr-script-run").forEach((wrap) => {
    applyProxyStateToRunBlock(wrap, proxyState);
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
        Run against cluster
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
  const outputPre = wrap.querySelector(".nr-script-run-pre");

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
      const output = formatOutput(result.stdout, result.stderr);
      outputPre.textContent = output;
      outputDetails.hidden = false;
      outputDetails.open = true;

      if (result.ok) {
        wrap.classList.remove("error");
        wrap.classList.add("success");
        statusEl.className = "nr-script-run-status success";
        statusEl.textContent = `Done (${result.durationMs ?? 0}ms)`;
      } else {
        wrap.classList.remove("success");
        wrap.classList.add("error");
        statusEl.className = "nr-script-run-status error";
        statusEl.textContent = `Failed (exit ${result.exitCode ?? "?"})`;
      }
    } catch (err) {
      wrap.classList.remove("success");
      wrap.classList.add("error");
      outputPre.textContent = err?.message || String(err);
      outputDetails.hidden = false;
      outputDetails.open = true;
      statusEl.className = "nr-script-run-status error";
      statusEl.textContent = "Error";
    } finally {
      copyBtn.disabled = false;
      if (wrap.dataset.proxyState === "healthy") {
        runBtn.disabled = false;
      }
    }
  });

  return wrap;
}

function wireCommandElements(root, { proxyState, proxyUrl, observability, runnerEnabled }) {
  const card = root.querySelector("[data-nr-card]");
  if (!card) return;

  card.querySelectorAll(".nr-script-run").forEach((el) => el.remove());

  if (!runnerEnabled) return;

  const onRunComplete = async (actionId) => {
    const result = await fetchJson(`${proxyUrl}/api/demo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionId }),
    });
    if (result.ok) {
      observability?.refresh?.();
    }
    return result;
  };

  card.querySelectorAll(".nr-cmd").forEach((cmdEl) => {
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
}

function ensureProxyBanner(root, navEl, proxyState) {
  let banner = root.querySelector(".nr-script-proxy-banner");
  if (proxyState !== "offline") {
    banner?.remove();
    return;
  }

  if (banner) return;

  banner = document.createElement("p");
  banner.className = "nr-script-proxy-banner";
  banner.textContent =
    "Script runner requires ./scripts/demo-presenter-serve.sh (observability proxy on :8766).";
  const main = root.querySelector(".nr-main");
  if (main) {
    main.insertBefore(banner, main.firstChild);
    return;
  }
  if (navEl?.parentElement) {
    navEl.parentElement.insertBefore(banner, navEl.nextSibling);
  }
}

function parseStepIdFromHash() {
  const hash = window.location.hash.replace(/^#/, "").trim();
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
  /** Narrative step ids where script runner UI and proxy banner are suppressed. */
  skipSteps = ["0"],
} = {}) {
  const skipStepIds = new Set(skipSteps);
  let currentStepId = parseStepIdFromHash();
  let proxyState = "checking";

  const syncRunnerUi = () => {
    const runnerEnabled = isRunnerStep(currentStepId, skipStepIds);
    if (runnerEnabled) {
      ensureProxyBanner(root, navEl, proxyState);
    } else {
      root.querySelector(".nr-script-proxy-banner")?.remove();
    }
    wireCommandElements(root, {
      proxyState,
      proxyUrl,
      observability,
      runnerEnabled,
    });
  };

  syncRunnerUi();

  checkProxyHealth(proxyUrl).then((resolvedState) => {
    proxyState = resolvedState;
    const runnerEnabled = isRunnerStep(currentStepId, skipStepIds);
    if (runnerEnabled) {
      ensureProxyBanner(root, navEl, proxyState);
    }
    applyProxyStateToAllRunBlocks(root, proxyState);
  });

  root.addEventListener("nr:step-change", (event) => {
    currentStepId = event.detail?.stepId ?? parseStepIdFromHash();
    syncRunnerUi();
  });

  return {
    refresh: syncRunnerUi,
    getProxyHealthy: () => proxyState === "healthy",
    getProxyState: () => proxyState,
  };
}
