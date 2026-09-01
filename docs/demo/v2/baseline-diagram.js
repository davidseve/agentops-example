/**
 * FlowStory baseline diagram embed for v2 live companion step 0.
 */

import { FlowStory } from "../shared/vendor/flowstory.min.js";
import { setLogosEnabled, uninstallLogoRenderer } from "../shared/logo-renderer.js";
import { buildBaselineDiagram } from "../scenarios/overall-diagram-config.js";
import {
  applyPhaseRestVisuals,
  getActiveResponseMode,
  normalizeLightupBadges,
  wireResponseComparison,
} from "../scenarios/shared-scenario.js";
import { buildOverallResponseComparison, BASELINE_LEGEND_HOP_HIGHLIGHTS, PHASE_REST } from "../scenarios/overall-flows.js";

export const BASELINE_LAYOUT_IDS = [
  "current",
  "stack",
  "unified",
  "legend-footer",
  "legend-inset",
];

const DEFAULT_LAYOUT = "current";
const LEGEND_FOOTER_RESERVE_PX = 44;
const BASELINE_POPUP_MODE_KEY = "v2-baseline-popups-mode";
const BASELINE_LEGEND_HIGHLIGHT_KEY = "v2-baseline-legend-highlight";

let activeViz = null;
let activeDiagram = null;
let activeContainer = null;
let activeLayout = DEFAULT_LAYOUT;
let activeResponseWire = null;
let activeLegendHighlightWire = null;
let resizeObserver = null;

export function isValidBaselineLayout(layout) {
  return BASELINE_LAYOUT_IDS.includes(layout);
}

function mapInspectorRows(rows) {
  return (rows || []).map((p) => ({
    v: p.value || p.v,
    s: p.style || p.s || "keep",
    id: p.id,
  }));
}

function applyInspectorInitialState(viz, diagram, flowId = "baseline") {
  const insp = diagram.inspector;
  if (!insp) return;
  const inspector = viz?._inspector;
  if (!inspector) return;

  const state = insp.initialStates?.[flowId] ?? insp.initialState ?? { headers: [], body: [] };
  inspector.init({
    headers: mapInspectorRows(state.headers),
    body: mapInspectorRows(state.body),
    cycleState: mapInspectorRows(state.cycleState),
  });
  if (state.phase) inspector.setPhase(state.phase);
  inspector.render();
}

function stepCount(diagram, viz) {
  const flowId = viz.state.activeFlow || diagram.defaultFlow;
  return diagram.flows[flowId]?.steps?.length ?? 0;
}

function syncPlayLabel(viz, playBtn) {
  if (!playBtn) return;
  const s = viz.state;
  playBtn.innerHTML = s.running && !s.paused ? "&#9646;&#9646; Pause" : "&#9654; Start";
}

function relabelInspector(root) {
  const title = root.querySelector(".v2-fs-inspector-title");
  if (
    title &&
    (title.textContent === "Request" ||
      title.textContent === "Response" ||
      title.textContent === "Error Response")
  ) {
    title.textContent = "Layer board";
    title.style.color = "#58a6ff";
  }
  root.querySelectorAll(".fs-inspector-section").forEach((el) => {
    if (el.textContent === "Headers:") el.textContent = "Layers";
    const useResponses =
      getActiveResponseMode() === "panel" || getActiveResponseMode() === "both";
    const targetBody = useResponses ? "Responses" : "Scenario";
    const bodyLabels = new Set(["Body:", "Scenario", "Responses"]);
    if (bodyLabels.has(el.textContent) && el.textContent !== targetBody) {
      el.textContent = targetBody;
      el.classList.toggle("fs-inspector-responses", useResponses);
    }
  });
}

function scrollLayerBoardToHop(root) {
  requestAnimationFrame(() => {
    const scrollEl = root.querySelector(".fs-inspector");
    if (!scrollEl) return;

    const highlights = scrollEl.querySelectorAll(".fs-inspector-line.highlight");
    const line =
      highlights.length > 0
        ? highlights[highlights.length - 1]
        : scrollEl.querySelector(".fs-inspector-line.err") ||
          scrollEl.querySelector(".fs-inspector-line.add");
    if (!line) {
      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const scrollRect = scrollEl.getBoundingClientRect();
    const lineRect = line.getBoundingClientRect();
    const relativeTop = lineRect.top - scrollRect.top + scrollEl.scrollTop;
    const target =
      relativeTop - scrollEl.clientHeight / 2 + lineRect.height / 2;
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    scrollEl.scrollTo({
      top: Math.max(0, Math.min(target, maxScroll)),
      behavior: "smooth",
    });
  });
}

function readLegendHighlightEnabled() {
  const stored = localStorage.getItem(BASELINE_LEGEND_HIGHLIGHT_KEY);
  if (stored === null) return true;
  return stored === "true";
}

function syncLegendHighlightButton(btn, enabled) {
  if (!btn) return;
  btn.textContent = enabled ? "Legend: On" : "Legend: Off";
  btn.classList.toggle("fs-response-mode-on", enabled);
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
}

function tagLegendItems(root) {
  root.querySelectorAll(".v2-fs-legend .fs-legend-item").forEach((el, index) => {
    el.dataset.legendIndex = String(index);
  });
}

function applyLegendHopHighlight(root, stepDone, enabled) {
  const items = root.querySelectorAll(".v2-fs-legend .fs-legend-item");
  items.forEach((el) => {
    el.classList.remove("v2-fs-legend-item--active");
    el.classList.toggle("v2-fs-legend-item--dim", enabled && stepDone > 0);
  });
  if (!enabled || stepDone <= 0) {
    items.forEach((el) => el.classList.remove("v2-fs-legend-item--dim"));
    return;
  }

  const indices = BASELINE_LEGEND_HOP_HIGHLIGHTS[stepDone] ?? [];
  for (const index of indices) {
    const item = root.querySelector(
      `.v2-fs-legend .fs-legend-item[data-legend-index="${index}"]`
    );
    if (!item) continue;
    item.classList.add("v2-fs-legend-item--active");
    item.classList.remove("v2-fs-legend-item--dim");
    item.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
}

function syncLegendHopHighlight(viz, root) {
  if (!viz || !root) return;
  tagLegendItems(root);
  applyLegendHopHighlight(root, viz.state.currentStepDone || 0, readLegendHighlightEnabled());
}

function wireLegendHopHighlight(viz, root) {
  const btn = root.querySelector(".v2-fs-legend-highlight-toggle");
  let enabled = readLegendHighlightEnabled();
  syncLegendHighlightButton(btn, enabled);

  const refresh = () => syncLegendHopHighlight(viz, root);

  const legendEl = root.querySelector(".v2-fs-legend");
  let legendObserver = null;
  if (legendEl) {
    legendObserver = new MutationObserver(() => refresh());
    legendObserver.observe(legendEl, { childList: true, subtree: true });
  }

  const stepsContainer = root.querySelector(".v2-fs-steps-container");
  let stepsObserver = null;
  if (stepsContainer) {
    stepsObserver = new MutationObserver(() => refresh());
    stepsObserver.observe(stepsContainer, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (typeof viz.jumpTo === "function") {
    const origJumpTo = viz.jumpTo.bind(viz);
    viz.jumpTo = (idx) => {
      origJumpTo(idx);
      requestAnimationFrame(() => refresh());
    };
  }

  btn?.addEventListener("click", () => {
    enabled = !enabled;
    localStorage.setItem(BASELINE_LEGEND_HIGHLIGHT_KEY, String(enabled));
    syncLegendHighlightButton(btn, enabled);
    refresh();
  });

  refresh();

  return {
    enabled,
    refresh,
    teardown: () => {
      legendObserver?.disconnect();
      stepsObserver?.disconnect();
    },
  };
}

function legendHtml(extraClass = "") {
  return `<div class="v2-fs-legend fs-legend ${extraClass}" aria-label="Diagram legend"></div>`;
}

function inspectorHtml() {
  return `
    <div class="fs-inspector">
      <div class="fs-inspector-title v2-fs-inspector-title">Layer board</div>
      <div class="v2-fs-inspector-content"></div>
    </div>`;
}

function canvasBlock(layout) {
  if (layout === "legend-footer") {
    return `
      <div class="nr-v2-baseline-canvas-wrap">
        <div class="nr-v2-canvas-stage">
          <canvas class="v2-fs-canvas"></canvas>
        </div>
        ${legendHtml("v2-fs-legend--horizontal")}
      </div>`;
  }
  if (layout === "legend-inset") {
    return `
      <div class="nr-v2-baseline-canvas-wrap nr-v2-canvas-wrap--inset">
        <div class="nr-v2-canvas-stage">
          <div class="nr-v2-canvas-legend-anchor">
            ${legendHtml("v2-fs-legend--inset-column")}
            <canvas class="v2-fs-canvas"></canvas>
          </div>
        </div>
      </div>`;
  }
  return `
      <div class="nr-v2-baseline-canvas-wrap">
        <canvas class="v2-fs-canvas"></canvas>
      </div>`;
}

function overlayHtml() {
  return `
      <div class="v2-fs-highlight-box"></div>
      <div class="v2-fs-overlay">
        <div class="v2-fs-overlay-card">
          <button type="button" class="v2-fs-overlay-close">✕</button>
          <div class="v2-fs-overlay-accent"></div>
          <h2 class="v2-fs-overlay-title"></h2>
          <p class="v2-fs-overlay-desc"></p>
          <div class="v2-fs-overlay-details"></div>
          <button type="button" class="v2-fs-overlay-resume">&#9654; Resume</button>
        </div>
      </div>`;
}

function buildEmbedHtml(layout = DEFAULT_LAYOUT) {
  const inCanvasLegend = layout === "legend-footer" || layout === "legend-inset";
  const unified = layout === "unified";
  const panelInspector = unified ? "" : inspectorHtml();
  const externalLegend =
    !inCanvasLegend && !unified
      ? legendHtml(layout === "stack" ? "v2-fs-legend--grid" : "")
      : "";
  const metaCard = unified
    ? `<div class="nr-v2-meta-card">${inspectorHtml()}${legendHtml("v2-fs-legend--grid")}</div>`
    : "";

  return `
    <div class="nr-v2-baseline-inner" data-layout="${layout}">
      <div class="fs-panel v2-fs-panel">
        <div class="fs-flow-bar">
          <div class="fs-flow-nav">
            <button type="button" class="v2-fs-prev" title="Previous hop">&#9664;</button>
            <button type="button" class="fs-start v2-fs-play">&#9654; Start</button>
            <button type="button" class="v2-fs-next" title="Next hop">&#9654;</button>
          </div>
          <button type="button" class="v2-fs-popup-toggle" title="Toggle hop popup messages">Popups: On</button>
          <button type="button" class="v2-fs-legend-highlight-toggle" title="Toggle legend hop highlights">Legend: On</button>
          <button type="button" class="fs-reset v2-fs-reset">Reset</button>
        </div>
        <div class="fs-steps" aria-hidden="true">
          <div class="fs-steps-title">Layers</div>
          <div class="v2-fs-steps-container"></div>
        </div>
        ${panelInspector}
      </div>
      ${canvasBlock(layout)}
      ${externalLegend}
      ${metaCard}
      ${overlayHtml()}
    </div>`;
}

function wireOverlayClose(viz, root) {
  const overlay = root.querySelector(".v2-fs-overlay");
  const closeBtn = root.querySelector(".v2-fs-overlay-close");
  const resumeBtn = root.querySelector(".v2-fs-overlay-resume");
  const onClose = () => viz.closeOverlay?.();
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) onClose();
  });
  closeBtn?.addEventListener("click", onClose);
  resumeBtn?.addEventListener("click", onClose);
}

function measureLegendFooterHeight(wrap) {
  const legendEl = wrap?.querySelector(".v2-fs-legend");
  if (!legendEl) return LEGEND_FOOTER_RESERVE_PX;
  const h = legendEl.offsetHeight;
  return h > 0 ? h : LEGEND_FOOTER_RESERVE_PX;
}

function scheduleResize(viz) {
  requestAnimationFrame(() => {
    const engine = viz?._engine;
    const wrap = activeContainer?.querySelector(".nr-v2-baseline-canvas-wrap");
    if (!engine || !wrap || !activeDiagram) return;

    const logicalW = activeDiagram.canvas?.width ?? engine.logicalWidth ?? 820;
    const logicalH = activeDiagram.canvas?.height ?? engine.logicalHeight ?? 740;
    const containerW = Math.max(wrap.clientWidth || wrap.parentElement?.clientWidth || 0, 260);

    const maxH = Math.min(window.innerHeight * 0.78, 720);
    const minH = 420;
    let diagramH = Math.max(minH, maxH);

    let scale = diagramH / logicalH;
    let w = Math.round(logicalW * scale);
    if (w > containerW) {
      w = containerW;
      scale = w / logicalW;
      diagramH = Math.round(logicalH * scale);
    }
    if (diagramH < minH && containerW > 0) {
      diagramH = minH;
      scale = diagramH / logicalH;
      w = Math.min(Math.round(logicalW * scale), containerW);
    }

    let wrapTotalH = diagramH;
    if (activeLayout === "legend-footer") {
      const legendH = measureLegendFooterHeight(wrap);
      wrapTotalH = diagramH + legendH;
    }

    wrap.style.height = `${wrapTotalH}px`;
    engine.panelWidth = 0;
    engine.W = engine.canvas.width = w;
    engine.H = engine.canvas.height = diagramH;
    engine._sc = scale * 0.96;
    engine._ox = (w - logicalW * engine._sc) / 2;
    engine._oy = (diagramH - logicalH * engine._sc) * 0.02;
    engine.draw();
  });
}

function bindEngineResize(viz) {
  const engine = viz?._engine;
  if (!engine) return;
  window.removeEventListener("resize", engine._onResize);
  engine._onResize = () => scheduleResize(viz);
  window.addEventListener("resize", engine._onResize, { passive: true });
}

/**
 * @param {HTMLElement} container — typically .nr-diagram-wrap
 * @param {{ layout?: string }} options
 */
export async function mountBaselineDiagram(container, { layout = DEFAULT_LAYOUT } = {}) {
  if (!container) return;
  destroyBaselineDiagram();

  activeLayout = isValidBaselineLayout(layout) ? layout : DEFAULT_LAYOUT;
  activeContainer = container;
  container.innerHTML = buildEmbedHtml(activeLayout);
  container.classList.add("nr-v2-baseline-mounted");

  const root = container.querySelector(".nr-v2-baseline-inner");
  const canvas = root.querySelector(".v2-fs-canvas");
  const playBtn = root.querySelector(".v2-fs-play");
  const prevBtn = root.querySelector(".v2-fs-prev");
  const nextBtn = root.querySelector(".v2-fs-next");
  const resetBtn = root.querySelector(".v2-fs-reset");
  const highlightBox = root.querySelector(".v2-fs-highlight-box");
  const overlay = root.querySelector(".v2-fs-overlay");

  activeDiagram = buildBaselineDiagram();
  normalizeLightupBadges(activeDiagram);

  const viz = new FlowStory(canvas, {
    panelWidth: 0,
    panelElement: root.querySelector(".v2-fs-panel"),
    stepsContainer: root.querySelector(".v2-fs-steps-container"),
    inspectorTitle: root.querySelector(".v2-fs-inspector-title"),
    inspectorContent: root.querySelector(".v2-fs-inspector-content"),
    overlay,
    overlayCard: root.querySelector(".v2-fs-overlay-card"),
    overlayTitle: root.querySelector(".v2-fs-overlay-title"),
    overlayDesc: root.querySelector(".v2-fs-overlay-desc"),
    overlayDetails: root.querySelector(".v2-fs-overlay-details"),
    overlayAccent: root.querySelector(".v2-fs-overlay-accent"),
    overlayClose: root.querySelector(".v2-fs-overlay-close"),
    overlayResume: root.querySelector(".v2-fs-overlay-resume"),
    highlightBox,
    playBtn,
    resetBtn,
    legend: root.querySelector(".v2-fs-legend"),
  });

  activeViz = viz;

  await viz.load(activeDiagram);
  await setLogosEnabled(viz, true);
  bindEngineResize(viz);
  applyInspectorInitialState(viz, activeDiagram, "baseline");
  applyPhaseRestVisuals(viz, activeDiagram, "baseline", PHASE_REST);
  relabelInspector(root);

  const responseComparison = buildOverallResponseComparison();
  activeResponseWire = wireResponseComparison(viz, activeDiagram, {
    flows: { baseline: responseComparison.flows.baseline },
    defaultFlowId: "baseline",
    modeButton: root.querySelector(".v2-fs-popup-toggle"),
    stepsContainer: root.querySelector(".v2-fs-steps-container"),
    inspectorRoot: root,
    cycleModes: ["popup", "panel"],
    modeKey: BASELINE_POPUP_MODE_KEY,
    modeLabels: { popup: "Popups: On", panel: "Popups: Off" },
    modeActive: (m) => m === "popup",
  });

  activeLegendHighlightWire = wireLegendHopHighlight(viz, root);

  const inspContent = root.querySelector(".v2-fs-inspector-content");
  if (inspContent) {
    new MutationObserver(() => {
      relabelInspector(root);
      scrollLayerBoardToHop(root);
    }).observe(inspContent, {
      childList: true,
      subtree: true,
    });
  }

  viz._playback?.onChange?.((event) => {
    if (event === "reset") {
      applyPhaseRestVisuals(viz, activeDiagram, "baseline", PHASE_REST);
      relabelInspector(root);
    }
    scrollLayerBoardToHop(root);
    syncLegendHopHighlight(viz, root);
    syncPlayLabel(viz, playBtn);
  });

  prevBtn?.addEventListener("click", () => goPrev());
  nextBtn?.addEventListener("click", () => goNext());
  wireOverlayClose(viz, root);

  const canvasWrap = root.querySelector(".nr-v2-baseline-canvas-wrap");
  if (canvasWrap && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => scheduleResize(viz));
    resizeObserver.observe(canvasWrap);
  }
  window.addEventListener("resize", onWindowResize);
  scheduleResize(viz);
  requestAnimationFrame(() => scheduleResize(viz));
  setTimeout(() => scheduleResize(viz), 80);
}

function onWindowResize() {
  scheduleResize(activeViz);
}

export function goNext() {
  const viz = activeViz;
  const diagram = activeDiagram;
  const root = activeContainer?.querySelector(".nr-v2-baseline-inner");
  if (!viz || !diagram) return;
  viz.closeOverlay?.();
  const shown = viz.state.currentStepDone || 0;
  if (shown >= stepCount(diagram, viz)) return;
  viz.jumpTo(shown);
  if (root) {
    scrollLayerBoardToHop(root);
    syncLegendHopHighlight(viz, root);
  }
  syncPlayLabel(viz, activeContainer?.querySelector(".v2-fs-play"));
}

export function goPrev() {
  const viz = activeViz;
  const root = activeContainer?.querySelector(".nr-v2-baseline-inner");
  if (!viz) return;
  viz.closeOverlay?.();
  const shown = viz.state.currentStepDone || 0;
  if (shown <= 0) return;
  if (shown === 1) viz.reset();
  else viz.jumpTo(shown - 2);
  applyPhaseRestVisuals(viz, activeDiagram, "baseline", PHASE_REST);
  if (root) {
    scrollLayerBoardToHop(root);
    syncLegendHopHighlight(viz, root);
  }
  syncPlayLabel(viz, activeContainer?.querySelector(".v2-fs-play"));
}

export function destroyBaselineDiagram() {
  window.removeEventListener("resize", onWindowResize);
  activeLegendHighlightWire?.teardown?.();
  activeLegendHighlightWire = null;
  activeResponseWire?.teardown?.();
  activeResponseWire = null;
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (activeViz) {
    activeViz.closeOverlay?.();
    activeViz.reset?.();
    uninstallLogoRenderer(activeViz);
    activeViz._engine?.stop?.();
    activeViz = null;
  }
  activeDiagram = null;
  activeLayout = DEFAULT_LAYOUT;
  if (activeContainer) {
    activeContainer.classList.remove("nr-v2-baseline-mounted");
    activeContainer.innerHTML = "";
    activeContainer = null;
  }
}

export function isBaselineMounted() {
  return Boolean(activeViz);
}

export function getActiveBaselineLayout() {
  return activeLayout;
}
