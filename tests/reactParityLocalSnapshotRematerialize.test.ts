/**
 * SPEC-010 · React parity — canonical local snapshot rematerialization.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const COCKPIT = 'src/ui/modules/pages/ReactManagerCockpitPage.tsx';
const HOOKS = 'src/ui/hooks/useWave3Data.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const LEGACY_HANDLER = 'src/ui/legacy/handlers/clientAdminHandlers.ts';
const LEGACY_COCKPIT = 'src/components/ManagerCockpit.ts';
const PAGE_HEADER = 'src/components/PageHeader.ts';

describe('React rematerialize action ownership', () => {
  it('React cockpit serves rematerialize through the hook and command seam', () => {
    const cockpit = code(COCKPIT);
    const hooks = read(HOOKS);
    const seam = code(SEAM);
    expect(cockpit).toMatch(/useRematerializeLocalSnapshot/);
    expect(cockpit).toMatch(/react-cockpit-rematerialize/);
    expect(cockpit).toMatch(/Subir local → Firestore/);
    expect(hooks).toMatch(/export function useRematerializeLocalSnapshot/);
    expect(hooks).toMatch(/localSnapshotCommands\.rematerializeLocalSnapshot\(/);
    expect(seam).toMatch(/localSnapshotCommands/);
    expect(seam).toMatch(/rematerializeLocalSnapshot\(/);
    expect(seam).toMatch(/from ['"].*localSnapshotConsumer['"]/);
  });

  it('React does not own leftover persistence or construct a snapshot', () => {
    const cockpit = code(COCKPIT);
    const hooks = code(HOOKS);
    expect(cockpit).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(cockpit).not.toMatch(/importSnapshotToFirestore/);
    expect(cockpit).not.toMatch(/localStorage/);
    expect(cockpit).not.toMatch(/from ['"].*services\//);
    expect(cockpit).not.toMatch(/from ['"].*localSnapshotConsumer['"]/);
    expect(hooks).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(hooks).not.toMatch(/importSnapshotToFirestore/);
    expect(hooks).not.toMatch(/\bdbService\b/);
    expect(hooks).not.toMatch(/from ['"].*localSnapshotConsumer['"]/);
  });

  it('React rematerialize action stays in the cockpit admin area outside header actions', () => {
    const cockpit = read(COCKPIT);
    expect(cockpit).toMatch(/<CreateClientPanel \/>/);
    expect(cockpit).toMatch(/<RematerializeLocalSnapshotPanel \/>/);
    expect(cockpit).toMatch(/<ReactTabHeader\s+tab=\{COCKPIT_HEADER_TAB\[tab\]\}/);
    expect(cockpit).not.toMatch(/<ReactTabHeader[^>]*actions=/);
    expect(existsSync(join(process.cwd(), PAGE_HEADER))).toBe(false);
  });

  it('ADMIN and Firebase availability remain presentation gates', () => {
    const cockpit = code(COCKPIT);
    expect(cockpit).toMatch(/isAdmin/);
    expect(cockpit).toMatch(/react-cockpit-not-admin/);
    expect(cockpit).toMatch(/available/);
    const hooks = read(HOOKS);
    const idx = hooks.indexOf('export function useRematerializeLocalSnapshot');
    const block = hooks.slice(idx, idx + 900);
    expect(block).toMatch(/localSnapshotCommands\.isRematerializeAvailable\(\)/);
  });

  it('create-client remains served and leftover-only handoff no longer claims Firestore push', () => {
    const cockpit = read(COCKPIT);
    expect(cockpit).toMatch(/useCreateClientWithInvite/);
    expect(cockpit).toMatch(/react-cockpit-create-client/);
    expect(cockpit).toMatch(/ver la app como cliente/);
    expect(cockpit).toMatch(/generar contenido y mover el pipeline/);
    expect(cockpit).not.toMatch(/subir datos a Firestore/);
  });
});

describe('Leftover rematerialize retarget', () => {
  it('leftover header button is gone as presentation; leftover handler still uses the canonical consumer', () => {
    expect(read(LEGACY_COCKPIT)).not.toMatch(/btn-firebase-push-local/);
    expect(read(LEGACY_COCKPIT)).not.toMatch(/from\s+['"]\.\/PageHeader['"]/);
    const handler = code(LEGACY_HANDLER);
    expect(handler).toMatch(/btn-firebase-push-local/);
    expect(handler).toMatch(/rematerializeLocalSnapshot\(/);
    expect(handler).toMatch(/requireAdmin\(\)/);
    expect(handler).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(handler).toMatch(/from ['"].*localSnapshotConsumer['"]/);
  });
});
