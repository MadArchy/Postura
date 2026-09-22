/**
 * SPEC-010 · React MasterDossierPanel (wave 2, T-010-201).
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readMasterDossier`). No canonical dossier
 * projection exists, so the read is labelled, tenant-keyed and read-only, and it
 * is not presented as canonical truth.
 *
 * COMMANDS: copy and download Markdown — PRESENTATION_ONLY. Both format data
 * already on screen and change no business state; they go through the command
 * seam so the UI keeps a single command entry point even for presentation
 * actions. No `dbService` write is involved.
 */

import { useMemo, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { narrowToClient } from '../../query/tenantScope';
import { useMasterDossier } from '../../hooks/useWave2Data';
import { dossierPresentationCommands } from '../../commands/commandSeam';

const CHANNEL_LABELS: Record<string, string> = {
  LINKEDIN: 'LinkedIn',
  WEBSITE: 'Web',
  YOUTUBE: 'YouTube',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
};

export function ReactMasterDossierPanel({
  workspaceClientId = null,
}: {
  /** Shell-selected client for ADMIN workspace; CLIENT sessions already carry clientId. */
  workspaceClientId?: string | null;
}) {
  const { tenantScope: sessionScope } = useSession();
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
  const { data, isLoading, isError } = useMasterDossier(tenantScope);
  const [notice, setNotice] = useState<string | null>(null);

  if (!sessionScope) {
    return (
      <section className="card" data-testid="react-dossier-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestra el dossier.</p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="card" data-testid="react-dossier-loading">
        <p className="muted">Cargando dossier maestro…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-dossier-error">
        <p className="muted">No se pudo cargar el dossier maestro.</p>
      </section>
    );
  }

  const dossier = data?.dossier ?? null;
  const client = data?.client ?? null;

  if (!dossier || !client) {
    return (
      <section className="card" data-testid="react-dossier-empty">
        <h3>Dossier maestro</h3>
        <p className="empty-state">No hay dossier maestro para este cliente.</p>
      </section>
    );
  }

  return (
    <section className="card dossier-card" data-testid="react-dossier-panel">
      <div className="card-header">
        <div>
          <h3>Dossier maestro</h3>
          <p className="muted small">
            Biografía, servicios, audiencia, diferenciadores y guías por canal — fuente de verdad
            para {client.displayName}.
          </p>
        </div>
        <div className="dossier-card-actions">
          <span className="badge badge-progress">v{dossier.version}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="react-dossier-copy"
            onClick={async () => {
              const result = await dossierPresentationCommands.copyMarkdown(dossier, client);
              setNotice(result.ok ? 'Markdown copiado.' : result.message);
            }}
          >
            Copiar Markdown
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="react-dossier-download"
            onClick={() => {
              const result = dossierPresentationCommands.download(dossier, client);
              setNotice(result.ok ? 'Dossier descargado en Markdown.' : result.message);
            }}
          >
            Descargar .md
          </button>
        </div>
      </div>

      {notice ? (
        <p className="muted small" role="status" data-testid="react-dossier-notice">
          {notice}
        </p>
      ) : null}

      <div className="dossier-hero">
        <p className="dossier-tagline-en">{dossier.taglineEn}</p>
        <p className="dossier-subtitle-en">{dossier.subtitleEn}</p>
      </div>

      <div className="dossier-section">
        <h4 className="dossier-section-title">Resumen ejecutivo</h4>
        <p>{dossier.executiveSummary}</p>
        <div className="field-block">
          <label className="form-label">Arco narrativo</label>
          <p className="dossier-arc">{dossier.narrativeArc}</p>
        </div>
        <div className="info-strip">
          <span>
            <strong>Regla editorial:</strong> {dossier.newsEditorialRule}
          </span>
        </div>
      </div>

      <div className="dossier-section">
        <h4 className="dossier-section-title">Identidad — 8 dimensiones</h4>
        <div className="dossier-dimension-grid">
          {dossier.identityDimensions.map((dimension) => (
            <div className="dossier-dimension" key={dimension.label}>
              <span className="dossier-dimension-label">{dimension.label}</span>
              <p>{dimension.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="dossier-section">
        <h4 className="dossier-section-title">Líneas de servicio</h4>
        <div className="workspace-split">
          {dossier.serviceLines.map((line) => (
            <div className="dossier-service-line" key={line.name}>
              <h5>{line.name}</h5>
              <p className="muted small">{line.description}</p>
              <ul className="policy-list">
                {line.offerings.map((offering) => (
                  <li key={offering}>{offering}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="dossier-section">
        <h4 className="dossier-section-title">Público objetivo</h4>
        <ul className="policy-list">
          {dossier.targetAudiences.map((audience) => (
            <li key={audience}>{audience}</li>
          ))}
        </ul>
        <h5>Preguntas de negocio que resuelve</h5>
        <ul className="policy-list">
          {dossier.clientQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>

      <div className="dossier-section">
        <div className="grid-2">
          <div>
            <h4 className="dossier-section-title">Temas que debe dominar</h4>
            <ul className="policy-list dossier-list-positive">
              {dossier.topicsToOwn.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="dossier-section-title">Evitar en comunicación</h4>
            <ul className="policy-list dossier-list-negative">
              {dossier.topicsToAvoid.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
        </div>

        {dossier.pendingVerification.length ? (
          <div className="warn-strip">
            <strong>Pendiente verificar:</strong>
            <ul className="policy-list">
              {dossier.pendingVerification.map((pending) => (
                <li key={pending}>{pending}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="field-block">
          <label className="form-label">Diferenciadores</label>
          <ul className="policy-list">
            {dossier.differentiators.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="dossier-section">
        <h4 className="dossier-section-title">Guías por canal</h4>
        <div className="dossier-channel-grid">
          {dossier.channelGuides.map((guide) => (
            <article className="dossier-channel-card" key={guide.channel}>
              <header>
                <span className="badge badge-progress">
                  {CHANNEL_LABELS[guide.channel] || guide.channel}
                </span>
              </header>
              <div className="field-block">
                <label className="form-label">Headline</label>
                <p>
                  <strong>{guide.headline}</strong>
                </p>
              </div>
              <div className="field-block">
                <label className="form-label">Bio</label>
                <p className="muted small">{guide.bio}</p>
              </div>
              <div className="field-block">
                <label className="form-label">Hacer</label>
                <ul className="policy-list dossier-list-positive">
                  {guide.dos.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="field-block">
                <label className="form-label">Evitar</label>
                <ul className="policy-list dossier-list-negative">
                  {guide.donts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
