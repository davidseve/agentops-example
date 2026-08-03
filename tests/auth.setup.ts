import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'state.json');

// oauth-proxy (OpenShift fork, --provider=openshift) redirects to OCP's
// OAuth login page. Credentials are from the cluster's identity provider.
const OCP_USERNAME = process.env.OCP_TEST_USERNAME || 'redhat';
const OCP_PASSWORD = process.env.OCP_TEST_PASSWORD || '';

setup('authenticate via OpenShift-native OAuth', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  await page.goto('/');

  const isOcpLogin = await page.locator('#inputUsername').isVisible({ timeout: 10_000 }).catch(() => false);

  if (isOcpLogin) {
    await page.locator('#inputUsername').fill(OCP_USERNAME);
    await page.locator('#inputPassword').fill(OCP_PASSWORD);
    await page.locator('#co-login-button').click();

    // Handle consent/approve step if present
    const approveButton = page.getByRole('button', { name: /allow selected permissions/i });
    if (await approveButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await approveButton.click();
    }

    await page.waitForURL(/\/(chat|conversation|home|$)/, { timeout: 15_000 });
  }

  await page.context().storageState({ path: STORAGE_STATE });
});
