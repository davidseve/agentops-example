/**
 * Shared FlowStory bootstrap for per-scenario demo panels (A–D).
 */

import { FlowStory } from "../shared/vendor/flowstory.min.js";
import { setLogosEnabled } from "../shared/logo-renderer.js";
import { OVERALL_IN_DOC, syncCanvasWrapLegend } from "./overall-in-doc-resize.js";


export * from "./scenario-layout.js";
import {
  ARROW,
  BOX,
  COLORS,
  LAYER_NAMES,
  OVERALL_CANVAS,
  OVERALL_FLOW_ORDER,
  OVERALL_FLOW_SHORTCUTS,
  OVERALL_HREF,
  OVERALL_NODES,
  SCENARIO_LINKS,
  mergeResponseBodies,
  pickNodes,
} from "./scenario-layout.js";

const LAYERS_DOCK_MODES = ["right", "off", "top", "bottom"];
const IN_DOC_LAYERS_MODES = ["bottom", "off", "top"];
export const LAYERS_RIGHT_PANEL_WIDTH = 380;
const V3_STEP_SCENARIO_CANVAS_LOCK_VAR = "--nr-v3-step-scenario-canvas-locked-height";

function isV3ScenarioCanvasStep() {
  return document.body.classList.contains("nr-v3-step-scenario");
}

export function captureV3ScenarioCanvasHeight() {
  if (!isV3ScenarioCanvasStep()) return;
  const wrap = document.querySelector(".nr-v3-scenario-mounted .fs-overall-canvas-wrap");
  if (!wrap) return;
  const height = Math.round(wrap.getBoundingClientRect().height);
  if (height > 0) {
    document.documentElement.style.setProperty(V3_STEP_SCENARIO_CANVAS_LOCK_VAR, `${height}px`);
  }
}

export function releaseV3ScenarioCanvasHeight() {
  document.documentElement.style.removeProperty(V3_STEP_SCENARIO_CANVAS_LOCK_VAR);
}

/** @deprecated Use captureV3ScenarioCanvasHeight */
export const captureV3StepACanvasHeight = captureV3ScenarioCanvasHeight;

/** @deprecated Use releaseV3ScenarioCanvasHeight */
export const releaseV3StepACanvasHeight = releaseV3ScenarioCanvasHeight;

function isLayersRightMode() {
  return (
    document.body.classList.contains("fs-layers-pos-right") &&
    !document.body.classList.contains("fs-layers-ui--off")
  );
}

function getLayersPanelWidth() {
  return isLayersRightMode() ? LAYERS_RIGHT_PANEL_WIDTH : 0;
}

function readLayersDockMode() {
  const stored = localStorage.getItem(LAYERS_DOCK_MODE_KEY);
  if (LAYERS_DOCK_MODES.includes(stored)) return stored;
  return localStorage.getItem(LAYERS_DOCK_VISIBLE_KEY) === "false" ? "off" : "right";
}

function getChromeInsets() {
  const flowDock = document.getElementById("fs-top-dock");
  const layersDock = document.getElementById("fs-layers-dock");
  const off = document.body.classList.contains("fs-layers-ui--off");
  const bottom = document.body.classList.contains("fs-layers-pos-bottom");

  const flowBottom = flowDock
    ? Math.round(flowDock.getBoundingClientRect().bottom)
    : 52;

  if (off || !layersDock || isLayersRightMode()) {
    return { top: flowBottom, bottom: 0 };
  }

  if (bottom) {
    return {
      top: flowBottom,
      bottom: Math.round(layersDock.getBoundingClientRect().height),
    };
  }

  return {
    top: Math.round(layersDock.getBoundingClientRect().bottom),
    bottom: 0,
  };
}

function syncChromeInsets() {
  const flowDock = document.getElementById("fs-top-dock");
  const flowBottom = flowDock
    ? Math.round(flowDock.getBoundingClientRect().bottom)
    : 52;
  const { top, bottom } = getChromeInsets();
  document.documentElement.style.setProperty("--fs-flow-dock-offset", `${flowBottom}px`);
  document.documentElement.style.setProperty("--fs-chrome-top-offset", `${top}px`);
  document.documentElement.style.setProperty("--fs-chrome-bottom-offset", `${bottom}px`);
  document.documentElement.style.setProperty(
    "--fs-layers-right-width",
    `${LAYERS_RIGHT_PANEL_WIDTH}px`,
  );
}

let layersDockSyncRaf = 0;

/** Content-driven panel height (not the flex-sized inspector container). */
function measureLayersPanelHeight() {
  const content = document.getElementById("fs-inspector-content");
  const title = document.getElementById("fs-inspector-title");
  if (!content) return 112;
  const pad = 16;
  const titleH = title?.offsetHeight ?? 0;
  return Math.max(112, Math.ceil(titleH + content.scrollHeight + pad));
}

function scheduleSyncLayersDockHeight(viz) {
  if (layersDockSyncRaf) return;
  layersDockSyncRaf = requestAnimationFrame(() => {
    layersDockSyncRaf = 0;
    syncLayersDockHeight(viz);
  });
}

/** Equal-height Layers + Layer board; dock height = 2× layer-board content (no inspector scroll). */
function syncLayersDockHeight(viz) {
  const layersDock = document.getElementById("fs-layers-dock");
  if (!layersDock) return;

  if (document.body.classList.contains("fs-layers-ui--off")) {
    document.documentElement.style.removeProperty("--fs-layers-panel-height");
    layersDock.style.height = "";
    syncChromeInsets();
    viz?._engine?.resize?.();
    refreshScenarioHeader(viz);
    return;
  }

  if (isLayersRightMode()) {
    document.documentElement.style.removeProperty("--fs-layers-panel-height");
    layersDock.style.height = "";
    syncChromeInsets();
    viz?._engine?.resize?.();
    refreshScenarioHeader(viz);
    return;
  }

  const maxPanel = Math.floor(window.innerHeight * 0.38);
  const panelHeight = Math.min(maxPanel, measureLayersPanelHeight());
  const prev = Number.parseInt(
    document.documentElement.style.getPropertyValue("--fs-layers-panel-height"),
    10,
  );
  if (!Number.isFinite(prev) || Math.abs(prev - panelHeight) > 1) {
    document.documentElement.style.setProperty("--fs-layers-panel-height", `${panelHeight}px`);
    layersDock.style.height = "";
  }

  syncChromeInsets();
  viz?._engine?.resize?.();
  refreshScenarioHeader(viz);
}

function patchEngineLayoutForTopPanel(viz) {
  const engine = viz?._engine;
  if (!engine || engine._topPanelPatched) return;
  engine._topPanelPatched = true;
  engine.panelWidth = 0;

  engine.resize = function chromeDockResize() {
    syncChromeInsets();
    const { top, bottom } = getChromeInsets();
    const panelWidth = getLayersPanelWidth();
    this.panelWidth = panelWidth;
    this.W = this.canvas.width = innerWidth - panelWidth;
    this.H = this.canvas.height = innerHeight;
    const availH = Math.max(1, innerHeight - top - bottom);
    this._sc = Math.min(this.W / this.logicalWidth, availH / this.logicalHeight) * 0.98;
    this._ox = (this.W - this.logicalWidth * this._sc) / 2;
    this._oy = top + (availH - this.logicalHeight * this._sc) * 0.04;
    this.draw();
    syncCanvasWrapLegend(this);
  };
}

/** Flow bar on top; layers stack toggles Right → Off → Top → Bottom (v3 in-doc: off by default, no toggle). */
export function wireLayersDock(viz, options = {}) {
  const { inDocumentEmbed = false, embedRoot = null } = options;
  const stack = document.getElementById("fs-layers-stack");
  const toggle = document.getElementById("fs-layers-toggle");
  const flowDock = document.getElementById("fs-top-dock");
  const layersDock = document.getElementById("fs-layers-dock");
  if (!stack || !flowDock || !layersDock) return null;
  if (!toggle && !inDocumentEmbed) return null;

  const layoutRoot =
    embedRoot ??
    (inDocumentEmbed ? document.querySelector(OVERALL_IN_DOC.innerSelector) : null);
  const modes = inDocumentEmbed ? IN_DOC_LAYERS_MODES : LAYERS_DOCK_MODES;

  if (!inDocumentEmbed) {
    document.body.classList.add("fs-has-top-panel");
  }

  let mode = inDocumentEmbed ? "off" : readLayersDockMode();
  if (inDocumentEmbed) {
    if (mode === "right") mode = "bottom";
    if (!modes.includes(mode)) mode = "off";
  }

  function syncInDocLayout() {
    if (!layoutRoot) return;
    layoutRoot.classList.remove(
      OVERALL_IN_DOC.layersOffClass,
      OVERALL_IN_DOC.layersTopClass,
      OVERALL_IN_DOC.layersBottomClass,
    );
    if (mode === "off") layoutRoot.classList.add(OVERALL_IN_DOC.layersOffClass);
    else if (mode === "top") layoutRoot.classList.add(OVERALL_IN_DOC.layersTopClass);
    else layoutRoot.classList.add(OVERALL_IN_DOC.layersBottomClass);
  }

  function syncToggle() {
    if (!toggle) return;
    const labels = inDocumentEmbed
      ? {
          off: "Layers: Off",
          bottom: "Layers: Bottom",
          top: "Layers: Top",
        }
      : {
          off: "Layers: Off",
          right: "Layers: Right",
          top: "Layers: Top",
          bottom: "Layers: Bottom",
        };
    toggle.textContent = labels[mode] ?? "Layers";
    toggle.classList.toggle("fs-layers-toggle--right", !inDocumentEmbed && mode === "right");
    toggle.classList.toggle("fs-layers-toggle--top", mode === "top");
    toggle.classList.toggle("fs-layers-toggle--bottom", mode === "bottom");
    toggle.classList.toggle("fs-layers-toggle--on", mode !== "off");
    toggle.setAttribute("aria-pressed", mode !== "off" ? "true" : "false");
  }

  function apply() {
    if (inDocumentEmbed && mode === "off" && isV3ScenarioCanvasStep()) {
      releaseV3ScenarioCanvasHeight();
    }
    document.body.classList.toggle("fs-layers-ui--off", mode === "off");
    document.body.classList.toggle("fs-layers-pos-right", !inDocumentEmbed && mode === "right");
    document.body.classList.toggle("fs-layers-pos-top", mode === "top");
    document.body.classList.toggle(
      "fs-layers-pos-bottom",
      inDocumentEmbed ? mode === "bottom" : mode === "bottom",
    );
    if (inDocumentEmbed) syncInDocLayout();
    stack.hidden = mode === "off";
    stack.setAttribute("aria-hidden", mode === "off" ? "true" : "false");
    layersDock.hidden = mode === "off";
    layersDock.setAttribute("aria-hidden", mode === "off" ? "true" : "false");
    syncToggle();
    localStorage.setItem(LAYERS_DOCK_MODE_KEY, mode);
    localStorage.setItem(LAYERS_DOCK_VISIBLE_KEY, mode === "off" ? "false" : "true");
    scheduleSyncLayersDockHeight(viz);
    refreshScenarioHeader(viz);
    document.dispatchEvent(
      new CustomEvent("nr:layers-mode-change", {
        bubbles: true,
        detail: { mode, visible: mode !== "off" },
      }),
    );
  }

  toggle?.addEventListener("click", () => {
    const prevMode = mode;
    const idx = modes.indexOf(mode);
    mode = modes[(idx + 1) % modes.length];
    if (
      inDocumentEmbed &&
      prevMode === "off" &&
      mode !== "off" &&
      isV3ScenarioCanvasStep()
    ) {
      captureV3ScenarioCanvasHeight();
    }
    apply();
  });

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => scheduleSyncLayersDockHeight(viz));
    ro.observe(flowDock);
    const content = document.getElementById("fs-inspector-content");
    if (content) ro.observe(content);
  }

  apply();
  return {
    setMode: (next) => {
      if (LAYERS_DOCK_MODES.includes(next)) {
        mode = next;
        apply();
      }
    },
  };
}

/** Align fixed title/tagline + scenario nav with the main container center on canvas. */
export function syncScenarioHeaderLayout(viz) {
  const engine = viz?._engine;
  const nodes = viz?.state?.nodes;
  const canvas = viz?._canvas || document.getElementById("fs-canvas");
  if (!engine?.tx || !nodes || !canvas) return;

  const box = nodes.cluster ?? nodes.openshell;
  if (!box) return;

  const rect = canvas.getBoundingClientRect();
  const centerX = rect.left + engine.tx(box.x + box.w / 2);
  const left = `${Math.round(centerX)}px`;

  for (const el of [
    document.getElementById("fs-header-stack"),
    document.querySelector(".fs-scenario-nav"),
  ]) {
    if (!el) continue;
    el.style.left = left;
    el.style.transform = "translateX(-50%)";
  }
}

const LAYER_BOARD_TITLE_DEFAULT = "Layer board";

/** Keep the layer-board panel title fixed (layers-logos.html behaviour). */
function relabelLayerBoardTitle() {
  const title = document.getElementById("fs-inspector-title");
  if (!title || title.textContent === LAYER_BOARD_TITLE_DEFAULT) return;
  title.textContent = LAYER_BOARD_TITLE_DEFAULT;
  title.style.color = "var(--fs-accent, #58a6ff)";
}

/** Stop FlowStory from overwriting the layer-board title with Request/Response. */
function patchInspectorLayerBoardTitle(viz) {
  const inspector = viz?._inspector;
  if (!inspector || inspector._layerBoardTitlePatched) return;
  inspector._layerBoardTitlePatched = true;

  inspector.setPhase = function setPhase(phase) {
    this._phase = phase;
  };

  const origRender = inspector.render.bind(inspector);
  inspector.render = function render() {
    origRender();
    relabelInspector();
    if (document.getElementById("fs-top-dock")) {
      scheduleSyncLayersDockHeight(viz);
    }
  };
}

export function refreshScenarioHeader(viz) {
  viz._origUpdateFlowLabel?.call(viz);
  relabelLayerBoardTitle();
  syncScenarioHeaderLayout(viz);
}

function wireLayerBoardTitle(viz) {
  patchInspectorLayerBoardTitle(viz);
  viz._origUpdateFlowLabel = viz._updateFlowLabel.bind(viz);
  viz._updateFlowLabel = () => refreshScenarioHeader(viz);
  relabelLayerBoardTitle();

  const titleEl = document.getElementById("fs-inspector-title");
  if (titleEl) {
    new MutationObserver(() => relabelLayerBoardTitle()).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
}
export const RESPONSE_MODE_KEY = "agentops-demo-response-mode-v2";
export const LAYERS_DOCK_VISIBLE_KEY = "agentops-layers-dock-visible";
export const LAYERS_DOCK_MODE_KEY = "agentops-layers-dock-mode";
export const RESPONSE_MODES = ["popup", "panel", "both"];

export function readResponseMode(storageKey = RESPONSE_MODE_KEY) {
  const stored = localStorage.getItem(storageKey);
  if (stored === "overlay") return "popup";
  return RESPONSE_MODES.includes(stored) ? stored : "panel";
}

export function writeResponseMode(mode, storageKey = RESPONSE_MODE_KEY) {
  localStorage.setItem(storageKey, mode);
}

export function syncResponseModeButton(btn, mode, labels, isActive) {
  if (!btn) return;
  const defaultLabels = {
    popup: "Msgs: Popup",
    panel: "Msgs: Panel",
    both: "Msgs: Both",
  };
  const L = labels ?? defaultLabels;
  const active = isActive ? isActive(mode) : mode !== "popup";
  btn.textContent = L[mode] ?? L.popup ?? defaultLabels.popup;
  btn.classList.toggle("fs-response-mode-on", active);
  btn.setAttribute("aria-pressed", active ? "true" : "false");
}

export function getActiveResponseMode() {
  return activeResponseMode;
}
let activeResponseMode = "panel";
let inspectorBodyLabelDefault = "Scenario";
let relabelInspectorBusy = false;

function relabelInspector(scope = document) {
  if (relabelInspectorBusy) return;
  relabelInspectorBusy = true;
  try {
    const sections =
      scope.querySelectorAll?.(".fs-inspector-section") ??
      document.querySelectorAll(".fs-inspector-section");
    sections.forEach((el) => {
      if (el.textContent === "Headers:") el.textContent = "Layers";
      const useResponses =
        activeResponseMode === "panel" || activeResponseMode === "both";
      const targetBody = useResponses ? "Responses" : inspectorBodyLabelDefault;
      const bodyLabels = new Set([
        "Body:",
        "Scenario",
        "Responses",
        inspectorBodyLabelDefault,
      ]);
      if (bodyLabels.has(el.textContent) && el.textContent !== targetBody) {
        el.textContent = targetBody;
        el.classList.toggle("fs-inspector-responses", useResponses);
      }
    });
    relabelLayerBoardTitle();
  } finally {
    relabelInspectorBusy = false;
  }
}

function mapInspectorRows(rows) {
  return (rows || []).map((p) => ({
    v: p.value || p.v,
    s: p.style || p.s || "keep",
    id: p.id,
  }));
}

function applyInspectorInitialState(diagram, flowId) {
  const insp = diagram.inspector;
  if (!insp) return;
  const viz = window.__flowstory;
  const inspector = viz?._inspector;
  if (!inspector) return;

  const state =
    insp.initialStates?.[flowId] ?? insp.initialState ?? { headers: [], body: [] };
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

function syncPlayLabel(viz) {
  const btn = document.getElementById("fs-play");
  if (!btn) return;
  const s = viz.state;
  btn.innerHTML = s.running && !s.paused ? "&#9646;&#9646; Pause" : "&#9654; Start";
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function parsePhaseHash(modeFlows) {
  if (!modeFlows) return null;
  const hash = (location.hash || "").replace(/^#/, "").toLowerCase();
  if (hash === "before" || hash === "b") return modeFlows.before;
  if (hash === "after" || hash === "a") return modeFlows.after;
  return null;
}

function updatePhaseHash(flowId, modeFlows) {
  if (!modeFlows) return;
  const hash =
    flowId === modeFlows.before
      ? "before"
      : flowId === modeFlows.after
        ? "after"
        : null;
  if (!hash) return;
  const next = `#${hash}`;
  if (location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

function syncPhaseBodyClass(flowId, modeFlows) {
  if (!modeFlows) return;
  document.body.classList.remove("fs-scenario-phase-before", "fs-scenario-phase-after");
  if (flowId === modeFlows.before) document.body.classList.add("fs-scenario-phase-before");
  if (flowId === modeFlows.after) document.body.classList.add("fs-scenario-phase-after");
}

function resetEngineNodeColors(diagram, state) {
  if (!state?.nodes || !diagram?.nodes) return;
  for (const [id, def] of Object.entries(diagram.nodes)) {
    const n = state.nodes[id];
    if (!n) continue;
    n.color = def.color;
    delete n._origColor;
  }
}

/** Apply phase idle visuals without resetting playback (FlowStory already reset on flow switch). */
export function applyPhaseRestVisuals(viz, diagram, flowId, phaseRest) {
  if (!viz?._engine?.state) return;
  const state = viz._engine.state;
  resetEngineNodeColors(diagram, state);

  const rest = phaseRest?.[flowId];
  if (!rest) {
    viz._engine.draw?.();
    return;
  }

  if (rest.glow) rest.glow.forEach((g) => state.glowing.add(g));
  if (rest.activeNodes) rest.activeNodes.forEach((n) => state.activeNodes.add(n));
  if (rest.badges) Object.assign(state.badges, rest.badges);
  if (rest.nodeColors) {
    for (const [id, color] of Object.entries(rest.nodeColors)) {
      const n = state.nodes[id];
      if (!n) continue;
      n._origColor = n._origColor || n.color;
      n.color = color;
    }
  }
  viz._engine.draw?.();
}

export function applyPhaseRestState(viz, diagram, flowId, phaseRest) {
  if (!viz?._engine?.state) return;
  viz.reset();
  applyPhaseRestVisuals(viz, diagram, flowId, phaseRest);
}

/**
 * Render scenario nav — flat links A–D; Before/After only in the right panel toggle.
 * @param {string|null} activeId — e.g. "A", "C", "D"
 * @param {{ base?: "scenarios" | "overall", inPanel?: boolean }} options
 */
export function renderScenarioNav(activeId, { base = "scenarios", inPanel = false } = {}) {
  const nav = document.querySelector(".fs-scenario-nav");
  if (!nav) return;

  const overallHref =
    base === "overall" ? "./overall-demo-architecture.html" : "../overall-demo-architecture.html";
  const prefix = base === "overall" ? "./scenarios/" : "";

  const parts = [`<a class="fs-overall-link" href="${overallHref}">Overall map</a>`];

  for (const item of SCENARIO_LINKS) {
    const cls = item.id === activeId ? "active" : "";
    if (inPanel) {
      parts.push(
        `<a class="${cls}" href="#" data-fs-flow="${item.flowId}" data-fs-nav="${item.id}">${item.label}</a>`
      );
    } else {
      const href = `${prefix}${item.href}`;
      parts.push(`<a class="${cls}" href="${href}">${item.label}</a>`);
    }
  }

  nav.innerHTML = parts.join("");
}

/** Wire nav links on overall map to switch flows in-panel (no new tab). */
export function wireOverallNav(viz, diagram, { onFlowChange } = {}) {
  const nav = document.querySelector(".fs-scenario-nav");
  if (!nav) return;

  const flowToNav = {};
  for (const item of SCENARIO_LINKS) {
    flowToNav[item.flowId] = item.id;
    if (item.id === "C") flowToNav["scenario-c-after"] = "C";
    if (item.id === "D") flowToNav["scenario-d-after"] = "D";
  }

  function syncNavActive(flowId) {
    const navId = flowToNav[flowId] ?? null;
    nav.querySelectorAll("[data-fs-nav]").forEach((el) => {
      el.classList.toggle("active", navId != null && el.getAttribute("data-fs-nav") === navId);
    });
  }

  nav.querySelectorAll("[data-fs-flow]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const flowId = link.getAttribute("data-fs-flow");
      if (!flowId || !diagram.flows[flowId]) return;
      switchScenarioFlow(viz, diagram, flowId);
      syncNavActive(flowId);
    });
  });

  onFlowChange?.(syncNavActive);
  syncNavActive(viz.state.activeFlow ?? diagram.defaultFlow);
}

function syncModeButtons(flowId, modeFlows) {
  if (!modeFlows) return;
  document.querySelectorAll("[data-fs-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-fs-mode") === flowId);
  });
}

export function switchScenarioFlow(viz, diagram, flowId) {
  const select = document.getElementById("fs-flow-select");
  if (!select || !diagram.flows[flowId]) return;
  if (select.value === flowId && viz.state?.activeFlow === flowId) return;
  select.value = flowId;
  select.dispatchEvent(new Event("change"));
}

function ensureNodePopupElement() {
  let el = document.getElementById("fs-node-popup");
  if (el) return el;
  el = document.createElement("div");
  el.id = "fs-node-popup";
  el.className = "fs-node-popup";
  el.hidden = true;
  el.setAttribute("role", "status");
  el.innerHTML = `
    <div class="fs-node-popup-inner">
      <div class="fs-node-popup-accent"></div>
      <div class="fs-node-popup-title"></div>
      <div class="fs-node-popup-lines"></div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function hideNodePopup() {
  const el = document.getElementById("fs-node-popup");
  if (!el) return;
  el.hidden = true;
  el.style.display = "none";
}

/** In-document embed: FlowStory positions #fs-highlight-box in canvas-local px (fullscreen assumption). */
function applyInDocHighlightViewport(viz, node) {
  const box = document.getElementById("fs-highlight-box");
  const canvas = viz._canvas || document.getElementById("fs-canvas");
  const engine = viz._engine;
  if (!box || !canvas || !engine?.tx || !engine?.ty || !engine?.ts || !node) return;

  const rect = canvas.getBoundingClientRect();
  box.style.left = `${Math.round(rect.left + engine.tx(node.x))}px`;
  box.style.top = `${Math.round(rect.top + engine.ty(node.y))}px`;
  box.style.width = `${Math.round(engine.ts(node.w))}px`;
  box.style.height = `${Math.round(engine.ts(node.h))}px`;
}

function syncInDocHighlightIfOpen(viz) {
  const overlay = viz._overlay;
  const box = document.getElementById("fs-highlight-box");
  if (!overlay?.highlightKey || !box || box.style.display === "none") return;
  const node = viz.state?.nodes?.[overlay.highlightKey];
  if (!node) return;
  applyInDocHighlightViewport(viz, node);
}

function suppressInDocOverlayBackdrop(overlay) {
  const backdrop = overlay?._dom?.overlay;
  if (backdrop) backdrop.style.display = "none";
}

/**
 * Fix node highlight ring in v3 in-card / in-doc embeds without changing layout CSS.
 * Keeps the highlight box; suppresses the fullscreen overlay backdrop only.
 */
export function wireInDocHighlightOverlay(viz, { signal } = {}) {
  const overlay = viz._overlay;
  if (!overlay || overlay._inDocHighlightPatched) return () => {};
  overlay._inDocHighlightPatched = true;

  const origShow = overlay.show.bind(overlay);
  overlay.show = (nodeId, node, tooltip, ctx) => {
    origShow(nodeId, node, tooltip, ctx);
    if (node) applyInDocHighlightViewport(viz, node);
    suppressInDocOverlayBackdrop(overlay);
  };

  const sync = () => syncInDocHighlightIfOpen(viz);
  window.addEventListener("resize", sync, { passive: true, signal });

  const mainEl = document.querySelector(".nr-main");
  mainEl?.addEventListener("scroll", sync, { passive: true, signal });

  let resizeObserver = null;
  const canvas = viz._canvas || document.getElementById("fs-canvas");
  const wrap = canvas?.closest?.(".fs-overall-canvas-wrap");
  if (typeof ResizeObserver !== "undefined" && wrap) {
    resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(wrap);
  }

  return () => {
    resizeObserver?.disconnect();
    overlay.show = origShow;
    overlay._inDocHighlightPatched = false;
  };
}

function positionNodePopup(viz, node, el) {
  const engine = viz._engine;
  const canvas = viz._canvas || document.getElementById("fs-canvas");
  if (!engine?.tx || !engine?.ty || !canvas || !node || !el) return;

  const rect = canvas.getBoundingClientRect();
  const nodeRight = rect.left + engine.tx(node.x + node.w);
  const nodeLeft = rect.left + engine.tx(node.x);
  const nodeCenterY = rect.top + engine.ty(node.y + node.h / 2);
  const margin = 14;
  const popupW = el.offsetWidth || 280;

  let left = nodeRight + margin;
  let transform = "translateY(-50%)";

  if (left + popupW > window.innerWidth - 16) {
    left = nodeLeft - margin;
    transform = "translate(-100%, -50%)";
  }

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(nodeCenterY)}px`;
  el.style.transform = transform;
}

function showNodePopup(viz, diagram, cfg, lines) {
  const el = ensureNodePopupElement();
  const node = diagram.nodes?.[cfg.node];
  if (!node) {
    hideNodePopup();
    return;
  }

  const titleEl = el.querySelector(".fs-node-popup-title");
  const linesEl = el.querySelector(".fs-node-popup-lines");
  const accentEl = el.querySelector(".fs-node-popup-accent");
  if (titleEl) titleEl.textContent = cfg.title ?? "";
  if (accentEl) accentEl.style.background = cfg.color ?? "#58a6ff";
  if (linesEl) {
    linesEl.replaceChildren();
    for (const line of lines ?? []) {
      const row = document.createElement("div");
      row.className = "fs-node-popup-line";
      row.textContent = line;
      linesEl.appendChild(row);
    }
  }

  el.hidden = false;
  el.style.display = "block";
  requestAnimationFrame(() => {
    positionNodePopup(viz, node, el);
    requestAnimationFrame(() => positionNodePopup(viz, node, el));
  });
}

export function wireResponseComparison(viz, diagram, config) {
  const isMulti = config.flows != null;
  let activeFlowId = isMulti
    ? config.defaultFlowId ?? Object.keys(config.flows)[0]
    : config.flowId;

  function flowConfig(flowId = activeFlowId) {
    if (isMulti) return config.flows?.[flowId];
    return config;
  }

  const initialFc = flowConfig();
  if (!initialFc?.baseMutations || !initialFc?.mergedMutations) return null;
  if (!isMulti && !config.flowId) return null;

  const cycleModes = config.cycleModes ?? RESPONSE_MODES;
  const inspectorRoot = config.inspectorRoot ?? document;
  const modeLabels = config.modeLabels;
  const modeActive = config.modeActive;

  const modeBtn = config.modeButton ?? document.getElementById("fs-response-mode");

  function resolveMode() {
    if (modeBtn) {
      let m = readResponseMode(config.modeKey ?? RESPONSE_MODE_KEY);
      if (!cycleModes.includes(m)) m = cycleModes[0];
      return m;
    }
    return config.fixedMode ?? "panel";
  }

  let mode = resolveMode();
  activeResponseMode = mode;

  const syncModeBtn = () =>
    syncResponseModeButton(modeBtn, mode, modeLabels, modeActive);

  syncModeBtn();

  function mutationsForMode(m, fc) {
    return m === "popup" ? fc.baseMutations : fc.mergedMutations;
  }

  function applyMutationSet() {
    const fc = flowConfig();
    if (!fc || !diagram.inspector?.mutations) return;
    diagram.inspector.mutations[activeFlowId] = mutationsForMode(mode, fc);
  }

  function refreshPopup() {
    if (mode === "popup" || mode === "both") {
      showPopupForStep(viz.state.currentStepDone || 0);
    } else {
      hideNodePopup();
    }
  }

  function showPopupForStep(stepOneBased) {
    const fc = flowConfig();
    if (!fc) return;
    if (mode === "panel") {
      hideNodePopup();
      viz.closeOverlay?.();
      return;
    }
    const overlays = fc.overlays ?? {};
    const responseMap = fc.responseMap ?? {};
    const cfg = overlays[stepOneBased];
    if (!cfg) {
      hideNodePopup();
      viz.closeOverlay?.();
      return;
    }
    showNodePopup(viz, diagram, cfg, responseMap[stepOneBased]);
  }

  function syncStepPresentation(stepOneBased) {
    activeResponseMode = mode;
    applyMutationSet();
    if (stepOneBased > 0 && viz._inspector?.step) {
      viz._inspector.step(stepOneBased);
    }
    relabelInspector(inspectorRoot);
    refreshPopup();
    refreshScenarioHeader(viz);
  }

  function onFlowChange(flowId) {
    activeFlowId = flowId;
    hideNodePopup();
    viz.closeOverlay?.();
    const step = viz.state.currentStepDone || 0;
    syncStepPresentation(step);
  }

  applyMutationSet();

  const stepsContainer =
    config.stepsContainer ?? document.getElementById("fs-steps-container");
  if (stepsContainer) {
    const syncPopupFromActiveStep = () => {
      const active = stepsContainer.querySelector(".fs-step.active");
      if (!active?.id?.startsWith("step-")) {
        refreshPopup();
        return;
      }
      const idx = Number.parseInt(active.id.slice(5), 10);
      if (Number.isNaN(idx)) {
        refreshPopup();
        return;
      }
      const stepOneBased = idx + 1;
      if (mode === "popup" || mode === "both") {
        showPopupForStep(stepOneBased);
      } else {
        hideNodePopup();
      }
    };
    new MutationObserver(syncPopupFromActiveStep).observe(stepsContainer, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  if (typeof viz.jumpTo === "function") {
    const origJumpTo = viz.jumpTo.bind(viz);
    viz.jumpTo = (idx) => {
      origJumpTo(idx);
      syncPlayLabel(viz);
      requestAnimationFrame(() => {
        refreshPopup();
        refreshScenarioHeader(viz);
      });
    };
  }

  modeBtn?.addEventListener("click", () => {
    const idx = cycleModes.indexOf(mode);
    mode = cycleModes[(idx + 1) % cycleModes.length];
    writeResponseMode(mode, config.modeKey ?? RESPONSE_MODE_KEY);
    syncModeBtn();
    const step = viz.state.currentStepDone || 0;
    syncStepPresentation(step);
  });

  viz._playback?.onChange?.((event) => {
    if (event === "reset") {
      mode = resolveMode();
      activeResponseMode = mode;
      syncModeBtn();
      applyMutationSet();
      hideNodePopup();
      viz.closeOverlay?.();
      relabelInspector(inspectorRoot);
      refreshScenarioHeader(viz);
    }
  });

  const onResizePopup = () => {
    const step = viz.state.currentStepDone || 0;
    if (step > 0 && (mode === "popup" || mode === "both")) {
      showPopupForStep(step);
    }
  };
  window.addEventListener("resize", onResizePopup, { passive: true });

  return {
    syncStepPresentation,
    refreshPopup,
    hideNodePopup,
    onFlowChange,
    teardown: () => {
      window.removeEventListener("resize", onResizePopup);
      hideNodePopup();
    },
  };
}

/** FlowStory requires badge on lightup steps; empty string satisfies validator without drawing a label. */
export function normalizeLightupBadges(diagram) {
  for (const flow of Object.values(diagram.flows ?? {})) {
    for (const step of flow.steps ?? []) {
      if (step.mode === "lightup" && step.badge === undefined) {
        step.badge = "";
      }
    }
  }
  return diagram;
}

const SCENARIO_BODY_LAYOUT_CLASSES = [
  "fs-has-top-panel",
  "fs-layers-ui--off",
  "fs-layers-pos-right",
  "fs-layers-pos-top",
  "fs-layers-pos-bottom",
  "fs-scenario-phase-before",
  "fs-scenario-phase-after",
];

let scenarioDiagramSession = null;
let scenarioDiagramInitGeneration = 0;

function abandonStaleScenarioViz(viz) {
  if (!viz) return;
  viz.closeOverlay?.();
  viz._engine?.stop?.();
  if (window.__flowstory === viz) {
    window.__flowstory = null;
  }
}

/** Remove FlowStory layout classes from body (e.g. after v3 overall embed teardown). */
export function stripScenarioDiagramBodyClasses() {
  for (const cls of SCENARIO_BODY_LAYOUT_CLASSES) {
    document.body.classList.remove(cls);
  }
  releaseV3ScenarioCanvasHeight();
}

/** Tear down window listeners and viz state from a prior initScenarioDiagram call. */
export function disposeScenarioDiagramSession() {
  if (scenarioDiagramSession) {
    scenarioDiagramSession.dispose();
    scenarioDiagramSession = null;
  }
  scenarioDiagramInitGeneration += 1;
}

export async function initScenarioDiagram(diagram, options = {}) {
  disposeScenarioDiagramSession();
  const initGeneration = scenarioDiagramInitGeneration;
  const sessionAc = new AbortController();
  const { signal } = sessionAc;
  let inspObserver = null;
  let inDocHighlightTeardown = null;
  const {
    headerTitle,
    tagline = "Your Agent. Our Platform. Production-Ready.",
    modeFlows = null,
    phaseRest = null,
    defaultMode = diagram.defaultFlow,
    showFlowSelect = Boolean(modeFlows),
    responseComparison = null,
    activeNavId = null,
    navBase = "scenarios",
    renderNav = null,
    overallNav = false,
    flowShortcuts = null,
    inspectorBodyLabelDefault: bodyLabelDefault = "Scenario",
    inDocumentEmbed = false,
    prepareInDocumentResize = null,
    embedRootSelector = null,
    embedRootElement = null,
  } = options;

  inspectorBodyLabelDefault = bodyLabelDefault;

  if (renderNav) {
    renderScenarioNav(activeNavId ?? null, {
      base: renderNav.base ?? navBase,
      inPanel: Boolean(renderNav.inPanel ?? overallNav),
    });
  } else if (activeNavId) {
    renderScenarioNav(activeNavId, { base: navBase });
  }

  const viz = new FlowStory(document.getElementById("fs-canvas"), {
    panelElement: document.querySelector(".fs-panel"),
    stepsContainer: document.getElementById("fs-steps-container"),
    inspectorTitle: document.getElementById("fs-inspector-title"),
    inspectorContent: document.getElementById("fs-inspector-content"),
    overlay: document.getElementById("fs-overlay"),
    overlayCard: document.getElementById("fs-overlay-card"),
    overlayTitle: document.getElementById("fs-overlay-title"),
    overlayDesc: document.getElementById("fs-overlay-desc"),
    overlayDetails: document.getElementById("fs-overlay-details"),
    overlayAccent: document.getElementById("fs-overlay-accent"),
    overlayClose: document.getElementById("fs-overlay-close"),
    overlayResume: document.getElementById("fs-overlay-resume"),
    highlightBox: document.getElementById("fs-highlight-box"),
    brand: document.getElementById("fs-brand"),
    title: document.getElementById("fs-title"),
    legend: document.getElementById("fs-legend"),
    flowSelect: document.getElementById("fs-flow-select"),
    playBtn: document.getElementById("fs-play"),
    speedBtn: document.getElementById("fs-speed"),
    loopBtn: document.getElementById("fs-loop"),
    resetBtn: document.getElementById("fs-reset"),
    themeBtn: document.getElementById("fs-theme"),
  });

  window.__flowstory = viz;

  if (inDocumentEmbed && typeof prepareInDocumentResize === "function") {
    const onAfterDraw =
      phaseRest != null
        ? () => {
            const flowId = viz.state.activeFlow ?? diagram.defaultFlow;
            applyPhaseRestVisuals(viz, diagram, flowId, phaseRest);
          }
        : undefined;
    prepareInDocumentResize(viz, { onAfterDraw });
  }

  if (document.getElementById("fs-top-dock") && !inDocumentEmbed) {
    patchEngineLayoutForTopPanel(viz);
    syncChromeInsets();
  }

  const titleEl = document.getElementById("fs-title");
  if (titleEl && headerTitle) titleEl.textContent = headerTitle;
  const taglineEl = document.getElementById("fs-tagline");
  if (taglineEl) taglineEl.textContent = tagline;

  function goNext() {
    viz.closeOverlay?.();
    const shown = viz.state.currentStepDone || 0;
    if (shown >= stepCount(diagram, viz)) return;
    viz.jumpTo(shown);
    syncPlayLabel(viz);
    refreshScenarioHeader(viz);
  }

  function goPrev() {
    viz.closeOverlay?.();
    const shown = viz.state.currentStepDone || 0;
    if (shown <= 0) return;
    if (shown === 1) viz.reset();
    else viz.jumpTo(shown - 2);
    syncPlayLabel(viz);
    refreshScenarioHeader(viz);
  }

  normalizeLightupBadges(diagram);
  await viz.load(diagram);
  if (inDocumentEmbed) {
    inDocHighlightTeardown = wireInDocHighlightOverlay(viz, { signal });
  }
  relabelInspector();
  wireLayersDock(viz, {
    inDocumentEmbed,
    embedRoot:
      embedRootElement ??
      (embedRootSelector ? document.querySelector(embedRootSelector) : null),
  });
  wireLayerBoardTitle(viz);
  refreshScenarioHeader(viz);
  window.addEventListener("resize", () => refreshScenarioHeader(viz), {
    passive: true,
    signal,
  });

  const responseWire = responseComparison
    ? wireResponseComparison(viz, diagram, responseComparison)
    : null;

  const flowSelect = document.getElementById("fs-flow-select");
  if (flowSelect) {
    flowSelect.style.display = showFlowSelect ? "" : "none";
  }

  await setLogosEnabled(viz, true);

  let syncNavFromFlow = null;

  function syncFlowPanel(flowId) {
    if (!diagram.flows[flowId]) return;
    applyInspectorInitialState(diagram, flowId);
    syncModeButtons(flowId, modeFlows);
    syncPhaseBodyClass(flowId, modeFlows);
    updatePhaseHash(flowId, modeFlows);
    applyPhaseRestVisuals(viz, diagram, flowId, phaseRest);
    responseWire?.onFlowChange?.(flowId);
    syncNavFromFlow?.(flowId);
    viz.closeOverlay?.();
    syncPlayLabel(viz);
    refreshScenarioHeader(viz);
    scheduleSyncLayersDockHeight(viz);
  }

  const modeToggle = document.getElementById("fs-mode-toggle");
  if (modeFlows && modeToggle) {
    modeToggle.hidden = false;
    document.querySelectorAll("[data-fs-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchScenarioFlow(viz, diagram, btn.getAttribute("data-fs-mode"));
      });
    });
  }

  const hashFlow = parsePhaseHash(modeFlows);
  const initialFlow = hashFlow ?? defaultMode ?? diagram.defaultFlow;

  if (modeFlows) {
    const wasActive = viz.state.activeFlow;
    switchScenarioFlow(viz, diagram, initialFlow);
    if (wasActive === initialFlow) syncFlowPanel(initialFlow);
  } else if (showFlowSelect) {
    switchScenarioFlow(viz, diagram, initialFlow);
    syncFlowPanel(initialFlow);
  } else {
    applyInspectorInitialState(diagram, diagram.defaultFlow);
    if (phaseRest) {
      applyPhaseRestVisuals(viz, diagram, diagram.defaultFlow, phaseRest);
    }
  }

  if (modeFlows) {
    window.addEventListener(
      "hashchange",
      () => {
        const flowId = parsePhaseHash(modeFlows);
        if (flowId && flowId !== viz.state.activeFlow) {
          switchScenarioFlow(viz, diagram, flowId);
        }
      },
      { signal }
    );
  }

  document.getElementById("fs-next")?.addEventListener("click", goNext);
  document.getElementById("fs-prev")?.addEventListener("click", goPrev);

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;

      if (modeFlows) {
        if (e.key === "1" || e.key === "b" || e.key === "B") {
          e.preventDefault();
          switchScenarioFlow(viz, diagram, modeFlows.before);
          return;
        }
        if (e.key === "2" || e.key === "a" || e.key === "A") {
          e.preventDefault();
          switchScenarioFlow(viz, diagram, modeFlows.after);
          return;
        }
      } else if (flowShortcuts?.[e.key] && diagram.flows[flowShortcuts[e.key]]) {
        e.preventDefault();
        switchScenarioFlow(viz, diagram, flowShortcuts[e.key]);
        return;
      }

      const nextKeys = new Set([
        "ArrowRight",
        "ArrowDown",
        "PageDown",
        " ",
        "Spacebar",
        "Enter",
        ".",
        "n",
        "N",
      ]);
      const prevKeys = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"]);
      if (nextKeys.has(e.key) || e.code === "Space") {
        e.preventDefault();
        goNext();
      } else if (prevKeys.has(e.key)) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        viz.closeOverlay?.();
        viz.reset();
        syncPlayLabel(viz);
        responseWire?.syncStepPresentation?.(0);
        refreshScenarioHeader(viz);
      } else if (e.key === "End") {
        e.preventDefault();
        viz.closeOverlay?.();
        viz.jumpTo(stepCount(diagram, viz) - 1);
        syncPlayLabel(viz);
        refreshScenarioHeader(viz);
      }
    },
    { capture: true, signal }
  );

  const insp = document.getElementById("fs-inspector-content");
  if (insp) {
    inspObserver = new MutationObserver(() => relabelInspector());
    inspObserver.observe(insp, {
      childList: true,
      subtree: true,
    });
  }

  viz._playback?.onChange?.((event) => {
    if (event === "flow") {
      syncFlowPanel(viz.state.activeFlow);
    }
    if (event === "reset" && phaseRest) {
      applyPhaseRestVisuals(viz, diagram, viz.state.activeFlow, phaseRest);
    }
  });

  const flowSelectEl = document.getElementById("fs-flow-select");
  flowSelectEl?.addEventListener("change", () => {
    syncFlowPanel(flowSelectEl.value);
  });

  if (overallNav) {
    wireOverallNav(viz, diagram, {
      onFlowChange: (fn) => {
        syncNavFromFlow = fn;
      },
    });
  }

  if (initGeneration !== scenarioDiagramInitGeneration) {
    abandonStaleScenarioViz(viz);
    return viz;
  }

  scenarioDiagramSession = {
    viz,
    dispose() {
      inDocHighlightTeardown?.();
      inDocHighlightTeardown = null;
      sessionAc.abort();
      inspObserver?.disconnect();
      responseWire?.teardown?.();
      viz.closeOverlay?.();
      viz._engine?.stop?.();
      stripScenarioDiagramBodyClasses();
      if (window.__flowstory === viz) {
        window.__flowstory = null;
      }
    },
  };

  return viz;
}

export function scenarioPageShell({ title, activeScenario }) {
  const nav = SCENARIO_LINKS.map((s) => {
    const cls = s.id === activeScenario ? "active" : "";
    return `<a class="${cls}" href="${s.href}">${s.label}</a>`;
  }).join("");

  return {
    title,
    scenarioNav: nav,
  };
}
