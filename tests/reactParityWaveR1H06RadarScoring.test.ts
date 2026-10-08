/**
 * SPEC-010 · Radar R1 H06 — React-native bulk "Puntuar todas".
 *
 * Presentation parity with legacy `btn-score-all-signals`: frozen
 * ScoreAndRouteSignal per pending signal, ADMIN only, one SCORE_SIGNALS_BULK
 * `{ scored }` audit per run. H09 override remains out of scope.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type SignalRow = { id: string; clientId: string; status: string; relevanceScore?: number };
type ScoreInput = { signalId: string; clientId: string; organizationId: string };

const scoreCalls: ScoreInput[] = [];
const auditCalls: { user: unknown; event: string; entity: string; entityId: string; details: unknown }[] = [];
let currentUser: { id: string; role: string; organizationId?: string } | null = null;
let signals: SignalRow[] = [];
let clientOrg: string | undefined = 'org_a';
let scoreImpl: ((input: ScoreInput) => unknown) | null = null;

const routed = (totalScore = 60) => ({
  routing: { routingState: 'CLEAR', eligibleThesisCount: 2 },
  materialDecision: true,
  scoreResult: { totalScore },
  historyWritten: true,
});

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => currentUser },
}));

vi.mock('../src/services/audit', () => ({
  auditService: {
    log: (user: unknown, event: string, entity: string, entityId: string, details?: unknown) => {
      auditCalls.push({ user, event, entity, entityId, details });
    },
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getSignalsByClient: (clientId: string) => signals.filter((s) => s.clientId === clientId),
    getClientById: (id: string) =>
      id === 'client_a' ? { id: 'client_a', organizationId: clientOrg } : null,
    getSignalById: () => null,
    isSignalInCuration: () => false,
  },
}));

vi.mock('../src/services/signalIntakeConsumer', () => ({
  discardSignal: vi.fn(),
  markSignalSaved: vi.fn(),
  registerSource: vi.fn(),
  registerManualSignal: vi.fn(),
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  addSignalToCuration: vi.fn(),
  addAdviceActionToCuration: vi.fn(),
  assignClientTask: vi.fn(),
  cancelClientTask: vi.fn(),
  sendDeliveryPackage: vi.fn(),
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
  createContentDraft: vi.fn(),
}));

vi.mock('../src/composition/strategicSignalRouting/composeStrategicSignalRouting', () => ({
  createStrategicSignalRoutingUseCases: () => ({
    scoreAndRouteSignal: (input: ScoreInput) => {
      scoreCalls.push(input);
      return scoreImpl ? scoreImpl(input) : routed();
    },
  }),
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const COMPOSITE = 'src/services/radarScoreSignalsPresentation.ts';
const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';

function radarPanel(): string {
  const src = read(PAGE);
  return src.slice(src.indexOf('function RadarPanel'), src.indexOf('const CURATION_DESTINATION_LABELS'));
}

async function run(requestedClientId: string | null = 'client_a') {
  const { radarCommands } = await import('../src/ui/commands/commandSeam');
  return radarCommands.scorePendingSignals({ requestedClientId });
}

beforeAll(async () => {
  await import('../src/ui/commands/commandSeam');
}, 60_000);

beforeEach(() => {
  scoreCalls.length = 0;
  auditCalls.length = 0;
  currentUser = { id: 'user_admin_01', role: 'ADMIN', organizationId: 'org_a' };
  clientOrg = 'org_a';
  scoreImpl = null;
  signals = [
    { id: 'sig_new', clientId: 'client_a', status: 'NEW' },
    { id: 'sig_saved', clientId: 'client_a', status: 'SAVED' },
    { id: 'sig_scored', clientId: 'client_a', status: 'NEW', relevanceScore: 72 },
    { id: 'sig_discarded', clientId: 'client_a', status: 'DISCARDED' },
    { id: 'sig_other_client', clientId: 'client_b', status: 'NEW' },
  ];
});

describe('H06 — bulk scoring through the canonical presentation path', () => {
  it('ADMIN run scores every pending signal once via ScoreAndRouteSignal', async () => {
    const result = await run();
    expect(result).toEqual({ ok: true, scored: 2, message: '2 señal(es) puntuada(s)' });
    expect(scoreCalls).toEqual([
      { signalId: 'sig_new', clientId: 'client_a', organizationId: 'org_a' },
      { signalId: 'sig_saved', clientId: 'client_a', organizationId: 'org_a' },
    ]);
  });

  it('already-scored, discarded and other-client signals are not pending', async () => {
    await run();
    const ids = scoreCalls.map((c) => c.signalId);
    expect(ids).not.toContain('sig_scored');
    expect(ids).not.toContain('sig_discarded');
    expect(ids).not.toContain('sig_other_client');
  });

  it('writes exactly one SCORE_SIGNALS_BULK { scored } audit per run', async () => {
    await run();
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      event: 'SCORE_SIGNALS_BULK',
      entity: 'Client',
      entityId: 'client_a',
      details: { scored: 2 },
    });
  });

  it('falls back to the session organization when the client has none', async () => {
    clientOrg = undefined;
    currentUser = { id: 'user_admin_01', role: 'ADMIN', organizationId: 'org_session' };
    await run();
    expect(scoreCalls.every((c) => c.organizationId === 'org_session')).toBe(true);
  });
});

describe('H06 — ADMIN boundary', () => {
  it.each(['CLIENT', 'MANAGER', 'HUMAN'])('%s is rejected before any scoring or audit', async (role) => {
    currentUser = { id: 'user_x', role, organizationId: 'org_a' };
    const result = await run();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe('Solo un administrador puede puntuar señales.');
    expect(scoreCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
  });

  it('missing session is rejected', async () => {
    currentUser = null;
    const result = await run();
    expect(result.ok).toBe(false);
    expect(scoreCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
  });

  it('unresolved client is rejected', async () => {
    const result = await run(null);
    expect(result).toEqual({ ok: false, message: 'Cliente no resuelto' });
    expect(scoreCalls).toHaveLength(0);
  });
});

describe('H06 — scored-count semantics match legacy scoreSignal', () => {
  it('UNROUTED with zero eligible theses is not counted → no active thesis message', async () => {
    scoreImpl = () => ({
      routing: { routingState: 'UNROUTED', eligibleThesisCount: 0 },
      materialDecision: false,
      scoreResult: { totalScore: 10 },
      historyWritten: false,
    });
    const result = await run();
    expect(result).toEqual({ ok: true, scored: 0, message: 'No hay tesis activa para puntuar' });
    expect(scoreCalls).toHaveLength(2);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0].details).toEqual({ scored: 0 });
  });

  it('UNROUTED with eligible theses still counts (routed below threshold)', async () => {
    scoreImpl = () => ({
      routing: { routingState: 'UNROUTED', eligibleThesisCount: 1 },
      materialDecision: true,
      scoreResult: { totalScore: 12 },
      historyWritten: true,
    });
    const result = await run();
    expect(result.ok && result.scored).toBe(2);
  });

  it('SIGNAL_NOT_FOUND is skipped and the run continues', async () => {
    const { StrategicRoutingError } = await import('../src/application/strategicSignalRouting');
    scoreImpl = (input) => {
      if (input.signalId === 'sig_new') throw new StrategicRoutingError('SIGNAL_NOT_FOUND', 'gone');
      return routed();
    };
    const result = await run();
    expect(result).toEqual({ ok: true, scored: 1, message: '1 señal(es) puntuada(s)' });
    expect(auditCalls[0].details).toEqual({ scored: 1 });
  });

  it('no resolvable organization scores nothing and reports no active thesis', async () => {
    clientOrg = undefined;
    currentUser = { id: 'user_admin_01', role: 'ADMIN' };
    const result = await run();
    expect(result).toEqual({ ok: true, scored: 0, message: 'No hay tesis activa para puntuar' });
    expect(scoreCalls).toHaveLength(0);
  });

  it('no pending signals scores nothing', async () => {
    signals = [{ id: 'sig_scored', clientId: 'client_a', status: 'NEW', relevanceScore: 50 }];
    const result = await run();
    expect(result.ok && result.scored).toBe(0);
    expect(scoreCalls).toHaveLength(0);
  });
});

describe('H06 — canonical error propagation', () => {
  it.each(['TENANT_CONTEXT_INVALID', 'PERSISTENCE_ERROR'] as const)(
    '%s stops the run and surfaces the canonical message without audit',
    async (codeName) => {
      const { StrategicRoutingError } = await import('../src/application/strategicSignalRouting');
      scoreImpl = () => {
        throw new StrategicRoutingError(codeName, `canonical ${codeName}`);
      };
      const result = await run();
      expect(result).toEqual({ ok: false, message: `canonical ${codeName}` });
      expect(scoreCalls).toHaveLength(1);
      expect(auditCalls).toHaveLength(0);
    }
  );
});

describe('H06 — no duplicated scoring logic / architecture boundaries', () => {
  it('composite delegates to the frozen use case and computes no score itself', () => {
    const composite = code(COMPOSITE);
    expect(composite).toMatch(/createStrategicSignalRoutingUseCases/);
    expect(composite).toMatch(/scoreAndRouteSignal\(/);
    expect(composite).toMatch(/relevanceScore === undefined/);
    expect(composite).toMatch(/status !== 'DISCARDED'/);
    expect(composite).not.toMatch(/SCORING_FACTOR_WEIGHTS|computeStrategicScore|calculateStrategicScore/);
    expect(composite).not.toMatch(/relevanceScore\s*=[^=]/);
    expect(composite).not.toMatch(/applyStrategicRoutingToSignal|applyScoreToSignal/);
    expect(composite).not.toMatch(/overrideSignalThesis|OverrideSignalThesis/);
    expect(composite).not.toMatch(/runResearchSignalsAgent|addRecommendation|firebase/);
    expect(composite.match(/auditService\.log\(/g)).toHaveLength(1);
  });

  it('seam and hook only forward to the composite', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/scorePendingSignals\([\s\S]*?runRadarBulkScoringComposite\(intent\)/);
    expect(seam).not.toMatch(/\bdbService\b/);
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    const idx = hooks.indexOf('export function useRadarPendingScoring');
    expect(idx).toBeGreaterThan(-1);
    const block = hooks.slice(idx, idx + 700);
    expect(block).toMatch(/radarCommands\.scorePendingSignals/);
    expect(block).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
    expect(block).not.toMatch(/scoreAndRouteSignal|relevanceScore/);
  });

  it('workspace page never names the canonical scoring command', () => {
    expect(read(PAGE)).not.toMatch(/scoreAndRouteSignal/);
    expect(read(PAGE)).not.toMatch(/overrideSignalThesis/);
  });
});

describe('H06 — RadarPanel surface', () => {
  it('"Puntuar todas" is a native button gated by canScore, ADMIN and pending signals', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/useRadarPendingScoring\(scope\)/);
    expect(panel).toMatch(/isAdmin && unscoredCount > 0/);
    expect(panel).toMatch(/!data\.canScore \?/);
    expect(panel).toMatch(/s\.score === null && s\.status !== 'DISCARDED'/);
    expect(panel).toMatch(/<button\s+type="button"[\s\S]*?data-testid="react-ws-radar-score-pending"/);
    expect(panel).toMatch(/'Puntuar todas'/);
  });

  it('shared busy covers the bulk run and guards double-submit', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/pendingScoring\.isPending/);
    expect(panel).toMatch(/const busy =[\s\S]*?pendingScoring\.isPending/);
    expect(panel).toMatch(/if \(busy\) return;/);
    const button = panel.slice(panel.indexOf('react-ws-radar-pending-strip'));
    expect(button.slice(0, 600)).toMatch(/disabled=\{busy\}/);
  });

  it('result surfaces through the accessible radar status message', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/result\.ok && result\.scored > 0/);
    expect(panel).toMatch(/role="status"/);
  });

  it('handoff no longer promises scoring as unavailable', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/actions=\{\['investigarlas', 'las fuentes recomendadas'\]\}/);
    expect(panel).not.toMatch(/'puntuar señales'/);
  });

  it('H09 contested override is not exposed', () => {
    const panel = radarPanel();
    expect(panel).not.toMatch(/data-thesis-override|Usar «|Override manual/);
    expect(panel).toMatch(/decidirla todavía no está disponible en esta interfaz/);
  });

  it('legacy rollback bulk score handler remains intact', () => {
    const radar = read('src/ui/legacy/handlers/radarHandlers.ts');
    expect(radar).toMatch(/btn-score-all-signals/);
    expect(radar).toMatch(/SCORE_SIGNALS_BULK/);
  });
});
