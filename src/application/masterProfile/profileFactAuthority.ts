import type { ClientProfile, ProfileFact, ProfileFactSection, UserRole } from '../../types';
import { MasterProfileError } from './errors';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import {
  assertNoMasterProfileSpoof,
  assertTrustedMasterProfileContext,
  type TrustedMasterProfileContext,
} from './trustedContext';

export const PROFILE_FACT_SECTIONS: readonly ProfileFactSection[] = [
  'identity',
  'career',
  'education',
  'credentials',
  'publications',
  'institutions',
  'digital',
  'voice',
  'services',
];

const ENTITLED_ROLES: readonly UserRole[] = ['ADMIN', 'CLIENT'];

export function isProfileFactSection(value: string): value is ProfileFactSection {
  return (PROFILE_FACT_SECTIONS as readonly string[]).includes(value);
}

export function assertEntitledFactActor(trusted: TrustedMasterProfileContext): void {
  assertTrustedMasterProfileContext(trusted);
  if (!ENTITLED_ROLES.includes(trusted.actorRole)) {
    throw new MasterProfileError('ACTOR_NOT_AUTHORIZED', 'Trusted actorRole is required.');
  }
}

export interface ProfileFactCommandClaims {
  claimedOrganizationId?: string;
  claimedClientId?: string;
}

export function authorizeProfileFactWrite(
  profiles: MasterProfileRepository,
  trusted: TrustedMasterProfileContext,
  claims: ProfileFactCommandClaims = {}
): ClientProfile {
  assertEntitledFactActor(trusted);
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

  const profile = profiles.getProfile(trusted.clientId);
  if (!profile) {
    throw new MasterProfileError('PROFILE_NOT_FOUND', 'Perfil maestro no encontrado.');
  }
  if (profile.organizationId !== trusted.organizationId || profile.clientId !== trusted.clientId) {
    throw new MasterProfileError(
      'TENANT_CONTEXT_INVALID',
      'Profile tenant envelope does not match trusted context.'
    );
  }
  return profile;
}

export function persistProfileFactMutation(
  profiles: MasterProfileRepository,
  profile: ClientProfile
): ClientProfile {
  try {
    profiles.saveProfile(profile);
  } catch (err) {
    throw new MasterProfileError(
      'PERSISTENCE_ERROR',
      err instanceof Error ? err.message : 'Failed to persist profile fact mutation.'
    );
  }
  return profiles.getProfile(profile.clientId) ?? profile;
}

export function requireFactId(factId: string | undefined): string {
  const id = factId?.trim();
  if (!id) {
    throw new MasterProfileError('INVALID_INPUT', 'factId is required.');
  }
  return id;
}

export function findFactOnProfile(profile: ClientProfile, factId: string): ProfileFact {
  const found = (profile.facts || []).find((fact) => fact.id === factId);
  if (!found) {
    throw new MasterProfileError('FACT_NOT_FOUND', 'Fact not found on trusted profile.');
  }
  return found;
}

export function replaceProfileFact(
  profile: ClientProfile,
  nextFact: ProfileFact,
  now: string
): ClientProfile {
  return {
    ...profile,
    facts: (profile.facts || []).map((fact) => (fact.id === nextFact.id ? nextFact : fact)),
    updatedAt: now,
  };
}
