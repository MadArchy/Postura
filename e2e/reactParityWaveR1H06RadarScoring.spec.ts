/**
 * SPEC-010 · Radar R1 H06 — React-native bulk "Puntuar todas" E2E.
 *
 * The fixture registers its own Juan signal through the React manual-signal form,
 * so it never depends on seeded signals still being unscored.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';

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

async function readSignal(page: Page, title: string) {
  return page.evaluate(
    async ({ cid, title: t }) => {
      const { dbService } = await import('/src/services/db.ts');
      const rows = dbService.getSignalsByClient(cid).filter((s) => s.title === t);
      const row = rows[0];
      return {
        matches: rows.length,
        id: row?.id ?? null,
        status: row?.status ?? null,
        score: typeof row?.relevanceScore === 'number' ? row.relevanceScore : null,
        routingState: row?.routingDecision?.routingState ?? null,
        routingSource: row?.routingDecision?.source ?? null,
      };
    },
    { cid: CLIENT_JUAN_ID, title }
  );
}

test.describe('R1 H06 — React admin radar bulk scoring', () => {
  test('ADMIN scores pending signals natively via "Puntuar todas"', async ({ page }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);

    const title = `H06 PENDING FIXTURE ${Date.now()}`;
    await sidebarTab(page, 'ws-sources-react').click();
    await expect(page.locator('[data-testid="react-ws-sources"]')).toBeVisible({ timeout: 15_000 });
    await registerManualSignal(page, title);

    await sidebarTab(page, 'ws-radar').click();
    await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 15_000 });
    const card = page.locator('li.signal-card').filter({ hasText: title });
    await expect(card).toHaveCount(1);

    const before = await readSignal(page, title);
    const diagnostics = `H06 fixture before: ${JSON.stringify(before)}`;
    expect(before.matches, diagnostics).toBe(1);
    expect(before.score, diagnostics).toBeNull();
    expect(before.status, diagnostics).not.toBe('DISCARDED');
    await expect(card).not.toContainText('score ');

    await expect(page.locator('[data-testid="react-ws-cannot-score"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-ws-radar-unscored-count"]')).toContainText(
      'señal(es) sin puntuar.'
    );
    const scoreAll = page.getByRole('button', { name: 'Puntuar todas', exact: true });
    await expect(scoreAll).toBeVisible();
    await expect(scoreAll).toBeEnabled();

    await scoreAll.focus();
    await page.keyboard.press('Enter');

    const status = page.locator('[data-testid="react-ws-radar-success"]');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveText(/^\d+ señal\(es\) puntuada\(s\)$/, { timeout: 15_000 });

    const after = await readSignal(page, title);
    const afterDiagnostics = `H06 fixture after: ${JSON.stringify(after)}`;
    expect(after.id, afterDiagnostics).toBe(before.id);
    expect(after.score, afterDiagnostics).not.toBeNull();
    expect(after.routingState, afterDiagnostics).not.toBeNull();
    expect(after.routingSource, afterDiagnostics).toBe('AUTO');
    expect(after.status, afterDiagnostics).not.toBe('DISCARDED');

    await expect(card).toContainText(`score ${after.score}`);
    await expect(card).toContainText(
      after.routingState === 'CLEAR'
        ? 'Tesis asignada:'
        : after.routingState === 'CONTESTED'
          ? 'Atribución en disputa'
          : 'Sin tesis estratégica asignada'
    );

    const handoff = page.locator('[data-testid="react-ws-radar-handoff"]');
    await expect(handoff).toBeVisible();
    await expect(handoff).not.toContainText('puntuar señales');
    await expect(handoff).toContainText('investigarlas');
  });
});
