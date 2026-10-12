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
const PROPOSAL = { title: 'Tesis propuesta', expertIdentity: 'Experta', domain: 'Dominio propuesto' };

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
    expect(await proposeThesisFromProfile({ requestedClientId: 'client_a' })).toEqual(PROPOSAL);
    expect(h.proposalCalls).toEqual(['client_a']);
    expect(h.writes).toEqual([]);
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
    });
  });

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

  it('React never imports the AI facade or a consumer and never names the AI operations', () => {
    for (const rel of [PAGE, 'src/ui/hooks/useWave3Data.ts']) {
      const source = code(rel);
      expect(source).not.toMatch(/from\s+['"][^'"]*services\/(ai|\w*Consumer)['"]/);
      expect(source).not.toMatch(/challengeThesis|generateThesisProposal|isServerGatewayAvailable/);
    }
  });
});
