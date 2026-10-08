/**
 * SPEC-010 T-010-403 — Stage-B seam inversion E2E.
 *
 * Uses Playwright's supported `channel: 'chrome'` when managed Chromium is
 * unavailable. No machine-specific executable paths are committed.
 */

import { expect, test } from '@playwright/test';
import { waitForCockpitAbrirWorkspace } from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const UI_MODE_KEY = 'postura_ui_mode';
const MANAGER_EMAIL = 'manager@postura.internal';
const MANAGER_PASSWORD = 'Postura2026!';
const CLIENT_ID = 'client_juan_001';

type AuditEvent = { action: string; entityType?: string; entityId?: string };

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

async function visibleRoots(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const shown = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden');
    };
    return ['app', 'react-root'].filter(shown);
  });
}

async function auditEvents(page: import('@playwright/test').Page): Promise<AuditEvent[]> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('postura_audit_logs');
    return raw ? (JSON.parse(raw) as AuditEvent[]) : [];
  });
}

async function countAuditAction(page: import('@playwright/test').Page, action: string) {
  const events = await auditEvents(page);
  return events.filter((event) => event.action === action).length;
}

function sidebarTab(page: import('@playwright/test').Page, tab: string) {
  return page.locator(`.sidebar-link[data-tab="${tab}"]`);
}

async function seedSendableDraft(page: import('@playwright/test').Page, clientId: string) {
  await page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');

    for (const pkg of dbService.getDeliveriesByClient(cid)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }

    const pkg = dbService.ensureDraftDelivery(cid, 'user_admin_01');
    dbService.addDeliveryItem(pkg.id, {
      kind: 'ADVICE',
      title: 'E2E T403 briefing advice',
      rationale: 'Deterministic Stage-B send proof without provider calls.',
    });

    if (dbService.getDraftDelivery(cid)?.items.length !== 1) {
      throw new Error('Expected exactly one delivery item for #18 proof.');
    }
  }, { cid: clientId });
}

async function enterClientWorkspaceFromShell(page: import('@playwright/test').Page) {
  await sidebarTab(page, 'clients').click();
  const openWorkspace = await waitForCockpitAbrirWorkspace(page);
  await openWorkspace.click();
  await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 15_000 });
}

async function loginAsManager(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('#react-root')).toBeVisible();
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  await page.fill('#react-login-email', MANAGER_EMAIL);
  await page.fill('#react-login-password', MANAGER_PASSWORD);
  await page.click('[data-testid="react-login-submit"]');
  await expect(page.locator('[data-testid="react-login"]')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible();
}

async function openClientWorkspace(page: import('@playwright/test').Page) {
  await loginAsManager(page);
  await enterClientWorkspaceFromShell(page);
}

test.describe('T-010-403 Stage-B seam inversion', () => {
  test('Stage-B normal mode boots the React shell by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#react-root')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-shell"]')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });

  test('a legacy request round trip does not mutate business storage', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);

    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('#react-root')).toBeVisible();

    expect(await businessSnapshot(page)).toEqual(before);
  });

  test('exactly one global presentation root is visible in normal Stage-B mode', async ({ page }) => {
    await page.goto('/');
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });

  test('manager navigation keeps a single React shell authority', async ({ page }) => {
    await openClientWorkspace(page);

    await sidebarTab(page, 'clients').click();
    await expect(page.locator('[data-testid="react-manager-cockpit"]')).toBeVisible();

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);

    await page.locator('button.link-btn', { hasText: 'Volver a cartera' }).click();
    await expect(page.locator('[data-testid="react-cockpit-portfolio"]')).toBeVisible();
  });

  test('React navigation hosts a legacy-only workspace island', async ({ page }) => {
    await openClientWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();

    const island = page.locator('[data-testid="react-legacy-island"]');
    await expect(island).toBeVisible();
    await expect(island).toHaveAttribute('data-legacy-island-tab', 'ws-briefing');
    await expect(page.locator('[data-legacy-island="true"]')).toBeVisible();
    await expect(page.locator('#react-root .sidebar')).toBeVisible();
    await expect(page.locator('#app .sidebar')).toHaveCount(0);
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });

  test('legacy island navigation intent returns to a React-native page', async ({ page }) => {
    await openClientWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toBeVisible();

    await page.locator('[data-legacy-island="true"] button[data-tab="ws-radar"]').first().click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(0);
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });

  test('legacy island mount, unmount and remount stay scoped to one host', async ({ page }) => {
    await openClientWorkspace(page);

    await sidebarTab(page, 'ws-briefing').click();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(1);

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(0);

    await sidebarTab(page, 'ws-briefing').click();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(1);
    await expect(page.locator('[data-legacy-island="true"]')).toHaveCount(1);
  });

  test('#18 hosted send intent executes one canonical delivery send', async ({ page }) => {
    test.setTimeout(60_000);
    await openClientWorkspace(page);
    await seedSendableDraft(page, CLIENT_ID);
    await sidebarTab(page, 'ws-briefing').click();
    const host = page.locator('[data-testid="react-legacy-island"]');
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute('data-legacy-island-tab', 'ws-briefing');

    const sendButton = host.locator('[data-legacy-island="true"] #btn-send-delivery-bar');
    await expect(sendButton).toBeEnabled({ timeout: 15_000 });

    const beforeSent = await countAuditAction(page, 'DELIVERY_SENT');
    await sendButton.click();
    await page.locator('#delivery-preview-modal .btn-confirm-send-delivery').click();
    await expect(page.locator('#delivery-preview-modal')).toBeHidden({ timeout: 30_000 });
    await expect
      .poll(async () => countAuditAction(page, 'DELIVERY_SENT'), { timeout: 30_000 })
      .toBe(beforeSent + 1);
    await expect.poll(async () => countAuditAction(page, 'DELIVERY_SENT')).toBe(beforeSent + 1);
  });

  test('legacy island navigation produces one top-level page transition', async ({ page }) => {
    await openClientWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toBeVisible();

    await page.locator('[data-legacy-island="true"] button[data-tab="ws-deliver"]').first().click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(0);
  });
});
