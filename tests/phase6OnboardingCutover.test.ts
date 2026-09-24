/**
 * SPEC-010 Phase 6 — Onboarding presentation cutover.
 *
 * Frozen Product contract: 1A + 2B + 3B + 4B + 5B + 6B.
 * Omits leftover Onboarding modal from `modalPresenter` and retires
 * LegacyApp auto-open presentation ownership. Physical file remains PRESENT.
 * C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { listKnownReactExclusiveSlotIds } from '../src/ui/presentation/reactExclusiveSlots';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/OnboardingWizard.ts';
const REACT = 'src/ui/modules/Onboarding/ReactOnboardingWizard.tsx';
const MODAL = 'src/controllers/modalPresenter.ts';
const LEGACY_APP = 'src/ui/legacy/LegacyApp.ts';
const AUTH = 'src/services/auth.ts';
const TYPES = 'src/types/index.ts';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const HOOKS = 'src/ui/hooks/useWave2Data.ts';
const READS = 'src/ui/data/compatibilityReads.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const APPLICATION = 'src/application/masterProfile/ApplyOnboardingStep.ts';
const LOGIC = 'src/application/masterProfile/applyOnboardingStepLogic.ts';
const HANDLERS = 'src/ui/legacy/handlers/onboardingHandlers.ts';
const MOUNT = 'src/ui/mount.ts';
const SLOTS = 'src/ui/presentation/reactExclusiveSlots.ts';

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

describe('Phase 6 Onboarding cutover — leftover file is absent, Product graph is zero', () => {
  it('OnboardingWizard.ts is physically absent with no stub/alias', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/PageHeader.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/SourceRegistryModal.ts'))).toBe(false);
  });

  it('modalPresenter no longer imports or presents leftover Onboarding', () => {
    const presenter = code(MODAL);
    expect(presenter).not.toMatch(/OnboardingWizard/);
    expect(presenter).not.toMatch(/renderOnboardingWizard/);
    expect(presenter).not.toMatch(/modal === 'onboarding'/);
    expect(presenter).toMatch(/return html\(''\)/);
    expect(presenter).toMatch(/export function presentActiveModal/);
  });

  it('product runtime import and call graph of OnboardingWizard.ts is zero', () => {
    const importOffenders: string[] = [];
    const callOffenders: string[] = [];
    for (const file of collectTs(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel === LEGACY) continue;
      const source = code(rel);
      if (
        /from\s+['"][^'"]*\/OnboardingWizard['"]/.test(source) ||
        /import\s*\(\s*['"][^'"]*\/OnboardingWizard['"]/.test(source)
      ) {
        importOffenders.push(rel);
      }
      if (/\brenderOnboardingWizard\b/.test(source)) {
        callOffenders.push(rel);
      }
    }
    expect(importOffenders).toEqual([]);
    expect(callOffenders).toEqual([]);
  });
});

describe('Phase 6 Onboarding cutover — auto-open presentation retired; auth preserved', () => {
  it('LegacyApp no longer converts mustCompleteOnboarding into leftover modal ownership', () => {
    const app = code(LEGACY_APP);
    expect(app).not.toMatch(/mustCompleteOnboarding[\s\S]{0,120}activeModal\s*=\s*['"]onboarding['"]/);
    expect(app).not.toMatch(/activeModal\s*=\s*['"]onboarding['"]/);
  });

  it('mustCompleteOnboarding field and invite/session helpers remain intact', () => {
    expect(code(TYPES)).toMatch(/mustCompleteOnboarding:\s*boolean/);
    expect(code(AUTH)).toMatch(/mustCompleteOnboarding:\s*extras\?\.mustCompleteOnboarding/);
    expect(code(AUTH)).toMatch(/mustCompleteOnboarding:\s*true/);
    expect(code(AUTH)).toMatch(/clearOnboardingFlag/);
    expect(code(AUTH)).toMatch(/registerFromInvite/);
  });
});

describe('Phase 6 Onboarding cutover — canonical React owner', () => {
  it('ReactOnboardingWizard remains live on client-profile / existing #react-root', () => {
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(code(APPSHELL)).toMatch(/'client-profile':\s*'profile'/);
    expect(code(WAVE2)).toMatch(/group === 'profile'[\s\S]*<ReactOnboardingWizard/);
    expect(code(MOUNT)).toMatch(/REACT_ROOT_ID = 'react-root'/);
    expect(code(REACT)).not.toMatch(/createRoot/);
    expect(code(MODAL)).not.toMatch(/createRoot|#react-root|#app/);
    expect(existsSync(join(ROOT, 'src/ui/modules/Onboarding/ReactOnboardingModal.tsx'))).toBe(false);
  });

  it('six-step model, scoped reads, and #10 write remain', () => {
    const wizard = code(REACT);
    const hooks = code(HOOKS);
    expect(wizard).toMatch(/Paso \{effectiveStep\} de 6|Paso \$\{effectiveStep\} de 6|de 6/);
    expect(wizard).toMatch(/useOnboardingContext/);
    expect(wizard).toMatch(/useApplyOnboardingStep/);
    expect(hooks).toMatch(/readOnboardingContext/);
    expect(hooks).toMatch(/masterProfileCommands\.applyOnboardingStep/);
    expect(code(READS)).toMatch(/export function readOnboardingContext/);
    expect(code(APPLICATION)).toMatch(/createApplyOnboardingStep|ApplyOnboardingStep/);
    expect(wizard).not.toMatch(/\bdbService\b/);
  });

  it('step-6 completion, notify/flag-clear, and client-thesis destination remain', () => {
    expect(code(LOGIC)).toMatch(/onboardingStatus:\s*'COMPLETED'/);
    expect(code(LOGIC)).toMatch(/status:\s*'ACTIVE'/);
    const seam = code(SEAM);
    expect(seam).toMatch(/notifyManager/);
    expect(seam).toMatch(/clearOnboardingFlag/);
    expect(code(REACT)).toMatch(/publishShellNavigation\(\{\s*tab:\s*'client-thesis'\s*\}\)/);
    expect(code(REACT)).not.toMatch(/generateProposal:\s*true/);
    expect(code(REACT)).not.toMatch(/generateThesisProposal/);
    expect(code(REACT)).not.toMatch(/thesis-editor/);
    expect(code(REACT)).not.toMatch(/onboardingStatus:\s*'IN_PROGRESS'/);
    expect(code(REACT)).not.toMatch(/\bdbService\.updateClient\b/);
  });
});

describe('Phase 6 Onboarding cutover — retired extras and nonblocking debt', () => {
  it('does not recreate continue-later, auto-open, or auto-proposal in React', () => {
    const reactUi = collectTs(join(ROOT, 'src/ui')).filter((file) => {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      return !rel.startsWith('src/ui/legacy/');
    });
    const offenders: string[] = [];
    for (const file of reactUi) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const source = code(rel);
      if (
        /generateProposal:\s*true/.test(source) ||
        /generateThesisProposal/.test(source) ||
        /activeModal\s*=\s*['"]onboarding['"]/.test(source)
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('unreachable leftover opener debt remains uncleaned', () => {
    const handlers = code(HANDLERS);
    expect(handlers).toMatch(/#btn-open-onboarding,\s*\.btn-open-onboarding/);
    expect(handlers).toMatch(/activeModal = 'onboarding'/);
  });
});

describe('Phase 6 Onboarding cutover — Option-E / A38 / closed subsets', () => {
  it('creates no Onboarding exclusive slot, id, or new root', () => {
    const ids = listKnownReactExclusiveSlotIds();
    expect(ids).not.toContain('onboarding');
    expect(ids).not.toContain('client-onboarding-modal');
    expect(ids).not.toContain('client-profile-onboarding');
    expect(code(SLOTS)).not.toMatch(/onboarding/);
    expect(existsSync(join(ROOT, 'src/ui/presentation/onboardingSlot.ts'))).toBe(false);
  });

  it('closed subsets stay closed and Onboarding leftover is absent', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/MasterDossierPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/OpportunityPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/KpiWeeklyChart.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClientProfilePanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ProofWallPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClaimSafetyPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/PageHeader.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/SourceRegistryModal.ts'))).toBe(false);
  });
});
