/**
 * SPEC-010 · React SourceRegistry (wave 2, T-010-204) — READ_ONLY_REACT.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readSources`).
 *
 * COMMANDS: none on this React surface. CR-1 Signal Intake owns
 * `RegisterSource` (#8/#24) and `PollRegisteredSource` (#9); the React workspace
 * Sources tab invokes them through the command seam. This panel does not call
 * the consumer or mutate sources.
 *
 * The legacy modal additionally runs the source-discovery agent while rendering.
 * That is deliberately not reproduced: rendering a React view must not launch an
 * agent run, and the recommendation chips it produces belong to the surface that
 * owns the agent.
 */

import { useSession } from '../../providers/SessionProvider';
import { useSources } from '../../hooks/useWave2Data';

export function ReactSourceRegistryPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useSources(tenantScope);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-sources-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestran fuentes.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-sources-loading">
        <p className="muted">Cargando fuentes…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-sources-error">
        <p className="muted">No se pudieron cargar las fuentes.</p>
      </section>
    );
  }

  const sources = data ?? [];

  return (
    <section className="card" data-testid="react-sources-panel" data-authority="READ_ONLY">
      <div className="card-header">
        <div>
          <h3>Fuentes activas ({sources.length})</h3>
          <p className="muted small">
            Catálogo de orígenes de información ligados a este cliente — monitoreo multi-tesis, sin
            atribución automática a una tesis.
          </p>
        </div>
      </div>

      {sources.length ? (
        <div className="source-list">
          {sources.map((source) => (
            <div className="source-row" key={source.id}>
              <div>
                <strong>{source.name}</strong>
                <span className="badge badge-progress">{source.type}</span>
                {source.hasError ? <span className="badge badge-pending">error</span> : null}
                <p className="muted small">
                  {source.url || 'Entrada manual'} · cada {source.fetchIntervalMinutes} min
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state small" data-testid="react-sources-empty">
          Sin fuentes registradas todavía.
        </p>
      )}

      <p className="muted small" data-testid="react-sources-delegation">
        Registrar una fuente nueva e ingerir fuentes se hacen en la pestaña Fuentes del workspace
        del cliente.
      </p>
    </section>
  );
}
