/**
 * SPEC-010 · T603 React Parity Wave P7 — #18 SendDeliveryPackage.
 *
 * Presentation parity only via frozen executionDeliveryCommands.sendDeliveryPackage.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sendCalls: {
  requestedClientId: string | null | undefined;
  packageId: string;
}[] = [];

const notifyCalls: {
  clientId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
}[] = [];

let sendImpl:
  | ((intent: (typeof sendCalls)[number]) => Promise<{
      packageId: string;
      clientId: string;
      itemCount: number;
      createdTasks: number;
      convertedSignalIds: string[];
    }>)
  | null = null;

let notifyReturns = true;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  sendDeliveryPackage: async (intent: (typeof sendCalls)[number]) => {
    sendCalls.push(intent);
    if (sendImpl) return sendImpl(intent);
    return {
      packageId: intent.packageId,
      clientId: intent.requestedClientId || 'client_a',
      itemCount: 1,
      createdTasks: 1,
      convertedSignalIds: [],
    };
  },
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
}));

vi.mock('../src/services/notifications', () => ({
  notifyClient: (
    clientId: string,
    input: { type: string; title: string; body: string; href?: string }
  ) => {
    notifyCalls.push({ clientId, ...input });
    return notifyReturns;
  },
  notifyManager: vi.fn(),
}));

vi.mock('../src/ui/data/compatibilityReads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ui/data/compatibilityReads')>();
  return {
    ...actual,
    readDeliverySentNotifyFacts: (packageId: string) =>
      packageId
        ? { title: 'Briefing demo', itemCount: 1 }
        : null,
  };
});

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel);
}

beforeEach(() => {
  sendCalls.length = 0;
  notifyCalls.length = 0;
  sendImpl = null;
  notifyReturns = true;
});

describe('P7 §9–§10 — command seam public input', () => {
  it('invokes SendDeliveryPackage once with public input only', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.sendDeliveryPackage({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.packageId).toBe('pkg_1');
      expect(result.createdTasks).toBe(1);
      expect(result.message).toMatch(/Briefing enviado/);
    }
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toEqual({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
    });
    expect(JSON.stringify(sendCalls[0])).not.toMatch(
      /claimed|trusted|organizationId|actorRole|status|SENT/
    );
  });

  it('notifies client once after successful send (presentation compatibility)', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    await executionDeliveryCommands.sendDeliveryPackage({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
    });
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]).toMatchObject({
      clientId: 'client_a',
      type: 'BRIEFING',
      title: 'Nuevo briefing de tu Brand Manager',
      href: 'client-home',
    });
  });

  it('notify skip still returns ok with compatibility message', async () => {
    notifyReturns = false;
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = await executionDeliveryCommands.sendDeliveryPackage({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notifySkipped).toBe(true);
      expect(result.message).toMatch(/no tiene cuenta/);
    }
  });

  it('surfaces consumer errors without silent success', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    sendImpl = async () => {
      throw new ExecutionDeliveryError('STRATEGIC_BRIEF_GATE_DENIED', 'Este briefing ya fue enviado.');
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    expect(
      await executionDeliveryCommands.sendDeliveryPackage({
        requestedClientId: 'client_a',
        packageId: 'pkg_sent',
      })
    ).toEqual({ ok: false, message: 'Este briefing ya fue enviado.' });
    expect(notifyCalls).toHaveLength(0);
  });

  it('REACT PUBLIC INPUT KEYS match frozen public input', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    await executionDeliveryCommands.sendDeliveryPackage({
      requestedClientId: 'client_a',
      packageId: 'pkg_1',
    });
    expect(Object.keys(sendCalls[0]!).sort()).toEqual(['packageId', 'requestedClientId']);
  });
});

describe('P7 §7 / §20 — React surface authority guards', () => {
  it('DeliverPanel and preview expose native send without delivery-preview handoff', () => {
    const workspace = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    const modal = read('src/ui/modules/pages/modals/ReactModals.tsx');
    expect(workspace).toMatch(/react-ws-deliver-preview-send/);
    expect(workspace).toMatch(/ReactDeliveryPreviewModal/);
    expect(workspace).toMatch(/narrowToClient/);
    expect(workspace).toMatch(/react-ws-ensure-draft|react-ws-draft-package/);
    expect(workspace).not.toMatch(/react-ws-deliver-handoff/);
    expect(workspace).not.toMatch(/montar el briefing/);
    expect(workspace).not.toMatch(/montar y enviar el briefing/);
    expect(modal).toMatch(/useSendDeliveryPackage/);
    expect(modal).toMatch(/narrowToClient/);
    expect(modal).toMatch(/react-delivery-preview-confirm-send/);
    expect(modal).not.toMatch(/react-delivery-preview-handoff/);
  });

  it('direct React dbService read/write = 0; no #14–#17 / #19 calls', () => {
    const workspace = code('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    const modal = code('src/ui/modules/pages/modals/ReactModals.tsx');
    const hooks = code('src/ui/hooks/useWave3Data.ts');
    for (const source of [workspace, modal]) {
      expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
      expect(source).not.toMatch(/\bdbService\.(get|add|update|mark|discard|ensure)/);
      expect(source).not.toMatch(/\b(decideCuration|proposeAngle|removeCuration|reopenCuration)\s*\(/);
      expect(source).not.toMatch(
        /ensureDraftDelivery|addCurationToDelivery|discardDraftDelivery|updateDeliveryPackageMetadata/
      );
      expect(source).not.toMatch(/acknowledgeDelivery|useAcknowledgeDelivery/);
    }
    expect(hooks).toMatch(/executionDeliveryCommands\.sendDeliveryPackage/);
    expect(hooks).toMatch(/useSendDeliveryPackage/);
    const sendHook = hooks.slice(
      hooks.indexOf('export function useSendDeliveryPackage'),
      hooks.indexOf('export function useWorkspaceSources')
    );
    expect(sendHook).not.toMatch(/\bdbService\b/);
  });

  it('seam delegates to consumer; React audit = 0 for #18', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/sendDeliveryPackage/);
    expect(seam).toMatch(/notifyClient/);
    const sendBlock = seam.slice(
      seam.indexOf('async sendDeliveryPackage'),
      seam.indexOf('transitionClientTask(intent:')
    );
    expect(sendBlock).not.toMatch(/auditService/);
    expect(sendBlock).not.toMatch(/dbService\./);
    const modal = read('src/ui/modules/pages/modals/ReactModals.tsx');
    expect(modal).not.toMatch(/auditService|DELIVERY_SENT/);
  });

  it('SendDeliveryPackage Application remains frozen (no notify)', () => {
    const app = read('src/application/executionDelivery/SendDeliveryPackage.ts');
    expect(app).toMatch(/requireAdminRole/);
    expect(app).not.toMatch(/notifyClient|notifyManager|auditService/);
  });

  it('legacy send path retained for rollback', () => {
    const handlers = read('src/ui/legacy/handlers/deliveryHandlers.ts');
    const controller = read('src/controllers/contentPipelineCommands.ts');
    expect(handlers).toMatch(/btn-confirm-send-delivery/);
    expect(controller).toMatch(/sendDeliveryPackage\(/);
    expect(controller).toMatch(/Nuevo briefing de tu Brand Manager/);
  });

  it('mutation hook invalidates compatibility queries after success', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useSendDeliveryPackage/);
    expect(hooks).toMatch(/invalidateQueries/);
  });

  it('draft package read projection is factual only', () => {
    const reads = code('src/ui/data/compatibilityReads.ts');
    expect(reads).toMatch(/draftPackage/);
    expect(reads).toMatch(/readDeliverySentNotifyFacts/);
    expect(reads).not.toMatch(/validateDeliveryForSend/);
  });
});

describe('P7 §3 — #18 canonical authority union', () => {
  it('owns send of prepared package only — not assembly', () => {
    const app = code('src/application/executionDelivery/SendDeliveryPackage.ts');
    expect(app).toMatch(/packageId: string/);
    expect(app).toMatch(/requireAdminRole/);
    expect(app).toMatch(/validateDeliveryForSend|markDeliverySent|ALREADY_SENT|NOT_DRAFT/);
    expect(app).not.toMatch(/decideCuration|proposeAngle|ensureDraftDelivery/);
  });
});
