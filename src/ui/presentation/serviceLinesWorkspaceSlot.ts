/**
 * SPEC-010 · ClientWorkspace positioning service-lines disclosure presentation boundary.
 *
 * Selects whether the leftover workspace host still renders `renderServiceLinesReadOnly`
 * inside `renderPositioning`. React already owns service-line facts through
 * `ReactMasterDossierPanel` on the React workspace positioning path.
 *
 * Cutover: `omit`. The leftover host must not render workspace service-lines.
 * This module does not invent a command or authorize anything.
 * Scope is the ClientWorkspace `ws-positioning` leftover service-lines only.
 * It does not own workspace ProofWall, portal ProofWall,
 * portal service-lines, Dossier, or ProofWallPanel.ts.
 */

export type ServiceLinesWorkspaceSlotPresentation = 'legacy' | 'omit';

/** Phase-6 workspace service-lines cutover: ClientWorkspace omits leftover service-lines. */
const SERVICE_LINES_WORKSPACE_SLOT_PRESENTATION: ServiceLinesWorkspaceSlotPresentation = 'omit';

export function serviceLinesWorkspaceSlotPresentation(): ServiceLinesWorkspaceSlotPresentation {
  return SERVICE_LINES_WORKSPACE_SLOT_PRESENTATION;
}

export function shouldRenderLegacyServiceLinesWorkspaceSlot(): boolean {
  return serviceLinesWorkspaceSlotPresentation() === 'legacy';
}
