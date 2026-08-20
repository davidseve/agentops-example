import { test, expect } from '@playwright/test';
import { requireMlflowExperimentId, selectMlflowWorkspace } from './ui-helpers';

const EXPERIMENT_ID = requireMlflowExperimentId();

test.describe('RHOAI MLflow UI', () => {

  test.beforeEach(async ({ page }) => {
    await selectMlflowWorkspace(page);
  });

  test('loads with openclaw-tracing experiment', async ({ page }) => {
    await page.goto(`./#/experiments/${EXPERIMENT_ID}`);
    await expect(page.getByRole('link', { name: 'openclaw-tracing' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Traces', { exact: true })).toBeVisible();
  });

  test('shows agent traces in Traces tab', async ({ page }) => {
    await page.goto(`./#/experiments/${EXPERIMENT_ID}/traces`);
    await expect(page.getByText('Trace ID')).toBeVisible({ timeout: 15_000 });

    const traceRows = page.locator('text=/tr-[0-9a-f]{32}/');
    await expect(traceRows.first()).toBeVisible({ timeout: 15_000 });

    const count = await traceRows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('trace list includes E2E chat content from Control UI', async ({ page }) => {
    await page.goto(`./#/experiments/${EXPERIMENT_ID}/traces`);
    await expect(page.getByText('Trace ID')).toBeVisible({ timeout: 15_000 });

    // The Playwright ui-tests chat sends "Respond with exactly one word: PONG"
    await expect(page.getByText(/PONG|Respond with exactly one word/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
