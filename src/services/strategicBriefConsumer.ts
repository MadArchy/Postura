import {
  StrategicBriefError,
  type AuthorizeStrategicDownstreamResult,
  type CreateStrategicBriefInput,
} from '../application/strategicBrief';
import { composeStrategicBrief } from '../composition/strategicBrief/composeStrategicBrief';
import type { StrategicBrief, StrategicDownstreamAction } from '../domain/strategicBriefCore';
import {
  curationDestinationToAuthorizedAction,
  strategicDenialMessage,
} from '../domain/briefConsumerCore';
import {
  createLocalStrategicBriefStore,
  LocalStrategicBriefStore,
  type StrategicBriefContextSource,
} from '../infrastructure/strategicBrief';
import type { CurationDestination } from '../types';
import { requireTenantScope } from '../controllers/trustedTenant';
import { FIREBASE_ENABLED } from '../firebase/config';
import { authService } from './auth';
import { dbService } from './db';
import type { TrustedBriefActorContext } from '../application/strategicBrief/trustedContext';

type BriefUseCases = ReturnType<typeof composeStrategicBrief>;

/** Narrow CR-2 consumer error — not an Application/Domain taxonomy extension. */
export class BriefFromCurationConsumerError extends Error {
  readonly code = 'CURATION_DESTINATION_MISMATCH' as const;

  constructor(message: string) {
    super(message);
    this.name = 'BriefFromCurationConsumerError';
  }
}

let store: LocalStrategicBriefStore = createLocalStrategicBriefStore();
let useCases: BriefUseCases = buildUseCases(store);
let unbindRemotePush = bindRemotePush(store);

function scheduleRemotePush(): void {
  if (!FIREBASE_ENABLED) return;
  void import('./firestore/strategicBriefSync').then((sync) => {
    sync.scheduleStrategicBriefPush(() => store.exportRecords());
  });
}

function bindRemotePush(briefStore: LocalStrategicBriefStore): () => void {
  return briefStore.subscribe(scheduleRemotePush);
}

/**
 * ADMIN session start: folds the organization's Firestore Briefs into the local store,
 * then uploads every local record the server does not hold yet.
 */
export async function syncStrategicBriefsWithFirestore(
  organizationId: string,
  clientIds: readonly string[]
): Promise<void> {
  const sync = await import('./firestore/strategicBriefSync');
  sync.startStrategicBriefSync(organizationId);
  store.mergeRemoteRecords(await sync.pullStrategicBriefs(clientIds));
  sync.scheduleStrategicBriefPush(() => store.exportRecords());
}

function buildUseCases(briefStore: LocalStrategicBriefStore): BriefUseCases {
  const signals: StrategicBriefContextSource = {
    getSignalById: (id) => dbService.getSignalById(id),
    getEvidenceById: (id) => {
      const item = dbService.getEvidenceById(id);
      if (!item) return undefined;
      return { id: item.id, organizationId: item.organizationId, clientId: item.clientId };
    },
  };
  return composeStrategicBrief({ store: briefStore, signals });
}

/** Test-only reset — not production API. */
export function resetStrategicBriefConsumerForTest(nextStore?: LocalStrategicBriefStore): void {
  unbindRemotePush();
  store = nextStore ?? createLocalStrategicBriefStore();
  store.resetForTest();
  useCases = buildUseCases(store);
  unbindRemotePush = bindRemotePush(store);
}

export function buildTrustedBriefContext(clientId: string, now?: string): TrustedBriefActorContext | undefined {
  // CR-3: organization comes from the trusted session via requireTenantScope —
  // never from the requested client record.
  const decision = requireTenantScope(clientId, {
    getCurrentUser: () => authService.getCurrentUser(),
    getClientById: (id) => dbService.getClientById(id),
  });
  if (!decision.ok) return undefined;
  return {
    actorId: decision.actorId,
    actorRole: decision.actorRole === 'CLIENT' ? 'CLIENT' : 'ADMIN',
    organizationId: decision.organizationId,
    clientId: decision.clientId,
    now: now ?? new Date().toISOString(),
  };
}

export function listStrategicBriefs(clientId: string): StrategicBrief[] {
  const client = dbService.getClientById(clientId);
  if (!client) return [];
  return store.listByTenant({ organizationId: client.organizationId, clientId });
}

export function getStrategicBrief(briefId: string, clientId: string): StrategicBrief | undefined {
  const trusted = buildTrustedBriefContext(clientId);
  if (!trusted) return undefined;
  return store.getById(briefId, trusted);
}

export function authorizeStrategicDownstream(params: {
  clientId: string;
  briefId: string;
  requestedAction: StrategicDownstreamAction;
  now?: string;
}): AuthorizeStrategicDownstreamResult {
  const trusted = buildTrustedBriefContext(params.clientId, params.now);
  if (!trusted) {
    return {
      authorized: false,
      briefId: params.briefId,
      denialCode: 'ACTOR_NOT_AUTHORIZED',
      denialReason: 'Missing trusted actor context.',
    };
  }
  return useCases.authorize({
    trusted,
    briefId: params.briefId,
    requestedAction: params.requestedAction,
  });
}

export function requireStrategicAuthorization(params: {
  clientId: string;
  briefId: string | undefined;
  requestedAction: StrategicDownstreamAction;
}): AuthorizeStrategicDownstreamResult {
  if (!params.briefId?.trim()) {
    return {
      authorized: false,
      briefId: params.briefId ?? '',
      denialCode: 'BRIEF_NOT_FOUND',
      denialReason: 'strategicBriefId is required for strategic downstream actions.',
    };
  }
  return authorizeStrategicDownstream({
    clientId: params.clientId,
    briefId: params.briefId,
    requestedAction: params.requestedAction,
  });
}

export function formatAuthorizationDenial(result: AuthorizeStrategicDownstreamResult): string {
  return strategicDenialMessage(result.denialCode, result.denialReason);
}

export function createBriefFromCurationEntry(params: {
  curationEntryId: string;
  destination: CurationDestination;
  briefId?: string;
  now?: string;
}): { brief: StrategicBrief; created: boolean } {
  const entry = dbService.getCurationById(params.curationEntryId);
  if (!entry) {
    throw new Error('Curation entry not found.');
  }

  const trusted = buildTrustedBriefContext(entry.clientId, params.now);
  if (!trusted) throw new Error('Trusted actor context required to create Strategic Brief.');
  if (!entry.signalId) {
    throw new Error('Curation entry must reference a signal to create a governed Brief.');
  }

  const authoritativeDestination = entry.destination;
  if (!authoritativeDestination) {
    throw new Error('Curation entry must have a decided destination to create a Strategic Brief.');
  }

  if (params.destination !== authoritativeDestination) {
    throw new BriefFromCurationConsumerError(
      `Curation destination mismatch: caller asserted ${params.destination}, authoritative destination is ${authoritativeDestination}.`
    );
  }

  const authorizedAction = curationDestinationToAuthorizedAction(authoritativeDestination);
  if (!authorizedAction) {
    throw new Error('This curation destination does not require a Strategic Brief.');
  }

  const input: CreateStrategicBriefInput = {
    trusted,
    briefId: params.briefId ?? `brief_${entry.id}`,
    signalIds: [entry.signalId],
    primaryAudience: 'Target audience',
    geography: 'TBD',
    territory: entry.title.slice(0, 120),
    framework: 'Governed curation decision',
    strategicAngle: entry.aiAngle || entry.title,
    supportingEvidenceIds: [],
    riskFlags: [],
    recommendedChannel: 'LINKEDIN',
    recommendedFormat: 'ARTICLE',
    CTA: 'Review and approve',
    authorizedAction,
    decisionRationale: entry.managerRationale || 'Governed Brief from curation review.',
  };

  try {
    const result = useCases.create(input);
    dbService.setCurationStrategicBriefId(entry.id, result.brief.id);
    return { brief: result.brief, created: result.created };
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      throw err;
    }
    throw err;
  }
}

export function approveStrategicBrief(params: {
  clientId: string;
  briefId: string;
  now?: string;
}): StrategicBrief {
  const trusted = buildTrustedBriefContext(params.clientId, params.now);
  if (!trusted) throw new Error('Trusted actor context required to approve Strategic Brief.');
  const result = useCases.approve({ trusted, briefId: params.briefId });
  return result.brief;
}

export function findApprovedBriefForSignal(params: {
  clientId: string;
  signalId: string;
  action: StrategicDownstreamAction;
}): StrategicBrief | undefined {
  return listStrategicBriefs(params.clientId).find(
    (b) =>
      b.status === 'APPROVED' &&
      !b.supersededByBriefId &&
      b.decision.authorizedAction === params.action &&
      b.signalIds.includes(params.signalId)
  );
}

export { strategicDenialMessage };

export type { StrategicBriefError };
