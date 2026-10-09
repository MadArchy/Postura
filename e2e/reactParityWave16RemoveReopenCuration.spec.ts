/**
 * SPEC-010 · #16 Remove / Reopen Curation React E2E.
 * Local deterministic fixtures. Remove and reopen are also confirmed in the Firestore emulator
 * through owner REST reads and a fresh manager session. Rows that persist register their own Juan
 * signals through the React manual-signal form so they never consume seeded signals.
 */

import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import {
  clientDocPath,
  ownerGetField,
  waitForServerDocAbsent,
  waitForServerField,
  waitForServerFieldAbsent,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

async function seedPending(page: import('@playwright/test').Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    for (const pkg of dbService.getDeliveriesByClient(cid)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }
    const signal = dbService
      .getSignalsByClient(cid)
      .find((row) => row.status !== 'DISCARDED' && !dbService.isSignalInCuration(cid, row.id));
    if (!signal) return { curationId: null as string | null };
    const { addSignalToCuration } = await import('/src/services/executionDeliveryConsumer.ts');
    const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
    return { curationId: added.entry.id };
  }, { cid: clientId });
}

async function registerManualSignal(page: Page, title: string) {
  await sidebarTab(page, 'ws-sources-react').click();
  await expect(page.locator('[data-testid="react-ws-sources"]')).toBeVisible({ timeout: 15_000 });
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

async function seedPendingForTitle(page: Page, clientId: string, signalTitle: string) {
  return page.evaluate(async ({ cid, title }) => {
    const { dbService } = await import('/src/services/db.ts');
    const matches = dbService.getSignalsByClient(cid).filter((row) => row.title === title);
    const signal = matches[0];
    if (matches.length !== 1 || !signal || dbService.isSignalInCuration(cid, signal.id)) {
      return { curationId: null as string | null, matches: matches.length };
    }
    const { addSignalToCuration } = await import('/src/services/executionDeliveryConsumer.ts');
    return { curationId: addSignalToCuration({ requestedClientId: cid, signalId: signal.id }).entry.id, matches: 1 };
  }, { cid: clientId, title: signalTitle });
}

/** A new manager session hydrates curation from Firestore only (no shared local state). */
async function readCurationInFreshSession(browser: Browser, ids: string[]) {
  const context = await browser.newContext();
  try {
    const fresh = await context.newPage();
    await openManagerWorkspace(fresh);
    return await fresh.evaluate(async ({ curationIds }) => {
      const { dbService } = await import('/src/services/db.ts');
      return curationIds.map((id) => {
        const entry = dbService.getCurationById(id);
        return entry
          ? {
              id,
              present: true,
              destination: entry.destination,
              managerRationale: entry.managerRationale,
              decidedAt: entry.decidedAt ?? null,
              decidedBy: entry.decidedBy ?? null,
            }
          : { id, present: false };
      });
    }, { curationIds: ids });
  } finally {
    await context.close();
  }
}

async function seedLooseReady(page: Page, clientId: string, signalTitle: string) {
  return page.evaluate(async ({ cid, title }) => {
    const { dbService } = await import('/src/services/db.ts');
    for (const pkg of dbService.getDeliveriesByClient(cid)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }
    const matches = dbService.getSignalsByClient(cid).filter((row) => row.title === title);
    const signal = matches[0];
    if (matches.length !== 1 || !signal || dbService.isSignalInCuration(cid, signal.id)) {
      return { curationId: null as string | null, matches: matches.length };
    }
    const { addSignalToCuration, decideCuration } = await import(
      '/src/services/executionDeliveryConsumer.ts'
    );
    const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
    decideCuration({
      requestedClientId: cid,
      curationEntryId: added.entry.id,
      destination: 'EVIDENCE',
      rationale: 'E2E #16 loose ready row for Reabrir.',
    });
    const entry = dbService.getCurationById(added.entry.id);
    if (entry?.deliveryPackageId) {
      dbService.attachCurationToDelivery(added.entry.id, null);
    }
    return {
      curationId: added.entry.id,
      matches: matches.length,
      ready: dbService.getReadyCurationByClient(cid).some((row) => row.id === added.entry.id),
    };
  }, { cid: clientId, title: signalTitle });
}

test.describe('#16 — React remove / reopen curation', () => {
  test('ADMIN removes a pending curation from Deliver', async ({ page, browser }) => {
    test.setTimeout(150_000);
    await openManagerWorkspace(page);
    const siblingTitle = `WAVE16 REMOVE SIBLING ${Date.now()}`;
    await registerManualSignal(page, siblingTitle);
    const sibling = await seedPendingForTitle(page, CLIENT_JUAN_ID, siblingTitle);
    expect(sibling.matches, `#16 remove sibling: ${JSON.stringify(sibling)}`).toBe(1);
    const siblingPath = clientDocPath(CLIENT_JUAN_ID, 'curation', sibling.curationId!);
    const fixture = await seedPending(page, CLIENT_JUAN_ID);
    expect(fixture.curationId).toBeTruthy();
    const curationId = fixture.curationId!;
    const curationPath = clientDocPath(CLIENT_JUAN_ID, 'curation', curationId);
    await waitForServerField(curationPath, 'clientId', CLIENT_JUAN_ID);
    await waitForServerField(siblingPath, 'clientId', CLIENT_JUAN_ID);

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-testid="react-ws-pending-${curationId}"]`)).toBeVisible();
    await page.locator(`[data-testid="react-ws-remove-curation-${curationId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Ítem retirado de la mesa',
      { timeout: 10_000 }
    );
    await expect(page.locator(`[data-testid="react-ws-pending-${curationId}"]`)).toHaveCount(0);

    const gone = await page.evaluate(async ({ id, cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      return {
        entry: dbService.getCurationById(id) ?? null,
        pending: dbService.getPendingCurationByClient(cid).some((row) => row.id === id),
      };
    }, { id: curationId, cid: CLIENT_JUAN_ID });
    expect(gone.entry).toBeNull();
    expect(gone.pending).toBe(false);

    await waitForServerDocAbsent(curationPath);
    await waitForServerField(siblingPath, 'clientId', CLIENT_JUAN_ID);

    const [removed, kept] = await readCurationInFreshSession(browser, [curationId, sibling.curationId!]);
    expect(kept.present).toBe(true);
    expect(removed.present).toBe(false);
  });

  test('ADMIN reopens a loose ready curation on Deliver', async ({ page, browser }) => {
    test.setTimeout(150_000);
    await openManagerWorkspace(page);
    const signalTitle = `WAVE16 REOPEN FIXTURE ${Date.now()}`;
    await registerManualSignal(page, signalTitle);
    const fixture = await seedLooseReady(page, CLIENT_JUAN_ID, signalTitle);
    expect(fixture.matches, `#16 reopen fixture: ${JSON.stringify(fixture)}`).toBe(1);
    expect(fixture.curationId).toBeTruthy();
    expect(fixture.ready).toBe(true);
    const curationId = fixture.curationId!;
    const curationPath = clientDocPath(CLIENT_JUAN_ID, 'curation', curationId);
    await waitForServerField(curationPath, 'destination', 'EVIDENCE');
    await waitForServerField(curationPath, 'managerRationale', 'E2E #16 loose ready row for Reabrir.');
    await expect.poll(() => ownerGetField(curationPath, 'decidedAt')).not.toBeNull();
    await expect.poll(() => ownerGetField(curationPath, 'decidedBy')).not.toBeNull();

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-testid="react-ws-ready-${curationId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-ws-reopen-curation-${curationId}"]`)).toBeVisible();
    await page.locator(`[data-testid="react-ws-reopen-curation-${curationId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Ítem reabierto para volver a decidir',
      { timeout: 10_000 }
    );
    await expect(page.locator(`[data-testid="react-ws-ready-${curationId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="react-ws-pending-${curationId}"]`)).toBeVisible();

    const reopened = await page.evaluate(async ({ id, cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const entry = dbService.getCurationById(id);
      return {
        destination: entry?.destination ?? null,
        pending: dbService.getPendingCurationByClient(cid).some((row) => row.id === id),
        ready: dbService.getReadyCurationByClient(cid).some((row) => row.id === id),
      };
    }, { id: curationId, cid: CLIENT_JUAN_ID });
    expect(reopened.destination).toBeNull();
    expect(reopened.pending).toBe(true);
    expect(reopened.ready).toBe(false);

    await waitForServerField(curationPath, 'managerRationale', '');
    await waitForServerFieldAbsent(curationPath, 'decidedAt');
    await waitForServerFieldAbsent(curationPath, 'decidedBy');

    const [fresh] = await readCurationInFreshSession(browser, [curationId]);
    expect(fresh).toEqual({
      id: curationId,
      present: true,
      destination: null,
      managerRationale: '',
      decidedAt: null,
      decidedBy: null,
    });
  });

  test('unknown id and wrong client fail closed without mutation', async ({ page }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    const fixture = await seedPending(page, CLIENT_JUAN_ID);
    expect(fixture.curationId).toBeTruthy();
    const curationId = fixture.curationId!;

    const outcome = await page.evaluate(async ({ juanId, elenaId, curationEntryId }) => {
      const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
      const { dbService } = await import('/src/services/db.ts');
      const missing = executionDeliveryCommands.removeCuration({
        requestedClientId: juanId,
        curationEntryId: 'cur_does_not_exist_16',
      });
      const cross = executionDeliveryCommands.removeCuration({
        requestedClientId: elenaId,
        curationEntryId,
      });
      return {
        missing,
        cross,
        stillThere: Boolean(dbService.getCurationById(curationEntryId)),
      };
    }, { juanId: CLIENT_JUAN_ID, elenaId: CLIENT_ELENA_ID, curationEntryId: curationId });

    expect(outcome.missing.ok).toBe(false);
    expect(outcome.cross.ok).toBe(false);
    expect(outcome.stillThere).toBe(true);
  });
});
