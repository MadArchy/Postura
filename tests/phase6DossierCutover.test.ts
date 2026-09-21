/**
 * SPEC-010 Phase 6 — ClientWorkspace dossier cutover.
 *
 * C1–C5 evidence for the bounded unit. C6 file-absence is not executed here.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';

const ROOT = join(__dirname, '..');
const REACT_PANEL = 'src/ui/modules/MasterDossier/ReactMasterDossierPanel.tsx';
const HOST = 'src/components/ClientWorkspace.ts';
const REACT_HOST = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const PORTAL = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const READ = 'src/ui/data/compatibilityReads.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const HANDLERS = 'src/ui/legacy/handlers/dossierHandlers.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const SUBSTANTIVE_LABELS = [
  'Dossier maestro',
  'Resumen ejecutivo',
  'Arco narrativo',
  'Regla editorial',
  'Identidad — 8 dimensiones',
  'Líneas de servicio',
  'Público objetivo',
  'Preguntas de negocio que resuelve',
  'Temas que debe dominar',
  'Evitar en comunicación',
  'Pendiente verificar',
  'Diferenciadores',
  'Guías por canal',
  'Copiar Markdown',
  'Descargar .md',
];

const SUBSTANTIVE_FIELDS = [
  'dossier.version',
  'dossier.taglineEn',
  'dossier.subtitleEn',
  'dossier.executiveSummary',
  'dossier.narrativeArc',
  'dossier.newsEditorialRule',
  'identityDimensions',
  'serviceLines',
  'targetAudiences',
  'clientQuestions',
  'topicsToOwn',
  'topicsToAvoid',
  'pendingVerification',
  'differentiators',
  'channelGuides',
];

describe('Phase 6 dossier cutover — C1 served ownership', () => {
  it('React dossier exists and is served from workspace, Wave2, and portal', () => {
    expect(statSync(join(ROOT, REACT_PANEL)).isFile()).toBe(true);
    expect(code(REACT_HOST)).toMatch(/<ReactMasterDossierPanel/);
    expect(code(WAVE2)).toMatch(/<ReactMasterDossierPanel/);
    expect(code(PORTAL)).toMatch(/<ReactMasterDossierPanel/);
  });

  it('ClientWorkspace no longer serves the legacy dossier slot', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/renderMasterDossierPanel/);
    expect(host).not.toMatch(/dossier-maestro/);
    expect(shouldRenderLegacyDossierSlot()).toBe(false);
    expect(dossierSlotPresentation()).toBe('omit');
  });

  it('exclusive dossier ownership is active', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(true);
  });
});

describe('Phase 6 dossier cutover — C2 focused presentation', () => {
  it('React panel binds the substantive dossier fields', () => {
    const source = code(REACT_PANEL);
    for (const field of SUBSTANTIVE_FIELDS) {
      expect(source).toContain(field.includes('.') ? field.split('.')[1] : field);
    }
    expect(source).toContain('dossier.version');
    expect(source).toContain('taglineEn');
    expect(source).toContain('subtitleEn');
    expect(source).toContain('executiveSummary');
    expect(source).toContain('narrativeArc');
    expect(source).toContain('newsEditorialRule');
  });

  it('React panel keeps the substantive section labels', () => {
    const source = read(REACT_PANEL);
    for (const label of SUBSTANTIVE_LABELS) {
      expect(source).toContain(label);
    }
  });

  it('React panel has empty, loading, error, and no-scope states', () => {
    const source = read(REACT_PANEL);
    expect(source).toContain('react-dossier-empty');
    expect(source).toContain('react-dossier-loading');
    expect(source).toContain('react-dossier-error');
    expect(source).toContain('react-dossier-no-scope');
  });

  it('copy and download stay presentation-only through the command seam', () => {
    const panel = code(REACT_PANEL);
    const seam = code(SEAM);
    expect(panel).toMatch(/dossierPresentationCommands\.copyMarkdown/);
    expect(panel).toMatch(/dossierPresentationCommands\.download/);
    expect(seam).toMatch(/formatDossierMarkdown/);
    expect(seam).toMatch(/downloadDossierMarkdown/);
    expect(seam).toMatch(/COPY_DOSSIER/);
    expect(seam).toMatch(/EXPORT_DOSSIER/);
    expect(seam).not.toMatch(/dbService\.(save|update|create|add|remove|delete)/);
  });

  it('ClientWorkspace has zero static or dynamic MasterDossierPanel imports', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/MasterDossierPanel/);
    expect(host).not.toMatch(/import\s*\(\s*['"][^'"]*MasterDossierPanel['"]/);
    expect(code(HANDLERS)).not.toMatch(/MasterDossierPanel/);
    expect(code('src/main.ts')).not.toMatch(/MasterDossierPanel/);
  });
});

describe('Phase 6 dossier cutover — C3 equivalence', () => {
  it('React read remains tenant-scoped compatibility, not a new authority', () => {
    const readSource = code(READ);
    const hook = code('src/ui/hooks/useWave2Data.ts');
    expect(readSource).toMatch(/export function readMasterDossier\(scope: TrustedTenantScope\)/);
    expect(readSource).toMatch(/requireClient\(scope\)/);
    expect(readSource).toMatch(/dbService\.getMasterDossier/);
    expect(hook).toMatch(/tenantQueryKey\(scope, 'compatibility', 'master-dossier'\)/);
    expect(code(REACT_PANEL)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT_PANEL)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT_PANEL)).not.toMatch(/from\s+['"][^'"]*domain\//);
  });

  it('cutover introduces no business write and keeps handlers retained', () => {
    expect(statSync(join(ROOT, HANDLERS)).isFile()).toBe(true);
    expect(code(REACT_PANEL)).not.toMatch(/dbService\.(save|update|create|add|remove|delete)/);
    expect(code(HOST)).not.toMatch(/dbService\.getMasterDossier/);
  });
});

describe('Phase 6 dossier cutover — C4 / C5 / C8', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [
      'src/ui/presentation/dossierSlot.ts',
      'src/ui/presentation/reactExclusiveSlots.ts',
      REACT_PANEL,
    ]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('React dossier uses session tenant scope rather than a DOM or caller tenant', () => {
    const panel = code(REACT_PANEL);
    expect(panel).toMatch(/useSession\(\)/);
    expect(panel).toMatch(/tenantScope/);
    expect(panel).not.toMatch(/data-tenant/);
    expect(panel).not.toMatch(/organizationId\s*[:=]/);
  });
});
