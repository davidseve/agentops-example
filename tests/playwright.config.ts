import { defineConfig } from '@playwright/test';

// OpenClaw gateway URL (Route with edge TLS)
const baseURL = process.env.OPENCLAW_BASE_URL || 'https://openclaw-gw-openshell.apps.ocp.sandbox701.opentlc.com';

// MLflow UI URL (RHOAI-managed, behind oauth-proxy)
const mlflowBaseURL = (process.env.MLFLOW_BASE_URL || 'https://rh-ai.apps.ocp.sandbox701.opentlc.com/mlflow').replace(/\/?$/, '/');

const mlflowAuthHeaders: Record<string, string> = {};
if (process.env.MLFLOW_AUTH_TOKEN) {
  mlflowAuthHeaders['Authorization'] = `Bearer ${process.env.MLFLOW_AUTH_TOKEN}`;
}
if (process.env.MLFLOW_WORKSPACE) {
  mlflowAuthHeaders['X-MLFLOW-WORKSPACE'] = process.env.MLFLOW_WORKSPACE;
}

export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  timeout: 60_000,
  retries: 0,
  projects: [
    {
      name: 'ui-tests',
      testMatch: /openclaw-ui\.spec\.ts/,
    },
    {
      name: 'security-tests',
      testMatch: /sandbox-security\.spec\.ts/,
    },
    {
      name: 'mlflow-ui-tests',
      testMatch: /mlflow-ui\.spec\.ts/,
      dependencies: ['ui-tests'],
      use: {
        baseURL: mlflowBaseURL,
        extraHTTPHeaders: mlflowAuthHeaders,
      },
    },
  ],
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './playwright-report' }],
  ],
});
