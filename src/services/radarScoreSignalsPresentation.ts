/**
 * R1 H06 — Radar "Puntuar todas" presentation composite.
 *
 * Mirrors the legacy `btn-score-all-signals` click in `radarHandlers.ts`:
 * authoritative reload of pending signals (`relevanceScore === undefined` and not
 * DISCARDED) → frozen ScoreAndRouteSignal once per signal → one
 * SCORE_SIGNALS_BULK `{ scored }` audit entry.
 *
 * Counting mirrors legacy `scoreSignal`: a signal that ends UNROUTED with zero
 * eligible theses, or that disappeared (SIGNAL_NOT_FOUND), is not counted. Any
 * other routing error stops the run before the audit entry, as in legacy.
 *
 * ScoreAndRouteSignal enforces no actor role, so this composite requires ADMIN.
 * Lives under `services/` so React UI stays free of direct dbService imports.
 * Not an Application boundary.
 */

import { authService } from './auth';
import { auditService } from './audit';
import { dbService } from './db';
import { createStrategicSignalRoutingUseCases } from '../composition/strategicSignalRouting/composeStrategicSignalRouting';
import { StrategicRoutingError } from '../application/strategicSignalRouting';

export const RADAR_BULK_NO_ACTIVE_THESIS_MESSAGE = 'No hay tesis activa para puntuar';

export type RadarBulkScoringCompositeResult =
  | { ok: true; scored: number; message: string }
  | { ok: false; message: string };

export function runRadarBulkScoringComposite(intent: {
  requestedClientId: string | null | undefined;
}): RadarBulkScoringCompositeResult {
  const user = authService.getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { ok: false, message: 'Solo un administrador puede puntuar señales.' };
  }

  const clientId =
    typeof intent.requestedClientId === 'string' ? intent.requestedClientId.trim() : '';
  if (!clientId) {
    return { ok: false, message: 'Cliente no resuelto' };
  }

  const organizationId =
    dbService.getClientById(clientId)?.organizationId?.trim() ||
    user.organizationId?.trim() ||
    null;

  const pending = dbService
    .getSignalsByClient(clientId)
    .filter((s) => s.relevanceScore === undefined && s.status !== 'DISCARDED');

  let scored = 0;
  if (organizationId) {
    const { scoreAndRouteSignal } = createStrategicSignalRoutingUseCases();
    for (const signal of pending) {
      try {
        const result = scoreAndRouteSignal({ signalId: signal.id, clientId, organizationId });
        if (
          result.routing.routingState === 'UNROUTED' &&
          result.routing.eligibleThesisCount === 0
        ) {
          continue;
        }
        scored += 1;
      } catch (error) {
        if (error instanceof StrategicRoutingError && error.code === 'SIGNAL_NOT_FOUND') {
          continue;
        }
        return {
          ok: false,
          message:
            error instanceof Error && error.message
              ? error.message
              : 'No se pudieron puntuar las señales',
        };
      }
    }
  }

  try {
    auditService.log(user, 'SCORE_SIGNALS_BULK', 'Client', clientId, { scored });
  } catch {
    // Best-effort presentation compatibility — routing already persisted.
  }

  return {
    ok: true,
    scored,
    message: scored ? `${scored} señal(es) puntuada(s)` : RADAR_BULK_NO_ACTIVE_THESIS_MESSAGE,
  };
}
