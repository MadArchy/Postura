/**
 * T604 follow-up — replacing a client's advice deletes the previous advice document
 * in Firestore, so a fresh session can never hydrate the stale one back.
 */
import { expect, test, type Page } from '@playwright/test';
import { CLIENT_JUAN_ID, openManagerWorkspace } from './helpers/spec010Auth';
import { clientDocPath, waitForServerDocAbsent, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

const ORG_ID = 'org_aurora_01';

async function saveAdvice(page: Page, id: string, summary: string, generatedAt: string) {
  await page.evaluate(
    async ({ id, summary, generatedAt, clientId, organizationId }) => {
      const { dbService } = await import('/src/services/db.ts');
      dbService.saveAdvice({
        id,
        organizationId,
        clientId,
        summary,
        diagnosis: {
          authorityScore: 1,
          consistencyScore: 1,
          evidenceScore: 1,
          visibilityScore: 1,
          strengths: [],
          gaps: [],
          risks: [],
        },
        actions: [],
        usedLiveModel: false,
        generatedAt,
        generatedBy: 'e2e-fixture',
      });
    },
    { id, summary, generatedAt, clientId: CLIENT_JUAN_ID, organizationId: ORG_ID }
  );
}

async function latestAdviceId(page: Page) {
  return page.evaluate(async ({ clientId }) => {
    const { dbService } = await import('/src/services/db.ts');
    return dbService.getLatestAdvice(clientId)?.id ?? null;
  }, { clientId: CLIENT_JUAN_ID });
}

test('replacing an advice deletes the previous advice document in Firestore', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const oldId = `adv_e2e_replace_old_${stamp}`;
  const newId = `adv_e2e_replace_new_${stamp}`;
  const oldPath = clientDocPath(CLIENT_JUAN_ID, 'advices', oldId);
  const newPath = clientDocPath(CLIENT_JUAN_ID, 'advices', newId);

  await openManagerWorkspace(page);

  await saveAdvice(page, oldId, 'Advice anterior', new Date(stamp - 60_000).toISOString());
  await waitForServerField(oldPath, 'summary', 'Advice anterior');

  await saveAdvice(page, newId, 'Advice vigente', new Date(stamp).toISOString());
  await waitForServerField(newPath, 'summary', 'Advice vigente');
  await waitForServerDocAbsent(oldPath);
  expect(await latestAdviceId(page)).toBe(newId);

  const context = await browser.newContext();
  try {
    const fresh = await context.newPage();
    await openManagerWorkspace(fresh);
    await expect.poll(() => latestAdviceId(fresh), { timeout: 15_000 }).toBe(newId);
  } finally {
    await context.close();
  }
});
