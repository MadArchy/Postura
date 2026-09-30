/**
 * SPEC-010 · T603 React Parity Wave P6 — bounded client onboarding write E2E.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';
import { waitForOnboardingHydration } from './support/clientFixtures';

test.use({ channel: 'chrome' });

test.describe('P6 — React client onboarding write parity', () => {
  test('CLIENT saves onboarding step via ApplyOnboardingStep without global legacy', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAsClientJuan(page);
    await sidebarTab(page, 'client-home').click();
    // Step form defaults are captured at mount; hydrate before the wizard first renders.
    await waitForOnboardingHydration(page, CLIENT_JUAN_ID);

    await sidebarTab(page, 'client-profile').click();
    await expect(page.locator('[data-testid="react-onboarding-wizard"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-onboarding-save"]')).toBeEnabled();
    await expect(page.locator('[data-testid="react-onboarding-save-disabled"]')).toHaveCount(0);

    // Resume / jump: open step 1 explicitly and persist a canonical field change.
    await page.locator('.onboarding-coverage-chip').first().click();
    await expect(page.locator('[data-testid="react-onboarding-form"]')).toHaveAttribute(
      'data-onboarding-step',
      '1'
    );

    const marker = `P6 E2E ${Date.now()}`;
    await page.fill('#react-onb-selfDescription', marker);
    await page.click('[data-testid="react-onboarding-save"]');

    await expect(page.locator('[data-testid="react-onboarding-success"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="react-onboarding-success"]')).toContainText(
      /Paso guardado/i
    );

    const stored = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const profile = dbService.getMasterProfile(cid);
      return profile
        ? {
            selfDescription: profile.identity?.selfDescription ?? null,
            step: profile.onboardingCurrentStep ?? null,
          }
        : null;
    }, { cid: CLIENT_JUAN_ID });

    expect(stored?.selfDescription).toBe(marker);
    expect(stored?.step).toBe(1);

    // Presentation next after success — wizard advances locally.
    await expect(page.locator('[data-testid="react-onboarding-form"]')).toHaveAttribute(
      'data-onboarding-step',
      '2'
    );

    // Finalization path: jump to step 6 and complete via frozen command.
    await page.locator('.onboarding-coverage-chip').nth(5).click();
    await expect(page.locator('[data-testid="react-onboarding-form"]')).toHaveAttribute(
      'data-onboarding-step',
      '6'
    );
    await page.selectOption('#react-onb-tone', 'authoritative');
    await page.fill('#react-onb-topicsToAvoid', 'Hype vacío, promesas de resultados');
    await page.fill('#react-onb-complianceGuidelines', 'State Bar confidentiality — P6');
    await page.click('[data-testid="react-onboarding-save"]');

    // Presentation-owned post-complete hop unmounts the wizard — assert nav + persisted state.
    await expect(page.locator('.sidebar-link[data-tab="client-thesis"].active')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="react-portal-thesis"]')).toBeVisible({
      timeout: 10_000,
    });

    const completed = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const profile = dbService.getMasterProfile(cid);
      const client = dbService.getClientById(cid);
      return {
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        onboardingStatus: client?.onboardingStatus ?? null,
        compliance: profile?.voicePreferences?.complianceGuidelines ?? null,
      };
    }, { cid: CLIENT_JUAN_ID });

    expect(completed).toEqual({
      onboardingCompleted: true,
      onboardingStatus: 'COMPLETED',
      compliance: 'State Bar confidentiality — P6',
    });

    const mode = await page.evaluate(() => localStorage.getItem('postura_ui_mode'));
    expect(mode).toBe('react');
  });
});
