import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (clientId: string) =>
      clientId === 'client_juan_001'
        ? {
            id: 'client_juan_001',
            organizationId: 'org_aurora_01',
            displayName: 'Dr. Juan Analyst',
            firstName: 'Juan',
            profession: 'Advisor',
            targetMarket: 'Enterprise',
            profileCompleteness: 70,
            onboardingStatus: 'COMPLETED',
          }
        : null,
    getPrimaryThesis: () => ({
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
    }),
    getMasterProfile: () => null,
    getEvidenceVaultByClient: () => [],
    getResultsByClient: () => [],
    getSignalsByClient: () => [],
    saveAdvice: vi.fn(),
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

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/topics', () => ({
  buildTopics: () => [],
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
import {
  executeAdvisorCurationAngleViaGateway,
  executeAdvisorPositioningViaGateway,
} from '../src/services/advisorGateway';
import { mapAdvisorPositioningToGatewayInput } from '../src/services/mapAdvisorPositioningGatewayInput';
import { mapCurationAngleToGatewayInput } from '../src/services/mapAdvisorCurationAngleGatewayInput';
import { mapAdvisorPositioningOutputToLiveAdvice } from '../src/services/mapAdvisorPositioningOutput';
import {
  ADVISOR_POSITIONING_PROMPT_ID,
  ADVISOR_POSITIONING_PROMPT_VERSION,
  renderAdvisorPositioningUserMessage,
} from '../src/application/ai/schemas/advisorPositioningInput';
import {
  ADVISOR_CURATION_ANGLE_PROMPT_ID,
  ADVISOR_CURATION_ANGLE_PROMPT_VERSION,
} from '../src/application/ai/schemas/advisorCurationAngleInput';
import { ADVISOR_POSITIONING_SCHEMA_ID } from '../src/application/ai/schemas/advisorPositioning';
import { ADVISOR_CURATION_ANGLE_SCHEMA_ID } from '../src/application/ai/schemas/advisorCurationAngle';
import { FakeAiRunRepository } from './helpers/fakeAiRunRepository';
import {
  SequenceFakeProvider,
  validAdvisorPositioningResponse,
  invalidAdvisorPositioningSchemaResponse,
  validAdvisorCurationAngleResponse,
  invalidAdvisorCurationAngleSchemaResponse,
  throwProviderError,
} from './helpers/resilienceFakeProvider';
import { FakeAiProviderPort } from './helpers/fakeAiProvider';
import { minimalAdvisorPositioningSource } from './helpers/advisorGatewayInput';
import type { PositioningThesis } from '../src/types';

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

describe('SPEC-005 Phase 5C — input mapping', () => {
  it('maps advisor positioning context into bounded gateway input', () => {
    const source = minimalAdvisorPositioningSource();
    const input = mapAdvisorPositioningToGatewayInput(source);
    expect(input.client.profession).toBe('Advisor');
    expect(input.thesis?.title).toBe('AI governance thesis');
    expect(renderAdvisorPositioningUserMessage(input)).toContain('asesor senior');
    expect(renderAdvisorPositioningUserMessage(input)).toContain('description');
  });

  it('maps curation angle params without approval fields', () => {
    const input = mapCurationAngleToGatewayInput({
      thesis: thesisFixture,
      title: 'EU AI Act update',
      snippet: 'New obligations for high-risk AI systems.',
    });
    expect(input.thesisTitle).toBe('AI governance thesis');
    expect(input.signalTitle).toBe('EU AI Act update');
    expect(JSON.stringify(input)).not.toMatch(/APPROVED|ACTIVE/);
  });
});

describe('SPEC-005 Phase 5C — ADVISOR_POSITIONING success', () => {
  it('validated advice + one aiRun; no browser provider key/model', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validAdvisorPositioningResponse]);
    const gateway = createGateway(seq.handler, repo);

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

    const source = minimalAdvisorPositioningSource();
    const result = await executeAdvisorPositioningViaGateway({
      clientId: 'client_juan_001',
      source,
      client,
    });

    expect(result.output.summary).toContain('Autoridad');
    expect(result.liveAdvice.actions?.length).toBe(1);
    expect(result.metadata.operation).toBe('ADVISOR_POSITIONING');
    expect(result.metadata.prompt.promptId).toBe(ADVISOR_POSITIONING_PROMPT_ID);
    expect(result.metadata.schema.schemaId).toBe(ADVISOR_POSITIONING_SCHEMA_ID);

    expect(capturedBody).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(capturedBody).not.toMatch(/OPENAI_API_KEY|gpt-4o|claude-|X-AI-Session|providerModelId/i);
    expect(capturedHeaders).not.toMatch(/X-AI-Session/i);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.operation).toBe('ADVISOR_POSITIONING');
    expect(repo.last()?.organizationId).toBe('org_aurora_01');
    expect(repo.last()?.clientId).toBe('client_juan_001');
  });
});

describe('SPEC-005 Phase 5C — ADVISOR_CURATION_ANGLE success', () => {
  it('validated angle reaches caller; one aiRun; no provider path', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(new SequenceFakeProvider([validAdvisorCurationAngleResponse]).handler, repo)
    );
    const { output, metadata } = await executeAdvisorCurationAngleViaGateway({
      thesis: thesisFixture,
      title: 'EU AI Act update',
      snippet: 'New obligations.',
      client,
    });
    expect(output.angle).toContain('CIOs');
    expect(metadata.schema.schemaId).toBe(ADVISOR_CURATION_ANGLE_SCHEMA_ID);
    expect(metadata.prompt.promptId).toBe(ADVISOR_CURATION_ANGLE_PROMPT_ID);
    expect(metadata.prompt.promptVersion).toBe(ADVISOR_CURATION_ANGLE_PROMPT_VERSION);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.operation).toBe('ADVISOR_CURATION_ANGLE');
  });
});

describe('SPEC-005 Phase 5C — advisory governance', () => {
  it('positioning output alone cannot approve thesis or mutate governed state', () => {
    const live = mapAdvisorPositioningOutputToLiveAdvice({
      summary: 'Advice only',
      diagnosis: { strengths: ['x'], gaps: ['y'], risks: ['z'] },
      actions: [{ title: 'Act', description: 'Do it', category: 'CONTENT', horizon: 'DAYS_30', priority: 70 }],
    });
    expect(live).not.toHaveProperty('status');
    expect(live).not.toHaveProperty('clientApprovalStatus');
    expect(JSON.stringify(live)).not.toMatch(/"ACTIVE"|"APPROVED"|"PUBLISHED"/);
  });

  it('curation angle output is advisory text only', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(new SequenceFakeProvider([validAdvisorCurationAngleResponse]).handler, repo)
    );
    const before = { ...thesisFixture };
    const { output } = await executeAdvisorCurationAngleViaGateway({
      thesis: thesisFixture,
      title: 'EU AI Act update',
      snippet: 'New obligations.',
      client,
    });
    expect(output.angle).toBeTruthy();
    expect(output).not.toHaveProperty('status');
    expect(thesisFixture.status).toBe(before.status);
    expect(thesisFixture.clientApprovalStatus).toBe(before.clientApprovalStatus);
  });
});

describe('SPEC-005 Phase 5C — repair', () => {
  it('ADVISOR_POSITIONING invalid → repair → valid; repairCount=1; one aiRun', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([invalidAdvisorPositioningSchemaResponse, validAdvisorPositioningResponse]).handler,
        repo
      )
    );
    const result = await executeAdvisorPositioningViaGateway({
      clientId: 'client_juan_001',
      source: minimalAdvisorPositioningSource(),
      client,
    });
    expect(result.output.summary).toContain('Autoridad');
    expect(repo.last()?.repairCount).toBe(1);
    expect(repo.last()?.providerCallCount).toBeLessThanOrEqual(4);
    expect(repo.saved).toHaveLength(1);
  });

  it('ADVISOR_CURATION_ANGLE invalid → repair → valid', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([
          invalidAdvisorCurationAngleSchemaResponse,
          validAdvisorCurationAngleResponse,
        ]).handler,
        repo
      )
    );
    const { output } = await executeAdvisorCurationAngleViaGateway({
      thesis: thesisFixture,
      title: 'Signal',
      snippet: 'Snippet',
      client,
    });
    expect(output.angle).toBeTruthy();
    expect(repo.last()?.repairCount).toBe(1);
    expect(repo.saved).toHaveLength(1);
  });
});

describe('SPEC-005 Phase 5C — terminal failure', () => {
  it('REPAIR_FAILED does not invoke legacy runAgentJson/complete', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([
          invalidAdvisorPositioningSchemaResponse,
          invalidAdvisorPositioningSchemaResponse,
        ]).handler,
        repo
      )
    );
    await expect(
      executeAdvisorPositioningViaGateway({
        clientId: 'client_juan_001',
        source: minimalAdvisorPositioningSource(),
        client,
      })
    ).rejects.toMatchObject({ code: 'REPAIR_FAILED' });
    expect(repo.last()?.errorClass).toBe('REPAIR_FAILED');
  });

  it('RATE_LIMITED exhaustion surfaces controlled error', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([
          () => {
            throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
          },
          () => {
            throw throwProviderError({ code: 'RATE_LIMITED', retryable: true, httpStatus: 429 });
          },
        ]).handler,
        repo
      )
    );
    await expect(
      executeAdvisorCurationAngleViaGateway({
        thesis: thesisFixture,
        title: 'Signal',
        snippet: 'Snippet',
        client,
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('SPEC-005 Phase 5C — session-key-free + no legacy fallback', () => {
  it('AiCompleteHttpClient succeeds without X-AI-Session for advisor ops', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validAdvisorPositioningResponse, validAdvisorCurationAngleResponse]);
    const gateway = createGateway(seq.handler, repo);
    const headersSeen: string[] = [];
    const client = new AiCompleteHttpClient({
      getIdToken: async () => 'token',
      resolveUrl: () => 'in-process://aiComplete',
      fetchFn: async (_url, init) => {
        headersSeen.push(JSON.stringify(init?.headers));
        return createInProcessFetch(gateway)(_url, init);
      },
    });

    await executeAdvisorPositioningViaGateway({
      clientId: 'client_juan_001',
      source: minimalAdvisorPositioningSource(),
      client,
    });
    await executeAdvisorCurationAngleViaGateway({
      thesis: thesisFixture,
      title: 'Signal',
      snippet: 'Snippet',
      client,
    });

    for (const h of headersSeen) {
      expect(h).not.toMatch(/X-AI-Session/i);
    }
    expect(repo.saved).toHaveLength(2);
  });

  it('advisor.ts does not call runAgentJson', () => {
    const source = readFileSync('src/services/advisor.ts', 'utf8');
    expect(source).not.toMatch(/runAgentJson/);
    expect(source).toMatch(/executeAdvisorPositioningViaGateway/);
    expect(source).toMatch(/executeAdvisorCurationAngleViaGateway/);
  });
});

describe('SPEC-005 Phase 5C — ANALYSIS_COMPARATIVE semantic gate', () => {
  it('documents MULTI_PROVIDER_COMPARISON; migration handled in Phase 5C-MP', () => {
    const source = readFileSync('src/services/ai.ts', 'utf8');
    const comparative = source.slice(
      source.indexOf('runComparativeAnalysis'),
      source.indexOf('generateThesisProposal')
    );
    expect(comparative).toMatch(/executeComparativeAnalysisViaGateway/);
    expect(comparative).not.toMatch(/this\.complete\(/);
  });
});

describe('SPEC-005 Phase 5C — browser isolation', () => {
  const forbidden = [
    'OpenAiAdapter',
    'AnthropicAdapter',
    'providerSecrets',
    'serverGatewayComposition',
    'firebase-admin',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
  ];

  for (const rel of [
    'services/advisorGateway.ts',
    'services/mapAdvisorPositioningGatewayInput.ts',
    'services/mapAdvisorCurationAngleGatewayInput.ts',
    'services/mapAdvisorPositioningOutput.ts',
    'services/advisor.ts',
  ]) {
    it(`${rel} does not import server provider infrastructure`, () => {
      const content = readFileSync(`src/${rel}`, 'utf8');
      for (const token of forbidden) {
        expect(content).not.toMatch(new RegExp(token));
      }
    });
  }
});

describe('SPEC-005 Phase 5C — prompt identity', () => {
  it('uses frozen prompt ids/versions', () => {
    expect(ADVISOR_POSITIONING_PROMPT_ID).toBe('tmpl_positioning_advisor_v1');
    expect(ADVISOR_POSITIONING_PROMPT_VERSION).toBe('1');
    expect(ADVISOR_CURATION_ANGLE_PROMPT_ID).toBe('tmpl_curation_angle_v1');
    expect(ADVISOR_CURATION_ANGLE_PROMPT_VERSION).toBe('1');
    expect(ADVISOR_POSITIONING_SCHEMA_ID).toBe('advisor.positioning');
    expect(ADVISOR_CURATION_ANGLE_SCHEMA_ID).toBe('advisor.curationAngle');
  });
});
