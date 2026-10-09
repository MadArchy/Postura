/**
 * SPEC-010 · T603 React Parity Wave P10 — bounded ADMIN decide-curation E2E.
 *
 * The fixture registers its own Juan signal through the React manual-signal form: the decided
 * curation row persists in the emulator and must not consume seeded signals later specs rely on.
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

test.describe('P10 — React admin decide curation parity', () => {
  test('ADMIN decides destination on pending curation row without decide handoff text', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);

    const signalTitle = `P10 CURATION FIXTURE ${Date.now()}`;
    await sidebarTab(page, 'ws-sources-react').click();
    await expect(page.locator('[data-testid="react-ws-sources"]')).toBeVisible({ timeout: 15_000 });
    await registerManualSignal(page, signalTitle);

    const fixture = await page.evaluate(async ({ cid, title }) => {
      const { dbService } = await import('/src/services/db.ts');
      for (const pkg of dbService.getDeliveriesByClient(cid)) {
        if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
      }
      const draftCount = dbService
        .getDeliveriesByClient(cid)
        .filter((d) => d.status === 'DRAFT').length;
      const matches = dbService.getSignalsByClient(cid).filter((s) => s.title === title);
      const signal = matches[0];
      if (matches.length !== 1 || !signal || dbService.isSignalInCuration(cid, signal.id)) {
        return {
          curationId: null as string | null,
          signalId: null as string | null,
          matches: matches.length,
          draftCount,
        };
      }
      const { addSignalToCuration } = await import('/src/services/executionDeliveryConsumer.ts');
      const result = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
      const pending = dbService.getPendingCurationByClient(cid);
      const row = pending.find((p) => p.id === result.entry.id);
      return {
        curationId: row?.id ?? result.entry.id,
        signalId: signal.id,
        matches: matches.length,
        draftCount,
      };
    }, { cid: CLIENT_JUAN_ID, title: signalTitle });

    expect(fixture.matches, `P10 fixture: ${JSON.stringify(fixture)}`).toBe(1);
    expect(fixture.curationId).toBeTruthy();
    expect(fixture.draftCount).toBe(0);

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-ws-ensure-draft"]')).toBeVisible();

    const curationId = fixture.curationId!;
    await expect(page.locator(`[data-testid="react-ws-pending-${curationId}"]`)).toBeVisible();

    await page.selectOption(`[data-testid="react-ws-decide-destination-${curationId}"]`, 'EVIDENCE');
    await page.fill(
      `[data-testid="react-ws-decide-rationale-${curationId}"]`,
      'Evidencia útil para el dossier del cliente en esta fase.'
    );
    await page.locator(`[data-testid="react-ws-decide-submit-${curationId}"]`).click();

    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Destino confirmado',
      { timeout: 10_000 }
    );

    const decided = await page.evaluate(
      async ({ cid, id }) => {
        const { dbService } = await import('/src/services/db.ts');
        const entry = dbService.getCurationById(id);
        return {
          destination: entry?.destination ?? null,
          rationale: entry?.managerRationale ?? null,
          pending: dbService.getPendingCurationByClient(cid).some((p) => p.id === id),
        };
      },
      { cid: CLIENT_JUAN_ID, id: curationId }
    );
    expect(decided.destination).toBe('EVIDENCE');
    expect(decided.rationale).toContain('Evidencia útil');
    expect(decided.pending).toBe(false);

    await expect(page.locator(`[data-testid="react-ws-pending-${curationId}"]`)).toHaveCount(0);

    const curationPath = clientDocPath(CLIENT_JUAN_ID, 'curation', curationId);
    await waitForServerField(curationPath, 'destination', 'EVIDENCE');
    await waitForServerField(
      curationPath,
      'managerRationale',
      'Evidencia útil para el dossier del cliente en esta fase.'
    );
  });
});
