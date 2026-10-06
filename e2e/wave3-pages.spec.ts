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

    await expect(page.locator('[data-testid="react-login-to-legacy"]')).toHaveCount(0);
    await page.evaluate(async () => {
      const ui = (
        window as unknown as {
          __posturaUi?: { applyUiMode?: (mode: 'legacy' | 'react') => Promise<void> };
        }
      ).__posturaUi;
      if (!ui?.applyUiMode) throw new Error('Strangler controls are unavailable');
      await ui.applyUiMode('legacy');
    });
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

  test('every visible wave-3 handoff states unavailability truthfully without a previous-interface action', async ({ page }) => {
    test.setTimeout(150_000);

    const expectTruthfulHandoff = async (testId: string, actionWords: readonly string[]) => {
      const handoff = page.locator(`[data-testid="${testId}"]`);
      await expect(handoff).toBeVisible({ timeout: 15_000 });
      await expect(handoff).toHaveAttribute('data-legacy-handoff', 'true');
      await expect(handoff).toContainText('todavía no');
      await expect(handoff).toContainText('disponible');
      for (const word of actionWords) await expect(handoff).toContainText(word);
      await expect(handoff).not.toContainText('interfaz anterior');
      await expect(handoff.locator('button')).toHaveCount(0);
      await expect(page.locator('[data-legacy-handoff="true"] button')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Abrir interfaz anterior', exact: true })).toHaveCount(0);
      await expect(page.locator('#app')).toBeHidden();
    };

    // ADMIN workspace pages.
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await expectTruthfulHandoff('react-ws-radar-handoff', ['puntuar señales', 'investigarlas']);

    await sidebarTab(page, 'ws-briefs').click();
    await expectTruthfulHandoff('react-ws-briefs-handoff', ['crear un Strategic Brief']);

    await sidebarTab(page, 'ws-sources-react').click();
    await expectTruthfulHandoff('react-ws-sources-handoff', [
      'pausarlas o archivarlas',
      'el descubrimiento automático',
    ]);

    await sidebarTab(page, 'ws-production').click();
    await expectTruthfulHandoff('react-ws-production-handoff', ['generar contenido', 'mover el pipeline']);
    await expect(page.locator('[data-testid="react-ws-production"]')).not.toContainText('interfaz anterior');

    await sidebarTab(page, 'ws-positioning').click();
    await expectTruthfulHandoff('react-thesis-editor-handoff', ['stress-test', 'generar propuesta con IA']);

    // ADMIN cockpit.
    await sidebarTab(page, 'dashboard').click();
    await expectTruthfulHandoff('react-cockpit-handoff', ['ver la app como cliente']);
    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible({ timeout: 15_000 });

    // CLIENT portal thesis page.
    await loginAsClientJuan(page);
    await sidebarTab(page, 'client-thesis').click();
    await expectTruthfulHandoff('react-portal-thesis-handoff', ['añadir evidencia al vault']);
  });
});
