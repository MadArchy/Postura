/**
 * SPEC-010 · `window.__posturaUi` production exposure (SEC-2 remediation, S2).
 *
 * The strangler seam and the recording persistence override exist only in the
 * DEV / test dev-server build (`import.meta.env.DEV`). Vite folds the guard to
 * `false` in production, so neither the global nor the override hook ships.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MOUNT = 'src/ui/mount.ts';
const RECORDING = 'src/ui/media/persistTrustedRecording.ts';
const DEV_GUARD = 'if (import.meta.env.DEV) {';

function code(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(relative(ROOT, join(ROOT, rel)).replace(/\\/g, '/'));
  }
  return out;
}

/** True when `index` sits inside an open `if (import.meta.env.DEV) {` block. */
function insideDevGuard(src: string, index: number): boolean {
  const guard = src.lastIndexOf(DEV_GUARD, index);
  if (guard === -1) return false;
  const between = src.slice(guard + DEV_GUARD.length, index);
  const opens = (between.match(/\{/g) || []).length;
  const closes = (between.match(/\}/g) || []).length;
  return opens >= closes;
}

/** Every `(window ...).name = …` write, located by paren balancing so typed casts are covered. */
function windowGlobalWrites(src: string): { name: string; index: number }[] {
  const writes: { name: string; index: number }[] = [];
  const pattern = /\(\s*window\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(src))) {
    let depth = 0;
    let end = match.index;
    for (; end < src.length; end += 1) {
      if (src[end] === '(') depth += 1;
      else if (src[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const tail = /^\)\.(\w+)\s*=(?!=)/.exec(src.slice(end));
    if (tail) writes.push({ name: tail[1], index: match.index });
  }
  for (const direct of src.matchAll(/\b(?:window|globalThis)\.(\w+)\s*=(?!=)/g)) {
    writes.push({ name: direct[1], index: direct.index ?? 0 });
  }
  return writes;
}

describe('A — strangler seam is DEV-guarded', () => {
  it('exposeStranglerControls assigns __posturaUi only inside the DEV guard', () => {
    const src = code(MOUNT);
    const fn = src.slice(src.indexOf('export function exposeStranglerControls'));
    expect(fn).toMatch(/^export function exposeStranglerControls\(\): void \{\s*if \(import\.meta\.env\.DEV\) \{\s*\(window as unknown as Record<string, unknown>\)\.__posturaUi = \{/);
    const assignment = src.indexOf('.__posturaUi =');
    expect(insideDevGuard(src, assignment)).toBe(true);
  });
});

describe('B — recording override is DEV-guarded', () => {
  it('persistTrustedRecording consults the override only in DEV, else the production path', () => {
    const src = code(RECORDING);
    const read = src.indexOf('.__posturaUi');
    expect(read).toBeGreaterThan(-1);
    expect(insideDevGuard(src, read)).toBe(true);
    expect(insideDevGuard(src, src.indexOf('harness.persistRecording('))).toBe(true);
    const production = src.indexOf("await import('../../services/recordings')");
    expect(production).toBeGreaterThan(-1);
    expect(insideDevGuard(src, production)).toBe(false);
    expect(src).toMatch(/return persistRecording\(organizationId, clientId, taskId, blob\);\s*\}\s*$/);
  });
});

describe('C — no unguarded __posturaUi under src/**', () => {
  it('every reference sits inside a DEV guard, in the two governed files only', () => {
    const files: string[] = [];
    for (const rel of sourceFiles()) {
      const src = code(rel);
      let at = src.indexOf('__posturaUi');
      if (at === -1) continue;
      files.push(rel);
      while (at !== -1) {
        expect(insideDevGuard(src, at), `${rel}@${at}`).toBe(true);
        at = src.indexOf('__posturaUi', at + 1);
      }
    }
    expect(files.sort()).toEqual([MOUNT, RECORDING].sort());
  });
});

describe('D — DEV / test seam intentionally retained', () => {
  it('members and the startup call are unchanged', () => {
    const src = code(MOUNT);
    const block = src.slice(src.indexOf('.__posturaUi = {'), src.indexOf('};', src.indexOf('.__posturaUi = {')));
    for (const member of [
      'applyUiMode',
      'readUiMode',
      'isReactMounted',
      'REACT_ROOT_ID',
      'LEGACY_ROOT_ID',
      'mountLegacyIsland',
      'unmountLegacyIsland',
    ]) {
      expect(block).toMatch(new RegExp(`\\b${member},`));
    }
    expect(code('src/main.ts')).toMatch(/exposeStranglerControls\(\);/);
  });

  it('Option E path is untouched by the guard', () => {
    const src = code(MOUNT);
    const apply = src.slice(src.indexOf('export async function applyUiMode'), src.indexOf('export async function initReactStrangler'));
    expect(apply).not.toMatch(/import\.meta\.env/);
    expect(apply).toMatch(/resolveServedUiMode\(mode\)/);
  });
});

describe('E — no production-only alternate mutable global', () => {
  it('every window/globalThis write under src/** is DEV-guarded', () => {
    const writes: string[] = [];
    for (const rel of sourceFiles()) {
      const src = code(rel);
      for (const write of windowGlobalWrites(src)) {
        writes.push(`${rel}:${write.name}`);
        expect(insideDevGuard(src, write.index), `${rel}:${write.name}`).toBe(true);
      }
    }
    expect(writes.sort()).toEqual([`${MOUNT}:__posturaUi`, 'src/ui/legacy/LegacyApp.ts:posturaReseedLocal'].sort());
  });
});
