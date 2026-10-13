/**
 * SPEC-010 Phase 6 — KPI Results-only cutover (`client-kpi-results`).
 *
 * Omits legacy Results tiles/chart on ClientPortal and ClientWorkspace.
 * Physical absence of KpiWeeklyChart.ts is intentional. Home omit is proven by the Home cutover test.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLIENT_KPI_RESULTS_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  kpiResultsSlotPresentation,
  shouldRenderLegacyKpiResultsSlot,
} from '../src/ui/presentation/kpiResultsSlot';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/KpiWeeklyChart.ts';
const REACT = 'src/ui/modules/Kpi/ReactKpiWeeklyChart.tsx';
const PORTAL = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const WORKSPACE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const HOST_PORTAL = 'src/components/ClientPortal.ts';
const HOST_WORKSPACE = 'src/components/ClientWorkspace.ts';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const HANDLERS = 'src/ui/legacy/handlers/clientPortalHandlers.ts';
const TASKS = 'specs/010-react-migration/tasks.md';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '');
}

describe('Phase 6 KPI Results cutover — C1 served ownership', () => {
  it('KpiWeeklyChart.ts is absent and Home React KPI stays mounted', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(code(PORTAL)).toMatch(
      /tab === 'home'[\s\S]*<ReactKpiWeeklyChart title="Dashboard semanal"/
    );
  });

  it('legacy Results tiles/chart calls are omitted', () => {
    const portal = code(HOST_PORTAL);
    const workspace = code(HOST_WORKSPACE);
    expect(portal).not.toMatch(/renderKpiSummaryTiles/);
    expect(portal).not.toMatch(/renderKpiWeeklyChart/);
    expect(workspace).not.toMatch(/renderKpiSummaryTiles/);
    expect(workspace).not.toMatch(/renderKpiWeeklyChart/);
    expect(portal).not.toMatch(/from\s+['"]\.\/KpiWeeklyChart['"]/);
    expect(workspace).not.toMatch(/from\s+['"]\.\/KpiWeeklyChart['"]/);
    expect(shouldRenderLegacyKpiResultsSlot()).toBe(false);
    expect(kpiResultsSlotPresentation()).toBe('omit');
  });

  it('Wave2 and Workspace React Results owners remain unchanged', () => {
    expect(code(WAVE2)).toMatch(/group === 'results'[\s\S]*<ReactKpiWeeklyChart/);
    expect(code(WORKSPACE)).toMatch(/tab === 'results'[\s\S]*<ReactKpiWeeklyChart/);
  });

  it('exclusive KPI Results id is Results-only and distinct from dossier/opportunity', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_KPI_RESULTS_SLOT)).toBe(true);
    expect(CLIENT_KPI_RESULTS_SLOT).toBe('client-kpi-results');
    expect(CLIENT_KPI_RESULTS_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_KPI_RESULTS_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(CLIENT_KPI_RESULTS_SLOT).not.toBe('kpi-weekly-chart');
    expect(existsSync(join(ROOT, 'src/ui/presentation/kpiSlot.ts'))).toBe(false);
  });
});

describe('Phase 6 KPI Results cutover — C2 / C3 canonical path', () => {
  it('React Results still use the accepted compatibility read', () => {
    expect(code(REACT)).toMatch(/useKpiWeekly\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/readKpiWeekly/);
    expect(code(READ)).toMatch(/export function readKpiWeekly\(/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
  });

  it('React Results still use the canonical consultation command', () => {
    expect(code(REACT)).toMatch(/useRegisterConsultation\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/resultCommands\.registerConsultation/);
    expect(code(SEAM)).toMatch(/registerResultRecordIntent/);
  });

  it('host result form and leftover Home quick-consultation handler remain', () => {
    expect(code(HOST_PORTAL)).toMatch(/form-add-result/);
    expect(code(HANDLERS)).toMatch(/form-add-result/);
    expect(code(HANDLERS)).toMatch(/form-quick-kpi-consultation/);
  });
});

describe('Phase 6 KPI Results cutover — C4 / C5 / no T603', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [
      'src/ui/presentation/kpiResultsSlot.ts',
      'src/ui/presentation/reactExclusiveSlots.ts',
      REACT,
    ]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('does not create a duplicate Results KPI surface or a second React root', () => {
    expect(code(HOST_PORTAL)).not.toMatch(/ReactKpiWeeklyChart/);
    expect(code(HOST_WORKSPACE)).not.toMatch(/ReactKpiWeeklyChart/);
    expect(code(PORTAL)).not.toMatch(/createRoot/);
    expect(code(WAVE2)).not.toMatch(/createRoot/);
    expect(code(WORKSPACE)).not.toMatch(/createRoot/);
  });

  it('legacy file absent; C6/C7 verified; T603 formally closed', () => {
    expect(read(TASKS)).toMatch(
      /^(?![^\n]*(?:NOT AUTHORIZED|TODO|PENDING|\[ \]))\| \*\*T-010-603\*\* \|[^\n]*\| \*\*\[x\] DONE — FORMALLY_CLOSED\*\*[^|\n]*\|\r?$/m
    );
    expect(read(TASKS).match(/^\| \*\*T-010-603\*\* \|/gm)).toHaveLength(1);
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
  });
});
