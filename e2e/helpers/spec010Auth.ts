/**
 * SPEC-010 Phase 5 — deterministic authenticated Playwright helpers.
 *
 * Uses the same demo credentials documented in docs/ops/pilot.md.
 * Test-only: no production auth bypass is introduced.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

export const UI_MODE_KEY = 'postura_ui_mode';

export const MANAGER_EMAIL = 'manager@postura.internal';
export const MANAGER_PASSWORD = 'Postura2026!';
export const CLIENT_JUAN_EMAIL = 'juan.vasquez@lexfirm.com';
export const CLIENT_ELENA_EMAIL = 'elena.martinez@lexfirm.com';
export const CLIENT_PASSWORD = 'Postura2026!';
export const CLIENT_JUAN_ID = 'client_juan_001';
export const CLIENT_ELENA_ID = 'client_elena_002';

export function businessSnapshot(page: Page) {
  return page.evaluate(() => {
    const snapshot: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || key === 'postura_ui_mode') continue;
      snapshot[key] = localStorage.getItem(key) ?? '';
    }
    return snapshot;
  });
}

/** Keys that may drift from background schedulers unrelated to UI-mode rollback. */
const ROLLBACK_VOLATILE_KEYS = new Set([
  'postura_source_agent_v1',
  'postura_source_automation_v1',
]);

function canonicalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalizeJsonValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** T508 Decision B — canonical JSON object-key order for stable rollback comparison only. */
export function canonicalizeJsonStorageValue(raw: string): string {
  try {
    return JSON.stringify(canonicalizeJsonValue(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

export function canonicalizeRollbackStableSnapshot(snapshot: Record<string, string>): Record<string, string> {
  const stable: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (!ROLLBACK_VOLATILE_KEYS.has(key)) stable[key] = canonicalizeJsonStorageValue(value);
  }
  return stable;
}

export function rollbackStableSnapshot(page: Page) {
  return businessSnapshot(page).then(canonicalizeRollbackStableSnapshot);
}

export async function visibleRoots(page: Page) {
  return page.evaluate(() => {
    const shown = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return false;
      return getComputedStyle(el).display !== 'none' && !el.hasAttribute('hidden');
    };
    return ['app', 'react-root'].filter(shown);
  });
}

export function sidebarTab(page: Page, tab: string) {
  return page.locator(`.sidebar-link[data-tab="${tab}"]`);
}

export async function enableReactMode(page: Page) {
  await page.goto('/');
  await page.evaluate(([key]) => localStorage.setItem(key, 'react'), [UI_MODE_KEY]);
  await page.reload();
}

export async function login(page: Page, email: string, password: string) {
  await enableReactMode(page);
  await expect(page.locator('[data-testid="react-login"]')).toBeVisible();
  await page.fill('#react-login-email', email);
  await page.fill('#react-login-password', password);
  await page.click('[data-testid="react-login-submit"]');
  await expect(page.locator('[data-testid="react-login"]')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('[data-testid="react-shell-logout"]')).toBeVisible();
}

export async function loginAsManager(page: Page) {
  await login(page, MANAGER_EMAIL, MANAGER_PASSWORD);
}

export async function loginAsClientJuan(page: Page) {
  await login(page, CLIENT_JUAN_EMAIL, CLIENT_PASSWORD);
}

export async function loginAsClientElena(page: Page) {
  await login(page, CLIENT_ELENA_EMAIL, CLIENT_PASSWORD);
}

/**
 * Product data-readiness SLA after AppShell. None — identity and data are independent.
 * Historical `15_000` Abrir wait was a helper mechanic, not an acceptance criterion.
 */
export const APPSHELL_DATA_READINESS_SLA_MS: null = null;

/**
 * Existing T508 test-run ceiling from mid-journey rollback
 * (`e2e/t010508-phase5-parity.spec.ts` `test.setTimeout(90_000)`).
 * Harness safety only — not a product SLA and not derived from observed Firestore latency.
 */
export const T508_EXISTING_ROLLBACK_TEST_TIMEOUT_MS = 90_000;

export function harnessSafetyCeilingMs(currentTestTimeoutMs: number): number {
  return Math.max(currentTestTimeoutMs, T508_EXISTING_ROLLBACK_TEST_TIMEOUT_MS);
}

export type CockpitWorkspaceReadiness = {
  authenticated: boolean;
  abrirWorkspaceVisible: boolean;
  exposedClientIds: readonly string[];
  expectedClientId?: string;
};

/** Semantic cockpit readiness: authenticated manager + valid Abrir workspace action. */
export function isCockpitWorkspaceReady(state: CockpitWorkspaceReadiness): boolean {
  if (!state.authenticated) return false;
  if (!state.abrirWorkspaceVisible) return false;
  if (state.expectedClientId && !state.exposedClientIds.includes(state.expectedClientId)) {
    return false;
  }
  return true;
}

function applyHarnessSafetyCeiling(): number {
  const ceiling = harnessSafetyCeilingMs(test.info().timeout);
  if (test.info().timeout < ceiling) {
    test.setTimeout(ceiling);
  }
  return test.info().timeout;
}

/**
 * Wait until the cockpit exposes `Abrir workspace` (client-data readiness).
 * Condition-driven: does not treat AppShell visibility as data readiness.
 */
export async function waitForCockpitAbrirWorkspace(page: Page): Promise<Locator> {
  const timeout = applyHarnessSafetyCeiling();
  const openWorkspace = page.locator('[data-testid="react-cockpit-queue"] button', {
    hasText: 'Abrir workspace',
  }).first();

  await expect
    .poll(
      async () => {
        const loginVisible = await page.locator('[data-testid="react-login"]').isVisible();
        const logoutVisible = await page.locator('[data-testid="react-shell-logout"]').isVisible();
        if (loginVisible || !logoutVisible) return 'unauthenticated';
        if (await openWorkspace.isVisible()) return 'ready';
        return 'pending';
      },
      { timeout }
    )
    .toBe('ready');

  return openWorkspace;
}

export type ClientProjectionReadiness = {
  authenticated: boolean;
  sessionClientId: string | null;
  expectedClientId: string;
  hydratedOwnClientRecord: boolean;
};

/**
 * Client-data readiness: the authenticated session's own client record is present.
 * Task/opportunity/briefing counts are ignored so a legitimately empty client can be ready.
 */
export function isClientProjectionReady(state: ClientProjectionReadiness): boolean {
  if (!state.authenticated) return false;
  if (!state.sessionClientId || state.sessionClientId !== state.expectedClientId) return false;
  return state.hydratedOwnClientRecord;
}

export type ClientPortalCatchUp = {
  hydratedOwnClientRecord: boolean;
  storeTaskCount: number;
  portalShowsEmptyTasks: boolean;
};

/** Portal sampling may proceed once the UI matches the hydrated projection (empty or populated). */
export function isClientPortalCaughtUp(state: ClientPortalCatchUp): boolean {
  if (!state.hydratedOwnClientRecord) return false;
  if (state.storeTaskCount === 0) return true;
  return !state.portalShowsEmptyTasks;
}

export async function readAuthenticatedClientProjection(page: Page) {
  return page.evaluate(async () => {
    const { authService } = await import('/src/services/auth.ts');
    const { dbService } = await import('/src/services/db.ts');
    await authService.ready;
    const user = authService.getCurrentUser();
    const clientId = user?.clientId ?? null;
    const own = clientId ? dbService.getClientById(clientId) : null;
    const clientIds = dbService.getClients().map((client) => client.id);
    const taskTitles = clientId ? dbService.getTasksForClient(clientId).map((task) => task.title) : [];
    return {
      role: user?.role ?? null,
      organizationId: user?.organizationId ?? null,
      clientId,
      hydratedOwnClientRecord: Boolean(own && own.id === clientId),
      clientIds,
      taskTitles,
    };
  });
}

/**
 * Wait until the current CLIENT session's own projection has hydrated.
 * Does not require non-empty business content. Does not wait for portal strings to differ.
 */
export async function waitForAuthenticatedClientProjection(page: Page, expectedClientId: string) {
  const timeout = applyHarnessSafetyCeiling();
  await expect
    .poll(
      async () => {
        const loginVisible = await page.locator('[data-testid="react-login"]').isVisible();
        const logoutVisible = await page.locator('[data-testid="react-shell-logout"]').isVisible();
        if (loginVisible || !logoutVisible) return 'unauthenticated';
        if (!(await page.locator('[data-testid="react-client-portal"]').isVisible())) return 'pending';

        const projection = await readAuthenticatedClientProjection(page);
        if (
          !isClientProjectionReady({
            authenticated: true,
            sessionClientId: projection.clientId,
            expectedClientId,
            hydratedOwnClientRecord: projection.hydratedOwnClientRecord,
          })
        ) {
          return projection.clientId && projection.clientId !== expectedClientId ? 'wrong-scope' : 'pending';
        }

        const portalShowsEmptyTasks = await page.locator('[data-testid="react-portal-tasks-empty"]').isVisible();
        if (
          !isClientPortalCaughtUp({
            hydratedOwnClientRecord: true,
            storeTaskCount: projection.taskTitles.length,
            portalShowsEmptyTasks,
          })
        ) {
          return 'pending';
        }
        return 'ready';
      },
      { timeout }
    )
    .toBe('ready');
}

export async function enterClientWorkspaceFromShell(page: Page) {
  await sidebarTab(page, 'clients').click();
  const openWorkspace = await waitForCockpitAbrirWorkspace(page);
  await openWorkspace.click();
  await expect(page.locator('[data-testid="react-ws-radar"]')).toBeVisible({ timeout: 15_000 });
}

export async function openManagerWorkspace(page: Page, clientId = CLIENT_JUAN_ID) {
  await loginAsManager(page);
  await enterClientWorkspaceFromShell(page);
  void clientId;
}

/** P7-proven cleanup: discard every DRAFT delivery package for the fixture client. */
export async function discardAllDraftDeliveries(page: Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    for (const pkg of dbService.getDeliveriesByClient(cid)) {
      if (pkg.status === 'DRAFT') dbService.discardDraftDelivery(pkg.id);
    }
    return dbService.getDeliveriesByClient(cid).filter((d) => d.status === 'DRAFT').length;
  }, { cid: clientId });
}

/** Authoritative DRAFT count for fixture client (test-side read only). */
export async function countDraftDeliveries(page: Page, clientId: string) {
  return page.evaluate(async ({ cid }) => {
    const { dbService } = await import('/src/services/db.ts');
    return dbService.getDeliveriesByClient(cid).filter((d) => d.status === 'DRAFT').length;
  }, { cid: clientId });
}

/** P7-proven presentation refresh after authoritative store mutation post-mount. */
export async function refetchDeliverPanel(page: Page) {
  await sidebarTab(page, 'ws-radar').click();
  await sidebarTab(page, 'ws-deliver').click();
  await expect(page.locator('[data-testid="react-ws-deliver"]')).toBeVisible({
    timeout: 15_000,
  });
}
