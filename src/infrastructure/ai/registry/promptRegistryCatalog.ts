import type { AiOperation } from '../../../domain/ai/operations';
import type { PromptIdentity } from '../../../domain/ai/promptIdentity';
import {
  ContentDraftGatewayInputSchema,
  renderContentDraftUserMessage,
} from '../../../application/ai/schemas/contentDraftInput';
import {
  ThesisProposalGatewayInputSchema,
  renderThesisProposalUserMessage,
} from '../../../application/ai/schemas/thesisProposalInput';
import {
  SignalThesisEvalGatewayInputSchema,
  renderSignalThesisEvalUserMessage,
} from '../../../application/ai/schemas/signalThesisEvalInput';
import {
  ThesisChallengeGatewayInputSchema,
  renderThesisChallengeUserMessage,
} from '../../../application/ai/schemas/thesisChallengeInput';
import {
  AdvisorPositioningGatewayInputSchema,
  renderAdvisorPositioningUserMessage,
} from '../../../application/ai/schemas/advisorPositioningInput';
import {
  AdvisorCurationAngleGatewayInputSchema,
  renderAdvisorCurationAngleUserMessage,
} from '../../../application/ai/schemas/advisorCurationAngleInput';
import {
  AnalysisComparativeGatewayInputSchema,
  renderAnalysisComparativeUserMessage,
} from '../../../application/ai/schemas/analysisComparativeInput';

export interface PromptCatalogEntry {
  operation: AiOperation;
  identity: PromptIdentity;
  systemMessage: string;
  /** Canonical user template with stable placeholders — hashed as promptHash identity. */
  userTemplateCanonical: string;
  renderUserMessage: (input: unknown) => string;
}

const JSON_SYSTEM =
  'Eres un analista estratégico de posicionamiento profesional. Responde solo JSON válido sin markdown.';

/** Static versioned prompts — semantics aligned with Phase-0 inventory IDs. */
export const PROMPT_CATALOG: PromptCatalogEntry[] = [
  {
    operation: 'CONTENT_DRAFT',
    identity: { promptId: 'tmpl_content_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical: 'Redacta {{FORMAT}} en voz {{VOICE_HINT}}.\nPercepción objetivo: {{PERCEPTION_TARGET}}.\nNo inventes credenciales fuera de: {{EVIDENCE_HINT}}.\nLímites duros (nunca violar): {{HARD_BLOCKS}}.\nEvitar en voz: {{VOICE_AVOID}}.\nTema: {{TOPIC_TITLE}}\nIdentidad: {{EXPERT_IDENTITY}}\nJSON { "title": string, "body": string }',
    renderUserMessage: (input) => renderContentDraftUserMessage(ContentDraftGatewayInputSchema.parse(input)),
  },
  {
    operation: 'THESIS_PROPOSAL',
    identity: { promptId: 'tmpl_thesis_proposal_v2', promptVersion: '2' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Genera una propuesta de tesis de posicionamiento. Usa SOLO credenciales del contexto.\n{{UNTRUSTED_SOURCE_NOTICE}}\n<UNTRUSTED_SOURCE>\n{{CONTEXT_JSON}}\n</UNTRUSTED_SOURCE>\nJSON { title, expertIdentity, identityCurrent, perceptionTarget, targetAudience, domain, objective, differentiator, proofPoints, audiences, territories, objectives, voiceAndTone, voiceAvoid, hardBlocks, softAvoid, complianceRules }',
    renderUserMessage: (input) =>
      renderThesisProposalUserMessage(ThesisProposalGatewayInputSchema.parse(input)),
  },
  {
    operation: 'SIGNAL_THESIS_EVAL',
    identity: { promptId: 'tmpl_strategist_signal_eval_v2', promptVersion: '2' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Tesis: {{THESIS_TITLE}}\nIdentidad: {{EXPERT_IDENTITY}}\nAudiencia: {{TARGET_AUDIENCE}}\nDominio: {{DOMAIN}}\nLímites: {{COMPLIANCE}}\n<UNTRUSTED_SOURCE>\nTítulo: {{SIGNAL_TITLE}}\nFuente: {{SIGNAL_SOURCE}}\n{{SIGNAL_SNIPPET}}\n</UNTRUSTED_SOURCE>\nDevuelve JSON { "proposedAngle": string, "strategicRationale": string, "recommendedAction": string }',
    renderUserMessage: (input) =>
      renderSignalThesisEvalUserMessage(SignalThesisEvalGatewayInputSchema.parse(input)),
  },
  {
    operation: 'THESIS_CHALLENGE',
    identity: { promptId: 'tmpl_thesis_challenge_v2', promptVersion: '2' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Critica esta tesis de posicionamiento. Responde JSON { outcome, recommendations, riskScore }.\nBusca vaguedad, falta de evidencia, audiencia incorrecta, contradicciones y riesgo de saturación.\n{{UNTRUSTED_SOURCE_NOTICE}}\n<UNTRUSTED_SOURCE>\n{{THESIS_JSON}}\n</UNTRUSTED_SOURCE>',
    renderUserMessage: (input) =>
      renderThesisChallengeUserMessage(ThesisChallengeGatewayInputSchema.parse(input)),
  },
  {
    operation: 'ADVISOR_POSITIONING',
    identity: { promptId: 'tmpl_positioning_advisor_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Actúas como asesor senior de posicionamiento profesional para un Brand Manager.\nContexto: {{INPUT_JSON}}\nJSON { summary, diagnosis { strengths, gaps, risks }, actions [{ category, horizon, title, description, priority }] }',
    renderUserMessage: (input) =>
      renderAdvisorPositioningUserMessage(AdvisorPositioningGatewayInputSchema.parse(input)),
  },
  {
    operation: 'ADVISOR_CURATION_ANGLE',
    identity: { promptId: 'tmpl_curation_angle_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Tesis: {{THESIS_TITLE}}\nIdentidad experta: {{EXPERT_IDENTITY}}\nAudiencia: {{TARGET_AUDIENCE}}\nLímites: {{COMPLIANCE}}\n<UNTRUSTED_SOURCE>\nTítulo: {{SIGNAL_TITLE}}\n{{SIGNAL_SNIPPET}}\n</UNTRUSTED_SOURCE>\nJSON { angle }',
    renderUserMessage: (input) =>
      renderAdvisorCurationAngleUserMessage(AdvisorCurationAngleGatewayInputSchema.parse(input)),
  },
  {
    operation: 'ANALYSIS_COMPARATIVE',
    identity: { promptId: 'tmpl_comparative_analysis_v1', promptVersion: '1' },
    systemMessage: JSON_SYSTEM,
    userTemplateCanonical:
      'Compara ángulos para la tesis {{THESIS_TITLE}} ante {{TARGET_AUDIENCE}}. Fuente no confiable:\n<UNTRUSTED_SOURCE>\n{{SIGNAL_TITLE}}\n{{SIGNAL_SNIPPET}}\n</UNTRUSTED_SOURCE>\nJSON { angle, rationale }',
    renderUserMessage: (input) =>
      renderAnalysisComparativeUserMessage(AnalysisComparativeGatewayInputSchema.parse(input)),
  },
];

export function findPromptCatalogEntry(operation: AiOperation, identity: PromptIdentity): PromptCatalogEntry | null {
  return (
    PROMPT_CATALOG.find(
      (entry) =>
        entry.operation === operation &&
        entry.identity.promptId === identity.promptId &&
        entry.identity.promptVersion === identity.promptVersion
    ) ?? null
  );
}
