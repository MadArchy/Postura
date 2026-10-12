/**
 * SPEC-010 · T603 React Parity Wave P5 — bounded manager thesis save E2E.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import { clientDocPath, waitForServerField } from './support/clientFixtures';
import { buildJuanGovernanceReviewThesis, THESIS_GOVERNANCE_REVIEW } from '../src/data/juanCampaignSeed';

test.use({ channel: 'chrome' });

async function openGovernanceThesis(page: Page) {
  await sidebarTab(page, 'ws-positioning').click();
  await expect(page.locator('[data-testid="react-thesis-editor"]')).toBeVisible({ timeout: 15_000 });
  await page.selectOption('[data-testid="react-thesis-select"]', THESIS_GOVERNANCE_REVIEW);
  await expect(page.locator('[data-testid="react-thesis-detail"]')).toBeVisible();
}

async function readGovernanceThesis(page: Page) {
  return page.evaluate(async ({ clientId, thesisId }) => {
    const { dbService } = await import('/src/services/db.ts');
    const thesis = dbService.getThesesByClient(clientId).find((row) => row.id === thesisId);
    return thesis
      ? {
          status: thesis.status,
          differentiator: thesis.differentiator ?? null,
          perceptionTarget: thesis.perceptionTarget ?? null,
          hasDifferentiator: Boolean(thesis.differentiator),
        }
      : null;
  }, { clientId: CLIENT_JUAN_ID, thesisId: THESIS_GOVERNANCE_REVIEW });
}

test.describe('P5 — React manager thesis save/activate parity', () => {
  test('ADMIN saves draft on ReactThesisEditorPage without #11 legacy handoff', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-positioning').click();

    await expect(page.locator('[data-testid="react-client-workspace"][data-workspace-tab="positioning"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-thesis-editor"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-thesis-editor-handoff"]')).toHaveCount(0);

    await page.selectOption('[data-testid="react-thesis-select"]', THESIS_GOVERNANCE_REVIEW);
    await expect(page.locator('[data-testid="react-thesis-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-thesis-stress-test"]')).toBeEnabled();
    await expect(page.locator('[data-testid="react-thesis-save"]')).toBeEnabled();
    await expect(page.locator('[data-testid="react-thesis-submit"]')).toBeEnabled();

    const titleInput = page.locator('#react-thesis-title');
    await titleInput.fill('Gobernanza IA para consejos y comités (P5 draft)');
    await page.click('[data-testid="react-thesis-save"]');

    await expect(page.locator('[data-testid="react-thesis-success"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="react-thesis-success"]')).toContainText(/Borrador|guardado/i);

    const stored = await page.evaluate(async ({ thesisId }) => {
      const { dbService } = await import('/src/services/db.ts');
      const thesis = dbService.getThesesByClient('client_juan_001').find((row) => row.id === thesisId);
      return thesis
        ? {
            title: thesis.title,
            status: thesis.status,
            clientApprovalStatus: thesis.clientApprovalStatus,
          }
        : null;
    }, { thesisId: THESIS_GOVERNANCE_REVIEW });

    expect(stored).toEqual({
      title: 'Gobernanza IA para consejos y comités (P5 draft)',
      status: 'DRAFT',
      clientApprovalStatus: 'PENDING',
    });

    await expect(page.locator('[data-testid="react-thesis-status"]')).toContainText('DRAFT');
  });

  test('ADMIN clears differentiator and perceptionTarget; Firestore keeps the explicit empty values', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const seeded = buildJuanGovernanceReviewThesis();
    const thesisPath = clientDocPath(CLIENT_JUAN_ID, 'theses', THESIS_GOVERNANCE_REVIEW);
    await waitForServerField(thesisPath, 'differentiator', seeded.differentiator!);
    await waitForServerField(thesisPath, 'perceptionTarget', seeded.perceptionTarget!);

    await openManagerWorkspace(page);
    await openGovernanceThesis(page);
    const differentiator = page.locator('#react-thesis-differentiator');
    const perceptionTarget = page.locator('#react-thesis-perceptionTarget');
    await expect(differentiator).toHaveValue(seeded.differentiator!);
    await expect(perceptionTarget).toHaveValue(seeded.perceptionTarget!);

    await differentiator.fill('');
    await perceptionTarget.fill('   ');
    await page.click('[data-testid="react-thesis-save"]');
    await expect(page.locator('[data-testid="react-thesis-success"]')).toBeVisible({ timeout: 10_000 });

    expect(await readGovernanceThesis(page)).toEqual({
      status: 'DRAFT',
      differentiator: '',
      perceptionTarget: '',
      hasDifferentiator: false,
    });
    await waitForServerField(thesisPath, 'differentiator', '');
    await waitForServerField(thesisPath, 'perceptionTarget', '');

    const context = await browser.newContext();
    try {
      const fresh = await context.newPage();
      await openManagerWorkspace(fresh);
      expect(await readGovernanceThesis(fresh)).toEqual({
        status: 'DRAFT',
        differentiator: '',
        perceptionTarget: '',
        hasDifferentiator: false,
      });
      await openGovernanceThesis(fresh);
      await expect(fresh.locator('#react-thesis-differentiator')).toHaveValue('');
      await expect(fresh.locator('#react-thesis-perceptionTarget')).toHaveValue('');
    } finally {
      await context.close();
    }
  });
});
