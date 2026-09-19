/**
 * SPEC-010 · #16 Remove / Reopen Curation React parity.
 *
 * Presentation + existing Execution Delivery commands only.
 * #21 advisor, #22 scoring, and #33 CreateContentDraft remain out of scope.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const workspace = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const hook = 'src/ui/hooks/useWave3Data.ts';
const seam = 'src/ui/commands/commandSeam.ts';
const consumer = 'src/services/executionDeliveryConsumer.ts';
const removeApp = 'src/application/executionDelivery/RemoveCuration.ts';
const reopenApp = 'src/application/executionDelivery/ReopenCuration.ts';
const legacyHost = 'src/components/ClientWorkspace.ts';
const legacyHandlers = 'src/ui/legacy/handlers/curationHandlers.ts';
const advisor = 'src/application/executionDelivery/AddAdviceActionToCuration.ts';
const createDraft = 'src/application/executionDelivery/CreateContentDraft.ts';

const removeCalls: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
}[] = [];
const reopenCalls: {
  requestedClientId: string | null | undefined;
  curationEntryId: string;
}[] = [];

let removeImpl:
  | ((intent: { curationEntryId: string }) => { ok: true } | { ok: false; compat: 'CURATION_NOT_FOUND' })
  | null = null;
let reopenImpl:
  | ((intent: { curationEntryId: string }) => { ok: true } | { ok: false; compat: 'CURATION_NOT_FOUND' })
  | null = null;
let removeThrow: unknown = null;
let reopenThrow: unknown = null;

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
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  removeCuration: (intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }) => {
    removeCalls.push(intent);
    if (removeThrow) throw removeThrow;
    if (removeImpl) return removeImpl(intent);
    return { ok: true };
  },
  reopenCuration: (intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }) => {
    reopenCalls.push(intent);
    if (reopenThrow) throw reopenThrow;
    if (reopenImpl) return reopenImpl(intent);
    return { ok: true };
  },
  decideCuration: vi.fn(),
  addCurationToDelivery: vi.fn(),
  proposeAngle: vi.fn(),
  assignClientTask: vi.fn(),
  cancelClientTask: vi.fn(),
  sendDeliveryPackage: vi.fn(),
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
  createContentDraft: vi.fn(),
  addSignalToCuration: vi.fn(),
  addAdviceActionToCuration: vi.fn(),
  ensureDraftDelivery: vi.fn(),
  updateDeliveryPackageMetadata: vi.fn(),
  removeDeliveryItemFromDelivery: vi.fn(),
  discardDraftDelivery: vi.fn(),
}));

vi.mock('../src/services/signalIntakeConsumer', () => ({
  discardSignal: vi.fn(),
  discardSignalForCurationComposite: vi.fn(),
  markSignalSaved: vi.fn(),
  registerSource: vi.fn(),
  registerManualSignal: vi.fn(),
  pollRegisteredSource: vi.fn(),
  pollAllActiveSources: vi.fn(),
}));

vi.mock('../src/services/strategicBriefConsumer', () => ({
  createBriefFromCurationEntry: vi.fn(),
  approveStrategicBrief: vi.fn(),
}));

function deliverPanel(): string {
  const src = code(workspace);
  return src.slice(src.indexOf('function DeliverPanel'), src.indexOf('function BriefsPanel'));
}

function hookBlock(name: string, next: string): string {
  const src = read(hook);
  const start = src.indexOf(`export function ${name}`);
  const end = src.indexOf(`export function ${next}`);
  return src.slice(start, end);
}

beforeEach(() => {
  removeCalls.length = 0;
  reopenCalls.length = 0;
  removeImpl = null;
  reopenImpl = null;
  removeThrow = null;
  reopenThrow = null;
});

describe('A — pending item renders Quitar', () => {
  it('DeliverPanel pending rows expose Quitar without a confirm dialog', () => {
    const panel = deliverPanel();
    expect(panel).toMatch(/deliver\.pending\.map/);
    expect(panel).toMatch(/react-ws-remove-curation-\$\{entry\.id\}/);
    expect(panel).toMatch(/removeBusy \? 'Retirando…' : 'Quitar'/);
    expect(panel).not.toMatch(/¿Retirar|confirm\(/);
  });
});

describe('B — readyEntries item renders Reabrir', () => {
  it('DeliverPanel ready rows expose Reabrir from readyEntries membership', () => {
    const panel = deliverPanel();
    expect(panel).toMatch(/deliver\.readyEntries\.map/);
    expect(panel).toMatch(/react-ws-reopen-curation-\$\{entry\.id\}/);
    expect(panel).toMatch(/reopenBusy \? 'Reabriendo…' : 'Reabrir'/);
    expect(panel).not.toMatch(/¿Reabrir|confirm\(/);
  });
});

describe('C — packaged item does not expose Reabrir', () => {
  it('draft package items keep #17 Quitar and never render Reabrir', () => {
    const panel = deliverPanel();
    const draft = panel.slice(panel.indexOf('react-ws-draft-package'));
    expect(draft).toMatch(/react-ws-remove-item-\$\{item\.id\}/);
    expect(draft).not.toMatch(/react-ws-reopen-curation/);
    expect(draft).not.toMatch(/'Reabrir'/);
  });
});

describe('D — remove delegates to canonical RemoveCuration', () => {
  it('seam removeCuration reaches the consumer once with UI-safe input', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.removeCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_16_1',
    });
    expect(result).toEqual({ ok: true, message: 'Ítem retirado de la mesa' });
    expect(removeCalls).toEqual([{ requestedClientId: 'client_a', curationEntryId: 'cur_16_1' }]);
    expect(JSON.stringify(removeCalls[0])).not.toMatch(/trusted|actorRole|organizationId/);
    expect(code(consumer)).toMatch(/useCases\.removeCuration/);
    expect(code(removeApp)).toMatch(/createRemoveCuration/);
  });
});

describe('E — reopen delegates to canonical ReopenCuration', () => {
  it('seam reopenCuration reaches the consumer once with UI-safe input', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.reopenCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_16_2',
    });
    expect(result).toEqual({ ok: true, message: 'Ítem reabierto para volver a decidir' });
    expect(reopenCalls).toEqual([{ requestedClientId: 'client_a', curationEntryId: 'cur_16_2' }]);
    expect(JSON.stringify(reopenCalls[0])).not.toMatch(/trusted|actorRole|organizationId/);
    expect(code(consumer)).toMatch(/useCases\.reopenCuration/);
    expect(code(reopenApp)).toMatch(/createReopenCuration/);
  });
});

describe('F — remove uses narrowed workspace client', () => {
  it('remove hook sends only scope.clientId as requestedClientId', () => {
    const block = hookBlock('useRemoveCuration', 'useReopenCuration');
    expect(block).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(block).toMatch(/requestedClientId: scope\.clientId/);
    expect(block).not.toMatch(/organizationId:/);
    expect(block).not.toMatch(/actorRole:/);
    expect(deliverPanel()).toMatch(/useRemoveCuration\(scope\)/);
    expect(deliverPanel()).toMatch(/narrowToClient/);
  });
});

describe('G — reopen uses narrowed workspace client', () => {
  it('reopen hook sends only scope.clientId as requestedClientId', () => {
    const block = hookBlock('useReopenCuration', 'useProposeAngle');
    expect(block).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(block).toMatch(/requestedClientId: scope\.clientId/);
    expect(block).not.toMatch(/organizationId:/);
    expect(block).not.toMatch(/actorRole:/);
    expect(deliverPanel()).toMatch(/useReopenCuration\(scope\)/);
  });
});

describe('H — React contains no direct curation DB write', () => {
  it('Deliver product files never write curation through dbService', () => {
    for (const path of [workspace, hook, seam]) {
      expect(code(path)).not.toMatch(/dbService\.removeCuration/);
      expect(code(path)).not.toMatch(/dbService\.reopenCuration/);
      expect(code(path)).not.toMatch(/dbService\.decideCuration/);
      expect(code(path)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    }
  });
});

describe('I — React contains no local transition table', () => {
  it('DeliverPanel does not assign destination or decided fields locally', () => {
    const panel = deliverPanel();
    expect(panel).not.toMatch(/destination\s*=\s*null/);
    expect(panel).not.toMatch(/managerRationale\s*=\s*['"]{2}/);
    expect(panel).not.toMatch(/decidedAt\s*=/);
    expect(panel).not.toMatch(/decidedBy\s*=/);
    expect(panel).not.toMatch(/VALID_DESTINATIONS|ALLOWED_SOURCE_STATES/);
    expect(code(hook)).not.toMatch(/destination\s*=\s*null/);
  });
});

describe('J — wrong client remove fails closed', () => {
  it('tenant mismatch from the consumer surfaces as a bounded failure', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    removeThrow = new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Curation entry does not belong to the trusted client entitlement.'
    );
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.removeCuration({
      requestedClientId: 'client_b',
      curationEntryId: 'cur_16_1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/trusted client entitlement/);
    }
    expect(code(removeApp)).toMatch(/entry\.clientId !== input\.trusted\.clientId/);
  });
});

describe('K — wrong client reopen fails closed', () => {
  it('tenant mismatch from the consumer surfaces as a bounded failure', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    reopenThrow = new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Curation entry does not belong to the trusted client entitlement.'
    );
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.reopenCuration({
      requestedClientId: 'client_b',
      curationEntryId: 'cur_16_2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/trusted client entitlement/);
    }
    expect(code(reopenApp)).toMatch(/entry\.clientId !== input\.trusted\.clientId/);
  });
});

describe('L — CLIENT role fails canonical authorization', () => {
  it('React never supplies role; Application still requires ADMIN', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    removeThrow = new ExecutionDeliveryError('ACTOR_NOT_AUTHORIZED', 'Actor is not authorized.');
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.removeCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_16_1',
    });
    expect(result.ok).toBe(false);
    expect(code(removeApp)).toMatch(/requireAdminRole/);
    expect(code(reopenApp)).toMatch(/requireAdminRole/);
    expect(hookBlock('useRemoveCuration', 'useReopenCuration')).not.toMatch(/actorRole/);
    expect(hookBlock('useReopenCuration', 'useProposeAngle')).not.toMatch(/actorRole/);
  });
});

describe('M — CURATION_NOT_FOUND surfaces bounded failure', () => {
  it('compat missing entry is not converted into success', async () => {
    removeImpl = () => ({ ok: false, compat: 'CURATION_NOT_FOUND' });
    reopenImpl = () => ({ ok: false, compat: 'CURATION_NOT_FOUND' });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const removed = executionDeliveryCommands.removeCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_missing',
    });
    const reopened = executionDeliveryCommands.reopenCuration({
      requestedClientId: 'client_a',
      curationEntryId: 'cur_missing',
    });
    expect(removed).toEqual({ ok: false, message: 'El ítem de curación ya no existe.' });
    expect(reopened).toEqual({ ok: false, message: 'El ítem de curación ya no existe.' });
    expect(hookBlock('useRemoveCuration', 'useReopenCuration')).toMatch(/if \(!scope \|\| !result\.ok\) return/);
    expect(hookBlock('useReopenCuration', 'useProposeAngle')).toMatch(/if \(!scope \|\| !result\.ok\) return/);
  });
});

describe('N — successful remove invalidates only workspace-deliver', () => {
  it('remove hook invalidates the deliver key and no radar/task/session keys', () => {
    const block = hookBlock('useRemoveCuration', 'useReopenCuration');
    expect(block).toMatch(/tenantQueryKey\(scope, 'compatibility', 'workspace-deliver'\)/);
    expect(block).not.toMatch(/tenantInvalidationKey/);
    expect(block).not.toMatch(/workspace-radar/);
    expect(block).not.toMatch(/workspace-tasks/);
    expect(block).not.toMatch(/sessionQueryKey/);
    expect(block).not.toMatch(/auditService/);
  });
});

describe('O — successful reopen invalidates only workspace-deliver', () => {
  it('reopen hook invalidates the deliver key and no radar/task/session keys', () => {
    const block = hookBlock('useReopenCuration', 'useProposeAngle');
    expect(block).toMatch(/tenantQueryKey\(scope, 'compatibility', 'workspace-deliver'\)/);
    expect(block).not.toMatch(/tenantInvalidationKey/);
    expect(block).not.toMatch(/workspace-radar/);
    expect(block).not.toMatch(/workspace-tasks/);
    expect(block).not.toMatch(/sessionQueryKey/);
  });
});

describe('P — #21 remains unchanged', () => {
  it('Deliver #16 path does not call advisor generation', () => {
    const panel = deliverPanel();
    expect(panel).not.toMatch(/AddAdviceActionToCuration|addAdviceActionToCuration/);
    expect(hookBlock('useRemoveCuration', 'useReopenCuration')).not.toMatch(/addAdviceActionToCuration/);
    expect(hookBlock('useReopenCuration', 'useProposeAngle')).not.toMatch(/addAdviceActionToCuration/);
    const seamSrc = code(seam);
    const seamBlock = seamSrc.slice(
      seamSrc.indexOf('removeCuration(intent'),
      seamSrc.indexOf('async proposeAngle(intent')
    );
    expect(seamBlock).not.toMatch(/addAdviceActionToCuration/);
    expect(seamBlock).not.toMatch(/scoreSignal|createContentDraft/);
    expect(read(advisor)).toMatch(/createAddAdviceActionToCuration|AddAdviceActionToCuration/);
  });
});

describe('Q — #22 and #33 remain unchanged', () => {
  it('Deliver #16 path does not score, recommend, or create content', () => {
    const panel = deliverPanel();
    expect(panel).not.toMatch(/scoreSignal|addRecommendation|createContentDraft/);
    expect(code(hook)).not.toMatch(/scoreSignal|createContentDraft/);
    expect(read(createDraft)).toMatch(/createCreateContentDraft|CreateContentDraft/);
  });
});

describe('R — legacy Quitar/Reabrir remain for rollback', () => {
  it('legacy host and handlers still expose both actions', () => {
    expect(read(legacyHost)).toMatch(/btn-remove-curation/);
    expect(read(legacyHost)).toMatch(/>Quitar</);
    expect(read(legacyHost)).toMatch(/btn-reopen-curation/);
    expect(read(legacyHandlers)).toMatch(/handleRemoveCurationClick/);
    expect(read(legacyHandlers)).toMatch(/handleReopenCurationClick/);
    expect(read(legacyHandlers)).toMatch(/Ítem retirado de la mesa/);
    expect(read(legacyHandlers)).toMatch(/Ítem reabierto para volver a decidir/);
  });
});

describe('#16 authority and layer boundaries', () => {
  it('APPLICATION and DOMAIN files are not imported as writers from React product files', () => {
    expect(code(workspace)).not.toMatch(/from\s+['"][^'"]*application\/executionDelivery['"]/);
    expect(code(hook)).not.toMatch(/from\s+['"][^'"]*application\/executionDelivery['"]/);
    expect(code(workspace)).not.toMatch(/createRemoveCuration|createReopenCuration/);
    expect(read(removeApp)).toMatch(/physical delete of CurationEntry/i);
    expect(read(reopenApp)).toMatch(/partial decision reset only/);
  });
});
