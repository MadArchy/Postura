/**
 * SPEC-010 · ClientWorkspace dossier disclosure presentation boundary.
 *
 * Selects whether the legacy workspace host still renders the dossier slot.
 * React already owns `ReactMasterDossierPanel` on the React workspace path.
 *
 * Cutover: `omit`. The legacy host must not render or import MasterDossierPanel.
 * This module does not invent a command or authorize anything.
 */

export type DossierSlotPresentation = 'legacy' | 'omit';

/** Phase-6 dossier cutover: ClientWorkspace omits the legacy disclosure. */
const DOSSIER_SLOT_PRESENTATION: DossierSlotPresentation = 'omit';

export function dossierSlotPresentation(): DossierSlotPresentation {
  return DOSSIER_SLOT_PRESENTATION;
}

export function shouldRenderLegacyDossierSlot(): boolean {
  return dossierSlotPresentation() === 'legacy';
}
