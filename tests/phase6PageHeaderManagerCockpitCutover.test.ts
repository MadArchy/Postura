/**
 * SPEC-010 Phase 6 — ManagerCockpit PageHeader second-host cutover
 * (`client-portfolio-page-header`).
 *
 * Omits leftover `renderPage` from ManagerCockpit `renderManagerCockpit`.
 * PageHeader.ts remains PRESENT. ClientWorkspace leftover import is ABSENT
 * after its own cutover. ClientPortal leftover import stays ABSENT.
 * ReactManagerCockpitPage serves ReactTabHeader. Create-client and
 * canonical rematerialize stay React-served.
 * C6 / C7 / T603 are not executed.
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
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
  resolveServedUiMode,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  pageHeaderPortfolioSlotPresentation,
  shouldRenderLegacyPageHeaderPortfolioSlot,
} from '../src/ui/presentation/pageHeaderPortfolioSlot';
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
import { PORTFOLIO_TABS, TAB_META } from '../src/ui/presentation/pageTabMeta';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/PageHeader.ts';
const HOST = 'src/components/ManagerCockpit.ts';
const PORTAL = 'src/components/ClientPortal.ts';
const WORKSPACE = 'src/components/ClientWorkspace.ts';
const PAGE = 'src/ui/modules/pages/ReactManagerCockpitPage.tsx';
const REACT = 'src/ui/modules/PageHeader/ReactPageHeader.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const SLOT = 'src/ui/presentation/pageHeaderPortfolioSlot.ts';
const PORTAL_SLOT = 'src/ui/presentation/pageHeaderPortalSlot.ts';
const REGISTRY = 'src/ui/presentation/reactExclusiveSlots.ts';
const HANDLER = 'src/ui/legacy/handlers/clientAdminHandlers.ts';
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

describe('Phase 6 PageHeader ManagerCockpit cutover — leftover omit', () => {
  it('PageHeader.ts remains present; ManagerCockpit drops the leftover import', () => {
    expect(statSync(join(ROOT, LEGACY)).isFile()).toBe(true);
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(host).not.toMatch(/\brenderPage\b/);
    expect(host).not.toMatch(/\brenderPageHeader\b/);
    expect(host).toMatch(/function managerPage\(/);
    expect(host).toMatch(/class="page-content"/);
    expect(host).toMatch(/renderClientsBody/);
    expect(host).toMatch(/renderAICenterBody/);
    expect(host).toMatch(/renderPortfolioBody/);
    expect(host).not.toMatch(/btn-open-create-client/);
    expect(host).not.toMatch(/btn-firebase-push-local/);
    expect(shouldRenderLegacyPageHeaderPortfolioSlot()).toBe(false);
    expect(pageHeaderPortfolioSlotPresentation()).toBe('omit');
  });

  it('leftover ManagerCockpit keeps exactly one page-content wrapper per body', () => {
    const host = code(HOST);
    const wrappers = host.match(/class="page-content"/g) ?? [];
    expect(wrappers).toHaveLength(1);
    expect(host).toMatch(/managerPage\(renderClientsBody\(filters\)\)/);
    expect(host).toMatch(/managerPage\(renderAICenterBody\(\)\)/);
    expect(host).toMatch(/managerPage\(renderPortfolioBody\(filters\)\)/);
  });

  it('ClientWorkspace leftover PageHeader import is omitted; ClientPortal stays omitted', () => {
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(WORKSPACE)).not.toMatch(/\brenderPage\b/);
    expect(code(PORTAL)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(PORTAL)).not.toMatch(/\brenderPage\b/);
    expect(shouldRenderLegacyPageHeaderPortalSlot()).toBe(false);
    expect(pageHeaderPortalSlotPresentation()).toBe('omit');
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

describe('Phase 6 PageHeader ManagerCockpit cutover — React owner', () => {
  it('ReactManagerCockpitPage serves ReactTabHeader inside existing cockpit-card', () => {
    const page = code(PAGE);
    expect(page).toMatch(/from\s+['"]\.\.\/PageHeader\/ReactPageHeader['"]/);
    expect(page).toMatch(/<ReactTabHeader\s+tab=\{COCKPIT_HEADER_TAB\[tab\]\}/);
    expect(page).toMatch(/className="card cockpit-card"/);
    expect(page).toMatch(/data-testid="react-manager-cockpit"/);
    expect(page).not.toMatch(/className="page-content"/);
    expect(page).not.toMatch(/createRoot/);
    expect(page).not.toMatch(/#app/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*eyebrow=/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*actions=/);
    expect(code(REACT)).toMatch(/export function ReactTabHeader/);
    expect(code(REACT)).toMatch(/TAB_META\[tab\] \|\| \{ title: 'POSTURA', subtitle: '' \}/);
  });

  it('page-local leftover tab mapping preserves PORTFOLIO_TABS title/subtitle', () => {
    const page = read(PAGE);
    expect(page).toMatch(/portfolio:\s*'dashboard'/);
    expect(page).toMatch(/clients:\s*'clients'/);
    expect(page).toMatch(/ai:\s*'ai-center'/);
    expect(TAB_META.dashboard).toEqual(PORTFOLIO_TABS.dashboard);
    expect(TAB_META.clients).toEqual(PORTFOLIO_TABS.clients);
    expect(TAB_META['ai-center']).toEqual(PORTFOLIO_TABS['ai-center']);
    expect(TAB_META.dashboard?.title).toBe('Hoy');
    expect(TAB_META.clients?.title).toBe('Clientes');
    expect(TAB_META['ai-center']?.title).toBe('IA y operación');
    expect(TAB_META.dashboard?.subtitle).toBe(
      'Tu cola de atención. El resto vive en Clientes o en el detalle plegable.'
    );
    expect(TAB_META.clients?.subtitle).toBe(
      'Directorio de la cartera. Métricas calculadas en vivo desde señales, tareas y entregas.'
    );
    expect(TAB_META['ai-center']?.subtitle).toBe(
      'Sesión de claves, proveedor y observabilidad de corridas.'
    );
  });

  it('create-client and rematerialize stay in-panel, not in header actions', () => {
    const page = code(PAGE);
    expect(page).toMatch(/<CreateClientPanel \/>/);
    expect(page).toMatch(/useCreateClientWithInvite/);
    expect(page).toMatch(/<RematerializeLocalSnapshotPanel \/>/);
    expect(page).toMatch(/useRematerializeLocalSnapshot/);
    expect(page).not.toMatch(/<ReactTabHeader[^>]*actions=/);
    expect(code(APPSHELL)).toMatch(/ReactManagerCockpitPage/);
    expect(code(APPSHELL)).not.toMatch(/ReactTabHeader/);
  });
});

describe('Phase 6 PageHeader ManagerCockpit cutover — Option-E / A38', () => {
  it('exclusive ManagerCockpit PageHeader id is portfolio-header-only and distinct', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT)).toBe(true);
    expect(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT).toBe('client-portfolio-page-header');
    expect(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT).not.toBe(CLIENT_PORTAL_PAGE_HEADER_SLOT);
    expect(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT).not.toBe(CLIENT_CONTENT_EDITOR_CLAIM_SAFETY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portfolio-page-header');
    expect(listKnownReactExclusiveSlotIds()).toContain('client-portal-page-header');
    expect(listKnownReactExclusiveSlotIds()).not.toContain('page-header');
    expect(existsSync(join(ROOT, SLOT))).toBe(true);
    expect(existsSync(join(ROOT, PORTAL_SLOT))).toBe(true);
  });

  it('omit-slot, exclusive activation, and zero ManagerCockpit import are atomic', () => {
    const omitted =
      pageHeaderPortfolioSlotPresentation() === 'omit' &&
      !shouldRenderLegacyPageHeaderPortfolioSlot();
    const exclusive =
      hasReactExclusiveSlot() && isReactExclusiveSlot(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT);
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

describe('Phase 6 PageHeader ManagerCockpit cutover — authority / closed subsets', () => {
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

  it('leftover header-button disappearance is presentation-only; handler stays unmatched', () => {
    expect(code(HOST)).not.toMatch(/btn-open-create-client/);
    expect(code(HOST)).not.toMatch(/btn-firebase-push-local/);
    const handler = code(HANDLER);
    expect(handler).toMatch(/btn-firebase-push-local/);
    expect(handler).toMatch(/btn-open-create-client/);
    expect(handler).toMatch(/rematerializeLocalSnapshot\(/);
    expect(handler).toMatch(/createClientWithInvite\(/);
    expect(handler).toMatch(/requireAdmin\(\)/);
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
    expect(code(WORKSPACE)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    expect(code(PORTAL)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
  });
});
