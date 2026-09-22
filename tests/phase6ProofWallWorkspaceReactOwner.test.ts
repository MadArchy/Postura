/**
 * SPEC-010 Phase 6 — ProofWall workspace React owner.
 *
 * Serves ReactProofWallPanel on ws-positioning with ADMIN workspace
 * narrowing. Client-resolves the already-mounted ReactMasterDossierPanel.
 * Leftover ClientWorkspace ProofWall is omitted. Leftover service-lines remain.
 * Workspace ProofWall slot is omit; exclusive id is active. C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';
import {
  proofWallWorkspaceSlotPresentation,
  shouldRenderLegacyProofWallWorkspaceSlot,
} from '../src/ui/presentation/proofWallWorkspaceSlot';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/ProofWallPanel.ts';
const REACT = 'src/ui/modules/ProofWall/ReactProofWallPanel.tsx';
const DOSSIER = 'src/ui/modules/MasterDossier/ReactMasterDossierPanel.tsx';
const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const PORTAL = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const HANDLERS = 'src/ui/legacy/handlers/profileHandlers.ts';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const SLOTS = 'src/ui/presentation/reactExclusiveSlots.ts';
const TABS = 'src/ui/legacy/shellTabs.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Phase 6 ProofWall workspace React owner — route and composition', () => {
  it('ws-positioning is React-native and routes to ReactClientWorkspacePage', () => {
    expect(code(TABS)).toMatch(/'ws-positioning'/);
    expect(code(APPSHELL)).toMatch(/'ws-positioning':\s*'positioning'/);
    expect(code(APPSHELL)).toMatch(
      /<ReactClientWorkspacePage tab=\{workspaceTab\} clientId=\{activeClientId\} \/>/
    );
  });

  it('positioning mounts ProofWall then dossier with workspaceClientId={clientId}', () => {
    expect(code(PAGE)).toMatch(/from\s+['"]\.\.\/ProofWall\/ReactProofWallPanel['"]/);
    expect(code(PAGE)).toMatch(
      /<ReactThesisEditorPage workspaceClientId=\{clientId\} \/>[\s\S]*<AdviceActionsPanel workspaceClientId=\{clientId\} \/>[\s\S]*<ReactProofWallPanel workspaceClientId=\{clientId\} \/>[\s\S]*<ReactMasterDossierPanel workspaceClientId=\{clientId\} \/>/
    );
  });

  it('both owners expose optional workspaceClientId and use established narrowing', () => {
    for (const file of [REACT, DOSSIER]) {
      const source = code(file);
      expect(source).toMatch(/workspaceClientId\?:\s*string\s*\|\s*null/);
      expect(source).toMatch(/narrowToClient\(sessionScope,\s*requested\)/);
      expect(source).toMatch(/if \(!sessionScope\) return null;/);
      expect(source).toMatch(/if \(sessionScope\.clientId\) return sessionScope;/);
      expect(source).toMatch(/if \(!requested \|\| requested === 'all'\) return null;/);
    }
  });
});

describe('Phase 6 ProofWall workspace React owner — read / write / toggle', () => {
  it('ProofWall read and write consume the narrowed scope via existing #7 path', () => {
    expect(code(REACT)).toMatch(/useProofWall\(tenantScope\)/);
    expect(code(REACT)).toMatch(/useSetProofWallItemReadiness\(tenantScope\)/);
    expect(code(REACT)).toMatch(/const tenantScope = scope;/);
    expect(code(HOOK)).toMatch(/masterProfileCommands\.setProofWallItemReadiness/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT)).not.toMatch(/updateProofWallItem/);
    expect(code(REACT)).not.toMatch(/bindProfileHandlers|profileHandlers/);
    expect(code(PAGE)).not.toMatch(/updateProofWallItem|profileHandlers|from\s+['"][^'"]*services\/db['"]/);
    expect(code(DOSSIER)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
  });

  it('toggle is ADMIN plus narrowed client; CLIENT badges stay', () => {
    expect(code(REACT)).toMatch(/showToggle = isAdmin && Boolean\(scope\?\.clientId\)/);
    expect(code(REACT)).toMatch(/item\.complete \? 'Listo' : 'Pendiente'/);
    expect(code(REACT)).not.toMatch(/actorRole:/);
    expect(code(REACT)).not.toMatch(/editable:/);
  });

  it('workspace dossier becomes client-resolved and still serves service-line facts', () => {
    expect(code(DOSSIER)).toMatch(/useMasterDossier\(tenantScope\)/);
    expect(code(DOSSIER)).toMatch(/const tenantScope = scope;/);
    expect(code(DOSSIER)).toMatch(/dossier\.serviceLines/);
    expect(code(DOSSIER)).toMatch(/Líneas de servicio/);
  });
});

describe('Phase 6 ProofWall workspace React owner — defaults and A38', () => {
  it('portal thesis and Wave2 profile ProofWall mounts stay prop-less', () => {
    expect(code(PORTAL)).toMatch(/<ReactProofWallPanel\s*\/>/);
    expect(code(WAVE2)).toMatch(/group === 'profile'[\s\S]*<ReactProofWallPanel\s*\/>/);
    expect(code(PORTAL)).toMatch(/<ReactMasterDossierPanel\s*\/>/);
    expect(code(WAVE2)).toMatch(/group === 'dossier'[\s\S]*<ReactMasterDossierPanel\s*\/>/);
  });

  it('A38: existing React tree only; no leftover island on served ws-positioning', () => {
    expect(code(APPSHELL)).not.toMatch(/createRoot/);
    expect(code(PAGE)).not.toMatch(/createRoot/);
    expect(code(REACT)).not.toMatch(/createRoot/);
    expect(code(WORKSPACE)).not.toMatch(/ReactProofWallPanel|createRoot/);
    expect(code(TABS)).toMatch(/REACT_WORKSPACE_TABS[\s\S]*'ws-positioning'/);
    const served = resolveServedUiMode('react');
    expect(served.served).toBe('react');
    expect(served.mayActivateLegacyRoot).toBe(false);
  });

  it('Dossier governance remains unchanged', () => {
    expect(shouldRenderLegacyDossierSlot()).toBe(false);
    expect(dossierSlotPresentation()).toBe('omit');
    expect(hasReactExclusiveSlot()).toBe(true);
  });
});

describe('Phase 6 ProofWall workspace React owner — leftover gate separation', () => {
  it('ClientWorkspace leftover ProofWall is omitted; service-lines and file remain', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    expect(code(WORKSPACE)).toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
    expect(code(WORKSPACE)).not.toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
    expect(code(WORKSPACE)).not.toMatch(/\brenderProofWall\b/);
    expect(code(WORKSPACE)).toMatch(/renderServiceLinesReadOnly\(clientId\)/);
    expect(code(HANDLERS)).toMatch(/dbService\.updateProofWallItem/);
  });

  it('whole-file C6 is not eligible; workspace ProofWall slot is omit and exclusive id is active', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
    expect(existsSync(join(ROOT, 'src/ui/presentation/proofWallWorkspaceSlot.ts'))).toBe(true);
    expect(proofWallWorkspaceSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyProofWallWorkspaceSlot()).toBe(false);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PROOF_WALL_SLOT)).toBe(true);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-proof-wall');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('client-workspace-service-lines');
    expect(code(SLOTS)).toMatch(/CLIENT_WORKSPACE_PROOF_WALL_SLOT/);
    expect(code(WORKSPACE)).toMatch(/from\s+['"]\.\/ProofWallPanel['"]/);
  });
});
