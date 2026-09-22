/**
 * SPEC-010 · ClientPortal thesis ProofWall disclosure presentation boundary.
 *
 * Selects whether the legacy portal host still renders `renderProofWall`
 * inside `renderClientThesisBody`. React already owns `ReactProofWallPanel`
 * on the React portal thesis path.
 *
 * Cutover: `omit`. The legacy host must not render thesis ProofWall.
 * This module does not invent a command or authorize anything.
 * Scope is the ClientPortal `client-thesis` leftover ProofWall only.
 * It does not own workspace ProofWall, Wave2 profile ProofWall,
 * service lines, or ProofWallPanel.ts.
 */

export type ProofWallPortalThesisSlotPresentation = 'legacy' | 'omit';

/** Phase-6 portal thesis ProofWall cutover: ClientPortal omits leftover thesis ProofWall. */
const PROOF_WALL_PORTAL_THESIS_SLOT_PRESENTATION: ProofWallPortalThesisSlotPresentation = 'omit';

export function proofWallPortalThesisSlotPresentation(): ProofWallPortalThesisSlotPresentation {
  return PROOF_WALL_PORTAL_THESIS_SLOT_PRESENTATION;
}

export function shouldRenderLegacyProofWallPortalThesisSlot(): boolean {
  return proofWallPortalThesisSlotPresentation() === 'legacy';
}
