import { authService } from '../../services/auth';
import { dbService } from '../../services/db';
import { auditService } from '../../services/audit';
import { processDeadlineReminders } from '../../services/reminders';
import { createStrategicSignalRoutingUseCases } from '../../composition/strategicSignalRouting/composeStrategicSignalRouting';
import { renderAppShell, renderBriefingBar } from '../../components/AppShell';
import { renderManagerCockpit } from '../../components/ManagerCockpit';
import { renderClientWorkspace } from '../../components/ClientWorkspace';
import { renderClientPortal } from '../../components/ClientPortal';
import { renderLogin } from '../../components/Login';
import {
  PORTFOLIO_TAB_IDS,
  WORKSPACE_TAB_IDS,
  CLIENT_TAB_IDS,
  isWorkspaceTab,
} from '../presentation/pageTabMeta';
import { CAMP_ADOPTION } from '../../data/juanCampaignSeed';
import {
  gateStrategicDownstream as gateStrategicDownstreamCmd,
  syncContentToPipelineStatus as syncContentToPipelineStatusCmd,
  saveContentWithClaimGate as saveContentWithClaimGateCmd,
  toastExecErr as toastExecErrCmd,
  approveClientArticle as approveClientArticleCmd,
  rejectClientArticle as rejectClientArticleCmd,
  runContentPipelineAction as runContentPipelineActionCmd,
} from '../../controllers/contentPipelineCommands';
import { SourceAutomationScheduler } from '../../controllers/sourceAutomationScheduler';
import { TeleprompterController } from './teleprompterController';
import { bindContentHandlers } from './handlers/contentHandlers';
import { bindClientPortalHandlers } from './handlers/clientPortalHandlers';
import { bindLoginHandlers } from './handlers/loginHandlers';
import { renderNotificationsPanel } from './handlers/notificationsHandlers';
import { bindNavigationHandlers } from './handlers/navigationHandlers';
import { bindFiltersHandlers } from './handlers/filtersHandlers';
import { bindSessionHandlers } from './handlers/sessionHandlers';
import { bindClientAdminHandlers } from './handlers/clientAdminHandlers';
import { bindOnboardingHandlers } from './handlers/onboardingHandlers';
import { bindProfileHandlers } from './handlers/profileHandlers';
import { bindThesisHandlers } from './handlers/thesisHandlers';
import { bindDossierHandlers } from './handlers/dossierHandlers';
import { bindSourcesHandlers } from './handlers/sourcesHandlers';
import { bindTasksHandlers } from './handlers/tasksHandlers';
import { bindRadarHandlers } from './handlers/radarHandlers';
import { bindCurationHandlers } from './handlers/curationHandlers';
import { bindAdvisorHandlers } from './handlers/advisorHandlers';
import { bindDeliveryHandlers } from './handlers/deliveryHandlers';
import type {
  LegacyAppHandlerHost,
  SourceAutomationHost,
  TeleprompterHandlerHost,
  TeleprompterHost,
} from './legacyAppHost';
import {
  requireAdminActor,
  requireTenantScope,
  type TenantDecision,
} from '../../controllers/trustedTenant';
import { themeService } from '../../services/theme';
// SPEC-010 T-010-402: presentation state, toasts, modal dispatch and navigation
// rules now live outside this controller. See specs/010-react-migration.
import { AppUiState } from '../../controllers/appUiState';
import { ToastController, type ToastType } from '../../controllers/toastController';
import { presentActiveModal } from '../../controllers/modalPresenter';
import { createRenderScheduler } from '../../controllers/renderScheduler';
import {
  findNotificationTarget,
  resolveTabTransition,
  NOTIFICATION_HIGHLIGHT_MS,
  NOTIFICATION_SCROLL_DELAY_MS,
} from '../../controllers/navigationController';
import { readUiMode } from '../../ui/strangler/toggle';
import {
  registerLegacyIslandController,
  type LegacyIslandMountConfig,
} from '../../controllers/legacyIslandBridge';
import { publishShellNavigation } from './navigationBridge';
import { PORTFOLIO_SCOPE } from '../../controllers/appUiState';

export class LegacyApp {
  /**
   * SPEC-010 T-010-402: presentation state is owned by `AppUiState`, not by this
   * controller. The accessors below keep the existing call sites working while
   * the ownership â€” and the ability to test navigation without a DOM â€” moves out.
   */
  private readonly ui = new AppUiState();
  private readonly toastController = new ToastController();
  private readonly teleprompterController = new TeleprompterController(this as unknown as TeleprompterHost);
  private readonly sourceAutomation = new SourceAutomationScheduler(this as unknown as SourceAutomationHost);

  private asContentPipelineHost(): import('./legacyAppHost').ContentPipelineHost {
    return this as unknown as import('./legacyAppHost').ContentPipelineHost;
  }

  private get activeTab(): string { return this.ui.activeTab; }
  private set activeTab(value: string) { this.ui.activeTab = value; }
  private get activeClientId(): string { return this.ui.activeClientId; }
  private set activeClientId(value: string) { this.ui.activeClientId = value; }
  private get activeCampaignId(): string | null { return this.ui.activeCampaignId; }
  private set activeCampaignId(value: string | null) { this.ui.activeCampaignId = value; }
  private get activeModal(): string | null { return this.ui.activeModal; }
  private set activeModal(value: string | null) { this.ui.activeModal = value; }
  private get modalData(): any { return this.ui.modalData; }
  private set modalData(value: any) { this.ui.modalData = value; }
  private get filterState() { return this.ui.filterState; }
  private get loginError(): string { return this.ui.loginError; }
  private set loginError(value: string) { this.ui.loginError = value; }

  readonly strategicRouting = createStrategicSignalRoutingUseCases(dbService);
  private readonly renderScheduler = createRenderScheduler(() => this.render());
  /** Stage-B legacy island host supplied by React shell (T-010-403). */
  private islandHostEl: HTMLElement | null = null;
  private islandGeneration = 0;

  constructor() {
    registerLegacyIslandController({
      mountIsland: (host, config) => this.mountLegacyIsland(host, config),
      unmountIsland: () => this.unmountLegacyIsland(),
      refreshIsland: () => this.refreshLegacyIslandIfMounted(),
    });
    void this.boot();
  }

  private isReactShellOwner(): boolean {
    return readUiMode() === 'react';
  }

  private publishShellNavigationFromLegacy(tab: string): void {
    publishShellNavigation({
      tab,
      clientId: this.activeClientId !== PORTFOLIO_SCOPE ? this.activeClientId : PORTFOLIO_SCOPE,
    });
  }

  /** Called by React LegacyIslandHost â€” mounts page-local legacy surface only. */
  mountLegacyIsland(host: HTMLElement, config: LegacyIslandMountConfig): void {
    this.islandGeneration += 1;
    this.islandHostEl = host;
    this.activeTab = config.tab;
    this.activeClientId = config.clientId ?? PORTFOLIO_SCOPE;
    if (config.campaignId !== undefined) this.activeCampaignId = config.campaignId;
    if (config.thesisId !== undefined) this.filterState.thesisId = config.thesisId;
    this.renderIsland();
  }

  unmountLegacyIsland(): void {
    this.islandGeneration += 1;
    if (this.islandHostEl) this.islandHostEl.innerHTML = '';
    this.islandHostEl = null;
    if (this.activeModal === 'teleprompter') {
      this.teleprompterController.stopRecordingSession();
      this.teleprompterController.stopTeleprompter();
    }
    this.ui.closeModal();
  }

  refreshLegacyIslandIfMounted(): void {
    if (this.islandHostEl) this.renderIsland();
  }

  private async boot() {
    themeService.init();
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeModal) {
        event.preventDefault();
        this.closeModal();
      }
    });
    const { onFirestorePushError } = await import('../../services/firestore/sync');
    onFirestorePushError((message) => this.showToast(message, 'warning'));
    await authService.ready;
    authService.subscribe((user) => {
      if (!user) {
        this.sourceAutomation.stopSourceAutomation();
        this.activeTab = 'dashboard';
        this.activeClientId = 'all';
        this.render();
        return;
      }
      if (user.role === 'ADMIN') {
        const valid = [...PORTFOLIO_TAB_IDS, ...WORKSPACE_TAB_IDS];
        if (!valid.includes(this.activeTab)) this.activeTab = 'dashboard';
        if (isWorkspaceTab(this.activeTab) && this.activeClientId === 'all') this.activeTab = 'dashboard';
        this.sourceAutomation.startSourceAutomation();
      } else {
        this.sourceAutomation.stopSourceAutomation();
        if (user.mustCompleteOnboarding) {
          this.activeModal = 'onboarding';
          this.modalData = { clientId: user.clientId, step: 1 };
        }
        if (!CLIENT_TAB_IDS.includes(this.activeTab)) this.activeTab = 'client-home';
        this.activeCampaignId = this.resolveCampaignId(user.clientId || undefined);
      }
      this.render();
    });

    dbService.onChange(() => {
      if (authService.getCurrentUser()) this.renderScheduler.schedule();
    });
  }

  public showToast(message: string, type: ToastType = 'info') {
    this.toastController.show(message, type);
  }

  private renderToasts() {
    this.toastController.render();
  }

  private resolveCampaignId(clientId?: string): string | null {
    const id = clientId || authService.getCurrentUser()?.clientId;
    if (!id) return null;
    const campaigns = dbService.getCampaignsByClient(id);
    const stored = localStorage.getItem(`postura_active_campaign_${id}`);
    if (stored && campaigns.some((c) => c.id === stored)) return stored;
    return campaigns[0]?.id || CAMP_ADOPTION;
  }

  setActiveCampaign(campaignId: string) {
    const user = authService.getCurrentUser();
    const clientId = user?.clientId;
    if (clientId) localStorage.setItem(`postura_active_campaign_${clientId}`, campaignId);
    this.activeCampaignId = campaignId;
    const camp = dbService.getCampaignById(campaignId);
    if (camp) this.showToast(`CampaÃ±a: ${camp.name}`, 'info');
    this.render();
  }

  /** Cliente sobre el que se estÃ¡ trabajando, o null si estamos en la cartera. */
  private currentClientId(): string | null {
    return this.ui.currentClientId();
  }

  /** Tenant organization for writes: client record, else session â€” never a hardcoded id. */
  resolveOrganizationId(clientId?: string | null): string | null {
    if (clientId) {
      const fromClient = dbService.getClientById(clientId)?.organizationId?.trim();
      if (fromClient) return fromClient;
    }
    const fromSession = authService.getCurrentUser()?.organizationId?.trim();
    return fromSession || null;
  }

  /**
   * Cliente *candidato* de una acciÃ³n. NO es autoridad de tenant.
   *
   * AUDIT010-11: antes terminaba en `dbService.getClients()[0]?.id`, es decir
   * elegÃ­a un tenant por posiciÃ³n cuando no habÃ­a ninguno resuelto. Ese tramo
   * se eliminÃ³: ahora devuelve '' y quien ejecute un efecto debe pasar el
   * candidato por `requireTenantScope`, que falla cerrado.
   */
  resolveClientId(fallback?: string | null): string {
    const user = authService.getCurrentUser();
    return fallback || this.currentClientId() || user?.clientId || '';
  }

  /** Display-only default for screens without an active client (not tenant authority). */
  private displayClientId(): string {
    return this.resolveClientId() || dbService.getClients()[0]?.id || '';
  }

  /** Gate de tenant de confianza para efectos. Falla cerrado. */
  requireTenant(requested?: string | null): TenantDecision {
    return requireTenantScope(requested, {
      getCurrentUser: () => authService.getCurrentUser(),
      getClientById: (id) => dbService.getClientById(id),
    });
  }

  /** Gate de actor de confianza para utilidades sin tenant propio. */
  requireAdmin(): TenantDecision {
    return requireAdminActor({ getCurrentUser: () => authService.getCurrentUser() });
  }

  enterClient(clientId: string, tab?: string) {
    if (this.isReactShellOwner()) {
      const resolvedTab = tab && tab.startsWith('ws-') ? tab : 'ws-briefing';
      publishShellNavigation({ tab: resolvedTab, clientId });
      const client = dbService.getClientById(clientId);
      auditService.log(authService.getCurrentUser(), 'OPEN_CLIENT_WORKSPACE', 'Client', clientId);
      this.showToast(`Trabajando con ${client?.displayName || clientId}`, 'info');
      return;
    }
    this.ui.enterClient(clientId, tab);
    const client = dbService.getClientById(clientId);
    auditService.log(authService.getCurrentUser(), 'OPEN_CLIENT_WORKSPACE', 'Client', clientId);
    this.showToast(`Trabajando con ${client?.displayName || clientId}`, 'info');
    this.render();
  }

  backToPortfolio() {
    if (this.isReactShellOwner()) {
      publishShellNavigation({ tab: 'dashboard', clientId: PORTFOLIO_SCOPE });
      return;
    }
    this.ui.backToPortfolio();
    this.render();
  }

  public render() {
    this.renderScheduler.cancel();
    if (this.isReactShellOwner()) {
      if (this.islandHostEl) this.renderIsland();
      return;
    }

    const appEl = document.getElementById('app');
    if (!appEl) return;

    const user = authService.getCurrentUser();
    if (!user) {
      appEl.innerHTML = renderLogin(this.loginError, new URLSearchParams(location.search).get('invite') || '');
      this.bindLogin();
      this.renderToasts();
      return;
    }

    const workspaceClientId = user.role === 'ADMIN' ? this.currentClientId() : null;

    appEl.innerHTML = `
      <div class="app-container">
        ${renderAppShell(this.activeTab, this.activeClientId, this.activeCampaignId, this.filterState.thesisId || null)}
        <main class="main-wrapper">
          ${this.renderMainView()}
        </main>
        ${workspaceClientId ? renderBriefingBar(this.activeTab, workspaceClientId) : ''}
        ${this.renderActiveModal()}
      </div>
    `;

    this.bindEvents();
    this.renderToasts();
    if (this.activeModal) {
      requestAnimationFrame(() => {
        const firstControl = document.querySelector<HTMLElement>(
          '.modal-overlay .modal-content button, .modal-overlay .modal-content input, .modal-overlay .modal-content select, .modal-overlay .modal-content textarea'
        );
        firstControl?.focus();
      });
    }
    if (user) processDeadlineReminders();
  }

  /** Stage-B island render â€” no global legacy shell; React owns sidebar and lifecycle. */
  private renderIsland() {
    const host = this.islandHostEl;
    if (!host) return;
    const generation = this.islandGeneration;

    const user = authService.getCurrentUser();
    if (!user) {
      host.innerHTML = '';
      return;
    }

    const workspaceClientId = user.role === 'ADMIN' ? this.currentClientId() : null;

    host.innerHTML = `
      <div class="legacy-island-root" data-legacy-island="true">
        <main class="main-wrapper">
          ${this.renderMainView()}
        </main>
        ${workspaceClientId ? renderBriefingBar(this.activeTab, workspaceClientId) : ''}
        ${this.renderActiveModal()}
      </div>
    `;

    this.bindEvents();
    this.renderToasts();
    if (generation !== this.islandGeneration) return;
    if (this.activeModal) {
      requestAnimationFrame(() => {
        const firstControl = document.querySelector<HTMLElement>(
          '.modal-overlay .modal-content button, .modal-overlay .modal-content input, .modal-overlay .modal-content select, .modal-overlay .modal-content textarea'
        );
        firstControl?.focus();
      });
    }
    if (user) processDeadlineReminders();
  }

  private renderMainView(): string {
    const user = authService.getCurrentUser();
    if (!user) return '';

    if (user.role !== 'ADMIN') {
      // AUDIT010-11: este tramo caÃ­a en `getClients()[0]` cuando la sesiÃ³n de
      // cliente no traÃ­a clientId, es decir pintaba el portal de OTRO tenant.
      // Falla cerrado: sin clientId de confianza no se pinta portal alguno.
      const trustedClientId = user.clientId?.trim();
      if (!trustedClientId) {
        return `<div class="empty-state"><h3>SesiÃ³n sin cliente asignado</h3><p>Contacta a tu manager para completar el alta.</p></div>`;
      }
      return renderClientPortal(
        this.activeTab,
        trustedClientId,
        this.activeCampaignId,
        this.filterState.thesisId || undefined,
        this.filterState.highlightTaskId || undefined
      );
    }

    const clientId = this.currentClientId();
    if (clientId && isWorkspaceTab(this.activeTab)) {
      return renderClientWorkspace(this.activeTab, clientId, {
        searchQuery: this.activeTab === 'ws-production' ? this.filterState.contentSearch : this.filterState.searchQuery,
        sourceType: this.filterState.sourceType,
        priorityBand: this.filterState.priorityBand,
        contentStatus: this.filterState.contentStatus,
        topicKey: this.filterState.topicKey || undefined,
        radarView: this.filterState.radarView,
        thesisId: this.filterState.thesisId || undefined,
      });
    }

    return renderManagerCockpit(this.activeTab, {
      searchQuery:
        this.activeTab === 'dashboard' || this.activeTab === 'clients'
          ? this.filterState.portfolioSearch
          : this.filterState.searchQuery,
      sourceType: this.filterState.sourceType,
      contentStatus: this.filterState.contentStatus,
    });
  }

  /** Redibuja y devuelve el foco al campo que lo tenÃ­a, para no interrumpir la escritura. */
  refreshMain() {
    const active = document.activeElement as HTMLInputElement | null;
    const focusId = active?.id || '';
    const caret = active?.selectionStart ?? null;

    this.render();

    if (!focusId) return;
    const restored = document.getElementById(focusId) as HTMLInputElement | null;
    if (!restored) return;
    restored.focus();
    if (caret !== null && typeof restored.setSelectionRange === 'function') {
      restored.setSelectionRange(caret, caret);
    }
  }

  private bindLogin() {
    bindLoginHandlers(this as unknown as LegacyAppHandlerHost);
  }

  openModal(id: string) {
    this.ui.openModal(id);
    this.render();
  }

  setTab(tab: string) {
    const transition = resolveTabTransition(tab, this.currentClientId());
    if (!transition.ok) {
      this.showToast(transition.message, 'warning');
      return;
    }
    if (this.isReactShellOwner()) {
      this.publishShellNavigationFromLegacy(transition.tab);
      return;
    }
    this.activeTab = transition.tab;
    this.render();
  }

  navigateFromNotification(tab: string, targetId?: string | null) {
    if (targetId) this.filterState.highlightTaskId = targetId;
    this.setTab(tab);
    if (targetId) {
      window.setTimeout(() => {
        findNotificationTarget(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
          this.filterState.highlightTaskId = '';
        }, NOTIFICATION_HIGHLIGHT_MS);
      }, NOTIFICATION_SCROLL_DELAY_MS);
    }
  }

  private renderActiveModal(): string {
    const presentation = presentActiveModal({
      activeModal: this.activeModal,
      modalData: this.modalData,
      fallbackClientId: this.displayClientId(),
      currentClientId: this.currentClientId(),
      isAdmin: authService.getCurrentUser()?.role === 'ADMIN',
      renderNotificationsPanel: () => renderNotificationsPanel(),
    });
    if (presentation.forceClose) this.activeModal = null;
    return presentation.html;
  }

  closeModal(): void {
    if (this.activeModal === 'teleprompter') {
      this.teleprompterController.stopRecordingSession();
      this.teleprompterController.stopTeleprompter();
    }
    this.ui.closeModal();
    this.render();
  }

  private bindEvents() {
    const host = this as unknown as LegacyAppHandlerHost;
    bindNavigationHandlers(host);
    bindFiltersHandlers(host);
    bindSessionHandlers(host);
    bindClientAdminHandlers(host);
    bindOnboardingHandlers(host);
    bindThesisHandlers(host);
    bindDossierHandlers(host);
    bindSourcesHandlers(host);
    bindTasksHandlers(host);
    bindRadarHandlers(host);
    bindCurationHandlers(host);
    bindAdvisorHandlers(host);
    bindDeliveryHandlers(host);
    bindContentHandlers(host);
    bindClientPortalHandlers(host);
    bindProfileHandlers(host);
  }

  get teleprompter(): TeleprompterHandlerHost['teleprompter'] {
    return this.teleprompterController;
  }

  gateStrategicDownstream(
    clientId: string,
    briefId: string | undefined,
    action: import('../../domain/strategicBriefCore').StrategicDownstreamAction
  ) {
    return gateStrategicDownstreamCmd(clientId, briefId, action);
  }

  syncContentToPipelineStatus(
    contentId: string,
    legacyStatus: import('../../types').ContentStatus,
    comment?: string,
    options?: {
      reviewAcknowledged?: boolean;
      requireReviewAck?: boolean;
      claimSafetyOverride?: import('../../types').ClaimSafetyVerdictRecord;
    }
  ): boolean {
    return syncContentToPipelineStatusCmd(this.asContentPipelineHost(), contentId, legacyStatus, comment, options);
  }

  saveContentWithClaimGate(
    content: import('../../types').ContentItem,
    targetStatus: import('../../types').ContentStatus,
    comment?: string
  ): boolean {
    return saveContentWithClaimGateCmd(this.asContentPipelineHost(), content, targetStatus, comment);
  }

  toastExecErr(error: unknown, fallback: string): void {
    toastExecErrCmd(this.asContentPipelineHost(), error, fallback);
  }

  approveClientArticle(
    contentId: string,
    taskId?: string,
    draft?: { title?: string; body?: string }
  ): boolean {
    return approveClientArticleCmd(this.asContentPipelineHost(), contentId, taskId, draft);
  }

  rejectClientArticle(contentId: string, reason: string, taskId?: string): boolean {
    return rejectClientArticleCmd(this.asContentPipelineHost(), contentId, reason, taskId);
  }

  runContentPipelineAction(
    contentId: string,
    action: import('../../domain/contentPublishCore').ContentPipelineAction
  ): boolean {
    return runContentPipelineActionCmd(this.asContentPipelineHost(), contentId, action);
  }

  markArticleReviewStarted(task: import('../../types').Task, contentId: string): void {
    this.teleprompterController.markArticleReviewStarted(task, contentId);
  }
}

export function createLegacyApp(): LegacyApp {
  if (import.meta.env.DEV) {
    (window as unknown as { posturaReseedLocal?: () => void }).posturaReseedLocal = () => {
      dbService.resetLocalDemoAndReload();
    };
  }
  return new LegacyApp();
}
