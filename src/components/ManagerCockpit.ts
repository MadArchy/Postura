import { dbService } from '../services/db';
import { aiService } from '../services/ai';
import { Client, ClientPortfolioSummary, ContentItem, PositioningThesis } from '../types';
import { suggestScientificFoci } from '../domain/scientificFocusCore';
import { esc } from '../lib/escape';
import { aggregatePortfolioRadarMetrics } from '../services/portfolioMetrics';
import { buildPortfolioDigest } from '../domain/radarDigestCore';
import { getEmailStubLog } from '../services/reminders';
import {
  availablePipelineActions,
  PIPELINE_ACTION_LABELS,
  pipelineStatusLabel,
} from '../domain/contentPublishCore';

/**
 * Phase-6 ManagerCockpit PageHeader cutover (`client-portfolio-page-header`):
 * leftover `renderPage` header is omitted from `renderManagerCockpit`.
 * ReactManagerCockpitPage serves ReactTabHeader. Body and `.page-content` remain.
 */
function managerPage(body: string): string {
  return `
    <div class="page-content">
      ${body}
    </div>
  `;
}

export function renderManagerCockpit(
  activeTab: string,
  filters: { searchQuery?: string; sourceType?: string; contentStatus?: string } = {}
): string {
  switch (activeTab) {
    case 'clients':
      return managerPage(renderClientsBody(filters));
    case 'ai-center':
      return managerPage(renderAICenterBody());
    case 'dashboard':
    default:
      return managerPage(renderPortfolioBody(filters));
  }
}

// ==========================================
// Nivel 1: cartera
// ==========================================

function attentionLevel(score: number): { label: string; cls: string } {
  if (score >= 45) return { label: 'Requiere acción', cls: 'attention-high' };
  if (score >= 20) return { label: 'Revisar pronto', cls: 'attention-medium' };
  if (score > 0) return { label: 'Menor', cls: 'attention-low' };
  return { label: 'Al día', cls: 'attention-ok' };
}

function portfolioPrimaryAction(summary: ClientPortfolioSummary): { tab: string; label: string } {
  if (summary.unreviewedSignals > 0) return { tab: 'ws-radar', label: 'Abrir radar' };
  if (summary.pendingCuration > 0 || summary.draftDeliveries > 0) return { tab: 'ws-deliver', label: 'Continuar entrega' };
  if (summary.contentAwaitingManager > 0) return { tab: 'ws-production', label: 'Revisar producción' };
  if (summary.sourcesInError > 0) return { tab: 'ws-sources', label: 'Revisar fuentes' };
  return { tab: 'ws-briefing', label: 'Ver resumen' };
}

/** Fila compacta para la cola de Hoy — sin métricas ni cards anidadas. */
function renderPortfolioQueueRow(summary: ClientPortfolioSummary): string {
  const { client } = summary;
  const level = attentionLevel(summary.attentionScore);
  const action = portfolioPrimaryAction(summary);
  const reason = summary.attentionReasons[0] || 'Revisar estado general del cliente';
  const signals = summary.unreviewedSignals;
  const delivery = summary.pendingCuration + summary.draftDeliveries;

  return `
    <article class="portfolio-queue-row ${level.cls}">
      <div class="portfolio-queue-copy">
        <div class="portfolio-queue-title">
          <strong>${esc(client.displayName)}</strong>
          <span class="attention-tag">${level.label}</span>
        </div>
        <p class="portfolio-queue-reason">${esc(reason)}</p>
        <p class="muted small portfolio-queue-meta">
          ${signals ? `${signals} señal${signals === 1 ? '' : 'es'} · ` : ''}${delivery ? `${delivery} en entrega · ` : ''}${esc(client.profession || 'Sin profesión')}
        </p>
      </div>
      <button type="button" class="btn btn-primary btn-sm btn-enter-client" data-client-id="${esc(client.id)}" data-tab="${esc(action.tab)}">
        ${esc(action.label)}
      </button>
    </article>
  `;
}

function renderPortfolioBody(filters: { searchQuery?: string } = {}): string {
  const summaries = dbService.getPortfolioSummary();
  const query = (filters.searchQuery || '').toLowerCase();
  const filtered = query
    ? summaries.filter(
        (s) =>
          s.client.displayName.toLowerCase().includes(query) ||
          (s.client.profession || '').toLowerCase().includes(query)
      )
    : summaries;

  const totals = summaries.reduce(
    (acc, s) => ({
      signals: acc.signals + s.unreviewedSignals,
      curation: acc.curation + s.pendingCuration,
      content: acc.content + s.contentAwaitingManager,
      overdue: acc.overdue + s.overdueTasks,
      drafts: acc.drafts + s.draftDeliveries,
    }),
    { signals: 0, curation: 0, content: 0, overdue: 0, drafts: 0 }
  );

  const queue = (query ? filtered : summaries.filter((s) => s.attentionScore > 0))
    .slice()
    .sort((a, b) => b.attentionScore - a.attentionScore);
  const radar = aggregatePortfolioRadarMetrics();
  const digest = buildPortfolioDigest(
    summaries.map((s) => s.client),
    (clientId) => dbService.getSignalsByClient(clientId),
    dbService.getSignalOutcomes()
  );
  const digestPreview = digest.topItems.slice(0, 3);

  return `
    <section class="today-hero editorial-panel">
      <p class="section-kicker">Estado de la cartera</p>
      <p class="today-hero-lead measure">
        ${queue.length
          ? `${queue.length} cliente${queue.length === 1 ? '' : 's'} requieren una decisión ahora.`
          : 'Nada urgente en la cartera. Revisa el radar o prepara la próxima entrega cuando quieras.'}
      </p>
      <p class="today-hero-stats muted small">
        ${totals.signals} señales por decidir · ${totals.curation} preparando entrega · ${totals.content} contenido por revisar
        ${totals.overdue ? ` · ${totals.overdue} tarea(s) vencida(s)` : ''}
      </p>
      ${!aiService.isServerGatewayAvailable()
        ? `<p class="today-note muted small">IA en modo local (scoring heurístico). <button type="button" class="link-btn" data-tab="ai-center">Ver estado del Gateway</button></p>`
        : ''}
    </section>

    <section class="card today-queue">
      <div class="section-heading">
        <div class="section-heading-copy">
          <h2>Cola de atención</h2>
          <p>Entra directo al paso que desbloquea cada cliente.</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-tab="clients">Ver cartera completa</button>
      </div>

      <div class="filter-bar today-search">
        <div class="search-input-group">
          <input type="text" id="input-search-portfolio" placeholder="Buscar cliente…" value="${esc(filters.searchQuery || '')}" />
        </div>
      </div>

      <div class="portfolio-queue-list">
        ${queue.length
          ? queue.map(renderPortfolioQueueRow).join('')
          : query
            ? '<p class="empty-state">No hay clientes que coincidan con la búsqueda.</p>'
            : '<p class="empty-state">Toda la cartera está al día. Usa Clientes para administración o entra a un cliente para avanzar trabajo.</p>'}
      </div>
    </section>

    ${digestPreview.length
      ? `<details class="card disclosure">
           <summary>Señales destacadas del radar (${digestPreview.length})</summary>
           <div class="disclosure-body">
             <p class="muted small measure">${esc(digest.periodLabel)} · ${digest.decideNowTotal} por decidir ahora</p>
             <div class="operational-list">
               ${digestPreview
                 .map(
                   (item) => `
                 <div class="operational-row">
                   <div class="operational-row-main">
                     <p class="operational-row-title">${esc(item.title)}</p>
                     <p class="operational-row-meta">${esc(item.clientName)} · ${esc(item.sourceName)}${item.score !== undefined ? ` · score ${item.score}` : ''}</p>
                   </div>
                   <button type="button" class="btn btn-secondary btn-sm btn-enter-client" data-client-id="${esc(item.clientId)}" data-tab="ws-radar">Radar</button>
                 </div>`
                 )
                 .join('')}
             </div>
           </div>
         </details>`
      : ''}

    <details class="card disclosure">
      <summary>Métricas y salud del sistema</summary>
      <div class="disclosure-body content-stack">
        <div class="metric-band metric-band-compact">
          <div class="metric-band-item"><span class="metric-band-label">Decidir ahora</span><strong class="metric-band-value">${digest.decideNowTotal}</strong></div>
          <div class="metric-band-item"><span class="metric-band-label">Convertidas · 7 d</span><strong class="metric-band-value">${digest.converted7d}</strong></div>
          <div class="metric-band-item"><span class="metric-band-label">Tasa útil</span><strong class="metric-band-value">${digest.usefulRate !== null ? `${digest.usefulRate}%` : '—'}</strong></div>
          <div class="metric-band-item"><span class="metric-band-label">Fuentes en error</span><strong class="metric-band-value">${radar.sourcesInError}</strong></div>
        </div>
        <p class="muted small">Ingesta: ${radar.ingestAccepted7d} aceptadas · ${radar.signalsCreated7d} señales nuevas (7 d) · ${radar.researchPending} investigación pendiente</p>
      </div>
    </details>
  `;
}

/** Fila del directorio Clientes — métricas reales del agregado de cartera. */
function renderClientDirectoryRow(summary: ClientPortfolioSummary): string {
  const { client } = summary;
  const level = attentionLevel(summary.attentionScore);
  const action = portfolioPrimaryAction(summary);
  const lastDelivery = summary.lastDeliveryAt
    ? new Date(summary.lastDeliveryAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'sin entregas';
  // ALLOWED_PRESENTATION_ONLY — directory chip label; does not persist or route.
  const thesis = dbService.getActiveTheses(client.id)[0];
  const statusNote =
    client.onboardingStatus !== 'COMPLETED'
      ? 'Onboarding en curso'
      : summary.attentionReasons[0] || 'Al día';

  return `
    <article class="portfolio-queue-row client-directory-row ${summary.attentionScore > 0 ? level.cls : 'attention-ok'}">
      <div class="portfolio-queue-copy">
        <div class="portfolio-queue-title">
          <strong>${esc(client.displayName)}</strong>
          <span class="badge ${client.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}">${esc(client.status)}</span>
          ${summary.attentionScore > 0 ? `<span class="attention-tag">${level.label}</span>` : ''}
        </div>
        <p class="portfolio-queue-reason">${esc(client.profession || 'Sin profesión')}${client.company ? ` · ${esc(client.company)}` : ''}</p>
        <p class="muted small portfolio-queue-meta">
          ${summary.unreviewedSignals} señal${summary.unreviewedSignals === 1 ? '' : 'es'} sin revisar ·
          ${summary.openTasks} tarea${summary.openTasks === 1 ? '' : 's'} abierta${summary.openTasks === 1 ? '' : 's'} ·
          ${summary.activeSources} fuente${summary.activeSources === 1 ? '' : 's'} ·
          última entrega ${esc(lastDelivery)}
        </p>
        <p class="muted small client-directory-note">${esc(statusNote)}${thesis ? ` · Tesis: ${esc(thesis.title)}` : ' · Sin tesis activa'}</p>
      </div>
      <div class="client-directory-actions">
        <button type="button" class="btn btn-ghost btn-sm btn-login-as-client" data-client-id="${esc(client.id)}">Ver como cliente</button>
        <button type="button" class="btn btn-primary btn-sm btn-enter-client" data-client-id="${esc(client.id)}" data-tab="${esc(action.tab)}">
          ${esc(action.label)}
        </button>
      </div>
    </article>
  `;
}

function renderClientsBody(filters: { searchQuery?: string } = {}): string {
  const summaries = dbService.getPortfolioSummary();
  const subscription = dbService.getSubscription();
  const query = (filters.searchQuery || '').toLowerCase();
  const filtered = query
    ? summaries.filter(
        (s) =>
          s.client.displayName.toLowerCase().includes(query) ||
          (s.client.profession || '').toLowerCase().includes(query) ||
          (s.client.company || '').toLowerCase().includes(query)
      )
    : summaries;

  const activeTheses = summaries.reduce(
    (acc, s) => acc + dbService.getActiveTheses(s.client.id).length,
    0
  );
  const completedTasks = summaries.reduce(
    (acc, s) => acc + dbService.getTasksByClient(s.client.id).filter((t) => t.status === 'COMPLETED').length,
    0
  );
  const openTasks = summaries.reduce((acc, s) => acc + s.openTasks, 0);
  const needsAttention = summaries.filter((s) => s.attentionScore > 0).length;

  return `
    <section class="today-hero editorial-panel">
      <p class="section-kicker">Directorio</p>
      <p class="today-hero-lead measure">
        ${summaries.length} cliente${summaries.length === 1 ? '' : 's'} en cartera
        ${needsAttention ? ` · ${needsAttention} con pendientes abiertos` : ' · todos al día'}.
      </p>
      <p class="today-hero-stats muted small">
        ${activeTheses} tesis activa${activeTheses === 1 ? '' : 's'} · ${openTasks} tarea${openTasks === 1 ? '' : 's'} abierta${openTasks === 1 ? '' : 's'} · ${completedTasks} completada${completedTasks === 1 ? '' : 's'}
      </p>
    </section>

    <section class="card today-queue">
      <div class="section-heading">
        <div class="section-heading-copy">
          <h2>Cartera</h2>
          <p>Ordenada por urgencia operativa. Los números vienen de señales, tareas y entregas reales.</p>
        </div>
      </div>

      <div class="filter-bar today-search">
        <div class="search-input-group">
          <input type="text" id="input-search-portfolio" placeholder="Buscar por nombre, profesión o empresa…" value="${esc(filters.searchQuery || '')}" />
        </div>
      </div>

      <div class="portfolio-queue-list">
        ${filtered.length
          ? filtered.map(renderClientDirectoryRow).join('')
          : '<p class="empty-state">No hay clientes que coincidan con la búsqueda.</p>'}
      </div>
    </section>

    <details class="card disclosure">
      <summary>Plan y uso (${esc(subscription.tier)})</summary>
      <div class="disclosure-body content-stack">
        <div class="metric-band metric-band-compact">
          <div class="metric-band-item">
            <span class="metric-band-label">Cupos de clientes</span>
            <strong class="metric-band-value">${summaries.length} / ${subscription.quotas.maxClients}</strong>
          </div>
          <div class="metric-band-item">
            <span class="metric-band-label">Corridas IA (mes)</span>
            <strong class="metric-band-value">${subscription.monthlyUsage.aiRuns} / ${subscription.quotas.maxMonthlyAiRuns}</strong>
          </div>
          <div class="metric-band-item">
            <span class="metric-band-label">Señales sin revisar</span>
            <strong class="metric-band-value">${summaries.reduce((acc, s) => acc + s.unreviewedSignals, 0)}</strong>
          </div>
          <div class="metric-band-item">
            <span class="metric-band-label">Fuentes en error</span>
            <strong class="metric-band-value">${summaries.reduce((acc, s) => acc + s.sourcesInError, 0)}</strong>
          </div>
        </div>
      </div>
    </details>
  `;
}

export function renderScientificFocusPanel(client: Client, thesis?: PositioningThesis): string {
  const foci = suggestScientificFoci({
    client,
    thesis,
    signals: dbService.getSignalsByClient(client.id),
    evidence: dbService.getEvidenceVaultByClient(client.id),
    limit: 5,
  });

  return `
    <details class="card disclosure sci-focus-panel">
      <summary>Crear artículo científico desde inteligencia validada</summary>
      <div class="disclosure-body">
        <p class="muted small measure">Sugerencias según el rol (${esc(client.profession || thesis?.expertIdentity || 'profesional')}) y la información de mayor valor en Radar y Evidence Vault.</p>
      ${
        foci.length
          ? `<div class="sci-focus-list">
        ${foci
          .map(
            (f) => `
          <article class="sci-focus-item">
            <div>
              <h4>${esc(f.title)}</h4>
              <p class="muted small">${esc(f.why)}</p>
              <div class="task-meta-badges">
                <span class="badge badge-ready">${esc(f.venueLabel)}</span>
                <span class="badge badge-neutral">score ${f.score}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm btn-generate-scientific-article"
              data-client-id="${esc(client.id)}"
              data-sci-title="${esc(f.title)}"
              data-sci-why="${esc(f.why)}"
              data-sci-venue="${esc(f.venueLabel)}"
              data-sci-role="${esc(f.roleAngle)}"
            >Redactar paper</button>
          </article>`
          )
          .join('')}
      </div>`
          : '<p class="empty-state">Aún no hay señales o evidencia de suficiente peso. Ingesta radar o vault primero; luego el sistema propondrá ejes.</p>'
      }
      </div>
    </details>
  `;
}

// ==========================================
// Pipeline editorial (compartido con el workspace)
// Phase-6 workspace production ClaimSafety cutover
// (`client-workspace-production-claim-safety`): leftover badge and
// disclosure are omitted. React ProductionPanel serves the advisory
// presentation. This does not claim content preview, content editor,
// or ClaimSafetyPanel.ts.
// ==========================================

export function renderContentPipeline(
  contents: ContentItem[],
  filters: { searchQuery?: string; contentStatus?: string } = {},
  options: { showCreate?: boolean; clientId?: string } = {}
): string {
  const searchQ = (filters.searchQuery || '').toLowerCase();
  const currentStatusFilter = filters.contentStatus || 'ALL';

  const filtered = contents.filter((c) => {
    const matchesSearch = !searchQ || c.title.toLowerCase().includes(searchQ) || c.body.toLowerCase().includes(searchQ);
    const matchesStatus = currentStatusFilter === 'ALL' || c.status === currentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusHint = (status: ContentItem['status']): string => {
    switch (status) {
      case 'CLIENT_REVIEW': return 'Esperando al cliente';
      case 'CHANGES_REQUESTED': return 'El cliente pidió ajustes';
      case 'READY': return 'Listo para publicar';
      case 'PUBLISHED': return 'Publicado';
      case 'AI_GENERATED': return 'Generado por IA, revisa antes de enviar';
      default: return 'En preparación';
    }
  };

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Pipeline editorial</h3>
          <p>Revisa y edita antes de que el material llegue al portal del cliente.</p>
        </div>
        ${options.showCreate
          ? `<button type="button" id="btn-generate-article" class="btn btn-primary btn-open-generate-content" data-client-id="${esc(options.clientId || '')}">+ Nuevo contenido</button>`
          : ''}
      </div>

      <div class="filter-bar">
        <div class="search-input-group">
          <input type="text" id="input-search-content" placeholder="Buscar por título o fragmento..." value="${esc(filters.searchQuery || '')}" />
        </div>
        <div class="filter-pills">
          <button type="button" class="filter-pill ${currentStatusFilter === 'ALL' ? 'active' : ''}" data-content-filter="ALL">Todos (${contents.length})</button>
          <button type="button" class="filter-pill ${currentStatusFilter === 'AI_GENERATED' ? 'active' : ''}" data-content-filter="AI_GENERATED">Por revisar</button>
          <button type="button" class="filter-pill ${currentStatusFilter === 'CLIENT_REVIEW' ? 'active' : ''}" data-content-filter="CLIENT_REVIEW">Con el cliente</button>
          <button type="button" class="filter-pill ${currentStatusFilter === 'CHANGES_REQUESTED' ? 'active' : ''}" data-content-filter="CHANGES_REQUESTED">Ajustes pedidos</button>
          <button type="button" class="filter-pill ${currentStatusFilter === 'READY' ? 'active' : ''}" data-content-filter="READY">Listo</button>
        </div>
      </div>

      <div class="content-stack">
        ${filtered.length
          ? filtered.map((item) => {
            const clientEdit = dbService.getLatestClientEdit(item.id);
            const feedbackEvents = dbService.getFeedbackEventsForContent(item.id);
            const showFeedback = feedbackEvents.length > 0;
            const pipelineActions = availablePipelineActions(item);
            return `
            <div class="card content-row status-${esc(item.status.toLowerCase())}">
              <div class="content-row-head">
                <div>
                  <div class="content-row-title">
                    <h4>${esc(item.title)}</h4>
                    <span class="badge ${item.status === 'READY' || item.status === 'PUBLISHED' ? 'badge-ready' : item.status === 'CHANGES_REQUESTED' ? 'badge-pending' : 'badge-progress'}">${esc(item.status)}</span>
                    <span class="badge badge-neutral" title="Pipeline canónico">${esc(pipelineStatusLabel(item))}</span>
                    <span class="badge badge-progress">${esc(item.targetPlatform)}</span>
                    ${clientEdit?.diffSummary
                      ? `<span class="badge badge-ready">Cliente editó (+${clientEdit.diffSummary.added}/−${clientEdit.diffSummary.removed})</span>`
                      : ''}
                  </div>
                  <p class="content-row-meta">
                    ${esc(item.type)} · creado ${new Date(item.createdAt).toLocaleDateString('es')}
                  </p>
                </div>
                <div class="row-actions">
                  ${pipelineActions.map((action) => `
                    <button
                      type="button"
                      class="btn btn-sm ${action === 'publish' ? 'btn-success' : 'btn-primary'} btn-content-pipeline-action"
                      data-content-id="${esc(item.id)}"
                      data-pipeline-action="${esc(action)}"
                    >${esc(PIPELINE_ACTION_LABELS[action])}</button>
                  `).join('')}
                  ${showFeedback
                    ? `<button class="btn btn-primary btn-sm btn-view-content-diff" data-content-id="${esc(item.id)}">${clientEdit ? 'Ver diff' : 'Ver feedback'}</button>`
                    : ''}
                  <button class="btn btn-secondary btn-sm btn-open-content-editor" data-content-id="${esc(item.id)}">Editar</button>
                  <button class="btn btn-secondary btn-sm btn-preview-content" data-content-id="${esc(item.id)}">Ver</button>
                </div>
              </div>

              <div class="content-preview">${esc(item.body.substring(0, 280))}…</div>

              <div class="content-row-foot">
                <span>Notas: ${esc(item.managerNotes || 'sin notas')}</span>
                <span class="content-status-hint">${statusHint(item.status)}</span>
              </div>
            </div>
          `;
          }).join('')
          : '<p class="empty-state">No hay contenido con los filtros actuales.</p>'}
      </div>
    </div>
  `;
}

// ==========================================
// Configuración de la organización
// ==========================================

function renderAICenterBody(): string {
  const gatewayReady = aiService.isServerGatewayAvailable();
  const subscription = dbService.getSubscription();
  const aiRuns = dbService.getAiRuns(10);

  const tokensPercent = Math.min(100, Math.round((subscription.monthlyUsage.tokensUsed / 100000) * 100));
  const runsPercent = Math.min(100, Math.round((subscription.monthlyUsage.aiRuns / subscription.quotas.maxMonthlyAiRuns) * 100));

  return `
    <section class="grid-3">
      <div class="card stat-card">
        <p class="form-label">Corridas del mes</p>
        <h2>${subscription.monthlyUsage.aiRuns} <span class="stat-of">/ ${subscription.quotas.maxMonthlyAiRuns}</span></h2>
        <div class="progress-track"><div class="progress-fill" style="width: ${runsPercent}%"></div></div>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tokens procesados</p>
        <h2>${(subscription.monthlyUsage.tokensUsed / 1000).toFixed(1)}k <span class="stat-of">/ 100k</span></h2>
        <div class="progress-track"><div class="progress-fill progress-cyan" style="width: ${tokensPercent}%"></div></div>
      </div>
      <div class="card stat-card">
        <p class="form-label">Estado del Gateway</p>
        <h2>${gatewayReady ? 'Gateway' : 'Local'}</h2>
        <span class="stat-hint">${gatewayReady
          ? 'ADMIN + Firebase → aiComplete (sin claves en el navegador)'
          : 'Sin Gateway: scoring/heurísticas locales'}</span>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Enrutamiento de modelos</h3>
          <p style="font-size: 0.9rem;">Los proveedores y modelos los resuelve el servidor (ModelRegistry). El navegador no envía claves ni IDs de modelo.</p>
        </div>
      </div>
      <ul class="policy-list">
        <li>Operaciones LLM: Content, Tesis, Señales, Advisor y Comparativo (OpenAI + Anthropic) vía AI Gateway.</li>
        <li>Credenciales: solo Secret Manager en el servidor (<code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code>).</li>
        <li>Local: <code>/api/ai/gateway-complete</code> → mismo Gateway. Producción: Cloud Function <code>aiComplete</code>.</li>
        <li>Las claves de proveedor en el navegador fueron eliminadas (SPEC-005 Phase 5D).</li>
      </ul>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Corridas recientes</h3>
          <p style="font-size: 0.9rem;">Agente, proveedor, tokens y latencia de cada llamada (registro local histórico).</p>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Hora</th><th>Agente</th><th>Proveedor</th><th>Tokens</th><th>Latencia</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${aiRuns.length
              ? aiRuns.map((run) => `
                <tr>
                  <td class="mono">${new Date(run.createdAt).toLocaleTimeString('es')}</td>
                  <td><strong>${esc(run.agent)}</strong></td>
                  <td>${esc(run.provider)} <span class="muted">(${esc(run.modelName)})</span></td>
                  <td class="mono">${run.promptTokens + run.completionTokens}</td>
                  <td class="mono">${run.latencyMs}ms</td>
                  <td><span class="badge ${run.status === 'SUCCESS' ? 'badge-ready' : 'badge-pending'}">${esc(run.status)}</span></td>
                </tr>
              `).join('')
              : '<tr><td colspan="6" class="empty-cell">Sin corridas registradas todavía.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    ${(() => {
      const emails = getEmailStubLog().slice(0, 8);
      if (!emails.length) return '';
      return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Recordatorios (email stub)</h3>
          <p class="muted small">Oleada 6.4 — avisos que se enviarían por correo; aquí solo log local.</p>
        </div>
      </div>
      <ul class="policy-list email-stub-log">
        ${emails.map((entry) => `
          <li>
            <strong>${esc(entry.subject)}</strong>
            <span class="muted small"> → ${esc(entry.to)} · ${new Date(entry.createdAt).toLocaleString('es')}</span>
            <p class="muted small">${esc(entry.body)}</p>
          </li>
        `).join('')}
      </ul>
    </section>`;
    })()}
  `;
}