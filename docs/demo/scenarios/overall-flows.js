/**
 * Shared FlowStory flow definitions for overall-demo-architecture and test scenario pages.
 */

import {
  ARROW,
  ARROW_SCENARIO_OC_GW,
  ARROW_SCENARIO_OC_GW_C_AFTER,
  COLORS,
  LAYER_NAMES,
  mergeResponseBodies,
  OVERALL_CANVAS,
  OVERALL_FLOW_ORDER,
  pickNodes,
  TRACE_STEP_STYLE,
} from "./scenario-layout.js";
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
    actions: [{ id: "l-gw", style: "highlight" }],
  },
  { step: 2, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}` },
  {
    step: 3,
    label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}`,
    actions: [{ id: "l-creds", style: "highlight" }],
  },
  { step: 4, label: `3  ${LAYER_NAMES.gw}`, actions: [{ id: "l-gw", style: "highlight" }] },
  {
    step: 5,
    label: `4  ${LAYER_NAMES.nemo} on the path`,
    actions: [{ id: "l-rails", style: "highlight" }],
    replaceBody: [
      {
        value: `Path:  ${LAYER_NAMES.ir}  →  ${LAYER_NAMES.gw}  →  ${LAYER_NAMES.nemo}  →  ${LAYER_NAMES.maas}  →  ${LAYER_NAMES.llm}`,
        style: "add",
        id: "p-path",
      },
    ],
  },
  { step: 6, label: `5  ${LAYER_NAMES.maas}`, actions: [{ id: "p-path", style: "highlight" }] },
  { step: 7, label: `6  ${LAYER_NAMES.llm}` },
  {
    step: 8,
    label: `6  ${LAYER_NAMES.llm} → ${LAYER_NAMES.maas} (read this file)`,
    phase: "response",
    replaceBody: [
      {
        value: `Path:  ${LAYER_NAMES.llm} → ${LAYER_NAMES.maas} → ${LAYER_NAMES.nemo} → ${LAYER_NAMES.gw} → ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw}  then  ${LAYER_NAMES.landlock}`,
        style: "add",
        id: "p-path",
      },
    ],
  },
  { step: 9, label: `5  ${LAYER_NAMES.maas} → ${LAYER_NAMES.nemo}` },
  { step: 10, label: `4  ${LAYER_NAMES.nemo} → ${LAYER_NAMES.gw}` },
  { step: 11, label: `3  ${LAYER_NAMES.gw} → ${LAYER_NAMES.ir}` },
  { step: 12, label: `2  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw}` },
  { step: 13, label: `7  ${LAYER_NAMES.landlock} →`, actions: [{ id: "l-files", style: "highlight" }] },
  { step: 14, label: `7  ← ${LAYER_NAMES.landlock}` },
  {
    step: 15,
    label: `8  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}`,
    actions: [{ id: "l-net", style: "highlight" }, { id: "l-gw", style: "highlight" }],
  },
  { step: 16, label: `8  ${LAYER_NAMES.gw} → ${LAYER_NAMES.internet}` },
  { step: 17, label: `8  ${LAYER_NAMES.internet} → ${LAYER_NAMES.gw}` },
  { step: 18, label: `8  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}` },
  { step: 19, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}` },
  { step: 20, label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser}` },
  { step: 21, label: `9  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}`, actions: [{ id: "l-mlflow", style: "highlight" }] },
  { step: 22, label: `9  ${LAYER_NAMES.gw} → ${LAYER_NAMES.mlflow}` },
];

export const BASELINE_STEPS = [
  {
    text: `${LAYER_NAMES.endUser} reaches ${LAYER_NAMES.openClaw} through the ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "user",
    to: "gw",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.userToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards the ${LAYER_NAMES.endUser} into ${LAYER_NAMES.openClaw}`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} calls ${LAYER_NAMES.ir} — the router injects the API key`,
    mode: "arrow",
    from: "oc",
    to: "ir",
    color: COLORS.platform,
    num: 2,
    ...ARROW.ocToIr,
  },
  {
    text: `The call leaves through the ${LAYER_NAMES.gw} — all outbound`,
    mode: "arrow",
    from: "ir",
    to: "gw",
    color: COLORS.gw,
    num: 3,
    ...ARROW.irToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards through ${LAYER_NAMES.nemo} (TrustyAI)`,
    mode: "arrow",
    from: "gw",
    to: "nemo",
    color: COLORS.platform,
    num: 4,
    ...ARROW.gwToNemo,
  },
  {
    text: `${LAYER_NAMES.nemo} forwards to ${LAYER_NAMES.maas}`,
    mode: "arrow",
    from: "nemo",
    to: "maas",
    color: COLORS.maas,
    num: 5,
    ...ARROW.nemoToMaas,
  },
  {
    text: `${LAYER_NAMES.maas} calls the ${LAYER_NAMES.llm}`,
    mode: "arrow",
    from: "maas",
    to: "llm",
    color: "#7ee787",
    num: 6,
    ...ARROW.maasToLlm,
  },
  {
    text: `${LAYER_NAMES.llm} responds — it tells the agent to read a file`,
    mode: "arrow",
    from: "llm",
    to: "maas",
    color: COLORS.maas,
    num: 6,
    ...ARROW.llmToMaas,
  },
  {
    text: `Response returns through ${LAYER_NAMES.nemo}`,
    mode: "arrow",
    from: "maas",
    to: "nemo",
    color: COLORS.maas,
    num: 5,
    ...ARROW.maasToNemo,
  },
  {
    text: `Response returns through the ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "nemo",
    to: "gw",
    color: COLORS.maas,
    num: 4,
    ...ARROW.nemoToGw,
  },
  {
    text: `${LAYER_NAMES.gw} returns to ${LAYER_NAMES.ir}`,
    mode: "arrow",
    from: "gw",
    to: "ir",
    color: COLORS.maas,
    num: 3,
    ...ARROW.gwToIr,
  },
  {
    text: `Response returns to ${LAYER_NAMES.openClaw} — the model asked for a file`,
    mode: "arrow",
    from: "ir",
    to: "oc",
    color: COLORS.maas,
    num: 2,
    ...ARROW.irToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} tries the file — ${LAYER_NAMES.landlock} is already locking it`,
    mode: "arrow",
    from: "oc",
    to: "landlock",
    color: COLORS.landlock,
    num: 7,
    ...ARROW.ocToLandlock,
  },
  {
    text: `${LAYER_NAMES.landlock} returns to ${LAYER_NAMES.openClaw} — no secret files`,
    mode: "arrow",
    from: "landlock",
    to: "oc",
    color: COLORS.landlock,
    num: 7,
    ...ARROW.landlockToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} curls out through the ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.risk,
    num: 8,
    ...ARROW.ocToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards the request to the ${LAYER_NAMES.internet}`,
    mode: "arrow",
    from: "gw",
    to: "internet",
    color: COLORS.risk,
    num: 8,
    ...ARROW.gwToInternet,
  },
  {
    text: `${LAYER_NAMES.internet} responds through the ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "internet",
    to: "gw",
    color: COLORS.maas,
    num: 8,
    ...ARROW.internetToGw,
  },
  {
    text: `Response returns to ${LAYER_NAMES.openClaw}`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.maas,
    num: 8,
    ...ARROW.gwToOcReturn,
  },
  {
    text: `${LAYER_NAMES.openClaw} answers through the ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.maas,
    num: 1,
    ...ARROW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} returns the answer to the ${LAYER_NAMES.endUser}`,
    mode: "arrow",
    from: "gw",
    to: "user",
    color: COLORS.maas,
    num: 1,
    ...ARROW.gwToUser,
  },
  {
    text: `Traces leave ${LAYER_NAMES.openClaw} through the ${LAYER_NAMES.gw}`,
    mode: "arrow",
    from: "oc",
    to: "gw",
    color: COLORS.trace,
    num: 9,
    ...ARROW.ocToGwTrace,
  },
  {
    text: `${LAYER_NAMES.gw} forwards traces to ${LAYER_NAMES.mlflow}`,
    mode: "arrow",
    from: "gw",
    to: "mlflow",
    color: COLORS.trace,
    num: 9,
    ...ARROW.gwToMlflow,
  },
];

/**
 * Legend item indices (buildLegend order) to highlight per baseline hop (1-based step).
 * 0 End user · 1 Internet · 2 OpenClaw · BYOA harness · 3 Agent Sandbox
 * 4 Inference hop · 5 OpenShell Gateway · 6 NeMo Guardrails · 7 MaaS / LLM · 8 MLflow traces
 */
export const BASELINE_LEGEND_HOP_HIGHLIGHTS = {
  1: [0, 5],
  2: [5, 2],
  3: [2, 3, 4],
  4: [4, 5],
  5: [5, 6],
  6: [6, 7],
  7: [7],
  8: [7],
  9: [7, 6],
  10: [6, 5],
  11: [5, 4],
  12: [4, 2],
  13: [2, 3],
  14: [3, 2],
  15: [1, 5, 2],
  16: [1, 5],
  17: [1, 5],
  18: [5, 2],
  19: [2, 5],
  20: [0, 5],
  21: [8, 2, 5],
  22: [8, 5],
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
    ...ARROW_SCENARIO_OC_GW.gwToOc,
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
    ...ARROW_SCENARIO_OC_GW.ocToGwReply,
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
    ...ARROW_SCENARIO_OC_GW.gwToOc,
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
    ...ARROW_SCENARIO_OC_GW.ocToGwReply,
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
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · egress attempt` },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.gw} denies unauthorized egress`,
    actions: [{ id: "l-egress", style: "highlight" }],
  },
  { step: 5, label: `1  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · blocked` },
  {
    step: 6,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · curl denied`,
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
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw} · retry`,
    actions: [{ id: "p-cmd", style: "highlight" }, { id: "p-probe", style: "highlight" }],
  },
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · egress` },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.gw} forwards to ${LAYER_NAMES.internet} (google.com)`,
    actions: [{ id: "l-egress", style: "highlight" }],
  },
  { step: 5, label: `3  ${LAYER_NAMES.internet} responds (HTTP 200)` },
  {
    step: 6,
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · HTTP 200 visible`,
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
    text: `${LAYER_NAMES.gw} forwards curl prompt to ${LAYER_NAMES.openClaw}`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW.gwToOc,
  },
  {
    text: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw} · egress attempt`,
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
    text: "Same curl prompt — retry after Change 1",
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
    color: COLORS.secure,
    num: 2,
    ...ARROW.ocToGw,
  },
  {
    text: `${LAYER_NAMES.gw} forwards to ${LAYER_NAMES.internet} (google.com)`,
    mode: "arrow",
    from: "gw",
    to: "internet",
    color: COLORS.secure,
    num: 3,
    ...ARROW.gwToInternet,
  },
  {
    text: `${LAYER_NAMES.internet} responds (HTTP 200)`,
    mode: "arrow",
    from: "internet",
    to: "gw",
    color: COLORS.secure,
    num: 3,
    ...ARROW.internetToGw,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · HTTP 200 visible`,
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
    label: `1  ${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw} · recon`,
    actions: [{ id: "p-probe", style: "highlight" }],
  },
  { step: 3, label: `2  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}` },
  {
    step: 4,
    label: `3  ${LAYER_NAMES.ir} → ${LAYER_NAMES.maas} · direct`,
    actions: [{ id: "p-path", style: "highlight" }, { id: "l-rails", style: "highlight" }],
  },
  { step: 5, label: `2  ${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw} · may generate script` },
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
    text: `${LAYER_NAMES.gw} forwards recon prompt`,
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW_SCENARIO_OC_GW.gwToOc,
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
    text: `Response to ${LAYER_NAMES.openClaw} — model may generate script`,
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
    ...ARROW_SCENARIO_OC_GW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · unsafe script possible`,
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
    text: "Same recon prompt — retry after Change 2",
    mode: "arrow",
    from: "gw",
    to: "oc",
    color: COLORS.endUser,
    num: 1,
    ...ARROW_SCENARIO_OC_GW.gwToOc,
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
    text: `Response to ${LAYER_NAMES.openClaw} — rail blocks recon script`,
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
    ...ARROW_SCENARIO_OC_GW.ocToGwReply,
  },
  {
    text: `${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser} · recon blocked`,
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
      { value: "Credentials     locked  (gateway holds the key)", style: "keep", id: "l-creds" },
      { value: "Egress          via OpenShell Gateway", style: "keep", id: "l-gw" },
      { value: "Files           locked  (Landlock)", style: "keep", id: "l-files" },
      { value: "Guardrails      on  (NeMo on the hop)", style: "keep", id: "l-rails" },
      { value: "Internet        curl  (Gateway egress)", style: "keep", id: "l-net" },
      { value: "MLflow          on  (one server)", style: "keep", id: "l-mlflow" },
    ],
    body: [{ value: "Path:  (not on the hop yet)", style: "keep", id: "p-path" }],
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
      { value: "Change 1: ./scripts/demo-allow-google-egress.sh", style: "add", id: "p-cmd" },
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
      { value: "Recon script: port scan 10.0.0.0/24 · CVE lookup", style: "add", id: "p-probe" },
      { value: "Path: inference.local → MaaS (direct)", style: "add", id: "p-path" },
      { value: "Expected: model may generate script (no rails)", style: "add", id: "p-expect" },
    ],
  },
  "scenario-d-after": {
    headers: [
      ...INSPECTOR_HEADERS_D.slice(0, 5),
      { value: "Guardrails      on  (NeMo)", style: "highlight", id: "l-rails" },
      ...INSPECTOR_HEADERS_D.slice(5),
    ],
    body: [
      { value: "Change 2: ./scripts/demo-enable-guardrails.sh", style: "add", id: "p-cmd" },
      { value: "Path: inference.local → NeMo → MaaS", style: "add", id: "p-path" },
      { value: "Same prompt → refusal / filtered", style: "add", id: "p-expect" },
    ],
  },
};

export const PHASE_REST = {
  baseline: {},
  "scenario-a": {
    nodeColors: {
      nemo: COLORS.dim,
      internet: COLORS.dim,
      landlock: COLORS.dim,
      maas: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
    activeNodes: ["oc", "ir"],
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
    glow: ["gw"],
    activeNodes: ["gw", "oc"],
    nodeColors: {
      gw: COLORS.denied,
      internet: COLORS.dim,
      nemo: COLORS.dim,
      maas: COLORS.dim,
      llm: COLORS.dim,
      mlflow: COLORS.dim,
    },
  },
  "scenario-c-after": {
    glow: ["internet"],
    activeNodes: ["oc", "gw", "internet"],
    nodeColors: {
      internet: COLORS.secure,
      gw: COLORS.secure,
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

function buildTraceGwBlock(arrows = ARROW) {
  return {
    steps: [
      {
        text: `Traces leave ${LAYER_NAMES.openClaw} through the ${LAYER_NAMES.gw}`,
        mode: "arrow",
        from: "oc",
        to: "gw",
        color: COLORS.trace,
        ...TRACE_STEP_STYLE,
        ...arrows.ocToGwTrace,
      },
      {
        text: `${LAYER_NAMES.gw} forwards traces to ${LAYER_NAMES.mlflow}`,
        mode: "arrow",
        from: "gw",
        to: "mlflow",
        color: COLORS.trace,
        ...TRACE_STEP_STYLE,
        ...arrows.gwToMlflow,
      },
    ],
    mutations: [
      {
        step: 1,
        label: `4  ${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}`,
        actions: [{ id: "l-mlflow", style: "highlight" }],
      },
      {
        step: 2,
        label: `4  ${LAYER_NAMES.gw} → ${LAYER_NAMES.mlflow}`,
      },
    ],
  };
}

const OVERALL_SCENARIO_A = composeOverallFlow([
  {
    steps: SCENARIO_A_STEPS.slice(0, 4),
    mutations: sliceMutations(SCENARIO_A_MUTATIONS, 1, 4),
  },
  buildInferenceGwMaasBlock(),
  {
    steps: [SCENARIO_A_STEPS[4]],
    mutations: sliceMutations(SCENARIO_A_MUTATIONS, 5, 5),
  },
  {
    steps: SCENARIO_A_STEPS.slice(5),
    mutations: sliceMutations(SCENARIO_A_MUTATIONS, 6, 8),
  },
  buildTraceGwBlock(ARROW_SCENARIO_OC_GW),
]);

const inferDirectB = buildInferenceDirectBlock();
const OVERALL_SCENARIO_B = composeOverallFlow([
  {
    steps: SCENARIO_B_STEPS.slice(0, 2),
    mutations: sliceMutations(SCENARIO_B_MUTATIONS, 1, 2),
  },
  {
    steps: [{ ...inferDirectB.steps[0], num: 2 }],
    mutations: sliceMutations(inferDirectB.mutations, 1, 1),
  },
  {
    steps: inferDirectB.steps.slice(1),
    mutations: sliceMutations(inferDirectB.mutations, 2, 5),
  },
  {
    steps: SCENARIO_B_STEPS.slice(2, 4).map((s) => ({ ...s, num: 4 })),
    mutations: sliceMutations(SCENARIO_B_MUTATIONS, 3, 4),
  },
  {
    steps: SCENARIO_B_STEPS.slice(4),
    mutations: sliceMutations(SCENARIO_B_MUTATIONS, 5, 6),
  },
  {
    ...buildTraceGwBlock(ARROW_SCENARIO_OC_GW),
    steps: buildTraceGwBlock(ARROW_SCENARIO_OC_GW).steps.map((s) => ({ ...s, num: 5 })),
  },
]);

const OVERALL_SCENARIO_C_BEFORE = composeOverallFlow([
  {
    steps: SCENARIO_C_BEFORE_STEPS.slice(0, 2),
    mutations: sliceMutations(SCENARIO_C_BEFORE_MUTATIONS, 1, 2),
  },
  buildInferenceDirectBlock(),
  {
    steps: SCENARIO_C_BEFORE_STEPS.slice(2),
    mutations: sliceMutations(SCENARIO_C_BEFORE_MUTATIONS, 3, 6),
  },
  buildTraceGwBlock(ARROW_SCENARIO_OC_GW),
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
  buildTraceGwBlock(ARROW_SCENARIO_OC_GW),
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
  buildTraceGwBlock(ARROW_SCENARIO_OC_GW),
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
  buildTraceGwBlock(ARROW_SCENARIO_OC_GW),
]);

const FLOW_LABELS = {
  baseline: "Overall Demo",
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

/** Node ids referenced by arrow steps (for legend filtering). */
export function collectNodesFromSteps(steps) {
  const ids = new Set();
  for (const step of steps ?? []) {
    if (step.from) ids.add(step.from);
    if (step.to) ids.add(step.to);
  }
  return ids;
}

/** Layer-board header ids (`l-*`) touched by inspector mutations. */
export function layerIdsFromMutations(mutations) {
  const ids = new Set();
  for (const m of mutations ?? []) {
    for (const a of m.actions ?? []) {
      if (a.id?.startsWith("l-")) ids.add(a.id);
    }
  }
  return ids;
}

/** Keep only layer-board headers that apply to this scenario flow. */
export function filterLayerBoard(board, layerIds) {
  const idSet = layerIds instanceof Set ? layerIds : new Set(layerIds);
  return {
    ...board,
    headers: (board.headers ?? []).filter((h) => idSet.has(h.id)),
    body: board.body ?? [],
  };
}

function buildFilteredLayerBoards() {
  const mutations = buildOverallMutations();
  const boards = {};
  for (const [flowId, board] of Object.entries(LAYER_BOARDS)) {
    boards[flowId] = filterLayerBoard(board, layerIdsFromMutations(mutations[flowId]));
  }
  return boards;
}

/** Steps, mutations, layer board, and phase rest for one overall-map scenario flow. */
export function getScenarioFlowBundle(flowId) {
  const flows = buildOverallFlows();
  const mutations = buildOverallMutations();
  const flow = flows[flowId];
  if (!flow) {
    throw new Error(`Unknown scenario flow: ${flowId}`);
  }
  return {
    flowId,
    label: flow.label,
    steps: flow.steps,
    mutations: mutations[flowId],
    layerBoard: LAYER_BOARDS[flowId],
    phaseRest: PHASE_REST[flowId] ?? {},
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

export { OVERALL_CANVAS, OVERALL_FLOW_ORDER, buildFilteredLayerBoards };
