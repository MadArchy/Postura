/**
 * SPEC-010 · ClientWorkspace production ClaimSafety disclosure presentation
 * boundary.
 *
 * Selects whether leftover `renderContentPipeline` still renders
 * `renderClaimSafetyBadge` / `renderClaimSafetyPanel`. React already owns
 * `ReactClaimSafetyBadge` and `ReactClaimSafetyPanel` on React
 * `ProductionPanel`.
 *
 * Cutover: `omit`. The leftover host must not render Workspace Production
 * ClaimSafety. This module does not invent a command or authorize anything.
 * Scope is leftover `renderContentPipeline` ClaimSafety only.
 * It does not own content-preview ClaimSafety, content-editor ClaimSafety,
 * other ManagerCockpit surfaces, or ClaimSafetyPanel.ts.
 */

export type ClaimSafetyWorkspaceProductionSlotPresentation = 'legacy' | 'omit';

/** Phase-6 workspace production ClaimSafety cutover: leftover pipeline omits ClaimSafety. */
const CLAIM_SAFETY_WORKSPACE_PRODUCTION_SLOT_PRESENTATION: ClaimSafetyWorkspaceProductionSlotPresentation =
  'omit';

export function claimSafetyWorkspaceProductionSlotPresentation(): ClaimSafetyWorkspaceProductionSlotPresentation {
  return CLAIM_SAFETY_WORKSPACE_PRODUCTION_SLOT_PRESENTATION;
}

export function shouldRenderLegacyClaimSafetyWorkspaceProductionSlot(): boolean {
  return claimSafetyWorkspaceProductionSlotPresentation() === 'legacy';
}
