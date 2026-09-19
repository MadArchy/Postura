/**
 * SPEC-010 · React ClientPortal (wave 3, T-010-304) — HYBRID.
 *
 * Authority: presentation + intent only.
 *
 * This is a HYBRID page, not a full cutover, and the classification is
 * load-bearing: the canonical parts of the portal run through React, and the
 * parts whose legacy handler writes business state without a canonical
 * Application use case stay on the legacy surface.
 *
 * READ SOURCES — one declared per panel:
 *   canonical      (SPEC-007) opportunities, via `readClientOpportunityCards`
 *   compatibility  tasks, content, theses, KPI results, latest client briefing
 *
 * P3B native: video teleprompter (`start` / video `complete`) and workspace
 * `attach_evidence` re-upload. Still blocked: add evidence vault (#30).
 *
 * CANONICAL COMMANDS migrated: accept / decline / toggle-checklist / submit an Opportunity,
 * register a consultation result, acknowledge a briefing (`AcknowledgeDelivery`),
 * decide thesis client review (`DecideThesisClientReview`), generic ClientPortal task
 * transitions (`TransitionClientTask` view / complete / request_changes for non-video,
 * non-article tasks — P3A), and client article review (`ReviewClientArticle` — P4 #32).
 *
 * MULTI-THESIS: the legacy portal selects `awaiting[0] || ACTIVE || theses[0]`
 * and that implicit pick feeds the approve/request-changes buttons' thesis id.
 * Here the client selects the thesis explicitly and nothing is pre-elected
 * (threat T-010-15).
 */

import { useEffect, useState } from 'react';
import { useSession } from '../../providers/SessionProvider';
import {
  useAcknowledgeDelivery,
  useClientContent,
  useClientLatestBriefing,
  useClientTasks,
  useContentDetail,
  useDecideThesisClientReview,
  useOpenClientArticleReview,
  useReviewClientArticle,
  useThesisDetail,
  useThesisOptions,
  useTransitionClientTask,
} from '../../hooks/useWave3Data';
import { ReactMasterDossierPanel } from '../MasterDossier/ReactMasterDossierPanel';
import { ReactOpportunityPanel } from '../Opportunity/ReactOpportunityPanel';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactClientProfilePanel } from '../ClientProfile/ReactClientProfilePanel';
import { ReactProofWallPanel } from '../ProofWall/ReactProofWallPanel';
import { LegacyHandoff, PanelState } from './LegacyHandoff';
import { ReactTeleprompterModal } from './ReactTeleprompterModal';

export type ClientPortalTab = 'home' | 'tasks' | 'content' | 'opportunities' | 'thesis' | 'results';

function isGenericClientTaskType(type: string): boolean {
  return type !== 'RECORD_VIDEO' && type !== 'REVIEW_ARTICLE';
}

function ArticleReviewPanel({
  contentId,
  taskId,
  onClose,
}: {
  contentId: string;
  taskId?: string;
  onClose: () => void;
}) {
  const { tenantScope } = useSession();
  const detail = useContentDetail(tenantScope, contentId);
  const review = useReviewClientArticle(tenantScope);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (detail.data?.resolved && !hydrated) {
      setTitle(detail.data.title);
      setBody(detail.data.body);
      setHydrated(true);
    }
  }, [detail.data, hydrated]);

  if (detail.isLoading || !hydrated) {
    return (
      <PanelState kind="loading" message="Cargando artículo…" testId="react-portal-article-review-loading" />
    );
  }
  if (detail.isError || !detail.data?.resolved) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el artículo."
        testId="react-portal-article-review-error"
      />
    );
  }

  const article = detail.data;

  const runDecision = (
    decision: 'save_revision' | 'approve' | 'request_changes',
    opts?: { reason?: string }
  ) => {
    setStatusMessage(null);
    const fallback =
      decision === 'save_revision'
        ? 'No se pudo guardar la revisión'
        : decision === 'approve'
          ? 'No se pudo aprobar el artículo'
          : 'No se pudo rechazar el artículo';
    review.mutate(
      {
        contentId,
        decision,
        title: decision === 'request_changes' ? undefined : title,
        body: decision === 'request_changes' ? undefined : body,
        reason: opts?.reason,
        taskId,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({ kind: 'error', text: result.message || fallback });
            return;
          }
          const kind =
            result.decision === 'save_revision' && !result.hadRevisionEvent ? 'info' : 'success';
          setStatusMessage({ kind, text: result.message });
          if (decision === 'request_changes') {
            setReason('');
            setRejectOpen(false);
          }
          if (decision === 'save_revision') {
            setHydrated(false);
          }
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: fallback });
        },
      }
    );
  };

  return (
    <div className="card article-review-modal" data-testid="react-portal-article-review">
      <header className="article-review-header">
        <div>
          <h3>Revisar artículo en tu voz</h3>
          <p className="muted small">
            {article.title} · {article.platform} · ~{article.wordCount} palabras
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid="react-portal-article-review-close"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      {article.managerNotes ? (
        <div className="article-review-notes" data-testid="react-portal-article-manager-notes">
          <strong>Indicaciones del manager</strong>
          <p className="muted small">{article.managerNotes}</p>
        </div>
      ) : null}

      <div className="form-group">
        <label className="form-label" htmlFor="react-article-review-title">
          Título
        </label>
        <input
          id="react-article-review-title"
          className="form-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          data-testid="react-portal-article-review-title"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="react-article-review-body">
          Cuerpo del artículo
        </label>
        {article.hasSectionMarkers ? (
          <p className="muted small article-section-hint">
            Guion estructurado: conserva los bloques [GANCHO], [DESARROLLO] y [CIERRE] si aplican.
          </p>
        ) : null}
        <textarea
          id="react-article-review-body"
          className="form-textarea article-review-body"
          rows={16}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          data-testid="react-portal-article-review-body"
        />
        <p className="muted small">
          Edita el borrador para que suene a ti. Al guardar registramos los cambios para tu Brand Manager.
        </p>
      </div>

      <div className="article-review-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="react-portal-article-review-reject-open"
          disabled={review.isPending}
          onClick={() => {
            setStatusMessage(null);
            setRejectOpen(true);
          }}
        >
          Rechazar con motivo
        </button>
        <div className="article-review-actions-main">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="react-portal-article-review-save"
            disabled={review.isPending || !title.trim() || !body.trim()}
            onClick={() => runDecision('save_revision')}
          >
            Guardar cambios
          </button>
          <button
            type="button"
            className="btn btn-success"
            data-testid="react-portal-article-review-approve"
            disabled={review.isPending}
            onClick={() => runDecision('approve')}
          >
            Aprobar y enviar
          </button>
        </div>
      </div>

      {rejectOpen ? (
        <div className="task-feedback" data-testid="react-portal-article-review-reject">
          <label className="form-label" htmlFor="react-article-review-reason">
            Motivo del rechazo
          </label>
          <textarea
            id="react-article-review-reason"
            className="form-textarea"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-testid="react-portal-article-review-reason"
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              data-testid="react-portal-article-review-reject-cancel"
              onClick={() => {
                setRejectOpen(false);
                setReason('');
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid="react-portal-article-review-reject-submit"
              disabled={review.isPending || !reason.trim()}
              onClick={() => runDecision('request_changes', { reason: reason.trim() })}
            >
              Enviar rechazo
            </button>
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <p
          className={
            statusMessage.kind === 'error'
              ? 'form-error'
              : statusMessage.kind === 'info'
                ? 'muted small'
                : 'form-success'
          }
          data-testid={
            statusMessage.kind === 'error'
              ? 'react-portal-article-review-failure'
              : 'react-portal-article-review-success'
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}

function ArticleTaskActions({
  task,
  onOpenReview,
}: {
  task: { id: string; status: string; contentItemId: string | null };
  onOpenReview: (contentId: string, taskId: string) => void;
}) {
  const { tenantScope } = useSession();
  const review = useReviewClientArticle(tenantScope);
  const openReview = useOpenClientArticleReview(tenantScope);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  const openNative = () => {
    setStatusMessage(null);
    if (!task.contentItemId) {
      setStatusMessage({ kind: 'info', text: 'No hay borrador vinculado. Revisa Producción.' });
      return;
    }
    openReview.mutate(
      { contentId: task.contentItemId, taskId: task.id },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({
              kind: 'error',
              text: result.message || 'No se pudo abrir la revisión del artículo',
            });
            return;
          }
          onOpenReview(task.contentItemId!, task.id);
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo abrir la revisión del artículo' });
        },
      }
    );
  };

  const approveWithoutEdits = () => {
    setStatusMessage(null);
    if (!task.contentItemId) {
      setStatusMessage({ kind: 'info', text: 'No hay borrador vinculado. Revisa Producción.' });
      return;
    }
    review.mutate(
      { contentId: task.contentItemId, decision: 'approve', taskId: task.id },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({ kind: 'error', text: result.message || 'No se pudo aprobar el artículo' });
            return;
          }
          setStatusMessage({ kind: 'success', text: result.message });
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo aprobar el artículo' });
        },
      }
    );
  };

  return (
    <div className="task-actions" data-testid={`react-portal-article-task-actions-${task.id}`}>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid={`react-portal-article-task-open-${task.id}`}
          disabled={openReview.isPending || review.isPending}
          onClick={openNative}
        >
          Revisar artículo
        </button>
        <button
          type="button"
          className="btn btn-success btn-sm"
          data-testid={`react-portal-article-task-approve-${task.id}`}
          disabled={openReview.isPending || review.isPending || !task.contentItemId}
          onClick={approveWithoutEdits}
        >
          Aprobar sin cambios
        </button>
      </div>
      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          data-testid={
            statusMessage.kind === 'error'
              ? `react-portal-article-task-failure-${task.id}`
              : `react-portal-article-task-success-${task.id}`
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}

function VideoTaskActions({
  task,
}: {
  task: { id: string; title: string; scriptPayload?: string | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={`react-portal-task-handoff-video-${task.id}`}>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        data-testid={`react-portal-task-open-video-${task.id}`}
        onClick={() => setOpen(true)}
      >
        grabar vídeo con el teleprompter
      </button>
      {open ? (
        <ReactTeleprompterModal
          taskId={task.id}
          title={task.title}
          scriptPayload={task.scriptPayload ?? null}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function TaskSpecializedHandoff({
  task,
  onOpenArticleReview,
}: {
  task: { id: string; type: string; status: string; contentItemId: string | null; title: string; scriptPayload?: string | null };
  onOpenArticleReview: (contentId: string, taskId: string) => void;
}) {
  if (task.type === 'RECORD_VIDEO') {
    return <VideoTaskActions task={task} />;
  }
  if (task.type === 'REVIEW_ARTICLE') {
    return <ArticleTaskActions task={task} onOpenReview={onOpenArticleReview} />;
  }
  return null;
}

function GenericTaskActions({
  task,
}: {
  task: { id: string; status: string; title: string };
}) {
  const { tenantScope } = useSession();
  const transition = useTransitionClientTask(tenantScope);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  const canView = task.status === 'ASSIGNED' || task.status === 'DRAFT';

  const runTransition = (
    intent: 'view' | 'complete' | 'request_changes',
    clientNotes?: string,
    successText?: string,
    errorFallback?: string
  ) => {
    setStatusMessage(null);
    transition.mutate(
      { taskId: task.id, intent, clientNotes },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({
              kind: 'error',
              text: result.message || errorFallback || 'No se pudo actualizar la tarea',
            });
            return;
          }
          if (successText) {
            setStatusMessage({ kind: 'success', text: successText });
          }
          if (intent === 'request_changes') {
            setNotes('');
            setFeedbackOpen(false);
          }
        },
        onError: () => {
          setStatusMessage({
            kind: 'error',
            text: errorFallback || 'No se pudo actualizar la tarea',
          });
        },
      }
    );
  };

  return (
    <div className="task-actions" data-testid={`react-portal-task-actions-${task.id}`}>
      <div className="btn-row">
        {canView ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid={`react-portal-task-view-${task.id}`}
            disabled={transition.isPending}
            onClick={() => runTransition('view')}
          >
            Abrir acción
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          data-testid={`react-portal-task-request-changes-${task.id}`}
          disabled={transition.isPending}
          onClick={() => {
            setStatusMessage(null);
            setFeedbackOpen(true);
          }}
        >
          Solicitar Ajustes
        </button>
        <button
          type="button"
          className="btn btn-success btn-sm"
          data-testid={`react-portal-task-complete-${task.id}`}
          disabled={transition.isPending}
          onClick={() => runTransition('complete', undefined, 'Tarea completada')}
        >
          Aprobar y Marcar como Listo
        </button>
      </div>

      {feedbackOpen ? (
        <div className="task-feedback" data-testid={`react-portal-task-feedback-${task.id}`}>
          <label className="form-label" htmlFor={`react-task-feedback-${task.id}`}>
            Observaciones para tu Brand Manager
          </label>
          <textarea
            id={`react-task-feedback-${task.id}`}
            className="form-textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            data-testid={`react-portal-task-feedback-notes-${task.id}`}
          />
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              data-testid={`react-portal-task-feedback-cancel-${task.id}`}
              onClick={() => {
                setFeedbackOpen(false);
                setNotes('');
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid={`react-portal-task-feedback-submit-${task.id}`}
              disabled={transition.isPending || !notes.trim()}
              onClick={() =>
                runTransition(
                  'request_changes',
                  notes.trim(),
                  'Observaciones enviadas a tu Brand Manager',
                  'No se pudo actualizar la tarea'
                )
              }
            >
              Enviar observaciones
            </button>
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'success' ? 'form-success' : 'form-error'}
          data-testid={
            statusMessage.kind === 'success'
              ? `react-portal-task-success-${task.id}`
              : `react-portal-task-failure-${task.id}`
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}

function TasksPanel({
  onOpenArticleReview,
}: {
  onOpenArticleReview: (contentId: string, taskId: string) => void;
}) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useClientTasks(tenantScope);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando acciones…" testId="react-portal-tasks-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar tus acciones."
        testId="react-portal-tasks-error"
      />
    );
  }

  const tasks = data ?? [];
  const open = tasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED');

  return (
    <div data-testid="react-portal-tasks">
      {open.length ? (
        <ul className="task-list">
          {open.map((task) => (
            <li className="task-row" key={task.id} data-testid={`react-portal-task-row-${task.id}`}>
              <div>
                <strong>{task.title}</strong>
                {task.description ? <p className="muted small">{task.description}</p> : null}
                <p className="muted small">
                  {task.type} · {task.estimatedMinutes} min
                  {task.deadline ? ` · vence ${task.deadline}` : ''}
                </p>
              </div>
              <span className="badge badge-progress" data-testid={`react-portal-task-status-${task.id}`}>
                {task.status}
              </span>
              {isGenericClientTaskType(task.type) ? (
                <GenericTaskActions task={task} />
              ) : (
                <TaskSpecializedHandoff task={task} onOpenArticleReview={onOpenArticleReview} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-portal-tasks-empty">
          No tienes acciones pendientes.
        </p>
      )}
    </div>
  );
}

function BriefingPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useClientLatestBriefing(tenantScope);
  const acknowledge = useAcknowledgeDelivery(tenantScope);
  const [note, setNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando briefing…" testId="react-portal-briefing-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar tu briefing."
        testId="react-portal-briefing-error"
      />
    );
  }

  if (!data) {
    return (
      <section className="card" data-testid="react-portal-briefing">
        <div className="section-heading">
          <div className="section-heading-copy">
            <p className="section-kicker">Contexto</p>
            <h2>Último briefing</h2>
            <p>La selección más reciente de tu Brand Manager y por qué importa.</p>
          </div>
        </div>
        <p className="empty-state" data-testid="react-portal-briefing-empty">
          Tu Brand Manager aún no te ha enviado un briefing.
        </p>
      </section>
    );
  }

  const isSent = data.status === 'SENT';
  const isAcknowledged = data.status === 'ACKNOWLEDGED';

  return (
    <section className="card" data-testid="react-portal-briefing">
      <div className="section-heading">
        <div className="section-heading-copy">
          <p className="section-kicker">Contexto</p>
          <h2>Último briefing</h2>
          <p>La selección más reciente de tu Brand Manager y por qué importa.</p>
        </div>
        {isSent ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="react-portal-briefing-ack"
            disabled={acknowledge.isPending}
            onClick={() => {
              setStatusMessage(null);
              const trimmedNote = note.trim() || undefined;
              acknowledge.mutate(
                { packageId: data.id, clientAckNote: trimmedNote },
                {
                  onSuccess: (result) => {
                    if (result.ok) {
                      setNote('');
                      setStatusMessage({ kind: 'success', text: 'Briefing marcado como visto' });
                    } else {
                      setStatusMessage({
                        kind: 'error',
                        text: result.message || 'No se pudo marcar el briefing',
                      });
                    }
                  },
                  onError: () => {
                    setStatusMessage({ kind: 'error', text: 'No se pudo marcar el briefing' });
                  },
                }
              );
            }}
          >
            Marcar como leído
          </button>
        ) : isAcknowledged ? (
          <span className="badge badge-ready" data-testid="react-portal-briefing-read">
            Leído
          </span>
        ) : null}
      </div>

      <article className="briefing-card" data-testid="react-portal-briefing-card">
        <header className="briefing-card-header">
          <div>
            <h3>{data.title}</h3>
            <p className="muted small">
              {data.periodLabel ? `${data.periodLabel} · ` : ''}
              {data.itemCount} {data.itemCount === 1 ? 'elemento' : 'elementos'} · {data.statusLabel}
            </p>
          </div>
        </header>

        {data.strategicNote ? (
          <blockquote className="briefing-note">{data.strategicNote}</blockquote>
        ) : null}

        <ul className="briefing-items">
          {data.items.map((item) => (
            <li key={item.id}>
              <span className="badge badge-progress">{item.kindLabel}</span>
              <strong>{item.title}</strong>
              {item.rationale ? (
                <details className="briefing-rationale">
                  <summary>Por qué se incluyó</summary>
                  <p className="muted small">{item.rationale}</p>
                </details>
              ) : null}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  Ver fuente
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        {isSent ? (
          <div className="briefing-ack-note">
            <label className="form-label" htmlFor={`react-ack-note-${data.id}`}>
              Nota para tu Brand Manager (opcional)
            </label>
            <textarea
              id={`react-ack-note-${data.id}`}
              className="form-textarea"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Lo reviso el jueves / necesito más contexto en el punto 2"
              data-testid="react-portal-briefing-note"
            />
          </div>
        ) : null}

        {data.clientAckNote ? (
          <p className="muted small">
            <em>Tu nota: {data.clientAckNote}</em>
          </p>
        ) : null}
      </article>

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'success' ? 'form-success' : 'form-error'}
          data-testid={
            statusMessage.kind === 'success'
              ? 'react-portal-briefing-success'
              : 'react-portal-briefing-failure'
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </section>
  );
}

function ContentPanel({
  onOpenArticleReview,
}: {
  onOpenArticleReview: (contentId: string, taskId?: string) => void;
}) {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useClientContent(tenantScope);
  const tasks = useClientTasks(tenantScope);
  const openReview = useOpenClientArticleReview(tenantScope);
  const review = useReviewClientArticle(tenantScope);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando contenido…" testId="react-portal-content-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar tu contenido."
        testId="react-portal-content-error"
      />
    );
  }

  const pending = data?.pending ?? [];
  const decided = data?.decided ?? [];

  const linkedTaskId = (contentId: string) =>
    (tasks.data ?? []).find(
      (task) =>
        task.type === 'REVIEW_ARTICLE' &&
        task.contentItemId === contentId &&
        task.status !== 'COMPLETED' &&
        task.status !== 'CANCELLED'
    )?.id;

  const openItem = (contentId: string) => {
    setStatusMessage(null);
    const taskId = linkedTaskId(contentId);
    openReview.mutate(
      { contentId, taskId },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({
              kind: 'error',
              text: result.message || 'No se pudo abrir la revisión del artículo',
            });
            return;
          }
          onOpenArticleReview(contentId, taskId);
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo abrir la revisión del artículo' });
        },
      }
    );
  };

  const approveItem = (contentId: string) => {
    setStatusMessage(null);
    review.mutate(
      { contentId, decision: 'approve', taskId: linkedTaskId(contentId) },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({ kind: 'error', text: result.message || 'No se pudo aprobar el artículo' });
            return;
          }
          setStatusMessage({ kind: 'success', text: result.message });
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: 'No se pudo aprobar el artículo' });
        },
      }
    );
  };

  return (
    <div data-testid="react-portal-content">
      <h4 className="small">Pendiente de tu revisión</h4>
      {pending.length ? (
        <ul className="content-list">
          {pending.map((item) => (
            <li className="content-row" key={item.id} data-testid={`react-portal-content-row-${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <p className="muted small">
                  {item.platform} · {item.type} · {item.wordCount} palabras
                </p>
              </div>
              <span className="badge badge-pending">{item.status}</span>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  data-testid={`react-portal-content-edit-${item.id}`}
                  disabled={openReview.isPending || review.isPending}
                  onClick={() => openItem(item.id)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  data-testid={`react-portal-content-approve-${item.id}`}
                  disabled={openReview.isPending || review.isPending}
                  onClick={() => approveItem(item.id)}
                >
                  Aprobar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  data-testid={`react-portal-content-reject-${item.id}`}
                  disabled={openReview.isPending || review.isPending}
                  onClick={() => openItem(item.id)}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-portal-content-empty">
          Nada pendiente de revisión.
        </p>
      )}

      {decided.length ? (
        <details data-testid="react-portal-content-decided">
          <summary className="small">Ya revisado ({decided.length})</summary>
          <ul className="content-list">
            {decided.map((item) => (
              <li className="content-row" key={item.id}>
                <strong>{item.title}</strong>
                <span className="badge badge-ready">{item.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          data-testid={
            statusMessage.kind === 'error'
              ? 'react-portal-content-failure'
              : 'react-portal-content-success'
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}

function ThesisReviewPanel() {
  const { tenantScope } = useSession();
  const [thesisId, setThesisId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );
  const options = useThesisOptions(tenantScope);
  const detail = useThesisDetail(tenantScope, thesisId);
  const decideReview = useDecideThesisClientReview(tenantScope);

  if (options.isLoading) {
    return <PanelState kind="loading" message="Cargando tesis…" testId="react-portal-thesis-loading" />;
  }
  if (options.isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar tus tesis."
        testId="react-portal-thesis-error"
      />
    );
  }

  const theses = options.data ?? [];
  const awaiting = theses.filter((thesis) => thesis.awaitingClientAction);
  const resolved = detail.data?.resolved ? detail.data : null;

  const handleDecision = (decision: 'approve' | 'request_changes') => {
    if (!thesisId) return;
    setStatusMessage(null);
    const fallback =
      decision === 'approve' ? 'No se pudo aprobar la tesis' : 'No se pudo solicitar cambios';
    decideReview.mutate(
      {
        thesisId,
        decision,
        feedback: decision === 'request_changes' ? feedback : undefined,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setStatusMessage({ kind: 'error', text: result.message || fallback });
            return;
          }
          if (result.decision === 'approve') {
            setStatusMessage({
              kind: 'success',
              text: result.appliedRevision
                ? 'Revisión aplicada. La tesis activa queda actualizada.'
                : result.awaitsManagerActivation
                  ? 'Tesis aprobada. Tu Brand Manager la activará.'
                  : 'Tesis aprobada.',
            });
          } else {
            setStatusMessage({ kind: 'success', text: 'Cambios solicitados al manager' });
          }
          if (decision === 'request_changes') {
            setFeedback('');
          }
        },
        onError: () => {
          setStatusMessage({ kind: 'error', text: fallback });
        },
      }
    );
  };

  return (
    <div data-testid="react-portal-thesis">
      {awaiting.length ? (
        <p className="muted small" data-testid="react-portal-thesis-awaiting">
          {awaiting.length === 1
            ? '1 tesis espera tu decisión.'
            : `${awaiting.length} tesis esperan tu decisión.`}
        </p>
      ) : null}

      {theses.length ? (
        <div className="form-group">
          <label className="form-label" htmlFor="react-portal-thesis-select">
            Tesis
          </label>
          <select
            id="react-portal-thesis-select"
            className="form-select"
            value={thesisId ?? ''}
            onChange={(event) => {
              setThesisId(event.target.value || null);
              setStatusMessage(null);
            }}
            data-testid="react-portal-thesis-select"
          >
            <option value="">Selecciona una tesis…</option>
            {theses.map((thesis) => (
              <option key={thesis.id} value={thesis.id}>
                {thesis.title} · {thesis.status}
                {thesis.awaitingClientAction ? ' · espera tu decisión' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="empty-state" data-testid="react-portal-thesis-empty">
          Todavía no hay tesis para revisar.
        </p>
      )}

      {thesisId && resolved ? (
        <div className="card" data-testid="react-portal-thesis-detail">
          <div className="card-header">
            <div>
              <h3>
                {resolved.status === 'UNDER_REVIEW'
                  ? 'Tesis en revisión'
                  : 'Tu tesis de posicionamiento'}
              </h3>
            </div>
            <span className="badge badge-pending">
              {resolved.status} · {resolved.clientApprovalStatus}
            </span>
          </div>

          {resolved.hasPendingRevision ? (
            <p className="warn-strip" data-testid="react-portal-thesis-pending-revision">
              Hay una revisión pendiente propuesta por tu Brand Manager.
            </p>
          ) : null}

          <h4>{resolved.title}</h4>
          {resolved.expertIdentity ? <p className="small">{resolved.expertIdentity}</p> : null}
          {resolved.differentiator ? (
            <p className="small">
              <strong>Diferenciador:</strong> {resolved.differentiator}
            </p>
          ) : null}
          {resolved.audiences.length ? (
            <p className="muted small">
              Audiencias: {resolved.audiences.map((a) => a.label).join(' · ')}
            </p>
          ) : null}
          {resolved.proofPoints.length ? (
            <ul className="policy-list" data-testid="react-portal-thesis-proof-points">
              {resolved.proofPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}

          {resolved.needsAction ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="react-portal-thesis-change-notes">
                  Si pides cambios, indica qué debe ajustar el manager
                </label>
                <textarea
                  id="react-portal-thesis-change-notes"
                  className="form-textarea"
                  rows={2}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Ej. La audiencia comercial está demasiado amplia."
                  data-testid="react-portal-thesis-change-notes"
                />
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-success"
                  data-testid="react-portal-thesis-approve"
                  disabled={decideReview.isPending}
                  onClick={() => handleDecision('approve')}
                >
                  Aprobar tesis
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  data-testid="react-portal-thesis-request-changes"
                  disabled={decideReview.isPending}
                  onClick={() => handleDecision('request_changes')}
                >
                  Pedir cambios
                </button>
              </div>
            </>
          ) : resolved.status === 'UNDER_REVIEW' && resolved.clientApprovalStatus === 'APPROVED' ? (
            <p className="info-strip" data-testid="react-portal-thesis-approved-info">
              Aprobaste esta tesis. Tu Brand Manager la activará para el radar y el contenido.
            </p>
          ) : null}
        </div>
      ) : thesisId ? (
        <p className="muted small" data-testid="react-portal-thesis-unresolved">
          Esa tesis no está disponible.
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'success' ? 'form-success' : 'form-error'}
          data-testid={
            statusMessage.kind === 'success'
              ? 'react-portal-thesis-success'
              : 'react-portal-thesis-failure'
          }
          role="status"
        >
          {statusMessage.text}
        </p>
      ) : null}

      <ReactProofWallPanel />

      <LegacyHandoff
        actions={['añadir evidencia al vault']}
        testId="react-portal-thesis-handoff"
      />

      <ReactMasterDossierPanel />
    </div>
  );
}

export function ReactClientPortalPage({ tab = 'home' }: { tab?: ClientPortalTab }) {
  const { tenantScope } = useSession();
  const [articleReview, setArticleReview] = useState<{ contentId: string; taskId?: string } | null>(
    null
  );

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra el portal."
        testId="react-portal-no-scope"
      />
    );
  }

  const openArticleReview = (contentId: string, taskId?: string) => {
    setArticleReview({ contentId, taskId });
  };

  return (
    <div className="page-content" data-testid="react-client-portal" data-portal-tab={tab}>
      {articleReview ? (
        <ArticleReviewPanel
          contentId={articleReview.contentId}
          taskId={articleReview.taskId}
          onClose={() => setArticleReview(null)}
        />
      ) : null}

      {tab === 'home' ? (
        <>
          <TasksPanel onOpenArticleReview={openArticleReview} />
          <BriefingPanel />
          <ReactOpportunityPanel />
        </>
      ) : null}

      {tab === 'tasks' ? <TasksPanel onOpenArticleReview={openArticleReview} /> : null}
      {tab === 'content' ? <ContentPanel onOpenArticleReview={openArticleReview} /> : null}
      {tab === 'opportunities' ? <ReactOpportunityPanel /> : null}
      {tab === 'thesis' ? <ThesisReviewPanel /> : null}

      {tab === 'results' ? (
        <>
          <ReactKpiWeeklyChart title="Tus resultados" />
          <ReactClientProfilePanel />
        </>
      ) : null}
    </div>
  );
}
