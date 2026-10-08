/**
 * SPEC-010 · T603 React Parity Wave P9 — bounded ADMIN radar discard / send-to-curation E2E.
 *
 * The fixture registers its own two Juan signals through the React manual-signal form:
 * earlier specs share the emulator and may leave seeded signals discarded or in curation.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import { clientDocPath, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

async function registerManualSignal(page: Page, title: string) {
  await page.locator('[data-testid="react-ws-sources-open-manual"]').click();
  await expect(page.locator('[data-testid="react-ws-sources-manual-form"]')).toBeVisible();
  await page.locator('[data-testid="react-ws-sources-manual-title"]').fill(title);
  await page.locator('[data-testid="react-ws-sources-manual-submit"]').click();
  await expect(page.locator('[data-testid="react-ws-sources-manual-form"]')).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.locator('[data-testid="react-ws-sources-success"]')).toContainText(
    'Señal manual registrada'
  );
}

test.describe('P9 — React admin radar discard + send-to-curation parity', () => {
  test('ADMIN discards and sends to curation via RadarPanel without those handoff texts', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).not.toContainText(
      'puntuar señales'
    );
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).toContainText(
      'investigarlas'
    );
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).not.toContainText(
      'descartarlas'
    );
    await expect(page.locator('[data-testid="react-ws-radar-handoff"]')).not.toContainText(
      'añadirlas a una entrega'
    );

    const stamp = Date.now();
    const discardTitle = `P9 DISCARD FIXTURE ${stamp}`;
    const curationTitle = `P9 CURATION FIXTURE ${stamp}`;
    await sidebarTab(page, 'ws-sources-react').click();
    await expect(page.locator('[data-testid="react-ws-sources"]')).toBeVisible({ timeout: 15_000 });
    await registerManualSignal(page, discardTitle);
    await registerManualSignal(page, curationTitle);

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(discardTitle)).toBeVisible();
    await expect(page.getByText(curationTitle)).toBeVisible();

    const fixture = await page.evaluate(
      async ({ cid, discardTitle: dTitle, curationTitle: cTitle }) => {
        const { dbService } = await import('/src/services/db.ts');
        const byTitle = (title: string) =>
          dbService.getSignalsByClient(cid).filter((s) => s.title === title);
        const describe = (title: string) => {
          const rows = byTitle(title);
          const row = rows[0];
          return {
            matches: rows.length,
            id: row?.id ?? null,
            discarded: row?.status === 'DISCARDED',
            inCuration: row ? dbService.isSignalInCuration(cid, row.id) : false,
            scored: typeof row?.relevanceScore === 'number',
          };
        };
        return { discard: describe(dTitle), curation: describe(cTitle) };
      },
      { cid: CLIENT_JUAN_ID, discardTitle, curationTitle }
    );

    const diagnostics = `P9 fixture: discard=${JSON.stringify(fixture.discard)} curation=${JSON.stringify(fixture.curation)}`;
    expect(fixture.discard.matches, diagnostics).toBe(1);
    expect(fixture.curation.matches, diagnostics).toBe(1);
    expect(fixture.discard.id, diagnostics).not.toBe(fixture.curation.id);
    expect(fixture.discard.discarded, diagnostics).toBe(false);
    expect(fixture.curation.inCuration, diagnostics).toBe(false);
    const discardId = fixture.discard.id!;
    const curationId = fixture.curation.id!;

    await page.locator(`[data-testid="react-ws-discard-${discardId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar-success"]')).toContainText(
      'Señal descartada',
      { timeout: 10_000 }
    );

    const discardedStatus = await page.evaluate(
      async ({ id }) => {
        const { dbService } = await import('/src/services/db.ts');
        return dbService.getSignalById(id)?.status ?? null;
      },
      { id: discardId }
    );
    expect(discardedStatus).toBe('DISCARDED');

    await page.locator(`[data-testid="react-ws-send-curation-${curationId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-radar-success"]')).toContainText(
      'Enviada a curación',
      { timeout: 10_000 }
    );

    const curationState = await page.evaluate(
      async ({ cid, id }) => {
        const { dbService } = await import('/src/services/db.ts');
        const signal = dbService.getSignalById(id);
        return {
          inCuration: dbService.isSignalInCuration(cid, id),
          managerDecision: signal?.managerDecision ?? null,
          status: signal?.status ?? null,
          score: typeof signal?.relevanceScore === 'number' ? signal.relevanceScore : null,
        };
      },
      { cid: CLIENT_JUAN_ID, id: curationId }
    );
    expect(curationState.inCuration).toBe(true);
    expect(curationState.managerDecision).toBe('SAVED');
    if (!fixture.curation.scored) {
      expect(curationState.score).not.toBeNull();
    }

    await expect(
      page.locator(`[data-testid="react-ws-send-curation-${curationId}"]`)
    ).toHaveCount(0);

    await waitForServerField(clientDocPath(CLIENT_JUAN_ID, 'signals', discardId), 'status', 'DISCARDED');
    await waitForServerField(clientDocPath(CLIENT_JUAN_ID, 'signals', curationId), 'managerDecision', 'SAVED');
  });
});
