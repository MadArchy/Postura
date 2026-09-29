/**
 * SPEC-010 · Playwright E2E / parity harness foundation (T-010-104).
 *
 * Phase 1 proves only the foundation: the app boots, the legacy presentation
 * works, the React island mounts, the toggle and rollback work, and the two DOM
 * owners never overlap. Full journey and parity suites belong to Phase 5.
 *
 * No paid or external provider flow is exercised.
 *
 * Firebase: E2E runs only against the Firebase Emulator Suite (`npm run test:e2e`
 * wraps `firebase emulators:exec`). Vite runs in `--mode test` with the resolved
 * `.env.test` target passed explicitly; production project IDs abort the run.
 */

import { defineConfig, devices } from '@playwright/test';
import { E2E_CHROMIUM_ARGS, resolveE2EFirebaseEnv } from './e2e/support/globalSetup';

const PORT = 3100;
const e2eFirebaseEnv = resolveE2EFirebaseEnv();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/globalSetup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { args: E2E_CHROMIUM_ARGS },
  },
  webServer: {
    command: `npx vite --mode test --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    env: e2eFirebaseEnv,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
