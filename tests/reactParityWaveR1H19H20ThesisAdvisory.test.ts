/**
 * SPEC-010 · R1 H19 stress-test + H20 AI thesis proposal — React-native advisory.
 *
 * The consumer gates tenant + ADMIN, resolves the thesis by explicit id, reaches the
 * AI facade, and persists nothing. React reaches it only through the command seam.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const h = vi.hoisted(() => ({
  user: null as null | { uid: string; role: 'ADMIN' | 'CLIENT'; organizationId: string; clientId?: string },
  challengeCalls: [] as { id: string; clientId: string }[],
  proposalCalls: [] as string[],
  writes: [] as string[],
  evidence: [] as Array<Record<string, unknown>>,
}));

const THESIS = { id: 'thesis_a', clientId: 'client_a', organizationId: 'org_a', title: 'Tesis A' };
const CHALLENGE = {
  outcome: 'SPLIT',
  riskScore: 61,
  findings: [{ kind: 'breadth', severity: 'warning', message: 'Demasiados territorios' }],
  recommendations: ['Separar la tesis en dos'],
  primaryAction: 'split',
  splitHint: 'Dividir por audiencia',
};
const PROPOSAL = {
  title: 'Tesis propuesta',
  expertIdentity: 'Socio de Lex Partners especializado en patentes',
  targetAudience: 'General Counsel',
  domain: 'Dominio propuesto',
  objective: 'Autoridad en patentes',
  proofPoints: ['Más de 200 casos ganados'],
  voiceAndTone: 'Sobrio',
  complianceRules: 'Sin promesas',
};

function evidenceItem(clientId: string, title: string) {
  return {
    id: `ev_${clientId}`,
    organizationId: 'org_a',
    clientId,
    title,
    type: 'CREDENTIAL',
    snippet: title,
    confidenceScore: 90,
    verified: true,
    associatedThesesIds: ['thesis_other'],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

vi.mock('../src/services/auth', () => ({
  authService: { getCurrentUser: () => h.user },
}));

vi.mock('../src/services/db', () => ({
  dbService: {
    getClientById: (id: string) =>
      id === 'client_a' || id === 'client_b'
        ? { id, organizationId: id === 'client_a' ? 'org_a' : 'org_b' }
        : undefined,
    getThesisById: (clientId: string, thesisId: string) =>
      clientId === THESIS.clientId && thesisId === THESIS.id ? THESIS : undefined,
    getEvidenceVaultByClient: () => h.evidence,
    saveThesis: () => h.writes.push('saveThesis'),
    saveAll: () => h.writes.push('saveAll'),
  },
}));

vi.mock('../src/services/ai', () => ({
  aiService: {
    challengeThesis: async (thesis: { id: string; clientId: string }) => {
      h.challengeCalls.push({ id: thesis.id, clientId: thesis.clientId });
      return CHALLENGE;
    },
    generateThesisProposal: async (clientId: string) => {
      h.proposalCalls.push(clientId);
      return PROPOSAL;
    },
  },
}));

const ADMIN = { uid: 'user_admin_01', role: 'ADMIN' as const, organizationId: 'org_a' };

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

beforeEach(() => {
  h.user = ADMIN;
  h.challengeCalls.length = 0;
  h.proposalCalls.length = 0;
  h.writes.length = 0;
  h.evidence = [];
});

describe('H19 — stress-test consumer', () => {
  it('challenges exactly the explicitly selected thesis of the trusted client', async () => {
    const { stressTestThesis } = await import('../src/services/thesisAdvisoryConsumer');
    const result = await stressTestThesis({ requestedClientId: 'client_a', thesisId: 'thesis_a' });
    expect(result).toEqual(CHALLENGE);
    expect(h.challengeCalls).toEqual([{ id: 'thesis_a', clientId: 'client_a' }]);
    expect(h.writes).toEqual([]);
  });

  it('fails closed for an unknown thesis, another organization, or a CLIENT actor', async () => {
    const { stressTestThesis } = await import('../src/services/thesisAdvisoryConsumer');
    await expect(
      stressTestThesis({ requestedClientId: 'client_a', thesisId: 'thesis_missing' })
    ).rejects.toThrow('Tesis no encontrada.');
    await expect(
      stressTestThesis({ requestedClientId: 'client_b', thesisId: 'thesis_a' })
    ).rejects.toThrow();
    h.user = { uid: 'user_client_a', role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a' };
    await expect(
      stressTestThesis({ requestedClientId: 'client_a', thesisId: 'thesis_a' })
    ).rejects.toThrow('rol ADMIN');
    expect(h.challengeCalls).toEqual([]);
  });
});

describe('H20 — AI proposal consumer', () => {
  it('proposes for the trusted client only and persists nothing', async () => {
    const { proposeThesisFromProfile } = await import('../src/services/thesisAdvisoryConsumer');
    const advice = await proposeThesisFromProfile({ requestedClientId: 'client_a' });
    expect(advice.fields).toEqual(PROPOSAL);
    expect(h.proposalCalls).toEqual(['client_a']);
    expect(h.writes).toEqual([]);
  });

  it('reviews the proposed claims; its own proof points never count as support', async () => {
    const { proposeThesisFromProfile } = await import('../src/services/thesisAdvisoryConsumer');
    const unsupported = await proposeThesisFromProfile({ requestedClientId: 'client_a' });
    expect(unsupported.claimSafety.verdict).toBe('BLOCK');
    expect(unsupported.claimSafety.findings.map((finding) => finding.kind).sort()).toEqual([
      'CREDENTIAL',
      'METRIC',
    ]);

    h.evidence = [evidenceItem('client_a', 'Socio de Lex Partners')];
    const supported = await proposeThesisFromProfile({ requestedClientId: 'client_a' });
    expect(supported.claimSafety.verdict).toBe('REVIEW');
    expect(supported.claimSafety.findings.map((finding) => finding.kind)).toEqual(['METRIC']);
  });

  it('only verified evidence of the trusted client supports a proposed claim', async () => {
    const { proposeThesisFromProfile } = await import('../src/services/thesisAdvisoryConsumer');
    h.evidence = [
      evidenceItem('client_b', 'Socio de Lex Partners'),
      { ...evidenceItem('client_a', 'Socio de Lex Partners'), verified: false },
    ];
    const advice = await proposeThesisFromProfile({ requestedClientId: 'client_a' });
    expect(advice.claimSafety.verdict).toBe('BLOCK');
    expect(advice.claimSafety.findings.map((finding) => finding.kind)).toContain('CREDENTIAL');
  });

  it('rejects a cross-organization client, a missing client id, and a CLIENT actor', async () => {
    const { proposeThesisFromProfile } = await import('../src/services/thesisAdvisoryConsumer');
    await expect(proposeThesisFromProfile({ requestedClientId: 'client_b' })).rejects.toThrow();
    await expect(proposeThesisFromProfile({ requestedClientId: '' })).rejects.toThrow();
    h.user = { uid: 'user_client_a', role: 'CLIENT', organizationId: 'org_a', clientId: 'client_a' };
    await expect(proposeThesisFromProfile({ requestedClientId: 'client_a' })).rejects.toThrow(
      'rol ADMIN'
    );
    expect(h.proposalCalls).toEqual([]);
  });

  it('consumer source writes nothing and never touches the thesis lifecycle write path', () => {
    const consumer = code('src/services/thesisAdvisoryConsumer.ts');
    expect(consumer).not.toMatch(/dbService\.(save|add|update|delete|remove|set)\w*\(/);
    expect(consumer).not.toMatch(/auditService|saveThesis|createThesis|saveAll/);
  });
});

describe('H19/H20 — command seam', () => {
  it('maps consumer results and errors without throwing to React', async () => {
    const { thesisAdvisoryCommands } = await import('../src/ui/commands/commandSeam');
    expect(
      await thesisAdvisoryCommands.stressTest({ requestedClientId: 'client_a', thesisId: 'thesis_a' })
    ).toEqual({ ok: true, challenge: CHALLENGE });
    expect(
      await thesisAdvisoryCommands.stressTest({ requestedClientId: 'client_a', thesisId: 'nope' })
    ).toEqual({ ok: false, message: 'Tesis no encontrada.' });
    expect(await thesisAdvisoryCommands.proposeFromProfile({ requestedClientId: 'client_a' })).toEqual({
      ok: true,
      fields: PROPOSAL,
      claimSafety: expect.objectContaining({ verdict: 'BLOCK' }),
    });
  }, 15_000);

  it('seam keeps the AI consumer out of its static import graph', () => {
    const seam = code('src/ui/commands/commandSeam.ts');
    expect(seam).not.toMatch(/from\s+['"][^'"]*thesisAdvisoryConsumer['"]/);
    expect(seam).toMatch(/await import\('\.\.\/\.\.\/services\/thesisAdvisoryConsumer'\)/);
    expect(seam).not.toMatch(/from\s+['"][^'"]*services\/ai['"]/);
  });
});

describe('H19/H20 — React editor surface', () => {
  const PAGE = 'src/ui/modules/pages/ReactThesisEditorPage.tsx';

  it('stress-test targets the selected thesis and renders the existing challenge modal', () => {
    const page = code(PAGE);
    expect(page).toMatch(/handleStressTest\(detail\.data!\.id, detail\.data!\.title\)/);
    expect(page).toMatch(/stressTest\.mutate\(\s*\{ thesisId: id \}/);
    expect(page).toMatch(/<ReactChallengeModal/);
    expect(page).toMatch(/thesisChallengeOutcomeLabel\(result\.outcome\)/);
  });

  it('proposal only pre-fills the create form; saving stays on #11 via useCreateThesis', () => {
    const page = code(PAGE);
    expect(page).toMatch(/react-thesis-propose/);
    expect(page).toMatch(/editableFields=\{proposal\?\.fields \?\? EMPTY_EDITABLE_FIELDS\}/);
    expect(page).toMatch(/key=\{`create-\$\{proposal\?\.key \?\? 0\}`\}/);
    expect(page).toMatch(/createThesis\.mutate\(/);
  });

  it('shows the proposal claim-safety review as received, next to the create form', () => {
    const page = code(PAGE);
    expect(page).toMatch(/claimSafety: result\.claimSafety/);
    expect(page).toMatch(/<ReactClaimSafetyPanel record=\{proposal\.claimSafety\} \/>/);
    expect(page).toMatch(/react-thesis-proposal-claims/);
  });

  it('React never imports the AI facade or a consumer and never names the AI operations', () => {
    for (const rel of [PAGE, 'src/ui/hooks/useWave3Data.ts']) {
      const source = code(rel);
      expect(source).not.toMatch(/from\s+['"][^'"]*services\/(ai|\w*Consumer)['"]/);
      expect(source).not.toMatch(/challengeThesis|generateThesisProposal|isServerGatewayAvailable/);
    }
  });
});
