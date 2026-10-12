/**
 * T604 — an ADMIN's Strategic Brief, with its history, is persisted to Firestore, and a
 * fresh session with an empty local store reads the approved Brief back from the server.
 */
import { expect, test, type Page } from '@playwright/test';
import type { StrategicBriefHistoryRecord } from '../src/domain/strategicBriefCore';
import { CLIENT_JUAN_ID, openManagerWorkspace, sidebarTab } from './helpers/spec010Auth';
import { clientDocPath, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

async function createBrief(page: Page): Promise<string | null> {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    const thesis = dbService.getActiveTheses(cid)[0];
    const signal = dbService
      .getSignalsByClient(cid)
      .find((row) => row.status !== 'DISCARDED' && !dbService.isSignalInCuration(cid, row.id));
    if (!thesis || !signal) return null;
    const now = new Date().toISOString();
    dbService.applyStrategicRoutingToSignal(
      signal.id,
      {
        totalScore: 84,
        priorityBand: 'HIGH',
        factors: {} as never,
        penalties: {} as never,
        strategicRationale: 'E2E T604 governed routing fixture.',
        recommendedAction: 'CURATE',
        scoringStatus: 'SCORED',
        calculatedAt: now,
      },
      {
        thesisId: thesis.id,
        thesisScores: [{ thesisId: thesis.id, score: 84, rationale: 'E2E T604' }],
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
        strategicRationale: 'E2E T604 governed score fixture.',
        recommendedAction: 'CURATE',
        scoringStatus: 'SCORED',
        scoringVersion: 'scoring-v1',
        recommendedDisposition: 'SAVE',
        recommendedOutputFormat: 'ARTICLE',
        calculatedAt: now,
      },
      { whyNow: { reason: 'E2E T604 timely governed context', score: 10 } }
    );
    const { addSignalToCuration, decideCuration } = await import('/src/services/executionDeliveryConsumer.ts');
    const added = addSignalToCuration({ requestedClientId: cid, signalId: signal.id });
    decideCuration({
      requestedClientId: cid,
      curationEntryId: added.entry.id,
      destination: 'TASK_ARTICLE',
      rationale: 'E2E T604 decided row for a persisted Strategic Brief.',
    });
    const briefConsumer = await import('/src/services/strategicBriefConsumer.ts');
    return briefConsumer.createBriefFromCurationEntry({
      curationEntryId: added.entry.id,
      destination: 'TASK_ARTICLE',
    }).brief.id;
  }, { cid: CLIENT_JUAN_ID });
}

async function approveBrief(page: Page, briefId: string): Promise<string> {
  return page.evaluate(async ({ cid, id }) => {
    const { approveStrategicBrief } = await import('/src/services/strategicBriefConsumer.ts');
    return approveStrategicBrief({ clientId: cid, briefId: id }).status;
  }, { cid: CLIENT_JUAN_ID, id: briefId });
}

/** Firestore paths of the local history entries of one Brief. */
async function historyDocPaths(page: Page, briefId: string): Promise<string[]> {
  return page.evaluate(async ({ id }) => {
    const { STRATEGIC_BRIEF_HISTORY_STORE_KEY } = await import('/src/infrastructure/strategicBrief/index.ts');
    const { STRATEGIC_BRIEF_SUBCOLLECTIONS, strategicBriefHistoryDocId } = await import(
      '/src/services/firestore/strategicBriefSync.ts'
    );
    const raw = localStorage.getItem(STRATEGIC_BRIEF_HISTORY_STORE_KEY);
    const entries: StrategicBriefHistoryRecord[] = raw ? JSON.parse(raw).entries : [];
    const paths: string[] = [];
    for (const entry of entries.filter((row) => row.briefId === id)) {
      const docId = await strategicBriefHistoryDocId(entry);
      paths.push(`clients/${entry.clientId}/${STRATEGIC_BRIEF_SUBCOLLECTIONS.history}/${docId}`);
    }
    return paths;
  }, { id: briefId });
}

async function briefStatus(page: Page, briefId: string): Promise<string | null> {
  return page.evaluate(async ({ cid, id }) => {
    const { listStrategicBriefs } = await import('/src/services/strategicBriefConsumer.ts');
    return listStrategicBriefs(cid).find((brief) => brief.id === id)?.status ?? null;
  }, { cid: CLIENT_JUAN_ID, id: briefId });
}

test('an approved Strategic Brief and its history persist to Firestore and hydrate a fresh session', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await openManagerWorkspace(page);

  const briefId = await createBrief(page);
  expect(briefId).toBeTruthy();
  const briefPath = clientDocPath(CLIENT_JUAN_ID, 'strategicBriefs', briefId!);
  await waitForServerField(briefPath, 'status', 'DRAFT');

  expect(await approveBrief(page, briefId!)).toBe('APPROVED');
  await waitForServerField(briefPath, 'status', 'APPROVED');
  await waitForServerField(briefPath, 'organizationId', 'org_aurora_01');

  const historyPaths = await historyDocPaths(page, briefId!);
  expect(historyPaths.length).toBeGreaterThanOrEqual(2);
  for (const path of historyPaths) {
    await waitForServerField(path, 'briefId', briefId!);
  }

  const context = await browser.newContext();
  try {
    const fresh = await context.newPage();
    await openManagerWorkspace(fresh);
    await expect.poll(() => briefStatus(fresh, briefId!), { timeout: 15_000 }).toBe('APPROVED');
    expect(await historyDocPaths(fresh, briefId!)).toEqual(expect.arrayContaining(historyPaths));
  } finally {
    await context.close();
  }
});

test('an open Briefs tab shows Briefs that a Firestore pull merges after it rendered', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  try {
    const viewer = await context.newPage();
    await openManagerWorkspace(viewer);
    await sidebarTab(viewer, 'ws-briefs').click();
    await expect(viewer.locator('[data-testid="react-ws-briefs"]')).toBeVisible({ timeout: 15_000 });

    await openManagerWorkspace(page);
    const briefId = await createBrief(page);
    expect(briefId).toBeTruthy();
    await waitForServerField(clientDocPath(CLIENT_JUAN_ID, 'strategicBriefs', briefId!), 'status', 'DRAFT');

    const approveInViewer = viewer.locator(`[data-testid="react-ws-approve-brief-${briefId}"]`);
    await expect(approveInViewer).toHaveCount(0);
    await viewer.evaluate(async ({ cid }) => {
      const { syncStrategicBriefsWithFirestore } = await import('/src/services/strategicBriefConsumer.ts');
      await syncStrategicBriefsWithFirestore('org_aurora_01', [cid]);
    }, { cid: CLIENT_JUAN_ID });
    await expect(approveInViewer).toBeVisible({ timeout: 15_000 });
  } finally {
    await context.close();
  }
});
