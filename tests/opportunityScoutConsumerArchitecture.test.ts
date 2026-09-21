/**
 * SPEC-007 Phase 4 — Consumer architecture bans (T-007-407).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const LEGACY_SURFACE = readLegacyControllerSurface();
const DELIVERY_SEND = join(ROOT, 'src/infrastructure/executionDelivery/DbDeliverySendAdapter.ts');
const COMPONENTS = join(ROOT, 'src/components');
const CONSUMER = join(ROOT, 'src/services/opportunityScoutConsumer.ts');
const COMPOSE = join(ROOT, 'src/composition/opportunityScout');
const APP = join(ROOT, 'src/application/opportunityScout');

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

describe('SPEC-007 Phase 4 — consumer architecture (T-007-407)', () => {
  it('Application does not import Infrastructure or composition', () => {
    for (const file of collectTsFiles(APP)) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from ['"].*\/infrastructure\//);
      expect(content).not.toMatch(/from ['"].*\/composition\//);
      expect(content).not.toMatch(/from ['"].*\/services\/db/);
      expect(content).not.toMatch(/localStorage/);
    }
  });

  it('UI components do not import LocalOpportunityScoutStore / posture keys directly', () => {
    const hits: string[] = [];
    for (const file of collectTsFiles(COMPONENTS)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      if (
        content.includes('LocalOpportunityScoutStore') ||
        content.includes('LocalOpportunityRepository') ||
        content.includes('postura_opportunity_')
      ) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });

  it('main.ts does not open canonical opportunity store keys', () => {
    const main = LEGACY_SURFACE;
    const deliverySend = readFileSync(DELIVERY_SEND, 'utf8');
    expect(main).not.toMatch(/postura_opportunity_|LocalOpportunityScoutStore/);
    expect(deliverySend).toMatch(/materializeOpportunityForDelivery/);
    expect(main).toMatch(/sendDeliveryPackage/);
  });

  it('consumer facade documents non-authority of caller claims and compatibility mirror', () => {
    const content = readFileSync(CONSUMER, 'utf8');
    expect(content).toMatch(/never from UI|Trusted context/i);
    expect(content).toMatch(/COMPATIBILITY_WRITE_MIRROR|NON_AUTHORITATIVE/);
    expect(content).toMatch(/forgedPlan|forgedOpportunity|forgedStatus/);
    expect(content).not.toMatch(/OpenAI|Anthropic|fetch\s*\(/);
  });

  it('composition wires Application use cases to ports via infrastructure adapters', () => {
    const compose = readFileSync(join(COMPOSE, 'composeOpportunityScout.ts'), 'utf8');
    expect(compose).toMatch(/createMaterializeOpportunity/);
    expect(compose).toMatch(/LocalOpportunityRepository/);
    expect(compose).toMatch(/LocalOpportunityCandidateRepository/);
    expect(compose).toMatch(/createAcceptOpportunity/);
  });

  it('SPEC-006 AuthorizePublication composition remains present; Opportunity consumer does not own it', () => {
    const gate = readFileSync(
      join(ROOT, 'src/composition/claimEvidence/contentClaimPublicationGate.ts'),
      'utf8'
    );
    expect(gate).toMatch(/authorizeContentPublicationGate|AuthorizePublication/);
    const consumer = readFileSync(CONSUMER, 'utf8');
    expect(consumer).not.toMatch(/AuthorizePublication|VerifyClaim/);
  });

  it('no direct provider SDK in Phase-4 opportunity composition/consumer', () => {
    const files = [CONSUMER, ...collectTsFiles(COMPOSE)];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from ['"]openai['"]|from ['"]@anthropic-ai\//);
      expect(content).not.toMatch(/fetch\s*\(\s*['"]https?:\/\//);
    }
  });

  it('active SPEC-007 consumer paths have zero id-only getOpportunityById authority', () => {
    const main = LEGACY_SURFACE
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(main).not.toMatch(/getOpportunityById\s*\(/);
    const portal = readFileSync(join(ROOT, 'src/components/ClientPortal.ts'), 'utf8');
    expect(portal).not.toMatch(/getOpportunityById/);
  });
});
