/**
 * SPEC-010 · React ClientProfilePanel (wave 2) — presentation write parity
 * for Master Profile fact lifecycle (#2–#6).
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readProfileOverview`). Coverage/completeness are
 * consumed from the facade — React does not evaluate the 20/5 formula.
 *
 * WRITES: Wave2 hooks → `masterProfileCommands` → `masterProfileConsumer` →
 * frozen Add/Confirm/Reject/Update/ImportProfileFactsFromCv.
 *
 * React may collect section/label/value, factId, value, and local CV text.
 * It must not supply role, organization, trusted client identity, status,
 * source, or completeness. CV import sends text only (`file.text()` / paste).
 *
 * #7 ProofWall remains a sibling Wave2 read-only surface.
 * Legacy `ClientProfilePanel` + `profileHandlers` remain for rollback.
 */

import { useEffect, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useAddProfileFact,
  useConfirmProfileFact,
  useImportProfileFactsFromCv,
  useProfileOverview,
  useRejectProfileFact,
  useUpdateProfileFact,
} from '../../hooks/useWave2Data';
import type { ProfileFactSection } from '../../../types';

type StatusMessage = { kind: 'success' | 'error'; text: string };

export function ReactClientProfilePanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useProfileOverview(tenantScope);
  const addFact = useAddProfileFact(tenantScope);
  const confirmFact = useConfirmProfileFact(tenantScope);
  const rejectFact = useRejectProfileFact(tenantScope);
  const updateFact = useUpdateProfileFact(tenantScope);
  const importCv = useImportProfileFactsFromCv(tenantScope);

  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState('');
  const [addValue, setAddValue] = useState('');
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvPrefillKey, setCvPrefillKey] = useState<string | null>(null);

  useEffect(() => {
    const extracted = data?.cvExtractedText ?? '';
    if (cvPrefillKey === null && extracted) {
      setCvText(extracted.slice(0, 2000));
      setCvPrefillKey(extracted);
    }
  }, [data?.cvExtractedText, cvPrefillKey]);

  if (!tenantScope) {
    return (
      <section className="card" data-testid="react-profile-no-scope">
        <p className="muted">Sesión sin contexto de organización — no se muestra el perfil.</p>
      </section>
    );
  }

  if (isLoading && !data) {
    return (
      <section className="card" data-testid="react-profile-loading">
        <p className="muted">Cargando perfil…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card" role="alert" data-testid="react-profile-error">
        <p className="muted">No se pudo cargar el perfil.</p>
      </section>
    );
  }

  const profile = data ?? {
    totalConfirmed: 0,
    sectionsWithFacts: 0,
    meetsPilotThreshold: false,
    sections: [],
    clientDisplayName: null,
    profileCompleteness: 0,
    cvExtractedText: '',
    serviceLines: [],
  };

  const showStatus = (kind: StatusMessage['kind'], text: string) => {
    setStatusMessage({ kind, text });
  };

  const handleAdd = (section: ProfileFactSection) => {
    const label = addLabel.trim();
    const value = addValue.trim();
    if (!label || !value) {
      showStatus('error', 'Escribe una etiqueta y un valor.');
      return;
    }
    addFact.mutate(
      { section, label, value },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            showStatus('error', result.message);
            return;
          }
          setAddingSection(null);
          setAddLabel('');
          setAddValue('');
          showStatus('success', result.message || 'Fact añadido');
        },
        onError: () => showStatus('error', 'No se pudo añadir el fact de perfil'),
      }
    );
  };

  const handleConfirm = (factId: string) => {
    confirmFact.mutate(
      { factId },
      {
        onSuccess: (result) => {
          showStatus(result.ok ? 'success' : 'error', result.message || (result.ok ? 'Fact confirmado' : 'No se pudo confirmar el fact de perfil'));
        },
        onError: () => showStatus('error', 'No se pudo confirmar el fact de perfil'),
      }
    );
  };

  const handleReject = (factId: string) => {
    rejectFact.mutate(
      { factId },
      {
        onSuccess: (result) => {
          showStatus(result.ok ? 'success' : 'error', result.message || (result.ok ? 'Fact descartado' : 'No se pudo rechazar el fact de perfil'));
        },
        onError: () => showStatus('error', 'No se pudo rechazar el fact de perfil'),
      }
    );
  };

  const handleUpdate = (factId: string) => {
    const value = editValue.trim();
    if (!value) {
      showStatus('error', 'Escribe un valor.');
      return;
    }
    updateFact.mutate(
      { factId, value },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            showStatus('error', result.message);
            return;
          }
          setEditingFactId(null);
          setEditValue('');
          showStatus('success', result.message || 'Fact actualizado');
        },
        onError: () => showStatus('error', 'No se pudo actualizar el fact de perfil'),
      }
    );
  };

  const handleImportCv = () => {
    const text = cvText.trim();
    if (!text) {
      showStatus('error', 'Pega el texto del CV o sube un archivo .txt');
      return;
    }
    importCv.mutate(
      { cvText: text },
      {
        onSuccess: (result) => {
          showStatus(result.ok ? 'success' : 'error', result.message);
        },
        onError: () => showStatus('error', 'No se pudieron importar facts desde CV'),
      }
    );
  };

  const handleCvFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCvText(text);
    setCvPrefillKey(text);
  };

  return (
    <div
      className="profile-page-stack"
      data-testid="react-profile-panel"
      data-authority="PRESENTATION"
    >
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Cobertura del perfil</h3>
            <p className="muted small">Objetivo piloto: ≥20 facts confirmados en ≥5 secciones.</p>
          </div>
          <span
            className={`badge ${profile.meetsPilotThreshold ? 'badge-ready' : 'badge-progress'}`}
            data-testid="react-profile-coverage"
          >
            {profile.totalConfirmed} facts · {profile.sectionsWithFacts} secciones
          </span>
        </div>

        <div className="coverage-grid">
          {profile.sections.map((section) => (
            <div
              className={`coverage-tile ${section.complete ? 'is-complete' : ''}`}
              key={section.section}
            >
              <strong>{section.label}</strong>
              <span className="muted small">
                {section.confirmed} confirmados
                {section.candidates ? ` · ${section.candidates} candidatos` : ''}
              </span>
            </div>
          ))}
        </div>

        {statusMessage ? (
          <p
            className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
            role="status"
            data-testid={
              statusMessage.kind === 'error' ? 'react-profile-error-msg' : 'react-profile-success'
            }
          >
            {statusMessage.text}
          </p>
        ) : null}
      </section>

      <section className="card" data-testid="react-profile-cv">
        <div className="card-header">
          <div>
            <h3>Subir CV para extraer facts</h3>
            <p className="muted small">Acepta .txt o .md. También puedes pegar texto plano del CV.</p>
          </div>
        </div>
        <div className="cv-upload-block">
          <label className="btn btn-secondary btn-sm">
            Seleccionar archivo
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              data-testid="react-profile-cv-file"
              onChange={(event) => {
                void handleCvFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <textarea
            className="form-textarea cv-paste-area"
            rows={5}
            placeholder="O pega aquí el texto de tu CV…"
            data-testid="react-profile-cv-paste"
            value={cvText}
            onChange={(event) => setCvText(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-testid="react-profile-cv-submit"
            disabled={importCv.isPending}
            onClick={handleImportCv}
          >
            {importCv.isPending ? 'Extrayendo…' : 'Extraer facts candidatos'}
          </button>
        </div>
      </section>

      {profile.sections.map((section) => (
        <section
          className="card profile-facts-section"
          key={section.section}
          data-fact-section={section.section}
        >
          <div className="card-header">
            <div>
              <h3>{section.label}</h3>
              <p className="muted small">
                {section.facts.length
                  ? `${section.facts.length} fact(s) en esta sección`
                  : 'Sin facts todavía'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid={`react-profile-add-${section.section}`}
              disabled={addFact.isPending}
              onClick={() => {
                setAddingSection((current) =>
                  current === section.section ? null : section.section
                );
                setAddLabel('');
                setAddValue('');
              }}
            >
              + Añadir
            </button>
          </div>

          {addingSection === section.section ? (
            <div className="profile-add-form" data-testid={`react-profile-add-form-${section.section}`}>
              <label className="muted small" htmlFor={`react-profile-add-label-${section.section}`}>
                Etiqueta
              </label>
              <input
                id={`react-profile-add-label-${section.section}`}
                className="form-input"
                data-testid={`react-profile-add-label-${section.section}`}
                value={addLabel}
                onChange={(event) => setAddLabel(event.target.value)}
              />
              <label className="muted small" htmlFor={`react-profile-add-value-${section.section}`}>
                Valor
              </label>
              <input
                id={`react-profile-add-value-${section.section}`}
                className="form-input"
                data-testid={`react-profile-add-value-${section.section}`}
                value={addValue}
                onChange={(event) => setAddValue(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid={`react-profile-add-submit-${section.section}`}
                disabled={addFact.isPending}
                onClick={() => handleAdd(section.section as ProfileFactSection)}
              >
                {addFact.isPending ? 'Guardando…' : 'Guardar fact'}
              </button>
            </div>
          ) : null}

          {section.facts.length ? (
            <div className="profile-facts-list">
              {section.facts.map((fact) => (
                <div
                  className={`profile-fact-row ${fact.status === 'candidate' ? 'is-candidate' : ''}`}
                  key={fact.id}
                  data-testid={`react-profile-fact-${fact.id}`}
                  data-fact-id={fact.id}
                  data-fact-status={fact.status}
                >
                  <div className="profile-fact-main">
                    <span
                      className={`badge ${fact.status === 'confirmed' ? 'badge-ready' : 'badge-progress'}`}
                    >
                      {fact.status === 'confirmed' ? 'Confirmado' : 'Candidato'}
                    </span>
                    <strong>{fact.label}</strong>
                    {editingFactId === fact.id ? (
                      <input
                        className="form-input"
                        data-testid={`react-profile-edit-value-${fact.id}`}
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                      />
                    ) : (
                      <p className="muted small">{fact.value}</p>
                    )}
                  </div>
                  <div className="profile-fact-actions">
                    {fact.status === 'candidate' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          data-testid={`react-profile-confirm-${fact.id}`}
                          disabled={confirmFact.isPending || rejectFact.isPending}
                          onClick={() => handleConfirm(fact.id)}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          data-testid={`react-profile-reject-${fact.id}`}
                          disabled={confirmFact.isPending || rejectFact.isPending}
                          onClick={() => handleReject(fact.id)}
                        >
                          Descartar
                        </button>
                      </>
                    ) : editingFactId === fact.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          data-testid={`react-profile-edit-submit-${fact.id}`}
                          disabled={updateFact.isPending}
                          onClick={() => handleUpdate(fact.id)}
                        >
                          {updateFact.isPending ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          data-testid={`react-profile-edit-cancel-${fact.id}`}
                          disabled={updateFact.isPending}
                          onClick={() => {
                            setEditingFactId(null);
                            setEditValue('');
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        data-testid={`react-profile-edit-${fact.id}`}
                        disabled={updateFact.isPending}
                        onClick={() => {
                          setEditingFactId(fact.id);
                          setEditValue(fact.value);
                        }}
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Añade facts confirmados o extrae candidatos desde tu CV.</p>
          )}
        </section>
      ))}

      {profile.serviceLines.length ? (
        <section className="card service-lines-card">
          <div className="card-header">
            <div>
              <h3>Líneas de servicio</h3>
              <p className="muted small">
                Dos vías §3.1–3.2: IP/Patentes y Adopción IA (solo lectura).
              </p>
            </div>
          </div>
          <div className="service-lines-grid">
            {profile.serviceLines.map((line) => (
              <article className="service-line-block" key={line.name}>
                <h4>{line.name}</h4>
                <p className="muted small">{line.description}</p>
                <ul className="policy-list">
                  {line.offerings.map((offering) => (
                    <li key={offering}>{offering}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile.clientDisplayName ? (
        <p className="muted small profile-footnote" data-testid="react-profile-completeness">
          Perfil de {profile.clientDisplayName} · completitud {profile.profileCompleteness}%
        </p>
      ) : null}
    </div>
  );
}
