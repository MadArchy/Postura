/**
 * SPEC-010 · UI command seam.
 *
 * AUTHORITY: NONE. A React intent is a request, never a decision.
 *
 * Required shape for every UI-originated command:
 *
 *   React intent → this seam → canonical consumer / Application use case
 *                → Domain → Ports → Infrastructure
 *
 * Forbidden here and in every React module: `dbService` mutation, `Local*Store`
 * write, Firestore write, target-SPEC persistence, AI provider call
 * (threats T-010-01…04).
 *
 * Wave 1 exposed session commands only. Wave 2 (T-010-201…204) adds the
 * commands whose legacy handler already reaches a canonical consumer, so a
 * migrated command is a change of caller, never a change of authority: React and
 * legacy converge on the identical use case.
 *
 * CR-1 Client Lifecycle (#34, #1), Master Profile (#10 + #2–#6 + #7), Thesis Lifecycle
 * (#11–#13), Signal Intake (#8/#9/#24/#26), and Execution Delivery (#28/#31/#32)
 * are exposed below. Other AUDIT010-09 writes remain unexposed until their
 * Application owners exist
 * (full registry: `specs/010-react-migration/audit010-09-registry.md`).
 *
 * In every remaining case the legacy surface remains served, so no capability is
 * lost by not migrating it yet.
 */

import { authService } from '../../services/auth';
import { auditService } from '../../services/audit';
import {
  acceptClientOpportunity,
  declineClientOpportunity,
  submitClientOpportunity,
  toggleClientOpportunityChecklistItem,
} from '../../services/opportunityScoutConsumer';
import {
  registerResultRecordIntent,
  registerSignalOutcomeIntent,
} from '../../services/learningLoopConsumer';
import { approveStrategicBrief } from '../../services/strategicBriefConsumer';
import {
  acceptClientInvitation,
  createClientWithInvite,
} from '../../services/clientLifecycleConsumer';
import {
  isLocalSnapshotRematerializeAvailable,
  rematerializeLocalSnapshot,
} from '../../services/localSnapshotConsumer';
import { LocalSnapshotError } from '../../application/localSnapshot';
import {
  addProfileFact,
  applyOnboardingStep,
  confirmProfileFact,
  importProfileFactsFromCv,
  rejectProfileFact,
  setProofWallItemReadiness,
  updateProfileFact,
} from '../../services/masterProfileConsumer';
import {
  activateThesis,
  createThesis,
  decideThesisClientReview,
  saveThesis,
} from '../../services/thesisLifecycleConsumer';
import {
  discardSignal as discardSignalConsumer,
  pollAllActiveSources,
  pollRegisteredSource,
  registerManualSignal,
  registerSource,
} from '../../services/signalIntakeConsumer';
import {
  addAdviceActionToCuration as addAdviceActionToCurationConsumer,
  assignClientTask,
  cancelClientTask,
  removeCuration,
  reopenCuration,
  reviewClientArticle,
  saveContentDraft,
  sendDeliveryPackage,
  transitionClientTask,
  acknowledgeDelivery as acknowledgeDeliveryConsumer,
} from '../../services/executionDeliveryConsumer';
import { runRadarSendToCurationComposite } from '../../services/radarSendToCurationPresentation';
import {
  runRadarBulkScoringComposite,
  type RadarBulkScoringCompositeResult,
} from '../../services/radarScoreSignalsPresentation';
import {
  runRadarContestedAttributionComposite,
  type RadarContestedAttributionCompositeResult,
} from '../../services/radarContestedAttributionPresentation';
import { runCurationDecidePresentation } from '../../services/curationDecidePresentation';
import { runCurationProposeAnglePresentation } from '../../services/curationProposeAnglePresentation';
import { runBriefCreateFromCurationPresentation } from '../../services/briefCreateFromCurationPresentation';
import {
  runAddCurationToDeliveryPresentation,
  runDiscardDraftDeliveryPresentation,
  runEnsureDraftDeliveryPresentation,
  runRemoveDeliveryItemPresentation,
  runUpdateDeliveryPackageMetadataPresentation,
  type DeliveryAssemblyPresentationResult,
} from '../../services/deliveryAssemblyPresentation';
import { ClientLifecycleError } from '../../application/clientLifecycle';
import { MasterProfileError } from '../../application/masterProfile';
import { ThesisLifecycleError } from '../../application/thesisLifecycle';
import { SignalIntakeError } from '../../application/signalIntake';
import { ExecutionDeliveryError } from '../../application/executionDelivery';
import type {
  ContentStatus,
  ContentType,
  CurationDestination,
  ProfileFactSection,
  SourceType,
  TaskType,
  ThesisEditableFields,
} from '../../types';
import type { ThesisSaveIntent } from '../../domain/thesisRevisionCore';
import { downloadDossierMarkdown, formatDossierMarkdown } from '../../services/dossierExport';
import { notifyClient, notifyManager } from '../../services/notifications';
import { notifyManagerBriefingAcknowledged } from '../presentation/briefingAckNotification';
import {
  notifyManagerThesisChangesRequested,
  notifyManagerThesisClientApproved,
} from '../presentation/thesisClientReviewNotification';
import { notifyClientThesisManagerSave } from '../presentation/thesisManagerSaveNotification';
import { openClientArticleReviewPresentation } from '../../services/articleReviewOpen';
import {
  readBriefingAckNotificationContext,
  readDeliverySentNotifyFacts,
} from '../data/compatibilityReads';
import type { Client, MasterDossier } from '../../types';
import type { TrustedTenantScope } from '../query/tenantScope';

export type CommandResult = { ok: true; message?: string } | { ok: false; message: string };

export type OnboardingStepCommandResult =
  | {
      ok: true;
      completed: boolean;
      step: number;
      message?: string;
    }
  | { ok: false; message: string };

export type ProfileFactImportCommandResult =
  | { ok: true; importedCount: number; message: string }
  | { ok: false; message: string };

export type ThesisSaveCommandResult =
  | {
      ok: true;
      toast: string;
      message: string;
      notifyClient: boolean;
      intent: ThesisSaveIntent;
      notifySkipped?: boolean;
    }
  | { ok: false; message: string };

export type ThesisCreateCommandResult =
  | {
      ok: true;
      thesisId: string;
      toast: string;
      message: string;
      notifyClient: boolean;
      intent: ThesisSaveIntent;
      notifySkipped?: boolean;
    }
  | { ok: false; message: string };

export type ThesisClientReviewCommandResult =
  | {
      ok: true;
      decision: 'approve' | 'request_changes';
      appliedRevision: boolean;
      awaitsManagerActivation: boolean;
    }
  | { ok: false; message: string };

export type ArticleReviewCommandResult =
  | {
      ok: true;
      decision: 'save_revision' | 'approve' | 'request_changes';
      message: string;
      hadRevisionEvent: boolean;
    }
  | { ok: false; message: string };

export type DeliverySendCommandResult =
  | {
      ok: true;
      packageId: string;
      createdTasks: number;
      message: string;
      notifySkipped?: boolean;
    }
  | { ok: false; message: string };

export type CurationDecideCommandResult =
  | { ok: true; message: string; queued?: boolean; kind?: 'success' | 'warning' }
  | { ok: false; message: string };

export type ProposeAngleCommandResult =
  | { ok: true; message: string; kind: 'success' }
  | { ok: false; message: string; kind?: 'warning' | 'error'; silent?: boolean };

export type { DeliveryAssemblyPresentationResult } from '../../services/deliveryAssemblyPresentation';

export type CreateBriefFromCurationCommandResult =
  | { ok: true; message: string; briefId: string }
  | { ok: false; message: string; kind?: 'warning' | 'error' };

export type CreateClientWithInviteCommandResult =
  | {
      ok: true;
      message: string;
      clientId: string;
      displayName: string;
      invitationToken: string;
    }
  | { ok: false; message: string };

export type RematerializeLocalSnapshotCommandResult =
  | { ok: true; message: string; written: number }
  | { ok: false; message: string };

/**
 * Wraps a canonical call so a rejection reaches the UI as a message instead of
 * an unhandled throw. The seam never inspects the reason and never retries: the
 * canonical layer's verdict is final, and a failed command leaves no UI state
 * claiming otherwise.
 */
function attempt(run: () => void, fallbackMessage: string): CommandResult {
  try {
    run();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : fallbackMessage };
  }
}

/**
 * Session commands.
 *
 * These delegate to the trusted auth runtime (SPEC-009), which remains the sole
 * authority over identity. The seam never inspects or asserts a role, and never
 * decides whether a login should succeed — it forwards credentials and returns
 * the runtime's verdict.
 */
export const sessionCommands = {
  async login(email: string, password: string): Promise<CommandResult> {
    const result = await authService.login(email, password);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  },

  logout(): void {
    authService.logout();
  },

  returnToManager(): void {
    authService.returnToManager();
  },
} as const;

/**
 * SPEC-007 Opportunity commands (wave 2, T-010-202).
 *
 * Every one of these delegates to `opportunityScoutConsumer`, the canonical
 * consumer the legacy controller already calls, so the React and legacy buttons
 * reach the identical Application use case, Domain rules and lifecycle guard.
 *
 * The trusted tenant scope is passed as the claimed identity, which means the
 * consumer's own tenant validation runs against trusted values. Nothing here
 * supplies `actorType`, `role` or a forged snapshot — the consumer ignores those
 * inputs anyway, and the seam must not be the place that starts sending them
 * (threats T-010-09…11).
 *
 * Only ids and user-authored notes cross this boundary. No cached aggregate is
 * ever passed as state, so the canonical layer always loads current state
 * itself (caller snapshot authority 0, threat T-010-07).
 */
export const opportunityCommands = {
  accept(scope: TrustedTenantScope, opportunityId: string, notes?: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        acceptClientOpportunity({
          clientId: scope.clientId!,
          opportunityId,
          notes,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo aceptar la oportunidad'
    );
  },

  /**
   * Declining requires notes, matching the legacy feedback modal, which will not
   * submit without them. The check is an input-shape guard, not an authorization
   * decision — the canonical consumer still rules on the transition.
   */
  decline(scope: TrustedTenantScope, opportunityId: string, notes: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    if (!notes.trim()) return { ok: false, message: 'Escribe tus observaciones para declinar' };
    return attempt(
      () =>
        declineClientOpportunity({
          clientId: scope.clientId!,
          opportunityId,
          notes: notes.trim(),
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo declinar la oportunidad'
    );
  },

  toggleChecklistItem(
    scope: TrustedTenantScope,
    opportunityId: string,
    itemId: string,
    done: boolean
  ): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        toggleClientOpportunityChecklistItem({
          clientId: scope.clientId!,
          opportunityId,
          itemId,
          done,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo actualizar el checklist'
    );
  },

  /**
   * Marking a submission as sent is a canonical lifecycle transition. The React
   * button is enabled only when the projection says the checklist is complete,
   * but that is presentation: the consumer re-validates and may still refuse.
   */
  submit(scope: TrustedTenantScope, opportunityId: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        submitClientOpportunity({
          clientId: scope.clientId!,
          opportunityId,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo marcar la postulación'
    );
  },
} as const;

/**
 * SPEC-008 result/KPI intent (wave 2, T-010-203).
 *
 * `registerResultRecordIntent` is the canonical learning-loop consumer the
 * legacy quick form already uses. It resolves the trusted context itself and
 * discards any caller-supplied actor, so the React path cannot become a second
 * way to assert identity.
 */
export const resultCommands = {
  registerConsultation(scope: TrustedTenantScope, note: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    const trimmed = note.trim();
    return attempt(
      () =>
        registerResultRecordIntent({
          clientId: scope.clientId!,
          title: trimmed ? `Consulta: ${trimmed}` : 'Consulta recibida',
          channel: 'LinkedIn / Web',
          metricLabel: 'Consultas recibidas',
          metricValue: 1,
          kpiType: 'consultation_requests',
          notes: trimmed || undefined,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo registrar la consulta'
    );
  },
} as const;

/**
 * SPEC-008 signal-outcome intent (wave 3, T-010-305).
 *
 * The radar's "¿sirvió?" Sí/No control is one of the few workspace actions whose
 * legacy handler already reaches a canonical consumer
 * (`registerSignalOutcomeIntent`, `ClientWorkspace` radar → `main.ts:2534`), so
 * migrating it changes the caller and nothing else.
 *
 * `thesisId` is forwarded only when the caller was given one by a canonical
 * projection. React never picks a thesis to attribute an outcome to: an
 * unattributed outcome stays unattributed (threat T-010-15).
 */
export const signalOutcomeCommands = {
  register(
    scope: TrustedTenantScope,
    params: {
      signalId: string;
      kind: 'USEFUL' | 'NOT_USEFUL';
      thesisId?: string | null;
      note?: string;
    }
  ): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        registerSignalOutcomeIntent({
          clientId: scope.clientId!,
          signalId: params.signalId,
          kind: params.kind,
          source: 'RADAR',
          thesisId: params.thesisId ?? undefined,
          note: params.note?.trim() || undefined,
          claimedOrganizationId: scope.organizationId,
          claimedClientId: scope.clientId!,
        }),
      'No se pudo registrar el resultado de la señal'
    );
  },
} as const;

/**
 * SPEC-003 Strategic Brief approval (wave 3, T-010-305).
 *
 * `approveStrategicBrief` is canonical in the legacy controller too
 * (`main.ts:2757`) and takes ids only, resolving the trusted actor context
 * itself. Approval authority stays entirely inside SPEC-003: the seam forwards
 * the id and returns the consumer's verdict. It never marks a brief approved in
 * the UI, and a refused approval leaves no optimistic state behind (T-010-14).
 *
 * CR-2 brief creation from curation (P12). Composite body lives in
 * `briefCreateFromCurationPresentation` (mirrors curationHandlers create-brief
 * click; keeps seam/React db-free). React passes `curationEntryId` and factual
 * `destination` from the compatibility read only — canonical consumer reloads the
 * entry and resolves thesis internally.
 */
export const briefCommands = {
  approve(scope: TrustedTenantScope, briefId: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    return attempt(
      () =>
        approveStrategicBrief({
          clientId: scope.clientId!,
          briefId,
        }),
      'No se pudo aprobar el Strategic Brief'
    );
  },

  createFromCuration(intent: {
    curationEntryId: string;
    destination: CurationDestination;
  }): CreateBriefFromCurationCommandResult {
    return runBriefCreateFromCurationPresentation(intent);
  },
} as const;

/**
 * CR-1 Client Lifecycle (#34 CreateClientWithInvite, #1 AcceptClientInvitation).
 *
 * Seam authority = 0. Both commands delegate to `clientLifecycleConsumer`, which
 * gates create via `requireAdminActor` and loads invitation state for accept.
 * React and legacy (`main.ts`) must converge on these identical use cases.
 */
/**
 * Local snapshot rematerialization. Seam authority = 0.
 * React and leftover (`#btn-firebase-push-local`) converge on localSnapshotConsumer.
 */
export const localSnapshotCommands = {
  isRematerializeAvailable(): boolean {
    return isLocalSnapshotRematerializeAvailable();
  },

  async rematerializeLocalSnapshot(): Promise<RematerializeLocalSnapshotCommandResult> {
    try {
      const result = await rematerializeLocalSnapshot();
      return {
        ok: result.ok,
        message: result.message,
        written: result.written,
      };
    } catch (err) {
      if (err instanceof LocalSnapshotError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo subir el snapshot.',
      };
    }
  },
} as const;

export const clientLifecycleCommands = {
  createClientWithInvite(intent: {
    firstName: string;
    lastName: string;
    email: string;
    profession?: string;
    company?: string;
    targetMarket?: string;
    claimedOrganizationId?: string;
  }): CreateClientWithInviteCommandResult {
    try {
      const result = createClientWithInvite(intent);
      return {
        ok: true,
        message: `Cliente creado. Token de invitación: ${result.invitation.token}`,
        clientId: result.client.id,
        displayName: result.client.displayName,
        invitationToken: result.invitation.token,
      };
    } catch (err) {
      if (err instanceof ClientLifecycleError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo crear el cliente',
      };
    }
  },

  async acceptInvitation(intent: {
    token: string;
    password: string;
    displayName: string;
  }): Promise<CommandResult> {
    try {
      await acceptClientInvitation(intent);
      return { ok: true };
    } catch (err) {
      if (err instanceof ClientLifecycleError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo aceptar la invitación',
      };
    }
  },
} as const;

function mapMasterProfileError(err: unknown, fallback: string): CommandResult {
  if (err instanceof MasterProfileError) {
    return { ok: false, message: err.message };
  }
  return { ok: false, message: err instanceof Error ? err.message : fallback };
}

/**
 * CR-1 Master Profile (#10 ApplyOnboardingStep + #2–#6 fact lifecycle + #7 ProofWall).
 *
 * Seam authority = 0. Delegates to `masterProfileConsumer`, which gates via
 * `requireTenantScope`. React and legacy must converge on these use cases.
 * Adapters do not authorize, persist, extract CV facts, or compute completeness.
 */
export const masterProfileCommands = {
  applyOnboardingStep(intent: {
    requestedClientId: string | null | undefined;
    step: number;
    fields: Record<string, string>;
  }): OnboardingStepCommandResult {
    try {
      const result = applyOnboardingStep(intent);
      if (result.completed) {
        try {
          notifyManager(result.profile.clientId, {
            type: 'ONBOARDING',
            title: 'Perfil listo para revisión',
            body: 'El cliente completó el onboarding.',
          });
        } catch {
          // Best-effort compatibility — completion already persisted.
        }
        try {
          authService.clearOnboardingFlag();
        } catch {
          // Presentation flag only.
        }
      }
      return {
        ok: true,
        completed: result.completed,
        step: result.step,
        message: result.completed
          ? 'Onboarding completado. Abriendo propuesta de tesis…'
          : undefined,
      };
    } catch (err) {
      if (err instanceof MasterProfileError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo guardar el onboarding',
      };
    }
  },

  addProfileFact(intent: {
    requestedClientId: string | null | undefined;
    section: ProfileFactSection;
    label: string;
    value: string;
  }): CommandResult {
    try {
      addProfileFact(intent);
      return { ok: true, message: 'Fact añadido' };
    } catch (err) {
      return mapMasterProfileError(err, 'No se pudo añadir el fact de perfil');
    }
  },

  confirmProfileFact(intent: {
    requestedClientId: string | null | undefined;
    factId: string;
  }): CommandResult {
    try {
      confirmProfileFact(intent);
      return { ok: true, message: 'Fact confirmado' };
    } catch (err) {
      return mapMasterProfileError(err, 'No se pudo confirmar el fact de perfil');
    }
  },

  rejectProfileFact(intent: {
    requestedClientId: string | null | undefined;
    factId: string;
  }): CommandResult {
    try {
      rejectProfileFact(intent);
      return { ok: true, message: 'Fact descartado' };
    } catch (err) {
      return mapMasterProfileError(err, 'No se pudo rechazar el fact de perfil');
    }
  },

  updateProfileFact(intent: {
    requestedClientId: string | null | undefined;
    factId: string;
    value: string;
  }): CommandResult {
    try {
      updateProfileFact(intent);
      return { ok: true, message: 'Fact actualizado' };
    } catch (err) {
      return mapMasterProfileError(err, 'No se pudo actualizar el fact de perfil');
    }
  },

  importProfileFactsFromCv(intent: {
    requestedClientId: string | null | undefined;
    cvText: string;
  }): ProfileFactImportCommandResult {
    try {
      const result = importProfileFactsFromCv(intent);
      const importedCount = result.importedCount;
      return {
        ok: true,
        importedCount,
        message: importedCount
          ? `${importedCount} facts candidatos extraídos`
          : 'No se encontraron facts nuevos',
      };
    } catch (err) {
      if (err instanceof MasterProfileError) {
        return { ok: false, message: err.message };
      }
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudieron importar facts desde CV',
      };
    }
  },

  setProofWallItemReadiness(intent: {
    requestedClientId: string | null | undefined;
    proofWallItemId: string;
    targetStatus: 'pending' | 'complete';
  }): CommandResult {
    try {
      setProofWallItemReadiness(intent);
      return {
        ok: true,
        message:
          intent.targetStatus === 'complete'
            ? 'Activo marcado como listo'
            : 'Activo marcado como pendiente',
      };
    } catch (err) {
      return mapMasterProfileError(err, 'No se pudo actualizar el estado del activo');
    }
  },
} as const;

/**
 * CR-1 Thesis Lifecycle (#11 SaveThesis, #12 ActivateThesis, #13 DecideThesisClientReview).
 * Seam authority = 0. Save/activate/review require explicit thesisId — no positional thesis.
 * createThesis never mints; the consumer owns new thesis ids.
 */
export const thesisLifecycleCommands = {
  createThesis(intent: {
    requestedClientId: string | null | undefined;
    intent: ThesisSaveIntent;
    fields: ThesisEditableFields;
  }): ThesisCreateCommandResult {
    try {
      const result = createThesis(intent);
      let message = result.toast;
      let notifySkipped = false;
      if (result.notifyClient) {
        try {
          const notified = notifyClientThesisManagerSave(
            result.thesis.clientId,
            result.thesis.title,
            result.thesis.status
          );
          if (!notified) {
            notifySkipped = true;
            message = 'Tesis guardada. El cliente aún no tiene cuenta para recibir aviso.';
          }
        } catch {
          // Best-effort compatibility — save already persisted.
        }
      }
      return {
        ok: true,
        thesisId: result.thesis.id,
        toast: result.toast,
        message,
        notifyClient: result.notifyClient,
        intent: result.intent,
        ...(notifySkipped ? { notifySkipped: true } : {}),
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : 'No se pudo guardar la tesis',
      };
    }
  },

  saveThesis(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
    intent: ThesisSaveIntent;
    fields: ThesisEditableFields;
  }): ThesisSaveCommandResult {
    try {
      const result = saveThesis(intent);
      let message = result.toast;
      let notifySkipped = false;
      if (result.notifyClient) {
        try {
          const notified = notifyClientThesisManagerSave(
            result.thesis.clientId,
            result.thesis.title,
            result.thesis.status
          );
          if (!notified) {
            notifySkipped = true;
            message = 'Tesis guardada. El cliente aún no tiene cuenta para recibir aviso.';
          }
        } catch {
          // Best-effort compatibility — save already persisted.
        }
      }
      return {
        ok: true,
        toast: result.toast,
        message,
        notifyClient: result.notifyClient,
        intent: result.intent,
        ...(notifySkipped ? { notifySkipped: true } : {}),
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : 'No se pudo guardar la tesis',
      };
    }
  },

  activateThesis(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
  }): CommandResult {
    try {
      activateThesis(intent);
      return {
        ok: true,
        message: 'Tesis activada. El radar y el scoring ya la usan.',
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : 'No se pudo activar la tesis',
      };
    }
  },

  decideClientReview(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
    decision: 'approve' | 'request_changes';
    feedback?: string;
  }): ThesisClientReviewCommandResult {
    const fallback =
      intent.decision === 'approve'
        ? 'No se pudo aprobar la tesis'
        : 'No se pudo solicitar cambios';
    try {
      const result = decideThesisClientReview(intent);
      try {
        if (result.decision === 'approve' && result.awaitsManagerActivation) {
          notifyManagerThesisClientApproved(result.thesis.clientId, result.thesis.title);
        } else if (result.decision === 'request_changes') {
          notifyManagerThesisChangesRequested(
            result.thesis.clientId,
            result.thesis.title,
            intent.feedback
          );
        }
      } catch {
        // Best-effort compatibility — review decision already persisted.
      }
      return {
        ok: true,
        decision: result.decision,
        appliedRevision: result.appliedRevision,
        awaitsManagerActivation: result.awaitsManagerActivation,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ThesisLifecycleError || err instanceof Error
            ? err.message
            : fallback,
      };
    }
  },
} as const;

export type PollRegisteredSourceCommandResult =
  | {
      ok: true;
      sourceId: string;
      fetched: number;
      accepted: number;
      rejected: number;
      duplicates: number;
      created: number;
      message?: string;
    }
  | { ok: false; message: string };

export type PollAllActiveSourcesCommandResult =
  | {
      ok: true;
      created: number;
      failed: number;
      rejected: number;
      polled: number;
      message?: string;
    }
  | { ok: false; message: string };

/**
 * CR-1 Signal Intake (#8/#24 RegisterSource, #9 PollRegisteredSource /
 * PollAllActiveSources, #26 RegisterManualSignal).
 * Seam authority = 0. No routing/scoring/thesis/feed authority.
 */
export const signalIntakeCommands = {
  registerSource(intent: {
    requestedClientId: string | null | undefined;
    name: string;
    type: SourceType;
    url?: string;
    fetchIntervalMinutes?: number;
  }): CommandResult {
    try {
      registerSource(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo registrar la fuente',
      };
    }
  },

  registerManualSignal(intent: {
    requestedClientId: string | null | undefined;
    title: string;
    contentSnippet?: string;
    sourceUrl?: string;
  }): CommandResult {
    try {
      const result = registerManualSignal(intent);
      if (result.isDuplicate) {
        return { ok: false, message: 'Esta señal ya estaba registrada.' };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo registrar la señal',
      };
    }
  },

  async pollRegisteredSource(intent: {
    requestedClientId: string | null | undefined;
    sourceId: string;
  }): Promise<PollRegisteredSourceCommandResult> {
    try {
      const result = await pollRegisteredSource(intent);
      return {
        ok: true,
        sourceId: result.sourceId,
        fetched: result.fetched,
        accepted: result.accepted,
        rejected: result.rejected,
        duplicates: result.duplicates,
        created: result.created,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo ingerir la fuente',
      };
    }
  },

  async pollAllActiveSources(intent: {
    requestedClientId: string | null | undefined;
  }): Promise<PollAllActiveSourcesCommandResult> {
    try {
      const result = await pollAllActiveSources(intent);
      return {
        ok: true,
        created: result.created,
        failed: result.failed,
        rejected: result.rejected,
        polled: result.polled,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo ingerir las fuentes',
      };
    }
  },
} as const;

export type RadarDiscardCommandResult =
  | { ok: true; message: string; compatMissing?: boolean }
  | { ok: false; message: string };

export type RadarSendToCurationCommandResult =
  | { ok: true; message: string; alreadyInCuration?: boolean; preScored?: boolean }
  | { ok: false; message: string };

export type RadarBulkScoringCommandResult = RadarBulkScoringCompositeResult;

export type RadarContestedAttributionCommandResult = RadarContestedAttributionCompositeResult;

/**
 * P9 — Radar #20 DiscardSignal + #21 radar send-to-curation composite.
 *
 * Seam authority = 0. Mirrors `radarHandlers` presentation composite exactly:
 * optional frozen ScoreAndRouteSignal pre-score when authoritative relevanceScore
 * is undefined, then AddSignalToCuration (#21a), then MarkSignalSaved (#21b),
 * then presentation SIGNAL_TO_CURATION audit.
 *
 * Advisor AddAdviceActionToCuration is NOT exposed here (#21 non-radar residual).
 * R1 H06 bulk "Puntuar todas" is exposed via `radarScoreSignalsPresentation`;
 * R1 H09 contested lead/rival choice via `radarContestedAttributionPresentation`;
 * #22 per-signal score/investigate/addRecommendation UI is NOT exposed.
 */
export const radarCommands = {
  /** Registry #20 — DiscardSignal. Consumer owns SIGNAL_DISCARDED on success. */
  discardSignal(intent: {
    requestedClientId: string | null | undefined;
    signalId: string;
  }): RadarDiscardCommandResult {
    try {
      discardSignalConsumer({
        requestedClientId: intent.requestedClientId,
        signalId: intent.signalId,
      });
      return { ok: true, message: 'Señal descartada' };
    } catch (err) {
      if (err instanceof SignalIntakeError && err.code === 'SIGNAL_NOT_FOUND') {
        try {
          auditService.log(
            authService.getCurrentUser(),
            'SIGNAL_DISCARDED',
            'Signal',
            intent.signalId
          );
        } catch {
          // Best-effort A1 presentation compatibility.
        }
        return { ok: true, message: 'Señal descartada', compatMissing: true };
      }
      return {
        ok: false,
        message:
          err instanceof SignalIntakeError || err instanceof Error
            ? err.message
            : 'No se pudo descartar la señal',
      };
    }
  },

  /**
   * Registry #21 radar composite — AddSignalToCuration then MarkSignalSaved.
   * Pre-score via frozen ScoreAndRouteSignal only when authoritative signal is unscored.
   * Composite body lives in `radarSendToCurationPresentation` (mirrors radarHandlers; keeps seam/React db-free).
   */
  sendToCuration(intent: {
    requestedClientId: string | null | undefined;
    signalId: string;
  }): RadarSendToCurationCommandResult {
    return runRadarSendToCurationComposite(intent);
  },

  /**
   * R1 H06 — bulk "Puntuar todas" over pending signals (ADMIN only, one
   * SCORE_SIGNALS_BULK audit per run). Body lives in `radarScoreSignalsPresentation`.
   */
  scorePendingSignals(intent: {
    requestedClientId: string | null | undefined;
  }): RadarBulkScoringCommandResult {
    return runRadarBulkScoringComposite(intent);
  },

  /**
   * R1 H09 — resolve a CONTESTED attribution to the lead or rival thesis.
   * Canonical use case owns ADMIN/actor authority; body lives in
   * `radarContestedAttributionPresentation` (one THESIS_OVERRIDE audit on success).
   */
  resolveContestedAttribution(intent: {
    requestedClientId: string | null | undefined;
    signalId: string;
    selectedThesisId: string;
  }): RadarContestedAttributionCommandResult {
    return runRadarContestedAttributionComposite(intent);
  },
} as const;

export type TaskAssignCommandResult =
  | { ok: true; taskId: string; message: string; notifySkipped?: boolean }
  | { ok: false; message: string };

export type TaskCancelCommandResult =
  | { ok: true; message: string; compatMissing?: boolean }
  | { ok: false; message: string };

/**
 * CR-1 Execution Delivery (#18 SendDeliveryPackage, #27 Assign/CancelClientTask,
 * #28 TransitionClientTask, #31 SaveContentDraft, #32 ReviewClientArticle).
 * Seam authority = 0. Claim safety / learning / providers not owned here.
 */
export const executionDeliveryCommands = {
  /**
   * Registry #14 — DecideCuration.
   * Composite body lives in `curationDecidePresentation` (mirrors curationHandlers;
   * keeps seam/React db-free). DISCARD uses frozen #20 via discardSignalForCurationComposite.
   * Non-DISCARD queue calls frozen #17 addCurationToDelivery as legacy presentation compat only.
   */
  decideCuration(intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
    destination: CurationDestination;
    rationale: string;
  }): CurationDecideCommandResult {
    return runCurationDecidePresentation(intent);
  },

  /**
   * Registry #21a advisor — AddAdviceActionToCuration.
   * Presentation adapter only. Consumes an existing advice action; no AI.
   */
  addAdviceActionToCuration(intent: {
    requestedClientId: string | null | undefined;
    adviceActionId: string;
  }): CommandResult {
    try {
      addAdviceActionToCurationConsumer(intent);
      return { ok: true, message: 'Acción enviada a la mesa de curación' };
    } catch (err) {
      if (err instanceof ExecutionDeliveryError && err.code === 'ADVICE_ACTION_NOT_FOUND') {
        return { ok: false, message: 'El consejo ya no existe.' };
      }
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo enviar a curación',
      };
    }
  },

  /**
   * Registry #16-R — RemoveCuration.
   * Presentation adapter only. Canonical command owns delete authority.
   * CURATION_NOT_FOUND is a bounded failure, not a success toast.
   */
  removeCuration(intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }): CommandResult {
    try {
      const result = removeCuration(intent);
      if (!result.ok && result.compat === 'CURATION_NOT_FOUND') {
        return { ok: false, message: 'El ítem de curación ya no existe.' };
      }
      if (!result.ok) {
        return { ok: false, message: 'No se pudo retirar el ítem' };
      }
      return { ok: true, message: 'Ítem retirado de la mesa' };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo retirar el ítem',
      };
    }
  },

  /**
   * Registry #16-O — ReopenCuration.
   * Presentation adapter only. Canonical command owns the decision reset.
   * CURATION_NOT_FOUND is a bounded failure, not a success toast.
   */
  reopenCuration(intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }): CommandResult {
    try {
      const result = reopenCuration(intent);
      if (!result.ok && result.compat === 'CURATION_NOT_FOUND') {
        return { ok: false, message: 'El ítem de curación ya no existe.' };
      }
      if (!result.ok) {
        return { ok: false, message: 'No se pudo reabrir el ítem' };
      }
      return { ok: true, message: 'Ítem reabierto para volver a decidir' };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo reabrir el ítem',
      };
    }
  },

  /**
   * Registry #15 — ProposeAngle.
   * Composite body lives in `curationProposeAnglePresentation` (mirrors
   * handleProposeAngleClick; keeps seam/React db-free and AI-free).
   */
  async proposeAngle(intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }): Promise<ProposeAngleCommandResult> {
    return runCurationProposeAnglePresentation(intent);
  },

  /**
   * Registry #17 — EnsureDraftDelivery.
   * Presentation composite mirrors deliveryHandlers ensure toast.
   */
  ensureDraftDelivery(intent: {
    requestedClientId: string | null | undefined;
  }): DeliveryAssemblyPresentationResult {
    return runEnsureDraftDeliveryPresentation(intent);
  },

  /**
   * Registry #17 — AddCurationToDelivery.
   * Direct ADMIN assembly only. P10 decide composite uses frozen consumer separately.
   */
  addCurationToDelivery(intent: {
    requestedClientId: string | null | undefined;
    curationEntryId: string;
  }): DeliveryAssemblyPresentationResult {
    return runAddCurationToDeliveryPresentation(intent);
  },

  /**
   * Registry #17 — UpdateDeliveryPackageMetadata.
   */
  updateDeliveryPackageMetadata(intent: {
    requestedClientId: string | null | undefined;
    packageId: string;
    title: string;
    strategicNote: string;
  }): DeliveryAssemblyPresentationResult {
    return runUpdateDeliveryPackageMetadataPresentation(intent);
  },

  /**
   * Registry #17 — RemoveDeliveryItemFromDelivery.
   */
  removeDeliveryItemFromDelivery(intent: {
    requestedClientId: string | null | undefined;
    packageId: string;
    itemId: string;
  }): DeliveryAssemblyPresentationResult {
    return runRemoveDeliveryItemPresentation(intent);
  },

  /**
   * Registry #17 — DiscardDraftDelivery.
   */
  discardDraftDelivery(intent: {
    requestedClientId: string | null | undefined;
    packageId: string;
  }): DeliveryAssemblyPresentationResult {
    return runDiscardDraftDeliveryPresentation(intent);
  },

  /**
   * Registry #27 — AssignClientTask (MANUAL origin only).
   * Recommendation→task composite remains #33 presentation (legacy).
   * Notify + ASSIGN_TASK audit are presentation compatibility (mirrors tasksHandlers).
   */
  assignClientTaskManual(intent: {
    requestedClientId: string | null | undefined;
    thesisId: string;
    type: TaskType;
    title: string;
    description: string;
    estimatedMinutes: number;
    deadline?: string;
  }): TaskAssignCommandResult {
    try {
      const result = assignClientTask({
        requestedClientId: intent.requestedClientId,
        origin: {
          kind: 'MANUAL',
          thesisId: intent.thesisId,
          type: intent.type,
          title: intent.title,
          description: intent.description,
          estimatedMinutes: intent.estimatedMinutes,
          deadline: intent.deadline,
        },
      });
      let message = 'Tarea asignada. El cliente la verá en su portal.';
      let notifySkipped = false;
      try {
        const notified = notifyClient(result.task.clientId, {
          type: 'TASK_ASSIGNED',
          title: 'Nueva tarea asignada',
          body: result.task.title,
          href: 'client-home',
          targetId: result.task.id,
        });
        if (!notified) {
          notifySkipped = true;
          message = 'Tarea guardada. El cliente no tiene cuenta vinculada para avisos.';
        }
      } catch {
        // Best-effort compatibility — assign already persisted.
      }
      try {
        auditService.log(authService.getCurrentUser(), 'ASSIGN_TASK', 'Task', result.task.clientId, {
          title: result.task.title,
          type: result.task.type,
        });
      } catch {
        // Best-effort compatibility.
      }
      return { ok: true, taskId: result.task.id, message, notifySkipped };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo asignar la tarea',
      };
    }
  },

  /**
   * Registry #27 — CancelClientTask.
   * CANCEL_TASK audit is consumer-owned. Missing-task compat mirrors legacy toast success.
   */
  cancelClientTask(intent: { taskId: string }): TaskCancelCommandResult {
    try {
      const result = cancelClientTask({ taskId: intent.taskId });
      if (!result.ok && result.compat === 'TASK_NOT_FOUND') {
        return { ok: true, message: 'Tarea cancelada', compatMissing: true };
      }
      if (!result.ok) {
        return { ok: false, message: 'No se pudo cancelar la tarea' };
      }
      return { ok: true, message: 'Tarea cancelada' };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo cancelar la tarea',
      };
    }
  },

  /**
   * Registry #18 — SendDeliveryPackage.
   * Public input only. Client BRIEFING notify is presentation compatibility
   * after canonical success (mirrors contentPipelineCommands.sendDelivery).
   * Audit DELIVERY_SENT remains consumer-owned.
   */
  async sendDeliveryPackage(intent: {
    requestedClientId: string | null | undefined;
    packageId: string;
  }): Promise<DeliverySendCommandResult> {
    try {
      const result = await sendDeliveryPackage(intent);
      let message = `Briefing enviado. ${
        result.createdTasks
          ? `${result.createdTasks} tarea(s) creada(s).`
          : 'Sin tareas nuevas.'
      }`;
      let notifySkipped = false;
      try {
        const facts = readDeliverySentNotifyFacts(result.packageId);
        const notified = notifyClient(result.clientId, {
          type: 'BRIEFING',
          title: 'Nuevo briefing de tu Brand Manager',
          body: `${facts?.title || 'Briefing'} · ${facts?.itemCount ?? result.itemCount} ítem(s)`,
          href: 'client-home',
        });
        if (!notified) {
          notifySkipped = true;
          message = 'Briefing enviado. El cliente no tiene cuenta vinculada para avisos.';
        }
      } catch {
        // Best-effort compatibility — send already persisted.
      }
      return {
        ok: true,
        packageId: result.packageId,
        createdTasks: result.createdTasks,
        message,
        notifySkipped,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo enviar el briefing',
      };
    }
  },

  transitionClientTask(intent: {
    requestedClientId: string | null | undefined;
    taskId: string;
    intent: 'view' | 'start' | 'complete' | 'cancel' | 'request_changes' | 'attach_evidence';
    evidenceUrl?: string;
    clientNotes?: string;
  }): CommandResult {
    try {
      transitionClientTask(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo actualizar la tarea',
      };
    }
  },

  saveContentDraft(intent: {
    requestedClientId: string | null | undefined;
    contentId: string;
    fields: {
      title?: string;
      body?: string;
      type?: ContentType;
      targetPlatform?: 'LinkedIn' | 'YouTube' | 'PersonalWebsite' | 'Substack' | 'LegalJournal';
      teleprompterScript?: string;
      managerNotes?: string;
    };
    requestedTargetStatus?: ContentStatus;
  }): CommandResult {
    try {
      saveContentDraft(intent);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : 'No se pudo guardar el borrador',
      };
    }
  },

  reviewClientArticle(intent: {
    requestedClientId: string | null | undefined;
    contentId: string;
    decision: 'save_revision' | 'approve' | 'request_changes';
    title?: string;
    body?: string;
    reason?: string;
    taskId?: string;
  }): ArticleReviewCommandResult {
    const fallback =
      intent.decision === 'save_revision'
        ? 'No se pudo guardar la revisión'
        : intent.decision === 'approve'
          ? 'No se pudo aprobar el artículo'
          : 'No se pudo rechazar el artículo';
    try {
      const result = reviewClientArticle(intent);
      try {
        if (result.decision === 'save_revision' && result.feedbackEvent) {
          notifyManager(result.content.clientId, {
            type: 'CONTENT_REVIEW',
            title: 'Cliente editó borrador',
            body: `«${result.content.title}»: +${result.feedbackEvent.diffSummary?.added ?? 0}/−${result.feedbackEvent.diffSummary?.removed ?? 0} líneas`,
            href: 'ws-production',
            targetId: result.content.id,
          });
        } else if (result.decision === 'approve') {
          notifyManager(result.content.clientId, {
            type: 'CONTENT_REVIEW',
            title: 'Artículo aprobado por el cliente',
            body: `«${result.content.title}» está listo para finalizar.`,
            href: 'ws-production',
          });
        } else if (result.decision === 'request_changes') {
          notifyManager(result.content.clientId, {
            type: 'CONTENT_REVIEW',
            title: 'Artículo rechazado por el cliente',
            body: (intent.reason || '').trim(),
            href: 'ws-production',
          });
        }
      } catch {
        // Best-effort compatibility — review decision already persisted.
      }

      const message =
        result.decision === 'save_revision'
          ? result.feedbackEvent
            ? 'Cambios guardados. Tu manager verá el diff.'
            : 'Sin cambios respecto al borrador original.'
          : result.decision === 'approve'
            ? 'Artículo aprobado y enviado al manager'
            : 'Rechazo enviado con tu motivo';

      return {
        ok: true,
        decision: result.decision,
        message,
        hadRevisionEvent: Boolean(result.feedbackEvent),
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof ExecutionDeliveryError || err instanceof Error
            ? err.message
            : fallback,
      };
    }
  },

  /**
   * P4 presentation open for REVIEW_ARTICLE only.
   * Mirrors legacy `markArticleReviewStarted`: narrow #28 start when applicable,
   * then compatibility pipeline steps. Not a generic start surface.
   */
  openClientArticleReview(intent: {
    requestedClientId: string | null | undefined;
    contentId: string;
    taskId?: string;
  }): CommandResult {
    return openClientArticleReviewPresentation(intent);
  },
} as const;

/**
 * CR-1 Execution Delivery (#19 AcknowledgeDelivery) — P1 React parity.
 *
 * Delegates to `executionDeliveryConsumer.acknowledgeDelivery` (frozen Application
 * command). Manager notification is presentation-only compatibility after success.
 */
export const deliveryAckCommands = {
  acknowledge(scope: TrustedTenantScope, packageId: string, clientAckNote?: string): CommandResult {
    if (!scope.clientId) return { ok: false, message: 'Cliente no resuelto' };
    const trimmedNote = clientAckNote?.trim() || undefined;
    try {
      const result = acknowledgeDeliveryConsumer({
        requestedClientId: scope.clientId,
        packageId,
        clientAckNote: trimmedNote,
      });
      if (!result.ok) {
        return { ok: false, message: 'No se pudo marcar el briefing' };
      }
      const ctx = readBriefingAckNotificationContext(scope, result.packageId);
      if (ctx) {
        try {
          notifyManagerBriefingAcknowledged(
            ctx.clientId,
            ctx.packageTitle,
            ctx.clientDisplayName,
            trimmedNote
          );
        } catch {
          // Best-effort compatibility — acknowledgement already persisted.
        }
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'No se pudo marcar el briefing',
      };
    }
  },
} as const;

/**
 * Dossier export (wave 2, T-010-201) — PRESENTATION_ONLY.
 *
 * Copying or downloading Markdown formats data the user is already looking at.
 * No business state changes: `dossierExport` is a pure formatter plus a browser
 * download, and the audit entry is observability, written by the same trusted
 * service the legacy handler uses. No `dbService` mutation is involved, which is
 * why this is allowed to cross the seam while a real legacy write is not.
 */
export const dossierPresentationCommands = {
  async copyMarkdown(dossier: MasterDossier, client: Client): Promise<CommandResult> {
    const markdown = formatDossierMarkdown(dossier, client);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      return { ok: false, message: 'No se pudo copiar al portapapeles' };
    }
    auditService.log(authService.getCurrentUser(), 'COPY_DOSSIER', 'MasterDossier', client.id);
    return { ok: true };
  },

  download(dossier: MasterDossier, client: Client): CommandResult {
    downloadDossierMarkdown(dossier, client);
    auditService.log(authService.getCurrentUser(), 'EXPORT_DOSSIER', 'MasterDossier', client.id);
    return { ok: true };
  },
} as const;
