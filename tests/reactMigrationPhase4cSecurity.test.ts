import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  requireAdminActor,
  requireTenantScope,
  type TenantGateDeps,
} from '../src/controllers/trustedTenant';
import type { Client, User, UserRole } from '../src/types';

/**
 * SPEC-010 Phase 4C — AUDIT010-10 / AUDIT010-11 remediation evidence.
 *
 * The point of these tests is adversarial: every case below models a caller
 * proposing a tenant it should not get, and asserts the gate refuses. A test
 * that only proves the happy path would not distinguish this remediation from
 * the DOM-derived behaviour it replaces.
 */

const ORG_A = 'org_a';
const ORG_B = 'org_b';

/** Strips comments so that a doc comment describing a defect never satisfies
 *  an assertion about the code that was supposed to remove it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function user(overrides: Partial<User> & { role: UserRole }): User {
  return {
    uid: 'user_1',
    organizationId: ORG_A,
    email: 'a@example.com',
    displayName: 'A',
    status: 'ACTIVE',
    clientId: null,
    mustCompleteOnboarding: false,
    aiKeyManagementAllowed: false,
    locale: 'es',
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

function client(id: string, organizationId: string): Client {
  return {
    id,
    organizationId,
    primaryManagerId: 'user_1',
    firstName: 'C',
    lastName: 'L',
    displayName: 'C L',
    primaryEmail: 'c@example.com',
    onboardingStatus: 'COMPLETED',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user_1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'user_1',
    activeThesesCount: 0,
    completedTasksCount: 0,
  } as Client;
}

function deps(current: User | null, clients: Client[] = []): TenantGateDeps {
  return {
    getCurrentUser: () => current,
    getClientById: (id) => clients.find((c) => c.id === id),
  };
}

const CLIENT_A1 = client('client_a1', ORG_A);
const CLIENT_A2 = client('client_a2', ORG_A);
const CLIENT_B1 = client('client_b1', ORG_B);
const ALL = [CLIENT_A1, CLIENT_A2, CLIENT_B1];

describe('AUDIT010-10 — the gate fails closed without a trusted session', () => {
  it('refuses when there is no session at all', () => {
    const d = requireTenantScope('client_a1', deps(null, ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_SESSION');
  });

  it('refuses when the session carries no organizationId', () => {
    const d = requireTenantScope('client_a1', deps(user({ role: 'ADMIN', organizationId: '' }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_TRUSTED_ORG');
  });

  it('refuses a whitespace-only organizationId rather than trimming into a grant', () => {
    const d = requireTenantScope('client_a1', deps(user({ role: 'ADMIN', organizationId: '   ' }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_TRUSTED_ORG');
  });
});

describe('AUDIT010-10 — a DOM-injected client id cannot redirect an effect', () => {
  it('refuses a CLIENT actor asking for somebody else’s tenant', () => {
    const actor = user({ role: 'CLIENT', clientId: 'client_a1' });
    const d = requireTenantScope('client_a2', deps(actor, ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('CLIENT_SCOPE_VIOLATION');
  });

  it('pins a CLIENT actor to its own tenant when nothing is proposed', () => {
    const actor = user({ role: 'CLIENT', clientId: 'client_a1' });
    const d = requireTenantScope(null, deps(actor, ALL));
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.clientId).toBe('client_a1');
  });

  it('ignores a matching proposal rather than trusting it — same result either way', () => {
    const actor = user({ role: 'CLIENT', clientId: 'client_a1' });
    const proposed = requireTenantScope('client_a1', deps(actor, ALL));
    const bare = requireTenantScope(undefined, deps(actor, ALL));
    expect(proposed).toEqual(bare);
  });

  it('refuses a CLIENT actor with no tenant of its own', () => {
    const d = requireTenantScope('client_a1', deps(user({ role: 'CLIENT', clientId: null }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_CLIENT_SCOPE');
  });

  it('refuses a CLIENT actor whose own tenant is blank', () => {
    const d = requireTenantScope(null, deps(user({ role: 'CLIENT', clientId: '  ' }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_CLIENT_SCOPE');
  });
});

describe('AUDIT010-10 — cross-organization safety for an ADMIN actor', () => {
  it('refuses a client belonging to another organization', () => {
    const d = requireTenantScope('client_b1', deps(user({ role: 'ADMIN' }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('CROSS_ORG');
  });

  it('refuses a client id that does not exist', () => {
    const d = requireTenantScope('client_nope', deps(user({ role: 'ADMIN' }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('UNKNOWN_CLIENT');
  });

  it('grants a same-organization client', () => {
    const d = requireTenantScope('client_a2', deps(user({ role: 'ADMIN' }), ALL));
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.clientId).toBe('client_a2');
      expect(d.organizationId).toBe(ORG_A);
    }
  });

  it('takes the organization from the session, never from the client record', () => {
    // A client record claiming the actor's org while sitting under another one
    // must not be able to launder itself through the grant.
    const spoofed = { ...client('client_x', ORG_A) };
    const actor = user({ role: 'ADMIN', organizationId: ORG_B });
    const d = requireTenantScope('client_x', deps(actor, [spoofed]));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('CROSS_ORG');
  });
});

describe('AUDIT010-11 — no positional/first-client authority', () => {
  it('refuses an ADMIN action with no explicitly chosen client', () => {
    const d = requireTenantScope('', deps(user({ role: 'ADMIN' }), ALL));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_CLIENT_SCOPE');
  });

  it('does not silently fall back to the first available client', () => {
    // The old resolveClientId ended in getClients()[0]?.id. With several
    // candidates present the gate must still refuse rather than pick one.
    for (const requested of [null, undefined, '', '   ']) {
      const d = requireTenantScope(requested, deps(user({ role: 'ADMIN' }), ALL));
      expect(d.ok).toBe(false);
    }
  });

  it('the controller no longer resolves a client by array position', () => {
    const source = readFileSync(resolve(__dirname, '../src/ui/legacy/LegacyApp.ts'), 'utf8');
    const resolver = source.slice(
      source.indexOf('private resolveClientId('),
      source.indexOf('private displayClientId('),
    );
    expect(resolver).not.toMatch(/getClients\(\)\[0\]/);
  });

  it('the display default is separate, and is the only positional pick left in code', () => {
    const source = code(readFileSync(resolve(__dirname, '../src/ui/legacy/LegacyApp.ts'), 'utf8'));
    const occurrences = source.match(/getClients\(\)\[0\]/g) || [];
    expect(occurrences).toHaveLength(1);

    const display = source.slice(
      source.indexOf('private displayClientId('),
      source.indexOf('private requireTenant('),
    );
    expect(display).toMatch(/getClients\(\)\[0\]/);
  });

  it('a client session without a trusted clientId renders no portal at all', () => {
    // Previously this fell through to getClients()[0], rendering another
    // tenant's portal to a client whose session carried no clientId.
    const source = code(readFileSync(resolve(__dirname, '../src/ui/legacy/LegacyApp.ts'), 'utf8'));
    const view = source.slice(
      source.indexOf('private renderMainView('),
      source.indexOf('const clientId = this.currentClientId();'),
    );
    expect(view).not.toMatch(/getClients\(\)\[0\]/);
    expect(view).toMatch(/trustedClientId/);
    expect(view).toMatch(/if \(!trustedClientId\)/);
  });

  it('the ingest scheduler will not pick a tenant by position', () => {
    const source = code(readFileSync(resolve(__dirname, '../src/controllers/sourceAutomationScheduler.ts'), 'utf8'));
    const tick = source.slice(
      source.indexOf('async tickScheduledIngest('),
      source.indexOf('const due = sourcesDueForIngest('),
    );
    expect(tick).not.toMatch(/getClients\(\)\[0\]/);
    expect(tick).toMatch(/requireTenant\(/);
    expect(tick).toMatch(/if \(!grant\.ok\) return;/);
  });
});

describe('AUDIT010-10 — role gate for the tenant-less admin utility', () => {
  it('refuses a CLIENT actor', () => {
    const d = requireAdminActor({ getCurrentUser: () => user({ role: 'CLIENT', clientId: 'client_a1' }) });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('CLIENT_SCOPE_VIOLATION');
  });

  it('refuses when there is no session', () => {
    const d = requireAdminActor({ getCurrentUser: () => null });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe('NO_SESSION');
  });

  it('grants an ADMIN actor and reports the trusted organization', () => {
    const d = requireAdminActor({ getCurrentUser: () => user({ role: 'ADMIN' }) });
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.actorRole).toBe('ADMIN');
      expect(d.organizationId).toBe(ORG_A);
    }
  });
});

describe('AUDIT010-10 — the gate holds no authority of its own', () => {
  const source = readFileSync(resolve(__dirname, '../src/controllers/trustedTenant.ts'), 'utf8');

  it('does not import a store, a service or a provider', () => {
    expect(source).not.toMatch(/from '.*services\/(db|auth|ai)'/);
    expect(source).not.toMatch(/dbService|authService|localStorage|firebase|openai|anthropic/i);
  });

  it('reads identity only through injected dependencies', () => {
    expect(source).toMatch(/getCurrentUser\(\): User \| null/);
    expect(source).toMatch(/getClientById\(id: string\)/);
  });

  it('performs no write and executes no command', () => {
    expect(source).not.toMatch(/\.(save|add|create|update|delete|remove|apply|transition)[A-Z]\w*\(/);
  });
});

describe('AUDIT010-10 — every remediated effect path gates before the effect', () => {
  const source = readLegacyControllerSurface();
  const lines = source.split(/\r?\n/);

  const EFFECTS = [
    'rematerializeLocalSnapshot(',
    'applyOnboardingStep(',
    'aiService.generateThesisProposal(',
    'runResearchSignalsAgent(',
    'generatePositioningAdvice(',
    'runTopicAgent(',
  ];

  /** Nearest preceding gate, searching back to the start of the handler. */
  function gatedBefore(effectLine: number): boolean {
    for (let i = effectLine; i >= Math.max(0, effectLine - 40); i -= 1) {
      if (/(?:this|host)\.require(Tenant|Admin)\(/.test(lines[i])) return true;
    }
    return false;
  }

  for (const effect of EFFECTS) {
    it(`gates ${effect.replace('(', '')} at every user-triggered site`, () => {
      const sites = lines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => line.includes(effect));
      expect(sites.length).toBeGreaterThan(0);

      for (const { i } of sites) {
        // Internal helpers receive an already-gated clientId from their caller;
        // only the handler-attached sites are asserted here.
        const insideHandler = lines
          .slice(Math.max(0, i - 40), i)
          .some((l) => /addEventListener\(|void \(async \(\) =>/.test(l));
        if (insideHandler) expect(gatedBefore(i)).toBe(true);
      }
    });
  }

  it('leftover rematerialize UI no longer calls the leftover mutator', () => {
    const handler = readFileSync(
      resolve(__dirname, '../src/ui/legacy/handlers/clientAdminHandlers.ts'),
      'utf8'
    );
    expect(handler).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(handler).toMatch(/rematerializeLocalSnapshot/);
    expect(handler).toMatch(/requireAdmin\(\)/);
  });

  it('canonical rematerialize consumer gates ADMIN from the trusted session', () => {
    const consumer = readFileSync(
      resolve(__dirname, '../src/services/localSnapshotConsumer.ts'),
      'utf8'
    );
    expect(consumer).toMatch(/requireAdminActor/);
    expect(consumer).toMatch(/FIREBASE_ENABLED/);
    expect(consumer).not.toMatch(/pushCurrentLocalToFirestore/);
  });

  it('does not treat a disabled or hidden button as authorization', () => {
    // A gate must be a refusal, not a UI state change. Assert that no
    // remediated path relies on reading .disabled/.hidden to decide.
    expect(source).not.toMatch(/if \([^)]*\.(disabled|hidden)\)\s*\{?\s*(return|throw)/);
  });

  it('keeps the tenant gate as the only tenant decision in the remediated paths', () => {
    const gateCalls = (source.match(/(?:this|host)\.require(Tenant|Admin)\(/g) || []).length;
    expect(gateCalls).toBeGreaterThanOrEqual(8);
  });

  it('still routes AI through the existing services rather than a provider', () => {
    expect(source).not.toMatch(/from '.*(openai|anthropic|@google\/gen)/i);
    expect(source).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
  });
});
