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

export interface ConfirmProfileFactInput extends ProfileFactCommandClaims {
  trusted: TrustedMasterProfileContext;
  factId: string;
}

export interface ConfirmProfileFactResult {
  profile: ClientProfile;
  fact: ProfileFact;
}

export interface ConfirmProfileFactDeps {
  profiles: MasterProfileRepository;
}

/**
 * CR-1 #3 — ConfirmProfileFact.
 * Only legal transition: candidate → confirmed. No reopen. No caller status.
 */
export function createConfirmProfileFact(deps: ConfirmProfileFactDeps) {
  return function confirmProfileFact(input: ConfirmProfileFactInput): ConfirmProfileFactResult {
    const factId = requireFactId(input.factId);
    const existing = authorizeProfileFactWrite(deps.profiles, input.trusted, input);
    const current = findFactOnProfile(existing, factId);
    if (current.status !== 'candidate') {
      throw new MasterProfileError(
        'INVALID_FACT_STATE',
        'Only candidate facts may be confirmed.'
      );
    }

    const now = input.trusted.now;
    const fact: ProfileFact = {
      ...current,
      status: 'confirmed',
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
