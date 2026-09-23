/**
 * SPEC-010 · React ManagerCockpit (wave 3, T-010-303) — HYBRID.
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readPortfolioOverview`, `readAiCenter`).
 *
 * COMMAND: #34 CreateClientWithInvite (P14) via `clientLifecycleCommands`.
 * Remaining mutating cockpit actions stay legacy:
 *   - "Ver como cliente"           → `authService.impersonateClient` (SPEC-009)
 * COMMAND: RematerializeLocalSnapshotToFirestore via `localSnapshotCommands`.
 *   - "Redactar paper" / pipeline  → canonical gate + legacy writes
 *
 * Two legacy behaviours are deliberately not reproduced:
 *   - the directory row shows `getActiveTheses(id)[0]` and silently hides any
 *     other active thesis. This view shows the count and every title.
 *   - the panel probes `aiService.isServerGatewayAvailable()` during render.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useAiCenter,
  useCreateClientWithInvite,
  usePortfolioOverview,
  useRematerializeLocalSnapshot,
} from '../../hooks/useWave3Data';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

type CockpitTab = 'portfolio' | 'clients' | 'ai';

type CreateClientFields = {
  firstName: string;
  lastName: string;
  email: string;
  profession: string;
  company: string;
  targetMarket: string;
};

const EMPTY_CREATE_CLIENT: CreateClientFields = {
  firstName: '',
  lastName: '',
  email: '',
  profession: '',
  company: '',
  targetMarket: '',
};

function CreateClientPanel() {
  const { tenantScope } = useSession();
  const createClient = useCreateClientWithInvite(tenantScope);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<CreateClientFields>(EMPTY_CREATE_CLIENT);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = createClient.isPending;

  const resetForm = () => {
    setFields(EMPTY_CREATE_CLIENT);
    setError(null);
    setMessage(null);
  };

  const closeForm = () => {
    setOpen(false);
    resetForm();
  };

  const setField = (key: keyof CreateClientFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const firstName = fields.firstName.trim();
    const lastName = fields.lastName.trim();
    const email = fields.email.trim();
    if (!firstName || !lastName || !email) {
      setError('Nombre, apellido y correo son obligatorios.');
      return;
    }
    if (!email.includes('@')) {
      setError('Introduce un correo válido.');
      return;
    }

    const result = await createClient.mutateAsync({
      firstName,
      lastName,
      email,
      profession: fields.profession.trim() || undefined,
      company: fields.company.trim() || undefined,
      targetMarket: fields.targetMarket.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setFields(EMPTY_CREATE_CLIENT);
    setError(null);
    setMessage(result.message);
    setOpen(false);
  };

  return (
    <div className="cockpit-create-client" data-testid="react-cockpit-create-client">
      {!open ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
          data-testid="react-cockpit-create-open"
        >
          + Nuevo cliente
        </button>
      ) : (
        <form className="card nested-card" noValidate onSubmit={(event) => void submit(event)}>
          <h4>Crear cliente e invitación</h4>
          <p className="muted small">
            La organización y el actor se resuelven desde la sesión de manager.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="react-cockpit-first-name">
                Nombre
              </label>
              <input
                id="react-cockpit-first-name"
                className="form-input"
                value={fields.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
                required
                disabled={busy}
                data-testid="react-cockpit-first-name"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="react-cockpit-last-name">
                Apellido
              </label>
              <input
                id="react-cockpit-last-name"
                className="form-input"
                value={fields.lastName}
                onChange={(event) => setField('lastName', event.target.value)}
                required
                disabled={busy}
                data-testid="react-cockpit-last-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-email">
              Correo
            </label>
            <input
              id="react-cockpit-email"
              type="email"
              className="form-input"
              value={fields.email}
              onChange={(event) => setField('email', event.target.value)}
              required
              disabled={busy}
              data-testid="react-cockpit-email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-profession">
              Profesión (opcional)
            </label>
            <input
              id="react-cockpit-profession"
              className="form-input"
              value={fields.profession}
              onChange={(event) => setField('profession', event.target.value)}
              disabled={busy}
              data-testid="react-cockpit-profession"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-company">
              Empresa (opcional)
            </label>
            <input
              id="react-cockpit-company"
              className="form-input"
              value={fields.company}
              onChange={(event) => setField('company', event.target.value)}
              disabled={busy}
              data-testid="react-cockpit-company"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-cockpit-target">
              Mercado objetivo (opcional)
            </label>
            <input
              id="react-cockpit-target"
              className="form-input"
              value={fields.targetMarket}
              onChange={(event) => setField('targetMarket', event.target.value)}
              disabled={busy}
              data-testid="react-cockpit-target"
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={closeForm}
              data-testid="react-cockpit-create-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              data-testid="react-cockpit-create-submit"
            >
              {busy ? 'Creando…' : 'Crear e invitar'}
            </button>
          </div>
        </form>
      )}

      {message ? (
        <p className="muted small" role="status" data-testid="react-cockpit-create-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert" data-testid="react-cockpit-create-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RematerializeLocalSnapshotPanel() {
  const { tenantScope } = useSession();
  const rematerialize = useRematerializeLocalSnapshot(tenantScope);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!rematerialize.available) return null;

  const busy = rematerialize.isPending;

  const submit = async () => {
    setError(null);
    setMessage(null);
    const result = await rematerialize.mutateAsync();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
  };

  return (
    <div className="cockpit-rematerialize" data-testid="react-cockpit-rematerialize">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() => void submit()}
        data-testid="react-cockpit-rematerialize-submit"
      >
        {busy ? 'Subiendo…' : 'Subir local → Firestore'}
      </button>
      {message ? (
        <p className="muted small" role="status" data-testid="react-cockpit-rematerialize-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert" data-testid="react-cockpit-rematerialize-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PortfolioPanel({ onEnterClient }: { onEnterClient?: (clientId: string) => void }) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = usePortfolioOverview(tenantScope);
  const [search, setSearch] = useState('');

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando cartera…" testId="react-cockpit-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar la cartera."
        testId="react-cockpit-error"
      />
    );
  }

  const overview = data ?? {
    rows: [],
    totalClients: 0,
    needingAttention: 0,
    totalActiveTheses: 0,
  };

  const term = search.trim().toLowerCase();
  const rows = term
    ? overview.rows.filter((row) =>
        `${row.displayName} ${row.profession} ${row.company}`.toLowerCase().includes(term)
      )
    : overview.rows;

  const queue = [...rows].sort((a, b) => b.attentionScore - a.attentionScore);

  return (
    <div data-testid="react-cockpit-portfolio">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{overview.totalClients}</span>
          <span className="stat-label">Clientes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value" data-testid="react-cockpit-attention">
            {overview.needingAttention}
          </span>
          <span className="stat-label">Requieren atención</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value" data-testid="react-cockpit-theses">
            {overview.totalActiveTheses}
          </span>
          <span className="stat-label">Tesis activas</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="react-cockpit-search">
          Buscar cliente
        </label>
        <input
          id="react-cockpit-search"
          type="search"
          className="form-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          data-testid="react-cockpit-search"
        />
      </div>

      {queue.length ? (
        <ul className="portfolio-queue" data-testid="react-cockpit-queue">
          {queue.map((row) => (
            <li className="portfolio-queue-row" key={row.clientId}>
              <div>
                <strong>{row.displayName}</strong>
                <p className="muted small">
                  {row.profession}
                  {row.company ? ` · ${row.company}` : ''}
                </p>
                <p className="muted small" data-testid={`react-cockpit-theses-${row.clientId}`}>
                  {row.activeThesisCount === 0
                    ? 'Sin tesis activa'
                    : `${row.activeThesisCount} ${
                        row.activeThesisCount === 1 ? 'tesis activa' : 'tesis activas'
                      }: ${row.activeThesisTitles.join(' · ')}`}
                </p>
                {row.attentionReasons.length ? (
                  <ul className="small">
                    {row.attentionReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="portfolio-queue-meta">
                <span className={`badge ${row.attentionScore > 0 ? 'badge-pending' : 'badge-ready'}`}>
                  Atención {row.attentionScore}
                </span>
                <p className="muted small">
                  {row.unreviewedSignals} señales nuevas · {row.pendingCuration} por decidir
                </p>
                {onEnterClient ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onEnterClient(row.clientId)}
                  >
                    Abrir workspace
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-cockpit-empty">
          Ningún cliente coincide con la búsqueda.
        </p>
      )}
    </div>
  );
}

function AiCenterPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useAiCenter(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando consumo…" testId="react-ai-center-loading" />;
  }
  if (isError || !data) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el consumo de IA."
        testId="react-ai-center-error"
      />
    );
  }

  return (
    <div data-testid="react-ai-center">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{data.tier}</span>
          <span className="stat-label">Plan · {data.status}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.aiRunsUsed}</span>
          <span className="stat-label">Ejecuciones este mes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.tokensUsed}</span>
          <span className="stat-label">Tokens</span>
        </div>
      </div>

      {data.runs.length ? (
        <ul className="ai-run-list small" data-testid="react-ai-runs">
          {data.runs.map((run) => (
            <li key={run.id}>
              <span className={`badge ${run.ok ? 'badge-ready' : 'badge-pending'}`}>
                {run.status}
              </span>{' '}
              {run.agent} · {run.provider}/{run.modelName} · {run.createdAt}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ai-runs-empty">
          Sin ejecuciones registradas.
        </p>
      )}

      <p className="muted small">
        El estado del gateway se consulta en la interfaz anterior: esta vista no hace llamadas a
        servicios durante el render.
      </p>
    </div>
  );
}

export function ReactManagerCockpitPage({
  onEnterClient,
  shellTab = 'portfolio',
}: {
  onEnterClient?: (clientId: string) => void;
  shellTab?: CockpitTab;
}) {
  const { tenantScope, isAdmin } = useSession();
  const [tab, setTab] = useState<CockpitTab>(shellTab);

  useEffect(() => {
    setTab(shellTab);
  }, [shellTab]);

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra la cartera."
        testId="react-cockpit-no-scope"
      />
    );
  }

  if (!isAdmin) {
    return (
      <PanelState
        kind="empty"
        message="Esta vista es para managers."
        testId="react-cockpit-not-admin"
      />
    );
  }

  return (
    <section
      className="card cockpit-card"
      data-testid="react-manager-cockpit"
      data-authority="HYBRID"
    >
      <div className="card-header">
        <div>
          <h3>Cartera</h3>
          <p className="muted small">Lectura de cartera, directorio y consumo de IA.</p>
        </div>
        <div className="tab-pills" role="tablist" aria-label="Secciones de cartera">
          {(
            [
              ['portfolio', 'Hoy'],
              ['clients', 'Clientes'],
              ['ai', 'IA'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`btn btn-sm ${tab === value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <CreateClientPanel />
      <RematerializeLocalSnapshotPanel />

      {tab === 'ai' ? (
        <AiCenterPanel />
      ) : (
        <PortfolioPanel onEnterClient={onEnterClient} />
      )}

      <LegacyHandoff
        actions={[
          'ver la app como cliente',
          'generar contenido y mover el pipeline',
        ]}
        testId="react-cockpit-handoff"
      />
    </section>
  );
}
