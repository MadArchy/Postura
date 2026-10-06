/**
 * SPEC-010 · React AppShell (wave 1, T-010-111).
 *
 * Authority: presentation only. The shell renders navigation, badge counts and
 * session chrome. It issues no strategic command and stores nothing.
 *
 * Data: every read goes through a query hook → facade → (canonical consumer |
 * labelled compatibility read). This module imports neither `dbService`, nor a
 * `Local*Store`, nor Firestore, nor any AI provider.
 *
 * MULTI-THESIS: the thesis selector lists every viewable thesis and its value is
 * a pure view filter. No thesis is pre-selected as authoritative, nothing reads
 * `theses[0]`, and no ordering is treated as precedence (threat T-010-15). The
 * same holds for the campaign selector.
 *
 * Navigation is local presentation state owned by this shell in Stage B (T-010-403).
 * Legacy islands request navigation through the presentation bridge; they do not
 * own global sidebar or top-level tab authority in normal React mode.
 */

import { useEffect, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useCanonicalOpportunities,
  useClientBadges,
  usePortfolioBadges,
  useShellContext,
  useWorkspaceBadges,
} from '../../hooks/useShellData';
import { sessionCommands } from '../../commands/commandSeam';
import { subscribeShellNavigation } from '../../legacy/navigationBridge';
import { LegacyIslandHost } from '../../legacy/LegacyIslandHost';
import { isLegacyIslandTab, isWorkspaceTab, legacyIslandTabId } from '../../legacy/shellTabs';
import { Wave2Surface, type Wave2Group } from '../wave2/Wave2Surface';
import { ReactManagerCockpitPage } from '../pages/ReactManagerCockpitPage';
import { ReactClientPortalPage, type ClientPortalTab } from '../pages/ReactClientPortalPage';
import { ReactClientWorkspacePage, type WorkspaceTab } from '../pages/ReactClientWorkspacePage';

/**
 * Which wave-2 component group, if any, belongs to a tab. A tab with no entry
 * has no migrated component yet; it is not a missing feature, it is a surface
 * whose migration belongs to a later phase.
 */
const WAVE2_BY_TAB: Record<string, Wave2Group> = {
  'client-opps': 'opportunities',
  'client-results': 'results',
  'client-profile': 'profile',
  'ws-sources': 'sources',
};

/**
 * Wave-3 page ownership (T-010-301…305).
 *
 * A tab listed here is rendered by a migrated React page. Every one of these
 * pages is HYBRID or READ_ONLY, never a full cutover, so the legacy surface
 * remains the served default and the pages state which actions still live there.
 *
 * A tab owned by a wave-3 page does not additionally render its wave-2 group:
 * two components must not claim the same surface (threat T-010-24).
 */
const WORKSPACE_TAB_BY_ID: Record<string, WorkspaceTab> = {
  'ws-radar': 'radar',
  'ws-deliver': 'deliver',
  'ws-briefs': 'briefs',
  'ws-sources-react': 'sources',
  'ws-tasks': 'tasks',
  'ws-results': 'results',
  'ws-positioning': 'positioning',
  'ws-production': 'production',
};

const PORTAL_TAB_BY_ID: Record<string, ClientPortalTab> = {
  'client-home': 'home',
  'client-feed': 'tasks',
  'client-content': 'content',
  'client-thesis': 'thesis',
};

const COCKPIT_TABS = new Set(['dashboard', 'clients', 'ai-center']);

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly badge?: number;
}

function NavGroup({
  label,
  items,
  activeTab,
  onSelect,
}: {
  label: string;
  items: readonly NavItem[];
  activeTab: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="sidebar-group">
      <p className="sidebar-group-label">{label}</p>
      <div className="sidebar-links">
        {items.map(({ id, label: itemLabel, badge }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-link ${activeTab === id ? 'active' : ''}`}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
            data-tab={id}
          >
            <span>{itemLabel}</span>
            {badge ? <span className="sidebar-badge">{badge}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReactAppShell() {
  const { user, tenantScope, isAdmin, isImpersonating } = useSession();
  const [activeTab, setActiveTab] = useState(isAdmin ? 'dashboard' : 'client-home');
  const [activeClientId, setActiveClientId] = useState('all');

  // Presentation filters. Empty string means "all" — an explicit, non-authoritative
  // absence of filter rather than an implicit first-item selection.
  const [campaignFilter, setCampaignFilter] = useState('');
  const [thesisFilter, setThesisFilter] = useState('');

  useEffect(() => {
    return subscribeShellNavigation((intent) => {
      setActiveTab(intent.tab);
      if (intent.clientId !== undefined) setActiveClientId(intent.clientId);
    });
  }, []);

  const enterClient = (clientId: string, tab = 'ws-radar') => {
    setActiveClientId(clientId);
    setActiveTab(tab);
  };

  const backToPortfolio = () => {
    setActiveClientId('all');
    setActiveTab('dashboard');
  };

  const selectTab = (tab: string) => {
    if (isAdmin && isWorkspaceTab(tab) && activeClientId === 'all') {
      setActiveTab('clients');
      return;
    }
    setActiveTab(tab);
  };

  const portfolio = usePortfolioBadges(isAdmin ? tenantScope : null);
  const workspace = useWorkspaceBadges(isAdmin ? null : tenantScope);
  const clientBadges = useClientBadges(isAdmin ? null : tenantScope);
  const canonicalOpportunities = useCanonicalOpportunities(isAdmin ? null : tenantScope);
  const shellContext = useShellContext(tenantScope, null);

  if (!user) return null;

  if (!tenantScope) {
    // Fail closed: a session without a usable trusted scope reads nothing.
    return (
      <div className="card" role="alert" data-testid="react-shell-no-scope">
        <h2>Sesión sin contexto de organización</h2>
        <p className="muted">
          No se puede determinar el ámbito de organización de forma confiable, así que no se muestran
          datos.
        </p>
      </div>
    );
  }

  const isLoading =
    portfolio.isLoading || workspace.isLoading || clientBadges.isLoading || shellContext.isLoading;

  const campaigns = shellContext.data?.campaigns ?? [];
  const theses = shellContext.data?.theses ?? [];

  const workspaceTab = WORKSPACE_TAB_BY_ID[activeTab];
  const portalTab = PORTAL_TAB_BY_ID[activeTab];
  const cockpitTab = COCKPIT_TABS.has(activeTab);
  const wave3Owns = Boolean(workspaceTab || portalTab || cockpitTab);
  const wave2Group = wave3Owns ? undefined : WAVE2_BY_TAB[activeTab];
  const legacyIsland = isLegacyIslandTab(activeTab);
  const inWorkspace = isAdmin && activeClientId !== 'all';
  const cockpitSection =
    activeTab === 'clients' ? 'clients' : activeTab === 'ai-center' ? 'ai' : 'portfolio';

  const sidebar = isAdmin ? (
    <>
      <NavGroup
        label="Cartera"
        items={[
          { id: 'dashboard', label: 'Hoy', badge: portfolio.data?.clientsNeedingAttention },
          { id: 'clients', label: 'Clientes' },
        ]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
      {inWorkspace ? (
        <NavGroup
          label={`Cliente · ${activeClientId}`}
          items={[
            { id: 'ws-briefing', label: 'Resumen' },
            { id: 'ws-radar', label: 'Radar' },
            { id: 'ws-deliver', label: 'Entregas' },
            { id: 'ws-briefs', label: 'Strategic Briefs' },
            { id: 'ws-positioning', label: 'Posicionamiento' },
            { id: 'ws-sources-react', label: 'Fuentes' },
            { id: 'ws-tasks', label: 'Tareas' },
            { id: 'ws-production', label: 'Producción' },
            { id: 'ws-results', label: 'Resultados' },
          ]}
          activeTab={activeTab}
          onSelect={selectTab}
        />
      ) : (
        <NavGroup
          label="Workspace"
          items={[
            { id: 'ws-radar', label: 'Radar' },
            { id: 'ws-deliver', label: 'Entregas' },
            { id: 'ws-briefs', label: 'Strategic Briefs' },
            { id: 'ws-positioning', label: 'Posicionamiento' },
            { id: 'ws-sources-react', label: 'Fuentes' },
            { id: 'ws-tasks', label: 'Tareas' },
            { id: 'ws-results', label: 'Resultados' },
          ]}
          activeTab={activeTab}
          onSelect={selectTab}
        />
      )}
      <NavGroup
        label="Sistema"
        items={[{ id: 'ai-center', label: 'IA y operación' }]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
    </>
  ) : (
    <>
      <NavGroup
        label="Mi semana"
        items={[
          { id: 'client-home', label: 'Esta semana', badge: clientBadges.data?.openTasks || undefined },
          {
            id: 'client-content',
            label: 'Revisar',
            badge: clientBadges.data?.pendingContentReview || undefined,
          },
          {
            id: 'client-opps',
            label: 'Oportunidades',
            badge: canonicalOpportunities.data?.length || undefined,
          },
        ]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
      <NavGroup
        label="Mi trayectoria"
        items={[
          {
            id: 'client-profile',
            label: 'Mi perfil',
            badge: clientBadges.data?.profileIncomplete ? 1 : undefined,
          },
          { id: 'client-thesis', label: 'Mi posicionamiento' },
          { id: 'client-results', label: 'Resultados' },
        ]}
        activeTab={activeTab}
        onSelect={selectTab}
      />
    </>
  );

  return (
    <>
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span className="sidebar-brand-text">
            <span className="brand-logo">POSTURA</span>
            <span className="sidebar-role">
              {isAdmin ? 'Cockpit del manager' : 'Portal del cliente'}
            </span>
          </span>
        </div>

        <nav className="sidebar-nav">{sidebar}</nav>

        <div className="sidebar-footer">
          <span className="sidebar-footnote">{isAdmin ? 'Brand Manager' : 'Cliente'}</span>
        </div>
      </aside>

      <header className="topbar">
        <nav className="breadcrumb" aria-label="Ubicación">
          <span className="breadcrumb-root">{isAdmin ? 'Cartera' : 'Mi espacio'}</span>
          {inWorkspace ? (
            <>
              <span className="breadcrumb-sep" aria-hidden="true">
                /
              </span>
              <button type="button" className="link-btn" onClick={backToPortfolio}>
                Volver a cartera
              </button>
            </>
          ) : null}
        </nav>

        <div className="topbar-right">
          {!isAdmin && campaigns.length > 1 ? (
            <label className="campaign-filter-label">
              <span className="sr-only">Campaña activa</span>
              <select
                className="form-select form-select-sm"
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                data-testid="react-campaign-filter"
              >
                <option value="">Todas las campañas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isAdmin && theses.length > 1 ? (
            <label className="campaign-filter-label">
              <span className="sr-only">Tesis activa</span>
              <select
                className="form-select form-select-sm"
                value={thesisFilter}
                onChange={(e) => setThesisFilter(e.target.value)}
                data-testid="react-thesis-filter"
              >
                {/* No thesis is pre-selected: the default is an explicit "all". */}
                <option value="">Todas las tesis</option>
                {theses.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isLoading ? (
            <span className="status-pill" data-testid="react-shell-loading">
              Cargando…
            </span>
          ) : null}

          <span className="topbar-divider" aria-hidden="true" />

          <div className="topbar-user">
            <div className="user-avatar" aria-hidden="true">
              {(user.displayName || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="topbar-user-meta">
              <span className="topbar-user-name">{user.displayName || user.email}</span>
              <span className={`role-pill ${isAdmin ? 'admin' : 'client'}`}>
                {isAdmin ? 'Manager' : 'Cliente'}
              </span>
            </div>
          </div>

          <div className="topbar-actions">
            {isImpersonating ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => sessionCommands.returnToManager()}
              >
                Volver al cockpit
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              title="Salir"
              aria-label="Cerrar sesión"
              onClick={() => sessionCommands.logout()}
              data-testid="react-shell-logout"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="main-wrapper" data-testid="react-shell-body">
        {isAdmin && isWorkspaceTab(activeTab) && activeClientId === 'all' ? (
          <div className="card" data-testid="react-shell-workspace-guard">
            <h3>Selecciona un cliente</h3>
            <p className="muted">Abre un workspace desde la cartera para trabajar en pestañas de cliente.</p>
          </div>
        ) : null}

        {cockpitTab && !(isWorkspaceTab(activeTab) && activeClientId === 'all') ? (
          <ReactManagerCockpitPage
            shellTab={cockpitSection}
            onEnterClient={(clientId) => enterClient(clientId, 'ws-radar')}
          />
        ) : null}
        {workspaceTab && activeClientId !== 'all' ? (
          <ReactClientWorkspacePage tab={workspaceTab} clientId={activeClientId} />
        ) : null}
        {portalTab ? <ReactClientPortalPage tab={portalTab} /> : null}
        {wave2Group ? <Wave2Surface group={wave2Group} /> : null}
        {legacyIsland &&
        (!isWorkspaceTab(activeTab) || activeClientId !== 'all') &&
        !(workspaceTab && activeClientId !== 'all') ? (
          <LegacyIslandHost
            tab={legacyIslandTabId(activeTab)}
            clientId={activeClientId}
            campaignId={campaignFilter || null}
            thesisId={thesisFilter || undefined}
            testId="react-legacy-island"
          />
        ) : null}
      </main>
    </>
  );
}
