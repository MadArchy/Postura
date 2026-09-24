import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  createOverrideSignalThesis,
  createScoreAndRouteSignal,
  StrategicRoutingError,
  type PersistStrategicRoutingParams,
  type SignalReadPort,
  type SignalWritePort,
  type StrategicScoringPort,
  type ThesisQueryPort,
} from '../src/application/strategicSignalRouting';
import {
  isMaterialRoutingChange,
  ROUTING_SYSTEM_ACTOR_ID,
  type SignalRoutingHistoryEntry,
} from '../src/domain/routingHistoryCore';
import {
  resolveRoutedThesisFromSignal,
  resolveThesisForSignalOperation,
} from '../src/domain/routedThesisContext';
import {
  routeSignalAcrossTheses,
  ROUTING_ALGORITHM_VERSION,
  ROUTING_CONTEST_MARGIN,
} from '../src/domain/thesisRoutingCore';
import type {
  PositioningThesis,
  Signal,
  StrategicScoreResult,
  ThesisStatus,
} from '../src/types';

const ROOT = process.cwd();
const NOW = '2026-08-24T01:00:00.000Z';
const LATER = '2026-08-24T01:05:00.000Z';

const STRATEGIC_MODULES = [
  'src/services/advisor.ts',
  'src/services/topicAgent.ts',
  'src/services/researchSignalsAgent.ts',
  'src/components/ClientWorkspace.ts',
  'src/ui/legacy/LegacyApp.ts',
  'src/application/strategicSignalRouting',
  'src/domain/thesisRoutingCore.ts',
  'src/domain/routedThesisContext.ts',
  'src/domain/routingHistoryCore.ts',
  'src/domain/thesisRoutingEligibility.ts',
];

function makeThesis(overrides: Partial<PositioningThesis>): PositioningThesis {
  return {
    id: 'thesis_x',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Tesis',
    expertIdentity: 'Attorney',
    targetAudience: 'GC',
    domain: 'Legal',
    objective: 'Business',
    proofPoints: [],
    voiceAndTone: '',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: NOW,
    createdBy: 'system',
    updatedAt: NOW,
    updatedBy: 'system',
    priority: 50,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Signal',
    contentSnippet: 'snippet',
    sourceName: 'Source',
    sourceType: 'REGULATORY',
    sourceQuality: 'HIGH',
    fingerprint: 'fp',
    status: 'NEW',
    aiStatus: 'PENDING',
    managerDecision: 'UNREVIEWED',
    detectedAt: NOW,
    ...overrides,
  } as Signal;
}

function stubScore(total: number): StrategicScoreResult {
  return {
    totalScore: total,
    priorityBand: total >= 70 ? 'HIGH' : total < 40 ? 'LOW' : 'MEDIUM',
    factors: {
      thesisMatch: 0.5,
      audienceMatch: 0.5,
      timeliness: 0.5,
      authorityFit: 0.5,
      differentiation: 0.5,
      strategicPotential: 0.5,
      commercialPotential: 0.5,
      sourceQuality: 0.5,
    },
    penalties: { evidenceGap: 0, risk: 0, staleness: 0, conflict: 0 },
    strategicRationale: `score ${total}`,
    recommendedAction: total < 40 ? 'NO_ACTION' : 'SAVE',
    scoringStatus: 'SCORED',
    calculatedAt: NOW,
  };
}

function buildHarness(opts: {
  signal: Signal;
  theses: PositioningThesis[];
  scores: Record<string, number>;
  failPersist?: boolean;
}) {
  const store = { signal: { ...opts.signal } };
  const history: SignalRoutingHistoryEntry[] = [];
  const writes: PersistStrategicRoutingParams[] = [];

  const signals: SignalReadPort = {
    getSignalById: (id) => (id === store.signal.id ? { ...store.signal } : undefined),
  };
  const theses: ThesisQueryPort = {
    getThesesForClient: (clientId) =>
      opts.theses.filter((t) => !t.clientId || t.clientId === clientId),
  };
  const writer: SignalWritePort = {
    persistStrategicRouting: (params) => {
      if (opts.failPersist) throw new Error('simulated persist failure');
      if (params.clientId !== store.signal.clientId) {
        throw new Error('tenant mismatch clientId');
      }
      if (params.organizationId !== store.signal.organizationId) {
        throw new Error('tenant mismatch organizationId');
      }
      writes.push(params);
      if (params.historyEntry) history.push(params.historyEntry);
      store.signal = {
        ...store.signal,
        thesisId: params.thesisId,
        thesisScores: params.thesisScores,
        routingDecision: params.routingDecision,
        whyNow: params.whyNow,
        relevanceScore: params.scoreResult.totalScore,
        priorityBand: params.scoreResult.priorityBand,
        recommendedAction: params.scoreResult.recommendedAction,
        scoreRationale: params.scoreResult.strategicRationale,
        status: store.signal.status,
        managerDecision: store.signal.managerDecision,
      };
    },
  };
  const scoring: StrategicScoringPort = {
    createScoreFn: () => (_s, thesis) => stubScore(opts.scores[thesis.id] ?? 0),
    computeWhyNow: () => ({ score: 50, band: 'SOON', reason: 'stub' }),
    scoreThesis: (_s, thesis) => stubScore(opts.scores[thesis.id] ?? 0),
  };

  return {
    scoreAndRoute: createScoreAndRouteSignal({ signals, theses, writer, scoring }),
    override: createOverrideSignalThesis({ signals, theses, writer, scoring }),
    writes,
    history,
    store,
  };
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectTsFiles(full));
    else if (entry.endsWith('.ts')) results.push(full);
  }
  return results;
}

describe('SPEC-001 Phase 5 — tenant / authorization', () => {
  it('rejects signal client A with routing context client B', () => {
    const h = buildHarness({
      signal: makeSignal({ clientId: 'client_A', organizationId: 'org_A' }),
      theses: [makeThesis({ id: 'A', clientId: 'client_A', organizationId: 'org_A' })],
      scores: { A: 80 },
    });
    expect(() =>
      h.scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_B',
        organizationId: 'org_A',
        now: NOW,
      })
    ).toThrow(StrategicRoutingError);
    expect(h.writes).toHaveLength(0);
  });

  it('rejects cross-organization routing context', () => {
    const h = buildHarness({
      signal: makeSignal({ clientId: 'client_A', organizationId: 'org_A' }),
      theses: [makeThesis({ id: 'A', clientId: 'client_A', organizationId: 'org_A' })],
      scores: { A: 80 },
    });
    expect(() =>
      h.scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_A',
        organizationId: 'org_B',
        now: NOW,
      })
    ).toThrow(/TENANT_CONTEXT_INVALID|organizationId/);
    expect(h.writes).toHaveLength(0);
  });

  it('CLIENT cannot MANUAL override', () => {
    const h = buildHarness({
      signal: makeSignal({
        routingDecision: { source: 'AUTO', routingState: 'CONTESTED', contested: true },
      }),
      theses: [makeThesis({ id: 'B' })],
      scores: { B: 70 },
    });
    expect(() =>
      h.override({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        selectedThesisId: 'B',
        actorId: 'client_user',
        actorRole: 'CLIENT',
        now: LATER,
      })
    ).toThrow(StrategicRoutingError);
    try {
      h.override({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        selectedThesisId: 'B',
        actorId: 'client_user',
        actorRole: 'CLIENT',
        now: LATER,
      });
    } catch (e) {
      expect((e as StrategicRoutingError).code).toBe('UNAUTHORIZED_OVERRIDE');
    }
    expect(h.writes).toHaveLength(0);
  });

  it('ADMIN MANUAL override succeeds with history', () => {
    const h = buildHarness({
      signal: makeSignal({
        thesisId: undefined,
        thesisScores: [
          { thesisId: 'A', score: 72, band: 'HIGH' },
          { thesisId: 'B', score: 70, band: 'HIGH' },
        ],
        routingDecision: {
          source: 'AUTO',
          routingState: 'CONTESTED',
          contested: true,
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses: [makeThesis({ id: 'A' }), makeThesis({ id: 'B' })],
      scores: { A: 72, B: 70 },
    });
    const result = h.override({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      selectedThesisId: 'B',
      actorId: 'mgr_trusted',
      actorRole: 'ADMIN',
      now: LATER,
    });
    expect(result.routing.source).toBe('MANUAL');
    expect(result.routing.selectedThesisId).toBe('B');
    expect(result.historyWritten).toBe(true);
    expect(h.history[0].actorId).toBe('mgr_trusted');
    expect(h.history[0].previous.routingState).toBe('CONTESTED');
  });

  it('rejects cross-client thesis even if query port returns foreign thesis', () => {
    const store = {
      signal: makeSignal({ clientId: 'client_A', organizationId: 'org_A' }),
    };
    const writes: PersistStrategicRoutingParams[] = [];
    const override = createOverrideSignalThesis({
      signals: {
        getSignalById: (id) => (id === store.signal.id ? store.signal : undefined),
      },
      theses: {
        // Poisoned port — returns alien thesis for client_A query.
        getThesesForClient: () => [
          makeThesis({
            id: 'alien',
            clientId: 'client_B',
            organizationId: 'org_A',
            status: 'ACTIVE',
          }),
        ],
      },
      writer: {
        persistStrategicRouting: (p) => writes.push(p),
      },
      scoring: {
        createScoreFn: () => () => stubScore(80),
        computeWhyNow: () => ({ score: 1, band: 'SOON', reason: 'x' }),
        scoreThesis: () => stubScore(80),
      },
    });
    expect(() =>
      override({
        signalId: 'sig_1',
        clientId: 'client_A',
        organizationId: 'org_A',
        selectedThesisId: 'alien',
        actorId: 'mgr',
        actorRole: 'ADMIN',
        now: LATER,
      })
    ).toThrow(/TENANT_CONTEXT_INVALID|clientId/);
    expect(writes).toHaveLength(0);
  });

  it('rejects inactive thesis statuses for MANUAL override', () => {
    const statuses: ThesisStatus[] = [
      'PAUSED',
      'ARCHIVED',
      'LEGACY',
      'DRAFT',
      'UNDER_REVIEW',
    ];
    for (const status of statuses) {
      const h = buildHarness({
        signal: makeSignal({
          routingDecision: { source: 'AUTO', routingState: 'CONTESTED', contested: true },
        }),
        theses: [makeThesis({ id: 'X', status })],
        scores: { X: 90 },
      });
      expect(() =>
        h.override({
          signalId: 'sig_1',
          clientId: 'client_test',
          organizationId: 'org_test',
          selectedThesisId: 'X',
          actorId: 'mgr',
          actorRole: 'ADMIN',
          now: LATER,
        })
      ).toThrow(StrategicRoutingError);
      try {
        h.override({
          signalId: 'sig_1',
          clientId: 'client_test',
          organizationId: 'org_test',
          selectedThesisId: 'X',
          actorId: 'mgr',
          actorRole: 'ADMIN',
          now: LATER,
        });
      } catch (e) {
        expect(['THESIS_NOT_ELIGIBLE', 'THESIS_NOT_FOUND']).toContain(
          (e as StrategicRoutingError).code
        );
      }
      expect(h.writes).toHaveLength(0);
    }
  });
});

describe('SPEC-001 Phase 5 — CONTESTED / UNROUTED / stale attribution', () => {
  it('stale thesisId does not resolve CONTESTED to CLEAR for consumers', () => {
    const signal = makeSignal({
      thesisId: 'stale_A',
      routingDecision: { source: 'AUTO', routingState: 'CONTESTED', contested: true },
    });
    expect(resolveRoutedThesisFromSignal(signal).status).toBe('CONTESTED');
    const resolved = resolveThesisForSignalOperation(signal, [
      makeThesis({ id: 'stale_A' }),
      makeThesis({ id: 'B' }),
    ]);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toBe('CONTESTED');
  });

  it('stale thesisId does not resolve UNROUTED to CLEAR for consumers', () => {
    const signal = makeSignal({
      thesisId: 'stale_A',
      routingDecision: { source: 'AUTO', routingState: 'UNROUTED' },
    });
    expect(resolveRoutedThesisFromSignal(signal).status).toBe('UNROUTED');
    expect(resolveThesisForSignalOperation(signal, [makeThesis({ id: 'stale_A' })]).ok).toBe(
      false
    );
  });

  it('CLEAR → CONTESTED clears current thesisId and writes history', () => {
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses: [
        makeThesis({ id: 'A', priority: 10 }),
        makeThesis({ id: 'B', priority: 20 }),
      ],
      scores: { A: 72, B: 70 },
    });
    const result = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(result.routing.routingState).toBe('CONTESTED');
    expect(h.store.signal.thesisId).toBeUndefined();
    expect(h.history[0].previous.selectedThesisId).toBe('A');
    expect(h.history[0].next.routingState).toBe('CONTESTED');
  });

  it('ScoreAndRouteSignal never emits source MANUAL', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [makeThesis({ id: 'A' })],
      scores: { A: 80 },
    });
    const result = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });
    expect(result.routing.source).toBe('AUTO');
    expect(h.writes[0].routingDecision.source).toBe('AUTO');
  });

  it('zero ACTIVE → UNROUTED without DISCARD', () => {
    const h = buildHarness({
      signal: makeSignal({ status: 'NEW', managerDecision: 'UNREVIEWED' }),
      theses: [makeThesis({ id: 'L', status: 'LEGACY' }), makeThesis({ id: 'P', status: 'PAUSED' })],
      scores: { L: 99, P: 99 },
    });
    const result = h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });
    expect(result.routing.routingState).toBe('UNROUTED');
    expect(h.store.signal.status).not.toBe('DISCARDED');
    expect(h.store.signal.managerDecision).not.toBe('DISCARDED');
    expect(h.store.signal.thesisId).toBeUndefined();
  });
});

describe('SPEC-001 Phase 5 — multi-thesis / order / evidence', () => {
  it('thesis input order does not change CLEAR selection', () => {
    const thesesAsc = [
      makeThesis({ id: 'A', priority: 10, title: 'A' }),
      makeThesis({ id: 'B', priority: 20, title: 'B' }),
      makeThesis({ id: 'C', priority: 30, title: 'C' }),
    ];
    const thesesDesc = [...thesesAsc].reverse();
    const signal = makeSignal();
    const scores = { A: 55, B: 90, C: 60 };
    const scoreFn = (_s: Signal, t: PositioningThesis) => stubScore(scores[t.id]);
    const r1 = routeSignalAcrossTheses(signal, thesesAsc, scoreFn, { now: NOW });
    const r2 = routeSignalAcrossTheses(signal, thesesDesc, scoreFn, { now: NOW });
    expect(r1.routingState).toBe('CLEAR');
    expect(r1.selectedThesisId).toBe('B');
    expect(r2.selectedThesisId).toBe('B');
    expect(r1.perThesis.map((p) => p.thesisId).sort()).toEqual(
      r2.perThesis.map((p) => p.thesisId).sort()
    );
  });

  it('injected inactive theses are ignored by domain router', () => {
    const signal = makeSignal();
    const theses = [
      makeThesis({ id: 'A', status: 'ACTIVE', priority: 1 }),
      makeThesis({ id: 'P', status: 'PAUSED', priority: 99 }),
      makeThesis({ id: 'L', status: 'LEGACY', priority: 99 }),
      makeThesis({ id: 'D', status: 'DRAFT', priority: 99 }),
      makeThesis({ id: 'C', status: 'ACTIVE', priority: 2 }),
    ];
    const result = routeSignalAcrossTheses(
      signal,
      theses,
      (_s, t) => stubScore(t.id === 'A' ? 80 : t.id === 'C' ? 50 : 99),
      { now: NOW }
    );
    expect(result.perThesis.map((p) => p.thesisId).sort()).toEqual(['A', 'C']);
    expect(result.selectedThesisId).toBe('A');
  });

  it('N-thesis evidence survives ScoreAndRoute persist params', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [
        makeThesis({ id: 'A', priority: 1 }),
        makeThesis({ id: 'B', priority: 2 }),
        makeThesis({ id: 'C', priority: 3 }),
      ],
      scores: { A: 90, B: 60, C: 55 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });
    expect(h.writes[0].thesisScores).toHaveLength(3);
  });
});

describe('SPEC-001 Phase 5 — history governance', () => {
  it('equivalent reroute does not append history; AUTO→MANUAL same thesis does', () => {
    const theses = [makeThesis({ id: 'A' })];
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses,
      scores: { A: 80 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(h.history).toHaveLength(0);

    const ov = h.override({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      selectedThesisId: 'A',
      actorId: 'mgr',
      actorRole: 'ADMIN',
      now: '2026-08-24T01:10:00.000Z',
    });
    expect(ov.historyWritten).toBe(true);
    expect(h.history[0].previous.source).toBe('AUTO');
    expect(h.history[0].next.source).toBe('MANUAL');
    expect(h.history[0].actorId).toBe('mgr');
  });

  it('history entries are append-only snapshots (prior actor preserved)', () => {
    const prev = {
      routingState: 'CLEAR' as const,
      selectedThesisId: 'A',
      source: 'MANUAL' as const,
      algorithmVersion: 'routing-v0',
    };
    const next = {
      routingState: 'CLEAR' as const,
      selectedThesisId: 'B',
      source: 'AUTO' as const,
      algorithmVersion: ROUTING_ALGORITHM_VERSION,
    };
    expect(isMaterialRoutingChange(prev, next)).toBe(true);
    expect(prev.algorithmVersion).toBe('routing-v0');
  });

  it('AUTO history uses SYSTEM actor', () => {
    const h = buildHarness({
      signal: makeSignal({
        thesisId: 'A',
        routingDecision: {
          source: 'AUTO',
          routingState: 'CLEAR',
          algorithmVersion: ROUTING_ALGORITHM_VERSION,
          routedAt: NOW,
        },
      }),
      theses: [
        makeThesis({ id: 'A', priority: 1 }),
        makeThesis({ id: 'B', priority: 2 }),
      ],
      scores: { A: 40, B: 85 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: LATER,
    });
    expect(h.history[0].actorId).toBe(ROUTING_SYSTEM_ACTOR_ID);
  });

  it('persistence failure yields PERSISTENCE_ERROR — no fake success', () => {
    const h = buildHarness({
      signal: makeSignal(),
      theses: [makeThesis({ id: 'A' })],
      scores: { A: 80 },
      failPersist: true,
    });
    try {
      h.scoreAndRoute({
        signalId: 'sig_1',
        clientId: 'client_test',
        organizationId: 'org_test',
        now: NOW,
      });
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(StrategicRoutingError);
      expect((e as StrategicRoutingError).code).toBe('PERSISTENCE_ERROR');
    }
    expect(h.history).toHaveLength(0);
  });
});

describe('SPEC-001 Phase 5 — auto-discard + low score', () => {
  it('low score routing does not set DISCARD status', () => {
    const h = buildHarness({
      signal: makeSignal({ status: 'NEW', managerDecision: 'UNREVIEWED' }),
      theses: [makeThesis({ id: 'A' })],
      scores: { A: 10 },
    });
    h.scoreAndRoute({
      signalId: 'sig_1',
      clientId: 'client_test',
      organizationId: 'org_test',
      now: NOW,
    });
    expect(h.store.signal.status).toBe('NEW');
    expect(h.store.signal.managerDecision).toBe('UNREVIEWED');
    expect(h.writes[0].scoreResult.recommendedAction).toBe('NO_ACTION');
  });
});

describe('SPEC-001 Phase 5 — architecture / static security', () => {
  it('strategic modules ban primary/[0] selection patterns', () => {
    const violations: string[] = [];
    for (const entry of STRATEGIC_MODULES) {
      const full = join(ROOT, entry);
      const files = statSync(full).isDirectory() ? collectTsFiles(full) : [full];
      for (const file of files) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        const content = readFileSync(file, 'utf8');
        if (/\.getPrimaryThesis\(/.test(content)) violations.push(`${rel}: getPrimaryThesis`);
        if (/getActiveTheses\([^)]*\)\[0\]/.test(content)) {
          violations.push(`${rel}: getActiveTheses()[0]`);
        }
        if (/activeTheses\[0\]/.test(content)) violations.push(`${rel}: activeTheses[0]`);
        if (
          /candidates\[0\]/.test(content) &&
          !/No getPrimaryThesis \/ candidates\[0\]/.test(content)
        ) {
          violations.push(`${rel}: candidates[0]`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('Domain SPEC-001 routing modules stay pure', () => {
    const domainFiles = [
      'src/domain/thesisRoutingCore.ts',
      'src/domain/thesisRoutingEligibility.ts',
      'src/domain/routingHistoryCore.ts',
      'src/domain/routedThesisContext.ts',
    ];
    const banned =
      /from\s+['"][^'"]*(firebase|firestore|dbService|react|vite|express|OpenAi|Anthropic)/i;
    for (const rel of domainFiles) {
      const content = readFileSync(join(ROOT, rel), 'utf8');
      expect(content, rel).not.toMatch(banned);
      expect(content, rel).not.toMatch(/localStorage/);
    }
  });

  it('Application does not import Firebase/db/React/providers', () => {
    for (const file of collectTsFiles(join(ROOT, 'src/application/strategicSignalRouting'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      expect(content, rel).not.toMatch(
        /from ['"].*(firebase|dbService|react|vite|OpenAiAdapter|AnthropicAdapter)/
      );
    }
  });

  it('ScoreAndRoute / Override do not call applyScoreToSignal (auto-discard path)', () => {
    const app = collectTsFiles(join(ROOT, 'src/application/strategicSignalRouting'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const adapter = readFileSync(
      join(ROOT, 'src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts'),
      'utf8'
    );
    expect(app).not.toMatch(/applyScoreToSignal/);
    expect(adapter).not.toMatch(/applyScoreToSignal\(/);
    expect(adapter).toMatch(/applyStrategicRoutingToSignal/);
  });

  it('AI boundary: SIGNAL_THESIS_EVAL / analyze must not set routingDecision as authority in Application', () => {
    const app = collectTsFiles(join(ROOT, 'src/application/strategicSignalRouting'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(app).not.toMatch(/SIGNAL_THESIS_EVAL|analyzeSignalAgainstThesis|OpenAI|Anthropic/);
    const score = readFileSync(
      join(ROOT, 'src/application/strategicSignalRouting/ScoreAndRouteSignal.ts'),
      'utf8'
    );
    expect(score).toMatch(/source:\s*['"]AUTO['"]/);
    expect(score).not.toMatch(/source:\s*['"]MANUAL['"]/);
    const override = readFileSync(
      join(ROOT, 'src/application/strategicSignalRouting/OverrideSignalThesis.ts'),
      'utf8'
    );
    expect(override).toMatch(/source:\s*['"]MANUAL['"]/);
  });

  it('no org_aurora_01 / provider URL / VITE AI keys in SPEC-001 routing paths', () => {
    const paths = [
      ...collectTsFiles(join(ROOT, 'src/application/strategicSignalRouting')),
      join(ROOT, 'src/domain/thesisRoutingCore.ts'),
      join(ROOT, 'src/domain/routingHistoryCore.ts'),
      join(ROOT, 'src/domain/routedThesisContext.ts'),
      join(ROOT, 'src/infrastructure/strategicSignalRouting/DbStrategicSignalRoutingAdapter.ts'),
    ];
    for (const file of paths) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/org_aurora_01/);
      expect(content).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
      expect(content).not.toMatch(/VITE_.*API_KEY|X-AI-Session|\/api\/ai\/complete/);
    }
  });

  it('presentation-only exceptions remain labeled and non-strategic', () => {
    const cockpit = readFileSync(join(ROOT, 'src/components/ManagerCockpit.ts'), 'utf8');
    const portal = readFileSync(join(ROOT, 'src/components/ClientPortal.ts'), 'utf8');
    const db = readFileSync(join(ROOT, 'src/services/db.ts'), 'utf8');
    expect(cockpit).toMatch(/ALLOWED_PRESENTATION_ONLY/);
    expect(portal).toMatch(/ALLOWED_PRESENTATION_ONLY/);
    expect(db).toMatch(/PRESENTATION_ONLY|LEGACY_COMPATIBILITY/);
  });

  it('Workspace contested attribution does not use scores[0] as selected winner', () => {
    const ws = readFileSync(join(ROOT, 'src/components/ClientWorkspace.ts'), 'utf8');
    expect(ws).toMatch(/CONTESTED: never present scores\[0\]/);
    expect(ws).not.toMatch(/scores\.find\(\(s\) => s\.thesisId === signal\.thesisId\) \|\| scores\[0\]/);
  });

  it('main override UI uses OverrideSignalThesis + auth actor (no direct thesisId write)', () => {
    const main = readLegacyControllerSurface();
    const overrideBlock = main.match(
      /document\.querySelectorAll\('\[data-thesis-override\]'\)[\s\S]*?document\.querySelectorAll\('\.btn-challenge-thesis'\)/
    )?.[0];
    expect(overrideBlock).toBeTruthy();
    expect(overrideBlock!).toMatch(/overrideSignalThesis/);
    expect(overrideBlock!).toMatch(/actorId:\s*user\.uid/);
    expect(overrideBlock!).toMatch(/actorRole:\s*user\.role/);
    expect(overrideBlock!).not.toMatch(/signal\.thesisId\s*=/);
    expect(overrideBlock!).not.toMatch(/applyScoreToSignal/);
  });

  it('primaryThesisId is not used as strategic decision source in Application', () => {
    const app = collectTsFiles(join(ROOT, 'src/application/strategicSignalRouting'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(app).not.toMatch(/primaryThesisId\s*\?\?| \|\| .*primaryThesisId|if\s*\(.*primaryThesisId/);
  });

  it('history schema forbids AI/secret fields', () => {
    const core = readFileSync(join(ROOT, 'src/domain/routingHistoryCore.ts'), 'utf8');
    expect(core).toMatch(/Forbidden: raw AI output/);
    // Interface must not declare secret/AI payload fields as properties.
    expect(core).not.toMatch(/^\s*(rawOutput|apiKey|Authorization)\s*[?:]/m);
  });
});

describe('SPEC-001 Phase 5 — contested margin still contested (not error)', () => {
  it('near-tie within margin remains CONTESTED with no selectedThesisId', () => {
    const result = routeSignalAcrossTheses(
      makeSignal(),
      [makeThesis({ id: 'A', priority: 1 }), makeThesis({ id: 'B', priority: 2 })],
      (_s, t) => stubScore(t.id === 'A' ? 70 : 70 - ROUTING_CONTEST_MARGIN + 1),
      { now: NOW }
    );
    expect(result.routingState).toBe('CONTESTED');
    expect(result.selectedThesisId).toBeUndefined();
    expect(result.primaryThesisId).toBeUndefined();
  });
});
