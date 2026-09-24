import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  resolveRoutedThesisFromSignal,
  resolveThesisForSignalOperation,
} from '../src/domain/routedThesisContext';
import type { PositioningThesis, Signal } from '../src/types';

const ROOT = process.cwd();
const NOW = '2026-08-24T00:00:00.000Z';

function makeThesis(overrides: Partial<PositioningThesis>): PositioningThesis {
  return {
    id: 'thesis_x',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Tesis',
    expertIdentity: 'Attorney',
    targetAudience: 'GC',
    domain: 'Legal',
    objective: 'Business',
    proofPoints: [],
    voiceAndTone: '',
    complianceRules: '',
    status: 'ACTIVE',
    clientApprovalStatus: 'APPROVED',
    createdAt: NOW,
    createdBy: 'system',
    updatedAt: NOW,
    updatedBy: 'system',
    priority: 50,
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 'sig_1',
    organizationId: 'org_test',
    clientId: 'client_test',
    title: 'Signal',
    contentSnippet: 'snippet',
    sourceName: 'Source',
    sourceType: 'REGULATORY',
    fingerprint: 'fp',
    status: 'NEW',
    aiStatus: 'PENDING',
    managerDecision: 'UNREVIEWED',
    detectedAt: NOW,
    ...overrides,
  } as Signal;
}

const STRATEGIC_MODULES = [
  'src/services/advisor.ts',
  'src/services/topicAgent.ts',
  'src/services/researchSignalsAgent.ts',
  'src/components/ClientWorkspace.ts',
  'src/ui/legacy/LegacyApp.ts',
];

describe('SPEC-001 Phase 4 — routed thesis consumers', () => {
  it('CLEAR signal resolves selected thesis', () => {
    const theses = [makeThesis({ id: 'A' }), makeThesis({ id: 'B' })];
    const signal = makeSignal({
      thesisId: 'B',
      routingDecision: { source: 'AUTO', routingState: 'CLEAR' },
    });
    expect(resolveRoutedThesisFromSignal(signal)).toEqual({
      status: 'CLEAR',
      thesisId: 'B',
    });
    const resolved = resolveThesisForSignalOperation(signal, theses);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.thesis.id).toBe('B');
  });

  it('CONTESTED does not fabricate thesis', () => {
    const theses = [makeThesis({ id: 'A' }), makeThesis({ id: 'B' })];
    const signal = makeSignal({
      thesisId: undefined,
      routingDecision: { source: 'AUTO', routingState: 'CONTESTED', contested: true },
    });
    expect(resolveRoutedThesisFromSignal(signal).status).toBe('CONTESTED');
    const resolved = resolveThesisForSignalOperation(signal, theses);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toBe('CONTESTED');
  });

  it('UNROUTED does not fabricate thesis', () => {
    const theses = [makeThesis({ id: 'A' })];
    const signal = makeSignal({
      thesisId: undefined,
      routingDecision: { source: 'AUTO', routingState: 'UNROUTED' },
    });
    const resolved = resolveThesisForSignalOperation(signal, theses);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error).toBe('UNROUTED');
  });

  it('topic ranking accepts multi-thesis without requiring primary', async () => {
    const { rankDailyTopics } = await import('../src/domain/topicAgent');
    const theses = [
      makeThesis({ id: 'A', title: 'Gobernanza IA', domain: 'Legal tech', proofPoints: ['gobernanza'] }),
      makeThesis({ id: 'B', title: 'Patentes', domain: 'IP', proofPoints: ['patentes'] }),
    ];
    const items = rankDailyTopics(
      'client_test',
      [
        makeSignal({
          id: 'a',
          title: 'Gobernanza de inteligencia artificial',
          relevanceScore: 88,
        }),
      ],
      theses,
      3
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].rationale.length).toBeGreaterThan(5);
  });
});

describe('SPEC-001 Phase 4 — strategic module primary ban', () => {
  it('migrated strategic modules do not call getPrimaryThesis or activeTheses[0]', () => {
    const violations: string[] = [];
    for (const rel of STRATEGIC_MODULES) {
      const content = readFileSync(join(ROOT, rel), 'utf8');
      if (/\.getPrimaryThesis\(/.test(content)) {
        violations.push(`${rel}: getPrimaryThesis`);
      }
      if (/getActiveTheses\([^)]*\)\[0\]/.test(content)) {
        violations.push(`${rel}: getActiveTheses()[0]`);
      }
      if (/activeTheses\[0\]/.test(content)) {
        violations.push(`${rel}: activeTheses[0]`);
      }
      if (/candidates\[0\]/.test(content) && !/No getPrimaryThesis \/ candidates\[0\]/.test(content)) {
        violations.push(`${rel}: candidates[0]`);
      }
      // primaryThesisId as decision source (not assignment of routing output)
      if (/primaryThesisId\s*\?\?|primaryThesisId\s*\|\||=\s*.*primaryThesisId/.test(content)) {
        // Allow writing primaryThesisId on routing results
        if (!/primaryThesisId:\s*/.test(content) || /selectedThesisId\s*\?\?\s*.*primaryThesisId|primaryThesisId\s*\?\?/.test(content)) {
          if (/primaryThesisId\s*\?\?| \|\| .*primaryThesisId/.test(content)) {
            violations.push(`${rel}: primaryThesisId decision fallback`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('Application still bans primary helpers', () => {
    const appRoot = join(ROOT, 'src', 'application', 'strategicSignalRouting');
    function collect(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...collect(full));
        else if (entry.endsWith('.ts')) out.push(full);
      }
      return out;
    }
    for (const file of collect(appRoot)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      expect(content, rel).not.toMatch(/getPrimaryThesis/);
      expect(content, rel).not.toMatch(/activeTheses\[0\]/);
      expect(content, rel).not.toMatch(/candidates\[0\]/);
    }
  });
});

describe('SPEC-001 Phase 4 — presentation-only exceptions documented', () => {
  it('ManagerCockpit and ClientPortal keep labeled presentation defaults only', () => {
    const cockpit = readFileSync(join(ROOT, 'src/components/ManagerCockpit.ts'), 'utf8');
    const portal = readFileSync(join(ROOT, 'src/components/ClientPortal.ts'), 'utf8');
    expect(cockpit).toMatch(/ALLOWED_PRESENTATION_ONLY/);
    expect(portal).toMatch(/ALLOWED_PRESENTATION_ONLY/);
    expect(cockpit).toMatch(/getActiveTheses\(client\.id\)\[0\]/);
    expect(portal).toMatch(/theses\[0\]/);
  });
});
