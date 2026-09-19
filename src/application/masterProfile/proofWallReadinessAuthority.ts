import type { Client, ProofWallItem } from '../../types';
import { MasterProfileError } from './errors';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import type { ProofWallItemRepository } from './ports/ProofWallItemRepository';
import {
  assertNoMasterProfileSpoof,
  assertTrustedMasterProfileContext,
  type TrustedMasterProfileContext,
} from './trustedContext';

export const PROOF_WALL_READINESS_VALUES = ['pending', 'complete'] as const;
export type ProofWallReadinessStatus = (typeof PROOF_WALL_READINESS_VALUES)[number];

export interface ProofWallReadinessCommandClaims {
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export function isProofWallReadinessStatus(value: unknown): value is ProofWallReadinessStatus {
  return value === 'pending' || value === 'complete';
}

export function requireProofWallItemId(proofWallItemId: string | undefined): string {
  const id = proofWallItemId?.trim();
  if (!id) {
    throw new MasterProfileError('INVALID_INPUT', 'proofWallItemId is required.');
  }
  return id;
}

export function requireProofWallTargetStatus(value: unknown): ProofWallReadinessStatus {
  if (!isProofWallReadinessStatus(value)) {
    throw new MasterProfileError(
      'INVALID_INPUT',
      'targetStatus must be pending or complete.'
    );
  }
  return value;
}

export function assertProofWallAdminActor(trusted: TrustedMasterProfileContext): void {
  assertTrustedMasterProfileContext(trusted);
  if (trusted.actorRole !== 'ADMIN') {
    throw new MasterProfileError(
      'ACTOR_NOT_AUTHORIZED',
      'Only ADMIN may change ProofWall readiness.'
    );
  }
}

export function authorizeProofWallClient(
  profiles: MasterProfileRepository,
  trusted: TrustedMasterProfileContext,
  claims: ProofWallReadinessCommandClaims = {}
): Client {
  assertProofWallAdminActor(trusted);
  assertNoMasterProfileSpoof({
    trusted,
    claimedOrganizationId: claims.claimedOrganizationId,
    claimedClientId: claims.claimedClientId,
  });

  const client = profiles.getClient(trusted.clientId);
  if (!client) {
    throw new MasterProfileError('CLIENT_NOT_FOUND', 'Cliente no encontrado.');
  }
  if (client.organizationId?.trim() !== trusted.organizationId) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Client organization does not match trusted session organization.'
    );
  }
  return client;
}

export function loadAuthorizedProofWallItem(
  proofWall: ProofWallItemRepository,
  trusted: TrustedMasterProfileContext,
  client: Client,
  proofWallItemId: string
): ProofWallItem {
  let item: ProofWallItem | null;
  try {
    item = proofWall.getProofWallItem(proofWallItemId);
  } catch (err) {
    throw new MasterProfileError(
      'PERSISTENCE_ERROR',
      err instanceof Error ? err.message : 'Failed to load ProofWall item.'
    );
  }
  if (!item) {
    throw new MasterProfileError('PROOF_WALL_ITEM_NOT_FOUND', 'ProofWall item not found.');
  }
  if (
    item.organizationId !== trusted.organizationId ||
    item.clientId !== trusted.clientId ||
    item.clientId !== client.id
  ) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'ProofWall item tenant envelope does not match trusted context.'
    );
  }
  if (!isProofWallReadinessStatus(item.status)) {
    throw new MasterProfileError(
      'INVALID_PROOF_WALL_STATE',
      'ProofWall item status is not a recognized readiness value.'
    );
  }
  return item;
}

export function persistProofWallItem(
  proofWall: ProofWallItemRepository,
  item: ProofWallItem
): ProofWallItem {
  try {
    proofWall.saveProofWallItem(item);
  } catch (err) {
    throw new MasterProfileError(
      'PERSISTENCE_ERROR',
      err instanceof Error ? err.message : 'Failed to persist ProofWall readiness.'
    );
  }
  return proofWall.getProofWallItem(item.id) ?? item;
}
