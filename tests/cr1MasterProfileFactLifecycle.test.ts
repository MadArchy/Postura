/**
 * CR-1 Master Profile — canonical fact lifecycle (#2–#6).
 * Application authority only. No React, network, AI, or Firestore.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
});

import {
  CV_EXTRACTED_TEXT_MAX,
  MasterProfileError,
  createAddProfileFact,
  createConfirmProfileFact,
  createImportProfileFactsFromCv,
  createRejectProfileFact,
  createUpdateProfileFact,
  type MasterProfileRepository,
  type TrustedMasterProfileContext,
} from '../src/application/masterProfile';
import { extractCandidateFactsFromCv } from '../src/domain/cvExtract';
import { composeMasterProfile } from '../src/composition/masterProfile/composeMasterProfile';
import {
  addProfileFact,
  confirmProfileFact,
  importProfileFactsFromCv,
  resetMasterProfileConsumerForTest,
} from '../src/services/masterProfileConsumer';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';
import type { Client, ClientProfile, ProfileFact, User } from '../src/types';

const NOW = '2026-08-28T15:00:00.000Z';

function trusted(
  overrides: Partial<TrustedMasterProfileContext> = {}
): TrustedMasterProfileContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_trust',
    clientId: 'client_trust',
    now: NOW,
    ...overrides,
  };
}

function emptyProfile(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    organizationId: 'org_trust',
    clientId: 'client_trust',
    identity: {},
    goals: {},
    audience: {},
    career: {},
    education: [],
    careerHistory: [],
    ventures: [],
    keyPublications: [],
    socialLinks: {},
    voicePreferences: {
      tone: 'authoritative',
      preferredPhrases: [],
      topicsToAvoid: [],
      complianceGuidelines: '',
    },
    facts: [],
    onboardingCompleted: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fact(overrides: Partial<ProfileFact> = {}): ProfileFact {
  return {
    id: 'fact_existing',
    section: 'identity',
    label: 'Headline',
    value: 'Abogada IP',
    status: 'candidate',
    source: 'cv',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client_trust',
    organizationId: 'org_trust',
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
    ...overrides,
  };
}

function memoryRepo(options: { seedProfile?: boolean; profile?: ClientProfile } = {}) {
  const clients = new Map<string, Client>();
  const profiles = new Map<string, ClientProfile>();
  clients.set('client_trust', seedClient());
  if (options.seedProfile !== false) {
    profiles.set('client_trust', options.profile ?? emptyProfile());
  }

  const saveSpy = vi.fn();
  const repo: MasterProfileRepository = {
    getProfile(clientId) {
      return profiles.get(clientId) ?? null;
    },
    saveProfile(profile) {
      saveSpy(profile);
      profiles.set(profile.clientId, { ...profile });
    },
    getClient(clientId) {
      return clients.get(clientId);
    },
    updateClient(clientId, updates) {
      const c = clients.get(clientId);
      if (!c) return null;
      const next = { ...c, ...updates, updatedAt: NOW };
      clients.set(clientId, next);
      return next;
    },
  };

  return { repo, clients, profiles, saveSpy };
}

function expectCode(err: unknown, code: string) {
  expect(err).toBeInstanceOf(MasterProfileError);
  expect((err as MasterProfileError).code).toBe(code);
}

const SAMPLE_CV = `
Juan Vasquez
Member — Whitaker Chalk PLLC
J.D. St. Mary's University School of Law
B.S. Electrical Engineering — UT Austin
Chair, Emerging Technology Committee — State Bar of Texas
https://linkedin.com/in/juanjvasquez
`;

describe('AddProfileFact', () => {
  it('creates a confirmed manual fact and invokes saveProfile', () => {
    const { repo, profiles, saveSpy } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    const result = add({
      trusted: trusted(),
      section: 'career',
      label: '  Profesión  ',
      value: '  Abogada  ',
    });
    expect(result.fact.status).toBe('confirmed');
    expect(result.fact.source).toBe('manual');
    expect(result.fact.label).toBe('Profesión');
    expect(result.fact.value).toBe('Abogada');
    expect(result.fact.section).toBe('career');
    expect(result.fact.id.startsWith('fact_')).toBe(true);
    expect(result.fact.createdAt).toBe(NOW);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(profiles.get('client_trust')?.facts?.some((f) => f.id === result.fact.id)).toBe(true);
    expect(result.profile.facts?.some((f) => f.id === result.fact.id)).toBe(true);
  });

  it('denies empty label', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: '   ', value: 'X' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('denies empty value', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: '' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('denies invalid section', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted(),
        section: 'not-a-section' as never,
        label: 'L',
        value: 'V',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('fails when profile is missing', () => {
    const { repo } = memoryRepo({ seedProfile: false });
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: 'V' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PROFILE_NOT_FOUND');
    }
  });

  it('fails when client is missing', () => {
    const { repo, clients } = memoryRepo();
    clients.delete('client_trust');
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: 'V' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'CLIENT_NOT_FOUND');
    }
  });

  it('denies missing trusted actor', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted({ actorId: '' }),
        section: 'identity',
        label: 'L',
        value: 'V',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'ACTOR_NOT_AUTHORIZED');
    }
  });

  it('denies wrong organization', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted({ organizationId: 'org_other' }),
        section: 'identity',
        label: 'L',
        value: 'V',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('denies org spoof claim', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted(),
        section: 'identity',
        label: 'L',
        value: 'V',
        claimedOrganizationId: 'org_evil',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('denies client spoof claim', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted(),
        section: 'identity',
        label: 'L',
        value: 'V',
        claimedClientId: 'client_other',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('denies cross-client trusted target without that client', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted({ clientId: 'client_other' }),
        section: 'identity',
        label: 'L',
        value: 'V',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'CLIENT_NOT_FOUND');
    }
  });

  it('denies profile envelope mismatch', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ organizationId: 'org_other' }),
    });
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: 'V' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('wraps persistence failure', () => {
    const { repo } = memoryRepo();
    repo.saveProfile = () => {
      throw new Error('disk full');
    };
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: 'V' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PERSISTENCE_ERROR');
    }
  });

  it('caller cannot supply status or source — Application forces confirmed/manual', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    const result = add({
      trusted: trusted(),
      section: 'identity',
      label: 'L',
      value: 'V',
      ...({ status: 'candidate', source: 'cv' } as object),
    });
    expect(result.fact.status).toBe('confirmed');
    expect(result.fact.source).toBe('manual');
  });

  it('does not compute completeness in Application', () => {
    const source = readFileSync(resolve('src/application/masterProfile/AddProfileFact.ts'), 'utf8');
    expect(source).not.toMatch(/computeProfileCoverage|profileCompleteness/);
  });
});

describe('ConfirmProfileFact', () => {
  it('candidate → confirmed', () => {
    const { repo, profiles } = memoryRepo({
      profile: emptyProfile({ facts: [fact()] }),
    });
    const confirm = createConfirmProfileFact({ profiles: repo });
    const result = confirm({ trusted: trusted(), factId: 'fact_existing' });
    expect(result.fact.status).toBe('confirmed');
    expect(result.fact.source).toBe('cv');
    expect(profiles.get('client_trust')?.facts?.[0].status).toBe('confirmed');
  });

  it('confirmed → confirmed denied', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'confirmed' })] }),
    });
    const confirm = createConfirmProfileFact({ profiles: repo });
    try {
      confirm({ trusted: trusted(), factId: 'fact_existing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_FACT_STATE');
    }
  });

  it('rejected → confirmed denied (no reopen)', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'rejected' })] }),
    });
    const confirm = createConfirmProfileFact({ profiles: repo });
    try {
      confirm({ trusted: trusted(), factId: 'fact_existing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_FACT_STATE');
    }
  });

  it('missing fact fails', () => {
    const { repo } = memoryRepo();
    const confirm = createConfirmProfileFact({ profiles: repo });
    try {
      confirm({ trusted: trusted(), factId: 'fact_missing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'FACT_NOT_FOUND');
    }
  });

  it('empty factId is invalid input', () => {
    const { repo } = memoryRepo();
    const confirm = createConfirmProfileFact({ profiles: repo });
    try {
      confirm({ trusted: trusted(), factId: '  ' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('foreign profile fact fails', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ id: 'fact_local' })] }),
    });
    const confirm = createConfirmProfileFact({ profiles: repo });
    try {
      confirm({ trusted: trusted(), factId: 'fact_other_profile' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'FACT_NOT_FOUND');
    }
  });

  it('status cannot be caller-selected', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact()] }),
    });
    const confirm = createConfirmProfileFact({ profiles: repo });
    const result = confirm({
      trusted: trusted(),
      factId: 'fact_existing',
      ...({ status: 'rejected' } as object),
    });
    expect(result.fact.status).toBe('confirmed');
  });

  it('missing profile fails', () => {
    const { repo } = memoryRepo({ seedProfile: false });
    const confirm = createConfirmProfileFact({ profiles: repo });
    try {
      confirm({ trusted: trusted(), factId: 'fact_existing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PROFILE_NOT_FOUND');
    }
  });
});

describe('RejectProfileFact', () => {
  it('candidate → rejected and fact remains stored', () => {
    const { repo, profiles } = memoryRepo({
      profile: emptyProfile({ facts: [fact()] }),
    });
    const reject = createRejectProfileFact({ profiles: repo });
    const result = reject({ trusted: trusted(), factId: 'fact_existing' });
    expect(result.fact.status).toBe('rejected');
    expect(profiles.get('client_trust')?.facts).toHaveLength(1);
    expect(profiles.get('client_trust')?.facts?.[0].id).toBe('fact_existing');
  });

  it('confirmed → rejected denied', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'confirmed' })] }),
    });
    const reject = createRejectProfileFact({ profiles: repo });
    try {
      reject({ trusted: trusted(), factId: 'fact_existing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_FACT_STATE');
    }
  });

  it('rejected → rejected denied', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'rejected' })] }),
    });
    const reject = createRejectProfileFact({ profiles: repo });
    try {
      reject({ trusted: trusted(), factId: 'fact_existing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_FACT_STATE');
    }
  });

  it('missing fact fails', () => {
    const { repo } = memoryRepo();
    const reject = createRejectProfileFact({ profiles: repo });
    try {
      reject({ trusted: trusted(), factId: 'fact_missing' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'FACT_NOT_FOUND');
    }
  });
});

describe('UpdateProfileFact', () => {
  it('updates confirmed value only', () => {
    const original = fact({
      status: 'confirmed',
      source: 'manual',
      label: 'Headline',
      section: 'identity',
      value: 'Old',
    });
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [original] }),
    });
    const update = createUpdateProfileFact({ profiles: repo });
    const result = update({
      trusted: trusted(),
      factId: 'fact_existing',
      value: '  New value  ',
    });
    expect(result.fact.value).toBe('New value');
    expect(result.fact.label).toBe('Headline');
    expect(result.fact.status).toBe('confirmed');
    expect(result.fact.source).toBe('manual');
    expect(result.fact.section).toBe('identity');
    expect(result.fact.id).toBe('fact_existing');
    expect(result.fact.createdAt).toBe(original.createdAt);
    expect(result.profile.organizationId).toBe('org_trust');
    expect(result.profile.clientId).toBe('client_trust');
  });

  it('candidate denied', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'candidate' })] }),
    });
    const update = createUpdateProfileFact({ profiles: repo });
    try {
      update({ trusted: trusted(), factId: 'fact_existing', value: 'X' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_FACT_STATE');
    }
  });

  it('rejected denied', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'rejected' })] }),
    });
    const update = createUpdateProfileFact({ profiles: repo });
    try {
      update({ trusted: trusted(), factId: 'fact_existing', value: 'X' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_FACT_STATE');
    }
  });

  it('empty value denied', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ facts: [fact({ status: 'confirmed' })] }),
    });
    const update = createUpdateProfileFact({ profiles: repo });
    try {
      update({ trusted: trusted(), factId: 'fact_existing', value: '   ' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('missing fact fails', () => {
    const { repo } = memoryRepo();
    const update = createUpdateProfileFact({ profiles: repo });
    try {
      update({ trusted: trusted(), factId: 'fact_missing', value: 'X' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'FACT_NOT_FOUND');
    }
  });

  it('supplied label/status/source fields cannot mutate authority', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({
        facts: [fact({ status: 'confirmed', source: 'manual', label: 'Keep' })],
      }),
    });
    const update = createUpdateProfileFact({ profiles: repo });
    const result = update({
      trusted: trusted(),
      factId: 'fact_existing',
      value: 'Changed',
      ...({ label: 'Hacked', status: 'rejected', source: 'cv', section: 'career' } as object),
    });
    expect(result.fact.label).toBe('Keep');
    expect(result.fact.status).toBe('confirmed');
    expect(result.fact.source).toBe('manual');
    expect(result.fact.section).toBe('identity');
  });
});

describe('ImportProfileFactsFromCv', () => {
  it('imports candidate/cv facts via existing Domain extractor', () => {
    const { repo, profiles } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    const domain = extractCandidateFactsFromCv(SAMPLE_CV);
    const result = importCv({ trusted: trusted(), cvText: SAMPLE_CV });
    expect(result.importedCount).toBe(domain.length);
    expect(result.facts.every((f) => f.status === 'candidate')).toBe(true);
    expect(result.facts.every((f) => f.source === 'cv')).toBe(true);
    expect(profiles.get('client_trust')?.facts?.length).toBe(result.importedCount);
    expect(profiles.get('client_trust')?.cvExtractedText).toBe(SAMPLE_CV);
  });

  it('denies empty/whitespace CV', () => {
    const { repo } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    try {
      importCv({ trusted: trusted(), cvText: '   \n  ' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('missing profile fails (not importedCount 0)', () => {
    const { repo } = memoryRepo({ seedProfile: false });
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    try {
      importCv({ trusted: trusted(), cvText: SAMPLE_CV });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PROFILE_NOT_FOUND');
    }
  });

  it('dedups existing profile values case-insensitively', () => {
    const domain = extractCandidateFactsFromCv(SAMPLE_CV);
    const existingValue = domain[0].value;
    const blocked = existingValue.toLowerCase();
    const expectedNovel = domain.filter((row) => row.value.toLowerCase() !== blocked).length;
    const { repo } = memoryRepo({
      profile: emptyProfile({
        facts: [fact({ id: 'fact_dup', value: existingValue.toUpperCase(), status: 'confirmed' })],
      }),
    });
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    const result = importCv({ trusted: trusted(), cvText: SAMPLE_CV });
    expect(result.importedCount).toBe(expectedNovel);
    expect(result.facts.every((f) => f.value.toLowerCase() !== blocked)).toBe(true);
  });

  it('dedups repeated import', () => {
    const { repo } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    const first = importCv({ trusted: trusted(), cvText: SAMPLE_CV });
    const second = importCv({ trusted: trusted(), cvText: SAMPLE_CV });
    expect(first.importedCount).toBeGreaterThan(0);
    expect(second.importedCount).toBe(0);
  });

  it('preserves Domain max extracted fact cap', () => {
    const lines = Array.from({ length: 80 }, (_, i) => `Candidate professional line number ${i + 1} xx`);
    const text = lines.join('\n');
    const domain = extractCandidateFactsFromCv(text);
    const { repo } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    const result = importCv({ trusted: trusted(), cvText: text });
    expect(result.importedCount).toBe(domain.length);
    expect(result.importedCount).toBeLessThanOrEqual(24);
  });

  it('stores cvExtractedText at most 12000 characters', () => {
    const huge = `${'Professional experience line long enough. '.repeat(400)}\n${SAMPLE_CV}`;
    expect(huge.length).toBeGreaterThan(CV_EXTRACTED_TEXT_MAX);
    const { repo, profiles } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    importCv({ trusted: trusted(), cvText: huge });
    expect(profiles.get('client_trust')?.cvExtractedText?.length).toBeLessThanOrEqual(12000);
  });

  it('PII remains on the trusted client profile only', () => {
    const { repo, profiles, clients } = memoryRepo();
    clients.set('client_other', seedClient({ id: 'client_other' }));
    profiles.set('client_other', emptyProfile({ clientId: 'client_other' }));
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    importCv({ trusted: trusted(), cvText: SAMPLE_CV });
    expect(profiles.get('client_trust')?.cvExtractedText).toContain('Juan');
    expect(profiles.get('client_other')?.cvExtractedText).toBeUndefined();
    expect(profiles.get('client_other')?.facts).toEqual([]);
  });

  it('cross-client trusted target denied', () => {
    const { repo } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    try {
      importCv({ trusted: trusted({ clientId: 'client_other' }), cvText: SAMPLE_CV });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'CLIENT_NOT_FOUND');
    }
  });

  it('importedCount equals novel facts only', () => {
    const { repo } = memoryRepo();
    const importCv = createImportProfileFactsFromCv({ profiles: repo });
    const result = importCv({ trusted: trusted(), cvText: SAMPLE_CV });
    expect(result.importedCount).toBe(result.facts.length);
    expect(result.profile.facts?.filter((f) => f.source === 'cv').length).toBe(result.importedCount);
  });
});

describe('Fact lifecycle security', () => {
  it('ADMIN may act on chosen client in trusted organization', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    const result = add({
      trusted: trusted({ actorRole: 'ADMIN' }),
      section: 'identity',
      label: 'L',
      value: 'V',
    });
    expect(result.fact.status).toBe('confirmed');
  });

  it('CLIENT may act on own trusted client', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    const result = add({
      trusted: trusted({ actorRole: 'CLIENT', actorId: 'client_user' }),
      section: 'identity',
      label: 'L',
      value: 'V',
    });
    expect(result.fact.status).toBe('confirmed');
  });

  it('organization mismatch fails closed', () => {
    const { repo, clients } = memoryRepo();
    clients.set('client_trust', seedClient({ organizationId: 'org_other' }));
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: 'V' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('profile client envelope mismatch fails closed', () => {
    const { repo } = memoryRepo({
      profile: emptyProfile({ clientId: 'client_other' }),
    });
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({ trusted: trusted(), section: 'identity', label: 'L', value: 'V' });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('missing trusted org/client is tenant invalid', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    try {
      add({
        trusted: trusted({ organizationId: '', clientId: '' }),
        section: 'identity',
        label: 'L',
        value: 'V',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
  });

  it('caller role spoof field has no authority', () => {
    const { repo } = memoryRepo();
    const add = createAddProfileFact({ profiles: repo });
    const result = add({
      trusted: trusted({ actorRole: 'CLIENT' }),
      section: 'identity',
      label: 'L',
      value: 'V',
      ...({ actorRole: 'ADMIN', role: 'ADMIN' } as object),
    });
    expect(result.fact.source).toBe('manual');
  });
});

describe('Master Profile fact consumer tenant gate', () => {
  beforeEach(() => {
    resetMasterProfileConsumerForTest();
    vi.restoreAllMocks();
  });

  function admin(): User {
    return {
      uid: 'u_admin',
      email: 'admin@x.com',
      displayName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: 'org_from_session',
      clientId: null,
      mustCompleteOnboarding: false,
      aiKeyManagementAllowed: false,
      locale: 'es',
      timezone: 'UTC',
    };
  }

  it('denies missing session', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      addProfileFact({
        requestedClientId: 'any',
        section: 'identity',
        label: 'L',
        value: 'V',
      })
    ).toThrow(MasterProfileError);
  });

  it('CLIENT may not act on another client', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...admin(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: 'client_own',
      organizationId: 'org_from_session',
    });
    expect(() =>
      confirmProfileFact({
        requestedClientId: 'client_other',
        factId: 'fact_x',
      })
    ).toThrow(MasterProfileError);
  });

  it('ADMIN may add a fact on a chosen org client that already has a profile', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin());
    const created = dbService.createClient({
      organizationId: 'org_from_session',
      primaryManagerId: 'u_admin',
      firstName: 'Luis',
      lastName: 'Gómez',
      displayName: 'Luis Gómez',
      primaryEmail: `luis_fact_${Date.now()}@example.com`,
      onboardingStatus: 'NOT_STARTED',
      profileCompleteness: 15,
      status: 'INVITED',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    dbService.saveMasterProfile(emptyProfile({ organizationId: 'org_from_session', clientId: created.id }));
    const result = addProfileFact({
      requestedClientId: created.id,
      section: 'identity',
      label: 'Headline',
      value: 'Consultor',
    });
    expect(result.fact.status).toBe('confirmed');
    expect(result.profile.clientId).toBe(created.id);
    expect(dbService.getMasterProfile(created.id)?.facts?.some((f) => f.id === result.fact.id)).toBe(
      true
    );
  });

  it('CLIENT may import CV onto own profile', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...admin(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: 'client_own_cv',
      organizationId: 'org_from_session',
    });
    const created = dbService.createClient({
      organizationId: 'org_from_session',
      primaryManagerId: 'u_admin',
      firstName: 'Own',
      lastName: 'Client',
      displayName: 'Own Client',
      primaryEmail: `own_cv_${Date.now()}@example.com`,
      onboardingStatus: 'NOT_STARTED',
      profileCompleteness: 15,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    Object.defineProperty(created, 'id', { value: created.id });
    dbService.saveMasterProfile(
      emptyProfile({ organizationId: 'org_from_session', clientId: created.id })
    );
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...admin(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: created.id,
      organizationId: 'org_from_session',
    });
    const result = importProfileFactsFromCv({
      requestedClientId: created.id,
      cvText: SAMPLE_CV,
    });
    expect(result.importedCount).toBeGreaterThan(0);
    expect(result.facts.every((f) => f.status === 'candidate')).toBe(true);
  });
});

describe('Fact lifecycle architecture boundary', () => {
  const commandFiles = [
    'src/application/masterProfile/AddProfileFact.ts',
    'src/application/masterProfile/ConfirmProfileFact.ts',
    'src/application/masterProfile/RejectProfileFact.ts',
    'src/application/masterProfile/UpdateProfileFact.ts',
    'src/application/masterProfile/ImportProfileFactsFromCv.ts',
    'src/application/masterProfile/profileFactAuthority.ts',
  ];

  it('compose exposes the five fact commands', () => {
    const composed = composeMasterProfile();
    expect(typeof composed.addProfileFact).toBe('function');
    expect(typeof composed.confirmProfileFact).toBe('function');
    expect(typeof composed.rejectProfileFact).toBe('function');
    expect(typeof composed.updateProfileFact).toBe('function');
    expect(typeof composed.importProfileFactsFromCv).toBe('function');
  });

  it('Application does not call dbService or invent Domain transitions', () => {
    for (const file of commandFiles) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/dbService/);
      expect(source).not.toMatch(
        /dbService\.(addProfileFact|confirmProfileFact|rejectProfileFact|updateProfileFact|importCandidateFactsFromCv)/
      );
      expect(source).not.toMatch(/computeProfileCoverage/);
    }
  });

  it('CV import reuses Domain extractor and has no AI/network', () => {
    const source = readFileSync(
      resolve('src/application/masterProfile/ImportProfileFactsFromCv.ts'),
      'utf8'
    );
    expect(source).toMatch(/extractCandidateFactsFromCv/);
    expect(source).not.toMatch(/openai|anthropic|aiService|fetch\(|XMLHttpRequest|WebSocket/i);
  });

  it('does not invent fact-lifecycle audit event names', () => {
    const consumer = readFileSync(resolve('src/services/masterProfileConsumer.ts'), 'utf8');
    expect(consumer.match(/auditService\.log/g)?.length).toBe(2);
    expect(consumer).toMatch(/ONBOARDING_STEP_COMPLETED/);
    expect(consumer).toMatch(/addProfileFact/);
    expect(consumer).toMatch(/importProfileFactsFromCv/);
  });

  it('does not misuse INVALID_STEP', () => {
    for (const file of commandFiles) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/INVALID_STEP/);
    }
  });
});
