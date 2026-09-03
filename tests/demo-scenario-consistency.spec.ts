/**
 * Unit tests for demo scenario data consistency (no cluster required).
 *
 * Guards alignment between narrative-data.js, overall-flows.js, overall-response-maps.js,
 * and tests/demo-prompts.ts — see docs/demo-scenario-considerations.md.
 */
import { test, expect } from '@playwright/test';
import { NARRATIVE, NAV_GROUPS, STEP_IDS, YAML_PANELS } from '../docs/demo/v1/narrative-data.js';
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
  PHASE_REST,
} from '../docs/demo/scenarios/overall-flows.js';
import {
  ARROW_SCENARIO_OC_GW,
  ARROW_SCENARIO_OC_GW_C_AFTER,
  COLORS,
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

  test('PHASE_REST scenario-a highlights OpenClaw and inference.local at idle', () => {
    expect(PHASE_REST['scenario-a'].activeNodes).toContain('oc');
    expect(PHASE_REST['scenario-a'].activeNodes).toContain('ir');
    expect(PHASE_REST['scenario-a'].nodeColors?.ir).toBeUndefined();
  });

  test('PHASE_REST scenario-b highlights OpenClaw and Landlock at idle', () => {
    expect(PHASE_REST['scenario-b'].activeNodes).toContain('oc');
    expect(PHASE_REST['scenario-b'].activeNodes).toContain('landlock');
    expect(PHASE_REST['scenario-b'].nodeColors?.landlock).toBeUndefined();
  });

  test('PHASE_REST scenario-c-before highlights gateway enforcement at idle', () => {
    expect(PHASE_REST['scenario-c-before'].glow).toContain('gw');
    expect(PHASE_REST['scenario-c-before'].activeNodes).toContain('oc');
    expect(PHASE_REST['scenario-c-before'].activeNodes).toContain('gw');
    expect(PHASE_REST['scenario-c-before'].nodeColors?.gw).toBe(COLORS.denied);
    expect(PHASE_REST['scenario-c-before'].nodeColors?.internet).toBe(COLORS.dim);
  });

  test('PHASE_REST scenario-c-after highlights internet egress at idle', () => {
    expect(PHASE_REST['scenario-c-after'].glow).toContain('internet');
    expect(PHASE_REST['scenario-c-after'].activeNodes).toContain('oc');
    expect(PHASE_REST['scenario-c-after'].activeNodes).toContain('gw');
    expect(PHASE_REST['scenario-c-after'].activeNodes).toContain('internet');
    expect(PHASE_REST['scenario-c-after'].nodeColors?.internet).toBe(COLORS.secure);
    expect(PHASE_REST['scenario-c-after'].nodeColors?.gw).toBe(COLORS.secure);
  });

  test('step B baseline yaml panel documents OpenShell filesystem policy', () => {
    const stepB = NARRATIVE.steps.B;
    expect(stepB.yamlPanel).toBe(YAML_PANELS.filesystem);
    const snippet = stepB.yamlPanel?.snippet ?? '';
    expect(snippet).toContain('filesystem_policy');
    expect(snippet).toContain('landlock');
    expect(snippet).toContain('process');
    expect(snippet).toContain('run_as_user: sandbox');
  });

  test('step C-pre baseline yaml panel documents OpenShell network egress policy', () => {
    const stepCPre = NARRATIVE.steps['C-pre'];
    expect(stepCPre.yamlPanel).toBe(YAML_PANELS.egressBaseline);
    expect(stepCPre.yamlPanel?.title).toContain('network egress (default deny)');
    const snippet = stepCPre.yamlPanel?.snippet ?? '';
    expect(snippet).toContain('network_policies');
    expect(snippet).toContain('mlflow_direct');
    expect(snippet).toContain('rhoai-mlflow-direct-traces');
    expect(snippet).not.toMatch(/^\s*demo_egress_google:/m);
  });

  test('step C-post yaml panel documents egress allowed demo_egress_google policy', () => {
    const stepCPost = NARRATIVE.steps['C-post'];
    expect(stepCPost.yamlPanel).toBe(YAML_PANELS.egress);
    expect(stepCPost.yamlPanel?.title).toContain('network egress allowed');
    expect(stepCPost.yamlPanel?.fileBefore).toBe('config/openshell/default.yaml');
    expect(stepCPost.yamlPanel?.fileAfter).toBe('config/openshell/google-egress.yaml');
    expect(stepCPost.yamlPanel?.command).toBe('./scripts/demo-allow-google-egress.sh');
    expect(stepCPost.yamlPanel?.defaultOpen).toBe(false);
    const after = stepCPost.yamlPanel?.after ?? '';
    expect(after).toContain('demo_egress_google');
    expect(after).toContain('demo-permissive-google');
    expect(after).toContain('google.com');
    expect(after).toContain('/usr/bin/curl');
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

  test('scenario C before/after hops match runtime egress deny then allow', () => {
    expect(SCENARIO_C_BEFORE_STEPS).toHaveLength(6);
    expect(SCENARIO_C_AFTER_STEPS).toHaveLength(6);
    expect(SCENARIO_C_BEFORE_STEPS[3].text).toContain('denies');
    expect(SCENARIO_C_AFTER_STEPS[3].text).toContain('forwards');
    expect(SCENARIO_C_AFTER_STEPS[3].color).toBe(COLORS.secure);
    expect(SCENARIO_C_AFTER_STEPS[4].text).toContain('HTTP 200');
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
