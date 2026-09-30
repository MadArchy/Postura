import { beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
type Write = { path: string; data: Doc };

const h = vi.hoisted(() => {
  const state = {
    remote: new Map<string, Record<string, unknown>>(),
    claims: {} as Record<string, unknown>,
    commits: [] as Array<Array<{ path: string; data: Record<string, unknown> }>>,
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
    [...h.state.remote.entries()].filter(([path]) => path.slice(0, path.lastIndexOf('/')) === collectionPath);
  const toSnapshot = (rows: Array<[string, Record<string, unknown>]>) => ({
    metadata: { fromCache: h.state.fromCache },
    docs: rows.map(([path, data]) => ({
      id: path.slice(path.lastIndexOf('/') + 1),
      data: () => data,
      metadata: { hasPendingWrites: h.state.pendingPaths.has(path) },
    })),
  });
  const matches = (q: Query) =>
    inCollection(q.col.path).filter(([, data]) => q.constraints.every((c) => data[c.field] === c.value));
  return {
    doc: (_db: unknown, path: string) => ({ path }),
    collection: (_db: unknown, path: string) => ({ path }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (col: { path: string }, ...constraints: Filter[]) => ({ col, constraints }),
    serverTimestamp: () => ({ serverTimestamp: ++h.state.tick }),
    writeBatch: () => {
      const pending: Array<{ path: string; data: Record<string, unknown> }> = [];
      return {
        set(ref: { path: string }, data: Record<string, unknown>) {
          pending.push({ path: ref.path, data });
        },
        async commit() {
          h.state.commits.push(pending.map((write) => ({ ...write })));
          for (const write of pending) {
            h.state.remote.set(write.path, { ...(h.state.remote.get(write.path) ?? {}), ...write.data });
          }
        },
      };
    },
    onSnapshot: (q: Query, callback: (snap: ReturnType<typeof toSnapshot>) => void) => {
      callback(toSnapshot(matches(q)));
      return () => {};
    },
    getDoc: async (ref: { path: string }) => ({
      id: ref.path.slice(ref.path.lastIndexOf('/') + 1),
      exists: () => h.state.remote.has(ref.path),
      data: () => h.state.remote.get(ref.path),
      metadata: { fromCache: h.state.fromCache, hasPendingWrites: h.state.pendingPaths.has(ref.path) },
    }),
    getDocs: async (q: Query) => toSnapshot(matches(q)),
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
  pullClientDataFromFirestore,
  resetKnownRemoteDocPaths,
  startFirestoreRealtimeSync,
  stopFirestoreRealtimeSync,
} from '../src/services/firestore/sync';
import type { LocalV5Snapshot } from '../src/services/firestore/types';

const ORG = 'org_aurora_01';
const CID = 'client_juan_001';
const ROOT = `clients/${CID}`;
const T0 = '2026-09-01T10:00:00.000Z';
const T_LOCAL = '2026-09-30T12:00:00.000Z';
const ADMIN = { role: 'ADMIN', organizationId: ORG };
const CLIENT = { role: 'CLIENT', organizationId: ORG, clientId: CID };

const SNAPSHOT_KEY: Record<string, keyof LocalV5Snapshot> = {
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
  evidence: 'evidenceVault',
  advices: 'advices',
  feedbackEvents: 'feedbackEvents',
  signalOutcomes: 'signalOutcomes',
  proofWallItems: 'proofWallItems',
  sources: 'sources',
  notifications: 'notifications',
  recommendations: 'recommendations',
  aiRuns: 'aiRuns',
};

const ADMIN_ONLY = [
  ['signals', 'sig_1'],
  ['curation', 'cur_1'],
  ['sources', 'src_1'],
  ['recommendations', 'rec_1'],
  ['campaigns', 'camp_1'],
  ['campaignMilestones', 'ms_1'],
  ['advices', 'adv_1'],
  ['proofWallItems', 'pw_1'],
  ['aiRuns', 'ai_1'],
  ['signalOutcomes', 'so_1'],
] as const;

function sub(collection: string, id: string, extra: Doc = {}) {
  h.state.remote.set(`${ROOT}/${collection}/${id}`, {
    id,
    organizationId: ORG,
    clientId: CID,
    createdAt: T0,
    updatedAt: T0,
    ...extra,
  });
}

/** Remote state mirroring the reviewed Juan snapshot shape. */
function seedFixture() {
  h.state.remote.set(ROOT, {
    id: CID,
    organizationId: ORG,
    displayName: 'Juan',
    profession: 'IP Attorney',
    internalNotes: 'manager only',
    createdBy: 'user_admin_01',
    onboardingStatus: 'COMPLETED',
    createdAt: T0,
    updatedAt: T0,
  });
  sub('tasks', 'task_1', { title: 'Task 1', status: 'ASSIGNED' });
  sub('tasks', 'task_2', { title: 'Task 2', status: 'ASSIGNED' });
  sub('deliveries', 'pkg_draft', { title: 'Draft', status: 'DRAFT' });
  sub('deliveries', 'pkg_sent', { title: 'Sent', status: 'SENT', sentAt: T0 });
  sub('deliveries', 'pkg_ack', { title: 'Acked', status: 'ACKNOWLEDGED', acknowledgedAt: T0 });
  sub('contents', 'c_1', {
    title: 'Article',
    body: 'Body',
    status: 'CLIENT_REVIEW',
    pipelineStatus: 'sent_to_client',
    stateHistory: [{ status: 'sent_to_client', at: T0 }],
  });
  sub('opportunities', 'op_1', { title: 'Panel', status: 'SENT_TO_CLIENT' });
  sub('theses', 'th_1', { title: 'Thesis', status: 'ACTIVE', clientApprovalStatus: 'PENDING' });
  sub('results', 'res_1', { metric: 'views', value: 10 });
  sub('evidence', 'ev_1', { title: 'Logo', url: 'https://example.test/logo.png' });
  sub('feedbackEvents', 'fb_1', { kind: 'LIKE' });
  sub('notifications', 'ntf_unread', { title: 'New task', body: 'b', type: 'TASK_ASSIGNED', userId: 'u', read: false });
  sub('notifications', 'ntf_read', { title: 'Old', body: 'b', type: 'SYSTEM', userId: 'u', read: true });
  for (const [collection, id] of ADMIN_ONLY) sub(collection, id, { title: `${collection} row` });
  h.state.remote.set(`${ROOT}/profile/data`, {
    organizationId: ORG,
    clientId: CID,
    identity: { selfDescription: 'Original' },
    facts: [],
    onboardingCompleted: true,
    updatedAt: T0,
  });
  h.state.remote.set(`${ROOT}/dossier/data`, { organizationId: ORG, clientId: CID, summary: 'manager dossier' });
}

/** Local snapshot as hydration would leave it (a deep copy of remote). */
function localFromRemote(): LocalV5Snapshot {
  const snap: Record<string, unknown> = { clients: [], profiles: {}, dossiers: {} };
  for (const key of Object.values(SNAPSHOT_KEY)) snap[key] = [];
  for (const [path, data] of h.state.remote) {
    const copy = structuredClone(data);
    if (path === ROOT) {
      (snap.clients as Doc[]).push(copy);
      continue;
    }
    const [, , collection, id] = path.split('/');
    if (collection === 'profile') (snap.profiles as Record<string, Doc>)[CID] = copy;
    else if (collection === 'dossier') (snap.dossiers as Record<string, Doc>)[CID] = copy;
    else (snap[SNAPSHOT_KEY[collection]] as Doc[]).push({ ...copy, id });
  }
  return snap as unknown as LocalV5Snapshot;
}

function rows(snap: LocalV5Snapshot, key: keyof LocalV5Snapshot): Doc[] {
  return snap[key] as unknown as Doc[];
}

function row(snap: LocalV5Snapshot, key: keyof LocalV5Snapshot, id: string): Doc {
  const found = rows(snap, key).find((r) => r.id === id);
  if (!found) throw new Error(`missing ${String(key)}/${id}`);
  return found;
}

function writes(): Write[] {
  return h.state.commits.flat();
}

function writeTo(path: string): Write | undefined {
  return writes().find((w) => w.path === path);
}

const isServerStamp = (value: unknown) =>
  typeof value === 'object' && value !== null && 'serverTimestamp' in (value as Doc);

async function hydrateAsClient() {
  h.state.claims = CLIENT;
  await pullClientDataFromFirestore([CID]);
  h.state.commits = [];
}

beforeEach(() => {
  h.state.remote.clear();
  h.state.commits = [];
  h.state.pendingPaths.clear();
  h.state.fromCache = false;
  h.state.tick = 0;
  h.state.claims = CLIENT;
  resetKnownRemoteDocPaths();
  seedFixture();
});

describe('CLIENT persistence — dirty documents only (W4)', () => {
  it('CW-01: idle CLIENT persistence writes zero unchanged documents', async () => {
    await hydrateAsClient();

    const result = await importSnapshotToFirestore(localFromRemote());

    expect(result.ok).toBe(true);
    expect(result.written).toBe(0);
    expect(writes()).toEqual([]);
  });

  it('CW-02: a legitimate existing task transition persists without rewriting unrelated documents', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), { status: 'VIEWED', updatedAt: T_LOCAL });

    const result = await importSnapshotToFirestore(local);

    expect(result.ok).toBe(true);
    expect(writes().map((w) => w.path)).toEqual([`${ROOT}/tasks/task_1`]);
    const data = writeTo(`${ROOT}/tasks/task_1`)!.data;
    expect(Object.keys(data).sort()).toEqual(['status', 'updatedAt']);
    expect(data.status).toBe('VIEWED');
    expect(isServerStamp(data.updatedAt)).toBe(true);
    const stored = h.state.remote.get(`${ROOT}/tasks/task_1`)!;
    expect(stored.status).toBe('VIEWED');
    expect(stored.title).toBe('Task 1');
    expect(stored.createdAt).toBe(T0);
  });

  it('CW-02b: task completion carries the server-stamped completedAt the rules require', async () => {
    h.state.remote.set(`${ROOT}/tasks/task_1`, { ...h.state.remote.get(`${ROOT}/tasks/task_1`)!, status: 'VIEWED' });
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), {
      status: 'COMPLETED',
      completedAt: T_LOCAL,
      clientNotes: 'done',
      updatedAt: T_LOCAL,
    });

    await importSnapshotToFirestore(local);

    const data = writeTo(`${ROOT}/tasks/task_1`)!.data;
    expect(Object.keys(data).sort()).toEqual(['clientNotes', 'completedAt', 'status', 'updatedAt']);
    expect(isServerStamp(data.completedAt)).toBe(true);
  });

  it('CW-03: existing results are not rewritten, even if local copies drift', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'results', 'res_1'), { value: 999, updatedAt: T_LOCAL });

    await importSnapshotToFirestore(local);

    expect(writeTo(`${ROOT}/results/res_1`)).toBeUndefined();
    expect(h.state.remote.get(`${ROOT}/results/res_1`)!.value).toBe(10);
  });

  it('CW-04: existing evidence documents are not rewritten', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'evidenceVault', 'ev_1'), { title: 'Edited locally' });

    await importSnapshotToFirestore(local);

    expect(writeTo(`${ROOT}/evidence/ev_1`)).toBeUndefined();
  });

  it('CW-05: existing feedbackEvents are not rewritten', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'feedbackEvents', 'fb_1'), { kind: 'DISLIKE' });

    await importSnapshotToFirestore(local);

    expect(writeTo(`${ROOT}/feedbackEvents/fb_1`)).toBeUndefined();
  });

  it('CW-06: genuinely new result / evidence / feedback documents are created with envelope and server createdAt', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    rows(local, 'results').push({ id: 'res_2', clientId: CID, metric: 'leads', value: 3, createdAt: T_LOCAL });
    rows(local, 'evidenceVault').push({ id: 'ev_2', clientId: CID, title: 'Speaker photo', createdAt: T_LOCAL });
    rows(local, 'feedbackEvents').push({ id: 'fb_2', clientId: CID, kind: 'LIKE', createdAt: T_LOCAL });

    await importSnapshotToFirestore(local);

    expect(writes().map((w) => w.path).sort()).toEqual(
      [`${ROOT}/evidence/ev_2`, `${ROOT}/feedbackEvents/fb_2`, `${ROOT}/results/res_2`].sort()
    );
    for (const w of writes()) {
      expect(w.data.organizationId).toBe(ORG);
      expect(w.data.clientId).toBe(CID);
      expect(isServerStamp(w.data.createdAt)).toBe(true);
    }
  });

  it('CW-07: unchanged unread notifications (and admin-side drift on them) are not written', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'notifications', 'ntf_unread'), { title: 'Locally renamed' });

    await importSnapshotToFirestore(local);

    expect(writeTo(`${ROOT}/notifications/ntf_unread`)).toBeUndefined();
    expect(writes()).toEqual([]);
  });

  it('CW-08: a notification read transition sends only the allowed fields; read→unread is never sent', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'notifications', 'ntf_unread'), { read: true, updatedAt: T_LOCAL, title: 'drift' });
    Object.assign(row(local, 'notifications', 'ntf_read'), { read: false });

    await importSnapshotToFirestore(local);

    expect(writes().map((w) => w.path)).toEqual([`${ROOT}/notifications/ntf_unread`]);
    const data = writeTo(`${ROOT}/notifications/ntf_unread`)!.data;
    expect(Object.keys(data).sort()).toEqual(['read', 'updatedAt']);
    expect(data.read).toBe(true);
  });

  it('CW-09: a delivery acknowledgement sends only the acknowledgement mutation', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'deliveries', 'pkg_sent'), {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: T_LOCAL,
      clientAckNote: 'Lo reviso esta semana',
      updatedAt: T_LOCAL,
      title: 'drift',
    });
    Object.assign(row(local, 'deliveries', 'pkg_draft'), { title: 'Draft edited locally' });
    rows(local, 'deliveries').push({ id: 'pkg_new', clientId: CID, status: 'SENT', title: 'client-made' });

    await importSnapshotToFirestore(local);

    expect(writes().map((w) => w.path)).toEqual([`${ROOT}/deliveries/pkg_sent`]);
    const data = writeTo(`${ROOT}/deliveries/pkg_sent`)!.data;
    expect(Object.keys(data).sort()).toEqual(['acknowledgedAt', 'clientAckNote', 'status', 'updatedAt']);
    expect(data.status).toBe('ACKNOWLEDGED');
    expect(isServerStamp(data.acknowledgedAt)).toBe(true);
    expect(h.state.remote.has(`${ROOT}/deliveries/pkg_new`)).toBe(false);
  });

  it('CW-10: admin-only collections, dossier and client-made admin-owned docs are excluded', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    for (const [collection, id] of ADMIN_ONLY) {
      Object.assign(row(local, SNAPSHOT_KEY[collection], id), { title: 'edited by client' });
      rows(local, SNAPSHOT_KEY[collection]).push({ id: `${id}_new`, clientId: CID, title: 'new' });
    }
    (local.dossiers as Record<string, Doc>)[CID] = { organizationId: ORG, clientId: CID, summary: 'client edit' };
    rows(local, 'tasks').push({ id: 'task_client_made', clientId: CID, status: 'ASSIGNED', title: 'x', createdAt: T_LOCAL });
    rows(local, 'contents').push({ id: 'c_client_made', clientId: CID, status: 'CLIENT_REVIEW', createdAt: T_LOCAL });
    rows(local, 'opportunities').push({ id: 'op_client_made', clientId: CID, status: 'SENT_TO_CLIENT' });
    rows(local, 'theses').push({ id: 'th_client_made', clientId: CID, status: 'ACTIVE' });

    const result = await importSnapshotToFirestore(local);

    expect(result.ok).toBe(true);
    expect(writes()).toEqual([]);
  });

  it('CW-11: root client persistence projects only CLIENT-allowed fields', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(local.clients[0] as unknown as Doc, {
      displayName: 'Juan J. Vasquez',
      internalNotes: 'client tried this',
      createdBy: 'someone',
      organizationId: 'org_other',
      createdAt: T_LOCAL,
      updatedAt: T_LOCAL,
    });

    await importSnapshotToFirestore(local);

    expect(writes().map((w) => w.path)).toEqual([ROOT]);
    const data = writeTo(ROOT)!.data;
    expect(Object.keys(data).sort()).toEqual(['displayName', 'updatedAt']);
    const stored = h.state.remote.get(ROOT)!;
    expect(stored.organizationId).toBe(ORG);
    expect(stored.internalNotes).toBe('manager only');
    expect(stored.createdAt).toBe(T0);
  });

  it('CW-11b: root admin-only drift alone does not write the root', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(local.clients[0] as unknown as Doc, { internalNotes: 'drift', updatedAt: T_LOCAL });

    await importSnapshotToFirestore(local);

    expect(writes()).toEqual([]);
  });

  it('CW-12: profile persistence projects only allowed profile keys (update and create)', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign((local.profiles as Record<string, Doc>)[CID], {
      identity: { selfDescription: 'Updated' },
      secretAdminField: 'nope',
      createdAt: T_LOCAL,
      updatedAt: T_LOCAL,
    });

    await importSnapshotToFirestore(local);

    const data = writeTo(`${ROOT}/profile/data`)!.data;
    expect(Object.keys(data).sort()).toEqual(['identity', 'updatedAt']);

    resetKnownRemoteDocPaths();
    h.state.remote.delete(`${ROOT}/profile/data`);
    await hydrateAsClient();
    await importSnapshotToFirestore(local);

    const created = writeTo(`${ROOT}/profile/data`)!.data;
    expect(Object.keys(created).sort()).toEqual(
      ['clientId', 'facts', 'identity', 'onboardingCompleted', 'organizationId', 'updatedAt'].sort()
    );
    expect(created.organizationId).toBe(ORG);
    expect('createdAt' in created).toBe(false);
  });

  it('CW-13: ADMIN persistence is unchanged — full snapshot, every doc, as before', async () => {
    h.state.claims = ADMIN;
    await pullClientDataFromFirestore([CID]);
    h.state.commits = [];
    const result = await importSnapshotToFirestore(localFromRemote());

    const expectedPaths = [...h.state.remote.keys()].sort();
    expect(writes().map((w) => w.path).sort()).toEqual(expectedPaths);
    expect(result.written).toBe(expectedPaths.length);
    const task = writeTo(`${ROOT}/tasks/task_1`)!.data;
    expect(task.title).toBe('Task 1');
    expect('createdAt' in task).toBe(false);
    expect(isServerStamp(task.updatedAt)).toBe(true);
  });

  it('CW-14: createdAt stays immutable on CLIENT updates and is stamped once on CLIENT creates', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), { status: 'VIEWED', createdAt: T_LOCAL });
    Object.assign(row(local, 'contents', 'c_1'), { clientFeedback: 'Looks good', createdAt: null });
    rows(local, 'results').push({ id: 'res_new', clientId: CID, value: 1, createdAt: T_LOCAL });

    await importSnapshotToFirestore(local);

    for (const w of writes()) {
      if (w.path.endsWith('/res_new')) expect(isServerStamp(w.data.createdAt)).toBe(true);
      else expect('createdAt' in w.data, w.path).toBe(false);
    }
    expect(h.state.remote.get(`${ROOT}/tasks/task_1`)!.createdAt).toBe(T0);
    expect(h.state.remote.get(`${ROOT}/contents/c_1`)!.createdAt).toBe(T0);
    const firstStamp = h.state.remote.get(`${ROOT}/results/res_new`)!.createdAt;

    await importSnapshotToFirestore(local);
    expect(h.state.remote.get(`${ROOT}/results/res_new`)!.createdAt).toEqual(firstStamp);
  });

  it('CW-15: server-stamped time fields never make a doc dirty; with a real change updatedAt is server-stamped', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), { updatedAt: T_LOCAL, completedAt: T_LOCAL });
    Object.assign(row(local, 'deliveries', 'pkg_ack'), { acknowledgedAt: T_LOCAL, updatedAt: T_LOCAL });
    Object.assign(row(local, 'opportunities', 'op_1'), { submittedAt: T_LOCAL });
    Object.assign(row(local, 'theses', 'th_1'), { clientApprovedAt: T_LOCAL });

    await importSnapshotToFirestore(local);
    expect(writes()).toEqual([]);

    Object.assign(row(local, 'theses', 'th_1'), { clientApprovalStatus: 'APPROVED' });
    await importSnapshotToFirestore(local);

    const data = writeTo(`${ROOT}/theses/th_1`)!.data;
    expect(Object.keys(data).sort()).toEqual(['clientApprovalStatus', 'clientApprovedAt', 'updatedAt']);
    expect(isServerStamp(data.updatedAt)).toBe(true);
    expect(isServerStamp(data.clientApprovedAt)).toBe(true);
  });

  it('CW-16: one changed CLIENT doc yields a batch with only that doc; stripped stateHistory never rides along', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'contents', 'c_1'), {
      pipelineStatus: 'client_in_progress',
      body: 'Edited body',
      stateHistory: [{ status: 'client_in_progress', at: T_LOCAL }],
      updatedAt: T_LOCAL,
    });

    await importSnapshotToFirestore(local);

    expect(h.state.commits).toHaveLength(1);
    expect(h.state.commits[0].map((w) => w.path)).toEqual([`${ROOT}/contents/c_1`]);
    expect(Object.keys(h.state.commits[0][0].data).sort()).toEqual(['body', 'pipelineStatus', 'updatedAt']);
  });
});

describe('CLIENT persistence — server-confirmed baseline', () => {
  it('an acknowledged write becomes baseline: repeating the push writes nothing', async () => {
    await hydrateAsClient();
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), { status: 'VIEWED', updatedAt: T_LOCAL });

    await importSnapshotToFirestore(local);
    h.state.commits = [];
    await importSnapshotToFirestore(local);

    expect(writes()).toEqual([]);
  });

  it('server-confirmed realtime snapshots feed the baseline (no pull needed)', async () => {
    h.state.claims = CLIENT;
    await startFirestoreRealtimeSync([CID], () => {});
    const local = localFromRemote();
    Object.assign(row(local, 'opportunities', 'op_1'), { status: 'IN_PROGRESS', clientDecision: 'ACCEPTED' });

    await importSnapshotToFirestore(local);

    expect(writes().map((w) => w.path)).toEqual([`${ROOT}/opportunities/op_1`]);
    expect(Object.keys(writeTo(`${ROOT}/opportunities/op_1`)!.data).sort()).toEqual([
      'clientDecision',
      'status',
      'updatedAt',
    ]);
    stopFirestoreRealtimeSync();
  });

  it('pending local writes never become baseline', async () => {
    h.state.claims = CLIENT;
    h.state.pendingPaths.add(`${ROOT}/tasks/task_1`);
    await startFirestoreRealtimeSync([CID], () => {});
    stopFirestoreRealtimeSync();
    h.state.commits = [];
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), { status: 'VIEWED' });

    await importSnapshotToFirestore(local);

    // task_1 had no confirmed baseline: it is re-read, still pending, so it is skipped rather than blindly sent.
    expect(writeTo(`${ROOT}/tasks/task_1`)).toBeUndefined();
  });

  it('cache-only data never becomes baseline: nothing is blindly re-sent', async () => {
    h.state.claims = CLIENT;
    h.state.fromCache = true;
    await pullClientDataFromFirestore([CID]);
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_1'), { status: 'VIEWED' });

    await importSnapshotToFirestore(local);

    expect(writes()).toEqual([]);
  });

  it('a missing baseline for an existing doc is filled from the server before diffing', async () => {
    h.state.claims = CLIENT;
    const local = localFromRemote();
    Object.assign(row(local, 'tasks', 'task_2'), { status: 'IN_PROGRESS' });

    await importSnapshotToFirestore(local);

    expect(writes().map((w) => w.path)).toEqual([`${ROOT}/tasks/task_2`]);
  });
});
