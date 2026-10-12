import { z } from 'zod';
import { UNTRUSTED_SOURCE_NOTICE, untrustedSourceBlock } from './untrustedSource';

/** Structured gateway input — preserves legacy generateThesisProposal context. */
export const ThesisProposalGatewayInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    profession: z.string().max(200).optional(),
    selfDescription: z.string().max(2000).optional(),
    primaryGoal: z.string().max(1000).optional(),
    audience: z.string().max(1000).optional(),
    industries: z.array(z.string().max(200)).max(20).optional(),
    dossierTagline: z.string().max(500).optional(),
    topicsToOwn: z.array(z.string().max(200)).max(20).optional(),
    proofPoints: z.array(z.string().max(500)).max(20),
    compliance: z.string().max(2000).optional(),
  })
  .strict();

export type ThesisProposalGatewayInput = z.infer<typeof ThesisProposalGatewayInputSchema>;

export const THESIS_PROPOSAL_PROMPT_ID = 'tmpl_thesis_proposal_v2';
export const THESIS_PROPOSAL_PROMPT_VERSION = '2';

export function renderThesisProposalUserMessage(input: ThesisProposalGatewayInput): string {
  return `Genera una propuesta de tesis de posicionamiento. Usa SOLO credenciales del contexto.
${UNTRUSTED_SOURCE_NOTICE}
${untrustedSourceBlock(input)}
JSON {
  "title": string,
  "expertIdentity": string,
  "identityCurrent": string,
  "perceptionTarget": string,
  "targetAudience": string,
  "domain": string,
  "objective": string,
  "differentiator": string,
  "proofPoints": string[],
  "audiences": [{"name": string, "tier": "COMMERCIAL"|"INFLUENCE"|"AMPLIFICATION", "weight": number}],
  "territories": [{"name": string, "weight": number, "pillar": string}],
  "objectives": [{"kind": "BUSINESS"|"THOUGHT_LEADERSHIP"|"SPEAKING"|"INSTITUTIONAL"|"NETWORK", "weight": number}],
  "voiceAndTone": string,
  "voiceAvoid": string[],
  "hardBlocks": string[],
  "softAvoid": string[],
  "complianceRules": string
}`;
}
