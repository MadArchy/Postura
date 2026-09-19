/**
 * SPEC-010 · #21 advisor click-only React parity (AddAdviceActionToCuration).
 *
 * Presentation + existing Execution Delivery command only.
 * No AI generation, topic agent, #22 scoring, or #33 CreateContentDraft.
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
const reads = 'src/ui/data/compatibilityReads.ts';
const consumer = 'src/services/executionDeliveryConsumer.ts';
const advisorApp = 'src/application/executionDelivery/AddAdviceActionToCuration.ts';
const createDraft = 'src/application/executionDelivery/CreateContentDraft.ts';
const advisorLegacy = 'src/ui/legacy/handlers/advisorHandlers.ts';
const legacyHost = 'src/components/ClientWorkspace.ts';
const aiAdvisor = 'src/services/advisor.ts';
const topicAgent = 'src/services/topicAgent.ts';

const addCalls: {
  requestedClientId: string | null | undefined;
  adviceActionId: string;
}[] = [];

let addImpl:
  | ((intent: { adviceActionId: string }) => { entry: { id: string }; adviceActionId: string })
  | null = null;
let addThrow: unknown = null;

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
  addAdviceActionToCuration: (intent: {
    requestedClientId: string | null | undefined;
    adviceActionId: string;
  }) => {
    addCalls.push(intent);
    if (addThrow) throw addThrow;
    if (addImpl) return addImpl(intent);
    return { entry: { id: 'cur_21_1' }, adviceActionId: intent.adviceActionId };
  },
  removeCuration: vi.fn(),
  reopenCuration: vi.fn(),
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

function advicePanel(): string {
  const src = code(workspace);
  return src.slice(src.indexOf('function AdviceActionsPanel'), src.indexOf('export function ReactClientWorkspacePage'));
}

function radarPanel(): string {
  const src = code(workspace);
  return src.slice(src.indexOf('function RadarPanel'), src.indexOf('function DeliverPanel'));
}

function hookBlock(name: string, next: string): string {
  const src = read(hook);
  const start = src.indexOf(`export function ${name}`);
  const end = src.indexOf(`export function ${next}`);
  return src.slice(start, end);
}

function seamAdvisorBlock(): string {
  const src = code(seam);
  return src.slice(
    src.indexOf('addAdviceActionToCuration(intent'),
    src.indexOf('removeCuration(intent')
  );
}

beforeEach(() => {
  addCalls.length = 0;
  addImpl = null;
  addThrow = null;
});

describe('A — seeded existing advice action appears in React', () => {
  it('AdviceActionsPanel maps persisted actions from the compatibility read', () => {
    const panel = advicePanel();
    expect(panel).toMatch(/useWorkspaceAdvice\(scope\)/);
    expect(panel).toMatch(/data\?\.actions/);
    expect(panel).toMatch(/react-ws-advice-action-\$\{action\.id\}/);
    expect(code(reads)).toMatch(/export function readWorkspaceAdvice/);
    expect(code(reads)).toMatch(/dbService\.getLatestAdvice\(clientId\)/);
  });
});

describe('B — factual title/why/how are displayed', () => {
  it('panel renders title, why, and how from the advice action', () => {
    const panel = advicePanel();
    expect(panel).toMatch(/react-ws-advice-title-\$\{action\.id\}/);
    expect(panel).toMatch(/\{action\.title\}/);
    expect(panel).toMatch(/react-ws-advice-why-\$\{action\.id\}/);
    expect(panel).toMatch(/\{action\.why\}/);
    expect(panel).toMatch(/react-ws-advice-how-\$\{action\.id\}/);
    expect(panel).toMatch(/\{action\.how\}/);
    expect(panel).toMatch(/action\.horizon/);
    expect(panel).toMatch(/action\.category/);
    expect(panel).toMatch(/action\.impact/);
  });
});

describe('C — Preparar entrega exists', () => {
  it('each existing action exposes Preparar entrega and no generate controls', () => {
    const panel = advicePanel();
    expect(panel).toMatch(/react-ws-advice-prepare-\$\{action\.id\}/);
    expect(panel).toMatch(/busy \? 'Enviando…' : 'Preparar entrega'/);
    expect(panel).not.toMatch(/Generar consejo|Regenerar|Descubrir temas/);
    expect(panel).not.toMatch(/btn-generate-advice|btn-run-topic-agent/);
    expect(panel).toMatch(/No hay acciones de consejo para este cliente\./);
  });
});

describe('D — click delegates to canonical AddAdviceActionToCuration', () => {
  it('seam addAdviceActionToCuration reaches the consumer once', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.addAdviceActionToCuration({
      requestedClientId: 'client_a',
      adviceActionId: 'adv_21_1',
    });
    expect(result).toEqual({ ok: true, message: 'Acción enviada a la mesa de curación' });
    expect(addCalls).toEqual([{ requestedClientId: 'client_a', adviceActionId: 'adv_21_1' }]);
    expect(code(consumer)).toMatch(/useCases\.addAdviceActionToCuration/);
    expect(code(advisorApp)).toMatch(/createAddAdviceActionToCuration/);
  });
});

describe('E — exact adviceActionId reaches consumer', () => {
  it('seam forwards the clicked adviceActionId without rewriting it', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    executionDeliveryCommands.addAdviceActionToCuration({
      requestedClientId: 'client_a',
      adviceActionId: 'adv_exact_id',
    });
    expect(addCalls[0]?.adviceActionId).toBe('adv_exact_id');
    expect(advicePanel()).toMatch(/mutateAsync\(\{ adviceActionId \}\)/);
  });
});

describe('F — client derives from narrowed workspace scope', () => {
  it('advice hook and mutation send only scope.clientId', () => {
    const readHook = hookBlock('useWorkspaceAdvice', 'useAddAdviceActionToCuration');
    const mutateHook = hookBlock('useAddAdviceActionToCuration', 'useDecideCuration');
    expect(readHook).toMatch(/readWorkspaceAdvice\(scope!\)/);
    expect(mutateHook).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(mutateHook).toMatch(/requestedClientId: scope\.clientId/);
    expect(mutateHook).not.toMatch(/organizationId:/);
    expect(mutateHook).not.toMatch(/actorRole:/);
    expect(advicePanel()).toMatch(/useAddAdviceActionToCuration\(scope\)/);
    expect(advicePanel()).toMatch(/narrowToClient/);
  });
});

describe('G — React performs no direct curation DB write', () => {
  it('advisor product files never write curation through dbService', () => {
    for (const path of [workspace, hook, seam]) {
      expect(code(path)).not.toMatch(/dbService\.addToCuration/);
      expect(code(path)).not.toMatch(/dbService\.saveAdvice/);
      expect(code(path)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    }
  });
});

describe('H — React contains no local curation creation', () => {
  it('AdviceActionsPanel does not construct a CurationEntry', () => {
    const panel = advicePanel();
    expect(panel).not.toMatch(/destination\s*:/);
    expect(panel).not.toMatch(/createId\(\s*['"]cur/);
    expect(panel).not.toMatch(/addToCuration\s*\(/);
    expect(panel).not.toMatch(/organizationId\s*:/);
    expect(code(hook)).not.toMatch(/addToCuration\s*\(/);
  });
});

describe('I — foreign advice action fails closed', () => {
  it('tenant mismatch from the consumer surfaces as a bounded failure', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    addThrow = new ExecutionDeliveryError(
      'TENANT_CONTEXT_INVALID',
      'Advice does not belong to the trusted client entitlement.'
    );
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.addAdviceActionToCuration({
      requestedClientId: 'client_b',
      adviceActionId: 'adv_21_1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/trusted client entitlement/);
    }
    expect(code(advisorApp)).toMatch(/advice\.clientId !== input\.trusted\.clientId/);
  });
});

describe('J — CLIENT/unauthorized role fails closed', () => {
  it('React never supplies role; Application still requires ADMIN', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    addThrow = new ExecutionDeliveryError('ACTOR_NOT_AUTHORIZED', 'Actor is not authorized.');
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.addAdviceActionToCuration({
      requestedClientId: 'client_a',
      adviceActionId: 'adv_21_1',
    });
    expect(result.ok).toBe(false);
    expect(code(advisorApp)).toMatch(/requireAdminRole/);
    expect(hookBlock('useAddAdviceActionToCuration', 'useDecideCuration')).not.toMatch(/actorRole/);
    expect(seamAdvisorBlock()).not.toMatch(/actorRole|trustedOrganization|role:/);
  });
});

describe('K — successful mutation invalidates workspace-deliver', () => {
  it('add-advice hook invalidates only the deliver key', () => {
    const block = hookBlock('useAddAdviceActionToCuration', 'useDecideCuration');
    expect(block).toMatch(/tenantQueryKey\(scope, 'compatibility', 'workspace-deliver'\)/);
    expect(block).not.toMatch(/tenantInvalidationKey/);
    expect(block).not.toMatch(/workspace-radar/);
    expect(block).not.toMatch(/workspace-advice/);
    expect(block).not.toMatch(/sessionQueryKey/);
    expect(block).not.toMatch(/auditService/);
  });
});

describe('L — advice query is not invalidated unnecessarily', () => {
  it('success path does not invalidate workspace-advice', () => {
    const block = hookBlock('useAddAdviceActionToCuration', 'useDecideCuration');
    expect(block).toMatch(/if \(!scope \|\| !result\.ok\) return/);
    expect(block).not.toMatch(/workspace-advice/);
    expect(advicePanel()).not.toMatch(/invalidateQueries/);
  });
});

describe('M — ADVICE_ACTION_NOT_FOUND surfaces failure', () => {
  it('missing action is a bounded failure, not success', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    addThrow = new ExecutionDeliveryError(
      'ADVICE_ACTION_NOT_FOUND',
      'Advice action not found: adv_missing'
    );
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.addAdviceActionToCuration({
      requestedClientId: 'client_a',
      adviceActionId: 'adv_missing',
    });
    expect(result).toEqual({ ok: false, message: 'El consejo ya no existe.' });
    expect(advicePanel()).toMatch(/react-ws-advice-error/);
    expect(hookBlock('useAddAdviceActionToCuration', 'useDecideCuration')).toMatch(
      /if \(!scope \|\| !result\.ok\) return/
    );
  });
});

describe('N — no generatePositioningAdvice', () => {
  it('React advisor surface does not invoke AI advice generation', () => {
    expect(advicePanel()).not.toMatch(/generatePositioningAdvice/);
    expect(code(hook)).not.toMatch(/generatePositioningAdvice/);
    expect(seamAdvisorBlock()).not.toMatch(/generatePositioningAdvice/);
    expect(code(reads)).not.toMatch(/generatePositioningAdvice/);
    expect(read(aiAdvisor)).toMatch(/export async function generatePositioningAdvice/);
  });
});

describe('O — no runTopicAgent', () => {
  it('React advisor surface does not invoke the topic agent', () => {
    expect(advicePanel()).not.toMatch(/runTopicAgent/);
    expect(code(hook)).not.toMatch(/runTopicAgent/);
    expect(seamAdvisorBlock()).not.toMatch(/runTopicAgent/);
    expect(read(topicAgent)).toMatch(/export function runTopicAgent/);
  });
});

describe('P — no #22 mutation', () => {
  it('advisor click path does not score, investigate, or persist recommendations', () => {
    expect(advicePanel()).not.toMatch(/scoreSignal|addRecommendation|scoreAndRouteSignal/);
    expect(hookBlock('useAddAdviceActionToCuration', 'useDecideCuration')).not.toMatch(
      /scoreSignal|addRecommendation|scoreAndRouteSignal/
    );
    expect(radarPanel()).not.toMatch(/addAdviceActionToCuration/);
  });
});

describe('Q — no #33/CreateContentDraft', () => {
  it('advisor click path does not create content drafts', () => {
    expect(advicePanel()).not.toMatch(/createContentDraft|CreateContentDraft|generateContent/);
    expect(hookBlock('useAddAdviceActionToCuration', 'useDecideCuration')).not.toMatch(
      /createContentDraft|CreateContentDraft/
    );
    expect(read(createDraft)).toMatch(/createCreateContentDraft|CreateContentDraft/);
  });
});

describe('R — legacy advisor path remains present', () => {
  it('legacy host and handlers still expose Preparar entrega and AI siblings', () => {
    expect(read(legacyHost)).toMatch(/btn-advice-to-curation/);
    expect(read(legacyHost)).toMatch(/Preparar entrega/);
    expect(read(advisorLegacy)).toMatch(/handleAdviceToCurationClick/);
    expect(read(advisorLegacy)).toMatch(/generatePositioningAdvice/);
    expect(read(advisorLegacy)).toMatch(/runTopicAgent/);
    expect(read(advisorLegacy)).toMatch(/Acción enviada a la mesa de curación/);
  });
});

describe('#21 layer and authority boundaries', () => {
  it('new Application and Domain files are not introduced by the React path', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    executionDeliveryCommands.addAdviceActionToCuration({
      requestedClientId: 'client_a',
      adviceActionId: 'adv_21_1',
    });
    expect(code(workspace)).not.toMatch(/from\s+['"][^'"]*application\/executionDelivery['"]/);
    expect(code(hook)).not.toMatch(/from\s+['"][^'"]*application\/executionDelivery['"]/);
    expect(code(workspace)).not.toMatch(/createAddAdviceActionToCuration/);
    expect(code(reads)).toMatch(/export function readWorkspaceAdvice/);
    expect(code(reads)).not.toMatch(/saveAdvice|addToCuration/);
    expect(JSON.stringify(addCalls[0])).not.toMatch(/trusted|actorRole|organizationId/);
  });
});
