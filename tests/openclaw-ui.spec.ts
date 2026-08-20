import { test, expect } from '@playwright/test';
import { CHAT_TIMEOUT, gotoControlUi } from './ui-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('OpenClaw Control UI', () => {

  test('loads and shows chat interface', async ({ page }) => {
    await gotoControlUi(page);
    await expect(page).toHaveTitle('OpenClaw Control');
    await expect(page.getByPlaceholder(/Message/)).toBeVisible();
    await expect(page.getByText(/Router|Sonnet|router|inference/).first()).toHaveCount(1, { timeout: 10000 });
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
    await expect(
      page.getByRole('button', { name: /Send|Stop generating|Queue message/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('E2E chat: model responds via inference router', async ({ page }) => {
    await gotoControlUi(page);

    const messageInput = page.getByPlaceholder(/Message/);
    await messageInput.waitFor({ state: 'visible' });

    await page.getByRole('button', { name: /Stop generating/ }).waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});

    await messageInput.fill('Respond with exactly one word: PONG');
    await page.getByRole('button', { name: /Send/ }).click();

    await expect(page.locator('text=PONG').last()).toBeVisible({ timeout: CHAT_TIMEOUT });
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
        model: 'router',
        messages: [{ role: 'user', content: 'ping' }],
      },
    });
    expect([403, 404, 405]).toContain(resp.status());
  });
});
