/**
 * SPEC-010 · presentation-only React-exclusive slot registry.
 *
 * A listed slot has no remaining legal full-legacy renderer for that disclosure.
 * Whole-app unmount rollback is then illegal: React must stay mounted so the
 * exclusive slot can still render (Phase-6 Option E / A43 C6).
 *
 * This is UI metadata only. It is not a Domain concept, not persisted product
 * state, not an authorization source, and not a tenant or role authority.
 *
 * Phase-6 dossier cutover activates `client-workspace-dossier`.
 * Phase-6 opportunity cutover activates `client-portal-opportunity`.
 * Phase-6 KPI Results cutover activates `client-kpi-results` (Results only).
 * Phase-6 KPI Home cutover activates `client-kpi-home` (Home only).
 * Phase-6 ClientProfile cutover activates `client-portal-profile`
 * (ClientPortal `client-profile` body only).
 * Phase-6 portal thesis ProofWall cutover activates
 * `client-portal-thesis-proof-wall` (ClientPortal `client-thesis`
 * leftover ProofWall only). That id does not claim workspace ProofWall,
 * Wave2 profile ProofWall, service lines, or ProofWallPanel.ts.
 * Phase-6 portal thesis service-lines cutover activates
 * `client-portal-thesis-service-lines` (ClientPortal `client-thesis`
 * leftover service-lines only). That id does not claim workspace
 * service-lines, workspace ProofWall, portal ProofWall, Dossier, or
 * ProofWallPanel.ts.
 * Phase-6 workspace ProofWall cutover activates
 * `client-workspace-proof-wall` (ClientWorkspace `ws-positioning`
 * leftover editable ProofWall only). That id does not claim workspace
 * service-lines, portal ProofWall, portal service-lines, Dossier, or
 * ProofWallPanel.ts.
 * Phase-6 workspace service-lines cutover activates
 * `client-workspace-service-lines` (ClientWorkspace `ws-positioning`
 * leftover service-lines only). That id does not claim workspace
 * ProofWall, portal ProofWall, portal service-lines, Dossier, or
 * ProofWallPanel.ts.
 * Neither KPI id means KpiWeeklyChart.ts has been deleted.
 * The profile id does not claim ProofWall or Onboarding.
 * Other slots remain unlisted until their own cutover authorization.
 */

import type { UiMode } from '../strangler/toggle';

export const CLIENT_WORKSPACE_DOSSIER_SLOT = 'client-workspace-dossier';
export const CLIENT_PORTAL_OPPORTUNITY_SLOT = 'client-portal-opportunity';
export const CLIENT_KPI_RESULTS_SLOT = 'client-kpi-results';
export const CLIENT_KPI_HOME_SLOT = 'client-kpi-home';
export const CLIENT_PORTAL_PROFILE_SLOT = 'client-portal-profile';
export const CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT = 'client-portal-thesis-proof-wall';
export const CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT = 'client-portal-thesis-service-lines';
export const CLIENT_WORKSPACE_PROOF_WALL_SLOT = 'client-workspace-proof-wall';
export const CLIENT_WORKSPACE_SERVICE_LINES_SLOT = 'client-workspace-service-lines';

const KNOWN_REACT_EXCLUSIVE_SLOT_IDS = [
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_KPI_RESULTS_SLOT,
  CLIENT_KPI_HOME_SLOT,
  CLIENT_PORTAL_PROFILE_SLOT,
  CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT,
  CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT,
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  CLIENT_WORKSPACE_SERVICE_LINES_SLOT,
] as const;

export type ReactExclusiveSlotId = (typeof KNOWN_REACT_EXCLUSIVE_SLOT_IDS)[number];

/** Compile-time exclusive set. Dossier, opportunity, KPI, profile, thesis ProofWall, thesis service-lines, workspace ProofWall, and workspace service-lines surface cutovers are active. */
const CONFIGURED_REACT_EXCLUSIVE_SLOTS: readonly string[] = [
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_KPI_RESULTS_SLOT,
  CLIENT_KPI_HOME_SLOT,
  CLIENT_PORTAL_PROFILE_SLOT,
  CLIENT_PORTAL_THESIS_PROOF_WALL_SLOT,
  CLIENT_PORTAL_THESIS_SERVICE_LINES_SLOT,
  CLIENT_WORKSPACE_PROOF_WALL_SLOT,
  CLIENT_WORKSPACE_SERVICE_LINES_SLOT,
];

let exclusiveSlotOverride: readonly string[] | null = null;

function configuredSlotIds(): readonly string[] {
  return exclusiveSlotOverride ?? CONFIGURED_REACT_EXCLUSIVE_SLOTS;
}

function isKnownSlotId(id: string): id is ReactExclusiveSlotId {
  return (KNOWN_REACT_EXCLUSIVE_SLOT_IDS as readonly string[]).includes(id);
}

/**
 * True when any slot id is configured. Unknown ids fail closed to keeping
 * React mounted rather than allowing whole-app unmount.
 */
export function hasReactExclusiveSlot(): boolean {
  return configuredSlotIds().length > 0;
}

export function isReactExclusiveSlot(id: string): boolean {
  return isKnownSlotId(id) && configuredSlotIds().includes(id);
}

export function listKnownReactExclusiveSlotIds(): readonly ReactExclusiveSlotId[] {
  return KNOWN_REACT_EXCLUSIVE_SLOT_IDS;
}

export type ServedPresentation = {
  readonly requested: UiMode;
  readonly served: UiMode;
  readonly mayUnmountReact: boolean;
  readonly mayActivateLegacyRoot: boolean;
  readonly keepReactMounted: boolean;
};

/**
 * Resolves which shell may be served for a presentation request.
 * Never reads business, tenant, or persistence state.
 */
export function resolveServedUiMode(
  requested: UiMode,
  exclusive = hasReactExclusiveSlot()
): ServedPresentation {
  if (requested === 'react') {
    return {
      requested,
      served: 'react',
      mayUnmountReact: false,
      mayActivateLegacyRoot: false,
      keepReactMounted: true,
    };
  }

  if (exclusive) {
    return {
      requested,
      served: 'react',
      mayUnmountReact: false,
      mayActivateLegacyRoot: false,
      keepReactMounted: true,
    };
  }

  return {
    requested,
    served: 'legacy',
    mayUnmountReact: true,
    mayActivateLegacyRoot: true,
    keepReactMounted: false,
  };
}

/**
 * In-memory test seam for exclusive-slot presence. Not persisted and not an
 * authority API. Pass `null` to restore the compile-time (empty) default.
 *
 * @internal
 */
export function __setReactExclusiveSlotsForTests(ids: readonly string[] | null): void {
  exclusiveSlotOverride = ids;
}
