import {
  createRematerializeLocalSnapshotToFirestore,
  type FirestoreSnapshotImportPort,
  type LocalSnapshotExportPort,
} from '../../application/localSnapshot';
import { createDbLocalSnapshotExportPort } from '../../infrastructure/localSnapshot/createDbLocalSnapshotExportPort';
import { createFirestoreSnapshotImportPort } from '../../infrastructure/localSnapshot/createFirestoreSnapshotImportPort';

export interface ComposeLocalSnapshotOptions {
  snapshot?: LocalSnapshotExportPort;
  firestore?: FirestoreSnapshotImportPort;
}

/**
 * Composition root for local snapshot rematerialization.
 * Default wiring wraps existing exportSnapshot / importSnapshotToFirestore.
 */
export function composeLocalSnapshot(options: ComposeLocalSnapshotOptions = {}) {
  const snapshot = options.snapshot ?? createDbLocalSnapshotExportPort();
  const firestore = options.firestore ?? createFirestoreSnapshotImportPort();

  return {
    rematerializeLocalSnapshotToFirestore: createRematerializeLocalSnapshotToFirestore({
      snapshot,
      firestore,
    }),
  };
}
