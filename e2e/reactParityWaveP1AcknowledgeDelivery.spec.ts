/**
 * SPEC-010 · T603 React Parity Wave P1 — bounded client delivery acknowledgement E2E.
 * The SENT briefing is ADMIN-owned and seeded by the emulator owner before CLIENT login.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';
import {
  clientDocPath,
  ownerSeedDelivery,
  waitForLocalDoc,
  waitForServerField,
  ownerGetField,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

test.describe('P1 §25 — React client portal acknowledge delivery', () => {
  test('CLIENT acknowledges latest SENT briefing under React shell', async ({ page }) => {
    test.setTimeout(60_000);
    const deliveryId = `pkg_p1_e2e_${Date.now()}`;
    const deliveryPath = clientDocPath(CLIENT_JUAN_ID, 'deliveries', deliveryId);
    await ownerSeedDelivery({
      id: deliveryId,
      clientId: CLIENT_JUAN_ID,
      title: 'P1 E2E briefing',
      strategicNote: 'Deterministic P1 acknowledgement proof.',
      periodLabel: 'P1 E2E',
      status: 'SENT',
      sentAt: new Date(Date.now() + 3_600_000).toISOString(),
      items: [
        {
          id: `${deliveryId}_item`,
          kind: 'ADVICE',
          title: 'P1 E2E briefing advice',
          rationale: 'Deterministic P1 acknowledgement proof.',
        },
      ],
    });

    await loginAsClientJuan(page);
    await waitForLocalDoc(page, 'delivery', deliveryId);
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-briefing-card"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-portal-briefing-ack"]')).toBeVisible({ timeout: 15_000 });
    await page.fill('[data-testid="react-portal-briefing-note"]', 'Lo reviso esta semana');
    await page.click('[data-testid="react-portal-briefing-ack"]');
    await expect(page.locator('[data-testid="react-portal-briefing-success"]')).toHaveText(
      'Briefing marcado como visto'
    );
    await expect(page.locator('[data-testid="react-portal-briefing-ack"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-portal-briefing-read"]')).toBeVisible();

    await waitForServerField(deliveryPath, 'status', 'ACKNOWLEDGED');
    expect(await ownerGetField(deliveryPath, 'clientAckNote')).toBe('Lo reviso esta semana');

    const stored = await page.evaluate(async ({ id }) => {
      const { dbService } = await import('/src/services/db.ts');
      const pkg = dbService.getDeliveryById(id);
      return pkg ? { status: pkg.status, clientAckNote: pkg.clientAckNote ?? null } : null;
    }, { id: deliveryId });
    expect(stored).toEqual({ status: 'ACKNOWLEDGED', clientAckNote: 'Lo reviso esta semana' });
  });
});
