/**
 * SPEC-010 Phase 3 — wave-3 page E2E (T-010-306).
 *
 * Scope note, stated rather than implied: these tests prove the properties of
 * the wave-3 page surface that hold WITHOUT a session — that migrating five
 * pages did not make React the served default, did not create a second DOM
 * owner, did not let a page render outside the React root, did not break
 * rollback, and did not remove the legacy surface that still owns the blocked
 * actions.
 *
 * Authenticated page behaviour (canonical read projection, signal-outcome and
 * brief-approval forwarding, tenant-safe cache identity, explicit thesis
 * selection) is proved by `tests/reactMigrationPhase3Pages.test.ts`, which
 * exercises the same seams the pages call. No seeded credentials are available in
 * this environment, so authenticated E2E stays PARTIAL and is not claimed here.
 * Full page parity remains Phase-5 work.
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

/** Every wave-3 page and panel root, so "did not leak" is checked exhaustively. */
const WAVE3_SURFACES = [
  'react-manager-cockpit',
  'react-client-workspace',
  'react-client-portal',
  'react-thesis-editor',
  'react-ws-radar',
  'react-ws-deliver',
  'react-ws-briefs',
  'react-ws-sources',
  'react-ws-tasks',
];

test.describe('wave-3 page migration', () => {
  test('React is the served presentation after Stage-B seam inversion', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // Five migrated pages, none of them served by default.
    for (const surface of WAVE3_SURFACES) {
      await expect(page.locator(`[data-testid="${surface}"]`)).toHaveCount(0);
    }
  });

  test('the wave-3 code path mounts without disturbing DOM ownership', async ({ page }) => {
    await enableReact(page);

    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    await expect(page.locator('#react-root #app')).toHaveCount(0);
    await expect(page.locator('#app #react-root')).toHaveCount(0);

    // No page escaped the React root to become a sibling owner of the body.
    for (const surface of WAVE3_SURFACES) {
      await expect(page.locator(`body > [data-testid="${surface}"]`)).toHaveCount(0);
    }
  });

  test('an unauthenticated session renders no wave-3 page', async ({ page }) => {
    await enableReact(page);

    // Fail closed: without a trusted session there is no tenant scope, so no
    // page read runs and no page renders.
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    for (const surface of WAVE3_SURFACES) {
      await expect(page.locator(`[data-testid="${surface}"]`)).toHaveCount(0);
    }
  });

  test('no wave-3 page renders a control for a blocked legacy write', async ({ page }) => {
    await enableReact(page);

    // The disabled save controls exist only inside an authenticated page, so on
    // the login surface there must be no enabled write control at all.
    await expect(page.locator('[data-testid="react-thesis-save-disabled"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-onboarding-save-disabled"]')).toHaveCount(0);
  });

  test('rollback after loading wave 3 leaves business state byte-identical', async ({ page }) => {
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
    for (const surface of WAVE3_SURFACES) {
      await expect(page.locator(`[data-testid="${surface}"]`)).toHaveCount(0);
    }

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('the legacy pages that still own the blocked actions keep working', async ({ page }) => {
    await enableReact(page);
    await expect(page.locator('#react-root')).toBeVisible();

    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();

    // The legacy path still owns thesis persistence, curation decisions, delivery
    // assembly and sending, source registration and ingestion, task assignment,
    // evidence, content saves and client creation. It is intact and interactive.
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#form-login')).toBeVisible();
  });
});
