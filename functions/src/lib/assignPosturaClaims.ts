import type { ClientOrganizationLookupPort } from '../../../src/interfaces/ai/handleAiCompleteRequest';
import { buildPosturaClaimsOrThrow, ClaimsProvisionError, type PosturaAuthClaims } from './posturaClaims';

/**
 * SPEC-009 — interactive claim assignment is organization-scoped (no platform admin).
 * The caller token organization is authoritative; body organizationId/clientId are requested values only.
 */

export type ClaimAssignmentErrorCode = 'permission-denied' | 'invalid-argument' | 'unavailable';

export class ClaimAssignmentError extends Error {
  readonly code: ClaimAssignmentErrorCode;

  constructor(code: ClaimAssignmentErrorCode, message: string) {
    super(message);
    this.name = 'ClaimAssignmentError';
    this.code = code;
  }
}

/** Identical for cross-org targets, unknown targets and foreign/unknown clients — no enumeration. */
export const CLAIM_ASSIGNMENT_DENIED_MESSAGE = 'claim assignment is not permitted for this organization';
const CLAIM_ASSIGNMENT_UNVERIFIED_MESSAGE = 'claim assignment could not be verified';

export type TargetClaimsLookupResult =
  | { found: true; customClaims: Record<string, unknown> | null }
  | { found: false };

export interface ClaimAssignmentDeps {
  /** Server-side Admin Auth read of the target user's current custom claims. */
  readTargetClaims(uid: string): Promise<TargetClaimsLookupResult>;
  clientOrganizations: ClientOrganizationLookupPort;
  writeClaims(uid: string, claims: PosturaAuthClaims): Promise<void>;
}

export interface ClaimAssignmentCaller {
  role?: unknown;
  organizationId?: unknown;
}

export interface ClaimAssignmentRequest {
  uid?: unknown;
  role?: unknown;
  organizationId?: unknown;
  clientId?: unknown;
}

function trustedCallerOrganization(caller: ClaimAssignmentCaller | null | undefined): string {
  if (!caller || caller.role !== 'ADMIN') {
    throw new ClaimAssignmentError('permission-denied', 'ADMIN required');
  }
  const organizationId = typeof caller.organizationId === 'string' ? caller.organizationId.trim() : '';
  if (!organizationId) {
    throw new ClaimAssignmentError('permission-denied', 'ADMIN required');
  }
  return organizationId;
}

export async function assignPosturaClaims(
  caller: ClaimAssignmentCaller | null | undefined,
  request: ClaimAssignmentRequest,
  deps: ClaimAssignmentDeps
): Promise<PosturaAuthClaims> {
  const callerOrganizationId = trustedCallerOrganization(caller);

  const uid = typeof request.uid === 'string' ? request.uid.trim() : '';
  if (!uid) {
    throw new ClaimAssignmentError('invalid-argument', 'uid required');
  }

  let requested: PosturaAuthClaims;
  try {
    requested = buildPosturaClaimsOrThrow({
      role: request.role,
      organizationId: request.organizationId,
      clientId: request.clientId,
    });
  } catch (err) {
    if (err instanceof ClaimsProvisionError) {
      throw new ClaimAssignmentError('invalid-argument', err.message);
    }
    throw err;
  }

  if (requested.organizationId !== callerOrganizationId) {
    throw new ClaimAssignmentError('permission-denied', CLAIM_ASSIGNMENT_DENIED_MESSAGE);
  }

  let target: TargetClaimsLookupResult;
  try {
    target = await deps.readTargetClaims(uid);
  } catch {
    throw new ClaimAssignmentError('unavailable', CLAIM_ASSIGNMENT_UNVERIFIED_MESSAGE);
  }
  if (!target.found) {
    throw new ClaimAssignmentError('permission-denied', CLAIM_ASSIGNMENT_DENIED_MESSAGE);
  }
  const existingOrganizationId = target.customClaims?.organizationId;
  const targetBoundElsewhere =
    existingOrganizationId !== undefined &&
    existingOrganizationId !== null &&
    existingOrganizationId !== callerOrganizationId;
  if (targetBoundElsewhere) {
    throw new ClaimAssignmentError('permission-denied', CLAIM_ASSIGNMENT_DENIED_MESSAGE);
  }

  if (requested.role === 'CLIENT') {
    const clientId = requested.clientId ?? '';
    if (clientId.includes('/')) {
      throw new ClaimAssignmentError('permission-denied', CLAIM_ASSIGNMENT_DENIED_MESSAGE);
    }
    let owningOrganizationId: string | null;
    try {
      owningOrganizationId = await deps.clientOrganizations.findOwningOrganizationId(clientId);
    } catch {
      throw new ClaimAssignmentError('unavailable', CLAIM_ASSIGNMENT_UNVERIFIED_MESSAGE);
    }
    if (owningOrganizationId === null || owningOrganizationId !== callerOrganizationId) {
      throw new ClaimAssignmentError('permission-denied', CLAIM_ASSIGNMENT_DENIED_MESSAGE);
    }
  }

  const claims = buildPosturaClaimsOrThrow({
    role: requested.role,
    organizationId: callerOrganizationId,
    clientId: requested.clientId,
  });
  await deps.writeClaims(uid, claims);
  return claims;
}
