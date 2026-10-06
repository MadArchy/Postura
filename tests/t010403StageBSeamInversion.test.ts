/**
 * SPEC-010 T-010-403 — Stage-B seam inversion architecture tests.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readLegacyControllerSurface } from './lib/legacyControllerSurface';

const ROOT = join(import.meta.dirname, '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('T-010-403 — Stage-B shell ownership', () => {
  it('normal mode default is React-owned shell', () => {
    const toggle = read('src/ui/strangler/toggle.ts');
    expect(toggle).toMatch(/DEFAULT_UI_MODE: UiMode = 'react'/);
  });

  it('LegacyApp does not render the legacy global shell while React owns presentation', () => {
    const legacy = read('src/ui/legacy/LegacyApp.ts');
    expect(legacy).toMatch(
      /if \(this\.isReactShellOwner\(\)\) \{\s*\n\s*if \(this\.islandHostEl\) this\.renderIsland\(\);\s*\n\s*return;\s*\n\s*\}/
    );
  });

  it('ReactAppShell owns top-level navigation state', () => {
    const shell = read('src/ui/modules/AppShell/ReactAppShell.tsx');
    expect(shell).toMatch(/useState\(isAdmin \? 'dashboard'/);
    expect(shell).toMatch(/subscribeShellNavigation/);
    expect(shell).not.toMatch(/from\s+['"].*dbService/);
  });

  it('legacy islands mount through a dedicated host seam', () => {
    const host = read('src/ui/legacy/LegacyIslandHost.tsx');
    const bridge = read('src/controllers/legacyIslandBridge.ts');
    expect(host).toMatch(/mountLegacyIsland/);
    expect(host).toMatch(/unmountLegacyIsland/);
    expect(bridge).toMatch(/registerLegacyIslandController/);
  });

  it('legacy navigation publishes intents instead of owning shell state in React mode', () => {
    const legacy = read('src/ui/legacy/LegacyApp.ts');
    expect(legacy).toMatch(/publishShellNavigation/);
    expect(legacy).toMatch(/if \(this\.isReactShellOwner\(\)\)/);
  });
});

describe('T-010-403 — rollback and single global shell', () => {
  it('rollback seam stays in mount while the shell exposes no legacy navigation control', () => {
    const shell = read('src/ui/modules/AppShell/ReactAppShell.tsx');
    expect(shell).not.toMatch(/applyUiMode/);
    expect(shell).not.toMatch(/react-shell-to-legacy/);
    const mount = read('src/ui/mount.ts');
    expect(mount).toMatch(/export async function applyUiMode\(mode: UiMode\)/);
    expect(mount).toMatch(/__posturaUi = \{\s*applyUiMode,/);
    const css = read('src/ui/strangler/strangler.css');
    expect(css).toContain("html[data-postura-ui='react'] #app");
    expect(css).toContain('html:not([data-postura-ui=\'react\']) #react-root');
  });

  it('sibling roots remain exclusive owners (A38)', () => {
    const html = read('index.html');
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<div id="react-root"></div>');
    const mount = read('src/ui/mount.ts');
    expect(mount).not.toMatch(/createRoot\([^)]*LEGACY_ROOT_ID/);
  });
});

describe('T-010-403 — canonical path preservation', () => {
  it('#9 ingest remains consumer-owned', () => {
    const surface = readLegacyControllerSurface();
    expect(surface).toMatch(/pollRegisteredSource/);
    expect(surface).toMatch(/pollAllActiveSources/);
    expect(surface).not.toMatch(/async function pollRegisteredSource/);
  });

  it('#18 send remains consumer-owned', () => {
    const surface = readLegacyControllerSurface();
    expect(surface).toMatch(/sendDeliveryPackage/);
    expect(surface).not.toMatch(/async function sendDeliveryPackage/);
  });

  it('React shell has no business authority imports', () => {
    const forbidden = [/from\s+['"].*dbService/, /from\s+['"].*\w+Consumer/, /from\s+['"].*\/domain/];
    const uiFiles = [
      'src/ui/modules/AppShell/ReactAppShell.tsx',
      'src/ui/legacy/LegacyIslandHost.tsx',
      'src/ui/legacy/navigationBridge.ts',
    ];
    for (const file of uiFiles) {
      const source = read(file);
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
  });
});

describe('T-010-403 — governance status', () => {
  it('records former BLOCKED_BY_PRECONDITION without erasing history', () => {
    const tasks = read('specs/010-react-migration/tasks.md');
    const governance = read('specs/010-react-migration/t-010-403-stage-b-seam-inversion.md');
    expect(tasks).toMatch(/T-010-403 \/ T-010-404 — why BLOCKED/);
    expect(governance).toMatch(/Former status.*BLOCKED_BY_PRECONDITION/);
  });
});
