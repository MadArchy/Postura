/**
 * SPEC-010 · canonical read facade.
 *
 * AUTHORITY: NONE. This facade projects state owned by other SPECs; it neither
 * decides nor stores anything.
 *
 * React modules reach canonical state only through this file, which delegates to
 * the existing canonical consumers. It must never import `dbService`, a
 * `Local*Store`, the Firestore SDK or an AI provider (threats T-010-01…04), and
 * it must never recreate logic owned by another SPEC (threats T-010-17…22) — it
 * forwards calls and returns the consumer's own projection unchanged.
 */

import {
  listOpportunitiesForClient,
  opportunityStatusDisplayLabel,
} from '../../services/opportunityScoutConsumer';
import type { OpportunityDisplayProjection } from '../../services/opportunityScoutConsumer';
import { listStrategicBriefs, onStrategicBriefsRemoteMerge } from '../../services/strategicBriefConsumer';
import { listSignalOutcomesForDisplay } from '../../services/learningLoopConsumer';
import { daysUntilDeadline, isCleOpportunity } from '../../domain/clientOpportunityCore';
import type { TrustedTenantScope } from '../query/tenantScope';

export const CANONICAL_READ_STATUS = 'CANONICAL_PROJECTION' as const;

/**
 * Read-side observation of Strategic Briefs merged from Firestore after session start.
 * Callers must only invalidate NONAUTHORITATIVE_CACHE entries — this is not a mutator.
 */
export function readStrategicBriefsOnRemoteMerge(listener: () => void): () => void {
  return onStrategicBriefsRemoteMerge(listener);
}

/**
 * SPEC-007 Opportunity projections for one client.
 *
 * The trusted scope's `clientId` is passed as the read scope, and the same value
 * is passed as the claimed identity so the consumer's own tenant validation runs
 * against trusted input rather than anything the UI invented.
 */
export function readClientOpportunities(
  scope: TrustedTenantScope
): readonly OpportunityDisplayProjection[] {
  if (!scope.clientId) return [];
  return listOpportunitiesForClient(scope.clientId, {
    claimedOrganizationId: scope.organizationId,
    claimedClientId: scope.clientId,
  });
}

/**
 * Display-ready view of a canonical Opportunity projection (T-010-202).
 *
 * The canonical status is carried through unchanged and every derived flag is
 * computed here by the owning domain/consumer function — the status label by
 * `opportunityStatusDisplayLabel`, the deadline distance by `daysUntilDeadline`,
 * the CLE classification by `isCleOpportunity`. React therefore renders values
 * rather than classifying anything itself (threat T-010-19), and the action
 * visibility flags below describe what the lifecycle already allows; they never
 * grant it.
 */
export interface OpportunityCardView {
  readonly id: string;
  readonly title: string;
  readonly organization: string;
  readonly description: string;
  readonly fitRationale: string;
  readonly clientNotes: string | null;
  readonly status: OpportunityDisplayProjection['status'];
  readonly statusLabel: string;
  readonly deadline: string | null;
  readonly daysLeft: number | null;
  readonly deadlineSoon: boolean;
  readonly isCle: boolean;
  readonly submittedAt: string | null;
  readonly checklist: readonly { readonly id: string; readonly label: string; readonly done: boolean }[];
  readonly checklistDone: number;
  readonly checklistTotal: number;
  readonly canAcceptOrDecline: boolean;
  readonly canUseChecklist: boolean;
  readonly canSubmit: boolean;
}

function toCardView(opp: OpportunityDisplayProjection): OpportunityCardView {
  const checklist = opp.submissionChecklist ?? [];
  const daysLeft = opp.deadline ? daysUntilDeadline(opp.deadline) : null;

  return {
    id: opp.id,
    title: opp.title,
    organization: opp.organization,
    description: opp.description,
    fitRationale: opp.fitRationale,
    clientNotes: opp.clientNotes ?? null,
    status: opp.status,
    statusLabel: opportunityStatusDisplayLabel(opp.status),
    deadline: opp.deadline ?? null,
    daysLeft,
    deadlineSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 3,
    isCle: isCleOpportunity({ title: opp.title, type: opp.type }),
    submittedAt: opp.submittedAt ?? null,
    checklist: checklist.map((item) => ({ id: item.id, label: item.label, done: item.done })),
    checklistDone: checklist.filter((item) => item.done).length,
    checklistTotal: checklist.length,
    canAcceptOrDecline: opp.status === 'PROPOSED',
    canUseChecklist: opp.status === 'ACCEPTED' || opp.status === 'CHECKLIST',
    canSubmit:
      opp.status === 'CHECKLIST' && checklist.length > 0 && checklist.every((item) => item.done),
  };
}

/**
 * Canonical Opportunity card views for one client, ordered by deadline.
 *
 * The ordering is a display convenience. No position in this list carries
 * authority: there is no primary opportunity, and `[0]` is never used to decide
 * a lifecycle transition (threat T-010-15).
 */
export function readClientOpportunityCards(
  scope: TrustedTenantScope
): readonly OpportunityCardView[] {
  return [...readClientOpportunities(scope)]
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .map(toCardView);
}

/* ======================================================================
 * WAVE 3 — canonical page reads (T-010-302, T-010-305)
 *
 * Canonical is preferred over compatibility wherever a consumer projection
 * exists, so these two resources move off `dbService` entirely for the React
 * pages that use them.
 * ====================================================================== */

export interface StrategicBriefView {
  readonly id: string;
  readonly strategicAngle: string;
  readonly territory: string;
  readonly primaryAudience: string;
  readonly recommendedChannel: string;
  readonly recommendedFormat: string;
  readonly status: string;
  readonly version: number;
  readonly thesisId: string;
  readonly authorizedAction: string | null;
  readonly superseded: boolean;
  readonly createdAt: string;
}

/**
 * SPEC-003 Strategic Briefs for one client (canonical).
 *
 * `authorizedAction` is carried through from the brief's own governed decision;
 * it is never inferred here. React may use it to decide what to *offer*, and the
 * canonical gate still re-validates on submit.
 */
export function readStrategicBriefs(scope: TrustedTenantScope): readonly StrategicBriefView[] {
  if (!scope.clientId) return [];
  return listStrategicBriefs(scope.clientId).map((brief) => ({
    id: brief.id,
    strategicAngle: brief.strategicAngle,
    territory: brief.territory,
    primaryAudience: brief.primaryAudience,
    recommendedChannel: brief.recommendedChannel,
    recommendedFormat: brief.recommendedFormat,
    status: brief.status,
    version: brief.version,
    thesisId: brief.thesisId,
    authorizedAction: brief.decision?.authorizedAction ?? null,
    superseded: Boolean(brief.supersededByBriefId),
    createdAt: brief.createdAt,
  }));
}

/**
 * Briefs that currently authorize content creation.
 *
 * Returned as a list with NO pre-selection. The legacy modal defaults to
 * `approvedBriefs[0]` (`Modals.ts:772`), which silently biases the manager when
 * several briefs are approved; that default is deliberately not reproduced, so
 * the React caller must select a brief explicitly (threats T-010-15, T-010-16).
 */
export function readContentAuthorizingBriefs(
  scope: TrustedTenantScope
): readonly StrategicBriefView[] {
  return readStrategicBriefs(scope).filter(
    (brief) =>
      brief.status === 'APPROVED' &&
      !brief.superseded &&
      brief.authorizedAction === 'CREATE_CONTENT'
  );
}

export interface SignalOutcomeView {
  readonly signalId: string;
  readonly kind: string;
  readonly note: string | null;
  readonly source: string;
  readonly createdAt: string;
}

/** SPEC-008 signal outcomes for one client (canonical learning-loop projection). */
export function readSignalOutcomes(scope: TrustedTenantScope): readonly SignalOutcomeView[] {
  if (!scope.clientId) return [];
  return listSignalOutcomesForDisplay(scope.clientId).map((outcome) => ({
    signalId: outcome.signalId,
    kind: outcome.kind,
    note: outcome.note ?? null,
    source: outcome.source,
    createdAt: outcome.createdAt,
  }));
}

export type { OpportunityDisplayProjection };
