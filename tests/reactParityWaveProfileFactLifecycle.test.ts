/**
 * SPEC-010 · Master Profile fact lifecycle React write parity (#2–#6).
 *
 * Presentation + frozen masterProfileConsumer commands only.
 * #7 ProofWall, registry/CU, Application, and Domain remain out of scope.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MasterProfileError } from '../src/application/masterProfile';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const panel = 'src/ui/modules/ClientProfile/ReactClientProfilePanel.tsx';
const hook = 'src/ui/hooks/useWave2Data.ts';
const wave3 = 'src/ui/hooks/useWave3Data.ts';
const seam = 'src/ui/commands/commandSeam.ts';
const reads = 'src/ui/data/compatibilityReads.ts';
const consumer = 'src/services/masterProfileConsumer.ts';
const workspace = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const wizard = 'src/ui/modules/Onboarding/ReactOnboardingWizard.tsx';
const registry = 'specs/010-react-migration/audit010-09-registry.md';
const applicationDir = 'src/application/masterProfile';

const addCalls: Array<Record<string, unknown>> = [];
const confirmCalls: Array<Record<string, unknown>> = [];
const rejectCalls: Array<Record<string, unknown>> = [];
const updateCalls: Array<Record<string, unknown>> = [];
const importCalls: Array<Record<string, unknown>> = [];

let addThrow: unknown = null;
let confirmThrow: unknown = null;
let updateThrow: unknown = null;
let importThrow: unknown = null;
let importCount = 2;

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => ({
      id: 'user_client_01',
      role: 'CLIENT',
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
  addProfileFact: (intent: Record<string, unknown>) => {
    addCalls.push(intent);
    if (addThrow) throw addThrow;
    return { profile: { clientId: 'client_a' }, fact: { id: 'fact_1' } };
  },
  confirmProfileFact: (intent: Record<string, unknown>) => {
    confirmCalls.push(intent);
    if (confirmThrow) throw confirmThrow;
    return { profile: { clientId: 'client_a' }, fact: { id: intent.factId } };
  },
  rejectProfileFact: (intent: Record<string, unknown>) => {
    rejectCalls.push(intent);
    return { profile: { clientId: 'client_a' }, fact: { id: intent.factId } };
  },
  updateProfileFact: (intent: Record<string, unknown>) => {
    updateCalls.push(intent);
    if (updateThrow) throw updateThrow;
    return { profile: { clientId: 'client_a' }, fact: { id: intent.factId } };
  },
  importProfileFactsFromCv: (intent: Record<string, unknown>) => {
    importCalls.push(intent);
    if (importThrow) throw importThrow;
    return { profile: { clientId: 'client_a' }, importedCount: importCount, facts: [] };
  },
  setProofWallItemReadiness: vi.fn(),
}));

function hookBlock(name: string, next: string): string {
  const src = read(hook);
  const start = src.indexOf(`export function ${name}`);
  const end = src.indexOf(`export function ${next}`);
  return src.slice(start, end === -1 ? undefined : end);
}

function seamFactBlock(): string {
  const src = code(seam);
  return src.slice(
    src.indexOf('addProfileFact(intent'),
    src.indexOf('export const thesisLifecycleCommands')
  );
}

beforeEach(() => {
  addCalls.length = 0;
  confirmCalls.length = 0;
  rejectCalls.length = 0;
  updateCalls.length = 0;
  importCalls.length = 0;
  addThrow = null;
  confirmThrow = null;
  updateThrow = null;
  importThrow = null;
  importCount = 2;
});

describe('A — React reads canonical factual profile data', () => {
  it('panel uses useProfileOverview and the compatibility profile-overview key', () => {
    expect(code(panel)).toMatch(/useProfileOverview\(tenantScope\)/);
    expect(code(hook)).toMatch(/tenantQueryKey\(scope, 'compatibility', 'profile-overview'\)/);
    expect(code(hook)).toMatch(/readProfileOverview\(scope!\)/);
    expect(code(reads)).toMatch(/export function readProfileOverview/);
    expect(code(reads)).toMatch(/dbService\.getMasterProfile\(clientId\)/);
  });
});

describe('B — Add UI collects section/label/value only', () => {
  it('inline add submits section from the card plus label and value', () => {
    expect(code(panel)).toMatch(/\+ Añadir/);
    expect(code(panel)).toMatch(/handleAdd\(section\.section as ProfileFactSection\)/);
    expect(code(panel)).toMatch(/\{ section, label, value \}/);
    expect(code(panel)).not.toMatch(/status:\s*['"]confirmed['"]/);
    expect(code(panel)).not.toMatch(/source:\s*['"]manual['"]/);
    expect(seamFactBlock()).not.toMatch(/status:/);
    expect(seamFactBlock()).not.toMatch(/source:/);
  });
});

describe('C — Add delegates to canonical command path', () => {
  it('panel → hook → seam → consumer AddProfileFact', async () => {
    expect(code(panel)).toMatch(/useAddProfileFact\(tenantScope\)/);
    expect(hookBlock('useAddProfileFact', 'useConfirmProfileFact')).toMatch(
      /masterProfileCommands\.addProfileFact/
    );
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.addProfileFact({
      requestedClientId: 'client_a',
      section: 'identity',
      label: 'Rol',
      value: 'Socia',
    });
    expect(result).toEqual({ ok: true, message: 'Fact añadido' });
    expect(addCalls).toEqual([
      {
        requestedClientId: 'client_a',
        section: 'identity',
        label: 'Rol',
        value: 'Socia',
      },
    ]);
    expect(code(consumer)).toMatch(/useCases\.addProfileFact/);
  }, 15_000);
});

describe('D — Confirm delegates exact factId', () => {
  it('confirm control passes factId only through the hook/seam', async () => {
    expect(code(panel)).toMatch(/confirmFact\.mutate\(\s*\{\s*factId\s*\}/);
    expect(hookBlock('useConfirmProfileFact', 'useRejectProfileFact')).toMatch(
      /factId: params\.factId/
    );
    expect(hookBlock('useConfirmProfileFact', 'useRejectProfileFact')).not.toMatch(/status:/);
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.confirmProfileFact({
      requestedClientId: 'client_a',
      factId: 'fact_cand_1',
    });
    expect(result).toEqual({ ok: true, message: 'Fact confirmado' });
    expect(confirmCalls).toEqual([{ requestedClientId: 'client_a', factId: 'fact_cand_1' }]);
  });
});

describe('E — Reject delegates exact factId', () => {
  it('reject control passes factId only and does not delete locally', async () => {
    expect(code(panel)).toMatch(/rejectFact\.mutate\(\s*\{\s*factId\s*\}/);
    expect(code(panel)).not.toMatch(/filter\(\(.*status.*rejected/);
    expect(code(panel)).not.toMatch(/facts\.splice|removeFact|deleteFact/);
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.rejectProfileFact({
      requestedClientId: 'client_a',
      factId: 'fact_cand_2',
    });
    expect(result).toEqual({ ok: true, message: 'Fact descartado' });
    expect(rejectCalls).toEqual([{ requestedClientId: 'client_a', factId: 'fact_cand_2' }]);
  });
});

describe('F — Edit delegates factId and value only', () => {
  it('edit form submits factId + value and no other fact fields', async () => {
    expect(code(panel)).toMatch(/updateFact\.mutate\(\s*\{\s*factId, value\s*\}/);
    expect(hookBlock('useUpdateProfileFact', 'useImportProfileFactsFromCv')).toMatch(
      /factId: params\.factId/
    );
    expect(hookBlock('useUpdateProfileFact', 'useImportProfileFactsFromCv')).toMatch(
      /value: params\.value/
    );
    expect(hookBlock('useUpdateProfileFact', 'useImportProfileFactsFromCv')).not.toMatch(/label:/);
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.updateProfileFact({
      requestedClientId: 'client_a',
      factId: 'fact_conf_1',
      value: 'Nuevo valor',
    });
    expect(result).toEqual({ ok: true, message: 'Fact actualizado' });
    expect(updateCalls).toEqual([
      { requestedClientId: 'client_a', factId: 'fact_conf_1', value: 'Nuevo valor' },
    ]);
  });
});

describe('G — CV import delegates text only', () => {
  it('import seam receives cvText and returns importedCount messaging', async () => {
    expect(code(panel)).toMatch(/importCv\.mutate\(\s*\{\s*cvText: text\s*\}/);
    expect(code(panel)).toMatch(/file\.text\(\)/);
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.importProfileFactsFromCv({
      requestedClientId: 'client_a',
      cvText: 'Partner at a law firm specializing in patents.',
    });
    expect(result).toEqual({
      ok: true,
      importedCount: 2,
      message: '2 facts candidatos extraídos',
    });
    expect(importCalls).toEqual([
      {
        requestedClientId: 'client_a',
        cvText: 'Partner at a law firm specializing in patents.',
      },
    ]);
    importCount = 0;
    const empty = masterProfileCommands.importProfileFactsFromCv({
      requestedClientId: 'client_a',
      cvText: 'duplicate only',
    });
    expect(empty).toEqual({
      ok: true,
      importedCount: 0,
      message: 'No se encontraron facts nuevos',
    });
  });
});

describe('H — no React dbService writes', () => {
  it('panel, wave2 hooks, and seam never call dbService mutators', () => {
    for (const path of [panel, hook, seam]) {
      expect(code(path)).not.toMatch(/dbService\.(addProfileFact|confirmProfileFact|rejectProfileFact|updateProfileFact|importCandidateFactsFromCv)/);
      expect(code(path)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    }
    expect(code(reads)).not.toMatch(/dbService\.(addProfileFact|updateProfileFact)/);
  });
});

describe('I — no Firestore direct writes', () => {
  it('React profile write path has no Firestore/firebase writes', () => {
    for (const path of [panel, hook, seam]) {
      expect(code(path)).not.toMatch(/firestore|getFirestore|doc\(|setDoc|updateDoc/i);
    }
  });
});

describe('J — no local transition authority', () => {
  it('React does not assign confirmed/rejected or own a transition table', () => {
    expect(code(panel)).not.toMatch(/status\s*=\s*['"]confirmed['"]/);
    expect(code(panel)).not.toMatch(/status\s*=\s*['"]rejected['"]/);
    expect(code(panel)).not.toMatch(/candidate → confirmed|transitionFact/);
    expect(code(hook)).not.toMatch(/status:\s*['"]confirmed['"]/);
  });
});

describe('K — no completeness math', () => {
  it('panel consumes profileCompleteness and does not compute 20/5', () => {
    expect(code(panel)).toMatch(/profile\.profileCompleteness/);
    expect(code(panel)).not.toMatch(/computeProfileCoverage/);
    expect(code(panel)).not.toMatch(/totalConfirmed\s*\/\s*20|>=\s*20\b|\/\s*5\b/);
    expect(code(hook)).not.toMatch(/computeProfileCoverage/);
    expect(seamFactBlock()).not.toMatch(/computeProfileCoverage|profileCompleteness/);
  });
});

describe('L — no CV extraction business logic in React', () => {
  it('React never imports or calls extractCandidateFactsFromCv', () => {
    expect(code(panel)).not.toMatch(/extractCandidateFactsFromCv/);
    expect(code(hook)).not.toMatch(/extractCandidateFactsFromCv/);
    expect(seamFactBlock()).not.toMatch(/extractCandidateFactsFromCv/);
    expect(code(panel)).not.toMatch(/guessSection|DEGREE_PATTERN/);
  });
});

describe('M — no AI', () => {
  it('profile write files do not call AI providers or advisor/topic agents', () => {
    for (const path of [panel, hook, seam]) {
      expect(code(path)).not.toMatch(/openai|anthropic|tavily|generateAdvice|runTopicAgent|topicAgent/i);
    }
  });
});

describe('N — no network for CV', () => {
  it('file-to-text is local file.text() with no upload or fetch', () => {
    expect(code(panel)).toMatch(/file\.text\(\)/);
    expect(code(panel)).toMatch(/accept=".txt,.md,text\/plain,text\/markdown"/);
    expect(code(panel)).not.toMatch(/fetch\(|XMLHttpRequest|FormData|uploadBytes/);
    expect(code(panel)).not.toMatch(/MAX_FILE|maxSize|file\.size/);
  });
});

describe('O — wrong-client canonical failure surfaces bounded error', () => {
  it('seam maps MasterProfileError message and never returns the code', async () => {
    addThrow = new MasterProfileError('ACTOR_NOT_AUTHORIZED', 'No puedes operar sobre otro cliente.');
    const { masterProfileCommands } = await import('../src/ui/commands/commandSeam');
    const result = masterProfileCommands.addProfileFact({
      requestedClientId: 'client_foreign',
      section: 'identity',
      label: 'Rol',
      value: 'Socia',
    });
    expect(result).toEqual({ ok: false, message: 'No puedes operar sobre otro cliente.' });
    expect(result).not.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
    expect(code(panel)).toMatch(/result\.message/);
    expect(code(panel)).not.toMatch(/ACTOR_NOT_AUTHORIZED|TENANT_CONTEXT_INVALID|FACT_NOT_FOUND/);
  });
});

describe('P — CLIENT foreign-client path fails closed', () => {
  it('hooks send only session clientId and consumer still requires tenant scope', () => {
    for (const [name, next] of [
      ['useAddProfileFact', 'useConfirmProfileFact'],
      ['useConfirmProfileFact', 'useRejectProfileFact'],
      ['useRejectProfileFact', 'useUpdateProfileFact'],
      ['useUpdateProfileFact', 'useImportProfileFactsFromCv'],
      ['useImportProfileFactsFromCv', 'useProofWall'],
    ] as const) {
      const block = hookBlock(name, next);
      expect(block).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
      expect(block).toMatch(/requestedClientId: scope\.clientId/);
      expect(block).not.toMatch(/organizationId:/);
      expect(block).not.toMatch(/actorRole:/);
    }
    expect(code(consumer)).toMatch(/requireTrustedGate\(intent\.requestedClientId\)/);
    expect(code(consumer)).toMatch(/requireTenantScope/);
  });
});

describe('Q — successful writes invalidate compatibility profile queries', () => {
  it('all five hooks invalidate tenant compatibility only', () => {
    expect(code(hook)).toMatch(/function invalidateCompatibility/);
    expect(code(hook)).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
    expect(hookBlock('useAddProfileFact', 'useProofWall')).not.toMatch(/tenantInvalidationKey\(scope, 'canonical'\)/);
    expect(hookBlock('useAddProfileFact', 'useProofWall')).not.toMatch(/invalidateQueries\(\s*\{\s*\}\)/);
    expect(code(hook)).not.toMatch(/queryClient\.setQueryData/);
  });
});

describe('R — leftover panel absent; handlers and UI-mode switch remain', () => {
  it('handlers and UI-mode switch remain; leftover panel is absent', () => {
    expect(existsSync(join(ROOT, 'src/components/ClientProfilePanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/ui/legacy/handlers/profileHandlers.ts'))).toBe(true);
    expect(read('src/ui/legacy/handlers/profileHandlers.ts')).toMatch(/btn-extract-cv-facts/);
    expect(read('src/ui/legacy/handlers/profileHandlers.ts')).toMatch(/dbService\.addProfileFact/);
    expect(code(panel)).toMatch(/applyUiMode\('legacy'\)/);
    expect(code(panel)).toMatch(/interfaz anterior/);
  });
});

describe('S — #7 ProofWall excluded', () => {
  it('profile write path never touches updateProofWallItem', () => {
    expect(code(panel)).not.toMatch(/updateProofWallItem|btn-toggle-proof-wall|useUpdateProofWall/);
    expect(code(hook)).not.toMatch(/updateProofWallItem/);
    expect(seamFactBlock()).not.toMatch(/updateProofWallItem/);
    expect(read('tests/reactMigrationPhase2Architecture.test.ts')).toMatch(/updateProofWallItem/);
  });
});

describe('T — registry and CU unchanged', () => {
  it('registry still records #2–#6 CU YES and DISPLAY_ONLY_REACT', () => {
    const src = read(registry);
    expect(src).toMatch(/#2 CANONICALIZED_AND_FROZEN/);
    expect(src).toMatch(/#6 CANONICALIZED_AND_FROZEN/);
    expect(src).toMatch(/`DISPLAY_ONLY_REACT`/);
    expect(src).toMatch(/React not started/);
    expect(src).toMatch(/updateProofWallItem/);
    expect(src).toMatch(/ProofWallPanel/);
    expect(code('src/ui/modules/ProofWall/ReactProofWallPanel.tsx')).toMatch(/READ_ONLY/);
  });
});

describe('U — pending behavior disables active controls', () => {
  it('add/confirm/reject/edit/CV submit honor isPending', () => {
    expect(code(panel)).toMatch(/disabled=\{addFact\.isPending\}/);
    expect(code(panel)).toMatch(/disabled=\{confirmFact\.isPending \|\| rejectFact\.isPending\}/);
    expect(code(panel)).toMatch(/disabled=\{updateFact\.isPending\}/);
    expect(code(panel)).toMatch(/disabled=\{importCv\.isPending\}/);
    expect(code(panel)).not.toMatch(/onceDisabled|permanentlyDisabled/);
  });
});

describe('V — read extension is cvExtractedText only', () => {
  it('compatibility read adds cvExtractedText from the already-loaded profile', () => {
    expect(code(reads)).toMatch(/cvExtractedText: profile\?\.cvExtractedText \?\? ''/);
    expect(code(panel)).toMatch(/data\?\.cvExtractedText/);
    expect(code(panel)).toMatch(/slice\(0, 2000\)/);
    expect(code(reads)).not.toMatch(/computeProfileCoverage\(.*cv/);
    expect(code(reads)).not.toMatch(/extractCandidateFactsFromCv/);
    const files = readdirSync(join(ROOT, applicationDir)).filter((name) => name.endsWith('.ts'));
    expect(files).toContain('AddProfileFact.ts');
    expect(files).toContain('ImportProfileFactsFromCv.ts');
  });
});

describe('W — no manager workspace profile tab and no generic mutator', () => {
  it('workspace page does not host profile fact writes', () => {
    expect(code(workspace)).not.toMatch(/ReactClientProfilePanel/);
    expect(code(workspace)).not.toMatch(/useAddProfileFact|useImportProfileFactsFromCv/);
    expect(code(hook)).not.toMatch(/useMutateProfileFact/);
    expect(code(wave3)).not.toMatch(/useAddProfileFact|useConfirmProfileFact|useImportProfileFactsFromCv/);
  });
});

describe('X — onboarding wizard stays isolated from fact writes', () => {
  it('P6 wizard still does not invoke profile CRUD commands', () => {
    expect(code(wizard)).not.toMatch(
      /addProfileFact|confirmProfileFact|rejectProfileFact|updateProfileFact|importCandidateFactsFromCv|importProfileFactsFromCv|updateProofWallItem/
    );
  });
});

describe('Y — presentation matrix is display-only', () => {
  it('candidate shows Confirmar/Descartar and confirmed shows Editar', () => {
    expect(code(panel)).toMatch(/fact\.status === 'candidate'/);
    expect(code(panel)).toMatch(/Confirmar/);
    expect(code(panel)).toMatch(/Descartar/);
    expect(code(panel)).toMatch(/Editar/);
    expect(code(reads)).toMatch(/f\.status !== 'rejected'/);
  });
});

describe('Z — empty CV guard is presentation-only', () => {
  it('empty paste warns without calling the command', () => {
    expect(code(panel)).toMatch(/Pega el texto del CV o sube un archivo \.txt/);
    expect(code(panel)).toMatch(/if \(!text\)/);
  });
});
