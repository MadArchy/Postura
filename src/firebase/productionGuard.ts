/**
 * E2E / test-mode Firebase production guard (fail-closed).
 *
 * Pure module: no `import.meta.env`, no Firebase SDK. Shared by the browser
 * Firebase init path, the Playwright config/global setup and the emulator reset.
 */
export const PRODUCTION_FIREBASE_PROJECT_ID = 'aurora-postura-app';

/** Firebase CLI treats `demo-*` projects as emulator-only; they have no live backend. */
export const DEMO_FIREBASE_PROJECT_PREFIX = 'demo-';

/** Live Firebase endpoints E2E browsers must never resolve. */
export const PRODUCTION_FIREBASE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasestorage.googleapis.com',
  'firebaseinstallations.googleapis.com',
  '*.cloudfunctions.net',
  `${PRODUCTION_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  `${PRODUCTION_FIREBASE_PROJECT_ID}.web.app`,
] as const;

export interface E2EFirebaseTarget {
  projectId: string | null | undefined;
  useEmulators: boolean;
}

export function isProductionFirebaseProject(projectId: string | null | undefined): boolean {
  return (projectId ?? '').trim().toLowerCase() === PRODUCTION_FIREBASE_PROJECT_ID;
}

export function assertNonProductionFirebaseProjectForE2E(target: E2EFirebaseTarget, context = 'E2E'): void {
  const projectId = (target.projectId ?? '').trim();
  if (isProductionFirebaseProject(projectId)) {
    throw new Error(
      `[${context}] E2E against production Firebase project "${PRODUCTION_FIREBASE_PROJECT_ID}" is prohibited. Aborting.`
    );
  }
  if (!projectId.toLowerCase().startsWith(DEMO_FIREBASE_PROJECT_PREFIX)) {
    throw new Error(
      `[${context}] E2E requires an emulator-only "${DEMO_FIREBASE_PROJECT_PREFIX}*" Firebase project; got "${projectId || '<missing>'}". Aborting.`
    );
  }
  if (!target.useEmulators) {
    throw new Error(
      `[${context}] E2E requires the Firebase Emulator Suite (VITE_FIREBASE_USE_EMULATORS=true). Aborting.`
    );
  }
}

/** Emulator admin endpoints (reset/seed) may only be addressed on loopback. */
export function assertLoopbackEmulatorHost(host: string | null | undefined, context = 'E2E'): string {
  const value = (host ?? '').trim();
  const match = /^(127\.0\.0\.1|localhost|\[::1\]):(\d{1,5})$/i.exec(value);
  if (!match) {
    throw new Error(
      `[${context}] Firebase emulator host must be loopback host:port; got "${value || '<missing>'}". Aborting.`
    );
  }
  return value;
}
