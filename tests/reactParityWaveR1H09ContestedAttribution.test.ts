/**
 * SPEC-010 · Radar R1 H09 — React contested attribution (lead / rival).
 *
 * Presentation parity with legacy `[data-thesis-override]`: frozen
 * OverrideSignalThesis with the trusted session actor, no rationale, one
 * THESIS_OVERRIDE `{ thesisId }` audit per success. Canonical authority owns
 * ADMIN / actorId / eligibility; React adds none.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PositioningThesis, Signal, StrategicScoreResult } from '../src/types';

type OverrideInput = {
  signalId: string;
  clientId: string;
  organizationId: string;
  selectedThesisId: string;
  actorId: string;
  actorRole: string;
  rationale?: string;
};

const overrideCalls: OverrideInput[] = [];
const auditCalls: { user: unknown; event: string; entity: string; entityId: string; details: unknown }[] = [];
let currentUser: { uid: string; role: string; organizationId?: string } | null = null;
let signalStore: Partial<Signal>[] = [];
let thesisStore: { id: string; clientId: string; title: string; status: string }[] = [];
let overrideImpl: ((input: OverrideInput) => unknown) | null = null;

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
    getSignalById: (id: string) => signalStore.find((s) => s.id === id) ?? null,
    getSignalsByClient: (clientId: string) => signalStore.filter((s) => s.clientId === clientId),
    getClientById: (id: string) =>
      id === 'client_a' ? { id: 'client_a', organizationId: 'org_a' } : null,
    getThesesByClient: (clientId: string) => thesisStore.filter((t) => t.clientId === clientId),
    getThesisById: (clientId: string, thesisId: string) =>
      thesisStore.find((t) => t.clientId === clientId && t.id === thesisId),
    getActiveTheses: (clientId: string) =>
      thesisStore.filter((t) => t.clientId === clientId && t.status === 'ACTIVE'),
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
    scoreAndRouteSignal: vi.fn(),
    overrideSignalThesis: (input: OverrideInput) => {
      overrideCalls.push(input);
      if (overrideImpl) return overrideImpl(input);
      return {
        routing: { routingState: 'CLEAR', source: 'MANUAL', selectedThesisId: input.selectedThesisId },
        historyWritten: true,
      };
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

const COMPOSITE = 'src/services/radarContestedAttributionPresentation.ts';
const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const READS = 'src/ui/data/compatibilityReads.ts';

function radarPanel(): string {
  const src = read(PAGE);
  return src.slice(src.indexOf('function RadarPanel'), src.indexOf('const CURATION_DESTINATION_LABELS'));
}

const contestedSignal = (overrides: Partial<Signal> = {}): Partial<Signal> => ({
  id: 'sig_h09',
  clientId: 'client_a',
  organizationId: 'org_a',
  title: 'Contested',
  sourceName: 'Manual',
  status: 'NEW',
  detectedAt: '2026-10-01T00:00:00Z',
  relevanceScore: 62,
  thesisScores: [
    { thesisId: 'th_rival', score: 60, band: 'HIGH' },
    { thesisId: 'th_third', score: 41, band: 'MEDIUM' },
    { thesisId: 'th_lead', score: 62, band: 'HIGH' },
  ],
  routingDecision: {
    routingState: 'CONTESTED',
    contested: true,
    source: 'AUTO',
    secondaryThesisId: 'th_rival',
    algorithmVersion: 'routing-v1',
  },
  ...overrides,
});

async function choose(selectedThesisId = 'th_rival', requestedClientId: string | null = 'client_a') {
  const { radarCommands } = await import('../src/ui/commands/commandSeam');
  return radarCommands.resolveContestedAttribution({
    requestedClientId,
    signalId: 'sig_h09',
    selectedThesisId,
  });
}

async function radarRead() {
  const { readWorkspaceRadar } = await import('../src/ui/data/compatibilityReads');
  return readWorkspaceRadar({ organizationId: 'org_a', clientId: 'client_a' } as never);
}

beforeAll(async () => {
  await import('../src/ui/commands/commandSeam');
  await import('../src/ui/data/compatibilityReads');
}, 60_000);

beforeEach(() => {
  overrideCalls.length = 0;
  auditCalls.length = 0;
  overrideImpl = null;
  currentUser = { uid: 'user_admin_01', role: 'ADMIN', organizationId: 'org_a' };
  signalStore = [contestedSignal()];
  thesisStore = [
    { id: 'th_lead', clientId: 'client_a', title: 'Lead thesis', status: 'ACTIVE' },
    { id: 'th_rival', clientId: 'client_a', title: 'Rival thesis', status: 'ACTIVE' },
    { id: 'th_third', clientId: 'client_a', title: 'Third thesis', status: 'ACTIVE' },
    { id: 'th_foreign', clientId: 'client_b', title: 'Foreign thesis', status: 'ACTIVE' },
  ];
});

describe('H09 — composite reuses canonical OverrideSignalThesis with the trusted actor', () => {
  it('passes session uid / role, scope tenant and the chosen thesis — no rationale', async () => {
    const result = await choose('th_rival');
    expect(result).toEqual({
      ok: true,
      message: 'Señal asignada a «Rival thesis»',
      thesisId: 'th_rival',
      historyWritten: true,
    });
    expect(overrideCalls).toEqual([
      {
        signalId: 'sig_h09',
        clientId: 'client_a',
        organizationId: 'org_a',
        selectedThesisId: 'th_rival',
        actorId: 'user_admin_01',
        actorRole: 'ADMIN',
      },
    ]);
    expect(overrideCalls[0]).not.toHaveProperty('rationale');
  });

  it('writes exactly one THESIS_OVERRIDE { thesisId } audit on success', async () => {
    await choose('th_lead');
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      event: 'THESIS_OVERRIDE',
      entity: 'Signal',
      entityId: 'sig_h09',
      details: { thesisId: 'th_lead' },
    });
    expect(auditCalls[0].user).toBe(currentUser);
  });

  it('falls back to the signal client when no client is requested', async () => {
    await choose('th_lead', null);
    expect(overrideCalls[0].clientId).toBe('client_a');
  });

  it('falls back to the thesis id when its title is unavailable', async () => {
    thesisStore = thesisStore.filter((t) => t.id !== 'th_rival');
    const result = await choose('th_rival');
    expect(result.ok && result.message).toBe('Señal asignada a «th_rival»');
  });
});

describe('H09 — canonical authority is not duplicated', () => {
  it('CLIENT role reaches the canonical command, which rejects it; no audit', async () => {
    const { StrategicRoutingError } = await import('../src/application/strategicSignalRouting');
    currentUser = { uid: 'user_client', role: 'CLIENT', organizationId: 'org_a' };
    overrideImpl = (input) => {
      if (input.actorRole !== 'ADMIN') {
        throw new StrategicRoutingError('UNAUTHORIZED_OVERRIDE', 'Manual thesis override requires ADMIN role.');
      }
      return null;
    };
    const result = await choose();
    expect(overrideCalls).toHaveLength(1);
    expect(overrideCalls[0].actorRole).toBe('CLIENT');
    expect(result).toEqual({ ok: false, message: 'Manual thesis override requires ADMIN role.' });
    expect(auditCalls).toHaveLength(0);
  });

  it('composite contains no role, eligibility, contested or score logic', () => {
    const composite = code(COMPOSITE);
    expect(composite).toMatch(/createStrategicSignalRoutingUseCases\(\)\.overrideSignalThesis\(/);
    expect(composite).toMatch(/actorId: user\.uid/);
    expect(composite).toMatch(/actorRole: user\.role/);
    expect(composite).not.toMatch(/'ADMIN'|isThesisEligible|'ACTIVE'|CONTESTED|thesisScores/);
    expect(composite).not.toMatch(/rationale/);
    expect(composite).not.toMatch(/scoreAndRouteSignal|applyStrategicRouting|relevanceScore|firebase/);
    expect(composite.match(/auditService\.log\(/g)).toHaveLength(1);
  });

  it('missing session returns the safe session error without invoking the command', async () => {
    currentUser = null;
    const result = await choose();
    expect(result).toEqual({
      ok: false,
      message: 'Sesión sin organizationId — no se puede asignar tesis',
    });
    expect(overrideCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
  });

  it('missing signal returns "Señal no encontrada." without invoking the command', async () => {
    signalStore = [];
    const result = await choose();
    expect(result).toEqual({ ok: false, message: 'Señal no encontrada.' });
    expect(overrideCalls).toHaveLength(0);
  });
});

describe('H09 — canonical errors surface as safe messages with zero audit', () => {
  it.each([
    'UNAUTHORIZED_OVERRIDE',
    'THESIS_NOT_FOUND',
    'THESIS_NOT_ELIGIBLE',
    'SIGNAL_NOT_FOUND',
    'TENANT_CONTEXT_INVALID',
    'PERSISTENCE_ERROR',
  ] as const)('%s', async (codeName) => {
    const { StrategicRoutingError } = await import('../src/application/strategicSignalRouting');
    overrideImpl = () => {
      throw new StrategicRoutingError(codeName, `canonical ${codeName}`);
    };
    const result = await choose();
    expect(result).toEqual({ ok: false, message: `canonical ${codeName}` });
    expect(JSON.stringify(result)).not.toMatch(/\n\s+at |stack/);
    expect(auditCalls).toHaveLength(0);
  });
});

describe('H09 — read model: routingSource + lead/rival attribution only', () => {
  it('projects lead (highest score) and rival (secondaryThesisId) with titles and scores', async () => {
    const [signal] = (await radarRead()).signals;
    expect(signal.routingSource).toBe('AUTO');
    expect(signal.attribution).toEqual({
      leadThesisId: 'th_lead',
      leadTitle: 'Lead thesis',
      leadScore: 62,
      rivalThesisId: 'th_rival',
      rivalTitle: 'Rival thesis',
      rivalScore: 60,
    });
  });

  it('rival falls back to the second-highest score without secondaryThesisId', async () => {
    signalStore = [
      contestedSignal({
        routingDecision: { routingState: 'CONTESTED', contested: true, source: 'AUTO' },
        thesisScores: [
          { thesisId: 'th_third', score: 41, band: 'MEDIUM' },
          { thesisId: 'th_lead', score: 62, band: 'HIGH' },
          { thesisId: 'th_rival', score: 60, band: 'HIGH' },
        ],
      }),
    ];
    const [signal] = (await radarRead()).signals;
    expect(signal.attribution?.rivalThesisId).toBe('th_rival');
  });

  it('only CONTESTED saved routing yields attribution — no score-gap inference', async () => {
    signalStore = [
      contestedSignal({
        thesisId: 'th_lead',
        routingDecision: { routingState: 'CLEAR', source: 'MANUAL', selectedThesisId: 'th_lead' },
      }),
    ];
    const [signal] = (await radarRead()).signals;
    expect(signal.attribution).toBeNull();
    expect(signal.routingSource).toBe('MANUAL');
  });

  it('CONTESTED with fewer than two thesis scores yields no attribution', async () => {
    signalStore = [contestedSignal({ thesisScores: [{ thesisId: 'th_lead', score: 62, band: 'HIGH' }] })];
    const [signal] = (await radarRead()).signals;
    expect(signal.routingState).toBe('CONTESTED');
    expect(signal.attribution).toBeNull();
  });

  it('missing title falls back to the thesis id; no routing source yields null', async () => {
    thesisStore = [];
    signalStore = [contestedSignal({ routingDecision: undefined })];
    const [plain] = (await radarRead()).signals;
    expect(plain.routingSource).toBeNull();
    signalStore = [contestedSignal()];
    const [signal] = (await radarRead()).signals;
    expect(signal.attribution?.leadTitle).toBe('th_lead');
    expect(signal.attribution?.rivalTitle).toBe('th_rival');
  });

  it('read facade adds no exported mutator or full thesis aggregate', () => {
    const reads = code(READS);
    const exported = reads.match(/export (?:async )?function (\w+)/g) || [];
    expect(exported.filter((name) => !/function read/.test(name))).toEqual([]);
    const block = reads.slice(reads.indexOf('export interface WorkspaceRadarAttributionRead'), reads.indexOf('export function readWorkspaceRadar'));
    expect(block).not.toMatch(/PositioningThesis/);
  });
});

describe('H09 — canonical post-override contract (real use case, in-memory ports)', () => {
  it('CONTESTED/AUTO → CLEAR/MANUAL, thesisScores preserved, history written, derived score recomputed', async () => {
    const { createOverrideSignalThesis } = await import('../src/application/strategicSignalRouting');
    const signal = {
      ...contestedSignal(),
      thesisScores: [
        { thesisId: 'th_lead', score: 62, band: 'HIGH' },
        { thesisId: 'th_rival', score: 60, band: 'HIGH' },
      ],
    } as Signal;
    const theses = [
      { id: 'th_lead', clientId: 'client_a', organizationId: 'org_a', title: 'Lead thesis', status: 'ACTIVE' },
      { id: 'th_rival', clientId: 'client_a', organizationId: 'org_a', title: 'Rival thesis', status: 'ACTIVE' },
    ] as PositioningThesis[];
    const writes: { thesisId?: string; thesisScores?: unknown; routingDecision: Record<string, unknown>; scoreResult: StrategicScoreResult; historyEntry?: unknown }[] = [];
    const override = createOverrideSignalThesis({
      signals: { getSignalById: (id) => (id === signal.id ? signal : undefined) },
      theses: { getThesesForClient: () => theses },
      writer: { persistStrategicRouting: (params) => void writes.push(params as never) },
      scoring: {
        createScoreFn: () => () => ({}) as StrategicScoreResult,
        computeWhyNow: () => ({ score: 50, band: 'SOON', reason: 'r' }),
        scoreThesis: () => ({ totalScore: 55, priorityBand: 'MEDIUM', recommendedAction: 'SAVE' }) as StrategicScoreResult,
      },
    });
    const result = override({
      signalId: 'sig_h09',
      clientId: 'client_a',
      organizationId: 'org_a',
      selectedThesisId: 'th_rival',
      actorId: 'user_admin_01',
      actorRole: 'ADMIN',
    });
    expect(result.historyWritten).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].thesisId).toBe('th_rival');
    expect(writes[0].thesisScores).toEqual(signal.thesisScores);
    expect(writes[0].routingDecision).toMatchObject({
      routingState: 'CLEAR',
      source: 'MANUAL',
      selectedThesisId: 'th_rival',
      actorId: 'user_admin_01',
    });
    expect(writes[0].scoreResult.totalScore).toBe(55);
    expect(writes[0].historyEntry).toBeTruthy();
  });
});

describe('H09 — RadarPanel surface', () => {
  it('lead and rival are the only two native buttons, ADMIN-visible, busy-guarded', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/isAdmin && signal\.routingState === 'CONTESTED' && signal\.attribution/);
    expect(panel).toMatch(/thesisId: signal\.attribution\.leadThesisId/);
    expect(panel).toMatch(/thesisId: signal\.attribution\.rivalThesisId/);
    expect(panel.match(/react-ws-attribution-use-/g)).toHaveLength(1);
    expect(panel).toMatch(/<button\s+key=\{choice\.thesisId\}\s+type="button"[\s\S]*?disabled=\{busy\}/);
    expect(panel).toMatch(/Usar \{choice\.title\}/);
    expect(panel).not.toMatch(/<select|<textarea|confirm\(|data-thesis-override/);
  });

  it('shared busy covers the attribution mutation and the handler guards double-submit', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/useResolveContestedAttribution\(scope\)/);
    expect(panel).toMatch(/const busy =[\s\S]*?attributionChoice\.isPending/);
    const handler = panel.slice(panel.indexOf('const onChooseThesis'), panel.indexOf('const onDiscard'));
    expect(handler).toMatch(/if \(busy\) return;/);
    expect(handler).toMatch(/react-ws-radar|kind: 'success'/);
  });

  it('contested line pairs each title with its score; incomplete projection shows only the prefix', () => {
    const panel = radarPanel();
    expect(panel).toMatch(
      /Atribución en disputa — elige la tesis: \$\{signal\.attribution\.leadTitle\} \$\{signal\.attribution\.leadScore\} · \$\{signal\.attribution\.rivalTitle\} \$\{signal\.attribution\.rivalScore\}/
    );
    expect(panel).toMatch(/: 'Atribución en disputa'/);
    expect(panel).not.toMatch(/decidirla todavía no está disponible/);
    expect(panel).toMatch(/Tesis asignada: \$\{signal\.thesisId\}/);
  });

  it('manual badge derives from routingSource with the governed class and testid', () => {
    const panel = radarPanel();
    expect(panel).toMatch(/signal\.routingSource === 'MANUAL'/);
    expect(panel).toMatch(/className="badge badge-progress"\s+data-testid=\{`react-ws-attribution-manual-\$\{signal\.id\}`\}/);
    expect(panel).toMatch(/Override manual/);
  });

  it('results surface on the existing accessible radar status message', () => {
    expect(radarPanel()).toMatch(/role="status"/);
  });
});

describe('H09 — architecture: canonical names stay out of src/ui', () => {
  it('seam and hook only forward to the composite', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/resolveContestedAttribution\([\s\S]*?runRadarContestedAttributionComposite\(intent\)/);
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    const idx = hooks.indexOf('export function useResolveContestedAttribution');
    expect(idx).toBeGreaterThan(-1);
    const block = hooks.slice(idx, idx + 900);
    expect(block).toMatch(/radarCommands\.resolveContestedAttribution/);
    expect(block).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
  });

  it('no src/ui file names the canonical override command', () => {
    for (const rel of ['src/ui/commands/commandSeam.ts', 'src/ui/hooks/useWave3Data.ts', PAGE, READS]) {
      expect(read(rel)).not.toMatch(/overrideSignalThesis/);
    }
    expect(read(PAGE)).not.toMatch(/scoreAndRouteSignal/);
  });
});
