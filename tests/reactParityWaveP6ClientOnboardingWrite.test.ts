/**
 * SPEC-010 · T603 React Parity Wave P6 — #10 ApplyOnboardingStep.
 *
 * Presentation parity only via frozen masterProfileCommands.applyOnboardingStep.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MasterProfileError,
  createApplyOnboardingStep,
  applyOnboardingStepToProfile,
  MASTER_ONBOARDING_STEP_COUNT,
  type MasterProfileRepository,
  type TrustedMasterProfileContext,
} from '../src/application/masterProfile';
import type { Client, ClientProfile } from '../src/types';

const applyCalls: {
  requestedClientId: string | null | undefined;
  step: number;
  fields: Record<string, string>;
}[] = [];

const notifyCalls: {
  clientId: string;
  type: string;
  title: string;
  body: string;
}[] = [];

let clearFlagCalls = 0;

let applyImpl:
  | ((intent: (typeof applyCalls)[number]) => {
      profile: { clientId: string };
      completed: boolean;
      step: number;
    })
  | null = null;

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => null,
    clearOnboardingFlag: () => {
      clearFlagCalls += 1;
    },
  },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/masterProfileConsumer', () => ({
  applyOnboardingStep: (intent: (typeof applyCalls)[number]) => {
    applyCalls.push(intent);
    if (applyImpl) return applyImpl(intent);
    return {
      profile: { clientId: intent.requestedClientId || 'client_a' },
      completed: intent.step === MASTER_ONBOARDING_STEP_COUNT,
      step: intent.step,
    };
  },
  setProofWallItemReadiness: vi.fn(),
}));

vi.mock('../src/services/notifications', () => ({
  notifyManager: (
    clientId: string,
    input: { type: string; title: string; body: string }
  ) => {
    notifyCalls.push({ clientId, ...input });
    return true;
  },
  notifyClient: vi.fn(),
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel);
}

function trusted(
  overrides: Partial<TrustedMasterProfileContext> = {}
): TrustedMasterProfileContext {
  return {
    actorId: 'client_user',
    actorRole: 'CLIENT',
    organizationId: 'org_a',
    clientId: 'client_a',
    now: '2026-09-08T12:00:00.000Z',
    ...overrides,
  };
}

function memoryRepo() {
  const clients = new Map<string, Client>();
  const profiles = new Map<string, ClientProfile>();
  clients.set('client_a', {
    id: 'client_a',
    organizationId: 'org_a',
    primaryManagerId: 'admin_01',
    firstName: 'Ana',
    lastName: 'Pérez',
    displayName: 'Ana Pérez',
    primaryEmail: 'ana@example.com',
    onboardingStatus: 'NOT_STARTED',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin_01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'admin_01',
    activeThesesCount: 0,
    completedTasksCount: 0,
  });
  const repo: MasterProfileRepository = {
    getProfile(clientId) {
      return profiles.get(clientId) ?? null;
    },
    saveProfile(profile) {
      profiles.set(profile.clientId, { ...profile });
    },
    getClient(clientId) {
      return clients.get(clientId);
    },
    updateClient(clientId, updates) {
      const c = clients.get(clientId);
      if (!c) return null;
      const next = { ...c, ...updates, updatedAt: '2026-09-08T12:01:00.000Z' };
      clients.set(clientId, next);
      return next;
    },
  };
  return { repo, clients, profiles };
}

const STEP_MATRIX: Array<{
  step: number;
  fields: Record<string, string>;
  assert: (profile: ClientProfile) => void;
}> = [
  {
    step: 1,
    fields: {
      displayName: 'Ana Pérez',
      profession: 'Abogada',
      role: 'Socia',
      company: 'Firma',
      selfDescription: 'IP counsel',
    },
    assert: (p) => {
      expect(p.career.profession).toBe('Abogada');
      expect(p.career.currentRole).toBe('Socia');
      expect(p.onboardingCurrentStep).toBe(1);
      expect(p.onboardingCompleted).toBe(false);
    },
  },
  {
    step: 2,
    fields: {
      primaryGoal: 'Conseguir nuevos clientes corporativos',
      secondaryGoals: 'Keynotes, paneles',
    },
    assert: (p) => {
      expect(p.goals.primaryGoal).toMatch(/clientes corporativos/);
      expect(p.onboardingCurrentStep).toBe(2);
    },
  },
  {
    step: 3,
    fields: {
      targetAudience: 'GCs de tech',
      industries: 'Legal, Tech',
      countries: 'MX, US',
    },
    assert: (p) => {
      expect(p.audience.targetAudienceDescription).toBe('GCs de tech');
      expect(p.onboardingCurrentStep).toBe(3);
    },
  },
  {
    step: 4,
    fields: {
      education: 'JD - Universidad\nLLM - Escuela',
      highlights: 'Caso emblemático\nPremio sectorial',
    },
    assert: (p) => {
      expect(p.education.length).toBeGreaterThan(0);
      expect(p.careerHistory.length).toBeGreaterThan(0);
      expect(p.onboardingCurrentStep).toBe(4);
    },
  },
  {
    step: 5,
    fields: {
      linkedin: 'https://linkedin.com/in/ana',
      website: 'https://ana.example',
    },
    assert: (p) => {
      expect(p.socialLinks.linkedin).toContain('linkedin');
      expect(p.onboardingCurrentStep).toBe(5);
    },
  },
  {
    step: 6,
    fields: {
      tone: 'authoritative',
      avoid: 'Hype, promesas',
      compliance: 'Ética profesional',
    },
    assert: (p) => {
      expect(p.voicePreferences.complianceGuidelines).toBe('Ética profesional');
      expect(p.onboardingCompleted).toBe(true);
      expect(p.onboardingCurrentStep).toBe(6);
    },
  },
];

beforeEach(() => {
  applyCalls.length = 0;
  notifyCalls.length = 0;
  clearFlagCalls = 0;
  applyImpl = null;
});

describe('P6 §9–§10 — command seam public input', () => {
  it('invokes ApplyOnboardingStep once with public input only', async () => {
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.applyOnboardingStep({
      requestedClientId: 'client_a',
      step: 1,
      fields: {
        displayName: 'Ana',
        profession: 'Abogada',
        role: 'Socia',
        company: 'Firma',
        selfDescription: 'IP',
      },
    });
    expect(result).toEqual({ ok: true, completed: false, step: 1, message: undefined });
    expect(applyCalls).toHaveLength(1);
    expect(applyCalls[0]).toEqual({
      requestedClientId: 'client_a',
      step: 1,
      fields: {
        displayName: 'Ana',
        profession: 'Abogada',
        role: 'Socia',
        company: 'Firma',
        selfDescription: 'IP',
      },
    });
    expect(JSON.stringify(applyCalls[0])).not.toMatch(/claimed|trusted|organizationId|actorRole/);
    expect(notifyCalls).toHaveLength(0);
    expect(clearFlagCalls).toBe(0);
  });

  it('final step returns completed and runs presentation notify + flag clear', async () => {
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.applyOnboardingStep({
      requestedClientId: 'client_a',
      step: 6,
      fields: { tone: 'academic', avoid: 'x', compliance: 'y' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.completed).toBe(true);
      expect(result.message).toMatch(/Onboarding completado/);
    }
    expect(applyCalls).toHaveLength(1);
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0]).toMatchObject({
      clientId: 'client_a',
      type: 'ONBOARDING',
      title: 'Perfil listo para revisión',
    });
    expect(clearFlagCalls).toBe(1);
  });

  it('surfaces consumer errors without silent success', async () => {
    applyImpl = () => {
      throw new MasterProfileError('INVALID_STEP', 'Onboarding step must be an integer from 1 to 6.');
    };
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    expect(
      masterProfileCommands.applyOnboardingStep({
        requestedClientId: 'client_a',
        step: 99,
        fields: {},
      })
    ).toEqual({
      ok: false,
      message: 'Onboarding step must be an integer from 1 to 6.',
    });
    expect(notifyCalls).toHaveLength(0);
  });

  it('seam TypeScript public intent omits claimed* and trusted authority', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    const block = seam.slice(
      seam.indexOf('export const masterProfileCommands'),
      seam.indexOf('export const thesisLifecycleCommands')
    );
    expect(block).toMatch(/requestedClientId/);
    expect(block).toMatch(/step: number/);
    expect(block).toMatch(/fields: Record<string, string>/);
    expect(block).not.toMatch(/claimedOrganizationId|claimedOnboardingStatus|trusted:/);
    expect(block).not.toMatch(/auditService/);
  });
});

describe('P6 §6–§7 / §21 — React surface authority guards', () => {
  it('wizard renders current step controls and enabled save', () => {
    const wizard = read('src/ui/modules/Onboarding/ReactOnboardingWizard.tsx');
    expect(wizard).toMatch(/react-onboarding-wizard/);
    expect(wizard).toMatch(/react-onboarding-save/);
    expect(wizard).not.toMatch(/react-onboarding-save-disabled/);
    expect(wizard).toMatch(/useApplyOnboardingStep/);
    expect(wizard).toMatch(/useOnboardingContext/);
    expect(wizard).toMatch(/suggestedStep/);
  });

  it('direct React dbService read/write = 0; no consumer import', () => {
    const wizard = code('src/ui/modules/Onboarding/ReactOnboardingWizard.tsx');
    const hooks = code('src/ui/hooks/useWave2Data.ts');
    expect(wizard).not.toMatch(/\bdbService\b/);
    expect(wizard).not.toMatch(/from\s+['"][^'"]*masterProfileConsumer['"]/);
    expect(wizard).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(hooks).toMatch(/masterProfileCommands\.applyOnboardingStep/);
    expect(hooks).toMatch(/invalidateQueries/);
    const applyHook = hooks.slice(
      hooks.indexOf('export function useApplyOnboardingStep'),
      hooks.indexOf('export function useProofWall')
    );
    expect(applyHook).not.toMatch(/\bdbService\b/);
  });

  it('maps presentation fields to frozen write keys before command', () => {
    const wizard = code('src/ui/modules/Onboarding/ReactOnboardingWizard.tsx');
    expect(wizard).toMatch(/role:\s*trim\('currentRole'\)/);
    expect(wizard).toMatch(/avoid:\s*trim\('topicsToAvoid'\)/);
    expect(wizard).toMatch(/compliance:\s*trim\('complianceGuidelines'\)/);
    expect(wizard).toMatch(/toCanonicalFields/);
  });

  it('post-complete hop is presentation navigation only — no #11/#12/#13', () => {
    const wizard = code('src/ui/modules/Onboarding/ReactOnboardingWizard.tsx');
    expect(wizard).toMatch(/publishShellNavigation\(\{\s*tab:\s*'client-thesis'\s*\}\)/);
    expect(wizard).not.toMatch(/\bsaveThesis\s*\(/);
    expect(wizard).not.toMatch(/\bactivateThesis\s*\(/);
    expect(wizard).not.toMatch(/\bdecideThesisClientReview\s*\(/);
    expect(wizard).not.toMatch(/generateProposal:\s*true/);
    expect(wizard).not.toMatch(/thesisLifecycleCommands/);
  });

  it('NO_CU profile CRUD calls = 0 on onboarding surface', () => {
    const wizard = code('src/ui/modules/Onboarding/ReactOnboardingWizard.tsx');
    expect(wizard).not.toMatch(
      /addProfileFact|confirmProfileFact|rejectProfileFact|updateProfileFact|importCandidateFactsFromCv|updateProofWallItem/
    );
  });

  it('legacy onboarding file is absent; leftover handlers remain as debt', () => {
    expect(existsSync(join(process.cwd(), 'src/components/OnboardingWizard.ts'))).toBe(false);
    const handlers = read('src/ui/legacy/handlers/onboardingHandlers.ts');
    expect(handlers).toMatch(/applyOnboardingStep\(/);
    expect(handlers).toMatch(/generateProposal:\s*true/);
  });

  it('ApplyOnboardingStep Application remains frozen (no notify/audit)', () => {
    const app = read('src/application/masterProfile/ApplyOnboardingStep.ts');
    expect(app).toMatch(/assertNoMasterProfileSpoof/);
    expect(app).not.toMatch(/notifyManager|notifyClient|auditService/);
    expect(app).not.toMatch(/claimedOnboardingStatus.*=.*COMPLETED/);
  });

  it('no new route / duplicate onboarding owner', () => {
    const shell = code('src/ui/modules/AppShell/ReactAppShell.tsx');
    const wave2 = code('src/ui/modules/wave2/Wave2Surface.tsx');
    expect(shell).toMatch(/'client-profile':\s*'profile'/);
    expect(wave2).toMatch(/ReactOnboardingWizard/);
    expect(shell).not.toMatch(/onboarding-route|\/onboarding/);
  });
});

describe('P6 §22 — step coverage matrix (every canonical step)', () => {
  it.each(STEP_MATRIX)('step $step fields + progression + command result', ({ step, fields, assert }) => {
    const result = applyOnboardingStepToProfile({
      existing: null,
      organizationId: 'org_a',
      clientId: 'client_a',
      step,
      fields,
      now: '2026-09-08T12:00:00.000Z',
      actorId: 'client_user',
    });
    expect(result.completed).toBe(step === 6);
    assert(result.profile);
  });
});

describe('P6 §14 / §23 — finalization semantics', () => {
  it('completion occurs only via step 6 ApplyOnboardingStep — no caller completion authority', () => {
    const { repo, clients } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    const completed = apply({
      trusted: trusted(),
      step: 6,
      fields: { tone: 'authoritative', avoid: 'x', compliance: 'y' },
    });
    expect(completed.completed).toBe(true);
    expect(completed.profile.onboardingCompleted).toBe(true);
    expect(clients.get('client_a')?.onboardingStatus).toBe('COMPLETED');
    expect(clients.get('client_a')?.status).toBe('ACTIVE');

    expect(() =>
      apply({
        trusted: trusted(),
        step: 6,
        fields: { tone: 'academic', avoid: 'z', compliance: 'w' },
        claimedOnboardingStatus: 'COMPLETED',
      })
    ).toThrow(/lifecycle\/onboarding state is not accepted/);

    expect(() =>
      apply({
        trusted: trusted(),
        step: 3,
        fields: { targetAudience: 'x', industries: 'y', countries: 'z' },
        claimedProfileCompleteness: 100,
      })
    ).toThrow(/profileCompleteness is not accepted/);
  });

  it('invalid step denied; missing client denied; cross-org denied', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    expect(() =>
      apply({ trusted: trusted(), step: 0, fields: {} })
    ).toThrow(/integer from 1 to 6/);
    expect(() =>
      apply({ trusted: trusted({ clientId: 'missing' }), step: 1, fields: { profession: 'X' } })
    ).toThrow(/Cliente no encontrado/);
    expect(() =>
      apply({
        trusted: trusted({ organizationId: 'org_other' }),
        step: 1,
        fields: { profession: 'X' },
      })
    ).toThrow(/organization does not match/);
  });

  it('repeat step 6 re-finalizes without inventing caller completion flag', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    apply({
      trusted: trusted(),
      step: 6,
      fields: { tone: 'authoritative', avoid: 'a', compliance: 'b' },
    });
    const again = apply({
      trusted: trusted(),
      step: 6,
      fields: { tone: 'conversational', avoid: 'c', compliance: 'd' },
    });
    expect(again.completed).toBe(true);
    expect(again.profile.voicePreferences.tone).toBe('conversational');
  });

  it('ADMIN with trusted client scope may apply; no role authority from caller payload', () => {
    const { repo } = memoryRepo();
    const apply = createApplyOnboardingStep({ profiles: repo });
    const result = apply({
      trusted: trusted({ actorId: 'admin_1', actorRole: 'ADMIN' }),
      step: 1,
      fields: {
        displayName: 'Ana',
        profession: 'Abogada',
        role: 'Socia',
        company: 'Firma',
        selfDescription: 'IP',
      },
    });
    expect(result.step).toBe(1);
    expect(result.completed).toBe(false);
  });
});

describe('P6 §3 — #10 canonical authority union', () => {
  it('owns save + advance step marker + finalize on step 6', () => {
    const logic = code('src/application/masterProfile/applyOnboardingStepLogic.ts');
    expect(logic).toMatch(/MASTER_ONBOARDING_STEP_COUNT = 6/);
    expect(logic).toMatch(/profile\.onboardingCurrentStep = step/);
    expect(logic).toMatch(/const completed = step === MASTER_ONBOARDING_STEP_COUNT/);
    expect(logic).toMatch(/onboardingCompleted = true/);
    expect(logic).toMatch(/onboardingStatus: 'COMPLETED'/);
  });
});
