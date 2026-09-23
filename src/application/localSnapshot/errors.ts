/**
 * Local snapshot rematerialization Application errors.
 * Operational orchestration — not a new role, tenant, or persistence policy.
 */

export type LocalSnapshotErrorCode =
  | 'ACTOR_NOT_AUTHORIZED'
  | 'NO_LOCAL_SNAPSHOT'
  | 'FIREBASE_NOT_CONFIGURED'
  | 'FIRESTORE_UNAVAILABLE'
  | 'PERSISTENCE_ERROR';

export class LocalSnapshotError extends Error {
  readonly code: LocalSnapshotErrorCode;

  constructor(code: LocalSnapshotErrorCode, message: string) {
    super(message);
    this.name = 'LocalSnapshotError';
    this.code = code;
  }
}
