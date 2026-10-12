import { getFirebaseFirestore } from '../../firebase/app';
import type { StrategicBriefHistoryRecord } from '../../domain/strategicBriefCore';
import {
  historyIdentity,
  type RemoteStrategicBriefRecords,
  type StrategicBriefRecordSet,
} from '../../infrastructure/strategicBrief';
import { clientDocPath } from './paths';
import {
  isFirestoreAuthoritative,
  normalizeFirestorePulledData,
  reportFirestorePushError,
  stripUndefinedForFirestore,
} from './sync';

/**
 * ADMIN-only Strategic Brief persistence. Brief records are written as-is, in their own
 * batches, so a rejected Brief write can never roll back the main snapshot push.
 */
export const STRATEGIC_BRIEF_SUBCOLLECTIONS = {
  briefs: 'strategicBriefs',
  history: 'strategicBriefHistory',
  overrides: 'strategicBriefOverrides',
} as const;

const BATCH_LIMIT = 400;
const PUSH_DEBOUNCE_MS = 800;

export interface StrategicBriefWrite {
  path: string;
  data: Record<string, unknown>;
  fingerprint: string;
}

export interface StrategicBriefPlan {
  writes: StrategicBriefWrite[];
  skipped: number;
}

export interface StrategicBriefPushResult {
  ok: boolean;
  written: number;
  message?: string;
}

let activeOrganizationId: string | null = null;
/** Path → fingerprint of the copy known to be on the server. */
const serverFingerprints = new Map<string, string>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushQueue: Promise<unknown> = Promise.resolve();

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

const MAX_DOC_ID_BYTES = 1500;

function isUsableDocId(id: string): boolean {
  return (
    id.length > 0 &&
    new TextEncoder().encode(id).length <= MAX_DOC_ID_BYTES &&
    !id.includes('/') &&
    id !== '.' &&
    id !== '..' &&
    !/^__.*__$/.test(id)
  );
}

function plannedWrite(
  clientId: string,
  subcollection: string,
  docId: string,
  record: object
): StrategicBriefWrite | undefined {
  if (!isUsableDocId(clientId) || !isUsableDocId(docId)) return undefined;
  const data: Record<string, unknown> = stripUndefinedForFirestore({ ...record });
  return {
    path: `${clientDocPath(clientId)}/${subcollection}/${docId}`,
    data,
    fingerprint: stableStringify(data),
  };
}

/** History identities embed the material fingerprint, which can exceed Firestore's id limit. */
export async function strategicBriefHistoryDocId(entry: StrategicBriefHistoryRecord): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(historyIdentity(entry)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Writes for the records of one organization whose server copy is missing or differs.
 * Records of other organizations, or with ids Firestore cannot address, are skipped.
 */
export async function planStrategicBriefWrites(
  records: StrategicBriefRecordSet,
  organizationId: string,
  known: ReadonlyMap<string, string>
): Promise<StrategicBriefPlan> {
  const candidates: Array<StrategicBriefWrite | undefined> = [];
  let skipped = 0;
  const consider = (recordOrg: string, build: () => StrategicBriefWrite | undefined) => {
    if (recordOrg !== organizationId) {
      skipped += 1;
      return;
    }
    const write = build();
    if (!write) skipped += 1;
    candidates.push(write);
  };
  for (const brief of records.briefs) {
    consider(brief.organizationId, () =>
      plannedWrite(brief.clientId, STRATEGIC_BRIEF_SUBCOLLECTIONS.briefs, brief.id, brief)
    );
  }
  for (const entry of records.history) {
    const docId = await strategicBriefHistoryDocId(entry);
    consider(entry.organizationId, () =>
      plannedWrite(entry.clientId, STRATEGIC_BRIEF_SUBCOLLECTIONS.history, docId, entry)
    );
  }
  for (const record of records.overrides) {
    consider(record.organizationId, () =>
      plannedWrite(record.clientId, STRATEGIC_BRIEF_SUBCOLLECTIONS.overrides, record.overrideId, record)
    );
  }
  const writes = candidates.filter(
    (write): write is StrategicBriefWrite => write !== undefined && known.get(write.path) !== write.fingerprint
  );
  return { writes, skipped };
}

/** Enables pushes for an ADMIN session of `organizationId`. */
export function startStrategicBriefSync(organizationId: string): void {
  if (activeOrganizationId !== organizationId) serverFingerprints.clear();
  activeOrganizationId = organizationId;
}

export function stopStrategicBriefSync(): void {
  activeOrganizationId = null;
  serverFingerprints.clear();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
}

export async function pullStrategicBriefs(clientIds: readonly string[]): Promise<RemoteStrategicBriefRecords> {
  const remote = { briefs: [] as unknown[], history: [] as unknown[], overrides: [] as unknown[] };
  const organizationId = activeOrganizationId;
  if (!organizationId) return remote;
  const db = await getFirebaseFirestore();
  if (!db) return remote;
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const targets: Array<[keyof typeof STRATEGIC_BRIEF_SUBCOLLECTIONS, unknown[]]> = [
    ['briefs', remote.briefs],
    ['history', remote.history],
    ['overrides', remote.overrides],
  ];
  for (const clientId of clientIds) {
    for (const [kind, sink] of targets) {
      const collectionPath = `${clientDocPath(clientId)}/${STRATEGIC_BRIEF_SUBCOLLECTIONS[kind]}`;
      const snap = await getDocs(
        query(
          collection(db, collectionPath),
          where('organizationId', '==', organizationId),
          where('clientId', '==', clientId)
        )
      );
      for (const row of snap.docs) {
        const data: Record<string, unknown> = normalizeFirestorePulledData(row.data());
        serverFingerprints.set(`${collectionPath}/${row.id}`, stableStringify(data));
        sink.push(data);
      }
    }
  }
  return remote;
}

async function runStrategicBriefPush(records: StrategicBriefRecordSet): Promise<StrategicBriefPushResult> {
  const organizationId = activeOrganizationId;
  if (!organizationId || !isFirestoreAuthoritative()) return { ok: true, written: 0 };
  const { writes } = await planStrategicBriefWrites(records, organizationId, serverFingerprints);
  if (writes.length === 0) return { ok: true, written: 0 };
  const db = await getFirebaseFirestore();
  if (!db) return { ok: false, written: 0, message: 'Firestore no inicializado.' };
  const { doc, writeBatch } = await import('firebase/firestore');
  let written = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const write of chunk) batch.set(doc(db, write.path), write.data);
    try {
      await batch.commit();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, written, message: `No se pudieron sincronizar los briefs: ${reason}` };
    }
    for (const write of chunk) serverFingerprints.set(write.path, write.fingerprint);
    written += chunk.length;
  }
  return { ok: true, written };
}

/** Pushes now, after any push already in flight. */
export function pushStrategicBriefs(records: StrategicBriefRecordSet): Promise<StrategicBriefPushResult> {
  const run = pushQueue.then(() => runStrategicBriefPush(records));
  pushQueue = run.catch(() => undefined);
  return run;
}

/** Debounced push; `readRecords` is called when the push fires, not when it is scheduled. */
export function scheduleStrategicBriefPush(readRecords: () => StrategicBriefRecordSet): void {
  if (!activeOrganizationId) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushStrategicBriefs(readRecords())
      .then((result) => {
        if (!result.ok && result.message) reportFirestorePushError(result.message);
      })
      .catch((err) => {
        reportFirestorePushError(err instanceof Error ? err.message : 'Error al sincronizar los briefs.');
      });
  }, PUSH_DEBOUNCE_MS);
}
