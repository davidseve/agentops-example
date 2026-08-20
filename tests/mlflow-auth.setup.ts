import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginToMlflowOAuthIfNeeded, MLFLOW_WORKSPACE } from './ui-helpers';

const MLFLOW_STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'mlflow-state.json');

// RHOAI's MLflow route sits behind its own oauth-proxy, registered under the
// `data-science` OAuthClient with `approval_prompt=force`. That flag makes
// OpenShift's OAuth server always re-present the login/consent flow for this
// client, even with a live cluster SSO session (`ssn` cookie) from a
// different OAuthClient (e.g. OpenClaw's oauth-proxy) — so the storageState
// captured by auth.setup.ts cannot be reused here. Log in separately.
setup('authenticate to RHOAI MLflow via OpenShift OAuth', async ({ page }) => {
  fs.mkdirSync(path.dirname(MLFLOW_STORAGE_STATE), { recursive: true });

  await page.goto('./');
  await loginToMlflowOAuthIfNeeded(page);

  // Do not save storageState until MLflow UI is reachable (avoids false-positive setup).
  await expect(page.getByText(MLFLOW_WORKSPACE, { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: MLFLOW_STORAGE_STATE });
});

export { MLFLOW_STORAGE_STATE };
