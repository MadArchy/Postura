/**
 * SPEC-010 Phase 4 — controller strangler E2E (T-010-402, T-010-405).
 *
 * §28 asks for parity evidence wherever orchestration changed. Four
 * responsibilities left `main.ts` this phase — presentation state, toasts, modal
 * dispatch and navigation rules — and all four are reachable in a real browser
 * without a session, so they are proved here rather than argued.
 *
 * Scope note, stated rather than implied: authenticated orchestration (tab
 * switching inside a workspace, the 17 modals, deep-linked notifications) needs
 * seeded credentials that are not formally available in this environment. Those
 * paths are covered by `tests/reactMigrationPhase4Controllers.test.ts`, which
 * exercises the extracted modules directly. Authenticated E2E stays PARTIAL and
 * is not claimed here.
 */

import { expect, test } from '@playwright/test';

const UI_MODE_KEY = 'postura_ui_mode';

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

test.describe('Phase-4 controller strangler', () => {
  test('an explicit legacy request keeps canonical React served (Option E)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();

    // React-exclusive slots make whole-app legacy rollback illegal: the request is
    // persisted, but React stays mounted and #app never becomes the served shell.
    expect(await page.evaluate(([key]) => localStorage.getItem(key), [UI_MODE_KEY])).toBe('legacy');
    await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
  });

  test('a failed React sign-in shows the error and keeps the form usable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-login-error"]')).toHaveCount(0);

    await page.fill('#react-login-email', 'nobody@example.invalid');
    await page.fill('#react-login-password', 'definitely-wrong');
    await page.click('[data-testid="react-login-submit"]');

    await expect(page.locator('[data-testid="react-login-error"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-login-error"]')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#react-login-email')).toBeEditable();
    await expect(page.locator('#react-login-password')).toBeEditable();
    await expect(page.locator('[data-testid="react-login-submit"]')).toBeEnabled();
    await expect(page.locator('[data-testid="react-shell-logout"]')).toHaveCount(0);
  });

  test('a failed React sign-in reports the failure without writing business state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    const before = await businessSnapshot(page);

    await page.fill('#react-login-email', 'nobody@example.invalid');
    await page.fill('#react-login-password', 'definitely-wrong');
    await page.click('[data-testid="react-login-submit"]');
    await expect(page.locator('[data-testid="react-login-error"]')).toBeVisible({ timeout: 15_000 });

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('nothing claims the toast container inside either presentation root', async ({ page }) => {
    await page.goto('/');

    // The toast sink is created lazily at body level. Whether or not it exists
    // yet, it must never be nested inside a root that another owner renders.
    const placement = await page.evaluate(() => {
      const el = document.getElementById('toast-container');
      return {
        exists: !!el,
        parentIsBody: el ? el.parentElement === document.body : true,
        insideApp: !!document.getElementById('app')?.contains(el ?? null) && !!el,
        insideReact: !!document.getElementById('react-root')?.contains(el ?? null) && !!el,
      };
    });
    expect(placement.parentIsBody).toBe(true);
    expect(placement.insideApp).toBe(false);
    expect(placement.insideReact).toBe(false);
  });

  test('the strangler toggle round trip leaves business state unchanged after the extraction', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('exactly one presentation root is visible at a time', async ({ page }) => {
    await page.goto('/');

    const visibleRoots = await page.evaluate(() => {
      const shown = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden');
      };
      return ['app', 'react-root'].filter(shown);
    });

    // Stage B normal mode is React-owned; legacy rollback remains explicit.
    expect(visibleRoots).toEqual(['react-root']);
  });
});
