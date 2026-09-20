/**
 * SPEC-010 · ClientWorkspace dossier disclosure presentation boundary.
 *
 * Selects whether the legacy workspace host still renders the dossier slot.
 * React already owns `ReactMasterDossierPanel` on the React workspace path.
 *
 * Coexistence default is `legacy` so current product behavior is unchanged.
 * A later cutover authorization may set this to `omit`. This module does not
 * perform that cutover, invent a command, or authorize anything.
 */

export type DossierSlotPresentation = 'legacy' | 'omit';

/** Coexistence default until a separate cutover authorization. */
const DOSSIER_SLOT_PRESENTATION: DossierSlotPresentation = 'legacy';

export function dossierSlotPresentation(): DossierSlotPresentation {
  return DOSSIER_SLOT_PRESENTATION;
}

export function shouldRenderLegacyDossierSlot(): boolean {
  return dossierSlotPresentation() === 'legacy';
}
