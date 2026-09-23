/**
 * Local snapshot rematerialization consumer.
 *
 * UI issues intent only. `requireAdminActor` establishes trusted org/actor/role.
 * Application owns rematerialization orchestration.
 */

import {
  LocalSnapshotError,
  type RematerializeLocalSnapshotToFirestoreResult,
} from '../application/localSnapshot';
import { composeLocalSnapshot } from '../composition/localSnapshot/composeLocalSnapshot';
import { requireAdminActor } from '../controllers/trustedTenant';
import { FIREBASE_ENABLED } from '../firebase/config';
import { authService } from './auth';

type LocalSnapshotUseCases = ReturnType<typeof composeLocalSnapshot>;

let useCases: LocalSnapshotUseCases = composeLocalSnapshot();

/** Test-only reset — not production API. */
export function resetLocalSnapshotConsumerForTest(next?: LocalSnapshotUseCases): void {
  useCases = next ?? composeLocalSnapshot();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof LocalSnapshotError) {
    throw err;
  }
  throw new LocalSnapshotError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

/** Technical availability — not authorization. */
export function isLocalSnapshotRematerializeAvailable(): boolean {
  return FIREBASE_ENABLED;
}

/**
 * ADMIN rematerializes the current local v5 snapshot into Firestore.
 * Organization and actor come exclusively from `requireAdminActor`.
 */
export async function rematerializeLocalSnapshot(): Promise<RematerializeLocalSnapshotToFirestoreResult> {
  const gate = requireAdminActor({
    getCurrentUser: () => authService.getCurrentUser(),
  });
  if (!gate.ok) {
    throw new LocalSnapshotError('ACTOR_NOT_AUTHORIZED', gate.message);
  }

  if (!FIREBASE_ENABLED) {
    throw new LocalSnapshotError(
      'FIREBASE_NOT_CONFIGURED',
      'Configura VITE_FIREBASE_* para importar.'
    );
  }

  try {
    return await useCases.rematerializeLocalSnapshotToFirestore({
      trusted: {
        actorId: gate.actorId,
        actorRole: gate.actorRole,
        organizationId: gate.organizationId,
      },
    });
  } catch (err) {
    mapError(err, 'No se pudo subir el snapshot.');
  }
}
