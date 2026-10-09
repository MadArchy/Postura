/**
 * SPEC-010 · T603 React Parity Wave P7 — bounded ADMIN delivery send E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import { clientDocPath, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

async function seedDraftAdvicePackage(
  page: import('@playwright/test').Page,
  clientId: string
) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    for (const pkg of dbService.getDeliveriesByClient(cid)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }
    const pkg = dbService.ensureDraftDelivery(cid, 'user_admin_01');
    dbService.addDeliveryItem(pkg.id, {
      kind: 'ADVICE',
      title: 'P7 E2E briefing advice',
      rationale: 'Deterministic P7 send proof.',
    });
    return pkg.id;
  }, { cid: clientId });
}

test.describe('P7 — React delivery package send parity', () => {
  test('ADMIN sends prepared draft via React preview without #18 legacy handoff', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
      timeout: 15_000,
    });
    const packageId = await seedDraftAdvicePackage(page, CLIENT_JUAN_ID);
    // Refetch after seed so draftPackage projection is visible.
    await sidebarTab(page, 'ws-radar').click();
    await sidebarTab(page, 'ws-deliver').click();
    await expect(page.locator('[data-testid="react-ws-draft-package"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="react-ws-deliver-preview-send"]')).toBeEnabled();
    await expect(page.locator('[data-testid="react-delivery-preview-handoff"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="react-ws-deliver-handoff"]')).toHaveCount(0);

    await page.click('[data-testid="react-ws-deliver-preview-send"]');
    await expect(page.locator('[data-testid="react-delivery-preview-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-delivery-preview-send"]')).toBeVisible();
    await page.click('[data-testid="react-delivery-preview-send"]');
    await expect(page.locator('[data-testid="react-delivery-preview-confirm-send"]')).toBeVisible();
    await page.click('[data-testid="react-delivery-preview-confirm-send"]');

    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="react-ws-deliver-success"]')).toContainText(
      /Briefing enviado/i
    );

    const stored = await page.evaluate(async ({ pid, cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const pkg = dbService.getDeliveryById(pid);
      const draft = dbService.getDraftDelivery(cid);
      return {
        status: pkg?.status ?? null,
        sentAt: pkg?.sentAt ?? null,
        draftId: draft?.id ?? null,
      };
    }, { pid: packageId, cid: CLIENT_JUAN_ID });

    expect(stored.status).toBe('SENT');
    expect(stored.sentAt).toBeTruthy();
    expect(stored.draftId).toBeNull();

    await expect(page.locator('[data-testid="react-ws-draft-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-sent-list"]')).toContainText('SENT');

    const mode = await page.evaluate(() => localStorage.getItem('postura_ui_mode'));
    expect(mode).toBe('react');

    await waitForServerField(clientDocPath(CLIENT_JUAN_ID, 'deliveries', packageId), 'status', 'SENT');
  });
});
