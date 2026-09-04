/** Draw brand marks on FlowStory boxes/containers. FlowStory has no node.logo field. */

const ICON = {
  badge: 18,
  badgePad: 5,
  badgeInset: 2,
  badgeGap: 7,
  chip: 3,
};

let origDraw = null;
let installedViz = null;

function resolveDiagram(diagramOrViz) {
  if (diagramOrViz?.state?.nodes) {
    return { nodes: diagramOrViz.state.nodes, tooltips: diagramOrViz.state.tooltips || {} };
  }
  return {
    nodes: diagramOrViz?.nodes || {},
    tooltips: diagramOrViz?.tooltips || {},
  };
}

export function detachLogos(diagramOrViz) {
  const { nodes, tooltips } = resolveDiagram(diagramOrViz);
  for (const node of Object.values(nodes)) {
    delete node.logo;
    delete node.logos;
  }
  for (const tt of Object.values(tooltips)) {
    delete tt.logo;
  }
}

const ICON_BASE = new URL("./assets/icons/", import.meta.url).href;

export function attachLogos(diagramOrViz) {
  const I = ICON_BASE;
  const { nodes, tooltips } = resolveDiagram(diagramOrViz);
  const map = {
    user: `${I}/user.svg`,
    oc: `${I}/openclaw.svg`,
    landlock: `${I}/landlock.svg`,
    ir: `${I}/openshell-mark.svg`,
    gw: `${I}/openshell-mark.svg`,
    nemo: `${I}/nvidia.svg`,
    maas: `${I}/openshift-ai.svg`,
    llm: `${I}/ai-experience.svg`,
    guardrailsLlm: `${I}/ai-experience.svg`,
    mlflow: `${I}/mlflow.svg`,
    internet: `${I}/globe.svg`,
    file: `${I}/file.svg`,
    openshell: `${I}/openshell-mark.svg`,
    agentsb: `${I}/sandbox.svg`,
  };
  const deniedMap = {
    file: `${I}/file-denied.svg`,
    internet: `${I}/globe-denied.svg`,
  };
  for (const [id, src] of Object.entries(map)) {
    if (nodes[id]) nodes[id].logo = src;
  }
  for (const [id, src] of Object.entries(deniedMap)) {
    if (nodes[id]) nodes[id]._logoDenied = src;
  }
  if (nodes.cluster) {
    nodes.cluster.logos = [`${I}/openshift.svg`, `${I}/openshift-ai.svg`];
  }
  for (const [id, tt] of Object.entries(tooltips || {})) {
    if (map[id]) tt.logo = map[id];
  }
}

export function preloadLogos(diagramOrViz) {
  const { nodes } = resolveDiagram(diagramOrViz);
  const urls = new Set();
  for (const node of Object.values(nodes)) {
    if (node.logo) urls.add(node.logo);
    if (node._logoDenied) urls.add(node._logoDenied);
    for (const src of node.logos || []) urls.add(src);
  }
  return Promise.all([...urls].map((src) => loadImage(src)));
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn('Logo failed to load:', src);
      resolve(null);
    };
    cache.set(src, img);
    img.src = src;
  });
}

const cache = new Map();

function imgOf(src) {
  const img = cache.get(src);
  return img && img.complete && img.naturalWidth ? img : null;
}

function drawContained(ctx, img, x, y, size) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ar = iw / ih;
  let dw = size;
  let dh = size;
  if (ar > 1) dh = size / ar;
  else dw = size * ar;
  ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
}

function drawChip(ctx, x, y, size, r, ts, isDark) {
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.fillStyle = isDark ? '#21262d' : '#f6f8fa';
  ctx.fill();
  ctx.strokeStyle = isDark ? '#484f58' : '#d0d7de';
  ctx.lineWidth = Math.max(1, ts(0.6));
  ctx.stroke();
}

function drawBadgeAt(ctx, opts, src, bx, by) {
  const img = imgOf(src);
  if (!img) return;
  const { ts: l, isDark } = opts;
  const icon = l(ICON.badge);
  const inset = l(ICON.badgeInset);

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  drawChip(ctx, bx, by, icon, l(ICON.chip), l, isDark);
  drawContained(ctx, img, bx + inset, by + inset, icon - inset * 2);
  ctx.restore();
}

/** Left margin of node boxes — centered text stays unchanged. */
function drawBoxBadge(ctx, node, opts, src) {
  const { tx, ty, ts: l } = opts;
  const icon = l(ICON.badge);
  const pad = l(ICON.badgePad);
  const bx = tx(node.x) + pad;
  const by = ty(node.y) + (l(node.h) - icon) / 2;
  drawBadgeAt(ctx, opts, src, bx, by);
}

/** Title baseline (logical y offset from node.y) for containers and boundaries. */
const TITLE_BASELINE_Y = {
  openshell: 22,
  agentsb: 22,
  cluster: 22,
};

/** Container title row: logo then label on FlowStory baseline. */
function drawContainerTitleWithLogo(ctx, node, opts, src, label, id) {
  const { tx, ty, ts: l, isDark } = opts;
  const icon = l(ICON.badge);
  const gap = l(ICON.badgeGap);
  const titleY = TITLE_BASELINE_Y[id] ?? 28;
  const labelX = tx(node.x + 14);
  const labelY = ty(node.y + titleY);
  const badgeY = labelY - icon + l(3);

  drawBadgeAt(ctx, opts, src, labelX, badgeY);

  ctx.save();
  ctx.font = `bold ${l(13)}px system-ui`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = node.color + (isDark ? 'aa' : '99');
  ctx.fillText(label, labelX + icon + gap, labelY);
  ctx.restore();
}

/** Boundary title row: logo(s) then label on FlowStory baseline. */
function drawBoundaryTitleWithLogos(ctx, node, opts, logos, label, id) {
  const { tx, ty, ts: l } = opts;
  const icon = l(ICON.badge);
  const gap = l(ICON.badgeGap);
  const titleY = TITLE_BASELINE_Y[id] ?? 22;
  const labelY = ty(node.y + titleY);
  let x = tx(node.x + 12);

  for (const src of logos) {
    drawBadgeAt(ctx, opts, src, x, labelY - icon + l(3));
    x += icon + gap;
  }

  ctx.save();
  ctx.font = `${l(14)}px system-ui`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = node.labelColor || opts.colors.dim;
  ctx.fillText(label, x, labelY);
  ctx.restore();
}

export function uninstallLogoRenderer(viz) {
  if (!installedViz || installedViz !== viz || !origDraw) return false;
  const r = viz._renderer;
  r.drawBox = origDraw.drawBox;
  r.drawContainer = origDraw.drawContainer;
  r.drawBoundary = origDraw.drawBoundary;
  origDraw = null;
  installedViz = null;
  return true;
}

export function installLogoRenderer(viz) {
  if (installedViz === viz) return;
  uninstallLogoRenderer(installedViz);

  const r = viz._renderer;
  const origBox = r.drawBox.bind(r);
  const origContainer = r.drawContainer.bind(r);
  const origBoundary = r.drawBoundary.bind(r);
  origDraw = { drawBox: origBox, drawContainer: origContainer, drawBoundary: origBoundary };
  installedViz = viz;

  r.drawBox = function (ctx, id, node, opts) {
    origBox(ctx, id, node, opts);
    const hasDeniedArrow = node?._logoDenied && viz.state?.lines?.some(l => l.to === id && l.color === '#f85149');

    if (!node.label && hasDeniedArrow) {
      const { tx, ty, ts: l } = opts;
      const icon = l(ICON.badge);
      const bx = tx(node.x) + (l(node.w) - icon) / 2;
      const by = ty(node.y) + (l(node.h) - icon) / 2;
      drawBadgeAt(ctx, opts, node._logoDenied, bx, by);
    } else if (node?.logo) {
      drawBoxBadge(ctx, node, opts, node.logo);
    }

    if (hasDeniedArrow && node.label) {
      const { tx, ty, ts: l } = opts;
      const cx = tx(node.x) + l(node.w) / 2;
      const cy = ty(node.y) + l(node.h) / 2;
      const r2 = Math.min(l(node.w), l(node.h)) * 0.45;
      ctx.save();
      ctx.strokeStyle = '#f85149';
      ctx.lineWidth = l(3);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, r2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r2 * 0.707, cy - r2 * 0.707);
      ctx.lineTo(cx + r2 * 0.707, cy + r2 * 0.707);
      ctx.stroke();
      ctx.restore();
    }
  };

  r.drawContainer = function (ctx, id, node, opts) {
    if (!node?.logo) return origContainer(ctx, id, node, opts);
    const label = node.label;
    node.label = '';
    origContainer(ctx, id, node, opts);
    node.label = label;
    drawContainerTitleWithLogo(ctx, node, opts, node.logo, label, id);
  };

  r.drawBoundary = function (ctx, id, node, opts) {
    if (!node?.logos?.length) return origBoundary(ctx, id, node, opts);
    const label = node.label;
    node.label = '';
    origBoundary(ctx, id, node, opts);
    node.label = label;
    drawBoundaryTitleWithLogos(ctx, node, opts, node.logos, label, id);
  };
}

export async function setLogosEnabled(viz, enabled) {
  if (!viz?.state?.nodes) return;
  if (enabled) {
    attachLogos(viz);
    await preloadLogos(viz);
    installLogoRenderer(viz);
  } else {
    uninstallLogoRenderer(viz);
    detachLogos(viz);
  }
  viz._engine?.draw();
}
