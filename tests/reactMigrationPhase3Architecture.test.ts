/**
 * SPEC-010 Phase 3 — wave-3 page architecture and migratability tests (T-010-306).
 *
 * Scope: the migrated pages under `src/ui/modules/pages/**`, the wave-3 read
 * seams and the wave-3 commands. The Phase-1 and Phase-2 suites still guard the
 * layer as a whole; this suite adds the properties that only become assertable
 * once whole pages — with tabs, panels and dozens of legacy actions behind them —
 * exist in React.
 *
 * The central Phase-3 property is unchanged from Phase 2 and is enforced
 * mechanically here: a legacy business write with no canonical Application use
 * case must not appear behind a React control (AUDIT010-09). Phase 3 raises the
 * stakes because the pages it migrates hold the large majority of those writes.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..');
const UI_ROOT = join(ROOT, 'src/ui');
const PAGES_ROOT = join(UI_ROOT, 'modules/pages');

const COMPATIBILITY_FACADE = 'src/ui/data/compatibilityReads.ts';

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
const PAGE_FILES = collectFiles(PAGES_ROOT);

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

/** The wave-3 pages this phase claims to have migrated. */
const WAVE3_PAGES = [
  'src/ui/modules/pages/ReactThesisEditorPage.tsx',
  'src/ui/modules/pages/modals/ReactModals.tsx',
  'src/ui/modules/pages/ReactManagerCockpitPage.tsx',
  'src/ui/modules/pages/ReactClientPortalPage.tsx',
  'src/ui/modules/pages/ReactClientWorkspacePage.tsx',
];

describe('T-010-301…305 — the claimed wave-3 pages exist', () => {
  it('every claimed page file is present', () => {
    const present = WAVE3_PAGES.filter((path) => {
      try {
        return statSync(join(ROOT, path)).isFile();
      } catch {
        return false;
      }
    });
    expect(present).toEqual(WAVE3_PAGES);
  });

  it('no legacy page was deleted — Phase 3 is migration, not removal (§32)', () => {
    const legacy = [
      'src/components/ThesisEditorModal.ts',
      'src/components/Modals.ts',
      'src/components/ManagerCockpit.ts',
      'src/components/ClientPortal.ts',
      'src/components/ClientWorkspace.ts',
    ];
    for (const path of legacy) {
      expect(statSync(join(ROOT, path)).isFile()).toBe(true);
    }
  });
});

describe('T-010-01 / A8 — no wave-3 page reaches dbService', () => {
  it('no page imports dbService', () => {
    const offenders = PAGE_FILES.filter((file) =>
      /from\s+['"][^'"]*services\/db['"]/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the compatibility facade remains the only dbService importer in src/ui', () => {
    const importers = REACT_UI_FILES.filter((file) =>
      /from\s+['"][^'"]*services\/db['"]/.test(code(file))
    ).map(rel);
    expect(importers).toEqual([COMPATIBILITY_FACADE]);
  });

  it('no page imports a Local*Store, Firestore, or an AI provider', () => {
    // Matched against import specifiers only: a projection field named
    // `openaiOutput` is data the page displays, not a provider call.
    const banned = [
      /from\s+['"][^'"]*Local[A-Za-z]*Store['"]/,
      /from\s+['"][^'"]*firebase\/firestore['"]/,
      /from\s+['"][^'"]*services\/ai['"]/,
      /from\s+['"](openai|@anthropic-ai\/[^'"]*|@google\/generative-ai)['"]/,
    ];
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('AUDIT010-09 / §6 — no blocked legacy write appears behind a React page control', () => {
  /**
   * Business writes found by the Phase-3 page screen across the five legacy
   * pages. Every one completes with a direct `dbService` mutation and has no
   * canonical Application use case, so none may appear anywhere in the React
   * layer — not in a page, not in a hook, and not in the read facade, which is
   * read-only by contract.
   */
  const BLOCKED_MUTATORS = [
    // thesis lifecycle — saveThesis is CR-1 Thesis Lifecycle canonical (seam → consumer)
    // curation and delivery — decideCuration is CR-1 Execution Delivery canonical (P10)
    // removeCuration / reopenCuration are CR-1 #16 canonical via the execution-delivery seam
    'decideSignal',
    'setCurationAngle',
    'addToCuration',
    // ensureDraftDelivery / discardDraftDelivery — CR-1 #17 canonical via P13 seam
    'addDeliveryItem',
    'attachCurationToDelivery',
    'removeDeliveryItem',
    'updateDelivery',
    'acknowledgeDelivery',
    // sources and ingestion — addSource/addSignal are CR-1 Signal Intake
    // canonical via seam → consumer (registerSource / registerManualSignal).
    // Legacy symbols must not appear as direct React writes.
    'updateSourceStatus',
    'recordSourceRun',
    'toggleTopicPin',
    // tasks — updateTaskStatus/updateTaskEvidence are CR-1 Execution Delivery
    // canonical via seam → consumer (transitionClientTask).
    'addTask',
    // evidence and content — saveContent / saveClientArticleRevision canonical via
    // saveContentDraft / reviewClientArticle
    'addEvidenceItem',
    'toggleEvidenceThesis',
    'transitionContentPipeline',
    'addFeedbackEvent',
    'updateRecommendationStatus',
    'addRecommendation',
    // tenancy and identity
    'createClient',
    'createInvitation',
    'createPendingAccount',
    'impersonateClient',
  ];

  it('no blocked mutator is referenced anywhere in the React layer', () => {
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

  it('the compatibility facade still exposes no mutator', () => {
    const source = code(join(ROOT, COMPATIBILITY_FACADE));
    const exported = [...source.matchAll(/export\s+function\s+(\w+)/g)].map((match) => match[1]);
    const mutators = exported.filter((name) => !/^read/.test(name));
    expect(mutators).toEqual([]);
  });

  it('every blocked page action is delegated visibly rather than removed (§7)', () => {
    // Each migrated page keeps some action on the legacy surface, and each must
    // say so: a blocked action that is simply absent would be capability loss.
    const pagesWithBlockedActions = [
      'src/ui/modules/pages/ReactThesisEditorPage.tsx',
      'src/ui/modules/pages/ReactManagerCockpitPage.tsx',
      'src/ui/modules/pages/ReactClientPortalPage.tsx',
      'src/ui/modules/pages/ReactClientWorkspacePage.tsx',
      'src/ui/modules/pages/modals/ReactModals.tsx',
    ];
    for (const path of pagesWithBlockedActions) {
      expect(read(join(ROOT, path))).toMatch(/LegacyHandoff/);
    }
  });
});

describe('§10 / A26 — every wave-3 command goes through the command seam', () => {
  it('pages import commands only from the seam or a hook, never a consumer directly', () => {
    const offenders = PAGE_FILES.filter((file) =>
      /from\s+['"][^'"]*services\/\w*Consumer['"]/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the seam exposes exactly the wave-3 canonical commands it claims', () => {
    const source = code(join(ROOT, 'src/ui/commands/commandSeam.ts'));
    expect(source).toMatch(/signalOutcomeCommands/);
    expect(source).toMatch(/registerSignalOutcomeIntent/);
    expect(source).toMatch(/briefCommands/);
    expect(source).toMatch(/approveStrategicBrief/);
  });

  it('brief creation from curation is exposed via presentation composite (P12 CR-2)', () => {
    const source = code(join(ROOT, 'src/ui/commands/commandSeam.ts'));
    expect(source).toMatch(/createFromCuration/);
    expect(source).toMatch(/runBriefCreateFromCurationPresentation/);
    expect(source).not.toMatch(/createBriefFromCurationEntry/);
  });

  it('delivery assembly #17 is exposed via presentation composite (P13 B4)', () => {
    const source = code(join(ROOT, 'src/ui/commands/commandSeam.ts'));
    expect(source).toMatch(/runEnsureDraftDeliveryPresentation/);
    expect(source).toMatch(/runAddCurationToDeliveryPresentation/);
    expect(source).toMatch(/ensureDraftDelivery\(intent/);
    expect(source).not.toMatch(/\bdbService\b/);
  });
});

describe('§11 / A23 — no wave-3 page holds business authority', () => {
  it('no page computes a score, a verdict or a lifecycle transition', () => {
    // Assignments only. Comparing against a canonical status in order to decide
    // what to render is presentation; producing one is authority.
    const banned = [
      /function\s+\w*[Ss]core\w*\s*\(/,
      /\bweight\s*\*/,
      /[^!=<>]=\s*['"](APPROVED|PUBLISHED|COMPLETED|APPLIED)['"]/,
      /status\s*:\s*['"](APPROVED|PUBLISHED|COMPLETED|APPLIED)['"]/,
    ];
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('no page manufactures an organizationId, clientId, actor or privileged role', () => {
    const banned = [
      /organizationId\s*[:=]\s*['"]/,
      /clientId\s*[:=]\s*['"][^'"]+['"]/,
      /actorUid\s*[:=]\s*['"]/,
      /actorType\s*[:=]\s*['"]/,
      /\brole\s*[:=]\s*['"](ADMIN|MANAGER|CLIENT)['"]/,
    ];
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('every page derives identity from the trusted session projection', () => {
    for (const file of PAGE_FILES) {
      const source = code(file);
      // A page that reads tenant-scoped data must obtain the scope from the session.
      if (/useWave3Data|useWave2Data/.test(source)) {
        expect(source, rel(file)).toMatch(/useSession|tenantScope/);
      }
    }
  });
});

describe('T-010-15, T-010-16 / A20, A21 — no primary or first-thesis authority', () => {
  it('no page selects a thesis, campaign or brief by position', () => {
    const banned = [
      /theses\s*\[\s*0\s*\]/,
      /campaigns\s*\[\s*0\s*\]/,
      /approvedBriefs\s*\[\s*0\s*\]/,
      /awaiting\s*\[\s*0\s*\]/,
      /primaryThesisId/,
      /getPrimaryThesis/,
      /\.sort\([^)]*\)\s*\[\s*0\s*\]/,
    ];
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('the wave-3 read facade takes an explicit thesis id and never falls back', () => {
    const source = code(join(ROOT, COMPATIBILITY_FACADE));
    expect(source).toMatch(/readThesisDetail/);
    // The unresolved marker exists, which is what makes "no fallback" observable.
    expect(source).toMatch(/UNRESOLVED_THESIS/);
    expect(source).not.toMatch(/theses\s*\[\s*0\s*\]/);
  });

  it('the thesis selector and the brief selector both start unselected', () => {
    const editor = code(join(ROOT, 'src/ui/modules/pages/ReactThesisEditorPage.tsx'));
    expect(editor).toMatch(/useState<string \| null>\(null\)/);
    const modals = code(join(ROOT, 'src/ui/modules/pages/modals/ReactModals.tsx'));
    expect(modals).toMatch(/useState<string>\(''\)/);
  });
});

describe('§20 — EFFECT_FIRST legacy paths are not migrated', () => {
  it('no React module runs the source-discovery agent', () => {
    const banned = [
      /runSourceDiscoveryAgent/,
      /runResearchSignalsAgent/,
      /runTopicAgent/,
      /discoverExtendedSources/,
      /enrichYoutubeDiscoverySources/,
      /pollSources/,
    ];
    const offenders: string[] = [];
    for (const file of REACT_UI_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('no React module probes the AI gateway during render', () => {
    const offenders = REACT_UI_FILES.filter((file) =>
      /isServerGatewayAvailable/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('§17 / A38 — DOM ownership stays exclusive', () => {
  it('no page touches document, window or an element id outside React', () => {
    const banned = [
      /document\.(getElementById|querySelector|createElement|body)/,
      /window\.(location|confirm|prompt)/,
      /innerHTML/,
      /dangerouslySetInnerHTML/,
    ];
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      const source = code(file);
      if (banned.some((pattern) => pattern.test(source))) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('a tab owned by a wave-3 page does not also render its wave-2 group', () => {
    const shell = code(join(ROOT, 'src/ui/modules/AppShell/ReactAppShell.tsx'));
    expect(shell).toMatch(/wave3Owns/);
    expect(shell).toMatch(/wave3Owns \? undefined : WAVE2_BY_TAB\[activeTab\]/);
  });

  it('the handoff element states unavailability without a previous-interface action (Option E)', () => {
    const handoff = code(join(ROOT, 'src/ui/modules/pages/LegacyHandoff.tsx'));
    expect(handoff).toMatch(/export function LegacyHandoff/);
    expect(handoff).toMatch(/data-legacy-handoff="true"/);
    expect(handoff).toMatch(/todavía no está disponible en esta interfaz/);
    expect(handoff).not.toMatch(/applyUiMode/);
    expect(handoff).not.toMatch(/interfaz anterior/);
    expect(handoff).not.toMatch(/<button/);
  });
});

describe('§18 — the Phase-1 routing decision is unchanged', () => {
  it('no routing library was introduced', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const banned of [
      'react-router',
      'react-router-dom',
      '@tanstack/react-router',
      'wouter',
      'next',
      '@remix-run/react',
    ]) {
      expect(all[banned]).toBeUndefined();
    }
  });

  it('no page reads or writes the URL', () => {
    const offenders = PAGE_FILES.filter((file) =>
      /history\.(push|replace)State|location\.(href|pathname|search|hash)/.test(code(file))
    ).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('§23 — frozen SPEC implementations are untouched by the React layer', () => {
  it('no React module imports a domain or application module in order to write', () => {
    // Reading a domain calculator is required and correct; calling an
    // Application use case directly from a component is not — that is the seam's job.
    const offenders: string[] = [];
    for (const file of PAGE_FILES) {
      const source = code(file);
      if (/from\s+['"][^'"]*application\//.test(source)) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('§19 — main.ts is not rewritten in Phase 3', () => {
  // The Phase-3 guarantee was that page migration did not touch the controller,
  // and the Phase-3 commit proves it: main.ts was byte-identical at 5,138 lines.
  // Phase 4 (T-010-401…405) is the phase that owns this file, so a fixed line
  // count is no longer the right assertion here — it would just forbid the next
  // phase from doing its job. What still belongs to Phase 3 is that no wave-3
  // page is wired into the legacy controller, which is asserted below and in
  // the Phase-4 suite for the extraction itself.

  it('main.ts does not import a wave-3 page — the seam is unchanged', () => {
    const source = code(join(ROOT, 'src/ui/legacy/LegacyApp.ts'));
    expect(source).not.toMatch(/modules\/pages/);
  });
});
