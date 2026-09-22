import { dbService } from '../services/db';
import { esc, safeHref } from '../lib/escape';
import { renderPage } from './PageHeader';
import { renderTaskMetaBadges, KPI_LABELS, kpiLabel } from '../lib/campaignLabels';
import { icon } from '../lib/icons';
import { CAMP_ADOPTION } from '../data/juanCampaignSeed';
import { deliveryItemKindLabel, deliveryStatusLabel } from '../domain/deliveryCore';
import { normalizeThesis, AUDIENCE_TIER_LABELS } from '../domain/thesisModelCore';
import { computeProfileCoverage } from '../domain/profileCoverage';
import { thesisForClientReview, thesesAwaitingClientAction } from '../domain/thesisRevisionCore';
import type { DeliveryPackage } from '../types';

/**
 * Phase-6 ClientPortal opportunity cutover (`client-portal-opportunity`):
 * legacy renderOpportunity HTML is omitted. ReactClientPortalPage serves Scout.
 *
 * Phase-6 KPI Results cutover (`client-kpi-results`): Results tiles/chart omitted.
 * Phase-6 KPI Home cutover (`client-kpi-home`): Home dashboard omitted.
 * ReactClientPortalPage and Wave2Surface serve React KPI.
 *
 * Phase-6 ClientProfile cutover (`client-portal-profile`):
 * legacy renderClientProfileBody is omitted. Wave2Surface serves ReactClientProfilePanel.
 *
 * Phase-6 portal thesis ProofWall cutover (`client-portal-thesis-proof-wall`):
 * leftover `renderProofWall` is omitted from `renderClientThesisBody`.
 * ReactClientPortalPage thesis serves ReactProofWallPanel.
 * Phase-6 portal thesis service-lines cutover (`client-portal-thesis-service-lines`):
 * leftover `renderServiceLinesReadOnly` is omitted from `renderClientThesisBody`.
 * ReactMasterDossierPanel serves service-line facts on thesis.
 */

function clientPage(tab: string, body: string): string {
  return renderPage(tab, body);
}

/** Tarjeta de briefing (cliente y preview del manager). */
export function renderDeliveryBriefingCard(
  pkg: DeliveryPackage,
  options: { showAckControls?: boolean; preview?: boolean } = {}
): string {
  const { showAckControls = false, preview = false } = options;
  return `
    <article class="briefing-card ${preview ? 'briefing-card-preview' : ''}">
      <header class="briefing-head">
        <div>
          <h4>${esc(pkg.title)}</h4>
          <p class="muted small">
            ${pkg.periodLabel ? `${esc(pkg.periodLabel)} · ` : ''}
            ${pkg.items.length} ítem(s)
            ${preview ? ' · <span class="badge badge-progress">Vista previa</span>' : ''}
            ${!preview ? ` · ${esc(deliveryStatusLabel(pkg.status))}` : ''}
          </p>
        </div>
        ${showAckControls && pkg.status === 'SENT'
          ? `<button class="btn btn-secondary btn-sm btn-acknowledge-delivery" data-package-id="${esc(pkg.id)}">
               Marcar como leído
             </button>`
          : !preview && pkg.status === 'ACKNOWLEDGED'
            ? '<span class="badge badge-ready">Leído</span>'
            : ''}
      </header>

      ${pkg.strategicNote
        ? `<blockquote class="briefing-note">${esc(pkg.strategicNote)}</blockquote>`
        : ''}

      <ul class="briefing-items">
        ${pkg.items
          .map(
            (item) => `
          <li>
            <span class="badge badge-progress">${esc(deliveryItemKindLabel(item.kind))}</span>
            <strong>${esc(item.title)}</strong>
            ${item.rationale
              ? `<details class="briefing-rationale"><summary>Por qué se incluyó</summary><p class="muted small">${esc(item.rationale)}</p></details>`
              : ''}
            ${item.url ? `<a href="${safeHref(item.url)}" target="_blank" rel="noopener noreferrer">Ver fuente</a>` : ''}
          </li>`
          )
          .join('')}
      </ul>

      ${showAckControls && pkg.status === 'SENT'
        ? `<div class="briefing-ack-note">
             <label class="form-label" for="ack-note-${esc(pkg.id)}">Nota para tu Brand Manager (opcional)</label>
             <textarea id="ack-note-${esc(pkg.id)}" class="form-textarea input-ack-note" data-package-id="${esc(pkg.id)}" rows="2"
                       placeholder="Ej. Lo reviso el jueves / necesito más contexto en el punto 2"></textarea>
           </div>`
        : ''}
      ${pkg.clientAckNote
        ? `<p class="muted small"><em>Tu nota: ${esc(pkg.clientAckNote)}</em></p>`
        : ''}
    </article>
  `;
}

/** Briefings que el manager ya envió a este cliente. */
function renderReceivedBriefings(clientId: string, limit = 5): string {
  const deliveries = dbService.getSentDeliveriesByClient(clientId).slice(0, limit);
  if (!deliveries.length) {
    return '<p class="empty-state">Tu Brand Manager aún no te ha enviado un briefing.</p>';
  }

  return deliveries.map((pkg) => renderDeliveryBriefingCard(pkg, { showAckControls: true })).join('');
}

export function renderClientPortal(
  activeTab: string,
  clientId: string,
  activeCampaignId: string | null = CAMP_ADOPTION,
  selectedThesisId?: string,
  highlightTaskId?: string
): string {
  const client = dbService.getClientById(clientId);
  if (!client) {
    return clientPage(
      'client-home',
      `<div class="card"><p class="empty-state">No hay un cliente vinculado a esta sesión. Cierra sesión e inicia de nuevo.</p></div>`
    );
  }
  const campaignId = activeCampaignId || undefined;
  const tasks = dbService.getTasksForClient(client.id, campaignId);
  const theses = dbService.getThesesByClient(client.id);
  const profile = dbService.getMasterProfile(client.id);
  const campaigns = dbService.getCampaignsByClient(client.id);
  const effectiveCampaignId = campaignId || campaigns[0]?.id || CAMP_ADOPTION;

  switch (activeTab) {
    case 'client-home':
      return clientPage('client-home', renderClientHomeBody(client, tasks, effectiveCampaignId, theses, highlightTaskId));
    case 'client-feed':
      return clientPage('client-feed', renderClientTaskFeedBody(client, tasks));
    case 'client-content':
      return clientPage('client-content', renderClientContentReviewBody(client, effectiveCampaignId));
    case 'client-opps':
      return clientPage('client-opps', '');
    case 'client-profile':
      return clientPage('client-profile', '');
    case 'client-thesis':
      return clientPage('client-thesis', renderClientThesisBody(client, theses, profile, selectedThesisId));
    case 'client-results':
      return clientPage('client-results', renderClientResultsBody(client));
    case 'client-library':
      return clientPage('client-library', renderClientLibraryBody(client, effectiveCampaignId));
    default:
      return clientPage('client-home', renderClientHomeBody(client, tasks, effectiveCampaignId, theses, highlightTaskId));
  }
}

function formatDeadline(deadline?: string): string {
  if (!deadline) return 'Sin fecha límite';
  return new Date(deadline).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderStatTile(
  iconName: string,
  label: string,
  value: string | number,
  hint: string,
  tone: 'accent' | 'positive' | 'warning' | 'neutral' = 'neutral'
): string {
  const toneClass = tone === 'neutral' ? '' : `stat-tile-${tone}`;
  return `
    <div class="stat-tile">
      <div class="stat-tile-head">${icon(iconName, 15)}<span>${esc(label)}</span></div>
      <p class="stat-tile-value ${toneClass}">${esc(String(value))}</p>
      <p class="stat-tile-hint">${esc(hint)}</p>
    </div>
  `;
}

function renderClientStats(
  campaignId: string,
  tasks: ReturnType<typeof dbService.getTasksForClient>,
  clientId: string
): string {
  const camp = dbService.getCampaignById(campaignId);
  const open = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;
  const pendingContent = dbService.getContentByClient(clientId).filter((c) => c.status === 'CLIENT_REVIEW').length;
  const currentDay = camp?.planDays ? dbService.getCurrentPlanDay(campaignId) : 0;

  return `
    <div class="stat-grid">
      ${renderStatTile('zap', 'Acciones abiertas', open.length, open.length ? 'Listas para ejecutar' : 'Todo al día', open.length ? 'accent' : 'positive')}
      ${renderStatTile('check', 'Completadas', done, 'En esta campaña', 'positive')}
      ${renderStatTile('fileText', 'Por revisar', pendingContent, pendingContent ? 'Esperan tu aprobación' : 'Nada pendiente', pendingContent ? 'warning' : 'neutral')}
      ${camp?.planDays ? renderStatTile('calendar', 'Día del plan', `${currentDay}/${camp.planDays}`, camp.name) : ''}
    </div>
  `;
}

function renderPlanProgress(campaignId: string): string {
  const camp = dbService.getCampaignById(campaignId);
  if (!camp?.planDays) return '';
  const currentDay = dbService.getCurrentPlanDay(campaignId);
  const milestones = dbService.getCampaignMilestones(campaignId);
  const completed = milestones.filter((m) => m.status === 'completed').length;
  const pct = Math.min(100, Math.round((currentDay / camp.planDays) * 100));

  return `
    <div class="card plan-progress-card">
      <div class="card-header">
        <div>
          <h3>${esc(camp.name)}</h3>
          <p>Plan de ejecución de ${camp.planDays} días</p>
        </div>
        <span class="badge badge-accent">${pct}% recorrido</span>
      </div>
      <div class="plan-progress-meta">
        <span><span class="plan-progress-day">Día ${currentDay}</span> de ${camp.planDays}</span>
        <span>${completed} hito${completed === 1 ? '' : 's'} completado${completed === 1 ? '' : 's'}</span>
      </div>
      <div class="plan-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
        aria-label="Progreso del plan">
        <div class="plan-progress-fill" style="width: ${pct}%;"></div>
      </div>
    </div>
  `;
}

function renderUpcomingMilestones(campaignId: string): string {
  const camp = dbService.getCampaignById(campaignId);
  if (!camp?.planDays) return '';
  const currentDay = dbService.getCurrentPlanDay(campaignId);
  const upcoming = dbService
    .getCampaignMilestones(campaignId)
    .filter((m) => m.status !== 'completed' && m.dayNumber >= currentDay)
    .slice(0, 3);
  if (!upcoming.length) return '';

  return `
    <div class="card plan-milestones-card">
      <div class="card-header">
        <div>
          <h3>Próximos hitos</h3>
          <p>Lo que viene en el plan a partir del día ${currentDay}.</p>
        </div>
      </div>
      <ul class="plan-milestone-list">
        ${upcoming.map((m) => `
          <li class="plan-milestone-item">
            <span class="plan-milestone-day">Día ${m.dayNumber}</span>
            <div>
              <strong>${esc(m.title)}</strong>
              <span class="muted small">${esc(m.description || '')}</span>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderCampaignContext(campaignId: string): string {
  const camp = dbService.getCampaignById(campaignId);
  if (!camp) return '';
  return `
    <div class="info-strip">
      <span>
        Campaña activa: <strong>${esc(camp.name)}</strong> — tareas y contenido filtrados.
        Cambia arriba entre Adopción IA y PI/Patentes.
      </span>
    </div>
  `;
}

function renderWeeklyStrip(campaignId: string, tasks: ReturnType<typeof dbService.getTasksForClient>): string {
  const milestones = dbService.getCampaignMilestones(campaignId);
  const currentDay = dbService.getCurrentPlanDay(campaignId);
  const weekStart = currentDay - ((new Date().getDay() + 6) % 7);
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Esta semana</h3>
          <p>Ritmo operativo — acciones del plan de ejecución.</p>
        </div>
        <span class="badge badge-neutral">${icon('calendar', 13)} Semana en curso</span>
      </div>
      <div class="week-grid">
        ${days.map((label, i) => {
          const dayNum = weekStart + i;
          const ms = milestones.find((m) => m.dayNumber === dayNum);
          const dayTasks = tasks.filter((t) => t.campaignDay === dayNum && t.status !== 'COMPLETED');
          const isToday = dayNum === currentDay;
          return `
            <div class="week-day ${isToday ? 'week-day-today' : ''}">
              <span class="week-day-label">${label}${isToday ? ' · hoy' : ''}</span>
              <span class="week-day-num">${dayNum > 0 ? `Día ${dayNum}` : '—'}</span>
              ${ms ? `<p class="week-day-title">${esc(ms.title)}</p>` : '<p class="week-day-title muted">Sin hito</p>'}
              ${dayTasks.length ? `<span class="badge badge-accent">${dayTasks.length} tarea${dayTasks.length === 1 ? '' : 's'}</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderClientHomeBody(
  client: ReturnType<typeof dbService.getClientById>,
  tasks: ReturnType<typeof dbService.getTasksForClient>,
  campaignId: string,
  theses: ReturnType<typeof dbService.getThesesByClient>,
  highlightTaskId?: string
): string {
  const open = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const priorities = open.slice(0, 5);
  const clientId = client?.id || '';
  const pendingContent = dbService.getContentByClient(clientId).filter((c) => c.status === 'CLIENT_REVIEW').length;
  const thesisPending = thesesAwaitingClientAction(theses).length;

  const urgents: Array<{ label: string; detail: string; tab: string; cta: string }> = [];
  if (thesisPending) {
    urgents.push({
      label: `${thesisPending} tesis pendiente${thesisPending === 1 ? '' : 's'} de tu aprobación`,
      detail: 'Revisa identidad, audiencias y límites antes de activar el radar.',
      tab: 'client-thesis',
      cta: 'Revisar tesis',
    });
  }
  if (pendingContent) {
    urgents.push({
      label: `${pendingContent} contenido${pendingContent === 1 ? '' : 's'} por revisar`,
      detail: 'Artículos y guiones esperan tu voz.',
      tab: 'client-content',
      cta: 'Abrir revisión',
    });
  }
  if (open.length) {
    urgents.push({
      label: `${open.length} acción${open.length === 1 ? '' : 'es'} de la campaña`,
      detail: 'Grabaciones, revisiones y entregables de esta semana.',
      tab: 'client-home',
      cta: 'Ver cola',
    });
  }

  return `
      <div class="card hero-card client-week-hero">
        <div class="hero-card-inner">
          <div>
            <h2>Hola, ${esc(client?.firstName)}</h2>
            <p>${open.length
              ? `Esta semana tienes <strong>${open.length} acción${open.length === 1 ? '' : 'es'}</strong>. Empieza por la primera prioridad.`
              : 'Tu semana está al día. Aquí aparecerá el siguiente briefing cuando esté listo.'}</p>
          </div>
          <div class="hero-card-meta">
            <button type="button" class="btn btn-secondary btn-sm" data-tab="client-thesis">
              ${icon('target', 15)} Mi posicionamiento
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-tab="client-content">
              ${icon('fileText', 15)} Revisar contenido
            </button>
          </div>
        </div>
      </div>

      ${renderCampaignContext(campaignId)}

      ${urgents.length
        ? `<section class="card">
             <div class="section-heading">
               <div class="section-heading-copy">
                 <p class="section-kicker">Urgente</p>
                 <h2>Requiere tu atención</h2>
               </div>
             </div>
             <ul class="urgent-task-list">
               ${urgents.map((u) => `
                 <li>
                   <strong>${esc(u.label)}</strong>
                   <span class="muted small">${esc(u.detail)}</span>
                   <button type="button" class="btn btn-ghost btn-sm" data-tab="${esc(u.tab)}" style="align-self:flex-start;margin-top:0.35rem;">
                     ${esc(u.cta)}
                   </button>
                 </li>
               `).join('')}
             </ul>
           </section>`
        : ''}

      ${renderPlanProgress(campaignId)}
      ${renderUpcomingMilestones(campaignId)}
      ${renderWeeklyStrip(campaignId, tasks)}

      <section class="card">
        <div class="section-heading">
          <div class="section-heading-copy">
            <p class="section-kicker">Tu foco</p>
            <h2>Lo siguiente que debes hacer</h2>
            <p>Una sola cola, ordenada para que puedas avanzar sin buscar entre varias vistas.</p>
          </div>
        </div>
        ${priorities.length
          ? `<div class="priority-list">
               ${priorities.map((task) => `
                 <div class="priority-item${highlightTaskId === task.id ? ' priority-item-highlight' : ''}"
                      id="client-task-${esc(task.id)}"
                      data-task-id="${esc(task.id)}">
                   <div class="priority-copy">
                     <strong>${esc(task.title)}</strong>
                     <span>${esc(formatDeadline(task.deadline))} · ~${task.estimatedMinutes} min</span>
                     ${renderTaskMetaBadges(task)}
                   </div>
                   <button type="button" class="btn btn-primary btn-sm btn-open-task-action" data-task-id="${esc(task.id)}">
                     ${task.type === 'RECORD_VIDEO' ? 'Abrir teleprompter' : task.type === 'REVIEW_ARTICLE' ? 'Revisar artículo' : task.type === 'APPROVE_OPPORTUNITY' ? 'Ver oportunidad' : 'Abrir acción'}
                   </button>
                 </div>
               `).join('')}
             </div>`
          : '<p class="empty-state">No tienes acciones pendientes por ahora.</p>'}
      </section>

      <section class="card">
        <div class="section-heading">
          <div class="section-heading-copy">
            <p class="section-kicker">Contexto</p>
            <h2>Último briefing</h2>
            <p>La selección más reciente de tu Brand Manager y por qué importa.</p>
          </div>
        </div>
        ${renderReceivedBriefings(clientId, 1)}
      </section>

      <details class="card disclosure">
        <summary>Métricas de la campaña</summary>
        <div class="disclosure-body content-stack content-stack-lg">
          ${renderClientStats(campaignId, tasks, clientId)}
        </div>
      </details>
  `;
}

function renderClientTaskFeedBody(_client: ReturnType<typeof dbService.getClientById>, tasks: ReturnType<typeof dbService.getTasksByClient>): string {
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

  return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Acciones preparadas</h3>
            <p style="font-size: 0.9rem;">Revisa, graba con el teleprompter o aprueba material redactado en tu voz.</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${pendingTasks.length > 0 ? pendingTasks.map(task => {
            const isVideoTask = task.type === 'RECORD_VIDEO';
            return `
              <div class="card" style="background: var(--bg-surface); border: 1px solid ${isVideoTask ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-medium)'}; padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.5rem;">${isVideoTask ? '🎬' : '📝'}</span>
                    <div>
                      <h4>${esc(task.title)}</h4>
                      ${renderTaskMetaBadges(task)}
                      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
                        Tiempo estimado: ${task.estimatedMinutes} min · Fecha límite: ${formatDeadline(task.deadline)}
                      </p>
                    </div>
                  </div>
                  <span class="badge badge-progress">${esc(task.status)}</span>
                </div>

                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem; background: var(--bg-surface-raised); padding: 0.85rem; border-radius: var(--radius-md);">
                  ${esc(task.description)}
                </p>

                ${isVideoTask ? `
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.85rem; color: #a5b4fc; font-weight: 500;">
                      Guion cargado y sincronizado con el teleprompter en navegador.
                    </span>
                    <button class="btn btn-primary btn-open-teleprompter" data-task-id="${esc(task.id)}">
                      Abrir Teleprompter y Grabar Video
                    </button>
                  </div>
                ` : task.type === 'REVIEW_ARTICLE' && task.contentItemId ? `
                  <div style="display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm btn-open-article-review" data-content-id="${esc(task.contentItemId)}" data-task-id="${esc(task.id)}">
                      Editar artículo
                    </button>
                    <button class="btn btn-success btn-sm btn-approve-article-task" data-content-id="${esc(task.contentItemId)}" data-task-id="${esc(task.id)}">
                      Aprobar sin cambios
                    </button>
                  </div>
                ` : `
                  <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button class="btn btn-secondary btn-sm btn-request-task-changes" data-task-id="${esc(task.id)}">
                      Solicitar Ajustes
                    </button>
                    <button class="btn btn-success btn-sm btn-complete-task" data-task-id="${esc(task.id)}">
                      Aprobar y Marcar como Listo
                    </button>
                  </div>
                `}
              </div>
            `;
          }).join('') : `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
              🎉 ¡Excelente! No tienes tareas pendientes por el momento. Tu Brand Manager está preparando las siguientes oportunidades.
            </div>
          `}
        </div>
      </div>
  `;
}

function renderClientThesisBody(
  client: ReturnType<typeof dbService.getClientById>,
  theses: ReturnType<typeof dbService.getThesesByClient>,
  profile: ReturnType<typeof dbService.getMasterProfile>,
  selectedThesisId?: string
): string {
  const awaiting = thesesAwaitingClientAction(theses);
  const viewable = theses.filter((t) => t.status === 'ACTIVE' || t.status === 'UNDER_REVIEW');
  // ALLOWED_PRESENTATION_ONLY — initial thesis tab/view; does not write routing.
  const selected =
    (selectedThesisId ? theses.find((t) => t.id === selectedThesisId) : undefined) ||
    awaiting[0] ||
    viewable.find((t) => t.status === 'ACTIVE') ||
    theses[0];
  const activeThesis = selected;
  const reviewThesis = activeThesis ? thesisForClientReview(activeThesis) : undefined;
  const normalized = reviewThesis ? normalizeThesis(reviewThesis) : null;
  const clientId = client?.id;
  if (!clientId) {
    return `<div class="card"><p class="empty-state">Sin cliente vinculado — no se puede mostrar posicionamiento.</p></div>`;
  }
  const campaigns = dbService.getCampaignsByClient(clientId).filter(
    (c) => !selected || c.thesisId === selected.id
  );
  const evidenceList = dbService.getEvidenceVaultByClient(clientId);
  const needsAction =
    activeThesis &&
    ((activeThesis.status === 'UNDER_REVIEW' && activeThesis.clientApprovalStatus === 'PENDING') ||
      (activeThesis.pendingRevision && activeThesis.clientApprovalStatus === 'PENDING'));
  const coverage = computeProfileCoverage(profile);

  return `
    <div class="content-stack content-stack-lg">
      ${!coverage.meetsPilotThreshold
        ? `<div class="info-strip profile-coverage-strip">
             <strong>Perfil en construcción</strong>
             <span class="muted small">${coverage.totalConfirmed} facts confirmados en ${coverage.sectionsWithFacts} secciones — objetivo: ≥20 en ≥5.</span>
             <button type="button" class="btn btn-secondary btn-sm" data-tab="client-profile">Completar Mi perfil</button>
           </div>`
        : ''}
      ${viewable.length > 1
        ? `<div class="thesis-context-bar" role="group" aria-label="Tesis del cliente">
             <span class="thesis-context-label">Tesis</span>
             ${viewable.map((t) => `
               <button type="button"
                       class="thesis-context-chip${selected?.id === t.id ? ' thesis-context-chip-active' : ''}"
                       data-client-thesis-select="${esc(t.id)}">
                 ${esc(t.title)}
                 ${awaiting.some((a) => a.id === t.id) ? ' · pendiente' : ''}
               </button>
             `).join('')}
           </div>`
        : ''}
      <!-- Campaigns Tracker (F8-D08) -->
      ${campaigns.length > 0 ? `
        <div class="card">
          <div class="row-between">
            <div>
              <div class="cluster">
                <span class="badge badge-progress">${campaigns[0].status}</span>
                <h3>${campaigns[0].name}</h3>
              </div>
              <p class="small">
                ${campaigns[0].description}
              </p>
            </div>
            <div>
              <span class="metric-band-label">Entregables completados</span>
              <p class="metric-band-value">${campaigns[0].completedDeliverables} / ${campaigns[0].targetDeliverables}</p>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill progress-cyan" style="width: ${(campaigns[0].completedDeliverables / campaigns[0].targetDeliverables) * 100}%;"></div>
          </div>
        </div>
      ` : ''}

      <!-- Thesis Definition Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${selected?.status === 'UNDER_REVIEW' ? 'Tesis en revisión' : 'Tu tesis de posicionamiento'}</h3>
            <p>El filtro maestro que define qué temas se publican y ante qué público objetivo.</p>
          </div>
          ${activeThesis
            ? `<span class="badge ${activeThesis.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}">${esc(activeThesis.status)} · ${esc(activeThesis.clientApprovalStatus)}</span>`
            : ''}
        </div>

        ${reviewThesis && normalized ? `
          <div class="content-stack">
            ${activeThesis?.pendingRevision
              ? '<p class="warn-strip">Hay una revisión pendiente propuesta por tu Brand Manager.</p>'
              : ''}
            <div class="identity-grid">
              <div class="identity-field">
                <label class="form-label">Identidad actual</label>
                <p>${esc(normalized.identityCurrent || '—')}</p>
              </div>
              <div class="identity-field">
                <label class="form-label">Identidad objetivo</label>
                <p>${esc(reviewThesis.expertIdentity)}</p>
              </div>
              <div class="identity-field">
                <label class="form-label">Percepción objetivo</label>
                <p>${esc(normalized.perceptionTarget || reviewThesis.objective)}</p>
              </div>
              <div class="identity-field">
                <label class="form-label">Dominio</label>
                <p>${esc(reviewThesis.domain)}</p>
              </div>
            </div>

            <div class="identity-field">
              <label class="form-label">Audiencias</label>
              <ul class="policy-list">
                ${normalized.audiences.map((a) => `<li>${esc(a.name)} · ${esc(AUDIENCE_TIER_LABELS[a.tier])} · ${a.weight}</li>`).join('')
                  || `<li>${esc(reviewThesis.targetAudience)}</li>`}
              </ul>
            </div>

            <div class="identity-field">
              <label class="form-label">Territorios</label>
              <ul class="policy-list">
                ${normalized.territories.map((t) => `<li>${esc(t.name)} · ${t.weight}</li>`).join('')
                  || `<li>${esc(reviewThesis.domain)}</li>`}
              </ul>
            </div>

            <div class="identity-field">
              <label class="form-label">Límites duros</label>
              <ul class="policy-list">
                ${normalized.limits.hardBlocks.map((r) => `<li>${esc(r)}</li>`).join('')
                  || '<li class="muted">Sin límites duros declarados</li>'}
              </ul>
            </div>

            <div class="identity-field">
              <label class="form-label">Evidencias & Proof Points Registrados</label>
              <ul class="policy-list">
                ${reviewThesis.proofPoints.map(p => `<li>${esc(p)}</li>`).join('')}
              </ul>
            </div>
          </div>
        ` : `
          <p style="color: var(--text-muted);">Sin tesis configurada. Tu Brand Manager aún no ha publicado una tesis para tu aprobación.</p>
        `}
        ${needsAction ? `
          <div class="form-group">
            <label class="form-label" for="thesis-change-notes">Si pides cambios, indica qué debe ajustar el manager</label>
            <textarea id="thesis-change-notes" class="form-textarea" rows="2"
                      placeholder="Ej. La audiencia comercial está demasiado amplia."></textarea>
          </div>
          <div class="row-actions">
            <button class="btn btn-success btn-approve-thesis" data-thesis-id="${activeThesis!.id}">Aprobar tesis</button>
            <button class="btn btn-secondary btn-request-thesis-changes" data-thesis-id="${activeThesis!.id}">Pedir cambios</button>
          </div>
        ` : activeThesis?.status === 'UNDER_REVIEW' && activeThesis.clientApprovalStatus === 'APPROVED'
          ? '<p class="info-strip">Aprobaste esta tesis. Tu Brand Manager la activará para el radar y el contenido.</p>'
          : ''}
      </div>

      <!-- Evidence Vault (Módulo C / F7-D07 / F8-D08) -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Evidence Vault & Verificación de Credenciales (Módulo C)</h3>
            <p>Pruebas verificables, papers y acreditaciones que respaldan el rigor de los contenidos.</p>
          </div>
          <button id="btn-add-evidence-vault" class="btn btn-secondary btn-sm btn-add-evidence-vault" data-client-id="${clientId}">
            + Añadir Evidencia al Vault
          </button>
        </div>

        <div class="content-stack">
          ${evidenceList.map(item => `
            <div class="task-surface">
              <div class="row-between">
                <div class="cluster">
                  <h4>${esc(item.title)}</h4>
                  <span class="badge badge-ready">Verificada (${item.confidenceScore}%)</span>
                </div>
                <span class="badge badge-progress">${esc(item.type)}</span>
              </div>
              <p class="small">
                ${esc(item.snippet)}
              </p>
              ${item.sourceUrl ? `
                <a href="${safeHref(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="small">
                  Ver fuente original / Acreditación
                </a>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Master Profile Preview -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Perfil maestro</h3>
            <p>Tus credenciales, publicaciones y estilo de voz que alimentan a los agentes de redacción.</p>
          </div>
        </div>

        ${profile ? `
          <div class="content-stack">
            <div>
              <h4>${esc(client?.displayName || 'Perfil Profesional')}</h4>
              <p>${esc(profile.identity?.professionalHeadline || profile.career?.currentRole || '')}</p>
              <p class="muted small">${esc(profile.identity?.shortBio || '')}</p>
            </div>

            <div class="grid-2">
              <div class="identity-field">
                <h4>Formación académica</h4>
                ${(profile.education || []).map(e => `
                  <p class="small">
                    <strong>${esc(e.degree)}</strong> — ${esc(e.institution)} (${esc(e.year || '')})
                  </p>
                `).join('')}
              </div>

              <div class="identity-field">
                <h4>Preferencias de voz</h4>
                <p class="small">
                  <strong>Tono:</strong> ${(profile.voicePreferences?.tone || 'authoritative').toUpperCase()}
                </p>
                <p class="small">
                  <strong>Frases preferidas:</strong> ${esc((profile.voicePreferences?.preferredPhrases || []).join(', '))}
                </p>
              </div>
            </div>
          </div>
        ` : `
          <p style="color: var(--text-muted);">Sin perfil cargado.</p>
        `}
      </div>
    </div>
  `;
}

function renderClientContentReviewBody(
  client: ReturnType<typeof dbService.getClientById>,
  campaignId?: string
): string {
  if (!client) {
    return `<div class="card"><p class="empty-state">Sin cliente vinculado.</p></div>`;
  }
  const clientId = client.id;
  const allContents = dbService.getContentForClient(clientId, campaignId);
  const contents = allContents.filter((item) => item.status === 'CLIENT_REVIEW' || item.status === 'CHANGES_REQUESTED');
  const approved = allContents.filter((item) => item.status === 'READY' || item.status === 'PUBLISHED');
  const camp = campaignId ? dbService.getCampaignById(campaignId) : null;

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Pendiente de tu revisión</h3>
          <p>
            ${camp ? `Filtrado por campaña: <strong>${esc(camp.name)}</strong>.` : 'Edita el borrador en tu voz, aprueba o rechaza con un motivo claro.'}
          </p>
        </div>
      </div>
      <div class="content-stack">
        ${contents.length
          ? contents.map((item) => renderContentRow(item, true)).join('')
          : '<p class="empty-state">No hay contenido esperando tu revisión.</p>'}
      </div>
    </div>

    <details class="card disclosure"${contents.length ? '' : ' open'}>
      <summary>Contenido aprobado y publicado (${approved.length})</summary>
      <div class="disclosure-body content-stack">
        ${approved.length
          ? approved.map((item) => renderContentRow(item, false)).join('')
          : '<p class="empty-state">Tu archivo aparecerá aquí cuando haya contenido aprobado.</p>'}
      </div>
    </details>
  `;
}

function renderContentRow(item: ReturnType<typeof dbService.getContentByClient>[number], showReviewActions: boolean): string {
  return `
    <div class="task-surface">
      <div class="row-between">
        <div>
          <div class="cluster">
            <h4>${esc(item.title)}</h4>
            <span class="badge ${item.status === 'READY' || item.status === 'PUBLISHED' ? 'badge-ready' : 'badge-progress'}">${esc(item.status)}</span>
          </div>
          <p class="operational-row-meta">
            Plataforma: <strong>${esc(item.targetPlatform)}</strong> · Formato: ${esc(item.type)}
          </p>
        </div>
        <div class="row-actions">
          ${showReviewActions && item.status === 'CLIENT_REVIEW' ? `
            <button class="btn btn-primary btn-sm btn-open-article-review" data-content-id="${esc(item.id)}">Editar</button>
            <button class="btn btn-success btn-sm btn-client-approve-content" data-content-id="${esc(item.id)}">Aprobar</button>
            <button class="btn btn-secondary btn-sm btn-request-content-changes" data-content-id="${esc(item.id)}">Rechazar</button>
          ` : ''}
          <button class="btn btn-secondary btn-sm btn-preview-content" data-content-id="${esc(item.id)}">Ver</button>
        </div>
      </div>
    </div>
  `;
}

function renderClientLibraryBody(
  client: ReturnType<typeof dbService.getClientById>,
  campaignId?: string
): string {
  if (!client) {
    return `<div class="card"><p class="empty-state">Sin cliente vinculado.</p></div>`;
  }
  const clientId = client.id;
  const contents = dbService
    .getContentForClient(clientId, campaignId)
    .filter((item) => item.status === 'READY' || item.status === 'PUBLISHED');
  const camp = campaignId ? dbService.getCampaignById(campaignId) : null;

  return `
    <div style="display: flex; flex-direction: column; gap: 2rem; width: 100%;">
      ${camp
        ? `<div class="info-strip"><span>Biblioteca filtrada: <strong>${esc(camp.name)}</strong></span></div>`
        : ''}
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Biblioteca de Publicaciones & Contenido Aprobado</h3>
            <p style="font-size: 0.9rem;">Historial acumulado de autoridad, videos y artículos listos o publicados.</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${contents.length
            ? contents.map((item) => renderContentRow(item, false)).join('')
            : '<p class="empty-state">Tu biblioteca aparecerá aquí cuando haya contenido listo o publicado.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderClientResultsBody(client: ReturnType<typeof dbService.getClientById>): string {
  if (!client) {
    return `<div class="card"><p class="empty-state">Sin cliente vinculado.</p></div>`;
  }
  const results = dbService.getResultsByClient(client.id);
  const kpiOptions = Object.entries(KPI_LABELS)
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join('');

  return `
    <div class="card" style="width:100%;">
      <div class="card-header">
        <div>
          <h3>Resultados</h3>
          <p>Registra métricas de una publicación o conferencia. Puedes pasarlas al Evidence Vault.</p>
        </div>
      </div>
      <form id="form-add-result" data-client-id="${client?.id || ''}">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Título</label>
            <input class="form-input" id="result-title" required placeholder="Video LinkedIn: carga de la prueba" />
          </div>
          <div class="form-group">
            <label class="form-label">Canal</label>
            <input class="form-input" id="result-channel" required placeholder="LinkedIn" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Tipo KPI (plan §11.3)</label>
            <select class="form-select" id="result-kpi-type">${kpiOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Métrica</label>
            <input class="form-input" id="result-metric-label" value="Impresiones" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Valor</label>
          <input class="form-input" type="number" id="result-metric-value" value="0" />
        </div>
        <button class="btn btn-primary" type="submit">Registrar resultado</button>
      </form>
      <div style="margin-top:1.25rem;">
        ${results.map((r) => `
          <div class="card" style="margin-bottom:0.75rem;">
            <strong>${esc(r.title)}</strong> · ${esc(r.channel)}
            ${r.kpiType ? `<span class="badge badge-neutral">${esc(kpiLabel(r.kpiType))}</span>` : ''}
            · ${esc(r.metricLabel)}: ${r.metricValue}
            ${r.addedToEvidence ? '<span class="badge badge-ready">En vault</span>' : `<button class="btn btn-secondary btn-sm btn-result-to-evidence" data-result-id="${esc(r.id)}">Añadir al vault</button>`}
          </div>
        `).join('') || '<p class="form-label">Aún no hay resultados.</p>'}
      </div>
    </div>
  `;
}


