import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { connectControlUi } from './ui-helpers';

const STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'state.json');

// OpenClaw gateway.auth.mode: password — Control UI no longer applies
// `/?password=` (it strips the query param without setting auth). Authenticate
// by filling the Password field and clicking Connect. See ADR-0011 / OC-5.
setup('authenticate via OpenClaw gateway password', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  await connectControlUi(page, '/');

  await page.context().storageState({ path: STORAGE_STATE });
});
