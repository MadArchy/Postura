import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => {
  const state = {
    remote: new Map<string, Record<string, unknown>>(),
    claims: {} as Record<string, unknown>,
    probes: [] as Array<{ collectionPath: string; filters: Array<{ field: string; op: string; value: unknown }> }>,
    probeError: false,
    pendingPaths: new Set<string>(),
    fromCache: false,
    tick: 0,
  };
  return { state };
});

vi.mock('firebase/firestore', () => {
  type Filter = { field: string; op: string; value: unknown };
  type Query = { col: { path: string }; constraints: Filter[] };
  const inCollection = (collectionPath: string) =>
    [...h.state.remote.entries()].filter(([path]) => {
      const cut = path.lastIndexOf('/');
      return path.slice(0, cut) === collectionPath;
    });
  const toSnapshot = (rows: Array<[string, Record<string, unknown>]>) => ({
    metadata: { fromCache: h.state.fromCache },
    docs: rows.map(([path, data]) => ({
      id: path.slice(path.lastIndexOf('/') + 1),
      data: () => data,
      metadata: { hasPendingWrites: h.state.pendingPaths.has(path) },
    })),
  });
  return {
    doc: (_db: unknown, path: string) => ({ path }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    serverTimestamp: () => ({ serverTimestamp: ++h.state.tick }),
    writeBatch: () => {
      const pending: Array<{ path: string; data: Record<string, unknown>; merge: boolean }> = [];
      return {
        set(ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) {
          pending.push({ path: ref.path, data, merge: Boolean(options?.merge) });
        },
        async commit() {
          for (const write of pending) {
            const prior = write.merge ? h.state.remote.get(write.path) ?? {} : {};
            h.state.remote.set(write.path, { ...prior, ...write.data });
          }
        },
      };
    },
    onSnapshot: (q: Query, callback: (snap: ReturnType<typeof toSnapshot>) => void) => {
      const rows = inCollection(q.col.path).filter(([, data]) =>
        q.constraints.every((c) => data[c.field] === c.value)
      );
      callback(toSnapshot(rows));
      return () => {};
    },
    getDoc: async (ref: { path: string }) => ({
      exists: () => h.state.remote.has(ref.path),
      data: () => h.state.remote.get(ref.path),
    }),
    getDocs: async (q: Query) => {
      h.state.probes.push({ collectionPath: q.col.path, filters: q.constraints });
      if (h.state.probeError) throw new Error('permission-denied');
      const rows = inCollection(q.col.path).filter(([, data]) =>
        q.constraints.every((c) => c.op === '==' && data[c.field] === c.value)
      );
      return toSnapshot(rows);
    },
  };
});

vi.mock('../src/firebase/app', () => ({
  getFirebaseFirestore: async () => ({}),
  getFirebaseAuth: async () => ({
    currentUser: { getIdTokenResult: async () => ({ claims: h.state.claims }) },
  }),
}));

vi.mock('../src/firebase/config', () => ({
  readFirebaseConfig: () => ({ projectId: 'demo-aurora-e2e' }),
}));

import {
  applyCreatedAtWriteOnce,
  importSnapshotToFirestore,
  pullClientDataFromFirestore,
  resetKnownRemoteDocPaths,
  startFirestoreRealtimeSync,
  stopFirestoreRealtimeSync,
} from '../src/services/firestore/sync';
import type { LocalV5Snapshot } from '../src/services/firestore/types';

const ORG = 'org_aurora_01';
const CID = 'client_juan_001';
const ROOT = `clients/${CID}`;
const T1 = { serverTimestamp: 'T1-original' };
const ADMIN = { role: 'ADMIN', organizationId: ORG };
const CLIENT = { role: 'CLIENT', organizationId: ORG, clientId: CID };

function snapshot(parts: Partial<Record<keyof LocalV5Snapshot, unknown>>): LocalV5Snapshot {
  return { profiles: {}, dossiers: {}, ...parts } as unknown as LocalV5Snapshot;
}

function client(extra: Doc = {}): Doc {
  return { id: CID, organizationId: ORG, displayName: 'Juan', createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', ...extra };
}

function task(id: string, extra: Doc = {}): Doc {
  return { id, clientId: CID, organizationId: ORG, title: id, status: 'ASSIGNED', createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z', ...extra };
}

function seedRemote(path: string, data: Doc) {
  h.state.remote.set(path, { organizationId: ORG, clientId: CID, ...data });
}

beforeEach(() => {
  h.state.remote.clear();
  h.state.probes = [];
  h.state.probeError = false;
  h.state.pendingPaths.clear();
  h.state.fromCache = false;
  h.state.tick = 0;
  h.state.claims = ADMIN;
  resetKnownRemoteDocPaths();
});

describe('applyCreatedAtWriteOnce', () => {
  const stamp = () => 'SERVER_TS';

  it('stamps createdAt with serverTimestamp for a new doc (ISO or null local value)', () => {
    expect(applyCreatedAtWriteOnce({ createdAt: '2026-01-01T00:00:00Z' }, false, stamp).createdAt).toBe('SERVER_TS');
    expect(applyCreatedAtWriteOnce({ createdAt: null }, false, stamp).createdAt).toBe('SERVER_TS');
  });

  it('omits createdAt entirely for an existing doc (ISO, null, or timestamp-like local value)', () => {
    for (const value of ['2026-01-01T00:00:00Z', null, { toDate: () => new Date() }]) {
      const out = applyCreatedAtWriteOnce({ createdAt: value, title: 'x' }, true, stamp);
      expect('createdAt' in out).toBe(false);
      expect(out.title).toBe('x');
    }
  });

  it('never adds createdAt to payloads that do not carry it', () => {
    expect('createdAt' in applyCreatedAtWriteOnce({ title: 'x' }, false, stamp)).toBe(false);
    expect('createdAt' in applyCreatedAtWriteOnce({ title: 'x' }, true, stamp)).toBe(false);
  });
});

describe('importSnapshotToFirestore — createdAt write-once', () => {
  it('CA-01: a new document receives createdAt once, as a server timestamp', async () => {
    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_new')] }));

    const created = h.state.remote.get(`${ROOT}/tasks/task_new`)!;
    expect(created.createdAt).toEqual({ serverTimestamp: expect.any(Number) });
    expect(h.state.remote.get(ROOT)!.createdAt).toEqual({ serverTimestamp: expect.any(Number) });

    const firstStamp = created.createdAt;
    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_new', { title: 'again' })] }));
    expect(h.state.remote.get(`${ROOT}/tasks/task_new`)!.createdAt).toEqual(firstStamp);
  });

  it('CA-02: an existing createdAt T1 stays T1 after update', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1', { title: 'edited' })] }));

    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.title).toBe('edited');
    expect(h.state.remote.get(ROOT)!.createdAt).toEqual(T1);
  });

  it('CA-03: an existing null createdAt is preserved, not replaced with current time', async () => {
    seedRemote(ROOT, { id: CID, createdAt: null });
    seedRemote(`${ROOT}/tasks/task_null`, { id: 'task_null', createdAt: null });

    await importSnapshotToFirestore(
      snapshot({
        clients: [client({ createdAt: null })],
        tasks: [task('task_null', { createdAt: '2026-09-29T12:00:00Z' })],
      })
    );

    expect(h.state.remote.get(`${ROOT}/tasks/task_null`)!.createdAt).toBeNull();
    expect(h.state.remote.get(ROOT)!.createdAt).toBeNull();
  });

  it('CA-03b: an existing doc without createdAt does not get one invented', async () => {
    seedRemote(`${ROOT}/tasks/task_legacy`, { id: 'task_legacy' });
    seedRemote(ROOT, { id: CID });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_legacy')] }));

    expect('createdAt' in h.state.remote.get(`${ROOT}/tasks/task_legacy`)!).toBe(false);
    expect('createdAt' in h.state.remote.get(ROOT)!).toBe(false);
  });

  it('CA-04: an ordinary update refreshes updatedAt while createdAt is unchanged', async () => {
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1, updatedAt: T1 });
    seedRemote(ROOT, { id: CID, createdAt: T1 });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1')] }));

    const updated = h.state.remote.get(`${ROOT}/tasks/task_1`)!;
    expect(updated.createdAt).toEqual(T1);
    expect(updated.updatedAt).toEqual({ serverTimestamp: expect.any(Number) });
  });

  it('CA-05: a full snapshot push never mutates existing creation timestamps', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    for (const [sub, id] of [
      ['tasks', 'task_1'],
      ['deliveries', 'pkg_1'],
      ['contents', 'c_1'],
      ['notifications', 'ntf_1'],
      ['theses', 'th_1'],
    ]) {
      seedRemote(`${ROOT}/${sub}/${id}`, { id, createdAt: T1 });
    }
    seedRemote(`${ROOT}/profile/data`, { updatedAt: T1 });

    const row = (id: string) => ({ id, clientId: CID, organizationId: ORG, createdAt: '2026-09-29T10:00:00Z', updatedAt: '2026-09-29T10:00:00Z' });
    await importSnapshotToFirestore(
      snapshot({
        clients: [client()],
        tasks: [row('task_1'), row('task_2')],
        deliveries: [row('pkg_1')],
        contents: [row('c_1')],
        notifications: [row('ntf_1'), row('ntf_2')],
        theses: [row('th_1')],
        profiles: { [CID]: { organizationId: ORG, clientId: CID, updatedAt: '2026-09-29T10:00:00Z' } },
      })
    );

    for (const path of [ROOT, `${ROOT}/tasks/task_1`, `${ROOT}/deliveries/pkg_1`, `${ROOT}/contents/c_1`, `${ROOT}/notifications/ntf_1`, `${ROOT}/theses/th_1`]) {
      expect(h.state.remote.get(path)!.createdAt, path).toEqual(T1);
    }
    expect('createdAt' in h.state.remote.get(`${ROOT}/profile/data`)!).toBe(false);
    expect(h.state.remote.get(`${ROOT}/tasks/task_2`)!.createdAt).toEqual({ serverTimestamp: expect.any(Number) });
    expect(h.state.remote.get(`${ROOT}/notifications/ntf_2`)!.createdAt).toEqual({ serverTimestamp: expect.any(Number) });
  });

  it('CA-06: root client and subcollection docs follow the same contract (CLIENT actor)', async () => {
    h.state.claims = CLIENT;
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });
    seedRemote(`${ROOT}/notifications/ntf_1`, { id: 'ntf_1', createdAt: T1, read: false });

    await importSnapshotToFirestore(
      snapshot({
        clients: [client()],
        tasks: [task('task_1', { status: 'COMPLETED' })],
        notifications: [{ id: 'ntf_1', clientId: CID, organizationId: ORG, read: true, createdAt: '2026-09-29T10:00:00Z' }],
      })
    );

    expect(h.state.remote.get(ROOT)!.createdAt).toEqual(T1);
    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
    expect(h.state.remote.get(`${ROOT}/notifications/ntf_1`)!.createdAt).toEqual(T1);
    expect(h.state.probes.some((p) => p.collectionPath === 'clients')).toBe(false);
  });
});

describe('importSnapshotToFirestore — create/update classification', () => {
  it('classifies by remote existence probed with the envelope-scoped list query', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1', { createdAt: null })] }));

    expect(h.state.probes.find((p) => p.collectionPath === `${ROOT}/tasks`)!.filters).toEqual([
      { field: 'organizationId', op: '==', value: ORG },
      { field: 'clientId', op: '==', value: CID },
    ]);
    expect(h.state.probes.find((p) => p.collectionPath === 'clients')!.filters).toEqual([
      { field: 'organizationId', op: '==', value: ORG },
    ]);
    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
  });

  it('docs known from hydration are updates without probing', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });
    await pullClientDataFromFirestore([CID]);
    h.state.probes = [];

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1')] }));

    expect(h.state.probes).toEqual([]);
    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
  });

  it('a one-shot listing never goes stale: docs created elsewhere later are still updates', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_2')] }));
    seedRemote(`${ROOT}/tasks/task_3`, { id: 'task_3', createdAt: T1 });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_3')] }));

    expect(h.state.remote.get(ROOT)!.createdAt).toEqual(T1);
    expect(h.state.remote.get(`${ROOT}/tasks/task_3`)!.createdAt).toEqual(T1);
  });

  it('collections under a live realtime listener classify absent docs as new without probing', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });
    await pullClientDataFromFirestore([CID]);
    await startFirestoreRealtimeSync([CID], () => {});
    h.state.probes = [];

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1'), task('task_2')] }));

    expect(h.state.probes).toEqual([]);
    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
    expect(h.state.remote.get(`${ROOT}/tasks/task_2`)!.createdAt).toEqual({ serverTimestamp: expect.any(Number) });
    stopFirestoreRealtimeSync();
  });

  it('pending (unacknowledged) local writes do not prove existence', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/evidence/ev_1`, { id: 'ev_1' });
    h.state.pendingPaths.add(`${ROOT}/evidence/ev_1`);
    await startFirestoreRealtimeSync([CID], () => {});
    h.state.remote.delete(`${ROOT}/evidence/ev_1`);
    h.state.pendingPaths.clear();

    await importSnapshotToFirestore(
      snapshot({ clients: [client()], evidenceVault: [{ id: 'ev_1', clientId: CID, organizationId: ORG, createdAt: '2026-09-29T10:00:00Z' }] })
    );

    expect(h.state.remote.get(`${ROOT}/evidence/ev_1`)!.createdAt).toEqual({ serverTimestamp: expect.any(Number) });
    stopFirestoreRealtimeSync();
  });

  it('a probe that sees only a pending local write treats the doc as existing (fail safe)', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_pending`, { id: 'task_pending' });
    h.state.pendingPaths.add(`${ROOT}/tasks/task_pending`);

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_pending')] }));

    expect('createdAt' in h.state.remote.get(`${ROOT}/tasks/task_pending`)!).toBe(false);
  });

  it('concurrent pushes are serialized: the second push sees the first push’s creates as existing', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });

    await Promise.all([
      importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_race')] })),
      importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_race', { title: 'second' })] })),
    ]);

    const stored = h.state.remote.get(`${ROOT}/tasks/task_race`)!;
    expect(stored.title).toBe('second');
    // Stamp order in the first push: root updatedAt (1), task createdAt (2), task updatedAt (3).
    expect(stored.createdAt).toEqual({ serverTimestamp: 2 });
    expect(stored.updatedAt).toEqual({ serverTimestamp: 5 });
  });

  it('cache-only snapshots never mark a collection live; cache-only probes fail safe', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    h.state.fromCache = true;
    await startFirestoreRealtimeSync([CID], () => {});
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1'), task('task_new')] }));

    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
    expect('createdAt' in h.state.remote.get(`${ROOT}/tasks/task_new`)!).toBe(false);
    stopFirestoreRealtimeSync();
  });

  it('fails safe: when existence cannot be established, createdAt is not written', async () => {
    h.state.probeError = true;
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });

    await importSnapshotToFirestore(snapshot({ clients: [client()], tasks: [task('task_1'), task('task_unknown')] }));

    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toEqual(T1);
    expect('createdAt' in h.state.remote.get(`${ROOT}/tasks/task_unknown`)!).toBe(false);
  });

  it('other trusted time fields keep their serverTimestamp semantics', async () => {
    seedRemote(ROOT, { id: CID, createdAt: T1 });
    seedRemote(`${ROOT}/tasks/task_1`, { id: 'task_1', createdAt: T1 });

    await importSnapshotToFirestore(
      snapshot({
        clients: [client()],
        tasks: [task('task_1', { completedAt: '2026-09-29T11:00:00Z', acknowledgedAt: '2026-09-29T11:00:00Z', submittedAt: '2026-09-29T11:00:00Z', clientApprovedAt: '2026-09-29T11:00:00Z' })],
      })
    );

    const updated = h.state.remote.get(`${ROOT}/tasks/task_1`)!;
    for (const field of ['completedAt', 'acknowledgedAt', 'submittedAt', 'clientApprovedAt', 'updatedAt']) {
      expect(updated[field], field).toEqual({ serverTimestamp: expect.any(Number) });
    }
    expect(updated.createdAt).toEqual(T1);
  });
});
