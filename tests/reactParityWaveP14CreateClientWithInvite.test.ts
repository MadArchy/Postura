/**
 * SPEC-010 · T603 React Parity Wave P14 — Registry #34 CreateClientWithInvite.
 *
 * Presentation parity only. #1 accept invite, impersonation, Firestore, pipeline untouched.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClientLifecycleError } from '../src/application/clientLifecycle';

const createCalls: {
  firstName: string;
  lastName: string;
  email: string;
  profession?: string;
  company?: string;
  targetMarket?: string;
  claimedOrganizationId?: string;
}[] = [];

const auditCalls: { event: string; entityId: string }[] = [];
const notifyCalls: { type: string; clientId: string }[] = [];

let createImpl:
  | ((intent: (typeof createCalls)[number]) => {
      client: {
        id: string;
        displayName: string;
        organizationId: string;
        status: string;
        onboardingStatus: string;
        primaryEmail: string;
      };
      invitation: { token: string; status: string; email: string };
    })
  | null = null;

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      id: 'user_admin_01',
      role: 'ADMIN',
      organizationId: 'org_a',
    }),
  },
}));

vi.mock('../src/services/audit', () => ({
  auditService: {
    log: (_user: unknown, event: string, _entity: string, entityId: string) => {
      auditCalls.push({ event, entityId });
    },
  },
}));

vi.mock('../src/services/notifications', () => ({
  notificationService: {
    push: (input: { type: string; clientId: string }) => {
      notifyCalls.push({ type: input.type, clientId: input.clientId });
    },
  },
}));

vi.mock('../src/services/clientLifecycleConsumer', () => ({
  createClientWithInvite: (intent: (typeof createCalls)[number]) => {
    createCalls.push(intent);
    if (createImpl) return createImpl(intent);
    return {
      client: {
        id: 'client_p14_1',
        displayName: `${intent.firstName} ${intent.lastName}`,
        organizationId: 'org_a',
        status: 'INVITED',
        onboardingStatus: 'NOT_STARTED',
        primaryEmail: intent.email,
      },
      invitation: {
        token: 'tok_p14_fixture',
        status: 'PENDING',
        email: intent.email,
      },
    };
  },
  acceptClientInvitation: vi.fn(),
  resetClientLifecycleConsumerForTest: vi.fn(),
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

beforeEach(() => {
  createCalls.length = 0;
  auditCalls.length = 0;
  notifyCalls.length = 0;
  createImpl = null;
});

describe('P14 §1–§5 — registry authority and public input', () => {
  it('registry #34 uses CreateClientWithInvite with ADMIN trusted context only', () => {
    const registry = read('specs/010-react-migration/audit010-09-registry.md');
    expect(registry).toMatch(/\| 34 \|.*Create client \+ invite.*CreateClientWithInvite/s);
    expect(registry).toMatch(/\*\*YES\*\*/);
  });

  it('frozen consumer public input keys match CR-1 contract', () => {
    const consumer = read('src/services/clientLifecycleConsumer.ts');
    expect(consumer).toMatch(/firstName/);
    expect(consumer).toMatch(/lastName/);
    expect(consumer).toMatch(/email/);
    expect(consumer).toMatch(/profession\?:/);
    expect(consumer).toMatch(/claimedOrganizationId\?:/);
    expect(consumer).not.toMatch(/organizationId:\s*intent/);
    expect(consumer).toMatch(/requireAdminActor/);
  });

  it('command seam invokes consumer once with public input only', async () => {
    const { clientLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = clientLifecycleCommands.createClientWithInvite({
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      profession: 'Abogada',
      company: 'Acme',
      targetMarket: 'B2B',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.clientId).toBe('client_p14_1');
      expect(result.invitationToken).toBe('tok_p14_fixture');
      expect(result.message).toMatch(/Token de invitación: tok_p14_fixture/);
    }
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toEqual({
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      profession: 'Abogada',
      company: 'Acme',
      targetMarket: 'B2B',
    });
    expect(JSON.stringify(createCalls[0])).not.toMatch(/organizationId|actorId|actorRole|tenant/);
  });

  it('claimedOrganizationId spoof is forwarded but never becomes authority in seam payload', async () => {
    createImpl = () => {
      throw new ClientLifecycleError(
        'TENANT_CONTEXT_INVALID',
        'Caller-supplied organizationId does not match trusted session organization.'
      );
    };
    const { clientLifecycleCommands } = await import('../src/ui/commands/commandSeam');
    const result = clientLifecycleCommands.createClientWithInvite({
      firstName: 'X',
      lastName: 'Y',
      email: 'x@example.com',
      claimedOrganizationId: 'org_evil',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/organizationId|trusted/i);
    }
    expect(createCalls[0].claimedOrganizationId).toBe('org_evil');
  });
});

describe('P14 §6–§12 — frozen lifecycle semantics (source contract)', () => {
  it('Application create sets INVITED + NOT_STARTED defaults', () => {
    const app = read('src/application/clientLifecycle/CreateClientWithInvite.ts');
    expect(app).toMatch(/onboardingStatus: 'NOT_STARTED'/);
    expect(app).toMatch(/status: 'INVITED'/);
    expect(app).toMatch(/profileCompleteness: 15/);
    expect(app).toMatch(/organizationId = input\.trusted\.organizationId/);
  });

  it('invitation token is port-owned, not React-generated', () => {
    const adapter = read('src/infrastructure/clientLifecycle/DbClientLifecycleAdapters.ts');
    expect(adapter).toMatch(/dbService\.createInvitation/);
    const cockpit = code('src/ui/modules/pages/ReactManagerCockpitPage.tsx');
    expect(cockpit).not.toMatch(/createId|token\s*=/);
  });

  it('partial failure compensation archives client and revokes invitation', () => {
    const app = read('src/application/clientLifecycle/CreateClientWithInvite.ts');
    expect(app).toMatch(/compensateCreateFailure/);
    expect(app).toMatch(/markRevoked/);
    expect(app).toMatch(/status: 'ARCHIVED'/);
    expect(app).toMatch(/PARTIAL_FAILURE_COMPENSATED/);
  });

  it('consumer source emits CREATE_CLIENT audit and ONBOARDING notification after success', () => {
    const consumer = read('src/services/clientLifecycleConsumer.ts');
    expect(consumer).toMatch(/auditService\.log/);
    expect(consumer).toMatch(/CREATE_CLIENT/);
    expect(consumer).toMatch(/notificationService\.push/);
    expect(consumer).toMatch(/type: 'ONBOARDING'/);
  });
});

describe('P14 §15–§21 — hook, form, refresh, boundaries', () => {
  it('hook delegates to clientLifecycleCommands without dbService', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useCreateClientWithInvite/);
    const idx = hooks.indexOf('export function useCreateClientWithInvite');
    const block = hooks.slice(idx, idx + 900);
    expect(block).toMatch(/clientLifecycleCommands\.createClientWithInvite/);
    expect(block).toMatch(/tenantInvalidationKey/);
    expect(block).toMatch(/compatibility/);
    expect(block).not.toMatch(/\bdbService\b/);
  });

  it('portfolio overview query key matches invalidation target', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/tenantQueryKey\(scope, 'compatibility', 'portfolio-overview'\)/);
    expect(hooks).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
  });

  it('React cockpit form exposes user-data fields only', () => {
    const cockpit = code('src/ui/modules/pages/ReactManagerCockpitPage.tsx');
    expect(cockpit).toMatch(/react-cockpit-first-name/);
    expect(cockpit).toMatch(/react-cockpit-last-name/);
    expect(cockpit).toMatch(/react-cockpit-email/);
    expect(cockpit).toMatch(/react-cockpit-profession/);
    expect(cockpit).toMatch(/react-cockpit-company/);
    expect(cockpit).toMatch(/react-cockpit-target/);
    expect(cockpit).not.toMatch(/claimedOrganizationId/);
    expect(cockpit).not.toMatch(/organizationId/);
    expect(cockpit).not.toMatch(/\bdbService\b/);
    expect(cockpit).not.toMatch(/acceptInvitation/);
    expect(cockpit).not.toMatch(/impersonateClient/);
    expect(cockpit).not.toMatch(/pushCurrentLocalToFirestore/);
  });

  it('handoff removes create+invite but keeps infrastructure residuals', () => {
    const cockpit = read('src/ui/modules/pages/ReactManagerCockpitPage.tsx');
    expect(cockpit).not.toMatch(/crear un cliente/);
    expect(cockpit).not.toMatch(/invitarlo/);
    expect(cockpit).toMatch(/ver la app como cliente/);
    expect(cockpit).not.toMatch(/subir datos a Firestore/);
    expect(cockpit).toMatch(/generar contenido y mover el pipeline/);
  });

  it('command seam has zero acceptInvitation usage from create path', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).toMatch(/createClientWithInvite/);
    expect(seam).not.toMatch(/\bdbService\b/);
  });
});

describe('P14 §22–§28 — non-regression boundaries', () => {
  it('ReactLogin email branch unchanged by P14 cockpit work', () => {
    const login = read('src/ui/modules/Login/ReactLogin.tsx');
    expect(login).toMatch(/sessionCommands\.login/);
    expect(login).toMatch(/react-login-submit/);
    expect(login).not.toMatch(/useCreateClientWithInvite/);
  });

  it('legacy create-client handler rollback retained', () => {
    const legacy = read('src/ui/legacy/handlers/clientAdminHandlers.ts');
    expect(legacy).toMatch(/form-create-client/);
    expect(legacy).toMatch(/createClientWithInvite/);
  });

  it('P13 deliver hooks unchanged by P14 cockpit work', () => {
    const hooks = read('src/ui/hooks/useWave3Data.ts');
    expect(hooks).toMatch(/useEnsureDraftDelivery/);
    expect(hooks).toMatch(/useDiscardDraftDelivery/);
  });
});
