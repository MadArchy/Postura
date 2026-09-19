/**
 * SPEC-010 · wave-3 page query hooks (T-010-301…305).
 *
 * AUTHORITY: NONE. Same contract as the wave-2 hooks: each hook is disabled
 * without a trusted tenant scope, builds its cache key from that scope, and
 * declares exactly ONE read source, which is part of the key so a canonical
 * projection and a compatibility read of the same resource can never collide
 * (threats T-010-08, T-010-13).
 *
 * No hook holds a business rule. Every derived number these hooks expose was
 * computed by a domain function inside the read facade — completeness, weight
 * validation, review readiness, thesis strength, work stage, source health
 * (threat T-010-19).
 *
 * Mutations invalidate by tenant rather than patching the cache, so a command's
 * effect is re-read from the source of truth (threats T-010-06, T-010-07).
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { tenantInvalidationKey, tenantQueryKey } from '../query/queryKeys';
import type { TrustedTenantScope } from '../query/tenantScope';
import {
  readAiCenter,
  readClientContent,
  readClientLatestBriefing,
  readClientTaskScriptPayload,
  readClientTasks,
  readContentDetail,
  readPortfolioOverview,
  readThesisDetail,
  readThesisOptions,
  readWorkspaceAdvice,
  readWorkspaceContent,
  readWorkspaceDeliver,
  readWorkspaceRadar,
  readWorkspaceSources,
  readWorkspaceTasks,
} from '../data/compatibilityReads';
import {
  readContentAuthorizingBriefs,
  readSignalOutcomes,
  readStrategicBriefs,
} from '../data/canonicalReads';
import { briefCommands, clientLifecycleCommands, deliveryAckCommands, executionDeliveryCommands, radarCommands, signalIntakeCommands, signalOutcomeCommands, thesisLifecycleCommands, type ArticleReviewCommandResult, type CommandResult, type CreateBriefFromCurationCommandResult, type CreateClientWithInviteCommandResult, type CurationDecideCommandResult, type DeliveryAssemblyPresentationResult, type DeliverySendCommandResult, type PollAllActiveSourcesCommandResult, type PollRegisteredSourceCommandResult, type ProposeAngleCommandResult, type RadarDiscardCommandResult, type RadarSendToCurationCommandResult, type TaskAssignCommandResult, type TaskCancelCommandResult, type ThesisClientReviewCommandResult, type ThesisSaveCommandResult } from '../commands/commandSeam';
import type { ContentStatus, ContentType, CurationDestination, SourceType, TaskType } from '../../types';
import type { ThesisEditableFields } from '../../types';
import type { ThesisSaveIntent } from '../../domain/thesisRevisionCore';

const DISABLED = ['disabled'] as const;

/** READ SOURCE: compatibility — T-010-303. Portfolio scope, not client-scoped. */
export function usePortfolioOverview(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'portfolio-overview') : DISABLED,
    queryFn: () => readPortfolioOverview(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility — T-010-303. */
export function useAiCenter(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'ai-center') : DISABLED,
    queryFn: () => readAiCenter(scope!),
    enabled: scope !== null,
  });
}

/** READ SOURCE: compatibility — T-010-301, T-010-304. Full thesis list, no selection. */
export function useThesisOptions(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'thesis-options') : DISABLED,
    queryFn: () => readThesisOptions(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/**
 * READ SOURCE: compatibility — T-010-301.
 *
 * The thesis id is part of the cache key, so switching thesis cannot serve
 * another thesis's projection from cache. A null id keeps the query disabled
 * rather than resolving to a default thesis (threat T-010-15).
 */
export function useThesisDetail(scope: TrustedTenantScope | null, thesisId: string | null) {
  return useQuery({
    queryKey: scope
      ? tenantQueryKey(scope, 'compatibility', 'thesis-detail', thesisId ?? 'none')
      : DISABLED,
    queryFn: () => readThesisDetail(scope!, thesisId),
    enabled: scope !== null && scope.clientId !== null && thesisId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-304. */
export function useClientTasks(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'client-tasks') : DISABLED,
    queryFn: () => readClientTasks(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — P3B teleprompter script for one video task. */
export function useClientTaskScriptPayload(
  scope: TrustedTenantScope | null,
  taskId: string | null
) {
  return useQuery({
    queryKey: scope
      ? tenantQueryKey(scope, 'compatibility', 'client-task-script', taskId ?? 'none')
      : DISABLED,
    queryFn: () => readClientTaskScriptPayload(scope!, taskId!),
    enabled: scope !== null && scope.clientId !== null && taskId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-304. */
export function useClientContent(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'client-content') : DISABLED,
    queryFn: () => readClientContent(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-302. */
export function useContentDetail(scope: TrustedTenantScope | null, contentId: string | null) {
  return useQuery({
    queryKey: scope
      ? tenantQueryKey(scope, 'compatibility', 'content-detail', contentId ?? 'none')
      : DISABLED,
    queryFn: () => readContentDetail(scope!, contentId),
    enabled: scope !== null && scope.clientId !== null && contentId !== null,
  });
}

/** READ SOURCE: compatibility — #31 ADMIN production list. */
export function useWorkspaceContent(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-content') : DISABLED,
    queryFn: () => readWorkspaceContent(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** CR-1 #31 SaveContentDraft — P16 React content-editor parity (ADMIN, edit-existing). */
export function useSaveContentDraft(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CommandResult,
    Error,
    {
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
    }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.saveContentDraft({
        requestedClientId: scope.clientId,
        contentId: intent.contentId,
        fields: intent.fields,
        requestedTargetStatus: intent.requestedTargetStatus,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceRadar(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-radar') : DISABLED,
    queryFn: () => readWorkspaceRadar(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** CR-1 #20 DiscardSignal — P9 React radar discard parity. */
export function useDiscardRadarSignal(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<RadarDiscardCommandResult, Error, { signalId: string }>({
    mutationFn: async ({ signalId }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return radarCommands.discardSignal({
        requestedClientId: scope.clientId,
        signalId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/**
 * CR-1 #21 radar composite — AddSignalToCuration + MarkSignalSaved (+ optional ScoreAndRouteSignal).
 * Advisor AddAdviceActionToCuration is not exposed.
 */
export function useSendSignalToCuration(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<RadarSendToCurationCommandResult, Error, { signalId: string }>({
    mutationFn: async ({ signalId }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return radarCommands.sendToCuration({
        requestedClientId: scope.clientId,
        signalId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceDeliver(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-deliver') : DISABLED,
    queryFn: () => readWorkspaceDeliver(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — latest PositioningAdvice actions. No generate. */
export function useWorkspaceAdvice(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-advice') : DISABLED,
    queryFn: () => readWorkspaceAdvice(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** CR-1 #21a advisor — AddAdviceActionToCuration. Presentation only. */
export function useAddAdviceActionToCuration(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { adviceActionId: string }>({
    mutationFn: async ({ adviceActionId }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.addAdviceActionToCuration({
        requestedClientId: scope.clientId,
        adviceActionId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantQueryKey(scope, 'compatibility', 'workspace-deliver'),
      });
    },
  });
}

/** CR-1 #14 DecideCuration — P10 React deliver decide parity. */
export function useDecideCuration(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CurationDecideCommandResult,
    Error,
    { curationEntryId: string; destination: CurationDestination; rationale: string }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.decideCuration({
        requestedClientId: scope.clientId,
        curationEntryId: intent.curationEntryId,
        destination: intent.destination,
        rationale: intent.rationale,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** CR-1 #16-R RemoveCuration — presentation only. */
export function useRemoveCuration(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { curationEntryId: string }>({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.removeCuration({
        requestedClientId: scope.clientId,
        curationEntryId: intent.curationEntryId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantQueryKey(scope, 'compatibility', 'workspace-deliver'),
      });
    },
  });
}

/** CR-1 #16-O ReopenCuration — presentation only. */
export function useReopenCuration(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { curationEntryId: string }>({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.reopenCuration({
        requestedClientId: scope.clientId,
        curationEntryId: intent.curationEntryId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantQueryKey(scope, 'compatibility', 'workspace-deliver'),
      });
    },
  });
}

/** CR-1 #15 ProposeAngle — P11 React deliver propose-angle parity. */
export function useProposeAngle(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<ProposeAngleCommandResult, Error, { curationEntryId: string }>({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.proposeAngle({
        requestedClientId: scope.clientId,
        curationEntryId: intent.curationEntryId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** CR-1 #18 SendDeliveryPackage — P7 React delivery send parity. */
export function useSendDeliveryPackage(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<DeliverySendCommandResult, Error, { packageId: string }>({
    mutationFn: async ({ packageId }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.sendDeliveryPackage({
        requestedClientId: scope.clientId,
        packageId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceSources(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-sources') : DISABLED,
    queryFn: () => readWorkspaceSources(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

function invalidateSourceReads(queryClient: QueryClient, scope: TrustedTenantScope) {
  void queryClient.invalidateQueries({
    queryKey: tenantQueryKey(scope, 'compatibility', 'workspace-sources'),
  });
  void queryClient.invalidateQueries({
    queryKey: tenantQueryKey(scope, 'compatibility', 'sources'),
  });
}

function invalidateRadarReads(queryClient: QueryClient, scope: TrustedTenantScope) {
  void queryClient.invalidateQueries({
    queryKey: tenantQueryKey(scope, 'compatibility', 'workspace-radar'),
  });
}

/** CR-1 #8/#24 RegisterSource — presentation only. */
export function useRegisterSource(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CommandResult,
    Error,
    { name: string; type: SourceType; url?: string; fetchIntervalMinutes?: number }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return signalIntakeCommands.registerSource({
        requestedClientId: scope.clientId,
        name: params.name,
        type: params.type,
        url: params.url,
        fetchIntervalMinutes: params.fetchIntervalMinutes,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateSourceReads(queryClient, scope);
    },
  });
}

/** CR-1 #9 PollRegisteredSource — presentation only. */
export function usePollRegisteredSource(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<PollRegisteredSourceCommandResult, Error, { sourceId: string }>({
    mutationFn: async ({ sourceId }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return signalIntakeCommands.pollRegisteredSource({
        requestedClientId: scope.clientId,
        sourceId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateSourceReads(queryClient, scope);
      invalidateRadarReads(queryClient, scope);
    },
  });
}

/** CR-1 #9 PollAllActiveSources — presentation only; Application owns iteration. */
export function usePollAllActiveSources(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<PollAllActiveSourcesCommandResult, Error, void>({
    mutationFn: async () => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return signalIntakeCommands.pollAllActiveSources({
        requestedClientId: scope.clientId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateSourceReads(queryClient, scope);
      invalidateRadarReads(queryClient, scope);
    },
  });
}

/** CR-1 #26 RegisterManualSignal — presentation only. No scoring. */
export function useRegisterManualSignal(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { title: string }>({
    mutationFn: async ({ title }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return signalIntakeCommands.registerManualSignal({
        requestedClientId: scope.clientId,
        title,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateRadarReads(queryClient, scope);
    },
  });
}

/** READ SOURCE: compatibility — T-010-305. */
export function useWorkspaceTasks(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'workspace-tasks') : DISABLED,
    queryFn: () => readWorkspaceTasks(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** CR-1 #27 AssignClientTask — P8 MANUAL assign only. */
export function useAssignClientTaskManual(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    TaskAssignCommandResult,
    Error,
    {
      thesisId: string;
      type: TaskType;
      title: string;
      description: string;
      estimatedMinutes: number;
      deadline?: string;
    }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.assignClientTaskManual({
        requestedClientId: scope.clientId,
        ...params,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** CR-1 #27 CancelClientTask — P8 React cancel parity. */
export function useCancelClientTask(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<TaskCancelCommandResult, Error, { taskId: string }>({
    mutationFn: async ({ taskId }) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.cancelClientTask({ taskId });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** READ SOURCE: canonical (SPEC-003 `strategicBriefConsumer`) — T-010-305. */
export function useStrategicBriefs(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'strategic-briefs') : DISABLED,
    queryFn: () => readStrategicBriefs(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: canonical (SPEC-003) — T-010-302. Briefs authorizing content creation. */
export function useContentAuthorizingBriefs(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'briefs-authorizing-content') : DISABLED,
    queryFn: () => readContentAuthorizingBriefs(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: canonical (SPEC-008 `learningLoopConsumer`) — T-010-305. */
export function useSignalOutcomes(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'signal-outcomes') : DISABLED,
    queryFn: () => readSignalOutcomes(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-304 client portal home briefing (P1 #19). */
export function useClientLatestBriefing(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'client-latest-briefing') : DISABLED,
    queryFn: () => readClientLatestBriefing(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** CR-1 #19 AcknowledgeDelivery — P1 React parity command seam. */
export function useAcknowledgeDelivery(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { packageId: string; clientAckNote?: string }>({
    mutationFn: async (params) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return deliveryAckCommands.acknowledge(scope, params.packageId, params.clientAckNote);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/** CR-1 #28 TransitionClientTask — P3A generic + P3B video intents. */
export function useTransitionClientTask(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CommandResult,
    Error,
    {
      taskId: string;
      intent: 'view' | 'complete' | 'request_changes' | 'start' | 'attach_evidence';
      clientNotes?: string;
      evidenceUrl?: string;
    }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.transitionClientTask({
        requestedClientId: scope.clientId,
        taskId: params.taskId,
        intent: params.intent,
        clientNotes: params.clientNotes,
        evidenceUrl: params.evidenceUrl,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/** CR-1 #32 ReviewClientArticle — P4 React client article-review parity. */
export function useReviewClientArticle(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    ArticleReviewCommandResult,
    Error,
    {
      contentId: string;
      decision: 'save_revision' | 'approve' | 'request_changes';
      title?: string;
      body?: string;
      reason?: string;
      taskId?: string;
    }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.reviewClientArticle({
        requestedClientId: scope.clientId,
        contentId: params.contentId,
        decision: params.decision,
        title: params.title,
        body: params.body,
        reason: params.reason,
        taskId: params.taskId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/** P4 — REVIEW_ARTICLE open: narrow #28 start + compatibility pipeline (presentation only). */
export function useOpenClientArticleReview(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { contentId: string; taskId?: string }>({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.openClientArticleReview({
        requestedClientId: scope.clientId,
        contentId: params.contentId,
        taskId: params.taskId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/** CR-1 #13 DecideThesisClientReview — P2 React parity command seam. */
export function useDecideThesisClientReview(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    ThesisClientReviewCommandResult,
    Error,
    { thesisId: string; decision: 'approve' | 'request_changes'; feedback?: string }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return thesisLifecycleCommands.decideClientReview({
        requestedClientId: scope.clientId,
        thesisId: params.thesisId,
        decision: params.decision,
        feedback: params.feedback,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/** CR-1 #11 SaveThesis — P5 React manager thesis save parity. */
export function useSaveThesis(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    ThesisSaveCommandResult,
    Error,
    { thesisId: string; intent: ThesisSaveIntent; fields: ThesisEditableFields }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return thesisLifecycleCommands.saveThesis({
        requestedClientId: scope.clientId,
        thesisId: params.thesisId,
        intent: params.intent,
        fields: params.fields,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/** CR-1 #12 ActivateThesis — P5 React manager thesis activate parity. */
export function useActivateThesis(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { thesisId: string }>({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return thesisLifecycleCommands.activateThesis({
        requestedClientId: scope.clientId,
        thesisId: params.thesisId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

/**
 * SPEC-008 signal-outcome intent — T-010-305.
 *
 * Only ids, a kind and an optional note cross the boundary. The canonical
 * consumer loads current state itself, so nothing here can pass a stale
 * aggregate as authority.
 */
export function useRegisterSignalOutcome(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CommandResult,
    Error,
    { signalId: string; kind: 'USEFUL' | 'NOT_USEFUL'; thesisId?: string | null; note?: string }
  >({
    mutationFn: async (params) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return signalOutcomeCommands.register(scope, params);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'canonical') });
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** CR-1 #1 AcceptClientInvitation — P15 React invite accept parity (unauthenticated). */
export function useAcceptClientInvitation() {
  return useMutation<
    CommandResult,
    Error,
    { token: string; password: string; displayName: string }
  >({
    mutationFn: async (intent) => clientLifecycleCommands.acceptInvitation(intent),
  });
}

/** CR-1 #34 CreateClientWithInvite — P14 React cockpit create-client parity. */
export function useCreateClientWithInvite(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CreateClientWithInviteCommandResult,
    Error,
    {
      firstName: string;
      lastName: string;
      email: string;
      profession?: string;
      company?: string;
      targetMarket?: string;
    }
  >({
    mutationFn: async (intent) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización.' };
      return clientLifecycleCommands.createClientWithInvite(intent);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
    },
  });
}

/** CR-2 createBriefFromCurationEntry — P12 React deliver brief-create parity. */
export function useCreateBriefFromCuration(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CreateBriefFromCurationCommandResult,
    Error,
    { curationEntryId: string; destination: CurationDestination }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return briefCommands.createFromCuration(intent);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'compatibility'),
      });
      void queryClient.invalidateQueries({
        queryKey: tenantInvalidationKey(scope, 'canonical'),
      });
    },
  });
}

function invalidateDeliverWorkspace(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: TrustedTenantScope
) {
  void queryClient.invalidateQueries({
    queryKey: tenantInvalidationKey(scope, 'compatibility'),
  });
}

/** P13 — Registry #17 EnsureDraftDelivery. */
export function useEnsureDraftDelivery(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<DeliveryAssemblyPresentationResult, Error, void>({
    mutationFn: async () => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.ensureDraftDelivery({
        requestedClientId: scope.clientId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateDeliverWorkspace(queryClient, scope);
    },
  });
}

/** P13 — Registry #17 AddCurationToDelivery. */
export function useAddCurationToDelivery(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    DeliveryAssemblyPresentationResult,
    Error,
    { curationEntryId: string }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.addCurationToDelivery({
        requestedClientId: scope.clientId,
        curationEntryId: intent.curationEntryId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateDeliverWorkspace(queryClient, scope);
    },
  });
}

/** P13 — Registry #17 UpdateDeliveryPackageMetadata. */
export function useUpdateDeliveryPackageMetadata(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    DeliveryAssemblyPresentationResult,
    Error,
    { packageId: string; title: string; strategicNote: string }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.updateDeliveryPackageMetadata({
        requestedClientId: scope.clientId,
        ...intent,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateDeliverWorkspace(queryClient, scope);
    },
  });
}

/** P13 — Registry #17 RemoveDeliveryItemFromDelivery. */
export function useRemoveDeliveryItemFromDelivery(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    DeliveryAssemblyPresentationResult,
    Error,
    { packageId: string; itemId: string }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.removeDeliveryItemFromDelivery({
        requestedClientId: scope.clientId,
        ...intent,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateDeliverWorkspace(queryClient, scope);
    },
  });
}

/** P13 — Registry #17 DiscardDraftDelivery. */
export function useDiscardDraftDelivery(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    DeliveryAssemblyPresentationResult,
    Error,
    { packageId: string }
  >({
    mutationFn: async (intent) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return executionDeliveryCommands.discardDraftDelivery({
        requestedClientId: scope.clientId,
        packageId: intent.packageId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateDeliverWorkspace(queryClient, scope);
    },
  });
}

/**
 * SPEC-003 brief approval — T-010-305.
 *
 * The React button is enabled from the canonical projection's own status, but
 * the consumer re-validates and may refuse; a refusal invalidates nothing and
 * leaves no UI state claiming the brief was approved.
 */
export function useApproveBrief(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { briefId: string }>({
    mutationFn: async ({ briefId }) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return briefCommands.approve(scope, briefId);
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'canonical') });
    },
  });
}
