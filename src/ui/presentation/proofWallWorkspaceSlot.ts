/**
 * SPEC-010 · ClientWorkspace positioning ProofWall disclosure presentation boundary.
 *
 * Selects whether the leftover workspace host still renders `renderProofWall`
 * inside `renderPositioning`. React already owns `ReactProofWallPanel`
 * on the React workspace positioning path.
 *
 * Cutover: `omit`. The leftover host must not render workspace ProofWall.
 * This module does not invent a command or authorize anything.
 * Scope is the ClientWorkspace `ws-positioning` leftover editable ProofWall only.
 * It does not own workspace service-lines, portal ProofWall,
 * portal service-lines, Dossier, or ProofWallPanel.ts.
 */

export type ProofWallWorkspaceSlotPresentation = 'legacy' | 'omit';

/** Phase-6 workspace ProofWall cutover: ClientWorkspace omits leftover editable ProofWall. */
const PROOF_WALL_WORKSPACE_SLOT_PRESENTATION: ProofWallWorkspaceSlotPresentation = 'omit';

export function proofWallWorkspaceSlotPresentation(): ProofWallWorkspaceSlotPresentation {
  return PROOF_WALL_WORKSPACE_SLOT_PRESENTATION;
}

export function shouldRenderLegacyProofWallWorkspaceSlot(): boolean {
  return proofWallWorkspaceSlotPresentation() === 'legacy';
}
