/**
 * SPEC-010 · R1 H19/H20 — native thesis stress-test and AI proposal E2E.
 *
 * Both controls are advisory: the stress-test only renders a challenge modal and
 * the proposal only pre-fills the create form. Neither may write a thesis.
 */
import { expect, test, type Page } from '@playwright/test';
import { CLIENT_JUAN_ID, openManagerWorkspace, sidebarTab } from './helpers/spec010Auth';
import { clientDocPath, ownerGetField } from './support/clientFixtures';
import { stubAiGateway } from './support/aiGatewayStub';
import { THESIS_GOVERNANCE_REVIEW } from '../src/data/juanCampaignSeed';

test.use({ channel: 'chrome' });

const CHALLENGE_RECOMMENDATION = 'H19 stub: separa gobernanza de comités y adopción operativa.';

const THESIS_CHALLENGE_FIXTURE = {
  outcome: 'SPLIT',
  recommendations: [CHALLENGE_RECOMMENDATION],
  riskScore: 61,
};

const PROPOSAL_TITLE = 'H20 stub · Gobernanza de IA para despachos';

const THESIS_PROPOSAL_FIXTURE = {
  title: PROPOSAL_TITLE,
  expertIdentity: 'H20 stub · Abogado de propiedad intelectual y gobernanza de IA',
  identityCurrent: 'Litigante reconocido en patentes',
  perceptionTarget: 'Referente en gobernanza de IA para comités legales',
  targetAudience: 'General Counsel',
  domain: 'Dominio-H20-stub',
  objective: 'Posicionar autoridad en gobernanza de IA',
  differentiator: 'H20 stub · Une práctica de patentes con marcos de gobernanza de IA',
  proofPoints: ['Casos de patentes de software'],
  audiences: [{ name: 'General Counsel', tier: 'COMMERCIAL', weight: 90 }],
  territories: [{ name: 'Gobernanza IA', weight: 80, pillar: 'IP' }],
  objectives: [{ kind: 'THOUGHT_LEADERSHIP', weight: 70 }],
  voiceAndTone: 'Sobrio y preciso',
  voiceAvoid: ['hype'],
  hardBlocks: [],
  softAvoid: [],
  complianceRules: 'Sin promesas de resultados.',
};

async function openThesisEditor(page: Page) {
  await sidebarTab(page, 'ws-positioning').click();
  await expect(page.locator('[data-testid="react-thesis-editor"]')).toBeVisible({ timeout: 15_000 });
}

/** Every thesis write goes through `dbService.saveThesis`; record each call from here on. */
async function spyThesisWrites(page: Page) {
  await page.evaluate(async () => {
    const { dbService } = await import('/src/services/db.ts');
    const writes: string[] = [];
    Reflect.set(globalThis, '__r1ThesisWrites', writes);
    const original = dbService.saveThesis.bind(dbService);
    dbService.saveThesis = (thesis) => {
      writes.push(thesis.id);
      original(thesis);
    };
  });
}

async function readThesisWrites(page: Page) {
  return page.evaluate(() => {
    const writes: unknown = Reflect.get(globalThis, '__r1ThesisWrites');
    return Array.isArray(writes) ? writes.map(String) : null;
  });
}

async function readLocalThesisIds(page: Page) {
  return page.evaluate(async ({ clientId }) => {
    const { dbService } = await import('/src/services/db.ts');
    return dbService.getThesesByClient(clientId).map((thesis) => thesis.id).sort();
  }, { clientId: CLIENT_JUAN_ID });
}

test.describe('R1 H19/H20 — advisory thesis AI controls', () => {
  test('H19 — ADMIN stress-tests a thesis through the gateway and nothing is written', async ({ page }) => {
    test.setTimeout(90_000);
    const stub = await stubAiGateway(page, { THESIS_CHALLENGE: THESIS_CHALLENGE_FIXTURE });
    await openManagerWorkspace(page);
    await openThesisEditor(page);
    await page.selectOption('[data-testid="react-thesis-select"]', THESIS_GOVERNANCE_REVIEW);
    await expect(page.locator('[data-testid="react-thesis-detail"]')).toBeVisible();

    const thesisPath = clientDocPath(CLIENT_JUAN_ID, 'theses', THESIS_GOVERNANCE_REVIEW);
    const serverBefore = {
      title: await ownerGetField(thesisPath, 'title'),
      status: await ownerGetField(thesisPath, 'status'),
    };
    await spyThesisWrites(page);

    await page.click('[data-testid="react-thesis-stress-test"]');
    const modal = page.locator('[data-testid="react-challenge-modal"]');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal).toContainText('Considerar dividir');
    await expect(modal).toContainText('Riesgo 61%');
    await expect(modal).toContainText(CHALLENGE_RECOMMENDATION);

    expect(stub.calls).toEqual([
      expect.objectContaining({ operation: 'THESIS_CHALLENGE', clientId: CLIENT_JUAN_ID }),
    ]);
    expect(stub.providerHits).toEqual([]);

    await modal.getByRole('button', { name: 'Cerrar' }).click();
    await expect(modal).toHaveCount(0);

    expect(await readThesisWrites(page)).toEqual([]);
    expect({
      title: await ownerGetField(thesisPath, 'title'),
      status: await ownerGetField(thesisPath, 'status'),
    }).toEqual(serverBefore);
  });

  test('H20 — ADMIN loads an AI proposal into the create form without creating a thesis', async ({ page }) => {
    test.setTimeout(90_000);
    const stub = await stubAiGateway(page, { THESIS_PROPOSAL: THESIS_PROPOSAL_FIXTURE });
    await openManagerWorkspace(page);
    await openThesisEditor(page);
    const idsBefore = await readLocalThesisIds(page);
    await spyThesisWrites(page);
    const countBefore = await page.locator('[data-testid="react-thesis-count"]').innerText();

    await page.click('[data-testid="react-thesis-create"]');
    await expect(page.locator('[data-testid="react-thesis-create-form"]')).toBeVisible();
    await expect(page.locator('#react-thesis-title')).toHaveValue('');

    await page.click('[data-testid="react-thesis-propose"]');
    await expect(page.locator('[data-testid="react-thesis-success"]')).toContainText('Propuesta cargada', {
      timeout: 15_000,
    });
    await expect(page.locator('#react-thesis-title')).toHaveValue(PROPOSAL_TITLE);
    await expect(page.locator('#react-thesis-expertIdentity')).toHaveValue(THESIS_PROPOSAL_FIXTURE.expertIdentity);
    await expect(page.locator('#react-thesis-differentiator')).toHaveValue(THESIS_PROPOSAL_FIXTURE.differentiator);
    await expect(page.locator('#react-thesis-perceptionTarget')).toHaveValue(
      THESIS_PROPOSAL_FIXTURE.perceptionTarget
    );

    expect(stub.calls).toEqual([
      expect.objectContaining({ operation: 'THESIS_PROPOSAL', clientId: CLIENT_JUAN_ID }),
    ]);
    expect(stub.providerHits).toEqual([]);

    expect(await readThesisWrites(page)).toEqual([]);
    expect(await readLocalThesisIds(page)).toEqual(idsBefore);
    await expect(page.locator('[data-testid="react-thesis-count"]')).toHaveText(countBefore);
  });
});
