/**
 * SPEC-010 Phase 6 — ClientPortal thesis service-lines cutover
 * (`client-portal-thesis-service-lines`).
 *
 * Omits leftover `renderServiceLinesReadOnly` from ClientPortal
 * `renderClientThesisBody`. ProofWallPanel.ts remains present.
 * Workspace leftover ProofWall is omitted. Workspace leftover service-lines
 * are omitted (`client-workspace-service-lines`). Closed Dossier React
 * ownership is unchanged. C6 / C7 / T603 are not executed.
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
  CLIENT_WORKSPACE_SERVICE_LINES_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
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
const DOSSIER = 'src/ui/modules/MasterDossier/ReactMasterDossierPanel.tsx';
const PORTAL_PAGE = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const HOST = 'src/components/ClientPortal.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const HANDLERS = 'src/ui/legacy/handlers/profileHandlers.ts';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const SLOT = 'src/ui/presentation/serviceLinesPortalThesisSlot.ts';
const TASKS = 'specs/010-react-migration/tasks.md';
const DOSSIER_T603 = 'specs/010-react-migration/t-010-603-dossier-subset-removal.md';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Phase 6 ProofWall portal thesis service-lines cutover — C1 served ownership', () => {
  it('ProofWallPanel.ts remains present and React thesis dossier service-lines stay served', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    expect(statSync(join(ROOT, DOSSIER)).isFile()).toBe(true);
    expect(code(APPSHELL)).toMatch(/'client-thesis':\s*'thesis'/);
    expect(code(PORTAL_PAGE)).toMatch(/tab === 'thesis'[\s\S]*<ThesisReviewPanel/);
    expect(code(PORTAL_PAGE)).toMatch(/<ReactMasterDossierPanel\s*\/>/);
    expect(code(DOSSIER)).toMatch(/Líneas de servicio/);
    expect(code(DOSSIER)).toMatch(/dossier\.serviceLines/);
  });

  it('ClientPortal omits leftover thesis service-lines and drops the ProofWallPanel import', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(host).not.toMatch(/renderServiceLinesReadOnly/);
    expect(host).not.toMatch(/renderProofWall/);
    expect(shouldRenderLegacyServiceLinesPortalThesisSlot()).toBe(false);
    expect(serviceLinesPortalThesisSlotPresentation()).toBe('omit');
  });

  it('workspace leftover ProofWall and leftover service-lines are omitted; file remains', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(code(WORKSPACE)).not.toMatch(/id="proof-wall-section"/);
    expect(code(WORKSPACE)).not.toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
    expect(code(WORKSPACE)).not.toMatch(/\brenderProofWall\b/);
    expect(code(WORKSPACE)).not.toMatch(/renderServiceLinesReadOnly\(clientId\)/);
    expect(serviceLinesWorkspaceSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyServiceLinesWorkspaceSlot()).toBe(false);
    expect(code(HANDLERS)).toMatch(/dbService\.updateProofWallItem/);
  });

  it('exclusive thesis service-lines id is thesis-only and does not claim workspace, ProofWall, or Dossier', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT)).toBe(true);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).toBe('client-portal-thesis-service-lines');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portal-thesis-service-lines');
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_KPI_RESULTS_SLOT);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_KPI_HOME_SLOT);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_PORTAL_PROFILE_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-service-lines');
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_SERVICE_LINES_SLOT)).toBe(true);
    expect(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT).not.toBe(CLIENT_WORKSPACE_SERVICE_LINES_SLOT);
    expect(listKnownReactExclusiveSlotIds()).not.toContain('service-lines');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('proofwall');
  });
});

describe('Phase 6 ProofWall portal thesis service-lines cutover — C2 / C3 authority', () => {
  it('React dossier read remains tenant-scoped compatibility, not a new authority', () => {
    expect(code(DOSSIER)).toMatch(/useMasterDossier\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/readMasterDossier/);
    expect(code(READ)).toMatch(/export function readMasterDossier\(/);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
  });

  it('portal leftover service-lines write stays none; workspace leftover ProofWall call is omitted', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/renderServiceLinesReadOnly/);
    expect(host).not.toMatch(/btn-toggle-proof-wall/);
    expect(host).not.toMatch(/updateProofWallItem/);
    expect(host).not.toMatch(/setProofWallItemReadiness/);
    expect(code(HANDLERS)).toMatch(/querySelectorAll\('\.btn-toggle-proof-wall'\)/);
    expect(code(HANDLERS)).toMatch(/dbService\.updateProofWallItem/);
    expect(code(WORKSPACE)).not.toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
  });

  it('closed Dossier React owner, slot, exclusive id, and T603 record stay unchanged', () => {
    expect(code(DOSSIER)).toMatch(/Líneas de servicio/);
    expect(code(DOSSIER)).toMatch(/dossier\.serviceLines/);
    expect(code('src/ui/presentation/dossierSlot.ts')).toMatch(/omit/);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(true);
    expect(read(DOSSIER_T603)).toMatch(/T603 DOSSIER UNIT[\s\S]*FORMALLY_ACCEPTED/);
  });
});

describe('Phase 6 ProofWall portal thesis service-lines cutover — C4 / C5 / coexistence', () => {
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
    expect(code(HOST)).not.toMatch(/ReactMasterDossierPanel/);
    expect(code(HOST)).not.toMatch(/createRoot/);
    expect(code(HOST)).not.toMatch(/#app/);
    expect(code(WORKSPACE)).not.toMatch(/ReactMasterDossierPanel/);
  });

  it('legacy preference still serves React thesis service-lines (Option E)', () => {
    expect(isReactExclusiveSlot(CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT)).toBe(true);
    expect(serviceLinesPortalThesisSlotPresentation()).toBe('omit');
    const decision = resolveServedUiMode('legacy');
    expect(decision.requested).toBe('legacy');
    expect(decision.served).toBe('react');
    expect(decision.keepReactMounted).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.mayUnmountReact).toBe(false);
  });

  it('file remains present; whole-file C6 / C7 / T603 are not eligible', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
    expect(code(WORKSPACE)).not.toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
    expect(code(WORKSPACE)).not.toMatch(/renderServiceLinesReadOnly\(clientId\)/);
    expect(code(HOST)).not.toMatch(/renderServiceLinesReadOnly/);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
  });
});
