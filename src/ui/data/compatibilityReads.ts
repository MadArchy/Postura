/**
 * SPEC-010 · legacy compatibility read facade.
 *
 * STATUS: NONAUTHORITATIVE_COMPATIBILITY_READ.
 *
 * This is the ONLY module in the React presentation layer permitted to import
 * `dbService`. It exists so React modules never import the legacy singleton
 * directly (acceptance A8, threat T-010-01) while the canonical projections for
 * these resources do not yet exist.
 *
 * This facade is NOT canonical and must never be presented as such. It performs
 * reads only — no mutator is exposed, and none may be added. When a canonical
 * projection becomes available for a resource, that resource moves to
 * `canonicalReads.ts` and is removed from here.
 *
 * Tenant note (AUDIT010-05): the underlying legacy reads are `clientId`-scoped
 * only. Callers must pass a `TrustedTenantScope`, so the organization is always
 * part of the cache identity even though the legacy layer cannot enforce it.
 * This narrows cache-level bleed; it does not make the legacy read
 * organization-safe, and that gap stays recorded until the canonical migration.
 */

import { dbService } from '../../services/db';
import { mapOpportunityLifecycle } from '../../domain/opportunityLifecycle';
import {
  computeProfileCoverage,
  nextIncompleteOnboardingStep,
  PROFILE_SECTION_LABELS,
  PROFILE_SECTION_ORDER,
} from '../../domain/profileCoverage';
import {
  aggregateWeeklyKpis,
  primaryKpiSeries,
  sumKpi,
  sumKpiThisWeek,
} from '../../domain/kpiWeekly';
import { kpiLabel } from '../../lib/campaignLabels';
import {
  assertThesisReadyForReview,
  normalizeThesis,
  OBJECTIVE_KIND_LABELS,
  thesisCompleteness,
  validateWeights,
  VOICE_DIMENSION_LABELS,
} from '../../domain/thesisModelCore';
import {
  canActivateThesis,
  extractEditableFields,
  thesesAwaitingClientAction,
  thesisForClientReview,
} from '../../domain/thesisRevisionCore';
import type { PositioningThesis, ThesisEditableFields } from '../../types';
import { computeThesisStrength } from '../../domain/thesisStrengthCore';
import { deliveryItemKindLabel, deliveryStatusLabel } from '../../domain/deliveryCore';
import { deriveWorkStage } from '../../domain/workPipeline';
import { countUnhealthySources } from '../../domain/sourceHealthActionsCore';
import { summarizeSourceHealth } from '../../services/sourceHealth';
import { hasArticleSectionMarkers } from '../../domain/articleReviewCore';
import { mapLegacyContentStatus } from '../../domain/contentPipeline';
import type { BusinessKpiType, Client, MasterDossier } from '../../types';
import type { TrustedTenantScope } from '../query/tenantScope';

export const COMPATIBILITY_READ_STATUS = 'NONAUTHORITATIVE_COMPATIBILITY_READ' as const;

/** Requires a trusted scope so a compatibility read cannot be issued from UI-supplied identity. */
function requireClient(scope: TrustedTenantScope): string | null {
  return scope.clientId;
}

export interface PortfolioBadgeCounts {
  readonly clientsNeedingAttention: number;
}

export function readPortfolioBadges(_scope: TrustedTenantScope): PortfolioBadgeCounts {
  return {
    clientsNeedingAttention: dbService.getPortfolioSummary().filter((s) => s.attentionScore > 0).length,
  };
}

export interface WorkspaceBadgeCounts {
  readonly unreviewedSignals: number;
  readonly pendingCuration: number;
  readonly draftDeliveryItems: number;
  readonly sourceErrors: number;
  readonly openTasks: number;
  readonly inProduction: number;
}

export function readWorkspaceBadges(scope: TrustedTenantScope): WorkspaceBadgeCounts {
  const clientId = requireClient(scope);
  if (!clientId) {
    return {
      unreviewedSignals: 0,
      pendingCuration: 0,
      draftDeliveryItems: 0,
      sourceErrors: 0,
      openTasks: 0,
      inProduction: 0,
    };
  }

  return {
    unreviewedSignals: dbService
      .getSignalsByClient(clientId)
      .filter((s) => s.managerDecision === 'UNREVIEWED' && s.status !== 'DISCARDED').length,
    pendingCuration: dbService.getPendingCurationByClient(clientId).length,
    draftDeliveryItems: dbService.getDraftDelivery(clientId)?.items.length || 0,
    sourceErrors: dbService.getSourcesByClient(clientId).filter((s) => s.status === 'ERROR').length,
    openTasks: dbService
      .getTasksByClient(clientId)
      .filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
    inProduction: dbService.getContentByClient(clientId).filter((c) => c.status !== 'PUBLISHED').length,
  };
}

export interface ClientBadgeCounts {
  readonly openTasks: number;
  readonly pendingContentReview: number;
  readonly openOpportunities: number;
  readonly profileIncomplete: boolean;
}

export function readClientBadges(scope: TrustedTenantScope): ClientBadgeCounts {
  const clientId = requireClient(scope);
  if (!clientId) {
    return { openTasks: 0, pendingContentReview: 0, openOpportunities: 0, profileIncomplete: false };
  }

  const coverage = computeProfileCoverage(dbService.getMasterProfile(clientId));

  return {
    openTasks: dbService
      .getTasksByClient(clientId)
      .filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length,
    pendingContentReview: dbService
      .getContentByClient(clientId)
      .filter((c) => c.status === 'CLIENT_REVIEW').length,
    openOpportunities: dbService.getOpportunitiesByClient(clientId).filter((o) => {
      if (o.status === 'ARCHIVED') return false;
      const stage = mapOpportunityLifecycle(o);
      return stage === 'proposed' || stage === 'checklist' || stage === 'accepted';
    }).length,
    profileIncomplete: coverage ? !coverage.meetsPilotThreshold : false,
  };
}

export interface ShellContextRead {
  readonly workspaceClientName: string | null;
  readonly workspaceClientProfession: string | null;
  /** Presentation-only option lists. Selecting an option is never a strategic decision. */
  readonly campaigns: readonly { id: string; name: string }[];
  readonly theses: readonly { id: string; title: string }[];
}

export function readShellContext(
  scope: TrustedTenantScope,
  workspaceClientId: string | null
): ShellContextRead {
  const clientId = workspaceClientId ?? requireClient(scope);
  if (!clientId) {
    return {
      workspaceClientName: null,
      workspaceClientProfession: null,
      campaigns: [],
      theses: [],
    };
  }

  const client = dbService.getClientById(clientId);

  return {
    workspaceClientName: client?.displayName ?? null,
    workspaceClientProfession: client?.profession ?? null,
    campaigns: dbService.getCampaignsByClient(clientId).map((c) => ({ id: c.id, name: c.name })),
    // MULTI-THESIS: every viewable thesis is returned. No primary/first thesis is
    // selected here and no ordering implies authority (threat T-010-15).
    theses: dbService
      .getThesesByClient(clientId)
      .filter((t) => t.status === 'ACTIVE' || t.status === 'UNDER_REVIEW')
      .map((t) => ({ id: t.id, title: t.title })),
  };
}

/* ------------------------------------------------------------------------- *
 * Wave-2 reads (T-010-201…204)
 *
 * Every derived number below is computed by a domain function called here, not
 * in a React component: the facade projects, the domain calculates, and the
 * component only renders (threat T-010-19). Each read stays read-only — no
 * mutator exists in this module and none may be added.
 * ------------------------------------------------------------------------- */

export interface MasterDossierRead {
  readonly dossier: MasterDossier | null;
  readonly client: Client | null;
}

/** T-010-201 · `MasterDossierPanel`. No canonical dossier projection exists. */
export function readMasterDossier(scope: TrustedTenantScope): MasterDossierRead {
  const clientId = requireClient(scope);
  if (!clientId) return { dossier: null, client: null };
  return {
    dossier: dbService.getMasterDossier(clientId) ?? null,
    client: dbService.getClientById(clientId) ?? null,
  };
}

/** Same display selection as the legacy chart, so the migrated view is a parity view. */
const CHART_KPIS: readonly BusinessKpiType[] = [
  'consultation_requests',
  'linkedin_profile_views',
  'website_visits_from_linkedin',
];

export interface KpiSeriesRead {
  readonly kpiType: string;
  readonly label: string;
  readonly values: readonly number[];
  readonly max: number;
}

export interface KpiWeeklyRead {
  readonly weekLabels: readonly string[];
  readonly series: readonly KpiSeriesRead[];
  readonly tiles: readonly { readonly label: string; readonly value: number }[];
  readonly consultationsThisWeek: number;
}

/** T-010-203 · `KpiWeeklyChart`. Aggregation is `domain/kpiWeekly`, not this facade and not React. */
export function readKpiWeekly(scope: TrustedTenantScope): KpiWeeklyRead {
  const clientId = requireClient(scope);
  if (!clientId) {
    return { weekLabels: [], series: [], tiles: [], consultationsThisWeek: 0 };
  }

  const results = dbService.getResultsByClient(clientId);
  const buckets = aggregateWeeklyKpis(
    results.filter((result) => result.kpiType),
    8
  );

  return {
    weekLabels: buckets.map((bucket) => bucket.weekLabel.split(' – ')[0]),
    series: primaryKpiSeries(buckets, [...CHART_KPIS]).map((s) => ({
      kpiType: s.kpiType,
      label: s.label,
      values: s.values,
      max: s.max,
    })),
    tiles: CHART_KPIS.map((kpiType) => ({
      label: kpiLabel(kpiType),
      value: sumKpi(results, kpiType),
    })),
    consultationsThisWeek: sumKpiThisWeek(results, 'consultation_requests'),
  };
}

export interface ProfileFactRead {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly status: string;
}

export interface ProfileSectionRead {
  readonly section: string;
  readonly label: string;
  readonly confirmed: number;
  readonly candidates: number;
  readonly complete: boolean;
  readonly facts: readonly ProfileFactRead[];
}

export interface ProfileOverviewRead {
  readonly totalConfirmed: number;
  readonly sectionsWithFacts: number;
  readonly meetsPilotThreshold: boolean;
  readonly sections: readonly ProfileSectionRead[];
  readonly clientDisplayName: string | null;
  readonly profileCompleteness: number;
  readonly serviceLines: readonly {
    readonly name: string;
    readonly description: string;
    readonly offerings: readonly string[];
  }[];
}

/** T-010-203 · `ClientProfilePanel`, display portion only. Fact mutation stays legacy (AUDIT010-09). */
export function readProfileOverview(scope: TrustedTenantScope): ProfileOverviewRead {
  const clientId = requireClient(scope);
  const empty: ProfileOverviewRead = {
    totalConfirmed: 0,
    sectionsWithFacts: 0,
    meetsPilotThreshold: false,
    sections: [],
    clientDisplayName: null,
    profileCompleteness: 0,
    serviceLines: [],
  };
  if (!clientId) return empty;

  const profile = dbService.getMasterProfile(clientId);
  const coverage = computeProfileCoverage(profile);
  const client = dbService.getClientById(clientId);
  const dossier = dbService.getMasterDossier(clientId);
  const facts = profile?.facts || [];

  return {
    totalConfirmed: coverage.totalConfirmed,
    sectionsWithFacts: coverage.sectionsWithFacts,
    meetsPilotThreshold: coverage.meetsPilotThreshold,
    sections: PROFILE_SECTION_ORDER.map((section) => {
      const coverageSection = coverage.sections.find((s) => s.label === PROFILE_SECTION_LABELS[section]);
      return {
        section,
        label: PROFILE_SECTION_LABELS[section],
        confirmed: coverageSection?.confirmed ?? 0,
        candidates: coverageSection?.candidates ?? 0,
        complete: coverageSection?.complete ?? false,
        facts: facts
          .filter((f) => f.section === section && f.status !== 'rejected')
          .map((f) => ({ id: f.id, label: f.label, value: f.value, status: f.status })),
      };
    }),
    clientDisplayName: client?.displayName ?? null,
    profileCompleteness: client?.profileCompleteness || 0,
    serviceLines: (dossier?.serviceLines || []).map((line) => ({
      name: line.name,
      description: line.description,
      offerings: line.offerings,
    })),
  };
}

export interface ProofWallItemRead {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly complete: boolean;
  readonly evidenceUrl: string | null;
}

export interface ProofWallRead {
  readonly items: readonly ProofWallItemRead[];
  readonly complete: number;
  readonly total: number;
  readonly percentComplete: number;
}

/** T-010-203 · `ProofWallPanel`, read-only. The status toggle stays legacy (AUDIT010-09). */
export function readProofWall(scope: TrustedTenantScope): ProofWallRead {
  const clientId = requireClient(scope);
  if (!clientId) return { items: [], complete: 0, total: 0, percentComplete: 0 };

  const items = dbService.getProofWallByClient(clientId);
  const complete = items.filter((item) => item.status === 'complete').length;

  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      complete: item.status === 'complete',
      evidenceUrl: item.evidenceId
        ? dbService.getEvidenceById(item.evidenceId)?.sourceUrl ?? null
        : null,
    })),
    complete,
    total: items.length,
    percentComplete: items.length ? Math.round((complete / items.length) * 100) : 0,
  };
}

export interface OnboardingContextRead {
  readonly displayName: string;
  readonly profession: string;
  readonly currentRole: string;
  readonly company: string;
  readonly selfDescription: string;
  readonly primaryGoal: string;
  readonly secondaryGoals: string;
  readonly targetAudience: string;
  readonly industries: string;
  readonly countries: string;
  readonly education: string;
  readonly highlights: string;
  readonly linkedin: string;
  readonly website: string;
  readonly tone: string;
  readonly topicsToAvoid: string;
  readonly complianceGuidelines: string;
  readonly totalConfirmed: number;
  readonly sectionsWithFacts: number;
  readonly coverageSections: readonly { readonly label: string; readonly complete: boolean }[];
  /** Suggested step from `domain/profileCoverage` — a presentation hint, not a gate. */
  readonly suggestedStep: number;
}

/**
 * T-010-205 · `OnboardingWizard`, presentation scope.
 *
 * The matrix records this component as 2 compatibility reads and **0 writes**:
 * the onboarding step is applied by the legacy controller, not by the component.
 * This read therefore projects the current values the wizard displays, and the
 * suggested step is computed by the domain, not by React.
 */
export function readOnboardingContext(scope: TrustedTenantScope): OnboardingContextRead {
  const clientId = requireClient(scope);
  const empty: OnboardingContextRead = {
    displayName: '',
    profession: '',
    currentRole: '',
    company: '',
    selfDescription: '',
    primaryGoal: '',
    secondaryGoals: '',
    targetAudience: '',
    industries: '',
    countries: '',
    education: '',
    highlights: '',
    linkedin: '',
    website: '',
    tone: '',
    topicsToAvoid: '',
    complianceGuidelines: '',
    totalConfirmed: 0,
    sectionsWithFacts: 0,
    coverageSections: [],
    suggestedStep: 1,
  };
  if (!clientId) return empty;

  const client = dbService.getClientById(clientId);
  const profile = dbService.getMasterProfile(clientId);
  const coverage = computeProfileCoverage(profile);

  const displayName =
    client?.displayName ||
    `${client?.firstName || ''} ${client?.lastName || ''}`.trim();

  return {
    displayName,
    profession: client?.profession || '',
    currentRole: profile?.career?.currentRole || '',
    company: client?.company || '',
    selfDescription: profile?.identity?.selfDescription || '',
    primaryGoal: profile?.goals?.primaryGoal || '',
    secondaryGoals: (profile?.goals?.secondaryGoals || []).join(', '),
    targetAudience:
      profile?.audience?.targetAudienceDescription || client?.targetMarket || '',
    industries: (profile?.audience?.targetIndustries || []).join(', '),
    countries: (profile?.audience?.targetCountries || []).join(', '),
    education: (profile?.education || [])
      .map((e) => `${e.degree} - ${e.institution} (${e.year || ''})`)
      .join('\n'),
    highlights: (profile?.careerHistory || [])
      .map((h) => `${h.role} en ${h.organization}: ${h.highlight}`)
      .join('\n'),
    linkedin: profile?.socialLinks?.linkedin || '',
    website: profile?.socialLinks?.website || '',
    tone: profile?.voicePreferences?.tone || '',
    topicsToAvoid: (profile?.voicePreferences?.topicsToAvoid || []).join(', '),
    complianceGuidelines: profile?.voicePreferences?.complianceGuidelines || '',
    totalConfirmed: coverage.totalConfirmed,
    sectionsWithFacts: coverage.sectionsWithFacts,
    coverageSections: coverage.sections
      .slice(0, 6)
      .map((s) => ({ label: s.label, complete: s.complete })),
    suggestedStep: nextIncompleteOnboardingStep(profile),
  };
}

export interface SourceRead {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly url: string | null;
  readonly fetchIntervalMinutes: number;
  readonly hasError: boolean;
}

/**
 * T-010-204 · `SourceRegistryModal`, read-only inventory.
 *
 * The legacy modal also runs the source-discovery agent while rendering. That is
 * a service call with its own side effects, so it is deliberately NOT reproduced
 * here: a read facade must not trigger an agent run.
 */
export function readSources(scope: TrustedTenantScope): readonly SourceRead[] {
  const clientId = requireClient(scope);
  if (!clientId) return [];
  return dbService.getSourcesByClient(clientId).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    url: s.url ?? null,
    fetchIntervalMinutes: s.fetchIntervalMinutes,
    hasError: s.status === 'ERROR',
  }));
}

/* ======================================================================
 * WAVE 3 — page-level compatibility reads (T-010-301…305)
 *
 * Same rule as above, applied to pages: reads only, one declared source per
 * projection, every derived number produced by the domain function the legacy
 * page already calls. Three legacy behaviours are deliberately NOT reproduced,
 * because a read facade must not carry them:
 *
 *   - `runSourceDiscoveryAgent` during render (`ClientWorkspace:1983`, `:2247`)
 *     — an agent run triggered by rendering. Excluded; the recommendation
 *     surface stays legacy-only (EFFECT_FIRST, see `tasks.md`).
 *   - `aiService.isServerGatewayAvailable()` during render
 *     (`ManagerCockpit:130`, `:496`) — a service probe on the render path.
 *     Excluded; the React AI-centre panel reports quota only.
 *   - first-thesis and first-campaign fallbacks (`ClientPortal:536`, `:121`,
 *     `ManagerCockpit:205`) — every wave-3 read takes an explicit id and
 *     returns an unresolved marker instead of guessing (threat T-010-15).
 * ====================================================================== */

export interface PortfolioRowRead {
  readonly clientId: string;
  readonly displayName: string;
  readonly profession: string;
  readonly company: string;
  readonly attentionScore: number;
  readonly attentionReasons: readonly string[];
  readonly activeThesisCount: number;
  readonly activeThesisTitles: readonly string[];
  readonly pendingCuration: number;
  readonly unreviewedSignals: number;
}

export interface PortfolioOverviewRead {
  readonly rows: readonly PortfolioRowRead[];
  readonly totalClients: number;
  readonly needingAttention: number;
  readonly totalActiveTheses: number;
}

/**
 * T-010-303 · `ManagerCockpit` portfolio and directory projection.
 *
 * Portfolio scope: this read is NOT client-scoped, so it deliberately does not
 * call `requireClient`. It still requires a trusted scope, because the cache key
 * must carry the organization even though the legacy read cannot enforce it
 * (AUDIT010-05).
 *
 * Unlike the legacy directory row, which shows `getActiveTheses(id)[0]` and
 * silently hides the rest, every active thesis title is returned so the manager
 * can see that a client has more than one (threat T-010-15).
 */
export function readPortfolioOverview(_scope: TrustedTenantScope): PortfolioOverviewRead {
  const summaries = dbService.getPortfolioSummary();

  const rows = summaries.map((summary) => {
    const client = summary.client;
    const activeTheses = dbService.getActiveTheses(client.id);
    return {
      clientId: client.id,
      displayName: client.displayName || `${client.firstName} ${client.lastName}`.trim(),
      profession: client.profession || '',
      company: client.company || '',
      attentionScore: summary.attentionScore,
      attentionReasons: [...(summary.attentionReasons ?? [])],
      activeThesisCount: activeTheses.length,
      activeThesisTitles: activeTheses.map((t) => t.title),
      pendingCuration: dbService.getPendingCurationByClient(client.id).length,
      unreviewedSignals: dbService
        .getSignalsByClient(client.id)
        .filter((s) => s.status === 'NEW').length,
    };
  });

  return {
    rows,
    totalClients: rows.length,
    needingAttention: rows.filter((r) => r.attentionScore > 0).length,
    totalActiveTheses: rows.reduce((acc, r) => acc + r.activeThesisCount, 0),
  };
}

export interface AiCenterRead {
  readonly tier: string;
  readonly status: string;
  readonly aiRunsUsed: number;
  readonly tokensUsed: number;
  readonly runs: readonly {
    readonly id: string;
    readonly agent: string;
    readonly provider: string;
    readonly modelName: string;
    readonly createdAt: string;
    readonly status: string;
    readonly ok: boolean;
  }[];
}

/**
 * T-010-303 · AI-centre quota and run log.
 *
 * Gateway availability is not probed here: the legacy panel calls
 * `aiService.isServerGatewayAvailable()` while rendering, and a read facade must
 * not make service calls with side-effect potential. The React panel therefore
 * reports quota and history only, and the gateway strip stays legacy-only.
 */
export function readAiCenter(_scope: TrustedTenantScope): AiCenterRead {
  const subscription = dbService.getSubscription();
  return {
    tier: subscription.tier,
    status: subscription.status,
    aiRunsUsed: subscription.monthlyUsage.aiRuns,
    tokensUsed: subscription.monthlyUsage.tokensUsed,
    runs: dbService.getAiRuns(10).map((run) => ({
      id: run.id,
      agent: run.agent,
      provider: run.provider,
      modelName: run.modelName,
      createdAt: run.createdAt,
      status: run.status,
      ok: run.status === 'SUCCESS',
    })),
  };
}

export interface ThesisOptionRead {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly clientApprovalStatus: string;
  readonly awaitingClientAction: boolean;
  readonly priority: number;
}

/**
 * Every thesis of the client, with no selection applied.
 *
 * The caller must choose explicitly. There is no `[0]`, no "primary", no
 * highest-priority pick: `priority` is returned as data for display, never used
 * here to elect a thesis (threats T-010-15, T-010-16).
 */
export function readThesisOptions(scope: TrustedTenantScope): readonly ThesisOptionRead[] {
  const clientId = requireClient(scope);
  if (!clientId) return [];
  const theses = dbService.getThesesByClient(clientId);
  const awaitingIds = new Set(thesesAwaitingClientAction(theses).map((t) => t.id));
  return theses.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    clientApprovalStatus: t.clientApprovalStatus,
    awaitingClientAction: awaitingIds.has(t.id),
    priority: t.priority ?? 0,
  }));
}

export interface ThesisDetailRead {
  readonly resolved: boolean;
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly clientApprovalStatus: string;
  readonly needsAction: boolean;
  readonly hasPendingRevision: boolean;
  readonly clientFeedback: string;
  readonly proofPoints: readonly string[];
  readonly identityCurrent: string;
  readonly expertIdentity: string;
  readonly perceptionTarget: string;
  readonly differentiator: string;
  readonly domain: string;
  readonly audiences: readonly { readonly label: string; readonly tier: string }[];
  readonly territories: readonly string[];
  readonly objectives: readonly { readonly label: string; readonly weight: number }[];
  readonly voice: readonly { readonly label: string; readonly value: number }[];
  readonly hardBlocks: readonly string[];
  readonly softAvoid: readonly string[];
  readonly completenessScore: number;
  readonly missingBlocks: readonly string[];
  readonly weightsOk: boolean;
  readonly weightsTotal: number;
  readonly readyForReview: boolean;
  readonly readinessBlockers: readonly string[];
  readonly activationBlockers: readonly string[];
  /** Factual editable snapshot for manager save merge — Domain extractEditableFields. */
  readonly editableFields: ThesisEditableFields | null;
  readonly strengthScore: number | null;
  readonly assignedEvidence: number;
}

/** Legacy ClientPortal visibility — presentation compatibility only. */
function legacyThesisNeedsAction(thesis: PositioningThesis): boolean {
  return Boolean(
    thesis &&
      ((thesis.status === 'UNDER_REVIEW' && thesis.clientApprovalStatus === 'PENDING') ||
        (thesis.pendingRevision && thesis.clientApprovalStatus === 'PENDING'))
  );
}

const UNRESOLVED_THESIS: ThesisDetailRead = {
  resolved: false,
  id: '',
  title: '',
  status: '',
  clientApprovalStatus: '',
  needsAction: false,
  hasPendingRevision: false,
  clientFeedback: '',
  proofPoints: [],
  identityCurrent: '',
  expertIdentity: '',
  perceptionTarget: '',
  differentiator: '',
  domain: '',
  audiences: [],
  territories: [],
  objectives: [],
  voice: [],
  hardBlocks: [],
  softAvoid: [],
  completenessScore: 0,
  missingBlocks: [],
  weightsOk: true,
  weightsTotal: 0,
  readyForReview: false,
  readinessBlockers: [],
  activationBlockers: [],
  editableFields: null,
  strengthScore: null,
  assignedEvidence: 0,
};

/**
 * T-010-301 · one explicitly identified thesis, fully projected.
 *
 * `thesisId` is required and is matched exactly. An unknown id returns
 * `resolved: false` rather than falling back to another thesis — and rather than
 * the legacy editor's behaviour, where an unknown id silently becomes a *new*
 * thesis (`ThesisEditorModal:126-128`). That legacy quirk is deliberately not
 * reproduced; the deviation is recorded in `tasks.md`.
 *
 * Completeness, weight validation, review readiness, activation blockers and
 * strength are all computed by the owning domain functions.
 */
export function readThesisDetail(
  scope: TrustedTenantScope,
  thesisId: string | null
): ThesisDetailRead {
  const clientId = requireClient(scope);
  if (!clientId || !thesisId) return UNRESOLVED_THESIS;

  const thesis = dbService.getThesesByClient(clientId).find((t) => t.id === thesisId);
  if (!thesis) return UNRESOLVED_THESIS;

  const reviewThesis = thesisForClientReview(thesis);
  const normalized = normalizeThesis(reviewThesis);
  const completeness = thesisCompleteness(thesis);
  const readiness = assertThesisReadyForReview(thesis);
  const activation = canActivateThesis(thesis);
  const weights = validateWeights(thesis.objectives ?? []);
  const evidence = dbService.getEvidenceVaultByClient(clientId);
  const strength = computeThesisStrength(thesis, evidence);

  return {
    resolved: true,
    id: thesis.id,
    title: reviewThesis.title,
    status: thesis.status,
    clientApprovalStatus: thesis.clientApprovalStatus,
    needsAction: legacyThesisNeedsAction(thesis),
    hasPendingRevision: Boolean(thesis.pendingRevision),
    clientFeedback: thesis.clientFeedback ?? '',
    proofPoints: [...(reviewThesis.proofPoints ?? [])],
    identityCurrent: reviewThesis.identityCurrent ?? '',
    expertIdentity: reviewThesis.expertIdentity ?? '',
    perceptionTarget: normalized.perceptionTarget ?? reviewThesis.objective ?? '',
    differentiator: reviewThesis.differentiator ?? '',
    domain: reviewThesis.domain ?? '',
    audiences: (reviewThesis.audiences ?? []).map((a) => ({ label: a.name, tier: a.tier })),
    territories: (reviewThesis.territories ?? []).map((t) => t.name),
    objectives: (thesis.objectives ?? []).map((o) => ({
      label: OBJECTIVE_KIND_LABELS[o.kind] ?? o.kind,
      weight: o.weight,
    })),
    voice: Object.entries(thesis.voiceProfile ?? {})
      .filter(([, value]) => typeof value === 'number')
      .map(([key, value]) => ({
        label: VOICE_DIMENSION_LABELS[key as keyof typeof VOICE_DIMENSION_LABELS] ?? key,
        value: Number(value) || 0,
      })),
    hardBlocks: [...(thesis.limits?.hardBlocks ?? [])],
    softAvoid: [...(thesis.limits?.softAvoid ?? [])],
    completenessScore: completeness.score,
    missingBlocks: completeness.missing.map((block) => block.label),
    weightsOk: weights.ok,
    weightsTotal: weights.total,
    readyForReview: readiness.ready,
    readinessBlockers: [...readiness.blockers],
    activationBlockers: activation.ok ? [] : [...activation.blockers],
    editableFields: extractEditableFields(thesis),
    strengthScore: strength.authorityScore,
    assignedEvidence: evidence.filter((item) => item.associatedThesesIds?.includes(thesis.id))
      .length,
  };
}

export interface ClientTaskRead {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly type: string;
  readonly status: string;
  readonly deadline: string | null;
  readonly estimatedMinutes: number | null;
  readonly thesisId: string | null;
  /** Linked content for REVIEW_ARTICLE / RECORD_VIDEO — display/open only. */
  readonly contentItemId: string | null;
  /** Factual teleprompter script for RECORD_VIDEO. Display only. */
  readonly scriptPayload: string | null;
}

function taskRecordingRef(task: { evidenceUrl?: string }): string | null {
  return task.evidenceUrl ?? null;
}

/** T-010-304 · client task queue. Writes via #28 seam (P3A / P3B). */
export function readClientTasks(scope: TrustedTenantScope): readonly ClientTaskRead[] {
  const clientId = requireClient(scope);
  if (!clientId) return [];
  return dbService.getTasksForClient(clientId).map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    status: task.status,
    deadline: task.deadline ?? null,
    estimatedMinutes: task.estimatedMinutes,
    thesisId: task.thesisId ?? null,
    contentItemId: task.contentItemId ?? null,
    scriptPayload: factualScriptPayload(task),
  }));
}

/** Factual teleprompter script only — non-string values stay null (query-cache safe). */
function factualScriptPayload(task: { type?: string; scriptPayload?: unknown }): string | null {
  return typeof task.scriptPayload === 'string' ? task.scriptPayload : null;
}

export function readClientTaskScriptPayload(
  scope: TrustedTenantScope,
  taskId: string
): string | null {
  const clientId = requireClient(scope);
  if (!clientId || !taskId) return null;
  const task = dbService.getTasksForClient(clientId).find((row) => row.id === taskId);
  if (!task || task.type !== 'RECORD_VIDEO') return null;
  return factualScriptPayload(task);
}

export interface ClientBriefingItemRead {
  readonly id: string;
  readonly kindLabel: string;
  readonly title: string;
  readonly rationale: string | null;
  readonly url: string | null;
}

/** T-010-P1 · latest sent briefing for client portal home (limit 1, most recent first). */
export interface ClientLatestBriefingRead {
  readonly id: string;
  readonly title: string;
  readonly periodLabel: string | null;
  readonly itemCount: number;
  readonly status: string;
  readonly statusLabel: string;
  readonly strategicNote: string | null;
  readonly clientAckNote: string | null;
  readonly items: readonly ClientBriefingItemRead[];
}

/** T-010-P1 · mirrors legacy `renderReceivedBriefings(clientId, 1)` ordering. */
export function readClientLatestBriefing(scope: TrustedTenantScope): ClientLatestBriefingRead | null {
  const clientId = requireClient(scope);
  if (!clientId) return null;

  const latest = dbService.getSentDeliveriesByClient(clientId)[0];
  if (!latest) return null;

  return {
    id: latest.id,
    title: latest.title,
    periodLabel: latest.periodLabel ?? null,
    itemCount: latest.items.length,
    status: latest.status,
    statusLabel: deliveryStatusLabel(latest.status),
    strategicNote: latest.strategicNote ?? null,
    clientAckNote: latest.clientAckNote ?? null,
    items: latest.items.map((item) => ({
      id: item.id,
      kindLabel: deliveryItemKindLabel(item.kind),
      title: item.title,
      rationale: item.rationale ?? null,
      url: item.url ?? null,
    })),
  };
}

/** T-010-P1 · display-only context for post-ack manager notification (not authorization). */
export function readBriefingAckNotificationContext(
  scope: TrustedTenantScope,
  packageId: string
): { clientId: string; packageTitle: string; clientDisplayName: string } | null {
  const clientId = requireClient(scope);
  if (!clientId) return null;

  const pkg = dbService.getDeliveryById(packageId);
  if (!pkg || pkg.clientId !== clientId) return null;

  const client = dbService.getClientById(clientId);
  return {
    clientId,
    packageTitle: pkg.title,
    clientDisplayName: client?.displayName || 'Cliente',
  };
}

export interface ContentRowRead {
  readonly id: string;
  readonly title: string;
  readonly platform: string;
  readonly type: string;
  readonly status: string;
  readonly createdAt: string;
  readonly wordCount: number;
}

export interface WorkspaceContentRow {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly platform: string;
  readonly legacyStatus: string;
}

/** CR-1 #31 — ADMIN production list. Read-only; no create/generate. */
export function readWorkspaceContent(scope: TrustedTenantScope): {
  readonly items: readonly WorkspaceContentRow[];
} {
  const clientId = requireClient(scope);
  if (!clientId) return { items: [] };

  return {
    items: dbService.getContentForClient(clientId).map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      platform: item.targetPlatform,
      legacyStatus: item.status,
    })),
  };
}

/** T-010-304 · content pending client review, plus the already-decided history. */
export function readClientContent(scope: TrustedTenantScope): {
  readonly pending: readonly ContentRowRead[];
  readonly decided: readonly ContentRowRead[];
} {
  const clientId = requireClient(scope);
  if (!clientId) return { pending: [], decided: [] };

  const rows = dbService.getContentForClient(clientId).map((item) => ({
    id: item.id,
    title: item.title,
    platform: item.targetPlatform,
    type: item.type,
    status: item.status,
    createdAt: item.createdAt,
    wordCount: (item.body ?? '').trim().split(/\s+/).filter(Boolean).length,
  }));

  return {
    pending: rows.filter((r) => r.status === 'CLIENT_REVIEW'),
    decided: rows.filter((r) => r.status === 'READY' || r.status === 'PUBLISHED'),
  };
}

export interface ContentDetailRead {
  readonly resolved: boolean;
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly platform: string;
  readonly type: string;
  readonly status: string;
  /** Raw legacy status (e.g. CLIENT_REVIEW) for client article-review gating. */
  readonly legacyStatus: string;
  readonly managerNotes: string | null;
  readonly clientFeedback: string | null;
  readonly wordCount: number;
  readonly hasSectionMarkers: boolean;
  readonly claimVerdict: string | null;
  readonly claimFlags: readonly string[];
  readonly feedbackEvents: readonly {
    readonly id: string;
    readonly role: string;
    readonly notes: string;
    readonly createdAt: string;
  }[];
}

/**
 * T-010-302 · one content item, for the preview and diff modals.
 *
 * The legacy diff modal injects `latestEdit.diffHtml` unescaped. This projection
 * returns no HTML at all — React renders text nodes — so the legacy trust
 * boundary is not carried across the seam.
 */
export function readContentDetail(
  scope: TrustedTenantScope,
  contentId: string | null
): ContentDetailRead {
  const empty: ContentDetailRead = {
    resolved: false,
    id: '',
    title: '',
    body: '',
    platform: '',
    type: '',
    status: '',
    legacyStatus: '',
    managerNotes: null,
    clientFeedback: null,
    wordCount: 0,
    hasSectionMarkers: false,
    claimVerdict: null,
    claimFlags: [],
    feedbackEvents: [],
  };
  if (!requireClient(scope) || !contentId) return empty;

  const content = dbService.getContentById(contentId);
  if (!content) return empty;
  if (content.clientId !== requireClient(scope)) return empty;

  return {
    resolved: true,
    id: content.id,
    title: content.title,
    body: content.body ?? '',
    platform: content.targetPlatform,
    type: content.type,
    status: mapLegacyContentStatus(content.status),
    legacyStatus: content.status,
    managerNotes: content.managerNotes?.trim() ? content.managerNotes : null,
    clientFeedback: content.clientFeedback?.trim() ? content.clientFeedback : null,
    wordCount: (content.body ?? '').trim().split(/\s+/).filter(Boolean).length,
    hasSectionMarkers: hasArticleSectionMarkers(content.body ?? ''),
    claimVerdict: content.claimSafety?.verdict ?? null,
    claimFlags: (content.claimSafety?.findings ?? []).map((finding) => finding.detail),
    feedbackEvents: dbService.getFeedbackEventsForContent(contentId).map((event) => ({
      id: event.id,
      role: event.actorRole,
      notes: event.reason ?? '',
      createdAt: event.createdAt,
    })),
  };
}

export interface WorkspaceRadarRead {
  readonly signals: readonly {
    readonly id: string;
    readonly title: string;
    readonly source: string;
    readonly status: string;
    readonly priorityBand: string | null;
    readonly score: number | null;
    readonly thesisId: string | null;
    readonly routingState: string | null;
    readonly publishedAt: string | null;
    readonly inCuration: boolean;
  }[];
  readonly activeThesisCount: number;
  readonly canScore: boolean;
  readonly totalSignals: number;
  readonly newSignals: number;
}

/**
 * T-010-305 · radar signal list.
 *
 * `canScore` mirrors the legacy rule that scoring needs *any* ACTIVE thesis —
 * not a primary one — and is computed from `getActiveTheses`, exactly as
 * `ClientWorkspace:931-933` does.
 */
export function readWorkspaceRadar(scope: TrustedTenantScope): WorkspaceRadarRead {
  const clientId = requireClient(scope);
  if (!clientId) {
    return { signals: [], activeThesisCount: 0, canScore: false, totalSignals: 0, newSignals: 0 };
  }

  const activeTheses = dbService.getActiveTheses(clientId);
  const signals = dbService.getSignalsByClient(clientId).map((signal) => ({
    id: signal.id,
    title: signal.title,
    source: signal.sourceName,
    status: signal.status,
    priorityBand: signal.priorityBand ?? null,
    score: typeof signal.relevanceScore === 'number' ? signal.relevanceScore : null,
    thesisId: signal.thesisId ?? null,
    routingState: signal.routingDecision?.routingState ?? null,
    publishedAt: signal.detectedAt,
    inCuration: dbService.isSignalInCuration(clientId, signal.id),
  }));

  return {
    signals,
    activeThesisCount: activeTheses.length,
    canScore: activeTheses.length > 0,
    totalSignals: signals.length,
    newSignals: signals.filter((s) => s.status === 'NEW').length,
  };
}

export interface WorkspaceDeliverItemRead {
  readonly id: string;
  readonly title: string;
}

export interface WorkspaceDeliverPackageRead {
  readonly id: string;
  readonly title: string;
  readonly strategicNote: string;
  readonly status: string;
  readonly sentAt: string | null;
  readonly itemCount: number;
  readonly itemTitles: readonly string[];
  /** Persisted delivery item ids for #17 remove — factual read only. */
  readonly items: readonly WorkspaceDeliverItemRead[];
}

export interface WorkspaceDeliverReadyEntryRead {
  readonly id: string;
  readonly signalTitle: string;
  readonly destination: string;
  readonly rationale: string;
  readonly strategicBriefId: string | null;
  readonly aiAngle: string | null;
  readonly stage: string;
  /** Persisted attach fact — null when not in a briefing. */
  readonly deliveryPackageId: string | null;
}

export interface WorkspaceDeliverRead {
  readonly pending: readonly {
    readonly id: string;
    readonly signalTitle: string;
    readonly destination: string | null;
    readonly rationale: string;
    readonly strategicBriefId: string | null;
    readonly stage: string;
  }[];
  /** Decided curation rows not yet attached to a sent package — factual read for #15. */
  readonly readyEntries: readonly WorkspaceDeliverReadyEntryRead[];
  readonly ready: number;
  readonly draftItems: number;
  /** Current DRAFT package for #18 send preview — factual read only. */
  readonly draftPackage: WorkspaceDeliverPackageRead | null;
  readonly sentDeliveries: readonly WorkspaceDeliverPackageRead[];
}

/** T-010-305 · curation inbox and delivery history. #18 send is React-native (P7). */
export function readWorkspaceDeliver(scope: TrustedTenantScope): WorkspaceDeliverRead {
  const clientId = requireClient(scope);
  if (!clientId) {
    return {
      pending: [],
      readyEntries: [],
      ready: 0,
      draftItems: 0,
      draftPackage: null,
      sentDeliveries: [],
    };
  }

  const draft = dbService.getDraftDelivery(clientId);
  const pending = dbService.getPendingCurationByClient(clientId).map((entry) => {
    const pkg = entry.deliveryPackageId
      ? dbService.getDeliveryById(entry.deliveryPackageId)
      : undefined;
    return {
      id: entry.id,
      signalTitle: entry.title,
      destination: entry.destination ?? null,
      rationale: entry.managerRationale,
      strategicBriefId: entry.strategicBriefId ?? null,
      stage: deriveWorkStage({ entry, pkg, task: undefined }),
    };
  });

  const toPackageRead = (pkg: NonNullable<typeof draft>): WorkspaceDeliverPackageRead => ({
    id: pkg.id,
    title: pkg.title ?? '',
    strategicNote: pkg.strategicNote ?? '',
    status: pkg.status,
    sentAt: pkg.sentAt ?? null,
    itemCount: pkg.items.length,
    itemTitles: pkg.items.map((item) => item.title),
    items: pkg.items.map((item) => ({ id: item.id, title: item.title })),
  });

  const readyEntries = dbService.getReadyCurationByClient(clientId).map((entry) => {
    const pkg = entry.deliveryPackageId
      ? dbService.getDeliveryById(entry.deliveryPackageId)
      : undefined;
    return {
      id: entry.id,
      signalTitle: entry.title,
      destination: entry.destination as string,
      rationale: entry.managerRationale,
      strategicBriefId: entry.strategicBriefId ?? null,
      aiAngle: entry.aiAngle ?? null,
      stage: deriveWorkStage({ entry, pkg, task: undefined }),
      deliveryPackageId: entry.deliveryPackageId ?? null,
    };
  });

  return {
    pending,
    readyEntries,
    ready: readyEntries.length,
    draftItems: draft?.items.length ?? 0,
    draftPackage: draft ? toPackageRead(draft) : null,
    sentDeliveries: dbService.getSentDeliveriesByClient(clientId).map(toPackageRead),
  };
}

export interface WorkspaceAdviceActionRead {
  readonly id: string;
  readonly title: string;
  readonly why: string;
  readonly how: string;
  readonly horizon: string;
  readonly category: string;
  readonly impact: number;
}

export interface WorkspaceAdviceRead {
  readonly adviceId: string | null;
  readonly actions: readonly WorkspaceAdviceActionRead[];
}

/** Latest persisted PositioningAdvice actions — factual read only. No generate. */
export function readWorkspaceAdvice(scope: TrustedTenantScope): WorkspaceAdviceRead {
  const clientId = requireClient(scope);
  if (!clientId) return { adviceId: null, actions: [] };
  const advice = dbService.getLatestAdvice(clientId);
  if (!advice) return { adviceId: null, actions: [] };
  return {
    adviceId: advice.id,
    actions: advice.actions.map((action) => ({
      id: action.id,
      title: action.title,
      why: action.why,
      how: action.how,
      horizon: action.horizon,
      category: action.category,
      impact: action.impact,
    })),
  };
}

/** P7 presentation notify facts after canonical #18 success (title/body only). */
export function readDeliverySentNotifyFacts(packageId: string): {
  readonly title: string;
  readonly itemCount: number;
} | null {
  const pkg = dbService.getDeliveryById(packageId);
  if (!pkg) return null;
  return { title: pkg.title ?? '', itemCount: pkg.items.length };
}

export interface WorkspaceSourcesRead {
  readonly sources: readonly {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly url: string | null;
    readonly healthStatus: string;
    readonly healthLabel: string;
    readonly acceptRate: number | null;
  }[];
  readonly errors: number;
  readonly degraded: number;
  readonly paused: number;
}

/**
 * T-010-305 · registered-source inventory with health.
 *
 * Health status and counts come from `summarizeSourceHealth` and
 * `countUnhealthySources`. The legacy discovery/recommendation panels are absent
 * on purpose: both run an agent during render.
 */
export function readWorkspaceSources(scope: TrustedTenantScope): WorkspaceSourcesRead {
  const clientId = requireClient(scope);
  if (!clientId) return { sources: [], errors: 0, degraded: 0, paused: 0 };

  const sources = dbService.getSourcesByClient(clientId);
  const counts = countUnhealthySources(sources, summarizeSourceHealth);

  return {
    sources: sources.map((source) => {
      const health = summarizeSourceHealth(source);
      return {
        id: source.id,
        name: source.name,
        type: source.type,
        url: source.url ?? null,
        healthStatus: health.status,
        healthLabel: health.label,
        acceptRate: health.acceptRate,
      };
    }),
    errors: counts.errors,
    degraded: counts.degraded,
    paused: counts.paused,
  };
}

export interface WorkspaceTaskRead {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly deadline: string | null;
  readonly thesisId: string | null;
  readonly archived: boolean;
  /** Factual — cancel control visibility only; CancelClientTask remains authority. */
  readonly cancellable: boolean;
  /** Factual recording reference for P3B play/download. Display only. */
  readonly recordingRef: string | null;
  /** Factual client notes for recording display. */
  readonly clientNotes: string | null;
}

export interface WorkspaceActiveThesisRead {
  readonly id: string;
  readonly title: string;
}

export interface WorkspaceTasksProjection {
  readonly tasks: readonly WorkspaceTaskRead[];
  /** Factual ACTIVE thesis options for MANUAL #27 assign form. */
  readonly activeTheses: readonly WorkspaceActiveThesisRead[];
}

/** T-010-305 · task list + factual assign options. Writes via #27 seam (P8). */
export function readWorkspaceTasks(scope: TrustedTenantScope): WorkspaceTasksProjection {
  const clientId = requireClient(scope);
  if (!clientId) return { tasks: [], activeTheses: [] };
  const tasks = dbService.getTasksByClient(clientId).map((task) => ({
    id: task.id,
    title: task.title,
    type: task.type,
    status: task.status,
    deadline: task.deadline ?? null,
    thesisId: task.thesisId ?? null,
    archived: task.status === 'COMPLETED' || task.status === 'CANCELLED',
    cancellable:
      task.status !== 'COMPLETED' &&
      task.status !== 'CANCELLED',
    recordingRef: taskRecordingRef(task),
    clientNotes: task.clientNotes ?? null,
  }));
  const activeTheses = dbService.getActiveTheses(clientId).map((t) => ({
    id: t.id,
    title: t.title,
  }));
  return { tasks, activeTheses };
}

/**
 * Read-side observation of the compatibility store.
 *
 * `dbService.onChange` fires after hydrate, realtime merge, and local persist.
 * Callers must only invalidate NONAUTHORITATIVE_CACHE entries — this is not a
 * mutator and does not return snapshot data.
 */
export function readCompatibilityStoreOnChange(listener: () => void): () => void {
  return dbService.onChange(listener);
}
