import type { LocalV5Snapshot } from './types';
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app';
import { readFirebaseConfig } from '../../firebase/config';
import { CLIENT_SUBCOLLECTIONS, clientDocPath } from './paths';
import { stripNonAuthoritativeContentHistory } from '../../domain/contentHistoryPolicy';

type CollectionKey = keyof LocalV5Snapshot;

const COLLECTION_MAP: Partial<Record<CollectionKey, typeof CLIENT_SUBCOLLECTIONS[number] | 'profile'>> = {
  signals: 'signals',
  tasks: 'tasks',
  curation: 'curation',
  deliveries: 'deliveries',
  contents: 'contents',
  opportunities: 'opportunities',
  results: 'results',
  theses: 'theses',
  campaigns: 'campaigns',
  campaignMilestones: 'campaignMilestones',
  evidenceVault: 'evidence',
  advices: 'advices',
  feedbackEvents: 'feedbackEvents',
  signalOutcomes: 'signalOutcomes',
  proofWallItems: 'proofWallItems',
  sources: 'sources',
  notifications: 'notifications',
  recommendations: 'recommendations',
  aiRuns: 'aiRuns',
};

/** Snapshot collection keys CLIENT may persist (SEC-009-020). */
export const CLIENT_PERSIST_COLLECTION_KEYS = [
  'tasks',
  'deliveries',
  'contents',
  'opportunities',
  'results',
  'theses',
  'evidenceVault',
  'feedbackEvents',
  'notifications',
] as const satisfies ReadonlyArray<CollectionKey>;

const CLIENT_PERSIST_KEY_SET = new Set<string>(CLIENT_PERSIST_COLLECTION_KEYS);

/** Workflow fields written as serverTimestamp for SEC-009-017. */
const TRUSTED_SCALAR_TIME_FIELDS = new Set([
  'acknowledgedAt',
  'completedAt',
  'submittedAt',
  'clientApprovedAt',
  'createdAt',
  'updatedAt',
]);

export type PersistenceActor = {
  role: string;
  clientId?: string | null;
  organizationId?: string | null;
};

function itemsForClient<T extends { clientId?: string | null; id?: string }>(
  rows: T[],
  clientId: string
): T[] {
  return rows.filter((row) => row.clientId === clientId);
}

/**
 * SEC-009-020: CLIENT persistence must not attempt manager-only collections.
 * ADMIN retains full snapshot sync.
 */
export function filterSnapshotForPersistenceActor(
  snapshot: LocalV5Snapshot,
  actor: PersistenceActor
): LocalV5Snapshot {
  if (actor.role !== 'CLIENT') return snapshot;

  const clientId = actor.clientId?.trim() || '';
  if (!clientId) {
    return {
      ...snapshot,
      clients: [],
      signals: [],
      tasks: [],
      curation: [],
      deliveries: [],
      contents: [],
      opportunities: [],
      results: [],
      theses: [],
      campaigns: [],
      campaignMilestones: [],
      evidenceVault: [],
      advices: [],
      feedbackEvents: [],
      signalOutcomes: [],
      proofWallItems: [],
      sources: [],
      notifications: [],
      recommendations: [],
      aiRuns: [],
      profiles: {},
      dossiers: {},
    };
  }

  const filtered: LocalV5Snapshot = {
    ...snapshot,
    clients: snapshot.clients.filter((c) => c.id === clientId),
    signals: [],
    curation: [],
    campaigns: [],
    campaignMilestones: [],
    advices: [],
    signalOutcomes: [],
    proofWallItems: [],
    sources: [],
    recommendations: [],
    aiRuns: [],
    dossiers: {},
    profiles: snapshot.profiles[clientId]
      ? { [clientId]: snapshot.profiles[clientId] }
      : {},
    tasks: [],
    deliveries: [],
    contents: [],
    opportunities: [],
    results: [],
    theses: [],
    evidenceVault: [],
    feedbackEvents: [],
    notifications: [],
  };

  for (const key of CLIENT_PERSIST_COLLECTION_KEYS) {
    const rows = snapshot[key];
    if (!Array.isArray(rows)) continue;
    (filtered as unknown as Record<string, unknown>)[key] = itemsForClient(
      rows as Array<{ clientId?: string | null; id?: string }>,
      clientId
    );
  }

  return filtered;
}

export function clientPersistIncludesCollection(collectionKey: string): boolean {
  return CLIENT_PERSIST_KEY_SET.has(collectionKey);
}

/**
 * Firestore no acepta `undefined` en documentos. Quita claves undefined
 * (también anidadas) antes de batch.set / merge.
 */
export function stripUndefinedForFirestore<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedForFirestore(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    out[key] = stripUndefinedForFirestore(entry);
  }
  return out as T;
}

function isFirestoreTimestampLike(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

/** Convert Timestamps from pull into ISO strings for local domain models. */
export function normalizeFirestorePulledData<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (isFirestoreTimestampLike(value)) {
    return (value as unknown as { toDate: () => Date }).toDate().toISOString() as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFirestorePulledData(item)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalizeFirestorePulledData(entry);
    }
    return out as T;
  }
  return value;
}

/**
 * Replace trusted workflow clock fields with serverTimestamp so rules can
 * require request.time (SEC-009-017). Local memory keeps ISO strings.
 */
export function applyTrustedServerTimestamps(
  data: Record<string, unknown>,
  serverTimestamp: () => unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const key of TRUSTED_SCALAR_TIME_FIELDS) {
    if (typeof out[key] === 'string') {
      out[key] = serverTimestamp();
    }
  }
  // Do not convert stateHistory[].at — Firestore rejects serverTimestamp inside arrays.
  if (Array.isArray(out.stateHistory) && out.stateHistory.length > 0) {
    /* keep client ISO strings for admin paths; CLIENT persist strips stateHistory */
  }
  return out;
}

function prepareDocForWrite(
  row: Record<string, unknown>,
  serverTimestamp: () => unknown,
  options?: { stripStateHistory?: boolean; client?: { id: string; organizationId?: string | null } }
): Record<string, unknown> {
  let base = stripUndefinedForFirestore(row) as Record<string, unknown>;
  if (options?.client) {
    base = ensureSubcollectionEnvelope(base, options.client);
  }
  const prepared = applyTrustedServerTimestamps(base, serverTimestamp);
  if (options?.stripStateHistory && 'stateHistory' in prepared) {
    return stripNonAuthoritativeContentHistory(prepared);
  }
  return prepared;
}

/** T-009-14e: stamp denormalized tenant envelope on subcollection writes. */
export function ensureSubcollectionEnvelope(
  row: Record<string, unknown>,
  client: { id: string; organizationId?: string | null }
): Record<string, unknown> {
  const out = { ...row };
  const clientOrg =
    typeof client.organizationId === 'string' ? client.organizationId.trim() : '';
  if (clientOrg && typeof out.organizationId !== 'string') {
    out.organizationId = clientOrg;
  }
  if (typeof out.clientId !== 'string' || !out.clientId.trim()) {
    out.clientId = client.id;
  }
  return out;
}

/** Importa snapshot v5 a Firestore (Emulator o producción). */
export async function importSnapshotToFirestore(
  snapshot: LocalV5Snapshot
): Promise<{ ok: boolean; message: string; written: number }> {
  if (!readFirebaseConfig()) {
    return { ok: false, message: 'Configura VITE_FIREBASE_* para importar.', written: 0 };
  }

  const db = await getFirebaseFirestore();
  if (!db) return { ok: false, message: 'Firestore no inicializado.', written: 0 };

  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  let actor: PersistenceActor = { role: 'ADMIN' };
  if (user) {
    const token = await user.getIdTokenResult();
    actor = {
      role: typeof token.claims.role === 'string' ? token.claims.role : 'ADMIN',
      clientId: typeof token.claims.clientId === 'string' ? token.claims.clientId : null,
      organizationId:
        typeof token.claims.organizationId === 'string' ? token.claims.organizationId : null,
    };
  }

  const scoped = filterSnapshotForPersistenceActor(snapshot, actor);
  const isClientActor = actor.role === 'CLIENT';

  const { doc, writeBatch, serverTimestamp } = await import('firebase/firestore');
  let written = 0;
  let batch = writeBatch(db);
  let ops = 0;

  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db!);
    ops = 0;
  };

  for (const client of scoped.clients) {
    if (isClientActor && actor.clientId && client.id !== actor.clientId) continue;

    batch.set(
      doc(db, clientDocPath(client.id)),
      prepareDocForWrite(client as unknown as Record<string, unknown>, serverTimestamp),
      { merge: true }
    );
    ops += 1;
    written += 1;

    for (const [key, subName] of Object.entries(COLLECTION_MAP)) {
      if (isClientActor && !CLIENT_PERSIST_KEY_SET.has(key)) continue;
      const rows = scoped[key as CollectionKey];
      if (!Array.isArray(rows)) continue;
      for (const row of itemsForClient(rows as Array<{ clientId?: string | null; id?: string }>, client.id)) {
        if (!row.id) continue;
        batch.set(
          doc(db, `${clientDocPath(client.id)}/${subName}/${row.id}`),
          prepareDocForWrite(row as unknown as Record<string, unknown>, serverTimestamp, {
            stripStateHistory: isClientActor && subName === 'contents',
            client: { id: client.id, organizationId: client.organizationId },
          }),
          { merge: true }
        );
        ops += 1;
        written += 1;
        if (ops >= 400) await flush();
      }
    }

    const profile = scoped.profiles[client.id];
    if (profile) {
      batch.set(
        doc(db, `${clientDocPath(client.id)}/profile/data`),
        prepareDocForWrite(profile as unknown as Record<string, unknown>, serverTimestamp, {
          client: { id: client.id, organizationId: client.organizationId },
        }),
        { merge: true }
      );
      ops += 1;
      written += 1;
    }

    if (!isClientActor) {
      const dossier = scoped.dossiers[client.id];
      if (dossier) {
        batch.set(
          doc(db, `${clientDocPath(client.id)}/dossier/data`),
          prepareDocForWrite(dossier as unknown as Record<string, unknown>, serverTimestamp, {
            client: { id: client.id, organizationId: client.organizationId },
          }),
          { merge: true }
        );
        ops += 1;
        written += 1;
      }
    }
  }

  await flush();
  return { ok: true, message: `Importados ${written} documentos a Firestore.`, written };
}


/**
 * Resolve the tenant org for Q1 client listing.
 * Authenticated org always wins; a non-empty requested org must match auth org.
 * Returns null when the query must not run (fail-closed).
 */
export function resolveTenantOrganizationIdForQuery(
  authenticatedOrganizationId: string | null | undefined,
  requestedOrganizationId?: string
): string | null {
  const authOrg = authenticatedOrganizationId?.trim() || '';
  if (!authOrg) return null;
  const requested = requestedOrganizationId?.trim() || '';
  if (requested && requested !== authOrg) return null;
  return authOrg;
}

/**
 * SPEC-009 Q1: list clients for the authenticated tenant only.
 * Security Rules are not filters — never unscoped getDocs(collection('clients')).
 * Optional organizationId arg is validated against the auth token org (no arbitrary tenant).
 */
export async function listFirestoreClientIds(organizationId?: string): Promise<string[]> {
  const db = await getFirebaseFirestore();
  if (!db) return [];

  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return [];
  const token = await user.getIdTokenResult();
  const authOrg =
    typeof token.claims.organizationId === 'string' ? token.claims.organizationId : '';

  const orgId = resolveTenantOrganizationIdForQuery(authOrg, organizationId);
  if (!orgId) return [];

  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const snap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', orgId)));
  return snap.docs.map((docSnap) => docSnap.id);
}

/** Descarga datos de Firestore para un cliente (o todos si admin). */
export async function pullClientDataFromFirestore(
  clientIds: string[]
): Promise<Partial<LocalV5Snapshot>> {
  const db = await getFirebaseFirestore();
  if (!db) return {};

  const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
  const partial: Partial<LocalV5Snapshot> = {
    clients: [],
    signals: [],
    tasks: [],
    curation: [],
    deliveries: [],
    contents: [],
    opportunities: [],
    results: [],
    theses: [],
    campaigns: [],
    evidenceVault: [],
    advices: [],
    feedbackEvents: [],
    signalOutcomes: [],
    campaignMilestones: [],
    proofWallItems: [],
    sources: [],
    notifications: [],
    recommendations: [],
    aiRuns: [],
    profiles: {},
    dossiers: {},
  };

  for (const clientId of clientIds) {
    const clientSnap = await getDoc(doc(db, clientDocPath(clientId)));
    if (clientSnap.exists()) {
      partial.clients!.push(
        normalizeFirestorePulledData(clientSnap.data()) as unknown as LocalV5Snapshot['clients'][number]
      );
    }

    for (const sub of CLIENT_SUBCOLLECTIONS) {
      const snap = await getDocs(collection(db, `${clientDocPath(clientId)}/${sub}`));
      const targetKey = Object.entries(COLLECTION_MAP).find(([, v]) => v === sub)?.[0] as CollectionKey | undefined;
      if (!targetKey || !Array.isArray(partial[targetKey])) continue;
      for (const row of snap.docs) {
        (partial[targetKey] as unknown[]).push(
          normalizeFirestorePulledData({ id: row.id, ...row.data() })
        );
      }
    }

    const profileSnap = await getDoc(doc(db, `${clientDocPath(clientId)}/profile/data`));
    if (profileSnap.exists()) {
      partial.profiles![clientId] = normalizeFirestorePulledData(
        profileSnap.data()
      ) as unknown as LocalV5Snapshot['profiles'][string];
    }

    const dossierSnap = await getDoc(doc(db, `${clientDocPath(clientId)}/dossier/data`));
    if (dossierSnap.exists()) {
      partial.dossiers![clientId] = normalizeFirestorePulledData(
        dossierSnap.data()
      ) as unknown as LocalV5Snapshot['dossiers'][string];
    }
  }

  return partial;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let authoritative = false;
type FirestorePushErrorHandler = (message: string) => void;
let pushErrorHandler: FirestorePushErrorHandler | null = null;

export function onFirestorePushError(handler: FirestorePushErrorHandler | null) {
  pushErrorHandler = handler;
}

export function setFirestoreAuthoritative(active: boolean) {
  authoritative = active;
}

export function isFirestoreAuthoritative(): boolean {
  return authoritative && Boolean(readFirebaseConfig());
}

export function scheduleFirestorePush(snapshot: LocalV5Snapshot) {
  if (!isFirestoreAuthoritative()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void importSnapshotToFirestore(snapshot).then((result) => {
      if (!result.ok) pushErrorHandler?.(result.message);
    }).catch((err) => {
      const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
      pushErrorHandler?.(message);
    });
  }, 800);
}

export async function hydrateFromFirestore(clientIds: string[]): Promise<Partial<LocalV5Snapshot>> {
  if (!readFirebaseConfig()) return {};
  setFirestoreAuthoritative(true);
  return pullClientDataFromFirestore(clientIds);
}

type RealtimePartialHandler = (
  partial: Partial<LocalV5Snapshot>,
  meta: { clientId: string }
) => void;

let realtimeUnsubs: Array<() => void> = [];

/** Detiene listeners en tiempo real (logout). */
export function stopFirestoreRealtimeSync() {
  for (const unsub of realtimeUnsubs) unsub();
  realtimeUnsubs = [];
}

const REALTIME_SUBS = [
  'sources',
  'signals',
  'notifications',
  'deliveries',
  'tasks',
  'contents',
  'theses',
  'recommendations',
  'opportunities',
  'campaigns',
  'results',
  'feedbackEvents',
  'proofWallItems',
  'aiRuns',
] as const;

/** Subcolecciones cuyo nombre en Firestore no coincide con la clave del snapshot. */
const REALTIME_KEY_MAP: Partial<Record<(typeof REALTIME_SUBS)[number] | 'evidence', CollectionKey>> = {
  evidence: 'evidenceVault',
};

/**
 * Escucha colecciones operativas por cliente.
 * Cada snapshot reemplaza solo el alcance de ese clientId (delete-aware).
 */
export async function startFirestoreRealtimeSync(
  clientIds: string[],
  onPartial: RealtimePartialHandler
): Promise<void> {
  stopFirestoreRealtimeSync();
  if (!readFirebaseConfig() || !clientIds.length) return;

  const db = await getFirebaseFirestore();
  if (!db) return;

  const { collection, onSnapshot } = await import('firebase/firestore');

  const listen = (clientId: string, sub: string, snapshotKey: CollectionKey) => {
    const colRef = collection(db, `${clientDocPath(clientId)}/${sub}`);
    const unsub = onSnapshot(colRef, (snap: import('firebase/firestore').QuerySnapshot) => {
      const rows = snap.docs.map((docSnap) =>
        normalizeFirestorePulledData({
          ...docSnap.data(),
          id: docSnap.id,
          clientId,
        })
      );
      const partial: Partial<LocalV5Snapshot> = {
        [snapshotKey]: rows,
      } as Partial<LocalV5Snapshot>;
      onPartial(partial, { clientId });
    });
    realtimeUnsubs.push(unsub);
  };

  for (const clientId of clientIds) {
    for (const sub of REALTIME_SUBS) {
      listen(clientId, sub, (REALTIME_KEY_MAP[sub] || sub) as CollectionKey);
    }
    // Evidence usa nombre distinto en el snapshot local.
    listen(clientId, 'evidence', 'evidenceVault');
  }
}
