/**
 * SPEC-010 · T603 React Parity Wave P8 — bounded ADMIN task assign/cancel E2E.
 */
import { expect, test } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  openManagerWorkspace,
  sidebarTab,
} from './helpers/spec010Auth';
import { clientDocPath, waitForServerField } from './support/clientFixtures';

test.use({ channel: 'chrome' });

test.describe('P8 — React admin task assign/cancel parity', () => {
  test('ADMIN assigns and cancels via TasksPanel without #27 legacy handoff text', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openManagerWorkspace(page);
    await sidebarTab(page, 'ws-tasks').click();
    await expect(page.locator('[data-testid="react-ws-tasks"]')).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator('[data-testid="react-ws-tasks-handoff"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-ws-tasks-handoff"]')).toContainText(
      'gestionar grabaciones'
    );
    await expect(page.locator('[data-testid="react-ws-tasks-handoff"]')).not.toContainText(
      'asignar tareas'
    );

    const thesisId = await page.evaluate(async ({ cid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const active = dbService.getActiveTheses(cid);
      return active[0]?.id ?? null;
    }, { cid: CLIENT_JUAN_ID });
    expect(thesisId).toBeTruthy();

    await page.locator('[data-testid="react-ws-tasks-open-assign"]').click();
    await expect(page.locator('[data-testid="react-ws-tasks-assign-form"]')).toBeVisible();
    await page.locator('[data-testid="react-ws-tasks-thesis"]').selectOption(thesisId!);
    const title = `P8 E2E tarea ${Date.now()}`;
    await page.locator('[data-testid="react-ws-tasks-title"]').fill(title);
    await page
      .locator('[data-testid="react-ws-tasks-description"]')
      .fill('Instrucciones deterministas P8.');
    await page.locator('[data-testid="react-ws-tasks-type"]').selectOption('SUBMIT_INFO');
    await page.locator('[data-testid="react-ws-tasks-minutes"]').fill('15');
    await page.locator('[data-testid="react-ws-tasks-assign-submit"]').click();

    await expect(page.locator('[data-testid="react-ws-tasks-success"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="react-ws-task-list"]')).toContainText(title);

    const taskId = await page.evaluate(
      async ({ cid, taskTitle }) => {
        const { dbService } = await import('/src/services/db.ts');
        const task = dbService
          .getTasksByClient(cid)
          .find((t) => t.title === taskTitle && t.status !== 'CANCELLED');
        return task?.id ?? null;
      },
      { cid: CLIENT_JUAN_ID, taskTitle: title }
    );
    expect(taskId).toBeTruthy();

    const taskPath = clientDocPath(CLIENT_JUAN_ID, 'tasks', taskId!);
    await waitForServerField(taskPath, 'status', 'ASSIGNED');
    await waitForServerField(taskPath, 'title', title);

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator(`[data-testid="react-ws-task-cancel-${taskId}"]`).click();
    await expect(page.locator('[data-testid="react-ws-tasks-success"]')).toContainText(
      'Tarea cancelada'
    );

    const status = await page.evaluate(
      async ({ id }) => {
        const { dbService } = await import('/src/services/db.ts');
        return dbService.getAllTasks().find((t) => t.id === id)?.status ?? null;
      },
      { id: taskId }
    );
    expect(status).toBe('CANCELLED');
    await waitForServerField(taskPath, 'status', 'CANCELLED');

    await expect(page.locator('[data-testid="react-portal-task-handoff-video"]')).toHaveCount(0);
  });
});
