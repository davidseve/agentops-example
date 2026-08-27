/**
 * Cluster observability panel for v1 live companion.
 * Polls the local demo-observability-proxy for logs and MLflow traces.
 */

import {
  COMPONENT_LABELS,
  DEFAULT_HIDE_NOISE,
  formatStepHint,
  processLogLines,
  stepHintUsesCustomMessage,
} from "./observability-log-rules.js?v=23";

const DEFAULT_PROXY_URL = "http://127.0.0.1:8766";
const POLL_MS = 4000;
/** MLflow trace fetches run oc exec + cluster curl (~7s); must finish before next poll. */
const TRACE_POLL_MS = 10000;
const DEFAULT_LOG_LINES = 120;
const LOG_LINES_BY_COMPONENT = {
  openclaw: 120,
  sandbox: 300,
  openshell: 120,
  nemo: 120,
};
const TRACE_MAX = 8;
/** Slightly above proxy run_bash timeout (45s) so slow WiFi surfaces a clear error. */
const FETCH_TIMEOUT_MS = 50_000;
const DEFAULT_FOLLOW_SCROLL = true;

function logLinesFor(componentId) {
  return LOG_LINES_BY_COMPONENT[componentId] ?? DEFAULT_LOG_LINES;
}

function createComponentState(componentId) {
  return {
    followScroll: DEFAULT_FOLLOW_SCROLL,
    hideNoise: DEFAULT_HIDE_NOISE[componentId] ?? false,
    lastPayload: null,
    lastUpdated: null,
    lastError: null,
    lastStats: null,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTimestamp(ms) {
  if (!ms) return "—";
  const d = new Date(Number(ms));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function relativeTime(iso) {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const delta = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  return `${Math.round(delta / 60)}m ago`;
}

async function fetchJson(url, options = {}) {
  const signal = options.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { cache: "no-store", ...options, signal });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("Proxy request timed out — check WiFi / oc login");
    }
    throw err;
  }
  const data = await res.json();
  if (!res.ok && data?.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export function initObservabilityPanel({
  root,
  mount,
  proxyUrl = DEFAULT_PROXY_URL,
  pollMs = POLL_MS,
} = {}) {
  const host = mount ?? root?.querySelector("[data-nr-observability]");
  if (!host) return null;

  let components = [];
  let activeId = "openclaw";
  let activeStepId = null;
  let hiddenTabIds = new Set();
  let collapsed = false;
  let pollTimer = null;
  let refreshInFlight = false;
  let mlflowBaseUrl = "";
  const stateByComponent = new Map();

  host.innerHTML = `
    <section class="nr-obs" aria-label="Cluster observability">
      <div class="nr-obs-head">
        <h2>Cluster observability</h2>
        <div class="nr-obs-actions">
          <button type="button" class="nr-obs-refresh" title="Refresh now">↻</button>
          <button type="button" class="nr-obs-collapse" title="Collapse panel">▾</button>
        </div>
      </div>
      <p class="nr-obs-status" data-obs-status>Connecting to proxy…</p>
      <div class="nr-obs-body">
        <div class="nr-obs-tabrow">
          <nav class="nr-obs-tabs" data-obs-tabs role="tablist" aria-label="Components"></nav>
          <div class="nr-obs-tabrow-actions">
            <button type="button" class="nr-obs-filter active" title="Show signal and warn only" aria-pressed="true" aria-label="Focus filter">Filter</button>
            <button type="button" class="nr-obs-follow active" title="Pause live updates" aria-pressed="true" aria-label="Pause live updates">↓</button>
          </div>
        </div>
        <p class="nr-obs-hints" data-obs-hints></p>
        <div class="nr-obs-viewer-wrap">
          <pre class="nr-obs-viewer" data-obs-viewer role="tabpanel">Loading…</pre>
        </div>
      </div>
    </section>`;

  const statusEl = host.querySelector("[data-obs-status]");
  const tabsEl = host.querySelector("[data-obs-tabs]");
  const hintsEl = host.querySelector("[data-obs-hints]");
  const viewerEl = host.querySelector("[data-obs-viewer]");
  const viewerWrapEl = host.querySelector(".nr-obs-viewer-wrap");
  const followBtn = host.querySelector(".nr-obs-follow");
  const filterBtn = host.querySelector(".nr-obs-filter");
  const refreshBtn = host.querySelector(".nr-obs-refresh");
  const collapseBtn = host.querySelector(".nr-obs-collapse");

  function getState(id = activeId) {
    if (!stateByComponent.has(id)) {
      stateByComponent.set(id, createComponentState(id));
    }
    return stateByComponent.get(id);
  }

  function isFollowScroll(id = activeId) {
    return getState(id).followScroll;
  }

  function isHideNoise(id = activeId) {
    return getState(id).hideNoise;
  }

  function setFollowScroll(id, on) {
    getState(id).followScroll = on;
    if (id === activeId) {
      syncFollowButton();
    }
  }

  function setHideNoise(id, on) {
    getState(id).hideNoise = on;
    if (id === activeId) {
      syncFilterButton();
    }
  }

  function syncFollowButton() {
    const on = isFollowScroll(activeId);
    followBtn.classList.toggle("active", on);
    followBtn.setAttribute("aria-pressed", String(on));
    const label = on ? "Pause live updates" : "Resume live updates";
    followBtn.title = label;
    followBtn.setAttribute("aria-label", label);
  }

  function syncFilterButton() {
    const on = isHideNoise(activeId);
    filterBtn.classList.toggle("active", on);
    filterBtn.setAttribute("aria-pressed", String(on));
    const label = on ? "Show all lines" : "Focus: signal and warn only";
    filterBtn.title = label;
    filterBtn.setAttribute("aria-label", label);
  }

  function isTabHidden(id) {
    return hiddenTabIds.has(id);
  }

  function setHiddenTabs(ids = []) {
    hiddenTabIds = new Set(Array.isArray(ids) ? ids : []);
  }

  function clearTabSuggestions() {
    if (!components.length) return;
    components = components.map((c) => ({ ...c, suggested: false }));
  }

  function resolveActiveTabId(preferredId) {
    if (
      preferredId &&
      !isTabHidden(preferredId) &&
      components.some((c) => c.id === preferredId)
    ) {
      return preferredId;
    }
    const visible = components.find((c) => !isTabHidden(c.id));
    return visible?.id ?? activeId;
  }

  function hiddenTabsHintSuffix() {
    if (!hiddenTabIds.size) return "";
    const labels = [...hiddenTabIds]
      .map((id) => COMPONENT_LABELS[id] ?? id)
      .join(", ");
    return ` · Hidden this step: ${labels} — use OpenClaw + Sandbox`;
  }

  function updateHintsBar() {
    const base = formatStepHint(activeStepId);
    hintsEl.textContent = stepHintUsesCustomMessage(activeStepId)
      ? base
      : `${base}${hiddenTabsHintSuffix()}`;
  }

  function scrollToEnd() {
    if (!viewerWrapEl) return;
    const el = viewerWrapEl;
    const snap = () => {
      el.scrollTop = el.scrollHeight;
    };
    snap();
    requestAnimationFrame(() => {
      snap();
      requestAnimationFrame(snap);
    });
  }

  function setViewerHtml(html, { stickToBottom = isFollowScroll() } = {}) {
    const savedTop = viewerWrapEl.scrollTop;
    viewerEl.innerHTML = html;
    if (stickToBottom) {
      scrollToEnd();
    } else {
      viewerWrapEl.scrollTop = savedTop;
    }
  }

  function setStatus(text, kind = "") {
    statusEl.textContent = text;
    statusEl.className = `nr-obs-status${kind ? ` ${kind}` : ""}`;
  }

  function statusSuffix(current) {
    return current?.id === "mlflow" && mlflowBaseUrl ? ` · ${mlflowBaseUrl}` : "";
  }

  function statsSuffix(stats, hideNoise) {
    if (!stats) return "";
    const parts = [];
    if (stats.signal) parts.push(`${stats.signal} signal`);
    if (stats.warn) parts.push(`${stats.warn} warn`);
    if (hideNoise && stats.hidden) parts.push(`${stats.hidden} hidden`);
    else if (!hideNoise && stats.hidden) parts.push(`${stats.hidden} noise`);
    return parts.length ? ` · ${parts.join(" · ")}` : "";
  }

  function updateStatusForComponent(current) {
    const state = getState(current.id);
    const link = statusSuffix(current);
    const statsPart = statsSuffix(state.lastStats, state.hideNoise);
    if (state.lastError) {
      setStatus(`proxy: error · ${state.lastError} · updated ${relativeTime(state.lastUpdated)}${link}`, "error");
    } else if (!state.followScroll) {
      setStatus(
        `proxy: connected · paused (frozen snapshot) · fetched ${relativeTime(state.lastUpdated)}${statsPart}${link}`,
        "ok"
      );
    } else {
      setStatus(`proxy: connected · updated ${relativeTime(state.lastUpdated)}${statsPart}${link}`, "ok");
    }
  }

  function renderTabs() {
    if (!components.length) {
      tabsEl.innerHTML = "";
      return;
    }
    tabsEl.innerHTML = components
      .map((c) => {
        const active = c.id === activeId ? " active" : "";
        const suggested = c.suggested ? " suggested" : "";
        const hidden = isTabHidden(c.id);
        const disabled = hidden ? " disabled" : "";
        const title = hidden
          ? `Not relevant for step ${activeStepId ?? "?"} — use OpenClaw + Sandbox`
          : "";
        return `<button type="button" role="tab" class="nr-obs-tab${active}${suggested}${disabled}" data-component="${escapeHtml(c.id)}" aria-selected="${c.id === activeId}" aria-disabled="${hidden}"${title ? ` title="${escapeHtml(title)}"` : ""}${hidden ? " disabled" : ""}>${escapeHtml(c.label)}</button>`;
      })
      .join("");

    tabsEl.querySelectorAll("[data-component]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (isTabHidden(btn.dataset.component)) return;
        activeId = btn.dataset.component;
        clearTabSuggestions();
        syncFollowButton();
        syncFilterButton();
        renderTabs();
        updateHintsBar();
        const state = getState(activeId);
        const current = components.find((c) => c.id === activeId);
        restartPolling();
        if (isFollowScroll(activeId)) {
          viewerEl.textContent = "Refreshing…";
          refreshActive({ updateView: true });
        } else if (state.lastPayload) {
          renderViewer({ stickToBottom: false });
          updateStatusForComponent(current ?? { id: activeId });
        } else {
          viewerEl.textContent = "Refreshing…";
          refreshActive({ updateView: true });
        }
      });
    });
  }

  function renderLogHtml(content, componentId, hideNoise) {
    const text = content || "(no output)";
    if (text.startsWith("(sandbox log not found") || text.startsWith("(openclaw.log not found")) {
      return escapeHtml(text);
    }

    const { visible, stats } = processLogLines(text, componentId, hideNoise, activeStepId);
    getState(componentId).lastStats = stats;

    if (!visible.length) {
      return `<span class="obs-line obs-noise">${escapeHtml("(no signal lines — disable Filter to see full log, or run the demo step)")}</span>`;
    }

    return visible
      .map(({ line, tier }) => `<span class="obs-line obs-${tier}">${escapeHtml(line)}</span>`)
      .join("");
  }

  function renderTraces(payload) {
    const traces = payload?.traces ?? [];
    if (!traces.length) {
      return escapeHtml("No traces found yet. Run Tests A–D in the same chat session.");
    }
    const lines = traces.map((t, i) => {
      const id = t.traceId || t.requestId || `trace-${i + 1}`;
      const shortId = id.length > 24 ? `${id.slice(0, 24)}…` : id;
      return [
        `#${i + 1}`,
        shortId,
        t.status || "—",
        formatTimestamp(t.timestampMs),
        t.executionTimeMs != null ? `${t.executionTimeMs}ms` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");
    });
    const header = payload.experimentName
      ? `experiment: ${payload.experimentName} (${payload.experimentId})\n\n`
      : "";
    return escapeHtml(`${header}${lines.join("\n")}`);
  }

  function renderViewer({ stickToBottom = isFollowScroll() } = {}) {
    const state = getState(activeId);
    const component = components.find((c) => c.id === activeId);
    if (!state.lastPayload) {
      viewerEl.textContent = "Loading…";
      return;
    }

    if (component?.type === "traces") {
      setViewerHtml(renderTraces(state.lastPayload), { stickToBottom });
    } else {
      setViewerHtml(
        renderLogHtml(state.lastPayload.content, activeId, state.hideNoise),
        { stickToBottom }
      );
    }
    updateStatusForComponent(component ?? { id: activeId });
  }

  function logsFetchUrl(componentId) {
    let lines = logLinesFor(componentId);
    if (componentId === "sandbox" && activeStepId === "B") {
      lines = 500;
    }
    let url = `${proxyUrl}/api/logs/${encodeURIComponent(componentId)}?lines=${lines}`;
    if (componentId === "sandbox" && isHideNoise(componentId)) {
      url += "&filter=signal";
    }
    if (activeStepId) {
      url += `&step=${encodeURIComponent(activeStepId)}`;
    }
    return url;
  }

  async function loadComponents() {
    const data = await fetchJson(`${proxyUrl}/api/components`);
    components = data.components ?? [];
    mlflowBaseUrl = data.mlflowBaseUrl || mlflowBaseUrl;
    renderTabs();
  }

  async function refreshActive({ updateView } = {}) {
    const state = getState(activeId);
    const shouldUpdateView = updateView ?? state.followScroll;
    const requestedId = activeId;
    const userInitiated = updateView === true;

    // MLflow trace fetches often exceed POLL_MS; skip overlapping poll ticks instead of
    // discarding late responses (which left the viewer stuck on "Refreshing…").
    if (refreshInFlight && !userInitiated) return;

    refreshInFlight = true;
    refreshBtn.disabled = true;
    filterBtn.disabled = true;
    try {
      const component = components.find((c) => c.id === requestedId);
      if (!component) {
        await loadComponents();
      }
      const current =
        components.find((c) => c.id === requestedId) ?? components[0];
      if (!current) {
        throw new Error("No components available from proxy");
      }

      let payload;
      if (current.type === "traces") {
        payload = await fetchJson(`${proxyUrl}/api/traces/mlflow?max=${TRACE_MAX}`);
      } else {
        payload = await fetchJson(logsFetchUrl(current.id));
      }
      if (requestedId !== activeId) return;

      const componentState = getState(current.id);
      componentState.lastPayload = payload;
      componentState.lastUpdated = payload.fetchedAt || new Date().toISOString();
      componentState.lastError = payload.ok === false ? payload.error : null;
      mlflowBaseUrl = payload.mlflowBaseUrl || mlflowBaseUrl;

      updateStatusForComponent(current);
      renderTabs();
      if (shouldUpdateView) {
        renderViewer({ stickToBottom: componentState.followScroll });
      }
    } catch (err) {
      if (requestedId !== activeId) return;
      const componentState = getState(requestedId);
      componentState.lastError = err.message || String(err);
      setStatus(`proxy: unreachable (${componentState.lastError}) — run scripts/demo-presenter-serve.sh`, "error");
      if (shouldUpdateView) {
        viewerEl.textContent = componentState.lastError;
        if (componentState.followScroll) scrollToEnd();
      }
    } finally {
      refreshInFlight = false;
      refreshBtn.disabled = false;
      filterBtn.disabled = false;
    }
  }

  async function refreshHealth() {
    try {
      const health = await fetchJson(`${proxyUrl}/api/health`);
      if (!health.ok) {
        setStatus("proxy: oc/openshell not ready — log in with oc", "warn");
      }
      mlflowBaseUrl = health.mlflowBaseUrl || mlflowBaseUrl;
    } catch {
      /* refreshActive will surface errors */
    }
  }

  function suggestTab(focusId) {
    if (!focusId || !components.length) return;
    if (!components.some((c) => c.id === focusId)) return;
    activeId = resolveActiveTabId(focusId);
    syncFollowButton();
    syncFilterButton();
    components = components.map((c) => ({
      ...c,
      suggested: c.id === focusId && !isTabHidden(c.id),
    }));
    renderTabs();
  }

  function applyStepObservability({ focus, hidden = [] } = {}) {
    setHiddenTabs(hidden);
    const nextId = resolveActiveTabId(focus || activeId);
    if (nextId !== activeId) {
      activeId = nextId;
      syncFollowButton();
      syncFilterButton();
      restartPolling();
    }
    if (components.length) {
      components = components.map((c) => ({
        ...c,
        suggested: Boolean(focus && c.id === focus && !isTabHidden(c.id)),
      }));
    }
    renderTabs();
    updateHintsBar();
  }

  function pollIntervalMs() {
    const current = components.find((c) => c.id === activeId);
    return current?.type === "traces" ? TRACE_POLL_MS : pollMs;
  }

  function startPolling() {
    stopPolling();
    const tick = () => {
      refreshActive();
      pollTimer = window.setTimeout(tick, pollIntervalMs());
    };
    pollTimer = window.setTimeout(tick, pollIntervalMs());
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function restartPolling() {
    if (pollTimer) startPolling();
  }

  filterBtn.addEventListener("click", () => {
    const state = getState(activeId);
    const next = !state.hideNoise;
    setHideNoise(activeId, next);
    if (isFollowScroll(activeId)) {
      refreshActive({ updateView: true });
    } else {
      renderViewer({ stickToBottom: false });
    }
  });

  followBtn.addEventListener("click", () => {
    const state = getState(activeId);
    const current = components.find((c) => c.id === activeId) ?? { id: activeId };
    if (state.followScroll) {
      setFollowScroll(activeId, false);
      updateStatusForComponent(current);
      return;
    }
    setFollowScroll(activeId, true);
    refreshActive({ updateView: true });
  });

  viewerWrapEl.addEventListener(
    "wheel",
    (event) => {
      if (isFollowScroll(activeId) && event.deltaY < 0) {
        setFollowScroll(activeId, false);
        const current = components.find((c) => c.id === activeId) ?? { id: activeId };
        updateStatusForComponent(current);
      }
    },
    { passive: true }
  );

  refreshBtn.addEventListener("click", () => refreshActive({ updateView: true }));
  collapseBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    host.classList.toggle("nr-obs-collapsed", collapsed);
    collapseBtn.textContent = collapsed ? "▸" : "▾";
    collapseBtn.title = collapsed ? "Expand panel" : "Collapse panel";
    if (!collapsed && isFollowScroll(activeId)) scrollToEnd();
  });

  root?.addEventListener("nr:step-change", (event) => {
    activeStepId = event.detail?.stepId ?? null;
    const focus = event.detail?.observabilityFocus ?? null;
    const hidden = event.detail?.observabilityHidden ?? [];
    applyStepObservability({ focus, hidden });
    updateHintsBar();
    if (getState(activeId).lastPayload) {
      renderViewer({ stickToBottom: isFollowScroll(activeId) });
    }
    refreshActive({ updateView: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopPolling();
    } else {
      refreshActive({ updateView: isFollowScroll(activeId) });
      startPolling();
    }
  });

  (async () => {
    await refreshHealth();
    await loadComponents();
    syncFollowButton();
    syncFilterButton();
    updateHintsBar();
    await refreshActive({ updateView: true });
    startPolling();
  })();

  return {
    refresh: () => refreshActive({ updateView: true }),
    suggestTab,
    stopPolling,
  };
}
