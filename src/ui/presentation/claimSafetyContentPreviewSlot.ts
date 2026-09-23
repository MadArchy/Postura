/**
 * SPEC-010 · Content Preview ClaimSafety presentation boundary.
 *
 * Selects whether leftover `renderContentPreviewModal` still renders
 * `renderClaimSafetyPanel`. React already owns `ReactClaimSafetyPanel`
 * on existing `ReactContentPreviewModal`.
 *
 * Cutover: `omit`. The leftover host must not render Content Preview
 * ClaimSafety. This module does not invent a command or authorize anything.
 * Scope is leftover `renderContentPreviewModal` ClaimSafety only.
 * It does not own workspace production ClaimSafety, content-editor
 * ClaimSafety, other modal contents, or ClaimSafetyPanel.ts.
 */

export type ClaimSafetyContentPreviewSlotPresentation = 'legacy' | 'omit';

/** Phase-6 content preview ClaimSafety cutover: leftover preview omits ClaimSafety. */
const CLAIM_SAFETY_CONTENT_PREVIEW_SLOT_PRESENTATION: ClaimSafetyContentPreviewSlotPresentation =
  'omit';

export function claimSafetyContentPreviewSlotPresentation(): ClaimSafetyContentPreviewSlotPresentation {
  return CLAIM_SAFETY_CONTENT_PREVIEW_SLOT_PRESENTATION;
}

export function shouldRenderLegacyClaimSafetyContentPreviewSlot(): boolean {
  return claimSafetyContentPreviewSlotPresentation() === 'legacy';
}
