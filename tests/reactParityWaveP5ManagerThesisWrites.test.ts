/**
 * SPEC-010 · T603 React Parity Wave P5 — #11 SaveThesis + #12 ActivateThesis.
 *
 * Presentation parity only via frozen thesisLifecycleCommands seam.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PositioningThesis, ThesisEditableFields } from '../src/types';
import { createSaveThesis, createActivateThesis } from '../src/application/thesisLifecycle';
import type { ThesisRepository } from '../src/application/thesisLifecycle';
import { createDecideThesisClientReview } from '../src/application/thesisLifecycle/DecideThesisClientReview';

const saveCalls: {
  requestedClientId: string | null | undefined;
  thesisId: string;
  intent: string;
  fields: ThesisEditableFields;
}[] = [];

const activateCalls: {
  requestedClientId: string | null | undefined;
  thesisId: string;
}[] = [];

const notifyCalls: {
  clientId: string;
  type: string;
  title: string;
  body: string;
}[] = [];

let saveImpl: ((intent: (typeof saveCalls)[number]) => {
  thesis: PositioningThesis;
  toast: string;
  notifyClient: boolean;
  intent: 'draft' | 'submit_review';
}) | null = null;

let activateImpl: ((intent: (typeof activateCalls)[number]) => { thesis: PositioningThesis }) | null =
  null;

let notifyReturns = true;
let notifyThrows = false;

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => null },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/thesisLifecycleConsumer', () => ({
  saveThesis: (intent: (typeof saveCalls)[number]) => {
    saveCalls.push(intent);
    if (saveImpl) return saveImpl(intent);
    return {
      thesis: {
        id: intent.thesisId,
        organizationId: 'org_a',
        clientId: 'client_a',
        title: intent.fields.title,
        expertIdentity: intent.fields.expertIdentity,
        targetAudience: intent.fields.targetAudience,
        domain: intent.fields.domain,
        objective: intent.fields.objective,
        proofPoints: intent.fields.proofPoints,
        voiceAndTone: intent.fields.voiceAndTone,
        complianceRules: intent.fields.complianceRules,
        status: intent.intent === 'submit_review' ? 'UNDER_REVIEW' : 'DRAFT',
        clientApprovalStatus: 'PENDING',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin',
        updatedAt: '2026-01-01T00:00:00.000Z',
        updatedBy: 'admin',
      } as PositioningThesis,
      toast:
        intent.intent === 'submit_review'
          ? 'Tesis enviada a revisión del cliente.'
          : 'Borrador guardado. El cliente aún no la ve.',
      notifyClient: intent.intent === 'submit_review',
      intent: intent.intent,
    };
  },
  activateThesis: (intent: (typeof activateCalls)[number]) => {
    activateCalls.push(intent);
    if (activateImpl) return activateImpl(intent);
    return {
      thesis: {
        id: intent.thesisId,
        organizationId: 'org_a',
        clientId: 'client_a',
        title: 'Activated',
        expertIdentity: 'ID',
        targetAudience: 'A',
        domain: 'D',
        objective: 'O',
        proofPoints: ['p'],
        voiceAndTone: 'T',
        complianceRules: 'C',
        status: 'ACTIVE',
        clientApprovalStatus: 'APPROVED',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin',
        updatedAt: '2026-01-01T00:00:00.000Z',
        updatedBy: 'admin',
      } as PositioningThesis,
    };
  },
  decideThesisClientReview: vi.fn(),
}));

vi.mock('../src/services/notifications', () => ({
  notifyClient: (
    clientId: string,
    input: { type: string; title: string; body: string }
  ) => {
    if (notifyThrows) throw new Error('notify failed');
    notifyCalls.push({ clientId, ...input });
    return notifyReturns;
  },
  notifyManager: vi.fn(),
}));

const baseFields: ThesisEditableFields = {
  title: 'Tesis demo',
  expertIdentity: 'Identidad experta',
  targetAudience: 'Audiencia',
  domain: 'Dominio',
  objective: 'Objetivo',
  proofPoints: ['Prueba'],
  voiceAndTone: 'Tono',
  complianceRules: 'Reglas',
  differentiator: 'Diff',
  perceptionTarget: 'Percepción',
};

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel);
}

beforeEach(() => {
  saveCalls.length = 0;
  activateCalls.length = 0;
  notifyCalls.length = 0;
  saveImpl = null;
  activateImpl = null;
  notifyReturns = true;
  notifyThrows = false;
});

describe('P5 §4–§5 — command seam public input', () => {
  it('save draft invokes SaveThesis once with public input only', async () => {
    const { thesisLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = thesisLifecycleCommands.saveThesis({
      requestedClientId: 'client_a',
      thesisId: 'thesis_1',
      intent: 'draft',
      fields: baseFields,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.intent).toBe('draft');
      expect(result.toast).toMatch(/Borrador/);
      expect(result.notifyClient).toBe(false);
    }
    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0]).toEqual({
      requestedClientId: 'client_a',
      thesisId: 'thesis_1',
      intent: 'draft',
      fields: baseFields,
    });
    expect(JSON.stringify(saveCalls[0])).not.toMatch(/claimed/);
    expect(JSON.stringify(saveCalls[0])).not.toMatch(/organizationId|actorRole|trusted/);
    expect(notifyCalls).toHaveLength(0);
  });

  it('submit_review notifies client once after success', async () => {
    const { thesisLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = thesisLifecycleCommands.saveThesis({
      requestedClientId: 'client_a',
      thesisId: 'thesis_1',
      intent: 'submit_review',
      fields: baseFields,
    });
    expect(result.ok).toBe(true);
    expect(saveCalls).toHaveLength(1);
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]).toMatchObject({
      clientId: 'client_a',
      type: 'THESIS',
      title: 'Tesis lista para tu aprobación',
      body: 'Tesis demo',
    });
  });

  it('activate invokes ActivateThesis once with public thesisId', async () => {
    const { thesisLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = thesisLifecycleCommands.activateThesis({
      requestedClientId: 'client_a',
      thesisId: 'thesis_ready',
    });
    expect(result).toEqual({
      ok: true,
      message: 'Tesis activada. El radar y el scoring ya la usan.',
    });
    expect(activateCalls).toHaveLength(1);
    expect(activateCalls[0]).toEqual({
      requestedClientId: 'client_a',
      thesisId: 'thesis_ready',
    });
    expect(JSON.stringify(activateCalls[0])).not.toMatch(/claimed|status|approval/);
  });

  it('notify failure after submit still returns ok with compatibility message', async () => {
    notifyReturns = false;
    const { thesisLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = thesisLifecycleCommands.saveThesis({
      requestedClientId: 'client_a',
      thesisId: 'thesis_1',
      intent: 'submit_review',
      fields: baseFields,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notifySkipped).toBe(true);
      expect(result.message).toMatch(/aún no tiene cuenta/);
    }
  });

  it('seam surfaces consumer errors without silent success', async () => {
    const { ThesisLifecycleError } = await import('../src/application/thesisLifecycle');
    saveImpl = () => {
      throw new ThesisLifecycleError('NOT_READY_FOR_REVIEW', 'Estructura 40/100');
    };
    const { thesisLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    expect(
      thesisLifecycleCommands.saveThesis({
        requestedClientId: 'client_a',
        thesisId: 'thesis_1',
        intent: 'submit_review',
        fields: baseFields,
      })
    ).toEqual({ ok: false, message: 'Estructura 40/100' });
  });
});

describe('P5 §21 — React surface authority guards', () => {
  it('React thesis editor never imports dbService or consumers directly', () => {
    const page = read('src/ui/modules/pages/ReactThesisEditorPage.tsx');
    expect(page).not.toMatch(/\bdbService\b/);
    expect(page).not.toMatch(/\bsaveThesis\s*\(/);
    expect(page).not.toMatch(/\bactivateThesis\s*\(/);
    expect(page).not.toMatch(/\bdecideThesisClientReview\s*\(/);
    expect(page).toMatch(/useSaveThesis/);
    expect(page).toMatch(/useCreateThesis/);
    expect(page).toMatch(/useActivateThesis/);
    expect(page).toMatch(/react-thesis-save/);
    expect(page).toMatch(/react-thesis-submit/);
    expect(page).toMatch(/react-thesis-activate/);
    expect(page).toMatch(/react-thesis-create/);
    expect(page).toMatch(/Nueva tesis/);
    expect(page).not.toMatch(/createId/);
    expect(page).not.toMatch(/react-thesis-save-disabled/);
  });

  it('command seam delegates through consumer; React audit = 0 for #11/#12', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/saveThesis\s*\(/);
    expect(seam).toMatch(/activateThesis\s*\(/);
    expect(seam).toMatch(/notifyClientThesisManagerSave/);
    const thesisBlock = seam.slice(
      seam.indexOf('export const thesisLifecycleCommands'),
      seam.indexOf('export const signalIntakeCommands')
    );
    expect(thesisBlock).not.toMatch(/auditService/);
    expect(thesisBlock).not.toMatch(/dbService\./);
    const page = read('src/ui/modules/pages/ReactThesisEditorPage.tsx');
    expect(page).not.toMatch(/auditService|SAVE_THESIS|THESIS_ACTIVATED/);
  });

  it('SaveThesis and ActivateThesis Application remain frozen', () => {
    const save = read('src/application/thesisLifecycle/SaveThesis.ts');
    const activate = read('src/application/thesisLifecycle/ActivateThesis.ts');
    expect(save).toMatch(/requireAdminRole/);
    expect(activate).toMatch(/requireAdminRole/);
    expect(save).not.toMatch(/notifyClient\s*\(|notifyManager\s*\(/);
    expect(activate).not.toMatch(/notifyClient\s*\(|notifyManager\s*\(/);
  });

  it('#13 DecideThesisClientReview remains unchanged on React portal', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/useDecideThesisClientReview/);
    expect(portal).not.toMatch(/useSaveThesis|useActivateThesis|useCreateThesis/);
    const decide = read('src/application/thesisLifecycle/DecideThesisClientReview.ts');
    expect(decide).toMatch(/requireClientRole/);
  });

  it('AI / stress-test residual stays on LegacyHandoff', () => {
    const page = read('src/ui/modules/pages/ReactThesisEditorPage.tsx');
    expect(page).toMatch(/actions=\{\['el stress-test', 'generar propuesta con IA'\]\}/);
    expect(page).toMatch(/react-thesis-editor-handoff/);
    expect(page).not.toMatch(/'guardar la tesis'/);
    expect(page).not.toMatch(/'enviarla al cliente'/);
    expect(page).not.toMatch(/'activarla'/);
  });

  it('legacy thesis editor controls remain for rollback', () => {
    const legacyModal = read('src/components/ThesisEditorModal.ts');
    const legacyHandlers = read('src/ui/legacy/handlers/thesisHandlers.ts');
    expect(legacyModal).toMatch(/data-thesis-intent="draft"/);
    expect(legacyModal).toMatch(/data-thesis-intent="submit_review"/);
    expect(legacyHandlers).toMatch(/saveThesis\(/);
    expect(legacyHandlers).toMatch(/activateThesis\(/);
  });

  it('mutation hooks invalidate compatibility queries after success', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useSaveThesis/);
    expect(hooks).toMatch(/useCreateThesis/);
    expect(hooks).toMatch(/useActivateThesis/);
    expect(hooks).toMatch(/invalidateQueries/);
  });

  it('multi-thesis: selector starts unselected; no silent winner', () => {
    const page = read('src/ui/modules/pages/ReactThesisEditorPage.tsx');
    expect(page).toMatch(/useState<string \| null>\(null\)/);
    expect(page).toMatch(/Selecciona una tesis/);
    expect(page).not.toMatch(/theses\[0\]|primaryThesis|defaultThesis/);
  });

  it('explicit Nueva tesis create is distinct from unresolved-id anti-create', () => {
    const page = read('src/ui/modules/pages/ReactThesisEditorPage.tsx');
    expect(page).toMatch(/useCreateThesis/);
    expect(page).toMatch(/Nueva tesis/);
    expect(page).toMatch(/createMode/);
    expect(page).toMatch(/No se ha creado ninguna tesis nueva/);
    expect(page).not.toMatch(/createId/);
    expect(page).toMatch(/useSaveThesis/);
  });

  it('ADMIN workspace narrows trusted scope to shell clientId', () => {
    const page = read('src/ui/modules/pages/ReactThesisEditorPage.tsx');
    const workspace = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    const shell = read('src/ui/modules/AppShell/ReactAppShell.tsx');
    expect(page).toMatch(/narrowToClient/);
    expect(workspace).toMatch(/workspaceClientId=\{clientId\}/);
    expect(shell).toMatch(/ReactClientWorkspacePage tab=\{workspaceTab\} clientId=\{activeClientId\}/);
  });
});

describe('P5 §22–§24 — frozen Application save/activate + #13 non-regression', () => {
  it('draft save and submit_review follow frozen Domain plans', () => {
    const store = new Map<string, PositioningThesis>();
    const repo = memoryRepo(store);
    const save = createSaveThesis({ theses: repo });
    const admin = trustedAdmin();

    const draft = save({
      trusted: admin,
      thesisId: 't1',
      intent: 'draft',
      fields: readyFields(),
    });
    expect(draft.thesis.status).toBe('DRAFT');
    expect(draft.notifyClient).toBe(false);

    const submitted = save({
      trusted: admin,
      thesisId: 't1',
      intent: 'submit_review',
      fields: readyFields(),
    });
    expect(submitted.thesis.status).toBe('UNDER_REVIEW');
    expect(submitted.thesis.clientApprovalStatus).toBe('PENDING');
    expect(submitted.notifyClient).toBe(true);
  });

  it('activate requires client approval; CLIENT cannot save or activate', () => {
    const store = new Map<string, PositioningThesis>();
    const repo = memoryRepo(store);
    const save = createSaveThesis({ theses: repo });
    const activate = createActivateThesis({ theses: repo });
    const decide = createDecideThesisClientReview({ theses: repo });
    const admin = trustedAdmin();
    const client = {
      ...admin,
      actorId: 'client_user',
      actorRole: 'CLIENT' as const,
    };

    save({
      trusted: admin,
      thesisId: 't2',
      intent: 'submit_review',
      fields: readyFields(),
    });

    expect(() =>
      activate({ trusted: admin, thesisId: 't2' })
    ).toThrow(/aprobado|aprobación|APPROVED/i);

    decide({
      trusted: client,
      thesisId: 't2',
      decision: 'approve',
    });

    const activated = activate({ trusted: admin, thesisId: 't2' });
    expect(activated.thesis.status).toBe('ACTIVE');

    expect(() =>
      save({
        trusted: client,
        thesisId: 't2',
        intent: 'draft',
        fields: readyFields(),
      })
    ).toThrow();

    expect(() => activate({ trusted: client, thesisId: 't2' })).toThrow();
  });

  it('manager submit does not auto-activate; #13 approve still awaits manager', () => {
    const store = new Map<string, PositioningThesis>();
    const repo = memoryRepo(store);
    const save = createSaveThesis({ theses: repo });
    const decide = createDecideThesisClientReview({ theses: repo });
    const admin = trustedAdmin();
    const client = {
      ...admin,
      actorId: 'client_user',
      actorRole: 'CLIENT' as const,
    };

    const submitted = save({
      trusted: admin,
      thesisId: 't3',
      intent: 'submit_review',
      fields: readyFields(),
    });
    expect(submitted.thesis.status).toBe('UNDER_REVIEW');
    expect(submitted.thesis.clientApprovalStatus).toBe('PENDING');

    const approved = decide({
      trusted: client,
      thesisId: 't3',
      decision: 'approve',
    });
    expect(approved.awaitsManagerActivation).toBe(true);
    expect(approved.thesis.status).toBe('UNDER_REVIEW');
    expect(approved.thesis.clientApprovalStatus).toBe('APPROVED');
  });

  it('explicit thesisId among many — no silent winner', () => {
    const store = new Map<string, PositioningThesis>();
    const repo = memoryRepo(store);
    const save = createSaveThesis({ theses: repo });
    const activate = createActivateThesis({ theses: repo });
    const decide = createDecideThesisClientReview({ theses: repo });
    const admin = trustedAdmin();
    const client = {
      ...admin,
      actorId: 'client_user',
      actorRole: 'CLIENT' as const,
    };

    save({
      trusted: admin,
      thesisId: 'keep_draft',
      intent: 'draft',
      fields: { ...readyFields(), title: 'Keep draft' },
    });
    save({
      trusted: admin,
      thesisId: 'activate_me',
      intent: 'submit_review',
      fields: { ...readyFields(), title: 'Activate me' },
    });
    decide({ trusted: client, thesisId: 'activate_me', decision: 'approve' });
    activate({ trusted: admin, thesisId: 'activate_me' });

    expect(store.get('activate_me')?.status).toBe('ACTIVE');
    expect(store.get('keep_draft')?.status).toBe('DRAFT');
  });
});

function trustedAdmin() {
  return {
    actorId: 'admin_1',
    actorRole: 'ADMIN' as const,
    organizationId: 'org_a',
    clientId: 'client_a',
    now: '2026-03-01T00:00:00.000Z',
  };
}

function readyFields(): ThesisEditableFields {
  return {
    title: 'Ready thesis',
    expertIdentity: 'Expert identity with enough text',
    targetAudience: 'Target audience buyers',
    domain: 'Domain of expertise',
    objective: 'Clear objective for positioning',
    proofPoints: ['Proof A', 'Proof B', 'Proof C'],
    differentiator: 'Clear differentiator',
    voiceAndTone: 'Authoritative',
    complianceRules: 'No hype',
    identityCurrent: 'Current identity',
    perceptionTarget: 'Perception target',
    audiences: [
      { id: 'a1', name: 'GC', tier: 'COMMERCIAL', weight: 90, keywords: ['gc'] },
      { id: 'a2', name: 'Board', tier: 'INFLUENCE', weight: 70, keywords: ['board'] },
    ],
    territories: [
      { id: 't1', name: 'Governance', pillar: 'Gov', weight: 100, keywords: ['gov'] },
    ],
    objectives: [
      { id: 'o1', kind: 'BUSINESS', weight: 50 },
      { id: 'o2', kind: 'THOUGHT_LEADERSHIP', weight: 30 },
      { id: 'o3', kind: 'SPEAKING', weight: 20 },
    ],
    voiceProfile: {
      authority: 80,
      technicalDepth: 70,
      academic: 50,
      executive: 80,
      accessible: 60,
      provocative: 20,
      commercial: 40,
      legalPrecision: 90,
      humor: 10,
    },
    limits: { hardBlocks: ['No hype'], softAvoid: ['buzzwords'] },
    priority: 50,
  };
}

function memoryRepo(store: Map<string, PositioningThesis>): ThesisRepository {
  return {
    getById(clientId, thesisId) {
      const t = store.get(thesisId);
      return t && t.clientId === clientId ? t : undefined;
    },
    save(thesis) {
      store.set(thesis.id, thesis);
    },
  };
}
