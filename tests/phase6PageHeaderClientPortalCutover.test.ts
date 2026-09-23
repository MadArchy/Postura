/**
 * SPEC-010 Phase 6 — ClientPortal PageHeader first-host cutover
 * (`client-portal-page-header`).
 *
 * Omits leftover `renderPage` from ClientPortal `clientPage`.
 * PageHeader.ts remains PRESENT. ManagerCockpit and ClientWorkspace
 * leftover imports remain. ReactClientPortalPage serves ReactTabHeader.
 * C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_PORTAL_PAGE_HEADER_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  pageHeaderPortalSlotPresentation,
  shouldRenderLegacyPageHeaderPortalSlot,
} from '../src/ui/presentation/pageHeaderPortalSlot';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';
import {
  opportunitySlotPresentation,
  shouldRenderLegacyOpportunitySlot,
} from '../src/ui/presentation/opportunitySlot';
import { CLIENT_TABS, TAB_META } from '../src/ui/presentation/pageTabMeta';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/PageHeader.ts';
const HOST = 'src/components/ClientPortal.ts';
const COCKPIT = 'src/components/ManagerCockpit.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const PAGE = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const REACT = 'src/ui/modules/PageHeader/ReactPageHeader.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const SLOT = 'src/ui/presentation/pageHeaderPortalSlot.ts';
const REGISTRY = 'src/ui/presentation/reactExclusiveSlots.ts';
const TASKS = 'specs/010-react-migration/tasks.md';
const SOURCE_REGISTRY = 'src/components/SourceRegistryModal.ts';
const ONBOARDING = 'src/components/OnboardingWizard.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collectTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTs(full));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('Phase 6 PageHeader ClientPortal cutover — leftover omit', () => {
  it('PageHeader.ts remains present; ClientPortal drops the leftover import', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(host).not.toMatch(/\brenderPage\b/);
    expect(host).not.toMatch(/\brenderPageHeader\b/);
    expect(host).toMatch(/function clientPage\(/);
    expect(host).toMatch(/class="page-content"/);
    expect(host).toMatch(/renderClientHomeBody/);
    expect(host).toMatch(/renderClientContentReviewBody/);
    expect(host).toMatch(/renderClientThesisBody/);
    expect(shouldRenderLegacyPageHeaderPortalSlot()).toBe(false);
    expect(pageHeaderPortalSlotPresentation()).toBe('omit');
  });

  it('ManagerCockpit and ClientWorkspace leftover PageHeader imports remain', () => {
    expect(code(COCKPIT)).toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(COCKPIT)).toMatch(/\brenderPage\b/);
    expect(code(WORKSPACE)).toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(WORKSPACE)).toMatch(/\brenderPage\b/);
  });

  it('Product leftover PageHeader importers are exactly the two remaining hosts', () => {
    const offenders: string[] = [];
    for (const file of collectTs(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel === LEGACY) continue;
      const source = code(rel);
      if (
        /from\s+['"]\.\/PageHeader['"]/.test(source) ||
        /from\s+['"][^'"]*components\/PageHeader['"]/.test(source)
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders.sort()).toEqual([COCKPIT, WORKSPACE].sort());
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
  });
});

describe('Phase 6 PageHeader ClientPortal cutover — React owner', () => {
  it('ReactClientPortalPage serves ReactTabHeader inside existing page-content', () => {
    const page = code(PAGE);
    expect(page).toMatch(/from\s+['"]\.\.\/PageHeader\/ReactPageHeader['"]/);
    expect(page).toMatch(/<ReactTabHeader\s+tab=\{PORTAL_HEADER_TAB\[tab\]\}/);
    expect(page).toMatch(/className="page-content"/);
    expect(page).toMatch(/data-testid="react-client-portal"/);
    expect(page).not.toMatch(/createRoot/);
    expect(page).not.toMatch(/#app/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*eyebrow=/);
    expect(page).not.toMatch(/SPEC-010 · wave 2/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*actions=/);
    expect(code(REACT)).toMatch(/export function ReactTabHeader/);
    expect(code(REACT)).toMatch(/TAB_META\[tab\] \|\| \{ title: 'POSTURA', subtitle: '' \}/);
  });

  it('page-local leftover tab mapping preserves Wave3 title/subtitle TAB_META', () => {
    const page = read(PAGE);
    expect(page).toMatch(/home:\s*'client-home'/);
    expect(page).toMatch(/tasks:\s*'client-feed'/);
    expect(page).toMatch(/content:\s*'client-content'/);
    expect(page).toMatch(/opportunities:\s*'client-opps'/);
    expect(page).toMatch(/thesis:\s*'client-thesis'/);
    expect(page).toMatch(/results:\s*'client-results'/);
    expect(TAB_META['client-home']).toEqual(CLIENT_TABS['client-home']);
    expect(TAB_META['client-feed']).toEqual(CLIENT_TABS['client-feed']);
    expect(TAB_META['client-content']).toEqual(CLIENT_TABS['client-content']);
    expect(TAB_META['client-thesis']).toEqual(CLIENT_TABS['client-thesis']);
    expect(TAB_META['client-home']?.title).toBe('Esta semana');
    expect(TAB_META['client-feed']?.title).toBe('Mis tareas');
    expect(TAB_META['client-content']?.title).toBe('Revisar');
    expect(TAB_META['client-thesis']?.title).toBe('Mi posicionamiento');
  });

  it('Wave2 header ownership and GROUP_META remain preexisting / nonblocking', () => {
    const wave2 = code(WAVE2);
    expect(wave2).toMatch(/eyebrow="SPEC-010 · wave 2"/);
    expect(wave2).toMatch(/<ReactPageHeader/);
    expect(wave2).not.toMatch(/ReactTabHeader/);
    expect(code(APPSHELL)).toMatch(/'client-opps':\s*'opportunities'/);
    expect(code(APPSHELL)).toMatch(/'client-results':\s*'results'/);
    expect(code(APPSHELL)).toMatch(/'client-profile':\s*'profile'/);
    expect(code(APPSHELL)).not.toMatch(/ReactTabHeader/);
  });
});

describe('Phase 6 PageHeader ClientPortal cutover — Option-E / A38', () => {
  it('exclusive ClientPortal PageHeader id is portal-header-only and distinct', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_PAGE_HEADER_SLOT)).toBe(true);
    expect(CLIENT_PORTAL_PAGE_HEADER_SLOT).toBe('client-portal-page-header');
    expect(CLIENT_PORTAL_PAGE_HEADER_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_PORTAL_PAGE_HEADER_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_PORTAL_PAGE_HEADER_SLOT).not.toBe(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portal-page-header');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('page-header');
    expect(existsSync(join(ROOT, SLOT))).toBe(true);
  });

  it('omit-slot, exclusive activation, and zero ClientPortal import are atomic', () => {
    const omitted =
      pageHeaderPortalSlotPresentation() === 'omit' && !shouldRenderLegacyPageHeaderPortalSlot();
    const exclusive = hasReactExclusiveSlot() && isReactExclusiveSlot(CLIENT_PORTAL_PAGE_HEADER_SLOT);
    const importRemoved = !/from\s+['"]\.\/PageHeader['"]/.test(code(HOST));
    expect({ omitted, exclusive, importRemoved }).toEqual({
      omitted: true,
      exclusive: true,
      importRemoved: true,
    });
    const decision = resolveServedUiMode('legacy');
    expect(decision.requested).toBe('legacy');
    expect(decision.served).toBe('react');
    expect(decision.keepReactMounted).toBe(true);
    expect(decision.mayActivateLegacyRoot).toBe(false);
    expect(decision.mayUnmountReact).toBe(false);
  });

  it('does not create a nested React root or leftover island', () => {
    expect(code(HOST)).not.toMatch(/ReactTabHeader|ReactPageHeader/);
    expect(code(HOST)).not.toMatch(/createRoot/);
    expect(code(HOST)).not.toMatch(/#app/);
    expect(code(PAGE)).not.toMatch(/createRoot/);
    expect(code(REACT)).not.toMatch(/createRoot/);
  });
});

describe('Phase 6 PageHeader ClientPortal cutover — authority / closed subsets', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [SLOT, REGISTRY, REACT, PAGE]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('SourceRegistry, Onboarding, and closed leftover files stay outside this host', () => {
    expect(statSync(join(ROOT, SOURCE_REGISTRY)).isFile()).toBe(true);
    expect(statSync(join(ROOT, ONBOARDING)).isFile()).toBe(true);
    expect(code(HOST)).not.toMatch(/SourceRegistryModal|OnboardingWizard/);
    expect(code(PAGE)).not.toMatch(/SourceRegistryModal|OnboardingWizard/);
    expect(existsSync(join(ROOT, 'src/components/MasterDossierPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/OpportunityPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/KpiWeeklyChart.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClientProfilePanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ProofWallPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClaimSafetyPanel.ts'))).toBe(false);
    expect(shouldRenderLegacyDossierSlot()).toBe(false);
    expect(dossierSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyOpportunitySlot()).toBe(false);
    expect(opportunitySlotPresentation()).toBe('omit');
  });

  it('file remains present; C6 / C7 / T603 are not executed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
    expect(read(TASKS)).toMatch(/T-010-603[\s\S]*NOT AUTHORIZED/);
    expect(code(COCKPIT)).toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(WORKSPACE)).toMatch(/from\s+['"]\.\/PageHeader['"]/);
  });
});
