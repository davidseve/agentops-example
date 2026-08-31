/**
 * Shared FlowStory bootstrap for per-scenario demo panels (A–D).
 */

import { FlowStory } from "../shared/vendor/flowstory.min.js";
import { setLogosEnabled } from "../shared/logo-renderer.js";

export const LAYER_NAMES = {
  endUser: "End user",
  controlUI: "Control UI",
  openClaw: "OpenClaw",
  harness: "BYOA harness",
  gw: "OpenShell Gateway",
  ir: "inference.local",
  nemo: "NeMo Guardrails",
  maas: "MaaS",
  llm: "LLM",
  mlflow: "MLflow",
  internet: "Internet",
  landlock: "Landlock",
};

export const COLORS = {
  platform: "#58a6ff",
  secure: "#3fb950",
  warn: "#d29922",
  risk: "#f78166",
  denied: "#f85149",
  landlock: "#c9d1d9",
  nemo: "#2dd4bf",
  maas: "#3fb950",
  gw: "#1f6feb",
  oc: "#f0883e",
  dim: "#484f58",
  trace: "#e3b341",
  sandbox: "#d2a8ff",
  endUser: "#79c0ff",
};

export const BOX = { w: 148, h: 50 };

/** Layout grid — must match overall-demo-architecture.html */
export const COL_L = 292;
export const COL_R = 512;
export const INNER_W = COL_R + BOX.w - COL_L;
export const CONTAINER_PAD = 16;
export const SHELL_PAD = 16;
export const CONTENT_L = COL_L - CONTAINER_PAD;
export const CONTENT_R = CONTENT_L + INNER_W + 2 * CONTAINER_PAD;
export const OPENSHELL_X = CONTENT_L - SHELL_PAD;
export const OPENSHELL_W = CONTENT_R - CONTENT_L + 2 * SHELL_PAD;
export const CLUSTER_PAD = 16;
export const CLUSTER_X = OPENSHELL_X - CLUSTER_PAD;
export const CLUSTER_W = OPENSHELL_W + 2 * CLUSTER_PAD;

export const OVERALL_CANVAS = { width: 820, height: 740 };
/** @deprecated use OVERALL_CANVAS */
export const CANVAS = OVERALL_CANVAS;

const NODE_FS = 12;

/** Node positions aligned with overall-demo-architecture.html */
export const OVERALL_NODES = {
  cluster: {
    x: CLUSTER_X,
    y: 48,
    w: CLUSTER_W,
    h: 668,
    type: "boundary",
    label: "OpenShift + RHOAI",
    labelAlign: "left",
    labelColor: "#8b949e",
  },
  openshell: {
    x: OPENSHELL_X,
    y: 88,
    w: OPENSHELL_W,
    h: 328,
    type: "container",
    label: "OpenShell",
    color: COLORS.platform,
  },
  agentsb: {
    x: CONTENT_L,
    y: 124,
    w: CONTENT_R - CONTENT_L,
    h: 108,
    type: "container",
    label: "Agent Sandbox",
    color: COLORS.sandbox,
  },
  oc: {
    x: COL_L,
    y: 156,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.openClaw,
    sublabel: LAYER_NAMES.harness,
    color: COLORS.oc,
    fontSize: NODE_FS,
  },
  landlock: {
    x: COL_R,
    y: 156,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.landlock,
    sublabel: "files locked",
    color: "#8b949e",
    fontSize: NODE_FS,
  },
  ir: {
    x: COL_R,
    y: 240,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.ir,
    sublabel: "router injects key",
    color: COLORS.platform,
    fontSize: NODE_FS,
  },
  gw: {
    x: COL_L,
    y: 324,
    w: INNER_W,
    h: BOX.h,
    label: LAYER_NAMES.gw,
    sublabel: "all outbound",
    color: COLORS.gw,
    fontSize: NODE_FS,
  },
  nemo: {
    x: COL_R,
    y: 436,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.nemo,
    sublabel: "TrustyAI · RHOAI",
    color: COLORS.nemo,
    fontSize: NODE_FS,
  },
  maas: {
    x: COL_R,
    y: 528,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.maas,
    sublabel: "RHOAI",
    color: COLORS.maas,
    fontSize: NODE_FS,
  },
  llm: {
    x: COL_R,
    y: 620,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.llm,
    sublabel: "the model",
    color: "#7ee787",
    fontSize: NODE_FS,
    stackCount: 2,
    stackOffset: { dx: 8, dy: -7 },
  },
  mlflow: {
    x: COL_L,
    y: 436,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.mlflow,
    sublabel: "traces · RHOAI",
    color: COLORS.trace,
    fontSize: NODE_FS,
  },
  internet: {
    x: 40,
    y: 528,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.internet,
    sublabel: "public egress",
    color: COLORS.risk,
    fontSize: NODE_FS,
  },
  user: {
    x: 40,
    y: 324,
    w: BOX.w,
    h: BOX.h,
    label: LAYER_NAMES.endUser,
    sublabel: LAYER_NAMES.controlUI,
    color: COLORS.endUser,
    fontSize: NODE_FS,
  },
};

/** Pick nodes from the overall layout with optional per-id overrides */
export function pickNodes(keys, overrides = {}) {
  const nodes = {};
  const orderedKeys =
    keys.includes("openshell") && !keys.includes("cluster")
      ? ["cluster", ...keys]
      : keys;
  for (const key of orderedKeys) {
    const base = OVERALL_NODES[key];
    if (!base) continue;
    nodes[key] = { ...base, ...(overrides[key] || {}) };
  }
  return nodes;
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

/** Arrow routing offsets from overall-demo-architecture.html */
export const ARROW = {
  userToGw: { fromRight: true, toLeft: true, yOff: -10 },
  gwToOc: {
    fromTop: true,
    toBottom: true,
    fromXOff: -224,
    toXOff: -66,
    glow: "openshell",
  },
  ocToGwReply: {
    fromBottom: true,
    toTop: true,
    fromXOff: -36,
    toXOff: -194,
    glow: "openshell",
  },
  gwToUser: { fromLeft: true, toRight: true, yOff: 10 },
  ocToIr: { fromRight: true, toLeft: true, yOff: -6, glow: "openshell" },
  irToGw: { fromBottom: true, toTop: true, fromXOff: 0, toXOff: 62, glow: "openshell" },
  gwToIr: {
    fromTop: true,
    toBottom: true,
    fromXOff: 74,
    toXOff: 12,
    glow: "openshell",
  },
  irToOc: { fromLeft: true, toRight: true, yOff: 6, glow: "openshell" },
  ocToLandlock: { fromRight: true, toLeft: true, yOff: -14, glow: "agentsb" },
  landlockToOc: { fromLeft: true, toRight: true, yOff: 6, glow: "agentsb" },
  ocToGw: { fromBottom: true, toTop: true, fromXOff: 2, toXOff: -156, glow: "openshell" },
  gwToInternet: { fromBottom: true, toTop: true, fromXOff: -234, toXOff: 0 },
  internetToGw: { fromTop: true, toBottom: true, fromXOff: 0, toXOff: -220 },
  gwToOcReturn: {
    fromTop: true,
    toBottom: true,
    fromXOff: -118,
    toXOff: 40,
    glow: "openshell",
  },
  gwToNemo: { fromBottom: true, toTop: true, fromXOff: 50, toXOff: -12 },
  nemoToMaas: { fromBottom: true, toTop: true, fromXOff: -12, toXOff: -12 },
  irToMaas: { fromBottom: true, toTop: true, fromXOff: -12, toXOff: -12 },
  irToNemo: { fromBottom: true, toTop: true, fromXOff: -12, toXOff: -12 },
  gwToMaas: { fromBottom: true, toTop: true, fromXOff: 50, toXOff: -12 },
  maasToLlm: { fromBottom: true, toTop: true, fromXOff: -12, toXOff: -12 },
  llmToMaas: { fromTop: true, toBottom: true, fromXOff: 12, toXOff: 12 },
  ocToGwTrace: {
    fromBottom: true,
    toTop: true,
    fromXOff: 78,
    toXOff: -80,
    glow: "openshell",
  },
  gwToMlflow: { fromBottom: true, toTop: true, fromXOff: -158, toXOff: 0 },
  /** Direct trace export — mlflow_direct policy (sandbox → MLflow, no gateway hop). */
  ocToMlflow: {
    fromBottom: true,
    toTop: true,
    fromXOff: -36,
    toXOff: 36,
    glow: "openshell",
  },
};

/** FlowStory band styling for background MLflow trace hops. */
export const TRACE_STEP_STYLE = { color: COLORS.trace, num: 4 };

export const SCENARIO_LINKS = [
  {
    id: "A",
    label: "A · Credentials",
    href: "test-a-credentials.html",
    flowId: "scenario-a",
    navGroup: "A",
  },
  {
    id: "B",
    label: "B · Files",
    href: "test-b-files.html",
    flowId: "scenario-b",
    navGroup: "B",
  },
  {
    id: "C",
    label: "C · Egress",
    href: "test-c-egress.html",
    flowId: "scenario-c-before",
    navGroup: "C",
  },
  {
    id: "D",
    label: "D · Guardrails",
    href: "test-d-guardrails.html",
    flowId: "scenario-d-before",
    navGroup: "D",
  },
];

export const OVERALL_FLOW_ORDER = [
  "baseline",
  "scenario-a",
  "scenario-b",
  "scenario-c-before",
  "scenario-c-after",
  "scenario-d-before",
  "scenario-d-after",
];

export const OVERALL_FLOW_SHORTCUTS = {
  "0": "baseline",
  a: "scenario-a",
  A: "scenario-a",
  b: "scenario-b",
  B: "scenario-b",
  c: "scenario-c-before",
  C: "scenario-c-before",
  d: "scenario-d-before",
  D: "scenario-d-before",
};

export const OVERALL_HREF = "../overall-demo-architecture.html";

export const RESPONSE_MODE_KEY = "agentops-demo-response-mode-v2";
export const RESPONSE_MODES = ["popup", "panel", "both"];

export function readResponseMode(storageKey = RESPONSE_MODE_KEY) {
  const stored = localStorage.getItem(storageKey);
  if (stored === "overlay") return "popup";
  return RESPONSE_MODES.includes(stored) ? stored : "popup";
}

export function writeResponseMode(mode, storageKey = RESPONSE_MODE_KEY) {
  localStorage.setItem(storageKey, mode);
}

export function syncResponseModeButton(btn, mode) {
  if (!btn) return;
  const labels = {
    popup: "Msgs: Popup",
    panel: "Msgs: Panel",
    both: "Msgs: Both",
  };
  btn.textContent = labels[mode] ?? labels.popup;
  btn.classList.toggle("fs-response-mode-on", mode !== "popup");
  btn.setAttribute("aria-pressed", mode !== "popup" ? "true" : "false");
}

/** Merge panel response lines into inspector mutations (1-based step keys). */
export function mergeResponseBodies(mutations, responseMap) {
  if (!responseMap) return mutations;
  return mutations.map((m) => {
    const lines = responseMap[m.step];
    if (!lines?.length) return m;
    return {
      ...m,
      replaceBody: lines.map((value, i) => ({
        value,
        style: "add",
        id: `r-${m.step}-${i}`,
      })),
    };
  });
}

let activeResponseMode = "panel";
let inspectorBodyLabelDefault = "Scenario";

function relabelInspector() {
  const title = document.getElementById("fs-inspector-title");
  if (
    title &&
    (title.textContent === "Request" ||
      title.textContent === "Response" ||
      title.textContent === "Error Response")
  ) {
    title.textContent = "Layer board";
    title.style.color = "#58a6ff";
  }
  document.querySelectorAll(".fs-inspector-section").forEach((el) => {
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

function wireResponseComparison(viz, diagram, config) {
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

  let mode = readResponseMode(config.modeKey ?? RESPONSE_MODE_KEY);
  activeResponseMode = mode;

  const modeBtn = document.getElementById("fs-response-mode");
  syncResponseModeButton(modeBtn, mode);

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
    const lines = responseMap[stepOneBased];
    showNodePopup(viz, diagram, cfg, lines);
  }

  function syncStepPresentation(stepOneBased) {
    activeResponseMode = mode;
    applyMutationSet();
    if (stepOneBased > 0 && viz._inspector?.step) {
      viz._inspector.step(stepOneBased);
    }
    relabelInspector();
    refreshPopup();
  }

  function onFlowChange(flowId) {
    activeFlowId = flowId;
    hideNodePopup();
    viz.closeOverlay?.();
    const step = viz.state.currentStepDone || 0;
    syncStepPresentation(step);
  }

  applyMutationSet();

  const stepsContainer = document.getElementById("fs-steps-container");
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
      requestAnimationFrame(() => refreshPopup());
    };
  }

  modeBtn?.addEventListener("click", () => {
    const idx = RESPONSE_MODES.indexOf(mode);
    mode = RESPONSE_MODES[(idx + 1) % RESPONSE_MODES.length];
    writeResponseMode(mode, config.modeKey ?? RESPONSE_MODE_KEY);
    syncResponseModeButton(modeBtn, mode);
    const step = viz.state.currentStepDone || 0;
    syncStepPresentation(step);
  });

  viz._playback?.onChange?.((event) => {
    if (event === "reset") {
      mode = readResponseMode(config.modeKey ?? RESPONSE_MODE_KEY);
      activeResponseMode = mode;
      syncResponseModeButton(modeBtn, mode);
      applyMutationSet();
      hideNodePopup();
      viz.closeOverlay?.();
      relabelInspector();
    }
  });

  window.addEventListener(
    "resize",
    () => {
      const step = viz.state.currentStepDone || 0;
      if (step > 0 && (mode === "popup" || mode === "both")) {
        showPopupForStep(step);
      }
    },
    { passive: true }
  );

  return { syncStepPresentation, refreshPopup, hideNodePopup, onFlowChange };
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

export async function initScenarioDiagram(diagram, options = {}) {
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
  }

  function goPrev() {
    viz.closeOverlay?.();
    const shown = viz.state.currentStepDone || 0;
    if (shown <= 0) return;
    if (shown === 1) viz.reset();
    else viz.jumpTo(shown - 2);
    syncPlayLabel(viz);
  }

  normalizeLightupBadges(diagram);
  await viz.load(diagram);
  relabelInspector();
  viz._updateFlowLabel = () => syncScenarioHeaderLayout(viz);
  syncScenarioHeaderLayout(viz);
  requestAnimationFrame(() => syncScenarioHeaderLayout(viz));
  window.addEventListener("resize", () => syncScenarioHeaderLayout(viz), {
    passive: true,
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
    syncScenarioHeaderLayout(viz);
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
  }

  if (modeFlows) {
    window.addEventListener("hashchange", () => {
      const flowId = parsePhaseHash(modeFlows);
      if (flowId && flowId !== viz.state.activeFlow) {
        switchScenarioFlow(viz, diagram, flowId);
      }
    });
  }

  document.getElementById("fs-next")?.addEventListener("click", goNext);
  document.getElementById("fs-prev")?.addEventListener("click", goPrev);

  window.addEventListener("keydown", (e) => {
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
    } else if (e.key === "End") {
      e.preventDefault();
      viz.closeOverlay?.();
      viz.jumpTo(stepCount(diagram, viz) - 1);
      syncPlayLabel(viz);
    }
  }, true);

  const insp = document.getElementById("fs-inspector-content");
  if (insp) {
    new MutationObserver(relabelInspector).observe(insp, { childList: true, subtree: true });
  }
  const inspTitle = document.getElementById("fs-inspector-title");
  if (inspTitle) {
    new MutationObserver(relabelInspector).observe(inspTitle, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  viz._playback?.onChange?.((event) => {
    if (event === "flow") {
      syncFlowPanel(viz.state.activeFlow);
    }
    if (event === "reset" && modeFlows) {
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
