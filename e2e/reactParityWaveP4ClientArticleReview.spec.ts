/**
 * SPEC-010 · T603 React Parity Wave P4 — bounded client article-review E2E.
 * Content and review task are ADMIN-owned and seeded by the emulator owner before CLIENT
 * login. The content carries canonical `pipelineStatus: 'sent_to_client'`.
 */
import { expect, test } from '@playwright/test';
import { CLIENT_JUAN_ID, loginAsClientJuan, sidebarTab } from './helpers/spec010Auth';
import {
  clientDocPath,
  ownerGetField,
  ownerSeedContent,
  ownerSeedTask,
  waitForLocalDoc,
  waitForServerField,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

const P4_ARTICLE_TITLE = 'P4 article parity draft';
const P4_ARTICLE_BODY = 'Borrador P4 para revisión nativa en React.';

test.describe('P4 — React client portal article review', () => {
  test('CLIENT reviews article natively; video handoff and generic tasks remain', async ({ page }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const contentId = await ownerSeedContent({
      id: `cnt_p4_e2e_${stamp}`,
      clientId: CLIENT_JUAN_ID,
      title: P4_ARTICLE_TITLE,
      body: P4_ARTICLE_BODY,
      type: 'LINKEDIN_ARTICLE',
      targetPlatform: 'LinkedIn',
      status: 'CLIENT_REVIEW',
      pipelineStatus: 'sent_to_client',
      clientReviewBaseline: P4_ARTICLE_BODY,
    });
    const taskId = await ownerSeedTask({
      id: `task_p4_e2e_${stamp}`,
      clientId: CLIENT_JUAN_ID,
      type: 'REVIEW_ARTICLE',
      title: 'Revisar artículo P4',
      description: 'Paridad React #32',
      estimatedMinutes: 20,
      contentItemId: contentId,
    });
    const contentPath = clientDocPath(CLIENT_JUAN_ID, 'contents', contentId);
    const taskPath = clientDocPath(CLIENT_JUAN_ID, 'tasks', taskId);

    await loginAsClientJuan(page);
    await waitForLocalDoc(page, 'content', contentId);
    await waitForLocalDoc(page, 'task', taskId);

    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    const articleOpen = page.locator(`[data-testid="react-portal-article-task-open-${taskId}"]`);
    await expect(articleOpen).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="react-portal-content-handoff"]')).toHaveCount(0);
    await expect(page.locator(`[data-testid="react-portal-task-handoff-article-${taskId}"]`)).toHaveCount(0);

    await articleOpen.click();
    await expect(page.locator('[data-testid="react-portal-article-review"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.fill('[data-testid="react-portal-article-review-title"]', `${P4_ARTICLE_TITLE} editado`);
    await page.fill(
      '[data-testid="react-portal-article-review-body"]',
      'Borrador P4 editado por el cliente en React nativo.'
    );
    await page.click('[data-testid="react-portal-article-review-save"]');
    await expect(page.locator('[data-testid="react-portal-article-review-success"]')).toBeVisible({
      timeout: 15_000,
    });
    await waitForServerField(contentPath, 'title', `${P4_ARTICLE_TITLE} editado`);

    await page.click('[data-testid="react-portal-article-review-approve"]');
    await expect(page.locator('[data-testid="react-portal-article-review-success"]')).toContainText(
      /aprobado/i,
      { timeout: 15_000 }
    );
    await waitForServerField(contentPath, 'pipelineStatus', 'client_submitted');
    await waitForServerField(taskPath, 'status', 'COMPLETED');
    expect(await ownerGetField(contentPath, 'status')).toBe('CLIENT_APPROVED');

    const stored = await page.evaluate(async ({ cid, tid }) => {
      const { dbService } = await import('/src/services/db.ts');
      const content = dbService.getContentById(cid);
      const task = dbService.getAllTasks().find((row) => row.id === tid);
      return {
        contentStatus: content?.status,
        contentPipeline: content?.pipelineStatus,
        contentTitle: content?.title,
        taskStatus: task?.status,
      };
    }, { cid: contentId, tid: taskId });

    expect(stored).toEqual({
      contentStatus: 'CLIENT_APPROVED',
      contentPipeline: 'client_submitted',
      contentTitle: `${P4_ARTICLE_TITLE} editado`,
      taskStatus: 'COMPLETED',
    });

    await page.click('[data-testid="react-portal-article-review-close"]');
    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toBeVisible();
    await expect(page.locator('[data-testid="react-portal-task-handoff-video-task_001"]')).toContainText(
      'teleprompter'
    );
  });
});
