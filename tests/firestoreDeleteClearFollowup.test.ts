/**
 * db.ts registers exact remote mutation intents for replaced signal-outcome mirror rows and
 * cleared source `lastError`. Intent execution itself is covered by firestoreDeletePropagation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteMutationIntent } from '../src/services/firestore/sync';

const h = vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
  return { firebaseEnabled: false, queued: [] as RemoteMutationIntent[][] };
});

vi.mock('../src/firebase/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/firebase/config')>();
  return {
    ...actual,
    get FIREBASE_ENABLED() {
      return h.firebaseEnabled;
    },
  };
});

vi.mock('../src/services/firestore/sync', () => ({
  isFirestoreAuthoritative: () => true,
  queueRemoteMutationIntents: (intents: readonly RemoteMutationIntent[]) => {
    h.queued.push([...intents]);
  },
  scheduleFirestorePush: () => {},
  listFirestoreClientIds: async () => [],
  importSnapshotToFirestore: async () => ({ ok: true, message: 'ok', written: 0 }),
}));

import { dbService } from '../src/services/db';
import type { SignalOutcome, Source } from '../src/types';

const ORG = 'org_aurora_01';
const JUAN = 'client_juan_001';
const ELENA = 'client_elena_002';
const BROKEN_NIST = 'https://www.nist.gov/news-events/cybersecurity/rss.xml';

function source(over: Partial<Source> & Pick<Source, 'id'>): Source {
  return {
    organizationId: ORG,
    clientId: JUAN,
    name: over.id,
    type: 'RSS',
    url: `https://feeds.example.com/${over.id}.xml`,
    fetchIntervalMinutes: 60,
    status: 'ACTIVE',
    itemCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'user_admin_01',
    ...over,
  };
}

function outcome(over: Partial<SignalOutcome> & Pick<SignalOutcome, 'id' | 'signalId'>): SignalOutcome {
  return {
    organizationId: ORG,
    clientId: JUAN,
    kind: 'USEFUL',
    source: 'RADAR',
    actorUid: 'user_admin_01',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

/** Intents handed to the sync layer by the next `saveAll`. */
async function nextQueuedIntents(run: () => void): Promise<RemoteMutationIntent[]> {
  const before = h.queued.length;
  run();
  await vi.waitFor(() => expect(h.queued.length).toBe(before + 1));
  return h.queued[before];
}

beforeEach(() => {
  h.firebaseEnabled = true;
  h.queued = [];
});

describe('signal-outcome compatibility replacement', () => {
  beforeEach(() => {
    dbService.importSnapshot(
      {
        signalOutcomes: [
          outcome({ id: 'sout_old', signalId: 'sig_a', kind: 'USEFUL' }),
          outcome({ id: 'sout_unrelated', signalId: 'sig_b' }),
          outcome({ id: 'sout_elena', signalId: 'sig_e', clientId: ELENA }),
        ],
      },
      { merge: false, skipRemote: true }
    );
  });

  it('FU-SO1: the replaced row gets exactly one deleteDoc intent; the new row is kept', async () => {
    let created: SignalOutcome | undefined;
    const intents = await nextQueuedIntents(() => {
      created = dbService.mirrorSignalOutcomeCompatibility({
        organizationId: ORG,
        clientId: JUAN,
        signalId: 'sig_a',
        kind: 'NOT_USEFUL',
        source: 'RADAR',
        actorUid: 'user_admin_01',
      });
    });

    expect(intents).toEqual([
      { kind: 'deleteDoc', collection: 'signalOutcomes', clientId: JUAN, id: 'sout_old' },
    ]);
    expect(created!.id).not.toBe('sout_old');
    const ids = dbService.getSignalOutcomes().map((o) => o.id);
    expect(ids).toContain(created!.id);
    expect(ids).toContain('sout_unrelated');
    expect(ids).toContain('sout_elena');
    expect(ids).not.toContain('sout_old');
    expect(dbService.getSignalOutcome('sig_a')?.kind).toBe('NOT_USEFUL');
  });

  it('FU-SO2: a first verdict for a signal queues no delete', async () => {
    const intents = await nextQueuedIntents(() => {
      dbService.mirrorSignalOutcomeCompatibility({
        organizationId: ORG,
        clientId: JUAN,
        signalId: 'sig_new',
        kind: 'USEFUL',
        source: 'RADAR',
        actorUid: 'user_admin_01',
      });
    });
    expect(intents).toEqual([]);
  });

  it('FU-SO3: rows of another client or without client scope never produce a delete', async () => {
    dbService.importSnapshot(
      {
        signalOutcomes: [
          outcome({ id: 'sout_juan', signalId: 'sig_shared' }),
          outcome({ id: 'sout_elena_shared', signalId: 'sig_shared', clientId: ELENA }),
          outcome({ id: 'sout_unscoped', signalId: 'sig_shared', clientId: '' }),
        ],
      },
      { merge: false, skipRemote: true }
    );

    const intents = await nextQueuedIntents(() => {
      dbService.mirrorSignalOutcomeCompatibility({
        organizationId: ORG,
        clientId: JUAN,
        signalId: 'sig_shared',
        kind: 'NOT_USEFUL',
        source: 'RADAR',
        actorUid: 'user_admin_01',
      });
    });

    expect(intents).toEqual([
      { kind: 'deleteDoc', collection: 'signalOutcomes', clientId: JUAN, id: 'sout_juan' },
    ]);
  });
});

describe('source lastError clears', () => {
  beforeEach(() => {
    dbService.importSnapshot(
      {
        sources: [
          source({ id: 'src_err', status: 'ERROR', lastError: 'HTTP 500' }),
          source({ id: 'src_ok' }),
          source({ id: 'src_err', clientId: ELENA, status: 'ERROR', lastError: 'Elena feed down' }),
          source({ id: 'src_unscoped', clientId: null, status: 'ERROR', lastError: 'HTTP 404' }),
        ],
      },
      { merge: false, skipRemote: true }
    );
  });

  const success = { fetched: 5, accepted: 2, rejected: 3 };
  const juanSource = (id: string) => dbService.getSourcesByClient(JUAN).find((s) => s.id === id);
  const elenaSource = (id: string) => dbService.getSourcesByClient(ELENA).find((s) => s.id === id);

  it('FU-SE1: a successful run clearing a prior error queues the exact clearFields intent', async () => {
    const intents = await nextQueuedIntents(() => dbService.recordSourceRun('src_err', success));

    expect(intents).toEqual([
      { kind: 'clearFields', collection: 'sources', clientId: JUAN, id: 'src_err', fields: ['lastError'] },
    ]);
    expect(juanSource('src_err')).toMatchObject({ status: 'ACTIVE' });
    expect(juanSource('src_err')?.lastError).toBeUndefined();
    expect(elenaSource('src_err')?.lastError).toBe('Elena feed down');
  });

  it('FU-SE2: a successful run without a prior error queues no clear', async () => {
    const intents = await nextQueuedIntents(() => dbService.recordSourceRun('src_ok', success));
    expect(intents).toEqual([]);
  });

  it('FU-SE3: a failing run sets the error and queues no clear', async () => {
    const intents = await nextQueuedIntents(() =>
      dbService.recordSourceRun('src_ok', { ...success, error: 'timeout' })
    );
    expect(intents).toEqual([]);
    expect(juanSource('src_ok')).toMatchObject({ status: 'ERROR', lastError: 'timeout' });
  });

  it('FU-SE4: updateSourceStatus(clearError) clears a prior error remotely', async () => {
    const intents = await nextQueuedIntents(() =>
      dbService.updateSourceStatus('src_err', 'ACTIVE', { clearError: true })
    );
    expect(intents).toEqual([
      { kind: 'clearFields', collection: 'sources', clientId: JUAN, id: 'src_err', fields: ['lastError'] },
    ]);
  });

  it('FU-SE5: updateSourceStatus without clearError keeps the error and queues nothing', async () => {
    const intents = await nextQueuedIntents(() => dbService.updateSourceStatus('src_err', 'PAUSED'));
    expect(intents).toEqual([]);
    expect(juanSource('src_err')).toMatchObject({ status: 'PAUSED', lastError: 'HTTP 500' });
  });

  it('FU-SE6: a source without client scope never produces a clear intent', async () => {
    const intents = await nextQueuedIntents(() => dbService.recordSourceRun('src_unscoped', success));
    expect(intents).toEqual([]);
    const unscoped = dbService.getSources().find((s) => s.id === 'src_unscoped');
    expect(unscoped?.lastError).toBeUndefined();
  });

  it('FU-SE7: startup repair clears the error of a repaired scoped source only', async () => {
    dbService.importSnapshot(
      {
        sources: [
          source({ id: 'src_nist', url: BROKEN_NIST, status: 'ERROR', lastError: 'Feed vacío' }),
          source({ id: 'src_nist_unscoped', url: BROKEN_NIST, clientId: null, status: 'ERROR', lastError: 'x' }),
          source({ id: 'src_other', status: 'ERROR', lastError: 'HTTP 500' }),
        ],
      },
      { merge: false, skipRemote: true }
    );

    const intents = await nextQueuedIntents(() => dbService['repairKnownBrokenSources']());

    expect(intents).toEqual([
      { kind: 'clearFields', collection: 'sources', clientId: JUAN, id: 'src_nist', fields: ['lastError'] },
    ]);
    expect(juanSource('src_nist')).toMatchObject({ status: 'ACTIVE', url: 'https://www.nist.gov/news-events/news/rss.xml' });
    expect(juanSource('src_other')?.lastError).toBe('HTTP 500');
  });
});
