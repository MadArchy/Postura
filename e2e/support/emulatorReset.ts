/**
 * Deterministic E2E cleanup: wipe Firestore + Auth emulator data for the E2E project.
 *
 * Only emulator-only REST endpoints on loopback are addressed, and the shared
 * production guard runs first, so this can never target a live Firebase project.
 */
import {
  assertLoopbackEmulatorHost,
  assertNonProductionFirebaseProjectForE2E,
} from '../../src/firebase/productionGuard';

export interface EmulatorResetTarget {
  projectId: string;
  firestoreHost: string | undefined;
  authHost: string | undefined;
}

export async function resetFirebaseEmulators(
  target: EmulatorResetTarget,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  assertNonProductionFirebaseProjectForE2E({ projectId: target.projectId, useEmulators: true }, 'Emulator cleanup');
  const firestoreHost = assertLoopbackEmulatorHost(target.firestoreHost, 'Emulator cleanup');
  const authHost = assertLoopbackEmulatorHost(target.authHost, 'Emulator cleanup');
  const projectId = encodeURIComponent(target.projectId);

  const endpoints = [
    `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    `http://${authHost}/emulator/v1/projects/${projectId}/accounts`,
  ];
  for (const url of endpoints) {
    const res = await fetchImpl(url, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`[Emulator cleanup] DELETE ${url} failed with HTTP ${res.status}.`);
    }
  }
}
