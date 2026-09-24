/**
 * SPEC-010 Phase 6 — canonical React create-thesis (Nueva tesis).
 *
 * Consumer owns createId('thesis'). SaveThesis #11 remains the write authority.
 * React / hook / seam must not mint. PageHeader.ts remains present with zero
 * leftover importers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ThesisEditableFields, User } from '../src/types';

vi.hoisted(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new (class {
    private store = new Map<string, string>();
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.store.set(key, value);
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
  })() as Storage;
});

import {
  createThesis,
  resetThesisLifecycleConsumerForTest,
  saveThesis,
} from '../src/services/thesisLifecycleConsumer';
import { ThesisLifecycleError } from '../src/application/thesisLifecycle';
import { authService } from '../src/services/auth';
import { dbService } from '../src/services/db';

const ROOT = process.cwd();
const PAGE = 'src/ui/modules/pages/ReactThesisEditorPage.tsx';
const HOOKS = 'src/ui/hooks/useWave3Data.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const CONSUMER = 'src/services/thesisLifecycleConsumer.ts';
const SAVE = 'src/application/thesisLifecycle/SaveThesis.ts';
const COMPOSE = 'src/composition/thesisLifecycle/composeThesisLifecycle.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const PORTAL = 'src/components/ClientPortal.ts';
const COCKPIT = 'src/components/ManagerCockpit.ts';
const PAGE_HEADER = 'src/components/PageHeader.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walkTs(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, entry.name);
    if (entry.isDirectory()) walkTs(next, acc);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(next);
  }
  return acc;
}

function baseFields(overrides: Partial<ThesisEditableFields> = {}): ThesisEditableFields {
  return {
    title: 'Nueva tesis canónica',
    expertIdentity: 'Identidad experta',
    targetAudience: 'Audiencia',
    domain: 'Dominio',
    objective: 'Objetivo',
    proofPoints: ['Prueba', 'Publicación'],
    voiceAndTone: 'Tono',
    complianceRules: 'Reglas',
    ...overrides,
  };
}

function readyFields(overrides: Partial<ThesisEditableFields> = {}): ThesisEditableFields {
  return baseFields({
    identityCurrent: 'Perfil actual',
    perceptionTarget: 'Percepción objetivo',
    audiences: [{ id: 'a1', name: 'GC', tier: 'COMMERCIAL', weight: 100, keywords: ['gc'] }],
    territories: [{ id: 't1', name: 'LatAm', weight: 100, keywords: ['latam'] }],
    objectives: [{ id: 'o1', kind: 'BUSINESS', weight: 100 }],
    voiceProfile: {
      authority: 80,
      technicalDepth: 70,
      academic: 40,
      executive: 70,
      accessible: 50,
      provocative: 20,
      commercial: 60,
      legalPrecision: 90,
      humor: 10,
    },
    limits: { hardBlocks: ['no hype promises'], softAvoid: [] },
    ...overrides,
  });
}

const admin: User = {
  uid: 'u_admin',
  email: 'a@x.com',
  displayName: 'Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  organizationId: 'org_sess',
  clientId: null,
  mustCompleteOnboarding: false,
  aiKeyManagementAllowed: false,
  locale: 'es',
  timezone: 'UTC',
};

describe('canonical create-thesis — id ownership', () => {
  it('React page, hook, and seam never mint thesis ids', () => {
    expect(code(PAGE)).not.toMatch(/createId/);
    expect(code(HOOKS)).not.toMatch(/createId/);
    expect(code(SEAM)).not.toMatch(/createId/);
    expect(code(PAGE)).not.toMatch(/from ['"].*lib\/id['"]/);
    expect(code(HOOKS)).not.toMatch(/from ['"].*lib\/id['"]/);
    expect(code(SEAM)).not.toMatch(/from ['"].*lib\/id['"]/);
  });

  it('consumer owns createId(thesis) and delegates to existing saveThesis', () => {
    const source = code(CONSUMER);
    expect(source).toMatch(/export function createThesis/);
    expect(source).toMatch(/createId\(\s*['"]thesis['"]\s*\)/);
    expect(source).toMatch(/return saveThesis\(/);
    expect(source).toMatch(/requireTenantScope/);
  });

  it('SaveThesis #11 is reused; no new Application command', () => {
    const save = code(SAVE);
    expect(save).toMatch(/thesisId is required/);
    expect(save).not.toMatch(/createId/);
    expect(code(COMPOSE)).toMatch(/saveThesis:\s*createSaveThesis/);
    expect(code(COMPOSE)).not.toMatch(/createThesis/);
    expect(existsSync(join(ROOT, 'src/application/thesisLifecycle/CreateThesis.ts'))).toBe(false);
  });
});

describe('canonical create-thesis — React surface', () => {
  it('serves explicit Nueva tesis create without silent unresolved-id create', () => {
    const page = read(PAGE);
    expect(page).toMatch(/useCreateThesis/);
    expect(page).toMatch(/Nueva tesis/);
    expect(page).toMatch(/react-thesis-create/);
    expect(page).toMatch(/react-thesis-create-form/);
    expect(page).toMatch(/react-thesis-editor-empty/);
    expect(page).toMatch(/Este cliente todavía no tiene tesis registradas/);
    expect(page).toMatch(/createMode/);
    expect(page).toMatch(/setThesisId\(result\.thesisId\)/);
    expect(page).toMatch(/No se ha creado ninguna tesis nueva/);
    expect(page).toMatch(/useSaveThesis/);
    expect(page).toMatch(/Selecciona una tesis/);
    expect(page).not.toMatch(/theses\[0\]|primaryThesis|defaultThesis/);
  });

  it('hook create API has no thesisId and uses the seam', () => {
    const hooks = read(HOOKS);
    const idx = hooks.indexOf('export function useCreateThesis');
    expect(idx).toBeGreaterThan(-1);
    const block = hooks.slice(idx, idx + 900);
    expect(block).toMatch(/thesisLifecycleCommands\.createThesis\(/);
    expect(block).toMatch(/intent:\s*params\.intent/);
    expect(block).toMatch(/fields:\s*params\.fields/);
    expect(block).not.toMatch(/thesisId:\s*params/);
    expect(block).toMatch(/tenantInvalidationKey\(scope, 'compatibility'\)/);
    expect(block).not.toMatch(/createId/);
    expect(block).not.toMatch(/dbService/);
  });

  it('seam createThesis returns thesisId and does not mint', () => {
    const seam = code(SEAM);
    expect(seam).toMatch(/createThesis,/);
    const start = seam.indexOf('export const thesisLifecycleCommands');
    const end = seam.indexOf('export const signalIntakeCommands');
    const block = seam.slice(start, end);
    expect(block).toMatch(/createThesis\(intent:/);
    expect(block).toMatch(/thesisId:\s*result\.thesis\.id/);
    expect(block).not.toMatch(/createId/);
    expect(block).not.toMatch(/dbService\./);
  });
});

describe('canonical create-thesis — consumer runtime', () => {
  beforeEach(() => {
    resetThesisLifecycleConsumerForTest();
    vi.restoreAllMocks();
  });

  it('ADMIN trusted client can create a first DRAFT thesis and receive the minted id', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'A',
      lastName: 'B',
      displayName: 'A B',
      primaryEmail: `create_first_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });

    const result = createThesis({
      requestedClientId: client.id,
      intent: 'draft',
      fields: baseFields(),
    });

    expect(result.thesis.id).toMatch(/^thesis_/);
    expect(result.thesis.clientId).toBe(client.id);
    expect(result.thesis.organizationId).toBe('org_sess');
    expect(result.thesis.status).toBe('DRAFT');
    expect(result.intent).toBe('draft');
    expect(dbService.getThesisById(client.id, result.thesis.id)?.title).toBe('Nueva tesis canónica');
  });

  it('ADMIN can create an additional thesis without replacing the first', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'C',
      lastName: 'D',
      displayName: 'C D',
      primaryEmail: `create_more_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });

    const first = createThesis({
      requestedClientId: client.id,
      intent: 'draft',
      fields: baseFields({ title: 'Primera' }),
    });
    const second = createThesis({
      requestedClientId: client.id,
      intent: 'draft',
      fields: baseFields({ title: 'Segunda' }),
    });

    expect(second.thesis.id).not.toBe(first.thesis.id);
    expect(dbService.getThesesByClient(client.id).map((row) => row.title).sort()).toEqual([
      'Primera',
      'Segunda',
    ]);
  });

  it('submit_review create uses existing lifecycle, not ACTIVE', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'E',
      lastName: 'F',
      displayName: 'E F',
      primaryEmail: `create_review_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });

    const result = createThesis({
      requestedClientId: client.id,
      intent: 'submit_review',
      fields: readyFields(),
    });
    expect(result.thesis.status).toBe('UNDER_REVIEW');
    expect(result.thesis.status).not.toBe('ACTIVE');
    expect(result.notifyClient).toBe(true);
  });

  it('existing saveThesis edit path still requires a caller-supplied id', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(admin);
    const client = dbService.createClient({
      organizationId: 'org_sess',
      primaryManagerId: 'u_admin',
      firstName: 'G',
      lastName: 'H',
      displayName: 'G H',
      primaryEmail: `create_edit_${Date.now()}@ex.com`,
      onboardingStatus: 'IN_PROGRESS',
      profileCompleteness: 20,
      status: 'ACTIVE',
      avatarUrl: '',
      createdBy: 'u_admin',
      updatedBy: 'u_admin',
    });
    const created = createThesis({
      requestedClientId: client.id,
      intent: 'draft',
      fields: baseFields({ title: 'Editable' }),
    });
    const saved = saveThesis({
      requestedClientId: client.id,
      thesisId: created.thesis.id,
      intent: 'draft',
      fields: baseFields({ title: 'Editada' }),
    });
    expect(saved.thesis.id).toBe(created.thesis.id);
    expect(saved.thesis.title).toBe('Editada');
    expect(saved.thesis.status).toBe('DRAFT');
  });

  it('missing session and CLIENT role cannot create', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(null);
    expect(() =>
      createThesis({
        requestedClientId: 'c1',
        intent: 'draft',
        fields: baseFields(),
      })
    ).toThrow(ThesisLifecycleError);

    const clientUser: User = {
      ...admin,
      uid: 'u_client',
      role: 'CLIENT',
      clientId: 'c_client',
    };
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue(clientUser);
    expect(() =>
      createThesis({
        requestedClientId: 'c_client',
        intent: 'draft',
        fields: baseFields(),
      })
    ).toThrow(ThesisLifecycleError);
  });
});

describe('canonical create-thesis — PageHeader graph', () => {
  it('PageHeader.ts remains present with zero leftover importers', () => {
    expect(existsSync(join(ROOT, PAGE_HEADER))).toBe(true);
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(COCKPIT)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    if (existsSync(join(ROOT, PORTAL))) {
      expect(code(PORTAL)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    }

    const importers: string[] = [];
    for (const file of walkTs(join(ROOT, 'src'))) {
      const source = readFileSync(file, 'utf8');
      if (
        /from\s+['"]\.\/PageHeader['"]/.test(source) ||
        /from\s+['"][^'"]*components\/PageHeader['"]/.test(source)
      ) {
        importers.push(file.replace(/\\/g, '/'));
      }
    }
    expect(importers).toEqual([]);
  });
});
