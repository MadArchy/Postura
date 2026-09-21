/**
 * SPEC-010 · KPI Results disclosure presentation boundary.
 *
 * Selects whether the legacy portal/workspace hosts still render KPI tiles
 * and the weekly chart on Results surfaces. React already owns
 * `ReactKpiWeeklyChart` on Wave2 Results and Workspace Results.
 *
 * Scope is RESULTS ONLY. This does not omit ClientPortal Home
 * (`renderKpiHomeDashboard`) and does not authorize deleting KpiWeeklyChart.ts.
 *
 * Cutover: `omit`. The legacy hosts must not render Results tiles/chart.
 * This module does not invent a command or authorize anything.
 */

export type KpiResultsSlotPresentation = 'legacy' | 'omit';

/** Phase-6 KPI Results cutover: hosts omit legacy Results KPI HTML. */
const KPI_RESULTS_SLOT_PRESENTATION: KpiResultsSlotPresentation = 'omit';

export function kpiResultsSlotPresentation(): KpiResultsSlotPresentation {
  return KPI_RESULTS_SLOT_PRESENTATION;
}

export function shouldRenderLegacyKpiResultsSlot(): boolean {
  return kpiResultsSlotPresentation() === 'legacy';
}
