/**
 * SPEC-010 Phase 6 — Option E deletion-surviving rollback architecture.
 *
 * Presentation-only: exclusive-slot guard, applyUiMode evolution, dossier
 * coexistence boundary, A38 exclusivity, fail-closed mount, no new authority.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readdirSync } from 'node:fs';

import {
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  __setReactExclusiveSlotsForTests,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';
import {
  opportunitySlotPresentation,
  shouldRenderLegacyOpportunitySlot,
} from '../src/ui/presentation/opportunitySlot';
import { UI_MODE_ATTRIBUTE, UI_MODE_STORAGE_KEY, readUiMode } from '../src/ui/strangler/toggle';

const ROOT = join(__dirname, '..');

const reactRootMocks = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: reactRootMocks.render,
    unmount: reactRootMocks.unmount,
  }),
}));

vi.mock('../src/ui/shell/AppRoot', () => ({
  createShellElement: () => ({ type: 'mock-shell' }),
}));

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function installPresentationDocument(opts?: { reactRoot?: boolean }) {
  const attrs = new Map<string, string>();
  const reactRoot = opts?.reactRoot === false ? null : { id: 'react-root', innerHTML: '' };
  const appRoot = { id: 'app', innerHTML: '' };
  const documentElement = {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
  };
  vi.stubGlobal('document', {
    documentElement,
    getElementById(id: string) {
      if (id === 'react-root') return reactRoot;
      if (id === 'app') return appRoot;
      return null;
    },
  });
  return { attrs, documentElement };
}

describe('Phase 6 — exclusive-slot presentation guard', () => {
  afterEach(() => {
    __setReactExclusiveSlotsForTests(null);
  });

  it('compile-time default activates the dossier exclusive slot', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(true);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_WORKSPACE_DOSSIER_SLOT);
  });

  it('compile-time default activates the opportunity exclusive slot independently', () => {
    expect(isReactExclusiveSlot(CLIENT_PORTAL_OPPORTUNITY_SLOT)).toBe(true);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_PORTAL_OPPORTUNITY_SLOT).toBe('client-portal-opportunity');
    expect(CLIENT_PORTAL_OPPORTUNITY_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
  });

  it('opportunity exclusive slot alone keeps React served on a legacy request', () => {
    __setReactExclusiveSlotsForTests([CLIENT_PORTAL_OPPORTUNITY_SLOT]);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(false);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_OPPORTUNITY_SLOT)).toBe(true);
    const decision = resolveServedUiMode('legacy');
    expect(decision.served).toBe('react');
    expect(decision.keepReactMounted).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.mayUnmountReact).toBe(false);
  });

  it('treats a configured known slot as exclusive', () => {
    __setReactExclusiveSlotsForTests([CLIENT_WORKSPACE_DOSSIER_SLOT]);
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT)).toBe(true);
  });

  it('unknown exclusive-slot configuration fails closed to React-safe', () => {
    __setReactExclusiveSlotsForTests(['not-a-known-slot']);
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot('not-a-known-slot')).toBe(false);
    expect(resolveServedUiMode('legacy').mayUnmountReact).toBe(false);
    expect(resolveServedUiMode('legacy').served).toBe('react');
  });

  it('unknown UiMode values fall back to Stage-B React', () => {
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'cutover');
    expect(readUiMode()).toBe('react');
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'exclusive');
    expect(readUiMode()).toBe('react');
  });
});

describe('Phase 6 — served presentation resolution', () => {
  afterEach(() => {
    __setReactExclusiveSlotsForTests(null);
  });

  it('no exclusive slot + legacy request may unmount React', () => {
    const decision = resolveServedUiMode('legacy', false);
    expect(decision.served).toBe('legacy');
    expect(decision.mayUnmountReact).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(true);
    expect(decision.keepReactMounted).toBe(false);
  });

  it('exclusive slot + legacy request keeps React and does not activate #app', () => {
    const decision = resolveServedUiMode('legacy', true);
    expect(decision.served).toBe('react');
    expect(decision.mayUnmountReact).toBe(false);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.keepReactMounted).toBe(true);
  });

  it('react request always keeps React mounted', () => {
    expect(resolveServedUiMode('react', false).keepReactMounted).toBe(true);
    expect(resolveServedUiMode('react', true).keepReactMounted).toBe(true);
    expect(resolveServedUiMode('react', true).served).toBe('react');
  });
});

describe('Phase 6 — applyUiMode exclusive-slot evolution', () => {
  beforeEach(() => {
    reactRootMocks.render.mockClear();
    reactRootMocks.unmount.mockClear();
    __setReactExclusiveSlotsForTests(null);
  });

  afterEach(async () => {
    try {
      const { unmountReactShell } = await import('../src/ui/mount');
      unmountReactShell();
    } catch {
      // document may already be torn down
    }
    __setReactExclusiveSlotsForTests(null);
    vi.unstubAllGlobals();
  });

  it('no exclusive slot + legacy request unmounts React and serves #app', async () => {
    __setReactExclusiveSlotsForTests([]);
    const { attrs } = installPresentationDocument();
    const { applyUiMode, isReactMounted } = await import('../src/ui/mount');

    await applyUiMode('react');
    expect(isReactMounted()).toBe(true);
    expect(attrs.get(UI_MODE_ATTRIBUTE)).toBe('react');

    await applyUiMode('legacy');
    expect(isReactMounted()).toBe(false);
    expect(reactRootMocks.unmount).toHaveBeenCalled();
    expect(attrs.get(UI_MODE_ATTRIBUTE)).toBe('legacy');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('legacy');
  });

  it('cutover default + legacy request keeps React mounted and hides #app', async () => {
    const { attrs } = installPresentationDocument();
    const { applyUiMode, isReactMounted } = await import('../src/ui/mount');

    await applyUiMode('react');
    reactRootMocks.unmount.mockClear();

    await applyUiMode('legacy');
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactMounted()).toBe(true);
    expect(reactRootMocks.unmount).not.toHaveBeenCalled();
    expect(attrs.get(UI_MODE_ATTRIBUTE)).toBe('react');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('legacy');
  });

  it('exclusive slot + legacy request does not unmount React or show #app', async () => {
    const { attrs } = installPresentationDocument();
    __setReactExclusiveSlotsForTests([CLIENT_WORKSPACE_DOSSIER_SLOT]);
    const { applyUiMode, isReactMounted } = await import('../src/ui/mount');

    await applyUiMode('react');
    reactRootMocks.unmount.mockClear();

    await applyUiMode('legacy');
    expect(isReactMounted()).toBe(true);
    expect(reactRootMocks.unmount).not.toHaveBeenCalled();
    expect(attrs.get(UI_MODE_ATTRIBUTE)).toBe('react');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('legacy');
  });

  it('React mount failure without exclusive slot still fail-closes to legacy', async () => {
    __setReactExclusiveSlotsForTests([]);
    const { attrs } = installPresentationDocument({ reactRoot: false });
    const { applyUiMode, isReactMounted } = await import('../src/ui/mount');

    await applyUiMode('react');
    expect(isReactMounted()).toBe(false);
    expect(attrs.get(UI_MODE_ATTRIBUTE)).toBe('legacy');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('legacy');
  });

  it('React mount failure with exclusive slot does not activate #app', async () => {
    const { attrs } = installPresentationDocument({ reactRoot: false });
    __setReactExclusiveSlotsForTests([CLIENT_WORKSPACE_DOSSIER_SLOT]);
    const { applyUiMode, isReactMounted } = await import('../src/ui/mount');

    await applyUiMode('legacy');
    expect(isReactMounted()).toBe(false);
    expect(attrs.get(UI_MODE_ATTRIBUTE)).toBe('react');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('legacy');
  });

  it('presentation selection persists only the UI mode key', async () => {
    installPresentationDocument();
    const { applyUiMode } = await import('../src/ui/mount');
    localStorage.setItem('postura_notifications_v4', 'keep');
    await applyUiMode('legacy');
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('legacy');
    expect(localStorage.getItem('postura_notifications_v4')).toBe('keep');
  });
});

describe('Phase 6 — A38 root ownership remains exclusive', () => {
  it('sibling roots remain declared in index.html', () => {
    const html = read('index.html');
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<div id="react-root"></div>');
    expect(html.indexOf('id="app"')).toBeLessThan(html.indexOf('id="react-root"'));
  });

  it('React still mounts only into #react-root', () => {
    const source = read('src/ui/mount.ts');
    expect(source).toMatch(/createRoot\(container\)/);
    expect(source).toMatch(/getElementById\(REACT_ROOT_ID\)/);
    expect(source).not.toMatch(/createRoot\([^)]*LEGACY_ROOT_ID/);
    expect(code('src/ui/mount.ts')).not.toMatch(/getElementById\(\s*['"]app['"]\s*\)/);
  });

  it('visibility CSS still hides exactly one root', () => {
    const css = read('src/ui/strangler/strangler.css');
    expect(css).toContain("html[data-postura-ui='react'] #app");
    expect(css).toContain("html:not([data-postura-ui='react']) #react-root");
    expect(css).not.toMatch(/^\s*(body|\*|\.[\w-]+)\s*\{/m);
  });

  it('exclusive-slot served mode never activates both roots', () => {
    expect(resolveServedUiMode('legacy', true).served).toBe('react');
    expect(resolveServedUiMode('legacy', true).mayActivateLegacyRoot).toBe(false);
    expect(resolveServedUiMode('react', true).served).toBe('react');
  });

  it('mount.ts consults the exclusive-slot guard before unmount', () => {
    const source = code('src/ui/mount.ts');
    expect(source).toMatch(/resolveServedUiMode/);
    expect(source).toMatch(/hasReactExclusiveSlot/);
    expect(source).toMatch(/keepReactMounted/);
    expect(source).toMatch(/unmountReactShell/);
  });
});

describe('Phase 6 — dossier cutover pairing', () => {
  it('omit-slot, exclusive activation, and zero ClientWorkspace import are atomic', () => {
    const omitted = dossierSlotPresentation() === 'omit' && !shouldRenderLegacyDossierSlot();
    const exclusive = hasReactExclusiveSlot() && isReactExclusiveSlot(CLIENT_WORKSPACE_DOSSIER_SLOT);
    const host = code('src/components/ClientWorkspace.ts');
    const importRemoved =
      !/from\s+['"]\.\/MasterDossierPanel['"]/.test(host) &&
      !/renderMasterDossierPanel/.test(host) &&
      !/shouldRenderLegacyDossierSlot/.test(host);
    expect({ omitted, exclusive, importRemoved }).toEqual({
      omitted: true,
      exclusive: true,
      importRemoved: true,
    });
  });

  it('ClientWorkspace no longer renders or anchors the legacy dossier disclosure', () => {
    const source = code('src/components/ClientWorkspace.ts');
    expect(source).not.toMatch(/dossier-maestro/);
    expect(source).not.toMatch(/Ver dossier/);
    expect(source).not.toMatch(/renderMasterDossierPanel/);
    expect(source).not.toMatch(/from\s+['"]\.\/MasterDossierPanel['"]/);
    expect(source).not.toMatch(/import\s*\(\s*['"][^'"]*MasterDossierPanel['"]/);
  });

  it('React remains the served renderer when the exclusive-slot legacy dossier file is absent', () => {
    expect(existsSync(join(ROOT, 'src/components/MasterDossierPanel.ts'))).toBe(false);
    expect(statSync(join(ROOT, 'src/ui/modules/MasterDossier/ReactMasterDossierPanel.tsx')).isFile()).toBe(
      true
    );
    expect(code('src/ui/modules/pages/ReactClientWorkspacePage.tsx')).toMatch(/<ReactMasterDossierPanel/);
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(resolveServedUiMode('legacy').served).toBe('react');
    expect(resolveServedUiMode('legacy').keepReactMounted).toBe(true);
    expect(resolveServedUiMode('legacy').mayActivateLegacyRoot).toBe(false);
  });

  it('hosts do not nest each other\'s dossier renderer', () => {
    expect(code('src/components/ClientWorkspace.ts')).not.toMatch(/ReactMasterDossierPanel/);
    expect(code('src/ui/modules/pages/ReactClientWorkspacePage.tsx')).not.toMatch(
      /renderMasterDossierPanel/
    );
    expect(code('src/ui/modules/pages/ReactClientWorkspacePage.tsx')).not.toMatch(
      /from\s+['"][^'"]*\/MasterDossierPanel['"]/
    );
  });

  it('the dossier boundary introduces no command, persistence, or tenant authority', () => {
    const source = code('src/ui/presentation/dossierSlot.ts');
    expect(source).not.toMatch(/\bdbService\b/);
    expect(source).not.toMatch(/\w+Consumer\b/);
    expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
    expect(source).not.toMatch(/requireTenantScope/);
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/firestore/i);
  });
});

describe('Phase 6 — opportunity cutover pairing', () => {
  it('omit-slot, exclusive activation, and zero ClientPortal import are atomic', () => {
    const omitted = opportunitySlotPresentation() === 'omit' && !shouldRenderLegacyOpportunitySlot();
    const exclusive = hasReactExclusiveSlot() && isReactExclusiveSlot(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    const host = code('src/components/ClientPortal.ts');
    const importRemoved =
      !/from\s+['"]\.\/OpportunityPanel['"]/.test(host) &&
      !/renderOpportunityCard/.test(host) &&
      !/renderOpportunitySpotlight/.test(host) &&
      !/renderClientOpportunitiesBody/.test(host) &&
      !/listOpportunitiesForClient/.test(host);
    expect({ omitted, exclusive, importRemoved }).toEqual({
      omitted: true,
      exclusive: true,
      importRemoved: true,
    });
  });

  it('the opportunity boundary introduces no command, persistence, or tenant authority', () => {
    const source = code('src/ui/presentation/opportunitySlot.ts');
    expect(source).not.toMatch(/\bdbService\b/);
    expect(source).not.toMatch(/\w+Consumer\b/);
    expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
    expect(source).not.toMatch(/requireTenantScope/);
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/firestore/i);
  });

  it('React remains the served renderer when the exclusive-slot legacy opportunity file is absent', () => {
    expect(existsSync(join(ROOT, 'src/components/OpportunityPanel.ts'))).toBe(false);
    expect(statSync(join(ROOT, 'src/ui/modules/Opportunity/ReactOpportunityPanel.tsx')).isFile()).toBe(
      true
    );
    expect(code('src/ui/modules/pages/ReactClientPortalPage.tsx')).toMatch(/<ReactOpportunityPanel/);
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_OPPORTUNITY_SLOT)).toBe(true);
    expect(resolveServedUiMode('legacy').served).toBe('react');
    expect(resolveServedUiMode('legacy').keepReactMounted).toBe(true);
    expect(resolveServedUiMode('legacy').mayActivateLegacyRoot).toBe(false);
  });
});

describe('Phase 6 — security / authority of the rollback boundary', () => {
  const presentationFiles = [
    'src/ui/presentation/reactExclusiveSlots.ts',
    'src/ui/presentation/dossierSlot.ts',
    'src/ui/presentation/opportunitySlot.ts',
    'src/ui/mount.ts',
    'src/ui/strangler/toggle.ts',
  ];

  it('adds no business, tenant, role, actor, or persistence authority', () => {
    for (const file of presentationFiles) {
      const source = code(file);
      expect(source).not.toMatch(/\bdbService\b/);
      expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/\w+Consumer\b/);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('exclusive-slot module never persists and never writes localStorage', () => {
    const source = code('src/ui/presentation/reactExclusiveSlots.ts');
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/setDoc|updateDoc|addDoc|deleteDoc/);
  });

  it('toggle still persists only the presentation key', () => {
    const source = code('src/ui/strangler/toggle.ts');
    const writes = source.match(/localStorage\.setItem\([^)]*\)/g) ?? [];
    expect(writes).toEqual(['localStorage.setItem(UI_MODE_STORAGE_KEY, mode)']);
  });

  it('Application and Domain remain free of the exclusive-slot module', () => {
    const offenders: string[] = [];
    for (const layer of ['src/application', 'src/domain']) {
      for (const file of collectFiles(join(ROOT, layer))) {
        if (code(relative(ROOT, file).replace(/\\/g, '/')).includes('reactExclusiveSlots')) {
          offenders.push(relative(ROOT, file).replace(/\\/g, '/'));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
