import { describe, expect, it, vi } from 'vitest';
import {
  MAX_PROVIDER_CALLS_PER_EXECUTION,
  MAX_PROVIDER_RETRIES,
  MAX_REPAIR_ATTEMPTS,
  REPAIR_MODEL_ROLE,
} from '../src/domain/ai';
import { ExecuteAiOperation } from '../src/application/ai/use-cases/ExecuteAiOperation';
import { ModelRegistryAdapter } from '../src/infrastructure/ai/registry/ModelRegistryAdapter';
import { PromptRegistryAdapter } from '../src/infrastructure/ai/registry/PromptRegistryAdapter';
import { computePromptHash } from '../src/infrastructure/ai/registry/promptHash';
import {
  REPAIR_PROMPT_IDENTITY,
  REPAIR_PROMPT_TEMPLATE_HASH,
  REPAIR_USER_TEMPLATE_CANONICAL,
  REPAIR_PROMPT_SYSTEM_MESSAGE,
  computeRepairPromptTemplateHash,
} from '../src/infrastructure/ai/registry/repairPromptCatalog';
import { FakeAiProviderPort, jsonProviderResponse } from './helpers/fakeAiProvider';
import {
  SequenceFakeProvider,
  throwProviderError,
  validContentDraftResponse,
  invalidContentDraftSchemaResponse,
  malformedJsonResponse,
} from './helpers/resilienceFakeProvider';
import { handleAiCompleteRequest, type ClientOrganizationLookupPort } from '../src/interfaces/ai/handleAiCompleteRequest';
import { ProviderPortError } from '../src/application/ai/errors/providerPortErrors';
import { executeProviderWithRetry } from '../src/application/ai/resilience/providerRetryPolicy';
import { ProviderCallBudget } from '../src/application/ai/resilience/providerCallBudget';
import { isValidationRepairEligible } from '../src/application/ai/resilience/repairEligibility';
import { validateAiOutput, ContentDraftOutputSchema } from '../src/application/ai';
import { readFileSync } from 'node:fs';
import { minimalContentDraftGatewayInput } from './helpers/contentDraftGatewayInput';

const noSleep = async () => undefined;

function createGateway(handler: SequenceFakeProvider['handler']) {
  return new ExecuteAiOperation({
    providerPort: new FakeAiProviderPort(handler),
    modelRegistry: new ModelRegistryAdapter(),
    promptRegistry: new PromptRegistryAdapter(),
    retryBackoffMs: 0,
    sleepFn: noSleep,
  });
}

const baseRequest = {
  operation: 'CONTENT_DRAFT' as const,
  clientId: 'client_a',
  input: minimalContentDraftGatewayInput(),
  prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
};

const clientOrganizations: ClientOrganizationLookupPort = {
  async findOwningOrganizationId(clientId: string) {
    return clientId === 'client_a' ? 'org_test' : null;
  },
};

describe('SPEC-005 Phase 3 — retry policy constants', () => {
  it('freezes bounded retry/repair/budget constants', () => {
    expect(MAX_PROVIDER_RETRIES).toBe(1);
    expect(MAX_REPAIR_ATTEMPTS).toBe(1);
    expect(MAX_PROVIDER_CALLS_PER_EXECUTION).toBe(4);
    expect(REPAIR_MODEL_ROLE).toBe('FAST_STRUCTURED');
  });
});

describe('SPEC-005 Phase 3 — retry (A–I)', () => {
  it('A: success first attempt → no retry', async () => {
    const seq = new SequenceFakeProvider([validContentDraftResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.retryCount).toBe(0);
      expect(result.metadata.providerCallCount).toBe(1);
    }
    expect(seq.callCount).toBe(1);
  });

  it('B: RATE_LIMITED → one retry → success', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.metadata.retryCount).toBe(1);
    expect(seq.callCount).toBe(2);
  });

  it('C: retryable 5xx → one retry → success', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'PROVIDER_ERROR', retryable: true, httpStatus: 500 });
      },
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.metadata.retryCount).toBe(1);
  });

  it('D: timeout → one retry → success', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'TIMEOUT', retryable: true });
      },
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.metadata.retryCount).toBe(1);
  });

  it('E: non-retryable provider error → zero retry', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'PROVIDER_UNAVAILABLE', retryable: false, httpStatus: 403 });
      },
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(seq.callCount).toBe(1);
    if (!result.ok) expect(result.metadata?.retryCount).toBe(0);
  });

  it('F: retries exhausted → deterministic failure', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('RATE_LIMITED');
    expect(seq.callCount).toBe(2);
  });

  it('G: retry count never exceeds MAX_PROVIDER_RETRIES', async () => {
    const budget = new ProviderCallBudget();
    const providerPort = new FakeAiProviderPort(async () => {
      throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
    });
    await expect(
      executeProviderWithRetry({
        providerPort,
        budget,
        backoffMs: 0,
        sleepFn: noSleep,
        request: {
          operation: 'CONTENT_DRAFT',
          logicalModelRole: 'CREATIVE_WRITING',
          model: {
            role: 'CREATIVE_WRITING',
            providerName: 'openai',
            providerModelId: 'gpt-4o-mini',
            enabled: true,
            maxTokens: 1200,
            temperature: 0.3,
            supportsJsonMode: true,
          },
          structuredJsonRequired: true,
          messages: [{ role: 'user', content: 'x' }],
        },
      })
    ).rejects.toBeInstanceOf(ProviderPortError);
    expect(budget.providerCallCount).toBe(MAX_PROVIDER_RETRIES + 1);
  });

  it('H: provider adapter invocation count matches expected', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'PROVIDER_ERROR', retryable: true, httpStatus: 502 });
      },
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler);
    await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(seq.callCount).toBe(2);
  });

  it('I: backoff uses zero delay in tests', async () => {
    const sleepFn = vi.fn(async () => undefined);
    const providerPort = new FakeAiProviderPort(async () => validContentDraftResponse());
    await executeProviderWithRetry({
      providerPort,
      budget: new ProviderCallBudget(),
      backoffMs: 0,
      sleepFn,
      request: {
        operation: 'CONTENT_DRAFT',
        logicalModelRole: 'CREATIVE_WRITING',
        model: {
          role: 'CREATIVE_WRITING',
          providerName: 'openai',
          providerModelId: 'gpt-4o-mini',
          enabled: true,
          maxTokens: 1200,
          temperature: 0.3,
          supportsJsonMode: true,
        },
        structuredJsonRequired: true,
        messages: [{ role: 'user', content: 'x' }],
      },
    });
    expect(sleepFn).not.toHaveBeenCalled();
  });
});

describe('SPEC-005 Phase 3 — repair (J–S)', () => {
  it('J: valid output → repairCount 0', async () => {
    const gateway = createGateway(new SequenceFakeProvider([validContentDraftResponse]).handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.metadata.repairCount).toBe(0);
  });

  it('K: malformed JSON → repair → valid', async () => {
    const seq = new SequenceFakeProvider([malformedJsonResponse, validContentDraftResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.repairCount).toBe(1);
      expect(result.metadata.validationFailureReason).toBe('INVALID_JSON');
    }
    expect(seq.callCount).toBe(2);
  });

  it('L: schema-invalid JSON → repair → valid', async () => {
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, validContentDraftResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.repairCount).toBe(1);
      expect(result.metadata.validationFailureReason).toBe('SCHEMA_MISMATCH');
    }
  });

  it('M: malformed → repair still malformed → REPAIR_FAILED', async () => {
    const seq = new SequenceFakeProvider([malformedJsonResponse, malformedJsonResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPAIR_FAILED');
    if (!result.ok) expect(result.metadata?.repairCount).toBe(1);
  });

  it('N: schema invalid → repair still invalid → REPAIR_FAILED', async () => {
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, invalidContentDraftSchemaResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REPAIR_FAILED');
  });

  it('O: repairCount never > 1', async () => {
    const seq = new SequenceFakeProvider([
      invalidContentDraftSchemaResponse,
      invalidContentDraftSchemaResponse,
      validContentDraftResponse,
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.metadata?.repairCount).toBe(1);
    expect(seq.callCount).toBe(2);
  });

  it('P: repaired output passes same Zod schema', async () => {
    const seq = new SequenceFakeProvider([malformedJsonResponse, validContentDraftResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(ContentDraftOutputSchema.safeParse(result.data).success).toBe(true);
    }
  });

  it('Q: extra malicious fields still rejected by strict schema after repair attempt', async () => {
    const injected = () => jsonProviderResponse({ title: 'T', body: 'B', injected: true });
    const seq = new SequenceFakeProvider([malformedJsonResponse, injected]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(seq.callCount).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('REPAIR_FAILED');
      expect(result.metadata?.repairCount).toBe(1);
    }
  });

  it('R: caller cannot provide custom repair prompt', () => {
    const registry = new PromptRegistryAdapter();
    const resolved = registry.resolveRepair({
      operation: 'CONTENT_DRAFT',
      schemaIdentity: { schemaId: 'content.draft', schemaVersion: '1' },
      validationIssues: [{ path: 'body', message: 'Required' }],
      invalidOutput: '{"title":"x"}',
    });
    expect(resolved.identity.promptId).toBe(REPAIR_PROMPT_IDENTITY.promptId);
    expect(resolved.identity.promptVersion).toBe(REPAIR_PROMPT_IDENTITY.promptVersion);
    expect(resolved.systemMessage).toMatch(/JSON/);
    expect(resolved.userMessage).not.toMatch(/custom repair instructions/i);
  });

  it('S: repair prompt template hash is stable (version identity)', () => {
    expect(REPAIR_PROMPT_TEMPLATE_HASH).toMatch(/^[a-f0-9]{64}$/);
    expect(computeRepairPromptTemplateHash()).toBe(REPAIR_PROMPT_TEMPLATE_HASH);
    expect(computePromptHash(REPAIR_PROMPT_SYSTEM_MESSAGE, REPAIR_USER_TEMPLATE_CANONICAL)).toBe(
      REPAIR_PROMPT_TEMPLATE_HASH
    );
  });
});

describe('SPEC-005 Phase 3C — repair prompt identity contract', () => {
  const registry = new PromptRegistryAdapter();

  it('A: promptHash exactly 64 hex', () => {
    const resolved = registry.resolveRepair({
      operation: 'CONTENT_DRAFT',
      schemaIdentity: { schemaId: 'content.draft', schemaVersion: '1' },
      validationIssues: [{ path: 'body', message: 'Required' }],
      invalidOutput: '{"title":"x"}',
    });
    expect(resolved.identity.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('B/C/D: same template hash across different runtime contexts', () => {
    const a = registry.resolveRepair({
      operation: 'CONTENT_DRAFT',
      schemaIdentity: { schemaId: 'content.draft', schemaVersion: '1' },
      validationIssues: [{ path: 'body', message: 'Required' }],
      invalidOutput: '{"title":"x"}',
    });
    const b = registry.resolveRepair({
      operation: 'THESIS_CHALLENGE',
      schemaIdentity: { schemaId: 'thesis.challenge', schemaVersion: '1' },
      validationIssues: [{ path: '(parse)', message: 'bad json' }],
      invalidOutput: '{not json',
    });
    expect(a.identity.promptHash).toBe(b.identity.promptHash);
    expect(a.identity.promptHash).toBe(REPAIR_PROMPT_TEMPLATE_HASH);
    expect(a.userMessage).not.toBe(b.userMessage);
  });

  it('E: changed canonical template produces different hash', () => {
    const altered = `${REPAIR_USER_TEMPLATE_CANONICAL}\n<!-- v2 stub -->`;
    const alteredHash = computePromptHash(REPAIR_PROMPT_SYSTEM_MESSAGE, altered);
    expect(alteredHash).not.toBe(REPAIR_PROMPT_TEMPLATE_HASH);
    expect(alteredHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('F: promptVersion remains explicit', () => {
    const resolved = registry.resolveRepair({
      operation: 'CONTENT_DRAFT',
      schemaIdentity: { schemaId: 'content.draft', schemaVersion: '1' },
      validationIssues: [],
      invalidOutput: '{}',
    });
    expect(resolved.identity.promptId).toBe('ai_output_repair');
    expect(resolved.identity.promptVersion).toBe('1');
  });

  it('G: rendered user message is not part of promptHash identity', () => {
    const resolved = registry.resolveRepair({
      operation: 'CONTENT_DRAFT',
      schemaIdentity: { schemaId: 'content.draft', schemaVersion: '1' },
      validationIssues: [{ path: 'body', message: 'Required' }],
      invalidOutput: '{"title":"x"}',
    });
    expect(computePromptHash(resolved.systemMessage, resolved.userMessage)).not.toBe(resolved.identity.promptHash);
  });
});

describe('SPEC-005 Phase 3C — global execution deadline', () => {
  it('deadline prevents retry when remaining budget insufficient', async () => {
    let now = 0;
    const seq = new SequenceFakeProvider([
      () => {
        now = 1;
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      validContentDraftResponse,
    ]);
    const gateway = new ExecuteAiOperation({
      providerPort: new FakeAiProviderPort(seq.handler),
      modelRegistry: new ModelRegistryAdapter(),
      promptRegistry: new PromptRegistryAdapter(),
      retryBackoffMs: 0,
      sleepFn: noSleep,
      providerTimeoutMs: 60_000,
      maxGatewayExecutionMs: 60_000,
      nowFn: () => now,
    });
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.metadata?.retryCount).toBe(0);
    }
    expect(seq.callCount).toBe(1);
  });

  it('deadline prevents repair when remaining budget insufficient', async () => {
    let now = 0;
    const seq = new SequenceFakeProvider([
      () => {
        now = 55_000;
        return malformedJsonResponse();
      },
    ]);
    const gateway = new ExecuteAiOperation({
      providerPort: new FakeAiProviderPort(seq.handler),
      modelRegistry: new ModelRegistryAdapter(),
      promptRegistry: new PromptRegistryAdapter(),
      retryBackoffMs: 0,
      sleepFn: noSleep,
      providerTimeoutMs: 60_000,
      maxGatewayExecutionMs: 60_000,
      nowFn: () => now,
    });
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.metadata?.repairCount).toBe(0);
    }
    expect(seq.callCount).toBe(1);
  });

  it('TIMEOUT distinct from REPAIR_FAILED', async () => {
    let now = 0;
    const seq = new SequenceFakeProvider([
      () => {
        now = 55_000;
        return malformedJsonResponse();
      },
    ]);
    const gateway = new ExecuteAiOperation({
      providerPort: new FakeAiProviderPort(seq.handler),
      modelRegistry: new ModelRegistryAdapter(),
      promptRegistry: new PromptRegistryAdapter(),
      providerTimeoutMs: 60_000,
      maxGatewayExecutionMs: 60_000,
      nowFn: () => now,
      retryBackoffMs: 0,
      sleepFn: noSleep,
    });
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).not.toBe('REPAIR_FAILED');
  });
});

describe('SPEC-005 Phase 3C — retry backoff math', () => {
  it('one retry sleeps once at 250ms base', async () => {
    const { computeProviderRetryDelayMs, maxBackoffPerProviderSequence } = await import(
      '../src/application/ai/resilience/providerRetryPolicy'
    );
    expect(computeProviderRetryDelayMs(0)).toBe(250);
    expect(computeProviderRetryDelayMs(1)).toBe(500);
    expect(maxBackoffPerProviderSequence()).toBe(250);
  });
});

describe('SPEC-005 Phase 3 — global provider-call budget', () => {
  it('worst-case path never exceeds MAX_PROVIDER_CALLS_PER_EXECUTION', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      invalidContentDraftSchemaResponse,
      () => {
        throw throwProviderError({ code: 'PROVIDER_ERROR', retryable: true, httpStatus: 500 });
      },
      invalidContentDraftSchemaResponse,
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    expect(seq.callCount).toBeLessThanOrEqual(MAX_PROVIDER_CALLS_PER_EXECUTION);
    if (!result.ok) {
      expect(result.metadata?.providerCallCount).toBeLessThanOrEqual(MAX_PROVIDER_CALLS_PER_EXECUTION);
    }
  });
});

describe('SPEC-005 Phase 3 — error separation', () => {
  it('rate limit exhausted ≠ REPAIR_FAILED', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED');
      expect(result.error.code).not.toBe('REPAIR_FAILED');
    }
  });

  it('schema invalid after repair ≠ RATE_LIMITED', async () => {
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, invalidContentDraftSchemaResponse]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('REPAIR_FAILED');
      expect(result.error.code).not.toBe('RATE_LIMITED');
    }
  });

  it('timeout exhausted ≠ INVALID_OUTPUT', async () => {
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'TIMEOUT', retryable: true });
      },
      () => {
        throw throwProviderError({ code: 'TIMEOUT', retryable: true });
      },
    ]);
    const gateway = createGateway(seq.handler);
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.code).not.toBe('INVALID_OUTPUT');
    }
  });

  it('model resolution error → no provider calls', async () => {
    const providerPort = new FakeAiProviderPort(async () => validContentDraftResponse());
    const handler = vi.fn(providerPort.complete.bind(providerPort));
    const gateway = new ExecuteAiOperation({
      providerPort: { complete: handler },
      modelRegistry: new ModelRegistryAdapter({
        FAST_STRUCTURED: { role: 'FAST_STRUCTURED', providerName: 'openai', providerModelId: 'x', enabled: false, maxTokens: 1, temperature: 0, supportsJsonMode: true },
        DEEP_REASONING: { role: 'DEEP_REASONING', providerName: 'openai', providerModelId: 'x', enabled: true, maxTokens: 1, temperature: 0, supportsJsonMode: true },
        CREATIVE_WRITING: { role: 'CREATIVE_WRITING', providerName: 'openai', providerModelId: 'x', enabled: false, maxTokens: 1, temperature: 0, supportsJsonMode: true },
      }),
      promptRegistry: new PromptRegistryAdapter(),
      retryBackoffMs: 0,
      sleepFn: noSleep,
    });
    const result = await gateway.execute({
      operation: 'CONTENT_DRAFT',
      tenant: { organizationId: 'org', clientId: 'c1', userId: 'u1', role: 'ADMIN' },
      input: minimalContentDraftGatewayInput(),
      prompt: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MODEL_NOT_RESOLVED');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SPEC-005 Phase 3 — repair eligibility', () => {
  it('validation failures classified repairable vs not', () => {
    const invalidJson = validateAiOutput({ raw: '{bad', schema: ContentDraftOutputSchema });
    const schemaMismatch = validateAiOutput({
      raw: JSON.stringify({ title: 'only' }),
      schema: ContentDraftOutputSchema,
    });
    expect(isValidationRepairEligible(invalidJson)).toBe(true);
    expect(isValidationRepairEligible(schemaMismatch)).toBe(true);
  });
});

describe('SPEC-005 Phase 3 — E2E hexagonal resilience', () => {
  it('invalid CONTENT_DRAFT → repair → valid ValidatedDomainOutput', async () => {
    const seq = new SequenceFakeProvider([malformedJsonResponse, validContentDraftResponse]);
    const gateway = createGateway(seq.handler);
    const result = await handleAiCompleteRequest({
      gateway,
      clientOrganizations,
      auth: { role: 'ADMIN', organizationId: 'org_test', clientId: null },
      body: baseRequest,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.repairCount).toBe(1);
      expect(result.metadata.validationStatus).toBe('VALID');
      expect(result.data).toMatchObject({ title: 'Hello', body: 'World content' });
    }
  });
});

describe('SPEC-005 Phase 3 — provider adapters remain single-attempt', () => {
  it('OpenAiAdapter has no hidden retry loop', () => {
    const source = readFileSync('src/infrastructure/ai/providers/OpenAiAdapter.ts', 'utf8');
    expect(source).not.toMatch(/\bwhile\s*\(/);
    expect(source).not.toMatch(/for\s*\([^)]*retry/i);
  });

  it('AnthropicAdapter has no hidden retry loop', () => {
    const source = readFileSync('src/infrastructure/ai/providers/AnthropicAdapter.ts', 'utf8');
    expect(source).not.toMatch(/\bwhile\s*\(/);
    expect(source).not.toMatch(/for\s*\([^)]*retry/i);
  });
});

describe('SPEC-005 Phase 3 — legacy browser unchanged', () => {
  it('services/ai.ts untouched by Phase 3 gateway work', () => {
    const content = readFileSync('src/services/ai.ts', 'utf8');
    expect(content).not.toMatch(/ExecuteAiOperation/);
    expect(content).not.toMatch(/providerRetryPolicy/);
  });
});
