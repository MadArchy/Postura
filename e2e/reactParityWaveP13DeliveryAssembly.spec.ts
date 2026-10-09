/**
 * SPEC-010 · T603 React Parity Wave P13 — bounded ADMIN delivery assembly E2E.
 *
 * Discard is also confirmed in the Firestore emulator and a fresh manager session; an Elena
 * draft stands in as the unrelated sibling document that must survive Juan's discard.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  refetchDeliverPanel,
  sidebarTab,
} from './helpers/spec010Auth';
import { clientDocPath, waitForServerDocAbsent, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

test.describe('P13 — React admin delivery assembly parity', () => {
  test('ADMIN assembles draft briefing without deliver handoff', async ({ page }) => {
    test.setTimeout(120_000);
    await openManagerWorkspace(page);

    const fixture = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      for (const pkg of dbService.getDeliveriesByClient(cid)) {
        if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
      }
      const draftCountBefore = dbService
        .getDeliveriesByClient(cid)
        .filter((d) => d.status === 'DRAFT').length;

      const thesis = dbService.getActiveTheses(cid)[0];
      if (!thesis) {
        return { curationId: null as string | null, thesisResolved: false, draftCountBefore };
      }

      const signal = dbService
        .getSignalsByClient(cid)
        .find((s) => s.status !== 'DISCARDED' && !dbService.isSignalInCuration(cid, s.id));
      if (!signal) return { curationId: null, thesisResolved: false, draftCountBefore };

      dbService.applyStrategicRoutingToSignal(
        signal.id,
        {
          totalScore: 84,
          priorityBand: 'HIGH',
          factors: {} as never,
          penalties: {} as never,
          strategicRationale: 'E2E P13 governed routing fixture.',
          recommendedAction: 'CURATE',
          scoringStatus: 'SCORED',
          calculatedAt: new Date().toISOString(),
        },
        {
          thesisId: thesis.id,
          thesisScores: [{ thesisId: thesis.id, score: 84, rationale: 'E2E' }],
          routingDecision: { routingState: 'CLEAR', selectedThesisId: thesis.id },
          clientId: cid,
        }
      );
      dbService.applyScoreToSignal(
        signal.id,
        {
          totalScore: 84,
          priorityBand: 'HIGH',
          factors: {} as never,
          penalties: {} as never,
          strategicRationale: 'E2E P13 governed score fixture.',
          recommendedAction: 'CURATE',
          scoringStatus: 'SCORED',
          scoringVersion: 'scoring-v1',
          recommendedDisposition: 'SAVE',
          recommendedOutputFormat: 'ARTICLE',
          calculatedAt: new Date().toISOString(),
        },
        {
          whyNow: { reason: 'E2E P13 timely governed context', score: 10 },
        }
      );

      const { addSignalToCuration, decideCuration } = await import(
        '/src/services/executionDeliveryConsumer.ts'
      );
      const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
      decideCuration({
        requestedClientId: cid,
        curationEntryId: added.entry.id,
        destination: 'TASK_VIDEO',
        rationale: 'E2E P13 decided ready row for assembly.',
      });

      const entry = dbService.getCurationById(added.entry.id);
      if (entry?.deliveryPackageId) {
        dbService.attachCurationToDelivery(added.entry.id, null);
      }

      const draftCountAfter = dbService
        .getDeliveriesByClient(cid)
        .filter((d) => d.status === 'DRAFT').length;
      const ready = dbService.getReadyCurationByClient(cid).some((row) => row.id === added.entry.id);
      return {
        curationId: added.entry.id,
        thesisResolved: true,
        ready,
        draftCountBefore,
        draftCountAfter,
      };
    }, { cid: CLIENT_JUAN_ID });

    expect(fixture.curationId).toBeTruthy();
    expect(fixture.thesisResolved).toBe(true);
    expect(fixture.ready).toBe(true);
    expect(fixture.draftCountBefore).toBe(0);
    expect(fixture.draftCountAfter).toBe(0);

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toHaveCount(0);

    await expect(page.locator('[data-testid="react-ws-ensure-draft"]')).toBeVisible();
    await page.locator('[data-testid="react-ws-ensure-draft"]').click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Briefing creado'
    );
    await expect(page.locator('[data-testid="react-ws-draft-package"]')).toBeVisible();

    const curationId = fixture.curationId!;
    const addButton = page.locator(`[data-testid="react-ws-add-to-briefing-${curationId}"]`);
    if (await addButton.count()) {
      await addButton.click();
      await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
        'Añadido al briefing'
      );
    }

    await page.fill('[data-testid="react-ws-draft-title"]', 'Briefing E2E P13');
    await page.fill('[data-testid="react-ws-draft-strategic-note"]', 'Nota estratégica E2E');
    await page.locator('[data-testid="react-ws-draft-save-metadata"]').click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Nota estratégica guardada'
    );

    await expect(page.locator('[data-testid="react-ws-draft-items"] li')).not.toHaveCount(0);
    await expect(page.locator('[data-testid="react-ws-deliver-preview-send"]')).toBeEnabled();
  });

  test('ADMIN discards draft briefing with authoritative refresh', async ({ page, browser }) => {
    test.setTimeout(180_000);
    await openManagerWorkspace(page);

    const seeded = await page.evaluate(async ({ cid, elenaId }) => {
      const { dbService } = await import('/src/services/db.ts');
      for (const pkg of dbService.getDeliveriesByClient(cid)) {
        if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
      }
      const pkg = dbService.ensureDraftDelivery(cid, 'e2e_p13');
      dbService.updateDelivery(pkg.id, { title: 'Briefing E2E P13 discard' });
      const sibling = dbService.ensureDraftDelivery(elenaId, 'e2e_p13');
      const draftCount = dbService
        .getDeliveriesByClient(cid)
        .filter((d) => d.status === 'DRAFT').length;
      return { packageId: pkg.id, siblingId: sibling.id, draftCount };
    }, { cid: CLIENT_JUAN_ID, elenaId: CLIENT_ELENA_ID });

    expect(seeded.draftCount).toBe(1);
    const packagePath = clientDocPath(CLIENT_JUAN_ID, 'deliveries', seeded.packageId);
    const siblingPath = clientDocPath(CLIENT_ELENA_ID, 'deliveries', seeded.siblingId);
    await waitForServerField(packagePath, 'title', 'Briefing E2E P13 discard');
    await waitForServerField(packagePath, 'status', 'DRAFT');
    await waitForServerField(siblingPath, 'status', 'DRAFT');

    await sidebarTab(page, 'ws-deliver').click();
    await refetchDeliverPanel(page);
    await expect(page.locator('[data-testid="react-ws-draft-package"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-ws-draft-title"]')).toHaveValue(
      'Briefing E2E P13 discard'
    );

    await page.locator('[data-testid="react-ws-discard-draft"]').click();
    await expect(page.locator('[data-testid="react-ws-discard-confirm"]')).toBeVisible();
    await page.locator('[data-testid="react-ws-discard-confirm-yes"]').click();
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      'Borrador descartado'
    );

    const afterDiscard = await page.evaluate(async ({ pid, cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const pkg = dbService.getDeliveryById(pid);
      const draft = dbService.getDraftDelivery(cid);
      const draftCount = dbService
        .getDeliveriesByClient(cid)
        .filter((d) => d.status === 'DRAFT').length;
      return {
        packageExists: Boolean(pkg),
        packageStatus: pkg?.status ?? null,
        draftId: draft?.id ?? null,
        draftCount,
      };
    }, { pid: seeded.packageId, cid: CLIENT_JUAN_ID });

    expect(afterDiscard.packageExists).toBe(false);
    expect(afterDiscard.draftId).toBeNull();
    expect(afterDiscard.draftCount).toBe(0);

    await expect(page.locator('[data-testid="react-ws-draft-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-ensure-draft"]')).toBeVisible();

    await waitForServerDocAbsent(packagePath);
    await waitForServerField(siblingPath, 'status', 'DRAFT');

    const context = await browser.newContext();
    try {
      const fresh = await context.newPage();
      await openManagerWorkspace(fresh);
      const freshState = await fresh.evaluate(async ({ pid, siblingId, cid, elenaId }) => {
        const { dbService } = await import('/src/services/db.ts');
        return {
          discardedPresent: Boolean(dbService.getDeliveryById(pid)),
          juanDraftCount: dbService.getDeliveriesByClient(cid).filter((d) => d.status === 'DRAFT').length,
          siblingPresent: dbService.getDeliveriesByClient(elenaId).some((d) => d.id === siblingId),
        };
      }, { pid: seeded.packageId, siblingId: seeded.siblingId, cid: CLIENT_JUAN_ID, elenaId: CLIENT_ELENA_ID });
      expect(freshState).toEqual({ discardedPresent: false, juanDraftCount: 0, siblingPresent: true });
    } finally {
      await context.close();
    }

    const siblingDiscarded = await page.evaluate(async ({ siblingId }) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.discardDraftDelivery(siblingId);
    }, { siblingId: seeded.siblingId });
    expect(siblingDiscarded).toBe(true);
    await waitForServerDocAbsent(siblingPath);
  });
});
