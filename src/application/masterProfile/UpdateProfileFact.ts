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

export interface UpdateProfileFactInput extends ProfileFactCommandClaims {
  trusted: TrustedMasterProfileContext;
  factId: string;
  value: string;
}

export interface UpdateProfileFactResult {
  profile: ClientProfile;
  fact: ProfileFact;
}

export interface UpdateProfileFactDeps {
  profiles: MasterProfileRepository;
}

/**
 * CR-1 #5 — UpdateProfileFact.
 * Confirmed facts only. Value is the sole editable business field.
 */
export function createUpdateProfileFact(deps: UpdateProfileFactDeps) {
  return function updateProfileFact(input: UpdateProfileFactInput): UpdateProfileFactResult {
    const factId = requireFactId(input.factId);
    const value = input.value?.trim();
    if (!value) {
      throw new MasterProfileError('INVALID_INPUT', 'value is required.');
    }

    const existing = authorizeProfileFactWrite(deps.profiles, input.trusted, input);
    const current = findFactOnProfile(existing, factId);
    if (current.status !== 'confirmed') {
      throw new MasterProfileError(
        'INVALID_FACT_STATE',
        'Only confirmed facts may be edited.'
      );
    }

    const now = input.trusted.now;
    const fact: ProfileFact = {
      ...current,
      value,
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
