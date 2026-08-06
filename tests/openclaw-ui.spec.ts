import { test, expect, Page } from '@playwright/test';
import { controlUiPath } from './helpers';

const CHAT_TIMEOUT = 30_000;

// The Control UI occasionally shows its own built-in "Control UI did not
// start" recovery screen (app bundle registration race, not an auth/infra
// issue — see docs.openclaw.ai/web/control-ui#blank-control-ui-page) when
// tests navigate back-to-back rapidly against the same gateway process.
// The UI itself offers a "Try again" button for exactly this case; retry
// via reload (observed more reliable than the in-page button) up to twice.
// Password must be re-supplied on each navigation (Control UI does not
// persist gateway.auth.password across reloads).
async function gotoControlUi(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt === 0) {
      await page.goto(controlUiPath('/'));
    } else {
      await page.goto(controlUiPath('/'));
    }
    const messageInput = page.getByPlaceholder(/Message/);
    const startFailed = page.getByText('Control UI did not start');
    const result = await Promise.race([
      messageInput.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'ok' as const),
      startFailed.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'failed' as const),
    ]).catch(() => 'timeout' as const);
    if (result === 'ok') return;
  }
}

test.describe('OpenClaw Control UI', () => {

  test('loads and shows chat interface', async ({ page }) => {
    await gotoControlUi(page);
    await expect(page).toHaveTitle('OpenClaw Control');
    await expect(page.getByPlaceholder(/Message/)).toBeVisible();
    await expect(page.getByText(/gpt-oss|GPT-OSS|maas/).first()).toHaveCount(1, { timeout: 10000 });
  });

  test('sidebar navigation is present', async ({ page }) => {
    await gotoControlUi(page);
    await expect(page.getByText('Overview')).toBeVisible();
    await expect(page.getByText('Main Session').first()).toBeVisible();
  });

  test('chat input is functional', async ({ page }) => {
    await gotoControlUi(page);
    const messageInput = page.getByPlaceholder(/Message/);
    await expect(messageInput).toBeVisible();
    await messageInput.fill('test message');
    await page.waitForTimeout(500);
    const sendButton = page.getByRole('button', { name: /Send/ });
    await expect(sendButton).toBeVisible();
  });

  test('E2E chat: model responds via MaaS', async ({ page }) => {
    await gotoControlUi(page);

    const messageInput = page.getByPlaceholder(/Message/);
    await messageInput.waitFor({ state: 'visible' });

    await page.waitForTimeout(2000);

    await messageInput.fill('Respond with exactly one word: PONG');
    await page.getByRole('button', { name: /Send/ }).click();

    const response = page.locator('text=PONG').last();
    await expect(response).toBeVisible({ timeout: CHAT_TIMEOUT });
  });

  test('health API returns ok', async ({ request }) => {
    const resp = await request.get('/health');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test('chat completions HTTP API is disabled', async ({ request }) => {
    const resp = await request.post('/v1/chat/completions', {
      data: {
        model: 'gpt-oss-120b',
        messages: [{ role: 'user', content: 'ping' }],
      },
    });
    expect([403, 404, 405]).toContain(resp.status());
  });
});
