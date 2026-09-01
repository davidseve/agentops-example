/**
 * Shared FlowStory diagram config for overall-demo-architecture.html and v2 baseline embed.
 */

import { LAYER_NAMES } from "./shared-scenario.js";
import {
  buildOverallFlows,
  buildOverallMutations,
  buildOverallNodes,
  buildOverallResponseComparison,
  buildFilteredLayerBoards,
  collectNodesFromSteps,
  filterLayerBoard,
  getScenarioFlowBundle,
  layerIdsFromMutations,
  OVERALL_CANVAS,
  OVERALL_FLOW_ORDER,
} from "./overall-flows.js";

const DIRECT_INFERENCE_PATH = `${LAYER_NAMES.ir} → ${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}`;

function buildTooltips() {
  return {
    user: {
      title: LAYER_NAMES.endUser,
      description: `The end user reaches ${LAYER_NAMES.openClaw} through the ${LAYER_NAMES.gw} — never a direct hop into the sandbox. ${LAYER_NAMES.controlUI} behind the nginx mTLS bridge.`,
      details: [
        ["Owner", "Customer (BYOA)"],
        ["Platform", "nginx bridge on OpenShift"],
        ["ADR", "0011"],
      ],
    },
    oc: {
      title: `${LAYER_NAMES.openClaw} — ${LAYER_NAMES.harness}`,
      description:
        "Runs inside the Agent Sandbox. The customer brings the agent; Red Hat isolates, observes, and governs it.",
      details: [
        ["Owner", "Customer"],
        ["Product", "Not Red Hat"],
        ["Runs in", "Agent Sandbox"],
      ],
    },
    landlock: {
      title: "Landlock filesystem policy",
      description: "Inside the Agent Sandbox. Landlock blocks /etc/shadow and secrets from minute zero.",
      details: [
        ["Owner", "Red Hat Agent Sandbox"],
        ["State", "Locked"],
        ["Policy", "config/openshell/default.yaml"],
      ],
    },
    ir: {
      title: LAYER_NAMES.ir,
      description: `OpenShell inference router. Injects the MaaS API key — the agent process never sees it.`,
      details: [
        ["Owner", "NVIDIA OpenShell on OpenShift"],
        ["Path", DIRECT_INFERENCE_PATH],
      ],
    },
    gw: {
      title: "OpenShell Gateway",
      description: `Choke point inside OpenShell. User entry via ${LAYER_NAMES.controlUI}; all sandbox egress goes through the gateway.`,
      details: [
        ["Owner", "NVIDIA OpenShell on OpenShift"],
        ["Role", "Egress + inference router"],
        ["Policy", "nftables / network_policies"],
      ],
    },
    nemo: {
      title: "NeMo Guardrails",
      description: "Input/output rails on the inference hop. Off at demo start; enabled live in Cambio 2 (Test D).",
      details: [
        ["Product", "RHOAI · TrustyAI"],
        ["Rails", "NVIDIA NeMo Guardrails"],
        ["ADR", "0004"],
      ],
    },
    maas: {
      title: "Models as a Service",
      description: "Serving gateway. Calls the LLM — the agent never talks to the model directly.",
      details: [
        ["Product", "RHOAI"],
        ["Role", "Model serving gateway"],
      ],
    },
    llm: {
      title: "LLM",
      description: "The model MaaS calls. Last hop on the inference path.",
      details: [
        ["Served by", "MaaS"],
        ["Role", "LLM inference"],
      ],
    },
    internet: {
      title: LAYER_NAMES.internet,
      description: `Public egress. curl allowed in demo-initial policy (Test C) until Cambio 1.`,
      details: [
        ["Path", `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} → ${LAYER_NAMES.internet}`],
        ["Policy", "nftables / network_policies"],
      ],
    },
    mlflow: {
      title: LAYER_NAMES.mlflow,
      description: "One tracking server. Agent traces from the first token (mlflow-openclaw plugin).",
      details: [
        ["Product", "RHOAI · MLflow"],
        ["ADR", "0010"],
      ],
    },
  };
}

function buildLegend() {
  return [
    { label: LAYER_NAMES.endUser, color: "#79c0ff" },
    { label: LAYER_NAMES.internet, color: "#f78166" },
    { label: `${LAYER_NAMES.openClaw} · ${LAYER_NAMES.harness}`, color: "#f0883e" },
    { label: "Agent Sandbox", color: "#d2a8ff" },
    { label: "Inference hop", color: "#58a6ff" },
    { label: LAYER_NAMES.gw, color: "#1f6feb" },
    { label: LAYER_NAMES.nemo, color: "#2dd4bf" },
    { label: `${LAYER_NAMES.maas} / ${LAYER_NAMES.llm}`, color: "#3fb950" },
    { label: "MLflow traces", color: "#e3b341" },
  ];
}

/** Legend item index → node ids used on canvas (for per-scenario filtering). */
const LEGEND_NODE_SETS = [
  ["user"],
  ["internet"],
  ["oc"],
  ["oc", "agentsb"],
  ["ir"],
  ["gw"],
  ["nemo"],
  ["maas", "llm"],
  ["mlflow"],
];

function filterLegendForNodes(legend, activeNodeIds) {
  const active = activeNodeIds instanceof Set ? activeNodeIds : new Set(activeNodeIds);
  return legend.filter((_, index) => {
    const nodes = LEGEND_NODE_SETS[index] ?? [];
    return nodes.some((id) => active.has(id));
  });
}

function applyNodeOverrides(nodes, overrides = {}) {
  const next = { ...nodes };
  for (const [key, patch] of Object.entries(overrides)) {
    if (next[key]) next[key] = { ...next[key], ...patch };
  }
  return next;
}

function mergeTooltips(overrides = {}) {
  const base = buildTooltips();
  const merged = { ...base };
  for (const [key, patch] of Object.entries(overrides)) {
    merged[key] = { ...base[key], ...patch };
  }
  return merged;
}

function buildDiagramBase() {
  const allFlows = buildOverallFlows();
  const responseComparison = buildOverallResponseComparison();
  const baselineMerged =
    responseComparison.flows.baseline?.mergedMutations ?? buildOverallMutations().baseline;

  return {
    meta: {
      title: "AgentOps - Platform Architecture",
      branding: {
        logo: "../shared/assets/redhat-logo.svg",
        title: "Red Hat",
      },
    },
    canvas: OVERALL_CANVAS,
    nodes: buildOverallNodes(),
    tooltips: buildTooltips(),
    legend: buildLegend(),
    defaultFlow: "baseline",
    inspector: {
      initialStates: buildFilteredLayerBoards(),
      mutations: buildOverallMutations(),
    },
    _baselineMergedMutations: baselineMerged,
    _allFlows: allFlows,
  };
}

/** Full overall map — all scenario flows in the dropdown. */
export function buildOverallDiagram() {
  const base = buildDiagramBase();
  return {
    meta: {
      ...base.meta,
      branding: {
        logo: "./shared/assets/redhat-logo.svg",
        title: "Red Hat",
      },
    },
    canvas: base.canvas,
    nodes: base.nodes,
    tooltips: base.tooltips,
    flows: base._allFlows,
    flowOrder: OVERALL_FLOW_ORDER,
    defaultFlow: base.defaultFlow,
    inspector: base.inspector,
    legend: base.legend,
  };
}

/** Baseline-only diagram for v2 live companion step 0. */
export function buildBaselineDiagram() {
  const base = buildDiagramBase();
  return {
    meta: base.meta,
    canvas: base.canvas,
    nodes: base.nodes,
    tooltips: base.tooltips,
    flows: { baseline: base._allFlows.baseline },
    flowOrder: ["baseline"],
    defaultFlow: "baseline",
    inspector: {
      initialStates: { baseline: buildFilteredLayerBoards().baseline },
      mutations: { baseline: base._baselineMergedMutations },
    },
    legend: base.legend,
  };
}

/**
 * Self-contained test page diagram — same hops/nodes/ARROW routing as overall map scenario flow.
 * @param {string} flowId — e.g. "scenario-a"
 * @param {{ title?: string, gwSublabel?: string, nodeOverrides?: object, tooltipOverrides?: object }} options
 */
export function buildScenarioPageDiagram(flowId, options = {}) {
  const bundle = getScenarioFlowBundle(flowId);
  const comparison = buildOverallResponseComparison().flows[flowId];
  if (!comparison) {
    throw new Error(`No response comparison for scenario flow: ${flowId}`);
  }

  const nodeOverrides = { ...(options.nodeOverrides ?? {}) };
  if (options.gwSublabel) {
    nodeOverrides.gw = { ...nodeOverrides.gw, sublabel: options.gwSublabel };
  }

  const activeNodes = collectNodesFromSteps(bundle.steps);
  const filteredBoard = filterLayerBoard(
    bundle.layerBoard,
    layerIdsFromMutations(bundle.mutations)
  );

  return {
    meta: {
      title: options.title ?? bundle.label,
      branding: {
        logo: "../shared/assets/redhat-logo.svg",
        title: "Red Hat",
      },
    },
    canvas: OVERALL_CANVAS,
    nodes: applyNodeOverrides(buildOverallNodes(), nodeOverrides),
    tooltips: mergeTooltips(options.tooltipOverrides),
    flows: {
      main: {
        label: bundle.label,
        steps: bundle.steps,
      },
    },
    flowOrder: ["main"],
    defaultFlow: "main",
    inspector: {
      initialState: filteredBoard,
      mutations: { main: bundle.mutations },
    },
    legend: filterLegendForNodes(buildLegend(), activeNodes),
    _responseComparison: {
      flowId: "main",
      baseMutations: comparison.baseMutations,
      mergedMutations: comparison.mergedMutations,
      overlays: comparison.overlays,
      responseMap: comparison.responseMap,
    },
    _phaseRest: {
      main: bundle.phaseRest,
    },
  };
}
