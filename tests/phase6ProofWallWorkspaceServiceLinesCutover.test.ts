/**
 * SPEC-010 Phase 6 — ClientWorkspace positioning service-lines cutover
 * (`client-workspace-service-lines`).
 *
 * Omits leftover `renderServiceLinesReadOnly` from ClientWorkspace
 * `renderPositioning`. ProofWallPanel.ts is absent. ClientWorkspace
 * drops the ProofWallPanel import. `#proof-wall-section` is removed.
 * React workspace ProofWall and ReactMasterDossierPanel stay served.
 * C6 / C7 technical contracts remain. The ProofWall T603 formal record is present.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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
  serviceLinesWorkspaceSlotPresentation,
  shouldRenderLegacyServiceLinesWorkspaceSlot,
} from '../src/ui/presentation/serviceLinesWorkspaceSlot';
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
const SLOT = 'src/ui/presentation/serviceLinesWorkspaceSlot.ts';
const TASKS = 'specs/010-react-migration/tasks.md';
const DOSSIER_T603 = 'specs/010-react-migration/t-010-603-dossier-subset-removal.md';
const PROOFWALL_T603 = 'specs/010-react-migration/t-010-603-proofwall-subset-removal.md';
const TABS = 'src/ui/legacy/shellTabs.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function productSources(): string[] {
  return collectFiles(join(ROOT, 'src'))
    .filter((file) => !file.replace(/\\/g, '/').endsWith('/components/ProofWallPanel.ts'))
    .map((file) => code(relative(ROOT, file).replace(/\\/g, '/')));
}

describe('Phase 6 ProofWall workspace service-lines cutover — C1 served ownership', () => {
  it('ProofWallPanel.ts is absent and React workspace ProofWall plus dossier stay mounted', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(statSync(join(ROOT, DOSSIER)).isFile()).toBe(true);
    expect(code(APPSHELL)).toMatch(/'ws-positioning':\s*'positioning'/);
    expect(code(PAGE)).toMatch(
      /tab === 'positioning'[\s\S]*<ReactProofWallPanel\s+workspaceClientId=\{clientId\}/
    );
    expect(code(PAGE)).toMatch(
      /<ReactMasterDossierPanel\s+workspaceClientId=\{clientId\}/
    );
    expect(code(DOSSIER)).toMatch(/workspaceClientId\?:\s*string\s*\|\s*null/);
    expect(code(DOSSIER)).toMatch(/narrowToClient\(sessionScope,\s*requested\)/);
  });

  it('ClientWorkspace drops the ProofWallPanel import and omits leftover service-lines', () => {
    const workspace = code(WORKSPACE);
    expect(workspace).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(workspace).not.toMatch(/\brenderProofWall\b/);
    expect(workspace).not.toMatch(/renderServiceLinesReadOnly/);
    expect(workspace).not.toMatch(/id="proof-wall-section"/);
    expect(shouldRenderLegacyServiceLinesWorkspaceSlot()).toBe(false);
    expect(serviceLinesWorkspaceSlotPresentation()).toBe('omit');
  });

  it('React workspace dossier remains client-resolved and product-serves service-line facts', () => {
    expect(code(DOSSIER)).toMatch(/useMasterDossier\(tenantScope\)/);
    expect(code(DOSSIER)).toMatch(/dossier\.serviceLines/);
    expect(code(DOSSIER)).toMatch(/Líneas de servicio/);
    expect(code(DOSSIER)).toMatch(/line\.name/);
    expect(code(DOSSIER)).toMatch(/line\.description/);
    expect(code(DOSSIER)).toMatch(/line\.offerings/);
    expect(code(HOOK)).toMatch(/readMasterDossier/);
    expect(code(READ)).toMatch(/export function readMasterDossier\(/);
  });

  it('exclusive workspace service-lines id is workspace-service-lines-only', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_SERVICE_LINES_SLOT)).toBe(true);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).toBe('client-workspace-service-lines');
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_WORKSPACE_PROOF_WALL_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_KPI_RESULTS_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_KPI_HOME_SLOT);
    expect(CLIENT_WORKSPACE_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_PROFILE_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-service-lines');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-proof-wall');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('service-lines');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('proofwall');
  });
});

describe('Phase 6 ProofWall workspace service-lines cutover — C2 / C3 authority', () => {
  it('React dossier read remains tenant-scoped compatibility, not a new authority', () => {
    expect(code(DOSSIER)).toMatch(/useMasterDossier\(tenantScope\)/);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
  });

  it('workspace leftover service-lines write stays none; workspace ProofWall stays omitted', () => {
    expect(code(WORKSPACE)).not.toMatch(/renderServiceLinesReadOnly/);
    expect(code(WORKSPACE)).not.toMatch(/\brenderProofWall\b/);
    expect(code(WORKSPACE)).not.toMatch(/btn-toggle-proof-wall/);
    expect(code(PAGE)).not.toMatch(/updateProofWallItem|profileHandlers|from\s+['"][^'"]*services\/db['"]/);
    expect(proofWallWorkspaceSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyProofWallWorkspaceSlot()).toBe(false);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PROOF_WALL_SLOT)).toBe(true);
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

describe('Phase 6 ProofWall workspace service-lines cutover — C4 / C5 / coexistence', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [SLOT, 'src/ui/presentation/reactExclusiveSlots.ts', DOSSIER]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('does not nest React dossier in the leftover host or create a second root', () => {
    expect(code(WORKSPACE)).not.toMatch(/ReactMasterDossierPanel/);
    expect(code(WORKSPACE)).not.toMatch(/ReactProofWallPanel/);
    expect(code(WORKSPACE)).not.toMatch(/createRoot/);
    expect(code(WORKSPACE)).not.toMatch(/#app/);
    expect(code(APPSHELL)).not.toMatch(/createRoot/);
    expect(code(PAGE)).not.toMatch(/createRoot/);
    expect(code(DOSSIER)).not.toMatch(/createRoot/);
    expect(code(TABS)).toMatch(/REACT_WORKSPACE_TABS[\s\S]*'ws-positioning'/);
  });

  it('legacy preference still serves React workspace service-lines (Option E)', () => {
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_SERVICE_LINES_SLOT)).toBe(true);
    expect(serviceLinesWorkspaceSlotPresentation()).toBe('omit');
    const decision = resolveServedUiMode('legacy');
    expect(decision.requested).toBe('legacy');
    expect(decision.served).toBe('react');
    expect(decision.keepReactMounted).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.mayUnmountReact).toBe(false);
  });

  it('Product graph is zero; ProofWall T603 subset accepted; legacy file absent; C6/C7 verified; T603 formally closed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    const sources = productSources();
    expect(
      sources.some((source) => /from\s+['"](?:\.\/ProofWallPanel|[^'"]*\/ProofWallPanel)['"]/.test(source))
    ).toBe(false);
    expect(sources.some((source) => /\brenderProofWall\b/.test(source))).toBe(false);
    expect(sources.some((source) => /\brenderServiceLinesReadOnly\b/.test(source))).toBe(false);
    expect(shouldRenderLegacyDossierSlot()).toBe(false);
    expect(dossierSlotPresentation()).toBe('omit');
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(true);
    expect(read(DOSSIER_T603)).toMatch(/T603 DOSSIER UNIT[\s\S]*FORMALLY_ACCEPTED/);
    expect(read(TASKS)).toMatch(
      /^(?![^\n]*(?:NOT AUTHORIZED|TODO|PENDING|\[ \]))\| \*\*T-010-603\*\* \|[^\n]*\| \*\*\[x\] DONE — FORMALLY_CLOSED\*\*[^|\n]*\|\r?$/m
    );
    expect(read(TASKS).match(/^\| \*\*T-010-603\*\* \|/gm)).toHaveLength(1);
    expect(existsSync(join(ROOT, PROOFWALL_T603))).toBe(true);
    const proofWallT603 = read(PROOFWALL_T603);
    expect(proofWallT603).toMatch(/T603 SAFE SUBSET = `src\/components\/ProofWallPanel\.ts`/);
    expect(proofWallT603).toMatch(
      /FORMAL DECISION = `PHASE6_PROOFWALL_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`/
    );
    expect(proofWallT603).toMatch(/T603 PROOFWALL UNIT[\s\S]*FORMALLY_ACCEPTED/);
  });
});
