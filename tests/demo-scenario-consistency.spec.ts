/**
 * Unit tests for demo scenario data consistency (no cluster required).
 *
 * Guards alignment between narrative-data.js, overall-flows.js, overall-response-maps.js,
 * and tests/demo-prompts.ts — see docs/demo-scenario-considerations.md.
 */
import { test, expect } from '@playwright/test';
import { NARRATIVE, NAV_GROUPS, STEP_IDS } from '../docs/demo/v1/narrative-data.js';
import {
  SCENARIO_A_MUTATIONS,
  SCENARIO_A_STEPS,
  SCENARIO_B_MUTATIONS,
  SCENARIO_B_STEPS,
  SCENARIO_C_BEFORE_MUTATIONS,
  SCENARIO_C_BEFORE_STEPS,
  SCENARIO_C_AFTER_MUTATIONS,
  SCENARIO_C_AFTER_STEPS,
  SCENARIO_D_BEFORE_MUTATIONS,
  SCENARIO_D_BEFORE_STEPS,
  SCENARIO_D_AFTER_MUTATIONS,
  SCENARIO_D_AFTER_STEPS,
  buildOverallFlows,
  buildOverallMutations,
  buildOverallResponseComparison,
} from '../docs/demo/scenarios/overall-flows.js';
import {
  ARROW_SCENARIO_OC_GW,
  ARROW_SCENARIO_OC_GW_C_AFTER,
} from '../docs/demo/scenarios/scenario-layout.js';
import {
  OVERALL_OVERLAYS,
  OVERALL_RESPONSES,
} from '../docs/demo/scenarios/overall-response-maps.js';
import { PROMPT_A, PROMPT_B, PROMPT_C, PROMPT_D } from './demo-prompts';

const EXPECTED_FLOW_IDS = [
  'baseline',
  'scenario-a',
  'scenario-b',
  'scenario-c-before',
  'scenario-c-after',
  'scenario-d-before',
  'scenario-d-after',
] as const;

const PROMPT_STEPS: Record<string, string> = {
  A: PROMPT_A,
  B: PROMPT_B,
  'C-pre': PROMPT_C,
  'C-post': PROMPT_C,
  'D-pre': PROMPT_D,
  'D-post': PROMPT_D,
};

test.describe('demo scenario consistency', () => {
  test('prompts match between narrative-data.js and demo-prompts.ts', () => {
    for (const [stepId, expectedPrompt] of Object.entries(PROMPT_STEPS)) {
      const step = NARRATIVE.steps[stepId];
      expect(step, `missing narrative step ${stepId}`).toBeTruthy();
      expect(step.prompt, `prompt for ${stepId}`).toBe(expectedPrompt);
    }
  });

  test('STEP_IDS and NAV_GROUPS are coherent', () => {
    const navStepIds = NAV_GROUPS.flatMap((g) => g.steps);
    expect(navStepIds).toEqual(STEP_IDS);
    expect(new Set(STEP_IDS).size).toBe(STEP_IDS.length);

    for (const group of NAV_GROUPS) {
      for (const stepId of group.steps) {
        expect(NARRATIVE.steps[stepId], `NARRATIVE missing step ${stepId}`).toBeTruthy();
      }
    }
  });

  test('buildOverallFlows returns all expected flows with steps', () => {
    const flows = buildOverallFlows();
    expect(Object.keys(flows).sort()).toEqual([...EXPECTED_FLOW_IDS].sort());

    for (const flowId of EXPECTED_FLOW_IDS) {
      const flow = flows[flowId];
      expect(flow.label.length, `${flowId} label`).toBeGreaterThan(0);
      expect(flow.steps.length, `${flowId} steps`).toBeGreaterThan(0);
    }
  });

  test('buildOverallResponseComparison mutations align with flow steps', () => {
    const flows = buildOverallFlows();
    const comparison = buildOverallResponseComparison();

    for (const flowId of EXPECTED_FLOW_IDS) {
      const { baseMutations, mergedMutations } = comparison.flows[flowId];
      const stepCount = flows[flowId].steps.length;
      expect(baseMutations.length, `${flowId} baseMutations`).toBe(stepCount);
      expect(mergedMutations.length, `${flowId} mergedMutations`).toBe(stepCount);
    }
  });

  test('scenario C after oc ↔ gw lanes are centered on OpenClaw', () => {
    const ocBottomOffsets = [
      ARROW_SCENARIO_OC_GW_C_AFTER.gwToOc.toXOff,
      ARROW_SCENARIO_OC_GW_C_AFTER.ocToGw.fromXOff,
      ARROW_SCENARIO_OC_GW_C_AFTER.ocToGwReply.fromXOff,
      ARROW_SCENARIO_OC_GW_C_AFTER.ocToGwTrace.fromXOff,
    ];
    const sum = ocBottomOffsets.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
    expect(new Set(ocBottomOffsets).size).toBe(4);
  });

  test('scenario B oc ↔ gw lanes are centered on OpenClaw', () => {
    const ocBottomOffsets = [
      ARROW_SCENARIO_OC_GW.gwToOc.toXOff,
      ARROW_SCENARIO_OC_GW.ocToGwReply.fromXOff,
      ARROW_SCENARIO_OC_GW.ocToGwTrace.fromXOff,
    ];
    const sum = ocBottomOffsets.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
    expect(new Set(ocBottomOffsets).size).toBe(3);
  });

  test('scenario D before oc ↔ gw lanes are centered on OpenClaw', () => {
    const ocBottomOffsets = [
      ARROW_SCENARIO_OC_GW.gwToOc.toXOff,
      ARROW_SCENARIO_OC_GW.ocToGwReply.fromXOff,
      ARROW_SCENARIO_OC_GW.ocToGwTrace.fromXOff,
    ];
    const sum = ocBottomOffsets.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
    expect(new Set(ocBottomOffsets).size).toBe(3);
  });

  test('scenario D after oc ↔ gw lanes are centered on OpenClaw', () => {
    const ocBottomOffsets = [
      ARROW_SCENARIO_OC_GW.gwToOc.toXOff,
      ARROW_SCENARIO_OC_GW.ocToGwReply.fromXOff,
      ARROW_SCENARIO_OC_GW.ocToGwTrace.fromXOff,
    ];
    const sum = ocBottomOffsets.reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
    expect(new Set(ocBottomOffsets).size).toBe(3);
  });

  test('standalone security scenarios have matching steps and mutations', () => {
    const pairs: Array<{ name: string; steps: unknown[]; mutations: unknown[] }> = [
      { name: 'A', steps: SCENARIO_A_STEPS, mutations: SCENARIO_A_MUTATIONS },
      { name: 'B', steps: SCENARIO_B_STEPS, mutations: SCENARIO_B_MUTATIONS },
      { name: 'C-before', steps: SCENARIO_C_BEFORE_STEPS, mutations: SCENARIO_C_BEFORE_MUTATIONS },
      { name: 'C-after', steps: SCENARIO_C_AFTER_STEPS, mutations: SCENARIO_C_AFTER_MUTATIONS },
      { name: 'D-before', steps: SCENARIO_D_BEFORE_STEPS, mutations: SCENARIO_D_BEFORE_MUTATIONS },
      { name: 'D-after', steps: SCENARIO_D_AFTER_STEPS, mutations: SCENARIO_D_AFTER_MUTATIONS },
    ];

    for (const { name, steps, mutations } of pairs) {
      expect(steps.length, `scenario ${name} steps`).toBe(mutations.length);
      expect(steps.length, `scenario ${name} non-empty`).toBeGreaterThan(0);
    }
  });

  test('OVERALL_RESPONSES and OVERALL_OVERLAYS cover all flow IDs', () => {
    const mutations = buildOverallMutations();

    for (const flowId of EXPECTED_FLOW_IDS) {
      expect(OVERALL_RESPONSES[flowId], `OVERALL_RESPONSES.${flowId}`).toBeTruthy();
      expect(OVERALL_OVERLAYS[flowId], `OVERALL_OVERLAYS.${flowId}`).toBeTruthy();
      expect(mutations[flowId]?.length, `mutations.${flowId}`).toBeGreaterThan(0);
    }
  });
});
