/**
 * SPEC-010 Phase 6 — ClientWorkspace PageHeader third-host cutover
 * (`client-workspace-page-header`).
 *
 * Omits leftover `renderPage` from ClientWorkspace `renderClientWorkspace`.
 * PageHeader.ts remains PRESENT. Static leftover importers are zero.
 * ReactClientWorkspacePage serves ReactTabHeader for mapped tabs and
 * page-local ReactPageHeader for briefs. Six previous header capabilities
 * stay React-served. C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_PORTAL_PAGE_HEADER_SLOT,
  CLIENT_PORTFOLIO_PAGE_HEADER_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_WORKSPACE_PAGE_HEADER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  pageHeaderWorkspaceSlotPresentation,
  shouldRenderLegacyPageHeaderWorkspaceSlot,
} from '../src/ui/presentation/pageHeaderWorkspaceSlot';
import {
  pageHeaderPortalSlotPresentation,
  shouldRenderLegacyPageHeaderPortalSlot,
} from '../src/ui/presentation/pageHeaderPortalSlot';
import {
  pageHeaderPortfolioSlotPresentation,
  shouldRenderLegacyPageHeaderPortfolioSlot,
} from '../src/ui/presentation/pageHeaderPortfolioSlot';
import {
  dossierSlotPresentation,
  shouldRenderLegacyDossierSlot,
} from '../src/ui/presentation/dossierSlot';
import {
  opportunitySlotPresentation,
  shouldRenderLegacyOpportunitySlot,
} from '../src/ui/presentation/opportunitySlot';
import { TAB_META, WORKSPACE_TABS } from '../src/ui/presentation/pageTabMeta';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/PageHeader.ts';
const HOST = 'src/components/ClientWorkspace.ts';
const PORTAL = 'src/components/ClientPortal.ts';
const COCKPIT = 'src/components/ManagerCockpit.ts';
const PAGE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const THESIS = 'src/ui/modules/pages/ReactThesisEditorPage.tsx';
const REACT = 'src/ui/modules/PageHeader/ReactPageHeader.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const SLOT = 'src/ui/presentation/pageHeaderWorkspaceSlot.ts';
const PORTAL_SLOT = 'src/ui/presentation/pageHeaderPortalSlot.ts';
const PORTFOLIO_SLOT = 'src/ui/presentation/pageHeaderPortfolioSlot.ts';
const REGISTRY = 'src/ui/presentation/reactExclusiveSlots.ts';
const CONSUMER = 'src/services/thesisLifecycleConsumer.ts';
const HOOKS = 'src/ui/hooks/useWave3Data.ts';
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

describe('Phase 6 PageHeader ClientWorkspace cutover — leftover omit', () => {
  it('PageHeader.ts remains present; ClientWorkspace drops the leftover import', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(host).not.toMatch(/\brenderPage\b/);
    expect(host).not.toMatch(/\brenderPageHeader\b/);
    expect(host).toMatch(/function workspacePage\(/);
    expect(host).toMatch(/class="page-content"/);
    expect(host).toMatch(/renderSources/);
    expect(host).toMatch(/renderRadar/);
    expect(host).toMatch(/renderPositioning/);
    expect(host).not.toMatch(/btn-poll-all-sources/);
    expect(host).not.toMatch(/btn-open-source-registry/);
    expect(host).not.toMatch(/id="btn-add-manual-signal"/);
    expect(host).not.toMatch(/btn-open-add-task/);
    expect(host).not.toMatch(/btn-open-thesis-editor/);
    expect(shouldRenderLegacyPageHeaderWorkspaceSlot()).toBe(false);
    expect(pageHeaderWorkspaceSlotPresentation()).toBe('omit');
  });

  it('leftover ClientWorkspace keeps exactly one page-content wrapper', () => {
    const host = code(HOST);
    const wrappers = host.match(/class="page-content"/g) ?? [];
    expect(wrappers).toHaveLength(1);
    expect(host).toMatch(/workspacePage\(`\$\{thesisBar\}\$\{renderSources/);
    expect(host).toMatch(/workspacePage\(`\$\{thesisBar\}\$\{renderRadar/);
    expect(host).toMatch(/workspacePage\(renderPositioning/);
  });

  it('ClientPortal and ManagerCockpit leftover PageHeader imports stay omitted', () => {
    expect(code(PORTAL)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(PORTAL)).not.toMatch(/\brenderPage\b/);
    expect(code(COCKPIT)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(COCKPIT)).not.toMatch(/\brenderPage\b/);
    expect(shouldRenderLegacyPageHeaderPortalSlot()).toBe(false);
    expect(pageHeaderPortalSlotPresentation()).toBe('omit');
    expect(shouldRenderLegacyPageHeaderPortfolioSlot()).toBe(false);
    expect(pageHeaderPortfolioSlotPresentation()).toBe('omit');
  });

  it('Product leftover PageHeader importers are zero', () => {
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
    expect(offenders).toEqual([]);
    expect(existsSync(join(ROOT, LEGACY))).toBe(true);
  });
});

describe('Phase 6 PageHeader ClientWorkspace cutover — React owner', () => {
  it('ReactClientWorkspacePage serves ReactTabHeader inside existing page-content', () => {
    const page = code(PAGE);
    expect(page).toMatch(/from\s+['"]\.\.\/PageHeader\/ReactPageHeader['"]/);
    expect(page).toMatch(/<ReactTabHeader\s+tab=\{WORKSPACE_HEADER_TAB\[tab\]\}/);
    expect(page).toMatch(/className="page-content"/);
    expect(page).toMatch(/data-testid="react-client-workspace"/);
    expect((page.match(/className="page-content"/g) ?? []).length).toBe(1);
    expect(page).not.toMatch(/createRoot/);
    expect(page).not.toMatch(/#app/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*eyebrow=/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*actions=/);
    expect(code(REACT)).toMatch(/export function ReactTabHeader/);
    expect(code(REACT)).toMatch(/TAB_META\[tab\] \|\| \{ title: 'POSTURA', subtitle: '' \}/);
  });

  it('mapped workspace tabs use exact TAB_META keys', () => {
    const page = read(PAGE);
    expect(page).toMatch(/radar:\s*'ws-radar'/);
    expect(page).toMatch(/deliver:\s*'ws-deliver'/);
    expect(page).toMatch(/sources:\s*'ws-sources'/);
    expect(page).toMatch(/tasks:\s*'ws-tasks'/);
    expect(page).toMatch(/results:\s*'ws-results'/);
    expect(page).toMatch(/positioning:\s*'ws-positioning'/);
    expect(page).toMatch(/production:\s*'ws-production'/);
    expect(TAB_META['ws-radar']).toEqual(WORKSPACE_TABS['ws-radar']);
    expect(TAB_META['ws-deliver']).toEqual(WORKSPACE_TABS['ws-deliver']);
    expect(TAB_META['ws-sources']).toEqual(WORKSPACE_TABS['ws-sources']);
    expect(TAB_META['ws-tasks']).toEqual(WORKSPACE_TABS['ws-tasks']);
    expect(TAB_META['ws-results']).toEqual(WORKSPACE_TABS['ws-results']);
    expect(TAB_META['ws-positioning']).toEqual(WORKSPACE_TABS['ws-positioning']);
    expect(TAB_META['ws-production']).toEqual(WORKSPACE_TABS['ws-production']);
    expect(TAB_META['ws-radar']?.subtitle).toBe(
      'Decide qué información merece avanzar hacia una entrega.'
    );
  });

  it('briefs uses page-local ReactPageHeader titled Strategic Briefs with no subtitle', () => {
    const page = code(PAGE);
    expect(page).toMatch(/<ReactPageHeader title="Strategic Briefs" \/>/);
    expect(page).not.toMatch(/<ReactPageHeader[^>]*subtitle=/);
    expect(page).not.toMatch(/briefs:\s*'ws-/);
    expect(TAB_META.briefs).toBeUndefined();
    expect(WORKSPACE_TABS.briefs).toBeUndefined();
  });

  it('six previous PageHeader capabilities remain React-served', () => {
    const page = code(PAGE);
    expect(page).toMatch(/usePollAllActiveSources/);
    expect(page).toMatch(/useRegisterSource/);
    expect(page).toMatch(/react-ws-sources-open-register/);
    expect(page).toMatch(/useRegisterManualSignal/);
    expect(page).toMatch(/useAssignClientTaskManual/);
    expect(code(THESIS)).toMatch(/useCreateThesis/);
    expect(code(THESIS)).toMatch(/Nueva tesis/);
    expect(code(HOOKS)).toMatch(/export function useCreateThesis/);
    expect(code(CONSUMER)).toMatch(/export function createThesis/);
    expect(code(APPSHELL)).toMatch(/'ws-sources-react':\s*'sources'/);
    expect(code(APPSHELL)).toMatch(/ReactClientWorkspacePage/);
    expect(code(APPSHELL)).not.toMatch(/ReactTabHeader/);
  });
});

describe('Phase 6 PageHeader ClientWorkspace cutover — Option-E / A38', () => {
  it('exclusive ClientWorkspace PageHeader id is workspace-header-only and distinct', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_WORKSPACE_PAGE_HEADER_SLOT)).toBe(true);
    expect(CLIENT_WORKSPACE_PAGE_HEADER_SLOT).toBe('client-workspace-page-header');
    expect(CLIENT_WORKSPACE_PAGE_HEADER_SLOT).not.toBe(CLIENT_PORTAL_PAGE_HEADER_SLOT);
    expect(CLIENT_WORKSPACE_PAGE_HEADER_SLOT).not.toBe(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT);
    expect(CLIENT_WORKSPACE_PAGE_HEADER_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_WORKSPACE_PAGE_HEADER_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_WORKSPACE_PAGE_HEADER_SLOT).not.toBe(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-workspace-page-header');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portal-page-header');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portfolio-page-header');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('page-header');
    expect(existsSync(join(ROOT, SLOT))).toBe(true);
    expect(existsSync(join(ROOT, PORTAL_SLOT))).toBe(true);
    expect(existsSync(join(ROOT, PORTFOLIO_SLOT))).toBe(true);
  });

  it('omit-slot, exclusive activation, and zero ClientWorkspace import are atomic', () => {
    const omitted =
      pageHeaderWorkspaceSlotPresentation() === 'omit' &&
      !shouldRenderLegacyPageHeaderWorkspaceSlot();
    const exclusive =
      hasReactExclusiveSlot() && isReactExclusiveSlot(CLIENT_WORKSPACE_PAGE_HEADER_SLOT);
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

describe('Phase 6 PageHeader ClientWorkspace cutover — authority / closed subsets', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [SLOT, REGISTRY, REACT]) {
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
    expect(code(HOST)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(PORTAL)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(COCKPIT)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
  });
});
