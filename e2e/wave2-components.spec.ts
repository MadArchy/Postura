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
import {
  enterClientWorkspaceFromShell,
  loginAsClientJuan,
  loginAsManager,
  sidebarTab,
} from './helpers/spec010Auth';

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

  test('wave-2 surfaces name their React workflows and never advertise the previous interface', async ({ page }) => {
    test.setTimeout(120_000);
    const surface = page.locator('[data-testid="react-wave2-surface"]');

    // CLIENT wave-2 surfaces: profile facts, proof wall and onboarding are React-native.
    await loginAsClientJuan(page);
    for (const tab of ['client-profile', 'client-opps', 'client-results']) {
      await sidebarTab(page, tab).click();
      await expect(surface).toBeVisible({ timeout: 15_000 });
      await expect(surface).not.toContainText('interfaz anterior');
      await expect(surface.getByRole('button', { name: /interfaz anterior/ })).toHaveCount(0);
    }
    await sidebarTab(page, 'client-profile').click();
    await expect(page.locator('[data-testid="react-profile-panel"]')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 15_000 });

    // ADMIN wave-2 Sources inventory, reached from the briefing island, points to
    // the React Sources tab where registration and ingestion already work.
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await sidebarTab(page, 'ws-briefing').click();
    const island = page.locator('[data-testid="react-legacy-island"]');
    await expect(island).toBeVisible({ timeout: 15_000 });
    await island.locator('.briefing-metric[data-tab="ws-sources"]').first().click();

    await expect(page.locator('[data-wave2-group="sources"]')).toBeVisible({ timeout: 15_000 });
    await expect(surface).toContainText('pestaña Fuentes');
    await expect(surface).not.toContainText('interfaz anterior');
    const delegation = page.locator('[data-testid="react-sources-delegation"]');
    await expect(delegation).toContainText('pestaña Fuentes');
    await expect(delegation.locator('button')).toHaveCount(0);

    await sidebarTab(page, 'ws-sources-react').click();
    await expect(page.locator('[data-testid="react-ws-sources-open-register"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-ws-sources-poll-all"]')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
  });
});
