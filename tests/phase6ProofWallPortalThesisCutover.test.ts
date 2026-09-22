/**
 * SPEC-010 Phase 6 — ClientPortal thesis ProofWall cutover
 * (`client-portal-thesis-proof-wall`).
 *
 * Omits leftover `renderProofWall` from ClientPortal `renderClientThesisBody`.
 * ProofWallPanel.ts remains present. Portal leftover service-lines are a
 * separate omit (`client-portal-thesis-service-lines`). Workspace leftover
 * ProofWall is omitted (`client-workspace-proof-wall`). Workspace leftover
 * service-lines are omitted (`client-workspace-service-lines`). Leftover write remains.
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
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  proofWallPortalThesisSlotPresentation,
  shouldRenderLegacyProofWallPortalThesisSlot,
} from '../src/ui/presentation/proofWallPortalThesisSlot';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/ProofWallPanel.ts';
const REACT = 'src/ui/modules/ProofWall/ReactProofWallPanel.tsx';
const PORTAL = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const HOST = 'src/components/ClientPortal.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const HANDLERS = 'src/ui/legacy/handlers/profileHandlers.ts';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const TASKS = 'specs/010-react-migration/tasks.md';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Phase 6 ProofWall portal thesis cutover — C1 served ownership', () => {
  it('ProofWallPanel.ts remains present and React thesis ProofWall stays mounted', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(code(APPSHELL)).toMatch(/'client-thesis':\s*'thesis'/);
    expect(code(PORTAL)).toMatch(/tab === 'thesis'[\s\S]*<ThesisReviewPanel/);
    expect(code(PORTAL)).toMatch(/<ReactProofWallPanel\s*\/>/);
  });

  it('ClientPortal omits leftover thesis ProofWall and drops the ProofWallPanel import', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(host).not.toMatch(/renderServiceLinesReadOnly/);
    expect(host).not.toMatch(/renderProofWall/);
    expect(shouldRenderLegacyProofWallPortalThesisSlot()).toBe(false);
    expect(proofWallPortalThesisSlotPresentation()).toBe('omit');
  });

  it('workspace leftover ProofWall and leftover service-lines are omitted; file remains', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(code(WORKSPACE)).not.toMatch(/id="proof-wall-section"/);
    expect(code(WORKSPACE)).not.toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
    expect(code(WORKSPACE)).not.toMatch(/\brenderProofWall\b/);
    expect(code(WORKSPACE)).not.toMatch(/renderServiceLinesReadOnly\(clientId\)/);
    expect(code(HANDLERS)).toMatch(/dbService\.updateProofWallItem/);
  });

  it('exclusive thesis ProofWall id is thesis-only and does not claim workspace or the file', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT)).toBe(true);
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).toBe('client-portal-thesis-proof-wall');
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).not.toBe(CLIENT_KPI_RESULTS_SLOT);
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).not.toBe(CLIENT_KPI_HOME_SLOT);
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).not.toBe(CLIENT_PORTAL_PROFILE_SLOT);
    expect(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT).not.toBe(CLIENT_WORKSPACE_PROOF_WALL_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portal-thesis-proof-wall');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-proof-wall');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('proof-wall');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('proofwall');
  });
});

describe('Phase 6 ProofWall portal thesis cutover — C2 / C3 authority', () => {
  it('React thesis read remains tenant-scoped compatibility, not a new authority', () => {
    expect(code(REACT)).toMatch(/useProofWall\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/readProofWall/);
    expect(code(READ)).toMatch(/export function readProofWall\(/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
  });

  it('portal thesis leftover write stays none; workspace leftover ProofWall call is omitted', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/btn-toggle-proof-wall/);
    expect(host).not.toMatch(/updateProofWallItem/);
    expect(host).not.toMatch(/setProofWallItemReadiness/);
    expect(code(HANDLERS)).toMatch(/querySelectorAll\('\.btn-toggle-proof-wall'\)/);
    expect(code(HANDLERS)).toMatch(/dbService\.updateProofWallItem/);
    expect(code(WORKSPACE)).not.toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
  });

  it('Wave2 profile ProofWall mount and #7 path stay unchanged', () => {
    expect(code(WAVE2)).toMatch(/group === 'profile'[\s\S]*<ReactProofWallPanel/);
    expect(code(REACT)).toMatch(/useSetProofWallItemReadiness/);
    expect(code(HOOK)).toMatch(/setProofWallItemReadiness/);
  });
});

describe('Phase 6 ProofWall portal thesis cutover — C4 / C5 / coexistence', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [
      'src/ui/presentation/proofWallPortalThesisSlot.ts',
      'src/ui/presentation/reactExclusiveSlots.ts',
      REACT,
    ]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('does not nest React ProofWall in the leftover host or create a second root', () => {
    expect(code(HOST)).not.toMatch(/ReactProofWallPanel/);
    expect(code(HOST)).not.toMatch(/createRoot/);
    expect(code(HOST)).not.toMatch(/#app/);
    expect(code(WAVE2)).not.toMatch(/from\s+['"][^'"]*\/ProofWallPanel['"]/);
  });

  it('legacy preference still serves React thesis ProofWall (Option E)', () => {
    expect(isReactExclusiveSlot(CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT)).toBe(true);
    expect(proofWallPortalThesisSlotPresentation()).toBe('omit');
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
    expect(code(HOST)).not.toMatch(/renderServiceLinesReadOnly/);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
  });
});
