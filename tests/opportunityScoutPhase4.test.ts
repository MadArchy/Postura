/**
 * SPEC-007 Phase 4 — Consumer migration tests (T-007-401…407).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  StrategicPlanAuthorizationDecision,
  StrategicPlanAuthorizationPort,
} from '../src/application/opportunityScout';
import { createLocalOpportunityScoutStore } from '../src/infrastructure/opportunityScout';

const NOW = '2026-08-26T21:00:00.000Z';
const ROOT = process.cwd();

const mirrors: unknown[] = [];

function expectAppError(fn: () => unknown, code?: string) {
  try {
    fn();
    expect.fail('expected OpportunityApplicationError');
  } catch (err) {
    expect(err).toMatchObject({ name: 'OpportunityApplicationError' });
    if (code) expect(err).toMatchObject({ code });
  }
}

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      uid: 'client_user',
      role: 'CLIENT',
      email: 'c@test',
      displayName: 'Client',
      clientId: 'client_a',
      organizationId: 'org_a',
    }),
  },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (id: string) =>
      id === 'client_a' || id === 'client_b'
        ? {
            id,
            organizationId: id === 'client_a' ? 'org_a' : 'org_b',
            name: 'Test',
          }
        : undefined,
    mirrorOpportunityCompatibility: (opp: unknown) => {
      mirrors.push(opp);
    },
    addOpportunity: () => {
      throw new Error('LEGACY_FALLBACK_FORBIDDEN');
    },
    updateOpportunityDecision: () => {
      throw new Error('LEGACY_FALLBACK_FORBIDDEN');
    },
    getOpportunityById: () => {
      throw new Error('ID_ONLY_AUTHORITY_FORBIDDEN');
    },
  },
}));

vi.mock('../src/services/strategicBriefConsumer', () => ({
  getStrategicBrief: (briefId: string, clientId: string) => {
    if (briefId !== 'brief-1' || clientId !== 'client_a') return undefined;
    return {
      id: 'brief-1',
      organizationId: 'org_a',
      clientId: 'client_a',
      thesisId: 'thesis-a',
      version: 2,
      status: 'APPROVED',
    };
  },
}));

function allowDecision(
  over: Partial<StrategicPlanAuthorizationDecision> = {}
): StrategicPlanAuthorizationDecision {
  return {
    disposition: 'ALLOW',
    allowed: true,
    action: 'CREATE_OPPORTUNITY',
    organizationId: 'org_a',
    clientId: 'client_a',
    thesisId: 'thesis-a',
    strategicBriefId: 'brief-1',
    strategicBriefVersion: 2,
    strategicPlanId: 'plan-1',
    strategicPlanVersion: 1,
    planItemId: 'item-1',
    planStatus: 'APPROVED',
    reasons: ['ALLOW'],
    ...over,
  };
}

async function loadConsumer(planAuth: StrategicPlanAuthorizationPort) {
  const mod = await import('../src/services/opportunityScoutConsumer');
  const store = createLocalOpportunityScoutStore();
  store.resetForTest();
  mirrors.length = 0;
  mod.resetOpportunityScoutConsumerForTest(store, { planAuth });
  return mod;
}

describe('SPEC-007 Phase 4 — materialize consumer (T-007-402/405)', () => {
  beforeEach(() => {
    mirrors.length = 0;
    vi.resetModules();
  });

  it('materialize uses Application path and mirrors only after success', async () => {
    const planAuth: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () => allowDecision(),
    };
    const c = await loadConsumer(planAuth);
    const opp = c.materializeOpportunityForDelivery({
      clientId: 'client_a',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 'CLE Panel',
      organization: 'Bar',
      description: 'Talk',
      fitRationale: 'Fit',
      strategicBriefId: 'brief-1',
      intentKey: 'mat-1',
      now: NOW,
    });
    expect(opp.status).toBe('PROPOSED');
    expect(opp.thesisId).toBe('thesis-a');
    expect(mirrors).toHaveLength(1);
    const listed = c.listOpportunitiesForClient('client_a', { now: NOW });
    expect(listed).toHaveLength(1);
    expect(listed[0].authority).toBe('CANONICAL');
  });

  it('SPEC-004 DENY produces no Opportunity and no mirror', async () => {
    const planAuth: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () =>
        allowDecision({ disposition: 'DENY', allowed: false, reasons: ['DENY'] }),
    };
    const c = await loadConsumer(planAuth);
    expectAppError(() =>
      c.materializeOpportunityForDelivery({
        clientId: 'client_a',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        description: 'd',
        fitRationale: 'f',
        strategicBriefId: 'brief-1',
        intentKey: 'deny-1',
        now: NOW,
      })
    );
    expect(mirrors).toHaveLength(0);
    expect(c.listOpportunitiesForClient('client_a', { now: NOW })).toHaveLength(0);
  });

  it('NONE / RESEARCH_ONLY / wrong action produce no Opportunity', async () => {
    for (const disposition of ['NONE', 'RESEARCH_ONLY'] as const) {
      vi.resetModules();
      const planAuth: StrategicPlanAuthorizationPort = {
        authorizeCreateOpportunity: () =>
          allowDecision({
            disposition,
            allowed: false,
            action: disposition,
            reasons: [disposition],
          }),
      };
      const c = await loadConsumer(planAuth);
      expectAppError(() =>
        c.materializeOpportunityForDelivery({
          clientId: 'client_a',
          planId: 'plan-1',
          planItemId: 'item-1',
          thesisId: 'thesis-a',
          title: 't',
          organization: 'o',
          description: 'd',
          fitRationale: 'f',
          strategicBriefId: 'brief-1',
          intentKey: `x-${disposition}`,
          now: NOW,
        })
      );
      expect(mirrors).toHaveLength(0);
    }

    vi.resetModules();
    const wrong: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () =>
        allowDecision({
          disposition: 'ALLOW',
          allowed: true,
          action: 'CREATE_CONTENT',
          reasons: ['wrong'],
        }),
    };
    const c = await loadConsumer(wrong);
    expectAppError(() =>
      c.materializeOpportunityForDelivery({
        clientId: 'client_a',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        description: 'd',
        fitRationale: 'f',
        strategicBriefId: 'brief-1',
        intentKey: 'wrong-action',
        now: NOW,
      })
    );
    expect(mirrors).toHaveLength(0);
  });

  it('high OpportunityScore does not authorize materialize when Plan denies', async () => {
    const planAuth: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () =>
        allowDecision({ disposition: 'DENY', allowed: false, reasons: ['DENY'] }),
    };
    const c = await loadConsumer(planAuth);
    expectAppError(() =>
      c.materializeOpportunityForDelivery({
        clientId: 'client_a',
        planId: 'plan-1',
        planItemId: 'item-1',
        thesisId: 'thesis-a',
        title: 't',
        organization: 'o',
        description: 'd',
        fitRationale: 'f',
        strategicBriefId: 'brief-1',
        intentKey: 'score-deny',
        opportunityScoreTotal: 100,
        now: NOW,
      })
    );
    expect(mirrors).toHaveLength(0);
  });

  it('double materialize with same intentKey is idempotent', async () => {
    const planAuth: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () => allowDecision(),
    };
    const c = await loadConsumer(planAuth);
    const a = c.materializeOpportunityForDelivery({
      clientId: 'client_a',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 't',
      organization: 'o',
      description: 'd',
      fitRationale: 'f',
      strategicBriefId: 'brief-1',
      opportunityId: 'opp-idem',
      intentKey: 'idem-mat',
      now: NOW,
    });
    const before = mirrors.length;
    const b = c.materializeOpportunityForDelivery({
      clientId: 'client_a',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 'other',
      organization: 'o',
      description: 'd',
      fitRationale: 'f',
      strategicBriefId: 'brief-1',
      opportunityId: 'opp-idem-2',
      intentKey: 'idem-mat',
      now: NOW,
    });
    expect(b.id).toBe(a.id);
    expect(c.listOpportunitiesForClient('client_a', { now: NOW })).toHaveLength(1);
    expect(mirrors.length).toBeGreaterThanOrEqual(before);
  });
});

describe('SPEC-007 Phase 4 — lifecycle consumer (T-007-404)', () => {
  beforeEach(() => {
    mirrors.length = 0;
    vi.resetModules();
  });

  async function seedProposed() {
    const planAuth: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () => allowDecision(),
    };
    const c = await loadConsumer(planAuth);
    c.materializeOpportunityForDelivery({
      clientId: 'client_a',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 'Panel',
      organization: 'Org',
      description: 'Desc',
      fitRationale: 'Fit',
      strategicBriefId: 'brief-1',
      opportunityId: 'opp-life',
      intentKey: 'life-1',
      now: NOW,
    });
    return c;
  }

  it('accept / checklist / submit use Application; stale forged status ignored', async () => {
    const c = await seedProposed();
    const accepted = c.acceptClientOpportunity({
      clientId: 'client_a',
      opportunityId: 'opp-life',
      forgedStatus: 'ARCHIVED',
      forgedOpportunity: { status: 'ARCHIVED' },
      actorType: 'AI',
      role: 'ADMIN',
      now: NOW,
    });
    expect(accepted.status).toBe('CHECKLIST');
    expect(accepted.submissionChecklist.length).toBeGreaterThan(0);

    const itemId = accepted.submissionChecklist[0].id;
    const checked = c.toggleClientOpportunityChecklistItem({
      clientId: 'client_a',
      opportunityId: 'opp-life',
      itemId,
      done: true,
      now: NOW,
    });
    expect(checked.status).toBe('CHECKLIST');

    for (const item of checked.submissionChecklist) {
      c.toggleClientOpportunityChecklistItem({
        clientId: 'client_a',
        opportunityId: 'opp-life',
        itemId: item.id,
        done: true,
        now: NOW,
      });
    }
    const submitted = c.submitClientOpportunity({
      clientId: 'client_a',
      opportunityId: 'opp-life',
      forgedStatus: 'PROPOSED',
      now: NOW,
    });
    expect(submitted.status).toBe('SUBMITTED');
  });

  it('decline uses Application; terminal cannot reopen via stale UI accept', async () => {
    const c = await seedProposed();
    c.declineClientOpportunity({
      clientId: 'client_a',
      opportunityId: 'opp-life',
      notes: 'no',
      now: NOW,
    });
    expectAppError(
      () =>
        c.acceptClientOpportunity({
          clientId: 'client_a',
          opportunityId: 'opp-life',
          forgedStatus: 'PROPOSED',
          now: NOW,
        }),
      'TERMINAL_STATE'
    );
  });

  it('caller tenant spoof denied', async () => {
    const c = await seedProposed();
    expectAppError(
      () =>
        c.acceptClientOpportunity({
          clientId: 'client_a',
          opportunityId: 'opp-life',
          claimedOrganizationId: 'org_evil',
          now: NOW,
        }),
      'TENANT_ACCESS_DENIED'
    );
  });

  it('same-id cross-tenant isolated', async () => {
    const planAuth: StrategicPlanAuthorizationPort = {
      authorizeCreateOpportunity: () => allowDecision(),
    };
    const c = await loadConsumer(planAuth);
    c.materializeOpportunityForDelivery({
      clientId: 'client_a',
      planId: 'plan-1',
      planItemId: 'item-1',
      thesisId: 'thesis-a',
      title: 't',
      organization: 'o',
      description: 'd',
      fitRationale: 'f',
      strategicBriefId: 'brief-1',
      opportunityId: 'opp-shared',
      intentKey: 'shared-a',
      now: NOW,
    });
    expectAppError(
      () => c.getOpportunityForClient('client_b', 'opp-shared', { now: NOW }),
      // CR-3: CLIENT entitlement fails closed before store lookup (was OPPORTUNITY_NOT_FOUND).
      'TRUSTED_CONTEXT_REQUIRED'
    );
  });

  it('archive completes lifecycle path via Application', async () => {
    const c = await seedProposed();
    const archived = c.archiveClientOpportunity({
      clientId: 'client_a',
      opportunityId: 'opp-life',
      now: NOW,
    });
    expect(archived.status).toBe('ARCHIVED');
  });
});

describe('SPEC-007 Phase 4 — source scans (T-007-401/403/406/407)', () => {
  it('main.ts delegates delivery materialization to Execution Delivery adapter', () => {
    const main = readLegacyControllerSurface()
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const deliverySend = readFileSync(
      join(ROOT, 'src/infrastructure/executionDelivery/DbDeliverySendAdapter.ts'),
      'utf8'
    );
    expect(deliverySend).toMatch(/materializeOpportunityForDelivery/);
    expect(main).toMatch(/sendDeliveryPackage/);
    expect(main).toMatch(/acceptClientOpportunity/);
    expect(main).toMatch(/declineClientOpportunity/);
    expect(main).toMatch(/submitClientOpportunity/);
    expect(main).toMatch(/toggleClientOpportunityChecklistItem/);
    expect(main).not.toMatch(/dbService\.addOpportunity\s*\(/);
    expect(main).not.toMatch(/dbService\.updateOpportunityDecision\s*\(/);
    expect(main).not.toMatch(/dbService\.submitOpportunity\s*\(/);
    expect(main).not.toMatch(/dbService\.toggleOpportunityChecklistItem\s*\(/);
    expect(main).not.toMatch(/dbService\.getOpportunityById\s*\(/);
  });

  it('OpportunityPanel / ClientPortal do not mutate lifecycle via dbService', () => {
    const content = readFileSync(join(ROOT, 'src/components/ClientPortal.ts'), 'utf8');
    expect(content).not.toMatch(/dbService\.(addOpportunity|updateOpportunityDecision|submitOpportunity|toggleOpportunityChecklistItem)/);
    expect(content).not.toMatch(/status\s*=\s*['"]ACCEPTED['"]/);
    expect(content).not.toMatch(/lifecycleStage\s*=/);
  });

  it('composition wires Application to Infrastructure adapters', () => {
    const compose = readFileSync(
      join(ROOT, 'src/composition/opportunityScout/composeOpportunityScout.ts'),
      'utf8'
    );
    expect(compose).toMatch(/createMaterializeOpportunity/);
    expect(compose).toMatch(/LocalOpportunityRepository/);
    expect(compose).toMatch(/createAcceptOpportunity/);
    expect(compose).not.toMatch(/OpenAI|Anthropic|fetch\s*\(/);
  });

  it('dbService Opportunity methods are demotion-marked', () => {
    const db = readFileSync(join(ROOT, 'src/services/db.ts'), 'utf8');
    expect(db).toMatch(/DEPRECATED_AUTHORITY_REMOVED/);
    expect(db).toMatch(/LEGACY_DEAD_OR_COMPATIBILITY_NONAUTHORITY/);
    expect(db).toMatch(/COMPATIBILITY_WRITE_MIRROR/);
    expect(db).toMatch(/mirrorOpportunityCompatibility/);
  });

  it('consumer has zero AuthorizePublication / Brief mutation / provider calls', () => {
    const consumer = readFileSync(
      join(ROOT, 'src/services/opportunityScoutConsumer.ts'),
      'utf8'
    );
    expect(consumer).not.toMatch(/AuthorizePublication|VerifyClaim|approveStrategicBrief|reviseStrategicBrief/);
    expect(consumer).not.toMatch(/OpenAI|Anthropic|fetch\s*\(/);
    expect(consumer).toMatch(/softwareAuthority/);
    expect(consumer).toMatch(/COMPATIBILITY_WRITE_MIRROR|NON_AUTHORITATIVE/);
  });

  it('no primaryThesisId / theses[0] authority in Phase-4 consumer paths', () => {
    const files = [
      'src/services/opportunityScoutConsumer.ts',
      'src/composition/opportunityScout/composeOpportunityScout.ts',
    ];
    for (const rel of files) {
      const content = readFileSync(join(ROOT, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(content).not.toMatch(/primaryThesisId/);
      expect(content).not.toMatch(/theses\s*\[\s*0\s*\]/);
      expect(content).not.toMatch(/highest OpportunityScore|OpportunityScore\s*→/);
    }
  });
});
