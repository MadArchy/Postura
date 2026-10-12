import {
  formatAudienceLines,
  formatTerritoryLines,
  normalizeThesis,
  parseAudienceLines,
  parseTerritoryLines,
  type NormalizedThesis,
} from './thesisModelCore';
import { reviewClaims, type ClaimSafetyReview } from './claimSafetyCore';
import type {
  Client,
  ClientProfile,
  EvidenceVaultItem,
  MasterDossier,
  PositioningThesis,
  ThesisEditableFields,
  VoiceProfile,
} from '../types';

const TONE_VOICE: Record<string, Partial<VoiceProfile>> = {
  authoritative: { authority: 90, legalPrecision: 85, executive: 80, provocative: 25 },
  academic: { academic: 90, technicalDepth: 85, authority: 75, accessible: 45 },
  conversational: { accessible: 85, executive: 70, authority: 65, humor: 35 },
  provocative: { provocative: 80, authority: 75, commercial: 60, accessible: 55 },
  approachable: { accessible: 90, commercial: 65, authority: 60, humor: 40 },
};

function defaultVoice(style?: string): VoiceProfile {
  return {
    authority: 70,
    technicalDepth: 65,
    academic: 55,
    executive: 70,
    accessible: 60,
    provocative: 30,
    commercial: 50,
    legalPrecision: 75,
    humor: 20,
    style,
    avoid: ['hype', 'sensacionalismo'],
  };
}

function mergeVoice(base: VoiceProfile, patch?: Partial<VoiceProfile>): VoiceProfile {
  return { ...base, ...patch, style: patch?.style || base.style, avoid: patch?.avoid || base.avoid };
}

/**
 * Propuesta heurística desde perfil + dossier + vault. Puras: sin IA.
 */
export function buildThesisProposalFromProfile(input: {
  client?: Client | null;
  profile: ClientProfile | null;
  dossier: MasterDossier | null;
  evidence: EvidenceVaultItem[];
}): ThesisEditableFields {
  const { client, profile, dossier, evidence } = input;
  const displayName = client?.displayName || client?.firstName || 'Cliente';
  const profession = profile?.career?.profession || client?.profession || 'Profesional';
  const selfDesc = profile?.identity?.selfDescription || profile?.identity?.shortBio || '';
  const primaryGoal = profile?.goals?.primaryGoal || 'Consolidar autoridad y práctica de alto valor';
  const audienceDesc =
    profile?.audience?.targetAudienceDescription ||
    client?.targetMarket ||
    dossier?.targetAudiences.join(', ') ||
    'Decisores clave del sector';
  const industries = profile?.audience?.targetIndustries || [];
  const domainParts = [
    profession,
    ...industries,
    ...(dossier?.topicsToOwn.slice(0, 3) || []),
  ].filter(Boolean);
  const domain = domainParts.slice(0, 3).join(' · ') || profession;

  const proofFromEvidence = evidence.filter((e) => e.verified).slice(0, 4).map((e) => e.title);
  const proofFromProfile = [
    ...(profile?.education || []).slice(0, 2).map((e) => `${e.degree} — ${e.institution}`),
    ...(profile?.careerHistory || []).slice(0, 2).map((h) => `${h.role}, ${h.organization}`),
  ];
  const proofPoints = [...new Set([...proofFromEvidence, ...proofFromProfile])].slice(0, 6);

  const toneKey = profile?.voicePreferences?.tone || 'authoritative';
  const voiceProfile = mergeVoice(
    defaultVoice(profile?.voicePreferences?.tone || 'Autoritativo y sobrio'),
    TONE_VOICE[toneKey]
  );
  voiceProfile.style =
    profile?.voicePreferences?.tone === 'academic'
      ? 'Académico, riguroso, basado en evidencia'
      : profile?.voicePreferences?.tone === 'conversational'
        ? 'Claro, accionable, sin jerga innecesaria'
        : 'Autoritativo, sobrio, sin hype';

  const avoidTopics = [
    ...(profile?.voicePreferences?.topicsToAvoid || []),
    ...(dossier?.topicsToAvoid || []),
  ];
  voiceProfile.avoid = [...new Set(avoidTopics.length ? avoidTopics : ['hype', 'sensacionalismo'])];

  const hardBlocks = [
    profile?.voicePreferences?.complianceGuidelines,
    'No inventar credenciales ni resultados no verificados',
  ].filter(Boolean) as string[];

  const softAvoid = dossier?.topicsToAvoid?.length ? dossier.topicsToAvoid : ['consumer hype', 'política partidista'];

  const expertIdentity =
    dossier?.taglineEn ||
    profile?.identity?.professionalHeadline ||
    `${profession} con enfoque en ${domain.split(' · ')[0] || 'su especialidad'}`;

  const perceptionTarget =
    dossier?.executiveSummary?.split('.')[0] ||
    `Referente en ${domain} para ${audienceDesc.split(',')[0] || 'su audiencia clave'}`;

  const identityCurrent =
    selfDesc ||
    profile?.identity?.shortBio ||
    `${displayName}: ${profession}${profile?.career?.currentRole ? ` · ${profile.career.currentRole}` : ''}`;

  const differentiator = dossier?.differentiators[0] || profile?.identity?.professionalHeadline;

  const normalizedSeed: NormalizedThesis = normalizeThesis({
    id: 'proposal',
    organizationId: client?.organizationId || 'org',
    clientId: client?.id || '',
    title: dossier?.taglineEn?.slice(0, 80) || `${profession}: ${primaryGoal.slice(0, 40)}`,
    expertIdentity,
    targetAudience: audienceDesc,
    domain,
    objective: primaryGoal,
    proofPoints: proofPoints.length ? proofPoints : ['Credencial verificable pendiente'],
    voiceAndTone: voiceProfile.style || '',
    complianceRules: profile?.voicePreferences?.complianceGuidelines || '',
    status: 'DRAFT',
    clientApprovalStatus: 'PENDING',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    perceptionTarget,
    identityCurrent,
    differentiator,
    audiences: undefined,
    territories: undefined,
  });

  const audienceLines = normalizedSeed.audiences.length
    ? formatAudienceLines(normalizedSeed.audiences)
    : audienceDesc
        .split(/[,;]/)
        .map((name, index) => `${name.trim()} | comercial | ${Math.max(40, 95 - index * 15)}`)
        .join('\n');

  const territoryLines = normalizedSeed.territories.length
    ? formatTerritoryLines(normalizedSeed.territories)
    : (dossier?.topicsToOwn || industries).slice(0, 5).map((name, index) => {
        const weight = Math.max(20, 100 - index * 15);
        return `${name} | ${weight} | ${name}`;
      }).join('\n');

  return {
    title: dossier?.taglineEn?.slice(0, 90) || `${displayName}: ${domain.split(' · ')[0]}`,
    expertIdentity,
    targetAudience: audienceDesc,
    domain,
    objective: primaryGoal,
    proofPoints: proofPoints.length >= 2 ? proofPoints : [...proofPoints, 'Segunda credencial por verificar en vault'],
    differentiator,
    voiceAndTone: voiceProfile.style || '',
    complianceRules: profile?.voicePreferences?.complianceGuidelines || hardBlocks[0] || '',
    identityCurrent,
    perceptionTarget,
    audiences: parseAudienceLines(audienceLines),
    territories: parseTerritoryLines(territoryLines),
    objectives: normalizedSeed.objectives,
    voiceProfile,
    limits: { hardBlocks, softAvoid },
    priority: 50,
  };
}

/** Claim-bearing text of a proposal, in the order the editor shows it. */
export function thesisProposalClaimText(fields: ThesisEditableFields): string {
  return [
    fields.title,
    fields.expertIdentity,
    fields.identityCurrent,
    fields.perceptionTarget,
    fields.differentiator,
    fields.objective,
    ...fields.proofPoints,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n');
}

/**
 * Advisory claim-safety review of a thesis proposal against the client's
 * verified evidence. The proposal's proof points are reviewed as claims and
 * never count as support for each other, because they come from the same
 * generator as the rest of the text.
 */
export function reviewThesisProposalClaims(
  fields: ThesisEditableFields,
  clientId: string,
  evidence: EvidenceVaultItem[]
): ClaimSafetyReview {
  const reviewTarget: PositioningThesis = {
    ...fields,
    id: '',
    organizationId: '',
    clientId,
    proofPoints: [],
    status: 'DRAFT',
    clientApprovalStatus: 'PENDING',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
  };
  const clientEvidence = evidence
    .filter((item) => item.clientId === clientId)
    .map((item) => ({ ...item, associatedThesesIds: [] }));
  return reviewClaims(thesisProposalClaimText(fields), reviewTarget, clientEvidence);
}
