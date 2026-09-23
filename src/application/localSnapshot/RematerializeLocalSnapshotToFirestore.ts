import { LocalSnapshotError } from './errors';
import type { FirestoreSnapshotImportPort } from './ports/FirestoreSnapshotImportPort';
import type { LocalSnapshotExportPort } from './ports/LocalSnapshotExportPort';
import {
  assertTrustedAdminActor,
  type TrustedLocalSnapshotAdminContext,
} from './trustedContext';

export interface RematerializeLocalSnapshotToFirestoreInput {
  trusted: TrustedLocalSnapshotAdminContext;
}

export interface RematerializeLocalSnapshotToFirestoreResult {
  ok: boolean;
  message: string;
  written: number;
}

export interface RematerializeLocalSnapshotToFirestoreDeps {
  snapshot: LocalSnapshotExportPort;
  firestore: FirestoreSnapshotImportPort;
}

/**
 * ADMIN rematerializes the current local v5 snapshot into Firestore.
 *
 * Orchestration only. Persistence is port-owned. UI must not supply a snapshot
 * or a client/tenant id. Merge, filter, and conflict semantics stay in the
 * existing adapter.
 */
export function createRematerializeLocalSnapshotToFirestore(
  deps: RematerializeLocalSnapshotToFirestoreDeps
) {
  return async function rematerializeLocalSnapshotToFirestore(
    input: RematerializeLocalSnapshotToFirestoreInput
  ): Promise<RematerializeLocalSnapshotToFirestoreResult> {
    assertTrustedAdminActor(input.trusted);

    let snapshot;
    try {
      snapshot = deps.snapshot.exportCurrent();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No hay datos locales para importar.';
      throw new LocalSnapshotError('PERSISTENCE_ERROR', message);
    }
    if (!snapshot) {
      throw new LocalSnapshotError('NO_LOCAL_SNAPSHOT', 'No hay datos locales para importar.');
    }

    let result;
    try {
      result = await deps.firestore.importSnapshot(snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
      throw new LocalSnapshotError('PERSISTENCE_ERROR', message);
    }

    if (!result.ok) {
      if (/VITE_FIREBASE|configura/i.test(result.message)) {
        throw new LocalSnapshotError('FIREBASE_NOT_CONFIGURED', result.message);
      }
      if (/no inicializado/i.test(result.message)) {
        throw new LocalSnapshotError('FIRESTORE_UNAVAILABLE', result.message);
      }
      throw new LocalSnapshotError('PERSISTENCE_ERROR', result.message);
    }

    return { ok: true, message: result.message, written: result.written };
  };
}
