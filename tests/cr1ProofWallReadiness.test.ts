/**
 * CR-1 Master Profile — canonical ProofWall readiness (#7).
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
  MasterProfileError,
  createSetProofWallItemReadiness,
  type MasterProfileRepository,
  type ProofWallItemRepository,
  type TrustedMasterProfileContext,
} from '../src/application/masterProfile';
import { composeMasterProfile } from '../src/composition/masterProfile/composeMasterProfile';
import {
  resetMasterProfileConsumerForTest,
  setProofWallItemReadiness,
} from '../src/services/masterProfileConsumer';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';
import type { Client, ClientProfile, ProofWallItem, User } from '../src/types';

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
    profileCompleteness: 40,
    ...overrides,
  };
}

function wallItem(overrides: Partial<ProofWallItem> = {}): ProofWallItem {
  return {
    id: 'pw_trust',
    organizationId: 'org_trust',
    clientId: 'client_trust',
    category: 'publications',
    title: 'Portada del libro',
    description: 'Enlace de compra',
    status: 'pending',
    evidenceId: 'ev_003',
    sortOrder: 1,
    ...overrides,
  };
}

function memoryHarness(options: {
  seedClient?: boolean;
  seedItem?: boolean;
  item?: ProofWallItem;
  client?: Client;
} = {}) {
  const clients = new Map<string, Client>();
  const items = new Map<string, ProofWallItem>();
  const profiles = new Map<string, ClientProfile>();
  if (options.seedClient !== false) {
    const client = options.client ?? seedClient();
    clients.set(client.id, client);
  }
  if (options.seedItem !== false) {
    const item = options.item ?? wallItem();
    items.set(item.id, item);
  }

  const saveProfile = vi.fn();
  const updateClient = vi.fn();
  const getItem = vi.fn((itemId: string) => items.get(itemId) ?? null);
  const saveItem = vi.fn((item: ProofWallItem) => {
    items.set(item.id, { ...item });
  });
  const authorizePublication = vi.fn();
  const verifyClaim = vi.fn();
  const mutateVault = vi.fn();

  const profilesRepo: MasterProfileRepository = {
    getProfile(clientId) {
      return profiles.get(clientId) ?? null;
    },
    saveProfile(profile) {
      saveProfile(profile);
      profiles.set(profile.clientId, { ...profile });
    },
    getClient(clientId) {
      return clients.get(clientId);
    },
    updateClient(clientId, updates) {
      updateClient(clientId, updates);
      const current = clients.get(clientId);
      if (!current) return null;
      const next = { ...current, ...updates };
      clients.set(clientId, next);
      return next;
    },
  };

  const proofWall: ProofWallItemRepository = {
    getProofWallItem: getItem,
    saveProofWallItem: saveItem,
  };

  const setReadiness = createSetProofWallItemReadiness({
    profiles: profilesRepo,
    proofWall,
  });

  return {
    setReadiness,
    clients,
    items,
    profiles,
    saveProfile,
    updateClient,
    getItem,
    saveItem,
    authorizePublication,
    verifyClaim,
    mutateVault,
    profilesRepo,
    proofWall,
  };
}

function expectCode(err: unknown, code: string) {
  expect(err).toBeInstanceOf(MasterProfileError);
  expect((err as MasterProfileError).code).toBe(code);
}

function admin(overrides: Partial<User> = {}): User {
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
    ...overrides,
  };
}

describe('SetProofWallItemReadiness', () => {
  it('ADMIN pending → complete succeeds and mutates status only', () => {
    const { setReadiness, items, saveItem, saveProfile, updateClient } = memoryHarness({
      item: wallItem({ status: 'pending' }),
    });
    const result = setReadiness({
      trusted: trusted(),
      proofWallItemId: 'pw_trust',
      targetStatus: 'complete',
    });
    expect(result.item.status).toBe('complete');
    expect(result.item.evidenceId).toBe('ev_003');
    expect(result.item.title).toBe('Portada del libro');
    expect(result.item.sortOrder).toBe(1);
    expect(items.get('pw_trust')?.status).toBe('complete');
    expect(saveItem).toHaveBeenCalledTimes(1);
    expect(saveProfile).not.toHaveBeenCalled();
    expect(updateClient).not.toHaveBeenCalled();
  });

  it('ADMIN complete → pending succeeds', () => {
    const { setReadiness } = memoryHarness({
      item: wallItem({ status: 'complete' }),
    });
    const result = setReadiness({
      trusted: trusted(),
      proofWallItemId: 'pw_trust',
      targetStatus: 'pending',
    });
    expect(result.item.status).toBe('pending');
  });

  it('invalid target fails without coercion', () => {
    const { setReadiness, saveItem } = memoryHarness();
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'ready' as 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('rejects empty proofWallItemId', () => {
    const { setReadiness } = memoryHarness();
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: '   ',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_INPUT');
    }
  });

  it('same-state pending → pending succeeds idempotently', () => {
    const { setReadiness, saveItem } = memoryHarness({
      item: wallItem({ status: 'pending' }),
    });
    const result = setReadiness({
      trusted: trusted(),
      proofWallItemId: 'pw_trust',
      targetStatus: 'pending',
    });
    expect(result.item.status).toBe('pending');
    expect(saveItem).toHaveBeenCalledTimes(1);
  });

  it('same-state complete → complete succeeds idempotently', () => {
    const { setReadiness } = memoryHarness({
      item: wallItem({ status: 'complete' }),
    });
    const result = setReadiness({
      trusted: trusted(),
      proofWallItemId: 'pw_trust',
      targetStatus: 'complete',
    });
    expect(result.item.status).toBe('complete');
  });

  it('CLIENT actor is denied even on own client', () => {
    const { setReadiness, saveItem } = memoryHarness();
    try {
      setReadiness({
        trusted: trusted({ actorRole: 'CLIENT', actorId: 'client_user' }),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'ACTOR_NOT_AUTHORIZED');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('wrong organization fails closed', () => {
    const { setReadiness, saveItem } = memoryHarness({
      client: seedClient({ organizationId: 'org_other' }),
    });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('wrong client fails closed', () => {
    const { setReadiness, saveItem } = memoryHarness({
      item: wallItem({ clientId: 'client_other' }),
    });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('item organization mismatch fails closed', () => {
    const { setReadiness, saveItem } = memoryHarness({
      item: wallItem({ organizationId: 'org_other' }),
    });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('missing client fails closed', () => {
    const { setReadiness } = memoryHarness({ seedClient: false });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'CLIENT_NOT_FOUND');
    }
  });

  it('missing item fails closed', () => {
    const { setReadiness } = memoryHarness({ seedItem: false });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_missing',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PROOF_WALL_ITEM_NOT_FOUND');
    }
  });

  it('foreign item fails closed without success', () => {
    const { setReadiness, saveItem } = memoryHarness({
      item: wallItem({
        id: 'pw_foreign',
        organizationId: 'org_foreign',
        clientId: 'client_foreign',
      }),
    });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_foreign',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('cross-client fail-closed when trusted client is not the item client', () => {
    const { setReadiness, clients, saveItem } = memoryHarness({
      item: wallItem({ clientId: 'client_other', organizationId: 'org_trust' }),
    });
    clients.set('client_other', seedClient({ id: 'client_other' }));
    try {
      setReadiness({
        trusted: trusted({ clientId: 'client_trust' }),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('unknown persisted status fails closed', () => {
    const { setReadiness, saveItem } = memoryHarness({
      item: wallItem({ status: 'ready' as ProofWallItem['status'] }),
    });
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'INVALID_PROOF_WALL_STATE');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('persistence load failure maps to PERSISTENCE_ERROR', () => {
    const { setReadiness, proofWall, profilesRepo } = memoryHarness();
    proofWall.getProofWallItem = () => {
      throw new Error('disk down');
    };
    const run = createSetProofWallItemReadiness({
      profiles: profilesRepo,
      proofWall,
    });
    try {
      run({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PERSISTENCE_ERROR');
    }
    expect(setReadiness).toBeTypeOf('function');
  });

  it('persistence save failure maps to PERSISTENCE_ERROR', () => {
    const { proofWall, profilesRepo } = memoryHarness();
    proofWall.saveProofWallItem = () => {
      throw new Error('write failed');
    };
    const run = createSetProofWallItemReadiness({
      profiles: profilesRepo,
      proofWall,
    });
    try {
      run({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'PERSISTENCE_ERROR');
    }
  });

  it('missing Master Profile does not independently block readiness', () => {
    const { setReadiness, profiles } = memoryHarness();
    expect(profiles.size).toBe(0);
    const result = setReadiness({
      trusted: trusted(),
      proofWallItemId: 'pw_trust',
      targetStatus: 'complete',
    });
    expect(result.item.status).toBe('complete');
  });

  it('caller cannot spoof organization or client', () => {
    const { setReadiness, saveItem } = memoryHarness();
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
        claimedOrganizationId: 'org_spoof',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    try {
      setReadiness({
        trusted: trusted(),
        proofWallItemId: 'pw_trust',
        targetStatus: 'complete',
        claimedClientId: 'client_spoof',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'TENANT_CONTEXT_INVALID');
    }
    expect(saveItem).not.toHaveBeenCalled();
  });

  it('publication, verification, and vault remain untouched', () => {
    const harness = memoryHarness({ item: wallItem({ status: 'pending', evidenceId: 'ev_003' }) });
    const before = { ...harness.items.get('pw_trust')! };
    const result = harness.setReadiness({
      trusted: trusted(),
      proofWallItemId: 'pw_trust',
      targetStatus: 'complete',
    });
    expect(harness.authorizePublication).not.toHaveBeenCalled();
    expect(harness.verifyClaim).not.toHaveBeenCalled();
    expect(harness.mutateVault).not.toHaveBeenCalled();
    expect(result.item.evidenceId).toBe(before.evidenceId);
    expect(result.item.category).toBe(before.category);
    expect(result.item.sortOrder).toBe(before.sortOrder);
    expect(result.item).not.toHaveProperty('verified');
    expect(result.item).not.toHaveProperty('published');
    expect(result.item).not.toHaveProperty('publicationStatus');
  });
});

describe('ProofWall readiness consumer', () => {
  beforeEach(() => {
    resetMasterProfileConsumerForTest();
    vi.restoreAllMocks();
  });

  it('ADMIN may set readiness on a chosen organization client item', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin());
    const created = dbService.createClient({
      organizationId: 'org_from_session',
      primaryManagerId: 'u_admin',
      firstName: 'Luis',
      lastName: 'Gómez',
      displayName: 'Luis Gómez',
      primaryEmail: `luis_pw_${Date.now()}@example.com`,
      onboardingStatus: 'NOT_STARTED',
      profileCompleteness: 15,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const item = wallItem({
      id: 'pw_consumer_admin',
      organizationId: 'org_from_session',
      clientId: created.id,
      status: 'pending',
    });
    const harness = memoryHarness({
      client: seedClient({ id: created.id, organizationId: 'org_from_session' }),
      item,
    });
    resetMasterProfileConsumerForTest(
      composeMasterProfile({ profiles: harness.profilesRepo, proofWall: harness.proofWall })
    );
    const result = setProofWallItemReadiness({
      requestedClientId: created.id,
      proofWallItemId: item.id,
      targetStatus: 'complete',
    });
    expect(result.item.status).toBe('complete');
    expect(harness.items.get(item.id)?.status).toBe('complete');
  });

  it('CLIENT cannot mutate own item through the consumer', () => {
    const created = dbService.createClient({
      organizationId: 'org_from_session',
      primaryManagerId: 'u_admin',
      firstName: 'Own',
      lastName: 'Client',
      displayName: 'Own Client',
      primaryEmail: `own_pw_${Date.now()}@example.com`,
      onboardingStatus: 'NOT_STARTED',
      profileCompleteness: 15,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const item = wallItem({
      id: 'pw_consumer_client',
      organizationId: 'org_from_session',
      clientId: created.id,
      status: 'pending',
    });
    const harness = memoryHarness({
      client: seedClient({ id: created.id, organizationId: 'org_from_session' }),
      item,
    });
    resetMasterProfileConsumerForTest(
      composeMasterProfile({ profiles: harness.profilesRepo, proofWall: harness.proofWall })
    );
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...admin(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: created.id,
      organizationId: 'org_from_session',
    });
    try {
      setProofWallItemReadiness({
        requestedClientId: created.id,
        proofWallItemId: item.id,
        targetStatus: 'complete',
      });
      throw new Error('expected throw');
    } catch (err) {
      expectCode(err, 'ACTOR_NOT_AUTHORIZED');
    }
    expect(harness.items.get(item.id)?.status).toBe('pending');
  });

  it('CLIENT cannot mutate a foreign item', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      ...admin(),
      uid: 'u_client',
      role: 'CLIENT',
      clientId: 'client_own_only',
      organizationId: 'org_from_session',
    });
    expect(() =>
      setProofWallItemReadiness({
        requestedClientId: 'client_other',
        proofWallItemId: 'pw_x',
        targetStatus: 'complete',
      })
    ).toThrow(MasterProfileError);
  });
});

describe('ProofWall readiness architecture boundary', () => {
  const commandFiles = [
    'src/application/masterProfile/SetProofWallItemReadiness.ts',
    'src/application/masterProfile/proofWallReadinessAuthority.ts',
    'src/application/masterProfile/ports/ProofWallItemRepository.ts',
  ];

  it('compose exposes SetProofWallItemReadiness', () => {
    expect(typeof composeMasterProfile().setProofWallItemReadiness).toBe('function');
  });

  it('Application uses the narrow load/save port and never dbService', () => {
    for (const file of commandFiles) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).not.toMatch(/dbService/);
      expect(source).not.toMatch(/updateProofWallItem/);
      expect(source).not.toMatch(/saveProfile/);
      expect(source).not.toMatch(/AuthorizePublication|VerifyClaim|addEvidenceItem|evidenceVault/);
      expect(source).not.toMatch(/FACT_NOT_FOUND|INVALID_FACT_STATE|PROFILE_NOT_FOUND/);
    }
    const port = readFileSync(
      resolve('src/application/masterProfile/ports/ProofWallItemRepository.ts'),
      'utf8'
    );
    expect(port).toMatch(/getProofWallItem/);
    expect(port).toMatch(/saveProofWallItem/);
    expect(port).not.toMatch(/updateProofWallItem/);
  });

  it('makes no SPEC-006 publication or verification call', () => {
    const source = [
      ...commandFiles,
      'src/composition/masterProfile/composeMasterProfile.ts',
      'src/infrastructure/masterProfile/DbProofWallItemAdapter.ts',
    ]
      .map((file) => readFileSync(resolve(file), 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/createAuthorizePublication|createVerifyClaim|LinkEvidenceToClaim/);
  });

  it('does not invent a ProofWall audit event name', () => {
    const consumer = readFileSync(resolve('src/services/masterProfileConsumer.ts'), 'utf8');
    expect(consumer.match(/auditService\.log/g)?.length).toBe(2);
    expect(consumer).toMatch(/setProofWallItemReadiness/);
    expect(consumer).toMatch(/No invented audit event/);
  });

  it('legacy updateProofWallItem remains unchanged', () => {
    const source = readFileSync(resolve('src/services/db.ts'), 'utf8');
    expect(source).toMatch(
      /public updateProofWallItem\(itemId: string, status: ProofWallItem\['status'\]\): boolean/
    );
    expect(source).toMatch(/if \(!item\) return false;/);
    expect(source).toMatch(/item\.status = status;/);
  });
});
