/**
 * Shared FlowStory diagram config for overall-demo-architecture.html and v2 baseline embed.
 */

import { LAYER_NAMES } from "./shared-scenario.js";
import {
  buildOverallFlows,
  buildOverallMutations,
  buildOverallNodes,
  buildOverallResponseComparison,
  LAYER_BOARDS,
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
    { label: `${LAYER_NAMES.endUser} · ${LAYER_NAMES.controlUI}`, color: "#79c0ff" },
    { label: "Public egress (risk)", color: "#f78166" },
    { label: `${LAYER_NAMES.openClaw} · ${LAYER_NAMES.harness}`, color: "#f0883e" },
    { label: "Agent Sandbox", color: "#d2a8ff" },
    { label: "Inference request", color: "#58a6ff" },
    { label: "OpenShell Gateway", color: "#1f6feb" },
    { label: "NeMo Guardrails", color: "#2dd4bf" },
    { label: "Inference response", color: "#3fb950" },
    { label: "File policy (Landlock)", color: "#c9d1d9" },
    { label: "MLflow traces", color: "#e3b341" },
  ];
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
      initialStates: LAYER_BOARDS,
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
      initialStates: { baseline: LAYER_BOARDS.baseline },
      mutations: { baseline: base._baselineMergedMutations },
    },
    legend: base.legend,
  };
}
