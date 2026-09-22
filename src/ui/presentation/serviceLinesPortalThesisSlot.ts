/**
 * SPEC-010 · ClientPortal thesis service-lines disclosure presentation boundary.
 *
 * Selects whether the legacy portal host still renders `renderServiceLinesReadOnly`
 * inside `renderClientThesisBody`. React already owns service-line facts through
 * `ReactMasterDossierPanel` on the React portal thesis path.
 *
 * Cutover: `omit`. The legacy host must not render thesis service-lines.
 * This module does not invent a command or authorize anything.
 * Scope is the ClientPortal `client-thesis` leftover service-lines only.
 * It does not own workspace service-lines, workspace ProofWall,
 * portal ProofWall, Dossier, or ProofWallPanel.ts.
 */

export type ServiceLinesPortalThesisSlotPresentation = 'legacy' | 'omit';

/** Phase-6 portal thesis service-lines cutover: ClientPortal omits leftover thesis service-lines. */
const SERVICE_LINES_PORTAL_THESIS_SLOT_PRESENTATION: ServiceLinesPortalThesisSlotPresentation = 'omit';

export function serviceLinesPortalThesisSlotPresentation(): ServiceLinesPortalThesisSlotPresentation {
  return SERVICE_LINES_PORTAL_THESIS_SLOT_PRESENTATION;
}

export function shouldRenderLegacyServiceLinesPortalThesisSlot(): boolean {
  return serviceLinesPortalThesisSlotPresentation() === 'legacy';
}
