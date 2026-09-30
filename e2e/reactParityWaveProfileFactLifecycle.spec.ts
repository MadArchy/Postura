/**
 * SPEC-010 · Master Profile fact lifecycle React E2E (#2–#6).
 * Local deterministic fixtures only. No remote Firestore, AI, or network.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_ELENA_EMAIL,
  CLIENT_ELENA_ID,
  CLIENT_JUAN_EMAIL,
  CLIENT_JUAN_ID,
  sidebarTab,
} from './helpers/spec010Auth';
import { loginClientWithSettledSession } from './support/clientFixtures';

test.use({ channel: 'chrome' });

const ADD_LABEL = 'PF E2E Rol';
const ADD_VALUE = 'Socia de propiedad intelectual';
const CV_LINE_A = 'Partner attorney specializing in patent governance.';
const CV_LINE_B = 'Published article on AI adoption readiness.';
const CV_PASTE = `${CV_LINE_A}\n${CV_LINE_B}`;

async function pinLocalDemoData(page: Page) {
  await page.evaluate(async () => {
    const sync = await import('/src/services/firestore/sync.ts');
    sync.stopFirestoreRealtimeSync();
    sync.setFirestoreAuthoritative(false);
    const { dbService } = await import('/src/services/db.ts');
    const { authService } = await import('/src/services/auth.ts');
    dbService.runBuiltInSeed();
    const user = authService.getCurrentUser();
    const cid = user?.clientId?.trim();
    if (cid && !dbService.getMasterProfile(cid)) {
      const existing = dbService.getClientById(cid);
      dbService.saveMasterProfile({
        organizationId: existing?.organizationId || user.organizationId,
        clientId: cid,
        identity: {},
        goals: {},
        audience: {},
        career: {},
        education: [],
        careerHistory: [],
        ventures: [],
        keyPublications: [],
        socialLinks: {},
        voicePreferences: {
          tone: 'authoritative',
          preferredPhrases: [],
          topicsToAvoid: [],
          complianceGuidelines: '',
        },
        facts: [],
        onboardingCompleted: false,
        updatedAt: new Date().toISOString(),
      });
    }
    if (cid && !dbService.getClientById(cid)) {
      const template =
        dbService.getClientById('client_juan_001') ?? dbService.getClients()[0];
      if (!template) throw new Error('Local demo seed produced no clients');
      const profile = dbService.getMasterProfile(template.id);
      dbService.importSnapshot(
        {
          clients: [
            {
              ...template,
              id: cid,
              organizationId: user.organizationId,
              primaryEmail: user.email,
              displayName: user.displayName,
            },
          ],
          profiles: profile
            ? {
                [cid]: {
                  ...profile,
                  clientId: cid,
                  organizationId: user.organizationId,
                },
              }
            : undefined,
        },
        { merge: true, skipRemote: true }
      );
    }
  });
}

async function openClientProfile(page: Page) {
  await sidebarTab(page, 'client-profile').click();
  await expect(page.locator('[data-testid="react-profile-panel"]')).toBeVisible({
    timeout: 15_000,
  });
}

async function profileFacts(page: Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    const profile = dbService.getMasterProfile(cid);
    return (profile?.facts ?? []).map((fact) => ({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      status: fact.status,
      section: fact.section,
    }));
  }, { cid: clientId });
}

async function seedCandidates(page: Page, clientId: string, text: string) {
  return page.evaluate(async ({ cid, cvText }) => {
    const { importProfileFactsFromCv } = await import('/src/services/masterProfileConsumer.ts');
    const result = importProfileFactsFromCv({
      requestedClientId: cid,
      cvText,
    });
    return {
      importedCount: result.importedCount,
      ids: result.facts.map((fact) => fact.id),
    };
  }, { cid: clientId, cvText: text });
}

test.describe('Profile fact lifecycle — React write parity', () => {
  test('CLIENT adds a manual fact on Mi perfil and refresh shows it', async ({ page }) => {
    test.setTimeout(90_000);
    await loginClientWithSettledSession(page, CLIENT_JUAN_EMAIL);
    await pinLocalDemoData(page);
    await openClientProfile(page);

    await page.locator('[data-testid="react-profile-add-identity"]').click();
    await page.locator('[data-testid="react-profile-add-label-identity"]').fill(ADD_LABEL);
    await page.locator('[data-testid="react-profile-add-value-identity"]').fill(ADD_VALUE);
    await page.locator('[data-testid="react-profile-add-submit-identity"]').click();

    await expect(page.locator('[data-testid="react-profile-success"]')).toContainText(
      'Fact añadido',
      { timeout: 10_000 }
    );

    const facts = await profileFacts(page, CLIENT_JUAN_ID);
    const added = facts.find((fact) => fact.label === ADD_LABEL && fact.value === ADD_VALUE);
    expect(added).toBeTruthy();
    expect(added?.status).toBe('confirmed');
    await expect(page.getByText(ADD_VALUE)).toBeVisible();
  });

  test('seeded candidates confirm and reject through refreshed factual state', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginClientWithSettledSession(page, CLIENT_JUAN_EMAIL);
    await pinLocalDemoData(page);
    const seeded = await seedCandidates(
      page,
      CLIENT_JUAN_ID,
      'Confirmable candidate fact from CV text.\nDiscardable candidate fact from CV text.'
    );
    expect(seeded.importedCount).toBeGreaterThanOrEqual(2);
    const [confirmId, rejectId] = seeded.ids;
    expect(confirmId).toBeTruthy();
    expect(rejectId).toBeTruthy();

    await openClientProfile(page);
    await expect(page.locator(`[data-testid="react-profile-fact-${confirmId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-profile-fact-${rejectId}"]`)).toBeVisible();

    await page.locator(`[data-testid="react-profile-confirm-${confirmId}"]`).click();
    await expect(page.locator('[data-testid="react-profile-success"]')).toContainText(
      'Fact confirmado',
      { timeout: 10_000 }
    );
    await expect(page.locator(`[data-testid="react-profile-fact-${confirmId}"]`)).toHaveAttribute(
      'data-fact-status',
      'confirmed'
    );

    await page.locator(`[data-testid="react-profile-reject-${rejectId}"]`).click();
    await expect(page.locator('[data-testid="react-profile-success"]')).toContainText(
      'Fact descartado',
      { timeout: 10_000 }
    );
    await expect(page.locator(`[data-testid="react-profile-fact-${rejectId}"]`)).toHaveCount(0);

    const facts = await profileFacts(page, CLIENT_JUAN_ID);
    expect(facts.find((fact) => fact.id === confirmId)?.status).toBe('confirmed');
    expect(facts.find((fact) => fact.id === rejectId)?.status).toBe('rejected');
  });

  test('CLIENT own edit succeeds and foreign client request fails closed', async ({ page }) => {
    test.setTimeout(90_000);
    await loginClientWithSettledSession(page, CLIENT_ELENA_EMAIL);
    await pinLocalDemoData(page);
    await openClientProfile(page);

    await page.locator('[data-testid="react-profile-add-career"]').click();
    await page.locator('[data-testid="react-profile-add-label-career"]').fill('PF E2E Cargo');
    await page.locator('[data-testid="react-profile-add-value-career"]').fill('Counsel original');
    await page.locator('[data-testid="react-profile-add-submit-career"]').click();
    await expect(page.locator('[data-testid="react-profile-success"]')).toContainText(
      'Fact añadido',
      { timeout: 10_000 }
    );

    const ownFacts = await profileFacts(page, CLIENT_ELENA_ID);
    const own = ownFacts.find((fact) => fact.label === 'PF E2E Cargo');
    expect(own?.id).toBeTruthy();

    await page.locator(`[data-testid="react-profile-edit-${own!.id}"]`).click();
    await page.locator(`[data-testid="react-profile-edit-value-${own!.id}"]`).fill('Counsel actualizado');
    await page.locator(`[data-testid="react-profile-edit-submit-${own!.id}"]`).click();
    await expect(page.locator('[data-testid="react-profile-success"]')).toContainText(
      'Fact actualizado',
      { timeout: 10_000 }
    );

    const refreshed = await profileFacts(page, CLIENT_ELENA_ID);
    expect(refreshed.find((fact) => fact.id === own!.id)?.value).toBe('Counsel actualizado');

    const foreign = await page.evaluate(async ({ foreignClientId, factId }) => {
      const { updateProfileFact } = await import('/src/services/masterProfileConsumer.ts');
      try {
        updateProfileFact({
          requestedClientId: foreignClientId,
          factId,
          value: 'should-not-write',
        });
        return { ok: true as const };
      } catch (err) {
        return {
          ok: false as const,
          message: err instanceof Error ? err.message : 'unknown',
          name: err instanceof Error ? err.name : 'unknown',
        };
      }
    }, { foreignClientId: CLIENT_JUAN_ID, factId: own!.id });

    expect(foreign.ok).toBe(false);
    expect(foreign.message).toBe('No puedes operar sobre otro cliente.');
    const juanFacts = await profileFacts(page, CLIENT_JUAN_ID);
    expect(juanFacts.some((fact) => fact.value === 'should-not-write')).toBe(false);
  });

  test('CV paste imports candidates locally and React profile controls remain', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const remoteHits: string[] = [];
    await loginClientWithSettledSession(page, CLIENT_JUAN_EMAIL);
    await pinLocalDemoData(page);
    page.on('request', (request) => {
      const url = request.url();
      if (/openai|anthropic|tavily/i.test(url)) {
        remoteHits.push(url);
      }
    });
    await openClientProfile(page);
    await page.locator('[data-testid="react-profile-cv-paste"]').fill(CV_PASTE);
    await page.locator('[data-testid="react-profile-cv-submit"]').click();
    await expect(page.locator('[data-testid="react-profile-success"]')).toContainText(
      /facts candidatos extraídos|No se encontraron facts nuevos/,
      { timeout: 10_000 }
    );

    const facts = await profileFacts(page, CLIENT_JUAN_ID);
    const imported = facts.filter(
      (fact) => fact.value === CV_LINE_A || fact.value === CV_LINE_B
    );
    expect(imported.length).toBeGreaterThanOrEqual(1);
    expect(imported.every((fact) => fact.status === 'candidate')).toBe(true);
    expect(remoteHits).toEqual([]);

    await expect(page.locator('[data-testid="react-profile-panel"]')).toBeVisible();
    for (const testId of [
      'react-profile-cv-paste',
      'react-profile-cv-submit',
      'react-profile-add-identity',
      'react-profile-add-career',
      'react-onboarding-wizard',
    ]) {
      await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible();
    }
  });
});
