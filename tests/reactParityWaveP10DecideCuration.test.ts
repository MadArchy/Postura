/**
 * SPEC-010 · T603 React Parity Wave P10 — #14 DecideCuration.
 *
 * Presentation parity only. #15/#16/#17 UI remain legacy.
 * #22 score/investigate/addRecommendation remain untouched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const decideCalls: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
  destination: string;
  rationale: string;
}[] = [];
const discardCompositeCalls: {
  requestedClientId: string | null | undefined;
  signalId: string;
  reason: string;
}[] = [];
const addToDeliveryCalls: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
}[] = [];
const proposeCalls: unknown[] = [];
const removeCalls: unknown[] = [];
const reopenCalls: unknown[] = [];
const briefCreateCalls: unknown[] = [];
const scoreCalls: unknown[] = [];
const auditCalls: { event: string; entity: string; entityId: string }[] = [];

let decideImpl:
  | ((intent: { curationEntryId: string; destination: string }) => {
      entry: { id: string; clientId: string; signalId?: string };
    })
  | null = null;
let discardCompositeImpl: (() => unknown) | null = null;
let addToDeliveryImpl: (() => { ok: boolean }) | null = null;

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

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  decideCuration: (intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
    destination: string;
    rationale: string;
  }) => {
    decideCalls.push(intent);
    if (decideImpl) return decideImpl(intent);
    return {
      entry: {
        id: intent.curationEntryId,
        clientId: intent.requestedClientId || 'client_a',
        signalId: 'sig_p10_1',
      },
    };
  },
  addCurationToDelivery: (intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }) => {
    addToDeliveryCalls.push(intent);
    if (addToDeliveryImpl) return addToDeliveryImpl();
    return { ok: true };
  },
  proposeAngle: (intent: unknown) => {
    proposeCalls.push(intent);
    return Promise.resolve({ ok: true });
  },
  removeCuration: (intent: unknown) => {
    removeCalls.push(intent);
    return { ok: true };
  },
  reopenCuration: (intent: unknown) => {
    reopenCalls.push(intent);
    return { ok: true };
  },
  assignClientTask: vi.fn(),
  cancelClientTask: vi.fn(),
  sendDeliveryPackage: vi.fn(),
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
  createContentDraft: vi.fn(),
  addSignalToCuration: vi.fn(),
}));

vi.mock('../src/services/signalIntakeConsumer', () => ({
  discardSignalForCurationComposite: (intent: {
    requestedClientId: string | null | undefined;
    signalId: string;
    reason: string;
  }) => {
    discardCompositeCalls.push(intent);
    if (discardCompositeImpl) return discardCompositeImpl();
    return { signal: { id: intent.signalId } };
  },
  discardSignal: vi.fn(),
  markSignalSaved: vi.fn(),
  registerSource: vi.fn(),
  registerManualSignal: vi.fn(),
}));

vi.mock('../src/composition/strategicSignalRouting/composeStrategicSignalRouting', () => ({
  createStrategicSignalRoutingUseCases: () => ({
    scoreAndRouteSignal: (input: unknown) => {
      scoreCalls.push(input);
      return { scoreResult: { totalScore: 55 } };
    },
  }),
}));

vi.mock('../src/services/strategicBriefConsumer', () => ({
  createBriefFromCurationEntry: (intent: unknown) => {
    briefCreateCalls.push(intent);
    return { brief: { id: 'brief_1' } };
  },
  approveStrategicBrief: vi.fn(),
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
  decideCalls.length = 0;
  discardCompositeCalls.length = 0;
  addToDeliveryCalls.length = 0;
  proposeCalls.length = 0;
  removeCalls.length = 0;
  reopenCalls.length = 0;
  briefCreateCalls.length = 0;
  scoreCalls.length = 0;
  auditCalls.length = 0;
  decideImpl = null;
  discardCompositeImpl = null;
  addToDeliveryImpl = null;
});

describe('P10 §2 — #14 public input and boundaries', () => {
  it('consumer public input includes requestedClientId + curation fields only', () => {
    const consumer = read('src/services/executionDeliveryConsumer.ts');
    const block = consumer.match(/export function decideCuration[\s\S]*?^}/m);
    expect(block?.[0]).toMatch(/requestedClientId/);
    expect(block?.[0]).toMatch(/curationEntryId/);
    expect(block?.[0]).toMatch(/destination/);
    expect(block?.[0]).toMatch(/rationale/);
    expect(block?.[0]).not.toMatch(/trusted:/);
  });

  it('frozen DecideCuration Application input uses trusted context not caller role', () => {
    const app = read('src/application/executionDelivery/DecideCuration.ts');
    expect(app).toMatch(/trusted: TrustedExecutionDeliveryContext/);
    expect(app).toMatch(/requireAdminRole/);
    expect(app).not.toMatch(/queueCurationInBriefing|discardSignal/);
  });
});

describe('P10 §12–§14 — decide curation seam', () => {
  it('ADMIN non-DISCARD invokes DecideCuration once then addCurationToDelivery compat', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.decideCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p10_1',
      destination: 'TASK_VIDEO',
      rationale: 'Valid rationale text',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toBe('Destino confirmado y añadido al briefing');
      expect(result.queued).toBe(true);
    }
    expect(decideCalls).toHaveLength(1);
    expect(decideCalls[0]).toEqual({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p10_1',
      destination: 'TASK_VIDEO',
      rationale: 'Valid rationale text',
    });
    expect(JSON.stringify(decideCalls[0])).not.toMatch(/trusted|actorRole|organizationId/);
    expect(addToDeliveryCalls).toEqual([
      { requestedClientId: 'client_a', curationEntryId: 'cur_p10_1' },
    ]);
    expect(discardCompositeCalls).toHaveLength(0);
    expect(auditCalls.filter((a) => a.event === 'CURATION_DECIDED')).toHaveLength(1);
    expect(proposeCalls).toHaveLength(0);
    expect(removeCalls).toHaveLength(0);
    expect(reopenCalls).toHaveLength(0);
    expect(briefCreateCalls).toHaveLength(0);
    expect(scoreCalls).toHaveLength(0);
  });

  it('DISCARD order: DecideCuration → discardSignalForCurationComposite → audit', async () => {
    const order: string[] = [];
    decideImpl = () => {
      order.push('decideCuration');
      return { entry: { id: 'cur_p10_1', clientId: 'client_a', signalId: 'sig_p10_1' } };
    };
    discardCompositeImpl = () => {
      order.push('discardSignalForCurationComposite');
      return { signal: { id: 'sig_p10_1' } };
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.decideCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p10_1',
      destination: 'DISCARD',
      rationale: 'Valid rationale text',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.message).toBe('Ítem descartado con justificación');
    expect(order).toEqual(['decideCuration', 'discardSignalForCurationComposite']);
    expect(addToDeliveryCalls).toHaveLength(0);
    expect(auditCalls.filter((a) => a.event === 'CURATION_DECIDED')).toHaveLength(1);
    expect(auditCalls.some((a) => a.event === 'SIGNAL_DISCARDED')).toBe(false);
  });

  it('DISCARD partial failure preserves legacy warning without rollback', async () => {
    const { SignalIntakeError } = await import('../src/application/signalIntake');
    discardCompositeImpl = () => {
      throw new SignalIntakeError('ACTOR_NOT_AUTHORIZED', 'Denied');
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.decideCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p10_1',
      destination: 'DISCARD',
      rationale: 'Valid rationale text',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('warning');
      expect(result.message).toBe(
        'La decisión de curación se guardó, pero no se pudo descartar la señal vinculada.'
      );
    }
    expect(decideCalls).toHaveLength(1);
    expect(discardCompositeCalls).toHaveLength(1);
    expect(auditCalls.filter((a) => a.event === 'CURATION_DECIDED')).toHaveLength(1);
  });

  it('DISCARD without signalId skips #20 composite', async () => {
    decideImpl = () => ({
      entry: { id: 'cur_p10_1', clientId: 'client_a' },
    });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.decideCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p10_1',
      destination: 'DISCARD',
      rationale: 'Valid rationale text',
    });
    expect(result.ok).toBe(true);
    expect(discardCompositeCalls).toHaveLength(0);
  });

  it('CURATION_NOT_FOUND compat: audit + success message without decide persist', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    decideImpl = () => {
      throw new ExecutionDeliveryError('CURATION_NOT_FOUND', 'missing');
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.decideCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_missing',
      destination: 'EVIDENCE',
      rationale: 'Valid rationale text',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toBe('Destino confirmado. Añádelo al briefing cuando quieras.');
    }
    expect(auditCalls.filter((a) => a.event === 'CURATION_DECIDED')).toHaveLength(1);
    expect(addToDeliveryCalls).toHaveLength(0);
  });

  it('queue failure returns success without queued message', async () => {
    addToDeliveryImpl = () => ({ ok: false });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.decideCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_p10_1',
      destination: 'OPPORTUNITY',
      rationale: 'Valid rationale text',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.queued).toBe(false);
      expect(result.message).toBe('Destino confirmado. Añádelo al briefing cuando quieras.');
    }
  });
});

describe('P10 surface / #22 / React db boundaries', () => {
  it('DeliverPanel wires decide form without deliver assembly handoff (P13 native)', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/useDecideCuration/);
    expect(panel).toMatch(/react-ws-decide-form-/);
    expect(panel).toMatch(/react-ws-decide-submit-/);
    expect(panel).not.toMatch(/react-ws-deliver-handoff/);
    expect(panel).not.toMatch(/montar el briefing/);
    expect(panel).not.toMatch(/actions=\{[^}]*proponer ángulo/);
    expect(panel).not.toMatch(/decidir el destino/);
    expect(panel).not.toMatch(/dbService\./);
    expect(panel).not.toMatch(/\bproposeAngle\s*\(/);
    expect(panel).not.toMatch(/\bremoveCuration\s*\(/);
    expect(panel).not.toMatch(/\breopenCuration\s*\(/);
    expect(panel).not.toMatch(/addRecommendation/);
  });

  it('hooks invalidate compatibility queries', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useDecideCuration/);
    const idx = hooks.indexOf('export function useDecideCuration');
    const block = hooks.slice(idx, idx + 900);
    expect(block).toMatch(/tenantInvalidationKey/);
    expect(block).not.toMatch(/addRecommendation|proposeAngle/);
  });

  it('command seam delegates to services composite without dbService', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/runCurationDecidePresentation/);
    expect(seam).not.toMatch(/\bdbService\b/);
  });

  it('presentation composite mirrors curationHandlers without #15/#16/#17 UI', () => {
    const composite = read('src/services/curationDecidePresentation.ts');
    expect(composite).toMatch(/decideCuration/);
    expect(composite).toMatch(/discardSignalForCurationComposite/);
    expect(composite).toMatch(/addCurationToDelivery/);
    expect(composite).toMatch(/CURATION_DECIDED/);
    expect(composite).not.toMatch(/proposeAngle|removeCuration|reopenCuration/);
    expect(composite).not.toMatch(/createBriefFromCurationEntry/);
    expect(composite).not.toMatch(/\bdbService\b/);
  });

  it('legacy curationHandlers rollback retained', () => {
    const legacy = read('src/ui/legacy/handlers/curationHandlers.ts');
    expect(legacy).toMatch(/handleCurationFormSubmit/);
    expect(legacy).toMatch(/handleProposeAngleClick/);
    expect(legacy).toMatch(/handleRemoveCurationClick/);
    expect(legacy).toMatch(/handleReopenCurationClick/);
  });

  it('frozen DecideCuration Application command remains unmodified shape', () => {
    const app = read('src/application/executionDelivery/DecideCuration.ts');
    expect(app).toMatch(/VALID_DESTINATIONS/);
    expect(app).toMatch(/TASK_VIDEO/);
    expect(app).toMatch(/DISCARD/);
  });
});
