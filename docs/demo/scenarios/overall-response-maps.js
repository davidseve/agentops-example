/**
 * Response / overlay maps for overall-demo-architecture flows.
 * Standalone test-a..d pages keep scenario-responses.js exports unchanged.
 */

import { COLORS, LAYER_NAMES } from "./scenario-layout.js";
import {
  OVERLAYS_A,
  OVERLAYS_B,
  OVERLAYS_C_AFTER,
  OVERLAYS_C_BEFORE,
  OVERLAYS_D_AFTER,
  OVERLAYS_D_BEFORE,
  OVERLAYS_LAYERS,
  OVERLAYS_TRACE_GW,
  RESPONSES_A,
  RESPONSES_B,
  RESPONSES_C_AFTER,
  RESPONSES_C_BEFORE,
  RESPONSES_D_AFTER,
  RESPONSES_D_BEFORE,
  RESPONSES_LAYERS,
  RESPONSES_TRACE_GW,
} from "./scenario-responses.js";

function pickKeys(map, keys) {
  const out = {};
  for (const k of keys) {
    if (map[k] != null) out[k] = map[k];
  }
  return out;
}

function remapKeys(map, offset) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    out[Number(k) + offset] = v;
  }
  return out;
}

/** Full direct inference path (oc → ir → gw → maas → llm → oc). Relative keys 1–5. */
export const RESPONSES_INFERENCE_DIRECT = {
  1: [`${LAYER_NAMES.openClaw} → ${LAYER_NAMES.ir}: model call`],
  2: [`${LAYER_NAMES.ir} → ${LAYER_NAMES.gw}: key inject at gateway`],
  3: [`${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} direct (${LAYER_NAMES.nemo} off)`],
  4: [`${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}: upstream model`],
  5: [`${LAYER_NAMES.ir} → ${LAYER_NAMES.openClaw}: model response`],
};

export const OVERLAYS_INFERENCE_DIRECT = {
  1: {
    node: "ir",
    title: `${LAYER_NAMES.ir} — model call`,
    description: "OpenClaw calls inference.local. Router injects the MaaS API key at the gateway.",
    details: [
      ["Path", "OC → IR"],
      ["Key", "Injected at GW — not in sandbox"],
    ],
    color: COLORS.platform,
  },
  3: {
    node: "maas",
    title: `${LAYER_NAMES.maas} — direct path`,
    description: "Demo initial state — inference.local routes straight to MaaS (NeMo off).",
    details: [
      ["Path", "GW → MaaS"],
      ["Guardrails", "off"],
    ],
    color: COLORS.maas,
  },
  4: {
    node: "llm",
    title: LAYER_NAMES.llm,
    description: "Upstream model serves the completion. Tool plan / reply returns through IR.",
    details: [
      ["Serving", "RHOAI MaaS"],
      ["Trace", "model: router in MLflow"],
    ],
    color: COLORS.maas,
  },
};

/** gw → maas → llm only (after credentials auth hop). Relative keys 1–2. */
export const RESPONSES_INFERENCE_GW_MAAS = {
  1: [`${LAYER_NAMES.gw} → ${LAYER_NAMES.maas} direct (${LAYER_NAMES.nemo} off)`],
  2: [`${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}: upstream model`],
};

export const OVERLAYS_INFERENCE_GW_MAAS = {
  1: {
    node: "maas",
    title: `${LAYER_NAMES.maas} — direct path`,
    description: "After gateway auth, the model call continues to MaaS without NeMo.",
    details: [
      ["Path", "GW → MaaS"],
      ["Credentials", "Key held at gateway"],
    ],
    color: COLORS.maas,
  },
  2: {
    node: "llm",
    title: LAYER_NAMES.llm,
    description: "Model completion — same inference path as baseline, parallel to security story.",
    details: [
      ["Serving", "RHOAI MaaS"],
      ["Sandbox", "Never sees API key"],
    ],
    color: COLORS.maas,
  },
};

/** maas → llm only (D scenarios — ir→maas already in security hops). Relative key 1. */
export const RESPONSES_INFERENCE_MAAS_LLM = {
  1: [`${LAYER_NAMES.maas} → ${LAYER_NAMES.llm}: upstream model`],
};

export const OVERLAYS_INFERENCE_MAAS_LLM = {
  1: {
    node: "llm",
    title: LAYER_NAMES.llm,
    description: "Jailbreak prompt reaches the upstream model when guardrails are off (D before) or filtered (D after).",
    details: [
      ["Path", "MaaS → LLM"],
      ["Trace", "Full span in MLflow (background)"],
    ],
    color: COLORS.maas,
  },
};

/** @deprecated use RESPONSES_TRACE_GW — direct oc→mlflow path retired from diagrams */
export const RESPONSES_TRACE_DIRECT = RESPONSES_TRACE_GW;

/** @deprecated use OVERLAYS_TRACE_GW */
export const OVERLAYS_TRACE_DIRECT = OVERLAYS_TRACE_GW;

function mergeMaps(...maps) {
  return Object.assign({}, ...maps);
}

/** Overall-map response maps keyed to composed hop indices (1-based). */
export const OVERALL_RESPONSES = {
  baseline: RESPONSES_LAYERS,
  "scenario-a": mergeMaps(
    pickKeys(RESPONSES_A, [1, 2, 3, 4]),
    remapKeys(RESPONSES_INFERENCE_GW_MAAS, 5),
    remapKeys(pickKeys(RESPONSES_A, [6, 8]), 2),
    remapKeys(RESPONSES_TRACE_GW, 10)
  ),
  "scenario-b": mergeMaps(
    pickKeys(RESPONSES_B, [3, 4]),
    remapKeys(RESPONSES_INFERENCE_DIRECT, 4),
    remapKeys(pickKeys(RESPONSES_B, [5, 6]), 5),
    remapKeys(RESPONSES_TRACE_GW, 11)
  ),
  "scenario-c-before": mergeMaps(
    pickKeys(RESPONSES_C_BEFORE, [1, 2]),
    remapKeys(RESPONSES_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(RESPONSES_C_BEFORE, [4, 5, 6]), 5),
    remapKeys(RESPONSES_TRACE_GW, 11)
  ),
  "scenario-c-after": mergeMaps(
    pickKeys(RESPONSES_C_AFTER, [1]),
    remapKeys(RESPONSES_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(RESPONSES_C_AFTER, [4, 5, 6]), 5),
    remapKeys(RESPONSES_TRACE_GW, 11)
  ),
  "scenario-d-before": mergeMaps(
    pickKeys(RESPONSES_D_BEFORE, [2, 4]),
    remapKeys(RESPONSES_INFERENCE_MAAS_LLM, 4),
    remapKeys(pickKeys(RESPONSES_D_BEFORE, [7]), 1),
    remapKeys(RESPONSES_TRACE_GW, 8)
  ),
  "scenario-d-after": mergeMaps(
    pickKeys(RESPONSES_D_AFTER, [4, 5]),
    remapKeys(RESPONSES_INFERENCE_MAAS_LLM, 5),
    remapKeys(pickKeys(RESPONSES_D_AFTER, [8]), 1),
    remapKeys(RESPONSES_TRACE_GW, 9)
  ),
};

export const OVERALL_OVERLAYS = {
  baseline: OVERLAYS_LAYERS,
  "scenario-a": mergeMaps(
    pickKeys(OVERLAYS_A, [1, 2, 3, 4]),
    remapKeys(OVERLAYS_INFERENCE_GW_MAAS, 5),
    remapKeys(pickKeys(OVERLAYS_A, [6, 8]), 2),
    remapKeys(OVERLAYS_TRACE_GW, 10)
  ),
  "scenario-b": mergeMaps(
    pickKeys(OVERLAYS_B, [3, 4]),
    remapKeys(OVERLAYS_INFERENCE_DIRECT, 4),
    remapKeys(pickKeys(OVERLAYS_B, [5, 6]), 5),
    remapKeys(OVERLAYS_TRACE_GW, 11)
  ),
  "scenario-c-before": mergeMaps(
    pickKeys(OVERLAYS_C_BEFORE, [1, 2]),
    remapKeys(OVERLAYS_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(OVERLAYS_C_BEFORE, [4, 5, 6]), 5),
    remapKeys(OVERLAYS_TRACE_GW, 11)
  ),
  "scenario-c-after": mergeMaps(
    pickKeys(OVERLAYS_C_AFTER, [1]),
    remapKeys(OVERLAYS_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(OVERLAYS_C_AFTER, [4, 5, 6]), 5),
    remapKeys(OVERLAYS_TRACE_GW, 11)
  ),
  "scenario-d-before": mergeMaps(
    pickKeys(OVERLAYS_D_BEFORE, [2, 4]),
    remapKeys(OVERLAYS_INFERENCE_MAAS_LLM, 4),
    remapKeys(pickKeys(OVERLAYS_D_BEFORE, [7]), 1),
    remapKeys(OVERLAYS_TRACE_GW, 8)
  ),
  "scenario-d-after": mergeMaps(
    pickKeys(OVERLAYS_D_AFTER, [4, 5]),
    remapKeys(OVERLAYS_INFERENCE_MAAS_LLM, 5),
    remapKeys(pickKeys(OVERLAYS_D_AFTER, [8]), 1),
    remapKeys(OVERLAYS_TRACE_GW, 9)
  ),
};
