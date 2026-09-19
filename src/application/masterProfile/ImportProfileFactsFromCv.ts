import { extractCandidateFactsFromCv } from '../../domain/cvExtract';
import { createId } from '../../lib/id';
import type { ClientProfile, ProfileFact } from '../../types';
import { MasterProfileError } from './errors';
import {
  authorizeProfileFactWrite,
  persistProfileFactMutation,
  type ProfileFactCommandClaims,
} from './profileFactAuthority';
import type { MasterProfileRepository } from './ports/MasterProfileRepository';
import type { TrustedMasterProfileContext } from './trustedContext';

export const CV_EXTRACTED_TEXT_MAX = 12000;

export interface ImportProfileFactsFromCvInput extends ProfileFactCommandClaims {
  trusted: TrustedMasterProfileContext;
  cvText: string;
}

export interface ImportProfileFactsFromCvResult {
  profile: ClientProfile;
  importedCount: number;
  facts: ProfileFact[];
}

export interface ImportProfileFactsFromCvDeps {
  profiles: MasterProfileRepository;
}

/**
 * CR-1 #6 — ImportProfileFactsFromCv.
 * Application owns tenant, reload, dedup, candidate/cv authority, and cvExtractedText.
 * Domain `extractCandidateFactsFromCv` is reused unchanged. No AI. No network.
 */
export function createImportProfileFactsFromCv(deps: ImportProfileFactsFromCvDeps) {
  return function importProfileFactsFromCv(
    input: ImportProfileFactsFromCvInput
  ): ImportProfileFactsFromCvResult {
    const raw = input.cvText;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new MasterProfileError('INVALID_INPUT', 'cvText is required.');
    }

    const existing = authorizeProfileFactWrite(deps.profiles, input.trusted, input);
    const extracted = extractCandidateFactsFromCv(raw);
    const existingValues = new Set((existing.facts || []).map((fact) => fact.value.toLowerCase()));
    const now = input.trusted.now;
    const novel: ProfileFact[] = extracted
      .filter((candidate) => !existingValues.has(candidate.value.toLowerCase()))
      .map((candidate) => ({
        ...candidate,
        id: createId('fact'),
        status: 'candidate' as const,
        source: 'cv' as const,
        createdAt: now,
        updatedAt: now,
      }));

    const next: ClientProfile = {
      ...existing,
      facts: [...(existing.facts || []), ...novel],
      cvExtractedText: raw.slice(0, CV_EXTRACTED_TEXT_MAX),
      updatedAt: now,
    };
    const profile = persistProfileFactMutation(deps.profiles, next);
    return { profile, importedCount: novel.length, facts: novel };
  };
}
