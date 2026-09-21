/**
 * SPEC-010 Phase 6 — ClientPortal opportunity cutover.
 *
 * C1–C5 evidence for the bounded unit. T-010-603 removed OpportunityPanel.ts.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLIENT_PORTAL_OPPORTUNITY_SLOT,
  CLIENT_WORKSPACE_DOSSIER_SLOT,
  hasReactExclusiveSlot,
  isReactExclusiveSlot,
} from '../src/ui/presentation/reactExclusiveSlots';
import {
  opportunitySlotPresentation,
  shouldRenderLegacyOpportunitySlot,
} from '../src/ui/presentation/opportunitySlot';

const ROOT = join(__dirname, '..');
const LEGACY_PANEL = 'src/components/OpportunityPanel.ts';
const REACT_PANEL = 'src/ui/modules/Opportunity/ReactOpportunityPanel.tsx';
const HOST = 'src/components/ClientPortal.ts';
const REACT_HOST = 'src/ui/modules/pages/ReactClientPortalPage.tsx';
const WAVE2 = 'src/ui/modules/wave2/Wave2Surface.tsx';
const READ = 'src/ui/data/canonicalReads.ts';
const SEAM = 'src/ui/commands/commandSeam.ts';
const HOOK = 'src/ui/hooks/useWave2Data.ts';
const HANDLERS = 'src/ui/legacy/handlers/clientPortalHandlers.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '');
}

describe('Phase 6 opportunity cutover — C1 served ownership', () => {
  it('OpportunityPanel is absent after T603 subset removal', () => {
    expect(existsSync(join(ROOT, LEGACY_PANEL))).toBe(false);
  });

  it('React opportunity exists and is served from portal home, opportunities tab, and Wave2', () => {
    expect(statSync(join(ROOT, REACT_PANEL)).isFile()).toBe(true);
    const portal = code(REACT_HOST);
    expect(portal).toMatch(/tab === 'home'[\s\S]*<ReactOpportunityPanel/);
    expect(portal).toMatch(/tab === 'opportunities'[\s\S]*<ReactOpportunityPanel/);
    expect(code(WAVE2)).toMatch(/<ReactOpportunityPanel/);
  });

  it('ClientPortal no longer imports or renders the legacy OpportunityPanel', () => {
    const host = code(HOST);
    expect(host).not.toMatch(/from\s+['"]\.\/OpportunityPanel['"]/);
    expect(host).not.toMatch(/OpportunityPanel/);
    expect(host).not.toMatch(/renderOpportunityCard/);
    expect(host).not.toMatch(/renderOpportunitySpotlight/);
    expect(host).not.toMatch(/renderClientOpportunitiesBody/);
    expect(host).not.toMatch(/listOpportunitiesForClient/);
    expect(shouldRenderLegacyOpportunitySlot()).toBe(false);
    expect(opportunitySlotPresentation()).toBe('omit');
  });

  it('exclusive opportunity ownership is active independently of the dossier slot id', () => {
    expect(hasReactExclusiveSlot()).toBe(true);
    expect(isReactExclusiveSlot(CLIENT_PORTAL_OPPORTUNITY_SLOT)).toBe(true);
    expect(CLIENT_PORTAL_OPPORTUNITY_SLOT).toBe('client-portal-opportunity');
    expect(CLIENT_PORTAL_OPPORTUNITY_SLOT).not.toBe(CLIENT_WORKSPACE_DOSSIER_SLOT);
  });
});

describe('Phase 6 opportunity cutover — C2 / C3 canonical path', () => {
  it('React read remains tenant-scoped canonical, not a new authority', () => {
    const readSource = code(READ);
    const hook = code(HOOK);
    expect(readSource).toMatch(/export function readClientOpportunityCards\(/);
    expect(readSource).toMatch(/listOpportunitiesForClient/);
    expect(hook).toMatch(/tenantQueryKey\(scope, 'canonical', 'opportunities'\)/);
    expect(code(REACT_PANEL)).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(code(REACT_PANEL)).not.toMatch(/from\s+['"][^'"]*application\//);
    expect(code(REACT_PANEL)).not.toMatch(/LocalOpportunityRepository/);
  });

  it('React actions remain canonical through the command seam', () => {
    const panel = code(REACT_PANEL);
    const seam = code(SEAM);
    const hook = code(HOOK);
    expect(panel).toMatch(/useOpportunityCommands/);
    expect(hook).toMatch(/opportunityCommands\.accept/);
    expect(hook).toMatch(/opportunityCommands\.decline/);
    expect(hook).toMatch(/opportunityCommands\.toggleChecklistItem/);
    expect(hook).toMatch(/opportunityCommands\.submit/);
    expect(seam).toMatch(/acceptClientOpportunity/);
    expect(seam).toMatch(/declineClientOpportunity/);
    expect(seam).toMatch(/toggleClientOpportunityChecklistItem/);
    expect(seam).toMatch(/submitClientOpportunity/);
  });

  it('cutover introduces no business write and keeps handlers retained', () => {
    expect(statSync(join(ROOT, HANDLERS)).isFile()).toBe(true);
    expect(code(HANDLERS)).toMatch(/acceptClientOpportunity/);
    expect(code(HANDLERS)).toMatch(/declineClientOpportunity/);
    expect(code(HANDLERS)).toMatch(/toggleClientOpportunityChecklistItem/);
    expect(code(HANDLERS)).toMatch(/submitClientOpportunity/);
    expect(code(HANDLERS)).toMatch(/\.btn-accept-opp/);
    expect(code(HANDLERS)).toMatch(/\.btn-reject-opp/);
    expect(code(HANDLERS)).toMatch(/\.input-opp-checklist/);
    expect(code(HANDLERS)).toMatch(/\.btn-submit-opportunity/);
    expect(code(HANDLERS)).not.toMatch(/OpportunityPanel/);
    expect(code(REACT_PANEL)).not.toMatch(/dbService\.(save|update|create|add|remove|delete)/);
    expect(code(HOST)).not.toMatch(/dbService\.(save|update|create|add|remove|delete)/);
  });
});

describe('Phase 6 opportunity cutover — C4 / C5 / duplicate surface', () => {
  it('presentation modules add no Application, Domain, or tenant authority', () => {
    for (const file of [
      'src/ui/presentation/opportunitySlot.ts',
      'src/ui/presentation/reactExclusiveSlots.ts',
      REACT_PANEL,
    ]) {
      const source = code(file);
      expect(source).not.toMatch(/from\s+['"][^'"]*application\//);
      expect(source).not.toMatch(/from\s+['"][^'"]*domain\//);
      expect(source).not.toMatch(/requireTenantScope/);
      expect(source).not.toMatch(/requireAdminActor/);
      expect(source).not.toMatch(/from\s+['"][^'"]*infrastructure\//);
    }
  });

  it('React opportunity uses session tenant scope rather than a DOM or caller tenant', () => {
    const panel = code(REACT_PANEL);
    expect(panel).toMatch(/useSession\(\)/);
    expect(panel).toMatch(/tenantScope/);
    expect(panel).not.toMatch(/data-tenant/);
  });

  it('legacy host does not nest React opportunity and React host does not import OpportunityPanel', () => {
    expect(code(HOST)).not.toMatch(/ReactOpportunityPanel/);
    expect(code(REACT_HOST)).not.toMatch(/from\s+['"][^'"]*\/OpportunityPanel['"]/);
    expect(code(REACT_HOST)).not.toMatch(/renderOpportunityCard/);
    expect(code(HOST)).not.toMatch(/createRoot/);
  });

  it('product runtime no longer imports OpportunityPanel', () => {
    expect(code(HOST)).not.toMatch(/import\s*\(\s*['"][^'"]*OpportunityPanel['"]/);
    expect(code('src/main.ts')).not.toMatch(/OpportunityPanel/);
    expect(code(HANDLERS)).not.toMatch(/from\s+['"][^'"]*OpportunityPanel['"]/);
  });
});
