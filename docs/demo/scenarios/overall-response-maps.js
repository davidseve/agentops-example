/**
 * Response / overlay maps for overall-demo-architecture flows.
 * Standalone test-a..d pages keep scenario-responses.js exports unchanged.
 */

import { COLORS, LAYER_NAMES } from "./shared-scenario.js";
import {
  OVERLAYS_A,
  OVERLAYS_B,
  OVERLAYS_C_AFTER,
  OVERLAYS_C_BEFORE,
  OVERLAYS_D_AFTER,
  OVERLAYS_D_BEFORE,
  RESPONSES_A,
  RESPONSES_B,
  RESPONSES_C_AFTER,
  RESPONSES_C_BEFORE,
  RESPONSES_D_AFTER,
  RESPONSES_D_BEFORE,
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

/** Direct oc → mlflow trace (mlflow_direct policy). Relative key 1. */
export const RESPONSES_TRACE_DIRECT = {
  1: ["Trace span (background)"],
};

export const OVERLAYS_TRACE_DIRECT = {
  1: {
    node: "mlflow",
    title: `${LAYER_NAMES.openClaw} → ${LAYER_NAMES.mlflow}`,
    description:
      "mlflow-openclaw exports spans directly from the sandbox (mlflow_direct policy). Same session trace for tests A–D.",
    details: [
      ["Plugin", "mlflow-openclaw"],
      ["Policy", "mlflow_direct"],
      ["ADR", "0010 — full request/response"],
    ],
    color: COLORS.trace,
  },
};

function mergeMaps(...maps) {
  return Object.assign({}, ...maps);
}

/** Baseline flow (10 hops): user path + direct inference + reply + trace. */
const BASELINE_USER_RESPONSES = {
  1: [`${LAYER_NAMES.controlUI} — user prompt`],
  2: [`${LAYER_NAMES.gw} forwards prompt to ${LAYER_NAMES.openClaw}`],
  8: [`${LAYER_NAMES.openClaw} → ${LAYER_NAMES.gw}: agent reply`],
  9: [`${LAYER_NAMES.gw} → ${LAYER_NAMES.endUser}: answer in Control UI`],
};

const BASELINE_USER_OVERLAYS = {
  1: {
    node: "user",
    title: `${LAYER_NAMES.endUser} · ${LAYER_NAMES.controlUI}`,
    description:
      "Baseline demo initial state — user prompt enters through the Control UI and OpenShell gateway.",
    details: [
      ["State", "demo-initial policy"],
      ["Guardrails", "off · egress open"],
    ],
    color: COLORS.endUser,
  },
  2: {
    node: "oc",
    title: `${LAYER_NAMES.gw} → ${LAYER_NAMES.openClaw}`,
    description: `${LAYER_NAMES.gw} forwards the prompt into the Agent Sandbox via mTLS bridge.`,
    details: [
      ["Harness", "OpenClaw (BYOA)"],
      ["Bridge", "mTLS · no direct sandbox access"],
    ],
    color: COLORS.oc,
  },
  8: {
    node: "gw",
    title: `${LAYER_NAMES.gw} — reply path`,
    description: "Agent answer leaves the sandbox through the same gateway bridge.",
    details: [
      ["Path", "OC → GW"],
      ["Credentials", "Still held at gateway"],
    ],
    color: COLORS.gw,
  },
  9: {
    node: "user",
    title: `${LAYER_NAMES.endUser} · ${LAYER_NAMES.controlUI}`,
    description: "Response returns to the Control UI — full stack path before security tests A–D.",
    details: [
      ["Flow", "Baseline happy path"],
      ["Next", "Jump to A–D for security probes"],
    ],
    color: COLORS.endUser,
  },
};

/** Overall-map response maps keyed to composed hop indices (1-based). */
export const OVERALL_RESPONSES = {
  baseline: mergeMaps(
    BASELINE_USER_RESPONSES,
    remapKeys(RESPONSES_INFERENCE_DIRECT, 2),
    remapKeys(RESPONSES_TRACE_DIRECT, 9)
  ),
  "scenario-a": mergeMaps(
    pickKeys(RESPONSES_A, [1, 2, 3, 4]),
    remapKeys(RESPONSES_INFERENCE_GW_MAAS, 5),
    remapKeys(pickKeys(RESPONSES_A, [6, 8]), 2),
    remapKeys(RESPONSES_TRACE_DIRECT, 10)
  ),
  "scenario-b": mergeMaps(
    pickKeys(RESPONSES_B, [3, 4]),
    remapKeys(RESPONSES_INFERENCE_DIRECT, 4),
    remapKeys(pickKeys(RESPONSES_B, [5, 6]), 5),
    remapKeys(RESPONSES_TRACE_DIRECT, 11)
  ),
  "scenario-c-before": mergeMaps(
    pickKeys(RESPONSES_C_BEFORE, [1, 2]),
    remapKeys(RESPONSES_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(RESPONSES_C_BEFORE, [4, 7, 8]), 5),
    remapKeys(RESPONSES_TRACE_DIRECT, 13)
  ),
  "scenario-c-after": mergeMaps(
    pickKeys(RESPONSES_C_AFTER, [1]),
    remapKeys(RESPONSES_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(RESPONSES_C_AFTER, [4, 6]), 5),
    remapKeys(RESPONSES_TRACE_DIRECT, 11)
  ),
  "scenario-d-before": mergeMaps(
    pickKeys(RESPONSES_D_BEFORE, [2, 4]),
    remapKeys(RESPONSES_INFERENCE_MAAS_LLM, 4),
    remapKeys(pickKeys(RESPONSES_D_BEFORE, [7]), 1),
    remapKeys(RESPONSES_TRACE_DIRECT, 8)
  ),
  "scenario-d-after": mergeMaps(
    pickKeys(RESPONSES_D_AFTER, [4, 5]),
    remapKeys(RESPONSES_INFERENCE_MAAS_LLM, 5),
    remapKeys(pickKeys(RESPONSES_D_AFTER, [8]), 1),
    remapKeys(RESPONSES_TRACE_DIRECT, 9)
  ),
};

export const OVERALL_OVERLAYS = {
  baseline: mergeMaps(
    BASELINE_USER_OVERLAYS,
    remapKeys(pickKeys(OVERLAYS_INFERENCE_DIRECT, [1]), 2),
    pickKeys(OVERLAYS_A, [4, 6]),
    remapKeys(pickKeys(OVERLAYS_INFERENCE_DIRECT, [3, 4]), 2),
    remapKeys(OVERLAYS_TRACE_DIRECT, 9)
  ),
  "scenario-a": mergeMaps(
    pickKeys(OVERLAYS_A, [1, 2, 3, 4]),
    remapKeys(OVERLAYS_INFERENCE_GW_MAAS, 5),
    remapKeys(pickKeys(OVERLAYS_A, [6, 8]), 2),
    remapKeys(OVERLAYS_TRACE_DIRECT, 10)
  ),
  "scenario-b": mergeMaps(
    pickKeys(OVERLAYS_B, [3, 4]),
    remapKeys(OVERLAYS_INFERENCE_DIRECT, 4),
    remapKeys(pickKeys(OVERLAYS_B, [5, 6]), 5),
    remapKeys(OVERLAYS_TRACE_DIRECT, 11)
  ),
  "scenario-c-before": mergeMaps(
    pickKeys(OVERLAYS_C_BEFORE, [1, 2]),
    remapKeys(OVERLAYS_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(OVERLAYS_C_BEFORE, [4, 7, 8]), 5),
    remapKeys(OVERLAYS_TRACE_DIRECT, 13)
  ),
  "scenario-c-after": mergeMaps(
    pickKeys(OVERLAYS_C_AFTER, [1]),
    remapKeys(OVERLAYS_INFERENCE_DIRECT, 2),
    remapKeys(pickKeys(OVERLAYS_C_AFTER, [4, 6]), 5),
    remapKeys(OVERLAYS_TRACE_DIRECT, 11)
  ),
  "scenario-d-before": mergeMaps(
    pickKeys(OVERLAYS_D_BEFORE, [2, 4]),
    remapKeys(OVERLAYS_INFERENCE_MAAS_LLM, 4),
    remapKeys(pickKeys(OVERLAYS_D_BEFORE, [7]), 1),
    remapKeys(OVERLAYS_TRACE_DIRECT, 8)
  ),
  "scenario-d-after": mergeMaps(
    pickKeys(OVERLAYS_D_AFTER, [4, 5]),
    remapKeys(OVERLAYS_INFERENCE_MAAS_LLM, 5),
    remapKeys(pickKeys(OVERLAYS_D_AFTER, [8]), 1),
    remapKeys(OVERLAYS_TRACE_DIRECT, 9)
  ),
};
