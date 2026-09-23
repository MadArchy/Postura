import type { FirestoreSnapshotImportPort } from '../../application/localSnapshot';
import { importSnapshotToFirestore } from '../../services/firestore/sync';

/** Temporary leftover adapter — wraps existing `importSnapshotToFirestore` only. */
export function createFirestoreSnapshotImportPort(): FirestoreSnapshotImportPort {
  return {
    importSnapshot(snapshot) {
      return importSnapshotToFirestore(snapshot);
    },
  };
}
