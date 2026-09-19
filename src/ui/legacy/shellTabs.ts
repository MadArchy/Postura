/**
 * SPEC-010 T-010-403 — tab ownership classification for Stage-B shell routing.
 *
 * React-native pages and legacy-hosted islands must not both claim the same tab.
 */

const COCKPIT_TABS = new Set(['dashboard', 'clients', 'ai-center']);

const REACT_WORKSPACE_TABS = new Set([
  'ws-radar',
  'ws-deliver',
  'ws-briefs',
  'ws-sources-react',
  'ws-tasks',
  'ws-results',
  'ws-positioning',
  'ws-production',
]);

const REACT_PORTAL_TABS = new Set([
  'client-home',
  'client-feed',
  'client-content',
  'client-thesis',
]);

const REACT_WAVE2_TABS = new Set([
  'client-opps',
  'client-results',
  'client-profile',
  'ws-sources',
]);

/** Maps React shell tab ids to legacy island tab ids where they differ. */
export function legacyIslandTabId(tab: string): string {
  if (tab === 'ws-sources-react') return 'ws-sources';
  return tab;
}

export function isReactNativeTab(tab: string): boolean {
  return (
    COCKPIT_TABS.has(tab) ||
    REACT_WORKSPACE_TABS.has(tab) ||
    REACT_PORTAL_TABS.has(tab) ||
    REACT_WAVE2_TABS.has(tab)
  );
}

export function isLegacyIslandTab(tab: string): boolean {
  return !isReactNativeTab(tab);
}

export function isWorkspaceTab(tab: string): boolean {
  return tab.startsWith('ws-');
}
