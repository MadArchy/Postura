import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/db', () => ({
  dbService: {
    getEvidenceVaultByClient: () => [],
  },
}));

import { readFileSync } from 'node:fs';
import { ExecuteAiOperation } from '../src/application/ai/use-cases/ExecuteAiOperation';
import { ModelRegistryAdapter } from '../src/infrastructure/ai/registry/ModelRegistryAdapter';
import { PromptRegistryAdapter } from '../src/infrastructure/ai/registry/PromptRegistryAdapter';
import { handleAiCompleteRequest, type ClientOrganizationLookupPort } from '../src/interfaces/ai/handleAiCompleteRequest';
import { AiCompleteHttpClient } from '../src/interfaces/ai/aiCompleteHttpClient';
import { mapThesisToContentDraftGatewayInput } from '../src/services/mapContentDraftGatewayInput';
import {
  CONTENT_DRAFT_PROMPT_ID,
  CONTENT_DRAFT_PROMPT_VERSION,
  renderContentDraftUserMessage,
} from '../src/application/ai/schemas/contentDraftInput';
import { CONTENT_DRAFT_SCHEMA_ID } from '../src/application/ai/schemas/contentDraft';
import { FakeAiRunRepository } from './helpers/fakeAiRunRepository';
import {
  SequenceFakeProvider,
  validContentDraftResponse,
  invalidContentDraftSchemaResponse,
  throwProviderError,
} from './helpers/resilienceFakeProvider';
import { FakeAiProviderPort } from './helpers/fakeAiProvider';
import type { PositioningThesis } from '../src/types';
import { readFileSync } from 'node:fs';

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
  proofPoints: ['ISO audit', 'EU AI Act advisory'],
  complianceRules: 'No medical claims',
  status: 'ACTIVE',
  clientApprovalStatus: 'APPROVED',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: 'admin',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: 'admin',
};

function createGateway(handler: SequenceFakeProvider['handler'], repo: FakeAiRunRepository) {
  return new ExecuteAiOperation({
    providerPort: new FakeAiProviderPort(handler),
    modelRegistry: new ModelRegistryAdapter(),
    promptRegistry: new PromptRegistryAdapter(),
    aiRunRepository: repo,
    retryBackoffMs: 0,
    sleepFn: noSleep,
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

describe('SPEC-005 Phase 5A — CONTENT_DRAFT input mapping', () => {
  it('maps thesis context into structured gateway input', () => {
    const input = mapThesisToContentDraftGatewayInput({
      thesis: thesisFixture,
      topicTitle: 'EU AI Act readiness',
      format: 'LINKEDIN_ARTICLE',
      extras: { angle: 'compliance lens' },
    });
    expect(input.topicTitle).toBe('EU AI Act readiness');
    expect(input.format).toBe('LINKEDIN_ARTICLE');
    expect(input.angle).toBe('compliance lens');
    expect(renderContentDraftUserMessage(input)).toContain('EU AI Act readiness');
    expect(renderContentDraftUserMessage(input)).toContain('Dr. Juan Analyst');
  });
});

describe('SPEC-005 Phase 5A — E2E migration (browser client → gateway → audit)', () => {
  it('success path: validated output + one aiRun, no provider secrets in request', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validContentDraftResponse]);
    const gateway = createGateway(seq.handler, repo);
    const input = mapThesisToContentDraftGatewayInput({
      thesis: thesisFixture,
      topicTitle: 'Radar topic',
      format: 'VIDEO_SCRIPT',
    });

    let capturedBody = '';
    let capturedHeaders = '';
    const client = new AiCompleteHttpClient({
      getIdToken: async () => 'token-admin',
      resolveUrl: () => 'in-process://aiComplete',
      fetchFn: async (_url, init) => {
        capturedBody = String(init?.body);
        capturedHeaders = JSON.stringify(init?.headers);
        return createInProcessFetch(gateway)(_url, init);
      },
    });

    const response = await client.execute({
      operation: 'CONTENT_DRAFT',
      clientId: thesisFixture.clientId,
      input,
      prompt: { promptId: CONTENT_DRAFT_PROMPT_ID, promptVersion: CONTENT_DRAFT_PROMPT_VERSION },
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data).toEqual({ title: 'Hello', body: 'World content' });
      expect(response.metadata.operation).toBe('CONTENT_DRAFT');
      expect(response.metadata.prompt.promptId).toBe(CONTENT_DRAFT_PROMPT_ID);
      expect(response.metadata.schema.schemaId).toBe(CONTENT_DRAFT_SCHEMA_ID);
    }

    expect(capturedBody).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(capturedBody).not.toMatch(/OPENAI_API_KEY|gpt-4o|anthropic/i);
    expect(capturedHeaders).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.executionStatus).toBe('SUCCESS');
    expect(repo.last()?.operation).toBe('CONTENT_DRAFT');
    expect(repo.last()?.organizationId).toBe('org_aurora_01');
    expect(repo.last()?.clientId).toBe('client_juan_001');
  });
});

describe('SPEC-005 Phase 5A — repair migration', () => {
  it('invalid output → repair → valid with repairCount=1 and one aiRun', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([invalidContentDraftSchemaResponse, validContentDraftResponse]);
    const client = createInProcessClient(createGateway(seq.handler, repo));
    const response = await client.execute({
      operation: 'CONTENT_DRAFT',
      clientId: thesisFixture.clientId,
      input: mapThesisToContentDraftGatewayInput({
        thesis: thesisFixture,
        topicTitle: 'Repair me',
        format: 'LINKEDIN_ARTICLE',
      }),
      prompt: { promptId: CONTENT_DRAFT_PROMPT_ID, promptVersion: CONTENT_DRAFT_PROMPT_VERSION },
    });
    expect(response.ok).toBe(true);
    expect(repo.last()?.repairCount).toBe(1);
    expect(repo.last()?.providerCallCount).toBeLessThanOrEqual(4);
    expect(repo.saved).toHaveLength(1);
  });
});

describe('SPEC-005 Phase 5A — failure migration', () => {
  it('REPAIR_FAILED returns controlled failure without provider secrets', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      invalidContentDraftSchemaResponse,
      invalidContentDraftSchemaResponse,
    ]);
    const client = createInProcessClient(createGateway(seq.handler, repo));
    await expect(
      client.execute({
        operation: 'CONTENT_DRAFT',
        clientId: thesisFixture.clientId,
        input: mapThesisToContentDraftGatewayInput({
          thesis: thesisFixture,
          topicTitle: 'Fail path',
          format: 'THOUGHT_LEADERSHIP',
        }),
        prompt: { promptId: CONTENT_DRAFT_PROMPT_ID, promptVersion: CONTENT_DRAFT_PROMPT_VERSION },
      })
    ).rejects.toMatchObject({ code: 'REPAIR_FAILED' });
    expect(repo.last()?.errorClass).toBe('REPAIR_FAILED');
  });

  it('does not fall back to legacy /api/ai/complete session path', () => {
    const source = readFileSync('src/services/ai.ts', 'utf8');
    const draftSection = source.slice(source.indexOf('generateContentDraft'));
    expect(draftSection).not.toMatch(/this\.complete\(\s*['"]CONTENT_TASKS/);
    expect(draftSection).toMatch(/executeContentDraftViaGateway/);
  });
});

describe('SPEC-005 Phase 5A — session key independence', () => {
  it('AiCompleteHttpClient succeeds without session key headers', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(new SequenceFakeProvider([validContentDraftResponse]).handler, repo)
    );
    const response = await client.execute({
      operation: 'CONTENT_DRAFT',
      clientId: thesisFixture.clientId,
      input: mapThesisToContentDraftGatewayInput({
        thesis: thesisFixture,
        topicTitle: 'No session',
        format: 'VIDEO_SCRIPT',
      }),
      prompt: { promptId: CONTENT_DRAFT_PROMPT_ID, promptVersion: CONTENT_DRAFT_PROMPT_VERSION },
    });
    expect(response.ok).toBe(true);
  });
});

describe('SPEC-005 Phase 5A — browser bundle isolation', () => {
  const browserPaths = [
    'services/ai.ts',
    'services/contentDraftGateway.ts',
    'interfaces/ai/aiCompleteHttpClient.ts',
    'services/mapContentDraftGatewayInput.ts',
  ];

  for (const rel of browserPaths) {
    it(`${rel} does not import server provider infrastructure`, () => {
      const content = readFileSync(`src/${rel}`, 'utf8');
      expect(content).not.toMatch(/infrastructure\/ai\/providers/);
      expect(content).not.toMatch(/serverGatewayComposition/);
      expect(content).not.toMatch(/firebase-admin/);
      expect(content).not.toMatch(/OPENAI_API_KEY|ANTHROPIC_API_KEY/);
      expect(content).not.toMatch(/VITE_OPENAI|VITE_ANTHROPIC/);
    });
  }
});

describe('SPEC-005 Phase 5A — duplicate execution guard (client contract)', () => {
  it('one explicit execute call → one gateway invocation', async () => {
    const repo = new FakeAiRunRepository();
    let fetchCount = 0;
    const gateway = createGateway(new SequenceFakeProvider([validContentDraftResponse]).handler, repo);
    const client = new AiCompleteHttpClient({
      getIdToken: async () => 'token',
      resolveUrl: () => 'in-process://aiComplete',
      fetchFn: async (_url, init) => {
        fetchCount += 1;
        return createInProcessFetch(gateway)(_url, init);
      },
    });
    await client.execute({
      operation: 'CONTENT_DRAFT',
      clientId: thesisFixture.clientId,
      input: mapThesisToContentDraftGatewayInput({
        thesis: thesisFixture,
        topicTitle: 'once',
        format: 'VIDEO_SCRIPT',
      }),
      prompt: { promptId: CONTENT_DRAFT_PROMPT_ID, promptVersion: CONTENT_DRAFT_PROMPT_VERSION },
    });
    expect(fetchCount).toBe(1);
    expect(repo.saved).toHaveLength(1);
  });
});

describe('SPEC-005 Phase 5A — provider terminal failure', () => {
  it('RATE_LIMITED exhaustion surfaces controlled error', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
      () => {
        throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
      },
    ]);
    const client = createInProcessClient(createGateway(seq.handler, repo));
    await expect(
      client.execute({
        operation: 'CONTENT_DRAFT',
        clientId: thesisFixture.clientId,
        input: mapThesisToContentDraftGatewayInput({
          thesis: thesisFixture,
          topicTitle: 'Rate limit',
          format: 'LINKEDIN_ARTICLE',
        }),
        prompt: { promptId: CONTENT_DRAFT_PROMPT_ID, promptVersion: CONTENT_DRAFT_PROMPT_VERSION },
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
