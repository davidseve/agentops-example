import { defineConfig } from '@playwright/test';
import * as path from 'path';

// OpenClaw gateway URL (via oauth-proxy — requires OCP login in browser)
const baseURL = process.env.OPENCLAW_BASE_URL || 'https://openclaw-gw--openclaw-ui.apps.ocp.sandbox701.opentlc.com';

// MLflow UI URL (RHOAI-managed, behind oauth-proxy)
const mlflowBaseURL = (process.env.MLFLOW_BASE_URL || 'https://rh-ai.apps.ocp.sandbox701.opentlc.com/mlflow').replace(/\/?$/, '/');

const mlflowAuthHeaders: Record<string, string> = {};
if (process.env.MLFLOW_AUTH_TOKEN) {
  mlflowAuthHeaders['Authorization'] = `Bearer ${process.env.MLFLOW_AUTH_TOKEN}`;
}
if (process.env.MLFLOW_WORKSPACE) {
  mlflowAuthHeaders['X-MLFLOW-WORKSPACE'] = process.env.MLFLOW_WORKSPACE;
}

const STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'state.json');

export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  timeout: 60_000,
  retries: 0,
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL },
    },
    {
      name: 'ui-tests',
      testMatch: /openclaw-ui\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { storageState: STORAGE_STATE },
    },
    {
      name: 'security-tests',
      testMatch: /sandbox-security\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { storageState: STORAGE_STATE },
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
