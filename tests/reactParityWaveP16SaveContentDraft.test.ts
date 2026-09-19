/**
 * SPEC-010 · T603 React Parity Wave P16 — Registry #31 SaveContentDraft.
 *
 * Presentation parity only. Frozen Application/Domain; #33 CreateContentDraft unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const saveCalls: {
  requestedClientId: string | null | undefined;
  contentId: string;
  fields: Record<string, unknown>;
  requestedTargetStatus?: string;
}[] = [];

let saveImpl:
  | ((intent: (typeof saveCalls)[number]) => { ok: boolean; message?: string })
  | null = null;

vi.mock('../src/services/executionDeliveryConsumer', () => ({
  saveContentDraft: (intent: (typeof saveCalls)[number]) => {
    saveCalls.push(intent);
    if (saveImpl) return saveImpl(intent);
    return { content: { id: intent.contentId }, advanced: false };
  },
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('P16 §A–§E — load, seam, no create', () => {
  beforeEach(() => {
    saveCalls.length = 0;
    saveImpl = null;
  });

  it('A. React editor initializes from existing content detail fields', () => {
    const editor = read('src/ui/modules/pages/modals/ReactModals.tsx');
    const start = editor.indexOf('export function ReactContentEditorModal');
    const block = editor.slice(start);
    expect(block).toMatch(/useContentDetail/);
    expect(block).toMatch(/narrowToClient/);
    expect(block).toMatch(/workspaceClientId/);
    expect(block).toMatch(/legacyStatus/);
    expect(block).toMatch(/react-content-editor-title/);
    expect(block).toMatch(/react-content-editor-body/);
    expect(block).toMatch(/data\.title/);
    expect(block).toMatch(/data\.body/);
  });

  it('B. save delegates exactly once to executionDeliveryCommands.saveContentDraft', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.saveContentDraft({
      requestedClientId: 'client_juan_001',
      contentId: 'cnt_existing',
      fields: { title: 'Edited', body: 'Body' },
    });
    expect(result.ok).toBe(true);
    expect(saveCalls).toHaveLength(1);
    expect(saveCalls[0]?.contentId).toBe('cnt_existing');
  });

  it('C. React editor/hook/panel import no dbService or Firestore write', () => {
    const editor = read('src/ui/modules/pages/modals/ReactModals.tsx');
    const start = editor.indexOf('export function ReactContentEditorModal');
    const editorBlock = editor.slice(start);
    expect(editorBlock).not.toMatch(/\bdbService\b/);
    expect(editorBlock).not.toMatch(/firestore/i);
    expect(read('src/ui/modules/pages/ReactClientWorkspacePage.tsx')).not.toMatch(/\bdbService\b/);
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    const idx = hooks.indexOf('export function useSaveContentDraft');
    expect(hooks.slice(idx, idx + 1600)).not.toMatch(/\bdbService\b/);
    expect(hooks.slice(idx, idx + 1600)).not.toMatch(/firestore/i);
  });

  it('D. successful edit forwards the existing contentId', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    executionDeliveryCommands.saveContentDraft({
      requestedClientId: 'client_juan_001',
      contentId: 'cnt_existing',
      fields: { title: 'Same id', body: 'Updated' },
    });
    expect(saveCalls[0]?.contentId).toBe('cnt_existing');
  });

  it('E. no new ContentItem is created by the #31 path', () => {
    const hook = read('src/ui/hooks/useWave3Data.ts');
    const idx = hook.indexOf('export function useSaveContentDraft');
    const block = hook.slice(idx, idx + 900);
    expect(block).toMatch(/executionDeliveryCommands\.saveContentDraft/);
    expect(block).not.toMatch(/createContentDraft/);
    expect(block).not.toMatch(/CreateContentDraft/);
    expect(block).not.toMatch(/saveContent\(/);
  });
});

describe('P16 §F–§I — fail-closed and canonical gates', () => {
  beforeEach(() => {
    saveCalls.length = 0;
    saveImpl = null;
  });

  it('F. missing content surfaces editor missing state', () => {
    const editor = read('src/ui/modules/pages/modals/ReactModals.tsx');
    expect(editor).toMatch(/react-content-editor-missing/);
    expect(editor).toMatch(/Contenido no encontrado/);
    expect(editor).toMatch(/!data\?\.resolved/);
  });

  it('G. tenant/org/client mismatch surfaces canonical message', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    saveImpl = () => {
      throw new ExecutionDeliveryError(
        'TENANT_CONTEXT_INVALID',
        'Content does not belong to the trusted client.'
      );
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.saveContentDraft({
      requestedClientId: 'client_other',
      contentId: 'cnt_existing',
      fields: { title: 'X', body: 'Y' },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('trusted client');
  });

  it('H. Strategic Brief denial stays canonical and is not reimplemented in React', async () => {
    const { ExecutionDeliveryError } = await import('../src/application/executionDelivery');
    saveImpl = () => {
      throw new ExecutionDeliveryError(
        'STRATEGIC_BRIEF_GATE_DENIED',
        'Strategic Brief does not authorize content update (DENIED).'
      );
    };
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    const result = executionDeliveryCommands.saveContentDraft({
      requestedClientId: 'client_juan_001',
      contentId: 'cnt_existing',
      fields: { title: 'X', body: 'Y' },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Strategic Brief');

    const editor = read('src/ui/modules/pages/modals/ReactModals.tsx');
    const start = editor.indexOf('export function ReactContentEditorModal');
    const block = editor.slice(start);
    expect(block).toMatch(/result\.message/);
    expect(block).not.toMatch(/AuthorizeStrategicDownstream/);
    expect(block).not.toMatch(/strategicBriefGate/);
    expect(block).not.toMatch(/classifyContentMutationAuthorization/);
  });

  it('I. requestedTargetStatus is forwarded; no local transition graph', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    executionDeliveryCommands.saveContentDraft({
      requestedClientId: 'client_juan_001',
      contentId: 'cnt_existing',
      fields: { title: 'X', body: 'Y' },
      requestedTargetStatus: 'CLIENT_REVIEW',
    });
    expect(saveCalls[0]?.requestedTargetStatus).toBe('CLIENT_REVIEW');

    const editor = read('src/ui/modules/pages/modals/ReactModals.tsx');
    const start = editor.indexOf('export function ReactContentEditorModal');
    const block = editor.slice(start);
    expect(block).toMatch(/requestedTargetStatus/);
    expect(block).not.toMatch(/resolvePipelineStepsToTarget/);
    expect(block).not.toMatch(/assertContentPipelineTransition/);
    expect(block).not.toMatch(/assertClaimSafeTransition/);
  });
});

describe('P16 §J–§P — #33 separation, rollback, invalidation, #32', () => {
  beforeEach(() => {
    saveCalls.length = 0;
    saveImpl = null;
  });

  it('J. no CreateContentDraft, generate-content, or aiService on #31 path', () => {
    const hook = read('src/ui/hooks/useWave3Data.ts');
    const idx = hook.indexOf('export function useSaveContentDraft');
    const hookBlock = hook.slice(idx, idx + 1600);
    expect(hookBlock).not.toMatch(/createContentDraft/);
    expect(hookBlock).not.toMatch(/CreateContentDraft/);
    expect(hookBlock).not.toMatch(/aiService/);
    expect(hookBlock).not.toMatch(/generate-content/);

    const editor = read('src/ui/modules/pages/modals/ReactModals.tsx');
    const start = editor.indexOf('export function ReactContentEditorModal');
    const block = editor.slice(start);
    expect(block).not.toMatch(/createContentDraft/);
    expect(block).not.toMatch(/CreateContentDraft/);
    expect(block).not.toMatch(/aiService/);
    expect(block).not.toMatch(/reviewDraftClaims/);
    expect(block).not.toMatch(/form-generate-content/);
  });

  it('K. legacy form-edit-content remains', () => {
    expect(read('src/components/Modals.ts')).toMatch(/id="form-edit-content"/);
    expect(read('src/ui/legacy/handlers/contentHandlers.ts')).toMatch(/form-edit-content/);
    expect(read('src/ui/legacy/handlers/contentHandlers.ts')).toMatch(/saveContentDraft\(/);
  });

  it('L. legacy UI mode / rollback remains possible', () => {
    const production = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(production).toMatch(/react-ws-production-handoff/);
    expect(production).toMatch(/LegacyHandoff/);
    expect(production).toMatch(/generar contenido/);
    expect(read('src/ui/modules/pages/LegacyHandoff.tsx')).toMatch(/applyUiMode\('legacy'\)/);
  });

  it('M. success invalidates only the compatibility tenant family', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    const idx = hooks.indexOf('export function useSaveContentDraft');
    const block = hooks.slice(idx, idx + 1600);
    expect(block).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
    expect(block).not.toMatch(/sessionQueryKey/);
    expect(block).not.toMatch(/compatibilityQueryNamespace/);
  });

  it('N. non-ADMIN cannot own the production editor surface', () => {
    const workspace = read('src/ui/modules/pages/ReactClientWorkspacePage.tsx');
    expect(workspace).toMatch(/react-ws-not-admin/);
    expect(workspace).toMatch(/if \(!isAdmin\)/);
    const hook = read('src/ui/hooks/useWave3Data.ts');
    const idx = hook.indexOf('export function useSaveContentDraft');
    expect(hook.slice(idx, idx + 1600)).not.toMatch(/actorRole/);
    expect(hook.slice(idx, idx + 1600)).not.toMatch(/claimedRole/);
  });

  it('O. public intent includes only permitted seam fields', async () => {
    const { executionDeliveryCommands } = await import('../src/ui/commands/commandSeam');
    executionDeliveryCommands.saveContentDraft({
      requestedClientId: 'client_juan_001',
      contentId: 'cnt_existing',
      fields: {
        title: 'T',
        body: 'B',
        type: 'LINKEDIN_ARTICLE',
        targetPlatform: 'LinkedIn',
        managerNotes: 'n',
      },
    });
    expect(saveCalls[0]?.contentId).toBe('cnt_existing');
    expect(saveCalls[0]?.requestedClientId).toBe('client_juan_001');
    expect(saveCalls[0]?.fields).toEqual({
      title: 'T',
      body: 'B',
      type: 'LINKEDIN_ARTICLE',
      targetPlatform: 'LinkedIn',
      managerNotes: 'n',
    });
    expect(saveCalls[0]?.fields).not.toHaveProperty('organizationId');
    expect(saveCalls[0]?.fields).not.toHaveProperty('claimedStrategicBriefId');
    expect(saveCalls[0]?.fields).not.toHaveProperty('claimedContentMutationClass');

    const hook = read('src/ui/hooks/useWave3Data.ts');
    const idx = hook.indexOf('export function useSaveContentDraft');
    const block = hook.slice(idx, idx + 1600);
    expect(block).not.toMatch(/organizationId/);
    expect(block).not.toMatch(/claimedOrganizationId/);
    expect(block).not.toMatch(/claimedClientId/);
    expect(block).not.toMatch(/claimedContentMutationClass/);
    expect(block).not.toMatch(/claimedStrategicBriefId/);
  });

  it('P. #32 article-review Editar behavior remains unchanged', () => {
    const portal = read('src/ui/modules/pages/ReactClientPortalPage.tsx');
    expect(portal).toMatch(/react-portal-content-edit-/);
    expect(portal).toMatch(/useReviewClientArticle/);
    expect(portal).toMatch(/useOpenClientArticleReview/);
    expect(portal).not.toMatch(/useSaveContentDraft/);
    expect(portal).not.toMatch(/saveContentDraft/);
    expect(portal).not.toMatch(/ReactContentEditorModal/);
  });
});
