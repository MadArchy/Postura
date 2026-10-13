/**
 * SPEC-010 Phase 6 — ClientPortal Home KPI parity (`MOUNT_ON_HOME`).
 *
 * Presentation-only reuse of ReactKpiWeeklyChart on the live Home branch.
 * Home/Results presentation cutovers omit legacy hosts. React Home KPI remains
 * served. Whole-leaf `kpiSlot.ts` remains absent.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/KpiWeeklyChart.ts';
const REACT = 'src/ui/modules/Kpi/ReactKpiWeeklyChart.tsx';
const PORTAL = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const WORKSPACE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const READ = 'src/ui/data/compatibilityReads.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const HANDLERS = 'src/ui/legacy/handlers/clientPortalHandlers.ts';
const SLOTS = 'src/ui/presentation/reactExclusiveSlots.ts';
const MOUNT = 'src/ui/mount.ts';
const TASKS = 'specs/010-react-migration/tasks.md';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '');
}

describe('Phase 6 KPI Home parity — C1 served Home', () => {
  it('active React ClientPortal Home mounts ReactKpiWeeklyChart after Opportunity', () => {
    const portal = code(PORTAL);
    expect(portal).toMatch(
      /tab === 'home'[\s\S]*<TasksPanel[\s\S]*<BriefingPanel[\s\S]*<ReactOpportunityPanel[\s\S]*<ReactKpiWeeklyChart title="Dashboard semanal"/
    );
    expect(statSync(join(ROOT, REACT)).isFile()).toBe(true);
  });

  it('Wave2 still owns client-results KPI and workspace results stay on the workspace page', () => {
    expect(code(WAVE2)).toMatch(/group === 'results'[\s\S]*<ReactKpiWeeklyChart/);
    expect(code(WORKSPACE)).toMatch(/tab === 'results'[\s\S]*<ReactKpiWeeklyChart/);
    const shell = code('src/ui/modules/AppShell/ReactAppShell.tsx');
    expect(shell).toMatch(/'client-results':\s*'results'/);
    const portalMap = shell.match(/const PORTAL_TAB_BY_ID[^=]*=\s*\{[^}]+\}/)?.[0] ?? '';
    expect(portalMap).toMatch(/'client-home':\s*'home'/);
    expect(portalMap).not.toMatch(/client-results/);
  });
});

describe('Phase 6 KPI Home parity — C2 / C3 capability', () => {
  it('React KPI still exposes week count, three metrics, 8-week chart, and consultation', () => {
    const panel = code(REACT);
    expect(panel).toMatch(/consultationsThisWeek/);
    expect(panel).toMatch(/kpi\.tiles/);
    expect(panel).toMatch(/kpi-chart-grid/);
    expect(panel).toMatch(/useRegisterConsultation/);
    expect(code(READ)).toMatch(/aggregateWeeklyKpis\([\s\S]*,\s*8/);
    expect(code(READ)).toMatch(/consultation_requests/);
    expect(code(READ)).toMatch(/linkedin_profile_views/);
    expect(code(READ)).toMatch(/website_visits_from_linkedin/);
  });

  it('Home-mounted KPI uses the accepted compatibility read and trusted session scope', () => {
    expect(code(REACT)).toMatch(/useKpiWeekly\(tenantScope\)/);
    expect(code(REACT)).toMatch(/useSession\(\)/);
    expect(code(HOOK)).toMatch(/readKpiWeekly/);
    expect(code(HOOK)).toMatch(/tenantQueryKey\(scope, 'compatibility', 'kpi-weekly'\)/);
    expect(code(READ)).toMatch(/export function readKpiWeekly\(/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT)).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    expect(code(PORTAL)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
  });

  it('consultation stays on the canonical React command seam', () => {
    expect(code(REACT)).toMatch(/useRegisterConsultation\(tenantScope\)/);
    expect(code(HOOK)).toMatch(/resultCommands\.registerConsultation/);
    expect(code(SEAM)).toMatch(/registerResultRecordIntent/);
    expect(code(REACT)).not.toMatch(/form-quick-kpi-consultation/);
    expect(code(PORTAL)).not.toMatch(/form-quick-kpi-consultation/);
  });

  it('loading, empty, error, and no-scope fail-closed states remain', () => {
    const panel = code(REACT);
    expect(panel).toMatch(/react-kpi-loading/);
    expect(panel).toMatch(/react-kpi-empty/);
    expect(panel).toMatch(/react-kpi-error/);
    expect(panel).toMatch(/react-kpi-no-scope/);
    expect(panel).toMatch(/role="alert"/);
    expect(panel).toMatch(/role="img"/);
  });
});

describe('Phase 6 KPI Home parity — A38 / file absent', () => {
  it('does not create a second React root or mount inside #app', () => {
    expect(code(PORTAL)).not.toMatch(/createRoot/);
    expect(code(REACT)).not.toMatch(/createRoot/);
    expect(code(PORTAL)).not.toMatch(/#app/);
    expect(code(MOUNT)).toMatch(/REACT_ROOT_ID/);
    expect(code(MOUNT)).not.toMatch(/createRoot\([^)]*#app/);
  });

  it('legacy file absent; no whole-leaf exclusive id; C6/C7 verified; T603 formally closed', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(existsSync(join(ROOT, 'src/ui/presentation/kpiSlot.ts'))).toBe(false);
    expect(code(SLOTS)).not.toMatch(/kpiSlot/);
    expect(code(HANDLERS)).toMatch(/form-quick-kpi-consultation/);
    expect(read(TASKS)).toMatch(
      /^(?![^\n]*(?:NOT AUTHORIZED|TODO|PENDING|\[ \]))\| \*\*T-010-603\*\* \|[^\n]*\| \*\*\[x\] DONE — FORMALLY_CLOSED\*\*[^|\n]*\|\r?$/m
    );
    expect(read(TASKS).match(/^\| \*\*T-010-603\*\* \|/gm)).toHaveLength(1);
  });
});
