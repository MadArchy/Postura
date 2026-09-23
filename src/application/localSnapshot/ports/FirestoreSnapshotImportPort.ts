import type { LocalV5Snapshot } from '../../../services/firestore/types';

/**
 * Capability port: merge-import a local v5 snapshot through the existing
 * Firestore persistence adapter. Actor filtering and merge semantics stay
 * in the unchanged adapter.
 */
export interface FirestoreSnapshotImportPort {
  importSnapshot(
    snapshot: LocalV5Snapshot
  ): Promise<{ ok: boolean; message: string; written: number }>;
}
