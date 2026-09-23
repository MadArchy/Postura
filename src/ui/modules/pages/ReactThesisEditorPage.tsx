/**
 * SPEC-010 · React thesis editor (wave 3 + P5 manager write parity).
 *
 * Authority: presentation only.
 *
 * READ SOURCE: compatibility (`readThesisOptions`, `readThesisDetail`).
 *
 * COMMAND: #11 SaveThesis + #12 ActivateThesis via `thesisLifecycleCommands`
 * (draft | submit_review | activate). Explicit create uses `useCreateThesis`
 * (consumer mints the id). AI proposal and stress-test remain legacy.
 *
 * MULTI-THESIS — explicit id selection only:
 *   - selector starts unselected; no silent winner;
 *   - mutations always target the selected thesisId;
 *   - unresolved id is an error, never a silent create;
 *   - "Nueva tesis" is an explicit create mode, never an unresolved-id fallback.
 */

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSession } from '../../providers/SessionProvider';
import {
  useActivateThesis,
  useCreateThesis,
  useSaveThesis,
  useThesisDetail,
  useThesisOptions,
} from '../../hooks/useWave3Data';
import { narrowToClient } from '../../query/tenantScope';
import type { ThesisEditableFields } from '../../../types';
import type { ThesisSaveIntent } from '../../../domain/thesisRevisionCore';
import { LegacyHandoff, PanelState } from './LegacyHandoff';

/**
 * Input-shape schema for the editable review fields.
 *
 * AUTHORITY: NONE. Completeness / readiness / activation remain Domain-owned.
 */
const thesisReviewSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  expertIdentity: z.string().trim().min(1, 'La identidad experta es obligatoria'),
  differentiator: z.string().trim().optional().or(z.literal('')),
  perceptionTarget: z.string().trim().optional().or(z.literal('')),
});

type ThesisReviewFields = z.infer<typeof thesisReviewSchema>;

const EMPTY_EDITABLE_FIELDS: ThesisEditableFields = {
  title: '',
  expertIdentity: '',
  targetAudience: '',
  domain: '',
  objective: '',
  proofPoints: [],
  voiceAndTone: '',
  complianceRules: '',
};

function CompletenessBar({ score }: { score: number }) {
  return (
    <div className="progress-track" data-testid="react-thesis-completeness">
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </div>
  );
}

function mergeEditableFields(
  base: ThesisEditableFields,
  form: ThesisReviewFields
): ThesisEditableFields {
  return {
    ...base,
    title: form.title.trim(),
    expertIdentity: form.expertIdentity.trim(),
    differentiator: form.differentiator?.trim() || undefined,
    perceptionTarget: form.perceptionTarget?.trim() || undefined,
  };
}

function ThesisReviewForm({
  thesisId,
  editableFields,
  canActivate,
  busy,
  onSave,
  onActivate,
}: {
  thesisId: string;
  editableFields: ThesisEditableFields;
  canActivate: boolean;
  busy: boolean;
  onSave: (intent: ThesisSaveIntent, fields: ThesisEditableFields) => void;
  onActivate: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ThesisReviewFields>({
    defaultValues: {
      title: editableFields.title,
      expertIdentity: editableFields.expertIdentity,
      differentiator: editableFields.differentiator ?? '',
      perceptionTarget: editableFields.perceptionTarget ?? '',
    },
    resolver: async (values) => {
      const parsed = thesisReviewSchema.safeParse(values);
      if (parsed.success) return { values, errors: {} };
      const fieldErrors: Record<string, { type: string; message: string }> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!fieldErrors[key]) fieldErrors[key] = { type: 'shape', message: issue.message };
      }
      return { values: {}, errors: fieldErrors };
    },
  });

  const [shapeOk, setShapeOk] = useState<boolean | null>(null);
  const error = (name: keyof ThesisReviewFields) => errors[name]?.message;

  const runSave = (intent: ThesisSaveIntent) => {
    void handleSubmit(
      (values) => {
        setShapeOk(true);
        onSave(intent, mergeEditableFields(editableFields, values));
      },
      () => setShapeOk(false)
    )();
  };

  const field = (
    name: keyof ThesisReviewFields,
    label: string,
    kind: 'input' | 'textarea' = 'input'
  ) => (
    <div className="form-group" key={name}>
      <label className="form-label" htmlFor={`react-thesis-${name}`}>
        {label}
      </label>
      {kind === 'textarea' ? (
        <textarea
          id={`react-thesis-${name}`}
          className="form-textarea"
          rows={3}
          aria-invalid={error(name) ? true : undefined}
          aria-describedby={error(name) ? `react-thesis-${name}-error` : undefined}
          {...register(name)}
        />
      ) : (
        <input
          id={`react-thesis-${name}`}
          type="text"
          className="form-input"
          aria-invalid={error(name) ? true : undefined}
          aria-describedby={error(name) ? `react-thesis-${name}-error` : undefined}
          {...register(name)}
        />
      )}
      {error(name) ? (
        <p className="form-error" id={`react-thesis-${name}-error`} role="alert">
          {error(name)}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      data-testid="react-thesis-form"
      data-thesis-id={thesisId}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(
          () => setShapeOk(true),
          () => setShapeOk(false)
        )();
      }}
    >
      {field('title', 'Título de la tesis')}
      {field('expertIdentity', 'Identidad experta', 'textarea')}
      {field('differentiator', 'Diferenciador', 'textarea')}
      {field('perceptionTarget', 'Percepción objetivo', 'textarea')}

      <div className="form-actions">
        <button type="submit" className="btn btn-secondary" data-testid="react-thesis-validate">
          Revisar formato
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          data-testid="react-thesis-save"
          onClick={() => runSave('draft')}
        >
          Guardar borrador
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          data-testid="react-thesis-submit"
          onClick={() => runSave('submit_review')}
        >
          Enviar al cliente
        </button>
        {canActivate ? (
          <button
            type="button"
            className="btn btn-success"
            disabled={busy}
            data-testid="react-thesis-activate"
            onClick={onActivate}
          >
            Activar tesis
          </button>
        ) : null}
      </div>

      {shapeOk === true ? (
        <p className="muted small" role="status" data-testid="react-thesis-shape-ok">
          Formato correcto.
        </p>
      ) : null}
      {shapeOk === false ? (
        <p className="muted small" role="status" data-testid="react-thesis-shape-bad">
          Revisa los campos marcados.
        </p>
      ) : null}
    </form>
  );
}

export function ReactThesisEditorPage({
  workspaceClientId = null,
}: {
  /** Shell-selected client for ADMIN workspace; CLIENT sessions already carry clientId. */
  workspaceClientId?: string | null;
}) {
  const { tenantScope } = useSession();
  const scope = useMemo(() => {
    if (!tenantScope) return null;
    if (tenantScope.clientId) return tenantScope;
    const requested = workspaceClientId?.trim();
    if (!requested || requested === 'all') return null;
    try {
      return narrowToClient(tenantScope, requested);
    } catch {
      return null;
    }
  }, [tenantScope, workspaceClientId]);

  const [thesisId, setThesisId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const options = useThesisOptions(scope);
  const detail = useThesisDetail(scope, thesisId);
  const createThesis = useCreateThesis(scope);
  const saveThesis = useSaveThesis(scope);
  const activateThesis = useActivateThesis(scope);
  const busy = createThesis.isPending || saveThesis.isPending || activateThesis.isPending;

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestran tesis."
        testId="react-thesis-editor-no-scope"
      />
    );
  }

  if (!scope) {
    return (
      <PanelState
        kind="no-scope"
        message="Selecciona un cliente en el workspace para editar tesis."
        testId="react-thesis-editor-no-client"
      />
    );
  }

  if (options.isLoading) {
    return (
      <PanelState kind="loading" message="Cargando tesis…" testId="react-thesis-editor-loading" />
    );
  }

  if (options.isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las tesis."
        testId="react-thesis-editor-error"
      />
    );
  }

  const theses = options.data ?? [];
  const canActivate =
    Boolean(detail.data?.resolved) && (detail.data?.activationBlockers.length ?? 1) === 0;

  const handleSave = (intent: ThesisSaveIntent, fields: ThesisEditableFields) => {
    if (createMode) {
      setStatusMessage(null);
      createThesis.mutate(
        { intent, fields },
        {
          onSuccess: (result) => {
            if (!result.ok) {
              setStatusMessage({
                kind: 'error',
                text: result.message || 'No se pudo guardar la tesis',
              });
              return;
            }
            setCreateMode(false);
            setThesisId(result.thesisId);
            setStatusMessage({
              kind: result.notifySkipped ? 'info' : 'success',
              text: result.message,
            });
          },
          onError: () => {
            setStatusMessage({ kind: 'error', text: 'No se pudo guardar la tesis' });
          },
        }
      );
      return;
    }
    if (!thesisId) return;
    setStatusMessage(null);
    saveThesis.mutate(
      { thesisId, intent, fields },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({ kind: 'error', text: result.message || 'No se pudo guardar la tesis' });
            return;
          }
          setStatusMessage({
            kind: result.notifySkipped ? 'info' : 'success',
            text: result.message,
          });
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo guardar la tesis' });
        },
      }
    );
  };

  const handleActivate = () => {
    if (!thesisId) return;
    setStatusMessage(null);
    activateThesis.mutate(
      { thesisId },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({
              kind: 'error',
              text: result.message || 'No se pudo activar la tesis',
            });
            return;
          }
          setStatusMessage({
            kind: 'success',
            text: result.message || 'Tesis activada. El radar y el scoring ya la usan.',
          });
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo activar la tesis' });
        },
      }
    );
  };

  return (
    <section
      className="card thesis-editor-card"
      data-testid="react-thesis-editor"
      data-authority="PRESENTATION"
      data-workspace-client={scope.clientId ?? ''}
    >
      <div className="card-header">
        <div>
          <h3>Editor de tesis</h3>
          <p className="muted small">
            Selecciona explícitamente la tesis que quieres revisar. Ninguna tesis se elige por ti.
          </p>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            data-testid="react-thesis-create"
            onClick={() => {
              setCreateMode(true);
              setThesisId(null);
              setStatusMessage(null);
            }}
          >
            Nueva tesis
          </button>
          <span className="badge badge-progress" data-testid="react-thesis-count">
            {theses.length} {theses.length === 1 ? 'tesis' : 'tesis'}
          </span>
        </div>
      </div>

      {theses.length ? (
        <div className="form-group">
          <label className="form-label" htmlFor="react-thesis-select">
            Tesis
          </label>
          <select
            id="react-thesis-select"
            className="form-select"
            value={thesisId ?? ''}
            onChange={(event) => {
              setCreateMode(false);
              setThesisId(event.target.value || null);
              setStatusMessage(null);
            }}
            data-testid="react-thesis-select"
          >
            <option value="">Selecciona una tesis…</option>
            {theses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title} · {option.status}
                {option.awaitingClientAction ? ' · esperando al cliente' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="empty-state" data-testid="react-thesis-editor-empty">
          Este cliente todavía no tiene tesis registradas.
        </p>
      )}

      {createMode ? (
        <div data-testid="react-thesis-create-form">
          <ThesisReviewForm
            key="create"
            thesisId=""
            editableFields={EMPTY_EDITABLE_FIELDS}
            canActivate={false}
            busy={busy}
            onSave={handleSave}
            onActivate={() => undefined}
          />
        </div>
      ) : thesisId === null ? (
        <p className="muted small" data-testid="react-thesis-unselected">
          Sin tesis seleccionada.
        </p>
      ) : detail.isLoading ? (
        <p className="muted" data-testid="react-thesis-detail-loading">
          Cargando tesis…
        </p>
      ) : detail.isError ? (
        <p className="muted" role="alert" data-testid="react-thesis-detail-error">
          No se pudo cargar la tesis.
        </p>
      ) : !detail.data?.resolved || !detail.data.editableFields ? (
        <p className="muted" role="alert" data-testid="react-thesis-unresolved">
          Esa tesis no existe para este cliente. No se ha creado ninguna tesis nueva.
        </p>
      ) : (
        <div data-testid="react-thesis-detail">
          <div className="thesis-detail-head">
            <h4>{detail.data.title}</h4>
            <span className="badge" data-testid="react-thesis-status">
              {detail.data.status} · cliente: {detail.data.clientApprovalStatus}
            </span>
          </div>

          <p className="muted small">
            Completitud {detail.data.completenessScore}% · autoridad{' '}
            {detail.data.strengthScore ?? '—'} · evidencia asignada {detail.data.assignedEvidence} ·
            prioridad declarada{' '}
            {theses.find((t) => t.id === detail.data!.id)?.priority ?? '—'}
          </p>
          <CompletenessBar score={detail.data.completenessScore} />

          {detail.data.missingBlocks.length ? (
            <div className="thesis-blockers" data-testid="react-thesis-missing">
              <strong className="small">Bloques incompletos</strong>
              <ul className="small">
                {detail.data.missingBlocks.map((block) => (
                  <li key={block}>{block}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!detail.data.weightsOk ? (
            <p className="form-error small" role="alert" data-testid="react-thesis-weights">
              Los pesos de objetivos suman {detail.data.weightsTotal} y deberían sumar 100.
            </p>
          ) : null}

          {detail.data.readinessBlockers.length ? (
            <div className="thesis-blockers" data-testid="react-thesis-readiness">
              <strong className="small">Pendiente para enviar al cliente</strong>
              <ul className="small">
                {detail.data.readinessBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted small" data-testid="react-thesis-ready">
              La tesis cumple los requisitos de revisión según el dominio.
            </p>
          )}

          <div className="thesis-blocks-grid">
            <div>
              <strong className="small">Audiencias</strong>
              {detail.data.audiences.length ? (
                <ul className="small">
                  {detail.data.audiences.map((audience) => (
                    <li key={`${audience.tier}-${audience.label}`}>
                      {audience.label} · {audience.tier}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin audiencias declaradas.</p>
              )}
            </div>
            <div>
              <strong className="small">Territorios</strong>
              {detail.data.territories.length ? (
                <ul className="small">
                  {detail.data.territories.map((territory) => (
                    <li key={territory}>{territory}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin territorios declarados.</p>
              )}
            </div>
            <div>
              <strong className="small">Objetivos</strong>
              {detail.data.objectives.length ? (
                <ul className="small">
                  {detail.data.objectives.map((objective) => (
                    <li key={objective.label}>
                      {objective.label} · {objective.weight}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin objetivos declarados.</p>
              )}
            </div>
            <div>
              <strong className="small">Límites</strong>
              <p className="muted small">
                {detail.data.hardBlocks.length} bloqueos duros ·{' '}
                {detail.data.softAvoid.length} evitar
              </p>
            </div>
          </div>

          {detail.data.activationBlockers.length ? (
            <div className="thesis-blockers" data-testid="react-thesis-activation">
              <strong className="small">No se puede activar todavía</strong>
              <ul className="small">
                {detail.data.activationBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted small" data-testid="react-thesis-activation-ready">
              Elegible para activación según el dominio (el comando decide).
            </p>
          )}

          <ThesisReviewForm
            key={detail.data.id}
            thesisId={detail.data.id}
            editableFields={detail.data.editableFields}
            canActivate={canActivate}
            busy={busy}
            onSave={handleSave}
            onActivate={handleActivate}
          />
        </div>
      )}

      {statusMessage ? (
        <p
          className={
            statusMessage.kind === 'error'
              ? 'form-error'
              : statusMessage.kind === 'info'
                ? 'muted small'
                : 'form-success'
          }
          role="status"
          data-testid={
            statusMessage.kind === 'error' ? 'react-thesis-error' : 'react-thesis-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

      <LegacyHandoff
        actions={['el stress-test', 'generar propuesta con IA']}
        testId="react-thesis-editor-handoff"
      />
    </section>
  );
}
