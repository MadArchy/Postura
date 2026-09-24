# T-010-603 — Onboarding legacy subset removal

**Status:** `PHASE6_ONBOARDING_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-24  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `8ba24a5ef4e03efe75e9e97e556a5f0f26eb8722`  
**Implementation commit:** `8ba24a5ef4e03efe75e9e97e556a5f0f26eb8722`  
**Physical removal subject:** `refactor(legacy): remove onboarding wizard`  
**Candidate:** `src/components/OnboardingWizard.ts`

This record accepts the **bounded T-010-603 admission** of the already-removed Onboarding leftover wizard after C1–C7.

PHASE = 6  
LEAF = ONBOARDING  
UNIT = ONBOARDING  
T603 SAFE SUBSET = `src/components/OnboardingWizard.ts`  
SAFE SUBSET SIZE = 1  
REMOVAL COMMIT = `8ba24a5ef4e03efe75e9e97e556a5f0f26eb8722`  
REMOVAL SUBJECT = `refactor(legacy): remove onboarding wizard`  
CUTOVER COMMIT = `a9f76050cc9ab06aa485646f94ec52f45d53ff32`  
CUTOVER SUBJECT = `feat(react): cut over onboarding`  
C6 = `PHASE6_ONBOARDING_C6_VERIFIED_PASS`  
C7 = `PHASE6_ONBOARDING_C7_DELETION_ACCEPTANCE_VERIFIED`  
SAFE SUBSET REVIEW = `PHASE6_ONBOARDING_T603_SAFE_SUBSET_VERIFIED`  
SAFE SUBSET RESULT = `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED`  
FORMAL DECISION = `PHASE6_ONBOARDING_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
FORMALLY ACCEPTED = YES  
ONBOARDING LOCAL A43 = PASS  
ONBOARDING UNIT A43 = PASS  
GLOBAL C3 = PARTIAL  
GLOBAL A43 = PARTIAL  
GLOBAL T603 = OPEN  
T604 = NOT_AUTHORIZED  
T604 ELIGIBLE = NO

`OnboardingWizard.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to clean nonblocking debt.  
It does **not** promote global A43 to PASS.  
It does **not** claim Phase 6 complete.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, KPI acceptance, ClientProfile acceptance, ProofWall acceptance, ClaimSafety acceptance, PageHeader acceptance, SourceRegistry acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| PRODUCT DECISION | `PHASE6_ONBOARDING_PRODUCT_DECISION_RESOLVED` (`1A + 2B + 3B + 4B + 5B + 6B`) |
| CUTOVER DESIGN | `PHASE6_ONBOARDING_CUTOVER_DESIGN_RESOLVED` |
| CUTOVER IMPLEMENTATION | `a9f76050cc9ab06aa485646f94ec52f45d53ff32` |
| CUTOVER OBSERVATION | `PHASE6_ONBOARDING_CUTOVER_OBSERVATION_VERIFIED` |
| FILE ABSENCE REVIEW | `PHASE6_ONBOARDING_FILE_ABSENCE_REVIEW_VERIFIED` |
| FILE ABSENCE | `8ba24a5ef4e03efe75e9e97e556a5f0f26eb8722` |
| C6 | `PHASE6_ONBOARDING_C6_VERIFIED_PASS` |
| C7 | `PHASE6_ONBOARDING_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_ONBOARDING_T603_SAFE_SUBSET_VERIFIED` |
| FEATURE | `8ba24a5ef4e03efe75e9e97e556a5f0f26eb8722` |

Feature `8ba24a5` is HEAD at acceptance. This commit adds governance only. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`8ba24a5`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/OnboardingWizard.ts` |
| Tests | `tests/phase6OnboardingCutover.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts`, `tests/phase6PageHeaderClientWorkspaceCutover.test.ts`, `tests/phase6PageHeaderClientPortalCutover.test.ts`, `tests/phase6PageHeaderManagerCockpitCutover.test.ts`, `tests/phase6SourceRegistryCutover.test.ts`, `tests/phase6ClientProfileCutover.test.ts`, `tests/reactParityWaveP6ClientOnboardingWrite.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## Physical evidence

| Field | Value |
|-------|--------|
| OnboardingWizard.ts | **ABSENT** |
| stub / alias / redirect / wrapper / renamed equivalent / duplicate leftover renderer | **NONE** |
| product import graph | **0** |
| product call graph | **0** |
| dynamic / barrel / registry | **0** / **0** / **0** live Product |
| runtime discovery | **0** |
| PRODUCT GRAPH | **ZERO** |
| STATIC PRODUCT IMPORTERS | **0** |
| PRODUCT CALLERS | **0** |
| LIVE LEGACY PRESENTERS | **0** |
| LIVE AUTO-OPEN PRESENTATION EMITTERS | **0** |
| build reachability | **NO** |
| SECOND DELETE | **NO** |
| PRODUCT MODIFICATION | **0** |
| REACT MODIFICATION | **0** |
| TEST MODIFICATION | **0** |

---

## React replacement

| Surface | Owner | Status |
|---------|--------|--------|
| Client profile / Mi perfil | `ReactOnboardingWizard` on `client-profile` / Wave2 profile group / existing `#react-root` | **SERVED / PRESERVED** |

Canonical `#10 ApplyOnboardingStep` remains on scoped `useApplyOnboardingStep` → `masterProfileCommands.applyOnboardingStep` → Application. Scoped reads remain `useOnboardingContext` → `readOnboardingContext(TrustedTenantScope)`. Step-6 completion remains `COMPLETED` / `ACTIVE` with seam `notifyManager` + `authService.clearOnboardingFlag` and presentation hop to `client-thesis`.

---

## Presentation evidence

| Field | Value |
|-------|--------|
| leftover cutover | omit at `modalPresenter` (no Onboarding import / branch / redirect / `forceClose`) |
| unknown-modal fallback | `return html('')` **PRESERVED** |
| LegacyApp auto-open | **RETIRED** (`mustCompleteOnboarding` → `activeModal='onboarding'` absent; field itself preserved) |
| Onboarding exclusive slot | **NONE** |
| Onboarding exclusive id | **NONE** |
| OPTION-E | **NOT_REQUIRED** |
| A38 | **PASS** |

---

## Authority evidence

| Field | Value |
|-------|--------|
| AUTHORITY | **UNCHANGED / PASS** |
| #10 AUTHORITY | **PRESERVED** |
| SPEC-006 | **UNCHANGED** |
| AUTHORITY BROADENING | **0** |
| ROLE / TENANT / AUTH / TRUST CHANGE | **0** |
| DOMAIN / PERSISTENCE / DATA MIGRATION | **0** / **0** / **NONE** |
| NEW AUTHORITY | **0** |
| DIRECT DB | **0** |
| LEGACY UNSCOPED READ COPY | **0** |
| HANDLER FILE DEPENDENCY | **NO** |
| HANDLER CLEANUP REQUIRED | **NO** |

---

## Deliberate Product retirements (`1A + 2B + 3B + 4B + 5B + 6B`)

| Item | State |
|------|--------|
| CONTINUE-LATER | **RETIRED** |
| SPECIAL DIRECT DB `IN_PROGRESS` | **0** |
| AUTO-OPEN | **RETIRED** |
| LEGACY WORKSPACE LAUNCH | **RETIRED / NONCANONICAL DEAD DEBT** |
| AUTO-PROPOSAL | **RETIRED** |
| LEGACY `thesis-editor` | **RETIRED** |

These are intentional Product decisions, **not** unresolved parity gaps.

---

## A43 unit (Onboarding leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — `ReactOnboardingWizard` on `client-profile` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — dedicated / P6 write / Phase-2 / PageHeader / SourceRegistry / ClientProfile / rollback oracles retained |
| C4 Authority | PASS — leftover was presentation only; `#10` remains Application-owned |
| C5 Tenant / security | PASS — no new authority; scoped reads/writes preserved |
| C6 Rollback | PASS — omit-at-`modalPresenter` without the file (`PHASE6_ONBOARDING_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_ONBOARDING_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, renamed equivalent, duplicate renderer, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| ONBOARDING UNIT A43 | **PASS** |
| ONBOARDING LOCAL A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/OnboardingWizard.ts` only |
| SAFE SUBSET SIZE | **1** |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | none remaining |

Explicitly **outside** this subset: `#btn-open-onboarding` / leftover `activeModal='onboarding'` handler path, historical docs/comments, negative/absence-oracle path strings, shared `.onboarding-coverage-*` CSS retained for React, `ReactOnboardingWizard`, `modalPresenter`, `LegacyApp`, exclusive-slot registry, Application, Domain, Auth, Persistence, SPEC-006.

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
| SourceRegistry T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| Whole remaining-legacy acceptance | **NO** (local Onboarding only; global T603 remains OPEN) |

---

## Verification

| Gate | Result |
|------|--------|
| DEDICATED ORACLE | **12 / 12 PASS** |
| FOCUSED | **15 files / 321 PASS** |
| FULL CHECK | **223 files / 3030 PASS** |
| BUILD | **PASS / 661 modules** |
| E2E | **NOT_REQUIRED / NOT_RUN** |
| BUSINESS / SECURITY | **PASS** |
| STALE ASSERTIONS | **0** |
| TEST WEAKENING | **0** |

---

## Nonblocking debt

| Class | Disposition |
|-------|-------------|
| `ClientWorkspace` `#btn-open-onboarding` | **OUTSIDE_T603_NONBLOCKING_DEBT** — LIVE DEFAULT-REACT DOM EMITTER=NO; PHYSICAL LEGACY DEPENDENCY=NO; RUNTIME OWNER=NO. **Not cleaned.** |
| `onboardingHandlers.ts` `activeModal='onboarding'` | **OUTSIDE_T603_NONBLOCKING_DEBT** — no live Product presenter after cutover. **Not cleaned.** |
| Historical documentation / comments | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Negative / absence-oracle path strings | Outside subset / nonblocking. |

OUTSIDE ONBOARDING SAFE SUBSET = YES  
BLOCKS ONBOARDING T603 = NO  
**BLOCKING DEBT = NONE**  
**NONBLOCKING DEBT = PRESENT / SEPARATED / OUTSIDE_T603**

Cleanup of handlers, comments, CSS, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

`modalPresenter` omits leftover Onboarding · LegacyApp auto-open retired · `ReactOnboardingWizard` / `#10` / scoped reads / completion seam unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 ONBOARDING UNIT | **FORMALLY_ACCEPTED** |
| ALL LOCAL LEGACY FAMILIES FORMALLY ACCEPTED | **YES** |
| GLOBAL T603 | **OPEN** (closure eligible for a **separate** gate; not closed here) |
| GLOBAL A43 | **PARTIAL** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** |
| REMAINING OPEN FAMILIES | **NONE** |
| NEXT FRONTIER | global T-010-603 closure / completion review (separate authorization required) |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize global T-010-603 closure, T-010-604, handler/comment cleanup, or a global A43 PASS.
