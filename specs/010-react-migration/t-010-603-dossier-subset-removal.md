# T-010-603 — Client workspace dossier legacy subset removal

**Status:** `PHASE6_DOSSIER_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-21  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `564aa1f0064551e32a4850c524d5f0fec48d8f90`  
**Implementation commit:** `564aa1f0064551e32a4850c524d5f0fec48d8f90`  
**Candidate:** `src/components/MasterDossierPanel.ts`  
**Predelete SHA256:** `b05a39706df6f6c7d4cd20e1f6b93f4ec333a6eb19b4d72261921e074dce9249`

This record accepts the **bounded T-010-603 removal** of the ClientWorkspace dossier HTML renderer after C1–C7.  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| CUTOVER | `e191221842e9e64f461857f7cd59ece2c12897f6` |
| C6 | `PHASE6_DOSSIER_C6_VERIFIED_PASS` |
| C7 | `PHASE6_DOSSIER_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_DOSSIER_T603_SUBSET_REVIEW_READY_FOR_IMPLEMENTATION` |
| FEATURE | `564aa1f0064551e32a4850c524d5f0fec48d8f90` |

Feature `564aa1f` is HEAD at acceptance. This commit adds governance only.

---

## Feature manifest (`564aa1f`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/MasterDossierPanel.ts` |
| Tests | `tests/phase6DossierCutover.test.ts`, `tests/phase6RollbackArchitecture.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts` |
| Governance | `specs/010-react-migration/migration-matrix.md` |
| Product / React / handlers / ClientWorkspace | **0** |

---

## A43 unit (dossier leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — `ReactMasterDossierPanel` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — React C2 field/label oracles retained |
| C4 Authority | PASS |
| C5 Tenant / security | PASS |
| C6 Rollback | PASS — Option E without the file |
| C7 Acceptance | PASS |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT |
| DOSSIER UNIT A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/MasterDossierPanel.ts` only |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

---

## Verification

| Gate | Result |
|------|--------|
| FULL CHECK | **2748 PASS** |
| BUILD | **PASS** · 661 modules · `MasterDossierPanel` resolution **0** |
| Focused cutover / rollback / Phase-2 architecture | **12 / 27 / 41 PASS** |
| Phase-1 A38 | **27 PASS** |
| Wave2 unit | **18 PASS** |
| T-010-403 unit | **11 PASS** |
| T508 readiness / snapshot | **18 / 13 PASS** |
| P2 thesis unit | **25 PASS** |
| FILE-PRESENCE CONFLICTS | **0** |
| PRODUCT E2E FAILURES CAUSED BY T603 | **0** |

---

## Nonblocking debt

| Class | Count | Disposition |
|-------|-------|-------------|
| Option-E E2E still expecting `#app` visible under `legacy` | 4 | Stale vs cutover `e191221` (exclusive slot already served React). **Not caused by `564aa1f`.** Future: `AUTHORIZE_PHASE6_OPTION_E_E2E_RECONCILIATION` |
| P2 E2E `react-dossier-empty` | 1 | `SEED_STATE` — React served empty dossier; React file unchanged |
| Wave2 Playwright Chromium missing | 5 | `ENVIRONMENT_FAILURE` — rerun without install blocked; unit Wave2 PASS |
| Remaining T603 candidates | 4+ wave-2 leaves + blocked hosts | Global T603 **OPEN** |

**BLOCKING DEBT = 0**

---

## Boundaries (unchanged)

ClientWorkspace slot `omit` · exclusive slot `client-workspace-dossier` · `dossierHandlers.ts` retained · React dossier / commands / hooks / routes unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 DOSSIER UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, Option-E E2E test edits, T-010-604, or a global A43 PASS.
