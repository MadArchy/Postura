/**
 * SPEC-010 T-010-508 — Playwright legacy-vs-React parity journeys + rollback.
 *
 * Uses deterministic demo credentials (docs/ops/pilot.md). No production auth bypass.
 */
import { expect, test } from '@playwright/test';
import {
  businessSnapshot,
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  loginAsClientElena,
  loginAsClientJuan,
  openManagerWorkspace,
  readAuthenticatedClientProjection,
  rollbackStableSnapshot,
  sidebarTab,
  UI_MODE_KEY,
  visibleRoots,
  waitForAuthenticatedClientProjection,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

type AuditEvent = { action: string; entityType?: string; entityId?: string };

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

async function mockRssFeeds(page: import('@playwright/test').Page) {
  await page.route('**/api/rss**', async (route) => {
    const stamp = Date.now();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            title: `E2E T508 signal ${stamp}`,
            link: `https://example.com/e2e-t508-${stamp}`,
            snippet: 'Deterministic feed item for Phase-5 poll proof.',
          },
        ],
      }),
    });
  });
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
      title: 'E2E T508 briefing advice',
      rationale: 'Deterministic Phase-5 send proof without provider calls.',
    });
  }, { cid: clientId });
}

async function mountLegacyIslandTab(
  page: import('@playwright/test').Page,
  tab: string,
  clientId = CLIENT_JUAN_ID
) {
  await page.evaluate(
    ({ legacyTab, legacyClientId }) => {
      const host = document.querySelector('[data-testid="react-legacy-island"]') as HTMLElement | null;
      if (!host) throw new Error('Legacy island host is missing');
      const ui = (window as unknown as { __posturaUi?: Record<string, unknown> }).__posturaUi;
      if (!ui || typeof ui.unmountLegacyIsland !== 'function' || typeof ui.mountLegacyIsland !== 'function') {
        throw new Error('Strangler controls are unavailable');
      }
      (ui.unmountLegacyIsland as () => void)();
      (ui.mountLegacyIsland as (el: HTMLElement, config: { tab: string; clientId: string }) => void)(host, {
        tab: legacyTab,
        clientId: legacyClientId,
      });
    },
    { legacyTab: tab, legacyClientId: clientId }
  );
}

test.describe('T-010-508 — authenticated manager journey', () => {
  test('manager cockpit and workspace navigation stay React-owned', async ({ page }) => {
    await openManagerWorkspace(page);
    await sidebarTab(page, 'clients').click();
    await expect(page.locator('[data-testid="react-manager-cockpit"]')).toBeVisible();
    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });
});

test.describe('T-010-508 — authenticated client journey', () => {
  test('client portal renders under React shell', async ({ page }) => {
    await loginAsClientJuan(page);
    await expect(page.locator('[data-testid="react-client-portal"]')).toBeVisible({ timeout: 15_000 });
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });
});

test.describe('T-010-508 — hybrid pages and legacy islands', () => {
  test('React hosts legacy briefing island with single shell authority', async ({ page }) => {
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    const island = page.locator('[data-testid="react-legacy-island"]');
    await expect(island).toBeVisible();
    await expect(island).toHaveAttribute('data-legacy-island-tab', 'ws-briefing');
    await expect(page.locator('#app .sidebar')).toHaveCount(0);
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });

  test('legacy island returns to React-native radar', async ({ page }) => {
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    await page.locator('[data-legacy-island="true"] button[data-tab="ws-radar"]').first().click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-legacy-island"]')).toHaveCount(0);
  });
});

test.describe('T-010-508 — React ↔ legacy rollback', () => {
  test('mid-journey rollback leaves stable business storage unchanged', async ({ page }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    const before = await rollbackStableSnapshot(page);

    // Option E: the mid-journey legacy request is persisted, but React stays served.
    await expect(page.locator('[data-testid="react-shell-to-legacy"]')).toHaveCount(0);
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
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();

    // Main-world only: never use waitForFunction + dynamic import for auth state.
    type MainWorldAuth = { uid: string; reactLogin: boolean; reactLogout: boolean };
    let mainWorld: MainWorldAuth | null = null;
    await expect
      .poll(async () => {
        mainWorld = await page.evaluate(async () => {
          const { authService } = await import('/src/services/auth.ts');
          await authService.ready;
          const user = authService.getCurrentUser();
          const reactLogin = !!document.querySelector('[data-testid="react-login"]');
          const reactLogout = !!document.querySelector('[data-testid="react-shell-logout"]');
          if (!user || !reactLogout || reactLogin) return null;
          return {
            uid: user.uid,
            reactLogin,
            reactLogout,
          };
        });
        return mainWorld;
      }, { timeout: 30_000 })
      .not.toBeNull();

    expect(mainWorld).not.toBeNull();
    expect(mainWorld!.uid).toBeTruthy();
    expect(mainWorld!.reactLogout).toBe(true);
    expect(mainWorld!.reactLogin).toBe(false);
    await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-login"]')).toHaveCount(0);

    expect(await rollbackStableSnapshot(page)).toEqual(before);
  });

  test('explicit legacy request keeps React served without data migration', async ({ page }) => {
    await page.goto('/');
    const before = await businessSnapshot(page);
    await page.evaluate(([key]) => localStorage.setItem(key, 'legacy'), [UI_MODE_KEY]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-postura-ui', 'react');
    await expect(page.locator('#react-root')).toBeVisible();
    expect(await visibleRoots(page)).toEqual(['react-root']);
    expect(await businessSnapshot(page)).toEqual(before);
  });
});

test.describe('T-010-508 — cross-tenant isolation', () => {
  test('two client sessions see distinct portal scopes', async ({ page }) => {
    await loginAsClientJuan(page);
    await waitForAuthenticatedClientProjection(page, CLIENT_JUAN_ID);
    const juan = await readAuthenticatedClientProjection(page);
    const juanText = await page.locator('[data-testid="react-client-portal"]').innerText();
    expect(juan.clientId).toBe(CLIENT_JUAN_ID);
    expect(juan.hydratedOwnClientRecord).toBe(true);
    expect(juan.clientIds).not.toContain(CLIENT_ELENA_ID);

    await page.locator('[data-testid="react-shell-logout"]').click();
    await expect(page.locator('[data-testid="react-login"]')).toBeVisible();

    await loginAsClientElena(page);
    await waitForAuthenticatedClientProjection(page, CLIENT_ELENA_ID);
    const elena = await readAuthenticatedClientProjection(page);
    const elenaText = await page.locator('[data-testid="react-client-portal"]').innerText();
    expect(elena.clientId).toBe(CLIENT_ELENA_ID);
    expect(elena.hydratedOwnClientRecord).toBe(true);
    expect(elena.clientIds).not.toContain(CLIENT_JUAN_ID);
    for (const title of juan.taskTitles) {
      expect(elenaText).not.toContain(title);
    }
    expect(juanText).not.toEqual(elenaText);
  });
});

test.describe('T-010-508 — #9 and #18 canonical E2E', () => {
  test('#9 poll intent executes one canonical source run', async ({ page }) => {
    await mockRssFeeds(page);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    await mountLegacyIslandTab(page, 'ws-sources');

    const beforeRuns = await countAuditAction(page, 'SOURCE_RUN_COMPLETED');
    const pollButton = page.locator('[data-legacy-island="true"] .btn-poll-one-source').first();
    await expect(pollButton).toBeVisible();
    await pollButton.click();
    await expect
      .poll(async () => countAuditAction(page, 'SOURCE_RUN_COMPLETED'), { timeout: 15_000 })
      .toBe(beforeRuns + 1);
  });

  test('#18 send intent executes one canonical delivery send', async ({ page }) => {
    test.setTimeout(60_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-briefing').click();
    await seedSendableDraft(page, CLIENT_JUAN_ID);
    await mountLegacyIslandTab(page, 'ws-deliver');

    const sendButton = page.locator('[data-legacy-island="true"] #btn-send-delivery');
    await expect(sendButton).toBeEnabled({ timeout: 15_000 });
    const beforeSent = await countAuditAction(page, 'DELIVERY_SENT');
    await sendButton.click();
    await page.locator('#delivery-preview-modal .btn-confirm-send-delivery').click();
    await expect
      .poll(async () => countAuditAction(page, 'DELIVERY_SENT'), { timeout: 30_000 })
      .toBe(beforeSent + 1);
  });
});

test.describe('T-010-508 — governed available MVP journey', () => {
  test('Client → workspace radar → briefs → deliver → result handoff (Planner unreachable)', async ({
    page,
  }) => {
    await openManagerWorkspace(page);

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();

    await sidebarTab(page, 'ws-briefs').click();
    await expect(page.locator('[data-testid="react-ws-briefs"]')).toBeVisible();

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible();

    await sidebarTab(page, 'ws-tasks').click();
    await expect(page.locator('[data-testid="react-ws-tasks"]')).toBeVisible();

    await expect(page.locator('[data-testid="react-ws-plan"]')).toHaveCount(0);
    expect(await visibleRoots(page)).toEqual(['react-root']);
  });
});
