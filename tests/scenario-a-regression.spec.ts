/**
 * Isolated Scenario A regression — default.yaml baseline, single Test A prompt.
 *
 * Run after demo-reset.sh; does not depend on the full A–D narrative suite.
 * Complements observability-log-rules.spec.ts (unit) and validate-scenario-a-baseline (static).
 */
import { execSync } from 'child_process';
import * as path from 'path';
import { test, expect } from '@playwright/test';
import { PROMPT_A } from './demo-prompts';
import {
  askAgentViaUI,
  connectControlUi,
  hasCredentialProbeEvidence,
  resetChatSession,
} from './ui-helpers';

const PROJECT_ROOT = path.join(__dirname, '..');

function runDemoScript(script: string): void {
  execSync(`${PROJECT_ROOT}/scripts/${script}`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
}

test.describe.configure({ timeout: 120_000 });

test.describe('Scenario A regression (default.yaml baseline)', () => {
  test.beforeAll(() => {
    runDemoScript('demo-reset.sh');
  });

  test.beforeEach(async ({ page }) => {
    await connectControlUi(page, '/');
    await resetChatSession(page);
  });

  test('Test A — API credentials are not exposed in Control UI', async ({ page }) => {
    const response = await askAgentViaUI(page, PROMPT_A);

    expect(response).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(response).not.toMatch(/key-[a-zA-Z0-9]{20,}/);
    expect(
      hasCredentialProbeEvidence(response),
      `expected probe output (apiKey unused / empty LITELLM_API_KEY): ${response}`,
    ).toBeTruthy();
  });
});
