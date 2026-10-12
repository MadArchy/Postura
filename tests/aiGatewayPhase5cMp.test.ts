import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: () => null,
    getSubscription: () => ({
      plan: 'PRO',
      quotas: { maxMonthlyAiRuns: 1000 },
      monthlyUsage: { aiRuns: 0 },
      features: { comparativeAnalysis: true },
    }),
  },
}));

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      uid: 'admin_uid',
      role: 'ADMIN',
      organizationId: 'org_aurora_01',
      clientId: null,
    }),
  },
}));

vi.mock('../src/firebase/config', () => ({
  FIREBASE_ENABLED: true,
}));

vi.mock('../src/firebase/authBridge', () => ({
  getFirebaseIdToken: async () => 'fake-admin-token',
}));

import { readFileSync } from 'node:fs';
import { ExecuteAiOperation } from '../src/application/ai/use-cases/ExecuteAiOperation';
import { ModelRegistryAdapter } from '../src/infrastructure/ai/registry/ModelRegistryAdapter';
import { PromptRegistryAdapter } from '../src/infrastructure/ai/registry/PromptRegistryAdapter';
import { handleAiCompleteRequest, type ClientOrganizationLookupPort } from '../src/interfaces/ai/handleAiCompleteRequest';
import { AiCompleteHttpClient } from '../src/interfaces/ai/aiCompleteHttpClient';
import { executeComparativeAnalysisViaGateway } from '../src/services/comparativeGateway';
import { mapSignalThesisToComparativeGatewayInput } from '../src/services/mapAnalysisComparativeGatewayInput';
import {
  ANALYSIS_COMPARATIVE_PROMPT_ID,
  ANALYSIS_COMPARATIVE_PROMPT_VERSION,
} from '../src/application/ai/schemas/analysisComparativeInput';
import { ANALYSIS_COMPARATIVE_SCHEMA_ID } from '../src/application/ai/schemas/comparativeAnalysis';
import {
  MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE,
  MAX_COMPARATIVE_PROVIDER_CALLS,
  MAX_GATEWAY_EXECUTION_MS,
} from '../src/domain/ai/constants';
import {
  COMPARATIVE_OPENAI_MODEL_CONFIG,
  COMPARATIVE_ANTHROPIC_MODEL_CONFIG,
} from '../src/infrastructure/ai/registry/modelRegistryConfig';
import { FakeAiRunRepository } from './helpers/fakeAiRunRepository';
import {
  throwProviderError,
  validComparativeSliceResponse,
  invalidComparativeSliceSchemaResponse,
} from './helpers/resilienceFakeProvider';
import { FakeAiProviderPort } from './helpers/fakeAiProvider';
import type { AiProviderCompletionRequest, AiProviderCompletionResponse } from '../src/application/ai/ports/outbound/AiProviderPort';
import type { PositioningThesis, Signal } from '../src/types';

const noSleep = async () => undefined;

const thesisFixture: PositioningThesis = {
  id: 'thesis_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  title: 'AI governance thesis',
  expertIdentity: 'Dr. Juan Analyst',
  domain: 'AI governance',
  targetAudience: 'CIOs',
  voiceAndTone: 'preciso',
  objective: 'thought leadership',
  proofPoints: ['ISO audit'],
  complianceRules: 'No medical claims',
  status: 'DRAFT',
  clientApprovalStatus: 'PENDING',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'admin',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'admin',
};

const signalFixture: Signal = {
  id: 'signal_1',
  organizationId: 'org_aurora_01',
  clientId: 'client_juan_001',
  title: 'EU AI Act update',
  sourceType: 'NEWS_API',
  sourceName: 'Reuters',
  contentSnippet: 'New obligations for high-risk AI systems.',
  fingerprint: 'fp_signal_1',
  detectedAt: '2026-01-01T00:00:00Z',
  status: 'NEW',
  aiStatus: 'PENDING_AI',
  managerDecision: 'UNREVIEWED',
};

/** Routes responses by resolved providerName — proves no cross-provider repair. */
class ProviderRoutingFake {
  openaiCalls = 0;
  anthropicCalls = 0;
  openaiModels: string[] = [];
  anthropicModels: string[] = [];

  constructor(
    private readonly openai: Array<() => Promise<AiProviderCompletionResponse> | AiProviderCompletionResponse | Error>,
    private readonly anthropic: Array<() => Promise<AiProviderCompletionResponse> | AiProviderCompletionResponse | Error>
  ) {}

  handler = async (request: AiProviderCompletionRequest): Promise<AiProviderCompletionResponse> => {
    const provider = request.model.providerName.toLowerCase();
    if (provider === 'openai') {
      this.openaiCalls += 1;
      this.openaiModels.push(request.model.providerModelId);
      return this.next(this.openai, 'openai');
    }
    if (provider === 'anthropic') {
      this.anthropicCalls += 1;
      this.anthropicModels.push(request.model.providerModelId);
      return this.next(this.anthropic, 'anthropic');
    }
    throw throwProviderError({ code: 'PROVIDER_UNAVAILABLE', retryable: false });
  };

  private async next(
    queue: Array<() => Promise<AiProviderCompletionResponse> | AiProviderCompletionResponse | Error>,
    label: string
  ): Promise<AiProviderCompletionResponse> {
    const current = queue.shift();
    if (!current) {
      throw throwProviderError({ code: 'PROVIDER_ERROR', retryable: false });
    }
    const result = await current();
    if (result instanceof Error) throw result;
    return {
      ...result,
      providerName: label === 'openai' ? 'openai' : 'anthropic',
      providerModelId:
        label === 'openai'
          ? COMPARATIVE_OPENAI_MODEL_CONFIG.providerModelId
          : COMPARATIVE_ANTHROPIC_MODEL_CONFIG.providerModelId,
    };
  }
}

function createGateway(
  handler: (request: AiProviderCompletionRequest) => Promise<AiProviderCompletionResponse>,
  repo: FakeAiRunRepository,
  extras?: { nowFn?: () => number; maxGatewayExecutionMs?: number; providerTimeoutMs?: number }
) {
  return new ExecuteAiOperation({
    providerPort: new FakeAiProviderPort(handler),
    modelRegistry: new ModelRegistryAdapter(),
    promptRegistry: new PromptRegistryAdapter(),
    aiRunRepository: repo,
    retryBackoffMs: 0,
    sleepFn: noSleep,
    nowFn: extras?.nowFn,
    maxGatewayExecutionMs: extras?.maxGatewayExecutionMs,
    providerTimeoutMs: extras?.providerTimeoutMs,
  });
}

const clientOrganizations: ClientOrganizationLookupPort = {
  async findOwningOrganizationId(clientId: string) {
    return clientId === 'client_juan_001' ? 'org_aurora_01' : null;
  },
};

function createInProcessFetch(gateway: ExecuteAiOperation) {
  return async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    const response = await handleAiCompleteRequest({
      gateway,
      clientOrganizations,
      auth: {
        role: 'ADMIN',
        organizationId: 'org_aurora_01',
        clientId: null,
        userId: 'admin_uid',
      },
      body: {
        operation: body.operation,
        clientId: body.clientId,
        input: body.input,
        prompt: body.prompt,
      },
    });
    return new Response(JSON.stringify(response), { status: response.ok ? 200 : 502 });
  };
}

function createInProcessClient(gateway: ExecuteAiOperation) {
  return new AiCompleteHttpClient({
    getIdToken: async () => 'fake-admin-token',
    resolveUrl: () => 'in-process://aiComplete',
    fetchFn: createInProcessFetch(gateway),
  });
}

describe('SPEC-005 Phase 5C-MP — model registry comparative plan', () => {
  it('resolves OpenAI + Anthropic Phase-0 verified model IDs', () => {
    const registry = new ModelRegistryAdapter();
    const plan = registry.resolveComparativePlan('ANALYSIS_COMPARATIVE');
    expect(plan.slices).toHaveLength(2);
    expect(plan.slices[0].providerName).toBe('openai');
    expect(plan.slices[0].providerModelId).toBe('gpt-4o-mini');
    expect(plan.slices[1].providerName).toBe('anthropic');
    expect(plan.slices[1].providerModelId).toBe('claude-3-5-haiku-20241022');
  });
});

describe('SPEC-005 Phase 5C-MP — dual success', () => {
  it('validated aggregate + one aiRun; both provider identities preserved', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [() => validComparativeSliceResponse({ angle: 'OpenAI angle', rationale: 'OpenAI rationale' })],
      [() => validComparativeSliceResponse({ angle: 'Claude angle', rationale: 'Claude rationale' })]
    );
    const gateway = createGateway(router.handler, repo);

    let capturedBody = '';
    let capturedHeaders = '';
    const trackedClient = new AiCompleteHttpClient({
      getIdToken: async () => 'token-admin',
      resolveUrl: () => 'in-process://aiComplete',
      fetchFn: async (_url, init) => {
        capturedBody = String(init?.body);
        capturedHeaders = JSON.stringify(init?.headers);
        return createInProcessFetch(gateway)(_url, init);
      },
    });

    const { aggregate, result, metadata } = await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client: trackedClient,
    });

    expect(aggregate.openai.angle).toBe('OpenAI angle');
    expect(aggregate.anthropic.angle).toBe('Claude angle');
    expect(result.openaiOutput).toContain('OpenAI angle');
    expect(result.claudeOutput).toContain('Claude angle');
    expect(metadata.operation).toBe('ANALYSIS_COMPARATIVE');
    expect(metadata.executionMode).toBe('COMPARATIVE');
    expect(metadata.prompt.promptId).toBe(ANALYSIS_COMPARATIVE_PROMPT_ID);
    expect(metadata.schema.schemaId).toBe(ANALYSIS_COMPARATIVE_SCHEMA_ID);
    expect(metadata.providerExecutions).toHaveLength(2);
    expect(metadata.providerExecutions?.[0].provider).toBe('openai');
    expect(metadata.providerExecutions?.[1].provider).toBe('anthropic');

    expect(capturedBody).not.toMatch(/sk-|OPENAI_API_KEY|X-AI-Session|providerModelId|claude-|gpt-4o/i);
    expect(capturedHeaders).not.toMatch(/X-AI-Session/i);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.executionMode).toBe('COMPARATIVE');
    expect(repo.last()?.providerExecutions).toHaveLength(2);
    expect(repo.last()?.providerName).toBeUndefined();
    expect(repo.last()?.executionStatus).toBe('SUCCESS');
    expect(router.openaiCalls).toBe(1);
    expect(router.anthropicCalls).toBe(1);
  });
});

describe('SPEC-005 Phase 5C-MP — provider-preserving repair', () => {
  it('OpenAI invalid → OpenAI repair; Anthropic valid; repair stayed OpenAI', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [invalidComparativeSliceSchemaResponse, () => validComparativeSliceResponse({ angle: 'O repaired', rationale: 'ok' })],
      [() => validComparativeSliceResponse({ angle: 'A ok', rationale: 'ok' })]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    const { aggregate, metadata } = await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(aggregate.openai.angle).toBe('O repaired');
    expect(metadata.providerExecutions?.[0].repairCount).toBe(1);
    expect(metadata.providerExecutions?.[1].repairCount).toBe(0);
    expect(router.openaiModels.every((m) => m === 'gpt-4o-mini')).toBe(true);
    expect(router.anthropicModels.every((m) => m === 'claude-3-5-haiku-20241022')).toBe(true);
    expect(router.openaiCalls).toBe(2);
    expect(router.anthropicCalls).toBe(1);
    expect(repo.saved).toHaveLength(1);
  });

  it('Anthropic invalid → Anthropic repair; OpenAI valid; no OpenAI repair of Anthropic', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [() => validComparativeSliceResponse({ angle: 'O ok', rationale: 'ok' })],
      [invalidComparativeSliceSchemaResponse, () => validComparativeSliceResponse({ angle: 'A repaired', rationale: 'ok' })]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    const { aggregate, metadata } = await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(aggregate.anthropic.angle).toBe('A repaired');
    expect(metadata.providerExecutions?.[0].repairCount).toBe(0);
    expect(metadata.providerExecutions?.[1].repairCount).toBe(1);
    expect(router.anthropicModels.every((m) => m === 'claude-3-5-haiku-20241022')).toBe(true);
    expect(router.openaiCalls).toBe(1);
    expect(router.anthropicCalls).toBe(2);
  });
});

describe('SPEC-005 Phase 5C-MP — technical retries', () => {
  it('OpenAI retryable → OpenAI retry; Anthropic untouched', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [
        () => {
          throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
        },
        () => validComparativeSliceResponse({ angle: 'O after retry', rationale: 'ok' }),
      ],
      [() => validComparativeSliceResponse({ angle: 'A ok', rationale: 'ok' })]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    const { metadata } = await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(metadata.providerExecutions?.[0].retryCount).toBe(1);
    expect(metadata.providerExecutions?.[1].retryCount).toBe(0);
    expect(router.openaiCalls).toBe(2);
    expect(router.anthropicCalls).toBe(1);
  });

  it('Anthropic retryable → Anthropic retry; OpenAI untouched', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [() => validComparativeSliceResponse({ angle: 'O ok', rationale: 'ok' })],
      [
        () => {
          throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
        },
        () => validComparativeSliceResponse({ angle: 'A after retry', rationale: 'ok' }),
      ]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    const { metadata } = await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(metadata.providerExecutions?.[1].retryCount).toBe(1);
    expect(router.anthropicCalls).toBe(2);
    expect(router.openaiCalls).toBe(1);
  });
});

describe('SPEC-005 Phase 5C-MP — one-sided terminal failure', () => {
  it('OpenAI valid + Anthropic RATE_LIMITED exhausted → overall FAILURE; not partial success', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [() => validComparativeSliceResponse({ angle: 'O ok', rationale: 'ok' })],
      [
        () => {
          throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
        },
        () => {
          throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
        },
      ]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    await expect(
      executeComparativeAnalysisViaGateway({
        signal: signalFixture,
        thesis: thesisFixture,
        client,
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    expect(repo.last()?.executionStatus).toBe('FAILED');
    expect(repo.last()?.errorClass).toBe('RATE_LIMITED');
    expect(repo.last()?.providerExecutions?.[0].status).toBe('SUCCESS');
    expect(repo.last()?.providerExecutions?.[1].status).toBe('FAILED');
    expect(repo.last()?.providerExecutions?.[1].errorClass).toBe('RATE_LIMITED');
  });
});

describe('SPEC-005 Phase 5C-MP — repair failed', () => {
  it('one slice remains invalid after repair → REPAIR_FAILED; no legacy fallback', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [invalidComparativeSliceSchemaResponse, invalidComparativeSliceSchemaResponse],
      [() => validComparativeSliceResponse({ angle: 'A ok', rationale: 'ok' })]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    await expect(
      executeComparativeAnalysisViaGateway({
        signal: signalFixture,
        thesis: thesisFixture,
        client,
      })
    ).rejects.toMatchObject({ code: 'REPAIR_FAILED' });
    expect(repo.last()?.errorClass).toBe('REPAIR_FAILED');
    expect(repo.last()?.providerExecutions?.[0].provider).toBe('openai');
    expect(repo.last()?.providerExecutions?.[0].repairCount).toBe(1);
  });
});

describe('SPEC-005 Phase 5C-MP — call budget', () => {
  it('each slice <= 4 and total <= 8', async () => {
    expect(MAX_PROVIDER_CALLS_PER_PROVIDER_SLICE).toBe(4);
    expect(MAX_COMPARATIVE_PROVIDER_CALLS).toBe(8);

    const repo = new FakeAiRunRepository();
    // Worst case success path: invalid+repair for both = 2+2=4 total
    const router = new ProviderRoutingFake(
      [
        invalidComparativeSliceSchemaResponse,
        () => validComparativeSliceResponse({ angle: 'O', rationale: 'ok' }),
      ],
      [
        invalidComparativeSliceSchemaResponse,
        () => validComparativeSliceResponse({ angle: 'A', rationale: 'ok' }),
      ]
    );
    const client = createInProcessClient(createGateway(router.handler, repo));
    const { metadata } = await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(metadata.providerExecutions?.[0].providerCallCount).toBeLessThanOrEqual(4);
    expect(metadata.providerExecutions?.[1].providerCallCount).toBeLessThanOrEqual(4);
    expect(metadata.providerCallCount).toBeLessThanOrEqual(8);
    expect(metadata.providerExecutions?.[0].repairCount).toBeLessThanOrEqual(1);
    expect(metadata.providerExecutions?.[1].repairCount).toBeLessThanOrEqual(1);
  });
});

describe('SPEC-005 Phase 5C-MP — global deadline', () => {
  it('shared 270s deadline blocks further attempts when budget insufficient', async () => {
    let now = 0;
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [
        () => {
          throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
        },
        () => validComparativeSliceResponse({ angle: 'O', rationale: 'ok' }),
      ],
      [() => validComparativeSliceResponse({ angle: 'A', rationale: 'ok' })]
    );
    // After first OpenAI attempt is about to retry, advance clock so retry cannot fit.
    const originalHandler = router.handler;
    let openAiAttempts = 0;
    const wrapped = async (request: AiProviderCompletionRequest) => {
      if (request.model.providerName.toLowerCase() === 'openai') {
        openAiAttempts += 1;
        if (openAiAttempts === 1) {
          now = MAX_GATEWAY_EXECUTION_MS - 1; // remaining < providerTimeout
        }
      }
      return originalHandler(request);
    };

    const client = createInProcessClient(
      createGateway(wrapped, repo, {
        nowFn: () => now,
        maxGatewayExecutionMs: MAX_GATEWAY_EXECUTION_MS,
        providerTimeoutMs: 60_000,
      })
    );

    await expect(
      executeComparativeAnalysisViaGateway({
        signal: signalFixture,
        thesis: thesisFixture,
        client,
      })
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('SPEC-005 Phase 5C-MP — concurrency', () => {
  it('starts both slices concurrently (not fully serialized)', async () => {
    let openaiStarted = false;
    let anthropicStarted = false;
    let bothStartedBeforeResolve = false;
    let resolveOpenAi!: (v: AiProviderCompletionResponse) => void;
    let resolveAnthropic!: (v: AiProviderCompletionResponse) => void;

    const openaiPromise = new Promise<AiProviderCompletionResponse>((r) => {
      resolveOpenAi = r;
    });
    const anthropicPromise = new Promise<AiProviderCompletionResponse>((r) => {
      resolveAnthropic = r;
    });

    const handler = async (request: AiProviderCompletionRequest) => {
      if (request.model.providerName.toLowerCase() === 'openai') {
        openaiStarted = true;
        if (openaiStarted && anthropicStarted) bothStartedBeforeResolve = true;
        return openaiPromise;
      }
      anthropicStarted = true;
      if (openaiStarted && anthropicStarted) bothStartedBeforeResolve = true;
      return anthropicPromise;
    };

    const repo = new FakeAiRunRepository();
    const gateway = createGateway(handler, repo);
    const client = createInProcessClient(gateway);
    const pending = executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });

    // Yield microtasks (bounded; includes the async client-ownership check) so both handlers start
    for (let tick = 0; tick < 20 && !(openaiStarted && anthropicStarted); tick += 1) {
      await Promise.resolve();
    }
    expect(openaiStarted && anthropicStarted).toBe(true);
    expect(bothStartedBeforeResolve).toBe(true);

    resolveOpenAi(
      validComparativeSliceResponse({ angle: 'O', rationale: 'ok' }) as AiProviderCompletionResponse
    );
    resolveAnthropic(
      validComparativeSliceResponse({ angle: 'A', rationale: 'ok' }) as AiProviderCompletionResponse
    );
    // Fix provider names on responses via routing fake would be better — wrap:
    // Actually validComparativeSliceResponse returns providerName: 'fake'. RoutingAiProviderPort
    // doesn't rewrite — our FakeAiProviderPort returns as-is. Audit uses request.model.providerName
    // from slice params in executeComparativeSlice (params.model.providerName), so OK.

    const { metadata } = await pending;
    expect(metadata.providerExecutions).toHaveLength(2);
  });
});

describe('SPEC-005 Phase 5C-MP — session-key-free + legacy path gone', () => {
  it('succeeds without X-AI-Session', async () => {
    const repo = new FakeAiRunRepository();
    const router = new ProviderRoutingFake(
      [() => validComparativeSliceResponse({ angle: 'O', rationale: 'ok' })],
      [() => validComparativeSliceResponse({ angle: 'A', rationale: 'ok' })]
    );
    const headersSeen: string[] = [];
    const gateway = createGateway(router.handler, repo);
    const client = new AiCompleteHttpClient({
      getIdToken: async () => 'token',
      resolveUrl: () => 'in-process://aiComplete',
      fetchFn: async (_url, init) => {
        headersSeen.push(JSON.stringify(init?.headers));
        return createInProcessFetch(gateway)(_url, init);
      },
    });
    await executeComparativeAnalysisViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    for (const h of headersSeen) {
      expect(h).not.toMatch(/X-AI-Session/i);
    }
  });

  it('ai.ts runComparativeAnalysis does not call complete()', () => {
    const source = readFileSync('src/services/ai.ts', 'utf8');
    const comparative = source.slice(
      source.indexOf('runComparativeAnalysis'),
      source.indexOf('generateThesisProposal')
    );
    expect(comparative).not.toMatch(/this\.complete\(/);
    expect(comparative).toMatch(/executeComparativeAnalysisViaGateway/);
  });

  it('complete() and runAgentJson are removed from ai.ts', () => {
    const ai = readFileSync('src/services/ai.ts', 'utf8');
    const advisor = readFileSync('src/services/advisor.ts', 'utf8');
    expect(advisor).not.toMatch(/\brunAgentJson\b/);
    expect(ai).not.toMatch(/\brunAgentJson\b/);
    expect(ai).not.toMatch(/private async complete\b/);
    expect(ai).not.toMatch(/this\.complete\(/);
    expect(ai).not.toMatch(/setSessionKeys|clearSessionKeys|X-AI-Session|\/api\/ai\/complete/);
  });
});

describe('SPEC-005 Phase 5C-MP — browser isolation', () => {
  const forbidden = [
    'OpenAiAdapter',
    'AnthropicAdapter',
    'providerSecrets',
    'serverGatewayComposition',
    'firebase-admin',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'api.openai.com',
    'api.anthropic.com',
  ];

  for (const rel of [
    'services/comparativeGateway.ts',
    'services/mapAnalysisComparativeGatewayInput.ts',
    'services/mapAnalysisComparativeOutput.ts',
    'services/ai.ts',
  ]) {
    it(`${rel} does not import server provider infrastructure`, () => {
      const content = readFileSync(`src/${rel}`, 'utf8');
      for (const token of forbidden) {
        expect(content).not.toMatch(new RegExp(token.replace(/\./g, '\\.')));
      }
    });
  }
});

describe('SPEC-005 Phase 5C-MP — input mapping', () => {
  it('maps bounded comparative input', () => {
    const input = mapSignalThesisToComparativeGatewayInput(signalFixture, thesisFixture);
    expect(input.signalId).toBe('signal_1');
    expect(input.thesisTitle).toContain('governance');
    expect(ANALYSIS_COMPARATIVE_PROMPT_VERSION).toBe('1');
  });
});
