/**
 * SPEC-010 · T603 React Parity Wave P16 — bounded ADMIN SaveContentDraft E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  enterClientWorkspaceFromShell,
  loginAsManager,
  sidebarTab,
} from './helpers/spec010Auth';

test.use({ channel: 'chrome' });

const TITLE_PREFIX = 'P16 SaveContentDraft';

async function seedExistingDraftAt(
  page: import('@playwright/test').Page,
  id: string,
  title: string
) {
  await page.evaluate(
    async ({ clientId, contentId, contentTitle }) => {
      const { dbService } = await import('/src/services/db.ts');
      const briefConsumer = await import('/src/services/strategicBriefConsumer.ts');
      const now = new Date().toISOString();

      const approved = briefConsumer.listStrategicBriefs(clientId).find(
        (brief) =>
          brief.status === 'APPROVED' &&
          !brief.supersededByBriefId &&
          brief.decision.authorizedAction === 'CREATE_CONTENT'
      );

      let briefId = approved?.id ?? null;
      if (!briefId) {
        const thesis = dbService.getActiveTheses(clientId)[0];
        const signal = dbService
          .getSignalsByClient(clientId)
          .find((row) => row.status !== 'DISCARDED' && !dbService.isSignalInCuration(clientId, row.id));
        if (thesis && signal) {
          dbService.applyStrategicRoutingToSignal(
            signal.id,
            {
              totalScore: 84,
              priorityBand: 'HIGH',
              factors: {} as never,
              penalties: {} as never,
              strategicRationale: 'E2E P16 governed routing fixture.',
              recommendedAction: 'CURATE',
              scoringStatus: 'SCORED',
              calculatedAt: now,
            },
            {
              thesisId: thesis.id,
              thesisScores: [{ thesisId: thesis.id, score: 84, rationale: 'E2E P16' }],
              routingDecision: { routingState: 'CLEAR', selectedThesisId: thesis.id },
              clientId,
            }
          );
          dbService.applyScoreToSignal(
            signal.id,
            {
              totalScore: 84,
              priorityBand: 'HIGH',
              factors: {} as never,
              penalties: {} as never,
              strategicRationale: 'E2E P16 governed score fixture.',
              recommendedAction: 'CURATE',
              scoringStatus: 'SCORED',
              scoringVersion: 'scoring-v1',
              recommendedDisposition: 'SAVE',
              recommendedOutputFormat: 'ARTICLE',
              calculatedAt: now,
            },
            { whyNow: { reason: 'E2E P16 timely governed context', score: 10 } }
          );

          const { addSignalToCuration, decideCuration } = await import(
            '/src/services/executionDeliveryConsumer.ts'
          );
          const added = addSignalToCuration({ requestedClientId: clientId, signalId: signal.id });
          decideCuration({
            requestedClientId: clientId,
            curationEntryId: added.entry.id,
            destination: 'TASK_ARTICLE',
            rationale: 'E2E P16 decided ready row for governed existing-content edit.',
          });
          const entry = dbService.getCurationById(added.entry.id);
          if (entry?.deliveryPackageId) {
            dbService.attachCurationToDelivery(added.entry.id, null);
          }
          const created = briefConsumer.createBriefFromCurationEntry({
            curationEntryId: added.entry.id,
            destination: 'TASK_ARTICLE',
          });
          try {
            briefId = briefConsumer.approveStrategicBrief({
              clientId,
              briefId: created.brief.id,
            }).id;
          } catch {
            briefId = created.brief.id;
          }
        }
      }

      const donor = dbService.getContentForClient(clientId)[0];
      dbService.saveContent({
        ...(donor ?? {
          type: 'LINKEDIN_ARTICLE' as const,
          targetPlatform: 'LinkedIn' as const,
        }),
        id: contentId,
        organizationId: donor?.organizationId ?? 'org_aurora_01',
        clientId,
        thesisId: donor?.thesisId ?? 'thesis_juan_ip_ai_adoption',
        title: contentTitle,
        body: 'Borrador P16 existente para edición nativa.',
        type: 'LINKEDIN_ARTICLE',
        targetPlatform: 'LinkedIn',
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
        ...(briefId ? { strategicBriefId: briefId } : {}),
      });
    },
    { clientId: CLIENT_JUAN_ID, contentId: id, contentTitle: title }
  );
}

async function seedExistingDraft(page: import('@playwright/test').Page) {
  const title = `${TITLE_PREFIX} ${Date.now()}`;
  const id = `cnt_p16_${Date.now()}`;
  await seedExistingDraftAt(page, id, title);
  return { id, title };
}

async function openProduction(page: import('@playwright/test').Page) {
  await sidebarTab(page, 'ws-production').click();
  await expect(page.locator('[data-testid="react-ws-production"]')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('P16 — React SaveContentDraft parity', () => {
  test('ADMIN edits an existing draft via native production editor', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    const { id, title } = await seedExistingDraft(page);
    await sidebarTab(page, 'ws-radar').click();
    await openProduction(page);

    await expect(page.locator(`[data-testid="react-ws-production-row-${id}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await page.click(`[data-testid="react-ws-production-edit-${id}"]`);
    await expect(page.locator('[data-testid="react-content-editor"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-content-editor-title"]')).toHaveValue(title);

    const updatedTitle = `${title} edited`;
    await page.fill('[data-testid="react-content-editor-title"]', updatedTitle);
    await page.fill('[data-testid="react-content-editor-body"]', 'Cuerpo P16 actualizado.');
    await page.click('[data-testid="react-content-editor-submit"]');

    await expect(page.locator('[data-testid="react-ws-production-success"]')).toContainText(
      'Cambios guardados',
      { timeout: 15_000 }
    );
    await expect(page.locator('[data-testid="react-ws-production"]')).toBeVisible();
    await expect(page.locator(`[data-testid="react-ws-production-row-${id}"]`)).toContainText(
      updatedTitle
    );

    const facts = await page.evaluate(async ({ contentId, originalTitle }) => {
      const { dbService } = await import('/src/services/db.ts');
      const item = dbService.getContentById(contentId);
      const clones = dbService
        .getContentForClient('client_juan_001')
        .filter((row) => row.title === originalTitle && row.id !== contentId);
      return {
        found: Boolean(item),
        id: item?.id ?? null,
        title: item?.title ?? null,
        body: item?.body ?? null,
        extraOriginals: clones.length,
      };
    }, { contentId: id, originalTitle: title });

    expect(facts.found).toBe(true);
    expect(facts.id).toBe(id);
    expect(facts.title).toBe(updatedTitle);
    expect(facts.body).toBe('Cuerpo P16 actualizado.');
    expect(facts.extraOriginals).toBe(0);
  });

  test('empty title blocks save without creating content', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    const { id, title } = await seedExistingDraft(page);
    await sidebarTab(page, 'ws-radar').click();
    await openProduction(page);
    await expect(page.locator(`[data-testid="react-ws-production-row-${id}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await page.click(`[data-testid="react-ws-production-edit-${id}"]`);
    await expect(page.locator('[data-testid="react-content-editor"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.fill('[data-testid="react-content-editor-title"]', '');
    await page.click('[data-testid="react-content-editor-submit"]');
    await expect(page.locator('[data-testid="react-content-editor-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-content-editor"]')).toBeVisible();

    const facts = await page.evaluate(async ({ contentId, originalTitle }) => {
      const { dbService } = await import('/src/services/db.ts');
      const item = dbService.getContentById(contentId);
      return {
        title: item?.title ?? null,
        createdExtras: dbService
          .getContentForClient('client_juan_001')
          .filter((row) => row.title.startsWith(originalTitle) && row.id !== contentId).length,
      };
    }, { contentId: id, originalTitle: title });

    expect(facts.title).toBe(title);
    expect(facts.createdExtras).toBe(0);
  });

  test('legacy content editor remains reachable after UI-mode rollback', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    const { id } = await seedExistingDraft(page);

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
      let host = document.getElementById('p16-legacy-production');
      if (!host) {
        host = document.createElement('div');
        host.id = 'p16-legacy-production';
        document.body.appendChild(host);
      }
      ui.mountLegacyIsland(host, { tab: 'ws-production', clientId });
    }, { clientId: CLIENT_JUAN_ID });

    await expect(page.locator('[data-legacy-island="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`.btn-open-content-editor[data-content-id="${id}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await page.locator(`.btn-open-content-editor[data-content-id="${id}"]`).click();
    await expect(page.locator('#form-edit-content')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#form-edit-content')).toHaveAttribute('data-content-id', id);
  });
});
