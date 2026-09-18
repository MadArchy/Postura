/**
 * T508 workspace + client-portal readiness expectation — focused PASS/FAIL invariants.
 *
 * Proves Abrir and client-projection waits are condition-driven and do not
 * encode a 15-second-from-AppShell product SLA.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPSHELL_DATA_READINESS_SLA_MS,
  CLIENT_ELENA_ID,
  CLIENT_JUAN_ID,
  T508_EXISTING_ROLLBACK_TEST_TIMEOUT_MS,
  harnessSafetyCeilingMs,
  isClientPortalCaughtUp,
  isClientProjectionReady,
  isCockpitWorkspaceReady,
} from '../e2e/helpers/spec010Auth.ts';

const helperSource = readFileSync(new URL('../e2e/helpers/spec010Auth.ts', import.meta.url), 'utf8');
const abrirWaitSource = helperSource.slice(
  helperSource.indexOf('export async function waitForCockpitAbrirWorkspace'),
  helperSource.indexOf('export type ClientProjectionReadiness')
);
const clientWaitSource = helperSource.slice(
  helperSource.indexOf('export async function waitForAuthenticatedClientProjection'),
  helperSource.indexOf('export async function enterClientWorkspaceFromShell')
);

describe('T508 workspace readiness expectation', () => {
  describe('A — PASS when Abrir workspace appears after data readiness', () => {
    it('accepts authenticated cockpit with Abrir workspace and expected client', () => {
      expect(
        isCockpitWorkspaceReady({
          authenticated: true,
          abrirWorkspaceVisible: true,
          exposedClientIds: [CLIENT_JUAN_ID],
          expectedClientId: CLIENT_JUAN_ID,
        })
      ).toBe(true);
    });
  });

  describe('B — FAIL if the cockpit never becomes data-ready', () => {
    it('rejects authenticated empty cockpit with no Abrir workspace', () => {
      expect(
        isCockpitWorkspaceReady({
          authenticated: true,
          abrirWorkspaceVisible: false,
          exposedClientIds: [],
        })
      ).toBe(false);
    });
  });

  describe('C — FAIL if the wrong client is exposed', () => {
    it('rejects Abrir workspace for a client other than the expected id', () => {
      expect(
        isCockpitWorkspaceReady({
          authenticated: true,
          abrirWorkspaceVisible: true,
          exposedClientIds: ['client_elena_001'],
          expectedClientId: CLIENT_JUAN_ID,
        })
      ).toBe(false);
    });
  });

  describe('D — FAIL if authentication disappears', () => {
    it('rejects Abrir workspace when the session is gone', () => {
      expect(
        isCockpitWorkspaceReady({
          authenticated: false,
          abrirWorkspaceVisible: true,
          exposedClientIds: [CLIENT_JUAN_ID],
          expectedClientId: CLIENT_JUAN_ID,
        })
      ).toBe(false);
    });
  });

  describe('E — FAIL if only AppShell appears', () => {
    it('rejects authenticated shell without the workspace action', () => {
      expect(
        isCockpitWorkspaceReady({
          authenticated: true,
          abrirWorkspaceVisible: false,
          exposedClientIds: [],
          expectedClientId: CLIENT_JUAN_ID,
        })
      ).toBe(false);
    });
  });

  describe('F — no 15-second-from-AppShell product SLA', () => {
    it('does not define a product data-readiness SLA', () => {
      expect(APPSHELL_DATA_READINESS_SLA_MS).toBeNull();
    });

    it('uses the existing T508 rollback test timeout as harness ceiling, not 15s', () => {
      expect(T508_EXISTING_ROLLBACK_TEST_TIMEOUT_MS).toBe(90_000);
      expect(harnessSafetyCeilingMs(30_000)).toBe(90_000);
      expect(harnessSafetyCeilingMs(30_000)).not.toBe(15_000);
      expect(harnessSafetyCeilingMs(90_000)).toBe(90_000);
      expect(harnessSafetyCeilingMs(120_000)).toBe(120_000);
    });

    it('waits on Abrir workspace against the test timeout, not a fixed 15s Abrir SLA', () => {
      expect(abrirWaitSource).toContain("hasText: 'Abrir workspace'");
      expect(abrirWaitSource).toContain('timeout');
      expect(abrirWaitSource).not.toMatch(/15_000/);
      expect(abrirWaitSource).toContain('unauthenticated');
    });
  });
});

describe('T508 client portal projection readiness', () => {
  describe('A — Juan can become ready with populated data', () => {
    it('accepts hydrated Juan even when tasks exist', () => {
      expect(
        isClientProjectionReady({
          authenticated: true,
          sessionClientId: CLIENT_JUAN_ID,
          expectedClientId: CLIENT_JUAN_ID,
          hydratedOwnClientRecord: true,
        })
      ).toBe(true);
      expect(
        isClientPortalCaughtUp({
          hydratedOwnClientRecord: true,
          storeTaskCount: 5,
          portalShowsEmptyTasks: false,
        })
      ).toBe(true);
    });
  });

  describe('B — Elena can become ready while remaining business-empty', () => {
    it('accepts hydrated Elena with zero tasks', () => {
      expect(
        isClientProjectionReady({
          authenticated: true,
          sessionClientId: CLIENT_ELENA_ID,
          expectedClientId: CLIENT_ELENA_ID,
          hydratedOwnClientRecord: true,
        })
      ).toBe(true);
      expect(
        isClientPortalCaughtUp({
          hydratedOwnClientRecord: true,
          storeTaskCount: 0,
          portalShowsEmptyTasks: true,
        })
      ).toBe(true);
    });
  });

  describe('C — pre-hydration generic empty UI is not data-ready', () => {
    it('rejects authenticated empty portal before the own client record exists', () => {
      expect(
        isClientProjectionReady({
          authenticated: true,
          sessionClientId: CLIENT_JUAN_ID,
          expectedClientId: CLIENT_JUAN_ID,
          hydratedOwnClientRecord: false,
        })
      ).toBe(false);
      expect(
        isClientPortalCaughtUp({
          hydratedOwnClientRecord: false,
          storeTaskCount: 0,
          portalShowsEmptyTasks: true,
        })
      ).toBe(false);
    });
  });

  describe('D — correct clientId is required', () => {
    it('rejects a hydrated record under the wrong expected client', () => {
      expect(
        isClientProjectionReady({
          authenticated: true,
          sessionClientId: CLIENT_ELENA_ID,
          expectedClientId: CLIENT_JUAN_ID,
          hydratedOwnClientRecord: true,
        })
      ).toBe(false);
    });
  });

  describe('E — Juan readiness cannot satisfy Elena', () => {
    it('rejects Juan session state against Elena expected clientId', () => {
      expect(
        isClientProjectionReady({
          authenticated: true,
          sessionClientId: CLIENT_JUAN_ID,
          expectedClientId: CLIENT_ELENA_ID,
          hydratedOwnClientRecord: true,
        })
      ).toBe(false);
    });
  });

  describe('F — Elena readiness cannot satisfy Juan', () => {
    it('rejects Elena session state against Juan expected clientId', () => {
      expect(
        isClientProjectionReady({
          authenticated: true,
          sessionClientId: CLIENT_ELENA_ID,
          expectedClientId: CLIENT_JUAN_ID,
          hydratedOwnClientRecord: true,
        })
      ).toBe(false);
    });
  });

  describe('G — authentication loss causes failure', () => {
    it('rejects a hydrated own record when the session is gone', () => {
      expect(
        isClientProjectionReady({
          authenticated: false,
          sessionClientId: CLIENT_JUAN_ID,
          expectedClientId: CLIENT_JUAN_ID,
          hydratedOwnClientRecord: true,
        })
      ).toBe(false);
    });
  });

  describe('H — no arbitrary fixed wait as a product requirement', () => {
    it('does not wait for portal strings to differ or for a 15s sleep', () => {
      expect(APPSHELL_DATA_READINESS_SLA_MS).toBeNull();
      expect(clientWaitSource).toContain('expectedClientId');
      expect(clientWaitSource).not.toMatch(/waitForTimeout/);
      expect(clientWaitSource).not.toMatch(/15_000/);
      expect(clientWaitSource).not.toMatch(/innerText/);
    });
  });

  describe('I — Abrir workspace reconciliation remains intact', () => {
    it('still requires Abrir workspace and does not treat AppShell as data-ready', () => {
      expect(abrirWaitSource).toContain("hasText: 'Abrir workspace'");
      expect(
        isCockpitWorkspaceReady({
          authenticated: true,
          abrirWorkspaceVisible: false,
          exposedClientIds: [CLIENT_JUAN_ID],
          expectedClientId: CLIENT_JUAN_ID,
        })
      ).toBe(false);
    });
  });

  it('does not treat populated-store + stale empty portal as caught up', () => {
    expect(
      isClientPortalCaughtUp({
        hydratedOwnClientRecord: true,
        storeTaskCount: 5,
        portalShowsEmptyTasks: true,
      })
    ).toBe(false);
  });
});
