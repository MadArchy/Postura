/**
 * SPEC-010 Phase 6 — KPI Home presentation cutover (`client-kpi-home`).
 *
 * Omits legacy Home `renderKpiHomeDashboard` from ClientPortal.
 * Physical absence of KpiWeeklyChart.ts is intentional. Results omit remains Results-only.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_KPI_HOME_SLOT,
  CLIENT_KPI_RESULTS_SLOT,
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
  listKnownReactExclusiveSlotIds,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  kpiHomeSlotPresentation,
  shouldRenderLegacyKpiHomeSlot,
} from '../src/ui/presentation/kpiHomeSlot';
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

function collectTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTs(full));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('Phase 6 KPI Home cutover — C1 served ownership', () => {
  it('KpiWeeklyChart.ts is absent and React Home KPI stays mounted', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
    expect(code(PORTAL)).toMatch(
      /tab === 'home'[\s\S]*<ReactKpiWeeklyChart title="Dashboard semanal"/
    );
  });

  it('ClientPortal no longer imports or calls the Home dashboard', () => {
    const portal = code(HOST_PORTAL);
    expect(portal).not.toMatch(/from\s+['"]\.\/KpiWeeklyChart['"]/);
    expect(portal).not.toMatch(/renderKpiHomeDashboard/);
    expect(portal).not.toMatch(/form-quick-kpi-consultation/);
    expect(shouldRenderLegacyKpiHomeSlot()).toBe(false);
    expect(kpiHomeSlotPresentation()).toBe('omit');
  });

  it('product runtime import graph of KpiWeeklyChart.ts is zero', () => {
    const offenders: string[] = [];
    for (const file of collectTs(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel === LEGACY) continue;
      const source = code(rel);
      if (
        /from\s+['"][^'"]*\/KpiWeeklyChart['"]/.test(source) ||
        /import\s*\(\s*['"][^'"]*\/KpiWeeklyChart['"]/.test(source)
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('Home exclusive id is Home-only and distinct from Results/dossier/opportunity', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_KPI_HOME_SLOT)).toBe(true);
    expect(CLIENT_KPI_HOME_SLOT).toBe('client-kpi-home');
    expect(CLIENT_KPI_HOME_SLOT).not.toBe(CLIENT_KPI_RESULTS_SLOT);
    expect(CLIENT_KPI_HOME_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
    expect(CLIENT_KPI_HOME_SLOT).not.toBe(CLIENT_PORTAL_OPPORTUNITY_SLOT);
    expect(listKnownReactExclusiveSlotIds()).not.toContain('kpi-weekly-chart');
    expect(existsSync(join(ROOT, 'src/ui/presentation/kpiSlot.ts'))).toBe(false);
  });
});

describe('Phase 6 KPI Home cutover — C2 / C3 seams and Results coexistence', () => {
  it('React Home still uses the accepted compatibility read and consultation command', () => {
    expect(code(REACT)).toMatch(/useKpiWeekly\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/readKpiWeekly/);
    expect(code(READ)).toMatch(/export function readKpiWeekly\(/);
    expect(code(REACT)).toMatch(/useRegisterConsultation\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/resultCommands\.registerConsultation/);
    expect(code(SEAM)).toMatch(/registerResultRecordIntent/);
  });

  it('Results cutover remains active and Results-only', () => {
    expect(shouldRenderLegacyKpiResultsSlot()).toBe(false);
    expect(kpiResultsSlotPresentation()).toBe('omit');
    expect(isReactExclusiveSlot(CLIENT_KPI_RESULTS_SLOT)).toBe(true);
    expect(code(WAVE2)).toMatch(/group === 'results'[\s\S]*<ReactKpiWeeklyChart/);
    expect(code(WORKSPACE)).toMatch(/tab === 'results'[\s\S]*<ReactKpiWeeklyChart/);
    expect(code(HOST_PORTAL)).not.toMatch(/renderKpiSummaryTiles/);
    expect(code(HOST_WORKSPACE)).not.toMatch(/from\s+['"]\.\/KpiWeeklyChart['"]/);
  });

  it('generic result form stays; product HTML no longer emits the Home quick form', () => {
    expect(code(HOST_PORTAL)).toMatch(/form-add-result/);
    expect(code(HANDLERS)).toMatch(/form-add-result/);
    expect(code(HANDLERS)).toMatch(/form-quick-kpi-consultation/);
    expect(code(HOST_PORTAL)).not.toMatch(/form-quick-kpi-consultation/);
  });
});

describe('Phase 6 KPI Home cutover — C4 / C5 / no T603', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [
      'src/ui/presentation/kpiHomeSlot.ts',
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

  it('does not create a duplicate Home KPI surface or a second React root', () => {
    expect(code(HOST_PORTAL)).not.toMatch(/ReactKpiWeeklyChart/);
    expect(code(PORTAL)).not.toMatch(/createRoot/);
    expect(code(PORTAL)).not.toMatch(/#app/);
  });

  it('legacy file absent; C6/C7 verified; T603 formally closed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(read(TASKS)).toMatch(
      /^(?![^\n]*(?:NOT AUTHORIZED|TODO|PENDING|\[ \]))\| \*\*T-010-603\*\* \|[^\n]*\| \*\*\[x\] DONE — FORMALLY_CLOSED\*\*[^|\n]*\|\r?$/m
    );
    expect(read(TASKS).match(/^\| \*\*T-010-603\*\* \|/gm)).toHaveLength(1);
  });
});
