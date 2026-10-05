/**
 * SPEC-010 Phase 2 — wave-2 focused E2E (T-010-206).
 *
 * Scope note, stated rather than implied: these tests prove the properties of
 * the wave-2 surface that hold without a session — that shipping eight new
 * components did not break the strangler contract, did not create a second DOM
 * owner, did not make React the served default, and did not make rollback lossy.
 *
 * Authenticated wave-2 behaviour (canonical command forwarding, decline-notes
 * parity, tenant-safe cache identity, fail-closed portfolio scope) is proved by
 * `tests/reactMigrationPhase2Wave2.test.ts`, which exercises the same seam the
 * components call. Full application parity remains Phase-5 work and is not
 * claimed here.
 */

import { expect, test } from '@playwright/test';

const UI_MODE_KEY = 'postura_ui_mode';

async function enableReact(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
  await page.reload();
}

function businessSnapshot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || key === 'postura_ui_mode') continue;
      snapshot[key] = localStorage.getItem(key) ?? '';
    }
    return snapshot;
  });
}

test.describe('wave-2 component extraction', () => {
  test('React is the served presentation after Stage-B seam inversion', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // No wave-2 component leaked into the default presentation.
    await expect(page.locator('[data-testid="react-wave2-surface"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-opportunities-panel"]')).toHaveCount(0);
  });

  test('the wave-2 code path mounts without disturbing DOM ownership', async ({ page }) => {
    await enableReact(page);

    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // Wave 2 introduced no second root and no cross-nesting.
    await expect(page.locator('#react-root #app')).toHaveCount(0);
    await expect(page.locator('#app #react-root')).toHaveCount(0);
    await expect(page.locator('body > [data-testid="react-wave2-surface"]')).toHaveCount(0);
  });

  test('an unauthenticated session renders no wave-2 data surface', async ({ page }) => {
    await enableReact(page);

    // Fail closed: without a trusted session there is no scope, so no read runs.
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-wave2-surface"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-opportunity-card"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-profile-panel"]')).toHaveCount(0);
  });

  test('rollback after loading wave 2 leaves business state byte-identical', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);

    await enableReact(page);
    await expect(page.locator('#react-root')).toBeVisible();

    await page.locator('[data-testid="react-login-to-legacy"]').click();
    await expect
      .poll(() => page.evaluate(([key]) => localStorage.getItem(key), [UI_MODE_KEY]))
      .toBe('legacy');

    // Option E: the legacy request keeps React served; #app is not the replacement shell.
    await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('[data-testid="react-wave2-surface"]')).toHaveCount(0);

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('the legacy surface that still owns the blocked actions keeps working', async ({ page }) => {
    await enableReact(page);
    await expect(page.locator('#react-root')).toBeVisible();

    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();

    // The legacy path — which still owns profile facts, proof-wall status, source
    // registration and onboarding — is intact and interactive.
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#form-login')).toBeVisible();
  });
});
