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

  test('chat completions HTTP API requires auth', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const resp = await ctx.post('/v1/chat/completions', {
        data: {
          model: 'openclaw/default',
          messages: [{ role: 'user', content: 'ping' }],
        },
      });
      expect([401, 403]).toContain(resp.status());
    } finally {
      await ctx.dispose();
    }
  });

  test('authenticated models API lists openclaw/default', async ({ playwright, baseURL }) => {
    const password = process.env.OPENCLAW_GATEWAY_PASSWORD;
    expect(password).toBeTruthy();
    const ctx = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { Authorization: `Bearer ${password}` },
    });
    try {
      const resp = await ctx.get('/v1/models');
      expect(resp.ok()).toBeTruthy();
      const body = await resp.json();
      const ids = (body.data || []).map((m: { id: string }) => m.id);
      expect(ids.some((id: string) => id.includes('openclaw'))).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });
});
