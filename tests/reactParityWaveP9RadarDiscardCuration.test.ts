/**
 * SPEC-010 · T603 React Parity Wave P9 — #20 DiscardSignal + #21 radar send-to-curation.
 *
 * Presentation parity only. Advisor AddAdviceActionToCuration remains legacy.
 * #22 score/investigate/addRecommendation remain untouched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const discardCalls: { requestedClientId: string | null | undefined; signalId: string }[] = [];
const addCalls: { requestedClientId: string | null | undefined; signalId: string }[] = [];
const markCalls: { requestedClientId: string | null | undefined; signalId: string }[] = [];
const scoreCalls: { signalId: string; clientId: string; organizationId: string }[] = [];
const auditCalls: { event: string; entity: string; entityId: string }[] = [];
const adviceCalls: unknown[] = [];

let discardImpl:
  | ((intent: { signalId: string }) => { signal: { id: string } })
  | null = null;
let addImpl:
  | ((intent: { signalId: string }) => { entry: { id: string; clientId: string } })
  | null = null;
let markImpl: ((intent: { signalId: string }) => { signal: { id: string } }) | null = null;
let scoreImpl: ((input: { signalId: string }) => unknown) | null = null;

let signalStore: {
  id: string;
  clientId: string;
  relevanceScore?: number;
} | null = {
  id: 'sig_p9_1',
  clientId: 'client_a',
  relevanceScore: 70,
};
let inCuration = false;

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      id: 'user_admin_01',
      role: 'ADMIN',
      organizationId: 'org_a',
    }),
  },
}));

vi.mock('../src/services/audit', () => ({
  auditService: {
    log: (_user: unknown, event: string, entity: string, entityId: string) => {
      auditCalls.push({ event, entity, entityId });
    },
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getSignalById: (id: string) => (signalStore && signalStore.id === id ? signalStore : null),
    isSignalInCuration: () => inCuration,
    getClientById: (id: string) =>
      id === 'client_a' ? { id: 'client_a', organizationId: 'org_a' } : null,
  },
}));

vi.mock('../src/services/signalIntakeConsumer', () => ({
  discardSignal: (intent: { requestedClientId: string | null | undefined; signalId: string }) => {
    discardCalls.push(intent);
    if (discardImpl) return discardImpl(intent);
    return { signal: { id: intent.signalId } };
  },
  markSignalSaved: (intent: {
    requestedClientId: string | null | undefined;
    signalId: string;
  }) => {
    markCalls.push(intent);
    if (markImpl) return markImpl(intent);
    return { signal: { id: intent.signalId } };
  },
  registerSource: vi.fn(),
  registerManualSignal: vi.fn(),
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  addSignalToCuration: (intent: {
    requestedClientId: string | null | undefined;
    signalId: string;
  }) => {
    addCalls.push(intent);
    if (addImpl) return addImpl(intent);
    return { entry: { id: 'cur_1', clientId: intent.requestedClientId || 'client_a' } };
  },
  addAdviceActionToCuration: (intent: unknown) => {
    adviceCalls.push(intent);
    return { entry: { id: 'cur_advice', clientId: 'client_a' }, adviceActionId: 'adv_1' };
  },
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
    scoreAndRouteSignal: (input: {
      signalId: string;
      clientId: string;
      organizationId: string;
    }) => {
      scoreCalls.push(input);
      if (scoreImpl) return scoreImpl(input);
      return { scoreResult: { totalScore: 55 } };
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

beforeEach(() => {
  discardCalls.length = 0;
  addCalls.length = 0;
  markCalls.length = 0;
  scoreCalls.length = 0;
  auditCalls.length = 0;
  adviceCalls.length = 0;
  discardImpl = null;
  addImpl = null;
  markImpl = null;
  scoreImpl = null;
  inCuration = false;
  signalStore = {
    id: 'sig_p9_1',
    clientId: 'client_a',
    relevanceScore: 70,
  };
});

describe('P9 §2–§3 — #21 ownership gate', () => {
  it('radar path is distinct from advisor AddAdviceActionToCuration', () => {
    const advisor = read('src/ui/legacy/handlers/advisorHandlers.ts');
    expect(advisor).toMatch(/addAdviceActionToCuration/);
    expect(advisor).toMatch(/btn-advice-to-curation/);

    const radar = read('src/ui/legacy/handlers/radarHandlers.ts');
    expect(radar).toMatch(/addSignalToCuration/);
    expect(radar).toMatch(/markSignalSaved/);
    expect(radar).not.toMatch(/addAdviceActionToCuration/);

    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/radarCommands/);
    expect(seam).toMatch(/runRadarSendToCurationComposite/);
    const radarSeam = seam.slice(
      seam.indexOf('export const radarCommands'),
      seam.indexOf('export type TaskAssignCommandResult')
    );
    expect(radarSeam).not.toMatch(/addAdviceActionToCuration/);
    expect(seam).not.toMatch(/\bdbService\b/);

    const composite = read('src/services/radarSendToCurationPresentation.ts');
    expect(composite).toMatch(/addSignalToCuration/);
    expect(composite).toMatch(/markSignalSaved/);
    expect(composite).toMatch(/scoreAndRouteSignal/);
    expect(composite).not.toMatch(/addAdviceActionToCuration/);
    expect(composite).not.toMatch(/addRecommendation/);

    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/useDiscardRadarSignal/);
    expect(panel).toMatch(/useSendSignalToCuration/);
    const radarPanel = panel.slice(panel.indexOf('function RadarPanel'), panel.indexOf('function DeliverPanel'));
    expect(radarPanel).not.toMatch(/addAdviceActionToCuration/);
    expect(panel).not.toMatch(/addRecommendation/);
    expect(panel).not.toMatch(/dbService/);
  });
});

describe('P9 §12–§14 — discard + send-to-curation seam', () => {
  it('ADMIN discard invokes DiscardSignal exactly once', async () => {
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.discardSignal({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(true);
    expect(discardCalls).toEqual([{ requestedClientId: 'client_a', signalId: 'sig_p9_1' }]);
    expect(JSON.stringify(discardCalls[0])).not.toMatch(/claimed|trusted|actorRole|organizationId/);
  });

  it('missing-signal discard uses A1 presentation compat without consumer success path', async () => {
    const { SignalIntakeError } = await import('../src/application/signalIntake');
    discardImpl = () => {
      throw new SignalIntakeError('SIGNAL_NOT_FOUND', 'missing');
    };
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.discardSignal({
      requestedClientId: 'client_a',
      signalId: 'missing',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.compatMissing).toBe(true);
    expect(auditCalls.some((a) => a.event === 'SIGNAL_DISCARDED')).toBe(true);
  });

  it('already-scored send-to-curation: no pre-score, add once, mark once, audit once', async () => {
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.sendToCuration({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(true);
    expect(scoreCalls).toHaveLength(0);
    expect(addCalls).toEqual([{ requestedClientId: 'client_a', signalId: 'sig_p9_1' }]);
    expect(markCalls).toEqual([{ requestedClientId: 'client_a', signalId: 'sig_p9_1' }]);
    expect(auditCalls.filter((a) => a.event === 'SIGNAL_TO_CURATION')).toHaveLength(1);
    expect(adviceCalls).toHaveLength(0);
  });

  it('unscored send-to-curation: ScoreAndRouteSignal once then add then mark', async () => {
    signalStore = { id: 'sig_p9_1', clientId: 'client_a' };
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.sendToCuration({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.preScored).toBe(true);
    expect(scoreCalls).toEqual([
      { signalId: 'sig_p9_1', clientId: 'client_a', organizationId: 'org_a' },
    ]);
    expect(addCalls).toHaveLength(1);
    expect(markCalls).toHaveLength(1);
    expect(scoreCalls.length).toBe(1);
  });

  it('already-in-curation short-circuits before score/add/mark', async () => {
    inCuration = true;
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.sendToCuration({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.alreadyInCuration).toBe(true);
    expect(scoreCalls).toHaveLength(0);
    expect(addCalls).toHaveLength(0);
    expect(markCalls).toHaveLength(0);
  });

  it('add failure stops before MarkSignalSaved', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    addImpl = () => {
      throw new ExecutionDeliveryError('PERSISTENCE_ERROR', 'boom');
    };
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.sendToCuration({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(false);
    expect(addCalls).toHaveLength(1);
    expect(markCalls).toHaveLength(0);
    expect(auditCalls.filter((a) => a.event === 'SIGNAL_TO_CURATION')).toHaveLength(0);
  });

  it('MarkSignalSaved SIGNAL_NOT_FOUND continues to audit after #21a success', async () => {
    const { SignalIntakeError } = await import('../src/application/signalIntake');
    markImpl = () => {
      throw new SignalIntakeError('SIGNAL_NOT_FOUND', 'gone');
    };
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.sendToCuration({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(true);
    expect(addCalls).toHaveLength(1);
    expect(markCalls).toHaveLength(1);
    expect(auditCalls.some((a) => a.event === 'SIGNAL_TO_CURATION')).toBe(true);
  });

  it('MarkSignalSaved non-missing failure returns error after #21a (no invented rollback)', async () => {
    const { SignalIntakeError } = await import('../src/application/signalIntake');
    markImpl = () => {
      throw new SignalIntakeError('ACTOR_NOT_AUTHORIZED', 'denied');
    };
    const { radarCommands } = await import('../src/ui/commands/commandSeam');
    const result = radarCommands.sendToCuration({
      requestedClientId: 'client_a',
      signalId: 'sig_p9_1',
    });
    expect(result.ok).toBe(false);
    expect(addCalls).toHaveLength(1);
    expect(markCalls).toHaveLength(1);
    expect(auditCalls.filter((a) => a.event === 'SIGNAL_TO_CURATION')).toHaveLength(0);
  });
});

describe('P9 surface / #22 / advisor / React db boundaries', () => {
  it('RadarPanel wires discard + send-to-curation and narrows handoff', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/react-ws-discard-/);
    expect(panel).toMatch(/react-ws-send-curation-/);
    expect(panel).toMatch(/narrowToClient/);
    expect(panel).not.toMatch(/actions=\{\[[^\]]*'puntuar señales'/);
    expect(panel).toMatch(/investigarlas/);
    expect(panel).toMatch(/las fuentes recomendadas/);
    expect(panel).not.toMatch(/descartarlas/);
    expect(panel).not.toMatch(/añadirlas a una entrega/);
    expect(panel).not.toMatch(/dbService\./);
    expect(panel).not.toMatch(/addRecommendation/);
    expect(panel).not.toMatch(/btn-score-all|research-all|btn-analyze-signal/);
  });

  it('hooks invalidate compatibility queries and do not call advisor/#22', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useDiscardRadarSignal/);
    expect(hooks).toMatch(/useSendSignalToCuration/);
    const discardIdx = hooks.indexOf('export function useDiscardRadarSignal');
    const sendIdx = hooks.indexOf('export function useSendSignalToCuration');
    const discardBlock = hooks.slice(discardIdx, discardIdx + 700);
    const sendBlock = hooks.slice(sendIdx, sendIdx + 800);
    expect(discardBlock).not.toMatch(/addAdviceActionToCuration|addRecommendation/);
    expect(sendBlock).not.toMatch(/addAdviceActionToCuration|addRecommendation/);
  });

  it('frozen Application commands remain unmodified shapes', () => {
    const discard = read('src/application/signalIntake/DiscardSignal.ts');
    const add = read('src/application/executionDelivery/AddSignalToCuration.ts');
    const mark = read('src/application/signalIntake/MarkSignalSaved.ts');
    const advice = read('src/application/executionDelivery/AddAdviceActionToCuration.ts');
    expect(discard).toMatch(/requireAdminRole/);
    expect(add).toMatch(/requireAdminRole/);
    expect(mark).toMatch(/requireAdminRole/);
    expect(advice).toMatch(/requireAdminRole/);
  });

  it('legacy rollback radar + advisor handlers remain intact', () => {
    const radar = read('src/ui/legacy/handlers/radarHandlers.ts');
    expect(radar).toMatch(/handleRadarDiscardSignalClick/);
    expect(radar).toMatch(/handleSendToCurationClick/);
    expect(radar).toMatch(/btn-discard-signal/);
    expect(radar).toMatch(/btn-send-to-curation/);
    expect(radar).toMatch(/btn-score-all-signals/);

    const advisor = read('src/ui/legacy/handlers/advisorHandlers.ts');
    expect(advisor).toMatch(/handleAdviceToCurationClick/);
    expect(advisor).toMatch(/btn-advice-to-curation/);
  });
});
