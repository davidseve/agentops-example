/**
 * Shared in-document resize for overall architecture diagrams (v3 embed + standalone).
 */

import { CLUSTER_X, OVERALL_NODES } from "./scenario-layout.js";

export const OVERALL_IN_DOC = {
  innerSelector: ".fs-overall-in-doc-inner",
  canvasWrapSelector: ".fs-overall-canvas-wrap",
  layersOffClass: "fs-overall-layers-off",
  layersTopClass: "fs-overall-layers-top",
  layersBottomClass: "fs-overall-layers-bottom",
  legendRatioVar: "--fs-overall-legend-ratio",
};

const MIN_CANVAS_HEIGHT = 120;
/** drawScale at which legend base tokens (10px / 168px) match standalone inset. */
const LEGEND_REF_SCALE = 0.72;
const LEGEND_INSET_PX = 8;
const LEGEND_BASE_WIDTH_PX = 168;
/** Keep legend inside the diagram left gutter (before the cluster boundary). */
const LEGEND_MAX_LOGICAL_W = CLUSTER_X - LEGEND_INSET_PX * 2;
/** Stop legend above the left-column user node (logical coords). */
const LEGEND_MAX_LOGICAL_H = OVERALL_NODES.user.y - LEGEND_INSET_PX * 2;

/** @param {number} drawScale */
export function computeLegendRatio(drawScale) {
  return Math.min(1, drawScale / LEGEND_REF_SCALE);
}

/**
 * Legend CSS width capped so it does not spill past the cluster column in logical coords.
 * @param {number} drawScale
 * @param {number} [ratio]
 */
export function computeLegendCssWidth(drawScale, ratio = computeLegendRatio(drawScale)) {
  const base = LEGEND_BASE_WIDTH_PX * ratio;
  const cap = LEGEND_MAX_LOGICAL_W * drawScale;
  return Math.round(Math.min(base, cap));
}

/** @param {number} drawScale */
export function computeLegendMaxCssHeight(drawScale) {
  return Math.max(48, Math.round(LEGEND_MAX_LOGICAL_H * drawScale));
}

export function syncCanvasWrapLegend(engine) {
  const wrap = document.querySelector(OVERALL_IN_DOC.canvasWrapSelector);
  if (!wrap || !engine) return;
  const containerW = Math.max(wrap.clientWidth || 0, 260);
  const w = engine.W ?? engine.canvas?.width ?? 0;
  const drawScale = engine._sc ?? 0.72;
  syncLegendLayout(wrap, { drawScale, w, containerW, engine });
}

function syncLegendLayout(wrap, { drawScale, w, containerW, engine }) {
  const legend = wrap.querySelector("#fs-legend");
  if (!legend) return;

  const ratio = computeLegendRatio(drawScale);
  wrap.style.setProperty(OVERALL_IN_DOC.legendRatioVar, ratio.toFixed(4));

  const inset = LEGEND_INSET_PX * ratio;
  const canvasLeft = Math.max(0, (containerW - w) / 2);

  legend.style.left = `${Math.round(canvasLeft + (engine._ox || 0) + inset)}px`;
  legend.style.top = `${Math.round((engine._oy || 0) + inset)}px`;
  legend.style.width = `${computeLegendCssWidth(drawScale, ratio)}px`;
  legend.style.maxHeight = `${computeLegendMaxCssHeight(drawScale)}px`;
  legend.style.bottom = "auto";
  legend.style.right = "auto";
}

function resolveInDocCanvasWrap(root) {
  if (!root) return null;
  const scope = root instanceof Element || root instanceof Document ? root : null;
  if (!scope) return null;
  const inner = scope?.querySelector?.(OVERALL_IN_DOC.innerSelector);
  return inner?.querySelector?.(OVERALL_IN_DOC.canvasWrapSelector) ?? null;
}

/** ResizeObserver only accepts Element nodes (not Document). */
function resizeObserveTarget(node) {
  if (node instanceof Element) return node;
  if (node?.documentElement instanceof Element) return node.documentElement;
  return null;
}

function scheduleInDocResize(viz, { getRoot, getDiagram, onAfterDraw }) {
  requestAnimationFrame(() => {
    const engine = viz?._engine;
    const root = getRoot?.();
    const wrap = resolveInDocCanvasWrap(root);
    const diagram = getDiagram?.();
    if (!engine || !wrap || !diagram) return;

    const logicalW = diagram.canvas?.width ?? engine.logicalWidth ?? 820;
    const logicalH = diagram.canvas?.height ?? engine.logicalHeight ?? 740;
    const containerW = Math.max(wrap.clientWidth || 0, 260);
    const containerH = Math.max(wrap.clientHeight || 0, MIN_CANVAS_HEIGHT);

    const scale = Math.min(containerW / logicalW, containerH / logicalH);
    const w = Math.round(logicalW * scale);

    const drawScale = scale * 0.96;
    engine.panelWidth = 0;
    engine.W = engine.canvas.width = w;
    // Fill the frame height; legend overlays the left gutter (_oy = 0).
    engine.H = engine.canvas.height = containerH;
    engine._sc = drawScale;
    engine._ox = (w - logicalW * engine._sc) / 2;
    engine._oy = 0;
    syncLegendLayout(wrap, { drawScale, w, containerW, engine });
    engine.draw();
    onAfterDraw?.();
  });
}

/**
 * @param {object} viz — FlowStory instance
 * @param {{ getRoot: () => ParentNode | null, getDiagram: () => object, onAfterDraw?: () => void }} context
 * @returns {{ clear: () => void }}
 */
export function bindOverallInDocResize(viz, { getRoot, getDiagram, onAfterDraw }) {
  const engine = viz?._engine;
  if (!engine) return { clear() {} };

  const resizeContext = { getRoot, getDiagram, onAfterDraw };

  engine.panelWidth = 0;
  engine.resize = function overallInDocResize() {
    scheduleInDocResize(viz, resizeContext);
  };

  const onResize = () => scheduleInDocResize(viz, resizeContext);
  window.addEventListener("resize", onResize, { passive: true });

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    const root = getRoot?.();
    const scope = root instanceof Element || root instanceof Document ? root : null;
    const inner = scope?.querySelector?.(OVERALL_IN_DOC.innerSelector);
    const wrap = resolveInDocCanvasWrap(scope);
    resizeObserver = new ResizeObserver(onResize);
    const observe = (node) => {
      const target = resizeObserveTarget(node);
      if (target) resizeObserver.observe(target);
    };
    observe(root);
    observe(inner);
    observe(wrap);
    observe(inner?.querySelector?.(".fs-layers-dock"));
  }

  scheduleInDocResize(viz, resizeContext);
  setTimeout(() => scheduleInDocResize(viz, resizeContext), 80);
  setTimeout(() => scheduleInDocResize(viz, resizeContext), 240);

  return {
    clear() {
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    },
  };
}
