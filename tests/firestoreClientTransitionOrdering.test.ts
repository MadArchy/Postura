import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Doc = Record<string, unknown>;
type Write = { path: string; data: Doc };

const h = vi.hoisted(() => {
  const state = {
    remote: new Map<string, Record<string, unknown>>(),
    claims: {} as Record<string, unknown>,
    /** Every batch the SDK was asked to commit, including rejected ones. */
    attempts: [] as Array<Array<{ path: string; data: Record<string, unknown> }>>,
    commits: [] as Array<Array<{ path: string; data: Record<string, unknown> }>>,
    failNextCommit: false,
    tick: 0,
  };
  return { state };
});

/** Rule-level CLIENT edges (firestore.rules) the emulator enforces; mirrored only to judge writes. */
const LEGAL_CLIENT_EDGES: Record<string, Record<string, readonly string[]>> = {
  tasks: {
    ASSIGNED: ['VIEWED', 'IN_PROGRESS'],
    VIEWED: ['IN_PROGRESS', 'COMPLETED'],
    IN_PROGRESS: ['COMPLETED'],
  },
  opportunities: {
    SENT_TO_CLIENT: ['IN_PROGRESS', 'REJECTED'],
    RECOMMENDED: ['IN_PROGRESS', 'REJECTED'],
    IN_PROGRESS: ['COMPLETED'],
  },
};

vi.mock('firebase/firestore', () => {
  type Filter = { field: string; op: string; value: unknown };
  type Query = { col: { path: string }; constraints: Filter[] };
  const inCollection = (collectionPath: string) =>
    [...h.state.remote.entries()].filter(([path]) => path.slice(0, path.lastIndexOf('/')) === collectionPath);
  const toSnapshot = (rows: Array<[string, Record<string, unknown>]>) => ({
    metadata: { fromCache: false },
    docs: rows.map(([path, data]) => ({
      id: path.slice(path.lastIndexOf('/') + 1),
      data: () => data,
      metadata: { hasPendingWrites: false },
    })),
  });
  const matches = (q: Query) =>
    inCollection(q.col.path).filter(([, data]) => q.constraints.every((c) => data[c.field] === c.value));
  const clientEdgeDenied = (path: string, data: Record<string, unknown>) => {
    if (h.state.claims.role !== 'CLIENT' || typeof data.status !== 'string') return false;
    const collection = path.split('/')[2];
    const edges = LEGAL_CLIENT_EDGES[collection];
    const current = h.state.remote.get(path)?.status;
    if (!edges || typeof current !== 'string' || current === data.status) return false;
    return !(edges[current] ?? []).includes(data.status);
  };
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
          h.state.attempts.push(pending.map((write) => ({ ...write })));
          if (h.state.failNextCommit) {
            h.state.failNextCommit = false;
            throw new Error('unavailable');
          }
          if (pending.some((write) => clientEdgeDenied(write.path, write.data))) {
            throw new Error('PERMISSION_DENIED');
          }
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
      metadata: { fromCache: false, hasPendingWrites: false },
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
  onFirestorePushError,
  pullClientDataFromFirestore,
  resetKnownRemoteDocPaths,
  scheduleFirestorePush,
  setFirestoreAuthoritative,
} from '../src/services/firestore/sync';
import type { LocalV5Snapshot } from '../src/services/firestore/types';

const ORG = 'org_aurora_01';
const CID = 'client_juan_001';
const ROOT = `clients/${CID}`;
const T0 = '2026-09-01T10:00:00.000Z';
const T1 = '2026-09-30T12:00:00.000Z';
const T2 = '2026-09-30T12:00:00.400Z';
const ADMIN = { role: 'ADMIN', organizationId: ORG };
const CLIENT = { role: 'CLIENT', organizationId: ORG, clientId: CID };
const TASK = `${ROOT}/tasks/task_1`;
const OPP = `${ROOT}/opportunities/op_1`;

const SNAPSHOT_KEY: Record<string, keyof LocalV5Snapshot> = {
  tasks: 'tasks',
  deliveries: 'deliveries',
  contents: 'contents',
  opportunities: 'opportunities',
  results: 'results',
  theses: 'theses',
  evidence: 'evidenceVault',
  feedbackEvents: 'feedbackEvents',
  notifications: 'notifications',
};

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

function seedFixture() {
  h.state.remote.set(ROOT, {
    id: CID,
    organizationId: ORG,
    displayName: 'Juan',
    completedTasksCount: 0,
    createdAt: T0,
    updatedAt: T0,
  });
  sub('tasks', 'task_1', { title: 'Task 1', status: 'ASSIGNED' });
  sub('tasks', 'task_article', { title: 'Review article', status: 'ASSIGNED', contentId: 'c_1' });
  sub('contents', 'c_1', { title: 'Article', body: 'Body', status: 'CLIENT_REVIEW', pipelineStatus: 'sent_to_client' });
  sub('opportunities', 'op_1', { title: 'Panel', status: 'SENT_TO_CLIENT' });
  h.state.remote.set(`${ROOT}/profile/data`, {
    organizationId: ORG,
    clientId: CID,
    identity: { selfDescription: 'Original' },
    updatedAt: T0,
  });
}

/** Local store as hydration leaves it; tests mutate these rows in place like `dbService` does. */
function localFromRemote(): LocalV5Snapshot {
  const snap: Record<string, unknown> = {
    clients: [],
    profiles: {},
    dossiers: {},
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
    subscription: null,
    invitations: [],
    files: [],
    topicPins: [],
  };
  for (const key of Object.values(SNAPSHOT_KEY)) snap[key] = [];
  for (const [path, data] of h.state.remote) {
    const copy = structuredClone(data);
    if (path === ROOT) {
      (snap.clients as Doc[]).push(copy);
      continue;
    }
    const [, , collection, id] = path.split('/');
    if (collection === 'profile') (snap.profiles as Record<string, Doc>)[CID] = copy;
    else (snap[SNAPSHOT_KEY[collection]] as Doc[]).push({ ...copy, id });
  }
  return snap as unknown as LocalV5Snapshot;
}

function row(snap: LocalV5Snapshot, key: keyof LocalV5Snapshot, id: string): Doc {
  const found = (snap[key] as unknown as Doc[]).find((r) => r.id === id);
  if (!found) throw new Error(`missing ${String(key)}/${id}`);
  return found;
}

function attemptedWritesTo(path: string): Write[] {
  return h.state.attempts.flat().filter((w) => w.path === path);
}

function committedStatuses(path: string): unknown[] {
  return h.state.commits.flat().filter((w) => w.path === path && 'status' in w.data).map((w) => w.data.status);
}

/** Runs the 800 ms debounce, then waits behind every queued import with a write-free one. */
async function settle() {
  await vi.advanceTimersByTimeAsync(800);
  await importSnapshotToFirestore({ clients: [], profiles: {}, dossiers: {} } as unknown as LocalV5Snapshot);
}

async function hydrateAs(claims: Doc) {
  h.state.claims = claims;
  await pullClientDataFromFirestore([CID]);
  h.state.attempts = [];
  h.state.commits = [];
}

/** Mirrors `dbService.updateTaskStatus`: in-place mutation, counter bump on completion. */
function transitionTask(local: LocalV5Snapshot, id: string, status: string, at: string) {
  const task = row(local, 'tasks', id);
  task.status = status;
  task.updatedAt = at;
  if (status === 'COMPLETED') {
    task.completedAt = at;
    const client = local.clients[0] as unknown as Doc;
    client.completedTasksCount = Number(client.completedTasksCount ?? 0) + 1;
  }
}

let pushErrors: string[] = [];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await settle();
  h.state.remote.clear();
  h.state.attempts = [];
  h.state.commits = [];
  h.state.failNextCommit = false;
  h.state.tick = 0;
  pushErrors = [];
  onFirestorePushError((message) => pushErrors.push(message));
  resetKnownRemoteDocPaths();
  setFirestoreAuthoritative(true);
  seedFixture();
});

afterEach(() => {
  onFirestorePushError(null);
  setFirestoreAuthoritative(false);
  vi.useRealTimers();
});

describe('CLIENT transition ordering through debounced persistence (D4)', () => {
  it('DB-01: rapid ASSIGNED → VIEWED → COMPLETED persists two ordered legal edges', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();

    transitionTask(local, 'task_1', 'VIEWED', T1);
    scheduleFirestorePush(local);
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    scheduleFirestorePush(local);
    await settle();

    expect(committedStatuses(TASK)).toEqual(['VIEWED', 'COMPLETED']);
    expect(h.state.remote.get(TASK)!.status).toBe('COMPLETED');
    expect(pushErrors).toEqual([]);
  });

  it('DB-02: rapid ASSIGNED → IN_PROGRESS → COMPLETED persists two ordered legal edges', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();

    transitionTask(local, 'task_1', 'IN_PROGRESS', T1);
    scheduleFirestorePush(local);
    row(local, 'tasks', 'task_1').evidenceUrl = 'indexeddb:rec_1';
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    scheduleFirestorePush(local);
    await settle();

    expect(committedStatuses(TASK)).toEqual(['IN_PROGRESS', 'COMPLETED']);
    expect(h.state.remote.get(TASK)!.evidenceUrl).toBe('indexeddb:rec_1');
    expect(pushErrors).toEqual([]);
  });

  it('DB-03: Firestore never receives the illegal direct ASSIGNED → COMPLETED edge', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();

    transitionTask(local, 'task_1', 'VIEWED', T1);
    scheduleFirestorePush(local);
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    scheduleFirestorePush(local);
    await settle();

    const taskWrites = attemptedWritesTo(TASK).map((w) => w.data.status);
    expect(taskWrites[0]).toBe('VIEWED');
    expect(h.state.attempts).toHaveLength(h.state.commits.length);
  });

  it('DB-04: ordinary non-state edits inside the debounce window still coalesce into one push', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();
    const profile = (local.profiles as unknown as Record<string, Doc>)[CID];

    for (const text of ['Draft 1', 'Draft 2', 'Draft 3']) {
      profile.identity = { selfDescription: text };
      row(local, 'tasks', 'task_1').clientNotes = `notes ${text}`;
      scheduleFirestorePush(local);
    }
    await settle();

    expect(h.state.commits).toHaveLength(1);
    expect(h.state.commits[0].map((w) => w.path).sort()).toEqual([`${ROOT}/profile/data`, TASK].sort());
    expect(h.state.remote.get(`${ROOT}/profile/data`)!.identity).toEqual({ selfDescription: 'Draft 3' });
    expect(h.state.remote.get(TASK)!.clientNotes).toBe('notes Draft 3');
  });

  it('DB-05: a scheduled capture keeps its values after the live local state moves on', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();

    transitionTask(local, 'task_1', 'VIEWED', T1);
    scheduleFirestorePush(local);
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    await settle();

    expect(committedStatuses(TASK)).toEqual(['VIEWED']);
    expect(row(local, 'tasks', 'task_1').status).toBe('COMPLETED');
  });

  it('DB-06: a failed first edge keeps the baseline and never sends the dependent edge', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();
    h.state.failNextCommit = true;

    transitionTask(local, 'task_1', 'VIEWED', T1);
    scheduleFirestorePush(local);
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    scheduleFirestorePush(local);
    await settle();

    expect(attemptedWritesTo(TASK).map((w) => w.data.status)).toEqual(['VIEWED']);
    expect(h.state.commits).toEqual([]);
    expect(h.state.remote.get(TASK)!.status).toBe('ASSIGNED');
    expect(pushErrors).toEqual(['unavailable']);

    // Realtime converges the row back to the server state; nothing is re-sent against the kept baseline.
    Object.assign(row(local, 'tasks', 'task_1'), { status: 'ASSIGNED', updatedAt: T0 });
    delete row(local, 'tasks', 'task_1').completedAt;
    (local.clients[0] as unknown as Doc).completedTasksCount = 0;
    scheduleFirestorePush(local);
    await settle();
    expect(h.state.attempts).toHaveLength(1);

    transitionTask(local, 'task_1', 'VIEWED', T2);
    scheduleFirestorePush(local);
    await settle();
    expect(committedStatuses(TASK)).toEqual(['VIEWED']);
  });

  it('DB-07: task completion still commits the task and the parent completedTasksCount together', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();

    transitionTask(local, 'task_1', 'VIEWED', T1);
    scheduleFirestorePush(local);
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    scheduleFirestorePush(local);
    await settle();

    expect(h.state.commits).toHaveLength(2);
    expect(h.state.commits[0].map((w) => w.path)).toEqual([TASK]);
    expect(h.state.commits[1].map((w) => w.path).sort()).toEqual([ROOT, TASK].sort());
    expect(h.state.remote.get(ROOT)!.completedTasksCount).toBe(1);
  });

  it('DB-08: article open → approve keeps each command grouped in its own ordered batch', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();
    const articleTask = `${ROOT}/tasks/task_article`;

    transitionTask(local, 'task_article', 'IN_PROGRESS', T1);
    Object.assign(row(local, 'contents', 'c_1'), { pipelineStatus: 'client_in_progress', updatedAt: T1 });
    scheduleFirestorePush(local);

    Object.assign(row(local, 'contents', 'c_1'), {
      pipelineStatus: 'client_submitted',
      status: 'CLIENT_APPROVED',
      updatedAt: T2,
    });
    transitionTask(local, 'task_article', 'COMPLETED', T2);
    local.feedbackEvents.push({ id: 'fb_1', clientId: CID, kind: 'APPROVED', createdAt: T2 } as never);
    local.notifications.push({
      id: 'ntf_1', clientId: CID, userId: 'manager', type: 'CONTENT_REVIEW', title: 't', body: 'b', read: false, createdAt: T2,
    } as never);
    scheduleFirestorePush(local);
    await settle();

    expect(h.state.commits).toHaveLength(2);
    expect(h.state.commits[0].map((w) => w.path).sort()).toEqual([`${ROOT}/contents/c_1`, articleTask].sort());
    expect(h.state.commits[1].map((w) => w.path).sort()).toEqual(
      [ROOT, `${ROOT}/contents/c_1`, `${ROOT}/feedbackEvents/fb_1`, `${ROOT}/notifications/ntf_1`, articleTask].sort()
    );
    expect(committedStatuses(articleTask)).toEqual(['IN_PROGRESS', 'COMPLETED']);
    expect(h.state.remote.get(`${ROOT}/contents/c_1`)!.pipelineStatus).toBe('client_submitted');
    expect(pushErrors).toEqual([]);
  });

  it('DB-09: ADMIN scheduling is unchanged — latest live snapshot, one coalesced full push', async () => {
    await hydrateAs(ADMIN);
    const local = localFromRemote();

    transitionTask(local, 'task_1', 'VIEWED', T1);
    scheduleFirestorePush(local);
    transitionTask(local, 'task_1', 'COMPLETED', T2);
    scheduleFirestorePush(local);
    local.contents[0].title = 'Edited after scheduling';
    await settle();

    expect(h.state.commits).toHaveLength(1);
    const scheduled = h.state.commits[0];
    expect(committedStatuses(TASK)).toEqual(['COMPLETED']);
    expect(scheduled.find((w) => w.path === `${ROOT}/contents/c_1`)!.data.title).toBe('Edited after scheduling');

    h.state.commits = [];
    h.state.tick = 0;
    await importSnapshotToFirestore(local);
    expect(h.state.commits[0].map((w) => w.path)).toEqual(scheduled.map((w) => w.path));
  });

  it('DB-10: rapid opportunity accept → complete persists IN_PROGRESS before COMPLETED', async () => {
    await hydrateAs(CLIENT);
    const local = localFromRemote();

    Object.assign(row(local, 'opportunities', 'op_1'), { status: 'IN_PROGRESS', clientDecision: 'ACCEPTED', updatedAt: T1 });
    scheduleFirestorePush(local);
    Object.assign(row(local, 'opportunities', 'op_1'), { status: 'COMPLETED', submittedAt: T2, updatedAt: T2 });
    scheduleFirestorePush(local);
    await settle();

    expect(attemptedWritesTo(OPP).map((w) => w.data.status)).toEqual(['IN_PROGRESS', 'COMPLETED']);
    expect(h.state.remote.get(OPP)!.status).toBe('COMPLETED');
    expect(pushErrors).toEqual([]);
  });
});
