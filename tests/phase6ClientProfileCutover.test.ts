/**
 * SPEC-010 Phase 6 — ClientPortal profile cutover (`client-portal-profile`).
 *
 * Omits legacy `renderClientProfileBody` from ClientPortal.
 * Physical absence of ClientProfilePanel.ts is intentional. C6 is not yet verified. C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_KPI_HOME_SLOT,
  CLIENT_KPI_RESULTS_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_PORTAL_PROFILE_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  clientProfileSlotPresentation,
  shouldRenderLegacyClientProfileSlot,
} from '../src/ui/presentation/clientProfileSlot';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/ClientProfilePanel.ts';
const REACT = 'src/ui/modules/ClientProfile/ReactClientProfilePanel.tsx';
const HOST = 'src/components/ClientPortal.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const HANDLERS = 'src/ui/legacy/handlers/profileHandlers.ts';
const ONBOARDING_HANDLERS = 'src/ui/legacy/handlers/onboardingHandlers.ts';
const MODAL = 'src/controllers/modalPresenter.ts';
const ONBOARDING_LEGACY = 'src/components/OnboardingWizard.ts';
const PROOFWALL = 'src/components/ProofWallPanel.ts';
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

describe('Phase 6 ClientProfile cutover — C1 served ownership', () => {
  it('ClientProfilePanel.ts is absent and React profile stays mounted', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
  });

  it('React profile is served from AppShell client-profile → Wave2 profile', () => {
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(code(APPSHELL)).toMatch(/'client-profile':\s*'profile'/);
    expect(code(WAVE2)).toMatch(/group === 'profile'[\s\S]*<ReactClientProfilePanel/);
  });

  it('ClientPortal no longer imports or calls the legacy profile body', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/ClientProfilePanel['"]/);
    expect(host).not.toMatch(/ClientProfilePanel/);
    expect(host).not.toMatch(/renderClientProfileBody/);
    expect(shouldRenderLegacyClientProfileSlot()).toBe(false);
    expect(clientProfileSlotPresentation()).toBe('omit');
  });

  it('product runtime import and call graph of ClientProfilePanel.ts is zero', () => {
    const importOffenders: string[] = [];
    const callOffenders: string[] = [];
    for (const file of collectTs(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel === LEGACY) continue;
      const source = code(rel);
      if (
        /from\s+['"][^'"]*\/ClientProfilePanel['"]/.test(source) ||
        /import\s*\(\s*['"][^'"]*\/ClientProfilePanel['"]/.test(source)
      ) {
        importOffenders.push(rel);
      }
      if (/renderClientProfileBody/.test(source)) {
        callOffenders.push(rel);
      }
    }
    expect(importOffenders).toEqual([]);
    expect(callOffenders).toEqual([]);
  });

  it('exclusive profile id is portal-profile-only and distinct from closed leaves', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_PROFILE_SLOT)).toBe(true);
    expect(CLIENT_PORTAL_PROFILE_SLOT).toBe('client-portal-profile');
    expect(CLIENT_PORTAL_PROFILE_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_PORTAL_PROFILE_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_PORTAL_PROFILE_SLOT).not.toBe(CLIENT_KPI_RESULTS_SLOT);
    expect(CLIENT_PORTAL_PROFILE_SLOT).not.toBe(CLIENT_KPI_HOME_SLOT);
    expect(listKnownReactExclusiveSlotIds()).not.toContain('client-profile');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('profile');
    expect(existsSync(join(ROOT, 'src/ui/presentation/profileSlot.ts'))).toBe(false);
  });
});

describe('Phase 6 ClientProfile cutover — C2 / C3 canonical path', () => {
  it('React read remains tenant-scoped compatibility, not a new authority', () => {
    expect(code(REACT)).toMatch(/useProfileOverview\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/readProfileOverview/);
    expect(code(READ)).toMatch(/export function readProfileOverview\(/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
  });

  it('React writes remain CU #2–#6 through masterProfileCommands', () => {
    const panel = code(REACT);
    const hook = code(HOOK);
    const seam = code(SEAM);
    expect(panel).toMatch(/useAddProfileFact/);
    expect(panel).toMatch(/useConfirmProfileFact/);
    expect(panel).toMatch(/useRejectProfileFact/);
    expect(panel).toMatch(/useUpdateProfileFact/);
    expect(panel).toMatch(/useImportProfileFactsFromCv/);
    expect(hook).toMatch(/masterProfileCommands\.addProfileFact/);
    expect(hook).toMatch(/masterProfileCommands\.confirmProfileFact/);
    expect(hook).toMatch(/masterProfileCommands\.rejectProfileFact/);
    expect(hook).toMatch(/masterProfileCommands\.updateProfileFact/);
    expect(hook).toMatch(/masterProfileCommands\.importProfileFactsFromCv/);
    expect(seam).toMatch(/addProfileFact\(intent/);
    expect(seam).toMatch(/confirmProfileFact\(intent/);
    expect(seam).toMatch(/rejectProfileFact\(intent/);
    expect(seam).toMatch(/updateProfileFact\(intent/);
    expect(seam).toMatch(/importProfileFactsFromCv\(intent/);
  });

  it('profile handlers stay optional and leftover fact/CV writes are unserved', () => {
    expect(statSync(join(ROOT, HANDLERS)).isFile()).toBe(true);
    const handlers = code(HANDLERS);
    expect(handlers).toMatch(/getElementById\('btn-extract-cv-facts'\)\?/);
    expect(handlers).toMatch(/querySelectorAll\('\.btn-add-profile-fact'\)/);
    expect(handlers).toMatch(/querySelectorAll\('\.btn-toggle-proof-wall'\)/);
    expect(code(HOST)).not.toMatch(/btn-extract-cv-facts/);
    expect(code(HOST)).not.toMatch(/btn-add-profile-fact/);
    expect(code(HOST)).not.toMatch(/btn-confirm-profile-fact/);
    expect(code(HOST)).not.toMatch(/btn-reject-profile-fact/);
    expect(code(HOST)).not.toMatch(/btn-edit-profile-fact/);
    expect(code(HOST)).not.toMatch(/input-cv-upload/);
    expect(code(WORKSPACE)).toMatch(/btn-toggle-proof-wall|renderProofWall/);
  });
});

describe('Phase 6 ClientProfile cutover — C4 / C5 / coexistence', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [
      'src/ui/presentation/clientProfileSlot.ts',
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

  it('does not create a second React root or nest React inside the legacy host', () => {
    expect(code(HOST)).not.toMatch(/ReactClientProfilePanel/);
    expect(code(HOST)).not.toMatch(/createRoot/);
    expect(code(HOST)).not.toMatch(/#app/);
    expect(code(WAVE2)).not.toMatch(/from\s+['"][^'"]*\/ClientProfilePanel['"]/);
  });

  it('legacy preference still serves React profile (Option E)', () => {
    expect(isReactExclusiveSlot(CLIENT_PORTAL_PROFILE_SLOT)).toBe(true);
    expect(clientProfileSlotPresentation()).toBe('omit');
    const decision = resolveServedUiMode('legacy');
    expect(decision.requested).toBe('legacy');
    expect(decision.served).toBe('react');
    expect(decision.keepReactMounted).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.mayUnmountReact).toBe(false);
  });

  it('ProofWall workspace remains leftover; thesis leftover ProofWall is omitted; profile nest is unserved', () => {
    expect(statSync(join(ROOT, PROOFWALL)).isFile()).toBe(true);
    expect(code(HOST)).not.toMatch(/renderProofWall/);
    expect(code(HOST)).toMatch(/renderServiceLinesReadOnly/);
    expect(code(WORKSPACE)).toMatch(/id="proof-wall-section"/);
    expect(code(WORKSPACE)).toMatch(/renderProofWall\(clientId,\s*\{\s*editable:\s*true\s*\}\)/);
    expect(code(HOST)).not.toMatch(/renderClientProfileBody/);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portal-thesis-proof-wall');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('client-workspace-proof-wall');
  });

  it('onboarding modal and remaining entry points stay served', () => {
    expect(statSync(join(ROOT, ONBOARDING_LEGACY)).isFile()).toBe(true);
    expect(code(MODAL)).toMatch(/modal === 'onboarding'/);
    expect(code(MODAL)).toMatch(/renderOnboardingWizard/);
    expect(code(WORKSPACE)).toMatch(/id="btn-open-onboarding"/);
    expect(code(ONBOARDING_HANDLERS)).toMatch(/#btn-open-onboarding,\s*\.btn-open-onboarding/);
    expect(code(WAVE2)).toMatch(/group === 'profile'[\s\S]*<ReactOnboardingWizard/);
    expect(listKnownReactExclusiveSlotIds()).not.toContain('client-onboarding-modal');
  });

  it('physical absence is intentional; C6 is not yet verified; C7 and T603 are not executed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
  });
});
