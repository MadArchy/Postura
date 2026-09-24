# T-010-603 — PageHeader legacy subset removal

**Status:** `PHASE6_PAGEHEADER_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-23  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `1a606a7a4c7d7de818d9818bd683ed20493b42ae`  
**Implementation commit:** `1a606a7a4c7d7de818d9818bd683ed20493b42ae`  
**Physical removal subject:** `refactor(legacy): remove page header renderer`  
**Candidate:** `src/components/PageHeader.ts`

This record accepts the **bounded T-010-603 admission** of the already-removed PageHeader HTML renderer after C1–C7.

PHASE = 6  
LEAF = PAGEHEADER  
UNIT = PAGEHEADER  
T603 SAFE SUBSET = `src/components/PageHeader.ts`  
SAFE SUBSET SIZE = 1  
REMOVAL COMMIT = `1a606a7a4c7d7de818d9818bd683ed20493b42ae`  
REMOVAL SUBJECT = `refactor(legacy): remove page header renderer`  
C6 = `PHASE6_PAGEHEADER_C6_VERIFIED_PASS`  
C7 = `PHASE6_PAGEHEADER_C7_DELETION_ACCEPTANCE_VERIFIED`  
SAFE SUBSET REVIEW = `PHASE6_PAGEHEADER_T603_SAFE_SUBSET_VERIFIED`  
SAFE SUBSET RESULT = `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED`  
FORMAL DECISION = `PHASE6_PAGEHEADER_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
FORMALLY ACCEPTED = YES  
PAGEHEADER LOCAL A43 = PASS  
PAGEHEADER UNIT A43 = PASS  
GLOBAL C3 = PARTIAL  
GLOBAL A43 = PARTIAL  
GLOBAL T603 = OPEN  
T604 = NOT_AUTHORIZED  
T604 ELIGIBLE = NO

`PageHeader.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** accept SourceRegistry or Onboarding.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, KPI acceptance, ClientProfile acceptance, ProofWall acceptance, ClaimSafety acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| CLIENTPORTAL CUTOVER | `1635b87567dcc3d621566b4d2c14d112f827ae43` |
| MANAGER FIREBASE REMATERIALIZE | `5ccf10571f223a4fb29028a5c0f000b70b532e3b` |
| MANAGERCOCKPIT CUTOVER | `7a7e074a4eb58b8e8d7873254c32ddcba2e2feb5` |
| CREATE-THESIS CANONICAL REPLACEMENT | `8ae8138d75df6944f97f1d65a6b1f4a7318ee6bc` |
| CLIENTWORKSPACE CUTOVER | `63310d24d0f80b0dbaef9ebacebf5d1f0b6dfe4b` |
| FILE ABSENCE | `1a606a7a4c7d7de818d9818bd683ed20493b42ae` |
| C6 | `PHASE6_PAGEHEADER_C6_VERIFIED_PASS` |
| C7 | `PHASE6_PAGEHEADER_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_PAGEHEADER_T603_SAFE_SUBSET_VERIFIED` |
| FEATURE | `1a606a7a4c7d7de818d9818bd683ed20493b42ae` |

Feature `1a606a7` is HEAD at acceptance. This commit adds governance only. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`1a606a7`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/PageHeader.ts` |
| Tests | `tests/phase6PageHeaderClientPortalCutover.test.ts`, `tests/phase6PageHeaderManagerCockpitCutover.test.ts`, `tests/phase6PageHeaderClientWorkspaceCutover.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts`, `tests/reactCreateThesisCanonical.test.ts`, `tests/reactParityLocalSnapshotRematerialize.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## Physical evidence

| Field | Value |
|-------|--------|
| PageHeader.ts | **ABSENT** |
| stub / alias / redirect / wrapper / renamed equivalent / duplicate legacy renderer | **NONE** |
| product import graph | **0** |
| product call graph | **0** |
| dynamic / barrel / registry | **0** / **0** / **0** live Product |
| runtime discovery | **0** |
| PRODUCT GRAPH | **ZERO** |
| STATIC PRODUCT IMPORTERS | **0** |
| PRODUCT CALLERS | **0** |
| build reachability | **NO** |
| SECOND DELETE | **NO** |
| PRODUCT MODIFICATION | **0** |
| REACT MODIFICATION | **0** |
| TEST MODIFICATION | **0** |

---

## React replacement

| Surface | Owner | Status |
|---------|--------|--------|
| ClientPortal | `ReactTabHeader` on `ReactClientPortalPage` | **SERVED / PRESERVED** |
| ManagerCockpit | `ReactTabHeader` on `ReactManagerCockpitPage` | **SERVED / PRESERVED** |
| ClientWorkspace mapped tabs | `ReactTabHeader` on `ReactClientWorkspacePage` | **SERVED / PRESERVED** |
| ClientWorkspace briefs | `ReactPageHeader` title `Strategic Briefs` | **SERVED / PRESERVED** |

Canonical create-thesis (`Nueva tesis` / consumer ID mint / SaveThesis #11) and Manager rematerialization remain **PRESERVED** and independent of the removed file.

---

## Presentation evidence

| Field | Value |
|-------|--------|
| portal slot | `omit` / `src/ui/presentation/pageHeaderPortalSlot.ts` |
| portal exclusive id | `client-portal-page-header` |
| portfolio slot | `omit` / `src/ui/presentation/pageHeaderPortfolioSlot.ts` |
| portfolio exclusive id | `client-portfolio-page-header` |
| workspace slot | `omit` / `src/ui/presentation/pageHeaderWorkspaceSlot.ts` |
| workspace exclusive id | `client-workspace-page-header` |
| PRESENTATION CONTRACT | **PASS** |
| ALL DISTINCT | **YES** |
| KNOWN + CONFIGURED | **YES** |
| COLLISIONS | **0** |
| Option-E without file | **PASS** |
| A38 | **PASS** |

---

## Authority evidence

| Field | Value |
|-------|--------|
| AUTHORITY | **UNCHANGED** |
| SPEC-006 | **UNCHANGED** |
| PAGEHEADER WRITE AUTHORITY | **0** |
| AUTHORITY BROADENING | **0** |
| ROLE / TENANT / AUTH / TRUST CHANGE | **0** |
| DOMAIN / PERSISTENCE / DATA MIGRATION | **0** / **0** / **NONE** |
| NEW AUTHORITY | **0** |
| DIRECT DB | **0** |
| HANDLER FILE DEPENDENCY | **NO** |
| HANDLER CLEANUP REQUIRED | **NO** |

---

## A43 unit (PageHeader leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — ClientPortal `ReactTabHeader`; ManagerCockpit `ReactTabHeader`; ClientWorkspace mapped `ReactTabHeader`; briefs `ReactPageHeader` / `Strategic Briefs` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — host / Phase-2 / rollback / create-thesis / rematerialize / navigation oracles retained |
| C4 Authority | PASS — leftover PageHeader was presentational chrome only; no write authority |
| C5 Tenant / security | PASS — no new authority; no tenant / auth / trust change |
| C6 Rollback | PASS — Option E without the file (`PHASE6_PAGEHEADER_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_PAGEHEADER_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, renamed equivalent, duplicate renderer, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| PAGEHEADER UNIT A43 | **PASS** |
| PAGEHEADER LOCAL A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/PageHeader.ts` only |
| SAFE SUBSET SIZE | **1** |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

Explicitly **outside** this subset: leftover optional header-id binds in `sourcesHandlers.ts` / `tasksHandlers.ts` / `thesisHandlers.ts`, shared `.page-header*` CSS, `ReactPageHeader` / `ReactTabHeader`, leftover hosts, PageHeader slot files, exclusive-slot registry, `SourceRegistryModal.ts`, `OnboardingWizard.ts`, Application, Domain, Auth, Persistence, SPEC-006.

---

## Boundary evidence

| Surface | State |
|---------|--------|
| Dossier T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| Opportunity T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| KPI T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| ClientProfile T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| ProofWall T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| ClaimSafety T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| SourceRegistry | **OUTSIDE PAGEHEADER SAFE SUBSET** |
| Onboarding | **OUTSIDE PAGEHEADER SAFE SUBSET** |
| Whole remaining-legacy acceptance | **NO** |

---

## Verification

| Gate | Result |
|------|--------|
| CLIENTPORTAL HOST | **12 PASS** |
| MANAGERCOCKPIT HOST | **14 PASS** |
| CLIENTWORKSPACE HOST | **14 PASS** |
| PHASE-2 | **41 PASS** |
| CREATE-THESIS | **12 PASS** |
| REMATERIALIZATION | **6 PASS** |
| ROLLBACK | **71 PASS** |
| P5 | **19 PASS** |
| SOURCES / TASK / RADAR | **3 files / 41 PASS** |
| NAVIGATION | **5 files / 83 PASS** |
| SAFE-SUBSET ORACLES | **16 files / 313 PASS** |
| FOCUSED C6 | **26 files / 386 PASS** |
| FULL CHECK | **221 files / 3005 PASS** |
| BUILD | **PASS / 663 modules** |
| E2E | **NOT_REQUIRED / NOT_RUN** |
| BUSINESS / SECURITY | **PASS** |
| STALE ASSERTIONS | **0** |
| TEST WEAKENING | **0** |

---

## Nonblocking debt

| Class | Disposition |
|-------|-------------|
| `sourcesHandlers.ts` `#btn-open-source-registry` | **OUTSIDE_T603_NONBLOCKING_DEBT** — REACHABLE=NO; Product emitter=NONE. **Not cleaned.** |
| `sourcesHandlers.ts` `#btn-poll-all-sources` | **OUTSIDE_T603_NONBLOCKING_DEBT** — REACHABLE via leftover `SourceRegistryModal.ts`. **Not cleaned.** |
| `sourcesHandlers.ts` `#btn-add-manual-signal` | **OUTSIDE_T603_NONBLOCKING_DEBT** — REACHABLE=NO as PageHeader emitter. **Not cleaned.** |
| `tasksHandlers.ts` `#btn-open-add-task` | **OUTSIDE_T603_NONBLOCKING_DEBT** — REACHABLE=NO; Product emitter=NONE. **Not cleaned.** |
| `thesisHandlers.ts` `.btn-open-thesis-editor` | **OUTSIDE_T603_NONBLOCKING_DEBT** — REACHABLE=NO as PageHeader emitter. **Not cleaned.** |
| Shared `.page-header*` CSS | Required by React `ReactPageHeader` / `ReactTabHeader`. **Not leftover-only. Not cleaned.** |
| Comments / SPEC / historical T603 refs still naming PageHeader | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Remaining leftover families `SourceRegistryModal.ts`, `OnboardingWizard.ts` | Outside subset. Still present. **Not accepted here.** |

OUTSIDE PAGEHEADER SAFE SUBSET = YES  
BLOCKS PAGEHEADER T603 = NO  
**BLOCKING DEBT = NONE**  
**NONBLOCKING DEBT = PRESENT / SEPARATED**

Cleanup of handlers, CSS, comments, remaining leftover families, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

Portal / portfolio / workspace slots `omit` · exclusive ids `client-portal-page-header` / `client-portfolio-page-header` / `client-workspace-page-header` active and distinct · React header owners / commands / hooks unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 PAGEHEADER UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| REMAINING OPEN FAMILIES | `SourceRegistryModal.ts`, `OnboardingWizard.ts` |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, handler/comment cleanup, SourceRegistry / Onboarding migration, T-010-604, or a global A43 PASS.
