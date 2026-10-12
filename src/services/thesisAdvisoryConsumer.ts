/**
 * SPEC-010 · R1 H19/H20 — Thesis advisory consumer facade.
 *
 * Security: requireTenantScope + ADMIN role (the AI gateway is ADMIN-only).
 * Persistence: none. The stress-test result is advisory, and a proposal only
 * pre-fills the editor; saving still goes through #11 SaveThesis.
 */

import type { ThesisEditableFields } from '../types';
import type { ThesisChallengeResult } from '../domain/thesisChallengeCore';
import { ThesisLifecycleError } from '../application/thesisLifecycle';
import { requireTenantScope } from '../controllers/trustedTenant';
import { aiService } from './ai';
import { authService } from './auth';
import { dbService } from './db';

function gateAdmin(requestedClientId: string | null | undefined) {
  const decision = requireTenantScope(requestedClientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) {
    throw new ThesisLifecycleError('ACTOR_NOT_AUTHORIZED', decision.message);
  }
  if (decision.actorRole !== 'ADMIN') {
    throw new ThesisLifecycleError(
      'ACTOR_NOT_AUTHORIZED',
      'Las herramientas de IA de tesis requieren rol ADMIN.'
    );
  }
  return decision;
}

/** H19 — advisory stress-test of one explicitly selected thesis. Writes nothing. */
export async function stressTestThesis(intent: {
  requestedClientId: string | null | undefined;
  thesisId: string;
}): Promise<ThesisChallengeResult> {
  const g = gateAdmin(intent.requestedClientId);
  const thesis = dbService.getThesisById(g.clientId, intent.thesisId);
  if (!thesis) {
    throw new ThesisLifecycleError('THESIS_NOT_FOUND', 'Tesis no encontrada.');
  }
  return aiService.challengeThesis(thesis);
}

/** H20 — AI thesis proposal for the trusted client. Returns editor fields only. */
export async function proposeThesisFromProfile(intent: {
  requestedClientId: string | null | undefined;
}): Promise<ThesisEditableFields> {
  const g = gateAdmin(intent.requestedClientId);
  return aiService.generateThesisProposal(g.clientId);
}
