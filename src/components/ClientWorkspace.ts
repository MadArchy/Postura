import { dbService } from '../services/db';
import { getStrategicBrief } from '../services/strategicBriefConsumer';
import { curationDestinationToAuthorizedAction } from '../domain/briefConsumerCore';
import { buildTopics, momentumLabel } from '../services/topics';
import {
  AdviceAction,
  AdviceCategory,
  Client,
  CurationDestination,
  CurationEntry,
  DeliveryPackage,
  EvidenceVaultItem,
  PositioningAdvice,
  PositioningThesis,
  Signal,
  Source,
  Task,
  TaskType,
  Topic,
} from '../types';
import { esc, escAttr } from '../lib/escape';
import {
  getSignalOutcomeForDisplay,
  listSignalOutcomesForDisplay,
} from '../services/learningLoopConsumer';
import { computeThesisLearningMetrics, type ThesisLearningMetrics } from '../domain/thesisMetricsCore';
import { icon } from '../lib/icons';
import { deriveWorkStage, WORK_STAGE_BADGE, WORK_STAGE_LABELS } from '../domain/workPipeline';
import { normalizeTab } from '../ui/presentation/pageTabMeta';
import { renderPage } from './PageHeader';
import { renderContentPipeline, renderScientificFocusPanel } from './ManagerCockpit';
import { buildProfileKeywords, normalizeSourceUrl } from '../services/sourceDiscovery';
import {
  buildCuratedPresetsForProfile,
  detectIndustryPreset,
  getIndustryPresetMeta,
  getRecommendedStackForClient,
} from '../services/industryPresets';
import { runSourceDiscoveryAgent, isAgentRunCurrent, loadLastAgentRun } from '../services/sourceDiscoveryAgent';
import { ingestProxyReady } from '../services/sourceApi';
import { pendingExtendedSources } from '../services/extendedSourceDiscovery';
import { signalsNeedingResearch } from '../services/researchSignalsAgent';
import { groupSignalsForTriage } from '../domain/radarTriageCore';
import {
  canonicalSignalsFromClusters,
  clusterForSignal,
  clusterSimilarSignals,
  type SignalCluster,
} from '../domain/signalClusterCore';
import {
  AUDIENCE_TIER_LABELS,
  OBJECTIVE_KIND_LABELS,
  VOICE_DIMENSION_LABELS,
  audiencesByTier,
  normalizeThesis,
  thesisCompleteness,
  validateWeights,
  type NormalizedThesis,
  type ThesisCompleteness,
} from '../domain/thesisModelCore';
import {
  computePositioningGap,
  computeThesisStrength,
  evidenceAuthority,
  type AuthorityBand,
  type PositioningGap,
  type ThesisStrength,
} from '../domain/thesisStrengthCore';
import { summarizeSourceHealth } from '../services/sourceHealth';
import {
  countUnhealthySources,
  sourceHealthTip,
  sourceRemediationActions,
} from '../domain/sourceHealthActionsCore';
import { labelSourceRunError } from '../domain/sourceIngestCore';
import { deliveryItemKindLabel, deliveryStatusLabel } from '../domain/deliveryCore';
import { isPlayableRecordingRef } from '../services/recordings';
import { signalsAwaitingOutcome, computeConversionStats } from '../domain/radarFeedbackCore';
import { renderProofWall, renderServiceLinesReadOnly } from './ProofWallPanel';
import { renderKpiSummaryTiles, renderKpiWeeklyChart } from './KpiWeeklyChart';
import { getLatestTopicAgentRun } from '../services/topicAgent';
import { canActivateThesis } from '../domain/thesisRevisionCore';

export interface WorkspaceFilters {
  searchQuery?: string;
  sourceType?: string;
  contentStatus?: string;
  priorityBand?: string;
  topicKey?: string;
  /** Lista clásica vs columnas de triage. */
  radarView?: 'list' | 'triage';
  /** Tesis seleccionada en Identidad. */
  thesisId?: string;
}

const DESTINATION_LABELS: Record<CurationDestination, string> = {
  TASK_VIDEO: 'Tarea: grabar video',
  TASK_ARTICLE: 'Tarea: revisar artículo',
  OPPORTUNITY: 'Oportunidad de escenario',
  REFERENCE_READING: 'Lectura de referencia',
  EVIDENCE: 'Guardar como evidencia',
  DISCARD: 'Descartado',
};

const CATEGORY_LABELS: Record<AdviceCategory, string> = {
  CONTENT: 'Contenido',
  CREDENTIAL: 'Credenciales',
  VISIBILITY: 'Visibilidad',
  EVIDENCE: 'Evidencia',
  NETWORK: 'Red de contactos',
  RISK: 'Riesgo',
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  RECORD_VIDEO: 'Grabar video',
  REVIEW_ARTICLE: 'Revisar artículo',
  APPROVE_OPPORTUNITY: 'Aprobar oportunidad',
  SUBMIT_INFO: 'Enviar información',
};

const TASK_STATUS_LABELS: Record<Task['status'], string> = {
  DRAFT: 'Borrador',
  ASSIGNED: 'Asignada',
  VIEWED: 'Vista',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const HORIZON_LABELS: Record<'DAYS_30' | 'DAYS_60' | 'DAYS_90', string> = {
  DAYS_30: '30 días',
  DAYS_60: '60 días',
  DAYS_90: '90 días',
};

export function renderClientWorkspace(
  activeTab: string,
  clientId: string,
  filters: WorkspaceFilters = {}
): string {
  const client = dbService.getClientById(clientId);
  if (!client) {
    return renderPage('ws-briefing', '<p class="empty-state">Cliente no encontrado. Vuelve a la cartera.</p>');
  }

  const theses = dbService.getThesesByClient(clientId);
  const thesis = dbService.resolveThesisFor({
    clientId,
    selectedThesisId: filters.thesisId,
  });
  const thesisBar = renderThesisContextBar(clientId, theses, filters.thesisId);

  switch (normalizeTab(activeTab)) {
    case 'ws-sources':
      return renderPage(
        'ws-sources',
        `${thesisBar}${renderSources(client, thesis)}`,
        `<button id="btn-poll-all-sources" class="btn btn-secondary">Ingerir todas</button>
         <button id="btn-open-source-registry" class="btn btn-secondary" data-client-id="${esc(clientId)}">+ Nueva fuente</button>
         <button id="btn-add-manual-signal" class="btn btn-primary" data-client-id="${esc(clientId)}">+ Señal manual</button>`
      );
    case 'ws-tasks':
      return renderPage(
        'ws-tasks',
        `${thesisBar}${renderTasks(client, filters)}`,
        `<button id="btn-open-add-task" class="btn btn-primary" data-client-id="${esc(clientId)}">+ Asignar tarea</button>`
      );
    case 'ws-radar':
      return renderPage(
        'ws-radar',
        `${thesisBar}${renderRadar(client, thesis, filters)}`,
        `<button class="btn btn-ghost" data-tab="ws-sources">Gestionar fuentes</button>
         <button id="btn-add-manual-signal" class="btn btn-secondary" data-client-id="${esc(clientId)}">+ Señal manual</button>
         <button id="btn-poll-all-sources" class="btn btn-primary">Buscar novedades</button>`
      );
    case 'ws-deliver':
      return renderPage('ws-deliver', `${thesisBar}${renderDeliver(client, thesis)}`);
    case 'ws-positioning':
      return renderPage(
        'ws-positioning',
        renderPositioning(client, theses, filters),
        `<button class="btn btn-primary btn-open-thesis-editor" data-client-id="${esc(clientId)}">Nueva tesis</button>`
      );
    case 'ws-production':
      return renderPage(
        'ws-production',
        `<div class="content-stack content-stack-lg">
           ${thesisBar}
           ${renderProductionOverview(client, filters)}
           ${renderContentPipeline(
             dbService.getContentByClient(clientId).filter((c) => !filters.thesisId || c.thesisId === filters.thesisId),
             filters,
             { showCreate: true, clientId }
           )}
           ${renderScientificFocusPanel(client, thesis)}
           ${renderTasks(client, filters)}
         </div>`,
        `<button id="btn-open-add-task" class="btn btn-secondary" data-client-id="${esc(clientId)}">+ Asignar tarea</button>`
      );
    case 'ws-results':
      return renderPage('ws-results', renderResults(client));
    case 'ws-briefing':
    default:
      return renderPage('ws-briefing', `${thesisBar}${renderBriefing(client, thesis, filters)}`);
  }
}

/** Selector de contexto de tesis compartido entre pestañas del workspace. */
function renderThesisContextBar(
  clientId: string,
  theses: PositioningThesis[],
  selectedId?: string
): string {
  if (theses.length < 2) return '';
  const active = theses.filter((t) => t.status === 'ACTIVE');
  return `
    <div class="thesis-context-bar" role="group" aria-label="Contexto de tesis">
      <span class="thesis-context-label">Trabajando sobre</span>
      <button type="button" class="thesis-context-chip${!selectedId ? ' thesis-context-chip-active' : ''}"
              data-thesis-select="">
        Todas
      </button>
      ${(active.length ? active : theses).map((t) => `
        <button type="button"
                class="thesis-context-chip${selectedId === t.id ? ' thesis-context-chip-active' : ''}"
                data-thesis-select="${esc(t.id)}"
                data-client-id="${esc(clientId)}">
          ${esc(t.title)}
        </button>
      `).join('')}
    </div>
  `;
}

// ==========================================
// Resumen (briefing)
// ==========================================

type BriefingAction = { title: string; detail: string; tab: string; label: string };

function buildBriefingActions(input: {
  thesis: PositioningThesis | undefined;
  portfolio: ReturnType<typeof dbService.getPortfolioSummary>[number] | undefined;
  unreviewed: number;
  pendingCuration: number;
  readyToDeliver: number;
  contentAwaiting: number;
  overdueTasks: number;
  openTasks: number;
}): BriefingAction[] {
  const actions: BriefingAction[] = [];
  const {
    thesis,
    portfolio,
    unreviewed,
    pendingCuration,
    readyToDeliver,
    contentAwaiting,
    overdueTasks,
    openTasks,
  } = input;

  if (!thesis) {
    actions.push({
      title: 'Definir la tesis activa',
      detail: 'Sin tesis el radar no puede puntuar ni filtrar señales.',
      tab: 'ws-positioning',
      label: 'Abrir Identidad',
    });
  }
  if (portfolio?.sourcesInError) {
    actions.push({
      title: `Revisar ${portfolio.sourcesInError} fuente${portfolio.sourcesInError === 1 ? '' : 's'} con error`,
      detail: 'La ingesta está fallando y puede dejar huecos en el radar.',
      tab: 'ws-sources',
      label: 'Revisar fuentes',
    });
  }
  if (unreviewed > 0) {
    actions.push({
      title: `Decidir ${unreviewed} señal${unreviewed === 1 ? '' : 'es'}`,
      detail: 'Prioriza por score y banda de urgencia en el radar.',
      tab: 'ws-radar',
      label: 'Abrir Radar',
    });
  }
  if (pendingCuration > 0 || readyToDeliver > 0) {
    actions.push({
      title: 'Preparar la próxima entrega',
      detail: `${pendingCuration} por decidir · ${readyToDeliver} listas para el briefing.`,
      tab: 'ws-deliver',
      label: 'Continuar entrega',
    });
  }
  if (contentAwaiting > 0) {
    actions.push({
      title: `Revisar ${contentAwaiting} contenido${contentAwaiting === 1 ? '' : 's'}`,
      detail: 'Material esperando tu visto bueno antes de llegar al cliente.',
      tab: 'ws-production',
      label: 'Ver Producción',
    });
  }
  if (overdueTasks > 0) {
    actions.push({
      title: `${overdueTasks} tarea${overdueTasks === 1 ? '' : 's'} vencida${overdueTasks === 1 ? '' : 's'}`,
      detail: 'Comprueba bloqueos y material pendiente de grabación o revisión.',
      tab: 'ws-production',
      label: 'Ver tareas',
    });
  } else if (openTasks > 0) {
    actions.push({
      title: `Dar seguimiento a ${openTasks} tarea${openTasks === 1 ? '' : 's'}`,
      detail: 'Trabajo editorial en curso sin vencimiento crítico.',
      tab: 'ws-production',
      label: 'Ver Producción',
    });
  }

  return actions;
}

function renderAdviceCompact(advice: PositioningAdvice): string {
  const { diagnosis } = advice;
  const dims: Array<[string, number]> = [
    ['Autoridad', diagnosis.authorityScore],
    ['Evidencia', diagnosis.evidenceScore],
    ['Visibilidad', diagnosis.visibilityScore],
  ];

  return `
    <p class="briefing-aside-summary">${esc(advice.summary.slice(0, 140))}${advice.summary.length > 140 ? '…' : ''}</p>
    <div class="briefing-mini-dims">
      ${dims.map(([label, value]) => `
        <div class="briefing-mini-dim">
          <div class="briefing-mini-dim-head"><span>${esc(label)}</span><strong>${value}</strong></div>
          <div class="progress-track progress-track-sm">
            <div class="progress-fill ${value >= 70 ? 'progress-green' : value >= 45 ? '' : 'progress-red'}" style="width: ${value}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBriefing(client: Client, thesis: PositioningThesis | undefined, _filters: WorkspaceFilters): string {
  const clientId = client.id;
  const portfolio = dbService.getPortfolioSummary().find((s) => s.client.id === clientId);
  const signals = dbService.getSignalsByClient(clientId);
  const topics = buildTopics(clientId, signals);
  const unreviewed = signals.filter((s) => s.managerDecision === 'UNREVIEWED' && s.status !== 'DISCARDED');
  const pendingCuration = dbService.getPendingCurationByClient(clientId);
  const readyToDeliver = dbService.getReadyCurationByClient(clientId);
  const tasks = dbService.getTasksByClient(clientId).filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const overdueTasks = tasks.filter((t) => t.deadline && new Date(t.deadline).getTime() < Date.now());
  const contentAwaiting = dbService.getContentByClient(clientId).filter(
    (c) => c.status === 'MANAGER_REVIEW' || c.status === 'CHANGES_REQUESTED' || c.status === 'AI_GENERATED'
  );
  const advice = dbService.getLatestAdvice(clientId);
  const lastDelivery = dbService.getSentDeliveriesByClient(clientId)[0];
  const opportunities = dbService.getOpportunitiesByClient(clientId);
  const topicRun = getLatestTopicAgentRun(clientId);

  const hotTopics = topics.filter((t) => t.momentum === 'RISING' || t.momentum === 'EMERGING').slice(0, 4);
  const nextActions = buildBriefingActions({
    thesis,
    portfolio,
    unreviewed: unreviewed.length,
    pendingCuration: pendingCuration.length,
    readyToDeliver: readyToDeliver.length,
    contentAwaiting: contentAwaiting.length,
    overdueTasks: overdueTasks.length,
    openTasks: tasks.length,
  });
  const focus = nextActions[0];
  const queue = nextActions.slice(1);

  const statusChips: Array<{ label: string; value: number; hot?: boolean; tab: string }> = [
    { label: 'Señales', value: unreviewed.length, hot: unreviewed.length > 0, tab: 'ws-radar' },
    { label: 'En entrega', value: pendingCuration.length, hot: pendingCuration.length > 0, tab: 'ws-deliver' },
    { label: 'Listas', value: readyToDeliver.length, hot: readyToDeliver.length > 0, tab: 'ws-deliver' },
    { label: 'Tareas', value: tasks.length, hot: overdueTasks.length > 0, tab: 'ws-production' },
    { label: 'Fuentes', value: portfolio?.activeSources ?? 0, tab: 'ws-sources' },
  ];
  if (portfolio?.sourcesInError) {
    statusChips.push({
      label: 'Errores',
      value: portfolio.sourcesInError,
      hot: true,
      tab: 'ws-sources',
    });
  }

  return `
    <div class="briefing-cockpit">
      <section class="briefing-hero" aria-label="Siguiente paso">
        ${focus
          ? `<p class="briefing-focus-kicker">Siguiente paso</p>
             <h2 class="briefing-focus-title">${esc(focus.title)}</h2>
             <p class="briefing-focus-detail">${esc(focus.detail)}</p>
             <button type="button" class="btn btn-primary briefing-focus-cta" data-tab="${esc(focus.tab)}">${esc(focus.label)}</button>`
          : `<p class="briefing-focus-kicker">Estado</p>
             <h2 class="briefing-focus-title">Cartera al día</h2>
             <p class="briefing-focus-detail">No hay bloqueos urgentes. Puedes revisar temas emergentes o preparar la próxima entrega cuando quieras.</p>
             <button type="button" class="btn btn-secondary briefing-focus-cta" data-tab="ws-radar">Explorar radar</button>`}
      </section>

      ${queue.length
        ? `<ol class="briefing-queue" aria-label="Cola de acciones">
             ${queue.map((action, index) => `
               <li class="briefing-queue-item">
                 <span class="briefing-queue-num">${index + 2}</span>
                 <div class="briefing-queue-copy">
                   <strong>${esc(action.title)}</strong>
                   <span>${esc(action.detail)}</span>
                 </div>
                 <button type="button" class="btn btn-ghost btn-sm" data-tab="${esc(action.tab)}">${esc(action.label)}</button>
               </li>
             `).join('')}
           </ol>`
        : ''}

      <div class="briefing-metrics" aria-label="Estado operativo">
        ${statusChips.map((chip) => `
          <button type="button" class="briefing-metric${chip.hot ? ' briefing-metric-hot' : ''}" data-tab="${esc(chip.tab)}">
            <span class="briefing-metric-value">${chip.value}</span>
            <span class="briefing-metric-label">${esc(chip.label)}</span>
          </button>
        `).join('')}
      </div>

      <section class="briefing-mid-grid" aria-label="Última entrega">
        <div class="briefing-panel briefing-panel-delivery">
          <h3 class="briefing-panel-title">Última entrega</h3>
          ${lastDelivery
            ? `<p class="briefing-aside-lead">${esc(lastDelivery.title)}</p>
               <p class="muted small">${lastDelivery.items.length} ítem(s) · ${new Date(lastDelivery.sentAt || lastDelivery.createdAt).toLocaleDateString('es')}</p>
               <span class="badge ${lastDelivery.status === 'ACKNOWLEDGED' ? 'badge-ready' : 'badge-progress'}">
                 ${lastDelivery.status === 'ACKNOWLEDGED' ? 'Visto' : 'Enviado'}
               </span>`
            : `<p class="muted small">Aún no hay entregas enviadas.</p>`}
        </div>
      </section>

      <section class="briefing-context-strip" aria-label="Contexto del dominio">
        <div class="briefing-context-block">
          <header class="context-tile-head">
            <h3>Temas en movimiento</h3>
            <button type="button" class="link-btn" data-tab="ws-radar">Radar</button>
          </header>
          ${hotTopics.length
            ? `<ul class="context-tile-list">
                 ${hotTopics.map((topic) => `
                   <li>
                     <strong>${esc(topic.label)}</strong>
                     <span class="muted small">${esc(momentumLabel(topic.momentum))} · ${topic.signalCount} señal${topic.signalCount === 1 ? '' : 'es'}</span>
                   </li>
                 `).join('')}
               </ul>`
            : '<p class="muted small">Sin temas emergentes todavía.</p>'}
        </div>

        <div class="briefing-context-block">
          <header class="context-tile-head">
            <h3>Oportunidades</h3>
            <span class="muted small">${opportunities.length} activa${opportunities.length === 1 ? '' : 's'}</span>
          </header>
          ${opportunities.length
            ? `<ul class="context-tile-list">
                 ${opportunities.slice(0, 3).map((opp) => `
                   <li>
                     <strong>${esc(opp.title)}</strong>
                     <span class="muted small">${esc(opp.status)}${opp.lifecycleStage ? ` · ${esc(opp.lifecycleStage)}` : ''}</span>
                   </li>
                 `).join('')}
               </ul>`
            : '<p class="muted small">Sin convocatorias registradas.</p>'}
        </div>
      </section>

      <section class="briefing-agent" aria-label="Topic Agent">
        <header class="briefing-agent-head">
          <h3 class="briefing-panel-title">Topic Agent</h3>
          <button type="button" id="btn-run-topic-agent" class="btn btn-ghost btn-sm" data-client-id="${esc(clientId)}">Actualizar ranking</button>
        </header>
        ${topicRun
          ? `<ol class="topic-agent-ranking">
               ${topicRun.items.map((item) => `
                 <li class="topic-agent-row">
                   <div class="topic-agent-row-head">
                     <span class="topic-agent-rank">#${item.rank}</span>
                     <strong>${esc(item.label)}</strong>
                     <span class="badge badge-progress">${item.signalCount} señal${item.signalCount === 1 ? '' : 'es'}</span>
                   </div>
                   <p class="topic-agent-rationale">${esc(item.rationale)}</p>
                 </li>
               `).join('')}
             </ol>
             <p class="muted small">Actualizado ${new Date(topicRun.run.createdAt).toLocaleString('es')}</p>`
          : '<p class="muted small">Sin ranking. Pulsa «Actualizar ranking» para generar la lista diaria con rationale.</p>'}
      </section>

      <section class="briefing-positioning" aria-label="Posicionamiento">
        <div class="briefing-aside-head">
          <h3 class="briefing-panel-title">Posicionamiento</h3>
          <button type="button" id="btn-generate-advice" class="btn btn-ghost btn-sm" data-client-id="${esc(clientId)}">
            ${advice ? 'Recalcular' : 'Generar'}
          </button>
        </div>
        ${advice
          ? `${renderAdviceCompact(advice)}
             <details class="briefing-inline-expand">
               <summary>Ver diagnóstico completo</summary>
               <div class="briefing-inline-body">${renderAdviceSummary(advice)}${renderAdviceActions(advice, true)}</div>
             </details>`
          : `<p class="muted small">Genera el diagnóstico para ver autoridad, brechas y plan de mejora.</p>`}
      </section>
    </div>
  `;
}

function renderAdviceSummary(advice: PositioningAdvice): string {
  const { diagnosis } = advice;
  const dims: Array<[string, number]> = [
    ['Autoridad', diagnosis.authorityScore],
    ['Consistencia', diagnosis.consistencyScore],
    ['Evidencia', diagnosis.evidenceScore],
    ['Visibilidad', diagnosis.visibilityScore],
  ];

  return `
    <p class="advice-summary">${esc(advice.summary)}</p>

    <div class="dimension-grid">
      ${dims.map(([label, value]) => `
        <div class="dimension">
          <div class="dimension-head">
            <span>${esc(label)}</span>
            <strong>${value}</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${value >= 70 ? 'progress-green' : value >= 45 ? '' : 'progress-red'}" style="width: ${value}%"></div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="diagnosis-lists">
      <div>
        <h5>Fortalezas</h5>
        <ul>${diagnosis.strengths.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div>
        <h5>Brechas</h5>
        <ul>${diagnosis.gaps.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
      <div>
        <h5>Riesgos</h5>
        <ul>${diagnosis.risks.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      </div>
    </div>

    <p class="advice-meta">
      ${advice.usedLiveModel ? 'Generado con modelo conectado' : 'Análisis heurístico local'} ·
      ${new Date(advice.generatedAt).toLocaleString('es')}
    </p>
  `;
}

function renderAdviceActions(advice: PositioningAdvice, embedded = false): string {
  const byHorizon: Array<[AdviceAction['horizon'], AdviceAction[]]> = [
    ['DAYS_30', advice.actions.filter((a) => a.horizon === 'DAYS_30')],
    ['DAYS_60', advice.actions.filter((a) => a.horizon === 'DAYS_60')],
    ['DAYS_90', advice.actions.filter((a) => a.horizon === 'DAYS_90')],
  ];

  const body = `
    <div class="horizon-grid">
      ${byHorizon.map(([horizon, actions]) => `
        <div class="horizon-column">
          <h5 class="horizon-title">${HORIZON_LABELS[horizon]}</h5>
          ${actions.length
            ? actions.map((action) => `
              <article class="advice-card">
                <header>
                  <span class="badge badge-progress">${CATEGORY_LABELS[action.category]}</span>
                  <span class="impact-tag">Impacto ${action.impact}</span>
                </header>
                <h6>${esc(action.title)}</h6>
                <p class="advice-why"><strong>Por qué:</strong> ${esc(action.why)}</p>
                <p class="advice-how"><strong>Cómo:</strong> ${esc(action.how)}</p>
                <footer>
                  <span class="muted">~${action.effortMinutes} min</span>
                  <button class="btn btn-secondary btn-sm btn-advice-to-curation"
                          data-client-id="${esc(advice.clientId)}"
                          data-action-id="${esc(action.id)}">
                    Preparar entrega
                  </button>
                </footer>
              </article>
            `).join('')
            : '<p class="empty-state small">Sin acciones en este horizonte.</p>'}
        </div>
      `).join('')}
    </div>
  `;

  if (embedded) {
    return `
      <div class="advice-actions-embedded">
        <h4 class="disclosure-subtitle">Plan de mejora propuesto</h4>
        ${body}
      </div>
    `;
  }

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Plan de mejora propuesto</h3>
          <p style="font-size: 0.9rem;">Acciones para elevar su imagen profesional, ordenadas por horizonte.</p>
        </div>
      </div>
      ${body}
    </section>
  `;
}

// ==========================================
// Radar
// ==========================================

function renderTopicRow(topic: Topic, compact = false): string {
  const trendClass =
    topic.momentum === 'RISING' || topic.momentum === 'EMERGING' ? 'trend-up'
      : topic.momentum === 'FADING' ? 'trend-down' : 'trend-flat';

  return `
    <div class="topic-row ${topic.pinned ? 'pinned' : ''}">
      <div class="topic-main">
        <div class="topic-title-line">
          <strong>${esc(topic.label)}</strong>
          <span class="trend-tag ${trendClass}">${momentumLabel(topic.momentum)}</span>
          <span class="badge ${topic.priorityBand === 'CRITICAL' || topic.priorityBand === 'HIGH' ? 'badge-ready' : 'badge-progress'}">
            Score ${topic.topScore}
          </span>
        </div>
        <p class="topic-keywords">${topic.keywords.slice(0, 5).map((k) => esc(k)).join(' · ')}</p>
        <p class="topic-stats">
          ${topic.signalCount} señal(es) · ${topic.recentCount} esta semana
          ${topic.previousCount ? ` (antes ${topic.previousCount})` : ''}
        </p>
      </div>
      ${compact
        ? `<button class="btn btn-secondary btn-sm" data-tab="ws-radar" data-topic-key="${esc(topic.key)}">Ver señales</button>`
        : `<div class="topic-actions">
             <button class="btn btn-secondary btn-sm btn-toggle-topic-pin" data-topic-key="${esc(topic.key)}">
               ${topic.pinned ? 'Quitar pin' : 'Fijar'}
             </button>
             <button class="btn btn-secondary btn-sm btn-filter-topic" data-topic-key="${esc(topic.key)}">
               Filtrar
             </button>
           </div>`}
    </div>
  `;
}

function renderScoreBreakdown(signal: Signal, compact: boolean): string {
  const breakdown = signal.scoreBreakdown;
  if (!breakdown || compact) {
    return signal.scoreRationale && !compact
      ? `<p class="muted small signal-rationale">${esc(signal.scoreRationale)}</p>`
      : '';
  }

  const topFactors = breakdown.factors.slice(0, 4);
  const maxPts = Math.max(...topFactors.map((f) => f.points), 1);

  return `
    <details class="score-explain">
      <summary class="muted small">Por qué score ${breakdown.totalScore}: ${esc(breakdown.summary)}</summary>
      <div class="score-explain-body">
        ${topFactors
          .map(
            (f) => `
          <div class="score-bar-row">
            <span class="score-bar-label">${esc(f.label)}</span>
            <span class="score-bar-track"><span class="score-bar-fill" style="width:${Math.round((f.points / maxPts) * 100)}%"></span></span>
            <span class="score-bar-pts">+${f.points}</span>
          </div>`
          )
          .join('')}
        ${breakdown.penalties.length
          ? `<p class="muted small" style="margin-top:0.35rem;">Penalizaciones: ${breakdown.penalties
              .map((p) => `${esc(p.label)} −${p.points}`)
              .join(' · ')}</p>`
          : ''}
      </div>
    </details>
  `;
}

function renderAlsoIn(cluster: SignalCluster | undefined, compact: boolean): string {
  if (!cluster || cluster.memberCount < 2) return '';
  const names = cluster.alsoIn.slice(0, compact ? 2 : 4);
  const extra = cluster.alsoIn.length - names.length;
  return `
    <p class="signal-also-in muted small">
      También en <strong>${esc(names.join(' · '))}</strong>${extra > 0 ? ` +${extra}` : ''}
      <span class="badge badge-progress">${cluster.memberCount} medios</span>
    </p>
  `;
}

/** Qué tesis reclamó la señal, y cuáles quedaron detrás. Solo aparece con varias tesis. */
function renderThesisAttribution(signal: Signal): string {
  const scores = signal.thesisScores;
  if (!scores?.length || scores.length < 2) return '';

  const titles = new Map(
    dbService.getThesesByClient(signal.clientId || '').map((t) => [t.id, t.title])
  );
  const routingState = signal.routingDecision?.routingState;
  const contested =
    routingState === 'CONTESTED' || Boolean(signal.routingDecision?.contested);

  // CONTESTED: never present scores[0] / stale thesisId as selected attribution.
  if (contested) {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const lead = sorted[0];
    const rival =
      sorted.find((s) => s.thesisId === signal.routingDecision?.secondaryThesisId) ||
      sorted[1];
    if (!lead || !rival) return '';
    return `
    <div class="signal-thesis-attribution">
      <p>
        <span class="badge badge-pending">Empate — decide</span>
        ${esc(titles.get(lead.thesisId) || 'Tesis')} ${lead.score}
        · ${esc(titles.get(rival.thesisId) || 'otra')} ${rival.score}
        ${signal.routingDecision?.source === 'MANUAL' ? '<span class="badge badge-progress">Override manual</span>' : ''}
      </p>
      <div class="row-actions">
        <button type="button" class="btn btn-secondary btn-sm"
                data-thesis-override="${esc(lead.thesisId)}"
                data-signal-id="${esc(signal.id)}">
          Usar ${esc(titles.get(lead.thesisId) || 'opción A')}
        </button>
        <button type="button" class="btn btn-secondary btn-sm"
                data-thesis-override="${esc(rival.thesisId)}"
                data-signal-id="${esc(signal.id)}">
          Usar ${esc(titles.get(rival.thesisId) || 'opción B')}
        </button>
      </div>
    </div>
  `;
  }

  if (routingState === 'UNROUTED' || !signal.thesisId) {
    return `
    <div class="signal-thesis-attribution">
      <p><span class="badge badge-pending">Sin tesis estratégica asignada</span></p>
    </div>
  `;
  }

  // CLEAR — only show selected thesis as attribution (no scores[0] fallback).
  const primary = scores.find((s) => s.thesisId === signal.thesisId);
  if (!primary) return '';
  const others = scores.filter((s) => s.thesisId !== primary.thesisId);

  return `
    <div class="signal-thesis-attribution">
      <p>
        <strong>${esc(titles.get(primary.thesisId) || 'Tesis')}</strong> ${primary.score}
        ${others.length
          ? `· frente a ${others
              .map((s) => `${esc(titles.get(s.thesisId) || 'otra')} ${s.score}`)
              .join(', ')}`
          : ''}
        ${signal.routingDecision?.source === 'MANUAL' ? '<span class="badge badge-progress">Override manual</span>' : ''}
      </p>
    </div>
  `;
}

function renderSignalCard(
  signal: Signal,
  thesis: PositioningThesis | undefined,
  inCuration: boolean,
  compact = false,
  cluster?: SignalCluster
): string {
  const score = signal.relevanceScore;
  const band = signal.priorityBand;
  const accent = band === 'CRITICAL' ? 'accent-critical' : band === 'HIGH' ? 'accent-high' : band === 'LOW' ? 'accent-low' : 'accent-medium';

  return `
    <article class="signal-card ${accent}${compact ? ' signal-card-compact' : ''}">
      <header class="signal-head">
        <span class="badge badge-pending">${esc(signal.sourceType)}</span>
        ${score !== undefined
          ? `<span class="badge ${band === 'CRITICAL' || band === 'HIGH' ? 'badge-ready' : 'badge-progress'}">
               Score ${score}${band ? ` · ${esc(band)}` : ''}
             </span>`
          : '<span class="badge badge-progress">Sin puntuar</span>'}
        ${signal.whyNow
          ? `<span class="why-now-chip why-now-${signal.whyNow.band.toLowerCase()}">
               ${signal.whyNow.band === 'NOW' ? 'Ahora' : signal.whyNow.band === 'SOON' ? 'Pronto' : 'Sin urgencia'}
             </span>`
          : ''}
      </header>

      <h4 class="signal-title">${esc(signal.title)}</h4>
      ${compact
        ? `<p class="signal-snippet">${esc(signal.contentSnippet.slice(0, 140))}${signal.contentSnippet.length > 140 ? '…' : ''}</p>`
        : `<p class="signal-snippet">${esc(signal.contentSnippet)}</p>`}

      ${signal.whyNow
        ? `<p class="why-now-reason"><strong>Why now:</strong> ${esc(signal.whyNow.reason)}</p>`
        : ''}
      ${renderThesisAttribution(signal)}
      ${renderAlsoIn(cluster, compact)}
      ${renderScoreBreakdown(signal, compact)}

      ${signal.recommendedAction
        ? `<p class="signal-suggestion">Sugerencia: <strong>${esc(signal.recommendedAction)}</strong></p>`
        : ''}

      ${signal.recommendedAction === 'RESEARCH_REQUIRED' && !signal.researchBrief
        ? `<p class="muted small">Necesita evidencia antes de convertirse en contenido.</p>`
        : ''}

      ${signal.researchBrief
        ? `<div class="field-block" style="margin: 0.5rem 0; padding: 0.5rem; background: var(--surface-muted, rgba(0,0,0,0.04)); border-radius: 6px;">
             <p class="muted small"><strong>Investigación Tavily</strong> · ${new Date(signal.researchBrief.queriedAt).toLocaleString('es')}</p>
             <p style="font-size: 0.9rem;">${esc(signal.researchBrief.summary)}</p>
             ${signal.researchBrief.evidence.length
               ? `<ul class="policy-list" style="margin-top: 0.35rem;">
                    ${signal.researchBrief.evidence.slice(0, 3).map((e) => `
                      <li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title.slice(0, 70))}</a></li>
                    `).join('')}
                  </ul>`
               : ''}
           </div>`
        : ''}

      <footer class="signal-foot">
        <span class="muted">
          ${esc(signal.sourceName)} · ${new Date(signal.detectedAt).toLocaleDateString('es')}
        </span>
        <div class="signal-actions">
          ${signal.recommendedAction === 'RESEARCH_REQUIRED' && thesis && !signal.researchBrief
            ? `<button class="btn btn-ghost btn-sm btn-research-signal" data-signal-id="${esc(signal.id)}">Investigar</button>`
            : ''}
          <button class="btn btn-secondary btn-sm btn-discard-signal" data-signal-id="${esc(signal.id)}">Descartar</button>
          ${thesis && !compact ? `<button class="btn btn-secondary btn-sm btn-analyze-signal" data-signal-id="${esc(signal.id)}">Puntuar</button>` : ''}
          ${inCuration
            ? '<span class="badge badge-ready">En preparación</span>'
            : `<button class="btn btn-primary btn-sm btn-send-to-curation" data-signal-id="${esc(signal.id)}">Añadir a entrega</button>`}
        </div>
      </footer>
      ${renderSignalOutcomeControls(signal)}
    </article>
  `;
}

function renderSignalOutcomeControls(signal: Signal): string {
  const outcome = getSignalOutcomeForDisplay(signal.clientId ?? '', signal.id);
  const canRate =
    signal.status === 'CONVERTED' ||
    signal.managerDecision === 'CONVERTED' ||
    signal.managerDecision === 'SAVED' ||
    Boolean(outcome);

  if (!canRate && signal.managerDecision === 'UNREVIEWED') return '';

  if (outcome) {
    return `
      <p class="signal-outcome-done muted small">
        Feedback: <strong>${outcome.kind === 'USEFUL' ? 'Sirvió' : 'No sirvió'}</strong>
        · ${new Date(outcome.createdAt).toLocaleDateString('es')}
      </p>
    `;
  }

  if (signal.status !== 'CONVERTED' && signal.managerDecision !== 'CONVERTED' && signal.managerDecision !== 'SAVED') {
    return '';
  }

  return `
    <div class="signal-outcome-actions">
      <span class="muted small">¿Sirvió para posicionar?</span>
      <button class="btn btn-ghost btn-sm btn-signal-outcome" data-signal-id="${esc(signal.id)}" data-outcome="USEFUL">Sí</button>
      <button class="btn btn-ghost btn-sm btn-signal-outcome" data-signal-id="${esc(signal.id)}" data-outcome="NOT_USEFUL">No</button>
    </div>
  `;
}

function renderTriageColumn(
  title: string,
  hint: string,
  signals: Signal[],
  thesis: PositioningThesis | undefined,
  clientId: string,
  tone: 'critical' | 'review' | 'monitor',
  clusters: SignalCluster[]
): string {
  return `
    <div class="radar-triage-col radar-triage-${tone}">
      <header class="radar-triage-col-head">
        <h4>${esc(title)} <span class="badge badge-pending">${signals.length}</span></h4>
        <p class="muted small">${esc(hint)}</p>
      </header>
      <div class="radar-triage-col-body">
        ${signals.length
          ? signals
              .slice(0, 12)
              .map((s) =>
                renderSignalCard(
                  s,
                  thesis,
                  dbService.isSignalInCuration(clientId, s.id),
                  true,
                  clusterForSignal(s.id, clusters)
                )
              )
              .join('')
          : '<p class="empty-state small">Vacío</p>'}
        ${signals.length > 12 ? `<p class="muted small">+${signals.length - 12} más — usa filtros o vista lista</p>` : ''}
      </div>
    </div>
  `;
}

function renderRadar(client: Client, thesis: PositioningThesis | undefined, filters: WorkspaceFilters): string {
  const clientId = client.id;
  const activeTheses = dbService.getActiveTheses(clientId);
  // Multi-thesis ScoreAndRouteSignal needs any ACTIVE thesis — not a primary/[0] pick.
  const canScore = activeTheses.length > 0;
  const allSignals = dbService.getSignalsByClient(clientId);
  const topics = buildTopics(clientId, allSignals);
  const radarView = filters.radarView === 'list' ? 'list' : 'triage';

  const query = (filters.searchQuery || '').toLowerCase();
  const sourceFilter = filters.sourceType || 'ALL';
  const bandFilter = filters.priorityBand || 'ALL';
  const topicFilter = filters.topicKey;
  const topicSignalIds = topicFilter ? topics.find((t) => t.key === topicFilter)?.signalIds : undefined;
  const activeTopic = topicFilter ? topics.find((t) => t.key === topicFilter) : undefined;

  const visible = allSignals.filter((s) => {
    if (s.status === 'DISCARDED') return false;
    if (filters.thesisId && s.thesisId && s.thesisId !== filters.thesisId) return false;
    if (query && !s.title.toLowerCase().includes(query) && !s.contentSnippet.toLowerCase().includes(query)) return false;
    if (sourceFilter !== 'ALL' && s.sourceType !== sourceFilter) return false;
    if (bandFilter !== 'ALL' && s.priorityBand !== bandFilter) return false;
    if (topicSignalIds && !topicSignalIds.includes(s.id)) return false;
    return true;
  });

  const clusters = clusterSimilarSignals(visible);
  const multiSourceClusters = clusters.filter((c) => c.memberCount > 1).length;
  const canonical = canonicalSignalsFromClusters(visible, clusters);
  const sorted = [...canonical].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  const unscored = allSignals.filter((s) => s.relevanceScore === undefined && s.status !== 'DISCARDED').length;
  const researchPending = signalsNeedingResearch(clientId).length;
  const triage = groupSignalsForTriage(canonical);
  const decideCount = triage.decideNow.length;
  const outcomes = listSignalOutcomesForDisplay(clientId);
  const awaitingFeedback = signalsAwaitingOutcome(allSignals, outcomes);
  const conversion = computeConversionStats(allSignals, outcomes);

  return `
    ${awaitingFeedback.length
      ? `<div class="info-strip warn">
           <span><strong>${awaitingFeedback.length}</strong> señal(es) convertidas sin feedback (útil / no útil).</span>
           ${conversion.usefulRate !== null ? `<span class="muted small">Tasa útil: ${conversion.usefulRate}%</span>` : ''}
         </div>`
      : ''}
    ${!canScore
      ? `<div class="info-strip warn">
           <span>Sin tesis <strong>ACTIVE</strong> el radar no puntuará señales. Activa una tesis en Identidad o completa y envía una al cliente.</span>
           <button type="button" class="btn btn-secondary btn-sm" data-tab="ws-positioning">Ir a Identidad</button>
         </div>`
      : unscored > 0
        ? `<div class="info-strip">
             <span>${unscored} señal(es) sin puntuar.</span>
             <button id="btn-score-all-signals" class="btn btn-secondary btn-sm" data-client-id="${esc(clientId)}">
               Puntuar todas
             </button>
           </div>`
        : researchPending > 0
          ? `<div class="info-strip">
               <span>${researchPending} señal(es) requieren investigación (Tavily).</span>
               <button id="btn-research-all-signals" class="btn btn-secondary btn-sm" data-client-id="${esc(clientId)}">
                 Investigar pendientes
               </button>
             </div>`
          : decideCount > 0
            ? `<div class="info-strip">
                 <span><strong>${decideCount}</strong> señal(es) listas para decidir ahora (críticas / altas / investigación).</span>
               </div>`
            : ''}

    <details class="card topic-trends-panel"${activeTopic ? ' open' : ''}>
      <summary class="topic-trends-summary">
        <div>
          <h3>Tendencias del dominio</h3>
          <p>
            ${topics.length} tema(s) · ${allSignals.length} señal(es)
            ${topics.length ? ' — pulsa para desplegar' : ''}
          </p>
        </div>
      </summary>
      <div class="topic-trends-body">
        ${topics.length
          ? `${topics.slice(0, 4).map((t) => renderTopicRow(t)).join('')}
             ${topics.length > 4
               ? `<details class="topic-trends-more">
                    <summary class="muted small">Ver ${topics.length - 4} tema(s) más</summary>
                    ${topics.slice(4).map((t) => renderTopicRow(t)).join('')}
                  </details>`
               : ''}`
          : '<p class="empty-state">Todavía no hay suficientes señales para detectar temas.</p>'}
      </div>
    </details>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Señales${activeTopic ? `: ${esc(activeTopic.label)}` : ''}</h3>
          <p>
            ${radarView === 'triage'
              ? 'Modo triage: decide primero lo crítico, luego revisa y monitorea. Historias repetidas se agrupan.'
              : 'Una tarjeta por historia (medios duplicados agrupados). Expande el score para ver el desglose.'}
            ${multiSourceClusters
              ? ` · <strong>${multiSourceClusters}</strong> historia(s) en varios medios`
              : ''}
          </p>
        </div>
        <div class="row-actions">
          <div class="filter-pills">
            <button type="button" class="filter-pill ${radarView === 'triage' ? 'active' : ''}" data-radar-view="triage">Triage</button>
            <button type="button" class="filter-pill ${radarView === 'list' ? 'active' : ''}" data-radar-view="list">Lista</button>
          </div>
          ${activeTopic
            ? '<button class="btn btn-secondary btn-sm btn-clear-topic-filter">Quitar filtro de tema</button>'
            : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-input-group">
          <input type="text" id="input-search-signals" placeholder="Buscar en titulares o resúmenes..." value="${esc(filters.searchQuery || '')}" />
        </div>
        <div class="filter-pills">
          <button type="button" class="filter-pill ${bandFilter === 'ALL' ? 'active' : ''}" data-band-filter="ALL">Historias (${canonical.length})</button>
          <button type="button" class="filter-pill ${bandFilter === 'CRITICAL' ? 'active' : ''}" data-band-filter="CRITICAL">Críticas</button>
          <button type="button" class="filter-pill ${bandFilter === 'HIGH' ? 'active' : ''}" data-band-filter="HIGH">Altas</button>
          <button type="button" class="filter-pill ${bandFilter === 'MEDIUM' ? 'active' : ''}" data-band-filter="MEDIUM">Medias</button>
        </div>
        <div class="filter-pills">
          <button type="button" class="filter-pill ${sourceFilter === 'ALL' ? 'active' : ''}" data-source-filter="ALL">Toda fuente</button>
          <button type="button" class="filter-pill ${sourceFilter === 'REGULATORY' ? 'active' : ''}" data-source-filter="REGULATORY">Regulatorio</button>
          <button type="button" class="filter-pill ${sourceFilter === 'RSS' ? 'active' : ''}" data-source-filter="RSS">RSS</button>
          <button type="button" class="filter-pill ${sourceFilter === 'VIDEO' ? 'active' : ''}" data-source-filter="VIDEO">YouTube</button>
          <button type="button" class="filter-pill ${sourceFilter === 'SOCIAL' ? 'active' : ''}" data-source-filter="SOCIAL">Social</button>
          <button type="button" class="filter-pill ${sourceFilter === 'ACADEMIC' ? 'active' : ''}" data-source-filter="ACADEMIC">Académico</button>
          <button type="button" class="filter-pill ${sourceFilter === 'MANUAL' ? 'active' : ''}" data-source-filter="MANUAL">Manual</button>
        </div>
      </div>

      ${radarView === 'triage'
        ? `<div class="radar-triage-grid">
             ${renderTriageColumn('Decidir ahora', 'Críticas, altas o con investigación pendiente', triage.decideNow, thesis, clientId, 'critical', clusters)}
             ${renderTriageColumn('Revisar', 'Buenas candidatas para una entrega o contenido', triage.review, thesis, clientId, 'review', clusters)}
             ${renderTriageColumn('Monitorear', 'Baja prioridad — no bloquean el flujo', triage.monitor, thesis, clientId, 'monitor', clusters)}
           </div>`
        : `<div class="signal-grid">
             ${sorted.length
               ? sorted
                   .map((s) =>
                     renderSignalCard(
                       s,
                       thesis,
                       dbService.isSignalInCuration(clientId, s.id),
                       false,
                       clusterForSignal(s.id, clusters)
                     )
                   )
                   .join('')
               : '<p class="empty-state">No hay señales con estos filtros.</p>'}
           </div>`}
    </section>

    <details class="card disclosure">
      <summary>Orígenes y fuentes recomendadas</summary>
      <div class="disclosure-body">${renderRecommendedSources(client, thesis, dbService.getMasterProfile(clientId))}</div>
    </details>
  `;
}

// ==========================================
// Mesa de curación
// ==========================================

function renderCurationBriefGovernance(entry: CurationEntry): string {
  const brief = entry.strategicBriefId
    ? getStrategicBrief(entry.strategicBriefId, entry.clientId)
    : undefined;
  if (brief?.status === 'APPROVED' && !brief.supersededByBriefId) {
    return `<p class="muted small">Strategic Brief: <strong>APPROVED</strong> · ${esc(brief.id)} · action ${esc(brief.decision.authorizedAction)}</p>`;
  }
  if (brief) {
    return `<p class="muted small">Strategic Brief: ${esc(brief.status)} · ${esc(brief.id)}</p>
      <button type="button" class="btn btn-secondary btn-sm btn-approve-strategic-brief"
              data-brief-id="${escAttr(brief.id)}" data-client-id="${escAttr(entry.clientId)}">
        Approve Strategic Brief
      </button>`;
  }
  if (entry.destination && curationDestinationToAuthorizedAction(entry.destination)) {
    return `<p class="muted small">Strategic Brief required before delivery materialization.</p>
      <button type="button" class="btn btn-secondary btn-sm btn-create-strategic-brief"
              data-curation-id="${escAttr(entry.id)}" data-destination="${escAttr(entry.destination)}">
        Create Strategic Brief DRAFT
      </button>`;
  }
  return `<p class="muted small">Choose a strategic destination, then create a Strategic Brief.</p>`;
}

function renderCurationEntry(entry: CurationEntry): string {
  return `
    <article class="curation-card">
      <header class="curation-head">
        ${entry.score !== undefined
          ? `<span class="badge ${entry.priorityBand === 'CRITICAL' || entry.priorityBand === 'HIGH' ? 'badge-ready' : 'badge-progress'}">
               Score ${entry.score}${entry.priorityBand ? ` · ${esc(entry.priorityBand)}` : ''}
             </span>`
          : '<span class="badge badge-progress">Sin puntuar</span>'}
        ${entry.suggestedAction ? `<span class="muted small">Sugerido: ${esc(entry.suggestedAction)}</span>` : ''}
      </header>

      <h4>${esc(entry.title)}</h4>
      <p class="curation-snippet">${esc(entry.snippet)}</p>
      ${entry.sourceUrl ? `<a class="curation-link" href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente original</a>` : ''}

      ${entry.aiAngle
        ? `<p class="curation-angle"><strong>Ángulo propuesto:</strong> ${esc(entry.aiAngle)}</p>`
        : `<button class="btn btn-secondary btn-sm btn-suggest-angle" data-curation-id="${esc(entry.id)}">
             Proponer ángulo
           </button>`}

      <div class="curation-brief-governance">${renderCurationBriefGovernance(entry)}</div>

      <form class="curation-form" data-curation-id="${esc(entry.id)}">
        <div class="form-group">
          <label class="form-label" for="dest-${esc(entry.id)}">Destino</label>
          <select id="dest-${esc(entry.id)}" name="destination" class="form-select" required>
            <option value="">Elige qué hacer con esto…</option>
            ${(Object.keys(DESTINATION_LABELS) as CurationDestination[]).map((d) => `
              <option value="${d}">${DESTINATION_LABELS[d]}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="why-${esc(entry.id)}">Por qué (queda en auditoría)</label>
          <textarea id="why-${esc(entry.id)}" name="rationale" class="form-input" rows="2" minlength="10" required
                    placeholder="Ej.: refuerza el proof point de gobernanza de IA y responde una duda real de la audiencia."></textarea>
        </div>
        <div class="curation-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">Confirmar y añadir al briefing</button>
          <button type="button" class="btn btn-ghost btn-sm btn-remove-curation" data-curation-id="${esc(entry.id)}">Quitar</button>
        </div>
      </form>
    </article>
  `;
}

function renderDeliveryItems(pkg: DeliveryPackage): string {
  if (!pkg.items.length) {
    return `<p class="empty-state small">
      Vacío. Confirma el destino de una señal de la izquierda y entrará aquí automáticamente.
    </p>`;
  }

  return pkg.items.map((item) => `
    <div class="delivery-item">
      <div>
        <span class="badge badge-progress">${esc(deliveryItemKindLabel(item.kind))}</span>
        <strong>${esc(item.title)}</strong>
        ${item.rationale
          ? `<details class="briefing-rationale"><summary>Por qué se incluyó</summary><p class="muted small">${esc(item.rationale)}</p></details>`
          : ''}
      </div>
      <button class="btn btn-ghost btn-sm btn-remove-delivery-item"
              data-package-id="${esc(pkg.id)}" data-item-id="${esc(item.id)}"
              title="Quitar del briefing" aria-label="Quitar del briefing">
        ${icon('x', 15)}
      </button>
    </div>
  `).join('');
}

/** Panel derecho: el briefing funciona como carrito del flujo de entrega. */
function renderBriefingPanel(clientId: string, draft: DeliveryPackage | undefined, loose: CurationEntry[]): string {
  return `
    <div class="card briefing-panel">
      <div class="card-header">
        <div>
          <h3>${icon('inbox', 16)} Briefing en preparación</h3>
          <p>Se envía al portal del cliente cuando tú lo decidas.</p>
        </div>
        ${draft
          ? `<span class="badge badge-accent">${draft.items.length} ítem${draft.items.length === 1 ? '' : 's'}</span>`
          : `<button id="btn-create-delivery" class="btn btn-primary btn-sm" data-client-id="${esc(clientId)}">
               Crear briefing
             </button>`}
      </div>

      ${draft
        ? `
          <form id="form-delivery-meta" data-package-id="${esc(draft.id)}">
            <div class="form-group">
              <label class="form-label" for="delivery-title">Título</label>
              <input id="delivery-title" name="title" class="form-input" value="${esc(draft.title)}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="delivery-note">Nota estratégica para el cliente</label>
              <textarea id="delivery-note" name="strategicNote" class="form-textarea" rows="3"
                        placeholder="Explica en dos frases por qué este es el foco de la semana.">${esc(draft.strategicNote)}</textarea>
            </div>
            <button type="submit" class="btn btn-secondary btn-sm">Guardar nota</button>
          </form>

          <div class="delivery-items">
            ${renderDeliveryItems(draft)}
          </div>

          ${loose.length
            ? `<div class="briefing-loose">
                 <p class="briefing-loose-label">${icon('clock', 13)} Decididos fuera del briefing</p>
                 ${loose.map((entry) => `
                   <div class="ready-item">
                     <div>
                       <span class="badge badge-neutral">${DESTINATION_LABELS[entry.destination as CurationDestination]}</span>
                       <strong>${esc(entry.title)}</strong>
                     </div>
                     <div class="ready-item-actions">
                       <button class="btn btn-secondary btn-sm btn-add-to-delivery"
                               data-curation-id="${esc(entry.id)}" data-client-id="${esc(clientId)}">
                         Añadir
                       </button>
                       <button class="btn btn-ghost btn-sm btn-reopen-curation" data-curation-id="${esc(entry.id)}"
                               title="Volver a decidir" aria-label="Volver a decidir">
                         ${icon('arrowLeft', 15)}
                       </button>
                     </div>
                   </div>
                 `).join('')}
               </div>`
            : ''}

          <div class="delivery-send">
            <button id="btn-preview-delivery" class="btn btn-secondary btn-block" data-package-id="${esc(draft.id)}"
                    ${draft.items.length ? '' : 'disabled'}>
              ${icon('fileText', 16)} Vista previa
            </button>
            <button id="btn-send-delivery" class="btn btn-gradient btn-block" data-package-id="${esc(draft.id)}"
                    ${draft.items.length ? '' : 'disabled'}>
              ${icon('send', 16)} Enviar al cliente
            </button>
            <button type="button" class="btn btn-ghost btn-sm btn-discard-delivery" data-package-id="${esc(draft.id)}">
              Descartar borrador
            </button>
            <span class="muted small">
              La vista previa muestra el briefing como lo verá el cliente. Al enviar se crean tareas, lecturas y notificaciones.
            </span>
          </div>
        `
        : '<p class="empty-state">No hay briefing abierto. Crea uno para empezar a agrupar entregables.</p>'}
    </div>
  `;
}

/**
 * Pantalla fusionada: decidir el destino de cada señal y armar el briefing
 * son la misma sesión de trabajo, así que viven en la misma vista.
 */
function renderDeliver(client: Client, thesis: PositioningThesis | undefined): string {
  const clientId = client.id;
  const pending = dbService.getPendingCurationByClient(clientId);
  const draft = dbService.getDraftDelivery(clientId);
  const loose = dbService.getReadyCurationByClient(clientId);
  const sent = dbService.getSentDeliveriesByClient(clientId);
  const all = dbService.getCurationByClient(clientId);
  const discarded = all.filter((c) => c.destination === 'DISCARD').length;
  const delivered = all.filter((c) => {
    const pkg = c.deliveryPackageId ? dbService.getDeliveryById(c.deliveryPackageId) : undefined;
    return pkg && pkg.status !== 'DRAFT';
  }).length;

  return `
    <div class="info-strip">
      <span>
        La IA propone y puntúa; tú decides. Al confirmar un destino el ítem entra directo al briefing.
        ${thesis
          ? `Tesis de referencia: <strong>${esc(thesis.title)}</strong>.`
          : 'Sin tesis activa: define una para tener criterio de filtro.'}
      </span>
    </div>

    <section class="stat-grid">
      <div class="card stat-card"><p class="form-label">Por decidir</p><h2>${pending.length}</h2></div>
      <div class="card stat-card"><p class="form-label">En el briefing</p><h2>${draft?.items.length || 0}</h2></div>
      <div class="card stat-card"><p class="form-label">Entregados</p><h2>${delivered}</h2></div>
      <div class="card stat-card"><p class="form-label">Descartados</p><h2>${discarded}</h2></div>
    </section>

    <section class="workspace-split">
      <div class="card">
        <div class="card-header">
          <div>
            <h3>${icon('filter', 16)} Bandeja por decidir</h3>
            <p>Cada ítem necesita destino y justificación. Nada llega al cliente sin las dos cosas.</p>
          </div>
          <button class="btn btn-ghost btn-sm" data-tab="ws-radar">Ir al radar</button>
        </div>
        <div class="curation-grid">
          ${pending.length
            ? pending.map((e) => renderCurationEntry(e)).join('')
            : `<p class="empty-state">
                 ${icon('check', 22)}
                 <span>Bandeja vacía. Ve al Radar y añade a la entrega las señales que valgan la pena.</span>
               </p>`}
        </div>
      </div>

      ${renderBriefingPanel(clientId, draft, loose)}
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Historial de entregas</h3>
          <p>Qué recibió el cliente y cuándo.</p>
        </div>
      </div>

      ${sent.length
        ? sent.map((pkg) => `
          <details class="delivery-summary">
            <summary class="delivery-summary-head">
              <div>
                <strong>${esc(pkg.title)}</strong>
                <p class="muted small">
                  ${pkg.items.length} ítem(s) · ${new Date(pkg.sentAt || pkg.createdAt).toLocaleString('es')}
                  ${pkg.acknowledgedAt ? ` · visto ${new Date(pkg.acknowledgedAt).toLocaleDateString('es')}` : ''}
                </p>
              </div>
              <span class="badge ${pkg.status === 'ACKNOWLEDGED' ? 'badge-ready' : 'badge-progress'}">
                ${esc(deliveryStatusLabel(pkg.status))}
              </span>
            </summary>
            <div class="delivery-summary-body">
              ${pkg.strategicNote ? `<p class="muted small">"${esc(pkg.strategicNote)}"</p>` : ''}
              <ul class="briefing-items">
                ${pkg.items
                  .map(
                    (item) => `
                  <li>
                    <span class="badge badge-progress">${esc(deliveryItemKindLabel(item.kind))}</span>
                    <strong>${esc(item.title)}</strong>
                  </li>`
                  )
                  .join('')}
              </ul>
              ${pkg.clientAckNote
                ? `<p class="muted small"><em>Nota del cliente: ${esc(pkg.clientAckNote)}</em></p>`
                : ''}
            </div>
          </details>
        `).join('')
        : '<p class="empty-state">Sin entregas enviadas todavía.</p>'}
    </section>
  `;
}

// ==========================================
// Posicionamiento
// ==========================================

/** Orden de exhibición: activas primero, luego por prioridad declarada. */
function sortThesesForBoard(theses: PositioningThesis[]): PositioningThesis[] {
  const statusRank: Record<string, number> = { ACTIVE: 0, UNDER_REVIEW: 1, DRAFT: 2, PAUSED: 3, ARCHIVED: 4 };
  return theses.slice().sort((a, b) => {
    const byStatus = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (byStatus !== 0) return byStatus;
    const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
    if (byPriority !== 0) return byPriority;
    return a.title.localeCompare(b.title, 'es');
  });
}

function renderWeightRow(label: string, weight: number, meta?: string): string {
  const pct = Math.max(0, Math.min(100, Math.round(weight)));
  return `
    <div class="weight-row">
      <div class="weight-row-head">
        <span class="weight-row-label">${esc(label)}</span>
        <strong class="weight-row-value">${pct}</strong>
      </div>
      <div class="progress-track progress-track-sm">
        <div class="progress-fill ${pct >= 70 ? 'progress-green' : pct >= 40 ? '' : 'progress-red'}" style="width: ${pct}%"></div>
      </div>
      ${meta ? `<p class="weight-row-meta">${esc(meta)}</p>` : ''}
    </div>
  `;
}

function renderThesisIdentityBlock(thesis: PositioningThesis, normalized: NormalizedThesis): string {
  return `
    <div class="thesis-block">
      ${thesis.pendingRevision
        ? `<p class="warn-strip">Hay una revisión pendiente de aprobación del cliente${
            thesis.pendingRevision.proposed.title
              ? ` («${esc(thesis.pendingRevision.proposed.title)}»)`
              : ''
          }.</p>`
        : ''}
      <h3 class="thesis-block-title">Identidad y percepción</h3>
      <div class="identity-ladder">
        <div class="identity-step">
          <span class="identity-step-label">Hoy reconocen</span>
          <p>${normalized.identityCurrent
            ? esc(normalized.identityCurrent)
            : '<span class="muted">Sin declarar. Sin esto no se puede medir la brecha.</span>'}</p>
        </div>
        <div class="identity-step identity-step-target">
          <span class="identity-step-label">Queremos que reconozcan</span>
          <p>${esc(normalized.identityTarget || 'Sin identidad objetivo.')}</p>
        </div>
        <div class="identity-step">
          <span class="identity-step-label">Asociación mental objetivo</span>
          <p>${normalized.perceptionTarget
            ? esc(normalized.perceptionTarget)
            : '<span class="muted">Sin percepción objetivo declarada.</span>'}</p>
        </div>
      </div>
      ${thesis.differentiator
        ? `<p class="thesis-differentiator"><span class="thesis-block-hint">Ángulo único:</span> ${esc(thesis.differentiator)}</p>`
        : ''}
    </div>
  `;
}

function renderThesisAudienceBlock(normalized: NormalizedThesis): string {
  const groups = audiencesByTier(normalized.audiences);
  if (!groups.length) return '';

  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Audiencias</h3>
      <p class="thesis-block-hint">Quién compra, quién abre puertas y quién amplifica.</p>
      <div class="audience-tiers">
        ${groups.map((group) => `
          <div class="audience-tier">
            <h4 class="audience-tier-title">${esc(AUDIENCE_TIER_LABELS[group.tier])}</h4>
            ${group.items.map((item) => renderWeightRow(item.name, item.weight)).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderThesisTerritoryBlock(normalized: NormalizedThesis): string {
  if (!normalized.territories.length) return '';

  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Territorios</h3>
      <p class="thesis-block-hint">Mapa de temas con peso: define qué noticia merece atención.</p>
      ${normalized.territories
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .map((t) => renderWeightRow(t.name, t.weight, t.pillar))
        .join('')}
    </div>
  `;
}

function renderThesisObjectiveBlock(normalized: NormalizedThesis): string {
  if (!normalized.objectives.length) return '';
  const validation = validateWeights(normalized.objectives);

  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Objetivos</h3>
      <p class="thesis-block-hint">Contra qué se evalúa cada oportunidad.</p>
      ${normalized.objectives
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .map((o) => renderWeightRow(OBJECTIVE_KIND_LABELS[o.kind], o.weight))
        .join('')}
      ${validation.ok ? '' : `<p class="warn-strip">${esc(validation.message || '')}</p>`}
    </div>
  `;
}

function renderThesisVoiceBlock(normalized: NormalizedThesis): string {
  const voice = normalized.voiceProfile;
  const dimensions = Object.keys(VOICE_DIMENSION_LABELS) as Array<keyof typeof VOICE_DIMENSION_LABELS>;

  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Perfil de voz</h3>
      <div class="voice-grid">
        ${dimensions.map((key) => renderWeightRow(VOICE_DIMENSION_LABELS[key], voice[key])).join('')}
      </div>
      ${voice.style ? `<p class="thesis-block-hint">${esc(voice.style)}</p>` : ''}
      ${voice.avoid?.length
        ? `<p class="muted small">Evitar: ${voice.avoid.map((a) => esc(a)).join(' · ')}</p>`
        : ''}
    </div>
  `;
}

function renderThesisLimitsBlock(thesis: PositioningThesis, normalized: NormalizedThesis): string {
  const { hardBlocks, softAvoid } = normalized.limits;

  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Límites</h3>
      <div class="limits-split">
        <div>
          <h4 class="limits-title limits-title-hard">Bloquean publicación (${hardBlocks.length})</h4>
          ${hardBlocks.length
            ? `<ul class="policy-list">${hardBlocks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
            : '<p class="warn-strip">Sin límites duros: nada frena una afirmación arriesgada.</p>'}
        </div>
        <div>
          <h4 class="limits-title">Restan puntos (${softAvoid.length})</h4>
          ${softAvoid.length
            ? `<ul class="policy-list">${softAvoid.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
            : '<p class="muted small">Sin framings penalizados.</p>'}
        </div>
      </div>
      <div class="limits-split">
        <div>
          <h4 class="limits-title">Proof points (${thesis.proofPoints.length})</h4>
          ${thesis.proofPoints.length
            ? `<ul class="policy-list">${thesis.proofPoints.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
            : '<p class="warn-strip">Sin proof points: la tesis promete más de lo que puede respaldar.</p>'}
        </div>
      </div>
    </div>
  `;
}

function renderThesisCompletenessBlock(
  completeness: ThesisCompleteness,
  derived: boolean,
  clientId: string,
  thesisId: string
): string {
  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Estructura de la tesis</h3>
      <div class="completeness-head">
        <strong class="completeness-value">${completeness.score}<span>/100</span></strong>
        <div class="progress-track">
          <div class="progress-fill ${completeness.score >= 70 ? 'progress-green' : completeness.score >= 40 ? '' : 'progress-red'}" style="width: ${completeness.score}%"></div>
        </div>
      </div>
      ${derived
        ? '<p class="muted small">Los bloques sin declarar se derivan del texto libre para que el scoring siga funcionando.</p>'
        : '<p class="muted small">Todos los bloques están declarados explícitamente.</p>'}
      ${completeness.missing.length
        ? `<ul class="completeness-missing">
             ${completeness.missing.map((block) => `
               <li>
                 <strong>${esc(block.label)}</strong>
                 <span>${esc(block.hint)}</span>
                 <button type="button" class="btn btn-ghost btn-sm btn-focus-thesis-block"
                         data-client-id="${escAttr(clientId)}"
                         data-thesis-id="${escAttr(thesisId)}"
                         data-focus-block="${escAttr(block.key)}">
                   Completar
                 </button>
               </li>
             `).join('')}
           </ul>`
        : ''}
    </div>
  `;
}

const AUTHORITY_BAND_LABELS: Record<AuthorityBand, string> = {
  WEAK: 'Sin respaldo',
  EMERGING: 'Emergente',
  SOLID: 'Sólida',
  DOMINANT: 'Dominante',
};

function renderThesisLearningBlock(metrics: ThesisLearningMetrics): string {
  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Aprendizaje de esta tesis</h3>
      <p class="muted small">${esc(metrics.summary)}</p>
    </div>
  `;
}

function renderThesisAuthorityBlock(strength: ThesisStrength): string {
  const tone = strength.authorityScore >= 55 ? 'progress-green' : strength.authorityScore >= 30 ? '' : 'progress-red';

  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Authority Score</h3>
      <p class="thesis-block-hint">Cuánta autoridad real sostiene la promesa de esta tesis.</p>
      <div class="completeness-head">
        <strong class="completeness-value">${strength.authorityScore}<span>/100</span></strong>
        <div class="progress-track">
          <div class="progress-fill ${tone}" style="width: ${strength.authorityScore}%"></div>
        </div>
        <span class="badge ${strength.authorityScore >= 55 ? 'badge-ready' : 'badge-pending'}">
          ${esc(AUTHORITY_BAND_LABELS[strength.band])}
        </span>
      </div>
      <p class="muted small">${esc(strength.summary)}</p>

      <div class="authority-components">
        ${strength.components.map((c) => `
          <div class="authority-component">
            <div class="weight-row-head">
              <span class="weight-row-label">${esc(c.label)}</span>
              <strong class="weight-row-value">${c.points}/${c.maxPoints}</strong>
            </div>
            <div class="progress-track progress-track-sm">
              <div class="progress-fill ${c.score >= 60 ? 'progress-green' : c.score >= 30 ? '' : 'progress-red'}" style="width: ${c.score}%"></div>
            </div>
            <p class="weight-row-meta">${esc(c.detail)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderGapAction(item: PositioningGap['gaps'][number], clientId: string, thesisId: string): string {
  if (item.kind === 'TERRITORY' && item.evidenceCount === 0) {
    return `
      <button type="button" class="btn btn-secondary btn-sm btn-add-evidence-vault"
              data-client-id="${escAttr(clientId)}">
        Añadir evidencia
      </button>`;
  }
  if ((item.kind === 'TERRITORY' || item.kind === 'AUDIENCE') && item.contentCount === 0) {
    return `
      <button type="button" class="btn btn-secondary btn-sm btn-open-generate-content"
              data-client-id="${escAttr(clientId)}"
              data-thesis-id="${escAttr(thesisId)}"
              data-topic="${escAttr(item.label)}">
        Generar contenido
      </button>`;
  }
  const focus =
    item.kind === 'PERCEPTION' ? 'perceptionTarget' : item.kind === 'AUDIENCE' ? 'audiences' : 'territories';
  return `
    <button type="button" class="btn btn-ghost btn-sm btn-focus-thesis-block"
            data-client-id="${escAttr(clientId)}"
            data-thesis-id="${escAttr(thesisId)}"
            data-focus-block="${escAttr(focus)}">
      Completar en editor
    </button>`;
}

function renderPositioningGapBlock(gap: PositioningGap, clientId: string, thesisId: string): string {
  return `
    <div class="thesis-block">
      <h3 class="thesis-block-title">Brecha de posicionamiento</h3>
      <p class="thesis-block-hint">${esc(gap.summary)}</p>
      ${gap.gaps.length
        ? `<ul class="gap-list">
             ${gap.gaps.slice(0, 8).map((item) => `
               <li class="gap-item gap-item-${item.severity.toLowerCase()}">
                 <div class="gap-item-head">
                   <strong>${esc(item.label)}</strong>
                   <span class="gap-item-severity">${item.severity === 'HIGH' ? 'crítica' : item.severity === 'MEDIUM' ? 'media' : 'baja'}</span>
                 </div>
                 <p>${esc(item.detail)}</p>
                 <p class="gap-item-action">${esc(item.action)}</p>
                 ${renderGapAction(item, clientId, thesisId)}
               </li>
             `).join('')}
           </ul>`
        : '<p class="muted small">Sin brechas: cada territorio y audiencia tiene evidencia y contenido.</p>'}
    </div>
  `;
}

function renderEvidenceAssignment(
  evidence: EvidenceVaultItem[],
  selected: PositioningThesis | undefined,
  clientId: string
): string {
  if (!evidence.length) {
    return '<p class="empty-state">Vault vacío. Sin evidencia no se pueden sostener afirmaciones públicas.</p>';
  }

  const linked = selected ? evidence.filter((e) => e.associatedThesesIds?.includes(selected.id)) : [];
  const rest = selected ? evidence.filter((e) => !e.associatedThesesIds?.includes(selected.id)) : evidence;

  const row = (item: EvidenceVaultItem, isLinked: boolean) => `
    <div class="evidence-row">
      <div>
        <span class="badge badge-progress">${esc(item.type)}</span>
        <strong>${esc(item.title)}</strong>
        <p class="muted small">${esc(item.snippet)}</p>
        ${item.supports?.length
          ? `<p class="muted small">Demuestra: ${item.supports.map((s) => esc(s)).join(' · ')}</p>`
          : ''}
      </div>
      <div class="evidence-row-actions">
        <span class="badge ${item.verified ? 'badge-ready' : 'badge-pending'}">
          ${item.verified ? 'Verificada' : 'Sin verificar'}
        </span>
        <span class="muted small">autoridad ${evidenceAuthority(item)}</span>
        ${selected
          ? `<button type="button" class="btn btn-secondary btn-sm"
                     data-evidence-thesis-toggle="${esc(item.id)}"
                     data-thesis-id="${esc(selected.id)}"
                     data-client-id="${esc(clientId)}">
               ${isLinked ? 'Quitar de la tesis' : 'Asignar a la tesis'}
             </button>`
          : ''}
      </div>
    </div>
  `;

  return `
    ${selected
      ? `<h4 class="limits-title">Asignada a ${esc(selected.title)} (${linked.length})</h4>
         ${linked.length
           ? linked.map((item) => row(item, true)).join('')
           : '<p class="warn-strip">Ninguna evidencia sostiene esta tesis. El Authority Score se queda en cero.</p>'}
         <h4 class="limits-title">Resto del vault (${rest.length})</h4>`
      : ''}
    ${rest.length
      ? rest.slice(0, 12).map((item) => row(item, false)).join('')
      : '<p class="muted small">Todo el vault está conectado a esta tesis.</p>'}
  `;
}

function renderPositioning(
  client: Client,
  theses: PositioningThesis[],
  filters: WorkspaceFilters = {}
): string {
  const clientId = client.id;
  const ordered = sortThesesForBoard(theses);
  const selected =
    ordered.find((t) => t.id === filters.thesisId) ||
    ordered.find((t) => t.status === 'ACTIVE') ||
    ordered[0];
  const profile = dbService.getMasterProfile(clientId);
  const campaigns = dbService.getCampaignsByClient(clientId);
  const evidence = dbService.getEvidenceVaultByClient(clientId);
  const activeCount = ordered.filter((t) => t.status === 'ACTIVE').length;
  const publishedContent = dbService
    .getContentByClient(clientId)
    .filter((item) => item.status === 'PUBLISHED' || item.status === 'READY')
    .map((item) => ({ id: item.id, title: item.title, body: item.body }));

  const normalized = selected ? normalizeThesis(selected) : null;
  const completeness = selected ? thesisCompleteness(selected) : null;
  const strength = selected ? computeThesisStrength(selected, evidence) : null;
  const gap = selected ? computePositioningGap(selected, evidence, publishedContent) : null;
  const learning = selected
    ? computeThesisLearningMetrics({
        thesis: selected,
        signals: dbService.getSignalsByClient(clientId),
        outcomes: listSignalOutcomesForDisplay(clientId),
        content: dbService.getContentByClient(clientId),
        evidence,
      })
    : null;
  const activationCheck = selected ? canActivateThesis(selected) : null;

  return `
    <section class="thesis-board editorial-panel">
      <p class="section-kicker">Motor de posicionamiento</p>
      <p class="thesis-board-lead measure">
        ${ordered.length
          ? `${ordered.length} tesis registrada${ordered.length === 1 ? '' : 's'}, ${activeCount} activa${activeCount === 1 ? '' : 's'}. Cada tesis define su propia audiencia, territorio y objetivo.`
          : 'Sin tesis registrada. El radar no puede puntuar señales hasta que exista al menos una.'}
      </p>

      ${ordered.length
        ? `<div class="thesis-rail" role="tablist" aria-label="Tesis del cliente">
             ${ordered.map((t) => {
               const c = thesisCompleteness(t);
               const s = computeThesisStrength(t, evidence);
               const isSelected = selected?.id === t.id;
               return `
                 <button type="button"
                         class="thesis-chip${isSelected ? ' thesis-chip-active' : ''}"
                         role="tab"
                         aria-selected="${isSelected ? 'true' : 'false'}"
                         data-thesis-select="${esc(t.id)}">
                   <span class="thesis-chip-title">${esc(t.title)}</span>
                   <span class="thesis-chip-meta">
                     <span class="badge ${t.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}">${esc(t.status)}</span>
                     <span class="thesis-chip-score">autoridad ${s.authorityScore} · estructura ${c.score}</span>
                   </span>
                 </button>
               `;
             }).join('')}
           </div>`
        : ''}
    </section>

    ${selected && normalized && completeness && strength && gap
      ? `<section class="card thesis-detail">
           <div class="section-heading">
             <div class="section-heading-copy">
               <h2>${esc(selected.title)}</h2>
               <p>
                 ${esc(selected.status)} ·
                 ${selected.clientApprovalStatus === 'APPROVED' ? 'aprobada por el cliente' : 'pendiente del cliente'}
                 ${normalized.derived ? ' · estructura parcialmente derivada' : ''}
               </p>
             </div>
             <div class="row-actions">
               <button type="button" class="btn btn-secondary btn-sm btn-challenge-thesis"
                       data-client-id="${esc(clientId)}" data-thesis-id="${esc(selected.id)}">
                 Stress-test
               </button>
               ${activationCheck?.ok
                 ? `<button type="button" class="btn btn-success btn-sm btn-activate-thesis"
                            data-client-id="${esc(clientId)}" data-thesis-id="${esc(selected.id)}">
                      Activar tesis
                    </button>`
                 : selected.status === 'UNDER_REVIEW' && selected.clientApprovalStatus === 'APPROVED'
                   ? `<span class="muted small" title="${esc(activationCheck?.blockers.join(' · ') || '')}">Pendiente de activación</span>`
                   : ''}
               <button type="button" class="btn btn-primary btn-sm btn-edit-thesis"
                       data-client-id="${esc(clientId)}" data-thesis-id="${esc(selected.id)}">
                 Editar tesis
               </button>
             </div>
           </div>

           ${selected.status === 'DRAFT'
             ? '<p class="info-strip">Borrador · invisible para el cliente hasta que pulses «Enviar al cliente».</p>'
             : selected.status === 'UNDER_REVIEW'
               ? selected.clientApprovalStatus === 'APPROVED'
                 ? '<p class="info-strip">Aprobada por el cliente · pulsa «Activar tesis» para usarla en radar y scoring.</p>'
                 : '<p class="info-strip">En revisión del cliente · el radar no la usa hasta que esté ACTIVE.</p>'
               : ''}

           ${selected.clientApprovalStatus === 'CHANGES_REQUESTED' && selected.clientFeedback
             ? `<p class="warn-strip"><strong>Feedback del cliente:</strong> ${esc(selected.clientFeedback)}</p>`
             : selected.clientApprovalStatus === 'CHANGES_REQUESTED'
               ? '<p class="warn-strip">El cliente pidió cambios. Ajusta y vuelve a enviar.</p>'
               : ''}

           <div class="thesis-blocks">
             ${renderThesisIdentityBlock(selected, normalized)}
             ${renderThesisAuthorityBlock(strength)}
             ${learning ? renderThesisLearningBlock(learning) : ''}
             ${renderPositioningGapBlock(gap, clientId, selected.id)}
             ${renderThesisCompletenessBlock(completeness, normalized.derived, clientId, selected.id)}
             ${renderThesisAudienceBlock(normalized)}
             ${renderThesisTerritoryBlock(normalized)}
             ${renderThesisObjectiveBlock(normalized)}
             ${renderThesisVoiceBlock(normalized)}
             ${renderThesisLimitsBlock(selected, normalized)}
           </div>
         </section>`
      : `<section class="card">
           <p class="empty-state">Sin tesis registrada. Créala para activar el radar y el scoring.</p>
         </section>`}

    <details class="card disclosure" id="proof-wall-section">
      <summary>Pruebas y líneas de servicio</summary>
      <div class="disclosure-body content-stack">
        ${renderProofWall(clientId, { editable: true })}
        ${renderServiceLinesReadOnly(clientId)}
      </div>
    </details>

    <details class="card disclosure">
      <summary>Perfil maestro (${client.profileCompleteness || 0}% completo)</summary>
      <div class="disclosure-body content-stack">
        <div class="section-heading">
          <div class="section-heading-copy">
            <p class="muted small">Contexto que alimenta la voz de todo el contenido · onboarding ${esc(client.onboardingStatus)}</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-open-onboarding" data-client-id="${esc(clientId)}">
            Abrir asistente
          </button>
        </div>

        ${profile
          ? `
            <div class="field-block">
              <label class="form-label">Objetivo principal</label>
              <p>${esc(profile.goals.primaryGoal || 'sin definir')}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Audiencia declarada</label>
              <p>${esc(profile.audience.targetAudienceDescription || 'sin definir')}</p>
            </div>
            <div class="field-block">
              <label class="form-label">Tono preferido</label>
              <p>${esc(profile.voicePreferences.tone)}</p>
            </div>
            ${profile.education.length
              ? `<div class="field-block">
                   <label class="form-label">Formación</label>
                   <ul class="policy-list">${profile.education.map((e) => `<li>${esc(e.degree)}${e.institution ? ` — ${esc(e.institution)}` : ''}</li>`).join('')}</ul>
                 </div>`
              : ''}
          `
          : '<p class="empty-state">El cliente aún no ha completado el perfil.</p>'}
      </div>
    </details>

    <details class="card disclosure"${strength && strength.evidenceCount === 0 && evidence.length ? ' open' : ''}>
      <summary>Evidence vault (${evidence.length})${strength?.unassignedCount ? ` · ${strength.unassignedCount} sin asignar` : ''}</summary>
      <div class="disclosure-body content-stack">
        <div class="section-heading">
          <div class="section-heading-copy">
            <p class="muted small">Cada evidencia asignada a una tesis levanta su Authority Score.</p>
          </div>
          <button class="btn btn-secondary btn-sm btn-add-evidence-vault" id="btn-add-evidence-vault" data-client-id="${esc(clientId)}">
            + Evidencia
          </button>
        </div>

        ${renderEvidenceAssignment(evidence, selected, clientId)}
      </div>
    </details>

    ${campaigns.length
      ? `<details class="card disclosure">
           <summary>Campañas (${campaigns.length})</summary>
           <div class="disclosure-body content-stack">
             <p class="muted small">Cada campaña ejecuta una tesis. Las que no apuntan a la tesis seleccionada aparecen atenuadas.</p>
             ${campaigns.map((c) => {
               const pct = c.targetDeliverables ? Math.round((c.completedDeliverables / c.targetDeliverables) * 100) : 0;
               const ownedBySelected = selected ? c.thesisId === selected.id : false;
               return `
                 <div class="campaign-block${ownedBySelected ? '' : ' campaign-block-muted'}">
                   <div class="campaign-block-head">
                     <strong>${esc(c.name)}</strong>
                     <span class="muted">${c.completedDeliverables}/${c.targetDeliverables}</span>
                   </div>
                   <p class="muted small">${esc(c.description)}</p>
                   <div class="progress-track"><div class="progress-fill" style="width: ${pct}%"></div></div>
                 </div>
               `;
             }).join('')}
           </div>
         </details>`
      : ''}
  `;
}

// ==========================================
// Fuentes (ingesta por cliente)
// ==========================================

function renderRecommendedSources(
  client: Client,
  thesis: PositioningThesis | undefined,
  profile: ReturnType<typeof dbService.getMasterProfile>
): string {
  const clientId = client.id;
  const agentRun = runSourceDiscoveryAgent(client, thesis);
  const top = agentRun.recommendations.slice(0, 5);
  const activeSources = dbService.getSourcesByClient(clientId).filter((s) => s.status === 'ACTIVE').length;

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Agente de fuentes</h3>
          <p style="font-size: 0.9rem;">
            Recomendaciones automáticas (Google News, oficiales, Tavily). Actívalas en
            <button class="link-btn" data-tab="ws-sources">Fuentes →</button>
          </p>
        </div>
      </div>

      ${thesis
        ? `<div class="grid-2" style="margin-bottom: 1rem;">
             <div class="field-block">
               <label class="form-label">Tesis activa</label>
               <p><strong>${esc(thesis.title)}</strong> · ${esc(thesis.domain)}</p>
               <p class="muted small">Audiencia: ${esc(thesis.targetAudience)}</p>
             </div>
             ${profile?.audience.targetIndustries?.length
               ? `<div class="field-block">
                    <label class="form-label">Industrias objetivo</label>
                    <p>${esc(profile.audience.targetIndustries.join(', '))}</p>
                  </div>`
               : ''}
           </div>`
        : `<p class="warn-strip">
             Sin tesis activa. Define el posicionamiento antes de elegir fuentes.
             <button class="link-btn" data-tab="ws-positioning">Ir a Posicionamiento</button>
           </p>`}

      ${top.length
        ? `<div class="field-block">
             <label class="form-label">Top recomendaciones pendientes</label>
             <ul class="policy-list">
               ${top.map((s) => `
                 <li>
                   ${esc(s.name)}
                   <span class="badge ${s.priority === 'HIGH' ? 'badge-ready' : 'badge-progress'}">${esc(s.priority)}</span>
                   <span class="muted small">${esc(s.agentRationale.slice(0, 90))}…</span>
                 </li>
               `).join('')}
             </ul>
           </div>`
        : `<p class="muted small">Sin fuentes pendientes — revisa el radar o busca con Tavily.</p>`}

      <p class="muted small">
        ${activeSources
          ? `${activeSources} fuente(s) activa(s). ${agentRun.pendingCount} pendiente(s) por activar.`
          : 'Aún no hay fuentes registradas.'}
      </p>
    </section>
  `;
}

function renderSources(client: Client, thesis?: PositioningThesis): string {
  const clientId = client.id;
  const sources = dbService.getSourcesByClient(clientId);
  const signalsFromSources = dbService.getSignalsByClient(clientId).filter((s) => s.sourceId).length;
  const healthCounts = countUnhealthySources(sources, summarizeSourceHealth);

  return `
    <div class="info-strip">
      <span>
        Operación de ingesta para <strong>${esc(client.displayName)}</strong>:
        registra fuentes, ejecuta la recolección automática o añade señales manuales.
        El contexto de perfil y las sugerencias están en
        <button class="link-btn" data-tab="ws-positioning">Posicionamiento</button>.
      </span>
    </div>

    ${!ingestProxyReady()
      ? `<div class="info-strip warn" style="margin-bottom: 1rem;">
           <span>
             La ingesta RSS/YouTube no está disponible en este hosting (no hay proxy).
             Usa <strong>npm run dev</strong> en local, o configura Cloud Functions.
           </span>
         </div>`
      : ''}

    ${healthCounts.errors || healthCounts.degraded || healthCounts.paused
      ? `<div class="info-strip warn" style="margin-bottom: 1rem;">
           <span>
             ${healthCounts.errors ? `<strong>${healthCounts.errors}</strong> en error · ` : ''}
             ${healthCounts.degraded ? `<strong>${healthCounts.degraded}</strong> degradada(s)/vacía(s) · ` : ''}
             ${healthCounts.paused ? `<strong>${healthCounts.paused}</strong> pausada(s) — ` : ''}
             usa Pausar / Reactivar / Archivar en cada fila.
           </span>
         </div>`
      : ''}

    ${(() => {
      const presetId = detectIndustryPreset(client, thesis, buildProfileKeywords(client, thesis));
      const stack = getRecommendedStackForClient(client, thesis, buildProfileKeywords(client, thesis));
      const presetLabel = getIndustryPresetMeta(presetId).label;
      return `<div class="info-strip" style="margin-bottom: 1rem;">
           <span>
             <strong>Stack recomendado (${esc(presetLabel)}):</strong>
             ${stack.map((s) => esc(s)).join(' · ')}.
             Usa <strong>Activar top 3</strong> en el panel del agente.
           </span>
         </div>`;
    })()}

    ${!thesis
      ? `<p class="warn-strip">
           Sin tesis activa: el radar puntuará peor las señales.
           <button class="link-btn" data-tab="ws-positioning">Completar en Posicionamiento</button>
         </p>`
      : ''}

    <section class="grid-3">
      <div class="card stat-card">
        <p class="form-label">Fuentes activas</p>
        <h2>${sources.filter((s) => s.status === 'ACTIVE').length}</h2>
      </div>
      <div class="card stat-card">
        <p class="form-label">Señales capturadas</p>
        <h2>${signalsFromSources}</h2>
        <button class="link-btn" data-tab="ws-radar">Ver radar</button>
      </div>
      <div class="card stat-card">
        <p class="form-label">Tesis vinculada</p>
        <h2 style="font-size: 0.95rem;">${esc(thesis?.title?.slice(0, 40) || 'Sin definir')}${thesis && thesis.title.length > 40 ? '…' : ''}</h2>
        <button class="link-btn" data-tab="ws-positioning">Ver posicionamiento</button>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Ingesta manual</h3>
          <p style="font-size: 0.9rem;">Nota, enlace o clip que el cliente te envió fuera de los feeds.</p>
        </div>
      </div>
      <p class="muted" style="margin-bottom: 0.75rem;">
        Las señales manuales entran al radar con el mismo flujo: puntuar → curar → entregar.
      </p>
      <button id="btn-add-manual-signal-inline" class="btn btn-primary" data-client-id="${esc(clientId)}">
        + Registrar señal manual
      </button>
    </section>

    ${renderDiscoveryPanel(client, thesis)}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Fuentes registradas para este cliente</h3>
          <p style="font-size: 0.9rem;">Ingesta automática. Cada corrida filtra por perfil antes de crear señales.</p>
        </div>
      </div>

      ${sources.length
        ? sources.map((s) => renderSourceRow(s, clientId)).join('')
        : `<p class="empty-state">
             Este cliente no tiene fuentes todavía.
             Activa las sugerencias de arriba o registra una manualmente.
           </p>`}
    </section>
  `;
}

function renderSourceRow(source: Source, clientId: string): string {
  const linkedSignals = dbService.getSignalsByClient(clientId).filter((sig) => sig.sourceId === source.id).length;
  const isQuery = (source.url || '').includes('news.google.com/rss/search');
  const lastRun = source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString('es') : null;
  const health = summarizeSourceHealth(source);
  const tip = sourceHealthTip(source, health);
  const actions = sourceRemediationActions(source, health);

  const healthBadgeClass =
    health.status === 'HEALTHY'
      ? 'badge-ready'
      : health.status === 'ERROR'
        ? 'badge-danger'
        : health.status === 'EMPTY'
          ? 'badge-pending'
          : 'badge-progress';

  const statusLabel =
    source.status === 'ACTIVE'
      ? 'Activa'
      : source.status === 'PAUSED'
        ? 'Pausada'
        : source.status === 'ERROR'
          ? 'Error'
          : source.status;

  const statusBadge = source.status === 'ERROR'
    ? '<span class="badge badge-danger">ERROR</span>'
    : `<span class="badge ${source.status === 'ACTIVE' ? 'badge-ready' : 'badge-pending'}">${esc(statusLabel)}</span>`;

  return `
    <div class="source-row ${source.status === 'ERROR' ? 'source-row-error' : ''} ${source.status === 'PAUSED' ? 'source-row-paused' : ''}">
      <div style="min-width: 260px; flex: 1;">
        <strong>${esc(source.name)}</strong>
        <span class="badge badge-progress">${esc(source.type)}</span>
        ${isQuery ? '<span class="badge badge-progress">CONSULTA</span>' : ''}
        ${statusBadge}
        <span class="badge ${healthBadgeClass}" title="Salud del feed">${esc(health.label)}</span>
        <p class="form-label" style="word-break: break-all;">
          ${esc((source.url || 'Entrada manual').slice(0, 110))}${(source.url || '').length > 110 ? '…' : ''}
        </p>
        <p class="muted small">
          cada ${source.fetchIntervalMinutes} min · ${linkedSignals} señal(es) acumulada(s)
          ${lastRun ? ` · última corrida ${esc(lastRun)}` : ' · sin correr todavía'}
        </p>
        ${source.lastRunFetched !== undefined
          ? `<p class="muted small">
               Última corrida: ${source.lastRunFetched} leída(s), <strong>${source.lastRunAccepted || 0} aceptada(s)</strong>,
               ${source.lastRunRejected || 0} filtrada(s) por ruido
             </p>`
          : ''}
        ${source.lastError ? `<p class="source-error-text">Fallo: ${esc(labelSourceRunError(source.lastError))}</p>` : ''}
        ${tip ? `<p class="muted small source-health-tip">${esc(tip)}</p>` : ''}
      </div>
      <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: flex-start;">
        ${actions.includes('probe') && source.url
          ? `<button class="btn btn-ghost btn-sm btn-probe-source" data-source-id="${esc(source.id)}">Probar feed</button>`
          : ''}
        ${actions.includes('ingest') && source.url
          ? `<button class="btn btn-secondary btn-sm btn-poll-one-source" data-source-id="${esc(source.id)}">Ingerir ahora</button>`
          : ''}
        ${actions.includes('pause')
          ? `<button class="btn btn-ghost btn-sm btn-pause-source" data-source-id="${esc(source.id)}">Pausar</button>`
          : ''}
        ${actions.includes('resume')
          ? `<button class="btn btn-secondary btn-sm btn-resume-source" data-source-id="${esc(source.id)}">Reactivar</button>`
          : ''}
        ${actions.includes('archive')
          ? `<button class="btn btn-ghost btn-sm btn-archive-source" data-source-id="${esc(source.id)}">Archivar</button>`
          : ''}
      </div>
    </div>
  `;
}

function discoveryKindBadge(c: { key: string; kind: string }): string {
  if (c.key.startsWith('curated_')) return 'TOP 3';
  if (c.kind === 'OFFICIAL') return 'OFICIAL';
  if (c.kind === 'TAVILY') return 'TAVILY';
  if (c.kind === 'YOUTUBE') return 'YOUTUBE';
  if (c.kind === 'SOCIAL') return 'SOCIAL';
  if (c.kind === 'ACADEMIC') return 'ACADÉMICO';
  return 'CONSULTA';
}

function discoveryKindBadgeClass(kind: string): string {
  if (kind === 'OFFICIAL' || kind === 'TAVILY' || kind === 'ACADEMIC' || kind === 'YOUTUBE') return 'badge-ready';
  if (kind === 'SOCIAL') return 'badge-progress';
  return 'badge-progress';
}

function renderDiscoveryPanel(client: Client, thesis?: PositioningThesis): string {
  const clientId = client.id;
  const cached = loadLastAgentRun(clientId);
  const agentRun =
    cached && isAgentRunCurrent(cached, client, thesis)
      ? cached
      : runSourceDiscoveryAgent(client, thesis);
  const pending = agentRun.recommendations;
  const keywords = buildProfileKeywords(client, thesis);
  const terms = [...keywords.coreEn, ...keywords.coreEs];
  const presetId = detectIndustryPreset(client, thesis, keywords);
  const presetMeta = getIndustryPresetMeta(presetId);
  const scannedLabel = new Date(agentRun.scannedAt).toLocaleString('es');
  const existingUrls = new Set(
    dbService.getSourcesByClient(clientId).map((s) => normalizeSourceUrl(s.url || ''))
  );
  const curatedPending = buildCuratedPresetsForProfile(client, thesis, keywords).filter(
    (c) => !existingUrls.has(normalizeSourceUrl(c.url))
  ).length;
  const extendedPending = pendingExtendedSources(client, thesis).length;
  const tavilyBadge = agentRun.tavilyUsed
    ? `<span class="badge badge-ready">Tavily activo</span>`
    : agentRun.tavilyError === 'TAVILY_KEY_MISSING'
      ? `<span class="badge badge-pending">Tavily sin configurar</span>`
      : '';

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Agente de descubrimiento de fuentes</h3>
          <p style="font-size: 0.9rem;">
            Escaneo automático: Google News, feeds oficiales, Tavily, redes sociales (LinkedIn/X), YouTube y fuentes académicas según el perfil de ${esc(client.displayName)}.
          </p>
          <p class="muted small" style="margin-top: 0.35rem;">
            Preset: <strong>${esc(presetMeta.label)}</strong> · Último escaneo: ${esc(scannedLabel)} · ${agentRun.registeredCount} activa(s) · ${pending.length} pendiente(s)
            ${tavilyBadge ? ` · ${tavilyBadge}` : ''}
          </p>
        </div>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
          ${curatedPending
            ? `<button id="btn-add-curated-top3" class="btn btn-primary btn-sm" data-client-id="${esc(clientId)}">
                 Activar top 3 (${esc(presetMeta.media.map((m) => m.host.split('.')[0]).join(' · '))})
               </button>`
            : ''}
          ${extendedPending
            ? `<button id="btn-add-extended-sources" class="btn btn-secondary btn-sm" data-client-id="${esc(clientId)}">
                 Social + YouTube + académico (${extendedPending})
               </button>`
            : ''}
          <button id="btn-tavily-rescan" class="btn btn-secondary btn-sm" data-client-id="${esc(clientId)}">
            Buscar con Tavily
          </button>
          ${pending.length
            ? `<button id="btn-add-all-discovered" class="btn btn-primary btn-sm" data-client-id="${esc(clientId)}">
                 Activar ${pending.length} e ingerir
               </button>`
            : '<span class="badge badge-ready">Todas activas</span>'}
        </div>
      </div>

      ${terms.length
        ? `<div class="field-block">
             <label class="form-label">Términos detectados en el perfil</label>
             <div class="discovery-terms">
               ${terms.map((t) => `<span class="discovery-term">${esc(t)}</span>`).join('')}
             </div>
           </div>`
        : `<p class="warn-strip">
             No se pudieron derivar términos. Completa el dominio de la tesis en
             <button class="link-btn" data-tab="ws-positioning">Posicionamiento</button>.
           </p>`}

      ${pending.length
        ? pending.map((c) => `
            <div class="discovery-row">
              <div style="min-width: 240px; flex: 1;">
                <strong>${esc(c.name)}</strong>
                <span class="badge ${discoveryKindBadgeClass(c.kind)}">
                  ${esc(discoveryKindBadge(c))}
                </span>
                <span class="badge ${c.priority === 'HIGH' ? 'badge-ready' : c.priority === 'MEDIUM' ? 'badge-progress' : 'badge-pending'}">
                  ${esc(c.priority)}
                </span>
                <p class="muted small">${esc(c.agentRationale)}</p>
              </div>
              <button class="btn btn-secondary btn-sm btn-add-discovered-source"
                      data-client-id="${esc(clientId)}"
                      data-discovery-key="${esc(c.key)}">
                Activar
              </button>
            </div>
          `).join('')
        : `<p class="muted small">
             Las fuentes propuestas ya están registradas. La ingesta automática corre cada 5 min según el intervalo configurado.
             Pulsa <strong>Ingerir todas</strong> para forzar una corrida ahora.
           </p>`}
    </section>
  `;
}

// ==========================================
// Tareas asignadas al cliente
// ==========================================

function renderProductionOverview(client: Client, filters: WorkspaceFilters = {}): string {
  const contents = dbService
    .getContentByClient(client.id)
    .filter((item) => !filters.thesisId || item.thesisId === filters.thesisId);
  const tasks = dbService
    .getTasksByClient(client.id)
    .filter((task) => !filters.thesisId || task.thesisId === filters.thesisId);
  const openTasks = tasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED');
  const managerReview = contents.filter((item) => item.status === 'AI_GENERATED' || item.status === 'DRAFT');
  const clientReview = contents.filter((item) => item.status === 'CLIENT_REVIEW' || item.status === 'CHANGES_REQUESTED');
  const ready = contents.filter((item) => item.status === 'READY' || item.status === 'PUBLISHED');
  const claimIssues = contents.filter(
    (item) => item.claimSafety && item.claimSafety.verdict !== 'PASS'
  ).length;

  return `
    <section class="metric-band" aria-label="Estado de producción">
      <div class="metric-band-item"><span class="metric-band-label">Por hacer</span><strong class="metric-band-value">${openTasks.length}</strong><span class="metric-band-hint">tareas activas</span></div>
      <div class="metric-band-item"><span class="metric-band-label">Revisión manager</span><strong class="metric-band-value">${managerReview.length}</strong><span class="metric-band-hint">borradores internos</span></div>
      <div class="metric-band-item"><span class="metric-band-label">Con el cliente</span><strong class="metric-band-value">${clientReview.length}</strong><span class="metric-band-hint">aprobación o ajustes</span></div>
      <div class="metric-band-item"><span class="metric-band-label">Claim safety</span><strong class="metric-band-value">${claimIssues}</strong><span class="metric-band-hint">REVIEW / BLOCK</span></div>
      <div class="metric-band-item"><span class="metric-band-label">Listo / archivo</span><strong class="metric-band-value">${ready.length}</strong><span class="metric-band-hint">contenido utilizable</span></div>
    </section>
  `;
}

function renderTasks(client: Client, filters: WorkspaceFilters = {}): string {
  const clientId = client.id;
  const allTasks = dbService
    .getTasksByClient(clientId)
    .filter((task) => !filters.thesisId || task.thesisId === filters.thesisId);
  const openTasks = allTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const doneTasks = allTasks.filter((t) => t.status === 'COMPLETED');

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>Tareas activas</h3>
          <p>Acciones que aparecen de inmediato en “Esta semana” para ${esc(client.displayName)}.</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-tab="ws-deliver">Ver origen en Entregar</button>
      </div>

      ${openTasks.length
        ? openTasks.map((task) => renderTaskRow(task, true)).join('')
        : `<p class="empty-state">
             No hay tareas abiertas. Pulsa <strong>+ Asignar tarea</strong> arriba para crear una.
           </p>`}
    </section>

    ${doneTasks.length
      ? `<details class="card disclosure">
           <summary>Archivo de tareas completadas (${doneTasks.length})</summary>
           <div class="disclosure-body">${doneTasks.slice(0, 8).map((task) => renderTaskRow(task, false)).join('')}</div>
         </details>`
      : ''}
  `;
}

/**
 * Cierra el círculo del flujo: muestra de qué ítem curado y de qué briefing
 * nació la tarea, junto con la justificación que se escribió al decidirlo.
 */
function renderTaskProvenance(task: Task): string {
  const entry = task.curationEntryId ? dbService.getCurationById(task.curationEntryId) : undefined;
  const pkg = task.deliveryPackageId ? dbService.getDeliveryById(task.deliveryPackageId) : undefined;
  if (!entry && !pkg) return '';

  const stage = entry
    ? deriveWorkStage({ entry, pkg, task })
    : task.status === 'COMPLETED' ? 'completado' : 'entregado';

  return `
    <div class="task-provenance">
      <span class="badge ${WORK_STAGE_BADGE[stage]}">${WORK_STAGE_LABELS[stage]}</span>
      ${pkg ? `<span class="muted small">${icon('send', 12)} ${esc(pkg.title)}</span>` : ''}
      ${entry?.managerRationale
        ? `<p class="task-provenance-why"><strong>Por qué se pidió:</strong> ${esc(entry.managerRationale)}</p>`
        : ''}
      ${entry?.sourceUrl
        ? `<a class="small" href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente original</a>`
        : ''}
    </div>
  `;
}

function renderTaskRecording(task: Task): string {
  if (task.type !== 'RECORD_VIDEO' || !isPlayableRecordingRef(task.evidenceUrl)) return '';
  const pipeline = task.contentItemId
    ? dbService.getContentById(task.contentItemId)?.pipelineStatus
    : undefined;
  return `
    <div class="task-recording-block" data-recording-task-id="${esc(task.id)}">
      ${pipeline === 'manager_finalizing'
        ? '<span class="badge badge-ready">Video recibido · pendiente de revisión</span>'
        : ''}
      <video
        class="task-recording-video"
        controls
        playsinline
        preload="metadata"
        data-task-id="${esc(task.id)}"
      ></video>
      <div class="task-recording-actions">
        <button type="button" class="btn btn-secondary btn-sm btn-download-recording" data-task-id="${esc(task.id)}">
          Descargar video
        </button>
        <label class="btn btn-ghost btn-sm btn-reupload-recording">
          Re-subir versión
          <input
            type="file"
            accept="video/*"
            class="sr-only input-reupload-recording"
            data-task-id="${esc(task.id)}"
          />
        </label>
      </div>
      ${task.clientNotes ? `<p class="muted small">${esc(task.clientNotes)}</p>` : ''}
    </div>
  `;
}

function taskPrimaryActionLabel(type: TaskType): string {
  switch (type) {
    case 'RECORD_VIDEO':
      return 'Abrir teleprompter';
    case 'REVIEW_ARTICLE':
      return 'Revisar artículo';
    case 'APPROVE_OPPORTUNITY':
      return 'Ver oportunidad';
    case 'SUBMIT_INFO':
      return 'Abrir lectura';
    default:
      return 'Abrir';
  }
}

function renderTaskRow(task: Task, showActions: boolean): string {
  const overdue = task.deadline && new Date(task.deadline).getTime() < Date.now();
  return `
    <div class="task-row ${overdue ? 'task-overdue' : ''}">
      <div class="task-row-main btn-open-task-action" data-task-id="${esc(task.id)}" role="button" tabindex="0">
        <div class="task-row-title">
          <span class="badge badge-progress">${TASK_TYPE_LABELS[task.type]}</span>
          <strong>${esc(task.title)}</strong>
          <span class="badge ${task.status === 'COMPLETED' ? 'badge-ready' : 'badge-pending'}">
            ${TASK_STATUS_LABELS[task.status]}
          </span>
        </div>
        <p class="task-row-desc">${esc(task.description)}</p>
        <p class="muted small">
          ~${task.estimatedMinutes} min
          ${task.deadline ? ` · límite ${new Date(task.deadline).toLocaleDateString('es')}` : ''}
          ${task.completedAt ? ` · completada ${new Date(task.completedAt).toLocaleDateString('es')}` : ''}
        </p>
        ${renderTaskProvenance(task)}
        ${renderTaskRecording(task)}
      </div>
      ${showActions
        ? `<div class="task-row-actions">
             <button type="button" class="btn btn-primary btn-sm btn-open-task-action" data-task-id="${esc(task.id)}">
               ${esc(taskPrimaryActionLabel(task.type))}
             </button>
             <button type="button" class="btn btn-secondary btn-sm btn-cancel-task" data-task-id="${esc(task.id)}">Cancelar</button>
           </div>`
        : `<div class="task-row-actions">
             <button type="button" class="btn btn-secondary btn-sm btn-open-task-action" data-task-id="${esc(task.id)}">
               ${esc(taskPrimaryActionLabel(task.type))}
             </button>
           </div>`}
    </div>
  `;
}

// ==========================================
// Resultados
// ==========================================

function renderResults(client: Client): string {
  const results = dbService.getResultsByClient(client.id);

  return `
    ${renderKpiSummaryTiles(client.id)}
    ${renderKpiWeeklyChart(client.id, 'KPIs semanales — cliente')}

    <section class="card">
      <div class="card-header">
        <div>
          <h3>Resultados registrados</h3>
          <p style="font-size: 0.9rem;">Métricas de publicaciones y apariciones. Alimentan el diagnóstico de imagen.</p>
        </div>
      </div>

      ${results.length
        ? results.map((r) => `
          <div class="result-row">
            <div>
              <strong>${esc(r.title)}</strong>
              <p class="muted small">${esc(r.channel)} · ${new Date(r.createdAt).toLocaleDateString('es')}</p>
              ${r.notes ? `<p class="muted small">${esc(r.notes)}</p>` : ''}
            </div>
            <div class="result-metric">
              <span class="result-value">${r.metricValue}</span>
              <span class="muted small">${esc(r.metricLabel)}</span>
            </div>
            ${r.addedToEvidence
              ? '<span class="badge badge-ready">En vault</span>'
              : `<button class="btn btn-secondary btn-sm btn-result-to-evidence" data-result-id="${esc(r.id)}">A evidencia</button>`}
          </div>
        `).join('')
        : '<p class="empty-state">Sin resultados registrados. El cliente puede añadirlos desde su portal.</p>'}
    </section>
  `;
}

export { DESTINATION_LABELS };
