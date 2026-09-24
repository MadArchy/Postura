# Tasks 010 — React migration

**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`

Phases derive from the constitutional §24 seven-step migration order, **not** from another SPEC's
structure. Each phase maps to one §24 step (see `ui-architecture.md` § *Phase ↔ §24 step mapping*).

**Authorized now:** Phase 0 only. **Phase 1+ requires human T-010-010.**

---

## Phase 0 — Governance / architecture (AUTHORIZED · COMPLETE except human gate)

| ID | Title | Class | Depends on | Outputs | Acceptance | Threats | Status |
|----|-------|-------|-----------|---------|------------|---------|--------|
| **T-010-001** | Verify SPEC-008 freeze and branch from frozen parent | TECHNICAL | SPEC-008 freeze | branch `spec/010-react-migration` @ `642ae939` | — | — | **[x] DONE** |
| **T-010-002** | Extract constitutional purpose, target stack and §24 order verbatim | TECHNICAL | T-010-001 | `spec.md`, `ui-architecture.md` | A1, A2, A4 | — | **[x] DONE** |
| **T-010-003** | Formalize strangler seam, mount/DOM/CSS ownership and big-bang prohibition | TECHNICAL | T-010-002 | `ui-architecture.md` | A3, A38 | T-010-24 | **[x] DONE** |
| **T-010-004** | Formalize UI authority model and state categories | TECHNICAL | T-010-002 | `ui-architecture.md`, `spec.md` | A6, A11, A12, A13, A14, A15 | T-010-05…07 | **[x] DONE** |
| **T-010-005** | Formalize data-access seam, read/command paths and tenant-safe query keys | TECHNICAL | T-010-004 | `data-flow.md`, `ui-architecture.md` | A8, A9, A10, A19, A36 | T-010-01…03, 08, 13 | **[x] DONE** |
| **T-010-006** | Formalize hexagonal boundaries and all SPEC-001…009 contracts | TECHNICAL | T-010-004 | `hexagonal-boundaries.md` | A22…A33 | T-010-04, 17, 20…23 | **[x] DONE** |
| **T-010-007** | Complete component migration matrix for every UI file + `main.ts` strangler plan | TECHNICAL | T-010-005 | `migration-matrix.md` | A39, A40 | T-010-25 | **[x] DONE** |
| **T-010-008** | Formalize behavioral parity model, legacy deletion gate, E2E and rollback | TECHNICAL | T-010-007 | `parity-model.md` | A5, A41, A42, A43 | T-010-26 | **[x] DONE** |
| **T-010-009** | Formalize acceptance (A1–A44), threats (T-010-01…26), deployment separation and AUDIT010 dispositions | TECHNICAL | T-010-002…008 | `acceptance.md`, `threat-model.md`, `deployment.md`, `plan.md` | all | all | **[x] DONE** |
| **T-010-010** | **Human SPEC-010 approval** | **HUMAN** | T-010-001…009 | approval record | Phase-1 gate | — | **[x] DONE** (2026-08-26 America/Bogota) |

**Phase 0 IDs:** T-010-001 … T-010-010
**Product files changed:** **0** · **Test files changed:** **0** · **Dependency files changed:** **0**

### Human SPEC-010 approval (T-010-010) — RECORDED

Provided verbatim by the human owner on **2026-08-26** (**America/Bogota**):

> «Apruebo formalmente SPEC-010 — React migration y autorizo el cierre de T-010-010 y el inicio de la Phase 1 de implementación.»

Authorized transitions performed by this approval and nothing else:
`T-010-010` TODO → **DONE** · `HUMAN SPEC-010 APPROVAL` PENDING → **APPROVED** ·
`PHASE-1 IMPLEMENTATION AUTHORIZATION` NO → **YES**.

`PHASE-2 IMPLEMENTATION AUTHORIZATION` remains **NO**. No approver identity, email, user ID,
organization, role or signature was recorded — none was supplied, and none may be invented.

**Exit:** Phase 0 **COMPLETE** · Phase 1 authorization **YES** · Phase 2 authorization **NO**

---

## Phase 1 — React shell + data-access seam (§24 steps 1, 3) — COMPLETE

| ID | Title | Class | Depends on | Outputs | Acceptance | Threats | Status |
|----|-------|-------|-----------|---------|------------|---------|--------|
| **T-010-101** | Add target-stack dependencies (React, React DOM, TanStack Query, React Hook Form, Vite React plugin) | TECHNICAL | T-010-010 | `package.json`, lockfile, Vite config | A2 | — | **[x] DONE** |
| **T-010-102** | Decide and record routing/navigation approach (constitution names none) | TECHNICAL | T-010-101 | decision record | A2 | — | **[x] DONE** |
| **T-010-103** | Decide and record React component-testing approach | TECHNICAL | T-010-101 | decision record | A41 | — | **[x] DONE** |
| **T-010-104** | Add Playwright E2E/parity harness | TECHNICAL | T-010-101 | Playwright config + first journey | A42 | T-010-26 | **[x] DONE** |
| **T-010-105** | Create React shell compatible with current services (§24 step 1) | TECHNICAL | T-010-101, T-010-102 | React shell + mount boundary | A3, A38 | T-010-24 | **[x] DONE** |
| **T-010-106** | Implement UI query boundary (query hooks + canonical consumer/query facade) | TECHNICAL | T-010-105 | query layer | A9, A11, A19 | T-010-05, 08 | **[x] DONE** |
| **T-010-107** | Implement explicit legacy compatibility read facade (labelled non-canonical) | TECHNICAL | T-010-106 | compatibility facade | A36 | T-010-13 | **[x] DONE** |
| **T-010-108** | Implement UI command boundary (command hooks → canonical use cases) | TECHNICAL | T-010-106 | command layer | A10, A35 | T-010-01…03, 12 | **[x] DONE** (session commands; see AUDIT010-09) |
| **T-010-109** | Implement trusted session projection (single auth authority) | TECHNICAL | T-010-105 | session context | A16, A17, A18, A37 | T-010-09…11, 23 | **[x] DONE** |
| **T-010-110** | Wave-1 architecture tests (boundary purity, scoped to migrated modules) | TECHNICAL | T-010-106…109 | architecture suite | A8, A26, A32, A33 | T-010-01…04 | **[x] DONE** (27/27 PASS) |
| **T-010-111** | Migrate `AppShell` and `Login` to React (wave 1) | TECHNICAL | T-010-105…110 | React shell modules | A5, A6 | T-010-24 | **[x] DONE** (coexisting behind toggle; see scope note) |

**Depends on:** T-010-010 human approval — **RECORDED**.

### Phase-1 delivered artifacts

| Area | Files |
|------|-------|
| Mount seam | `src/ui/mount.ts`, `src/ui/strangler/toggle.ts`, `src/ui/strangler/strangler.css`, `index.html` (`#react-root` sibling) |
| Shell | `src/ui/shell/AppRoot.tsx` |
| Providers | `src/ui/providers/QueryProvider.tsx`, `SessionProvider.tsx`, `ErrorBoundary.tsx` |
| Query boundary | `src/ui/query/tenantScope.ts`, `src/ui/query/queryKeys.ts`, `src/ui/hooks/useShellData.ts` |
| Read seams | `src/ui/data/canonicalReads.ts` (canonical), `src/ui/data/compatibilityReads.ts` (compatibility) |
| Command seam | `src/ui/commands/commandSeam.ts` |
| Wave-1 modules | `src/ui/modules/AppShell/ReactAppShell.tsx`, `src/ui/modules/Login/ReactLogin.tsx` |
| Tests | `tests/reactMigrationPhase1Architecture.test.ts` (27), `e2e/strangler-foundation.spec.ts` (5) |
| Toolchain | `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `.gitignore` |

### T-010-111 scope note — NO CUTOVER

The React `AppShell` and `Login` are **implemented and mountable**, not cut over. The legacy
presentation remains the default and is untouched. This is required by §24 step 7 and the parity gate:
cutover and legacy removal need parity evidence that belongs to Phases 5–6. Both implementations
coexist behind the presentation toggle, exactly as the strangler model specifies.

`ReactLogin` deliberately omits invitation acceptance — see **AUDIT010-09**.

### Decision records

**T-010-102 · ROUTING LIBRARY = NONE.** §23 names no routing library, so none was assumed. The legacy
application performs no URL routing: navigation is in-memory tab state (`activeTab`) re-rendered by the
controller, and the only URL parameter read is the `invite` token. Introducing a router in Phase 1 would
therefore add a dependency, change browser history behaviour that legacy does not implement, and create a
second navigation authority during coexistence — all without a requirement. Wave-1 React navigation uses
local presentation state, matching legacy behaviour exactly. Revisit in Phase 3, when page-level migration
may justify real URL routing; a router must then be introduced as its own formally justified decision.

**T-010-103 · REACT COMPONENT-TESTING LIBRARY = DEFERRED (none installed).** §23 names Vitest and
Playwright only. Wave-1 foundation properties are boundary and ownership properties, proven statically by
27 architecture assertions and behaviourally by 5 Playwright tests; a DOM-rendering unit library would add
`jsdom` plus a testing library without proving anything those two do not already cover. Revisit in Phase 2,
when leaf components with real interaction logic migrate. Existing Vitest suites remain unchanged
(`environment: 'node'`).

**Version policy.** Repository convention (caret ranges) followed; no exact pinning introduced and no
unrelated dependency upgraded. Vite deliberately stays at `^6.2.0`: `@vitejs/plugin-react@6` requires
Vite `^8`, so plugin `^5.2.0` was selected to fit the existing Vite rather than upgrading the build
toolchain, which no task authorizes.

### Side-effect ordering audit (wave-1 scope, AUDIT010-07)

| Path | Gate | Effect | Verdict | Migrated |
|------|------|--------|---------|----------|
| Login | `authService.login` credential verification | trusted session established | **GATE_FIRST** | yes |
| Logout / return to manager | trusted runtime state transition | session cleared | **GATE_FIRST** (no business effect) | yes |
| Invitation acceptance | `authService.registerFromInvite` | `dbService.markInvitationAccepted`, `dbService.updateClient` | **GATE_FIRST** | **no** — AUDIT010-09 |

Audited: **3** · `GATE_FIRST`: **3** · `EFFECT_FIRST`: **0** · `UNKNOWN`: **0**.
Only `GATE_FIRST` paths were migrated. All other `main.ts` command paths remain unaudited and were
therefore **not** migrated; they stay owned by Phase 4 (T-010-401).

### `main.ts` measurement

| Metric | Value |
|--------|-------|
| Lines before Phase 1 | **5,132** |
| Lines after Phase 1 | **5,138** (+6) |
| Responsibilities removed | **0** |
| Responsibilities retained | all |
| Change made | one import plus a four-line bootstrap call to the mount seam |

Phase 1 adds the seam; it does not extract the controller. Extraction is Phase 4 (T-010-401…404) and no
Phase-1 task assigns it. The `+6` lines are the honest cost of installing the strangler seam, and the
purpose is strangling rather than cosmetic line reduction.

**New finding — AUDIT010-09 · P3 · `LEGACY_COMMAND_WITHOUT_CANONICAL_USE_CASE`.** Invitation acceptance
gates correctly on trusted auth, then completes with two legacy `dbService` business writes
(`markInvitationAccepted`, `updateClient`) for which no canonical Application use case exists. Routing it
through the React command seam would make the UI layer perform a legacy business mutation, violating the
command-boundary target, so the flow stays on the legacy path and `ReactLogin` omits it. This is the first
concrete instance of a general constraint: **a legacy command with no canonical use case cannot be
migrated until one exists**, and creating it is other-SPEC work outside SPEC-010's authority. Every
migration wave must screen for this class before promising a module. Not a runtime defect; ordering is
sound and no capability was lost because legacy remains served.

---

## Phase 2 — Extract leaf components (§24 step 2) — COMPLETE

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-201** | Migrate zero-`dbService` leaves — `ClaimSafetyPanel`, `PageHeader`, `MasterDossierPanel` | TECHNICAL | Phase 1 | A5, A6 | **[x] DONE** |
| **T-010-202** | Migrate `OpportunityPanel` as the canonical-read reference module | TECHNICAL | T-010-201 | A9, A28 | **[x] DONE** (canonical read **and** canonical commands) |
| **T-010-203** | Migrate `KpiWeeklyChart`, `ClientProfilePanel`, `ProofWallPanel` | TECHNICAL | T-010-202 | A5, A36 | **[x] DONE** (`KpiWeeklyChart` full; other two display/read-only — AUDIT010-09) |
| **T-010-204** | Migrate `SourceRegistryModal` | TECHNICAL | T-010-203 | A5, A20 | **[x] DONE** (read-only; both writes blocked — AUDIT010-09) |
| **T-010-205** | Migrate `OnboardingWizard` (React Hook Form + Zod) | TECHNICAL | T-010-203 | A13, A18 | **[x] DONE** (presentation + reads; the step write stays legacy — see reconciliation below) |
| **T-010-206** | Wave-2 parity evidence + tenant-safe cache tests | TECHNICAL | T-010-201…205 | A19, A41 | **[x] DONE** (52 Vitest + 5 Playwright) |

### Phase-2 command migratability screen

Every action of every candidate was classified before any component was written.
Classification of the underlying legacy command decided what could migrate.

| Component | Action | Legacy command | Class | Migrated? |
|---|---|---|---|---|
| `PageHeader` | — | — | `NO_COMMAND` | ✔ |
| `ClaimSafetyPanel` | Go to phrase | editor cursor move | `PRESENTATION_ONLY` | ✔ |
| `MasterDossierPanel` | Copy / download `.md` | `dossierExport` + audit log | `PRESENTATION_ONLY` | ✔ |
| `OpportunityPanel` | Accept · Decline · Toggle checklist · Mark sent | `acceptClientOpportunity`, `declineClientOpportunity`, `toggleClientOpportunityChecklistItem`, `submitClientOpportunity` | `CANONICAL_CONSUMER` | ✔ |
| `KpiWeeklyChart` | Register consultation (+1) | `registerResultRecordIntent` | `CANONICAL_CONSUMER` | ✔ |
| `ClientProfilePanel` | Add / confirm / reject / edit fact · extract CV facts | 5 × raw `dbService` write | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |
| `ProofWallPanel` | Mark ready / pending | `dbService.updateProofWallItem` | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |
| `SourceRegistryModal` | Register source · Ingest now | `dbService.addSource` · ingestion polling | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |
| `OnboardingWizard` | Submit step / finish (owned by `main.ts`, not by the component) | `dbService.applyOnboardingStep` | `LEGACY_WRITE_WITHOUT_CANONICAL_USE_CASE` | ✘ blocked |

Full detail, dispositions and enforcement: **`audit010-09-registry.md`**.

### T-010-205 — formal reconciliation (supersedes the first Phase-2 verdict)

The first Phase-2 pass recorded T-010-205 as `BLOCKED`, on the grounds that the
component's purpose was to submit `dbService.applyOnboardingStep`. Re-reading the
formal package showed that attribution to be wrong, and the error mattered
because it produced a self-contradicting exit gate.

**Contract classification: `B — DISPLAY_READ_ONLY_ALLOWED_WITH_LEGACY_COMMAND_RETENTION`.**

Repository evidence, not convenience:

| Source | Statement |
|--------|-----------|
| `migration-matrix.md` row 10 | `OnboardingWizard.ts` — `dbService` reads **2**, **Writes: no**, boundary `<OnboardingWizard/>` (RHF), wave **2**, disposition **MIGRATE** |
| `migration-matrix.md` totals | «**0 components performing writes**» — true of all 16 components |
| `migration-matrix.md` row 1 | `src/main.ts` — «**yes** (all UI-originated commands)», wave **1→4** |
| `tasks.md` Phase-2 table | T-010-205 declares **no** output and **no** threat column; its acceptance mapping is **A13, A18** |
| `tasks.md` Phase 4 | `main.ts` command extraction is **T-010-401…404**, explicitly not Phase 2 |

The onboarding write lives in the legacy controller, which the matrix assigns to
Phase 4. It was never inside the boundary of T-010-205, so migrating this
component never required migrating it, and the task's mapped criteria are both
constraints on a form rather than demands for a save: A13 requires that form
state be non-authoritative and that Zod never bypass a Domain gate; A18 requires
zero caller role authority. Neither is satisfied by adding a write; both are
satisfied by a form that provably holds none.

What was implemented, and its exact limit:

- `ReactOnboardingWizard` renders all six steps with React Hook Form + Zod
  validating **input shape only**; the schemas contain no identity, role,
  lifecycle or completion field, and Zod strips injected ones.
- Its single read is the declared compatibility read `readOnboardingContext`;
  coverage and the suggested step are computed by `domain/profileCoverage`
  inside the facade, so no completion rule exists in React.
- It performs **no** write and imports **no** command seam. Saving is disabled
  with its real reason (AUDIT010-09 #10) and hands off to the legacy wizard,
  which remains served and unchanged.
- The «this view does not save yet» notice is rendered **before** any field, so
  no long answer is typed in the belief that it will be stored. This is the one
  accepted UX cost of coexistence, recorded rather than hidden.

`AUDIT010-09` is therefore **not** resolved by this closure. The command remains
`KEEP_LEGACY`, the registry entry stands, and the architecture suite continues to
fail if `applyOnboardingStep` ever appears in the React layer.

### Phase-2 delivered artifacts

| Area | Files |
|------|-------|
| Wave-2 components | `src/ui/modules/PageHeader/ReactPageHeader.tsx`, `ClaimSafety/ReactClaimSafetyPanel.tsx`, `MasterDossier/ReactMasterDossierPanel.tsx`, `Opportunity/ReactOpportunityPanel.tsx`, `Kpi/ReactKpiWeeklyChart.tsx`, `ClientProfile/ReactClientProfilePanel.tsx`, `ProofWall/ReactProofWallPanel.tsx`, `SourceRegistry/ReactSourceRegistryPanel.tsx`, `Onboarding/ReactOnboardingWizard.tsx` + `Onboarding/onboardingStepSchemas.ts` |
| Bounded surface | `src/ui/modules/wave2/Wave2Surface.tsx`, wiring inside `ReactAppShell` |
| Read seams | `src/ui/data/canonicalReads.ts` (+ `OpportunityCardView`), `src/ui/data/compatibilityReads.ts` (+ 6 reads) |
| Command seam | `src/ui/commands/commandSeam.ts` (+ `opportunityCommands`, `resultCommands`, `dossierPresentationCommands`) |
| Hooks | `src/ui/hooks/useWave2Data.ts` |
| Tests | `tests/reactMigrationPhase2Architecture.test.ts` (34), `tests/reactMigrationPhase2Wave2.test.ts` (18), `e2e/wave2-components.spec.ts` (5) |
| Governance | `specs/010-react-migration/audit010-09-registry.md` |

**`main.ts` unchanged: 5,138 lines before and after**, including the T-010-205
reconciliation. Wave-2 components render inside the React shell that Phase 1
already mounted, so no new island, no new mount contract and no controller wiring
was needed.

### T-010-206 — status basis

Verified against its own contract rather than assumed from the existence of test
files. Title: *Wave-2 parity evidence + tenant-safe cache tests*; acceptance
**A19, A41**.

- **A19 (tenant-safe query keys):** proven, not partial — every wave-2 read key
  is built by the tenant factory, cross-organization, cross-client and
  cross-source collisions are each asserted, and invalidation is tenant-scoped.
- **A41 (parity evidence):** A41 is a **Phase-5** criterion; at Phase 2 the task
  owes wave-2 evidence, which exists across 12 of the 18 parity dimensions
  (rendered capability, loading, empty, error, tenant, commands, disabled
  actions, validation, multi-thesis, freshness, canonical behaviour, rollback).
  Permissions, navigation, accessibility audit, legacy-quirk sign-off, authority
  adversarial proof and observation remain owned by Phases 3–5.

Evidence: 34 architecture + 18 focused Vitest + 5 wave-2 Playwright, all PASS.
The task is **DONE** for its Phase-2 scope; A41 stays **PARTIAL** by design.

**Exit:** Phase 2 **COMPLETE** — T-010-201…206 all **DONE** ·
Phase 3 authorization **NO** (external review owns it)

---

## Phase 3 — Page-by-page migration (§24 step 4) — COMPLETE

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-301** | Migrate `ThesisEditorModal` (multi-thesis explicit scope) | TECHNICAL | Phase 2 | A20, A21 | **[x] DONE** |
| **T-010-302** | Decompose and migrate `Modals.ts` into per-modal components | TECHNICAL | T-010-301 | A21, A35 | **[x] DONE** |
| **T-010-303** | Migrate `ManagerCockpit` | TECHNICAL | T-010-302 | A5, A18 | **[x] DONE** |
| **T-010-304** | Migrate `ClientPortal` | TECHNICAL | T-010-302 | A5, A20 | **[x] DONE** |
| **T-010-305** | Migrate `ClientWorkspace` (decomposed route + panel tree) | TECHNICAL | T-010-303, T-010-304 | A5, A29 | **[x] DONE** |
| **T-010-306** | Wave-3 parity evidence + boundary tests for SPEC-001…008 | TECHNICAL | T-010-301…305 | A22…A30, A41 | **[x] DONE** |

### Page migratability screen (§5)

Performed before any implementation, across all five legacy pages
(5,235 lines). The finding that shapes the whole phase: canonical Application
paths exist for signal routing, signal outcomes, strategic briefs, opportunities
and result intents — and for **nothing else**. Sources, curation, deliveries,
tasks, evidence, content saves, thesis saves and client creation all write
directly through `dbService` with no canonical use case, so AUDIT010-09 blocks
them. Consequently **no page qualifies for FULL CUTOVER** under §31, which
requires that all necessary commands be canonical.

| Page | Lines | Reads | Commands | Blocked (AUDIT010-09) | Canonical | Classification | Cutover |
|---|---|---|---|---|---|---|---|
| `ThesisEditorModal.ts` | 307 | 2 compat | 1 (save, two intents) | 1 | 0 | `READ_ONLY_REACT_WITH_LEGACY_COMMAND` | HYBRID |
| `Modals.ts` | 834 | 8 compat, 1 canonical | 9 across 13 modals | 8 | 1 (decline opportunity) | `HYBRID_MIGRATABLE` (7 of 13 modals) | HYBRID |
| `ManagerCockpit.ts` | 595 | 10 compat | 5 | 5 | 0 | `READ_ONLY_REACT_WITH_LEGACY_COMMAND` | HYBRID |
| `ClientPortal.ts` | 937 | 13 compat, 1 canonical | 12 | 7 | 5 | `HYBRID_MIGRATABLE` | HYBRID |
| `ClientWorkspace.ts` | 2,562 | ~55 compat, 3 canonical | 45+ | 22 | 2 | `HYBRID_MIGRATABLE` | HYBRID |

Side-effect ordering was classified for every command-bearing path touched.
All migrated paths are `GATE_FIRST`. Two `EFFECT_FIRST` paths were found and
deliberately left legacy: `renderRecommendedSources` (`ClientWorkspace:1983`) and
`renderDiscoveryPanel` (`:2247`) both call `runSourceDiscoveryAgent` *while
rendering*, so merely opening the radar or sources tab runs an agent. A React
read facade must not launch an agent as a side effect of rendering, so the
recommendation and discovery surfaces are not migrated. No `UNKNOWN` path was
migrated.

### T-010-301 — `ReactThesisEditorPage`

Target: `src/components/ThesisEditorModal.ts`. Output:
`src/ui/modules/pages/ReactThesisEditorPage.tsx`.

Reads: `readThesisOptions`, `readThesisDetail` (compatibility). Command: none —
both submit intents end in `dbService.saveThesis` (registry #11).

The multi-thesis requirement is the substance of this task and is met by
construction: the selector starts unselected, lists every thesis with its status,
and the detail read takes an explicit id. There is no `[0]`, no "primary", no
highest-priority election, and `priority` is rendered as data only.

Two deliberate deviations from legacy, both improvements:
- an unknown thesis id renders an explicit error, where the legacy editor
  silently switches to *create a new thesis* (`ThesisEditorModal.ts:126-128`);
- validation is RHF + Zod on shape only, whereas the legacy form is `novalidate`
  with imperative checks. Completeness, weight validation, review readiness and
  activation blockers all come from `domain/thesisModelCore` and
  `domain/thesisRevisionCore` via the facade, so no rule is duplicated.

### T-010-302 — `Modals.ts` decomposition

Target: `src/components/Modals.ts` (13 modals in one module). Output:
`src/ui/modules/pages/modals/ReactModals.tsx`, one component per modal.

Migrated (7): comparative, challenge, content preview, content diff, delivery
preview, feedback (Opportunity branch only), brief selection.
Not migrated (6): create-client, add-evidence, add-task, article-review,
content-editor, teleprompter — each has a blocked legacy write
(registry #30…#34), and teleprompter is media capture besides.

The feedback modal shows the boundary precisely: of its three branches only
`OPPORTUNITY` reaches a canonical consumer, so only that branch renders a submit.
The `TASK` and `CONTENT` branches render a handoff instead of a form, rather than
presenting a form that would have to write illegally.

Two legacy behaviours deliberately not reproduced:
- the diff modal injects `latestEdit.diffHtml` unescaped; the React projection
  returns no HTML and renders text nodes;
- the generate-content modal pre-selects `approvedBriefs[0]` (`Modals.ts:772`),
  which biases the manager when several briefs are approved. The React selector
  starts empty (threat T-010-16).

### T-010-303 — `ReactManagerCockpitPage`

Target: `src/components/ManagerCockpit.ts`. Output:
`src/ui/modules/pages/ReactManagerCockpitPage.tsx`.

Reads: `readPortfolioOverview`, `readAiCenter` (compatibility). Commands: none —
create-client, Firestore push, impersonation and content generation are all
blocked (registry #33, #34). Classified `READ_ONLY_REACT_WITH_LEGACY_COMMAND`.

Not reproduced: the directory row's `getActiveTheses(id)[0]`, which hides a
client's other active theses — the React row shows the count and every title; and
the render-time `aiService.isServerGatewayAvailable()` probe.

### T-010-304 — `ReactClientPortalPage`

Target: `src/components/ClientPortal.ts`. Output:
`src/ui/modules/pages/ReactClientPortalPage.tsx`, decomposed into task, content
and thesis-review panels plus the reused wave-2 panels.

Canonical commands migrated (5): the four Opportunity transitions and the
consultation result intent — all already live from wave 2, now reachable from the
page. Blocked and left legacy: thesis approve/request-changes, task open/complete/
request-changes, content approve/reject, briefing acknowledgement, add evidence
(registry #13, #19, #28, #30, #32).

Not reproduced: `awaiting[0] || ACTIVE || theses[0]`, whose implicit pick feeds
the legacy approve button's thesis id. The client selects explicitly.

Classified `HYBRID_MIGRATABLE`, cutover **HYBRID**.

### T-010-305 — `ReactClientWorkspacePage`

Target: `src/components/ClientWorkspace.ts` (2,562 lines, seven tabs in one
function). Output: `src/ui/modules/pages/ReactClientWorkspacePage.tsx`, a
decomposed panel tree — one component per tab, each with its own declared read
source and command disposition.

Canonical commands migrated (2): the radar signal-outcome intent
(`registerSignalOutcomeIntent`, SPEC-008) and Strategic Brief approval
(`approveStrategicBrief`, SPEC-003). Both are canonical in the legacy controller
too, so the migration changes the caller and nothing else.

Blocked and left legacy: 22 writes across radar decisions, curation, delivery
assembly and sending, sources and ingestion, tasks, and evidence assignment
(registry #12, #14…#29). Brief *creation* is blocked for a separate reason
recorded in the registry: its canonical consumer requires the caller to pass the
whole `CurationEntry` aggregate, which would give the UI snapshot authority.

Classified `HYBRID_MIGRATABLE`, cutover **HYBRID**.

### T-010-306 — wave-3 evidence

- `tests/reactMigrationPhase3Architecture.test.ts` — 28 tests. Enforces
  React→`dbService` = 0, facade mutators = 0, LocalStore/Firestore/provider
  imports = 0, the 34 blocked mutators absent from all of `src/ui/**`, no
  business authority, no manufactured identity, no first/primary selection, no
  EFFECT_FIRST agent run, exclusive DOM ownership, no routing library, no
  Application import from a page, and `main.ts` unchanged at 5,138 lines.
- `tests/reactMigrationPhase3Pages.test.ts` — 19 tests. Exercises the canonical
  reads and both wave-3 commands against mocked consumers: payloads carry ids
  only, no actor/role/aggregate crosses the seam, refusals surface rather than
  being swallowed, a scope without a client fails closed, and every wave-3 query
  key is tenant-scoped and collision-free across organizations, clients and read
  sources.
- `e2e/wave3-pages.spec.ts` — 6 Playwright tests: legacy still served by default,
  React mounts without a second DOM owner, no page renders without a trusted
  session, no blocked-write control is reachable, rollback leaves business state
  byte-identical, and the legacy pages that own the blocked actions still work.

Authenticated page-level E2E remains **PARTIAL**: no seeded credentials are
formally available in this environment, so authenticated behaviour is proved by
the Vitest suites that exercise the same seams. This is stated rather than
papered over, and full parity remains Phase-5 work (A41).

### Delivered artifacts

| Artifact | Detail |
|---|---|
| Pages | 5 files, one per Phase-3 task, plus `LegacyHandoff.tsx` |
| Modal components | 7 of 13 legacy modals |
| Read seams | 11 new compatibility reads, 3 new canonical reads |
| Commands | 2 new canonical commands (`signalOutcomeCommands`, `briefCommands`) |
| Hooks | `useWave3Data.ts` — 14 queries, 2 mutations |
| Tests | 28 architecture + 19 focused Vitest + 6 wave-3 Playwright |

**Exit:** Phase 3 **COMPLETE** — T-010-301…306 all **DONE** · 0 pages fully cut
over, 5 HYBRID, 0 blocked · Phase 4 authorization **NO**

---

## Phase 4 — Extract UI logic from services + `main.ts` strangler (§24 step 5) — FORMALLY_ACCEPTED

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-401** | Audit and record side-effect ordering (gate→effect) for every `main.ts` command path | TECHNICAL | Phase 3 | A5, A39 | **[x] DONE** |
| **T-010-402** | Relocate UI orchestration out of `main.ts` per audited path | TECHNICAL | T-010-401 | A39 | **[x] DONE** |
| **T-010-403** | Invert the seam — React shell hosts remaining legacy islands (Stage B) | TECHNICAL | T-010-402 | A38 | **[x] DONE — FORMALLY_ACCEPTED** (implementation `66d849b3` · E2E verification complete) |
| **T-010-404** | Reduce `main.ts` to minimal bootstrap/composition entrypoint | TECHNICAL | T-010-403 | A39 | **[x] DONE — FORMALLY_ACCEPTED** (bootstrap reduction complete) |
| **T-010-405** | Extract UI logic from domain-adjacent services without changing authority | TECHNICAL | T-010-402 | A5, A34 | **[x] DONE** |

Full evidence: **`main-controller-audit.md`** (new in this phase).

### T-010-401 — controller audit

The audit is the phase's most consequential output, because it decides what may
be extracted. Method: mechanical inventory, then hand verification of every
flagged path (`scripts/auditMainController.mjs`,
`scripts/auditBindTimeEffects.mjs`, `scripts/auditHandlerOrdering.mjs`).

Subject: 5,138 lines, one `class App`, 82 methods, 157 attached handlers.

Responsibility inventory — 11 classes. The load-bearing figure is **25 methods
classified `LEGACY_BUSINESS_WRITE`**, holding the 34 writes registered under
AUDIT010-09. They cannot become canonical use cases here (business authority) and
cannot move into React (the write ban), so they stay legacy per §17.

**Side-effect ordering across 86 material paths: 80 `GATE_FIRST`, 6
`EFFECT_FIRST`, 0 `UNKNOWN`.** Ordering was counted per *path* — 56
effect-bearing handlers plus 30 command-method bodies — because a `bind*` method
attaches many handlers, each with its own gate.

Two results worth stating plainly:

- **0 effects run at bind time or render time.** All 30 command-body effect sites
  are in methods whose purpose is to write. The legacy controller attaches
  listeners without firing them and renders without writing, which is what makes
  §9 enforceable rather than aspirational.
- **The first pass was wrong and was corrected.** A tolerant gate pattern
  reported 0 `EFFECT_FIRST` across all 157 handlers. Requiring a real refusal —
  early return, throw, authorization call, confirmation — surfaced 7 candidates,
  6 of which survived inspection. An audit that finds nothing should be
  distrusted before it is believed.

The 6 are registered as **AUDIT010-10** (P2), retained legacy, **0 migrated**.
Three take their tenant from a DOM attribute; four are advisory AI/agent
generators that spend a provider budget from an ungated click.

**AUDIT010-07** moves from `AUDIT_REQUIRED` (open since Phase 0) to
`AUDIT_COMPLETE · DEFECTS REGISTERED · 0 MIGRATED`.

### T-010-401 — `runSourceDiscoveryAgent` correction

Phase 3 recorded 2 `EFFECT_FIRST` occurrences at `ClientWorkspace.ts:1983` and
`:2247` and declined to migrate them. **The decision was right; the stated reason
was wrong.** The synchronous `runSourceDiscoveryAgent` performs no write, no
network call and no provider call — persistence and network live in
`runSourceDiscoveryAgentAsync` and `saveLastAgentRun`, neither of which is reached
from a render. Corrected to `RENDER_TIME_RECOMPUTATION (NO_MATERIAL_EFFECT)`:
still not migrated, because a React read facade must not read persistence during
render or re-derive on every pass, but not a side effect. `EFFECT_FIRST` for this
symbol in the controller is **0** — both call sites use the async variant behind a
button and behind the hourly tick.

### T-010-402 — UI orchestration relocated

| Responsibility | Was | Now |
|---|---|---|
| Presentation state — tab, client scope, campaign, modal, filters, login error | 11 mutable fields on `App` | `src/controllers/appUiState.ts` |
| Toast queue + rendering | `showToast`, `renderToasts` | `src/controllers/toastController.ts` (injectable sink) |
| Modal dispatch — 17 modals, 72 lines of `if` chains | `renderActiveModal` | `src/controllers/modalPresenter.ts` |
| Navigation transition rules | `setTab`, `enterClient`, `backToPortfolio` | `src/controllers/navigationController.ts` |

Follows the existing `controllers/sessionController.ts` precedent: a host contract
plus injected dependencies, so authority stays outside. None of the four modules
imports `dbService`, a store, Firestore, an Application module or a domain module —
asserted, not asserted-by-comment. `appUiState.ts` imports **nothing at all**.

One behaviour deliberately improved rather than copied: the manager-only content
editor used to set `this.activeModal = null` *during a render*. The presenter
returns `forceClose` and the caller applies it. Same outcome, no hidden write in a
render.

The ~5,000 existing `this.activeTab`-style call sites were preserved via
accessors that delegate to the store, so ownership moved without a 5,000-site
rewrite.

### T-010-405 — UI logic out of domain-adjacent services

`services/dossierExport.ts` and `services/recordings.ts` each built a document
*and* drove an anchor click. The document is theirs; the browser download is not.
Both now delegate to `src/lib/fileDownload.ts`, which is the **only** DOM-driven
download in `src/` (asserted). `dossierExport` gained `buildDossierExport`,
returning bytes and a filename, so the export is provable without a DOM.

`services/theme.ts` also touches the DOM but is a pure presentation service
rather than a domain-adjacent one, so it was left alone rather than churned.

### T-010-403 / T-010-404 — why BLOCKED, not attempted

`ui-architecture.md:121` sets Stage B's own precondition: *"Stage B is entered
only when `main.ts` has been reduced to bootstrap/composition responsibility."*
After T-010-402 the controller still owns 157 handlers, 25 business-write methods
and the polling scheduler. The precondition is unmet.

There is also a substantive reason, not just sequencing. Stage B makes React the
single navigation authority, while the 34 blocked writes are reached through
legacy event wiring bound during a legacy render. Hosting those surfaces in a
React shell while legacy still owns their navigation and binding is exactly the
dual-navigation-authority condition §18 and `ui-architecture.md:131` forbid.

T-010-404 depends on 403 and is further bounded by §27: a smaller `main.ts` with
duplicated authority is a failure, and every extracted responsibility needs
equivalence evidence. The remaining ~4,400 lines are DOM event handlers with no
unit coverage. Relocating them legacy→legacy would move no authority and is
permissible in principle, but this phase cannot produce equivalence evidence for
them — and moving untested handler code to claim a line count is precisely the
failure §27 describes.

**Neither is a task-contract conflict.** Neither *requires* a forbidden action, so
§3's STOP condition is not triggered. What both require is the CR-1 change
request that Phase 4 is explicitly not allowed to grant itself.

### `main.ts` before / after

One measurement method and one encoding for both revisions
(`scripts/mainStatsGit.mjs`).

| | Phase-3 checkpoint | Phase 4 | Δ |
|---|---|---|---|
| Lines | **5,138** | **5,041** | −97 |
| Methods | 82 | 82 | 0 |
| Named component imports | 28 | 11 | **−17** |
| `addEventListener` sites | 158 | 158 | 0 |
| Responsibility classes present | 12 | 11 | −1 |

−97 lines is the least interesting figure. Two others say more: the controller no
longer knows that 17 components exist (modal dispatch was the coupling and left
with the table), and **method and handler counts did not move at all** — the file
is not yet less of an event bus, nothing was shuffled to look smaller, and the
four responsibilities that left are gone rather than relocated within it.

### Delivered artifacts

| Artifact | Detail |
|---|---|
| Audit | `specs/010-react-migration/main-controller-audit.md` + 4 audit scripts |
| Extracted modules | 4 controllers + `lib/fileDownload.ts` |
| Services changed | 2 (`dossierExport`, `recordings`) — formatting kept, DOM removed |
| Tests | 28 architecture + 26 focused Vitest + 6 Playwright |
| Governance | AUDIT010-07 closed as audit; AUDIT010-10/-11 opened; CR inventory (2 CRs); SPEC-003 signature analysis |

**Exit:** Phase 4 **FORMALLY_ACCEPTED** — T-010-401…405 **DONE** (T-403/T-404 formally accepted) · A39 reconciled · dirty-tree hygiene **PASS** · formal closure record `t-010-phase4-formal-closure.md` · Phase 5 authorization **NO** · Phase 5 readiness **READY_FOR_AUTHORIZATION_REVIEW**

---

## Phase 4C — local security remediation (AUDIT010-10 / AUDIT010-11)

Not a new task range. Phase 4C discharges two Phase-4 findings that Phase 4B
classified as `PHASE4_LOCAL_UI_REMEDIATION`: they live in `main.ts`, they need no
new business authority, and they need no owner assignment. T-010-404 is **READY_FOR_AUTHORIZATION** after T-403 formal acceptance — CR-1 is untouched.

| Finding | Before | After |
|---|---|---|
| **AUDIT010-10** (P2) | 6 paths run a material effect with no in-path gate; 5 take tenant from `data-client-id`; 6 rely on button visibility | **RESOLVED** — all gated on a trusted grant; `EFFECT_FIRST` 6 → **0** |
| **AUDIT010-11** (P3→P2) | positional tenant fallback `getClients()[0]` | **RESOLVED** — removed from all three authority sites; one display-only default retained per §10 |
| **AUDIT010-12** (P3) | — | **OPENED** — 6 internal helpers gated by their callers rather than in-path |

New module: `src/controllers/trustedTenant.ts` — `requireTenantScope`,
`requireAdminActor`. A gate, not an authority: no state, no store import,
identity injected, organization always taken from the session.

Two sites the Phase-4B analysis had missed were found **by writing the test**,
and one mattered more than the recorded finding: `renderMainView` fell through
to `getClients()[0]` for a `CLIENT` session with no `clientId`, rendering
another tenant's portal. The ingest scheduler also picked a tenant by position.
Both now fail closed. This is why AUDIT010-11 was not display-only and why its
P3 was too low.

Evidence: `tests/reactMigrationPhase4cSecurity.test.ts` (33 tests, adversarial —
every case models a caller proposing a tenant it should not get) · re-audit by
the original scripts · `npm run check` **1679/1679** · rules **91/91** · build
**PASS** · Playwright **22/22**.

**Exit:** Phase 4 remains **FORMALLY_ACCEPTED** · AUDIT010-10 **RESOLVED** · AUDIT010-11
**RESOLVED** · AUDIT010-12 **OPEN (P3)** · CR-1 **34, ownership PARTIAL** · CR-2
**CHANGE_REQUIRED** · SPEC-001…008 modifications **0** · Phase 5 authorization
**NO**

---

## Phase 5 — Regression / parity / security / E2E (§24 step 6) — FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT

| ID | Title | Class | Depends on | Acceptance | Threats | Status |
|----|-------|-------|-----------|------------|---------|--------|
| **T-010-501** | Adversarial authority suite — caller tenant/actor/role spoof | TECHNICAL | Phase 4 | A16, A17, A18 | T-010-09…11 | **[x] DONE** |
| **T-010-502** | Adversarial cache suite — stale, optimistic, cross-tenant bleed | TECHNICAL | Phase 4 | A11, A14, A15, A19 | T-010-05…08 | **[x] DONE** |
| **T-010-503** | Adversarial write-path suite — `dbService`/store/Firestore/provider bypass | TECHNICAL | Phase 4 | A8, A26, A32, A33 | T-010-01…04 | **[x] DONE** |
| **T-010-504** | Adversarial approval suite — UI approval spoof, SPEC-008 boundary | TECHNICAL | Phase 4 | A29, A30 | T-010-14, 22 | **[x] DONE** |
| **T-010-505** | Duplication suite — scoring/routing/lifecycle/opportunity/learning logic | TECHNICAL | Phase 4 | A23, A28, A34 | T-010-17, 19…22 | **[x] DONE** |
| **T-010-506** | Dual-authority suite — command, read, auth, DOM ownership | TECHNICAL | Phase 4 | A35, A36, A37, A38 | T-010-12, 13, 23, 24 | **[x] DONE** |
| **T-010-507** | Multi-thesis and presentation-default suite | TECHNICAL | Phase 4 | A20, A21 | T-010-15, 16 | **[x] DONE** |
| **T-010-508** | Playwright legacy-vs-React parity journeys + rollback | TECHNICAL | Phase 4 | A41, A42, A43 | T-010-26 | **[x] DONE** |
| **T-010-509** | Accessibility and performance evidence per migrated module | TECHNICAL | Phase 4 | A41 | — | **[x] DONE** (verdict **PARTIAL** — static evidence only; runtime a11y audit absent — **NONBLOCKING_DEBT**) |
| **T-010-510** | Confirm all 26 formal threats | TECHNICAL | T-010-501…509 | all threats | T-010-01…26 | **[x] DONE** |

**Evidence:** `t-010-phase5-regression-parity-security-e2e.md` · `t-010-phase5-formal-closure.md` · focused Vitest **73/73** · Playwright **21/21** (Stage-B 11 + T-508 10; stability **5/5 + 3/3 + 2/2**) · FULL CHECK **1965/1965** · RULES **91/91** · BUILD **PASS** · product changes **0** · threats **23 PASS / 3 PARTIAL / 0 FAIL**

**Exit:** Phase 5 **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** · Phase 6 **NOT_AUTHORIZED** · next **`SPEC010_PHASE6_READINESS_REVIEW`**

---

## Phase 6 — Final acceptance / legacy removal / CODE_COMPLETE (§24 step 7) — PRE_REMOVAL_GATES_COMPLETE

| ID | Title | Class | Depends on | Acceptance | Status |
|----|-------|-------|-----------|------------|--------|
| **T-010-601** | Run full acceptance matrix A1–A44 | TECHNICAL | Phase 5 | A1–A44 | **[x] DONE** |
| **T-010-602** | Full check + rules regression | TECHNICAL | T-010-601 | A44 | **[x] DONE** (`REGRESSION_GATE_PASS`; A44 formal **PENDING**) |
| **T-010-603** | Remove legacy implementations that passed the parity gate | TECHNICAL | T-010-601, T-010-602 | A43 | **[x] DONE — FORMALLY_CLOSED** (`t-010-603-global-closure.md`; scope **A**; nine-family leaf program) |
| **T-010-604** | **Human CODE_COMPLETE approval** | **HUMAN** | T-010-601…603 | CODE_COMPLETE gate | **[ ] TODO · NOT AUTHORIZED** |

**Evidence:** `t-010-phase6-pre-removal-gates.md` · `t-010-phase6-a1-a44-reconciliation.md` · `t-010-603-global-closure.md` · A1–A44 **9/32/0/3** (A43 **PASS**) · T602 **1965/1965 · 91/91 · BUILD · 73/73 · 21/21** · T-603 nine governed leaves **ABSENT** · product changes at global closure **0**

**Exit:** Phase 6 pre-removal gates **COMPLETE** · T-603 **FORMALLY_CLOSED** · T-604 **NOT AUTHORIZED** · Phase 6 **NOT COMPLETE** · next human CODE_COMPLETE gate **T-010-604** (separate authorization required)

**Required human CODE_COMPLETE statement (T-010-604) — future:**

> «Apruebo formalmente el CODE_COMPLETE de SPEC-010 — React migration y autorizo el cierre de T-010-604.»

---

## Deployment (separate — NOT AUTHORIZED)

| Task | Title | Status |
|------|-------|--------|
| **D1** | Frontend rollout strategy (staged React exposure, toggle governance) | **NOT_STARTED** |
| **D2** | Frontend rollback/observation procedure in production | **NOT_STARTED** |
| **D3** | Production cutover verification (SPEC-009 coordination) | **NOT_STARTED** |

Deployment requires separate authorization. SPEC-009 production remains **DEFERRED_UNCHANGED**.

---

## Summary task counts

| Phase | ID range | Count | Status |
|-------|----------|-------|--------|
| 0 | T-010-001…010 | 10 | 9 DONE · 1 PENDING HUMAN (T-010-010) |
| 1 | T-010-101…111 | 11 | NOT AUTHORIZED |
| 2 | T-010-201…206 | 6 | NOT AUTHORIZED |
| 3 | T-010-301…306 | 6 | NOT AUTHORIZED |
| 4 | T-010-401…405 | 5 | **FORMALLY_ACCEPTED** |
| 5 | T-010-501…510 | 10 | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| 6 | T-010-601…604 | 4 | **PRE_REMOVAL_GATES_COMPLETE** (T-601/T-602 DONE · T-603/T-604 NOT AUTHORIZED) |
| Deploy | D1–D3 | 3 | NOT_STARTED |

**Total formal tasks:** 55 (52 implementation + 3 deployment)
