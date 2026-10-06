/**
 * SPEC-010 · Source Management React write parity — #8/#9/#24/#26.
 *
 * Presentation + existing Signal Intake commands only.
 * #25 lifecycle, discovery, and #22 scoring remain out of scope.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const workspace = 'src/ui/modules/pages/ReactClientWorkspacePage.tsx';
const hook = 'src/ui/hooks/useWave3Data.ts';
const seam = 'src/ui/commands/commandSeam.ts';
const registry = 'src/ui/modules/SourceRegistry/ReactSourceRegistryPanel.tsx';
const consumer = 'src/services/signalIntakeConsumer.ts';
const applicationDir = 'src/application/signalIntake';

describe('Source Management A — register delegates to RegisterSource', () => {
  it('SourcesPanel register hook calls signalIntakeCommands.registerSource', () => {
    expect(code(workspace)).toMatch(/useRegisterSource\(scope\)/);
    expect(code(hook)).toMatch(/useRegisterSource/);
    expect(code(hook)).toMatch(/signalIntakeCommands\.registerSource/);
    expect(code(hook)).toMatch(/requestedClientId: scope\.clientId/);
  });
});

describe('Source Management B — #8/#24 one command path', () => {
  it('React uses one registerSource seam path, not two business writers', () => {
    expect(code(seam)).toMatch(/registerSource\(intent\)/);
    expect(code(hook)).toMatch(/signalIntakeCommands\.registerSource/);
    expect((code(hook).match(/signalIntakeCommands\.registerSource/g) ?? []).length).toBe(1);
    expect(code(registry)).not.toMatch(/registerSource/);
    expect(code(registry)).not.toMatch(/useRegisterSource/);
  });
});

describe('Source Management C — no React dbService.addSource', () => {
  it('React source write files do not call addSource', () => {
    expect(code(workspace)).not.toMatch(/dbService\.addSource/);
    expect(code(hook)).not.toMatch(/dbService\.addSource/);
    expect(code(seam)).not.toMatch(/dbService\.addSource/);
    expect(code(registry)).not.toMatch(/dbService\.addSource/);
  });
});

describe('Source Management D — tenant/client fail closed', () => {
  it('register hook refuses mutation without trusted clientId', () => {
    const src = read(hook);
    const start = src.indexOf('export function useRegisterSource');
    const slice = src.slice(start, start + 900);
    expect(slice).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(slice).toMatch(/requestedClientId: scope\.clientId/);
    expect(slice).not.toMatch(/organizationId:/);
    expect(slice).not.toMatch(/actorRole:/);
  });
});

describe('Source Management E — invalid input is canonical failure', () => {
  it('register surfaces seam CommandResult message, not a local business rule', () => {
    expect(code(workspace)).toMatch(/result\.message/);
    expect(code(workspace)).not.toMatch(/QUOTA_EXCEEDED/);
    expect(code(workspace)).not.toMatch(/assertSourceQuota/);
    expect(code(hook)).toMatch(/signalIntakeCommands\.registerSource/);
  });
});

describe('Source Management F — successful register refreshes source reads', () => {
  it('register invalidates workspace-sources and sources keys', () => {
    const src = read(hook);
    const start = src.indexOf('function invalidateSourceReads');
    const slice = src.slice(start, src.indexOf('export function usePollRegisteredSource'));
    expect(slice).toMatch(/workspace-sources/);
    expect(slice).toMatch(/'sources'/);
    expect(src.slice(src.indexOf('export function useRegisterSource'), src.indexOf('export function usePollRegisteredSource'))).toMatch(
      /invalidateSourceReads/
    );
  });
});

describe('Source Management G — poll-one delegates canonically', () => {
  it('poll-one hook and seam reach PollRegisteredSource consumer', () => {
    expect(code(workspace)).toMatch(/usePollRegisteredSource\(scope\)/);
    expect(code(hook)).toMatch(/signalIntakeCommands\.pollRegisteredSource/);
    expect(code(seam)).toMatch(/await pollRegisteredSource\(intent\)/);
    expect(code(consumer)).toMatch(/useCases\.pollRegisteredSource/);
  });
});

describe('Source Management H — poll-all delegates canonically', () => {
  it('poll-all uses PollAllActiveSources, not a React loop', () => {
    expect(code(workspace)).toMatch(/usePollAllActiveSources\(scope\)/);
    expect(code(hook)).toMatch(/signalIntakeCommands\.pollAllActiveSources/);
    expect(code(seam)).toMatch(/await pollAllActiveSources\(intent\)/);
    const pollAllHook = code(hook).slice(
      code(hook).indexOf('export function usePollAllActiveSources'),
      code(hook).indexOf('export function useRegisterManualSignal')
    );
    expect(pollAllHook).not.toMatch(/for\s*\(/);
    expect(pollAllHook).not.toMatch(/pollRegisteredSource/);
  });
});

describe('Source Management I — React never calls SourceFeedPort.fetch', () => {
  it('workspace, hook, and seam contain no feed.fetch', () => {
    expect(code(workspace)).not.toMatch(/feed\.fetch/);
    expect(code(hook)).not.toMatch(/feed\.fetch/);
    expect(code(seam)).not.toMatch(/feed\.fetch/);
    expect(code(registry)).not.toMatch(/feed\.fetch/);
  });
});

describe('Source Management J — React never calls fetchSourceItems', () => {
  it('React source files do not import fetchSourceItems', () => {
    expect(code(workspace)).not.toMatch(/fetchSourceItems/);
    expect(code(hook)).not.toMatch(/fetchSourceItems/);
    expect(code(seam)).not.toMatch(/fetchSourceItems/);
    expect(code(registry)).not.toMatch(/fetchSourceItems/);
  });
});

describe('Source Management K — manual signal delegates to RegisterManualSignal', () => {
  it('manual hook uses existing registerManualSignal seam', () => {
    expect(code(workspace)).toMatch(/useRegisterManualSignal\(scope\)/);
    expect(code(hook)).toMatch(/signalIntakeCommands\.registerManualSignal/);
    expect(code(seam)).toMatch(/registerManualSignal\(intent\)/);
  });
});

describe('Source Management L — manual signal does not score', () => {
  it('React source path never calls scoreSignal', () => {
    expect(code(workspace)).not.toMatch(/scoreSignal/);
    expect(code(hook)).not.toMatch(/scoreSignal/);
    const seamBlock = code(seam).slice(
      code(seam).indexOf('export const signalIntakeCommands'),
      code(seam).indexOf('export type RadarDiscardCommandResult')
    );
    expect(seamBlock).not.toMatch(/scoreSignal/);
  });
});

describe('Source Management M — #25 lifecycle stays absent', () => {
  it('SourcesPanel has no pause/resume/archive/probe controls', () => {
    const src = code(workspace);
    const start = src.indexOf('function SourcesPanel');
    const panel = src.slice(start, src.indexOf('function TasksPanel'));
    expect(panel).not.toMatch(/Pausar/);
    expect(panel).not.toMatch(/Reactivar/);
    expect(panel).not.toMatch(/Archivar/);
    expect(panel).not.toMatch(/Probar feed/);
    expect(panel).not.toMatch(/btn-pause-source/);
    expect(panel).not.toMatch(/btn-resume-source/);
    expect(panel).not.toMatch(/btn-archive-source/);
    expect(panel).not.toMatch(/btn-probe-source/);
  });
});

describe('Source Management N — no React updateSourceStatus', () => {
  it('React source write files never call updateSourceStatus or recordSourceRun', () => {
    expect(code(workspace)).not.toMatch(/updateSourceStatus/);
    expect(code(hook)).not.toMatch(/updateSourceStatus/);
    expect(code(seam)).not.toMatch(/updateSourceStatus/);
    expect(code(workspace)).not.toMatch(/recordSourceRun/);
    expect(code(hook)).not.toMatch(/recordSourceRun/);
    expect(code(seam)).not.toMatch(/recordSourceRun/);
  });
});

describe('Source Management O — discovery remains LegacyHandoff', () => {
  it('SourcesPanel handoff keeps discovery and does not run the agent', () => {
    const src = code(workspace);
    const start = src.indexOf('function SourcesPanel');
    const panel = src.slice(start, src.indexOf('function TasksPanel'));
    expect(panel).toMatch(/el descubrimiento automático/);
    expect(panel).toMatch(/pausarlas o archivarlas/);
    expect(panel).toMatch(/LegacyHandoff/);
    expect(panel).not.toMatch(/runSourceDiscoveryAgent/);
    expect(panel).not.toMatch(/Tavily/);
    expect(src).not.toMatch(/runSourceDiscoveryAgent/);
  });
});

describe('Source Management P — cross-client poll fail closed', () => {
  it('poll hooks send only narrowed session clientId', () => {
    const src = read(hook);
    const pollOne = src.slice(src.indexOf('export function usePollRegisteredSource'), src.indexOf('export function usePollAllActiveSources'));
    expect(pollOne).toMatch(/if \(!scope\?\.clientId\) return \{ ok: false, message: 'Cliente no resuelto' \}/);
    expect(pollOne).toMatch(/requestedClientId: scope\.clientId/);
    expect(pollOne).not.toMatch(/organizationId:/);
  });
});

describe('Source Management Q — SourcesPanel uses narrowed client scope', () => {
  it('SourcesPanel mirrors sibling workspace narrowToClient pattern', () => {
    const src = read(workspace);
    const start = src.indexOf('function SourcesPanel');
    const panel = src.slice(start, src.indexOf('function TasksPanel'));
    expect(panel).toMatch(/workspaceClientId/);
    expect(panel).toMatch(/narrowToClient\(tenantScope, requested\)/);
    expect(src).toMatch(/<SourcesPanel workspaceClientId=\{clientId\} \/>/);
  });
});

describe('Source Management R — leftover modal is absent; leftover host debt remains', () => {
  it('leftover modal is absent; handlers and scheduler remain; handoff has no previous-interface path', () => {
    expect(existsSync(join(ROOT, 'src/components/SourceRegistryModal.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/ui/legacy/handlers/sourcesHandlers.ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'src/controllers/sourceAutomationScheduler.ts'))).toBe(true);
    expect(read(workspace)).toMatch(/react-ws-sources-handoff/);
    expect(read('src/ui/modules/pages/LegacyHandoff.tsx')).not.toMatch(/applyUiMode/);
  });
});

describe('Source Management — no new Application use case', () => {
  it('signal intake Application file set is unchanged', () => {
    const files = readdirSync(join(ROOT, applicationDir)).filter((name) => name.endsWith('.ts'));
    expect(files.sort()).toEqual([
      'DiscardSignal.ts',
      'MarkSignalSaved.ts',
      'PollRegisteredSource.ts',
      'RegisterManualSignal.ts',
      'RegisterSource.ts',
      'errors.ts',
      'index.ts',
      'trustedContext.ts',
    ]);
    expect(existsSync(join(ROOT, applicationDir, 'UpdateSourceStatus.ts'))).toBe(false);
  });
});
