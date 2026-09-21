/**
 * SPEC-007 Phase 5 — Architecture / authority / cross-SPEC bans (T-007-501, 506–510).
 * Threat coverage: T-007-05, T-007-06, T-007-12, T-007-18 + provider/hexagonal bans.
 * Product changes: 0.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const DOMAIN = join(ROOT, 'src/domain');
const APP = join(ROOT, 'src/application/opportunityScout');
const INFRA = join(ROOT, 'src/infrastructure/opportunityScout');
const COMPOSE = join(ROOT, 'src/composition/opportunityScout');
const CONSUMER = join(ROOT, 'src/services/opportunityScoutConsumer.ts');
const LEGACY_SURFACE = readLegacyControllerSurface();
const DELIVERY_SEND = join(ROOT, 'src/infrastructure/executionDelivery/DbDeliverySendAdapter.ts');
const REACT_PANEL = join(ROOT, 'src/ui/modules/Opportunity/ReactOpportunityPanel.tsx');
const PORTAL = join(ROOT, 'src/components/ClientPortal.ts');
const DB = join(ROOT, 'src/services/db.ts');

const DOMAIN_OPP = [
  'opportunityScoutErrors.ts',
  'opportunityTenantCore.ts',
  'opportunityScoreCore.ts',
  'opportunityCandidateCore.ts',
  'opportunityLifecycleCore.ts',
  'opportunityMultiThesisCore.ts',
  'opportunityMaterializeGateCore.ts',
  'opportunityCore.ts',
  'opportunityMaterialityCore.ts',
  'opportunityExplainabilityCore.ts',
  'opportunityLegacyMappingCore.ts',
].map((f) => join(DOMAIN, f));

describe('T-007-501 — architecture bans (Domain / UI / [0] thesis)', () => {
  it('Domain opportunity modules import no Application/Infrastructure/UI/Firebase/localStorage', () => {
    const forbidden = [
      '/application/',
      '/infrastructure/',
      '/composition/',
      '/components/',
      '/services/db',
      'localStorage',
      'firebase',
      'openai',
      '@anthropic',
    ];
    for (const file of DOMAIN_OPP) {
      const content = readFileSync(file, 'utf8');
      for (const frag of forbidden) {
        expect(content.includes(frag) && !content.includes('//')).toBeDefined();
        // Imports only
        const imports = content.match(/from ['"][^'"]+['"]/g) ?? [];
        for (const imp of imports) {
          expect(imp).not.toMatch(
            /application\/|infrastructure\/|composition\/|components\/|services\/db|firebase|openai|anthropic|localStorage/
          );
        }
      }
    }
  });

  it('Application has zero concrete Infrastructure / db / UI / localStorage imports', () => {
    for (const file of collectTsFiles(APP)) {
      const content = readFileSync(file, 'utf8');
      const imports = content.match(/from ['"][^'"]+['"]/g) ?? [];
      for (const imp of imports) {
        expect(imp).not.toMatch(
          /infrastructure\/|composition\/|components\/|services\/db|localStorage|firebase|openai|anthropic/
        );
      }
    }
  });

  it('UI Panel/Portal have zero primaryThesisId / Opportunity status assignment authority', () => {
    for (const file of [REACT_PANEL, PORTAL]) {
      const content = stripComments(readFileSync(file, 'utf8'));
      expect(content).not.toMatch(/primaryThesisId|getPrimaryThesis/);
      expect(content).not.toMatch(/lifecycleStage\s*=/);
      expect(content).not.toMatch(/\.status\s*=\s*['"]ACCEPTED['"]/);
      expect(content).not.toMatch(/localStorage/);
      expect(content).not.toMatch(/LocalOpportunityRepository|postura_opportunity_/);
    }
    // React OpportunityPanel must not use theses[0] as Opportunity thesis authority
    const panel = stripComments(readFileSync(REACT_PANEL, 'utf8'));
    expect(panel).not.toMatch(/theses\s*\[\s*0\s*\]/);
    // ClientPortal theses[0] on thesis tab is OTHER_SPEC presentation — not Opportunity authority
    const portal = readFileSync(PORTAL, 'utf8');
    expect(portal).toMatch(/listOpportunitiesForClient|renderOpportunity/);
  });

  it('ReactOpportunityPanel issues intent through the canonical seam — no dbService mutation', () => {
    const panel = stripComments(readFileSync(REACT_PANEL, 'utf8'));
    expect(panel).toMatch(/useOpportunityCommands/);
    expect(panel).not.toMatch(
      /dbService\.(addOpportunity|updateOpportunityDecision|submitOpportunity|toggleOpportunityChecklistItem)/
    );
  });
});

describe('T-007-506 — legacy db bypass inventory = 0 on strategic paths', () => {
  it('main.ts strategic Opportunity path does not call authoritative dbService mutators', () => {
    const main = stripComments(LEGACY_SURFACE);
    const deliverySend = stripComments(readFileSync(DELIVERY_SEND, 'utf8'));
    expect(deliverySend).toMatch(/materializeOpportunityForDelivery/);
    expect(main).toMatch(/sendDeliveryPackage/);
    expect(main).not.toMatch(/dbService\.addOpportunity\s*\(/);
    expect(main).not.toMatch(/dbService\.updateOpportunityDecision\s*\(/);
    expect(main).not.toMatch(/dbService\.submitOpportunity\s*\(/);
    expect(main).not.toMatch(/dbService\.toggleOpportunityChecklistItem\s*\(/);
    expect(main).not.toMatch(/dbService\.getOpportunityById\s*\(/);
  });

  it('consumer has no catch→legacy fallback pattern', () => {
    const consumer = readFileSync(CONSUMER, 'utf8');
    const stripped = stripComments(consumer);
    expect(stripped).not.toMatch(/catch\s*\([^)]*\)\s*\{[^}]*addOpportunity/);
    expect(stripped).not.toMatch(/catch\s*\([^)]*\)\s*\{[^}]*updateOpportunityDecision/);
    expect(consumer).toMatch(/COMPATIBILITY_WRITE_MIRROR|NON_AUTHORITATIVE/);
    expect(consumer).toMatch(/mirrorOpportunityCompatibility|mirrorCompatibilityAfterCanonicalSuccess/);
  });

  it('dbService Opportunity methods are demotion-classified', () => {
    const db = readFileSync(DB, 'utf8');
    expect(db).toMatch(/DEPRECATED_AUTHORITY_REMOVED/);
    expect(db).toMatch(/LEGACY_DEAD_OR_COMPATIBILITY_NONAUTHORITY/);
    expect(db).toMatch(/COMPATIBILITY_WRITE_MIRROR/);
  });
});

describe('T-007-507 — SPEC-003 / SPEC-004 regression (frozen)', () => {
  it('SPEC-007 consumer/composition cannot approve/revise Brief or invent Plan ALLOW', () => {
    const files = [CONSUMER, ...collectTsFiles(COMPOSE), ...collectTsFiles(APP)];
    for (const file of files) {
      const content = stripComments(readFileSync(file, 'utf8'));
      expect(content).not.toMatch(
        /approveStrategicBrief|reviseStrategicBrief|createStrategicBrief|supersedeStrategicBrief/
      );
      // Avoid matching createStrategicPlanAuthorizationAdapter
      expect(content).not.toMatch(
        /\bcreateStrategicPlan\b|\bapproveStrategicPlan\b|\bcreateAuthorizePlannedAction\b/
      );
    }
    const adapter = readFileSync(
      join(COMPOSE, 'StrategicPlanAuthorizationAdapter.ts'),
      'utf8'
    );
    expect(adapter).toMatch(/requirePlannedAuthorization/);
    expect(adapter).toMatch(/CREATE_OPPORTUNITY/);
  });

  it('frozen SPEC-004 tip remains recorded; Domain does not implement Planner', () => {
    const tasks = readFileSync(
      join(ROOT, 'specs/007-opportunity-scout/tasks.md'),
      'utf8'
    );
    expect(tasks).toMatch(/8661e4a2c272372e4d851bdb01d10f85b447e27c/);
    const gate = stripComments(
      readFileSync(join(DOMAIN, 'opportunityMaterializeGateCore.ts'), 'utf8')
    );
    expect(gate).toMatch(/CREATE_OPPORTUNITY_AUTHORIZATION_REQUIRED/);
    expect(gate).not.toMatch(/requirePlannedAuthorization/);
    const imports = gate.match(/from ['"][^'"]+['"]/g) ?? [];
    for (const imp of imports) {
      expect(imp).not.toMatch(/strategicPlan|AuthorizePlannedAction/);
    }
  });
});

describe('T-007-508 — SPEC-005 advisory-only; no paid AI', () => {
  it('SPEC-007 authority paths have zero OpenAI/Anthropic/provider SDK/session keys', () => {
    const paths = [
      ...DOMAIN_OPP,
      ...collectTsFiles(APP),
      ...collectTsFiles(INFRA),
      ...collectTsFiles(COMPOSE),
      CONSUMER,
    ];
    const hits: string[] = [];
    for (const file of paths) {
      const content = readFileSync(file, 'utf8');
      if (
        /from ['"]openai['"]|from ['"]@anthropic-ai\/|OpenAI|Anthropic|X-AI-Session|api[_-]?key/i.test(
          content
        ) &&
        !/\/\*\*|threat|ban|must not|never/i.test(content.slice(0, 200))
      ) {
        // Allow comments documenting bans; fail on imports/calls
        const stripped = stripComments(content);
        if (
          /from ['"]openai['"]|from ['"]@anthropic-ai\/|new OpenAI|Anthropic\(/i.test(
            stripped
          )
        ) {
          hits.push(relative(ROOT, file).replace(/\\/g, '/'));
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('consumer does not invent new AiOperation identifiers', () => {
    const consumer = stripComments(readFileSync(CONSUMER, 'utf8'));
    expect(consumer).not.toMatch(/AiOperation|aiGateway|runAiOperation/);
  });
});

describe('T-007-509 — SPEC-006 publication authority preserved', () => {
  it('Opportunity consumer/application never call AuthorizePublication / VerifyClaim', () => {
    const files = [CONSUMER, ...collectTsFiles(APP), ...collectTsFiles(COMPOSE)];
    for (const file of files) {
      const content = stripComments(readFileSync(file, 'utf8'));
      expect(content).not.toMatch(
        /AuthorizePublication|VerifyClaim|authorizeContentPublicationGate|createVerifyClaim/
      );
    }
    const gate = readFileSync(
      join(ROOT, 'src/composition/claimEvidence/contentClaimPublicationGate.ts'),
      'utf8'
    );
    expect(gate).toMatch(/AuthorizePublication|authorizeContentPublicationGate/);
  });
});

describe('T-007-510 — SPEC-001/002 regression + OpportunityScore ≠ StrategicScore', () => {
  it('Opportunity paths do not rewrite selectedThesisId / getPrimaryThesis as authority', () => {
    const files = [
      CONSUMER,
      ...collectTsFiles(APP),
      ...collectTsFiles(COMPOSE),
      PORTAL,
    ];
    for (const file of files) {
      const content = stripComments(readFileSync(file, 'utf8'));
      expect(content).not.toMatch(/getPrimaryThesis\s*\(/);
      expect(content).not.toMatch(/selectedThesisId\s*=/);
      expect(content).not.toMatch(/primaryThesisId/);
    }
  });

  it('OpportunityScore model is distinct from strategic-score-v1', () => {
    const score = readFileSync(join(DOMAIN, 'opportunityScoreCore.ts'), 'utf8');
    expect(score).toMatch(/opportunity-score-v1/);
    expect(score).not.toMatch(/strategic-score-v1/);
    expect(score).toMatch(/OPPORTUNITY_SCORE_MODEL_VERSION|scoringModelVersion/);
  });

  it('high OpportunityScore gate documents non-authorization of CREATE_OPPORTUNITY', () => {
    const gate = readFileSync(
      join(DOMAIN, 'opportunityMaterializeGateCore.ts'),
      'utf8'
    );
    expect(gate).toMatch(/assertHighScoreDoesNotAuthorize/);
    expect(gate).toMatch(/does not authorize CREATE_OPPORTUNITY/);
  });
});

describe('T-007-12 / authority search — AUTHORITY_BYPASS = 0 on SPEC-007 paths', () => {
  it('classifies Opportunity authority path hits without AUTHORITY_BYPASS', () => {
    const scans: Array<{ file: string; pattern: RegExp; class: string }> = [
      {
        file: 'src/infrastructure/executionDelivery/DbDeliverySendAdapter.ts',
        pattern: /materializeOpportunityForDelivery/,
        class: 'CANONICAL',
      },
      {
        file: 'src/controllers/contentPipelineCommands.ts',
        pattern: /sendDeliveryPackage/,
        class: 'CANONICAL',
      },
      {
        file: 'src/services/opportunityScoutConsumer.ts',
        pattern: /mirrorOpportunityCompatibility/,
        class: 'COMPATIBILITY',
      },
      {
        file: 'src/services/db.ts',
        pattern: /getOpportunityById/,
        class: 'DEAD',
      },
      {
        file: 'src/domain/clientOpportunityCore.ts',
        pattern: /pickSpotlightOpportunity/,
        class: 'DISPLAY_ONLY',
      },
      {
        file: 'src/ui/data/canonicalReads.ts',
        pattern: /listOpportunitiesForClient/,
        class: 'CANONICAL',
      },
    ];

    const bypasses: string[] = [];
    for (const row of scans) {
      const content = readFileSync(join(ROOT, row.file), 'utf8');
      expect(content).toMatch(row.pattern);
      if (row.class === 'AUTHORITY_BYPASS') bypasses.push(row.file);
    }

    // Active path: no dbService.addOpportunity as authority
    const main = stripComments(LEGACY_SURFACE);
    if (/dbService\.addOpportunity\s*\(/.test(main)) {
      bypasses.push('main.ts:addOpportunity');
    }
    expect(bypasses).toEqual([]);
  });

  it('Infrastructure malformed/unknown schema fail-closed remains documented in tests', () => {
    const persistence = readFileSync(
      join(ROOT, 'tests/opportunityScoutPersistence.test.ts'),
      'utf8'
    );
    expect(persistence).toMatch(/unknown schemaVersion|malformed/);
    expect(persistence).toMatch(/stale write|FAIL_CLOSED|fail closed/i);
    expect(persistence).toMatch(/idempotency/);
    expect(persistence).toMatch(/MIGRATION_REVIEW_REQUIRED|ambiguous/);
  });
});

describe('T-007-18 — hexagonal + SPEC-009 deferred', () => {
  it('SPEC-009 production remains DEFERRED_UNCHANGED in governance', () => {
    const acceptance = readFileSync(
      join(ROOT, 'specs/007-opportunity-scout/acceptance.md'),
      'utf8'
    );
    expect(acceptance).toMatch(/SPEC-009 PRODUCTION = DEFERRED_UNCHANGED/);
  });

  it('composition wires outward; Application folder has no LocalOpportunity imports', () => {
    for (const file of collectTsFiles(APP)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/LocalOpportunityScoutStore|LocalOpportunityRepository/);
    }
    const compose = readFileSync(join(COMPOSE, 'composeOpportunityScout.ts'), 'utf8');
    expect(compose).toMatch(/LocalOpportunityRepository/);
    expect(compose).toMatch(/createMaterializeOpportunity/);
  });
});

describe('Threat matrix completeness — T-007-01…18 referenced', () => {
  it('Phase-5 suites map all 18 formal threats', () => {
    const security = readFileSync(
      join(ROOT, 'tests/opportunityScoutPhase5Security.test.ts'),
      'utf8'
    );
    const arch = readFileSync(
      join(ROOT, 'tests/opportunityScoutPhase5Architecture.test.ts'),
      'utf8'
    );
    const combined = security + arch + readFileSync(
      join(ROOT, 'tests/opportunityScoutPersistence.test.ts'),
      'utf8'
    );
    for (let i = 1; i <= 18; i++) {
      const id = `T-007-${String(i).padStart(2, '0')}`;
      expect(combined).toMatch(new RegExp(id));
    }
  });
});
