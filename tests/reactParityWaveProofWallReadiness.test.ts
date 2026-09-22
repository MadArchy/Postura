/**
 * SPEC-010 · ProofWall readiness React write parity (#7).
 *
 * Presentation + frozen masterProfileConsumer.setProofWallItemReadiness only.
 * Application, Domain, registry/CU, and legacy business path remain out of scope.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MasterProfileError } from '../src/application/masterProfile';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const panel = 'src/ui/modules/ProofWall/ReactProofWallPanel.tsx';
const hook = 'src/ui/hooks/useWave2Data.ts';
const wave3 = 'src/ui/hooks/useWave3Data.ts';
const seam = 'src/ui/commands/commandSeam.ts';
const reads = 'src/ui/data/compatibilityReads.ts';
const consumer = 'src/services/masterProfileConsumer.ts';
const workspace = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const profile = 'src/ui/modules/ClientProfile/ReactClientProfilePanel.tsx';
const applicationDir = 'src/application/masterProfile';

const setCalls: Array<Record<string, unknown>> = [];
let setThrow: unknown = null;

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      id: 'user_admin_01',
      role: 'ADMIN',
      organizationId: 'org_a',
      clientId: 'client_a',
    }),
    clearOnboardingFlag: vi.fn(),
  },
}));

vi.mock('../src/services/audit', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../src/services/masterProfileConsumer', () => ({
  applyOnboardingStep: vi.fn(),
  addProfileFact: vi.fn(),
  confirmProfileFact: vi.fn(),
  rejectProfileFact: vi.fn(),
  updateProfileFact: vi.fn(),
  importProfileFactsFromCv: vi.fn(),
  setProofWallItemReadiness: (intent: Record<string, unknown>) => {
    setCalls.push(intent);
    if (setThrow) throw setThrow;
    return { item: { id: intent.proofWallItemId, status: intent.targetStatus } };
  },
}));

function hookBlock(name: string, next: string): string {
  const src = read(hook);
  const start = src.indexOf(`export function ${name}`);
  const end = src.indexOf(`export function ${next}`);
  return src.slice(start, end === -1 ? undefined : end);
}

function seamProofWallBlock(): string {
  const src = code(seam);
  return src.slice(
    src.indexOf('setProofWallItemReadiness(intent'),
    src.indexOf('export const thesisLifecycleCommands')
  );
}

beforeEach(() => {
  setCalls.length = 0;
  setThrow = null;
});

describe('A — React reads compatibility ProofWall data', () => {
  it('panel uses useProofWall and the compatibility proof-wall key', () => {
    expect(code(panel)).toMatch(/useProofWall\(tenantScope\)/);
    expect(code(hook)).toMatch(/tenantQueryKey\(scope, 'compatibility', 'proof-wall'\)/);
    expect(code(hook)).toMatch(/readProofWall\(scope!\)/);
    expect(code(reads)).toMatch(/export function readProofWall/);
  });
});

describe('B — ADMIN pending → complete uses the canonical seam', () => {
  it('toggle submits proofWallItemId + complete and reaches the consumer', async () => {
    expect(code(panel)).toMatch(/Marcar listo/);
    expect(code(panel)).toMatch(/targetStatus = complete \? 'pending' : 'complete'/);
    expect(code(panel)).toMatch(/setReadiness\.mutate\(/);
    expect(code(panel)).toMatch(/proofWallItemId, targetStatus/);
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    setCalls.length = 0;
    const result = masterProfileCommands.setProofWallItemReadiness({
      requestedClientId: 'client_a',
      proofWallItemId: 'pw_1',
      targetStatus: 'complete',
    });
    expect(result).toEqual({ ok: true, message: 'Activo marcado como listo' });
    expect(setCalls).toEqual([
      { requestedClientId: 'client_a', proofWallItemId: 'pw_1', targetStatus: 'complete' },
    ]);
    expect(code(consumer)).toMatch(/useCases\.setProofWallItemReadiness/);
  }, 15_000);
});

describe('C — ADMIN complete → pending uses the canonical seam', () => {
  it('complete items expose Marcar pendiente and send pending', async () => {
    expect(code(panel)).toMatch(/Marcar pendiente/);
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    setCalls.length = 0;
    const result = masterProfileCommands.setProofWallItemReadiness({
      requestedClientId: 'client_a',
      proofWallItemId: 'pw_2',
      targetStatus: 'pending',
    });
    expect(result).toEqual({ ok: true, message: 'Activo marcado como pendiente' });
    expect(setCalls).toEqual([
      { requestedClientId: 'client_a', proofWallItemId: 'pw_2', targetStatus: 'pending' },
    ]);
  }, 15_000);
});

describe('D — CLIENT cannot obtain write authority from presentation', () => {
  it('toggle is gated by isAdmin and CLIENT still sees badges only', () => {
    expect(code(panel)).toMatch(/showToggle = isAdmin && Boolean\(scope\?\.clientId\)/);
    expect(code(panel)).toMatch(/item\.complete \? 'Listo' : 'Pendiente'/);
    expect(code(panel)).not.toMatch(/actorRole:/);
    expect(code(panel)).not.toMatch(/editable/);
    expect(seamProofWallBlock()).not.toMatch(/actorRole:|organizationId:/);
  });
});

describe('E — no direct DB / repository / legacy persist from React path', () => {
  it('panel, hook, and seam never call updateProofWallItem or import the repository', () => {
    for (const path of [panel, hook, seam]) {
      expect(code(path)).not.toMatch(/updateProofWallItem/);
      expect(code(path)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
      expect(code(path)).not.toMatch(/ProofWallItemRepository|createDbProofWallItemRepository/);
      expect(code(path)).not.toMatch(/bindProfileHandlers|profileHandlers/);
    }
    expect(read('tests/reactMigrationPhase2Architecture.test.ts')).toMatch(/updateProofWallItem/);
  });
});

describe('F — trusted authority cannot be supplied from UI', () => {
  it('hook sends only session clientId plus item id and targetStatus', () => {
    const block = hookBlock('useSetProofWallItemReadiness', 'useSources');
    expect(block).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(block).toMatch(/requestedClientId: scope\.clientId/);
    expect(block).toMatch(/proofWallItemId: params\.proofWallItemId/);
    expect(block).toMatch(/targetStatus: params\.targetStatus/);
    expect(block).not.toMatch(/organizationId:/);
    expect(block).not.toMatch(/actorRole:/);
    expect(block).not.toMatch(/actorId:/);
    expect(code(consumer)).toMatch(/requireTrustedGate\(intent\.requestedClientId\)/);
  });
});

describe('G — narrow payload and pending/complete only', () => {
  it('React does not submit other ProofWall fields or invented states', () => {
    expect(code(hook)).toMatch(/targetStatus: 'pending' \| 'complete'/);
    expect(code(panel)).not.toMatch(/targetStatus:\s*['"]ready['"]/);
    expect(code(panel)).not.toMatch(/organizationId:|category:|title:|evidenceId:|sortOrder:/);
    expect(seamProofWallBlock()).not.toMatch(/category:|title:|evidenceId:|sortOrder:/);
    expect(code(panel)).not.toMatch(/AuthorizePublication|VerifyClaim|addEvidenceItem/);
  });
});

describe('H — loading disables and success invalidates after result.ok', () => {
  it('pending disables the toggle and hook invalidates compatibility only', () => {
    expect(code(panel)).toMatch(/disabled=\{setReadiness\.isPending\}/);
    expect(code(panel)).toMatch(/Guardando…/);
    const block = hookBlock('useSetProofWallItemReadiness', 'useSources');
    expect(block).toMatch(/if \(!scope \|\| !result\.ok\) return;/);
    expect(block).toMatch(/invalidateCompatibility\(scope, queryClient\)/);
    expect(block).not.toMatch(/queryClient\.setQueryData/);
    expect(block).not.toMatch(/tenantInvalidationKey\(scope, 'canonical'\)/);
  });
});

describe('I — failures remain failures and do not leak codes', () => {
  it('seam maps MasterProfileError message for auth, tenant, missing, state, persist', async () => {
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const cases: Array<[MasterProfileError['code'], string]> = [
      ['ACTOR_NOT_AUTHORIZED', 'Only ADMIN may change ProofWall readiness.'],
      ['TENANT_CONTEXT_INVALID', 'ProofWall item tenant envelope does not match trusted context.'],
      ['PROOF_WALL_ITEM_NOT_FOUND', 'ProofWall item not found.'],
      ['INVALID_PROOF_WALL_STATE', 'ProofWall item status is not a recognized readiness value.'],
      ['PERSISTENCE_ERROR', 'Failed to persist ProofWall readiness.'],
    ];
    for (const [errorCode, message] of cases) {
      setThrow = new MasterProfileError(errorCode, message);
      const result = masterProfileCommands.setProofWallItemReadiness({
        requestedClientId: 'client_a',
        proofWallItemId: 'pw_x',
        targetStatus: 'complete',
      });
      expect(result).toEqual({ ok: false, message });
      expect(result).not.toMatchObject({ code: errorCode });
      setThrow = null;
      setCalls.length = 0;
    }
    expect(code(panel)).toMatch(/result\.message/);
    expect(code(panel)).not.toMatch(
      /ACTOR_NOT_AUTHORIZED|TENANT_CONTEXT_INVALID|PROOF_WALL_ITEM_NOT_FOUND|INVALID_PROOF_WALL_STATE|PERSISTENCE_ERROR/
    );
  });
});

describe('J — no optimistic persisted state and no SPEC-006', () => {
  it('React does not patch cache or call publication/verification/vault', () => {
    expect(code(hook)).not.toMatch(/queryClient\.setQueryData/);
    for (const path of [panel, hook, seam]) {
      expect(code(path)).not.toMatch(/AuthorizePublication|VerifyClaim|LinkEvidenceToClaim|addEvidenceItem/);
      expect(code(path)).not.toMatch(/createAuthorizePublication|createVerifyClaim/);
    }
  });
});

describe('K — legacy retained and React stays presentation', () => {
  it('legacy toggle and handler remain; panel is PRESENTATION only', () => {
    expect(existsSync(join(ROOT, 'src/components/ProofWallPanel.ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'src/ui/legacy/handlers/profileHandlers.ts'))).toBe(true);
    expect(read('src/components/ProofWallPanel.ts')).toMatch(/btn-toggle-proof-wall/);
    expect(read('src/ui/legacy/handlers/profileHandlers.ts')).toMatch(/dbService\.updateProofWallItem/);
    expect(code(panel)).toMatch(/data-authority="PRESENTATION"/);
    expect(code(panel)).toMatch(/applyUiMode\('legacy'\)/);
    expect(code(panel)).toMatch(/interfaz anterior/);
    expect(code(workspace)).not.toMatch(/useSetProofWallItemReadiness/);
    expect(code(wave3)).not.toMatch(/useSetProofWallItemReadiness/);
    expect(code(profile)).not.toMatch(/useSetProofWallItemReadiness/);
    expect(existsSync(join(ROOT, applicationDir, 'SetProofWallItemReadiness.ts'))).toBe(true);
  });
});
