import type { ClientProfile, ProfileFact } from '../../types';
import { MasterProfileError } from './errors';
import {
  authorizeProfileFactWrite,
  findFactOnProfile,
  persistProfileFactMutation,
  replaceProfileFact,
  requireFactId,
  type ProfileFactCommandClaims,
} from './profileFactAuthority';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import type { TrustedMasterProfileContext } from './trustedContext';

export interface RejectProfileFactInput extends ProfileFactCommandClaims {
  trusted: TrustedMasterProfileContext;
  factId: string;
}

export interface RejectProfileFactResult {
  profile: ClientProfile;
  fact: ProfileFact;
}

export interface RejectProfileFactDeps {
  profiles: MasterProfileRepository;
}

/**
 * CR-1 #4 — RejectProfileFact.
 * Only legal transition: candidate → rejected. Fact remains stored. No recover.
 */
export function createRejectProfileFact(deps: RejectProfileFactDeps) {
  return function rejectProfileFact(input: RejectProfileFactInput): RejectProfileFactResult {
    const factId = requireFactId(input.factId);
    const existing = authorizeProfileFactWrite(deps.profiles, input.trusted, input);
    const current = findFactOnProfile(existing, factId);
    if (current.status !== 'candidate') {
      throw new MasterProfileError(
        'INVALID_FACT_STATE',
        'Only candidate facts may be rejected.'
      );
    }

    const now = input.trusted.now;
    const fact: ProfileFact = {
      ...current,
      status: 'rejected',
      updatedAt: now,
    };
    const profile = persistProfileFactMutation(
      deps.profiles,
      replaceProfileFact(existing, fact, now)
    );
    const saved = (profile.facts || []).find((row) => row.id === factId) ?? fact;
    return { profile, fact: saved };
  };
}
