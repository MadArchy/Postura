import type { Firestore } from 'firebase-admin/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { clientDocPath } from '../../../services/firestore/paths';

export interface FirestoreClientOrganizationLookupOptions {
  firestore?: Firestore;
}

/** Admin SDK read of `clients/{clientId}.organizationId` only — never returns the client payload. */
export class FirestoreClientOrganizationLookup {
  private readonly db: Firestore;

  constructor(options: FirestoreClientOrganizationLookupOptions = {}) {
    this.db = options.firestore ?? getFirestore();
  }

  async findOwningOrganizationId(clientId: string): Promise<string | null> {
    const snapshot = await this.db.doc(clientDocPath(clientId)).get();
    if (!snapshot.exists) return null;
    const organizationId: unknown = snapshot.get('organizationId');
    if (typeof organizationId !== 'string') return null;
    const trimmed = organizationId.trim();
    return trimmed || null;
  }
}
