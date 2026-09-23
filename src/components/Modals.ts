import { dbService } from '../services/db';
import { listStrategicBriefs } from '../services/strategicBriefConsumer';
import { authService } from '../services/auth';
import { esc, escAttr, nl2br } from '../lib/escape';
import { renderDeliveryBriefingCard } from './ClientPortal';
import { hasArticleSectionMarkers } from '../domain/articleReviewCore';
import { mapLegacyContentStatus } from '../domain/contentPipeline';
import {
  thesisChallengeOutcomeLabel,
  type ThesisChallengeResult,
} from '../domain/thesisChallengeCore';

export function renderTeleprompterModal(taskId: string): string {
  const task = dbService.getAllTasks().find(t => t.id === taskId);
  const scriptText = task?.scriptPayload || 'Guion no disponible.';

  return `
    <div id="teleprompter-modal" class="modal-overlay teleprompter-overlay">
      <div class="modal-content teleprompter-modal">
        <header class="teleprompter-header">
          <div>
            <h3>Teleprompter y grabación</h3>
            <p class="muted small">${esc(task?.title || 'Grabación de video')}</p>
          </div>
          <button id="btn-close-teleprompter" class="btn btn-secondary btn-sm teleprompter-close" type="button" aria-label="Cerrar">✕</button>
        </header>

        <div class="teleprompter-layout">
          <div class="teleprompter-media">
            <video id="teleprompter-camera" class="teleprompter-camera" autoplay muted playsinline></video>
            <video id="teleprompter-preview" class="teleprompter-preview hidden" playsinline controls></video>
            <div id="teleprompter-recording-indicator" class="teleprompter-rec-indicator hidden" aria-live="polite">
              <span class="teleprompter-rec-dot"></span> Grabando
            </div>
            <p id="teleprompter-camera-hint" class="teleprompter-camera-hint muted small">
              Activa cámara y micrófono. Ideal en móvil en vertical.
            </p>
          </div>

          <div class="teleprompter-container">
            <div class="teleprompter-cue"></div>
            <div id="teleprompter-scroll-area" class="teleprompter-glass">
              <p id="teleprompter-text-node" class="teleprompter-text">
                ${nl2br(scriptText)}
              </p>
            </div>
          </div>
        </div>

        <div id="teleprompter-phase-record" class="teleprompter-controls teleprompter-action-bar">
          <button id="btn-teleprompter-play" class="btn btn-primary teleprompter-touch-btn" type="button">
            Iniciar desplazamiento
          </button>
          <label class="teleprompter-speed-control">
            <span class="muted small">Velocidad</span>
            <input id="teleprompter-speed" type="range" min="1" max="5" value="2" />
          </label>
          <button id="btn-start-recording" class="btn btn-danger teleprompter-touch-btn" type="button">
            Grabar
          </button>
          <button id="btn-stop-recording" class="btn btn-secondary teleprompter-touch-btn hidden" type="button">
            Detener
          </button>
        </div>

        <div id="teleprompter-phase-preview" class="teleprompter-controls teleprompter-preview-controls teleprompter-action-bar hidden">
          <p class="muted small teleprompter-preview-copy">Revisa tu toma antes de enviarla al manager.</p>
          <button id="btn-retake-recording" class="btn btn-secondary teleprompter-touch-btn" type="button">
            Volver a grabar
          </button>
          <button id="btn-confirm-send-recording" class="btn btn-success teleprompter-touch-btn" data-task-id="${escAttr(taskId)}" type="button">
            Enviar video al manager
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderCreateClientModal(): string {
  return `
    <div id="create-client-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-header-copy"><h3>Crear nuevo cliente</h3><p>Datos iniciales para abrir su espacio de trabajo y enviar la invitación.</p></div>
          <button id="btn-close-create-client" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="form-create-client">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Nombre</label>
              <input type="text" id="new-client-firstname" class="form-input" required placeholder="Ej. Carlos" />
            </div>
            <div class="form-group">
              <label class="form-label">Apellido</label>
              <input type="text" id="new-client-lastname" class="form-input" required placeholder="Ej. Mendoza" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" id="new-client-email" class="form-input" required placeholder="carlos@despacho.com" />
          </div>

          <div class="form-group">
            <label class="form-label">Profesión / Especialidad</label>
            <input type="text" id="new-client-profession" class="form-input" required placeholder="Abogado en Fusiones y Adquisiciones (M&A)" />
          </div>

          <div class="form-group">
            <label class="form-label">Empresa / Firma</label>
            <input type="text" id="new-client-company" class="form-input" placeholder="Mendoza & Asociados" />
          </div>

          <div class="form-group">
            <label class="form-label">Mercado / Audiencia Objetivo</label>
            <input type="text" id="new-client-target" class="form-input" required placeholder="Fondos de Private Equity y Directores Financieros" />
          </div>

          <div class="modal-footer">
            <button type="button" id="btn-cancel-create-client" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">Crear e Invitar Cliente</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderComparativeModal(result: any): string {
  return `
    <div id="comparative-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 850px;">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>Análisis comparativo</h3>
            <p>Consenso entre dos modelos con contraste de divergencias.</p>
          </div>
          <button id="btn-close-comparative" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <div class="grid-2" style="margin-bottom: 1.25rem;">
          <div style="background: var(--bg-surface); padding: 1.15rem; border-radius: var(--radius-md); border-top: 3px solid #10a37f;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="color: #10a37f; font-size: 0.9rem;">OpenAI GPT-4o</strong>
              <span class="badge badge-progress" style="font-size: 0.75rem;">Operativo</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">${esc(result.openaiOutput)}</p>
          </div>

          <div style="background: var(--bg-surface); padding: 1.15rem; border-radius: var(--radius-md); border-top: 3px solid #d97706;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="color: #d97706; font-size: 0.9rem;">Anthropic Claude 3.7</strong>
              <span class="badge badge-ready" style="font-size: 0.75rem;">Dialéctico</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">${esc(result.claudeOutput)}</p>
          </div>
        </div>

        <div style="background: var(--bg-surface-raised); padding: 1.25rem; border-radius: var(--radius-md); border-left: 3px solid var(--accent-primary); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="color: var(--text-primary); font-size: 0.95rem;">💡 Síntesis Estratégica Recomendada</strong>
            <span class="badge badge-ready">Consenso: ${result.consensusScore}%</span>
          </div>
          <p style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.5rem;">${esc(result.synthesizedRecommendation)}</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);"><strong>Divergencia:</strong> ${esc(result.divergenceSummary)}</p>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="btn-close-comparative-bottom" class="btn btn-primary">Entendido y Aplicar Síntesis</button>
        </div>
      </div>
    </div>
  `;
}

export function renderChallengeModal(
  thesisTitle: string,
  challenge: ThesisChallengeResult,
  context?: { clientId: string; thesisId: string; thesisStatus?: string }
): string {
  const riskClass =
    challenge.riskScore >= 65 ? 'challenge-risk-high' : challenge.riskScore >= 40 ? 'challenge-risk-mid' : 'challenge-risk-low';
  const outcomeClass =
    challenge.outcome === 'READY'
      ? 'badge-ready'
      : challenge.outcome === 'SPLIT'
        ? 'badge-pending'
        : 'badge-progress';

  const actions: string[] = [];
  if (context) {
    if (challenge.primaryAction === 'edit' || challenge.outcome === 'REFINE') {
      actions.push(`
        <button type="button" id="btn-challenge-edit-thesis" class="btn btn-primary"
                data-client-id="${escAttr(context.clientId)}"
                data-thesis-id="${escAttr(context.thesisId)}">
          Editar tesis
        </button>`);
    }
    if (challenge.primaryAction === 'split' || challenge.outcome === 'SPLIT') {
      actions.push(`
        <button type="button" id="btn-challenge-split-thesis" class="btn btn-secondary"
                data-client-id="${escAttr(context.clientId)}"
                data-split-hint="${escAttr(challenge.splitHint || '')}">
          Crear segunda tesis
        </button>`);
    }
    if (challenge.primaryAction === 'vault' || challenge.outcome === 'PAUSE') {
      actions.push(`
        <button type="button" id="btn-challenge-open-vault" class="btn btn-secondary"
                data-client-id="${escAttr(context.clientId)}">
          Revisar evidencia
        </button>`);
    }
    if (challenge.primaryAction === 'submit' && context.thesisStatus === 'DRAFT') {
      actions.push(`
        <button type="button" id="btn-challenge-submit-thesis" class="btn btn-primary"
                data-client-id="${escAttr(context.clientId)}"
                data-thesis-id="${escAttr(context.thesisId)}">
          Enviar al cliente
        </button>`);
    }
  }

  return `
    <div id="challenge-modal" class="modal-overlay">
      <div class="modal-content challenge-modal-content">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>Stress-test de la tesis</h3>
            <p>${esc(thesisTitle)}</p>
          </div>
          <button id="btn-close-challenge" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <div class="challenge-summary">
          <div class="challenge-summary-head">
            <span class="badge ${outcomeClass}">${esc(thesisChallengeOutcomeLabel(challenge.outcome))}</span>
            <span class="challenge-risk ${riskClass}">Riesgo estratégico: ${esc(challenge.riskScore)}%</span>
          </div>
          ${challenge.splitHint ? `<p class="info-strip">${esc(challenge.splitHint)}</p>` : ''}
          ${challenge.findings.length
            ? `<ul class="challenge-findings">
                 ${challenge.findings.map((f) => `<li class="challenge-finding-${f.severity}">${esc(f.message)}</li>`).join('')}
               </ul>`
            : ''}
          <ul class="challenge-recommendations">
            ${(challenge.recommendations || []).map((r) => `<li>${esc(r)}</li>`).join('')}
          </ul>
        </div>

        <div class="modal-footer challenge-modal-footer">
          ${actions.join('')}
          <button id="btn-close-challenge-bottom" class="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

export function renderAddEvidenceModal(clientId: string): string {
  const theses = dbService.getThesesByClient(clientId);
  return `
    <div id="add-evidence-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-header-copy"><h3>Añadir evidencia</h3><p>Registra una prueba verificable que pueda respaldar afirmaciones públicas.</p></div>
          <button id="btn-close-evidence" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="form-add-evidence" data-client-id="${clientId}">
          <div class="form-group">
            <label class="form-label">Título de la Evidencia o Credencial</label>
            <input type="text" id="evidence-title" class="form-input" required placeholder="Ej. Certificación Internacional en Ciberseguridad NIST" />
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tipo de Evidencia</label>
              <select id="evidence-type" class="form-select">
                <option value="CERTIFICATION">Certificación / Título</option>
                <option value="ACADEMIC_PAPER">Artículo Académico / Paper</option>
                <option value="CASE_STUDY">Caso de Éxito Corporativo</option>
                <option value="MEDIA_MENTION">Mención en Prensa de Prestigio</option>
                <option value="METRIC">Métrica de Impacto Comprobable</option>
                <option value="AWARD">Premio / Ranking</option>
                <option value="PATENT">Patente</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Nivel de Confianza (%)</label>
              <input type="number" id="evidence-confidence" class="form-input" value="95" min="1" max="100" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Peso de autoridad (0-100)</label>
              <input type="number" id="evidence-authority-weight" class="form-input" value="70" min="0" max="100" />
            </div>
            <div class="form-group">
              <label class="form-label">Enlace de Verificación / URL</label>
              <input type="url" id="evidence-url" class="form-input" placeholder="https://..." />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Extracto o Resumen Verificable</label>
            <textarea id="evidence-snippet" class="form-textarea" rows="3" required placeholder="Detalle concreto de la credencial o cita para ser utilizada por los agentes de IA sin alucinaciones..."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Qué demuestra (uno por línea)</label>
            <textarea id="evidence-supports" class="form-textarea" rows="2" placeholder="Fundador de 3ITAL&#10;Best Lawyers 2026"></textarea>
          </div>

          ${theses.length
            ? `<div class="form-group">
                 <label class="form-label">Asignar a tesis</label>
                 <div class="checkbox-list">
                   ${theses.map((t) => `
                     <label class="checkbox-row">
                       <input type="checkbox" name="evidence-thesis" value="${escAttr(t.id)}" />
                       <span>${esc(t.title)}</span>
                     </label>
                   `).join('')}
                 </div>
               </div>`
            : ''}

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-evidence" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar en Evidence Vault</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderArticleReviewModal(contentId: string, taskId?: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  const wordCount = content.body.trim().split(/\s+/).filter(Boolean).length;
  const structured = hasArticleSectionMarkers(content.body);

  return `
    <div id="article-review-modal" class="modal-overlay">
      <div class="modal-content article-review-modal">
        <header class="article-review-header">
          <div>
            <h3>Revisar artículo en tu voz</h3>
            <p class="muted small">${esc(content.title)} · ${esc(content.targetPlatform)} · ~${wordCount} palabras</p>
          </div>
          <button id="btn-close-article-review" class="btn btn-secondary btn-sm teleprompter-close" type="button" aria-label="Cerrar">✕</button>
        </header>

        ${content.managerNotes
          ? `<div class="article-review-notes">
               <strong>Indicaciones del manager</strong>
               <p class="muted small">${esc(content.managerNotes)}</p>
             </div>`
          : ''}

        <form id="form-article-review" data-content-id="${escAttr(contentId)}" data-task-id="${escAttr(taskId || '')}">
          <div class="form-group">
            <label class="form-label" for="article-review-title">Título</label>
            <input id="article-review-title" class="form-input" value="${escAttr(content.title)}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="article-review-body">Cuerpo del artículo</label>
            ${structured
              ? `<p class="muted small article-section-hint">Guion estructurado: conserva los bloques [GANCHO], [DESARROLLO] y [CIERRE] si aplican.</p>`
              : ''}
            <textarea id="article-review-body" class="form-textarea article-review-body" rows="16" required>${esc(content.body)}</textarea>
            <p class="muted small">Edita el borrador para que suene a ti. Al guardar registramos los cambios para tu Brand Manager.</p>
          </div>

          <div class="article-review-actions">
            <button type="button" id="btn-article-reject" class="btn btn-secondary" data-content-id="${escAttr(contentId)}" data-task-id="${escAttr(taskId || '')}">
              Rechazar con motivo
            </button>
            <div class="article-review-actions-main">
              <button type="submit" class="btn btn-secondary" name="action" value="save">Guardar cambios</button>
              <button type="button" id="btn-article-approve" class="btn btn-success" data-content-id="${escAttr(contentId)}" data-task-id="${escAttr(taskId || '')}">
                Aprobar y enviar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderContentDiffModal(contentId: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  const events = dbService.getFeedbackEventsForContent(contentId);
  const latestEdit = events.find((event) => event.kind === 'CLIENT_EDIT');
  const latestReject = events.find((event) => event.kind === 'CLIENT_REJECT');
  const latestApprove = events.find((event) => event.kind === 'CLIENT_APPROVE');
  const pipeline = content.pipelineStatus || mapLegacyContentStatus(content.status);
  const readyToFinalize = pipeline === 'client_submitted' || pipeline === 'manager_finalizing' || Boolean(latestApprove);

  const pipelineLabels: Record<string, string> = {
    sent_to_client: 'Enviado al cliente',
    client_in_progress: 'Cliente editando',
    client_submitted: 'Aprobado por cliente',
    manager_finalizing: 'Manager finalizando',
  };

  return `
    <div id="content-diff-modal" class="modal-overlay">
      <div class="modal-content content-diff-modal">
        <header class="article-review-header">
          <div>
            <h3>Cambios del cliente</h3>
            <p class="muted small">${esc(content.title)} · ${esc(pipelineLabels[pipeline] || pipeline)}</p>
          </div>
          <button id="btn-close-content-diff" class="btn btn-secondary btn-sm teleprompter-close" type="button" aria-label="Cerrar">✕</button>
        </header>

        ${readyToFinalize
          ? `<div class="article-review-notes">
               <strong>Listo para finalizar</strong>
               <p class="muted small">El cliente aprobó o envió cambios. Abre el editor manager para pulir y marcar como listo.</p>
             </div>`
          : ''}

        ${latestEdit?.diffSummary
          ? `<div class="diff-summary-bar">
               <span class="badge badge-progress">+${latestEdit.diffSummary.added} líneas</span>
               <span class="badge badge-pending">−${latestEdit.diffSummary.removed} líneas</span>
               <span class="muted small">${latestEdit.diffSummary.unchanged} sin cambio</span>
             </div>`
          : ''}

        ${latestReject?.reason
          ? `<div class="article-review-notes warn">
               <strong>Rechazado por el cliente</strong>
               <p>${esc(latestReject.reason)}</p>
             </div>`
          : ''}

        ${latestApprove
          ? `<p class="muted small">Aprobado ${new Date(latestApprove.createdAt).toLocaleString('es')}</p>`
          : ''}

        <div class="diff-viewport">
          ${latestEdit?.diffHtml || '<p class="empty-state">El cliente aún no ha editado este borrador.</p>'}
        </div>

        <div class="article-review-actions">
          <button type="button" id="btn-close-content-diff-bottom" class="btn btn-secondary">Cerrar</button>
          ${authService.getCurrentUser()?.role === 'ADMIN'
            ? `<button type="button" class="btn btn-primary btn-open-content-editor" data-content-id="${escAttr(contentId)}">
                 Abrir editor manager
               </button>`
            : ''}
        </div>
      </div>
    </div>
  `;
}

// Phase-6 content editor ClaimSafety cutover
// (`client-content-editor-claim-safety`): leftover live panel and
// review-ack are omitted. P16 React editor accepted omission remains.
export function renderContentEditorModal(contentId: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  return `
    <div id="content-editor-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>Editor de contenido</h3>
            <p>Revisa, pule el tono y ajusta el estado del entregable.</p>
          </div>
          <button id="btn-close-content-editor" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="form-edit-content" data-content-id="${content.id}" data-client-id="${escAttr(content.clientId)}" data-thesis-id="${escAttr(content.thesisId || '')}">
          <div class="form-group">
            <label class="form-label">Título del Contenido</label>
            <input type="text" id="edit-content-title" class="form-input" value="${escAttr(content.title)}" required />
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Plataforma Destino</label>
              <select id="edit-content-platform" class="form-select">
                <option value="LinkedIn" ${content.targetPlatform === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
                <option value="YouTube" ${content.targetPlatform === 'YouTube' ? 'selected' : ''}>YouTube (Video)</option>
                <option value="Substack" ${content.targetPlatform === 'Substack' ? 'selected' : ''}>Substack / Newsletter</option>
                <option value="LegalJournal" ${content.targetPlatform === 'LegalJournal' ? 'selected' : ''}>Revista Especializada</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Formato</label>
              <select id="edit-content-type" class="form-select">
                <option value="VIDEO_SCRIPT" ${content.type === 'VIDEO_SCRIPT' ? 'selected' : ''}>Guion de Video (Teleprompter)</option>
                <option value="LINKEDIN_ARTICLE" ${content.type === 'LINKEDIN_ARTICLE' ? 'selected' : ''}>Artículo de Fondo</option>
                <option value="THOUGHT_LEADERSHIP" ${content.type === 'THOUGHT_LEADERSHIP' ? 'selected' : ''}>Columna de Opinión</option>
                <option value="ACADEMIC_PAPER" ${content.type === 'ACADEMIC_PAPER' ? 'selected' : ''}>Artículo científico / working paper</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Estado de Aprobación</label>
              <select id="edit-content-status" class="form-select">
                <option value="DRAFT" ${content.status === 'DRAFT' ? 'selected' : ''}>DRAFT (Borrador)</option>
                <option value="CLIENT_REVIEW" ${content.status === 'CLIENT_REVIEW' ? 'selected' : ''}>CLIENT_REVIEW (En Revisión del Cliente)</option>
                <option value="CHANGES_REQUESTED" ${content.status === 'CHANGES_REQUESTED' ? 'selected' : ''}>CHANGES_REQUESTED (Ajustes Solicitados)</option>
                <option value="READY" ${content.status === 'READY' ? 'selected' : ''}>READY (Listo para Publicar)</option>
                <option value="PUBLISHED" ${content.status === 'PUBLISHED' ? 'selected' : ''}>PUBLISHED (Publicado)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Cuerpo del Contenido / Guion Teleprompter</label>
            <textarea id="edit-content-body" class="form-textarea" rows="10" style="font-family: var(--font-mono); font-size: 0.88rem;" required>${esc(content.body)}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Notas del Brand Manager / Indicaciones de Grabación</label>
            <input type="text" id="edit-content-notes" class="form-input" value="${escAttr(content.managerNotes || '')}" placeholder="Ej. Grabar con energía en los primeros 8 segundos..." />
          </div>

          <div class="modal-footer">
            <span class="muted small">
              Última edición: ${new Date(content.updatedAt).toLocaleTimeString()}
            </span>
            <div class="row-actions">
              <button type="button" id="btn-cancel-content-editor" class="btn btn-secondary">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar cambios</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderFeedbackModal(targetId: string, itemType: 'TASK' | 'OPPORTUNITY' | 'CONTENT', taskId?: string): string {
  const title = itemType === 'CONTENT'
    ? 'Indica el motivo del rechazo'
    : 'Solicitar ajustes o registrar motivo';
  const subtitle = itemType === 'CONTENT'
    ? 'El motivo es obligatorio. Tu Brand Manager verá el diff y tus observaciones.'
    : 'Tus observaciones serán enviadas al Brand Manager para afinar la propuesta.';

  return `
    <div id="feedback-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>${title}</h3>
            <p>${subtitle}</p>
          </div>
          <button id="btn-close-feedback" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="form-submit-feedback" data-target-id="${targetId}" data-type="${itemType}" data-task-id="${escAttr(taskId || '')}">
          <div class="form-group">
            <label class="form-label">${itemType === 'CONTENT' ? 'Motivo del rechazo' : 'Detalle de las observaciones / cambios requeridos'}</label>
            <textarea id="feedback-notes" class="form-textarea" rows="4" required placeholder="${itemType === 'CONTENT' ? 'Ej. El tono es demasiado comercial; prefiero un enfoque más técnico en la sección 2…' : 'Ej. Me gustaría enfatizar más el aspecto de la inversión de la carga de la prueba…'}"></textarea>
          </div>

          <div class="modal-footer">
            <button type="button" id="btn-cancel-feedback" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">${itemType === 'CONTENT' ? 'Enviar rechazo' : 'Enviar observaciones'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// Phase-6 content preview ClaimSafety cutover
// (`client-content-preview-claim-safety`): leftover panel is omitted.
// ReactContentPreviewModal serves the advisory presentation.
export function renderContentPreviewModal(contentId: string): string {
  const content = dbService.getContentById(contentId);
  if (!content) return '';

  return `
    <div id="content-preview-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 720px;">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>Vista previa del contenido</h3>
            <p>Solo lectura. El editor de Producción conserva la versión de trabajo.</p>
          </div>
          <button id="btn-close-content-preview" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <div class="field-block">
          <label class="form-label">Título</label>
          <p>${esc(content.title)}</p>
        </div>
        <div class="grid-3" style="margin-bottom: 1rem;">
          <div class="field-block">
            <label class="form-label">Plataforma</label>
            <p>${esc(content.targetPlatform)}</p>
          </div>
          <div class="field-block">
            <label class="form-label">Formato</label>
            <p>${esc(content.type)}</p>
          </div>
          <div class="field-block">
            <label class="form-label">Estado</label>
            <p><span class="badge badge-progress">${esc(content.status)}</span></p>
          </div>
        </div>
        <div class="field-block">
          <label class="form-label">Contenido</label>
          <div style="background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); white-space: pre-wrap; font-size: 0.9rem; max-height: 320px; overflow-y: auto;">
            ${nl2br(content.body)}
          </div>
        </div>
        ${content.managerNotes
          ? `<div class="field-block"><label class="form-label">Notas del manager</label><p class="muted small">${esc(content.managerNotes)}</p></div>`
          : ''}

        <div class="modal-footer">
          <button type="button" id="btn-close-content-preview-bottom" class="btn btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

export function renderAddTaskModal(clientId: string): string {
  const client = dbService.getClientById(clientId);
  // Explicit thesis required — empty until manager selects (no primary default).
  const theses = dbService.getActiveTheses(clientId);

  return `
    <div id="add-task-modal" class="modal-overlay">
      <div class="modal-content" style="max-width: 560px;">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>Asignar tarea al cliente</h3>
            <p>
              ${client ? esc(client.displayName) : 'Cliente'} verá esta tarea en su portal de inmediato.
            </p>
          </div>
          <button id="btn-close-add-task" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <form id="form-add-task" data-client-id="${esc(clientId)}">
          <div class="form-group">
            <label class="form-label" for="task-thesis">Tesis (explícita)</label>
            <select id="task-thesis" class="form-input" required>
              <option value="">Selecciona una tesis ACTIVE…</option>
              ${theses.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="task-title">Título</label>
            <input type="text" id="task-title" class="form-input" required placeholder="Ej. Grabar video sobre el nuevo marco regulatorio de IA" />
          </div>

          <div class="form-group">
            <label class="form-label" for="task-description">Instrucciones para el cliente</label>
            <textarea id="task-description" class="form-textarea" rows="3" required placeholder="Qué debe hacer y con qué enfoque."></textarea>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" for="task-type">Tipo de tarea</label>
              <select id="task-type" class="form-select">
                <option value="RECORD_VIDEO">Grabar video</option>
                <option value="REVIEW_ARTICLE">Revisar artículo</option>
                <option value="APPROVE_OPPORTUNITY">Aprobar oportunidad</option>
                <option value="SUBMIT_INFO">Enviar información</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="task-minutes">Tiempo estimado (min)</label>
              <input type="number" id="task-minutes" class="form-input" min="5" max="480" value="15" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="task-deadline">Fecha límite (opcional)</label>
            <input type="date" id="task-deadline" class="form-input" />
          </div>

          <div class="modal-footer">
            <button type="button" id="btn-cancel-add-task" class="btn btn-secondary">Cancelar</button>
            <button type="submit" class="btn btn-primary">Asignar al cliente</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/** Vista previa del briefing tal como lo verá el cliente, antes de enviar. */
export function renderDeliveryPreviewModal(packageId: string): string {
  const pkg = dbService.getDeliveryById(packageId);
  if (!pkg) {
    return `
      <div class="modal-overlay">
        <div class="modal-content">
          <p>Briefing no encontrado.</p>
          <button type="button" class="btn btn-secondary btn-close-delivery-preview">Cerrar</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="modal-overlay" id="delivery-preview-modal">
      <div class="modal-content" style="max-width: 640px;">
        <div class="card-header" style="margin-bottom: 1rem;">
          <div>
            <h3>Vista previa del briefing</h3>
            <p class="muted small">Así lo verá el cliente en su portal. Confirma para materializar tareas y notificar.</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-delivery-preview" aria-label="Cerrar">✕</button>
        </div>
        ${renderDeliveryBriefingCard(pkg, { preview: true })}
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-close-delivery-preview">Seguir editando</button>
          <button type="button" class="btn btn-primary btn-confirm-send-delivery" data-package-id="${esc(pkg.id)}"
                  ${pkg.items.length ? '' : 'disabled'}>
            Confirmar y enviar
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderGenerateContentModal(
  clientId: string,
  options?: { thesisId?: string; topic?: string; strategicBriefId?: string }
): string {
  const approvedBriefs = listStrategicBriefs(clientId).filter(
    (b) =>
      b.status === 'APPROVED' &&
      !b.supersededByBriefId &&
      b.decision.authorizedAction === 'CREATE_CONTENT'
  );
  const topic = options?.topic || '';
  const selectedBrief =
    options?.strategicBriefId ||
    approvedBriefs.find((b) => !options?.thesisId || b.thesisId === options.thesisId)?.id ||
    approvedBriefs[0]?.id ||
    '';

  return `
    <div id="generate-content-modal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-header-copy">
            <h3>Nuevo contenido</h3>
            <p>Requiere un Strategic Brief APPROVED con autorización CREATE_CONTENT.</p>
          </div>
          <button id="btn-close-generate-content" class="btn btn-secondary btn-sm modal-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        ${approvedBriefs.length
          ? `<form id="form-generate-content" data-client-id="${escAttr(clientId)}">
               <div class="form-group">
                 <label class="form-label" for="generate-strategic-brief">Strategic Brief (APPROVED)</label>
                 <select id="generate-strategic-brief" class="form-select" required>
                   ${approvedBriefs.map((brief) => `
                     <option value="${escAttr(brief.id)}" ${brief.id === selectedBrief ? 'selected' : ''}>
                       ${esc(brief.id)} · v${brief.version} · ${esc(brief.thesisId)}
                     </option>
                   `).join('')}
                 </select>
               </div>

               <div class="form-group">
                 <label class="form-label" for="generate-format">Formato</label>
                 <select id="generate-format" class="form-select">
                   <option value="LINKEDIN_ARTICLE">Artículo LinkedIn</option>
                   <option value="THOUGHT_LEADERSHIP">Columna de opinión</option>
                   <option value="VIDEO_SCRIPT">Guion de video</option>
                   <option value="ACADEMIC_PAPER">Artículo científico</option>
                 </select>
               </div>

               <div class="form-group">
                 <label class="form-label" for="generate-topic">Tema</label>
                 <textarea id="generate-topic" class="form-textarea" rows="3" required
                           placeholder="Ej. Lo que un General Counsel debe exigir antes de adoptar un copiloto de IA">${esc(topic)}</textarea>
               </div>

               <div class="form-group">
                 <label class="form-label" for="generate-angle">Ángulo o matiz de voz (opcional)</label>
                 <input type="text" id="generate-angle" class="form-input"
                        placeholder="Ej. diagnóstico, sin hype, dirigido a GC" />
               </div>

               <div class="modal-footer">
                 <button type="button" id="btn-cancel-generate-content" class="btn btn-secondary">Cancelar</button>
                 <button type="submit" class="btn btn-primary">Redactar borrador</button>
               </div>
             </form>`
          : `<p class="empty-state">Create and approve a Strategic Brief (CREATE_CONTENT) before generating strategic content.</p>
             <div class="modal-footer">
               <button type="button" id="btn-cancel-generate-content" class="btn btn-secondary">Cerrar</button>
             </div>`}
      </div>
    </div>
  `;
}

