/**
 * SPEC-010 · ManagerCockpit PageHeader presentation boundary.
 *
 * Selects whether leftover `renderManagerCockpit` still wraps cockpit bodies
 * with leftover `renderPage` / `renderPageHeader`. React already owns
 * `ReactTabHeader` on existing `ReactManagerCockpitPage`.
 *
 * Cutover: `omit`. The leftover host must not render ManagerCockpit PageHeader.
 * This module does not invent a command or authorize anything.
 * Scope is leftover ManagerCockpit `renderManagerCockpit` header chrome only.
 * It does not own ClientPortal PageHeader, ClientWorkspace PageHeader,
 * Wave2 GROUP_META headers, or PageHeader.ts.
 */

export type PageHeaderPortfolioSlotPresentation = 'legacy' | 'omit';

/** Phase-6 ManagerCockpit PageHeader cutover: leftover cockpit omits PageHeader. */
const PAGE_HEADER_PORTFOLIO_SLOT_PRESENTATION: PageHeaderPortfolioSlotPresentation = 'omit';

export function pageHeaderPortfolioSlotPresentation(): PageHeaderPortfolioSlotPresentation {
  return PAGE_HEADER_PORTFOLIO_SLOT_PRESENTATION;
}

export function shouldRenderLegacyPageHeaderPortfolioSlot(): boolean {
  return pageHeaderPortfolioSlotPresentation() === 'legacy';
}
