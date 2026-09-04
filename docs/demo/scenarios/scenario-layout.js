/**
 * Pure layout constants and flow helpers (no FlowStory / DOM).
 * Imported by overall-flows.js and unit tests without browser deps.
 */

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

/** Layout grid — must match layers-logos.html (source of truth for arrow routing) */
export const COL_L = 292;
export const COL_R = 512;
export const CONTENT_L = 268;
export const INNER_W = 464;
export const CONTENT_R = CONTENT_L + INNER_W;
export const CONTAINER_PAD = COL_L - CONTENT_L;
export const OPENSHELL_X = 248;
export const OPENSHELL_W = 504;
export const SHELL_PAD = CONTENT_L - OPENSHELL_X;
export const CLUSTER_X = 228;
export const CLUSTER_W = 552;
export const CLUSTER_PAD = OPENSHELL_X - CLUSTER_X;
export const AGENTSB_H = 100;

export const OVERALL_CANVAS = { width: 820, height: 740 };
/** @deprecated use OVERALL_CANVAS */
export const CANVAS = OVERALL_CANVAS;

const NODE_FS = 12;

/** Node positions aligned with layers-logos.html */
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
    h: AGENTSB_H,
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
  file: {
    x: COL_R + BOX.w + 28,
    y: 162,
    w: 40,
    h: 40,
    label: "",
    color: "#8b949e",
    fontSize: 8,
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
    x: CONTENT_L,
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
  guardrailsLlm: {
    x: COL_L,
    y: 620,
    w: BOX.w,
    h: BOX.h,
    label: "Guardrails LLM",
    sublabel: "the guardrail model",
    color: COLORS.nemo,
    fontSize: NODE_FS,
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

/** Default lane offset for parallel in/out arrows on the same box edge. */
const LANE_H = 10;
const LANE_V = 12;

/** Node center X — used so top/bottom hops stay vertical (perpendicular to box edges). */
const OC_CX = COL_L + BOX.w / 2;
const GW_CX = CONTENT_L + INNER_W / 2;
const IR_CX = COL_R + BOX.w / 2;
const OC_GW_DX = GW_CX - OC_CX;

/** Five vertical oc ↔ gw lanes, evenly spaced inside OpenClaw box width. */
const OC_GW_LANE_COUNT = 5;
const OC_GW_LANE_PAD = LANE_V;
const OC_GW_LANE_STEP =
  (BOX.w - 2 * OC_GW_LANE_PAD) / (OC_GW_LANE_COUNT - 1);

function ocGwLaneAt(index) {
  return -BOX.w / 2 + OC_GW_LANE_PAD + index * OC_GW_LANE_STEP;
}

/** Left → right: band 1 out/in · band 8 out/in · band 9 trace. */
const OC_GW_LANES = {
  userOut: ocGwLaneAt(0),
  userIn: ocGwLaneAt(1),
  egressOut: ocGwLaneAt(2),
  egressIn: ocGwLaneAt(3),
  trace: ocGwLaneAt(4),
};

/** Three oc ↔ gw columns clustered at center (scenario A — user path + trace only). */
const OC_GW_SCENARIO_LANE_COUNT = 3;
const OC_GW_SCENARIO_STEP = LANE_V * 2;

function ocGwLaneScenario(index) {
  const span = (OC_GW_SCENARIO_LANE_COUNT - 1) * OC_GW_SCENARIO_STEP;
  return -span / 2 + index * OC_GW_SCENARIO_STEP;
}

const OC_GW_SCENARIO_LANES = {
  userOut: ocGwLaneScenario(0),
  userIn: ocGwLaneScenario(1),
  trace: ocGwLaneScenario(2),
};

/** Four oc ↔ gw columns clustered at center (scenario C after — no egress return). */
const OC_GW_SCENARIO_C_AFTER_LANE_COUNT = 4;
const OC_GW_SCENARIO_C_AFTER_STEP = LANE_V * 2;

function ocGwLaneScenarioCAfter(index) {
  const span = (OC_GW_SCENARIO_C_AFTER_LANE_COUNT - 1) * OC_GW_SCENARIO_C_AFTER_STEP;
  return -span / 2 + index * OC_GW_SCENARIO_C_AFTER_STEP;
}

const OC_GW_SCENARIO_C_AFTER_LANES = {
  userOut: ocGwLaneScenarioCAfter(0),
  userIn: ocGwLaneScenarioCAfter(1),
  egressOut: ocGwLaneScenarioCAfter(2),
  trace: ocGwLaneScenarioCAfter(3),
};

/** GW ↔ Internet band 8 — parallel diagonal lanes (constant Δx between endpoints). */
const GW_INTERNET_FROM_X = -210;
const INTERNET_EGRESS_TO_X = -LANE_V;
const INTERNET_RETURN_FROM_X = LANE_V;
const GW_INTERNET_PARALLEL_K = INTERNET_EGRESS_TO_X - GW_INTERNET_FROM_X;

/** Outbound lane: same slope for every attachment on GW bottom. */
function gwInternetOutbound(fromLane) {
  return { fromXOff: fromLane, toXOff: fromLane + GW_INTERNET_PARALLEL_K };
}

/** Return lane: mirror slope (toXOff − fromXOff = −K). */
function internetGwReturn(fromLane) {
  return { fromXOff: fromLane, toXOff: fromLane - GW_INTERNET_PARALLEL_K };
}

/** Same X on OpenClaw bottom and Gateway top (vertical segment). */
function ocGwVertical(ocLaneOff) {
  return { fromXOff: ocLaneOff, toXOff: ocLaneOff - OC_GW_DX };
}

/** Mirror: Gateway top → OpenClaw bottom on the same lane. */
function gwOcVertical(ocLaneOff) {
  return { fromXOff: ocLaneOff - OC_GW_DX, toXOff: ocLaneOff };
}

/** Gateway bottom → MLflow top on the same vertical column as oc ↔ gw trace. */
function gwMlflowVertical(ocLaneOff) {
  return { fromXOff: ocLaneOff - OC_GW_DX, toXOff: ocLaneOff };
}

/** Same X on inference.local bottom and Gateway top (ir → gw). */
function irGwVertical(x) {
  return { fromXOff: x - IR_CX, toXOff: x - GW_CX };
}

/** Same X on Gateway top and inference.local bottom (gw → ir). */
function gwIrVertical(x) {
  return { fromXOff: x - GW_CX, toXOff: x - IR_CX };
}

/** Arrow routing offsets — tuned for layers-logos.html node layout */
export const ARROW = {
  userToGw: { fromRight: true, toLeft: true, yOff: -LANE_H },
  gwToOc: {
    fromTop: true,
    toBottom: true,
    ...gwOcVertical(OC_GW_LANES.userIn),
    glow: "openshell",
  },
  ocToGwReply: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_LANES.userOut),
    glow: "openshell",
  },
  gwToUser: { fromLeft: true, toRight: true, yOff: LANE_H },
  /** Band 2 outbound — oc → ir (upper lane, within inference.local height). */
  ocToIr: { fromRight: true, toLeft: true, yOff: -LANE_H, glow: "openshell" },
  /** Band 2 return — ir → oc (lower lane, parallel to ocToIr). */
  irToOc: { fromLeft: true, toRight: true, yOff: LANE_H, glow: "openshell" },
  /** Band 3 outbound — ir → gw (left lane; vertical at both boxes). */
  irToGw: {
    fromBottom: true,
    toTop: true,
    ...irGwVertical(IR_CX - LANE_V),
    glow: "openshell",
  },
  /** Band 3 return — gw → ir (right lane; continues green column with bands 4–6). */
  gwToIr: {
    fromTop: true,
    toBottom: true,
    ...gwIrVertical(IR_CX + LANE_V),
    glow: "openshell",
  },
  ocToLandlock: { fromRight: true, toLeft: true, yOff: -LANE_H, glow: "agentsb" },
  landlockToOc: { fromLeft: true, toRight: true, yOff: LANE_H, glow: "agentsb" },
  landlockToFile: { fromRight: true, toLeft: true },
  /** Band 8 — oc → gw (egress outbound; left lane). */
  ocToGw: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_LANES.egressOut),
    glow: "openshell",
  },
  /** Band 8 outbound — gw → internet (left lane; parallel with return). */
  gwToInternet: {
    fromBottom: true,
    toTop: true,
    ...gwInternetOutbound(GW_INTERNET_FROM_X),
  },
  /** Band 8 return — internet → gw (right lane; parallel with outbound). */
  internetToGw: {
    fromTop: true,
    toBottom: true,
    ...internetGwReturn(INTERNET_RETURN_FROM_X),
  },
  /** Band 8 return — gw → oc (egress return; right lane, parallel with ocToGw). */
  gwToOcReturn: {
    fromTop: true,
    toBottom: true,
    ...gwOcVertical(OC_GW_LANES.egressIn),
    glow: "openshell",
  },
  gwToNemo: { fromBottom: true, toTop: true, fromXOff: 74, toXOff: -LANE_V },
  nemoToMaas: { fromBottom: true, toTop: true, fromXOff: -LANE_V, toXOff: -LANE_V },
  irToMaas: { fromBottom: true, toTop: true, fromXOff: -LANE_V, toXOff: -LANE_V },
  irToNemo: { fromBottom: true, toTop: true, fromXOff: -LANE_V, toXOff: -LANE_V },
  gwToMaas: { fromBottom: true, toTop: true, fromXOff: 74, toXOff: -LANE_V },
  maasToLlm: { fromBottom: true, toTop: true, fromXOff: -LANE_V, toXOff: -LANE_V },
  llmToMaas: { fromTop: true, toBottom: true, fromXOff: LANE_V, toXOff: LANE_V },
  maasToGuardrailsLlm: { fromBottom: true, toTop: true, fromXOff: -LANE_V, toXOff: LANE_V },
  maasToNemo: { fromTop: true, toBottom: true, fromXOff: LANE_V, toXOff: LANE_V },
  nemoToGw: { fromTop: true, toBottom: true, fromXOff: LANE_V, toXOff: 98 },
  /** Band 9 — oc → gw trace (own column; separated from bands 1/8). */
  ocToGwTrace: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_LANES.trace),
    glow: "openshell",
  },
  /** Band 9 — gw → mlflow (continues trace column vertically). */
  gwToMlflow: {
    fromBottom: true,
    toTop: true,
    ...gwMlflowVertical(OC_GW_LANES.trace),
  },
  /** Legacy direct trace — prefer ocToGwTrace + gwToMlflow (same as baseline band 9). */
  ocToMlflow: {
    fromBottom: true,
    toTop: true,
    fromXOff: 0,
    toXOff: 0,
    glow: "openshell",
  },
};

/** Compact oc ↔ gw routing for scenario A (user + trace lanes only). */
export const ARROW_SCENARIO_OC_GW = {
  gwToOc: {
    fromTop: true,
    toBottom: true,
    ...gwOcVertical(OC_GW_SCENARIO_LANES.userIn),
    glow: "openshell",
  },
  ocToGwReply: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_SCENARIO_LANES.userOut),
    glow: "openshell",
  },
  ocToGwTrace: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_SCENARIO_LANES.trace),
    glow: "openshell",
  },
  gwToMlflow: {
    fromBottom: true,
    toTop: true,
    ...gwMlflowVertical(OC_GW_SCENARIO_LANES.trace),
  },
};

/** Compact oc ↔ gw routing for scenario C after (user + egress + trace; no return lane). */
export const ARROW_SCENARIO_OC_GW_C_AFTER = {
  gwToOc: {
    fromTop: true,
    toBottom: true,
    ...gwOcVertical(OC_GW_SCENARIO_C_AFTER_LANES.userIn),
    glow: "openshell",
  },
  ocToGwReply: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_SCENARIO_C_AFTER_LANES.userOut),
    glow: "openshell",
  },
  ocToGw: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_SCENARIO_C_AFTER_LANES.egressOut),
    glow: "openshell",
  },
  ocToGwTrace: {
    fromBottom: true,
    toTop: true,
    ...ocGwVertical(OC_GW_SCENARIO_C_AFTER_LANES.trace),
    glow: "openshell",
  },
  gwToMlflow: {
    fromBottom: true,
    toTop: true,
    ...gwMlflowVertical(OC_GW_SCENARIO_C_AFTER_LANES.trace),
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
