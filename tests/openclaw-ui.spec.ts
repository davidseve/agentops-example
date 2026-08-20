import { test, expect, Page } from '@playwright/test';
import { connectControlUi } from './helpers';

const CHAT_TIMEOUT = 30_000;

// The Control UI occasionally shows its own built-in "Control UI did not
// start" recovery screen (app bundle registration race, not an auth/infra
// issue — see docs.openclaw.ai/web/control-ui#blank-control-ui-page) when
// tests navigate back-to-back rapidly against the same gateway process.
// Retry connect up to twice. Password must be re-entered each navigation
// (Control UI does not persist gateway.auth.password across reloads).
async function gotoControlUi(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await connectControlUi(page, '/', 15_000);
      return;
    } catch {
      // retry
    }
  }
  await connectControlUi(page, '/', 30_000);
}

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
    // Parallel workers share the main session; an in-flight agent run shows
    // "Stop generating" instead of "Send". Either proves the composer is live.
    await expect(
      page.getByRole('button', { name: /Send|Stop generating|Queue message/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('E2E chat: model responds via inference router', async ({ page }) => {
    await gotoControlUi(page);

    const messageInput = page.getByPlaceholder(/Message/);
    await messageInput.waitFor({ state: 'visible' });

    // Wait out any in-flight run from a parallel worker on the shared session.
    await page.getByRole('button', { name: /Stop generating/ }).waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});

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
