/**
 * SPEC-010 · Radar R1 H09 — React contested attribution (lead / rival) E2E.
 *
 * The emulator owner seeds one CONTESTED/AUTO Juan signal before ADMIN login, so
 * the fixture never depends on scoring producing a near-tie.
 */
import { expect, test, type Page } from '@playwright/test';
import { CLIENT_JUAN_ID, openManagerWorkspace, sidebarTab } from './helpers/spec010Auth';
import { clientDocPath, FIXTURE_ORG_ID, ownerSeedDoc, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

const LEAD_ID = 'thesis_juan_ip_ai_adoption';
const LEAD_TITLE = 'Propiedad Intelectual y Adopción Responsable de IA';
const RIVAL_ID = 'thesis_juan_ip_patents';
const RIVAL_TITLE = 'Estrategia de Patentes, PI y Opiniones Técnicas';
const THESIS_SCORES = [
  { thesisId: LEAD_ID, score: 62, band: 'HIGH' },
  { thesisId: RIVAL_ID, score: 60, band: 'HIGH' },
];

async function readSignal(page: Page, signalId: string) {
  return page.evaluate(
    async ({ id }) => {
      const { dbService } = await import('/src/services/db.ts');
      const row = dbService.getSignalById(id);
      return {
        present: Boolean(row),
        thesisId: row?.thesisId ?? null,
        thesisScores: row?.thesisScores ?? null,
        routingState: row?.routingDecision?.routingState ?? null,
        routingSource: row?.routingDecision?.source ?? null,
        selectedThesisId: row?.routingDecision?.selectedThesisId ?? null,
        actorId: row?.routingDecision?.actorId ?? null,
        historyCount: dbService.getSignalRoutingHistory(id).length,
      };
    },
    { id: signalId }
  );
}

test.describe('R1 H09 — React admin contested attribution', () => {
  test('ADMIN resolves a contested signal to the rival thesis', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const signalId = `sig_h09_${stamp}`;
    const signalPath = clientDocPath(CLIENT_JUAN_ID, 'signals', signalId);
    const title = `H09 CONTESTED FIXTURE ${stamp}`;
    await ownerSeedDoc(signalPath, {
      id: signalId,
      organizationId: FIXTURE_ORG_ID,
      clientId: CLIENT_JUAN_ID,
      title,
      sourceType: 'MANUAL',
      sourceName: 'Manual',
      contentSnippet: 'Contested attribution fixture seeded by the emulator owner.',
      fingerprint: `h09-${stamp}`,
      detectedAt: new Date(stamp - 60_000).toISOString(),
      status: 'NEW',
      aiStatus: 'NOT_REQUIRED',
      managerDecision: 'UNREVIEWED',
      relevanceScore: 62,
      priorityBand: 'HIGH',
      thesisScores: THESIS_SCORES,
      routingDecision: {
        routingState: 'CONTESTED',
        contested: true,
        source: 'AUTO',
        secondaryThesisId: RIVAL_ID,
        algorithmVersion: 'routing-v1',
      },
    });

    await openManagerWorkspace(page);
    await expect
      .poll(async () => (await readSignal(page, signalId)).present, {
        timeout: 30_000,
        message: `local hydration of ${signalId}`,
      })
      .toBe(true);

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 15_000 });
    const card = page.locator('li.signal-card').filter({ hasText: title });
    await expect(card).toHaveCount(1);

    const attribution = page.locator(`[data-testid="react-ws-attribution-${signalId}"]`);
    await expect(attribution).toHaveText(
      `Atribución en disputa — elige la tesis: ${LEAD_TITLE} 62 · ${RIVAL_TITLE} 60`
    );
    const useLead = page.locator(`[data-testid="react-ws-attribution-use-${signalId}-${LEAD_ID}"]`);
    const useRival = page.locator(`[data-testid="react-ws-attribution-use-${signalId}-${RIVAL_ID}"]`);
    await expect(useLead).toHaveText(`Usar ${LEAD_TITLE}`);
    await expect(useRival).toHaveText(`Usar ${RIVAL_TITLE}`);
    await expect(useRival).toBeEnabled();
    await expect(page.locator(`[data-testid="react-ws-attribution-manual-${signalId}"]`)).toHaveCount(0);

    await useRival.focus();
    await page.keyboard.press('Enter');

    const status = page.locator('[data-testid="react-ws-radar-success"]');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveText(`Señal asignada a «${RIVAL_TITLE}»`, { timeout: 15_000 });
    await expect(page.locator('[data-testid="react-ws-radar-error-msg"]')).toHaveCount(0);

    const after = await readSignal(page, signalId);
    const diagnostics = `H09 fixture after: ${JSON.stringify(after)}`;
    expect(after.routingState, diagnostics).toBe('CLEAR');
    expect(after.routingSource, diagnostics).toBe('MANUAL');
    expect(after.selectedThesisId, diagnostics).toBe(RIVAL_ID);
    expect(after.thesisId, diagnostics).toBe(RIVAL_ID);
    expect(after.actorId, diagnostics).toBeTruthy();
    expect(after.thesisScores, diagnostics).toEqual(THESIS_SCORES);
    expect(after.historyCount, diagnostics).toBe(1);

    await expect(attribution).toContainText('Tesis asignada:');
    await expect(page.locator(`[data-testid="react-ws-attribution-manual-${signalId}"]`)).toHaveText(
      'Override manual'
    );
    await expect(useLead).toHaveCount(0);
    await expect(useRival).toHaveCount(0);
    await expect(card).not.toContainText('elige la tesis');
    await expect(card).not.toContainText('decidirla todavía no está disponible');

    await waitForServerField(signalPath, 'routingDecision.routingState', 'CLEAR');
    await waitForServerField(signalPath, 'routingDecision.source', 'MANUAL');
    await waitForServerField(signalPath, 'routingDecision.selectedThesisId', RIVAL_ID);
    await waitForServerField(signalPath, 'thesisId', RIVAL_ID);
  });
});
