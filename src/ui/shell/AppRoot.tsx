/**
 * SPEC-010 · React shell root (§24 step 1).
 *
 * "Compatible with current services" means the shell composes the trusted
 * session projection and the query cache over the EXISTING services, and adds no
 * authority of its own. It decides which wave-1 surface to present based purely
 * on whether the trusted runtime reports a session — the same condition the
 * legacy controller uses.
 *
 * The shell owns presentation only: no business rule, no lifecycle transition,
 * no strategic decision.
 */

import { createElement, type ReactElement } from 'react';
import { QueryProvider } from '../providers/QueryProvider';
import { SessionProvider, useSession } from '../providers/SessionProvider';
import { UiErrorBoundary } from '../providers/ErrorBoundary';
import { ReactAppShell } from '../modules/AppShell/ReactAppShell';
import { ReactLogin } from '../modules/Login/ReactLogin';

function reloadPage(): void {
  window.location.reload();
}

function ShellSwitch() {
  const { user } = useSession();
  // `.app-container` is the logged-in shell grid (sidebar | main). Login must
  // not sit in that grid or it is crushed into the 240px sidebar column.
  if (user) {
    return (
      <div className="app-container" data-testid="react-shell">
        <ReactAppShell />
      </div>
    );
  }
  return (
    <div data-testid="react-shell">
      <ReactLogin />
    </div>
  );
}

export function AppRoot() {
  return (
    <UiErrorBoundary onReload={reloadPage}>
      <QueryProvider>
        <SessionProvider>
          <ShellSwitch />
        </SessionProvider>
      </QueryProvider>
    </UiErrorBoundary>
  );
}

/** Indirection so the mount seam does not need to parse JSX. */
export function createShellElement(): ReactElement {
  return createElement(AppRoot);
}
