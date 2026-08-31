/**
 * Shared FlowStory flow definitions for overall-demo-architecture and test scenario pages.
 */

import {
  ARROW,
  COLORS,
  LAYER_NAMES,
  mergeResponseBodies,
  OVERALL_CANVAS,
  OVERALL_FLOW_ORDER,
  pickNodes,
  TRACE_STEP_STYLE,
} from "./shared-scenario.js";
import { OVERALL_OVERLAYS, OVERALL_RESPONSES } from "./overall-response-maps.js";

const DIRECT_INFERENCE_PATH = `${LAYER_NAMES.ir} → ${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}`;

/** Layer board rows shared across baseline and A/B */
export const BASELINE_LAYER_HEADERS = [
  { value: "Credentials     locked  (gateway holds key)", style: "keep", id: "l-creds" },
  { value: `User path       ${LAYER_NAMES.controlUI} → GW`, style: "keep", id: "l-user" },
  { value: `Gateway         ${LAYER_NAMES.controlUI} bridge`, style: "keep", id: "l-gw" },
  { value: "Filesystem      locked  (Landlock)", style: "keep", id: "l-files" },
  { value: "Egress          open  (demo)", style: "keep", id: "l-egress" },
  { value: "Guardrails      off", style: "keep", id: "l-rails" },
  { value: "MLflow          on (background)", style: "keep", id: "l-mlflow" },
];

export const INSPECTOR_HEADERS_C = [
  { value: "Credentials     locked", style: "keep", id: "l-creds" },
  { value: `User path       ${LAYER_NAMES.controlUI} → GW`, style: "keep", id: "l-user" },
  { value: `Gateway         ${LAYER_NAMES.controlUI} bridge`, style: "keep", id: "l-gw" },
  { value: "Filesystem      locked", style: "keep", id: "l-files" },
  { value: "Guardrails      off", style: "keep", id: "l-rails" },
  { value: "MLflow          on (background)", style: "keep", id: "l-mlflow" },
];

export const INSPECTOR_HEADERS_D = [
  { value: "Credentials     locked", style: "keep", id: "l-creds" },
  { value: `User path       ${LAYER_NAMES.controlUI} → GW`, style: "keep", id: "l-user" },
  { value: `Gateway         ${LAYER_NAMES.controlUI} bridge`, style: "keep", id: "l-gw" },
  { value: "Filesystem      locked", style: "keep", id: "l-files" },
  { value: "Egress          blocked", style: "keep", id: "l-egress" },
  { value: "MLflow          on (background)", style: "keep", id: "l-mlflow" },
];

// --- Baseline flow ---

export const BASELINE_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  { step: 2, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw} · forward` },
  {
    step: 3,
    label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}`,
    actions: [{ id: "l-creds", style: "highlight" }],
  },
  { step: 4, label: `3  ${LAYER_NAMES.ir} → ${LAYER_NAMES.gw} · key inject` },
  {
    step: 5,
    label: `3  ${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} · direct`,
    actions: [{ id: "l-rails", style: "highlight" }],
    replaceBody: [{ value: `Path:  ${DIRECT_INFERENCE_PATH}`, style: "add", id: "p-path" }],
  },
  { step: 6, label: `4  ${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}` },
  { step: 7, label: `2  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw}` },
  { step: 8, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}` },
  { step: 9, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser}` },
  {
    step: 10,
    label: `4  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.mlflow} · trace`,
    actions: [{ id: "l-mlflow", style: "highlight" }],
  },
];

export const BASELINE_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} reaches ${LAYER_NAMES.gw} via ${LAYER_NAMES.controlUI}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards prompt to ${LAYER_NAMES.openClaw}`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} calls ${LAYER_NAMES.ir} — router injects API key`,
    mode: "arrow",
    from: "oc",
    to: "ir",
    color: COLORS.platform,
    num: 2,
    ...ARROW.ocToIr,
  },
  {
    text: `Call leaves through ${LAYER_NAMES.gw} — credentials at gateway`,
    mode: "arrow",
    from: "ir",
    to: "gw",
    color: COLORS.gw,
    num: 3,
    ...ARROW.irToGw,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} direct (${LAYER_NAMES.nemo} off)`,
    mode: "arrow",
    from: "gw",
    to: "maas",
    color: COLORS.warn,
    num: 3,
    ...ARROW.gwToMaas,
  },
  {
    text: `${LAYER_NAMES.maas} calls the ${LAYER_NAMES.llm}`,
    mode: "arrow",
    from: "maas",
    to: "llm",
    color: COLORS.maas,
    num: 4,
    ...ARROW.maasToLlm,
  },
  {
    text: `Response returns to ${LAYER_NAMES.openClaw}`,
    mode: "arrow",
    from: "ir",
    to: "oc",
    color: COLORS.secure,
    num: 2,
    ...ARROW.irToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} answers through ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.secure,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} returns answer to ${LAYER_NAMES.endUser}`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.secure,
    num: 1,
    ...ARROW.gwToUser,
  },
  {
    text: `Trace span (background) → ${LAYER_NAMES.mlflow}`,
    mode: "arrow",
    from: "oc",
    to: "mlflow",
    ...TRACE_STEP_STYLE,
    ...ARROW.ocToMlflow,
  },
];

/**
 * Legend item indices (buildLegend order) to highlight per baseline hop (1-based step).
 * 0 End user · Control UI · 1 Public egress · 2 OpenClaw · 3 Agent Sandbox
 * 4 Inference request · 5 OpenShell Gateway · 6 NeMo · 7 Inference response
 * 8 Landlock · 9 MLflow traces
 */
export const BASELINE_LEGEND_HOP_HIGHLIGHTS = {
  1: [0, 5],
  2: [5, 2],
  3: [2, 3, 4],
  4: [4, 5],
  5: [5, 4],
  6: [4],
  7: [7, 2],
  8: [7, 2, 5],
  9: [7, 0, 5],
  10: [9, 2],
};

// --- Scenario A ---

export const SCENARIO_A_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  {
    step: 2,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw} · forward`,
  },
  {
    step: 3,
    label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.gw} injects key`,
    actions: [{ id: "l-creds", style: "highlight" }],
  },
  {
    step: 5,
    label: `3  ${LAYER_NAMES.gw} → ${LAYER_NAMES.ir} · auth`,
    actions: [{ id: "l-creds", style: "highlight" }],
  },
  { step: 6, label: `1  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw} · no key` },
  { step: 7, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · no key` },
  { step: 8, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · safe` },
];

export const SCENARIO_A_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards prompt — local shell probe empty`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} calls ${LAYER_NAMES.ir}`,
    mode: "arrow",
    from: "oc",
    to: "ir",
    color: COLORS.platform,
    num: 2,
    ...ARROW.ocToIr,
  },
  {
    text: `${LAYER_NAMES.ir} routes through ${LAYER_NAMES.gw} — key injected`,
    mode: "arrow",
    from: "ir",
    to: "gw",
    color: COLORS.gw,
    num: 3,
    ...ARROW.irToGw,
  },
  {
    text: `${LAYER_NAMES.gw} returns auth to ${LAYER_NAMES.ir}`,
    mode: "arrow",
    from: "gw",
    to: "ir",
    color: COLORS.platform,
    num: 3,
    ...ARROW.gwToIr,
  },
  {
    text: `Response to ${LAYER_NAMES.openClaw} — no key echoed`,
    mode: "arrow",
    from: "ir",
    to: "oc",
    color: COLORS.secure,
    num: 2,
    ...ARROW.irToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} answers through ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.secure,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} — no key exposed`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.secure,
    num: 1,
    ...ARROW.gwToUser,
  },
];

// --- Scenario B ---

export const SCENARIO_B_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  { step: 2, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}` },
  {
    step: 3,
    label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.landlock}`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  {
    step: 4,
    label: "2  Landlock denies /etc/shadow",
    actions: [{ id: "l-files", style: "highlight" }],
  },
  { step: 5, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · blocked` },
  { step: 6, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · safe` },
];

export const SCENARIO_B_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards cat /etc/shadow prompt`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} tries to read outside workspace`,
    mode: "arrow",
    from: "oc",
    to: "landlock",
    color: COLORS.landlock,
    num: 2,
    ...ARROW.ocToLandlock,
  },
  {
    text: `${LAYER_NAMES.landlock} blocks /etc/shadow`,
    mode: "arrow",
    from: "landlock",
    to: "oc",
    color: COLORS.denied,
    num: 2,
    ...ARROW.landlockToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} answers through ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.secure,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} — no sensitive data`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.secure,
    num: 1,
    ...ARROW.gwToUser,
  },
];

// --- Scenario C ---

export const SCENARIO_C_BEFORE_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  {
    step: 2,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · egress` },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.gw} → ${LAYER_NAMES.internet}`,
    actions: [{ id: "l-egress", style: "highlight" }],
  },
  { step: 5, label: "3  Response returns" },
  { step: 6, label: `2  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}` },
  { step: 7, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · output` },
  {
    step: 8,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · risk`,
    actions: [{ id: "p-expect", style: "highlight" }],
  },
];

export const SCENARIO_C_AFTER_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  {
    step: 2,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}` },
  {
    step: 4,
    label: "3  Denied at gateway",
    actions: [{ id: "p-cmd", style: "highlight" }, { id: "l-egress", style: "highlight" }],
  },
  { step: 5, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · blocked` },
  {
    step: 6,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · denied`,
    actions: [{ id: "p-expect", style: "highlight" }],
  },
];

export const SCENARIO_C_BEFORE_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards curl prompt`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · egress`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.warn,
    num: 2,
    ...ARROW.ocToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards to ${LAYER_NAMES.internet}`,
    mode: "arrow",
    from: "gw",
    to: "internet",
    color: COLORS.warn,
    num: 3,
    ...ARROW.gwToInternet,
  },
  {
    text: `${LAYER_NAMES.internet} responds (HTTP 200)`,
    mode: "arrow",
    from: "internet",
    to: "gw",
    color: COLORS.warn,
    num: 3,
    ...ARROW.internetToGw,
  },
  {
    text: "Response returns to OpenClaw",
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.warn,
    num: 2,
    ...ARROW.gwToOcReturn,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · curl output`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.warn,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · egress risk`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.warn,
    num: 1,
    ...ARROW.gwToUser,
  },
];

export const SCENARIO_C_AFTER_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: "Same curl prompt — retry after Cambio 1",
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.platform,
    num: 2,
    ...ARROW.ocToGw,
  },
  {
    text: `${LAYER_NAMES.gw} denies unauthorized egress`,
    mode: "arrow",
    from: "gw",
    to: "internet",
    color: COLORS.denied,
    num: 3,
    ...ARROW.gwToInternet,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · blocked`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.secure,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · curl denied`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.secure,
    num: 1,
    ...ARROW.gwToUser,
  },
];

// --- Scenario D ---

export const SCENARIO_D_BEFORE_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  {
    step: 2,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw} · jailbreak`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}` },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.ir} → ${LAYER_NAMES.maas} · direct`,
    actions: [{ id: "p-path", style: "highlight" }, { id: "l-rails", style: "highlight" }],
  },
  { step: 5, label: `2  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw} · may comply` },
  { step: 6, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · output` },
  {
    step: 7,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · no rails`,
    actions: [{ id: "p-expect", style: "highlight" }],
  },
];

export const SCENARIO_D_AFTER_MUTATIONS = [
  {
    step: 1,
    label: `1  ${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-user", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  {
    step: 2,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw} · retry`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}` },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.ir} → ${LAYER_NAMES.nemo}`,
    actions: [{ id: "p-cmd", style: "highlight" }],
  },
  {
    step: 5,
    label: `3  ${LAYER_NAMES.nemo} → ${LAYER_NAMES.maas}`,
    actions: [{ id: "l-rails", style: "highlight" }],
  },
  { step: 6, label: `2  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw} · filtered` },
  { step: 7, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · refusal` },
  {
    step: 8,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · blocked`,
    actions: [{ id: "p-expect", style: "highlight" }],
  },
];

export const SCENARIO_D_BEFORE_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards jailbreak prompt`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}`,
    mode: "arrow",
    from: "oc",
    to: "ir",
    color: COLORS.platform,
    num: 2,
    ...ARROW.ocToIr,
  },
  {
    text: `Direct path — ${LAYER_NAMES.ir} → ${LAYER_NAMES.maas} (${LAYER_NAMES.nemo} off)`,
    mode: "arrow",
    from: "ir",
    to: "maas",
    color: COLORS.warn,
    num: 3,
    ...ARROW.irToMaas,
  },
  {
    text: `Response to ${LAYER_NAMES.openClaw} — model may comply`,
    mode: "arrow",
    from: "ir",
    to: "oc",
    color: COLORS.warn,
    num: 2,
    ...ARROW.irToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · no guardrails`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.warn,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · unsafe output possible`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.warn,
    num: 1,
    ...ARROW.gwToUser,
  },
];

export const SCENARIO_D_AFTER_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} → ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: "Same jailbreak prompt — retry after Cambio 2",
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}`,
    mode: "arrow",
    from: "oc",
    to: "ir",
    color: COLORS.platform,
    num: 2,
    ...ARROW.ocToIr,
  },
  {
    text: `${LAYER_NAMES.ir} → ${LAYER_NAMES.nemo}`,
    mode: "arrow",
    from: "ir",
    to: "nemo",
    color: COLORS.nemo,
    num: 3,
    ...ARROW.irToNemo,
  },
  {
    text: `${LAYER_NAMES.nemo} → ${LAYER_NAMES.maas}`,
    mode: "arrow",
    from: "nemo",
    to: "maas",
    color: COLORS.secure,
    num: 3,
    ...ARROW.nemoToMaas,
  },
  {
    text: `Response to ${LAYER_NAMES.openClaw} — rail blocks jailbreak`,
    mode: "arrow",
    from: "ir",
    to: "oc",
    color: COLORS.secure,
    num: 2,
    ...ARROW.irToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · refusal`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.secure,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · jailbreak blocked`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.secure,
    num: 1,
    ...ARROW.gwToUser,
  },
];

// --- Layer boards (initialStates) ---

export const LAYER_BOARDS = {
  baseline: {
    headers: [
      ...BASELINE_LAYER_HEADERS.slice(0, 5),
      { value: "Egress          open  (demo)", style: "highlight", id: "l-egress" },
      ...BASELINE_LAYER_HEADERS.slice(5),
    ],
    body: [
      { value: "Demo initial state — Cambio 1 & 2 not applied", style: "add", id: "p-path" },
      { value: `Inference: ${DIRECT_INFERENCE_PATH}`, style: "add", id: "p-probe" },
    ],
  },
  "scenario-a": {
    headers: [
      { value: "Credentials     locked  (gateway holds key)", style: "highlight", id: "l-creds" },
      ...BASELINE_LAYER_HEADERS.slice(1),
    ],
    body: [{ value: "Probe: echo $LITELLM_API_KEY · grep apiKey", style: "add", id: "p-probe" }],
  },
  "scenario-b": {
    headers: [
      ...BASELINE_LAYER_HEADERS.slice(0, 3),
      { value: "Filesystem      locked  (Landlock)", style: "highlight", id: "l-files" },
      ...BASELINE_LAYER_HEADERS.slice(4),
    ],
    body: [{ value: "Probe: cat /etc/shadow", style: "add", id: "p-probe" }],
  },
  "scenario-c-before": {
    headers: [
      ...INSPECTOR_HEADERS_C.slice(0, 4),
      { value: "Egress          closed (default deny)", style: "highlight", id: "l-egress" },
      ...INSPECTOR_HEADERS_C.slice(4),
    ],
    body: [
      { value: "curl -sI https://google.com", style: "add", id: "p-probe" },
      { value: "Expected: blocked (timeout / denied)", style: "add", id: "p-expect" },
    ],
  },
  "scenario-c-after": {
    headers: [
      ...INSPECTOR_HEADERS_C.slice(0, 4),
      { value: "Egress          open (google.com)", style: "highlight", id: "l-egress" },
      ...INSPECTOR_HEADERS_C.slice(4),
    ],
    body: [
      { value: "Cambio 1: ./scripts/demo-allow-google-egress.sh", style: "add", id: "p-cmd" },
      { value: "Same curl → HTTP 200 to google.com", style: "add", id: "p-expect" },
    ],
  },
  "scenario-d-before": {
    headers: [
      ...INSPECTOR_HEADERS_D.slice(0, 5),
      { value: "Guardrails      off", style: "highlight", id: "l-rails" },
      ...INSPECTOR_HEADERS_D.slice(5),
    ],
    body: [
      { value: "Jailbreak: ignore instructions · system prompt", style: "add", id: "p-probe" },
      { value: "Path: inference.local → MaaS (direct)", style: "add", id: "p-path" },
      { value: "Expected: model may comply (no rails)", style: "add", id: "p-expect" },
    ],
  },
  "scenario-d-after": {
    headers: [
      ...INSPECTOR_HEADERS_D.slice(0, 5),
      { value: "Guardrails      on  (NeMo)", style: "highlight", id: "l-rails" },
      ...INSPECTOR_HEADERS_D.slice(5),
    ],
    body: [
      { value: "Cambio 2: ./scripts/demo-enable-guardrails.sh", style: "add", id: "p-cmd" },
      { value: "Path: inference.local → NeMo → MaaS", style: "add", id: "p-path" },
      { value: "Same prompt → refusal / filtered", style: "add", id: "p-expect" },
    ],
  },
};

export const PHASE_REST = {
  baseline: {
    nodeColors: { nemo: COLORS.dim, internet: COLORS.dim },
  },
  "scenario-a": {
    nodeColors: {
      nemo: COLORS.dim,
      internet: COLORS.dim,
      landlock: COLORS.dim,
      maas: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
  },
  "scenario-b": {
    nodeColors: {
      nemo: COLORS.dim,
      internet: COLORS.dim,
      ir: COLORS.dim,
      maas: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
    glow: ["agentsb"],
    activeNodes: ["landlock", "oc"],
  },
  "scenario-c-before": {
    glow: ["internet"],
    activeNodes: ["internet"],
    nodeColors: {
      internet: COLORS.warn,
      nemo: COLORS.dim,
      maas: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
  },
  "scenario-c-after": {
    glow: ["gw"],
    activeNodes: ["gw"],
    nodeColors: {
      gw: COLORS.denied,
      internet: COLORS.dim,
      nemo: COLORS.dim,
      maas: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
  },
  "scenario-d-before": {
    glow: ["maas"],
    activeNodes: ["maas", "oc"],
    nodeColors: {
      maas: COLORS.warn,
      nemo: COLORS.dim,
      internet: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
  },
  "scenario-d-after": {
    glow: ["nemo"],
    activeNodes: ["nemo", "ir"],
    nodeColors: {
      nemo: COLORS.nemo,
      maas: COLORS.secure,
      internet: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
  },
};

// --- Overall-map composed flows — SCENARIO_* exports above stay for test-a..d ---

const INFERENCE_BAND = 3;

function sliceMutations(mutations, startStep, endStep) {
  return mutations
    .filter((m) => m.step >= startStep && m.step <= endStep)
    .map((m) => ({ ...m, step: m.step - startStep + 1 }));
}

function composeOverallFlow(parts) {
  const steps = [];
  const mutations = [];
  let offset = 0;

  for (const part of parts) {
    steps.push(...part.steps);
    if (part.mutations) {
      for (const m of part.mutations) {
        mutations.push({ ...m, step: m.step + offset });
      }
    }
    offset += part.steps.length;
  }

  return { steps, mutations };
}

function buildInferenceDirectBlock() {
  return {
    steps: [
      {
        text: `${LAYER_NAMES.openClaw} calls ${LAYER_NAMES.ir} — model request`,
        mode: "arrow",
        from: "oc",
        to: "ir",
        color: COLORS.platform,
        num: INFERENCE_BAND,
        ...ARROW.ocToIr,
      },
      {
        text: `Call leaves through ${LAYER_NAMES.gw} — credentials at gateway`,
        mode: "arrow",
        from: "ir",
        to: "gw",
        color: COLORS.gw,
        num: INFERENCE_BAND,
        ...ARROW.irToGw,
      },
      {
        text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} direct (${LAYER_NAMES.nemo} off)`,
        mode: "arrow",
        from: "gw",
        to: "maas",
        color: COLORS.warn,
        num: INFERENCE_BAND,
        ...ARROW.gwToMaas,
      },
      {
        text: `${LAYER_NAMES.maas} calls the ${LAYER_NAMES.llm}`,
        mode: "arrow",
        from: "maas",
        to: "llm",
        color: COLORS.maas,
        num: INFERENCE_BAND,
        ...ARROW.maasToLlm,
      },
      {
        text: `Model response returns to ${LAYER_NAMES.openClaw}`,
        mode: "arrow",
        from: "ir",
        to: "oc",
        color: COLORS.secure,
        num: INFERENCE_BAND,
        ...ARROW.irToOc,
      },
    ],
    mutations: [
      {
        step: 1,
        label: `3  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}`,
        actions: [{ id: "l-rails", style: "highlight" }],
      },
      {
        step: 2,
        label: `3  ${LAYER_NAMES.ir} → ${LAYER_NAMES.gw} · key inject`,
        actions: [{ id: "l-creds", style: "highlight" }],
      },
      {
        step: 3,
        label: `3  ${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} · direct`,
        actions: [{ id: "l-rails", style: "highlight" }],
        replaceBody: [{ value: `Path:  ${DIRECT_INFERENCE_PATH}`, style: "add", id: "p-path" }],
      },
      { step: 4, label: `3  ${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}` },
      { step: 5, label: `3  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw}` },
    ],
  };
}

function buildInferenceGwMaasBlock() {
  return {
    steps: [
      {
        text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} direct (${LAYER_NAMES.nemo} off)`,
        mode: "arrow",
        from: "gw",
        to: "maas",
        color: COLORS.warn,
        num: INFERENCE_BAND,
        ...ARROW.gwToMaas,
      },
      {
        text: `${LAYER_NAMES.maas} calls the ${LAYER_NAMES.llm}`,
        mode: "arrow",
        from: "maas",
        to: "llm",
        color: COLORS.maas,
        num: INFERENCE_BAND,
        ...ARROW.maasToLlm,
      },
    ],
    mutations: [
      {
        step: 1,
        label: `3  ${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} · direct`,
        actions: [{ id: "l-rails", style: "highlight" }],
      },
      { step: 2, label: `3  ${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}` },
    ],
  };
}

function buildInferenceMaasLlmBlock() {
  return {
    steps: [
      {
        text: `${LAYER_NAMES.maas} calls the ${LAYER_NAMES.llm}`,
        mode: "arrow",
        from: "maas",
        to: "llm",
        color: COLORS.maas,
        num: INFERENCE_BAND,
        ...ARROW.maasToLlm,
      },
    ],
    mutations: [{ step: 1, label: `3  ${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}` }],
  };
}

function buildTraceDirectBlock() {
  return {
    steps: [
      {
        text: `Trace span (background) → ${LAYER_NAMES.mlflow}`,
        mode: "arrow",
        from: "oc",
        to: "mlflow",
        ...TRACE_STEP_STYLE,
        ...ARROW.ocToMlflow,
      },
    ],
    mutations: [
      {
        step: 1,
        label: `4  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.mlflow} · trace`,
        actions: [{ id: "l-mlflow", style: "highlight" }],
      },
    ],
  };
}

const OVERALL_SCENARIO_A = composeOverallFlow([
  {
    steps: SCENARIO_A_STEPS.slice(0, 5),
    mutations: sliceMutations(SCENARIO_A_MUTATIONS, 1, 5),
  },
  buildInferenceGwMaasBlock(),
  {
    steps: SCENARIO_A_STEPS.slice(5),
    mutations: sliceMutations(SCENARIO_A_MUTATIONS, 6, 8),
  },
  buildTraceDirectBlock(),
]);

const OVERALL_SCENARIO_B = composeOverallFlow([
  {
    steps: SCENARIO_B_STEPS.slice(0, 4),
    mutations: sliceMutations(SCENARIO_B_MUTATIONS, 1, 4),
  },
  buildInferenceDirectBlock(),
  {
    steps: SCENARIO_B_STEPS.slice(4),
    mutations: sliceMutations(SCENARIO_B_MUTATIONS, 5, 6),
  },
  buildTraceDirectBlock(),
]);

const OVERALL_SCENARIO_C_BEFORE = composeOverallFlow([
  {
    steps: SCENARIO_C_BEFORE_STEPS.slice(0, 2),
    mutations: sliceMutations(SCENARIO_C_BEFORE_MUTATIONS, 1, 2),
  },
  buildInferenceDirectBlock(),
  {
    steps: SCENARIO_C_BEFORE_STEPS.slice(2),
    mutations: sliceMutations(SCENARIO_C_BEFORE_MUTATIONS, 3, 8),
  },
  buildTraceDirectBlock(),
]);

const OVERALL_SCENARIO_C_AFTER = composeOverallFlow([
  {
    steps: SCENARIO_C_AFTER_STEPS.slice(0, 2),
    mutations: sliceMutations(SCENARIO_C_AFTER_MUTATIONS, 1, 2),
  },
  buildInferenceDirectBlock(),
  {
    steps: SCENARIO_C_AFTER_STEPS.slice(2),
    mutations: sliceMutations(SCENARIO_C_AFTER_MUTATIONS, 3, 6),
  },
  buildTraceDirectBlock(),
]);

const OVERALL_SCENARIO_D_BEFORE = composeOverallFlow([
  {
    steps: SCENARIO_D_BEFORE_STEPS.slice(0, 4),
    mutations: sliceMutations(SCENARIO_D_BEFORE_MUTATIONS, 1, 4),
  },
  buildInferenceMaasLlmBlock(),
  {
    steps: SCENARIO_D_BEFORE_STEPS.slice(4),
    mutations: sliceMutations(SCENARIO_D_BEFORE_MUTATIONS, 5, 7),
  },
  buildTraceDirectBlock(),
]);

const OVERALL_SCENARIO_D_AFTER = composeOverallFlow([
  {
    steps: SCENARIO_D_AFTER_STEPS.slice(0, 5),
    mutations: sliceMutations(SCENARIO_D_AFTER_MUTATIONS, 1, 5),
  },
  buildInferenceMaasLlmBlock(),
  {
    steps: SCENARIO_D_AFTER_STEPS.slice(5),
    mutations: sliceMutations(SCENARIO_D_AFTER_MUTATIONS, 6, 8),
  },
  buildTraceDirectBlock(),
]);

const FLOW_LABELS = {
  baseline: "Baseline · demo initial",
  "scenario-a": "A · Credentials",
  "scenario-b": "B · Files",
  "scenario-c-before": "C · Egress (before)",
  "scenario-c-after": "C · Egress (after)",
  "scenario-d-before": "D · Guardrails (before)",
  "scenario-d-after": "D · Guardrails (after)",
};

export function buildOverallFlows() {
  return {
    baseline: { label: FLOW_LABELS.baseline, steps: BASELINE_STEPS },
    "scenario-a": { label: FLOW_LABELS["scenario-a"], steps: OVERALL_SCENARIO_A.steps },
    "scenario-b": { label: FLOW_LABELS["scenario-b"], steps: OVERALL_SCENARIO_B.steps },
    "scenario-c-before": {
      label: FLOW_LABELS["scenario-c-before"],
      steps: OVERALL_SCENARIO_C_BEFORE.steps,
    },
    "scenario-c-after": {
      label: FLOW_LABELS["scenario-c-after"],
      steps: OVERALL_SCENARIO_C_AFTER.steps,
    },
    "scenario-d-before": {
      label: FLOW_LABELS["scenario-d-before"],
      steps: OVERALL_SCENARIO_D_BEFORE.steps,
    },
    "scenario-d-after": {
      label: FLOW_LABELS["scenario-d-after"],
      steps: OVERALL_SCENARIO_D_AFTER.steps,
    },
  };
}

export function buildOverallMutations() {
  return {
    baseline: BASELINE_MUTATIONS,
    "scenario-a": OVERALL_SCENARIO_A.mutations,
    "scenario-b": OVERALL_SCENARIO_B.mutations,
    "scenario-c-before": OVERALL_SCENARIO_C_BEFORE.mutations,
    "scenario-c-after": OVERALL_SCENARIO_C_AFTER.mutations,
    "scenario-d-before": OVERALL_SCENARIO_D_BEFORE.mutations,
    "scenario-d-after": OVERALL_SCENARIO_D_AFTER.mutations,
  };
}

export function buildOverallResponseComparison() {
  const mutations = buildOverallMutations();
  const overallFlowIds = [
    "baseline",
    "scenario-a",
    "scenario-b",
    "scenario-c-before",
    "scenario-c-after",
    "scenario-d-before",
    "scenario-d-after",
  ];

  const flows = {};

  for (const flowId of overallFlowIds) {
    const responseMap = OVERALL_RESPONSES[flowId] ?? {};
    flows[flowId] = {
      baseMutations: mutations[flowId],
      mergedMutations: mergeResponseBodies(mutations[flowId], responseMap),
      overlays: OVERALL_OVERLAYS[flowId] ?? {},
      responseMap,
    };
  }

  return {
    flows,
    defaultFlowId: "baseline",
  };
}

/** Full node set for overall map (all layers visible). */
export function buildOverallNodes() {
  return pickNodes(
    [
      "user",
      "openshell",
      "agentsb",
      "oc",
      "landlock",
      "ir",
      "gw",
      "nemo",
      "maas",
      "llm",
      "mlflow",
      "internet",
    ],
    {
      gw: { sublabel: "all outbound" },
      oc: { sublabel: LAYER_NAMES.harness },
    }
  );
}

export { OVERALL_CANVAS, OVERALL_FLOW_ORDER };
