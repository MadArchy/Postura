/**
 * SPEC-010 · #21 advisor click-only React E2E.
 * Local deterministic saveAdvice fixtures only. No remote AI, network, or Firestore.
 */

import { expect, test } from '@playwright/test';
import {
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
  UI_MODE_KEY,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const ORG_ID = 'org_aurora_01';
const ACTION_ID = 'adv_act_e2e_21';
const ACTION_TITLE = 'E2E consejo de posicionamiento';

async function seedAdvice(
  page: import('@playwright/test').Page,
  clientId: string,
  actionId = ACTION_ID
) {
  return page.evaluate(
    async ({ cid, oid, aid, title }) => {
      const { dbService } = await import('/src/services/db.ts');
      dbService.saveAdvice({
        id: `adv_e2e_${cid}`,
        organizationId: oid,
        clientId: cid,
        summary: 'E2E seeded advice',
        diagnosis: {
          authorityScore: 1,
          consistencyScore: 1,
          evidenceScore: 1,
          visibilityScore: 1,
          strengths: [],
          gaps: [],
          risks: [],
        },
        actions: [
          {
            id: aid,
            category: 'CONTENT',
            horizon: 'DAYS_30',
            title,
            why: 'Porque el cliente necesita visibilidad.',
            how: 'Publicar una nota en LinkedIn.',
            effortMinutes: 30,
            impact: 70,
          },
        ],
        usedLiveModel: false,
        generatedAt: '2026-09-19T12:00:00.000Z',
        generatedBy: 'e2e-fixture',
      });
      return { adviceId: `adv_e2e_${cid}`, actionId: aid };
    },
    { cid: clientId, oid: ORG_ID, aid: actionId, title: ACTION_TITLE }
  );
}

async function pendingTitles(page: import('@playwright/test').Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    return dbService.getPendingCurationByClient(cid).map((row) => row.title);
  }, { cid: clientId });
}

test.describe('#21 — React advisor click-only curation', () => {
  test('SUCCESS — ADMIN prepares an existing advice action into Deliver', async ({ page }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    const fixture = await seedAdvice(page, CLIENT_JUAN_ID);
    const before = await pendingTitles(page, CLIENT_JUAN_ID);

    await sidebarTab(page, 'ws-positioning').click();
    await expect(page.locator('[data-testid="react-client-workspace"][data-workspace-tab="positioning"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-ws-advice"]')).toBeVisible();
    await expect(page.locator(`[data-testid="react-ws-advice-action-${fixture.actionId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-ws-advice-title-${fixture.actionId}"]`)).toHaveText(ACTION_TITLE);
    await expect(page.locator(`[data-testid="react-ws-advice-why-${fixture.actionId}"]`)).toContainText(
      'Porque el cliente necesita visibilidad.'
    );
    await expect(page.locator(`[data-testid="react-ws-advice-how-${fixture.actionId}"]`)).toContainText(
      'Publicar una nota en LinkedIn.'
    );
    await expect(page.locator('[data-testid="react-ws-advice"]')).not.toContainText('Generar consejo');
    await page.locator(`[data-testid="react-ws-advice-prepare-${fixture.actionId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-advice-success"]')).toContainText(
      'Acción enviada a la mesa de curación',
      { timeout: 10_000 }
    );

    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-ws-curation-list"]')).toContainText(ACTION_TITLE);

    const after = await pendingTitles(page, CLIENT_JUAN_ID);
    expect(after.filter((title) => title === ACTION_TITLE).length).toBeGreaterThan(
      before.filter((title) => title === ACTION_TITLE).length
    );
  });

  test('SECURITY — foreign/wrong-client advice action fails closed', async ({ page }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    const fixture = await seedAdvice(page, CLIENT_JUAN_ID);
    const juanBefore = await pendingTitles(page, CLIENT_JUAN_ID);
    const elenaBefore = await pendingTitles(page, CLIENT_ELENA_ID);

    const outcome = await page.evaluate(
      async ({ elenaId, actionId }) => {
        const { executionDeliveryCommands } = await import('/src/ui/commands/commandSeam.ts');
        return executionDeliveryCommands.addAdviceActionToCuration({
          requestedClientId: elenaId,
          adviceActionId: actionId,
        });
      },
      { elenaId: CLIENT_ELENA_ID, actionId: fixture.actionId }
    );

    expect(outcome.ok).toBe(false);
    const juanAfter = await pendingTitles(page, CLIENT_JUAN_ID);
    const elenaAfter = await pendingTitles(page, CLIENT_ELENA_ID);
    expect(juanAfter).toEqual(juanBefore);
    expect(elenaAfter).toEqual(elenaBefore);
  });

  test('NO-AI — click-only panel does not call the model or topic agent', async ({ page }) => {
    test.setTimeout(90_000);
    const remoteHits: string[] = [];
    await page.route(/openai|anthropic|generativelanguage\.googleapis/i, async (route) => {
      remoteHits.push(route.request().url());
      await route.abort();
    });

    await openManagerWorkspace(page);
    await seedAdvice(page, CLIENT_JUAN_ID);
    await sidebarTab(page, 'ws-positioning').click();
    await expect(page.locator('[data-testid="react-ws-advice"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-ws-advice"]')).not.toContainText('Generar consejo');
    await expect(page.locator('[data-testid="react-ws-advice"]')).not.toContainText('Descubrir temas');
    await page.locator(`[data-testid="react-ws-advice-prepare-${ACTION_ID}"]`).click();
    await expect(page.locator('[data-testid="react-ws-advice-success"]')).toContainText(
      'Acción enviada a la mesa de curación',
      { timeout: 10_000 }
    );

    const facts = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const advice = dbService.getLatestAdvice(cid);
      return {
        usedLiveModel: advice?.usedLiveModel ?? null,
        generatedAt: advice?.generatedAt ?? null,
        generatedBy: advice?.generatedBy ?? null,
      };
    }, { cid: CLIENT_JUAN_ID });
    expect(facts.usedLiveModel).toBe(false);
    expect(facts.generatedAt).toBe('2026-09-19T12:00:00.000Z');
    expect(facts.generatedBy).toBe('e2e-fixture');
    expect(remoteHits).toEqual([]);
  });

  test('ROLLBACK — legacy briefing Preparar entrega remains reachable', async ({ page }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await seedAdvice(page, CLIENT_JUAN_ID);

    await page.evaluate(async ({ clientId, key }) => {
      localStorage.setItem(key, 'legacy');
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
      let host = document.getElementById('c21-legacy-briefing');
      if (!host) {
        host = document.createElement('div');
        host.id = 'c21-legacy-briefing';
        document.body.appendChild(host);
      }
      ui.mountLegacyIsland(host, { tab: 'ws-briefing', clientId });
    }, { clientId: CLIENT_JUAN_ID, key: UI_MODE_KEY });

    const island = page.locator('[data-legacy-island="true"]');
    await expect(island).toBeVisible({ timeout: 15_000 });
    await island.getByText('Ver diagnóstico completo').click();
    await expect(island.locator('.btn-advice-to-curation').first()).toBeVisible();
    await expect(island.locator('.btn-advice-to-curation').first()).toHaveText('Preparar entrega');
  });
});
