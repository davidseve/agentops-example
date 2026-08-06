import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { controlUiPath } from './helpers';

const STORAGE_STATE = path.join(__dirname, 'test-results', '.auth', 'state.json');

// OpenClaw gateway.auth.mode: password — authenticate via Control UI query
// param (password is not persisted across reloads; ?password= is the
// supported bootstrap path). See ADR-0011.
setup('authenticate via OpenClaw gateway password', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  await page.goto(controlUiPath('/'));

  // Wait for the Control UI to connect (message input visible means WS auth succeeded).
  const messageInput = page.getByPlaceholder(/Message/);
  await messageInput.waitFor({ state: 'visible', timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
