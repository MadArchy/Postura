import { describe, expect, it } from 'vitest';
import type { CreateStrategicBriefInput } from '../src/application/strategicBrief';
import { composeStrategicBrief } from '../src/composition/strategicBrief/composeStrategicBrief';
import {
  createLocalStrategicBriefStore,
  historyIdentity,
  STRATEGIC_BRIEF_CURRENT_STORE_KEY,
} from '../src/infrastructure/strategicBrief';
import type { StorageLike } from '../src/infrastructure/strategicBrief/LocalStrategicBriefStore';
import {
  planStrategicBriefWrites,
  strategicBriefHistoryDocId,
} from '../src/services/firestore/strategicBriefSync';
import type { Signal } from '../src/types';

const NOW = '2026-10-12T10:00:00.000Z';
const LATER = '2026-10-12T11:00:00.000Z';
const ORG = 'org_test';
const CLIENT = 'client_test';

const TRUSTED = { actorId: 'mgr_ana', actorRole: 'ADMIN' as const, organizationId: ORG, clientId: CLIENT, now: NOW };

function signal(): Signal {
  return {
    id: 'sig_1',
    organizationId: ORG,
    clientId: CLIENT,
    title: 'NIST CSF 2.0',
    sourceType: 'NEWS_API',
    sourceName: 'NIST',
    contentSnippet: 'Framework update',
    fingerprint: 'fp_1',
    detectedAt: NOW,
    status: 'NEW',
    aiStatus: 'NOT_REQUIRED',
    managerDecision: 'UNREVIEWED',
    thesisId: 'th_1',
    routingDecision: {
      source: 'AUTO',
      routingState: 'CLEAR',
      selectedThesisId: 'th_1',
      algorithmVersion: 'routing-v1',
      routedAt: NOW,
    },
    scoringVersion: 'scoring-v1',
    relevanceScore: 82,
    priorityBand: 'HIGH',
    scoredAt: NOW,
    recommendedDisposition: 'SAVE',
    recommendedOutputFormat: 'ARTICLE',
    whyNow: { score: 15, band: 'NOW', reason: 'NIST update' },
    scoreRationale: 'governed score snapshot',
  };
}

function createInput(): CreateStrategicBriefInput {
  return {
    trusted: TRUSTED,
    briefId: 'brief_1',
    signalIds: ['sig_1'],
    primaryAudience: 'General Counsel',
    geography: 'CO',
    territory: 'AI Governance',
    framework: 'Preventive narrative',
    strategicAngle: 'Board-ready NIST translation',
    supportingEvidenceIds: ['ev_1'],
    riskFlags: ['REGULATORY'],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'Request diagnostic',
    authorizedAction: 'CREATE_CONTENT',
    decisionRationale: 'CLEAR thesis with timely signal.',
  };
}

function memoryKv(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function harness() {
  const kv = memoryKv();
  const store = createLocalStrategicBriefStore(kv);
  const signals = { sig_1: signal() };
  const useCases = composeStrategicBrief({
    store,
    signals: {
      getSignalById: (id: string) => signals[id as keyof typeof signals],
      getEvidenceById: (id: string) => (id === 'ev_1' ? { id, organizationId: ORG, clientId: CLIENT } : undefined),
    },
  });
  return { kv, store, ...useCases };
}

/** A Brief with its history and one override audit. */
function seededHarness() {
  const h = harness();
  h.create(createInput());
  h.override({
    trusted: { ...TRUSTED, now: LATER },
    briefId: 'brief_1',
    reason: 'Tighten the angle for the board',
    fields: { strategicAngle: 'Tighter board angle' },
  });
  return h;
}

describe('T604 Strategic Brief store — commit observation, export and remote merge', () => {
  it('notifies subscribers after each committed write unit, never after a failed one', () => {
    const h = harness();
    let commits = 0;
    const unsubscribe = h.store.subscribe(() => {
      commits += 1;
    });
    h.create(createInput());
    const afterCreate = commits;
    expect(afterCreate).toBeGreaterThan(0);
    expect(() =>
      h.store.commitWriteUnit({
        briefs: [],
        history: [{ ...h.store.listHistory()[0], clientId: 'other_client', changedAt: LATER }],
      })
    ).toThrow();
    expect(commits).toBe(afterCreate);
    unsubscribe();
    h.approve({ trusted: { ...TRUSTED, now: LATER }, briefId: 'brief_1' });
    expect(commits).toBe(afterCreate);
  });

  it('round-trips every record into an empty store without notifying subscribers', () => {
    const source = seededHarness();
    const exported = source.store.exportRecords();
    expect(exported.briefs).toHaveLength(1);
    expect(exported.history.length).toBeGreaterThanOrEqual(2);
    expect(exported.overrides).toHaveLength(1);

    const target = harness();
    let commits = 0;
    target.store.subscribe(() => {
      commits += 1;
    });
    const result = target.store.mergeRemoteRecords(exported);
    expect(result).toEqual({
      merged: 1 + exported.history.length + 1,
      rejected: 0,
    });
    expect(commits).toBe(0);
    expect(target.store.exportRecords()).toEqual(exported);
    expect(target.kv.data.get(STRATEGIC_BRIEF_CURRENT_STORE_KEY)).toContain('brief_1');

    expect(target.store.mergeRemoteRecords(exported)).toEqual({ merged: 0, rejected: 0 });
  });

  it('keeps the newest Brief: higher version wins, a tie goes to the newer updatedAt', () => {
    const h = harness();
    h.create(createInput());
    const local = h.store.exportRecords().briefs[0];

    h.store.mergeRemoteRecords({
      briefs: [{ ...local, version: local.version - 1, strategicAngle: 'Older copy', updatedAt: LATER }],
      history: [],
      overrides: [],
    });
    expect(h.store.getById('brief_1', TRUSTED)?.strategicAngle).toBe(local.strategicAngle);

    h.store.mergeRemoteRecords({
      briefs: [{ ...local, strategicAngle: 'Same version, newer edit', updatedAt: LATER }],
      history: [],
      overrides: [],
    });
    expect(h.store.getById('brief_1', TRUSTED)?.strategicAngle).toBe('Same version, newer edit');

    h.store.mergeRemoteRecords({
      briefs: [{ ...local, version: local.version + 1, strategicAngle: 'Next version', updatedAt: NOW }],
      history: [],
      overrides: [],
    });
    expect(h.store.getById('brief_1', TRUSTED)?.version).toBe(local.version + 1);
  });

  it('rejects malformed remote records and Briefs whose tenant disagrees with the local copy', () => {
    const h = harness();
    h.create(createInput());
    const local = h.store.exportRecords().briefs[0];
    const result = h.store.mergeRemoteRecords({
      briefs: [{ id: 'brief_x' }, { ...local, clientId: 'client_other', version: local.version + 5 }],
      history: [{ briefId: 'brief_1' }],
      overrides: [{ overrideId: 'ovr_1' }],
    });
    expect(result).toEqual({ merged: 0, rejected: 4 });
    expect(h.store.getById('brief_1', TRUSTED)?.clientId).toBe(CLIENT);
    expect(h.store.storedBriefCount()).toBe(1);
  });
});

describe('T604 Strategic Brief Firestore write plan', () => {
  it('addresses every record under its client and keys history by a digest of its identity', async () => {
    const records = seededHarness().store.exportRecords();
    const { writes, skipped } = await planStrategicBriefWrites(records, ORG, new Map());
    expect(skipped).toBe(0);
    const paths = writes.map((write) => write.path);
    expect(paths).toContain(`clients/${CLIENT}/strategicBriefs/brief_1`);
    expect(paths).toContain(`clients/${CLIENT}/strategicBriefOverrides/${records.overrides[0].overrideId}`);
    const historyIds = new Set<string>();
    for (const entry of records.history) {
      const docId = await strategicBriefHistoryDocId(entry);
      expect(docId).toMatch(/^[0-9a-f]{64}$/);
      expect(await strategicBriefHistoryDocId({ ...entry })).toBe(docId);
      historyIds.add(docId);
      expect(paths).toContain(`clients/${CLIENT}/strategicBriefHistory/${docId}`);
    }
    expect(historyIds.size).toBe(new Set(records.history.map((entry) => historyIdentity(entry))).size);
    for (const write of writes) {
      expect(JSON.stringify(write.data)).not.toContain('undefined');
      expect(Object.values(write.data)).not.toContain(undefined);
    }
  });

  it('keeps history document ids short however long the material fingerprint is', async () => {
    const entry = seededHarness().store.exportRecords().history[0];
    const long = { ...entry, materialFingerprint: 'x'.repeat(4000) };
    const docId = await strategicBriefHistoryDocId(long);
    expect(docId).toHaveLength(64);
    expect(docId).not.toBe(await strategicBriefHistoryDocId(entry));
  });

  it('skips records the server already holds unchanged and rewrites changed ones', async () => {
    const records = seededHarness().store.exportRecords();
    const first = await planStrategicBriefWrites(records, ORG, new Map());
    const known = new Map(first.writes.map((write) => [write.path, write.fingerprint]));
    expect((await planStrategicBriefWrites(records, ORG, known)).writes).toEqual([]);

    const changed = {
      ...records,
      briefs: [{ ...records.briefs[0], version: records.briefs[0].version + 1 }],
    };
    expect((await planStrategicBriefWrites(changed, ORG, known)).writes.map((write) => write.path)).toEqual([
      `clients/${CLIENT}/strategicBriefs/brief_1`,
    ]);
  });

  it('never plans writes for another organization or for ids Firestore cannot address', async () => {
    const records = seededHarness().store.exportRecords();
    expect(await planStrategicBriefWrites(records, 'org_other', new Map())).toEqual({
      writes: [],
      skipped: records.briefs.length + records.history.length + records.overrides.length,
    });
    const unaddressable = {
      briefs: [
        { ...records.briefs[0], id: 'a/b' },
        { ...records.briefs[0], id: 'b'.repeat(1501) },
      ],
      history: [],
      overrides: [{ ...records.overrides[0], overrideId: '..' }],
    };
    expect(await planStrategicBriefWrites(unaddressable, ORG, new Map())).toEqual({ writes: [], skipped: 3 });
  });
});
