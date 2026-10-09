import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
type BatchOp = { op: 'set' | 'delete'; path: string; data?: Doc; merge?: boolean };

const h = vi.hoisted(() => {
  const DELETE_FIELD = { __deleteField: true };
  const state = {
    remote: new Map<string, Record<string, unknown>>(),
    claims: {} as Record<string, unknown>,
    ops: [] as BatchOp[],
    failCommits: 0,
  };
  return { state, DELETE_FIELD };
});

vi.mock('firebase/firestore', () => {
  type Filter = { field: string; op: string; value: unknown };
  type Query = { col: { path: string }; constraints: Filter[] };
  return {
    doc: (_db: unknown, path: string) => ({ path }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    serverTimestamp: () => ({ serverTimestamp: true }),
    deleteField: () => h.DELETE_FIELD,
    writeBatch: () => {
      const pending: BatchOp[] = [];
      return {
        set(ref: { path: string }, data: Doc, options?: { merge?: boolean }) {
          pending.push({ op: 'set', path: ref.path, data, merge: Boolean(options?.merge) });
        },
        delete(ref: { path: string }) {
          pending.push({ op: 'delete', path: ref.path });
        },
        async commit() {
          if (h.state.failCommits > 0) {
            h.state.failCommits -= 1;
            throw new Error('commit failed');
          }
          for (const write of pending) {
            h.state.ops.push(write);
            if (write.op === 'delete') {
              h.state.remote.delete(write.path);
              continue;
            }
            const next: Doc = { ...(write.merge ? h.state.remote.get(write.path) ?? {} : {}) };
            for (const [key, value] of Object.entries(write.data!)) {
              if (value === h.DELETE_FIELD) delete next[key];
              else next[key] = value;
            }
            h.state.remote.set(write.path, next);
          }
        },
      };
    },
    getDoc: async (ref: { path: string }) => ({
      exists: () => h.state.remote.has(ref.path),
      data: () => h.state.remote.get(ref.path),
      metadata: { fromCache: false, hasPendingWrites: false },
    }),
    getDocs: async (q: Query) => {
      const rows = [...h.state.remote.entries()].filter(([path, data]) => {
        const cut = path.lastIndexOf('/');
        return path.slice(0, cut) === q.col.path && q.constraints.every((c) => data[c.field] === c.value);
      });
      return {
        metadata: { fromCache: false },
        docs: rows.map(([path, data]) => ({
          id: path.slice(path.lastIndexOf('/') + 1),
          data: () => data,
          metadata: { hasPendingWrites: false },
        })),
      };
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
  importSnapshotToFirestore,
  queueRemoteMutationIntents,
  resetKnownRemoteDocPaths,
} from '../src/services/firestore/sync';
import type { LocalV5Snapshot } from '../src/services/firestore/types';

const ORG = 'org_aurora_01';
const CID = 'client_juan_001';
const ELENA = 'client_elena_002';
const ROOT = `clients/${CID}`;
const ADMIN = { role: 'ADMIN', organizationId: ORG };
const CLIENT = { role: 'CLIENT', organizationId: ORG, clientId: CID };

function snapshot(parts: Partial<Record<keyof LocalV5Snapshot, unknown>>): LocalV5Snapshot {
  return { profiles: {}, dossiers: {}, clients: [client()], ...parts } as unknown as LocalV5Snapshot;
}

function client(): Doc {
  return { id: CID, organizationId: ORG, displayName: 'Juan' };
}

function curation(id: string, extra: Doc = {}): Doc {
  return { id, clientId: CID, organizationId: ORG, title: id, destination: null, managerRationale: '', ...extra };
}

function delivery(id: string, extra: Doc = {}): Doc {
  return { id, clientId: CID, organizationId: ORG, title: id, status: 'DRAFT', items: [], ...extra };
}

function seedRemote(path: string, data: Doc, clientId = CID) {
  h.state.remote.set(path, { organizationId: ORG, clientId, ...data });
}

const deletes = () => h.state.ops.filter((op) => op.op === 'delete').map((op) => op.path);

beforeEach(() => {
  h.state.remote.clear();
  h.state.ops = [];
  h.state.failCommits = 0;
  h.state.claims = ADMIN;
  resetKnownRemoteDocPaths();
  seedRemote(ROOT, { id: CID });
});

describe('importSnapshotToFirestore — explicit delete intents (ADMIN)', () => {
  it('DP-A: normal snapshot writes keep merge semantics', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1', title: 'old', remoteOnly: 'kept' });

    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_1', { title: 'new' })] }));

    expect(h.state.ops.filter((op) => op.op === 'set').every((op) => op.merge)).toBe(true);
    expect(h.state.remote.get(`${ROOT}/curation/cur_1`)).toMatchObject({ title: 'new', remoteOnly: 'kept' });
    expect(deletes()).toEqual([]);
  });

  it('DP-B: a curation delete intent deletes exactly that scoped document', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    seedRemote(`${ROOT}/curation/cur_2`, { id: 'cur_2' });
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'cur_1' }]);

    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_2')] }));

    expect(deletes()).toEqual([`${ROOT}/curation/cur_1`]);
    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(false);
    expect(h.state.remote.has(`${ROOT}/curation/cur_2`)).toBe(true);
  });

  it('DP-C: a delivery delete intent deletes exactly that scoped document', async () => {
    seedRemote(`${ROOT}/deliveries/pkg_draft`, { id: 'pkg_draft', status: 'DRAFT' });
    seedRemote(`${ROOT}/deliveries/pkg_sent`, { id: 'pkg_sent', status: 'SENT' });
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'deliveries', clientId: CID, id: 'pkg_draft' }]);

    await importSnapshotToFirestore(snapshot({ deliveries: [delivery('pkg_sent', { status: 'SENT' })] }));

    expect(deletes()).toEqual([`${ROOT}/deliveries/pkg_draft`]);
    expect(h.state.remote.has(`${ROOT}/deliveries/pkg_draft`)).toBe(false);
    expect(h.state.remote.get(`${ROOT}/deliveries/pkg_sent`)!.status).toBe('SENT');
  });

  it('DP-D: delete wins over a write of the same document in the same push', async () => {
    seedRemote(`${ROOT}/deliveries/pkg_1`, { id: 'pkg_1' });
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'deliveries', clientId: CID, id: 'pkg_1' }]);

    await importSnapshotToFirestore(snapshot({ deliveries: [delivery('pkg_1')] }));

    expect(h.state.ops.some((op) => op.op === 'set' && op.path === `${ROOT}/deliveries/pkg_1`)).toBe(false);
    expect(h.state.remote.has(`${ROOT}/deliveries/pkg_1`)).toBe(false);
  });

  it('DP-F: unrelated documents, other clients and out-of-scope intents are never deleted', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    seedRemote(`${ROOT}/curation/cur_other`, { id: 'cur_other' });
    seedRemote(`clients/${ELENA}/curation/cur_1`, { id: 'cur_1' }, ELENA);
    seedRemote(`clients/${ELENA}/curation/cur_e`, { id: 'cur_e' }, ELENA);
    queueRemoteMutationIntents([
      { kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'cur_1' },
      { kind: 'deleteDoc', collection: 'curation', clientId: ELENA, id: 'cur_e' },
    ]);

    await importSnapshotToFirestore(snapshot({ curation: [] }));

    expect(deletes()).toEqual([`${ROOT}/curation/cur_1`]);
    expect(h.state.remote.has(`${ROOT}/curation/cur_other`)).toBe(true);
    expect(h.state.remote.has(`clients/${ELENA}/curation/cur_1`)).toBe(true);
    expect(h.state.remote.has(`clients/${ELENA}/curation/cur_e`)).toBe(true);
  });

  it('DP-F2: malformed intents never reach Firestore', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    queueRemoteMutationIntents([
      { kind: 'deleteDoc', collection: 'curation', clientId: '', id: 'cur_1' },
      { kind: 'deleteDoc', collection: 'curation', clientId: CID, id: '' },
      { kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'a/b' },
      { kind: 'deleteDoc', collection: 'clients', clientId: CID, id: CID },
    ]);

    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_1')] }));

    expect(deletes()).toEqual([]);
    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(true);
  });

  it('DP-G: intents are retained when the batch commit fails', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'cur_1' }]);
    h.state.failCommits = 1;

    await expect(importSnapshotToFirestore(snapshot({ curation: [] }))).rejects.toThrow('commit failed');
    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(true);

    await importSnapshotToFirestore(snapshot({ curation: [] }));
    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(false);
  });

  it('DP-H: intents are released after a successful commit', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'cur_1' }]);
    await importSnapshotToFirestore(snapshot({ curation: [] }));
    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(false);

    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    h.state.ops = [];
    await importSnapshotToFirestore(snapshot({ curation: [] }));

    expect(deletes()).toEqual([]);
    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(true);
  });

  it('DP-K: deleting an already-absent document issues no delete and settles the intent', async () => {
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'deliveries', clientId: CID, id: 'pkg_never_pushed' }]);

    await importSnapshotToFirestore(snapshot({ deliveries: [] }));
    expect(deletes()).toEqual([]);

    seedRemote(`${ROOT}/deliveries/pkg_never_pushed`, { id: 'pkg_never_pushed' });
    await importSnapshotToFirestore(snapshot({ deliveries: [] }));
    expect(h.state.remote.has(`${ROOT}/deliveries/pkg_never_pushed`)).toBe(true);
  });

  it('DP-L: an intent survives several queued snapshots before the push runs', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1' });
    queueRemoteMutationIntents([{ kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'cur_1' }]);
    queueRemoteMutationIntents([]);

    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_2')] }));

    expect(h.state.remote.has(`${ROOT}/curation/cur_1`)).toBe(false);
  });
});

describe('importSnapshotToFirestore — explicit field clears (ADMIN)', () => {
  const decided = { id: 'cur_1', destination: 'EVIDENCE', managerRationale: 'why', decidedAt: '2026-10-01T00:00:00Z', decidedBy: 'mgr' };

  it('DP-E: cleared decision metadata becomes deleteField() alongside the normal merge write', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, decided);
    queueRemoteMutationIntents([
      { kind: 'clearFields', collection: 'curation', clientId: CID, id: 'cur_1', fields: ['decidedAt', 'decidedBy'] },
    ]);

    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_1', { title: 'reopened' })] }));

    const write = h.state.ops.find((op) => op.op === 'set' && op.path === `${ROOT}/curation/cur_1`)!;
    expect(write.merge).toBe(true);
    expect(write.data!.decidedAt).toBe(h.DELETE_FIELD);
    expect(write.data!.decidedBy).toBe(h.DELETE_FIELD);
    const stored = h.state.remote.get(`${ROOT}/curation/cur_1`)!;
    expect('decidedAt' in stored).toBe(false);
    expect('decidedBy' in stored).toBe(false);
    expect(stored).toMatchObject({ destination: null, managerRationale: '', title: 'reopened' });
  });

  it('DP-E2: a field set again locally before the push keeps its new value', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, decided);
    queueRemoteMutationIntents([
      { kind: 'clearFields', collection: 'curation', clientId: CID, id: 'cur_1', fields: ['decidedAt', 'decidedBy'] },
    ]);

    await importSnapshotToFirestore(
      snapshot({ curation: [curation('cur_1', { destination: 'ARTICLE', decidedAt: '2026-10-02T00:00:00Z', decidedBy: 'mgr2' })] })
    );

    expect(h.state.remote.get(`${ROOT}/curation/cur_1`)).toMatchObject({ decidedAt: '2026-10-02T00:00:00Z', decidedBy: 'mgr2' });
  });

  it('DP-E3: a settled clear is not re-applied on later pushes', async () => {
    seedRemote(`${ROOT}/curation/cur_1`, decided);
    queueRemoteMutationIntents([
      { kind: 'clearFields', collection: 'curation', clientId: CID, id: 'cur_1', fields: ['decidedAt', 'decidedBy'] },
    ]);
    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_1')] }));
    h.state.ops = [];

    await importSnapshotToFirestore(snapshot({ curation: [curation('cur_1')] }));

    const write = h.state.ops.find((op) => op.path === `${ROOT}/curation/cur_1`)!;
    expect('decidedAt' in write.data!).toBe(false);
  });
});

describe('importSnapshotToFirestore — CLIENT gains no removal authority', () => {
  it('DP-I/J: a CLIENT push never deletes documents or clears fields', async () => {
    h.state.claims = CLIENT;
    seedRemote(`${ROOT}/deliveries/pkg_1`, { id: 'pkg_1', status: 'SENT' });
    seedRemote(`${ROOT}/curation/cur_1`, { id: 'cur_1', decidedAt: 'x', decidedBy: 'y' });
    queueRemoteMutationIntents([
      { kind: 'deleteDoc', collection: 'deliveries', clientId: CID, id: 'pkg_1' },
      { kind: 'deleteDoc', collection: 'curation', clientId: CID, id: 'cur_1' },
      { kind: 'clearFields', collection: 'curation', clientId: CID, id: 'cur_1', fields: ['decidedAt'] },
    ]);

    await importSnapshotToFirestore(snapshot({ deliveries: [delivery('pkg_1', { status: 'SENT' })], curation: [] }));

    expect(deletes()).toEqual([]);
    expect(h.state.remote.has(`${ROOT}/deliveries/pkg_1`)).toBe(true);
    expect(h.state.remote.get(`${ROOT}/curation/cur_1`)).toMatchObject({ decidedAt: 'x', decidedBy: 'y' });
  });
});
