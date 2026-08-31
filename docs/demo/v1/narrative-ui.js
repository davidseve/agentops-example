/**
 * Shared render + navigation for narrative demo UI.
 */

import {
  NARRATIVE,
  STEP_IDS,
  NAV_GROUPS,
  getStep,
  stepIndex,
  nextStepId,
  prevStepId,
} from "./narrative-data.js";

const LAYER_STATE_CLASS = {
  locked: "locked",
  blocked: "blocked",
  open: "open",
  closed: "closed",
  off: "off",
  on: "on",
};

const MATRIX_CELL_CLASS = {
  blocked: "blocked",
  allowed: "allowed",
  na: "na",
};

const MATRIX_CELL_TEXT = {
  blocked: "blocked",
  allowed: "allowed",
  na: "—",
};

const DIAGRAM_NODES = {
  oc: { x: 24, y: 72, w: 88, h: 36, label: "OpenClaw", sub: "BYOA" },
  landlock: { x: 130, y: 72, w: 72, h: 36, label: "Landlock", sub: "files" },
  ir: { x: 24, y: 130, w: 88, h: 36, label: "inference.local", sub: "router" },
  gw: { x: 130, y: 130, w: 72, h: 36, label: "Gateway", sub: "egress" },
  nemo: { x: 24, y: 188, w: 88, h: 36, label: "NeMo", sub: "Guardrails" },
  maas: { x: 130, y: 188, w: 72, h: 36, label: "MaaS", sub: "model" },
  mlflow: { x: 24, y: 246, w: 88, h: 36, label: "MLflow", sub: "traces" },
  internet: { x: 220, y: 130, w: 72, h: 36, label: "Internet", sub: "egress" },
};

export const FLOW_ANIM_STORAGE_KEY = "nr-flow-anim-enabled";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderLayerBoard(container, layers) {
  if (!container) return;
  const { layerLabels } = NARRATIVE;
  container.innerHTML = Object.entries(layerLabels)
    .map(([key, label]) => {
      const val = layers[key] ?? "na";
      const cls = LAYER_STATE_CLASS[val] ?? "";
      return `<div class="nr-layer" data-layer="${key}">
        <span>${escapeHtml(label)}</span>
        <span class="nr-state ${cls}">${escapeHtml(val)}</span>
      </div>`;
    })
    .join("");
}

export function renderMatrix(container, matrix, matrixFocus = "all") {
  if (!container) return;
  const sectionTitle = container.previousElementSibling;
  const hide = matrixFocus == null;
  container.hidden = hide;
  if (sectionTitle?.matches("h2")) sectionTitle.hidden = hide;
  if (hide) {
    container.innerHTML = "";
    return;
  }

  const { matrixLabels } = NARRATIVE;
  const allKeys = Object.keys(matrixLabels);

  if (matrixFocus !== "all") {
    const key = matrixFocus;
    const v = matrix[key] ?? "na";
    const cls = MATRIX_CELL_CLASS[v] ?? "na";
    const text = MATRIX_CELL_TEXT[v] ?? v;
    const label = matrixLabels[key] ?? key;
    container.innerHTML = `<div class="nr-matrix-single">
      <span class="nr-matrix-single-label">${escapeHtml(label)}</span>
      <span class="nr-cell ${cls} nr-matrix-single-value">${escapeHtml(text)}</span>
    </div>`;
    return;
  }

  const header = allKeys.map((k) => `<th>${escapeHtml(matrixLabels[k])}</th>`).join("");
  const cells = allKeys
    .map((k) => {
      const v = matrix[k] ?? "na";
      const cls = MATRIX_CELL_CLASS[v] ?? "na";
      const text = MATRIX_CELL_TEXT[v] ?? v;
      return `<td class="nr-cell ${cls}">${escapeHtml(text)}</td>`;
    })
    .join("");

  container.innerHTML = `<div class="nr-matrix-wrap"><table class="nr-matrix">
    <thead><tr><th></th>${header}</tr></thead>
    <tbody><tr><td class="test-label">Summary</td>${cells}</tr></tbody>
  </table></div>`;
}

function edgeLine(x1, y1, x2, y2, classes, flowing = false, flowKind = null) {
  const flowCls = flowing ? " flowing" : "";
  const kindCls = flowKind ? ` flow-kind-${flowKind}` : "";
  return `<line class="edge ${classes}${flowCls}${kindCls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}

function nodeCenter(id) {
  const n = DIAGRAM_NODES[id];
  return { cx: n.x + n.w / 2, cy: n.y + n.h / 2, ...n };
}

const BOX_EDGE_INSET = 6;

function facingEdgePoint(node, toward, shiftX = 0) {
  const dx = toward.cx - node.cx;
  const dy = toward.cy - node.cy;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return {
      x: node.cx + shiftX,
      y: dy > 0 ? node.y + node.h - BOX_EDGE_INSET : node.y + BOX_EDGE_INSET,
    };
  }
  return {
    x: dx > 0 ? node.x + node.w - BOX_EDGE_INSET : node.x + BOX_EDGE_INSET,
    y: node.cy + shiftX,
  };
}

function hopEndpoints(fromId, toId) {
  const from = nodeCenter(fromId);
  const to = nodeCenter(toId);
  const a = facingEdgePoint(from, to);
  const b = facingEdgePoint(to, from);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function linkedPathD(nodes) {
  if (nodes.length < 2) return "";
  const parts = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodeCenter(nodes[i]);
    const to = nodeCenter(nodes[i + 1]);
    const a = facingEdgePoint(from, to);
    const b = facingEdgePoint(to, from);
    if (i === 0) parts.push(`M ${a.x} ${a.y}`);
    else parts.push(`L ${a.x} ${a.y}`);
    parts.push(`L ${b.x} ${b.y}`);
  }
  return parts.join(" ");
}

function usesLinkedPath(nodes) {
  return (nodes?.length ?? 0) >= 2;
}

function betweenBoxesPath(nodes, shiftX = 0) {
  if (nodes.length < 2) return "";
  const from = nodeCenter(nodes[0]);
  const to = nodeCenter(nodes[nodes.length - 1]);
  const a = facingEdgePoint(from, to, shiftX);
  const b = facingEdgePoint(to, from, shiftX);
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

const LANE_OFFSET = {
  center: 0,
  side: 52,
  "side-left": -52,
};

const FLOW_FILL_HEX = {
  probe: "#58a6ff",
  platform: "#58a6ff",
  default: "#58a6ff",
  "risk-open": "#d29922",
  egress: "#d29922",
  "inference-risk": "#d29922",
  inference: "#3fb950",
  "inference-guarded": "#3fb950",
  trace: "#a371f7",
  denied: "#f85149",
};

function flowPathD(nodes, { blocked = false, lane = "center", rail = 0 } = {}) {
  if (!nodes?.length) return "";
  if (lane === "between" && nodes.length >= 2) {
    return betweenBoxesPath(nodes, rail);
  }
  if (lane === "center" && usesLinkedPath(nodes)) {
    return linkedPathD(nodes);
  }
  const offset = LANE_OFFSET[lane] ?? 0;
  if (offset !== 0 && nodes.length >= 2) {
    return nodes
      .map((id, idx) => {
        const { cx, cy } = nodeCenter(id);
        return `${idx === 0 ? "M" : "L"} ${cx + offset} ${cy}`;
      })
      .join(" ");
  }
  if (blocked && nodes.length === 2) {
    const a = nodeCenter(nodes[0]);
    const b = nodeCenter(nodes[1]);
    const mx = a.cx + (b.cx - a.cx) * 0.55;
    const my = a.cy + (b.cy - a.cy) * 0.55;
    return `M ${a.cx} ${a.cy} L ${mx} ${my}`;
  }
  return nodes
    .map((id, idx) => {
      const { cx, cy } = nodeCenter(id);
      return `${idx === 0 ? "M" : "L"} ${cx} ${cy}`;
    })
    .join(" ");
}

function edgeFlowKind(fromId, toId, flows) {
  if (!flows?.length) return null;
  for (const flow of flows) {
    const lane = flow.lane ?? "center";
    if (lane !== "center") continue;
    const nodes = flow.nodes;
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      if ((from === fromId && to === toId) || (from === toId && to === fromId)) {
        return flow.kind ?? "default";
      }
    }
  }
  return null;
}

function edgePairInFlow(fromId, toId, flows) {
  return edgeFlowKind(fromId, toId, flows) != null;
}

function addEdge(staticEdges, flowingEdges, fromId, toId, classes, flows, animateFlows) {
  const { x1, y1, x2, y2 } = hopEndpoints(fromId, toId);
  const flowKind = animateFlows ? edgeFlowKind(fromId, toId, flows) : null;
  const flowing = flowKind != null;
  const line = edgeLine(x1, y1, x2, y2, classes, flowing, flowKind);
  if (flowing) flowingEdges.push(line);
  else staticEdges.push(line);
}

function flowDuration(flow) {
  if (flow.dur != null) return flow.dur;
  if (flow.bounce || flow.blocked) return 1.1;
  return 2;
}

const FLOW_FILL = {
  probe: "var(--nr-flow-platform)",
  platform: "var(--nr-flow-platform)",
  default: "var(--nr-flow-platform)",
  "risk-open": "var(--nr-flow-risk)",
  egress: "var(--nr-flow-risk)",
  "inference-risk": "var(--nr-flow-risk)",
  inference: "var(--nr-flow-secure)",
  "inference-guarded": "var(--nr-flow-secure)",
  trace: "var(--nr-flow-trace)",
  denied: "var(--nr-flow-denied)",
};

function flowFillForKind(kind, stateCls) {
  if (stateCls.includes("bounce") || stateCls.includes("blocked")) {
    return FLOW_FILL_HEX.denied;
  }
  return FLOW_FILL_HEX[kind] ?? FLOW_FILL_HEX.default;
}

function pathStartPoint(pathD) {
  const match = pathD.match(/^M\s*([-\d.]+)\s+([-\d.]+)/);
  if (!match) return { x: 0, y: 0 };
  return { x: Number(match[1]), y: Number(match[2]) };
}

function computeChainedTiming(flows) {
  const pause = flows.find((f) => f.pause != null)?.pause ?? 0.25;
  const timings = [];
  let cursor = 0;
  flows.forEach((flow, i) => {
    if (i > 0) cursor += pause;
    const dur = flowDuration(flow);
    timings.push({ start: cursor, dur });
    cursor += dur;
  });
  const cycle = cursor;
  return timings.map(({ start, dur }) => ({
    begin: `${start}s;${cycle}s`,
    dur,
  }));
}

function buildFlowGuide(pathD, kind) {
  const stroke = FLOW_FILL_HEX[kind] ?? FLOW_FILL_HEX.default;
  return `<path class="nr-flow-guide" d="${pathD}" fill="none" stroke="${stroke}" stroke-width="2" stroke-dasharray="4 5" opacity="0.85"/>`;
}

function flowPathOptions(flow) {
  return {
    blocked: Boolean(flow.blocked && !flow.bounce),
    lane: flow.lane ?? "center",
    rail: flow.rail ?? 0,
  };
}

function buildAnimatedFlowDot(flow, timing, pathId) {
  const pathD = flowPathD(flow.nodes, flowPathOptions(flow));
  const kind = flow.kind ?? "default";
  const stateCls = flow.bounce ? " bounce" : flow.blocked ? " blocked" : "";
  const fill = flowFillForKind(kind, stateCls);
  const { begin, dur } = timing;

  return `<path id="${pathId}" d="${pathD}" fill="none" stroke="none" visibility="hidden"/>
  <circle class="nr-flow-dot nr-flow-${kind}${stateCls}" r="4.5" fill="${fill}" opacity="0">
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.98;1" dur="${dur}s" begin="${begin}" repeatCount="indefinite"/>
    <animateMotion dur="${dur}s" begin="${begin}" repeatCount="indefinite" rotate="auto">
      <mpath href="#${pathId}"/>
    </animateMotion>
  </circle>`;
}

function buildChainedFlowDot(flow, timing, index) {
  return buildAnimatedFlowDot(flow, timing, `nr-flow-path-${index}`);
}

function flowLayerTarget(flow) {
  if (flow.lane === "between") return "above";
  if (flow.nodes?.includes("gw")) return "underGw";
  if (flow.afterPrevious) return "above";
  return "below";
}

function flowCoverNodeIds(flows) {
  const ids = new Set();
  flows?.forEach((flow) => {
    if (flowLayerTarget(flow) === "underGw") {
      flow.nodes?.forEach((id) => ids.add(id));
    }
  });
  return ids;
}

function buildSplitChainedFlowLayers(flows) {
  const timings = computeChainedTiming(flows);
  const below = [];
  const underGw = [];
  const above = [];
  const guidesBelow = [];
  const guidesUnderGw = [];
  const guidesAbove = [];
  const seenRailsBelow = new Set();
  const seenRailsUnderGw = new Set();
  const seenRailsAbove = new Set();

  flows.forEach((flow, i) => {
    const dot = buildChainedFlowDot(flow, timings[i], i);
    const pathD = flowPathD(flow.nodes, flowPathOptions(flow));
    const lane = flow.lane ?? "center";
    const layer = flowLayerTarget(flow);
    const railKey =
      lane !== "center"
        ? `${lane}:${flow.rail ?? 0}:${flow.nodes.join(">")}`
        : "";
    const guide =
      lane !== "center"
        ? buildFlowGuide(pathD, flow.kind ?? "default")
        : null;

    const target =
      layer === "above"
        ? { dots: above, guides: guidesAbove, seen: seenRailsAbove }
        : layer === "underGw"
          ? { dots: underGw, guides: guidesUnderGw, seen: seenRailsUnderGw }
          : { dots: below, guides: guidesBelow, seen: seenRailsBelow };

    target.dots.push(dot);
    if (guide && railKey && !target.seen.has(railKey)) {
      target.seen.add(railKey);
      target.guides.push(guide);
    }
  });

  const wrapGuides = (items) =>
    items.length ? `<g class="nr-flow-guides" aria-hidden="true">${items.join("\n")}</g>` : "";

  const wrapLayer = (guideItems, dots, cls) =>
    dots.length
      ? `<g class="nr-flow-layer nr-flow-chain ${cls}" aria-hidden="true">${wrapGuides(guideItems)}${dots.join("\n")}</g>`
      : "";

  return {
    below: wrapLayer(guidesBelow, below, "nr-flow-below"),
    underGw: wrapLayer(guidesUnderGw, underGw, "nr-flow-under-gw"),
    above: wrapLayer(guidesAbove, above, "nr-flow-above"),
  };
}

function buildParallelFlowLayer(flows) {
  const dots = flows
    .map((flow, i) => {
      const dur = flowDuration(flow);
      return buildAnimatedFlowDot(flow, { begin: `${i * 0.5}s`, dur }, `nr-flow-path-p${i}`);
    })
    .join("\n");
  return `<g class="nr-flow-layer" aria-hidden="true">${dots}</g>`;
}

function buildFlowLayers(flows, animateFlows) {
  if (!animateFlows || !flows?.length) {
    return { below: "", underGw: "", above: "" };
  }
  if (flows.some((flow) => flow.afterPrevious)) {
    return buildSplitChainedFlowLayers(flows);
  }
  return { below: buildParallelFlowLayer(flows), underGw: "", above: "" };
}

function hasRiskOpenFlow(flows) {
  return flows?.some((f) => f.kind === "risk-open" || f.kind === "inference-risk");
}

function hasBounceDenyFlow(flows) {
  return flows?.some((f) => f.bounce || f.kind === "denied");
}

function ocGatewayEdgeClass(isActive, flows) {
  if (!isActive) return "";
  if (flows?.some((f) => f.kind === "egress" || f.kind === "risk-open")) return "warn active";
  return "active";
}

function internetEdgeClass(active, egressOpen, suppressEgressWarn, flows) {
  if (!active) return "";
  if (hasRiskOpenFlow(flows)) return "warn active";
  if (egressOpen && !suppressEgressWarn) return "warn active";
  return "active";
}

function renderFlowLegend(flowAnimEnabled) {
  if (!flowAnimEnabled) return "";
  return `<div class="nr-flow-legend" id="nr-flow-legend">
    <span class="nr-legend-item nr-legend-platform">Platform path</span>
    <span class="nr-legend-item nr-legend-risk">Open egress</span>
    <span class="nr-legend-item nr-legend-secure">Secured path</span>
    <span class="nr-legend-item nr-legend-denied">Blocked</span>
    <span class="nr-legend-item nr-legend-trace">MLflow trace</span>
  </div>`;
}

export function renderDiagram(container, diagramState, layers, animateFlows = false) {
  if (!container) return;

  const active = new Set(diagramState?.active ?? []);
  const flows = diagramState?.flows ?? [];
  const path = diagramState?.inferencePath ?? "direct";
  const egressOpen = layers?.egress === "open";
  const guardrailsOff = layers?.guardrails === "off";
  const suppressEgressWarn = diagramState?.suppressEgressWarn === true;
  const inferenceRisk = diagramState?.inferenceRisk === true;
  const nodeRoles = diagramState?.nodeRoles ?? {};
  const showInternetRisk = active.has("internet") && hasRiskOpenFlow(flows);

  const staticEdges = [];
  const flowingEdges = [];

  const edgeActive = (a, b) => active.has(a) && active.has(b);

  addEdge(staticEdges, flowingEdges, "oc", "ir", edgeActive("oc", "ir") ? "active" : "", flows, animateFlows);
  addEdge(staticEdges, flowingEdges, "oc", "landlock", edgeActive("oc", "landlock") ? "active" : "", flows, animateFlows);
  addEdge(staticEdges, flowingEdges, "ir", "gw", edgeActive("ir", "gw") ? "active" : "", flows, animateFlows);
  addEdge(staticEdges, flowingEdges, "oc", "gw", ocGatewayEdgeClass(edgeActive("oc", "gw"), flows), flows, animateFlows);
  addEdge(
    staticEdges,
    flowingEdges,
    "gw",
    "internet",
    internetEdgeClass(edgeActive("gw", "internet"), egressOpen, suppressEgressWarn, flows),
    flows,
    animateFlows
  );
  addEdge(staticEdges, flowingEdges, "oc", "mlflow", edgeActive("oc", "mlflow") ? "active" : "", flows, animateFlows);

  if (path === "nemo") {
    addEdge(staticEdges, flowingEdges, "ir", "nemo", "active direct", flows, animateFlows);
    addEdge(staticEdges, flowingEdges, "nemo", "maas", "active direct", flows, animateFlows);
  } else {
    const irMaasClass = edgeActive("ir", "maas")
      ? inferenceRisk
        ? "warn active"
        : "active direct"
      : "bypass";
    addEdge(staticEdges, flowingEdges, "ir", "maas", irMaasClass, flows, animateFlows);
    addEdge(staticEdges, flowingEdges, "ir", "nemo", "bypass", flows, animateFlows);
    addEdge(staticEdges, flowingEdges, "nemo", "maas", "bypass", flows, animateFlows);
  }

  const { below: flowBelow, underGw: flowUnderGw, above: flowAbove } = buildFlowLayers(flows, animateFlows);

  const renderNode = (id, n) => {
    const isActive = active.has(id);
    const role = nodeRoles[id];
    const isDimmed = id === "nemo" && guardrailsOff;
    const isGatewayDenied = id === "gw" && isActive && hasBounceDenyFlow(flows);
    const isWarn =
      (id === "internet" && showInternetRisk) || (id === "maas" && inferenceRisk);
    const stateClass =
      role === "secure"
        ? "secure pulse"
        : role === "credential-host"
          ? "credential-host pulse"
          : isGatewayDenied
          ? "denied pulse"
          : isActive
            ? "active pulse"
            : "";
    const classes = ["node-box", stateClass, isDimmed ? "dimmed" : "", isWarn ? "warn" : ""]
      .filter(Boolean)
      .join(" ");
    return `<g class="node" data-node="${id}">
      <rect class="${classes}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6"/>
      <text class="node-label" x="${n.x + n.w / 2}" y="${n.y + 16}" text-anchor="middle">${escapeHtml(n.label)}</text>
      <text class="node-sublabel" x="${n.x + n.w / 2}" y="${n.y + 28}" text-anchor="middle">${escapeHtml(n.sub)}</text>
    </g>`;
  };

  const coverNodes = flowCoverNodeIds(flows);
  const nodeEntries = Object.entries(DIAGRAM_NODES);
  const backgroundNodes = nodeEntries
    .filter(([id]) => !coverNodes.has(id))
    .map(([id, n]) => renderNode(id, n))
    .join("");
  const foregroundNodes = nodeEntries
    .filter(([id]) => coverNodes.has(id))
    .map(([id, n]) => renderNode(id, n))
    .join("");

  container.innerHTML = `<svg class="nr-diagram${animateFlows ? " nr-animate" : ""}" viewBox="0 0 300 290" xmlns="http://www.w3.org/2000/svg" aria-label="Architecture mini-diagram">
    ${staticEdges.join("\n")}
    ${flowBelow}
    ${flowingEdges.length ? `<g class="nr-flow-edges" aria-hidden="true">${flowingEdges.join("\n")}</g>` : ""}
    ${backgroundNodes}
    ${flowUnderGw}
    ${foregroundNodes}
    ${flowAbove}
  </svg>`;
}

export function renderYamlPanel(container, yamlPanel) {
  if (!container) return;
  if (!yamlPanel) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }
  container.hidden = false;

  let body = "";
  if (yamlPanel.before && yamlPanel.after) {
    body = `<div class="nr-yaml-diff">
      <div class="nr-yaml-col before">
        <h4>Before (${escapeHtml(yamlPanel.fileBefore ?? "initial")})</h4>
        <pre class="nr-yaml-pre">${escapeHtml(yamlPanel.before)}</pre>
      </div>
      <div class="nr-yaml-col after">
        <h4>After (${escapeHtml(yamlPanel.fileAfter ?? "final")})</h4>
        <pre class="nr-yaml-pre">${escapeHtml(yamlPanel.after)}</pre>
      </div>
    </div>`;
  } else if (yamlPanel.snippet) {
    body = `<pre class="nr-yaml-pre">${escapeHtml(yamlPanel.snippet)}</pre>`;
  }

  container.innerHTML = `<details class="nr-yaml-panel"${yamlPanel.defaultOpen === false ? "" : " open"}>
    <summary>${escapeHtml(yamlPanel.title)}</summary>
    <div class="nr-yaml-body">
      ${yamlPanel.command ? `<div class="nr-label">Terminal</div><code class="nr-cmd">${escapeHtml(yamlPanel.command)}</code>` : ""}
      ${body}
      ${yamlPanel.expectedOutput ? `<div class="nr-label">Expected output</div><pre class="nr-yaml-pre">${escapeHtml(yamlPanel.expectedOutput)}</pre>` : ""}
      ${yamlPanel.note ? `<p class="nr-yaml-note">${escapeHtml(yamlPanel.note)}</p>` : ""}
    </div>
  </details>`;
}

export function renderStepCard(container, step, { flowAnimEnabled = true, onFlowAnimChange } = {}) {
  if (!container || !step) return;

  let subNav = "";
  if (step.subStep) {
    const { group, phase } = step.subStep;
    subNav = `<div class="nr-sub-nav" data-sub-group="${group}">
      <button type="button" data-goto="${group}-pre" class="${phase === "before" ? "active" : ""}">Before</button>
      <button type="button" data-goto="${group}-post" class="${phase === "after" ? "active" : ""}">After</button>
    </div>`;
  }

  const bodyHtml = (step.body ?? [])
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

  const promptHtml = step.prompt
    ? `<div class="nr-label">Prompt (copy to OpenClaw)</div>
       <pre class="nr-prompt" id="nr-active-prompt">${escapeHtml(step.prompt)}</pre>
       <div class="nr-actions"><button type="button" id="nr-copy-prompt">Copy prompt</button></div>`
    : "";

  const expectFail = step.expectedFail
    ? `<p class="nr-expect fail">Before change: <strong>${escapeHtml(step.expectedFail)}</strong></p>`
    : "";
  const expectOk = step.expected
    ? `<p class="nr-expect">Expected: <strong>${escapeHtml(step.expected)}</strong></p>`
    : "";

  const commandHtml = step.command
    ? `<div class="nr-label">Run in terminal</div><code class="nr-cmd">${escapeHtml(step.command)}</code>`
    : "";

  container.innerHTML = `
    ${subNav}
    <div class="nr-card">
      <h2>${escapeHtml(step.id === "0" ? "0" : step.id.replace("-", " · "))} — ${escapeHtml(step.title)}</h2>
      <p class="nr-meta">${escapeHtml(step.timing)}</p>
      <div class="nr-body">${bodyHtml}</div>
      ${promptHtml}
      ${expectFail}
      ${commandHtml}
      ${expectOk}
      <div class="nr-diagram-wrap${flowAnimEnabled ? " nr-flows-on" : ""}">
        <div class="nr-diagram-head">
          <h3>Architecture (this step)</h3>
          <label class="nr-flow-toggle">
            <input type="checkbox" id="nr-flow-toggle"${flowAnimEnabled ? " checked" : ""}>
            <span>Flow animation</span>
          </label>
        </div>
        <div id="nr-diagram-target"></div>
        ${renderFlowLegend(flowAnimEnabled)}
      </div>
      <div id="nr-yaml-target"></div>
    </div>`;

  renderDiagram(container.querySelector("#nr-diagram-target"), step.diagram, step.layers, flowAnimEnabled);
  renderYamlPanel(container.querySelector("#nr-yaml-target"), step.yamlPanel);

  const flowToggle = container.querySelector("#nr-flow-toggle");
  if (flowToggle && onFlowAnimChange) {
    flowToggle.addEventListener("change", () => {
      onFlowAnimChange(flowToggle.checked);
    });
  }

  const copyBtn = container.querySelector("#nr-copy-prompt");
  if (copyBtn && step.prompt) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(step.prompt).then(() => {
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.textContent = "Copy prompt";
        }, 1500);
      });
    });
  }

  container.querySelectorAll(".nr-sub-nav button[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const stepId = btn.getAttribute("data-goto");
      container.dispatchEvent(
        new CustomEvent("narrative-goto", { bubbles: true, detail: { stepId } })
      );
    });
  });
}

function navGroupForStep(stepId) {
  return NAV_GROUPS.find((g) => g.steps.includes(stepId))?.id ?? stepId;
}

function updateNavActive(navEl, stepId) {
  const group = navGroupForStep(stepId);
  navEl.querySelectorAll("button[data-group]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.group === group);
    const g = NAV_GROUPS.find((x) => x.id === btn.dataset.group);
    btn.classList.toggle("has-sub", g && g.steps.length > 1);
  });
}

function updateHash(stepId) {
  const hash = `step-${stepId}`;
  if (location.hash !== `#${hash}`) {
    history.replaceState(null, "", `#${hash}`);
  }
}

function parseHash() {
  const m = location.hash.match(/^#step-(.+)$/);
  if (m && STEP_IDS.includes(m[1])) return m[1];
  return "0";
}

export function initNarrativeUI({ root, onStepChange }) {
  const navEl = root.querySelector("[data-nr-nav]");
  const layerEl = root.querySelector("[data-nr-layers]");
  const matrixEl = root.querySelector("[data-nr-matrix]");
  const cardEl = root.querySelector("[data-nr-card]");
  let currentId = parseHash();
  let flowAnimEnabled = localStorage.getItem(FLOW_ANIM_STORAGE_KEY) !== "false";

  function handleFlowAnimChange(enabled) {
    flowAnimEnabled = enabled;
    localStorage.setItem(FLOW_ANIM_STORAGE_KEY, String(enabled));
    const step = getStep(currentId);
    const wrap = cardEl.querySelector(".nr-diagram-wrap");
    wrap?.classList.toggle("nr-flows-on", enabled);
    cardEl.querySelector("#nr-flow-legend")?.toggleAttribute("hidden", !enabled);
    renderDiagram(
      cardEl.querySelector("#nr-diagram-target"),
      step.diagram,
      step.layers,
      enabled
    );
  }

  function applyStep(stepId) {
    if (!STEP_IDS.includes(stepId)) stepId = "0";
    currentId = stepId;
    const step = getStep(stepId);

    renderLayerBoard(layerEl, step.layers);
    renderMatrix(matrixEl, step.matrix, step.matrixFocus);
    renderStepCard(cardEl, step, { flowAnimEnabled, onFlowAnimChange: handleFlowAnimChange });
    updateNavActive(navEl, stepId);
    updateHash(stepId);
    const mainEl = root.querySelector(".nr-main");
    if (mainEl) {
      const top = mainEl.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
    }
    onStepChange?.(stepId, step);
    root.dispatchEvent(
      new CustomEvent("nr:step-change", {
        bubbles: true,
        detail: {
          stepId,
          observabilityFocus: step.observabilityFocus ?? null,
          observabilityHidden: step.observabilityHidden ?? [],
        },
      })
    );
  }

  NAV_GROUPS.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.group = g.id;
    btn.textContent = g.label;
    btn.addEventListener("click", () => applyStep(g.steps[0]));
    navEl.appendChild(btn);
  });

  root.addEventListener("narrative-goto", (e) => {
    applyStep(e.detail.stepId);
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select") || e.target.isContentEditable) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      applyStep(nextStepId(currentId));
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      applyStep(prevStepId(currentId));
    }
  });

  window.addEventListener("hashchange", () => {
    applyStep(parseHash());
  });

  applyStep(currentId);
  return { goTo: applyStep, getCurrentId: () => currentId };
}

export { STEP_IDS, NAV_GROUPS, getStep, stepIndex };
