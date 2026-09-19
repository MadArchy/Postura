import { createId } from '../../lib/id';
import type { ClientProfile, ProfileFact, ProfileFactSection } from '../../types';
import { MasterProfileError } from './errors';
import {
  authorizeProfileFactWrite,
  isProfileFactSection,
  persistProfileFactMutation,
  type ProfileFactCommandClaims,
} from './profileFactAuthority';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import type { TrustedMasterProfileContext } from './trustedContext';

export interface AddProfileFactInput extends ProfileFactCommandClaims {
  trusted: TrustedMasterProfileContext;
  section: ProfileFactSection;
  label: string;
  value: string;
}

export interface AddProfileFactResult {
  profile: ClientProfile;
  fact: ProfileFact;
}

export interface AddProfileFactDeps {
  profiles: MasterProfileRepository;
}

/**
 * CR-1 #2 — AddProfileFact.
 * Manual add is confirmed + manual. Caller cannot supply status, source, or id.
 */
export function createAddProfileFact(deps: AddProfileFactDeps) {
  return function addProfileFact(input: AddProfileFactInput): AddProfileFactResult {
    if (!isProfileFactSection(String(input.section ?? ''))) {
      throw new MasterProfileError('INVALID_INPUT', 'section must be a valid ProfileFactSection.');
    }
    const label = input.label?.trim();
    const value = input.value?.trim();
    if (!label) {
      throw new MasterProfileError('INVALID_INPUT', 'label is required.');
    }
    if (!value) {
      throw new MasterProfileError('INVALID_INPUT', 'value is required.');
    }

    const existing = authorizeProfileFactWrite(deps.profiles, input.trusted, input);
    const now = input.trusted.now;
    const fact: ProfileFact = {
      id: createId('fact'),
      section: input.section,
      label,
      value,
      status: 'confirmed',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    const next: ClientProfile = {
      ...existing,
      facts: [...(existing.facts || []), fact],
      updatedAt: now,
    };
    const profile = persistProfileFactMutation(deps.profiles, next);
    const saved = (profile.facts || []).find((row) => row.id === fact.id) ?? fact;
    return { profile, fact: saved };
  };
}
