# T-010-603 — SourceRegistry legacy subset removal

**Status:** `PHASE6_SOURCEREGISTRY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-24  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `1441fe1e642c952950d08137d1c36ee57bc35a3a`  
**Implementation commit:** `1441fe1e642c952950d08137d1c36ee57bc35a3a`  
**Physical removal subject:** `refactor(legacy): remove source registry modal`  
**Candidate:** `src/components/SourceRegistryModal.ts`

This record accepts the **bounded T-010-603 admission** of the already-removed SourceRegistry leftover modal after C1–C7.

PHASE = 6  
LEAF = SOURCEREGISTRY  
UNIT = SOURCEREGISTRY  
T603 SAFE SUBSET = `src/components/SourceRegistryModal.ts`  
SAFE SUBSET SIZE = 1  
REMOVAL COMMIT = `1441fe1e642c952950d08137d1c36ee57bc35a3a`  
REMOVAL SUBJECT = `refactor(legacy): remove source registry modal`  
CUTOVER COMMIT = `fd21429d9f4ba075faf921de4f74c7ce0cae4705`  
CUTOVER SUBJECT = `feat(react): cut over source registry modal`  
C6 = `PHASE6_SOURCEREGISTRY_C6_VERIFIED_PASS`  
C7 = `PHASE6_SOURCEREGISTRY_C7_DELETION_ACCEPTANCE_VERIFIED`  
SAFE SUBSET REVIEW = `PHASE6_SOURCEREGISTRY_T603_SAFE_SUBSET_VERIFIED`  
SAFE SUBSET RESULT = `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED`  
FORMAL DECISION = `PHASE6_SOURCEREGISTRY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
FORMALLY ACCEPTED = YES  
SOURCEREGISTRY LOCAL A43 = PASS  
SOURCEREGISTRY UNIT A43 = PASS  
GLOBAL C3 = PARTIAL  
GLOBAL A43 = PARTIAL  
GLOBAL T603 = OPEN  
T604 = NOT_AUTHORIZED  
T604 ELIGIBLE = NO

`SourceRegistryModal.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another leftover file.  
It does **not** accept Onboarding.  
It does **not** promote global A43 to PASS.  
It does **not** claim Phase 6 complete or all leftover removed.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, KPI acceptance, ClientProfile acceptance, ProofWall acceptance, ClaimSafety acceptance, PageHeader acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| PRODUCT DECISION | `PHASE6_SOURCEREGISTRY_PRODUCT_DECISION_RESOLVED` (`1A + 2A + 3A`) |
| CUTOVER DESIGN | `PHASE6_SOURCEREGISTRY_CUTOVER_DESIGN_RESOLVED` |
| CUTOVER IMPLEMENTATION | `fd21429d9f4ba075faf921de4f74c7ce0cae4705` |
| CUTOVER OBSERVATION | `PHASE6_SOURCEREGISTRY_CUTOVER_OBSERVATION_VERIFIED` |
| FILE ABSENCE REVIEW | `PHASE6_SOURCEREGISTRY_FILE_ABSENCE_REVIEW_VERIFIED` |
| FILE ABSENCE | `1441fe1e642c952950d08137d1c36ee57bc35a3a` |
| C6 | `PHASE6_SOURCEREGISTRY_C6_VERIFIED_PASS` |
| C7 | `PHASE6_SOURCEREGISTRY_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_SOURCEREGISTRY_T603_SAFE_SUBSET_VERIFIED` |
| FEATURE | `1441fe1e642c952950d08137d1c36ee57bc35a3a` |

Feature `1441fe1` is HEAD at acceptance. This commit adds governance only. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`1441fe1`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/SourceRegistryModal.ts` |
| Tests | `tests/phase6SourceRegistryCutover.test.ts`, `tests/reactParityWaveSourceManagement.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts`, `tests/strategicSignalRoutingPhase4.test.ts`, `tests/strategicSignalRoutingPhase5.test.ts`, `tests/phase6PageHeaderClientWorkspaceCutover.test.ts`, `tests/phase6PageHeaderClientPortalCutover.test.ts`, `tests/phase6PageHeaderManagerCockpitCutover.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## Physical evidence

| Field | Value |
|-------|--------|
| SourceRegistryModal.ts | **ABSENT** |
| stub / alias / redirect / wrapper / renamed equivalent / duplicate leftover renderer | **NONE** |
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
| Workspace Fuentes | `SourcesPanel` on `ReactClientWorkspacePage` / `ws-sources-react` / existing `#react-root` | **SERVED / PRESERVED** |
| Wave2 leftover tab | `ReactSourceRegistryPanel` (`READ_ONLY`) | **COMPATIBILITY ONLY — not cutover owner** |

Canonical `#8 RegisterSource`, `#9 PollAllActiveSources` / `PollRegisteredSource`, and `#26 RegisterManualSignal` remain on scoped hooks → `signalIntakeCommands`. Discovery-on-render and leftover `autoResearchPrioritySignals` stay **outside** the canonical SourceRegistry surface.

---

## Presentation evidence

| Field | Value |
|-------|--------|
| leftover cutover | omit at `modalPresenter` (no SourceRegistry import / branch / redirect / `forceClose`) |
| unknown-modal fallback | `return html('')` **PRESERVED** |
| Onboarding branch | **PRESERVED** (`renderOnboardingWizard`) |
| SourceRegistry slot | **NONE** |
| SourceRegistry exclusive id | **NONE** |
| OPTION-E | **NOT_REQUIRED** |
| A38 | **PASS** |

---

## Authority evidence

| Field | Value |
|-------|--------|
| AUTHORITY | **UNCHANGED / PASS** |
| SPEC-006 | **UNCHANGED** |
| AUTHORITY BROADENING | **0** |
| ROLE / TENANT / AUTH / TRUST CHANGE | **0** |
| DOMAIN / PERSISTENCE / DATA MIGRATION | **0** / **0** / **NONE** |
| NEW AUTHORITY | **0** |
| DIRECT DB | **0** |
| HANDLER FILE DEPENDENCY | **NO** |
| HANDLER CLEANUP REQUIRED | **NO** |

---

## A43 unit (SourceRegistry leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — `SourcesPanel` on `ReactClientWorkspacePage` / `ws-sources-react` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — dedicated / source-management / Phase-2 / strategic / PageHeader / rollback oracles retained |
| C4 Authority | PASS — leftover modal was presentation only; canonical commands remain Application-owned |
| C5 Tenant / security | PASS — no new authority; scoped hooks preserved |
| C6 Rollback | PASS — omit-at-`modalPresenter` without the file (`PHASE6_SOURCEREGISTRY_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_SOURCEREGISTRY_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, renamed equivalent, duplicate renderer, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| SOURCEREGISTRY UNIT A43 | **PASS** |
| SOURCEREGISTRY LOCAL A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/SourceRegistryModal.ts` only |
| SAFE SUBSET SIZE | **1** |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

Explicitly **outside** this subset: `sourcesHandlers.ts` `#btn-open-source-registry` / `.btn-open-agent-sources`, orphan `.source-suggestion-*` CSS, `ReactSourceRegistryPanel`, `SourcesPanel`, `modalPresenter`, exclusive-slot registry, `OnboardingWizard.ts`, Application, Domain, Auth, Persistence, SPEC-006.

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
| PageHeader T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| Onboarding | **OUTSIDE SOURCEREGISTRY SAFE SUBSET / OPEN / DEFERRED** |
| Whole remaining-legacy acceptance | **NO** |

---

## Verification

| Gate | Result |
|------|--------|
| DEDICATED ORACLE | **13 / 13 PASS** |
| FOCUSED | **16 files / 365 PASS** |
| FULL CHECK | **222 files / 3018 PASS** |
| BUILD | **PASS / 662 modules** |
| E2E | **NOT_REQUIRED / NOT_RUN** |
| BUSINESS / SECURITY | **PASS** |
| STALE ASSERTIONS | **0** |
| TEST WEAKENING | **0** |

---

## Nonblocking debt

| Class | Disposition |
|-------|-------------|
| `sourcesHandlers.ts` `#btn-open-source-registry` | **OUTSIDE_T603_NONBLOCKING_DEBT** — LIVE DOM EMITTER=NO; RUNTIME REACHABLE=NO; DIRECT FILE DEPENDENCY=NO. **Not cleaned.** |
| `sourcesHandlers.ts` `.btn-open-agent-sources` | **OUTSIDE_T603_NONBLOCKING_DEBT** — no live Product emitter. **Not cleaned.** |
| Orphan `.source-suggestion-*` CSS | **OUTSIDE_T603_NONBLOCKING_DEBT**. **Not cleaned.** |
| Historical comments / negative-test textual references | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Remaining leftover family `OnboardingWizard.ts` | Outside subset. Still present. **Not accepted here.** |

OUTSIDE SOURCEREGISTRY SAFE SUBSET = YES  
BLOCKS SOURCEREGISTRY T603 = NO  
**BLOCKING DEBT = NONE**  
**NONBLOCKING DEBT = PRESENT / SEPARATED / OUTSIDE_T603**

Cleanup of handlers, CSS, comments, Onboarding, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

`modalPresenter` omits leftover SourceRegistry · Onboarding import / branch / `renderOnboardingWizard` preserved · no SourceRegistry exclusive slot · `SourcesPanel` / `#8` / `#9` / poll-one / `#26` unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 SOURCEREGISTRY UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** |
| REMAINING OPEN FAMILIES | `OnboardingWizard.ts` only |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_ONBOARDING_PRODUCT_DECISION` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, handler/comment/CSS cleanup, Onboarding migration, global T-010-603 closure, T-010-604, or a global A43 PASS.
