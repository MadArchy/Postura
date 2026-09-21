/**
 * SPEC-010 · ClientPortal opportunity disclosure presentation boundary.
 *
 * Selects whether the legacy portal host still renders OpportunityPanel.
 * React already owns `ReactOpportunityPanel` on the React portal path.
 *
 * Cutover: `omit`. The legacy host must not render or import OpportunityPanel.
 * This module does not invent a command or authorize anything.
 */

export type OpportunitySlotPresentation = 'legacy' | 'omit';

/** Phase-6 opportunity cutover: ClientPortal omits the legacy Opportunity HTML. */
const OPPORTUNITY_SLOT_PRESENTATION: OpportunitySlotPresentation = 'omit';

export function opportunitySlotPresentation(): OpportunitySlotPresentation {
  return OPPORTUNITY_SLOT_PRESENTATION;
}

export function shouldRenderLegacyOpportunitySlot(): boolean {
  return opportunitySlotPresentation() === 'legacy';
}
