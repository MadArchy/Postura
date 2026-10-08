/**
 * CLIENT E2E fixtures — emulator-only OWNER seeding, server reads, and readiness waits.
 *
 * ADMIN-owned documents are written with the Firestore emulator owner credential before
 * the CLIENT acts; the browser CLIENT session never creates them. No production command
 * logic lives here: CLIENT actions still run through the app's canonical commands.
 */
import { expect, type Page } from '@playwright/test';
import { assertLoopbackEmulatorHost, assertNonProductionFirebaseProjectForE2E } from '../../src/firebase/productionGuard';
import {
  CLIENT_PASSWORD,
  enableReactMode,
  waitForAuthenticatedClientProjection,
} from '../helpers/spec010Auth';
import { resolveE2EFirebaseEnv } from './globalSetup';

export const FIXTURE_ORG_ID = 'org_aurora_01';
export const FIXTURE_JUAN_THESIS_ID = 'thesis_juan_ip_ai_adoption';

/** Firestore fields that the app stores as timestamps. */
const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt', 'sentAt', 'acknowledgedAt', 'completedAt']);

type FirestoreRestValue = Record<string, unknown>;
type RestField = { stringValue?: string; timestampValue?: string; mapValue?: { fields?: RestFields } };
type RestFields = Record<string, RestField>;
type RestDoc = { fields?: RestFields };

function emulatorDocumentsBase(): string {
  const env = resolveE2EFirebaseEnv();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  assertNonProductionFirebaseProjectForE2E(
    { projectId, useEmulators: env.VITE_FIREBASE_USE_EMULATORS === 'true' },
    'clientFixtures'
  );
  const host = assertLoopbackEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST, 'clientFixtures');
  return `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
}

function toRestValue(value: unknown, key = ''): FirestoreRestValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') {
    return TIMESTAMP_FIELDS.has(key) ? { timestampValue: value } : { stringValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map((entry) => toRestValue(entry)) } };
  return { mapValue: { fields: toRestFields(value as Record<string, unknown>) } };
}

function toRestFields(data: Record<string, unknown>): Record<string, FirestoreRestValue> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toRestValue(value, key)]));
}

/** OWNER write of one complete document (emulator only). */
export async function ownerSeedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${emulatorDocumentsBase()}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: toRestFields(data) }),
  });
  if (!res.ok) throw new Error(`[clientFixtures] owner seed ${path}: HTTP ${res.status}`);
}

/**
 * OWNER read of one string field; `null` when the doc or field is absent or not a string.
 * A dotted `field` (`routingDecision.routingState`) descends through nested map fields only.
 */
export async function ownerGetField(path: string, field: string): Promise<string | null> {
  const res = await fetch(`${emulatorDocumentsBase()}/${path}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`[clientFixtures] owner GET ${path}: HTTP ${res.status}`);
  const doc = (await res.json()) as RestDoc;
  const segments = field.split('.');
  const leaf = segments.pop()!;
  let fields = doc.fields;
  for (const segment of segments) {
    fields = fields?.[segment]?.mapValue?.fields;
  }
  return fields?.[leaf]?.stringValue ?? null;
}

/** Waits until the emulator holds `expected` for `field` (authoritative server confirmation). */
export async function waitForServerField(path: string, field: string, expected: string, timeout = 15_000) {
  await expect.poll(() => ownerGetField(path, field), { timeout, message: `${path}.${field}` }).toBe(expected);
}

export function clientDocPath(clientId: string, sub: string, id: string): string {
  return `clients/${clientId}/${sub}/${id}`;
}

function fixtureTimestamps() {
  const at = new Date(Date.now() - 60_000).toISOString();
  return { createdAt: at, updatedAt: at };
}

export type SeedTask = {
  id: string;
  clientId: string;
  type: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  thesisId?: string;
} & Record<string, unknown>;

/** OWNER seed of an ASSIGNED task with its full tenant envelope. */
export async function ownerSeedTask(task: SeedTask): Promise<string> {
  await ownerSeedDoc(clientDocPath(task.clientId, 'tasks', task.id), {
    organizationId: FIXTURE_ORG_ID,
    thesisId: FIXTURE_JUAN_THESIS_ID,
    description: 'E2E fixture task seeded by the emulator owner.',
    estimatedMinutes: 10,
    status: 'ASSIGNED',
    ...fixtureTimestamps(),
    ...task,
  });
  return task.id;
}

/** OWNER seed of a content item with its full tenant envelope. */
export async function ownerSeedContent(content: { id: string; clientId: string } & Record<string, unknown>) {
  await ownerSeedDoc(clientDocPath(content.clientId, 'contents', content.id), {
    organizationId: FIXTURE_ORG_ID,
    thesisId: FIXTURE_JUAN_THESIS_ID,
    ...fixtureTimestamps(),
    ...content,
  });
  return content.id;
}

/** OWNER seed of a delivery package with its full tenant envelope. */
export async function ownerSeedDelivery(delivery: { id: string; clientId: string } & Record<string, unknown>) {
  await ownerSeedDoc(clientDocPath(delivery.clientId, 'deliveries', delivery.id), {
    organizationId: FIXTURE_ORG_ID,
    createdBy: 'user_admin_01',
    ...fixtureTimestamps(),
    ...delivery,
  });
  return delivery.id;
}

export type LocalDocKind = 'task' | 'content' | 'delivery';

/** Waits until a seeded document is present in the browser's hydrated local state. */
export async function waitForLocalDoc(page: Page, kind: LocalDocKind, id: string, timeout = 30_000) {
  await expect
    .poll(
      () =>
        page.evaluate(
          async ({ docKind, docId }) => {
            const { dbService } = await import('/src/services/db.ts');
            if (docKind === 'task') return dbService.getAllTasks().some((task) => task.id === docId);
            if (docKind === 'content') return Boolean(dbService.getContentById(docId));
            return Boolean(dbService.getDeliveryById(docId));
          },
          { docKind: kind, docId: id }
        ),
      { timeout, message: `local ${kind} ${id}` }
    )
    .toBe(true);
}

/**
 * Onboarding readiness: the CLIENT projection is hydrated and the onboarding read exposes
 * identity data. Must complete before the wizard's step form first mounts.
 */
export async function waitForOnboardingHydration(page: Page, clientId: string) {
  await waitForAuthenticatedClientProjection(page, clientId);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const { readOnboardingContext } = await import('/src/ui/data/compatibilityReads.ts');
          const { authService } = await import('/src/services/auth.ts');
          const user = authService.getCurrentUser();
          if (!user?.clientId) return false;
          const context = readOnboardingContext({
            organizationId: user.organizationId,
            clientId: user.clientId,
            role: user.role,
            uid: user.uid,
          } as Parameters<typeof readOnboardingContext>[0]);
          return Boolean(context.displayName.trim() && context.profession.trim());
        }),
      { timeout: 30_000, message: 'onboarding context hydrated' }
    )
    .toBe(true);
}

type SessionSyncObservation = { calls: number; inflight: number };

/**
 * CLIENT login with a pass-through observer on `authService.syncFirestoreSession`, then
 * waits until the session is settled: both post-login syncs (login + auth listener) ran and
 * none is in flight. The observer never alters or skips a sync.
 */
export async function loginClientWithSettledSession(page: Page, email: string, password = CLIENT_PASSWORD) {
  await enableReactMode(page);
  await page.evaluate(async () => {
    const { authService } = await import('/src/services/auth.ts');
    const observation: SessionSyncObservation = { calls: 0, inflight: 0 };
    (window as unknown as { __e2eSessionSync: SessionSyncObservation }).__e2eSessionSync = observation;
    const target = authService as unknown as { syncFirestoreSession: (user: unknown) => Promise<void> };
    const original = target.syncFirestoreSession.bind(authService);
    target.syncFirestoreSession = async (user: unknown) => {
      observation.calls += 1;
      observation.inflight += 1;
      try {
        return await original(user);
      } finally {
        observation.inflight -= 1;
      }
    };
  });
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  await page.fill('#react-login-email', email);
  await page.fill('#react-login-password', password);
  await page.click('[data-testid="react-login-submit"]');
  await expect(page.locator('[data-testid="react-login"]')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const observation = (window as unknown as { __e2eSessionSync: SessionSyncObservation }).__e2eSessionSync;
          return observation.calls >= 2 && observation.inflight === 0;
        }),
      { timeout: 30_000, message: 'session sync settled' }
    )
    .toBe(true);
}
