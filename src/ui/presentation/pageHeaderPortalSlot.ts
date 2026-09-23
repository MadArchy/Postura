/**
 * SPEC-010 · ClientPortal PageHeader presentation boundary.
 *
 * Selects whether leftover `clientPage` still wraps portal bodies with
 * leftover `renderPage` / `renderPageHeader`. React already owns
 * `ReactTabHeader` on existing `ReactClientPortalPage`.
 *
 * Cutover: `omit`. The leftover host must not render ClientPortal PageHeader.
 * This module does not invent a command or authorize anything.
 * Scope is leftover ClientPortal `clientPage` header chrome only.
 * It does not own ManagerCockpit PageHeader, ClientWorkspace PageHeader,
 * Wave2 GROUP_META headers, or PageHeader.ts.
 */

export type PageHeaderPortalSlotPresentation = 'legacy' | 'omit';

/** Phase-6 ClientPortal PageHeader cutover: leftover portal omits PageHeader. */
const PAGE_HEADER_PORTAL_SLOT_PRESENTATION: PageHeaderPortalSlotPresentation = 'omit';

export function pageHeaderPortalSlotPresentation(): PageHeaderPortalSlotPresentation {
  return PAGE_HEADER_PORTAL_SLOT_PRESENTATION;
}

export function shouldRenderLegacyPageHeaderPortalSlot(): boolean {
  return pageHeaderPortalSlotPresentation() === 'legacy';
}
