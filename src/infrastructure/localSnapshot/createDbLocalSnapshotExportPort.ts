import type { LocalSnapshotExportPort } from '../../application/localSnapshot';
import { dbService } from '../../services/db';

/** Temporary leftover adapter — wraps existing `dbService.exportSnapshot()` only. */
export function createDbLocalSnapshotExportPort(): LocalSnapshotExportPort {
  return {
    exportCurrent() {
      try {
        return dbService.exportSnapshot();
      } catch {
        return null;
      }
    },
  };
}
