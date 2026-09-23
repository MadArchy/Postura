import type { LocalV5Snapshot } from '../../../services/firestore/types';

/**
 * Capability port: export the current in-memory local v5 snapshot.
 * Application does not know dbService. UI does not construct the snapshot.
 */
export interface LocalSnapshotExportPort {
  exportCurrent(): LocalV5Snapshot | null;
}
