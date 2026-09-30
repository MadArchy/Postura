/**
 * SPEC-009 client persistence scope — a canonical CLIENT mutation on an ADMIN-seeded
 * document persists to Firestore and is not reverted by unrelated snapshot documents.
 * Emulator only: the task is seeded with the emulator owner credential, never by the CLIENT.
 */
import { expect, test } from '@playwright/test';
import { assertLoopbackEmulatorHost, assertNonProductionFirebaseProjectForE2E } from '../src/firebase/productionGuard';
import { CLIENT_JUAN_ID, loginAsClientJuan } from './helpers/spec010Auth';
import { resolveE2EFirebaseEnv } from './support/globalSetup';

test.use({ channel: 'chrome' });

const ORG_ID = 'org_aurora_01';
const SEEDED_CREATED_AT = '2026-09-01T10:00:00Z';

type RestDoc = {
  fields?: Record<string, { stringValue?: string; timestampValue?: string }>;
  updateTime?: string;
};

function emulatorTarget() {
  const env = resolveE2EFirebaseEnv();
  assertNonProductionFirebaseProjectForE2E(
    { projectId: env.VITE_FIREBASE_PROJECT_ID, useEmulators: env.VITE_FIREBASE_USE_EMULATORS === 'true' },
    'clientPersistenceScope'
  );
  const host = assertLoopbackEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST, 'clientPersistenceScope');
  return `http://${host}/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

async function ownerGet(base: string, path: string): Promise<RestDoc & { documents?: Array<RestDoc & { name: string }> }> {
  const res = await fetch(`${base}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (!res.ok) throw new Error(`[owner GET] ${path}: HTTP ${res.status}`);
  return res.json();
}

async function seedAdminTask(base: string, taskId: string) {
  const str = (value: string) => ({ stringValue: value });
  const res = await fetch(`${base}/clients/${CLIENT_JUAN_ID}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        id: str(taskId),
        organizationId: str(ORG_ID),
        clientId: str(CLIENT_JUAN_ID),
        thesisId: str('thesis_juan_ip_ai_adoption'),
        type: str('SUBMIT_INFO'),
        title: str('W4 persistence proof task'),
        description: str('Seeded by the emulator owner as ADMIN-owned data.'),
        status: str('ASSIGNED'),
        estimatedMinutes: { integerValue: '5' },
        createdAt: { timestampValue: SEEDED_CREATED_AT },
        updatedAt: { timestampValue: SEEDED_CREATED_AT },
      },
    }),
  });
  if (!res.ok) throw new Error(`[owner seed] task ${taskId}: HTTP ${res.status}`);
}

test.describe('Client persistence scope — canonical CLIENT mutation persists', () => {
  test('transitionClientTask on an ADMIN-seeded task persists and is not reverted', async ({ page }) => {
    test.setTimeout(90_000);
    const base = emulatorTarget();
    const taskId = `task_w4_proof_${Date.now()}`;
    const taskPath = `clients/${CLIENT_JUAN_ID}/tasks/${taskId}`;
    await seedAdminTask(base, taskId);

    const results = await ownerGet(base, `clients/${CLIENT_JUAN_ID}/results`);
    const untouched = (results.documents ?? []).map((row) => ({ name: row.name, updateTime: row.updateTime }));
    expect(untouched.length).toBeGreaterThan(0);

    await loginAsClientJuan(page);
    const localStatus = () =>
      page.evaluate(async ({ id }) => {
        const { dbService } = await import('/src/services/db.ts');
        return dbService.getAllTasks().find((task) => task.id === id)?.status ?? null;
      }, { id: taskId });
    await expect.poll(localStatus, { timeout: 30_000 }).toBe('ASSIGNED');

    const command = await page.evaluate(async ({ cid, id }) => {
      const { transitionClientTask } = await import('/src/services/executionDeliveryConsumer.ts');
      return transitionClientTask({ requestedClientId: cid, taskId: id, intent: 'view' }).task.status;
    }, { cid: CLIENT_JUAN_ID, id: taskId });
    expect(command).toBe('VIEWED');

    const serverStatus = async () => (await ownerGet(base, taskPath)).fields?.status?.stringValue ?? null;
    await expect.poll(serverStatus, { timeout: 15_000 }).toBe('VIEWED');

    for (let sample = 0; sample < 8; sample += 1) {
      await page.waitForTimeout(500);
      expect(await localStatus(), `local status at +${(sample + 1) * 500}ms`).toBe('VIEWED');
    }

    const stored = await ownerGet(base, taskPath);
    expect(stored.fields?.status?.stringValue).toBe('VIEWED');
    expect(stored.fields?.title?.stringValue).toBe('W4 persistence proof task');
    expect(Date.parse(stored.fields?.createdAt?.timestampValue ?? '')).toBe(Date.parse(SEEDED_CREATED_AT));
    expect(Date.parse(stored.fields?.updatedAt?.timestampValue ?? '')).toBeGreaterThan(Date.parse(SEEDED_CREATED_AT));

    const resultsAfter = await ownerGet(base, `clients/${CLIENT_JUAN_ID}/results`);
    expect((resultsAfter.documents ?? []).map((row) => ({ name: row.name, updateTime: row.updateTime }))).toEqual(untouched);
  });
});
