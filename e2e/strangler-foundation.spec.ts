/**
 * SPEC-010 Phase 1 — strangler foundation E2E (T-010-104).
 *
 * Proves the four foundation properties and nothing more:
 *   1. the app boots and the React presentation is the Stage-B default
 *   2. the React island mounts when requested
 *   3. a legacy request (served as React under Option E) does not touch business state
 *   4. the two DOM owners never render simultaneously
 *
 * Product parity for migrated pages is Phase-5 work and is not claimed here.
 */

import { expect, test } from '@playwright/test';

const UI_MODE_KEY = 'postura_ui_mode';

test.describe('strangler foundation', () => {
  test('the app boots with the React presentation by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();

    // Legacy rollback remains available but is hidden in normal Stage-B mode.
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('[data-testid="react-shell"]')).toBeVisible();
  });

  test('the React island mounts when the toggle is set', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();

    await expect(page.locator('#react-root')).toBeVisible();
    // Unauthenticated, so the React shell presents its login surface.
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  });

  test('only one presentation owner is visible at a time', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();

    // React visible implies legacy hidden — never both.
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // And the React root never contains legacy markup, nor vice versa.
    await expect(page.locator('#react-root #app')).toHaveCount(0);
    await expect(page.locator('#app #react-root')).toHaveCount(0);
  });

  test('a legacy request keeps React served and leaves business state untouched', async ({ page }) => {
    await page.goto('/');

    // Snapshot every persisted business key before switching presentation.
    const before = await page.evaluate(() => {
      const snapshot: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || key === 'postura_ui_mode') continue;
        snapshot[key] = localStorage.getItem(key) ?? '';
      }
      return snapshot;
    });

    await page.evaluate(
      ([key]) => localStorage.setItem(key, 'react'),
      [UI_MODE_KEY]
    );
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();

    // Request legacy through the strangler seam; no user-facing control exists. Under
    // Option E the request is persisted but React stays the served shell.
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

    await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    const after = await page.evaluate(() => {
      const snapshot: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || key === 'postura_ui_mode') continue;
        snapshot[key] = localStorage.getItem(key) ?? '';
      }
      return snapshot;
    });

    // The legacy request required no data migration: business storage is identical.
    expect(after).toEqual(before);
  });
});
