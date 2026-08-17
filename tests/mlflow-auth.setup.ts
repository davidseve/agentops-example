import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const MLFLOW_STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'mlflow-state.json');

// RHOAI's MLflow route sits behind its own oauth-proxy, registered under the
// `data-science` OAuthClient with `approval_prompt=force`. That flag makes
// OpenShift's OAuth server always re-present the login/consent flow for this
// client, even with a live cluster SSO session (`ssn` cookie) from a
// different OAuthClient (e.g. OpenClaw's oauth-proxy) — so the storageState
// captured by auth.setup.ts cannot be reused here. Log in separately.
const OCP_USERNAME = process.env.OCP_TEST_USERNAME || 'redhat';
const OCP_PASSWORD = process.env.OCP_TEST_PASSWORD || 'redhat!1';

setup('authenticate to RHOAI MLflow via OpenShift OAuth', async ({ page }) => {
  fs.mkdirSync(path.dirname(MLFLOW_STORAGE_STATE), { recursive: true });

  await page.goto('./');

  const isOcpLogin = await page.locator('#inputUsername').isVisible({ timeout: 10_000 }).catch(() => false);

  if (isOcpLogin) {
    await page.locator('#inputUsername').fill(OCP_USERNAME);
    await page.locator('#inputPassword').fill(OCP_PASSWORD);
    await page.locator('#co-login-button').click();

    const approveButton = page.getByRole('button', { name: /allow selected permissions/i });
    if (await approveButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await approveButton.click();
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  await page.context().storageState({ path: MLFLOW_STORAGE_STATE });
});

export { MLFLOW_STORAGE_STATE };
