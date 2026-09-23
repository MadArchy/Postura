/**
 * CR-1 Workstream 3 — Thesis Lifecycle consumer facade.
 *
 * Security: requireTenantScope. Domain: thesisRevisionCore.
 * Application owns SaveThesis / DecideThesisClientReview / ActivateThesis.
 */

import type { ThesisEditableFields } from '../types';
import type { ThesisSaveIntent } from '../domain/thesisRevisionCore';
import {
  ThesisLifecycleError,
  type ActivateThesisResult,
  type DecideThesisClientReviewResult,
  type SaveThesisResult,
  type ThesisClientReviewDecision,
} from '../application/thesisLifecycle';
import { composeThesisLifecycle } from '../composition/thesisLifecycle/composeThesisLifecycle';
import { requireTenantScope } from '../controllers/trustedTenant';
import { createId } from '../lib/id';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';

type ThesisLifecycleUseCases = ReturnType<typeof composeThesisLifecycle>;

let useCases: ThesisLifecycleUseCases = composeThesisLifecycle();

/** Test-only reset — not production API. */
export function resetThesisLifecycleConsumerForTest(next?: ThesisLifecycleUseCases): void {
  useCases = next ?? composeThesisLifecycle();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof ThesisLifecycleError) throw err;
  throw new ThesisLifecycleError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

function gate(requestedClientId: string | null | undefined) {
  const decision = requireTenantScope(requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) {
    throw new ThesisLifecycleError('ACTOR_NOT_AUTHORIZED', decision.message);
  }
  return decision;
}

export interface SaveThesisIntent {
  requestedClientId: string | null | undefined;
  thesisId: string;
  intent: ThesisSaveIntent;
  fields: ThesisEditableFields;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

export interface CreateThesisIntent {
  requestedClientId: string | null | undefined;
  intent: ThesisSaveIntent;
  fields: ThesisEditableFields;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

/** Consumer-owned create — mints thesisId, then Registry #11 SaveThesis. */
export function createThesis(intent: CreateThesisIntent): SaveThesisResult {
  gate(intent.requestedClientId);
  return saveThesis({
    requestedClientId: intent.requestedClientId,
    thesisId: createId('thesis'),
    intent: intent.intent,
    fields: intent.fields,
    claimedOrganizationId: intent.claimedOrganizationId,
    claimedClientId: intent.claimedClientId,
    claimedStatus: intent.claimedStatus,
    claimedClientApprovalStatus: intent.claimedClientApprovalStatus,
  });
}

/** Registry #11 */
export function saveThesis(intent: SaveThesisIntent): SaveThesisResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.saveThesis({
      trusted: {
        actorId: g.actorId,
        actorRole: g.actorRole,
        organizationId: g.organizationId,
        clientId: g.clientId,
        now: new Date().toISOString(),
      },
      thesisId: intent.thesisId,
      intent: intent.intent,
      fields: intent.fields,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedClientApprovalStatus: intent.claimedClientApprovalStatus,
    });
    auditService.log(authService.getCurrentUser(), 'SAVE_THESIS', 'PositioningThesis', result.thesis.id, {
      title: result.thesis.title,
      intent: result.intent,
    });
    return result;
  } catch (err) {
    mapError(err, 'No se pudo guardar la tesis');
  }
}

export interface DecideThesisClientReviewIntent {
  requestedClientId: string | null | undefined;
  thesisId: string;
  decision: ThesisClientReviewDecision;
  feedback?: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

/** Registry #13 */
export function decideThesisClientReview(
  intent: DecideThesisClientReviewIntent
): DecideThesisClientReviewResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.decideThesisClientReview({
      trusted: {
        actorId: g.actorId,
        actorRole: g.actorRole,
        organizationId: g.organizationId,
        clientId: g.clientId,
        now: new Date().toISOString(),
      },
      thesisId: intent.thesisId,
      decision: intent.decision,
      feedback: intent.feedback,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedClientApprovalStatus: intent.claimedClientApprovalStatus,
    });
    auditService.log(
      authService.getCurrentUser(),
      result.decision === 'approve' ? 'THESIS_CLIENT_APPROVED' : 'THESIS_CHANGES_REQUESTED',
      'PositioningThesis',
      result.thesis.id,
      { clientId: g.clientId }
    );
    return result;
  } catch (err) {
    mapError(err, 'No se pudo registrar la decisión del cliente');
  }
}

export interface ActivateThesisIntent {
  requestedClientId: string | null | undefined;
  thesisId: string;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedStatus?: string;
  claimedClientApprovalStatus?: string;
}

/** Registry #12 */
export function activateThesis(intent: ActivateThesisIntent): ActivateThesisResult {
  const g = gate(intent.requestedClientId);
  try {
    const result = useCases.activateThesis({
      trusted: {
        actorId: g.actorId,
        actorRole: g.actorRole,
        organizationId: g.organizationId,
        clientId: g.clientId,
        now: new Date().toISOString(),
      },
      thesisId: intent.thesisId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedStatus: intent.claimedStatus,
      claimedClientApprovalStatus: intent.claimedClientApprovalStatus,
    });
    auditService.log(
      authService.getCurrentUser(),
      'THESIS_ACTIVATED',
      'PositioningThesis',
      result.thesis.id,
      { clientId: g.clientId }
    );
    return result;
  } catch (err) {
    mapError(err, 'No se pudo activar la tesis');
  }
}
