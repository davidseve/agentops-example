import { test, expect, Page } from '@playwright/test';

const WORKSPACE = process.env.MLFLOW_WORKSPACE || 'openshell';
const EXPERIMENT_ID = process.env.MLFLOW_EXPERIMENT_ID || '1';

async function selectWorkspace(page: Page) {
  await page.goto('./');
  const workspace = page.getByText(WORKSPACE, { exact: true });
  await expect(workspace).toBeVisible({ timeout: 15_000 });
  await workspace.click();
  await page.waitForTimeout(1500);
}

test.describe('RHOAI MLflow UI', () => {

  test.beforeEach(async ({ page }) => {
    await selectWorkspace(page);
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
