import { expect, Page } from '@playwright/test';

export const MLFLOW_WORKSPACE = process.env.MLFLOW_WORKSPACE || 'openshell';
export const MLFLOW_EXPERIMENT_NAME = process.env.MLFLOW_EXPERIMENT_NAME || 'openclaw-tracing';

export function requireMlflowExperimentId(): string {
  const id = process.env.MLFLOW_EXPERIMENT_ID;
  if (!id) {
    throw new Error(
      'MLFLOW_EXPERIMENT_ID is not set. Run via make test-mlflow / make test-e2e ' +
        '(scripts/run-playwright-tests.sh resolves it from the cluster).',
    );
  }
  return id;
}

const OCP_USERNAME = process.env.OCP_TEST_USERNAME || '';
const OCP_PASSWORD = process.env.OCP_TEST_PASSWORD || '';

function usernameField(page: Page) {
  return page.locator('#inputUsername').or(page.getByRole('textbox', { name: /^username$/i }));
}

function passwordField(page: Page) {
  return page.locator('#inputPassword').or(page.getByRole('textbox', { name: /^password$/i }));
}

function loginButton(page: Page) {
  return page.locator('#co-login-button').or(page.getByRole('button', { name: /^log in$/i }));
}

function missingCredentialsError(): Error {
  return new Error(
    'MLflow UI OAuth requires OCP_TEST_USERNAME and OCP_TEST_PASSWORD in secrets/secrets.env.',
  );
}

/** Log in through OpenShift OAuth when MLflow redirects to the cluster login page. */
export async function loginToMlflowOAuthIfNeeded(page: Page): Promise<void> {
  const needsLogin = await usernameField(page).first().isVisible({ timeout: 10_000 }).catch(() => false);
  if (!needsLogin) {
    return;
  }

  if (!OCP_USERNAME || !OCP_PASSWORD) {
    throw missingCredentialsError();
  }

  await usernameField(page).first().fill(OCP_USERNAME);
  await passwordField(page).first().fill(OCP_PASSWORD);
  await expect(loginButton(page).first()).toBeEnabled({ timeout: 5_000 });
  await loginButton(page).first().click();

  const approveButton = page.getByRole('button', { name: /allow selected permissions/i });
  if (await approveButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await approveButton.click();
  }

  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

  if (await page.getByText(/invalid login or password/i).isVisible({ timeout: 2_000 }).catch(() => false)) {
    throw new Error(
      'MLflow OAuth login failed. Check OCP_TEST_USERNAME and OCP_TEST_PASSWORD in secrets/secrets.env.',
    );
  }
}

/** Open MLflow UI and select the target workspace (re-auth if session expired). */
export async function selectMlflowWorkspace(page: Page, workspace = MLFLOW_WORKSPACE): Promise<void> {
  await page.goto('./');
  await loginToMlflowOAuthIfNeeded(page);

  const workspaceLink = page.getByText(workspace, { exact: true });
  await expect(workspaceLink).toBeVisible({ timeout: 30_000 });
  await workspaceLink.click();
  await page.waitForTimeout(1500);
}
