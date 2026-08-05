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
const MLFLOW_STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'mlflow-state.json');

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
      name: 'mlflow-auth-setup',
      testMatch: /mlflow-auth\.setup\.ts/,
      use: { baseURL: mlflowBaseURL },
    },
    {
      name: 'mlflow-ui-tests',
      testMatch: /mlflow-ui\.spec\.ts/,
      // Depends on ui-tests so the E2E chat test (which produces the trace
      // this project asserts on) has already run, and on its own auth setup
      // — see mlflow-auth.setup.ts for why the openclaw-ui storageState
      // can't be reused (RHOAI's `data-science` OAuthClient forces
      // re-authentication regardless of cluster SSO session).
      dependencies: ['ui-tests', 'mlflow-auth-setup'],
      use: {
        baseURL: mlflowBaseURL,
        extraHTTPHeaders: mlflowAuthHeaders,
        storageState: MLFLOW_STORAGE_STATE,
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
