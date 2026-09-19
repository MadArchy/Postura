/**
 * CR-1 Workstream 2 — Master Profile consumer facade.
 *
 * Security: `requireTenantScope` establishes trusted org/client/actor.
 * Application owns ApplyOnboardingStep (#10) and profile fact lifecycle (#2–#6).
 *
 * Fact-lifecycle audit event names are a documented GOVERNANCE_GAP.
 * This consumer does not invent new fact-lifecycle audit action identifiers.
 */

import {
  MasterProfileError,
  type AddProfileFactResult,
  type ApplyOnboardingStepResult,
  type ConfirmProfileFactResult,
  type ImportProfileFactsFromCvResult,
  type OnboardingFieldMap,
  type RejectProfileFactResult,
  type UpdateProfileFactResult,
} from '../application/masterProfile';
import { composeMasterProfile } from '../composition/masterProfile/composeMasterProfile';
import { requireTenantScope } from '../controllers/trustedTenant';
import type { ProfileFactSection } from '../types';
import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';

type MasterProfileUseCases = ReturnType<typeof composeMasterProfile>;

let useCases: MasterProfileUseCases = composeMasterProfile();

/** Test-only reset — not production API. */
export function resetMasterProfileConsumerForTest(next?: MasterProfileUseCases): void {
  useCases = next ?? composeMasterProfile();
}

function mapError(err: unknown, fallback: string): never {
  if (err instanceof MasterProfileError) throw err;
  throw new MasterProfileError(
    'PERSISTENCE_ERROR',
    err instanceof Error ? err.message : fallback
  );
}

function requireTrustedGate(requestedClientId: string | null | undefined) {
  const gate = requireTenantScope(requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!gate.ok) {
    throw new MasterProfileError('ACTOR_NOT_AUTHORIZED', gate.message);
  }
  return gate;
}

export interface ApplyOnboardingStepIntent {
  /** Untrusted proposal — validated by requireTenantScope. */
  requestedClientId: string | null | undefined;
  step: number;
  fields: OnboardingFieldMap;
  claimedOrganizationId?: string;
  claimedClientId?: string;
  claimedProfileCompleteness?: number;
  claimedOnboardingStatus?: string;
  claimedClientStatus?: string;
}

export interface ProfileFactTenantIntent {
  requestedClientId: string | null | undefined;
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export interface AddProfileFactIntent extends ProfileFactTenantIntent {
  section: ProfileFactSection;
  label: string;
  value: string;
}

export interface ProfileFactIdIntent extends ProfileFactTenantIntent {
  factId: string;
}

export interface UpdateProfileFactIntent extends ProfileFactIdIntent {
  value: string;
}

export interface ImportProfileFactsFromCvIntent extends ProfileFactTenantIntent {
  cvText: string;
}

/**
 * Registry #10 — ApplyOnboardingStep.
 */
export function applyOnboardingStep(
  intent: ApplyOnboardingStepIntent
): ApplyOnboardingStepResult {
  const gate = requireTrustedGate(intent.requestedClientId);

  try {
    const result = useCases.applyOnboardingStep({
      trusted: {
        actorId: gate.actorId,
        actorRole: gate.actorRole,
        organizationId: gate.organizationId,
        clientId: gate.clientId,
        now: new Date().toISOString(),
      },
      step: intent.step,
      fields: intent.fields,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
      claimedProfileCompleteness: intent.claimedProfileCompleteness,
      claimedOnboardingStatus: intent.claimedOnboardingStatus,
      claimedClientStatus: intent.claimedClientStatus,
    });

    auditService.log(
      authService.getCurrentUser(),
      'ONBOARDING_STEP_COMPLETED',
      'Client',
      gate.clientId,
      { step: intent.step }
    );
    if (result.completed) {
      auditService.log(
        authService.getCurrentUser(),
        'COMPLETE_ONBOARDING',
        'Client',
        gate.clientId
      );
    }
    return result;
  } catch (err) {
    mapError(err, 'No se pudo guardar el paso de onboarding');
  }
}

function trustedFromGate(gate: ReturnType<typeof requireTrustedGate>) {
  return {
    actorId: gate.actorId,
    actorRole: gate.actorRole,
    organizationId: gate.organizationId,
    clientId: gate.clientId,
    now: new Date().toISOString(),
  };
}

/** Registry #2 — AddProfileFact. No invented audit event. */
export function addProfileFact(intent: AddProfileFactIntent): AddProfileFactResult {
  const gate = requireTrustedGate(intent.requestedClientId);
  try {
    return useCases.addProfileFact({
      trusted: trustedFromGate(gate),
      section: intent.section,
      label: intent.label,
      value: intent.value,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo añadir el fact de perfil');
  }
}

/** Registry #3 — ConfirmProfileFact. No invented audit event. */
export function confirmProfileFact(intent: ProfileFactIdIntent): ConfirmProfileFactResult {
  const gate = requireTrustedGate(intent.requestedClientId);
  try {
    return useCases.confirmProfileFact({
      trusted: trustedFromGate(gate),
      factId: intent.factId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo confirmar el fact de perfil');
  }
}

/** Registry #4 — RejectProfileFact. No invented audit event. */
export function rejectProfileFact(intent: ProfileFactIdIntent): RejectProfileFactResult {
  const gate = requireTrustedGate(intent.requestedClientId);
  try {
    return useCases.rejectProfileFact({
      trusted: trustedFromGate(gate),
      factId: intent.factId,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo rechazar el fact de perfil');
  }
}

/** Registry #5 — UpdateProfileFact. No invented audit event. */
export function updateProfileFact(intent: UpdateProfileFactIntent): UpdateProfileFactResult {
  const gate = requireTrustedGate(intent.requestedClientId);
  try {
    return useCases.updateProfileFact({
      trusted: trustedFromGate(gate),
      factId: intent.factId,
      value: intent.value,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudo actualizar el fact de perfil');
  }
}

/** Registry #6 — ImportProfileFactsFromCv. No invented audit event. */
export function importProfileFactsFromCv(
  intent: ImportProfileFactsFromCvIntent
): ImportProfileFactsFromCvResult {
  const gate = requireTrustedGate(intent.requestedClientId);
  try {
    return useCases.importProfileFactsFromCv({
      trusted: trustedFromGate(gate),
      cvText: intent.cvText,
      claimedOrganizationId: intent.claimedOrganizationId,
      claimedClientId: intent.claimedClientId,
    });
  } catch (err) {
    mapError(err, 'No se pudieron importar facts desde CV');
  }
}
