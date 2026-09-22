/**
 * SPEC-010 Phase 6 — ClientWorkspace positioning ProofWall cutover
 * (`client-workspace-proof-wall`).
 *
 * Omits leftover `renderProofWall` from ClientWorkspace `renderPositioning`.
 * ProofWallPanel.ts is absent. ClientWorkspace ProofWallPanel import
 * is absent. Leftover workspace service-lines are omitted
 * (`client-workspace-service-lines`). React workspace ProofWall stays served.
 * C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLIENT_KPI_HOME_SLOT,
  CLIENT_KPI_RESULTS_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_PORTAL_PROFILE_SLOT,
  CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT,
  CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  CLIENT_WORKSPACE_SERVICE_LINES_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  proofWallWorkspaceSlotPresentation,
  shouldRenderLegacyProofWallWorkspaceSlot,
} from '../src/ui/presentation/proofWallWorkspaceSlot';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';
import {
  proofWallPortalThesisSlotPresentation,
  shouldRenderLegacyProofWallPortalThesisSlot,
} from '../src/ui/presentation/proofWallPortalThesisSlot';
import {
  serviceLinesPortalThesisSlotPresentation,
  shouldRenderLegacyServiceLinesPortalThesisSlot,
} from '../src/ui/presentation/serviceLinesPortalThesisSlot';
import {
  serviceLinesWorkspaceSlotPresentation,
  shouldRenderLegacyServiceLinesWorkspaceSlot,
} from '../src/ui/presentation/serviceLinesWorkspaceSlot';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/ProofWallPanel.ts';
const REACT = 'src/ui/modules/ProofWall/ReactProofWallPanel.tsx';
const DOSSIER = 'src/ui/modules/MasterDossier/ReactMasterDossierPanel.tsx';
const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const PORTAL = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const HOST = 'src/components/ClientPortal.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const SLOT = 'src/ui/presentation/proofWallWorkspaceSlot.ts';
const TASKS = 'specs/010-react-migration/tasks.md';
const DOSSIER_T603 = 'specs/010-react-migration/t-010-603-dossier-subset-removal.md';
const TABS = 'src/ui/legacy/shellTabs.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Phase 6 ProofWall workspace ProofWall cutover — C1 served ownership', () => {
  it('ProofWallPanel.ts is absent and React workspace ProofWall stays mounted', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(code(APPSHELL)).toMatch(/'ws-positioning':\s*'positioning'/);
    expect(code(PAGE)).toMatch(
      /tab === 'positioning'[\s\S]*<ReactProofWallPanel\s+workspaceClientId=\{clientId\}/
    );
    expect(code(REACT)).toMatch(/workspaceClientId\?:\s*string\s*\|\s*null/);
    expect(code(REACT)).toMatch(/narrowToClient\(sessionScope,\s*requested\)/);
  });

  it('ClientWorkspace omits leftover ProofWall and drops the ProofWallPanel import', () => {
    const workspace = code(WORKSPACE);
    expect(workspace).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(workspace).not.toMatch(/renderServiceLinesReadOnly/);
    expect(workspace).not.toMatch(/\brenderProofWall\b/);
    expect(workspace).not.toMatch(/id="proof-wall-section"/);
    expect(shouldRenderLegacyProofWallWorkspaceSlot()).toBe(false);
    expect(proofWallWorkspaceSlotPresentation()).toBe('omit');
  });

  it('workspace leftover service-lines are omitted; React dossier facts stay served; file is absent', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(code(WORKSPACE)).not.toMatch(/renderServiceLinesReadOnly\(clientId\)/);
    expect(code(DOSSIER)).toMatch(/dossier\.serviceLines/);
    expect(code(DOSSIER)).toMatch(/Líneas de servicio/);
    expect(serviceLinesWorkspaceSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyServiceLinesWorkspaceSlot()).toBe(false);
  });

  it('exclusive workspace ProofWall id is workspace-ProofWall-only', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PROOF_WALL_SLOT)).toBe(true);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).toBe('client-workspace-proof-wall');
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_KPI_RESULTS_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_KPI_HOME_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_PORTAL_PROFILE_SLOT);
    expect(CLIENT_WORKSPACE_PROOF_WALL_SLOT).not.toBe(CLIENT_WORKSPACE_SERVICE_LINES_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-proof-wall');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-service-lines');
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_SERVICE_LINES_SLOT)).toBe(true);
    expect(listKnownReactExclusiveSlotIds()).not.toContain('proof-wall');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('proofwall');
  });
});

describe('Phase 6 ProofWall workspace ProofWall cutover — C2 / C3 authority', () => {
  it('React workspace read remains tenant-scoped compatibility, not a new authority', () => {
    expect(code(REACT)).toMatch(/useProofWall\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/readProofWall/);
    expect(code(READ)).toMatch(/export function readProofWall\(/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
  });

  it('React workspace write stays command #7; leftover host write stays none', () => {
    expect(code(REACT)).toMatch(/useSetProofWallItemReadiness\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/masterProfileCommands\.setProofWallItemReadiness/);
    expect(code(WORKSPACE)).not.toMatch(/btn-toggle-proof-wall/);
    expect(code(WORKSPACE)).not.toMatch(/updateProofWallItem/);
    expect(code(WORKSPACE)).not.toMatch(/setProofWallItemReadiness/);
    expect(code(PAGE)).not.toMatch(/updateProofWallItem|profileHandlers|from\s+['"][^'"]*services\/db['"]/);
  });

  it('portal ProofWall and portal service-lines cutovers stay omitted', () => {
    expect(code(HOST)).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(code(HOST)).not.toMatch(/renderProofWall/);
    expect(code(HOST)).not.toMatch(/renderServiceLinesReadOnly/);
    expect(proofWallPortalThesisSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyProofWallPortalThesisSlot()).toBe(false);
    expect(serviceLinesPortalThesisSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyServiceLinesPortalThesisSlot()).toBe(false);
    expect(code(PORTAL)).toMatch(/<ReactProofWallPanel\s*\/>/);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT)).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT)).toBe(true);
  });
});

describe('Phase 6 ProofWall workspace ProofWall cutover — C4 / C5 / coexistence', () => {
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

  it('does not nest React ProofWall in the leftover host or create a second root', () => {
    expect(code(WORKSPACE)).not.toMatch(/ReactProofWallPanel/);
    expect(code(WORKSPACE)).not.toMatch(/createRoot/);
    expect(code(WORKSPACE)).not.toMatch(/#app/);
    expect(code(APPSHELL)).not.toMatch(/createRoot/);
    expect(code(PAGE)).not.toMatch(/createRoot/);
    expect(code(REACT)).not.toMatch(/createRoot/);
    expect(code(TABS)).toMatch(/REACT_WORKSPACE_TABS[\s\S]*'ws-positioning'/);
  });

  it('legacy preference still serves React workspace ProofWall (Option E)', () => {
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PROOF_WALL_SLOT)).toBe(true);
    expect(proofWallWorkspaceSlotPresentation()).toBe('omit');
    const decision = resolveServedUiMode('legacy');
    expect(decision.requested).toBe('legacy');
    expect(decision.served).toBe('react');
    expect(decision.keepReactMounted).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.mayUnmountReact).toBe(false);
  });

  it('file is absent; Product graph is zero; Dossier stays closed; C6 / C7 / T603 are not executed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(code(WORKSPACE)).not.toMatch(/renderServiceLinesReadOnly\(clientId\)/);
    expect(code(HOST)).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(shouldRenderLegacyDossierSlot()).toBe(false);
    expect(dossierSlotPresentation()).toBe('omit');
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(true);
    expect(code(DOSSIER)).toMatch(/workspaceClientId\?:\s*string\s*\|\s*null/);
    expect(read(DOSSIER_T603)).toMatch(/T603 DOSSIER UNIT[\s\S]*FORMALLY_ACCEPTED/);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
  });
});
