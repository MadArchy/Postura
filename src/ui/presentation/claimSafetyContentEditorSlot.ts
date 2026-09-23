/**
 * SPEC-010 · Content Editor ClaimSafety presentation boundary.
 *
 * Selects whether leftover `renderContentEditorModal` still renders
 * `renderClaimSafetyPanel`, `#claim-safety-live`, and claim-review-ack.
 * P16 React editor accepted omission: no stored panel and no live review.
 *
 * Cutover: `omit`. The leftover host must not render Content Editor
 * ClaimSafety. This module does not invent a command or authorize anything.
 * Scope is leftover `renderContentEditorModal` ClaimSafety only.
 * It does not own workspace production ClaimSafety, content-preview
 * ClaimSafety, other editor fields, or ClaimSafetyPanel.ts.
 */

export type ClaimSafetyContentEditorSlotPresentation = 'legacy' | 'omit';

/** Phase-6 content editor ClaimSafety cutover: leftover editor omits ClaimSafety. */
const CLAIM_SAFETY_CONTENT_EDITOR_SLOT_PRESENTATION: ClaimSafetyContentEditorSlotPresentation =
  'omit';

export function claimSafetyContentEditorSlotPresentation(): ClaimSafetyContentEditorSlotPresentation {
  return CLAIM_SAFETY_CONTENT_EDITOR_SLOT_PRESENTATION;
}

export function shouldRenderLegacyClaimSafetyContentEditorSlot(): boolean {
  return claimSafetyContentEditorSlotPresentation() === 'legacy';
}
