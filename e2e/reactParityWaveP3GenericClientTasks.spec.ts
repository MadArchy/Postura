/**
 * SPEC-010 · T603 React Parity Wave P3A — bounded generic client task E2E.
 * The task is ADMIN-owned and seeded by the emulator owner before CLIENT login.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';
import { clientDocPath, ownerSeedTask, waitForLocalDoc, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

const P3A_TASK_TITLE = 'P3A generic parity task';

test.describe('P3A — React client portal generic task actions', () => {
  test('CLIENT completes generic task natively; video keeps legacy handoff', async ({ page }) => {
    test.setTimeout(60_000);
    const taskId = await ownerSeedTask({
      id: `task_p3a_e2e_${Date.now()}`,
      clientId: CLIENT_JUAN_ID,
      type: 'SUBMIT_INFO',
      title: P3A_TASK_TITLE,
      description: 'Tarea genérica para prueba de paridad React.',
    });
    const taskPath = clientDocPath(CLIENT_JUAN_ID, 'tasks', taskId);

    await loginAsClientJuan(page);
    await waitForLocalDoc(page, 'task', taskId);
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    const genericRow = page.locator(`[data-testid="react-portal-task-row-${taskId}"]`);
    await expect(genericRow).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-testid="react-portal-task-complete-${taskId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-portal-task-request-changes-${taskId}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="react-portal-task-view-${taskId}"]`)).toBeVisible();

    // View then complete inside one debounce window: persistence must keep VIEWED as its own edge.
    await page.click(`[data-testid="react-portal-task-view-${taskId}"]`);
    await page.click(`[data-testid="react-portal-task-complete-${taskId}"]`);
    await expect(genericRow).toHaveCount(0, { timeout: 15_000 });
    await waitForServerField(taskPath, 'status', 'COMPLETED');

    const stored = await page.evaluate(async ({ id }) => {
      const { dbService } = await import('/src/services/db.ts');
      const task = dbService.getAllTasks().find((row) => row.id === id);
      return task ? { status: task.status } : null;
    }, { id: taskId });

    expect(stored).toEqual({ status: 'COMPLETED' });

    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toContainText(
      'teleprompter'
    );
  });
});
