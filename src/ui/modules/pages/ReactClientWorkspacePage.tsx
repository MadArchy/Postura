/**
 * SPEC-010 · React ClientWorkspace (wave 3, T-010-305) — HYBRID.
 *
 * Authority: presentation + intent only.
 *
 * The legacy file is 2,562 lines rendering seven tabs from one function. This is
 * the decomposed panel tree the task asks for: one component per tab, each with
 * its own declared read source and its own command disposition.
 *
 * READ SOURCES — one per panel:
 *   canonical      (SPEC-008) signal outcomes · (SPEC-003) strategic briefs
 *   compatibility  radar signals, curation/delivery, sources, tasks
 *
 * CANONICAL COMMANDS migrated:
 *   - signal outcome "¿sirvió?" → `registerSignalOutcomeIntent` (SPEC-008)
 *   - approve Strategic Brief   → `approveStrategicBrief` (SPEC-003)
 *   - #18 send delivery package → `SendDeliveryPackage` (P7)
 *   - #27 assign/cancel task    → `AssignClientTask` / `CancelClientTask` (P8 MANUAL)
 *   - #20 discard signal        → `DiscardSignal` (P9)
 *   - #21 radar send-to-curation → `AddSignalToCuration` + `MarkSignalSaved` (P9)
 *   - #21 advisor click-only    → `AddAdviceActionToCuration` on positioning
 *   - #14 decide curation       → `DecideCuration` (P10)
 *   - #15 propose angle         → `ProposeAngle` (P11)
 *   - #16 remove/reopen curation → `RemoveCuration` / `ReopenCuration`
 *   - CR-2 brief create         → `createBriefFromCurationEntry` (P12)
 *   - #17 delivery assembly     → EnsureDraft/Add/Metadata/Remove/Discard (P13)
 *   - H06 bulk "Puntuar todas"  → `radarScoreSignalsPresentation` (R1, ADMIN only)
 * Outcome/brief/#18/#27/#20/#21-radar/#21-advisor/#14/#15/#12/#17/H06 change the caller only.
 * #22 per-signal score/investigate, #33 composite
 * recommendation→task path, and recordings remain legacy.
 *   - #31 save existing content → `SaveContentDraft` (P16) on ws-production
 *   - #8/#24 register source → `RegisterSource` on ws-sources
 *   - #9 poll/ingest → `PollRegisteredSource` / `PollAllActiveSources` on ws-sources
 *   - #26 manual signal → `RegisterManualSignal` on ws-sources
 *
 * BLOCKED, left legacy — the large majority. #22 per-signal score UI and
 * investigate agents remain;
 * #25 source lifecycle (pause/reactivate/archive/test-feed), discovery/Tavily,
 * #33 recommendation→task composite, evidence assignment and content generation
 * all write business state with no React parity yet (AUDIT010-09).
 *
 * DELIBERATELY NOT REPRODUCED — the legacy radar and sources tabs call
 * `runSourceDiscoveryAgent` during render (`ClientWorkspace:1983`, `:2247`), so
 * merely opening a tab runs an agent. That is an EFFECT_FIRST path: it is not
 * migrated, and the recommendation/discovery surfaces stay legacy-only.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSession } from '../../providers/SessionProvider';
import { narrowToClient } from '../../query/tenantScope';
import {
  useAddAdviceActionToCuration,
  useApproveBrief,
  useAssignClientTaskManual,
  useCancelClientTask,
  useAddCurationToDelivery,
  useCreateBriefFromCuration,
  useDecideCuration,
  useDiscardDraftDelivery,
  useEnsureDraftDelivery,
  useProposeAngle,
  useRemoveCuration,
  useReopenCuration,
  useRemoveDeliveryItemFromDelivery,
  useUpdateDeliveryPackageMetadata,
  useDiscardRadarSignal,
  useRadarPendingScoring,
  useRegisterSignalOutcome,
  useSendSignalToCuration,
  useSignalOutcomes,
  useStrategicBriefs,
  useWorkspaceAdvice,
  useWorkspaceContent,
  useWorkspaceDeliver,
  useWorkspaceRadar,
  usePollAllActiveSources,
  usePollRegisteredSource,
  useRegisterManualSignal,
  useRegisterSource,
  useWorkspaceSources,
  useWorkspaceTasks,
} from '../../hooks/useWave3Data';
import { curationDestinationToAuthorizedAction } from '../../../domain/briefConsumerCore';
import type { CurationDestination, SourceType, TaskType } from '../../../types';
import { ReactKpiWeeklyChart } from '../Kpi/ReactKpiWeeklyChart';
import { ReactMasterDossierPanel } from '../MasterDossier/ReactMasterDossierPanel';
import { ReactProofWallPanel } from '../ProofWall/ReactProofWallPanel';
import { ReactThesisEditorPage } from './ReactThesisEditorPage';
import { ReactContentEditorModal, ReactContentPreviewModal, ReactDeliveryPreviewModal } from './modals/ReactModals';
import { ReactClaimSafetyBadge, ReactClaimSafetyPanel } from '../ClaimSafety/ReactClaimSafetyPanel';
import { ReactPageHeader, ReactTabHeader } from '../PageHeader/ReactPageHeader';
import { LegacyHandoff, PanelState } from './LegacyHandoff';
import { ReactTaskRecordingBlock } from './ReactTaskRecordingBlock';

export type WorkspaceTab =
  | 'radar'
  | 'deliver'
  | 'positioning'
  | 'sources'
  | 'tasks'
  | 'results'
  | 'briefs'
  | 'production';

const WORKSPACE_HEADER_TAB: Record<Exclude<WorkspaceTab, 'briefs'>, string> = {
  radar: 'ws-radar',
  deliver: 'ws-deliver',
  sources: 'ws-sources',
  tasks: 'ws-tasks',
  results: 'ws-results',
  positioning: 'ws-positioning',
  production: 'ws-production',
};

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'RECORD_VIDEO', label: 'Grabar video' },
  { value: 'REVIEW_ARTICLE', label: 'Revisar artículo' },
  { value: 'APPROVE_OPPORTUNITY', label: 'Aprobar oportunidad' },
  { value: 'SUBMIT_INFO', label: 'Enviar información' },
];
/* ------------------------------------------------------------------ *
 * Radar — compatibility read + signal outcome + #20/#21 radar writes (P9)
 *         + H06 bulk pending scoring (R1)
 * ------------------------------------------------------------------ */

function RadarPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
  const { tenantScope, isAdmin } = useSession();
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
  const radar = useWorkspaceRadar(scope);
  const outcomes = useSignalOutcomes(scope);
  const register = useRegisterSignalOutcome(scope);
  const discard = useDiscardRadarSignal(scope);
  const sendToCuration = useSendSignalToCuration(scope);
  const pendingScoring = useRadarPendingScoring(scope);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  if (!scope) {
    return (
      <PanelState
        kind="no-scope"
        message="Selecciona un cliente en el workspace para ver el radar."
        testId="react-ws-radar-no-client"
      />
    );
  }

  if (radar.isLoading) {
    return <PanelState kind="loading" message="Cargando radar…" testId="react-ws-radar-loading" />;
  }
  if (radar.isError) {
    return (
      <PanelState kind="error" message="No se pudo cargar el radar." testId="react-ws-radar-error" />
    );
  }

  const data = radar.data ?? {
    signals: [],
    activeThesisCount: 0,
    canScore: false,
    totalSignals: 0,
    newSignals: 0,
  };
  const outcomeBySignal = new Map((outcomes.data ?? []).map((o) => [o.signalId, o]));
  const busy =
    register.isPending ||
    discard.isPending ||
    sendToCuration.isPending ||
    pendingScoring.isPending;
  const unscoredCount = data.signals.filter(
    (s) => s.score === null && s.status !== 'DISCARDED'
  ).length;

  const onScorePending = async () => {
    if (busy) return;
    const result = await pendingScoring.mutateAsync();
    setMessage(
      result.ok && result.scored > 0
        ? { kind: 'success', text: result.message }
        : { kind: 'error', text: result.message }
    );
  };

  const submit = async (
    signalId: string,
    kind: 'USEFUL' | 'NOT_USEFUL',
    thesisId: string | null
  ) => {
    const result = await register.mutateAsync({ signalId, kind, thesisId });
    setMessage(
      result.ok
        ? { kind: 'success', text: 'Resultado registrado.' }
        : { kind: 'error', text: result.message }
    );
  };

  const onDiscard = async (signalId: string) => {
    const result = await discard.mutateAsync({ signalId });
    setMessage(
      result.ok
        ? { kind: 'success', text: result.message }
        : { kind: 'error', text: result.message }
    );
  };

  const onSendToCuration = async (signalId: string) => {
    const result = await sendToCuration.mutateAsync({ signalId });
    setMessage(
      result.ok
        ? { kind: 'success', text: result.message }
        : { kind: 'error', text: result.message }
    );
  };

  return (
    <div data-testid="react-ws-radar">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{data.totalSignals}</span>
          <span className="stat-label">Señales</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{data.newSignals}</span>
          <span className="stat-label">Sin revisar</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value" data-testid="react-ws-active-theses">
            {data.activeThesisCount}
          </span>
          <span className="stat-label">Tesis activas</span>
        </div>
      </div>

      {/* Mirrors the legacy rule: scoring needs any ACTIVE thesis, not a primary one. */}
      {!data.canScore ? (
        <p className="muted small" data-testid="react-ws-cannot-score">
          Sin tesis activa no se puede puntuar ninguna señal.
        </p>
      ) : isAdmin && unscoredCount > 0 ? (
        <div className="info-strip" data-testid="react-ws-radar-pending-strip">
          <span data-testid="react-ws-radar-unscored-count">
            {unscoredCount} señal(es) sin puntuar.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void onScorePending()}
            data-testid="react-ws-radar-score-pending"
          >
            {pendingScoring.isPending ? 'Puntuando…' : 'Puntuar todas'}
          </button>
        </div>
      ) : null}

      {data.signals.length ? (
        <ul className="signal-list" data-testid="react-ws-signal-list">
          {data.signals.map((signal) => {
            const outcome = outcomeBySignal.get(signal.id);
            return (
              <li className="signal-card" key={signal.id}>
                <div>
                  <strong>{signal.title}</strong>
                  <p className="muted small">
                    {signal.source} · {signal.status}
                    {signal.priorityBand ? ` · ${signal.priorityBand}` : ''}
                    {signal.score !== null ? ` · score ${signal.score}` : ''}
                  </p>
                  {/* Attribution is shown only when routing decided it. */}
                  <p className="muted small">
                    {signal.routingState === 'CLEAR' && signal.thesisId
                      ? `Tesis asignada: ${signal.thesisId}`
                      : signal.routingState === 'CONTESTED'
                        ? 'Atribución en disputa — decidirla todavía no está disponible en esta interfaz'
                        : 'Sin tesis estratégica asignada'}
                  </p>
                  {signal.inCuration ? (
                    <span className="badge badge-ready">En entrega</span>
                  ) : null}
                </div>

                <div className="signal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void onDiscard(signal.id)}
                    data-testid={`react-ws-discard-${signal.id}`}
                  >
                    Descartar
                  </button>
                  {signal.inCuration ? (
                    <span className="badge badge-ready">En preparación</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => void onSendToCuration(signal.id)}
                      data-testid={`react-ws-send-curation-${signal.id}`}
                    >
                      Añadir a entrega
                    </button>
                  )}
                </div>

                <div className="signal-outcome-controls">
                  {outcome ? (
                    <span className="badge badge-ready" data-testid={`react-ws-outcome-${signal.id}`}>
                      {outcome.kind === 'USEFUL' ? 'Sirvió' : 'No sirvió'}
                    </span>
                  ) : (
                    <>
                      <span className="muted small">¿Sirvió?</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void submit(signal.id, 'USEFUL', signal.thesisId)}
                        data-testid={`react-ws-useful-${signal.id}`}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void submit(signal.id, 'NOT_USEFUL', signal.thesisId)}
                      >
                        No
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-radar-empty">
          Sin señales registradas.
        </p>
      )}

      {message ? (
        <p
          className={message.kind === 'error' ? 'form-error' : 'form-success'}
          role="status"
          data-testid={
            message.kind === 'error' ? 'react-ws-radar-error-msg' : 'react-ws-radar-success'
          }
        >
          {message.text}
        </p>
      ) : null}

      <LegacyHandoff
        actions={['investigarlas', 'las fuentes recomendadas']}
        testId="react-ws-radar-handoff"
      />
    </div>
  );
}

const CURATION_DESTINATION_LABELS: Record<CurationDestination, string> = {
  TASK_VIDEO: 'Tarea: grabar video',
  TASK_ARTICLE: 'Tarea: revisar artículo',
  OPPORTUNITY: 'Oportunidad de escenario',
  REFERENCE_READING: 'Lectura de referencia',
  EVIDENCE: 'Guardar como evidencia',
  DISCARD: 'Descartado',
};

const CURATION_DESTINATIONS = Object.keys(
  CURATION_DESTINATION_LABELS
) as CurationDestination[];

/* ------------------------------------------------------------------ *
 * Deliver — #14 decide native (P10); #18 send native (P7); #15–#17 remain legacy
 * ------------------------------------------------------------------ */

function PendingCurationDecideForm({
  entryId,
  busy,
  onSubmit,
}: {
  entryId: string;
  busy: boolean;
  onSubmit: (destination: CurationDestination, rationale: string) => Promise<void>;
}) {
  const [destination, setDestination] = useState<CurationDestination | ''>('');
  const [rationale, setRationale] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!destination) return;
    if (rationale.trim().length < 10) return;
    void onSubmit(destination, rationale.trim());
  };

  return (
    <form
      className="curation-decide-form"
      data-testid={`react-ws-decide-form-${entryId}`}
      onSubmit={handleSubmit}
    >
      <div className="form-group">
        <label className="form-label" htmlFor={`dest-${entryId}`}>
          Destino
        </label>
        <select
          id={`dest-${entryId}`}
          className="form-select"
          required
          disabled={busy}
          value={destination}
          onChange={(e) => setDestination(e.target.value as CurationDestination | '')}
          data-testid={`react-ws-decide-destination-${entryId}`}
        >
          <option value="">Elige qué hacer con esto…</option>
          {CURATION_DESTINATIONS.map((d) => (
            <option key={d} value={d}>
              {CURATION_DESTINATION_LABELS[d]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor={`why-${entryId}`}>
          Por qué (queda en auditoría)
        </label>
        <textarea
          id={`why-${entryId}`}
          className="form-input"
          rows={2}
          minLength={10}
          required
          disabled={busy}
          placeholder="Ej.: refuerza el proof point de gobernanza de IA y responde una duda real de la audiencia."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          data-testid={`react-ws-decide-rationale-${entryId}`}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={busy || !destination || rationale.trim().length < 10}
        data-testid={`react-ws-decide-submit-${entryId}`}
      >
        Confirmar destino
      </button>
    </form>
  );
}

function DeliverPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
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
  const { data, isLoading, isError } = useWorkspaceDeliver(scope);
  const decide = useDecideCuration(scope);
  const removeCuration = useRemoveCuration(scope);
  const reopenCuration = useReopenCuration(scope);
  const propose = useProposeAngle(scope);
  const createBrief = useCreateBriefFromCuration(scope);
  const ensureDraft = useEnsureDraftDelivery(scope);
  const addToDelivery = useAddCurationToDelivery(scope);
  const updateMetadata = useUpdateDeliveryPackageMetadata(scope);
  const removeItem = useRemoveDeliveryItemFromDelivery(scope);
  const discardDraft = useDiscardDraftDelivery(scope);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [creatingBriefId, setCreatingBriefId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingCurationId, setRemovingCurationId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const onDecide = async (
    curationEntryId: string,
    destination: CurationDestination,
    rationale: string
  ) => {
    const result = await decide.mutateAsync({ curationEntryId, destination, rationale });
    if (!result.ok) {
      setStatusMessage({ kind: 'error', text: result.message });
      return;
    }
    setStatusMessage({
      kind: result.kind === 'warning' ? 'warning' : 'success',
      text: result.message,
    });
  };

  const onRemoveCuration = async (curationEntryId: string) => {
    if (removeCuration.isPending || removingCurationId) return;
    setRemovingCurationId(curationEntryId);
    setStatusMessage(null);
    try {
      const result = await removeCuration.mutateAsync({ curationEntryId });
      if (!result.ok) {
        setStatusMessage({ kind: 'error', text: result.message });
        return;
      }
      setStatusMessage({ kind: 'success', text: result.message ?? 'Ítem retirado de la mesa' });
    } finally {
      setRemovingCurationId(null);
    }
  };

  const onReopenCuration = async (curationEntryId: string) => {
    if (reopenCuration.isPending || reopeningId) return;
    setReopeningId(curationEntryId);
    setStatusMessage(null);
    try {
      const result = await reopenCuration.mutateAsync({ curationEntryId });
      if (!result.ok) {
        setStatusMessage({ kind: 'error', text: result.message });
        return;
      }
      setStatusMessage({
        kind: 'success',
        text: result.message ?? 'Ítem reabierto para volver a decidir',
      });
    } finally {
      setReopeningId(null);
    }
  };

  const onProposeAngle = async (curationEntryId: string) => {
    if (propose.isPending || proposingId) return;
    setProposingId(curationEntryId);
    setStatusMessage(null);
    try {
      const result = await propose.mutateAsync({ curationEntryId });
      if (!result.ok) {
        if (result.silent) return;
        setStatusMessage({
          kind: result.kind === 'error' ? 'error' : 'warning',
          text: result.message,
        });
        return;
      }
      setStatusMessage({ kind: 'success', text: result.message });
    } finally {
      setProposingId(null);
    }
  };

  const onCreateBrief = async (curationEntryId: string, destination: CurationDestination) => {
    if (createBrief.isPending || creatingBriefId) return;
    setCreatingBriefId(curationEntryId);
    setStatusMessage(null);
    try {
      const result = await createBrief.mutateAsync({ curationEntryId, destination });
      if (!result.ok) {
        setStatusMessage({
          kind: result.kind === 'error' ? 'error' : 'warning',
          text: result.message,
        });
        return;
      }
      setStatusMessage({ kind: 'success', text: result.message });
    } finally {
      setCreatingBriefId(null);
    }
  };

  const deliver = data ?? {
    pending: [],
    readyEntries: [],
    ready: 0,
    draftItems: 0,
    draftPackage: null,
    sentDeliveries: [],
  };

  useEffect(() => {
    if (deliver.draftPackage) {
      setDraftTitle(deliver.draftPackage.title);
      setDraftNote(deliver.draftPackage.strategicNote);
    } else {
      setDraftTitle('');
      setDraftNote('');
    }
  }, [deliver.draftPackage]);

  const onEnsureDraft = async () => {
    if (ensureDraft.isPending) return;
    setStatusMessage(null);
    const result = await ensureDraft.mutateAsync();
    if (!result.ok) {
      setStatusMessage({
        kind: result.kind === 'error' ? 'error' : 'warning',
        text: result.message,
      });
      return;
    }
    setStatusMessage({ kind: 'success', text: result.message });
  };

  const onAddToDelivery = async (curationEntryId: string) => {
    if (addToDelivery.isPending || addingId) return;
    setAddingId(curationEntryId);
    setStatusMessage(null);
    try {
      const result = await addToDelivery.mutateAsync({ curationEntryId });
      if (!result.ok) {
        setStatusMessage({
          kind: result.kind === 'info' ? 'warning' : result.kind === 'error' ? 'error' : 'warning',
          text: result.message,
        });
        return;
      }
      setStatusMessage({ kind: 'success', text: result.message });
    } finally {
      setAddingId(null);
    }
  };

  const onSaveMetadata = async (event: FormEvent) => {
    event.preventDefault();
    if (!deliver.draftPackage || updateMetadata.isPending) return;
    setStatusMessage(null);
    const result = await updateMetadata.mutateAsync({
      packageId: deliver.draftPackage.id,
      title: draftTitle,
      strategicNote: draftNote,
    });
    if (!result.ok) {
      setStatusMessage({
        kind: result.kind === 'error' ? 'error' : 'warning',
        text: result.message,
      });
      return;
    }
    setStatusMessage({ kind: 'success', text: result.message });
  };

  const onRemoveItem = async (packageId: string, itemId: string) => {
    if (removeItem.isPending || removingItemId) return;
    setRemovingItemId(itemId);
    setStatusMessage(null);
    try {
      const result = await removeItem.mutateAsync({ packageId, itemId });
      if (!result.ok) {
        setStatusMessage({
          kind: result.kind === 'error' ? 'error' : 'warning',
          text: result.message,
        });
        return;
      }
      setStatusMessage({ kind: 'success', text: result.message });
    } finally {
      setRemovingItemId(null);
    }
  };

  const onDiscardDraftConfirmed = async (packageId: string) => {
    if (discardDraft.isPending) return;
    setStatusMessage(null);
    const result = await discardDraft.mutateAsync({ packageId });
    setDiscardConfirmOpen(false);
    if (!result.ok) {
      setStatusMessage({
        kind: result.kind === 'error' ? 'error' : 'warning',
        text: result.message,
      });
      return;
    }
    setStatusMessage({ kind: 'success', text: result.message });
  };

  if (!scope) {
    return (
      <PanelState
        kind="no-scope"
        message="Selecciona un cliente en el workspace para ver entregas."
        testId="react-ws-deliver-no-client"
      />
    );
  }

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando entregas…" testId="react-ws-deliver-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las entregas."
        testId="react-ws-deliver-error"
      />
    );
  }

  if (previewOpen && deliver.draftPackage) {
    return (
      <ReactDeliveryPreviewModal
        packageId={deliver.draftPackage.id}
        workspaceClientId={workspaceClientId}
        onClose={() => setPreviewOpen(false)}
        onSent={(message) => {
          setPreviewOpen(false);
          setStatusMessage({ kind: 'success', text: message });
        }}
      />
    );
  }

  return (
    <div data-testid="react-ws-deliver">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{deliver.pending.length}</span>
          <span className="stat-label">Por decidir</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{deliver.ready}</span>
          <span className="stat-label">Listas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{deliver.draftItems}</span>
          <span className="stat-label">En el briefing</span>
        </div>
      </div>

      {deliver.pending.length ? (
        <ul className="curation-list" data-testid="react-ws-curation-list">
          {deliver.pending.map((entry) => {
            const removeBusy = removeCuration.isPending && removingCurationId === entry.id;
            return (
            <li className="curation-row" key={entry.id} data-testid={`react-ws-pending-${entry.id}`}>
              <div>
                <strong>{entry.signalTitle}</strong>
                <p className="muted small">
                  Etapa {entry.stage}
                  {entry.destination ? ` · destino ${entry.destination}` : ' · sin destino'}
                  {entry.strategicBriefId ? ' · con Brief' : ''}
                </p>
                {entry.rationale ? <p className="small">{entry.rationale}</p> : null}
              </div>
              <div className="curation-row-actions">
                <PendingCurationDecideForm
                  entryId={entry.id}
                  busy={decide.isPending}
                  onSubmit={(destination, rationale) => onDecide(entry.id, destination, rationale)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  data-testid={`react-ws-remove-curation-${entry.id}`}
                  disabled={removeBusy || removeCuration.isPending}
                  onClick={() => void onRemoveCuration(entry.id)}
                >
                  {removeBusy ? 'Retirando…' : 'Quitar'}
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-curation-empty">
          Nada pendiente de decidir.
        </p>
      )}

      {deliver.readyEntries.length ? (
        <ul className="curation-list" data-testid="react-ws-ready-list">
          {deliver.readyEntries.map((entry) => {
            const proposeBusy = propose.isPending && proposingId === entry.id;
            const briefBusy = createBrief.isPending && creatingBriefId === entry.id;
            const briefDestination = entry.destination as CurationDestination | null;
            const briefEligible =
              Boolean(briefDestination) &&
              Boolean(curationDestinationToAuthorizedAction(briefDestination!)) &&
              !entry.strategicBriefId;
            const addEligible =
              !entry.deliveryPackageId &&
              Boolean(entry.destination) &&
              entry.destination !== 'DISCARD';
            const addBusy = addToDelivery.isPending && addingId === entry.id;
            const reopenBusy = reopenCuration.isPending && reopeningId === entry.id;
            return (
              <li className="curation-row" key={entry.id} data-testid={`react-ws-ready-${entry.id}`}>
                <div>
                  <strong>{entry.signalTitle}</strong>
                  <p className="muted small">
                    Etapa {entry.stage} · destino {entry.destination}
                    {entry.strategicBriefId ? ' · con Brief' : ''}
                    {entry.deliveryPackageId ? ' · en briefing' : ''}
                  </p>
                  {entry.rationale ? <p className="small">{entry.rationale}</p> : null}
                  {entry.aiAngle ? (
                    <p className="small" data-testid={`react-ws-angle-${entry.id}`}>
                      <strong>Ángulo propuesto:</strong> {entry.aiAngle}
                    </p>
                  ) : null}
                </div>
                <div className="curation-row-actions">
                  {!entry.aiAngle ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      data-testid={`react-ws-propose-angle-${entry.id}`}
                      disabled={proposeBusy || propose.isPending}
                      onClick={() => void onProposeAngle(entry.id)}
                    >
                      {proposeBusy ? 'Pensando…' : 'Proponer ángulo'}
                    </button>
                  ) : null}
                  {briefEligible ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      data-testid={`react-ws-create-brief-${entry.id}`}
                      disabled={briefBusy || createBrief.isPending}
                      onClick={() => void onCreateBrief(entry.id, briefDestination!)}
                    >
                      {briefBusy ? 'Creando…' : 'Create Strategic Brief DRAFT'}
                    </button>
                  ) : null}
                  {addEligible ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      data-testid={`react-ws-add-to-briefing-${entry.id}`}
                      disabled={addBusy || addToDelivery.isPending}
                      onClick={() => void onAddToDelivery(entry.id)}
                    >
                      {addBusy ? 'Añadiendo…' : 'Añadir al briefing'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    data-testid={`react-ws-reopen-curation-${entry.id}`}
                    disabled={reopenBusy || reopenCuration.isPending}
                    onClick={() => void onReopenCuration(entry.id)}
                  >
                    {reopenBusy ? 'Reabriendo…' : 'Reabrir'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small" data-testid="react-ws-ready-empty">
          Nada listo para proponer ángulo.
        </p>
      )}

      {deliver.draftPackage ? (
        <div className="card" data-testid="react-ws-draft-package" data-authority="PRESENTATION">
          <p className="small">
            <strong>{deliver.draftPackage.title || 'Briefing en borrador'}</strong>
            {' · '}
            {deliver.draftPackage.itemCount} elementos · {deliver.draftPackage.status}
          </p>
          <form
            className="form-stack small"
            data-testid="react-ws-draft-metadata-form"
            onSubmit={(event) => void onSaveMetadata(event)}
          >
            <label>
              Título
              <input
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                data-testid="react-ws-draft-title"
              />
            </label>
            <label>
              Nota estratégica
              <textarea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                rows={3}
                data-testid="react-ws-draft-strategic-note"
              />
            </label>
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              data-testid="react-ws-draft-save-metadata"
              disabled={updateMetadata.isPending}
            >
              {updateMetadata.isPending ? 'Guardando…' : 'Guardar nota estratégica'}
            </button>
          </form>
          <ul className="muted small" data-testid="react-ws-draft-items">
            {deliver.draftPackage.items.map((item) => {
              const removeBusy = removeItem.isPending && removingItemId === item.id;
              return (
                <li key={item.id} data-testid={`react-ws-draft-item-${item.id}`}>
                  {item.title}
                  <button
                    type="button"
                    className="btn btn-link btn-sm"
                    data-testid={`react-ws-remove-item-${item.id}`}
                    disabled={removeBusy || removeItem.isPending}
                    onClick={() =>
                      void onRemoveItem(deliver.draftPackage!.id, item.id)
                    }
                  >
                    {removeBusy ? 'Retirando…' : 'Quitar'}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="curation-row-actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="react-ws-deliver-preview-send"
              onClick={() => {
                setStatusMessage(null);
                setPreviewOpen(true);
              }}
            >
              Vista previa y enviar
            </button>
            {discardConfirmOpen ? (
              <div className="form-stack small" data-testid="react-ws-discard-confirm">
                <p className="small">¿Descartar este borrador de briefing?</p>
                <div className="curation-row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    data-testid="react-ws-discard-confirm-yes"
                    disabled={discardDraft.isPending}
                    onClick={() => void onDiscardDraftConfirmed(deliver.draftPackage!.id)}
                  >
                    {discardDraft.isPending ? 'Descartando…' : 'Sí, descartar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link btn-sm"
                    data-testid="react-ws-discard-confirm-no"
                    disabled={discardDraft.isPending}
                    onClick={() => setDiscardConfirmOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-testid="react-ws-discard-draft"
                disabled={discardDraft.isPending}
                onClick={() => setDiscardConfirmOpen(true)}
              >
                Descartar borrador
              </button>
            )}
          </div>
        </div>
      ) : (
        <div data-testid="react-ws-draft-empty">
          <p className="muted small">No hay briefing en borrador listo para enviar.</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="react-ws-ensure-draft"
            disabled={ensureDraft.isPending}
            onClick={() => void onEnsureDraft()}
          >
            {ensureDraft.isPending ? 'Creando…' : 'Crear briefing'}
          </button>
        </div>
      )}

      {deliver.sentDeliveries.length ? (
        <details data-testid="react-ws-sent-list">
          <summary className="small">Enviadas ({deliver.sentDeliveries.length})</summary>
          <ul className="delivery-list">
            {deliver.sentDeliveries.map((pkg) => (
              <li key={pkg.id}>
                {pkg.title || 'Sin título'} · {pkg.itemCount} elementos · {pkg.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {statusMessage ? (
        <p
          className={
            statusMessage.kind === 'error'
              ? 'form-error'
              : statusMessage.kind === 'warning'
                ? 'form-warning'
                : 'form-success'
          }
          role="status"
          data-testid={
            statusMessage.kind === 'error'
              ? 'react-ws-deliver-error-msg'
              : statusMessage.kind === 'warning'
                ? 'react-ws-deliver-warning-msg'
                : 'react-ws-deliver-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Briefs — canonical read + ONE canonical command
 * ------------------------------------------------------------------ */

function BriefsPanel() {
  const { tenantScope } = useSession();
  const { data, isLoading, isError } = useStrategicBriefs(tenantScope);
  const approve = useApproveBrief(tenantScope);
  const [message, setMessage] = useState<string | null>(null);

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando briefs…" testId="react-ws-briefs-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar los briefs."
        testId="react-ws-briefs-error"
      />
    );
  }

  const briefs = data ?? [];

  return (
    <div data-testid="react-ws-briefs">
      {briefs.length ? (
        <ul className="brief-list" data-testid="react-ws-brief-list">
          {briefs.map((brief) => (
            <li className="brief-row" key={brief.id}>
              <div>
                <strong>{brief.strategicAngle}</strong>
                <p className="muted small">
                  v{brief.version} · {brief.status}
                  {brief.authorizedAction ? ` · autoriza ${brief.authorizedAction}` : ''}
                  {brief.superseded ? ' · superado' : ''}
                </p>
                <p className="muted small">
                  {brief.territory} · {brief.primaryAudience}
                </p>
              </div>
              {/*
                Enabled from the canonical projection's own status. SPEC-003
                re-validates and may still refuse; nothing is marked approved here.
              */}
              {brief.status === 'DRAFT' && !brief.superseded ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={approve.isPending}
                  onClick={() =>
                    void approve
                      .mutateAsync({ briefId: brief.id })
                      .then((result) => setMessage(result.ok ? 'Brief aprobado.' : result.message))
                  }
                  data-testid={`react-ws-approve-brief-${brief.id}`}
                >
                  Aprobar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-briefs-empty">
          Sin Strategic Briefs registrados.
        </p>
      )}

      {message ? (
        <p className="muted small" role="status" data-testid="react-ws-briefs-message">
          {message}
        </p>
      ) : null}

      <LegacyHandoff
        actions={['crear un Strategic Brief desde un ítem curado']}
        testId="react-ws-briefs-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sources — #8/#24 RegisterSource + #9 poll + #26 manual signal native.
 * #25 lifecycle and discovery remain LegacyHandoff.
 * ------------------------------------------------------------------ */

const SOURCE_TYPE_OPTIONS: readonly SourceType[] = [
  'REGULATORY',
  'RSS',
  'ACADEMIC',
  'MEDIA',
  'MANUAL',
  'WEB',
  'API',
  'BLOG',
  'SOCIAL',
  'VIDEO',
  'OTHER',
];

function SourcesPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
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

  const { data, isLoading, isError } = useWorkspaceSources(scope);
  const register = useRegisterSource(scope);
  const pollOne = usePollRegisteredSource(scope);
  const pollAll = usePollAllActiveSources(scope);
  const manual = useRegisterManualSignal(scope);

  const [showRegister, setShowRegister] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<SourceType>('RSS');
  const [url, setUrl] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!scope) {
    return (
      <PanelState
        kind="empty"
        message="Selecciona un cliente del workspace para gestionar fuentes."
        testId="react-ws-sources-no-client"
      />
    );
  }

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando fuentes…" testId="react-ws-sources-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las fuentes."
        testId="react-ws-sources-error"
      />
    );
  }

  const sources = data ?? { sources: [], errors: 0, degraded: 0, paused: 0 };
  const busy = register.isPending || pollOne.isPending || pollAll.isPending || manual.isPending;

  const resetRegister = () => {
    setName('');
    setType('RSS');
    setUrl('');
    setIntervalMinutes('');
    setShowRegister(false);
  };

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setStatusMessage({ kind: 'error', text: 'El nombre de la fuente es obligatorio.' });
      return;
    }
    const parsedInterval = intervalMinutes.trim() ? Number(intervalMinutes) : undefined;
    const result = await register.mutateAsync({
      name: name.trim(),
      type,
      url: url.trim() || undefined,
      fetchIntervalMinutes:
        typeof parsedInterval === 'number' && Number.isFinite(parsedInterval)
          ? parsedInterval
          : undefined,
    });
    if (result.ok) {
      setStatusMessage({ kind: 'success', text: 'Fuente registrada.' });
      resetRegister();
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  const onPollOne = async (sourceId: string) => {
    const result = await pollOne.mutateAsync({ sourceId });
    if (result.ok) {
      setStatusMessage({
        kind: 'success',
        text: `${result.created} nueva(s) · ${result.fetched} leída(s) · ${result.rejected} filtrada(s) · ${result.duplicates} duplicada(s)`,
      });
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  const onPollAll = async () => {
    const result = await pollAll.mutateAsync();
    if (result.ok) {
      setStatusMessage({
        kind: 'success',
        text: `${result.created} nueva(s) · ${result.failed} fallo(s) · ${result.polled} fuente(s)`,
      });
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  const onManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!manualTitle.trim()) {
      setStatusMessage({ kind: 'error', text: 'El título de la señal es obligatorio.' });
      return;
    }
    const result = await manual.mutateAsync({ title: manualTitle.trim() });
    if (result.ok) {
      setStatusMessage({ kind: 'success', text: 'Señal manual registrada.' });
      setManualTitle('');
      setShowManual(false);
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  return (
    <div data-testid="react-ws-sources">
      <div className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{sources.sources.length}</span>
          <span className="stat-label">Fuentes</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sources.errors}</span>
          <span className="stat-label">Con error</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sources.degraded}</span>
          <span className="stat-label">Degradadas</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{sources.paused}</span>
          <span className="stat-label">Pausadas</span>
        </div>
      </div>

      <div className="onboarding-footer" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="react-ws-sources-open-register"
          disabled={busy}
          onClick={() => setShowRegister((open) => !open)}
        >
          {showRegister ? 'Cerrar registro' : '+ Registrar fuente'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="react-ws-sources-poll-all"
          disabled={busy}
          onClick={() => void onPollAll()}
        >
          Ingerir todas
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="react-ws-sources-open-manual"
          disabled={busy}
          onClick={() => setShowManual((open) => !open)}
        >
          {showManual ? 'Cerrar señal manual' : '+ Señal manual'}
        </button>
      </div>

      {showRegister ? (
        <form
          className="card"
          data-testid="react-ws-sources-register-form"
          onSubmit={(e) => void onRegister(e)}
          style={{ marginBottom: '1rem', padding: '1rem' }}
        >
          <h3>Registrar fuente</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="react-source-name">
              Nombre
            </label>
            <input
              id="react-source-name"
              className="form-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="react-ws-sources-name"
              disabled={busy}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="react-source-type">
              Tipo
            </label>
            <select
              id="react-source-type"
              className="form-input"
              required
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              data-testid="react-ws-sources-type"
              disabled={busy}
            >
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="react-source-url">
              URL (opcional)
            </label>
            <input
              id="react-source-url"
              className="form-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="react-ws-sources-url"
              disabled={busy}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="react-source-interval">
              Intervalo en minutos (opcional)
            </label>
            <input
              id="react-source-interval"
              className="form-input"
              type="number"
              min={1}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(e.target.value)}
              data-testid="react-ws-sources-interval"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="react-ws-sources-register-submit"
            disabled={busy}
          >
            Registrar
          </button>
        </form>
      ) : null}

      {showManual ? (
        <form
          className="card"
          data-testid="react-ws-sources-manual-form"
          onSubmit={(e) => void onManual(e)}
          style={{ marginBottom: '1rem', padding: '1rem' }}
        >
          <h3>Señal manual</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="react-manual-title">
              Título
            </label>
            <input
              id="react-manual-title"
              className="form-input"
              required
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              data-testid="react-ws-sources-manual-title"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="react-ws-sources-manual-submit"
            disabled={busy}
          >
            Registrar señal
          </button>
        </form>
      ) : null}

      {sources.sources.length ? (
        <ul className="source-list" data-testid="react-ws-source-list">
          {sources.sources.map((source) => (
            <li className="source-row" key={source.id} data-testid={`react-ws-source-row-${source.id}`}>
              <div>
                <strong>{source.name}</strong>
                <p className="muted small">
                  {source.type}
                  {source.url ? ` · ${source.url}` : ''}
                </p>
              </div>
              <span
                className={`badge ${source.healthStatus === 'ERROR' ? 'badge-pending' : 'badge-ready'}`}
              >
                {source.healthLabel}
                {source.acceptRate !== null ? ` · ${Math.round(source.acceptRate * 100)}%` : ''}
              </span>
              {source.url ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  data-testid={`react-ws-source-poll-${source.id}`}
                  disabled={busy}
                  onClick={() => void onPollOne(source.id)}
                >
                  Ingerir ahora
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-sources-empty">
          Sin fuentes registradas.
        </p>
      )}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'muted small'}
          role={statusMessage.kind === 'error' ? 'alert' : undefined}
          data-testid={
            statusMessage.kind === 'error' ? 'react-ws-sources-error-msg' : 'react-ws-sources-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

      <LegacyHandoff
        actions={['pausarlas o archivarlas', 'el descubrimiento automático']}
        testId="react-ws-sources-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tasks — #27 MANUAL assign + cancel native (P8); P3B recordings play/download/re-upload
 * ------------------------------------------------------------------ */

function TasksPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
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

  const { data, isLoading, isError } = useWorkspaceTasks(scope);
  const assign = useAssignClientTaskManual(scope);
  const cancel = useCancelClientTask(scope);
  const [showForm, setShowForm] = useState(false);
  const [thesisId, setThesisId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('RECORD_VIDEO');
  const [minutes, setMinutes] = useState('15');
  const [deadline, setDeadline] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!scope) {
    return (
      <PanelState
        kind="empty"
        message="Selecciona un cliente del workspace para gestionar tareas."
        testId="react-ws-tasks-no-client"
      />
    );
  }

  if (isLoading) {
    return <PanelState kind="loading" message="Cargando tareas…" testId="react-ws-tasks-loading" />;
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudieron cargar las tareas."
        testId="react-ws-tasks-error"
      />
    );
  }

  const tasks = data?.tasks ?? [];
  const activeTheses = data?.activeTheses ?? [];
  const active = tasks.filter((task) => !task.archived);
  const archived = tasks.filter((task) => task.archived);
  const busy = assign.isPending || cancel.isPending;

  const resetForm = () => {
    setThesisId('');
    setTitle('');
    setDescription('');
    setType('RECORD_VIDEO');
    setMinutes('15');
    setDeadline('');
    setShowForm(false);
  };

  const onAssign = async (event: FormEvent) => {
    event.preventDefault();
    if (!thesisId.trim()) {
      setStatusMessage({ kind: 'error', text: 'Selecciona una tesis ACTIVE para la tarea.' });
      return;
    }
    const estimatedMinutes = parseInt(minutes || '15', 10);
    const result = await assign.mutateAsync({
      thesisId: thesisId.trim(),
      type,
      title: title.trim(),
      description: description.trim(),
      estimatedMinutes,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
    });
    if (result.ok) {
      setStatusMessage({ kind: 'success', text: result.message });
      resetForm();
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  const onCancel = async (taskId: string) => {
    if (!confirm('¿Cancelar esta tarea? El cliente dejará de verla como pendiente.')) return;
    const result = await cancel.mutateAsync({ taskId });
    if (result.ok) {
      setStatusMessage({ kind: 'success', text: result.message });
    } else {
      setStatusMessage({ kind: 'error', text: result.message });
    }
  };

  return (
    <div data-testid="react-ws-tasks">
      <div className="onboarding-footer" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="react-ws-tasks-open-assign"
          disabled={busy}
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? 'Cerrar formulario' : '+ Asignar tarea'}
        </button>
      </div>

      {showForm ? (
        <form
          className="card"
          data-testid="react-ws-tasks-assign-form"
          onSubmit={(e) => void onAssign(e)}
          style={{ marginBottom: '1rem', padding: '1rem' }}
        >
          <h3>Asignar tarea al cliente</h3>
          <p className="muted small">El cliente verá esta tarea en su portal de inmediato.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-thesis">
              Tesis (explícita)
            </label>
            <select
              id="react-task-thesis"
              className="form-input"
              required
              value={thesisId}
              onChange={(e) => setThesisId(e.target.value)}
              data-testid="react-ws-tasks-thesis"
              disabled={busy}
            >
              <option value="">Selecciona una tesis ACTIVE…</option>
              {activeTheses.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-title">
              Título
            </label>
            <input
              id="react-task-title"
              className="form-input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="react-ws-tasks-title"
              disabled={busy}
              placeholder="Ej. Grabar video sobre el nuevo marco regulatorio de IA"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-description">
              Instrucciones para el cliente
            </label>
            <textarea
              id="react-task-description"
              className="form-textarea"
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="react-ws-tasks-description"
              disabled={busy}
              placeholder="Qué debe hacer y con qué enfoque."
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="react-task-type">
                Tipo de tarea
              </label>
              <select
                id="react-task-type"
                className="form-select"
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                data-testid="react-ws-tasks-type"
                disabled={busy}
              >
                {TASK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="react-task-minutes">
                Tiempo estimado (min)
              </label>
              <input
                id="react-task-minutes"
                type="number"
                className="form-input"
                min={5}
                max={480}
                required
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                data-testid="react-ws-tasks-minutes"
                disabled={busy}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="react-task-deadline">
              Fecha límite (opcional)
            </label>
            <input
              id="react-task-deadline"
              type="date"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              data-testid="react-ws-tasks-deadline"
              disabled={busy}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={resetForm}
              data-testid="react-ws-tasks-assign-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              data-testid="react-ws-tasks-assign-submit"
            >
              {assign.isPending ? 'Asignando…' : 'Asignar al cliente'}
            </button>
          </div>
        </form>
      ) : null}

      {active.length ? (
        <ul className="task-list" data-testid="react-ws-task-list">
          {active.map((task) => (
            <li className="task-row" key={task.id} data-testid={`react-ws-task-row-${task.id}`}>
              <div>
                <strong>{task.title}</strong>
                <p className="muted small">
                  {task.type}
                  {task.deadline ? ` · vence ${task.deadline}` : ''}
                  {task.thesisId ? ` · tesis ${task.thesisId}` : ''}
                </p>
              </div>
              <div className="task-row-actions">
                <span className="badge badge-progress">{task.status}</span>
                {task.cancellable ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    data-testid={`react-ws-task-cancel-${task.id}`}
                    onClick={() => void onCancel(task.id)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
              {task.type === 'RECORD_VIDEO' ? (
                <ReactTaskRecordingBlock
                  taskId={task.id}
                  evidenceUrl={task.recordingRef}
                  clientNotes={task.clientNotes}
                  scope={scope}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-tasks-empty">
          Sin tareas activas.
        </p>
      )}

      {archived.length ? (
        <details data-testid="react-ws-tasks-archived">
          <summary className="small">Cerradas ({archived.length})</summary>
          <ul className="task-list">
            {archived.map((task) => (
              <li key={task.id}>
                {task.title} · {task.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          role="status"
          data-testid={
            statusMessage.kind === 'error' ? 'react-ws-tasks-error-msg' : 'react-ws-tasks-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}

      <p className="muted small" data-testid="react-ws-tasks-handoff">
        Puedes gestionar grabaciones existentes (reproducir, descargar y volver a subir) desde
        cada tarea de video.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Production — #31 SaveContentDraft list + editor (P16)
 * ------------------------------------------------------------------ */

function ProductionPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
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

  const { data, isLoading, isError } = useWorkspaceContent(scope);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!scope) {
    return (
      <PanelState
        kind="empty"
        message="Selecciona un cliente del workspace para editar contenido existente."
        testId="react-ws-production-no-client"
      />
    );
  }

  if (isLoading) {
    return (
      <PanelState kind="loading" message="Cargando producción…" testId="react-ws-production-loading" />
    );
  }
  if (isError) {
    return (
      <PanelState
        kind="error"
        message="No se pudo cargar el contenido."
        testId="react-ws-production-error"
      />
    );
  }

  const items = data?.items ?? [];

  if (editingId) {
    return (
      <ReactContentEditorModal
        contentId={editingId}
        workspaceClientId={workspaceClientId}
        onClose={() => setEditingId(null)}
        onSaved={() => setStatusMessage({ kind: 'success', text: 'Cambios guardados' })}
      />
    );
  }

  if (previewingId) {
    return (
      <ReactContentPreviewModal
        contentId={previewingId}
        onClose={() => setPreviewingId(null)}
      />
    );
  }

  return (
    <div data-testid="react-ws-production">
      <div className="card-header">
        <div>
          <h3>Pipeline editorial</h3>
          <p>Revisa y edita entregables existentes. Generar contenido todavía no está disponible en esta interfaz.</p>
        </div>
      </div>

      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'login-error' : 'muted small'}
          data-testid={
            statusMessage.kind === 'success'
              ? 'react-ws-production-success'
              : 'react-ws-production-status-error'
          }
          role={statusMessage.kind === 'error' ? 'alert' : undefined}
        >
          {statusMessage.text}
        </p>
      ) : null}

      {items.length ? (
        <ul className="content-list" data-testid="react-ws-production-list">
          {items.map((item) => {
            const showClaimSafety = Boolean(item.claimSafety && item.claimSafety.verdict !== 'PASS');
            return (
            <li
              className="content-row"
              key={item.id}
              data-testid={`react-ws-production-row-${item.id}`}
            >
              <div>
                <strong>{item.title}</strong>
                {showClaimSafety ? <ReactClaimSafetyBadge record={item.claimSafety ?? undefined} /> : null}
                <p className="muted small">
                  {item.platform} · {item.type} · {item.legacyStatus}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-testid={`react-ws-production-edit-${item.id}`}
                onClick={() => setEditingId(item.id)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-testid={`react-ws-production-preview-${item.id}`}
                onClick={() => setPreviewingId(item.id)}
              >
                Ver
              </button>
              {showClaimSafety && item.claimSafety ? (
                <details className="claim-safety-disclosure">
                  <summary>{item.claimSafety.findings.length} afirmación(es) señalada(s)</summary>
                  <ReactClaimSafetyPanel record={item.claimSafety} />
                </details>
              ) : null}
            </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-production-empty">
          No hay contenido existente para este cliente.
        </p>
      )}

      <LegacyHandoff
        actions={['generar contenido', 'mover el pipeline']}
        testId="react-ws-production-handoff"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Positioning — existing advice actions + click-only #21a
 * ------------------------------------------------------------------ */

const ADVICE_CATEGORY_LABELS: Record<string, string> = {
  CONTENT: 'Contenido',
  CREDENTIAL: 'Credenciales',
  VISIBILITY: 'Visibilidad',
  EVIDENCE: 'Evidencia',
  NETWORK: 'Red de contactos',
  RISK: 'Riesgo',
};

const ADVICE_HORIZON_LABELS: Record<string, string> = {
  DAYS_30: '30 días',
  DAYS_60: '60 días',
  DAYS_90: '90 días',
};

function AdviceActionsPanel({ workspaceClientId = null }: { workspaceClientId?: string | null }) {
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
  const { data, isLoading, isError } = useWorkspaceAdvice(scope);
  const addAdvice = useAddAdviceActionToCuration(scope);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const onPrepare = async (adviceActionId: string) => {
    if (addAdvice.isPending || busyActionId) return;
    setBusyActionId(adviceActionId);
    setStatusMessage(null);
    try {
      const result = await addAdvice.mutateAsync({ adviceActionId });
      if (!result.ok) {
        setStatusMessage({ kind: 'error', text: result.message });
        return;
      }
      setStatusMessage({
        kind: 'success',
        text: result.message ?? 'Acción enviada a la mesa de curación',
      });
    } finally {
      setBusyActionId(null);
    }
  };

  const actions = data?.actions ?? [];

  return (
    <section className="card" data-testid="react-ws-advice">
      <div className="card-header">
        <h3>Acciones de consejo</h3>
      </div>
      {statusMessage ? (
        <p
          className={statusMessage.kind === 'error' ? 'form-error' : 'form-success'}
          role={statusMessage.kind === 'error' ? 'alert' : 'status'}
          data-testid={
            statusMessage.kind === 'error' ? 'react-ws-advice-error' : 'react-ws-advice-success'
          }
        >
          {statusMessage.text}
        </p>
      ) : null}
      {isLoading ? (
        <p className="muted small">Cargando acciones de consejo…</p>
      ) : isError ? (
        <p className="form-error" role="alert" data-testid="react-ws-advice-load-error">
          No se pudieron cargar las acciones de consejo.
        </p>
      ) : actions.length ? (
        <ul className="advice-list" data-testid="react-ws-advice-list">
          {actions.map((action) => {
            const busy = addAdvice.isPending && busyActionId === action.id;
            return (
              <li
                className="advice-card"
                key={action.id}
                data-testid={`react-ws-advice-action-${action.id}`}
              >
                <header>
                  <span className="badge badge-progress">
                    {ADVICE_CATEGORY_LABELS[action.category] ?? action.category}
                  </span>
                  <span className="impact-tag">Impacto {action.impact}</span>
                  <span className="muted small">
                    {ADVICE_HORIZON_LABELS[action.horizon] ?? action.horizon}
                  </span>
                </header>
                <h4 data-testid={`react-ws-advice-title-${action.id}`}>{action.title}</h4>
                <p className="advice-why" data-testid={`react-ws-advice-why-${action.id}`}>
                  <strong>Por qué:</strong> {action.why}
                </p>
                <p className="advice-how" data-testid={`react-ws-advice-how-${action.id}`}>
                  <strong>Cómo:</strong> {action.how}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  data-testid={`react-ws-advice-prepare-${action.id}`}
                  disabled={busy}
                  onClick={() => void onPrepare(action.id)}
                >
                  {busy ? 'Enviando…' : 'Preparar entrega'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state" data-testid="react-ws-advice-empty">
          No hay acciones de consejo para este cliente.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function ReactClientWorkspacePage({
  tab = 'radar',
  clientId = null,
}: {
  tab?: WorkspaceTab;
  /** Shell-selected workspace client — narrowed via trusted tenant scope, never forged. */
  clientId?: string | null;
}) {
  const { tenantScope, isAdmin } = useSession();

  if (!tenantScope) {
    return (
      <PanelState
        kind="no-scope"
        message="Sesión sin contexto de organización — no se muestra el workspace."
        testId="react-ws-no-scope"
      />
    );
  }

  // Visibility only, from the trusted session. This view never asserts a role.
  if (!isAdmin) {
    return (
      <PanelState kind="empty" message="Esta vista es para managers." testId="react-ws-not-admin" />
    );
  }

  return (
    <div className="page-content" data-testid="react-client-workspace" data-workspace-tab={tab}>
      {tab === 'briefs' ? (
        <ReactPageHeader title="Strategic Briefs" />
      ) : (
        <ReactTabHeader tab={WORKSPACE_HEADER_TAB[tab]} />
      )}
      {tab === 'radar' ? <RadarPanel workspaceClientId={clientId} /> : null}
      {tab === 'deliver' ? <DeliverPanel workspaceClientId={clientId} /> : null}
      {tab === 'briefs' ? <BriefsPanel /> : null}
      {tab === 'sources' ? <SourcesPanel workspaceClientId={clientId} /> : null}
      {tab === 'tasks' ? <TasksPanel workspaceClientId={clientId} /> : null}
      {tab === 'production' ? <ProductionPanel workspaceClientId={clientId} /> : null}
      {tab === 'results' ? <ReactKpiWeeklyChart title="Resultados registrados" /> : null}
      {tab === 'positioning' ? (
        <>
          <ReactThesisEditorPage workspaceClientId={clientId} />
          <AdviceActionsPanel workspaceClientId={clientId} />
          <ReactProofWallPanel workspaceClientId={clientId} />
          <ReactMasterDossierPanel workspaceClientId={clientId} />
        </>
      ) : null}
    </div>
  );
}
