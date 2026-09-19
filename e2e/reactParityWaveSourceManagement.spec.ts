/**
 * SPEC-010 · Source Management React write E2E — #8/#9/#24/#26.
 * Feed is stubbed on the existing Signal Intake consumer. No remote network.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  enterClientWorkspaceFromShell,
  loginAsManager,
  sidebarTab,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const REGISTER_NAME = 'SM E2E Register Source';
const MANUAL_TITLE = 'SM E2E Manual Signal';

async function openSources(page: Page) {
  await sidebarTab(page, 'ws-sources-react').click();
  await expect(page.locator('[data-testid="react-ws-sources"]')).toBeVisible({ timeout: 15_000 });
}

type AuditEvent = { action: string };

async function mockRssFeeds(page: Page) {
  const stamp = Date.now();
  await page.route('**/api/rss**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            title: `NIST AI RMF patent notice ${stamp}`,
            link: `https://www.nist.gov/news/sm-e2e-${stamp}`,
            snippet: 'Deterministic NIST AI RMF and patent guidance for corporate adoption.',
          },
        ],
      }),
    });
  });
}

async function countAuditAction(page: Page, action: string) {
  return page.evaluate((wanted) => {
    const raw = localStorage.getItem('postura_audit_logs');
    const events = raw ? (JSON.parse(raw) as AuditEvent[]) : [];
    return events.filter((event) => event.action === wanted).length;
  }, action);
}

async function sourceNamesForClient(page: Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    return dbService.getSourcesByClient(cid).map((source) => source.name);
  }, { cid: clientId });
}

async function signalTitlesForClient(page: Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    return dbService.getSignalsByClient(cid).map((signal) => signal.title);
  }, { cid: clientId });
}

test.describe('Source Management — React write parity', () => {
  test('ADMIN registers a source on the native React surface', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await openSources(page);

    await page.locator('[data-testid="react-ws-sources-open-register"]').click();
    await expect(page.locator('[data-testid="react-ws-sources-register-form"]')).toBeVisible();
    await page.locator('[data-testid="react-ws-sources-name"]').fill(REGISTER_NAME);
    await page.locator('[data-testid="react-ws-sources-type"]').selectOption('RSS');
    await page.locator('[data-testid="react-ws-sources-register-submit"]').click();

    await expect(page.locator('[data-testid="react-ws-sources-success"]')).toBeVisible();
    await expect(page.getByText(REGISTER_NAME)).toBeVisible();
    await expect.poll(async () => sourceNamesForClient(page, CLIENT_JUAN_ID)).toContain(REGISTER_NAME);
  });

  test('poll uses stubbed feed and canonical command', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await mockRssFeeds(page);
    const sourceId = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const existing = dbService
        .getSourcesByClient(cid)
        .find((source) => source.name === 'SM E2E Poll Source');
      if (existing) return existing.id;
      return dbService.addSource({
        organizationId: 'org_aurora_01',
        clientId: cid,
        name: 'SM E2E Poll Source',
        type: 'RSS',
        url: 'https://example.test/sm-e2e-poll',
        fetchIntervalMinutes: 360,
        status: 'ACTIVE',
        createdBy: 'user_admin_01',
      }).id;
    }, { cid: CLIENT_JUAN_ID });
    await openSources(page);

    const poll = page.locator(`[data-testid="react-ws-source-poll-${sourceId}"]`);
    await expect(poll).toBeVisible();
    const beforeRuns = await countAuditAction(page, 'SOURCE_RUN_COMPLETED');
    await poll.click();

    await expect(page.locator('[data-testid="react-ws-sources-success"]')).toBeVisible();
    await expect
      .poll(async () => countAuditAction(page, 'SOURCE_RUN_COMPLETED'), { timeout: 15_000 })
      .toBe(beforeRuns + 1);
  });

  test('manual signal appears on React radar', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await openSources(page);

    await page.locator('[data-testid="react-ws-sources-open-manual"]').click();
    await expect(page.locator('[data-testid="react-ws-sources-manual-form"]')).toBeVisible();
    await page.locator('[data-testid="react-ws-sources-manual-title"]').fill(MANUAL_TITLE);
    await page.locator('[data-testid="react-ws-sources-manual-submit"]').click();
    await expect(page.locator('[data-testid="react-ws-sources-success"]')).toBeVisible();

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible();
    await expect(page.getByText(MANUAL_TITLE)).toBeVisible();
    await expect.poll(async () => signalTitlesForClient(page, CLIENT_JUAN_ID)).toContain(MANUAL_TITLE);
  });

  test('wrong-client poll fails closed', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    const elenaSourceId = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.addSource({
        organizationId: 'org_aurora_01',
        clientId: cid,
        name: 'SM E2E Elena isolated source',
        type: 'RSS',
        url: 'https://example.test/elena-isolated',
        fetchIntervalMinutes: 360,
        status: 'ACTIVE',
        createdBy: 'user_admin_01',
      }).id;
    }, { cid: CLIENT_ELENA_ID });

    const outcome = await page.evaluate(async ({ sourceId }) => {
      const { pollRegisteredSource } = await import('/src/services/signalIntakeConsumer.ts');
      try {
        await pollRegisteredSource({
          requestedClientId: 'client_juan_001',
          sourceId,
        });
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          message: error instanceof Error ? error.message : 'failed',
        };
      }
    }, { sourceId: elenaSourceId });

    expect(outcome.ok).toBe(false);
    const elenaTitles = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.getSignalsByClient(cid).map((signal) => signal.title);
    }, { cid: CLIENT_ELENA_ID });
    expect(elenaTitles).not.toContain('SM E2E stub feed item');
  });

  test('legacy source workflow remains reachable', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await openSources(page);

    await page.locator('[data-testid="react-shell-to-legacy"]').click();
    await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#react-root')).toBeHidden();

    await page.evaluate(async ({ clientId }) => {
      const ui = (
        window as unknown as {
          __posturaUi?: {
            applyUiMode: (mode: 'legacy' | 'react') => Promise<void>;
            mountLegacyIsland: (el: HTMLElement, config: { tab: string; clientId: string }) => void;
          };
        }
      ).__posturaUi;
      if (!ui?.applyUiMode || !ui.mountLegacyIsland) {
        throw new Error('Strangler controls are unavailable');
      }
      await ui.applyUiMode('legacy');
      let host = document.getElementById('sm-legacy-sources');
      if (!host) {
        host = document.createElement('div');
        host.id = 'sm-legacy-sources';
        document.body.appendChild(host);
      }
      ui.mountLegacyIsland(host, { tab: 'ws-sources', clientId });
    }, { clientId: CLIENT_JUAN_ID });

    await expect(page.locator('[data-legacy-island="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('[data-legacy-island="true"] #btn-add-manual-signal, [data-legacy-island="true"] #btn-poll-all-sources').first()
    ).toBeVisible();
  });

  test('React sources surface does not expose #25 or discovery writes', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await openSources(page);

    const panel = page.locator('[data-testid="react-ws-sources"]');
    await expect(panel.locator('.btn-pause-source, .btn-resume-source, .btn-archive-source, .btn-probe-source')).toHaveCount(0);
    await expect(panel).not.toContainText('Pausar');
    await expect(panel).not.toContainText('Reactivar');
    await expect(panel).not.toContainText('Archivar');
    await expect(panel).not.toContainText('Probar feed');
    await expect(panel).not.toContainText('Tavily');
    await expect(page.locator('[data-testid="react-ws-sources-handoff"]')).toContainText('descubrimiento automático');
    await expect(page.locator('[data-testid="react-ws-sources-handoff"]')).toContainText('pausarlas o archivarlas');
  });
});
