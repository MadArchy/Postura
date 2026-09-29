import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_FIREBASE_PROJECT_ID,
  assertLoopbackEmulatorHost,
  assertNonProductionFirebaseProjectForE2E,
  isProductionFirebaseProject,
} from '../src/firebase/productionGuard';
import { resetFirebaseEmulators } from '../e2e/support/emulatorReset';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('E2E Firebase production guard', () => {
  it('rejects the production project in E2E mode', () => {
    expect(PRODUCTION_FIREBASE_PROJECT_ID).toBe('aurora-postura-app');
    expect(isProductionFirebaseProject('aurora-postura-app')).toBe(true);
    expect(isProductionFirebaseProject(' AURORA-POSTURA-APP ')).toBe(true);
    for (const useEmulators of [true, false]) {
      expect(() =>
        assertNonProductionFirebaseProjectForE2E({ projectId: 'aurora-postura-app', useEmulators })
      ).toThrow(/E2E against production Firebase project "aurora-postura-app" is prohibited/);
    }
  });

  it('allows the demo project with emulators', () => {
    expect(() =>
      assertNonProductionFirebaseProjectForE2E({ projectId: 'demo-aurora-e2e', useEmulators: true })
    ).not.toThrow();
  });

  it('fails closed for non-demo projects, missing project, or emulators off', () => {
    expect(() => assertNonProductionFirebaseProjectForE2E({ projectId: 'some-live-project', useEmulators: true })).toThrow(
      /emulator-only "demo-\*"/
    );
    expect(() => assertNonProductionFirebaseProjectForE2E({ projectId: '', useEmulators: true })).toThrow(/<missing>/);
    expect(() => assertNonProductionFirebaseProjectForE2E({ projectId: 'demo-aurora-e2e', useEmulators: false })).toThrow(
      /Firebase Emulator Suite/
    );
  });

  it('accepts only loopback emulator hosts', () => {
    expect(assertLoopbackEmulatorHost('127.0.0.1:8080')).toBe('127.0.0.1:8080');
    expect(assertLoopbackEmulatorHost('localhost:9099')).toBe('localhost:9099');
    expect(() => assertLoopbackEmulatorHost('firestore.googleapis.com:443')).toThrow(/loopback/);
    expect(() => assertLoopbackEmulatorHost(undefined)).toThrow(/<missing>/);
  });
});

describe('E2E emulator cleanup', () => {
  it('refuses the production project without any network call', async () => {
    const fetchImpl = vi.fn();
    await expect(
      resetFirebaseEmulators(
        { projectId: 'aurora-postura-app', firestoreHost: '127.0.0.1:8080', authHost: '127.0.0.1:9099' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow(/production Firebase project "aurora-postura-app" is prohibited/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses non-loopback hosts without any network call', async () => {
    const fetchImpl = vi.fn();
    await expect(
      resetFirebaseEmulators(
        { projectId: 'demo-aurora-e2e', firestoreHost: 'firestore.googleapis.com:443', authHost: '127.0.0.1:9099' },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toThrow(/loopback/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('clears only emulator endpoints for the demo project', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    await resetFirebaseEmulators(
      { projectId: 'demo-aurora-e2e', firestoreHost: '127.0.0.1:8080', authHost: '127.0.0.1:9099' },
      fetchImpl as unknown as typeof fetch
    );
    expect(fetchImpl.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      'http://127.0.0.1:8080/emulator/v1/projects/demo-aurora-e2e/databases/(default)/documents',
      'http://127.0.0.1:9099/emulator/v1/projects/demo-aurora-e2e/accounts',
    ]);
  });
});

describe('Firebase init guard (test mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('aborts app Firebase init when test mode targets production', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'k');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'aurora-postura-app');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'true');
    vi.resetModules();
    await expect(import('../src/firebase/config')).rejects.toThrow(/\[Firebase init\].*prohibited/);
  });

  it('boots app Firebase config for the demo emulator project', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'demo-api-key');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-aurora-e2e');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'true');
    vi.resetModules();
    const { readFirebaseConfig, FIREBASE_ENABLED } = await import('../src/firebase/config');
    expect(FIREBASE_ENABLED).toBe(true);
    expect(readFirebaseConfig()).toMatchObject({ projectId: 'demo-aurora-e2e', useEmulators: true });
  });
});

describe('E2E wiring', () => {
  it('.env.test targets the demo emulator project', () => {
    const env = read('.env.test');
    expect(env).toMatch(/^VITE_FIREBASE_PROJECT_ID=demo-aurora-e2e$/m);
    expect(env).toMatch(/^VITE_FIREBASE_USE_EMULATORS=true$/m);
    expect(env).toMatch(/^VITE_POSTURA_FUNCTIONS_BASE=$/m);
    expect(env).not.toContain('aurora-postura-app');
  });

  it('default E2E command is emulator-backed and Vite runs in test mode', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['test:e2e']).toMatch(/^firebase emulators:exec --project demo-aurora-e2e .*playwright test/);
    const config = read('playwright.config.ts');
    expect(config).toContain('--mode test');
    expect(config).toContain('reuseExistingServer: false');
    expect(config).toContain("globalSetup: './e2e/support/globalSetup.ts'");
  });
});
