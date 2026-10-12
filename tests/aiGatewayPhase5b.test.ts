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
          }
        : null,
    getMasterProfile: () => ({
      career: { profession: 'AI governance advisor' },
      identity: { selfDescription: 'Evidence-led advisor' },
      goals: { primaryGoal: 'Thought leadership' },
      audience: { targetAudienceDescription: 'CIOs', targetIndustries: ['Tech'] },
      voicePreferences: { complianceGuidelines: 'No medical claims' },
    }),
    getMasterDossier: () => ({
      taglineEn: 'Trusted AI advisor',
      topicsToOwn: ['Governance'],
      differentiators: ['Evidence-led'],
    }),
    getEvidenceVaultByClient: () => [],
    getSignals: () => [],
    updateSignalStatus: vi.fn(),
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
import {
  executeThesisProposalViaGateway,
  executeSignalThesisEvalViaGateway,
  executeThesisChallengeViaGateway,
} from '../src/services/thesisSignalGateway';
import { mapSignalThesisToGatewayInput } from '../src/services/mapSignalThesisEvalGatewayInput';
import { mapThesisToChallengeGatewayInput } from '../src/services/mapThesisChallengeGatewayInput';
import {
  mapClientToThesisProposalGatewayInput,
  mapThesisProposalOutputToEditableFields,
} from '../src/services/mapThesisProposalGatewayInput';
import {
  THESIS_PROPOSAL_PROMPT_ID,
  THESIS_PROPOSAL_PROMPT_VERSION,
  renderThesisProposalUserMessage,
} from '../src/application/ai/schemas/thesisProposalInput';
import {
  SIGNAL_THESIS_EVAL_PROMPT_ID,
  SIGNAL_THESIS_EVAL_PROMPT_VERSION,
} from '../src/application/ai/schemas/signalThesisEvalInput';
import {
  THESIS_CHALLENGE_PROMPT_ID,
  THESIS_CHALLENGE_PROMPT_VERSION,
} from '../src/application/ai/schemas/thesisChallengeInput';
import { THESIS_PROPOSAL_SCHEMA_ID } from '../src/application/ai/schemas/thesisProposal';
import { SIGNAL_THESIS_EVAL_SCHEMA_ID } from '../src/application/ai/schemas/signalThesisEval';
import { THESIS_CHALLENGE_SCHEMA_ID } from '../src/application/ai/schemas/thesisChallenge';
import { FakeAiRunRepository } from './helpers/fakeAiRunRepository';
import {
  SequenceFakeProvider,
  validThesisProposalResponse,
  invalidThesisProposalSchemaResponse,
  validSignalThesisEvalResponse,
  invalidSignalThesisEvalSchemaResponse,
  validThesisChallengeResponse,
  throwProviderError,
} from './helpers/resilienceFakeProvider';
import { FakeAiProviderPort } from './helpers/fakeAiProvider';
import {
  minimalThesisProposalGatewayInput,
  minimalSignalThesisEvalGatewayInput,
} from './helpers/thesisSignalGatewayInput';
import type { PositioningThesis, Signal } from '../src/types';
import { evaluateThesisChallenge, mergeChallengeWithAi } from '../src/domain/thesisChallengeCore';

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

describe('SPEC-005 Phase 5B — input mapping', () => {
  it('maps thesis proposal context into structured gateway input', () => {
    const mapped = mapClientToThesisProposalGatewayInput('client_juan_001');
    expect(mapped).not.toBeNull();
    expect(mapped!.input.name).toContain('Juan');
    expect(renderThesisProposalUserMessage(mapped!.input)).toContain('Usa SOLO credenciales');
  });

  it('maps signal+thesis into bounded SIGNAL_THESIS_EVAL input', () => {
    const input = mapSignalThesisToGatewayInput(signalFixture, thesisFixture);
    expect(input.thesisId).toBe('thesis_1');
    expect(input.signalId).toBe('signal_1');
    expect(input).toEqual(expect.objectContaining(minimalSignalThesisEvalGatewayInput()));
  });

  it('maps thesis into THESIS_CHALLENGE input without approval fields', () => {
    const input = mapThesisToChallengeGatewayInput(thesisFixture);
    expect(input.thesisId).toBe('thesis_1');
    expect(input.title).toBe('AI governance thesis');
    expect(input.proofPoints).toContain('ISO audit');
    expect(input.territories.length).toBeGreaterThan(0);
    expect(JSON.stringify(input)).not.toMatch(/APPROVED|ACTIVE|clientApproval/);
  });
});

describe('SPEC-005 Phase 5B — THESIS_PROPOSAL success', () => {
  it('validated proposal + one aiRun; no browser provider key/model', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validThesisProposalResponse]);
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

    const result = await executeThesisProposalViaGateway({
      clientId: 'client_juan_001',
      client,
    });

    expect(result.output.title).toBe('Governance thesis');
    expect(result.editable.title).toBe('Governance thesis');
    expect(result.metadata.operation).toBe('THESIS_PROPOSAL');
    expect(result.metadata.prompt.promptId).toBe(THESIS_PROPOSAL_PROMPT_ID);
    expect(result.metadata.schema.schemaId).toBe(THESIS_PROPOSAL_SCHEMA_ID);

    expect(capturedBody).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(capturedBody).not.toMatch(/OPENAI_API_KEY|gpt-4o|claude-|X-AI-Session/i);
    expect(capturedHeaders).not.toMatch(/X-AI-Session/i);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.operation).toBe('THESIS_PROPOSAL');
    expect(repo.last()?.organizationId).toBe('org_aurora_01');
    expect(repo.last()?.clientId).toBe('client_juan_001');
  });
});

describe('SPEC-005 Phase 5B — SIGNAL_THESIS_EVAL success', () => {
  it('validated evaluation reaches caller; one aiRun; no provider path', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(new SequenceFakeProvider([validSignalThesisEvalResponse]).handler, repo)
    );
    const { output, metadata } = await executeSignalThesisEvalViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(output.proposedAngle).toContain('Compliance');
    expect(metadata.schema.schemaId).toBe(SIGNAL_THESIS_EVAL_SCHEMA_ID);
    expect(metadata.prompt.promptId).toBe(SIGNAL_THESIS_EVAL_PROMPT_ID);
    expect(metadata.prompt.promptVersion).toBe(SIGNAL_THESIS_EVAL_PROMPT_VERSION);
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.operation).toBe('SIGNAL_THESIS_EVAL');
  });
});

describe('SPEC-005 Phase 5B — THESIS_CHALLENGE success + human approval', () => {
  it('challenge output merges advisory result and does not mutate thesis approval', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(new SequenceFakeProvider([validThesisChallengeResponse]).handler, repo)
    );
    const before = { ...thesisFixture };
    const { output } = await executeThesisChallengeViaGateway({ thesis: thesisFixture, client });
    const heuristic = evaluateThesisChallenge(thesisFixture, []);
    const merged = mergeChallengeWithAi(heuristic, {
      outcome: output.outcome,
      recommendations: output.recommendations,
      riskScore: output.riskScore,
    });

    expect(merged.outcome).toBe('REFINE');
    expect(thesisFixture.status).toBe(before.status);
    expect(thesisFixture.clientApprovalStatus).toBe(before.clientApprovalStatus);
    expect(thesisFixture.status).not.toBe('ACTIVE');
    expect(thesisFixture.clientApprovalStatus).not.toBe('APPROVED');
    expect(repo.saved).toHaveLength(1);
    expect(repo.last()?.operation).toBe('THESIS_CHALLENGE');
  });

  it('proposal editable fields alone cannot mark thesis ACTIVE/APPROVED', () => {
    const mapped = mapClientToThesisProposalGatewayInput('client_juan_001')!;
    const editable = mapThesisProposalOutputToEditableFields(
      {
        title: 'X',
        expertIdentity: 'Y',
        identityCurrent: 'Z',
        perceptionTarget: 'P',
        targetAudience: 'A',
        domain: 'D',
        objective: 'O',
        differentiator: 'Diff',
        proofPoints: ['p'],
        audiences: [{ name: 'A', tier: 'COMMERCIAL', weight: 50 }],
        territories: [{ name: 'T', weight: 50, pillar: 'P' }],
        objectives: [{ kind: 'BUSINESS', weight: 50 }],
        voiceAndTone: 'formal',
        voiceAvoid: [],
        hardBlocks: [],
        softAvoid: [],
        complianceRules: 'rules',
      },
      mapped.fallback
    );
    expect(editable).not.toHaveProperty('status');
    expect(editable).not.toHaveProperty('clientApprovalStatus');
    expect(JSON.stringify(editable)).not.toMatch(/"ACTIVE"|"APPROVED"/);
  });
});

describe('SPEC-005 Phase 5B — repair', () => {
  it('THESIS_PROPOSAL invalid → repair → valid; repairCount=1; one aiRun', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([invalidThesisProposalSchemaResponse, validThesisProposalResponse])
          .handler,
        repo
      )
    );
    const result = await executeThesisProposalViaGateway({ clientId: 'client_juan_001', client });
    expect(result.output.title).toBe('Governance thesis');
    expect(repo.last()?.repairCount).toBe(1);
    expect(repo.last()?.providerCallCount).toBeLessThanOrEqual(4);
    expect(repo.saved).toHaveLength(1);
  });

  it('SIGNAL_THESIS_EVAL invalid → repair → valid', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([
          invalidSignalThesisEvalSchemaResponse,
          validSignalThesisEvalResponse,
        ]).handler,
        repo
      )
    );
    const { output } = await executeSignalThesisEvalViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    expect(output.proposedAngle).toBeTruthy();
    expect(repo.last()?.repairCount).toBe(1);
    expect(repo.saved).toHaveLength(1);
  });
});

describe('SPEC-005 Phase 5B — terminal failure', () => {
  it('REPAIR_FAILED does not invoke legacy complete path', async () => {
    const repo = new FakeAiRunRepository();
    const client = createInProcessClient(
      createGateway(
        new SequenceFakeProvider([
          invalidThesisProposalSchemaResponse,
          invalidThesisProposalSchemaResponse,
        ]).handler,
        repo
      )
    );
    await expect(
      executeThesisProposalViaGateway({ clientId: 'client_juan_001', client })
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
      executeSignalThesisEvalViaGateway({
        signal: signalFixture,
        thesis: thesisFixture,
        client,
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('SPEC-005 Phase 5B — session-key-free + no legacy fallback', () => {
  it('AiCompleteHttpClient succeeds without X-AI-Session for all three ops', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([
      validThesisProposalResponse,
      validSignalThesisEvalResponse,
      validThesisChallengeResponse,
    ]);
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

    await executeThesisProposalViaGateway({ clientId: 'client_juan_001', client });
    await executeSignalThesisEvalViaGateway({
      signal: signalFixture,
      thesis: thesisFixture,
      client,
    });
    await executeThesisChallengeViaGateway({ thesis: thesisFixture, client });

    for (const h of headersSeen) {
      expect(h).not.toMatch(/X-AI-Session/i);
    }
    expect(repo.saved).toHaveLength(3);
  });

  it('migrated ai.ts paths do not call complete() for thesis/signal ops', () => {
    const source = readFileSync('src/services/ai.ts', 'utf8');
    const proposal = source.slice(
      source.indexOf('generateThesisProposal'),
      source.indexOf('challengeThesis')
    );
    const challenge = source.slice(source.indexOf('challengeThesis'), source.indexOf('reviewDraftClaims'));
    const analyze = source.slice(
      source.indexOf('analyzeSignalAgainstThesis'),
      source.indexOf('runComparativeAnalysis')
    );
    expect(proposal).not.toMatch(/this\.complete\(/);
    expect(analyze).not.toMatch(/this\.complete\(/);
    expect(challenge).not.toMatch(/this\.complete\(/);
    expect(proposal).toMatch(/executeThesisProposalViaGateway/);
    expect(analyze).toMatch(/executeSignalThesisEvalViaGateway/);
    expect(challenge).toMatch(/executeThesisChallengeViaGateway/);
  });
});

describe('SPEC-005 Phase 5B — browser isolation', () => {
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
    'services/thesisSignalGateway.ts',
    'services/mapThesisProposalGatewayInput.ts',
    'services/mapSignalThesisEvalGatewayInput.ts',
    'services/mapThesisChallengeGatewayInput.ts',
    'services/ai.ts',
  ]) {
    it(`${rel} does not import server provider infrastructure`, () => {
      const content = readFileSync(`src/${rel}`, 'utf8');
      for (const token of forbidden) {
        expect(content).not.toMatch(new RegExp(token));
      }
    });
  }
});

describe('SPEC-005 Phase 5B — duplicate execution guard (client contract)', () => {
  it('one explicit execute call → one gateway invocation', async () => {
    const repo = new FakeAiRunRepository();
    const seq = new SequenceFakeProvider([validThesisChallengeResponse]);
    const gateway = createGateway(seq.handler, repo);
    let fetchCount = 0;
    const client = new AiCompleteHttpClient({
      getIdToken: async () => 'token',
      resolveUrl: () => 'in-process://aiComplete',
      fetchFn: async (_url, init) => {
        fetchCount += 1;
        return createInProcessFetch(gateway)(_url, init);
      },
    });
    await executeThesisChallengeViaGateway({ thesis: thesisFixture, client });
    expect(fetchCount).toBe(1);
    expect(repo.saved).toHaveLength(1);
  });
});

describe('SPEC-005 Phase 5B — prompt identity', () => {
  it('uses frozen prompt ids/versions', () => {
    // Proposal and challenge are v2: client context moved into an <UNTRUSTED_SOURCE> block.
    expect(THESIS_PROPOSAL_PROMPT_ID).toBe('tmpl_thesis_proposal_v2');
    expect(THESIS_PROPOSAL_PROMPT_VERSION).toBe('2');
    expect(SIGNAL_THESIS_EVAL_PROMPT_ID).toBe('tmpl_strategist_signal_eval_v2');
    expect(SIGNAL_THESIS_EVAL_PROMPT_VERSION).toBe('2');
    expect(THESIS_CHALLENGE_PROMPT_ID).toBe('tmpl_thesis_challenge_v2');
    expect(THESIS_CHALLENGE_PROMPT_VERSION).toBe('2');
    expect(THESIS_CHALLENGE_SCHEMA_ID).toBe('thesis.challenge');
    expect(minimalThesisProposalGatewayInput().proofPoints.length).toBeGreaterThan(0);
  });
});
