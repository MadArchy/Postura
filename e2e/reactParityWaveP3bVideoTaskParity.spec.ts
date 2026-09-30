/**
 * SPEC-010 · T603 React Parity Wave P3B — bounded video/recording E2E.
 * Camera / MediaRecorder / remote Storage are mocked. Live devices not required.
 */

import { expect, test, type Page } from '@playwright/test';
import {
  CLIENT_JUAN_ID,
  enterClientWorkspaceFromShell,
  loginAsClientJuan,
  loginAsManager,
  sidebarTab,
} from './helpers/spec010Auth';
import {
  clientDocPath,
  ownerGetField,
  ownerSeedTask,
  waitForLocalDoc,
  waitForServerField,
} from './support/clientFixtures';

test.use({ channel: 'chrome' });

const P3B_TITLE = 'P3B video parity task';

/** CLIENT specs: the video task is ADMIN-owned and seeded by the emulator owner. */
async function ownerSeedVideoTask(title: string) {
  return ownerSeedTask({
    id: `task_p3b_e2e_${Date.now()}`,
    clientId: CLIENT_JUAN_ID,
    type: 'RECORD_VIDEO',
    title,
    description: 'P3B teleprompter parity.',
    scriptPayload: 'Guion P3B de prueba.',
  });
}

async function installMediaMocks(page: Page, denyCamera = false) {
  await page.addInitScript(
    ({ deny }) => {
      class FakeMediaRecorder {
        state = 'inactive';
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() {
          this.state = 'recording';
          queueMicrotask(() => {
            this.ondataavailable?.({
              data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'video/webm' }),
            });
          });
        }
        stop() {
          this.state = 'inactive';
          this.onstop?.();
        }
      }
      (FakeMediaRecorder as unknown as { isTypeSupported: (type: string) => boolean }).isTypeSupported =
        () => true;
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder });

      const media = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          ...media,
          getUserMedia: async () => {
            if (deny) throw new DOMException('Permission denied', 'NotAllowedError');
            const track = {
              kind: 'video',
              stop: () => undefined,
            };
            return {
              getTracks: () => [track],
              getVideoTracks: () => [track],
              getAudioTracks: () => [],
            } as unknown as MediaStream;
          },
        },
      });
    },
    { deny: denyCamera }
  );
}

async function installIndexedDbPersist(page: Page) {
  await page.evaluate(async () => {
    const rec = await import('/src/services/recordings.ts');
    const ui = (
      window as unknown as {
        __posturaUi?: {
          persistRecording?: (
            organizationId: string,
            clientId: string,
            taskId: string,
            blob: Blob
          ) => Promise<string>;
        };
      }
    ).__posturaUi;
    if (!ui) throw new Error('Strangler controls are unavailable');
    ui.persistRecording = async (_organizationId, _clientId, taskId, blob) => {
      await rec.saveRecording(taskId, blob);
      return `${rec.RECORDING_REF_PREFIX}${taskId}`;
    };
  });
}

async function seedVideoTask(page: Page, title: string) {
  return page.evaluate(
    async ({ clientId, taskTitle }) => {
      const { dbService } = await import('/src/services/db.ts');
      const existing = dbService
        .getTasksForClient(clientId)
        .find((task) => task.type === 'RECORD_VIDEO' && task.title === taskTitle);
      if (existing) return existing.id;
      return dbService.addTask({
        organizationId: 'org_aurora_01',
        clientId,
        thesisId: 'thesis_juan_ip_ai_adoption',
        type: 'RECORD_VIDEO',
        title: taskTitle,
        description: 'P3B teleprompter parity.',
        estimatedMinutes: 10,
        status: 'ASSIGNED',
        scriptPayload: 'Guion P3B de prueba.',
      }).id;
    },
    { clientId: CLIENT_JUAN_ID, taskTitle: title }
  );
}

test.describe('P3B — React video task and recordings', () => {
  test('CLIENT records and completes via React teleprompter', async ({ page }) => {
    test.setTimeout(90_000);
    const taskId = await ownerSeedVideoTask(P3B_TITLE);
    const taskPath = clientDocPath(CLIENT_JUAN_ID, 'tasks', taskId);
    await installMediaMocks(page);
    await loginAsClientJuan(page);
    await installIndexedDbPersist(page);
    await waitForLocalDoc(page, 'task', taskId);
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });

    const open = page.locator(`[data-testid="react-portal-task-open-video-${taskId}"]`);
    await expect(open).toBeVisible({ timeout: 15_000 });
    await open.click();
    await expect(page.locator('[data-testid="react-teleprompter-modal"]')).toBeVisible();

    const before = await page.evaluate(async ({ id }) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.getAllTasks().find((row) => row.id === id)?.status ?? null;
    }, { id: taskId });
    expect(before).toBe('ASSIGNED');

    await page.locator('[data-testid="react-teleprompter-record"]').click();
    await expect
      .poll(async () => {
        return page.evaluate(async ({ id }) => {
          const { dbService } = await import('/src/services/db.ts');
          return dbService.getAllTasks().find((row) => row.id === id)?.status ?? null;
        }, { id: taskId });
      })
      .toBe('IN_PROGRESS');
    // Server must confirm IN_PROGRESS before send: rapid steps can merge into one push the rules reject.
    await waitForServerField(taskPath, 'status', 'IN_PROGRESS');

    await page.locator('[data-testid="react-teleprompter-stop"]').click();
    await expect(page.locator('[data-testid="react-teleprompter-send"]')).toBeVisible();
    await page.locator('[data-testid="react-teleprompter-send"]').click();

    await expect
      .poll(async () => {
        return page.evaluate(async ({ id }) => {
          const { dbService } = await import('/src/services/db.ts');
          const task = dbService.getAllTasks().find((row) => row.id === id);
          return task ? { status: task.status, evidence: Boolean(task.evidenceUrl) } : null;
        }, { id: taskId });
      }, { timeout: 15_000 })
      .toEqual({ status: 'COMPLETED', evidence: true });
    await waitForServerField(taskPath, 'status', 'COMPLETED');
    expect(await ownerGetField(taskPath, 'evidenceUrl')).toBeTruthy();
  });

  test('ADMIN re-uploads recording via attach_evidence', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);
    await installIndexedDbPersist(page);
    const taskId = await seedVideoTask(page, `${P3B_TITLE} reupload`);
    await page.evaluate(
      async ({ id, clientId }) => {
        const rec = await import('/src/services/recordings.ts');
        const { transitionClientTask } = await import('/src/services/executionDeliveryConsumer.ts');
        const blob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'video/webm' });
        await rec.saveRecording(id, blob);
        transitionClientTask({
          requestedClientId: clientId,
          taskId: id,
          intent: 'attach_evidence',
          evidenceUrl: `${rec.RECORDING_REF_PREFIX}${id}`,
          clientNotes: 'seed P3B',
        });
      },
      { id: taskId, clientId: CLIENT_JUAN_ID }
    );

    await sidebarTab(page, 'ws-tasks').click();
    await expect(page.locator('[data-testid="react-ws-tasks"]')).toBeVisible({ timeout: 15_000 });
    await sidebarTab(page, 'ws-radar').click();
    await sidebarTab(page, 'ws-tasks').click();
    await expect(page.locator(`[data-testid="react-ws-task-recording-${taskId}"]`)).toBeVisible({
      timeout: 15_000,
    });

    const input = page.locator(`[data-testid="react-ws-task-recording-reupload-${taskId}"]`);
    await input.setInputFiles({
      name: 'p3b-retake.webm',
      mimeType: 'video/webm',
      buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]),
    });

    await expect(page.locator(`[data-testid="react-ws-task-recording-msg-${taskId}"]`)).toContainText(
      'Video actualizado',
      { timeout: 15_000 }
    );
  });

  test('camera denial does not mutate the task', async ({ page }) => {
    test.setTimeout(90_000);
    const taskId = await ownerSeedVideoTask(`${P3B_TITLE} denied`);
    const taskPath = clientDocPath(CLIENT_JUAN_ID, 'tasks', taskId);
    await installMediaMocks(page, true);
    await loginAsClientJuan(page);
    await waitForLocalDoc(page, 'task', taskId);
    await sidebarTab(page, 'client-home').click();
    await expect(page.locator('[data-testid="react-portal-tasks"]')).toBeVisible({ timeout: 15_000 });
    await page.locator(`[data-testid="react-portal-task-open-video-${taskId}"]`).click();
    await expect(page.locator('[data-testid="react-teleprompter-modal"]')).toBeVisible();
    await page.locator('[data-testid="react-teleprompter-record"]').click();
    await expect(page.locator('[data-testid="react-teleprompter-modal"]')).toContainText(
      'No se pudo acceder a la cámara'
    );

    const status = await page.evaluate(async ({ id }) => {
      const { dbService } = await import('/src/services/db.ts');
      return dbService.getAllTasks().find((row) => row.id === id)?.status ?? null;
    }, { id: taskId });
    expect(status).toBe('ASSIGNED');
    expect(await ownerGetField(taskPath, 'status')).toBe('ASSIGNED');
  });

  test('legacy teleprompter remains reachable after rollback', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManager(page);
    await enterClientWorkspaceFromShell(page);

    await page.locator('[data-testid="react-shell-to-legacy"]').click();
    await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#react-root')).toBeHidden();

    await page.evaluate(async ({ clientId }) => {
      const ui = (
        window as unknown as {
          __posturaUi?: {
            applyUiMode: (mode: 'legacy' | 'react') => Promise<void>;
            mountLegacyIsland: (el: HTMLElement, config: { tab: string; clientId: string }) => void;
          };
        }
      ).__posturaUi;
      if (!ui?.applyUiMode || !ui.mountLegacyIsland) {
        throw new Error('Strangler controls are unavailable');
      }
      await ui.applyUiMode('legacy');
      let host = document.getElementById('p3b-legacy-tasks');
      if (!host) {
        host = document.createElement('div');
        host.id = 'p3b-legacy-tasks';
        document.body.appendChild(host);
      }
      ui.mountLegacyIsland(host, { tab: 'ws-tasks', clientId });
    }, { clientId: CLIENT_JUAN_ID });

    await expect(page.locator('[data-legacy-island="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.btn-open-teleprompter, .btn-open-task-action').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator('.btn-open-teleprompter, .btn-open-task-action[data-task-id="task_001"]').first().click();
    await expect(page.locator('#teleprompter-modal, #btn-start-recording').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
