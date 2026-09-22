/**
 * SPEC-010 · ClientPortal profile disclosure presentation boundary.
 *
 * Selects whether the legacy portal host still renders ClientProfilePanel.
 * React already owns `ReactClientProfilePanel` on the Wave2 profile path.
 *
 * Cutover: `omit`. The legacy host must not render or import ClientProfilePanel.
 * This module does not invent a command or authorize anything.
 * Scope is the ClientPortal `client-profile` body only. It does not own
 * ProofWall or Onboarding.
 */

export type ClientProfileSlotPresentation = 'legacy' | 'omit';

/** Phase-6 ClientProfile cutover: ClientPortal omits the legacy profile body. */
const CLIENT_PROFILE_SLOT_PRESENTATION: ClientProfileSlotPresentation = 'omit';

export function clientProfileSlotPresentation(): ClientProfileSlotPresentation {
  return CLIENT_PROFILE_SLOT_PRESENTATION;
}

export function shouldRenderLegacyClientProfileSlot(): boolean {
  return clientProfileSlotPresentation() === 'legacy';
}
