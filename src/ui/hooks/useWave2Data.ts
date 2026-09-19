/**
 * SPEC-010 · wave-2 component query hooks (T-010-201…204).
 *
 * AUTHORITY: NONE. These hooks orchestrate cache and loading concerns. They hold
 * no Strategic Score formula, routing decision, lifecycle transition,
 * publication gate, opportunity scoring or learning-approval logic — every
 * derived value they expose was computed by a domain function inside the read
 * facade (threat T-010-19).
 *
 * Each hook is disabled unless a trusted tenant scope exists, and builds its
 * cache key from that scope, so no read is issued or cached under an identity
 * the UI invented (threat T-010-08).
 *
 * Each hook declares exactly ONE read source, and the source is part of the
 * cache key, so a canonical projection and a compatibility read of the same
 * resource can never be confused or collide (threat T-010-13).
 *
 * Mutations invalidate by tenant so a command's effect is re-read from the
 * source of truth instead of being patched into the cache. Nothing here writes
 * an optimistic business outcome (threats T-010-06, T-010-07).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantInvalidationKey, tenantQueryKey } from '../query/queryKeys';
import type { TrustedTenantScope } from '../query/tenantScope';
import {
  readKpiWeekly,
  readMasterDossier,
  readOnboardingContext,
  readProfileOverview,
  readProofWall,
  readSources,
} from '../data/compatibilityReads';
import { readClientOpportunityCards } from '../data/canonicalReads';
import {
  opportunityCommands,
  resultCommands,
  masterProfileCommands,
  type CommandResult,
  type OnboardingStepCommandResult,
  type ProfileFactImportCommandResult,
} from '../commands/commandSeam';
import type { ProfileFactSection } from '../../types';

const DISABLED = ['disabled'] as const;

/** READ SOURCE: canonical (SPEC-007 `opportunityScoutConsumer`) — T-010-202. */
export function useOpportunities(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'canonical', 'opportunities') : DISABLED,
    queryFn: () => readClientOpportunityCards(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility (no canonical dossier projection exists) — T-010-201. */
export function useMasterDossier(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'master-dossier') : DISABLED,
    queryFn: () => readMasterDossier(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-203. */
export function useKpiWeekly(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'kpi-weekly') : DISABLED,
    queryFn: () => readKpiWeekly(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-203. */
export function useProfileOverview(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'profile-overview') : DISABLED,
    queryFn: () => readProfileOverview(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/**
 * READ SOURCE: compatibility — T-010-205.
 *
 * Read-only projection. Writes go through `useApplyOnboardingStep` (P6 #10).
 */
export function useOnboardingContext(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'onboarding-context') : DISABLED,
    queryFn: () => readOnboardingContext(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** CR-1 #10 ApplyOnboardingStep — P6 React onboarding write parity. */
export function useApplyOnboardingStep(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    OnboardingStepCommandResult,
    Error,
    { step: number; fields: Record<string, string> }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return masterProfileCommands.applyOnboardingStep({
        requestedClientId: scope.clientId,
        step: params.step,
        fields: params.fields,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
    },
  });
}

function invalidateCompatibility(scope: TrustedTenantScope, queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'compatibility') });
}

/** CR-1 #2 AddProfileFact — presentation only. */
export function useAddProfileFact(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<
    CommandResult,
    Error,
    { section: ProfileFactSection; label: string; value: string }
  >({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return masterProfileCommands.addProfileFact({
        requestedClientId: scope.clientId,
        section: params.section,
        label: params.label,
        value: params.value,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateCompatibility(scope, queryClient);
    },
  });
}

/** CR-1 #3 ConfirmProfileFact — presentation only. */
export function useConfirmProfileFact(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { factId: string }>({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return masterProfileCommands.confirmProfileFact({
        requestedClientId: scope.clientId,
        factId: params.factId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateCompatibility(scope, queryClient);
    },
  });
}

/** CR-1 #4 RejectProfileFact — presentation only. */
export function useRejectProfileFact(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { factId: string }>({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return masterProfileCommands.rejectProfileFact({
        requestedClientId: scope.clientId,
        factId: params.factId,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateCompatibility(scope, queryClient);
    },
  });
}

/** CR-1 #5 UpdateProfileFact — presentation only. Value only. */
export function useUpdateProfileFact(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<CommandResult, Error, { factId: string; value: string }>({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return masterProfileCommands.updateProfileFact({
        requestedClientId: scope.clientId,
        factId: params.factId,
        value: params.value,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateCompatibility(scope, queryClient);
    },
  });
}

/** CR-1 #6 ImportProfileFactsFromCv — presentation only. Text in, no extraction. */
export function useImportProfileFactsFromCv(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();
  return useMutation<ProfileFactImportCommandResult, Error, { cvText: string }>({
    mutationFn: async (params) => {
      if (!scope?.clientId) return { ok: false, message: 'Cliente no resuelto' };
      return masterProfileCommands.importProfileFactsFromCv({
        requestedClientId: scope.clientId,
        cvText: params.cvText,
      });
    },
    onSuccess: (result) => {
      if (!scope || !result.ok) return;
      invalidateCompatibility(scope, queryClient);
    },
  });
}

/** READ SOURCE: compatibility — T-010-203. */
export function useProofWall(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'proof-wall') : DISABLED,
    queryFn: () => readProofWall(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

/** READ SOURCE: compatibility — T-010-204. */
export function useSources(scope: TrustedTenantScope | null) {
  return useQuery({
    queryKey: scope ? tenantQueryKey(scope, 'compatibility', 'sources') : DISABLED,
    queryFn: () => readSources(scope!),
    enabled: scope !== null && scope.clientId !== null,
  });
}

type OpportunityIntent =
  | { kind: 'accept'; opportunityId: string; notes?: string }
  | { kind: 'decline'; opportunityId: string; notes: string }
  | { kind: 'toggle'; opportunityId: string; itemId: string; done: boolean }
  | { kind: 'submit'; opportunityId: string };

/**
 * Canonical opportunity commands — T-010-202.
 *
 * The hook forwards an intent to the command seam and, whatever the verdict,
 * invalidates the tenant's canonical cache so the next render reflects the state
 * the canonical layer actually holds rather than what the UI hoped for.
 */
export function useOpportunityCommands(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();

  return useMutation<CommandResult, Error, OpportunityIntent>({
    mutationFn: async (intent) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      switch (intent.kind) {
        case 'accept':
          return opportunityCommands.accept(scope, intent.opportunityId, intent.notes);
        case 'decline':
          return opportunityCommands.decline(scope, intent.opportunityId, intent.notes);
        case 'toggle':
          return opportunityCommands.toggleChecklistItem(
            scope,
            intent.opportunityId,
            intent.itemId,
            intent.done
          );
        case 'submit':
          return opportunityCommands.submit(scope, intent.opportunityId);
      }
    },
    onSettled: () => {
      if (scope) {
        void queryClient.invalidateQueries({ queryKey: tenantInvalidationKey(scope, 'canonical') });
      }
    },
  });
}

/** Canonical consultation intent (SPEC-008 learning loop) — T-010-203. */
export function useRegisterConsultation(scope: TrustedTenantScope | null) {
  const queryClient = useQueryClient();

  return useMutation<CommandResult, Error, string>({
    mutationFn: async (note) => {
      if (!scope) return { ok: false, message: 'Sesión sin contexto de organización' };
      return resultCommands.registerConsultation(scope, note);
    },
    onSettled: () => {
      if (scope) {
        void queryClient.invalidateQueries({
          queryKey: tenantInvalidationKey(scope, 'compatibility'),
        });
      }
    },
  });
}
