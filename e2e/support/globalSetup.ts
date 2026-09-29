/**
 * Playwright global setup — Firebase production-safety boundary for all E2E.
 *
 * 1. Validates the effective Vite `test` Firebase target (non-production, emulators on).
 * 2. Requires the Firebase Emulator Suite (`firebase emulators:exec`) on loopback.
 * 3. Resets emulator data, seeds Auth users with POSTURA claims, and writes the app's
 *    built-in seed to Firestore through the app's own import — all inside the emulator.
 * 4. Fails if the browser requests any production Firebase host.
 */
import { fileURLToPath } from 'node:url';
import { chromium, type FullConfig } from '@playwright/test';
import { loadEnv } from 'vite';
import {
  PRODUCTION_FIREBASE_HOSTS,
  assertLoopbackEmulatorHost,
  assertNonProductionFirebaseProjectForE2E,
  isProductionFirebaseProject,
} from '../../src/firebase/productionGuard';
import { resetFirebaseEmulators } from './emulatorReset';
import {
  CLIENT_ELENA_EMAIL,
  CLIENT_ELENA_ID,
  CLIENT_JUAN_EMAIL,
  CLIENT_JUAN_ID,
  CLIENT_PASSWORD,
  MANAGER_EMAIL,
  MANAGER_PASSWORD,
  UI_MODE_KEY,
} from '../helpers/spec010Auth';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEMO_ORG_ID = 'org_aurora_01';

/** Effective `import.meta.env` Vite resolves for `--mode test` (files + process env). */
export function resolveE2EFirebaseEnv(): Record<string, string> {
  const env = loadEnv('test', REPO_ROOT, 'VITE_');
  assertNonProductionFirebaseProjectForE2E(
    { projectId: env.VITE_FIREBASE_PROJECT_ID, useEmulators: env.VITE_FIREBASE_USE_EMULATORS === 'true' },
    'Playwright config'
  );
  return env;
}

/** Chromium never resolves live Firebase hosts during E2E. */
export const E2E_CHROMIUM_ARGS = [
  `--host-resolver-rules=${PRODUCTION_FIREBASE_HOSTS.map((host) => `MAP ${host} ~NOTFOUND`).join(', ')}`,
];

function isProductionFirebaseUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return PRODUCTION_FIREBASE_HOSTS.some((host) =>
    host.startsWith('*.') ? hostname.endsWith(host.slice(1)) : hostname === host
  );
}

function requireEmulatorEnvironment(projectId: string) {
  const firestoreHost = assertLoopbackEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST, 'Playwright global setup');
  const authHost = assertLoopbackEmulatorHost(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Playwright global setup');
  const emulatorProject = process.env.GCLOUD_PROJECT?.trim();
  if (isProductionFirebaseProject(emulatorProject) || (emulatorProject && emulatorProject !== projectId)) {
    throw new Error(
      `[Playwright global setup] Emulator project "${emulatorProject}" does not match E2E project "${projectId}". Aborting.`
    );
  }
  return { firestoreHost, authHost };
}

async function seedAuthUser(
  authHost: string,
  projectId: string,
  user: { email: string; password: string; displayName: string; claims: Record<string, string | null> }
) {
  const base = `http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}`;
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
  const created = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    }),
  });
  if (!created.ok) throw new Error(`[Emulator seed] create ${user.email} failed: HTTP ${created.status}`);
  const { localId } = (await created.json()) as { localId: string };
  const claimed = await fetch(`${base}/accounts:update`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ localId, customAttributes: JSON.stringify(user.claims) }),
  });
  if (!claimed.ok) throw new Error(`[Emulator seed] claims ${user.email} failed: HTTP ${claimed.status}`);
}

function emulatorDocUrl(firestoreHost: string, projectId: string, path: string): string {
  return `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

async function emulatorDocExists(firestoreHost: string, projectId: string, path: string): Promise<boolean> {
  const res = await fetch(emulatorDocUrl(firestoreHost, projectId, path), {
    headers: { Authorization: 'Bearer owner' },
  });
  return res.ok;
}

/**
 * Rules check a new subcollection doc's parent client with `get()` (pre-batch state),
 * so the app's single-batch bootstrap cannot seed an empty database. Pre-create only
 * the root client envelopes; the app's own import then writes all data under rules.
 */
async function seedRootClientEnvelope(
  firestoreHost: string,
  projectId: string,
  client: { id: string; organizationId: string }
) {
  const res = await fetch(emulatorDocUrl(firestoreHost, projectId, `clients/${encodeURIComponent(client.id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { organizationId: { stringValue: client.organizationId } } }),
  });
  if (!res.ok) throw new Error(`[Emulator seed] root client ${client.id} failed: HTTP ${res.status}`);
}

async function bootstrapFirestoreThroughApp(
  baseURL: string,
  hosts: { firestoreHost: string; authHost: string },
  projectId: string
) {
  const { firestoreHost, authHost } = hosts;
  const browser = await chromium.launch({ args: E2E_CHROMIUM_ARGS });
  const productionRequests: string[] = [];
  const emulatorRequests = { auth: 0, firestore: 0 };
  try {
    const page = await browser.newPage();
    page.on('request', (req) => {
      const url = req.url();
      if (isProductionFirebaseUrl(url)) productionRequests.push(url);
      if (url.includes(authHost)) emulatorRequests.auth += 1;
      if (url.includes(firestoreHost)) emulatorRequests.firestore += 1;
    });

    await page.goto(baseURL);
    const runtime = await page.evaluate(async () => {
      const { readFirebaseConfig } = await import('/src/firebase/config.ts');
      const config = readFirebaseConfig();
      return { projectId: config?.projectId ?? null, useEmulators: config?.useEmulators ?? false };
    });
    assertNonProductionFirebaseProjectForE2E(runtime, 'Playwright runtime config');

    await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
    await page.reload();
    await page.fill('#react-login-email', MANAGER_EMAIL);
    await page.fill('#react-login-password', MANAGER_PASSWORD);
    await page.click('[data-testid="react-login-submit"]');
    await page.waitForSelector('[data-testid="react-shell-logout"]', { timeout: 60_000 });

    const readLocalClients = () =>
      page.evaluate(async () => {
        const { dbService } = await import('/src/services/db.ts');
        return dbService.getClients().map((client) => ({ id: client.id, organizationId: client.organizationId }));
      });
    const deadline = Date.now() + 60_000;
    let clients = await readLocalClients();
    while (![CLIENT_JUAN_ID, CLIENT_ELENA_ID].every((id) => clients.some((client) => client.id === id))) {
      if (Date.now() > deadline) throw new Error('[Emulator seed] app built-in seed did not produce fixture clients.');
      await page.waitForTimeout(500);
      clients = await readLocalClients();
    }
    for (const client of clients) {
      await seedRootClientEnvelope(firestoreHost, projectId, client);
    }
    const imported = await page.evaluate(async () => {
      const { dbService } = await import('/src/services/db.ts');
      const { importSnapshotToFirestore } = await import('/src/services/firestore/sync.ts');
      return importSnapshotToFirestore(dbService.exportSnapshot());
    });
    if (!imported.ok) throw new Error(`[Emulator seed] Firestore import failed: ${imported.message}`);
    for (const id of [CLIENT_JUAN_ID, CLIENT_ELENA_ID]) {
      if (!(await emulatorDocExists(firestoreHost, projectId, `clients/${id}`))) {
        throw new Error(`[Emulator seed] fixture client ${id} missing after import.`);
      }
    }
    await page.waitForTimeout(3_000);

    if (productionRequests.length) {
      throw new Error(`[Playwright global setup] Production Firebase request detected: ${productionRequests[0]}`);
    }
    console.log(
      `[e2e-safety] project=${runtime.projectId} emulators=${runtime.useEmulators} ` +
        `authEmulatorRequests=${emulatorRequests.auth} firestoreEmulatorRequests=${emulatorRequests.firestore} ` +
        `productionFirebaseRequests=${productionRequests.length}`
    );
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const env = resolveE2EFirebaseEnv();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const { firestoreHost, authHost } = requireEmulatorEnvironment(projectId);
  const resetTarget = { projectId, firestoreHost, authHost };

  await resetFirebaseEmulators(resetTarget);

  await seedAuthUser(authHost, projectId, {
    email: MANAGER_EMAIL,
    password: MANAGER_PASSWORD,
    displayName: 'Santiago Morales (Brand Manager)',
    claims: { role: 'ADMIN', organizationId: DEMO_ORG_ID, clientId: null },
  });
  await seedAuthUser(authHost, projectId, {
    email: CLIENT_JUAN_EMAIL,
    password: CLIENT_PASSWORD,
    displayName: 'Juan J. Vasquez',
    claims: { role: 'CLIENT', organizationId: DEMO_ORG_ID, clientId: CLIENT_JUAN_ID },
  });
  await seedAuthUser(authHost, projectId, {
    email: CLIENT_ELENA_EMAIL,
    password: CLIENT_PASSWORD,
    displayName: 'Elena Martínez',
    claims: { role: 'CLIENT', organizationId: DEMO_ORG_ID, clientId: CLIENT_ELENA_ID },
  });

  const baseURL = String(config.projects[0]?.use.baseURL ?? '');
  await bootstrapFirestoreThroughApp(baseURL, { firestoreHost, authHost }, projectId);

  return async () => {
    await resetFirebaseEmulators(resetTarget);
  };
}
