/** Shared Playwright helpers for OpenClaw Control UI password auth (ADR-0011). */

import type { Page } from '@playwright/test';

export function requireGatewayPassword(): string {
  const password = process.env.OPENCLAW_GATEWAY_PASSWORD;
  if (!password) {
    throw new Error(
      'OPENCLAW_GATEWAY_PASSWORD is required (set in secrets/secrets.env or the environment)',
    );
  }
  return password;
}

/**
 * @deprecated OpenClaw Control UI (2026.6.x) strips `?password=` without applying
 * it. Prefer {@link connectControlUi}. Kept for call sites that only need a path.
 */
export function controlUiPath(path = '/'): string {
  return path;
}

/** Load Control UI and authenticate via the password field + Connect. */
export async function connectControlUi(page: Page, path = '/', timeout = 30_000): Promise<void> {
  const password = requireGatewayPassword();
  await page.goto(path);

  const messageInput = page.getByPlaceholder(/Message/);
  if (await messageInput.isVisible().catch(() => false)) {
    return;
  }

  await page.getByRole('textbox', { name: /Password/ }).fill(password);
  await page.getByRole('button', { name: /^Connect$/ }).click();
  await messageInput.waitFor({ state: 'visible', timeout });
}
