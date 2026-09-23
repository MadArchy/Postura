/**
 * Canonical RematerializeLocalSnapshotToFirestore Application + consumer.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRematerializeLocalSnapshotToFirestore,
  type FirestoreSnapshotImportPort,
  type LocalSnapshotExportPort,
  type TrustedLocalSnapshotAdminContext,
} from '../src/application/localSnapshot';
import type { LocalV5Snapshot } from '../src/services/firestore/types';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function emptySnapshot(overrides: Partial<LocalV5Snapshot> = {}): LocalV5Snapshot {
  return {
    clients: [],
    theses: [],
    profiles: {},
    sources: [],
    signals: [],
    recommendations: [],
    tasks: [],
    contents: [],
    opportunities: [],
    campaigns: [],
    campaignMilestones: [],
    evidenceVault: [],
    aiRuns: [],
    subscription: null,
    invitations: [],
    results: [],
    curation: [],
    deliveries: [],
    advices: [],
    files: [],
    topicPins: [],
    dossiers: {},
    feedbackEvents: [],
    signalOutcomes: [],
    proofWallItems: [],
    notifications: [],
    ...overrides,
  };
}

function adminTrusted(
  overrides: Partial<TrustedLocalSnapshotAdminContext> = {}
): TrustedLocalSnapshotAdminContext {
  return {
    actorId: 'admin_01',
    actorRole: 'ADMIN',
    organizationId: 'org_trust',
    ...overrides,
  };
}

function ports(options: {
  snapshot?: LocalV5Snapshot | null;
  exportError?: Error;
  importResult?: { ok: boolean; message: string; written: number };
  importError?: Error;
} = {}) {
  const order: string[] = [];
  const imported: LocalV5Snapshot[] = [];
  const snapshot: LocalSnapshotExportPort = {
    exportCurrent() {
      order.push('export');
      if (options.exportError) throw options.exportError;
      return options.snapshot === undefined ? emptySnapshot() : options.snapshot;
    },
  };
  const firestore: FirestoreSnapshotImportPort = {
    async importSnapshot(next) {
      order.push('import');
      imported.push(next);
      if (options.importError) throw options.importError;
      return (
        options.importResult ?? {
          ok: true,
          message: 'Importados 3 documentos a Firestore.',
          written: 3,
        }
      );
    },
  };
  return { snapshot, firestore, order, imported };
}

describe('RematerializeLocalSnapshotToFirestore — Application authority', () => {
  it('ADMIN trusted actor rematerializes the exported snapshot', async () => {
    const payload = emptySnapshot({ topicPins: ['pin-1'] });
    const { snapshot, firestore, order, imported } = ports({ snapshot: payload });
    const run = createRematerializeLocalSnapshotToFirestore({ snapshot, firestore });
    const result = await run({ trusted: adminTrusted() });
    expect(result).toEqual({
      ok: true,
      message: 'Importados 3 documentos a Firestore.',
      written: 3,
    });
    expect(order).toEqual(['export', 'import']);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toBe(payload);
  });

  it('rejects a CLIENT actor', async () => {
    const { snapshot, firestore, order } = ports();
    const run = createRematerializeLocalSnapshotToFirestore({ snapshot, firestore });
    await expect(
      run({ trusted: adminTrusted({ actorRole: 'CLIENT' }) })
    ).rejects.toMatchObject({
      code: 'ACTOR_NOT_AUTHORIZED',
    });
    expect(order).toEqual([]);
  });

  it('rejects missing actor and organization context', async () => {
    const { snapshot, firestore } = ports();
    const run = createRematerializeLocalSnapshotToFirestore({ snapshot, firestore });
    await expect(
      run({ trusted: adminTrusted({ actorId: '' }) })
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
    await expect(
      run({ trusted: adminTrusted({ organizationId: '  ' }) })
    ).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED' });
  });

  it('fails deterministically when export returns no snapshot', async () => {
    const { snapshot, firestore, order } = ports({ snapshot: null });
    const run = createRematerializeLocalSnapshotToFirestore({ snapshot, firestore });
    await expect(run({ trusted: adminTrusted() })).rejects.toMatchObject({
      code: 'NO_LOCAL_SNAPSHOT',
    });
    expect(order).toEqual(['export']);
  });

  it('maps a persistence throw from export', async () => {
    const { snapshot, firestore } = ports({ exportError: new Error('export failed') });
    const run = createRematerializeLocalSnapshotToFirestore({ snapshot, firestore });
    await expect(run({ trusted: adminTrusted() })).rejects.toMatchObject({
      code: 'PERSISTENCE_ERROR',
      message: 'export failed',
    });
  });

  it('maps Firebase-config and uninitialized Firestore adapter failures', async () => {
    const missing = ports({
      importResult: { ok: false, message: 'Configura VITE_FIREBASE_* para importar.', written: 0 },
    });
    await expect(
      createRematerializeLocalSnapshotToFirestore(missing)({ trusted: adminTrusted() })
    ).rejects.toMatchObject({ code: 'FIREBASE_NOT_CONFIGURED' });

    const down = ports({
      importResult: { ok: false, message: 'Firestore no inicializado.', written: 0 },
    });
    await expect(
      createRematerializeLocalSnapshotToFirestore(down)({ trusted: adminTrusted() })
    ).rejects.toMatchObject({ code: 'FIRESTORE_UNAVAILABLE' });
  });

  it('maps a generic adapter failure and thrown import error', async () => {
    const failed = ports({
      importResult: { ok: false, message: 'batch rejected', written: 0 },
    });
    await expect(
      createRematerializeLocalSnapshotToFirestore(failed)({ trusted: adminTrusted() })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_ERROR', message: 'batch rejected' });

    const thrown = ports({ importError: new Error('network down') });
    await expect(
      createRematerializeLocalSnapshotToFirestore(thrown)({ trusted: adminTrusted() })
    ).rejects.toMatchObject({ code: 'PERSISTENCE_ERROR', message: 'network down' });
  });

  it('command input is trusted context only — no snapshot, client, or tenant from UI', () => {
    const app = read('src/application/localSnapshot/RematerializeLocalSnapshotToFirestore.ts');
    expect(app).toMatch(/trusted: TrustedLocalSnapshotAdminContext/);
    expect(app).not.toMatch(/snapshot\?:/);
    expect(app).not.toMatch(/clientId/);
    expect(app).not.toMatch(/claimedOrganizationId/);
    expect(app).not.toMatch(/localStorage/);
  });
});

describe('RematerializeLocalSnapshotToFirestore — Application isolation', () => {
  it('Application does not import infrastructure, UI, leftover push, or Firestore adapters', () => {
    const app = code('src/application/localSnapshot/RematerializeLocalSnapshotToFirestore.ts');
    expect(app).not.toMatch(/dbService/);
    expect(app).not.toMatch(/importSnapshotToFirestore/);
    expect(app).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(app).not.toMatch(/from ['"].*ui\//);
    expect(app).not.toMatch(/from ['"].*infrastructure\//);
    expect(app).not.toMatch(/from ['"].*services\/firestore\/sync/);
  });

  it('ports wrap existing export/import without changing leftover mutator ownership', () => {
    const exportAdapter = code(
      'src/infrastructure/localSnapshot/createDbLocalSnapshotExportPort.ts'
    );
    const importAdapter = code(
      'src/infrastructure/localSnapshot/createFirestoreSnapshotImportPort.ts'
    );
    expect(exportAdapter).toMatch(/dbService\.exportSnapshot\(\)/);
    expect(exportAdapter).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(importAdapter).toMatch(/importSnapshotToFirestore/);
    expect(importAdapter).not.toMatch(/pushCurrentLocalToFirestore/);
  });
});

const authState = vi.hoisted(() => ({
  user: {
    uid: 'admin_01',
    role: 'ADMIN',
    organizationId: 'org_trust',
  } as { uid: string; role: string; organizationId: string } | null,
  firebaseEnabled: true,
}));

vi.mock('../src/services/auth', () => ({
  authService: {
    getCurrentUser: () => authState.user,
  },
}));

vi.mock('../src/firebase/config', () => ({
  get FIREBASE_ENABLED() {
    return authState.firebaseEnabled;
  },
}));

describe('localSnapshotConsumer — trusted ADMIN gate', () => {
  beforeEach(() => {
    authState.user = {
      uid: 'admin_01',
      role: 'ADMIN',
      organizationId: 'org_trust',
    };
    authState.firebaseEnabled = true;
    vi.resetModules();
  });

  it('consumer source requires requireAdminActor and Firebase availability', () => {
    const consumer = read('src/services/localSnapshotConsumer.ts');
    expect(consumer).toMatch(/requireAdminActor/);
    expect(consumer).toMatch(/FIREBASE_ENABLED/);
    expect(consumer).not.toMatch(/pushCurrentLocalToFirestore/);
    expect(consumer).not.toMatch(/from ['"].*ui\//);
  });

  it('consumer rejects a CLIENT session before composing the write', async () => {
    authState.user = {
      uid: 'client_01',
      role: 'CLIENT',
      organizationId: 'org_trust',
    };
    const { rematerializeLocalSnapshot, resetLocalSnapshotConsumerForTest } =
      await import('../src/services/localSnapshotConsumer');
    resetLocalSnapshotConsumerForTest({
      rematerializeLocalSnapshotToFirestore: async () => {
        throw new Error('use case must not run');
      },
    });
    await expect(rematerializeLocalSnapshot()).rejects.toMatchObject({
      name: 'LocalSnapshotError',
      code: 'ACTOR_NOT_AUTHORIZED',
    });
  });

  it('consumer rejects unavailable Firebase before composing the write', async () => {
    authState.firebaseEnabled = false;
    const { rematerializeLocalSnapshot, resetLocalSnapshotConsumerForTest } =
      await import('../src/services/localSnapshotConsumer');
    resetLocalSnapshotConsumerForTest({
      rematerializeLocalSnapshotToFirestore: async () => {
        throw new Error('use case must not run');
      },
    });
    await expect(rematerializeLocalSnapshot()).rejects.toMatchObject({
      code: 'FIREBASE_NOT_CONFIGURED',
    });
  });

  it('consumer forwards trusted ADMIN context into the composed use case', async () => {
    const received: TrustedLocalSnapshotAdminContext[] = [];
    const { rematerializeLocalSnapshot, resetLocalSnapshotConsumerForTest } =
      await import('../src/services/localSnapshotConsumer');
    resetLocalSnapshotConsumerForTest({
      rematerializeLocalSnapshotToFirestore: async (input) => {
        received.push(input.trusted);
        return { ok: true, message: 'Importados 1 documentos a Firestore.', written: 1 };
      },
    });
    const result = await rematerializeLocalSnapshot();
    expect(result.ok).toBe(true);
    expect(result.written).toBe(1);
    expect(received).toEqual([
      { actorId: 'admin_01', actorRole: 'ADMIN', organizationId: 'org_trust' },
    ]);
  });
});
