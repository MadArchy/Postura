# T-010-603 — Client KPI weekly-chart legacy subset removal

**Status:** `PHASE6_KPI_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-21  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `1ca331fb25a625a93f820ebefcc935eaba3d8ded`  
**Implementation commit:** `1ca331fb25a625a93f820ebefcc935eaba3d8ded`  
**Physical removal subject:** `refactor(legacy): remove KPI renderer`  
**Candidate:** `src/components/KpiWeeklyChart.ts`  
**Predelete SHA256:** `c143abe86eccaaae687874fb5536fe65638bf9e3ccee3fe715539bb4bcdcd8ab`

This record accepts the **bounded T-010-603 admission** of the already-removed Client KPI weekly-chart HTML renderer after C1–C7.  
`KpiWeeklyChart.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| RESULTS CUTOVER | `972c72be01785f71d2e214321723d0ba91216026` |
| HOME CUTOVER | `0f38ee676bb79319234b9b2b9958b42ae1e19201` |
| C6 | `PHASE6_KPI_C6_VERIFIED_PASS` |
| C7 | `PHASE6_KPI_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_KPI_T603_SAFE_SUBSET_READY_FOR_FORMAL_ACCEPTANCE` |
| FEATURE | `1ca331fb25a625a93f820ebefcc935eaba3d8ded` |

Feature `1ca331f` is HEAD at acceptance. This commit adds governance only. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`1ca331f`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/KpiWeeklyChart.ts` |
| Tests | `tests/phase6KpiWeeklyChartHomeCutover.test.ts`, `tests/phase6KpiWeeklyChartResultsCutover.test.ts`, `tests/phase6KpiHomeParity.test.ts`, `tests/phase6RollbackArchitecture.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## A43 unit (KPI leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — Home `ReactClientPortalPage` → `ReactKpiWeeklyChart`; Portal Results `client-results` → `Wave2Surface` → `ReactKpiWeeklyChart`; Workspace Results `ws-results` → `ReactClientWorkspacePage` → `ReactKpiWeeklyChart` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — Home / Results cutover and Home parity oracles retained |
| C4 Authority | PASS — read `useKpiWeekly` → `readKpiWeekly`; write `useRegisterConsultation` → `resultCommands.registerConsultation` → `registerResultRecordIntent` |
| C5 Tenant / security | PASS — no new authority; no direct `dbService` / repository from React KPI |
| C6 Rollback | PASS — Option E without the file (`PHASE6_KPI_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_KPI_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| KPI UNIT A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/KpiWeeklyChart.ts` only |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

---

## Verification

| Gate | Result |
|------|--------|
| FULL CHECK | **2802 PASS** · 206 files |
| BUILD | **PASS** · 659 modules · `KpiWeeklyChart` resolution **0** |
| Focused 20-file aggregate | **399 PASS** |
| Home / Results cutover | **10 / 10 PASS** |
| Home parity | **8 PASS** |
| Phase-2 architecture | **41 PASS** |
| Phase-1 A38 / rollback | **27 / 42 PASS** |
| Dossier / Opportunity cutover | **12 / 11 PASS** |
| FILE-PRESENCE CONFLICTS | **0** |
| PRODUCT E2E FAILURES CAUSED BY T603 | **0** |
| TEST WEAKENING | **0** |
| E2E | **NOT_RUN** (not required) |

---

## Nonblocking debt

| Class | Count | Disposition |
|-------|-------|-------------|
| Optional `getElementById('form-quick-kpi-consultation')` in `clientPortalHandlers.ts` | 1 | **OUTSIDE_T603_NONBLOCKING_DEBT** — no file import, no served DOM target, no init failure. **Not cleaned.** |
| Scanner `scripts/pilot-juan-walkthrough.mjs` | 1 | Non-product `fileHas` of the absent path; does not fail required gates. **Outside subset. Not cleaned.** |
| Historical stale comments / spec / matrix `MIGRATE` text | n | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Option-E E2E still expecting `#app` visible under `legacy` | 4 | Stale vs exclusive-slot cutover. **Not caused by `1ca331f`.** Future: `AUTHORIZE_PHASE6_OPTION_E_E2E_RECONCILIATION` |
| Wave2 Playwright Chromium missing | 5 | `ENVIRONMENT_FAILURE` — unit Wave2 **18 PASS**. Outside subset. |
| Remaining T603 candidates | 6 wave-2 leaves + blocked hosts | Global T603 **OPEN** |

**BLOCKING DEBT = 0**

Cleanup of handler, scanner, comments, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

Home slot `omit` · Results slot `omit` · exclusive ids `client-kpi-home` and `client-kpi-results` independently active · whole-leaf KPI id **NONE** · `clientPortalHandlers.ts` retained · `#form-add-result` retained · React KPI / commands / hooks / compatibility reads unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 KPI UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, handler/scanner/comment cleanup, Option-E E2E test edits, T-010-604, or a global A43 PASS.
