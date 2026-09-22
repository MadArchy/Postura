/**
 * SPEC-010 · React ProofWallPanel (wave 2) — presentation write parity
 * for ProofWall readiness (#7).
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readProofWall`).
 *
 * WRITES: Wave2 hook → `masterProfileCommands` → `masterProfileConsumer` →
 * frozen SetProofWallItemReadiness. React may send proofWallItemId and
 * targetStatus (`pending` | `complete`) plus the session client id.
 * It must not supply role, organization, trusted client authority, or
 * any other ProofWall item field.
 *
 * `isAdmin` only shows or hides the toggle. Application remains the
 * authority. CLIENT stays on the same READ_ONLY badges as the legacy
 * non-editable view.
 *
 * Legacy `ProofWallPanel` + `profileHandlers` remain for rollback.
 */

import { useMemo, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { narrowToClient } from '../../query/tenantScope';
import { useProofWall, useSetProofWallItemReadiness } from '../../hooks/useWave2Data';
import { applyUiMode } from '../../mount';

type StatusMessage = { kind: 'success' | 'error'; text: string };

export function ReactProofWallPanel({
  workspaceClientId = null,
}: {
  /** Shell-selected client for ADMIN workspace; CLIENT sessions already carry clientId. */
  workspaceClientId?: string | null;
}) {
  const { tenantScope: sessionScope, isAdmin } = useSession();
  const scope = useMemo(() => {
    if (!sessionScope) return null;
    if (sessionScope.clientId) return sessionScope;
    const requested = workspaceClientId?.trim();
    if (!requested || requested === 'all') return null;
    try {
      return narrowToClient(sessionScope, requested);
    } catch {
      return null;
    }
  }, [sessionScope, workspaceClientId]);
  const tenantScope = scope;
  const { data, isLoading, isError } = useProofWall(tenantScope);
  const setReadiness = useSetProofWallItemReadiness(tenantScope);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  if (!sessionScope) {
    return (
      <section className="card" data-testid="react-proof-wall-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestra el muro.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-proof-wall-loading">
        <p className="muted">Cargando muro de pruebas…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-proof-wall-error">
        <p className="muted">No se pudo cargar el muro de pruebas.</p>
      </section>
    );
  }

  const wall = data ?? { items: [], complete: 0, total: 0, percentComplete: 0 };
  const showToggle = isAdmin && Boolean(scope?.clientId);

  const handleToggle = (proofWallItemId: string, complete: boolean) => {
    const targetStatus = complete ? 'pending' : 'complete';
    setReadiness.mutate(
      { proofWallItemId, targetStatus },
      {
        onSuccess: (result) => {
          setStatusMessage({
            kind: result.ok ? 'success' : 'error',
            text:
              result.message ||
              (result.ok ? 'Activo actualizado' : 'No se pudo actualizar el estado del activo'),
          });
        },
        onError: () =>
          setStatusMessage({
            kind: 'error',
            text: 'No se pudo actualizar el estado del activo',
          }),
      }
    );
  };

  return (
    <section
      className="card proof-wall-card"
      data-testid="react-proof-wall-panel"
      data-authority="PRESENTATION"
      data-client-view="READ_ONLY"
    >
      <div className="card-header">
        <div>
          <h3>Muro de pruebas §5.3</h3>
          <p className="muted small">
            Activos que respaldan credenciales públicas — libro, instituciones, servicios y medios.
          </p>
        </div>
        <div className="proof-wall-progress">
          <span
            className={`badge ${wall.percentComplete >= 70 ? 'badge-ready' : 'badge-progress'}`}
            data-testid="react-proof-wall-progress"
          >
            {wall.complete}/{wall.total} listos
          </span>
        </div>
      </div>

      <div className="progress-track proof-wall-track">
        <div className="progress-fill" style={{ width: `${wall.percentComplete}%` }} />
      </div>

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          data-testid={
            statusMessage.kind === 'error' ? 'react-proof-wall-error-msg' : 'react-proof-wall-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

      {wall.items.length ? (
        <ul className="proof-wall-list">
          {wall.items.map((item) => (
            <li
              className={`proof-wall-item ${item.complete ? 'is-complete' : 'is-pending'}`}
              key={item.id}
            >
              <span className="proof-wall-status" aria-hidden="true">
                {item.complete ? '✅' : '⏳'}
              </span>
              <div className="proof-wall-item-body">
                <strong>{item.title}</strong>
                {item.description ? <p className="muted small">{item.description}</p> : null}
                {item.evidenceUrl ? (
                  <a
                    className="small"
                    href={item.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver evidencia
                  </a>
                ) : null}
              </div>
              {showToggle ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  data-testid={`react-proof-wall-toggle-${item.id}`}
                  disabled={setReadiness.isPending}
                  onClick={() => handleToggle(item.id, item.complete)}
                >
                  {setReadiness.isPending
                    ? 'Guardando…'
                    : item.complete
                      ? 'Marcar pendiente'
                      : 'Marcar listo'}
                </button>
              ) : (
                <span className={`badge ${item.complete ? 'badge-ready' : 'badge-pending'}`}>
                  {item.complete ? 'Listo' : 'Pendiente'}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-proof-wall-empty">
          Sin activos registrados todavía.
        </p>
      )}

      <p className="muted small" data-testid="react-proof-wall-delegation">
        La interfaz anterior sigue disponible para rollback.{' '}
        <button type="button" className="link-btn" onClick={() => void applyUiMode('legacy')}>
          Abrir interfaz anterior
        </button>
      </p>
    </section>
  );
}
