/**
 * SPEC-010 Phase 6 — SourceRegistry presentation cutover.
 *
 * Omits leftover `SourceRegistryModal` from `modalPresenter`.
 * Physical file is ABSENT. C6 / C7 / T603 are not executed.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CLIENT_PORTAL_PAGE_HEADER_SLOT,
  CLIENT_PORTFOLIO_PAGE_HEADER_SLOT,
  CLIENT_WORKSPACE_PAGE_HEADER_SLOT,
  listKnownReactExclusiveSlotIds,
} from '../src/ui/presentation/reactExclusiveSlots';

const ROOT = join(__dirname, '..');
const LEGACY = 'src/components/SourceRegistryModal.ts';
const ONBOARDING = 'src/components/OnboardingWizard.ts';
const PAGE_HEADER = 'src/components/PageHeader.ts';
const MODAL = 'src/controllers/modalPresenter.ts';
const WORKSPACE = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const APPSHELL = 'src/ui/modules/AppShell/ReactAppShell.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const WAVE2_PANEL = 'src/ui/modules/SourceRegistry/ReactSourceRegistryPanel.tsx';
const HOOKS = 'src/ui/hooks/useWave3Data.ts';
const HANDLERS = 'src/ui/legacy/handlers/sourcesHandlers.ts';
const SLOTS = 'src/ui/presentation/reactExclusiveSlots.ts';
const MOUNT = 'src/ui/mount.ts';
const APPLICATION = 'src/application/signalIntake';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourcesPanel(src: string): string {
  const start = src.indexOf('function SourcesPanel');
  const end = src.indexOf('function TasksPanel');
  return src.slice(start, end === -1 ? undefined : end);
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

describe('Phase 6 SourceRegistry cutover — leftover file is absent, Product graph is zero', () => {
  it('SourceRegistryModal.ts is physically absent', () => {
    expect(existsSync(join(ROOT, LEGACY))).toBe(false);
    expect(existsSync(join(ROOT, PAGE_HEADER))).toBe(false);
  });

  it('modalPresenter no longer imports or presents leftover SourceRegistry', () => {
    const presenter = code(MODAL);
    expect(presenter).not.toMatch(/SourceRegistryModal/);
    expect(presenter).not.toMatch(/renderSourceRegistryModal/);
    expect(presenter).not.toMatch(/source-registry/);
    expect(presenter).toMatch(/return html\(''\)/);
  });

  it('unknown-modal fallback remains the only empty presentation path', () => {
    const presenter = code(MODAL);
    expect(presenter).toMatch(/return html\(''\)/);
    expect(presenter).not.toMatch(/forceClose:\s*true[\s\S]*source-registry|source-registry[\s\S]*forceClose/);
    expect(presenter).not.toMatch(/ws-sources-react/);
    expect(presenter).not.toMatch(/setTab/);
    expect(presenter).toMatch(/export function presentActiveModal/);
  });

  it('product runtime import and call graph of SourceRegistryModal.ts is zero', () => {
    const importOffenders: string[] = [];
    const callOffenders: string[] = [];
    for (const file of collectTs(join(ROOT, 'src'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (rel === LEGACY) continue;
      const source = code(rel);
      if (
        /from\s+['"][^'"]*\/SourceRegistryModal['"]/.test(source) ||
        /import\s*\(\s*['"][^'"]*\/SourceRegistryModal['"]/.test(source)
      ) {
        importOffenders.push(rel);
      }
      if (/\brenderSourceRegistryModal\b/.test(source)) {
        callOffenders.push(rel);
      }
    }
    expect(importOffenders).toEqual([]);
    expect(callOffenders).toEqual([]);
  });
});

describe('Phase 6 SourceRegistry cutover — Onboarding isolation', () => {
  it('Onboarding leftover file is ABSENT; legacy presentation is omitted; React is served', () => {
    expect(existsSync(join(ROOT, ONBOARDING))).toBe(false);
    const presenter = code(MODAL);
    expect(presenter).not.toMatch(/OnboardingWizard/);
    expect(presenter).not.toMatch(/renderOnboardingWizard/);
    expect(presenter).not.toMatch(/modal === 'onboarding'/);
    expect(code(WAVE2)).toMatch(/group === 'profile'[\s\S]*<ReactOnboardingWizard/);
    expect(code(APPSHELL)).toMatch(/'client-profile':\s*'profile'/);
  });
});

describe('Phase 6 SourceRegistry cutover — canonical SourcesPanel owner', () => {
  it('SourcesPanel remains the live owner on ws-sources-react', () => {
    const page = code(WORKSPACE);
    const panel = sourcesPanel(page);
    expect(panel).toMatch(/function SourcesPanel/);
    expect(page).toMatch(/<SourcesPanel workspaceClientId=\{clientId\} \/>/);
    expect(code(APPSHELL)).toMatch(/'ws-sources-react':\s*'sources'/);
    expect(code(APPSHELL)).toMatch(/id:\s*'ws-sources-react',\s*label:\s*'Fuentes'/);
    expect(code(MOUNT)).toMatch(/REACT_ROOT_ID = 'react-root'/);
    expect(page).not.toMatch(/createRoot/);
    expect(code(MODAL)).not.toMatch(/createRoot/);
  });

  it('canonical #8 #9 PollRegisteredSource and adjacent #26 remain on SourcesPanel', () => {
    const panel = sourcesPanel(code(WORKSPACE));
    const hooks = code(HOOKS);
    expect(panel).toMatch(/useRegisterSource/);
    expect(panel).toMatch(/usePollAllActiveSources/);
    expect(panel).toMatch(/usePollRegisteredSource/);
    expect(panel).toMatch(/useRegisterManualSignal/);
    expect(hooks).toMatch(/signalIntakeCommands\.registerSource/);
    expect(hooks).toMatch(/signalIntakeCommands\.pollAllActiveSources/);
    expect(hooks).toMatch(/signalIntakeCommands\.pollRegisteredSource/);
    expect(hooks).toMatch(/signalIntakeCommands\.registerManualSignal/);
    expect(readdirSync(join(ROOT, APPLICATION)).filter((name) => name.endsWith('.ts')).sort()).toEqual([
      'DiscardSignal.ts',
      'MarkSignalSaved.ts',
      'PollRegisteredSource.ts',
      'RegisterManualSignal.ts',
      'RegisterSource.ts',
      'errors.ts',
      'index.ts',
      'trustedContext.ts',
    ]);
  });

  it('Wave2 ReactSourceRegistryPanel stays READ_ONLY and is not the cutover owner', () => {
    const wave2 = code(WAVE2_PANEL);
    expect(statSync(join(ROOT, WAVE2_PANEL)).isFile()).toBe(true);
    expect(wave2).toMatch(/data-authority="READ_ONLY"/);
    expect(wave2).not.toMatch(/useRegisterSource|usePollAllActiveSources|usePollRegisteredSource/);
    expect(code(WORKSPACE)).not.toMatch(/ReactSourceRegistryPanel/);
    expect(code(WAVE2)).toMatch(/group === 'sources' \? <ReactSourceRegistryPanel/);
    expect(existsSync(join(ROOT, 'src/ui/modules/SourceRegistry/ReactSourceRegistryModal.tsx'))).toBe(
      false,
    );
  });
});

describe('Phase 6 SourceRegistry cutover — retired extras stay retired', () => {
  it('does not move discovery-on-render or leftover auto-research into React', () => {
    const reactFiles = collectTs(join(ROOT, 'src/ui')).filter((file) => {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      return !rel.startsWith('src/ui/legacy/');
    });
    const offenders: string[] = [];
    for (const file of reactFiles) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const source = code(rel);
      if (
        /runSourceDiscoveryAgent/.test(source) ||
        /useSourceDiscovery/.test(source) ||
        /autoResearchPrioritySignals/.test(source) ||
        /source-suggestion-chip/.test(source)
      ) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
    expect(existsSync(join(ROOT, APPLICATION, 'RunSourceDiscovery.ts'))).toBe(false);
    expect(existsSync(join(ROOT, APPLICATION, 'AutoResearchPrioritySignals.ts'))).toBe(false);
  });

  it('unreachable leftover opener debt remains uncleaned', () => {
    const handlers = code(HANDLERS);
    expect(handlers).toMatch(/getElementById\('btn-open-source-registry'\)\?/);
    expect(handlers).toMatch(/activeModal = 'source-registry'/);
  });
});

describe('Phase 6 SourceRegistry cutover — Option-E / A38 / closed subsets', () => {
  it('creates no SourceRegistry exclusive slot or id', () => {
    const ids = listKnownReactExclusiveSlotIds();
    expect(ids).not.toContain('source-registry');
    expect(ids).not.toContain('source-registry-modal');
    expect(ids).not.toContain('client-workspace-source-registry');
    expect(code(SLOTS)).not.toMatch(/source-registry/);
    expect(existsSync(join(ROOT, 'src/ui/presentation/sourceRegistrySlot.ts'))).toBe(false);
  });

  it('does not add a React root, nested root, or duplicate live Fuentes owner', () => {
    expect(code(MODAL)).not.toMatch(/createRoot|#react-root|#app/);
    expect(code(WORKSPACE)).not.toMatch(/createRoot/);
    expect(code(WAVE2_PANEL)).not.toMatch(/createRoot/);
    expect(code(APPSHELL)).toMatch(/'ws-sources-react':\s*'sources'/);
    expect(code(WORKSPACE)).toMatch(/tab === 'sources' \? <SourcesPanel workspaceClientId=\{clientId\} \/>/);
  });

  it('closed PageHeader subset and Onboarding remain isolated', () => {
    expect(existsSync(join(ROOT, PAGE_HEADER))).toBe(false);
    expect(existsSync(join(ROOT, ONBOARDING))).toBe(false);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_PORTAL_PAGE_HEADER_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_PORTFOLIO_PAGE_HEADER_SLOT);
    expect(listKnownReactExclusiveSlotIds()).toContain(CLIENT_WORKSPACE_PAGE_HEADER_SLOT);
    expect(existsSync(join(ROOT, 'src/components/MasterDossierPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/OpportunityPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/KpiWeeklyChart.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClientProfilePanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ProofWallPanel.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/components/ClaimSafetyPanel.ts'))).toBe(false);
  });
});
