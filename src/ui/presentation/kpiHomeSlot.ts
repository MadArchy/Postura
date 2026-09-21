/**
 * SPEC-010 · KPI Home disclosure presentation boundary.
 *
 * Selects whether the legacy ClientPortal host still renders
 * `renderKpiHomeDashboard`. React already owns `ReactKpiWeeklyChart` on
 * ReactClientPortalPage Home.
 *
 * Scope is HOME PRESENTATION ONLY. This does not change Results omit
 * (`kpiResultsSlot`) and does not authorize deleting KpiWeeklyChart.ts.
 *
 * Cutover: `omit`. The legacy host must not render or import the Home dashboard.
 * This module does not invent a command or authorize anything.
 */

export type KpiHomeSlotPresentation = 'legacy' | 'omit';

/** Phase-6 KPI Home cutover: ClientPortal omits legacy Home KPI HTML. */
const KPI_HOME_SLOT_PRESENTATION: KpiHomeSlotPresentation = 'omit';

export function kpiHomeSlotPresentation(): KpiHomeSlotPresentation {
  return KPI_HOME_SLOT_PRESENTATION;
}

export function shouldRenderLegacyKpiHomeSlot(): boolean {
  return kpiHomeSlotPresentation() === 'legacy';
}
