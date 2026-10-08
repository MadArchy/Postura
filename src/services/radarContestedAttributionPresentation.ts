/**
 * R1 H09 — Radar contested-attribution presentation composite.
 *
 * Mirrors the legacy `[data-thesis-override]` click in `thesisHandlers.ts`:
 * authoritative signal reload → frozen OverrideSignalThesis with the trusted
 * session actor (no rationale) → one THESIS_OVERRIDE `{ thesisId }` audit entry.
 *
 * ADMIN / actorId authority, tenant checks and ACTIVE-only eligibility stay in
 * the canonical use case; this composite adds none of its own.
 * Lives under `services/` so React UI stays free of direct dbService imports.
 * Not an Application boundary.
 */

import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';
import { createStrategicSignalRoutingUseCases } from '../composition/strategicSignalRouting/composeStrategicSignalRouting';

export type RadarContestedAttributionCompositeResult =
  | { ok: true; message: string; thesisId: string; historyWritten: boolean }
  | { ok: false; message: string };

export function runRadarContestedAttributionComposite(intent: {
  requestedClientId: string | null | undefined;
  signalId: string;
  selectedThesisId: string;
}): RadarContestedAttributionCompositeResult {
  const signalId = intent.signalId?.trim();
  const thesisId = intent.selectedThesisId?.trim();
  if (!signalId || !thesisId) {
    return { ok: false, message: 'Señal o tesis no resuelta' };
  }

  const signal = dbService.getSignalById(signalId);
  if (!signal) {
    return { ok: false, message: 'Señal no encontrada.' };
  }

  const clientId =
    (typeof intent.requestedClientId === 'string' && intent.requestedClientId.trim()) ||
    signal.clientId ||
    '';
  const user = authService.getCurrentUser();
  const organizationId =
    (clientId && dbService.getClientById(clientId)?.organizationId?.trim()) ||
    user?.organizationId?.trim() ||
    null;
  if (!clientId || !organizationId || !user) {
    return { ok: false, message: 'Sesión sin organizationId — no se puede asignar tesis' };
  }

  let historyWritten: boolean;
  let selectedThesisId: string;
  try {
    const result = createStrategicSignalRoutingUseCases().overrideSignalThesis({
      signalId,
      clientId,
      organizationId,
      selectedThesisId: thesisId,
      actorId: user.uid,
      actorRole: user.role,
    });
    historyWritten = result.historyWritten;
    selectedThesisId = result.routing.selectedThesisId || thesisId;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message ? error.message : 'No se pudo asignar la tesis',
    };
  }

  const title = dbService.getThesisById(clientId, selectedThesisId)?.title || selectedThesisId;

  try {
    auditService.log(user, 'THESIS_OVERRIDE', 'Signal', signalId, { thesisId });
  } catch {
    // Best-effort presentation compatibility — routing already persisted.
  }

  return { ok: true, message: `Señal asignada a «${title}»`, thesisId: selectedThesisId, historyWritten };
}
