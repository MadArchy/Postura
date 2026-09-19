import type { ProofWallItem } from '../../types';
import {
  authorizeProofWallClient,
  loadAuthorizedProofWallItem,
  persistProofWallItem,
  requireProofWallItemId,
  requireProofWallTargetStatus,
  type ProofWallReadinessCommandClaims,
} from './proofWallReadinessAuthority';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import type { ProofWallItemRepository } from './ports/ProofWallItemRepository';
import type { TrustedMasterProfileContext } from './trustedContext';

export interface SetProofWallItemReadinessInput extends ProofWallReadinessCommandClaims {
  trusted: TrustedMasterProfileContext;
  proofWallItemId: string;
  targetStatus: 'pending' | 'complete';
}

export interface SetProofWallItemReadinessResult {
  item: ProofWallItem;
}

export interface SetProofWallItemReadinessDeps {
  profiles: MasterProfileRepository;
  proofWall: ProofWallItemRepository;
}

/**
 * CR-1 #7 — SetProofWallItemReadiness.
 * ADMIN-only bidirectional assignment of ProofWall checklist readiness.
 * Mutates item.status only. Not SPEC-006 publication or verification.
 */
export function createSetProofWallItemReadiness(deps: SetProofWallItemReadinessDeps) {
  return function setProofWallItemReadiness(
    input: SetProofWallItemReadinessInput
  ): SetProofWallItemReadinessResult {
    const proofWallItemId = requireProofWallItemId(input.proofWallItemId);
    const targetStatus = requireProofWallTargetStatus(input.targetStatus);
    const client = authorizeProofWallClient(deps.profiles, input.trusted, input);
    const current = loadAuthorizedProofWallItem(
      deps.proofWall,
      input.trusted,
      client,
      proofWallItemId
    );

    const next: ProofWallItem = {
      ...current,
      status: targetStatus,
    };
    return { item: persistProofWallItem(deps.proofWall, next) };
  };
}
