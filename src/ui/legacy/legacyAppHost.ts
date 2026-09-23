import type { AppHost } from '../../controllers/sessionController';
import type { TenantDecision } from '../../controllers/trustedTenant';
import type { UiFilterState } from '../../controllers/appUiState';
import type { ContentStatus } from '../../types';
import type { ContentPipelineAction } from '../../domain/contentPublishCore';
import type { StrategicDownstreamAction } from '../../domain/strategicBriefCore';
import type { ContentItem, Task } from '../../types';
import type { createStrategicSignalRoutingUseCases } from '../../composition/strategicSignalRouting/composeStrategicSignalRouting';
import type { SourceAutomationScheduler } from '../../controllers/sourceAutomationScheduler';

/** Scope and tenant resolution for legacy handler modules. */
export interface LegacyScopeHost {
  resolveClientId(fallback?: string | null): string;
  resolveOrganizationId(clientId?: string | null): string | null;
  requireTenant(requested?: string | null): TenantDecision;
  currentClientId(): string | null;
  readonly filterState: UiFilterState;
}

/** Modal presentation state for legacy handler modules. */
export interface LegacyModalHost {
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
}

/** Redraw main content while preserving focused input caret. */
export interface LegacyRefreshHost {
  refreshMain(): void;
}

/** Portfolio / workspace navigation for legacy handler modules. */
export interface LegacyNavigationHost extends AppHost, LegacyScopeHost {
  setActiveCampaign(campaignId: string): void;
  enterClient(clientId: string, tab?: string): void;
  backToPortfolio(): void;
}

export type StrategicRoutingPort = ReturnType<typeof createStrategicSignalRoutingUseCases>;

export type SourceAutomationPort = Pick<
  SourceAutomationScheduler,
  'pollSources' | 'pollOneSource'
>;

/** Host surface shared by content and client-portal handler binders. */
export interface LegacyHandlerHost extends AppHost, LegacyScopeHost, LegacyModalHost {
  gateStrategicDownstream(
    clientId: string,
    briefId: string | undefined,
    action: StrategicDownstreamAction
  ):
    | {
        ok: true;
        briefId: string;
        version?: number;
        thesisId: string;
        signalIds: string[];
        evidenceIds: string[];
        planId: string;
        planItemId: string;
      }
    | { ok: false; message: string };
  syncContentToPipelineStatus(
    contentId: string,
    legacyStatus: ContentStatus,
    comment?: string,
    options?: {
      reviewAcknowledged?: boolean;
      requireReviewAck?: boolean;
      claimSafetyOverride?: import('../../types').ClaimSafetyVerdictRecord;
    }
  ): boolean;
  saveContentWithClaimGate(
    content: ContentItem,
    targetStatus: ContentStatus,
    comment?: string
  ): boolean;
  runContentPipelineAction(contentId: string, action: ContentPipelineAction): boolean;
  approveClientArticle(
    contentId: string,
    taskId?: string,
    draft?: { title?: string; body?: string }
  ): boolean;
  rejectClientArticle(contentId: string, reason: string, taskId?: string): boolean;
  toastExecErr(error: unknown, fallback: string): void;
  markArticleReviewStarted(task: Task, contentId: string): void;
}

/** Host surface for teleprompter UI wiring from client portal handlers. */
export interface TeleprompterHandlerHost extends LegacyModalHost, AppHost, LegacyScopeHost {
  readonly teleprompter: {
    stopTeleprompter(): void;
    startTeleprompter(): void;
    stopRecordingSession(): void;
    initTeleprompterCamera(): Promise<void>;
    startRecording(): Promise<void>;
    stopRecordingToPreview(): Promise<void>;
    retakeRecording(): void;
    confirmSendRecording(taskId: string): Promise<void>;
    hydrateRecordingVideos(): Promise<void>;
    markVideoCaptureStarted(task: Task): void;
    markArticleReviewStarted(task: Task, contentId: string): void;
  };
}

/** Host surface for client portal handler binders (non-teleprompter). */
export interface ClientPortalHandlerHost extends LegacyHandlerHost {
  readonly teleprompter: TeleprompterHandlerHost['teleprompter'];
}

/** Host surface for content pipeline command functions. */
export interface ContentPipelineHost {
  showToast(message: string, type?: 'success' | 'warning' | 'info' | 'error'): void;
  render(): void;
  requireTenant(requested?: string | null): TenantDecision;
}

/** Host surface for teleprompter/recording controller. */
export interface TeleprompterHost extends ContentPipelineHost {
  closeModal(): void;
  readonly modalData: unknown;
  resolveOrganizationId(clientId?: string | null): string | null;
}

/** Host surface for source automation scheduler. */
export interface SourceAutomationHost {
  showToast(message: string, type?: 'success' | 'warning' | 'info' | 'error'): void;
  render(): void;
  requireTenant(requested?: string | null): TenantDecision;
  currentClientId(): string | null;
  readonly activeTab: string;
  readonly activeClientId: string;
}

export interface LoginHandlerHost extends AppHost {
  loginError: string;
}

export interface NavigationHandlerHost extends LegacyNavigationHost, LegacyRefreshHost, LegacyModalHost {}

export interface FiltersHandlerHost extends LegacyRefreshHost, AppHost, LegacyScopeHost {}

export interface SessionHandlerHost extends AppHost, LegacyScopeHost {}

export interface ClientAdminHandlerHost extends AppHost, LegacyModalHost {
  requireAdmin(): TenantDecision;
}

export interface OnboardingHandlerHost extends AppHost, LegacyModalHost, LegacyScopeHost {}

export interface ProfileHandlerHost extends AppHost, LegacyScopeHost {}

export interface ThesisHandlerHost
  extends AppHost, LegacyModalHost, LegacyScopeHost, LegacyRefreshHost {
  readonly strategicRouting: StrategicRoutingPort;
}

export interface DossierHandlerHost extends AppHost, LegacyScopeHost {}

export interface RadarHandlerHost extends AppHost, LegacyScopeHost, LegacyRefreshHost {
  readonly strategicRouting: StrategicRoutingPort;
}

export interface SourcesHandlerHost extends RadarHandlerHost, LegacyModalHost {
  readonly sourceAutomation: SourceAutomationPort;
  readonly activeTab: string;
}

export interface TasksHandlerHost extends AppHost, LegacyModalHost, LegacyScopeHost {
  readonly teleprompter: TeleprompterHandlerHost['teleprompter'];
}

export interface CurationHandlerHost extends AppHost, LegacyScopeHost {}

export interface AdvisorHandlerHost extends AppHost, LegacyScopeHost {}

export interface DeliveryHandlerHost extends ContentPipelineHost, AppHost, LegacyModalHost, LegacyScopeHost {}

/** Union host type used when binding all legacy event handlers from LegacyApp. */
export type LegacyAppHandlerHost =
  & LoginHandlerHost
  & NavigationHandlerHost
  & FiltersHandlerHost
  & SessionHandlerHost
  & ClientAdminHandlerHost
  & OnboardingHandlerHost
  & ProfileHandlerHost
  & ThesisHandlerHost
  & DossierHandlerHost
  & SourcesHandlerHost
  & TasksHandlerHost
  & RadarHandlerHost
  & CurationHandlerHost
  & AdvisorHandlerHost
  & DeliveryHandlerHost
  & LegacyHandlerHost
  & ClientPortalHandlerHost;
