/**
 * SPEC-010 Phase 2 — wave-2 architecture and migratability tests (T-010-206).
 *
 * Scope: the wave-2 React components under `src/ui/modules/**`, the read facades
 * and the command seam. The Phase-1 suite still guards the layer as a whole;
 * this suite adds the properties that only become assertable once components
 * carry real reads and real commands.
 *
 * The central Phase-2 property is the migratability screen: a legacy business
 * write with no canonical Application use case must not appear behind a React
 * button (AUDIT010-09). That is enforced mechanically here, not by review.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..');
const UI_ROOT = join(ROOT, 'src/ui');
const MODULES_ROOT = join(UI_ROOT, 'modules');

const COMPATIBILITY_FACADE = 'src/ui/data/compatibilityReads.ts';
const CANONICAL_FACADE = 'src/ui/data/canonicalReads.ts';
const COMMAND_SEAM = 'src/ui/commands/commandSeam.ts';

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const UI_FILES = collectFiles(UI_ROOT);
const MODULE_FILES = collectFiles(MODULES_ROOT);
const HOOK_FILES = collectFiles(join(UI_ROOT, 'hooks'));

const rel = (file: string) => relative(ROOT, file).replace(/\\/g, '/');

/** T-010-404 legacy presentation modules under src/ui/legacy are not React UI. */
function isReactUiFile(file: string): boolean {
  const r = rel(file);
  if (r.startsWith('src/ui/legacy/handlers/')) return false;
  if (r === 'src/ui/legacy/LegacyApp.ts') return false;
  if (r === 'src/ui/legacy/teleprompterController.ts') return false;
  if (r === 'src/ui/legacy/legacyAppHost.ts') return false;
  return true;
}

const REACT_UI_FILES = UI_FILES.filter(isReactUiFile);
const read = (file: string) => readFileSync(file, 'utf8');

/** Code with comments stripped: a boundary violation is a property of code, not prose. */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The wave-2 components this phase claims to have migrated. */
const WAVE2_COMPONENTS = [
  'src/ui/modules/PageHeader/ReactPageHeader.tsx',
  'src/ui/modules/ClaimSafety/ReactClaimSafetyPanel.tsx',
  'src/ui/modules/MasterDossier/ReactMasterDossierPanel.tsx',
  'src/ui/modules/Opportunity/ReactOpportunityPanel.tsx',
  'src/ui/modules/Kpi/ReactKpiWeeklyChart.tsx',
  'src/ui/modules/ClientProfile/ReactClientProfilePanel.tsx',
  'src/ui/modules/ProofWall/ReactProofWallPanel.tsx',
  'src/ui/modules/SourceRegistry/ReactSourceRegistryPanel.tsx',
  'src/ui/modules/Onboarding/ReactOnboardingWizard.tsx',
];

describe('T-010-201…205 — the claimed wave-2 components exist', () => {
  it('every claimed component file is present', () => {
    const present = WAVE2_COMPONENTS.filter((path) => {
      try {
        return statSync(join(ROOT, path)).isFile();
      } catch {
        return false;
      }
    });
    expect(present).toEqual(WAVE2_COMPONENTS);
  });

  it('no legacy counterpart was deleted — Phase 2 is extraction, not removal', () => {
    const legacy = [
      'src/components/PageHeader.ts',
      'src/components/ClaimSafetyPanel.ts',
      'src/components/MasterDossierPanel.ts',
      'src/components/OpportunityPanel.ts',
      'src/components/KpiWeeklyChart.ts',
      'src/components/ClientProfilePanel.ts',
      'src/components/ProofWallPanel.ts',
      'src/components/SourceRegistryModal.ts',
      'src/components/OnboardingWizard.ts',
    ];
    for (const path of legacy) {
      expect(statSync(join(ROOT, path)).isFile()).toBe(true);
    }
  });
});

describe('T-010-01 / A8 — no wave-2 component reaches dbService', () => {
  it('no component or hook imports dbService', () => {
    const offenders = [...MODULE_FILES, ...HOOK_FILES]
      .filter((file) => /from\s+['"][^'"]*services\/db['"]/.test(code(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('the compatibility facade remains the only dbService importer in src/ui', () => {
    const importers = REACT_UI_FILES.filter((file) =>
      /from\s+['"][^'"]*services\/db['"]/.test(code(file))
    ).map(rel);
    expect(importers).toEqual([COMPATIBILITY_FACADE]);
  });
});

describe('AUDIT010-09 / §7 — no legacy business write is wrapped in React', () => {
  /**
   * Mutators discovered by the Phase-2 command screen. Each is a legacy business
   * write with no canonical Application use case, so none may appear anywhere in
   * the React layer — not in a component, not in a hook, and not in the read
   * facade, which is read-only by contract.
   */
  const BLOCKED_MUTATORS = [
    'markInvitationAccepted',
    'updateClient',
    // addProfileFact / confirmProfileFact / rejectProfileFact / updateProfileFact
    // are canonical CR-1 Master Profile (seam → consumer). Still forbidden:
    // dbService.* of those names and the legacy CV symbol below.
    'importCandidateFactsFromCv',
    'updateProofWallItem',
    'addSource',
    // applyOnboardingStep is canonical CR-1 Master Profile (seam → consumer).
    // Still forbidden: direct dbService.applyOnboardingStep (fail-closed deprecated).
    'updateTaskStatus',
  ];

  it('no blocked mutator is called anywhere in the React layer', () => {
    const offenders: string[] = [];
    for (const file of REACT_UI_FILES) {
      const source = code(file);
      for (const mutator of BLOCKED_MUTATORS) {
        if (new RegExp(`\\b${mutator}\\s*\\(`).test(source)) {
          offenders.push(`${rel(file)} → ${mutator}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the compatibility facade exposes no mutator', () => {
    const source = code(join(ROOT, COMPATIBILITY_FACADE));
    // Every exported function in the facade is a `read*` projection.
    const exported = [...source.matchAll(/export function (\w+)/g)].map((m) => m[1]);
    expect(exported.length).toBeGreaterThan(0);
    expect(exported.filter((name) => !name.startsWith('read'))).toEqual([]);
  });

  it('the command seam documents the blocked class and its registry', () => {
    const source = read(join(ROOT, COMMAND_SEAM));
    expect(source).toContain('AUDIT010-09');
    expect(source).toContain('audit010-09-registry.md');
  });
});

describe('§12 — every wave-2 command goes through the command seam', () => {
  it('no component imports a consumer or service command directly', () => {
    const offenders = MODULE_FILES.filter((file) => {
      const source = code(file);
      return /from\s+['"][^'"]*services\/(opportunityScoutConsumer|learningLoopConsumer|dossierExport|audit)['"]/.test(
        source
      );
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the seam delegates only to canonical consumers or presentation services', () => {
    const source = code(join(ROOT, COMMAND_SEAM));
    expect(source).toMatch(/services\/opportunityScoutConsumer/);
    expect(source).toMatch(/services\/learningLoopConsumer/);
    // No legacy persistence of any kind reaches the seam.
    expect(source).not.toMatch(/services\/db['"]/);
    expect(source).not.toMatch(/\bLocal\w*Store\b/);
  });
});

describe('T-010-02…04 — no store, Firestore or provider access in wave 2', () => {
  it('no component or hook imports a canonical store, Firestore or an AI provider', () => {
    const forbidden = [
      /from\s+['"][^'"]*Local\w*Store['"]/,
      /from\s+['"]firebase\/firestore['"]/,
      /from\s+['"][^'"]*infrastructure\//,
      /from\s+['"][^'"]*(openai|anthropic|gemini)/i,
      /api\.(openai|anthropic)\.com/i,
    ];
    const offenders: string[] = [];
    for (const file of [...MODULE_FILES, ...HOOK_FILES]) {
      const source = code(file);
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('T-010-08 / A19 — tenant-safe query keys for every wave-2 read', () => {
  const wave2Hooks = join(UI_ROOT, 'hooks/useWave2Data.ts');

  it('every query key is built by the tenant-safe factory', () => {
    const source = code(wave2Hooks);
    const keyLines = source
      .split('\n')
      .filter((line) => line.includes('queryKey:'))
      .map((line) => line.trim());

    expect(keyLines.length).toBeGreaterThan(0);
    for (const line of keyLines) {
      // A tenant-scoped read key, a tenant-scoped invalidation key, or the
      // explicit disabled sentinel. Nothing else may name a cache entry.
      expect(/tenantQueryKey\(|tenantInvalidationKey\(|DISABLED/.test(line)).toBe(true);
    }
  });

  it('no hook builds a bare key from an entity id', () => {
    const source = code(wave2Hooks);
    expect(source).not.toMatch(/queryKey:\s*\[\s*['"]/);
  });

  it('every hook is disabled without a trusted scope', () => {
    const source = code(wave2Hooks);
    const queryBlocks = source.split('useQuery({').slice(1);
    expect(queryBlocks.length).toBeGreaterThan(0);
    for (const block of queryBlocks) {
      expect(block).toMatch(/enabled:\s*scope !== null/);
    }
  });

  it('the tenant scope cannot be built from UI input', () => {
    const source = code(join(UI_ROOT, 'query/tenantScope.ts'));
    // The only constructor takes the trusted User; nothing accepts a raw pair.
    expect(source).toMatch(/buildTrustedTenantScope\(user: User\)/);
  });
});

describe('T-010-09…11 — no wave-2 code manufactures identity or role', () => {
  it('no component or hook assigns an organizationId, clientId, actor or role literal', () => {
    const forbidden = [
      /organizationId\s*[:=]\s*['"]/,
      /clientId\s*[:=]\s*['"]/,
      /actorType\s*[:=]/,
      // A role passed as data. The JSX `role="alert"` attribute is an ARIA
      // landmark, not an authority claim, so it is matched separately below by
      // privilege value rather than by the bare attribute name.
      /\brole\s*:\s*['"]/,
      /\brole\s*=\s*['"](admin|manager|owner|superadmin|client)['"]/i,
      /isAdmin\s*=\s*true/,
    ];
    const offenders: string[] = [];
    for (const file of [...MODULE_FILES, ...HOOK_FILES]) {
      const source = code(file);
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the seam passes trusted scope values as the claimed identity, never literals', () => {
    const source = code(join(ROOT, COMMAND_SEAM));
    expect(source).toContain('claimedOrganizationId: scope.organizationId');
    expect(source).not.toMatch(/claimedOrganizationId:\s*['"]/);
    expect(source).not.toMatch(/actorType:/);
  });
});

describe('T-010-07 / §25 — commands pass ids, never cached aggregates', () => {
  it('command seam signatures accept ids and notes only', () => {
    const source = code(join(ROOT, COMMAND_SEAM));
    // No projection or aggregate type crosses into a command argument.
    expect(source).not.toMatch(/OpportunityCardView/);
    expect(source).not.toMatch(/forgedOpportunity/);
    expect(source).not.toMatch(/forgedStatus/);
  });

  it('mutations invalidate rather than patch the cache', () => {
    const source = code(join(UI_ROOT, 'hooks/useWave2Data.ts'));
    expect(source).toContain('invalidateQueries');
    expect(source).not.toContain('setQueryData');
  });
});

describe('T-010-14 / T-010-19 — no lifecycle or business authority in components', () => {
  it('no component assigns a canonical lifecycle status', () => {
    const forbidden =
      /(status|verdict)\s*[:=]\s*['"](APPROVED|APPLIED|PUBLISHED|COMPLETED|SUBMITTED|ACCEPTED|DECLINED|VERIFIED|BLOCK)['"]/;
    const offenders = MODULE_FILES.filter((file) => forbidden.test(code(file))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no component recreates a strategic calculation', () => {
    const forbidden = [
      /\bcomputeStrategicScore\b/,
      /\bstrategicScore\s*=/,
      /\bcomputeProfileCoverage\b/,
      /\baggregateWeeklyKpis\b/,
      /\bisCleOpportunity\b/,
      /\bdaysUntilDeadline\b/,
    ];
    const offenders: string[] = [];
    for (const file of MODULE_FILES) {
      const source = code(file);
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('derived opportunity flags come from the canonical facade', () => {
    const source = code(join(ROOT, CANONICAL_FACADE));
    expect(source).toContain('opportunityStatusDisplayLabel');
    expect(source).toContain('isCleOpportunity');
    expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
  });
});

describe('T-010-15 / §23 — multi-thesis and no primary-item authority', () => {
  it('no component treats a first element as authoritative', () => {
    const forbidden = [
      /theses\[0\]/,
      /primaryThesisId/,
      /approvedBriefs\[0\]/,
      /\.sort\([^)]*\)\[0\]/,
    ];
    const offenders: string[] = [];
    for (const file of MODULE_FILES) {
      const source = code(file);
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${rel(file)} → ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the display-only spotlight is labelled as such and commands nothing extra', () => {
    const source = read(join(ROOT, 'src/ui/modules/Opportunity/ReactOpportunityPanel.tsx'));
    expect(source).toContain('DISPLAY_ONLY');
    // The spotlight reuses the same card, so it cannot acquire its own authority.
    expect(source).toMatch(/ReactOpportunitySpotlight[\s\S]*OpportunityCard/);
  });
});

describe('§13 / §14 — blocked actions are delegated, not silently dropped', () => {
  const delegating = [
    'src/ui/modules/ProofWall/ReactProofWallPanel.tsx',
    'src/ui/modules/SourceRegistry/ReactSourceRegistryPanel.tsx',
  ];

  it('each remaining read-only component tells the user where the action still lives', () => {
    for (const path of delegating) {
      const source = read(join(ROOT, path));
      expect(source).toContain('interfaz anterior');
      expect(source).toContain('applyUiMode');
    }
  });

  it('each remaining read-only component records its restricted authority', () => {
    for (const path of delegating) {
      const source = read(join(ROOT, path));
      expect(/data-authority="(READ_ONLY|DISPLAY_ONLY)"/.test(source)).toBe(true);
    }
  });

  it('profile panel retains rollback without exclusive display-only delegation', () => {
    const source = read(join(ROOT, 'src/ui/modules/ClientProfile/ReactClientProfilePanel.tsx'));
    expect(source).toContain('applyUiMode');
    expect(source).toContain('interfaz anterior');
    expect(source).toContain('data-authority="PRESENTATION"');
    expect(source).not.toContain('data-authority="DISPLAY_ONLY"');
  });

});

/*
  T-010-205 / P6 — onboarding presentation writes only through the frozen
  ApplyOnboardingStep seam (via useApplyOnboardingStep). Schemas stay shape-only.
  Legacy wizard remains for postura_ui_mode=legacy rollback.
*/
describe('T-010-205 / A13 / A18 / P6 — onboarding write via frozen seam', () => {
  const wizard = 'src/ui/modules/Onboarding/ReactOnboardingWizard.tsx';
  const schemas = 'src/ui/modules/Onboarding/onboardingStepSchemas.ts';

  it('the React onboarding presentation exists and the legacy wizard is retained', () => {
    expect(statSync(join(ROOT, wizard)).isFile()).toBe(true);
    expect(statSync(join(ROOT, 'src/components/OnboardingWizard.ts')).isFile()).toBe(true);
  });

  it('writes via useApplyOnboardingStep only — no direct consumer or dbService', () => {
    const source = code(join(ROOT, wizard));
    expect(source).toMatch(/useApplyOnboardingStep/);
    expect(source).not.toMatch(/from\s+['"][^'"]*masterProfileConsumer['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*commands\/commandSeam['"]/);
  });

  it('its read path remains the declared compatibility read', () => {
    const source = code(join(ROOT, wizard));
    expect(source).toContain('useOnboardingContext');
    expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
  });

  it('save control is enabled for canonical #10 parity', () => {
    const source = read(join(ROOT, wizard));
    expect(source).toContain('react-onboarding-save');
    expect(source).not.toContain('react-onboarding-save-disabled');
    expect(source).toContain('data-authority="PRESENTATION"');
  });

  it('the Zod schemas validate input shape only — no business or identity field', () => {
    const source = code(join(ROOT, schemas));
    // Word-bounded on purpose: `currentRole` is a profile text field, not a privilege.
    expect(source).not.toMatch(
      /\borganizationId\b|\bclientId\b|\bactor\b|\brole\b|\bstatus\b|\bverdict\b|\bapproved\b/i
    );
    expect(source).not.toMatch(/computeProfileCoverage|meetsPilotThreshold|>=\s*20/);
  });

  it('the suggested step comes from the domain, not from React', () => {
    expect(code(join(ROOT, wizard))).toContain('suggestedStep');
    expect(code(join(ROOT, 'src/ui/data/compatibilityReads.ts'))).toContain(
      'nextIncompleteOnboardingStep'
    );
  });
});

describe('§16 / §20 — DOM ownership and no main.ts big bang', () => {
  it('wave 2 adds no DOM root outside #react-root', () => {
    const offenders = MODULE_FILES.filter((file) =>
      /getElementById\(|createRoot\(|document\.body/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the wave-2 surface renders inside the existing React shell', () => {
    const source = read(join(ROOT, 'src/ui/modules/wave2/Wave2Surface.tsx'));
    expect(source).toContain('NOT a page migration');
  });

  it('main.ts still owns #app only and did not grow in Phase 2', () => {
    const main = read(join(ROOT, 'src/main.ts'));
    expect(main.split('\n').length).toBeLessThanOrEqual(5139);
    expect(main).toContain('initReactStrangler');
  });
});

describe('SPEC-010 Phase 6 — PageHeader shared presentation refactor', () => {
  const SHARED_META = 'src/ui/presentation/pageTabMeta.ts';
  const LEGACY_RENDERER = 'src/components/PageHeader.ts';
  const REACT_HEADER = 'src/ui/modules/PageHeader/ReactPageHeader.tsx';

  const sharedConsumers = [
    'src/ui/modules/PageHeader/ReactPageHeader.tsx',
    'src/components/AppShell.ts',
    'src/ui/legacy/LegacyApp.ts',
    'src/controllers/navigationController.ts',
    'src/controllers/sourceAutomationScheduler.ts',
    'src/components/ClientWorkspace.ts',
  ];

  it('the shared presentation module exists and the legacy renderer remains', () => {
    expect(statSync(join(ROOT, SHARED_META)).isFile()).toBe(true);
    expect(statSync(join(ROOT, LEGACY_RENDERER)).isFile()).toBe(true);
  });

  it('ReactPageHeader imports tab metadata from the shared module only', () => {
    const source = read(join(ROOT, REACT_HEADER));
    expect(source).toContain("from '../../presentation/pageTabMeta'");
    expect(source).not.toMatch(/from\s+['"][^'"]*components\/PageHeader['"]/);
  });

  it('shared navigation consumers import metadata from the shared module', () => {
    for (const path of sharedConsumers) {
      const source = read(join(ROOT, path));
      expect(source).toMatch(/from\s+['"][^'"]*presentation\/pageTabMeta['"]/);
    }
  });

  it('legacy renderPage consumers may still import the legacy renderer', () => {
    for (const path of [
      'src/components/ClientPortal.ts',
      'src/components/ManagerCockpit.ts',
      'src/components/ClientWorkspace.ts',
    ]) {
      const source = read(join(ROOT, path));
      expect(source).toMatch(/from\s+['"]\.\/PageHeader['"]/);
    }
  });

  it('the shared module carries no business authority imports', () => {
    const source = code(join(ROOT, SHARED_META));
    expect(source).not.toMatch(/from\s+['"][^'"]*services\/db['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*services\//);
    expect(source).not.toMatch(/dbService/);
  });
});
