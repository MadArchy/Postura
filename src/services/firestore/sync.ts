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

/**
 * Workflow fields written as serverTimestamp for SEC-009-017.
 * `createdAt` is write-once and handled by `applyCreatedAtWriteOnce`.
 */
const TRUSTED_SCALAR_TIME_FIELDS = new Set([
  'acknowledgedAt',
  'completedAt',
  'submittedAt',
  'clientApprovedAt',
  'updatedAt',
]);

/** Document paths observed to exist in Firestore (pull, realtime snapshots, committed writes). */
const knownRemoteDocPaths = new Set<string>();
/**
 * Collections kept current by a live realtime listener; a path absent there is new.
 * One-shot listings (pull, probes) go stale and never populate this set.
 */
const liveCollections = new Set<string>();
/**
 * Last server-confirmed data per document path (pull, realtime, probes, acknowledged CLIENT writes).
 * Pending local writes and cache-only snapshots never enter it; CLIENT persistence diffs against it.
 */
const remoteBaseline = new Map<string, Record<string, unknown>>();

export function resetKnownRemoteDocPaths() {
  knownRemoteDocPaths.clear();
  liveCollections.clear();
  remoteBaseline.clear();
}

function parentCollectionPath(docPath: string): string {
  return docPath.slice(0, docPath.lastIndexOf('/'));
}

function applyLiveCollectionSnapshot(collectionPath: string, docIds: Iterable<string>) {
  for (const path of knownRemoteDocPaths) {
    if (parentCollectionPath(path) === collectionPath) knownRemoteDocPaths.delete(path);
  }
  for (const id of docIds) knownRemoteDocPaths.add(`${collectionPath}/${id}`);
  liveCollections.add(collectionPath);
}

function markRemoteDocsKnown(collectionPath: string, docIds: Iterable<string>) {
  for (const id of docIds) knownRemoteDocPaths.add(`${collectionPath}/${id}`);
}

/** Only server-confirmed docs prove existence; pending local writes may still be rejected. */
type SnapshotMetadataCarrier = { metadata?: { hasPendingWrites?: boolean; fromCache?: boolean } };

function hasPendingWrites(row: { id: string }): boolean {
  return Boolean((row as SnapshotMetadataCarrier).metadata?.hasPendingWrites);
}

function confirmedDocIds(docs: ReadonlyArray<{ id: string }>): string[] {
  return docs.filter((row) => !hasPendingWrites(row)).map((row) => row.id);
}

function isFromCache(snap: unknown): boolean {
  return Boolean((snap as SnapshotMetadataCarrier).metadata?.fromCache);
}

type ServerDocLike = { id: string; data: () => unknown };

/** Callers pass only server-confirmed snapshots; `prune` drops docs absent from a complete listing. */
function recordRemoteBaseline(
  collectionPath: string,
  docs: ReadonlyArray<ServerDocLike>,
  options: { prune: boolean }
) {
  if (options.prune) {
    for (const path of remoteBaseline.keys()) {
      if (parentCollectionPath(path) === collectionPath) remoteBaseline.delete(path);
    }
  }
  for (const row of docs) {
    if (hasPendingWrites(row)) continue;
    remoteBaseline.set(
      `${collectionPath}/${row.id}`,
      normalizeFirestorePulledData((row.data() ?? {}) as Record<string, unknown>)
    );
  }
}

export type PersistenceActor = {
  role: string;
  clientId?: string | null;
  organizationId?: string | null;
};

/** Signed-in actor from the last token read; push scheduling is synchronous and cannot await claims. */
let sessionPersistenceActor: PersistenceActor | null = null;

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

/**
 * `createdAt` is write-once: stamped with serverTimestamp only when the document does not
 * exist remotely, and omitted from updates so a merge never replaces (or nulls) the stored value.
 */
export function applyCreatedAtWriteOnce(
  data: Record<string, unknown>,
  docExists: boolean,
  serverTimestamp: () => unknown
): Record<string, unknown> {
  if (!('createdAt' in data)) return data;
  const out: Record<string, unknown> = { ...data };
  if (docExists) {
    delete out.createdAt;
  } else {
    out.createdAt = serverTimestamp();
  }
  return out;
}

interface PrepareDocOptions {
  stripStateHistory?: boolean;
  client?: { id: string; organizationId?: string | null };
}

export function prepareDocForWrite(
  row: Record<string, unknown>,
  serverTimestamp: () => unknown,
  docExists: boolean,
  options?: PrepareDocOptions
): Record<string, unknown> {
  let base = stripUndefinedForFirestore(row) as Record<string, unknown>;
  if (options?.client) {
    base = ensureSubcollectionEnvelope(base, options.client);
  }
  base = applyCreatedAtWriteOnce(base, docExists, serverTimestamp);
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

type SnapshotImportResult = { ok: boolean; message: string; written: number };

let snapshotImportQueue: Promise<unknown> = Promise.resolve();

/**
 * Importa snapshot v5 a Firestore (Emulator o producción).
 * Imports run one at a time so create/update classification never races another push's pending writes.
 */
export function importSnapshotToFirestore(snapshot: LocalV5Snapshot): Promise<SnapshotImportResult> {
  return enqueueSnapshotImport(() => runSnapshotImport(snapshot));
}

function enqueueSnapshotImport(task: () => Promise<SnapshotImportResult>): Promise<SnapshotImportResult> {
  const run = snapshotImportQueue.then(task);
  snapshotImportQueue = run.catch(() => undefined);
  return run;
}

async function runSnapshotImport(snapshot: LocalV5Snapshot): Promise<SnapshotImportResult> {
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
    sessionPersistenceActor = actor;
  }

  const scoped = filterSnapshotForPersistenceActor(snapshot, actor);
  const isClientActor = actor.role === 'CLIENT';

  const planned: PlannedWrite[] = [];

  for (const client of scoped.clients) {
    if (isClientActor && actor.clientId && client.id !== actor.clientId) continue;
    const envelope = { id: client.id, organizationId: client.organizationId };

    planned.push({
      path: clientDocPath(client.id),
      envelopeClientId: null,
      collection: 'root',
      row: client as unknown as Record<string, unknown>,
    });

    for (const [key, subName] of Object.entries(COLLECTION_MAP)) {
      if (isClientActor && !CLIENT_PERSIST_KEY_SET.has(key)) continue;
      const rows = scoped[key as CollectionKey];
      if (!Array.isArray(rows)) continue;
      for (const row of itemsForClient(rows as Array<{ clientId?: string | null; id?: string }>, client.id)) {
        if (!row.id) continue;
        planned.push({
          path: `${clientDocPath(client.id)}/${subName}/${row.id}`,
          envelopeClientId: client.id,
          collection: subName,
          row: row as unknown as Record<string, unknown>,
          options: { stripStateHistory: isClientActor && subName === 'contents', client: envelope },
        });
      }
    }

    const profile = scoped.profiles[client.id];
    if (profile) {
      planned.push({
        path: `${clientDocPath(client.id)}/profile/data`,
        envelopeClientId: client.id,
        collection: 'profile',
        row: profile as unknown as Record<string, unknown>,
        options: { client: envelope },
      });
    }

    if (!isClientActor) {
      const dossier = scoped.dossiers[client.id];
      if (dossier) {
        planned.push({
          path: `${clientDocPath(client.id)}/dossier/data`,
          envelopeClientId: client.id,
          collection: 'dossier',
          row: dossier as unknown as Record<string, unknown>,
          options: { client: envelope },
        });
      }
    }
  }

  const existing = await resolveExistingDocPaths(db, planned, {
    organizationId: actor.organizationId?.trim() || null,
    // Root client create is ADMIN-only, so a CLIENT's own root doc always exists.
    rootAlwaysExists: isClientActor,
  });

  const { doc, writeBatch, serverTimestamp } = await import('firebase/firestore');

  let writes: PreparedWrite[];
  if (isClientActor) {
    await fillMissingClientBaselines(db, planned, existing, actor.organizationId?.trim() || null);
    writes = projectClientWrites(planned, existing, serverTimestamp);
  } else {
    writes = planned.map((write) => ({
      path: write.path,
      data: prepareDocForWrite(write.row, serverTimestamp, existing.has(write.path), write.options),
    }));
  }

  let written = 0;
  let batch = writeBatch(db);
  let batchWrites: PreparedWrite[] = [];

  const flush = async () => {
    if (batchWrites.length === 0) return;
    await batch.commit();
    for (const write of batchWrites) {
      knownRemoteDocPaths.add(write.path);
      if (write.confirmed) {
        remoteBaseline.set(write.path, { ...(remoteBaseline.get(write.path) ?? {}), ...write.confirmed });
      }
    }
    batch = writeBatch(db!);
    batchWrites = [];
  };

  for (const write of writes) {
    batch.set(doc(db, write.path), write.data, { merge: true });
    batchWrites.push(write);
    written += 1;
    if (batchWrites.length >= 400) await flush();
  }

  await flush();
  return { ok: true, message: `Importados ${written} documentos a Firestore.`, written };
}

interface PlannedWrite {
  path: string;
  /** Parent client id for subcollection docs; null for the root client doc. */
  envelopeClientId: string | null;
  /** `root`, `profile`, `dossier`, or the Firestore subcollection name. */
  collection: string;
  row: Record<string, unknown>;
  options?: PrepareDocOptions;
}

interface PreparedWrite {
  path: string;
  data: Record<string, unknown>;
  /** Local values the write makes server state once committed (CLIENT baseline). */
  confirmed?: Record<string, unknown>;
}

/**
 * CLIENT write contract per collection, mirroring firestore.rules. Collections absent here
 * are ADMIN/SYSTEM-owned and never written by CLIENT persistence.
 * `create`: whole new docs may be sent. `update`: fields a CLIENT may change on existing docs.
 * `canUpdate`: rule-level transition shape the local row must already satisfy.
 */
interface ClientWritePolicy {
  create: boolean | ((row: Record<string, unknown>) => boolean);
  createKeys?: readonly string[];
  update: readonly string[];
  canUpdate?: (row: Record<string, unknown>) => boolean;
}

const CLIENT_PROFILE_KEYS = [
  'organizationId', 'clientId',
  'identity', 'goals', 'audience', 'career', 'education', 'careerHistory',
  'ventures', 'keyPublications', 'socialLinks', 'voicePreferences',
  'facts', 'cvExtractedText', 'onboardingCompleted', 'onboardingCurrentStep',
  'updatedAt',
] as const;

const CLIENT_WRITE_POLICIES: Readonly<Record<string, ClientWritePolicy>> = {
  root: {
    create: false,
    update: [
      'userId', 'onboardingStatus', 'profileCompleteness', 'status',
      'displayName', 'firstName', 'lastName', 'profession', 'company',
      'targetMarket', 'completedTasksCount', 'updatedAt',
    ],
  },
  profile: {
    create: true,
    createKeys: CLIENT_PROFILE_KEYS,
    update: CLIENT_PROFILE_KEYS.filter((key) => key !== 'organizationId' && key !== 'clientId'),
  },
  tasks: {
    create: false,
    update: ['status', 'clientNotes', 'evidenceUrl', 'completedAt', 'updatedAt'],
  },
  deliveries: {
    create: false,
    update: ['status', 'acknowledgedAt', 'clientAckNote', 'updatedAt'],
    canUpdate: (row) => row.status === 'ACKNOWLEDGED',
  },
  contents: {
    create: false,
    update: [
      'title', 'body', 'clientFeedback', 'clientReviewBaseline',
      'pipelineStatus', 'status', 'updatedAt',
    ],
  },
  opportunities: {
    create: false,
    update: [
      'clientDecision', 'clientNotes', 'status', 'lifecycleStage',
      'submissionChecklist', 'submittedAt', 'updatedAt',
    ],
  },
  theses: {
    create: false,
    update: [
      'clientApprovalStatus', 'clientApprovedAt', 'clientFeedback',
      'pendingRevision', 'status', 'updatedAt', 'updatedBy',
      'title', 'expertIdentity', 'targetAudience', 'secondaryAudience',
      'domain', 'objective', 'proofPoints', 'differentiator', 'voiceAndTone',
      'complianceRules', 'identityCurrent', 'perceptionTarget', 'audiences',
      'territories', 'objectives', 'voiceProfile', 'limits', 'priority',
    ],
  },
  results: { create: true, update: [] },
  evidence: { create: true, update: [] },
  feedbackEvents: { create: true, update: [] },
  notifications: {
    create: (row) => row.read === false,
    update: ['read', 'updatedAt'],
    canUpdate: (row) => row.read === true,
  },
};

/** Stable structural comparison of pulled (ISO-normalized) and local values. */
function sameFieldValue(a: unknown, b: unknown): boolean {
  return stableSerialize(normalizeFirestorePulledData(a)) === stableSerialize(normalizeFirestorePulledData(b));
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(',')}}`;
}

function pickKeys(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) out[key] = row[key];
  }
  return out;
}

/**
 * Existing docs the CLIENT may update but that have no server-confirmed baseline yet
 * (e.g. only seen in a cache/pending snapshot) are read once from the server so dirtiness
 * can be decided. Docs that still lack a baseline are skipped rather than blindly re-sent.
 */
async function fillMissingClientBaselines(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  planned: ReadonlyArray<PlannedWrite>,
  existing: ReadonlySet<string>,
  organizationId: string | null
) {
  const { collection, doc, getDoc, getDocs, query, where } = await import('firebase/firestore');
  const collectionsToList = new Map<string, string>();
  for (const write of planned) {
    const policy = CLIENT_WRITE_POLICIES[write.collection];
    if (!policy || policy.update.length === 0) continue;
    if (!existing.has(write.path) || remoteBaseline.has(write.path)) continue;
    if (write.envelopeClientId === null) {
      try {
        const snap = await getDoc(doc(db, write.path));
        if (snap.exists() && !isFromCache(snap) && !hasPendingWrites(snap as unknown as { id: string })) {
          remoteBaseline.set(write.path, normalizeFirestorePulledData((snap.data() ?? {}) as Record<string, unknown>));
        }
      } catch {
        // No baseline: the root doc is skipped this push.
      }
    } else if (organizationId) {
      collectionsToList.set(parentCollectionPath(write.path), write.envelopeClientId);
    }
  }
  if (collectionsToList.size === 0 || !organizationId) return;

  for (const [collectionPath, envelopeClientId] of collectionsToList) {
    try {
      const snap = await getDocs(
        query(
          collection(db, collectionPath),
          where('organizationId', '==', organizationId),
          where('clientId', '==', envelopeClientId)
        )
      );
      markRemoteDocsKnown(collectionPath, confirmedDocIds(snap.docs));
      if (!isFromCache(snap)) recordRemoteBaseline(collectionPath, snap.docs, { prune: false });
    } catch {
      // No baseline: those docs are skipped this push.
    }
  }
}

/**
 * W4 CLIENT persistence: only docs whose CLIENT-writable state differs from the server
 * baseline are sent, projected to the fields the rules let a CLIENT change. Server-stamped
 * time fields never make a doc dirty; they ride along only with a real change.
 */
function projectClientWrites(
  planned: ReadonlyArray<PlannedWrite>,
  existing: ReadonlySet<string>,
  serverTimestamp: () => unknown
): PreparedWrite[] {
  const out: PreparedWrite[] = [];
  for (const write of planned) {
    const policy = CLIENT_WRITE_POLICIES[write.collection];
    if (!policy) continue;
    const row = stripUndefinedForFirestore(write.row) as Record<string, unknown>;

    if (!existing.has(write.path)) {
      const allowed = typeof policy.create === 'function' ? policy.create(row) : policy.create;
      if (!allowed) continue;
      const source = policy.createKeys ? pickKeys(row, policy.createKeys) : row;
      const createOptions = policy.createKeys
        ? { client: write.options?.client }
        : write.options;
      const createRow =
        createOptions?.client ? ensureSubcollectionEnvelope(source, createOptions.client) : source;
      out.push({
        path: write.path,
        data: prepareDocForWrite(source, serverTimestamp, false, createOptions),
        confirmed: createRow,
      });
      continue;
    }

    if (policy.update.length === 0) continue;
    if (policy.canUpdate && !policy.canUpdate(row)) continue;
    const baseline = remoteBaseline.get(write.path);
    if (!baseline) continue;

    const changed = policy.update.filter(
      (key) => !TRUSTED_SCALAR_TIME_FIELDS.has(key) && key in row && !sameFieldValue(row[key], baseline[key])
    );
    if (changed.length === 0) continue;

    const payload = pickKeys(row, changed);
    for (const key of policy.update) {
      if (!TRUSTED_SCALAR_TIME_FIELDS.has(key) || typeof row[key] !== 'string') continue;
      if (key === 'updatedAt' || !sameFieldValue(row[key], baseline[key])) payload[key] = row[key];
    }
    out.push({
      path: write.path,
      data: prepareDocForWrite(payload, serverTimestamp, true),
      confirmed: payload,
    });
  }
  return out;
}

/**
 * Create/update signal for `createdAt`: remote existence, never the local field value.
 * Known paths exist; unknown paths in a live-listened collection are new; otherwise the
 * collection is listed with the same envelope-scoped query the rules allow for reads.
 * If existence cannot be established the doc is treated as existing so `createdAt` is never re-stamped.
 */
export async function resolveExistingDocPaths(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  writes: ReadonlyArray<Pick<PlannedWrite, 'path' | 'envelopeClientId'>>,
  context: { organizationId: string | null; rootAlwaysExists: boolean }
): Promise<Set<string>> {
  const existing = new Set<string>();
  const toProbe = new Map<string, Array<Pick<PlannedWrite, 'path' | 'envelopeClientId'>>>();

  for (const write of writes) {
    const isRoot = write.envelopeClientId === null;
    const collectionPath = parentCollectionPath(write.path);
    if (knownRemoteDocPaths.has(write.path) || (isRoot && context.rootAlwaysExists)) {
      existing.add(write.path);
    } else if (liveCollections.has(collectionPath)) {
      continue;
    } else if (!context.organizationId) {
      existing.add(write.path);
    } else {
      const group = toProbe.get(collectionPath) ?? [];
      group.push(write);
      toProbe.set(collectionPath, group);
    }
  }
  if (toProbe.size === 0) return existing;

  const { collection, getDocs, query, where } = await import('firebase/firestore');
  for (const [collectionPath, group] of toProbe) {
    const envelopeClientId = group[0].envelopeClientId;
    const scopedQuery =
      envelopeClientId === null
        ? query(collection(db, collectionPath), where('organizationId', '==', context.organizationId))
        : query(
            collection(db, collectionPath),
            where('organizationId', '==', context.organizationId),
            where('clientId', '==', envelopeClientId)
          );
    try {
      const snap = await getDocs(scopedQuery);
      markRemoteDocsKnown(collectionPath, confirmedDocIds(snap.docs));
      if (!isFromCache(snap)) recordRemoteBaseline(collectionPath, snap.docs, { prune: false });
      const pendingPaths = new Set(
        snap.docs.filter(hasPendingWrites).map((row) => `${collectionPath}/${row.id}`)
      );
      for (const write of group) {
        if (isFromCache(snap) || pendingPaths.has(write.path) || knownRemoteDocPaths.has(write.path)) {
          existing.add(write.path);
        }
      }
    } catch {
      for (const write of group) existing.add(write.path);
    }
  }
  return existing;
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

/** Subcollections whose read rule is ADMIN-only; CLIENT sessions must not query them. */
const ADMIN_ONLY_READ_SUBCOLLECTIONS: ReadonlySet<string> = new Set(['signalOutcomes']);

interface TenantReadScope {
  organizationId: string;
  isAdmin: boolean;
}

async function readTenantReadScope(): Promise<TenantReadScope | null> {
  const auth = await getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult();
  const organizationId =
    typeof token.claims.organizationId === 'string' ? token.claims.organizationId.trim() : '';
  sessionPersistenceActor = organizationId
    ? {
        role: typeof token.claims.role === 'string' ? token.claims.role : '',
        clientId: typeof token.claims.clientId === 'string' ? token.claims.clientId : null,
        organizationId,
      }
    : null;
  if (!organizationId) return null;
  return { organizationId, isAdmin: token.claims.role === 'ADMIN' };
}

export function isClientSubcollectionReadable(sub: string, scope: TenantReadScope | null): boolean {
  if (!scope) return false;
  return scope.isAdmin || !ADMIN_ONLY_READ_SUBCOLLECTIONS.has(sub);
}

/**
 * Security Rules are not filters: subcollection reads require organizationId AND clientId
 * equality so every returned doc provably satisfies the envelope rule.
 */
async function scopedClientSubcollectionQuery(
  db: NonNullable<Awaited<ReturnType<typeof getFirebaseFirestore>>>,
  clientId: string,
  sub: string,
  scope: TenantReadScope
) {
  const { collection, query, where } = await import('firebase/firestore');
  return query(
    collection(db, `${clientDocPath(clientId)}/${sub}`),
    where('organizationId', '==', scope.organizationId),
    where('clientId', '==', clientId)
  );
}

/** Descarga datos de Firestore para un cliente (o todos si admin). */
export async function pullClientDataFromFirestore(
  clientIds: string[]
): Promise<Partial<LocalV5Snapshot>> {
  const db = await getFirebaseFirestore();
  if (!db) return {};

  const { doc, getDoc, getDocs } = await import('firebase/firestore');
  const scope = await readTenantReadScope();
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
      knownRemoteDocPaths.add(clientDocPath(clientId));
      if (!isFromCache(clientSnap) && !hasPendingWrites(clientSnap as unknown as { id: string })) {
        remoteBaseline.set(
          clientDocPath(clientId),
          normalizeFirestorePulledData((clientSnap.data() ?? {}) as Record<string, unknown>)
        );
      }
      partial.clients!.push(
        normalizeFirestorePulledData(clientSnap.data()) as unknown as LocalV5Snapshot['clients'][number]
      );
    }

    for (const sub of CLIENT_SUBCOLLECTIONS) {
      if (!scope || !isClientSubcollectionReadable(sub, scope)) continue;
      const snap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, sub, scope));
      markRemoteDocsKnown(`${clientDocPath(clientId)}/${sub}`, confirmedDocIds(snap.docs));
      if (!isFromCache(snap)) {
        recordRemoteBaseline(`${clientDocPath(clientId)}/${sub}`, snap.docs, { prune: true });
      }
      const targetKey = Object.entries(COLLECTION_MAP).find(([, v]) => v === sub)?.[0] as CollectionKey | undefined;
      if (!targetKey || !Array.isArray(partial[targetKey])) continue;
      for (const row of snap.docs) {
        (partial[targetKey] as unknown[]).push(
          normalizeFirestorePulledData({ id: row.id, ...row.data() })
        );
      }
    }

    if (!scope) continue;

    // A missing singleton doc is denied (not "absent") by envelope rules; list it scoped instead.
    const profileSnap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, 'profile', scope));
    markRemoteDocsKnown(`${clientDocPath(clientId)}/profile`, confirmedDocIds(profileSnap.docs));
    if (!isFromCache(profileSnap)) {
      recordRemoteBaseline(`${clientDocPath(clientId)}/profile`, profileSnap.docs, { prune: true });
    }
    const profileDoc = profileSnap.docs.find((row) => row.id === 'data');
    if (profileDoc) {
      partial.profiles![clientId] = normalizeFirestorePulledData(
        profileDoc.data()
      ) as unknown as LocalV5Snapshot['profiles'][string];
    }

    const dossierSnap = await getDocs(await scopedClientSubcollectionQuery(db, clientId, 'dossier', scope));
    markRemoteDocsKnown(`${clientDocPath(clientId)}/dossier`, confirmedDocIds(dossierSnap.docs));
    const dossierDoc = dossierSnap.docs.find((row) => row.id === 'data');
    if (dossierDoc) {
      partial.dossiers![clientId] = normalizeFirestorePulledData(
        dossierDoc.data()
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

/**
 * Status fields whose rules reject skipped edges (ASSIGNED→COMPLETED, SENT_TO_CLIENT→COMPLETED).
 * Other CLIENT state fields accept the direct edge, so their changes may coalesce.
 */
const EDGE_SENSITIVE_STATE_FIELDS: ReadonlyArray<readonly [CollectionKey, string]> = [
  ['tasks', 'status'],
  ['opportunities', 'status'],
];

type ClientCapture = { snapshot: LocalV5Snapshot; epoch: number };

let pendingClientCapture: ClientCapture | null = null;
/** Bumped when a CLIENT push fails: captures taken before then may carry edges that depend on it. */
let clientPushEpoch = 0;

/** Values as of scheduling time; `exportSnapshot()` shares live rows that later commands mutate. */
function captureClientSnapshot(snapshot: LocalV5Snapshot, actor: PersistenceActor): LocalV5Snapshot {
  const scoped = filterSnapshotForPersistenceActor(snapshot, actor);
  return structuredClone({ ...scoped, subscription: null, invitations: [], files: [], topicPins: [] });
}

function changesEdgeSensitiveState(pending: LocalV5Snapshot, next: LocalV5Snapshot): boolean {
  for (const [key, field] of EDGE_SENSITIVE_STATE_FIELDS) {
    const before = new Map(
      (pending[key] as unknown as Array<Record<string, unknown>>).map((row) => [row.id, row[field]])
    );
    for (const row of next[key] as unknown as Array<Record<string, unknown>>) {
      if (before.has(row.id) && before.get(row.id) !== row[field]) return true;
    }
  }
  return false;
}

function dispatchClientCapture(capture: ClientCapture) {
  void enqueueSnapshotImport(async () => {
    if (capture.epoch !== clientPushEpoch) {
      return { ok: true, message: 'Cambios descartados tras un error de sincronización.', written: 0 };
    }
    try {
      const result = await runSnapshotImport(capture.snapshot);
      if (!result.ok) clientPushEpoch += 1;
      return result;
    } catch (err) {
      clientPushEpoch += 1;
      throw err;
    }
  }).then((result) => {
    if (!result.ok) pushErrorHandler?.(result.message);
  }).catch((err) => {
    const message = err instanceof Error ? err.message : 'Error al sincronizar con Firestore.';
    pushErrorHandler?.(message);
  });
}

/**
 * CLIENT pushes keep every edge-sensitive transition: a pending capture is persisted, never
 * dropped, before a capture that moves one of its edge-sensitive states again.
 */
function scheduleClientPush(snapshot: LocalV5Snapshot, actor: PersistenceActor) {
  const capture: ClientCapture = { snapshot: captureClientSnapshot(snapshot, actor), epoch: clientPushEpoch };
  if (pendingClientCapture && changesEdgeSensitiveState(pendingClientCapture.snapshot, capture.snapshot)) {
    dispatchClientCapture(pendingClientCapture);
  }
  pendingClientCapture = capture;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const due = pendingClientCapture;
    pendingClientCapture = null;
    if (due) dispatchClientCapture(due);
  }, 800);
}

export function scheduleFirestorePush(snapshot: LocalV5Snapshot) {
  if (!isFirestoreAuthoritative()) return;
  const actor = sessionPersistenceActor;
  if (actor?.role === 'CLIENT' && actor.clientId) {
    scheduleClientPush(snapshot, actor);
    return;
  }
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
  liveCollections.clear();
  sessionPersistenceActor = null;
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

  const { onSnapshot } = await import('firebase/firestore');
  const scope = await readTenantReadScope();
  if (!scope) return;

  const listen = async (clientId: string, sub: string, snapshotKey: CollectionKey) => {
    if (!isClientSubcollectionReadable(sub, scope)) return;
    const scopedQuery = await scopedClientSubcollectionQuery(db, clientId, sub, scope);
    const unsub = onSnapshot(scopedQuery, (snap: import('firebase/firestore').QuerySnapshot) => {
      const collectionPath = `${clientDocPath(clientId)}/${sub}`;
      if (isFromCache(snap) || snap.docs.some(hasPendingWrites)) {
        liveCollections.delete(collectionPath);
        markRemoteDocsKnown(collectionPath, confirmedDocIds(snap.docs));
        if (!isFromCache(snap)) recordRemoteBaseline(collectionPath, snap.docs, { prune: false });
      } else {
        applyLiveCollectionSnapshot(collectionPath, snap.docs.map((docSnap) => docSnap.id));
        recordRemoteBaseline(collectionPath, snap.docs, { prune: true });
      }
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
      await listen(clientId, sub, (REALTIME_KEY_MAP[sub] || sub) as CollectionKey);
    }
    // Evidence usa nombre distinto en el snapshot local.
    await listen(clientId, 'evidence', 'evidenceVault');
  }
}
