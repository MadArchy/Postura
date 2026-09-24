/**
 * SPEC-010 · ClientWorkspace PageHeader presentation boundary.
 *
 * Selects whether leftover `renderClientWorkspace` still wraps workspace
 * bodies with leftover `renderPage` / `renderPageHeader`. React already owns
 * `ReactTabHeader` / briefs `ReactPageHeader` on existing
 * `ReactClientWorkspacePage`.
 *
 * Cutover: `omit`. The leftover host must not render ClientWorkspace PageHeader.
 * This module does not invent a command or authorize anything.
 * Scope is leftover ClientWorkspace `renderClientWorkspace` header chrome only.
 * It does not own ClientPortal PageHeader, ManagerCockpit PageHeader,
 * Wave2 GROUP_META headers, or PageHeader.ts.
 */

export type PageHeaderWorkspaceSlotPresentation = 'legacy' | 'omit';

/** Phase-6 ClientWorkspace PageHeader cutover: leftover workspace omits PageHeader. */
const PAGE_HEADER_WORKSPACE_SLOT_PRESENTATION: PageHeaderWorkspaceSlotPresentation = 'omit';

export function pageHeaderWorkspaceSlotPresentation(): PageHeaderWorkspaceSlotPresentation {
  return PAGE_HEADER_WORKSPACE_SLOT_PRESENTATION;
}

export function shouldRenderLegacyPageHeaderWorkspaceSlot(): boolean {
  return pageHeaderWorkspaceSlotPresentation() === 'legacy';
}
