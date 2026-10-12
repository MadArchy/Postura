import { z } from 'zod';
import { UNTRUSTED_SOURCE_NOTICE, untrustedSourceBlock } from './untrustedSource';

/** Structured gateway input — preserves legacy challengeThesis critique fields. */
export const ThesisChallengeGatewayInputSchema = z
  .object({
    thesisId: z.string().min(1).max(200),
    title: z.string().min(1).max(500),
    expertIdentity: z.string().min(1).max(500),
    audience: z.string().min(1).max(500),
    domain: z.string().min(1).max(500),
    proofPoints: z.array(z.string().max(500)).max(30),
    territories: z.array(z.string().max(200)).max(30),
  })
  .strict();

export type ThesisChallengeGatewayInput = z.infer<typeof ThesisChallengeGatewayInputSchema>;

export const THESIS_CHALLENGE_PROMPT_ID = 'tmpl_thesis_challenge_v2';
export const THESIS_CHALLENGE_PROMPT_VERSION = '2';

export function renderThesisChallengeUserMessage(input: ThesisChallengeGatewayInput): string {
  return `Critica esta tesis de posicionamiento. Responde JSON:
{
  "outcome": "READY"|"REFINE"|"SPLIT"|"PAUSE"|"REJECT",
  "recommendations": string[],
  "riskScore": number
}
Busca vaguedad, falta de evidencia, audiencia incorrecta, contradicciones y riesgo de saturación.
${UNTRUSTED_SOURCE_NOTICE}
${untrustedSourceBlock({
    title: input.title,
    expertIdentity: input.expertIdentity,
    audience: input.audience,
    domain: input.domain,
    proofPoints: input.proofPoints,
    territories: input.territories,
  })}`;
}
