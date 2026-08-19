/** Draw brand marks on FlowStory boxes/containers. FlowStory has no node.logo field. */

const ICON = {
  size: 28,
  inline: 22,
  pad: 6,
  gap: 6,
  chip: 4,
};

export function attachLogos(diagram) {
  const I = './assets/icons';
  const nodes = diagram.nodes;
  const map = {
    user: `${I}/user.svg`,
    oc: `${I}/openclaw.svg`,
    landlock: `${I}/landlock.svg`,
    ir: `${I}/openshell-mark.svg`,
    gw: `${I}/openshell-mark.svg`,
    nemo: `${I}/nvidia.svg`,
    maas: `${I}/openshift-ai.svg`,
    llm: `${I}/ai-experience.svg`,
    mlflow: `${I}/mlflow.svg`,
    internet: `${I}/globe.svg`,
    openshell: `${I}/openshell-mark.svg`,
    agentsb: `${I}/sandbox.svg`,
  };
  for (const [id, src] of Object.entries(map)) {
    if (nodes[id]) nodes[id].logo = src;
  }
  if (nodes.cluster) {
    nodes.cluster.logos = [`${I}/openshift.svg`, `${I}/openshift-ai.svg`];
  }
  for (const [id, tt] of Object.entries(diagram.tooltips || {})) {
    if (map[id]) tt.logo = map[id];
  }
}

export function preloadLogos(diagram) {
  const urls = new Set();
  for (const node of Object.values(diagram.nodes || {})) {
    if (node.logo) urls.add(node.logo);
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

function drawChip(ctx, x, y, size, r, ts) {
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.fillStyle = '#f6f8fa';
  ctx.fill();
  ctx.strokeStyle = '#d0d7de';
  ctx.lineWidth = Math.max(1, ts(0.8));
  ctx.stroke();
}

function drawLogoAndText(ctx, node, opts) {
  const img = imgOf(node.logo);
  if (!img) return;
  const { tx, ty, ts: l, colors } = opts;
  const x = tx(node.x);
  const y = ty(node.y);
  const w = l(node.w);
  const h = l(node.h);
  const pad = l(ICON.pad);
  const icon = l(ICON.size);
  const gap = l(ICON.gap);
  const chip = l(ICON.chip);
  const bx = x + pad;
  const by = y + (h - icon) / 2;

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  drawChip(ctx, bx, by, icon, chip, l);
  drawContained(ctx, img, bx + l(4), by + l(4), icon - l(8));

  const textX = bx + icon + gap;
  const maxW = Math.max(20, w - (textX - x) - pad);
  const fs = node.fs || node.fontSize || 15;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.txt;
  if (node.sublabel) {
    ctx.font = `bold ${l(fs)}px system-ui`;
    ctx.fillText(node.label, textX, y + h / 2 - l(6), maxW);
    ctx.font = `${l(Math.max(fs - 2, 10))}px system-ui`;
    ctx.fillStyle = colors.dim;
    ctx.fillText(node.sublabel, textX, y + h / 2 + l(7), maxW);
  } else {
    ctx.font = `bold ${l(fs)}px system-ui`;
    ctx.fillText(node.label, textX, y + h / 2, maxW);
  }
  ctx.restore();
}

function drawInlineLogos(ctx, node, opts, logos, labelX, labelY, font) {
  const { ts: l } = opts;
  const icon = l(ICON.inline);
  const gap = l(8);
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let x = labelX;
  for (const src of logos) {
    const img = imgOf(src);
    if (img) {
      drawChip(ctx, x, labelY - icon + l(2), icon, l(3), l);
      drawContained(ctx, img, x + l(1.5), labelY - icon + l(3.5), icon - l(3));
      x += icon + gap;
    }
  }
  ctx.fillStyle = node.labelColor || opts.colors.dim;
  if (node.color && node.type === 'container') {
    ctx.fillStyle = node.color + (opts.isDark ? 'aa' : '99');
  }
  ctx.fillText(node.label, x, labelY);
  ctx.restore();
}

export function installLogoRenderer(viz) {
  const r = viz._renderer;
  const origBox = r.drawBox.bind(r);
  const origContainer = r.drawContainer.bind(r);
  const origBoundary = r.drawBoundary.bind(r);

  r.drawBox = function (ctx, id, node, opts) {
    if (!node?.logo) return origBox(ctx, id, node, opts);
    const label = node.label;
    const sub = node.sublabel;
    node.label = '';
    node.sublabel = undefined;
    origBox(ctx, id, node, opts);
    node.label = label;
    node.sublabel = sub;
    drawLogoAndText(ctx, node, opts);
  };

  r.drawContainer = function (ctx, id, node, opts) {
    if (!node?.logo) return origContainer(ctx, id, node, opts);
    const label = node.label;
    node.label = '';
    origContainer(ctx, id, node, opts);
    node.label = label;
    const { tx, ty, ts: l } = opts;
    drawInlineLogos(
      ctx,
      node,
      opts,
      [node.logo],
      tx(node.x + 14),
      ty(node.y + 28),
      `bold ${l(13)}px system-ui`,
    );
  };

  r.drawBoundary = function (ctx, id, node, opts) {
    if (!node?.logos?.length) return origBoundary(ctx, id, node, opts);
    const label = node.label;
    node.label = '';
    origBoundary(ctx, id, node, opts);
    node.label = label;
    const { tx, ty, ts: l } = opts;
    const align = node.labelAlign || 'right';
    const labelY = ty(node.y + 28);
    const font = `${l(14)}px system-ui`;
    if (align === 'right') {
      origBoundary(ctx, id, { ...node, logos: undefined, label }, opts);
      const img = imgOf(node.logos[0]);
      if (img) {
        const icon = l(ICON.inline);
        const x = tx(node.x + node.w - 15) - icon;
        drawChip(ctx, x, labelY - icon + l(2), icon, l(3), l);
        drawContained(ctx, img, x + l(1.5), labelY - icon + l(3.5), icon - l(3));
      }
      return;
    }
    drawInlineLogos(ctx, node, opts, node.logos, tx(node.x + 12), labelY, font);
  };
}
