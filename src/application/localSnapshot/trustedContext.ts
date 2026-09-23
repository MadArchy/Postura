import type { UserRole } from '../../types';
import { LocalSnapshotError } from './errors';

/**
 * Trusted admin context for org-wide local snapshot rematerialization.
 * organizationId / actorId / actorRole come only from `requireAdminActor`.
 */
export interface TrustedLocalSnapshotAdminContext {
  actorId: string;
  actorRole: UserRole;
  organizationId: string;
}

export function assertTrustedAdminActor(trusted: TrustedLocalSnapshotAdminContext): void {
  if (!trusted.actorId?.trim()) {
    throw new LocalSnapshotError('ACTOR_NOT_AUTHORIZED', 'Trusted actorId is required.');
  }
  if (!trusted.organizationId?.trim()) {
    throw new LocalSnapshotError('ACTOR_NOT_AUTHORIZED', 'Trusted organizationId is required.');
  }
  if (trusted.actorRole !== 'ADMIN') {
    throw new LocalSnapshotError(
      'ACTOR_NOT_AUTHORIZED',
      'Local snapshot rematerialization requires ADMIN role from the trusted session.'
    );
  }
}
