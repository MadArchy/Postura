/**
 * SPEC-010 Phase 6 — Workspace Production ClaimSafety cutover
 * (`client-workspace-production-claim-safety`).
 *
 * Omits leftover `renderClaimSafetyBadge` / `renderClaimSafetyPanel` from
 * `renderContentPipeline`. ClaimSafetyPanel.ts remains PRESENT. Content
 * preview, content editor, and LegacyApp live refresh stay leftover.
 * C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_KPI_HOME_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT,
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
} from '../src/ui/presentation/reactExclusiveSlots';
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
const HOST = 'src/components/ManagerCockpit.ts';
const MODALS = 'src/components/Modals.ts';
const LEGACY_APP = 'src/ui/legacy/LegacyApp.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const SLOT = 'src/ui/presentation/claimSafetyWorkspaceProductionSlot.ts';
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

describe('Phase 6 ClaimSafety workspace production cutover — C1 served ownership', () => {
  it('ClaimSafetyPanel.ts is present and React ProductionPanel serves ClaimSafety', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(statSync(join(ROOT, PAGE)).isFile()).toBe(true);
    const page = code(PAGE);
    expect(page).toMatch(/from\s+['"]\.\.\/ClaimSafety\/ReactClaimSafetyPanel['"]/);
    expect(page).toMatch(/<ReactClaimSafetyBadge\s+record=\{item\.claimSafety/);
    expect(page).toMatch(/<ReactClaimSafetyPanel\s+record=\{item\.claimSafety/);
  });

  it('ManagerCockpit no longer imports or renders Workspace Production ClaimSafety', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/ClaimSafetyPanel['"]/);
    expect(host).not.toMatch(/renderClaimSafetyBadge/);
    expect(host).not.toMatch(/renderClaimSafetyPanel/);
    expect(host).not.toMatch(/claim-safety-disclosure/);
    expect(shouldRenderLegacyClaimSafetyWorkspaceProductionSlot()).toBe(false);
    expect(claimSafetyWorkspaceProductionSlotPresentation()).toBe('omit');
  });

  it('non-ClaimSafety leftover production behavior is preserved', () => {
    const host = code(HOST);
    expect(host).toMatch(/export function renderContentPipeline\(/);
    expect(host).toMatch(/btn-open-content-editor/);
    expect(host).toMatch(/btn-preview-content/);
    expect(host).toMatch(/btn-content-pipeline-action/);
    expect(code(MODALS)).toMatch(/renderClaimSafetyPanel\(content\.claimSafety\)/);
    expect(code(LEGACY_APP)).toMatch(/renderClaimSafetyPanel\(record\)/);
    expect(code(LEGACY_APP)).toMatch(/refreshClaimSafetyLive/);
  });

  it('Workspace Production exclusive id is production-only and distinct', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT)).toBe(true);
    expect(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT).toBe(
      'client-workspace-production-claim-safety'
    );
    expect(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_WORKSPACE_PROOF_WALL_SLOT);
    expect(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_KPI_HOME_SLOT);
    expect(CLIENT_WORKSPACE_PRODUCTION_CLAIM_SAFETY_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).not.toContain('client-content-preview-claim-safety');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('client-content-editor-claim-safety');
    expect(existsSync(join(ROOT, SLOT))).toBe(true);
  });
});

describe('Phase 6 ClaimSafety workspace production cutover — C2 / C3 seams', () => {
  it('React production consumes the stored ClaimSafety record from compatibility reads', () => {
    expect(code(READ)).toMatch(/readonly claimSafety: ClaimSafetyVerdictRecord \| null/);
    expect(code(READ)).toMatch(/claimSafety: item\.claimSafety \?\? null/);
    expect(code(READ)).toMatch(/export function readWorkspaceContent\(/);
    expect(code(PAGE)).toMatch(/useWorkspaceContent\(scope\)/);
    expect(code(PAGE)).toMatch(/item\.claimSafety && item\.claimSafety\.verdict !== 'PASS'/);
    expect(code(PAGE)).not.toMatch(/onLocateClaim/);
  });

  it('remaining ClaimSafetyPanel Product importers are Modals and LegacyApp only', () => {
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
    expect(offenders.sort()).toEqual([MODALS, LEGACY_APP].sort());
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

describe('Phase 6 ClaimSafety workspace production cutover — C4 / C5 / no T603', () => {
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
    expect(code(HOST)).not.toMatch(/ReactClaimSafety/);
    expect(code(PAGE)).not.toMatch(/createRoot/);
    expect(code(PAGE)).not.toMatch(/#app/);
    expect(code(REACT)).not.toMatch(/createRoot/);
    expect(code(REACT)).toMatch(/data-authority="ADVISORY_PROJECTION"/);
  });

  it('physical leftover file remains; C7 and T603 are not executed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
    expect(code(REACT)).toMatch(/export function ReactClaimSafetyBadge/);
    expect(code(REACT)).toMatch(/export function ReactClaimSafetyPanel/);
  });
});
