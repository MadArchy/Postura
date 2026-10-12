import { describe, expect, it, vi } from 'vitest';
import { OpenAiAdapter } from '../src/infrastructure/ai/providers/OpenAiAdapter';
import { AnthropicAdapter } from '../src/infrastructure/ai/providers/AnthropicAdapter';
import { ModelRegistryAdapter } from '../src/infrastructure/ai/registry/ModelRegistryAdapter';
import { MODEL_REGISTRY_ENTRIES } from '../src/infrastructure/ai/registry/modelRegistryConfig';
import { PromptRegistryAdapter } from '../src/infrastructure/ai/registry/PromptRegistryAdapter';
import { computePromptHash } from '../src/infrastructure/ai/registry/promptHash';
import { minimalContentDraftGatewayInput } from './helpers/contentDraftGatewayInput';
import { minimalSignalThesisEvalGatewayInput } from './helpers/thesisSignalGatewayInput';
import { ExecuteAiOperation } from '../src/application/ai/use-cases/ExecuteAiOperation';
import { handleAiCompleteRequest, type ClientOrganizationLookupPort } from '../src/interfaces/ai/handleAiCompleteRequest';
import { resolveTrustedTenantForAiComplete } from '../src/interfaces/ai/resolveTrustedTenant';
import { errorExposesSecrets } from '../src/domain/ai/errors';
import { FakeAiProviderPort, jsonProviderResponse } from './helpers/fakeAiProvider';
import { AI_MODEL_ROLES, DEFAULT_MODEL_ROLE_BY_OPERATION } from '../src/domain/ai/modelRole';
import { readFileSync } from 'node:fs';
import { AICOMPLETE_AUTH_POLICY } from '../src/interfaces/ai/aiCompletePolicy';

describe('SPEC-005 Phase 2 — OpenAI adapter', () => {
  it('normalizes valid response and usage', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'gpt-4o-mini',
          choices: [{ message: { content: '{"title":"T","body":"B"}' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 },
        }),
        { status: 200 }
      )
    );
    const adapter = new OpenAiAdapter({ openAiApiKey: 'test-openai-key', anthropicApiKey: null }, { timeoutMs: 5000 }, fetchFn);
    const result = await adapter.complete({
      operation: 'CONTENT_DRAFT',
      logicalModelRole: 'CREATIVE_WRITING',
      model: MODEL_REGISTRY_ENTRIES.CREATIVE_WRITING,
      structuredJsonRequired: true,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ],
    });
    expect(result.providerName).toBe('openai');
    expect(result.promptTokens).toBe(11);
    expect(result.completionTokens).toBe(22);
    expect(result.totalTokens).toBe(33);
    expect(result.providerRequestId).toBe('chatcmpl-test');
  });

  it('maps 429 to RATE_LIMITED', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 }));
    const adapter = new OpenAiAdapter({ openAiApiKey: 'key', anthropicApiKey: null }, { timeoutMs: 5000 }, fetchFn);
    await expect(
      adapter.complete({
        operation: 'CONTENT_DRAFT',
        logicalModelRole: 'CREATIVE_WRITING',
        model: MODEL_REGISTRY_ENTRIES.CREATIVE_WRITING,
        structuredJsonRequired: true,
        messages: [{ role: 'user', content: 'x' }],
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true });
  });

  it('fails closed when secret missing', async () => {
    const adapter = new OpenAiAdapter({ openAiApiKey: null, anthropicApiKey: null }, { timeoutMs: 5000 }, vi.fn());
    await expect(
      adapter.complete({
        operation: 'CONTENT_DRAFT',
        logicalModelRole: 'CREATIVE_WRITING',
        model: MODEL_REGISTRY_ENTRIES.CREATIVE_WRITING,
        structuredJsonRequired: true,
        messages: [{ role: 'user', content: 'x' }],
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });

  it('sanitizes provider errors', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: 'Bearer sk-secret1234567890 leaked' } }), { status: 500 })
    );
    const adapter = new OpenAiAdapter({ openAiApiKey: 'key', anthropicApiKey: null }, { timeoutMs: 5000 }, fetchFn);
    try {
      await adapter.complete({
        operation: 'CONTENT_DRAFT',
        logicalModelRole: 'CREATIVE_WRITING',
        model: MODEL_REGISTRY_ENTRIES.CREATIVE_WRITING,
        structuredJsonRequired: true,
        messages: [{ role: 'user', content: 'x' }],
      });
      expect.fail('expected throw');
    } catch (error) {
      expect((error as Error).message).not.toMatch(/sk-/);
      expect(errorExposesSecrets({ code: 'PROVIDER_ERROR', message: (error as Error).message, retryable: false })).toBe(false);
    }
  });
});

describe('SPEC-005 Phase 2 — Anthropic adapter', () => {
  it('normalizes valid response', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'msg_test',
          model: 'claude-3-5-haiku-20241022',
          content: [{ type: 'text', text: '{"angle":"Focus"}' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5, output_tokens: 7 },
        }),
        { status: 200 }
      )
    );
    const adapter = new AnthropicAdapter({ openAiApiKey: null, anthropicApiKey: 'anthropic-key' }, { timeoutMs: 5000 }, fetchFn);
    const result = await adapter.complete({
      operation: 'ADVISOR_CURATION_ANGLE',
      logicalModelRole: 'FAST_STRUCTURED',
      model: {
        role: 'FAST_STRUCTURED',
        providerName: 'anthropic',
        providerModelId: 'claude-3-5-haiku-20241022',
        enabled: true,
        maxTokens: 1200,
        temperature: 0.3,
        supportsJsonMode: false,
      },
      structuredJsonRequired: true,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ],
    });
    expect(result.providerName).toBe('anthropic');
    expect(result.totalTokens).toBe(12);
  });
});

describe('SPEC-005 Phase 2 — ModelRegistry', () => {
  const registry = new ModelRegistryAdapter();

  it('resolves all 3 logical roles deterministically', () => {
    for (const role of AI_MODEL_ROLES) {
      const config = registry.resolve(role, 'CONTENT_DRAFT');
      expect(config.enabled).toBe(true);
      expect(config.providerModelId).toBe('gpt-4o-mini');
    }
  });

  it('maps operations to expected roles', () => {
    expect(DEFAULT_MODEL_ROLE_BY_OPERATION.CONTENT_DRAFT).toBe('CREATIVE_WRITING');
    expect(registry.resolve('CREATIVE_WRITING', 'CONTENT_DRAFT').providerModelId).toBe('gpt-4o-mini');
  });

  it('fails closed for disabled config', () => {
    const disabled = new ModelRegistryAdapter({
      ...MODEL_REGISTRY_ENTRIES,
      FAST_STRUCTURED: { ...MODEL_REGISTRY_ENTRIES.FAST_STRUCTURED, enabled: false },
    });
    const config = disabled.resolve('FAST_STRUCTURED', 'ADVISOR_CURATION_ANGLE');
    expect(config.enabled).toBe(false);
  });
});

describe('SPEC-005 Phase 2 — PromptRegistry', () => {
  const registry = new PromptRegistryAdapter();

  it('resolves known prompt with version and full SHA-256 hash', () => {
    const resolved = registry.resolve({
      operation: 'CONTENT_DRAFT',
      identity: { promptId: 'tmpl_content_v1', promptVersion: '1' },
      input: minimalContentDraftGatewayInput({ topicTitle: 'test' }),
    });
    expect(resolved.identity.promptId).toBe('tmpl_content_v1');
    expect(resolved.identity.promptVersion).toBe('1');
    expect(resolved.identity.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('promptVersion independent from schemaVersion', () => {
    const signal = registry.resolve({
      operation: 'SIGNAL_THESIS_EVAL',
      identity: { promptId: 'tmpl_strategist_signal_eval_v2', promptVersion: '2' },
      input: minimalSignalThesisEvalGatewayInput(),
    });
    expect(signal.identity.promptVersion).toBe('2');
    expect(signal.identity.promptId).toBe('tmpl_strategist_signal_eval_v2');
  });

  it('unknown prompt fails', () => {
    expect(() =>
      registry.resolve({
        operation: 'CONTENT_DRAFT',
        identity: { promptId: 'unknown', promptVersion: '9' },
        input: minimalContentDraftGatewayInput(),
      })
    ).toThrow(/Unknown prompt/);
  });

  it('promptHash is deterministic 64-hex SHA-256', () => {
    const a = computePromptHash('sys', 'user');
    const b = computePromptHash('sys', 'user');
    const c = computePromptHash('sys', 'user-modified');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('SPEC-005 Phase 2 — aiComplete authorization policy', () => {
  it('policy is ADMIN_ONLY at Cloud Function boundary', () => {
    expect(AICOMPLETE_AUTH_POLICY).toBe('AICOMPLETE_ADMIN_ONLY');
    const indexSource = readFileSync('functions/src/index.ts', 'utf8');
    expect(indexSource).toMatch(/aiComplete[\s\S]*adminOnly:\s*true/);
    expect(indexSource).not.toMatch(/501/);
    expect(indexSource).not.toMatch(/NOT_IMPLEMENTED/);
  });

  it('CLIENT tenant helper exists but CLIENT is not aiComplete-reachable', () => {
    const clientOwn = resolveTrustedTenantForAiComplete(
      { role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a' },
      { operation: 'CONTENT_DRAFT' }
    );
    expect(clientOwn.ok).toBe(true);
    expect(AICOMPLETE_AUTH_POLICY).toBe('AICOMPLETE_ADMIN_ONLY');
  });
});

describe('SPEC-005 Phase 2 — tenant trust boundary (ADMIN aiComplete path)', () => {
  it('accepts auth-derived org/client', () => {
    const result = resolveTrustedTenantForAiComplete(
      { role: 'ADMIN', organizationId: 'org_a', clientId: null },
      { operation: 'CONTENT_DRAFT', bodyClientId: 'client_1' }
    );
    expect(result.ok).toBe(true);
  });

  it('denies client impersonation via body', () => {
    const result = resolveTrustedTenantForAiComplete(
      { role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a' },
      { operation: 'CONTENT_DRAFT', bodyClientId: 'client_b' }
    );
    expect(result.ok).toBe(false);
  });

  it('denies missing clientId for scoped operation', () => {
    const result = resolveTrustedTenantForAiComplete(
      { role: 'ADMIN', organizationId: 'org_a', clientId: null },
      { operation: 'CONTENT_DRAFT' }
    );
    expect(result.ok).toBe(false);
  });

  it('denies missing organizationId', () => {
    const result = resolveTrustedTenantForAiComplete(
      { role: 'ADMIN', organizationId: '', clientId: null },
      { operation: 'CONTENT_DRAFT', bodyClientId: 'client_1' }
    );
    expect(result.ok).toBe(false);
  });
});

describe('SPEC-005 Phase 2 — provider routing reachability', () => {
  it('production ModelRegistry routes all roles to OpenAI only', () => {
    const registry = new ModelRegistryAdapter();
    for (const role of AI_MODEL_ROLES) {
      const config = registry.resolve(role, 'CONTENT_DRAFT');
      expect(config.providerName).toBe('openai');
      expect(config.role).toBe(role);
    }
  });

  it('logical roles remain distinct from provider model IDs', () => {
    expect(AI_MODEL_ROLES).toEqual(['FAST_STRUCTURED', 'DEEP_REASONING', 'CREATIVE_WRITING']);
    expect(DEFAULT_MODEL_ROLE_BY_OPERATION.ANALYSIS_COMPARATIVE).toBe('DEEP_REASONING');
    expect(DEFAULT_MODEL_ROLE_BY_OPERATION.ADVISOR_CURATION_ANGLE).toBe('FAST_STRUCTURED');
  });
});

describe('SPEC-005 Phase 2 — timeout policy', () => {
  it('defaults to 60000ms and caps override at 120000ms', async () => {
    const { DEFAULT_PROVIDER_TIMEOUT_MS, resolveProviderTimeoutPolicy } = await import(
      '../src/infrastructure/ai/configuration/providerTimeout'
    );
    expect(DEFAULT_PROVIDER_TIMEOUT_MS).toBe(60_000);
    expect(resolveProviderTimeoutPolicy({})).toEqual({ timeoutMs: 60_000 });
    expect(resolveProviderTimeoutPolicy({ AI_PROVIDER_TIMEOUT_MS: '90000' })).toEqual({ timeoutMs: 90_000 });
    expect(resolveProviderTimeoutPolicy({ AI_PROVIDER_TIMEOUT_MS: '999999' })).toEqual({ timeoutMs: 120_000 });
    expect(resolveProviderTimeoutPolicy({ AI_PROVIDER_TIMEOUT_MS: 'invalid' })).toEqual({ timeoutMs: 60_000 });
  });
});

describe('SPEC-005 Phase 2 — end-to-end hexagonal (CONTENT_DRAFT)', () => {
  const clientOrganizations: ClientOrganizationLookupPort = {
    async findOwningOrganizationId(clientId: string) {
      return clientId === 'client_a' ? 'org_test' : null;
    },
  };

  it('validates trusted output from fake provider', async () => {
    const gateway = new ExecuteAiOperation({
      providerPort: new FakeAiProviderPort(() => jsonProviderResponse({ title: 'Hello', body: 'World content' })),
      modelRegistry: new ModelRegistryAdapter(),
      promptRegistry: new PromptRegistryAdapter(),
    });

    const result = await handleAiCompleteRequest({
      gateway,
      clientOrganizations,
      auth: { role: 'ADMIN', organizationId: 'org_test', clientId: null },
      body: {
        operation: 'CONTENT_DRAFT',
        clientId: 'client_a',
        input: minimalContentDraftGatewayInput(),
        prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ title: 'Hello', body: 'World content' });
      expect(result.metadata.validationStatus).toBe('VALID');
      expect(result.metadata.repairCount).toBe(0);
      expect(result.metadata.providerCallCount).toBe(1);
    }
  });

  it('rejects invalid provider JSON', async () => {
    const gateway = new ExecuteAiOperation({
      providerPort: new FakeAiProviderPort(() => jsonProviderResponse({ title: 'only title' })),
      modelRegistry: new ModelRegistryAdapter(),
      promptRegistry: new PromptRegistryAdapter(),
    });

    const result = await handleAiCompleteRequest({
      gateway,
      clientOrganizations,
      auth: { role: 'ADMIN', organizationId: 'org_test', clientId: null },
      body: {
        operation: 'CONTENT_DRAFT',
        clientId: 'client_a',
        input: minimalContentDraftGatewayInput(),
        prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPAIR_FAILED');
    if (!result.ok) expect(result.metadata?.repairCount).toBe(1);
  });
});

describe('SPEC-005 Phase 2 — browser bundle safety', () => {
  it('services/ai.ts does not import server gateway composition', () => {
    const content = readFileSync('src/services/ai.ts', 'utf8');
    expect(content).not.toMatch(/infrastructure\/ai/);
    expect(content).not.toMatch(/serverGatewayComposition/);
    expect(content).not.toMatch(/OPENAI_API_KEY/);
  });
});
