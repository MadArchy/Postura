/**
 * SPEC-010 Phase 6 — Content Editor + LegacyApp ClaimSafety cutover
 * (`client-content-editor-claim-safety`).
 *
 * Omits leftover editor ClaimSafety panel, live refresh, locate, and
 * review-ack. ClaimSafetyPanel.ts is absent with Product graph zero.
 * Workspace Production and Content Preview remain observed.
 * P16 React editor accepted omission remains. C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT,
  CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT,
  CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  claimSafetyContentEditorSlotPresentation,
  shouldRenderLegacyClaimSafetyContentEditorSlot,
} from '../src/ui/presentation/claimSafetyContentEditorSlot';
import {
  claimSafetyContentPreviewSlotPresentation,
  shouldRenderLegacyClaimSafetyContentPreviewSlot,
} from '../src/ui/presentation/claimSafetyContentPreviewSlot';
import {
  claimSafetyWorkspaceProductionSlotPresentation,
  shouldRenderLegacyClaimSafetyWorkspaceProductionSlot,
} from '../src/ui/presentation/claimSafetyWorkspaceProductionSlot';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';
import {
  proofWallWorkspaceSlotPresentation,
  shouldRenderLegacyProofWallWorkspaceSlot,
} from '../src/ui/presentation/proofWallWorkspaceSlot';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/ClaimSafetyPanel.ts';
const REACT = 'src/ui/modules/ClaimSafety/ReactClaimSafetyPanel.tsx';
const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const MODALS_REACT = 'src/ui/modules/pages/modals/ReactModals.tsx';
const HOST = 'src/components/ManagerCockpit.ts';
const MODALS = 'src/components/Modals.ts';
const LEGACY_APP = 'src/ui/legacy/LegacyApp.ts';
const HANDLERS = 'src/ui/legacy/handlers/contentHandlers.ts';
const APP_HOST = 'src/ui/legacy/legacyAppHost.ts';
const SLOT = 'src/ui/presentation/claimSafetyContentEditorSlot.ts';
const TASKS = 'specs/010-react-migration/tasks.md';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTs(full));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function editorFunction(source: string): string {
  const match = source.match(
    /export function renderContentEditorModal[\s\S]*?(?=export function |$)/
  );
  return match ? match[0] : '';
}

function reactEditorFunction(source: string): string {
  const match = source.match(
    /export function ReactContentEditorModal[\s\S]*?(?=export function |$)/
  );
  return match ? match[0] : '';
}

describe('Phase 6 ClaimSafety content editor cutover — C1 served ownership', () => {
  it('ClaimSafetyPanel.ts is absent and leftover editor ClaimSafety is omitted', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    const source = code(MODALS);
    expect(source).not.toMatch(/from\s+['"]\.\/ClaimSafetyPanel['"]/);
    expect(editorFunction(source)).not.toMatch(/renderClaimSafetyPanel/);
    expect(editorFunction(source)).not.toMatch(/claim-safety-live/);
    expect(editorFunction(source)).not.toMatch(/claim-review-ack/);
    expect(editorFunction(source)).toMatch(/edit-content-title/);
    expect(editorFunction(source)).toMatch(/edit-content-body/);
    expect(editorFunction(source)).toMatch(/form-edit-content/);
    expect(shouldRenderLegacyClaimSafetyContentEditorSlot()).toBe(false);
    expect(claimSafetyContentEditorSlotPresentation()).toBe('omit');
  });

  it('Workspace Production and Content Preview remain observed', () => {
    expect(code(HOST)).not.toMatch(/renderClaimSafetyPanel/);
    expect(code(PAGE)).toMatch(/<ReactClaimSafetyBadge\s+record=\{item\.claimSafety/);
    expect(code(PAGE)).toMatch(/<ReactClaimSafetyPanel\s+record=\{item\.claimSafety/);
    expect(code(PAGE)).toMatch(/ReactContentPreviewModal/);
    expect(code(MODALS_REACT)).toMatch(/<ReactClaimSafetyPanel\s+record=\{data\.claimSafety/);
    expect(shouldRenderLegacyClaimSafetyWorkspaceProductionSlot()).toBe(false);
    expect(claimSafetyWorkspaceProductionSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyClaimSafetyContentPreviewSlot()).toBe(false);
    expect(claimSafetyContentPreviewSlotPresentation()).toBe('omit');
  });

  it('LegacyApp live ClaimSafety methods and import are retired', () => {
    const app = code(LEGACY_APP);
    expect(app).not.toMatch(/from\s+['"][^'"]*ClaimSafetyPanel['"]/);
    expect(app).not.toMatch(/refreshClaimSafetyLive/);
    expect(app).not.toMatch(/bindClaimSafetyLive/);
    expect(app).not.toMatch(/bindClaimLocate/);
    expect(code(HANDLERS)).not.toMatch(/bindClaimSafetyLive/);
    expect(code(HANDLERS)).not.toMatch(/bindClaimLocate/);
    expect(code(HANDLERS)).toMatch(/reviewDraftClaims/);
    expect(code(APP_HOST)).not.toMatch(/bindClaimSafetyLive/);
    expect(code(APP_HOST)).not.toMatch(/bindClaimLocate/);
  });

  it('Content Editor exclusive id is editor-only and distinct', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT)).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT)).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT)).toBe(true);
    expect(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT).toBe('client-content-editor-claim-safety');
    expect(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT);
    expect(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT).not.toBe(
      CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT
    );
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT);
    expect(existsSync(join(ROOT, SLOT))).toBe(true);
  });
});

describe('Phase 6 ClaimSafety content editor cutover — C2 / C3 seams', () => {
  it('P16 React editor accepted omission remains', () => {
    const editor = reactEditorFunction(code(MODALS_REACT));
    expect(editor).toMatch(/export function ReactContentEditorModal/);
    expect(editor).not.toMatch(/ReactClaimSafetyPanel/);
    expect(editor).not.toMatch(/ReactClaimSafetyBadge/);
    expect(editor).not.toMatch(/reviewDraftClaims/);
    expect(editor).not.toMatch(/onLocateClaim/);
  });

  it('ClaimSafetyPanel Product importer graph is zero', () => {
    const offenders: string[] = [];
    for (const file of collectTs(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel === LEGACY) continue;
      const source = code(rel);
      if (
        /from\s+['"][^'"]*\/ClaimSafetyPanel['"]/.test(source) ||
        /from\s+['"]\.\/ClaimSafetyPanel['"]/.test(source)
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('closed subsets remain closed and not reopened', () => {
    expect(existsSync(join(ROOT, 'src/components/ProofWallPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/MasterDossierPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/OpportunityPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/KpiWeeklyChart.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClientProfilePanel.ts'))).toBe(false);
    expect(shouldRenderLegacyDossierSlot()).toBe(false);
    expect(dossierSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyProofWallWorkspaceSlot()).toBe(false);
    expect(proofWallWorkspaceSlotPresentation()).toBe('omit');
  });
});

describe('Phase 6 ClaimSafety content editor cutover — C4 / C5 / no T603', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [SLOT, 'src/ui/presentation/reactExclusiveSlots.ts', REACT]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('does not create a nested React root or leftover island', () => {
    expect(code(MODALS)).not.toMatch(/ReactClaimSafety/);
    expect(code(PAGE)).not.toMatch(/createRoot/);
    expect(code(PAGE)).not.toMatch(/#app/);
    expect(code(MODALS_REACT)).not.toMatch(/createRoot/);
    expect(code(REACT)).not.toMatch(/createRoot/);
    expect(code(REACT)).toMatch(/data-authority="ADVISORY_PROJECTION"/);
  });

  it('physical absence is intentional; C6 is not yet verified; C7 and T603 are not executed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
    expect(code(REACT)).toMatch(/export function ReactClaimSafetyBadge/);
    expect(code(REACT)).toMatch(/export function ReactClaimSafetyPanel/);
  });
});
