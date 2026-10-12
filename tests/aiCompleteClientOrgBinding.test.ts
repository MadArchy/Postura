import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecuteAiOperation } from '../src/application/ai/use-cases/ExecuteAiOperation';
import type { AiRunPersistenceRecord, AiRunRepositoryPort } from '../src/application/ai/ports/outbound/AiRunRepositoryPort';
import { ModelRegistryAdapter } from '../src/infrastructure/ai/registry/ModelRegistryAdapter';
import { PromptRegistryAdapter } from '../src/infrastructure/ai/registry/PromptRegistryAdapter';
import {
  handleAiCompleteRequest,
  mapAiCompleteErrorStatus,
  type ClientOrganizationLookupPort,
} from '../src/interfaces/ai/handleAiCompleteRequest';
import type { AuthDerivedTenantInput } from '../src/interfaces/ai/resolveTrustedTenant';
import type { AiCompleteRequestBody } from '../src/interfaces/ai/aiCompleteTypes';
import { FakeAiProviderPort, jsonProviderResponse } from './helpers/fakeAiProvider';
import { minimalContentDraftGatewayInput } from './helpers/contentDraftGatewayInput';

const ORG_A = 'org_a';
const ORG_B = 'org_b';
const CLIENT_A = 'client_a';
const CLIENT_B = 'client_b';

const CLIENT_OWNERS: Record<string, string> = { [CLIENT_A]: ORG_A, [CLIENT_B]: ORG_B };

const serverMocks = vi.hoisted(() => ({
  findOwningOrganizationId: vi.fn<(clientId: string) => Promise<string | null>>(),
  execute: vi.fn(),
}));

vi.mock('../src/composition/ai/serverGatewayComposition', () => ({
  createServerAiGateway: () => ({ execute: serverMocks.execute }),
  createServerClientOrganizationLookup: () => ({
    findOwningOrganizationId: serverMocks.findOwningOrganizationId,
  }),
}));

function createHarness() {
  const providerCalls = vi.fn();
  const savedRuns: AiRunPersistenceRecord[] = [];
  const aiRunRepository: AiRunRepositoryPort = {
    save: vi.fn(async (run: AiRunPersistenceRecord) => {
      savedRuns.push(run);
      return run.id;
    }),
  };
  const gateway = new ExecuteAiOperation({
    providerPort: new FakeAiProviderPort(() => {
      providerCalls();
      return jsonProviderResponse({ title: 'Hello', body: 'World content' });
    }),
    modelRegistry: new ModelRegistryAdapter(),
    promptRegistry: new PromptRegistryAdapter(),
    aiRunRepository,
  });
  const executeSpy = vi.spyOn(gateway, 'execute');
  const lookupCalls = vi.fn();
  const clientOrganizations: ClientOrganizationLookupPort = {
    async findOwningOrganizationId(clientId: string) {
      lookupCalls(clientId);
      return CLIENT_OWNERS[clientId] ?? null;
    },
  };
  return { gateway, executeSpy, providerCalls, aiRunRepository, savedRuns, clientOrganizations, lookupCalls };
}

const adminOrgA: AuthDerivedTenantInput = { role: 'ADMIN', organizationId: ORG_A, clientId: null, userId: 'admin_a' };

function contentDraftBody(clientId: string): AiCompleteRequestBody {
  return {
    operation: 'CONTENT_DRAFT',
    clientId,
    input: minimalContentDraftGatewayInput(),
    prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
  };
}

function expectDeniedWithoutSideEffects(
  result: Awaited<ReturnType<typeof handleAiCompleteRequest>>,
  harness: ReturnType<typeof createHarness>
) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('AUTH_CONTEXT_INVALID');
    expect(result.error.message).toBe('clientId is not valid for the authenticated organization');
    expect(result.error.retryable).toBe(false);
    expect(mapAiCompleteErrorStatus(result.error.code)).toBe(400);
  }
  expect(harness.executeSpy).not.toHaveBeenCalled();
  expect(harness.providerCalls).not.toHaveBeenCalled();
  expect(harness.aiRunRepository.save).not.toHaveBeenCalled();
  expect(harness.savedRuns).toHaveLength(0);
}

describe('A31 — aiComplete ADMIN client/organization binding', () => {
  it('denies ADMIN of ORG-A targeting CLIENT-B owned by ORG-B before gateway, provider and persistence', async () => {
    const harness = createHarness();
    const result = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody(CLIENT_B),
      clientOrganizations: harness.clientOrganizations,
    });
    expectDeniedWithoutSideEffects(result, harness);
    expect(harness.lookupCalls).toHaveBeenCalledWith(CLIENT_B);
  });

  it('denies ADMIN targeting a nonexistent client with the same error contract', async () => {
    const harness = createHarness();
    const result = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody('client_missing'),
      clientOrganizations: harness.clientOrganizations,
    });
    expectDeniedWithoutSideEffects(result, harness);
  });

  it('denies path-like clientId candidates without consulting the lookup', async () => {
    const harness = createHarness();
    const result = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody(`${CLIENT_A}/aiRuns/x`),
      clientOrganizations: harness.clientOrganizations,
    });
    expectDeniedWithoutSideEffects(result, harness);
    expect(harness.lookupCalls).not.toHaveBeenCalled();
  });

  it('fails closed when the ownership lookup errors', async () => {
    const harness = createHarness();
    const failingLookup: ClientOrganizationLookupPort = {
      async findOwningOrganizationId() {
        throw new Error('firestore unavailable');
      },
    };
    const result = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody(CLIENT_A),
      clientOrganizations: failingLookup,
    });
    expectDeniedWithoutSideEffects(result, harness);
  });

  it('fails closed when an untyped caller omits the ownership lookup', async () => {
    const harness = createHarness();
    const rawParams = {
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody(CLIENT_A),
      clientOrganizations: harness.clientOrganizations,
    };
    Reflect.deleteProperty(rawParams, 'clientOrganizations');
    expect('clientOrganizations' in rawParams).toBe(false);
    const result = await handleAiCompleteRequest(rawParams);
    expectDeniedWithoutSideEffects(result, harness);
    expect(harness.lookupCalls).not.toHaveBeenCalled();
  });

  it('fails closed when the ownership lookup is not a usable verifier', async () => {
    const harness = createHarness();
    const brokenLookup: ClientOrganizationLookupPort = {
      async findOwningOrganizationId() {
        return ORG_A;
      },
    };
    Reflect.set(brokenLookup, 'findOwningOrganizationId', undefined);
    const result = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody(CLIENT_A),
      clientOrganizations: brokenLookup,
    });
    expectDeniedWithoutSideEffects(result, harness);
  });

  it('accepts ADMIN of ORG-A targeting CLIENT-A owned by ORG-A and passes the trusted tenant to the gateway', async () => {
    const harness = createHarness();
    const result = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: contentDraftBody(CLIENT_A),
      clientOrganizations: harness.clientOrganizations,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ title: 'Hello', body: 'World content' });
    expect(harness.executeSpy).toHaveBeenCalledTimes(1);
    expect(harness.executeSpy.mock.calls[0][0].tenant).toMatchObject({
      organizationId: ORG_A,
      clientId: CLIENT_A,
      role: 'ADMIN',
      userId: 'admin_a',
    });
    expect(harness.providerCalls).toHaveBeenCalledTimes(1);
    expect(harness.savedRuns).toHaveLength(1);
    expect(harness.savedRuns[0]).toMatchObject({ organizationId: ORG_A, clientId: CLIENT_A });
  });

  it('keeps the token organization authoritative when the body carries an organization-like field', async () => {
    const harness = createHarness();
    const spoofedBody = { ...contentDraftBody(CLIENT_B), organizationId: ORG_B };
    const denied = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: spoofedBody,
      clientOrganizations: harness.clientOrganizations,
    });
    expectDeniedWithoutSideEffects(denied, harness);

    const allowedBody = { ...contentDraftBody(CLIENT_A), organizationId: ORG_B };
    const allowed = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: adminOrgA,
      body: allowedBody,
      clientOrganizations: harness.clientOrganizations,
    });
    expect(allowed.ok).toBe(true);
    expect(harness.executeSpy.mock.calls[0][0].tenant.organizationId).toBe(ORG_A);
    expect(harness.savedRuns[0]).toMatchObject({ organizationId: ORG_A, clientId: CLIENT_A });
  });

  it('preserves CLIENT resolution from trusted claims without consulting the ownership lookup', async () => {
    const harness = createHarness();
    const clientAuth: AuthDerivedTenantInput = { role: 'CLIENT', organizationId: ORG_A, clientId: CLIENT_A, userId: 'client_user' };

    const mismatch = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: clientAuth,
      body: contentDraftBody(CLIENT_B),
      clientOrganizations: harness.clientOrganizations,
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.error.code).toBe('AUTH_CONTEXT_INVALID');
      expect(mismatch.error.message).toBe('clientId in request does not match authenticated client');
    }
    expect(harness.executeSpy).not.toHaveBeenCalled();

    const own = await handleAiCompleteRequest({
      gateway: harness.gateway,
      auth: clientAuth,
      body: contentDraftBody(CLIENT_A),
      clientOrganizations: harness.clientOrganizations,
    });
    expect(own.ok).toBe(true);
    expect(harness.executeSpy.mock.calls[0][0].tenant).toMatchObject({ organizationId: ORG_A, clientId: CLIENT_A, role: 'CLIENT' });
    expect(harness.lookupCalls).not.toHaveBeenCalled();
  });
});

describe('A31 — runAiCompleteHttp always injects the server ownership lookup', () => {
  beforeEach(async () => {
    serverMocks.findOwningOrganizationId.mockReset();
    serverMocks.execute.mockReset();
    const { resetAiCompleteGatewayCache } = await import('../functions/src/ai/runAiComplete');
    resetAiCompleteGatewayCache();
  });

  it('returns 400 AUTH_CONTEXT_INVALID for a cross-org client without executing the gateway', async () => {
    serverMocks.findOwningOrganizationId.mockResolvedValue(ORG_B);
    const { runAiCompleteHttp } = await import('../functions/src/ai/runAiComplete');
    const { status, payload } = await runAiCompleteHttp({
      auth: { uid: 'admin_a', role: 'ADMIN', organizationId: ORG_A, clientId: null },
      body: contentDraftBody(CLIENT_B),
    });
    expect(status).toBe(400);
    expect(payload).toMatchObject({ ok: false, error: { code: 'AUTH_CONTEXT_INVALID' } });
    expect(serverMocks.findOwningOrganizationId).toHaveBeenCalledWith(CLIENT_B);
    expect(serverMocks.execute).not.toHaveBeenCalled();
  });

  it('returns 400 AUTH_CONTEXT_INVALID for a nonexistent client without executing the gateway', async () => {
    serverMocks.findOwningOrganizationId.mockResolvedValue(null);
    const { runAiCompleteHttp } = await import('../functions/src/ai/runAiComplete');
    const { status } = await runAiCompleteHttp({
      auth: { uid: 'admin_a', role: 'ADMIN', organizationId: ORG_A, clientId: null },
      body: contentDraftBody('client_missing'),
    });
    expect(status).toBe(400);
    expect(serverMocks.execute).not.toHaveBeenCalled();
  });
});
