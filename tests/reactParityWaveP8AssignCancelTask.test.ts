/**
 * SPEC-010 · T603 React Parity Wave P8 — #27 AssignClientTask / CancelClientTask.
 *
 * Presentation parity only via executionDeliveryCommands.assignClientTaskManual
 * and cancelClientTask. FROM_RECOMMENDATION remains #33 composite.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const assignCalls: {
  requestedClientId: string | null | undefined;
  origin: { kind: string; [k: string]: unknown };
}[] = [];

const cancelCalls: { taskId: string }[] = [];

const notifyCalls: {
  clientId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  targetId?: string;
}[] = [];

const auditCalls: { event: string; entity: string; entityId: string }[] = [];

let notifyReturns = true;
let cancelImpl:
  | ((intent: { taskId: string }) => {
      ok: true;
      task: { id: string; status: string };
    }
  | { ok: false; compat: 'TASK_NOT_FOUND' })
  | null = null;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => ({ id: 'user_admin_01', role: 'ADMIN' }) },
}));

vi.mock('../src/services/audit', () => ({
  auditService: {
    log: (
      _user: unknown,
      event: string,
      entity: string,
      entityId: string
    ) => {
      auditCalls.push({ event, entity, entityId });
    },
  },
}));

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  assignClientTask: (intent: (typeof assignCalls)[number]) => {
    assignCalls.push(intent);
    return {
      task: {
        id: 'task_p8_1',
        clientId: intent.requestedClientId || 'client_a',
        title: (intent.origin as { title?: string }).title || 'Tarea',
        type: (intent.origin as { type?: string }).type || 'SUBMIT_INFO',
      },
      origin: intent.origin.kind,
    };
  },
  cancelClientTask: (intent: { taskId: string }) => {
    cancelCalls.push(intent);
    if (cancelImpl) return cancelImpl(intent);
    return { ok: true, task: { id: intent.taskId, status: 'CANCELLED' } };
  },
  sendDeliveryPackage: vi.fn(),
  acknowledgeDelivery: vi.fn(),
  reviewClientArticle: vi.fn(),
  saveContentDraft: vi.fn(),
  transitionClientTask: vi.fn(),
  createContentDraft: vi.fn(),
}));

vi.mock('../src/services/notifications', () => ({
  notifyClient: (
    clientId: string,
    input: {
      type: string;
      title: string;
      body: string;
      href?: string;
      targetId?: string;
    }
  ) => {
    notifyCalls.push({ clientId, ...input });
    return notifyReturns;
  },
  notifyManager: vi.fn(),
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

beforeEach(() => {
  assignCalls.length = 0;
  cancelCalls.length = 0;
  notifyCalls.length = 0;
  auditCalls.length = 0;
  notifyReturns = true;
  cancelImpl = null;
});

describe('P8 §4 — #27 / #33 ownership gate', () => {
  it('FROM_RECOMMENDATION is owned by #33 composite presentation only', () => {
    const content = read('src/ui/legacy/handlers/contentHandlers.ts');
    expect(content).toMatch(/kind:\s*'RECOMMENDATION_TASK_SCRIPT'/);
    expect(content).toMatch(/kind:\s*'FROM_RECOMMENDATION'/);
    expect(content).toMatch(/createContentDraft\s*\(/);
    expect(content).toMatch(/assignClientTask\s*\(/);
    expect(content).toMatch(/btn-create-task-from-rec/);

    const tasksHandler = read('src/ui/legacy/handlers/tasksHandlers.ts');
    expect(tasksHandler).toMatch(/kind:\s*'MANUAL'/);
    expect(tasksHandler).not.toMatch(/FROM_RECOMMENDATION/);

    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/useAssignClientTaskManual/);
    expect(panel).toMatch(/useCancelClientTask/);
    expect(panel).not.toMatch(/kind:\s*'FROM_RECOMMENDATION'/);
    expect(panel).not.toMatch(/RECOMMENDATION_TASK_SCRIPT/);
    expect(panel).not.toMatch(/createContentDraft/);
  });

  it('React seam pins MANUAL origin and does not expose recommendation assign API', () => {
    const seam = read('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/assignClientTaskManual/);
    expect(seam).toMatch(/kind:\s*'MANUAL'/);
    expect(seam).not.toMatch(/assignClientTaskFromRecommendation/);
    expect(seam).not.toMatch(/kind:\s*'FROM_RECOMMENDATION'/);
  });
});

describe('P8 §9–§11 — command seam public input', () => {
  it(
    'manual assign invokes AssignClientTask once with MANUAL origin only',
    async () => {
      const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
      const result = executionDeliveryCommands.assignClientTaskManual({
        requestedClientId: 'client_a',
        thesisId: 'thesis_1',
        type: 'SUBMIT_INFO',
        title: 'Enviar CV',
        description: 'Adjunta el PDF actualizado.',
        estimatedMinutes: 20,
      });
      expect(result.ok).toBe(true);
      expect(assignCalls).toHaveLength(1);
      expect(assignCalls[0]).toEqual({
        requestedClientId: 'client_a',
        origin: {
          kind: 'MANUAL',
          thesisId: 'thesis_1',
          type: 'SUBMIT_INFO',
          title: 'Enviar CV',
          description: 'Adjunta el PDF actualizado.',
          estimatedMinutes: 20,
          deadline: undefined,
        },
      });
      expect(JSON.stringify(assignCalls[0])).not.toMatch(
        /claimed|trusted|organizationId|actorRole|FROM_RECOMMENDATION|status/
      );
      expect(notifyCalls).toHaveLength(1);
      expect(notifyCalls[0]).toMatchObject({
        clientId: 'client_a',
        type: 'TASK_ASSIGNED',
        title: 'Nueva tarea asignada',
        body: 'Enviar CV',
        href: 'client-home',
      });
      expect(auditCalls.some((a) => a.event === 'ASSIGN_TASK')).toBe(true);
    },
    15_000
  );
  it('cancel invokes CancelClientTask exactly once', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.cancelClientTask({ taskId: 'task_1' });
    expect(result.ok).toBe(true);
    expect(cancelCalls).toEqual([{ taskId: 'task_1' }]);
    expect(JSON.stringify(cancelCalls[0])).not.toMatch(/claimed|trusted|status|organizationId/);
  });

  it('missing-task cancel compat remains ok presentation', async () => {
    cancelImpl = () => ({ ok: false, compat: 'TASK_NOT_FOUND' });
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.cancelClientTask({ taskId: 'missing' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.compatMissing).toBe(true);
  });
});

describe('P8 surface / authority / residual boundaries', () => {
  it('TasksPanel wires assign/cancel and retains recordings handoff only', () => {
    const panel = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(panel).toMatch(/react-ws-tasks-assign-form/);
    expect(panel).toMatch(/react-ws-tasks-assign-submit/);
    expect(panel).toMatch(/react-ws-task-cancel-/);
    expect(panel).toMatch(/react-ws-tasks-handoff/);
    expect(panel).toMatch(/gestionar grabaciones/);
    expect(panel).not.toMatch(/asignar tareas/);
    expect(panel).toMatch(/narrowToClient/);
    expect(panel).not.toMatch(/transitionClientTask/);
    expect(panel).not.toMatch(/dbService\./);
  });

  it('hooks invalidate compatibility queries and do not call #28/#33', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useAssignClientTaskManual/);
    expect(hooks).toMatch(/useCancelClientTask/);
    expect(hooks).toMatch(/assignClientTaskManual/);
    expect(hooks).toMatch(/cancelClientTask/);
    const assignIdx = hooks.indexOf('export function useAssignClientTaskManual');
    const cancelIdx = hooks.indexOf('export function useCancelClientTask');
    const assignBlock = hooks.slice(assignIdx, assignIdx + 800);
    const cancelBlock = hooks.slice(cancelIdx, cancelIdx + 600);
    expect(assignBlock).not.toMatch(/createContentDraft|transitionClientTask|FROM_RECOMMENDATION/);
    expect(cancelBlock).not.toMatch(/createContentDraft|transitionClientTask/);
  });

  it('AssignClientTask / CancelClientTask Application remain frozen', () => {
    const assign = read('src/application/executionDelivery/AssignClientTask.ts');
    const cancel = read('src/application/executionDelivery/CancelClientTask.ts');
    expect(assign).toMatch(/kind: 'MANUAL'/);
    expect(assign).toMatch(/kind: 'FROM_RECOMMENDATION'/);
    expect(assign).toMatch(/requireAdminRole/);
    expect(cancel).toMatch(/requireAdminRole/);
    expect(cancel).toMatch(/CANCELLED/);
  });

  it('legacy rollback task handlers still own MANUAL assign + cancel', () => {
    const tasks = read('src/ui/legacy/handlers/tasksHandlers.ts');
    expect(tasks).toMatch(/assignClientTask/);
    expect(tasks).toMatch(/cancelClientTask/);
    expect(tasks).toMatch(/form-add-task/);
    expect(tasks).toMatch(/btn-cancel-task/);
  });
});
