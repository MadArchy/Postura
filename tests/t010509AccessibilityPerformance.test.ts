/**
 * SPEC-010 T-010-509 — accessibility and performance evidence (A41).
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  code,
  MIGRATED_PAGE_ROOTS,
  read,
  REACT_UI_FILES,
  rel,
  ROOT,
} from './lib/reactMigrationPhase5Surface';

const PAGE_FILES = REACT_UI_FILES.filter((file) => {
  const r = rel(file);
  return r.includes('/pages/') || r.includes('/modules/Login/') || r.includes('/Onboarding/');
});

const KEY_SURFACES = [
  'src/ui/modules/Login/ReactLogin.tsx',
  'src/ui/modules/pages/ReactThesisEditorPage.tsx',
  'src/ui/modules/pages/ReactClientWorkspacePage.tsx',
  'src/ui/modules/pages/ReactManagerCockpitPage.tsx',
  'src/ui/modules/Onboarding/ReactOnboardingWizard.tsx',
  'src/ui/modules/pages/modals/ReactModals.tsx',
];

describe('T-010-509 — accessibility evidence', () => {
  it('login form associates labels with controls', () => {
    const source = read(join(ROOT, 'src/ui/modules/Login/ReactLogin.tsx'));
    expect(source).toMatch(/htmlFor="react-login-email"/);
    expect(source).toMatch(/htmlFor="react-login-password"/);
    expect(source).toMatch(/role="alert"/);
  });

  it('migrated pages declare semantic loading/error/empty states', () => {
    for (const path of KEY_SURFACES) {
      const source = code(join(ROOT, path));
      const hasSemanticState =
        /role="(alert|status)"/.test(source) ||
        /PanelState/.test(source) ||
        /data-testid="react-.*-(loading|error|empty)"/.test(source);
      expect(hasSemanticState, path).toBe(true);
    }
  });

  it('thesis editor exposes labelled select and native save controls', () => {
    const source = read(join(ROOT, 'src/ui/modules/pages/ReactThesisEditorPage.tsx'));
    expect(source).toMatch(/htmlFor=|aria-label=/);
    expect(source).toMatch(/react-thesis-save/);
    expect(source).toMatch(/react-thesis-submit/);
    expect(source).toMatch(/react-thesis-select/);
    expect(source).not.toMatch(/react-thesis-save-disabled/);
  });

  it('shell logout is a keyboard-operable button and no legacy mode control remains', () => {
    const source = read(join(ROOT, 'src/ui/modules/AppShell/ReactAppShell.tsx'));
    expect(source).toMatch(/data-testid="react-shell-logout"/);
    expect(source).not.toMatch(/react-shell-to-legacy/);
    expect(source).toMatch(/<button[\s\S]*react-shell-logout/);
  });
});

describe('T-010-509 — performance evidence (repository-defined, no optimization)', () => {
  it('query cache remains non-authoritative with staleTime 0', () => {
    const source = read(join(ROOT, 'src/ui/providers/QueryProvider.tsx'));
    expect(source).toContain('NONAUTHORITATIVE_CACHE');
    expect(source).toMatch(/staleTime:\s*0/);
  });

  it('migrated page roots exist as declared test hooks', () => {
    for (const root of MIGRATED_PAGE_ROOTS) {
      const hits = REACT_UI_FILES.filter((file) => code(file).includes(`data-testid="${root}"`));
      expect(hits.length, root).toBeGreaterThan(0);
    }
  });

  it('no migrated page performs material effects during render', () => {
    const offenders = PAGE_FILES.filter((file) =>
      /^\s{0,4}(await\s+)?commandSeam\./m.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});
