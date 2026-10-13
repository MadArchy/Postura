/**
 * SPEC-010 Phase 6 — Content Preview ClaimSafety cutover
 * (`client-content-preview-claim-safety`).
 *
 * Omits leftover `renderClaimSafetyPanel` from `renderContentPreviewModal`.
 * ClaimSafetyPanel.ts is absent. Workspace Production remains
 * observed. Editor + LegacyApp cutover produces Product graph zero.
 * C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT,
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
} from '../src/ui/presentation/reactExclusiveSlots';
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
const READ = 'src/ui/data/compatibilityReads.ts';
const SLOT = 'src/ui/presentation/claimSafetyContentPreviewSlot.ts';
const WORKSPACE_SLOT = 'src/ui/presentation/claimSafetyWorkspaceProductionSlot.ts';
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

function previewFunction(source: string): string {
  const match = source.match(
    /export function renderContentPreviewModal[\s\S]*?(?=export function |$)/
  );
  return match ? match[0] : '';
}

function editorFunction(source: string): string {
  const match = source.match(
    /export function renderContentEditorModal[\s\S]*?(?=export function |$)/
  );
  return match ? match[0] : '';
}

describe('Phase 6 ClaimSafety content preview cutover — C1 served ownership', () => {
  it('ClaimSafetyPanel.ts is absent and React preview serves ClaimSafety', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(statSync(join(ROOT, MODALS_REACT)).isFile()).toBe(true);
    const preview = code(MODALS_REACT);
    expect(preview).toMatch(/from\s+['"]\.\.\/\.\.\/ClaimSafety\/ReactClaimSafetyPanel['"]/);
    expect(preview).toMatch(/export function ReactContentPreviewModal/);
    expect(preview).toMatch(/<ReactClaimSafetyPanel\s+record=\{data\.claimSafety/);
    expect(preview).not.toMatch(/onLocateClaim/);
  });

  it('leftover preview omits ClaimSafety and later editor omit is complete', () => {
    const source = code(MODALS);
    expect(source).not.toMatch(/from\s+['"]\.\/ClaimSafetyPanel['"]/);
    expect(previewFunction(source)).not.toMatch(/renderClaimSafetyPanel/);
    expect(editorFunction(source)).not.toMatch(/renderClaimSafetyPanel/);
    expect(editorFunction(source)).not.toMatch(/claim-safety-live/);
    expect(editorFunction(source)).not.toMatch(/claim-review-ack/);
    expect(shouldRenderLegacyClaimSafetyContentPreviewSlot()).toBe(false);
    expect(claimSafetyContentPreviewSlotPresentation()).toBe('omit');
  });

  it('Workspace Production cutover remains observed', () => {
    expect(code(HOST)).not.toMatch(/from\s+['"]\.\/ClaimSafetyPanel['"]/);
    expect(code(HOST)).not.toMatch(/renderClaimSafetyPanel/);
    expect(code(PAGE)).toMatch(/<ReactClaimSafetyBadge\s+record=\{item\.claimSafety/);
    expect(code(PAGE)).toMatch(/<ReactClaimSafetyPanel\s+record=\{item\.claimSafety/);
    expect(existsSync(join(ROOT, WORKSPACE_SLOT))).toBe(true);
    expect(shouldRenderLegacyClaimSafetyWorkspaceProductionSlot()).toBe(false);
    expect(claimSafetyWorkspaceProductionSlotPresentation()).toBe('omit');
  });

  it('Content Preview exclusive id is preview-only and distinct', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT)).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT)).toBe(true);
    expect(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT).toBe('client-content-preview-claim-safety');
    expect(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT).not.toBe(
      CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT
    );
    expect(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_WORKSPACE_PROOF_WALL_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-content-editor-claim-safety');
    expect(CLIENT_CONTENT_PREVIEW_CLAIM_SAFETY_SLOT).not.toBe('client-content-editor-claim-safety');
    expect(existsSync(join(ROOT, SLOT))).toBe(true);
  });
});

describe('Phase 6 ClaimSafety content preview cutover — C2 / C3 seams', () => {
  it('React preview consumes the stored ClaimSafety record from content detail', () => {
    expect(code(READ)).toMatch(/readonly claimSafety: ClaimSafetyVerdictRecord \| null/);
    expect(code(READ)).toMatch(/export function readContentDetail\(/);
    expect(code(READ)).toMatch(/claimSafety: content\.claimSafety \?\? null/);
    expect(code(PAGE)).toMatch(/ReactContentPreviewModal/);
    expect(code(PAGE)).toMatch(/previewingId/);
    expect(code(MODALS_REACT)).toMatch(/useContentDetail\(tenantScope, contentId\)/);
    expect(code(MODALS_REACT)).not.toMatch(/verdict !== 'PASS'/);
  });

  it('ClaimSafetyPanel Product importer graph is zero after final host cutover', () => {
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
    expect(code(LEGACY_APP)).not.toMatch(/refreshClaimSafetyLive/);
    expect(code(LEGACY_APP)).not.toMatch(/bindClaimSafetyLive/);
    expect(code(LEGACY_APP)).not.toMatch(/bindClaimLocate/);
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

describe('Phase 6 ClaimSafety content preview cutover — C4 / C5 / no T603', () => {
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

  it('legacy file absent; C6/C7 verified; T603 formally closed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(read(TASKS)).toMatch(
      /^(?![^\n]*(?:NOT AUTHORIZED|TODO|PENDING|\[ \]))\| \*\*T-010-603\*\* \|[^\n]*\| \*\*\[x\] DONE — FORMALLY_CLOSED\*\*[^|\n]*\|\r?$/m
    );
    expect(read(TASKS).match(/^\| \*\*T-010-603\*\* \|/gm)).toHaveLength(1);
    expect(code(REACT)).toMatch(/export function ReactClaimSafetyBadge/);
    expect(code(REACT)).toMatch(/export function ReactClaimSafetyPanel/);
  });
});
