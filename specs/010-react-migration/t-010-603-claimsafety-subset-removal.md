# T-010-603 — ClaimSafety legacy subset removal

**Status:** `PHASE6_CLAIMSAFETY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-23  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `824e13b5e6b60fe18344b871dede048f37041de1`  
**Implementation commit:** `824e13b5e6b60fe18344b871dede048f37041de1`  
**Physical removal subject:** `refactor(legacy): remove claim safety renderer`  
**Candidate:** `src/components/ClaimSafetyPanel.ts`  
**Predelete SHA256:** `26874a7b5cb9957d2a79603411f110ba6b1bc5810f244bb11ca1ddb93dcd0ba1`

This record accepts the **bounded T-010-603 admission** of the already-removed ClaimSafety HTML renderer after C1–C7.

PHASE = 6  
LEAF = CLAIMSAFETY  
UNIT = CLAIMSAFETY  
T603 SAFE SUBSET = `src/components/ClaimSafetyPanel.ts`  
SAFE SUBSET SIZE = 1  
REMOVAL COMMIT = `824e13b5e6b60fe18344b871dede048f37041de1`  
REMOVAL SUBJECT = `refactor(legacy): remove claim safety renderer`  
C6 = `PHASE6_CLAIMSAFETY_C6_VERIFIED_PASS`  
C7 = `PHASE6_CLAIMSAFETY_C7_DELETION_ACCEPTANCE_VERIFIED`  
SAFE SUBSET REVIEW = `PHASE6_CLAIMSAFETY_T603_SAFE_SUBSET_VERIFIED`  
SAFE SUBSET RESULT = `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED`  
FORMAL DECISION = `PHASE6_CLAIMSAFETY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
FORMALLY ACCEPTED = YES  
CLAIMSAFETY LOCAL A43 = PASS  
CLAIMSAFETY UNIT A43 = PASS  
GLOBAL C3 = PARTIAL  
GLOBAL A43 = PARTIAL  
GLOBAL T603 = OPEN  
T604 = NOT_AUTHORIZED  
T604 ELIGIBLE = NO

`ClaimSafetyPanel.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** accept PageHeader, SourceRegistry, or Onboarding.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, KPI acceptance, ClientProfile acceptance, ProofWall acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| WORKSPACE PRODUCTION CUTOVER | `bfa99538222e24bf04fbde912d88c084eea8e875` |
| CONTENT PREVIEW CUTOVER | `13bf7106d1e5e73b6a5b90349b6436fdb919fce6` |
| CONTENT EDITOR + LEGACYAPP CUTOVER | `0e1a5e55e48a8896353b70d8aafc4df34ae13caf` |
| FILE ABSENCE | `824e13b5e6b60fe18344b871dede048f37041de1` |
| C6 | `PHASE6_CLAIMSAFETY_C6_VERIFIED_PASS` |
| C7 | `PHASE6_CLAIMSAFETY_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_CLAIMSAFETY_T603_SAFE_SUBSET_VERIFIED` |
| FEATURE | `824e13b5e6b60fe18344b871dede048f37041de1` |

Feature `824e13b` is HEAD at acceptance. This commit adds governance only. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`824e13b`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/ClaimSafetyPanel.ts` |
| Tests | `tests/phase6ClaimSafetyWorkspaceProductionCutover.test.ts`, `tests/phase6ClaimSafetyContentPreviewCutover.test.ts`, `tests/phase6ClaimSafetyContentEditorCutover.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## Physical evidence

| Field | Value |
|-------|--------|
| ClaimSafetyPanel.ts | **ABSENT** |
| stub / alias / redirect / wrapper / renamed equivalent / duplicate legacy renderer | **NONE** |
| product import graph | **0** |
| product call graph | **0** |
| dynamic / barrel / registry | **0** / **0** / **0** |
| runtime discovery | **0** |
| PRODUCT GRAPH | **ZERO** |
| STATIC PRODUCT IMPORTERS | **0** |
| LEGACY CALLERS | **0** |
| build reachability | **NO** |
| SECOND DELETE | **NO** |

---

## React replacement

| Surface | Owner | Status |
|---------|--------|--------|
| Workspace Production | `ReactClaimSafetyBadge` / `ReactClaimSafetyPanel` on React `ProductionPanel` | **SERVED** |
| Content Preview | `ReactClaimSafetyPanel` on `ReactContentPreviewModal` | **SERVED** |
| Content Editor | React ClaimSafety replacement | **NONE** (P16 accepted omission) |

Locate is presentation intent only and is **NONE** on the served preview path.

---

## Presentation evidence

| Field | Value |
|-------|--------|
| workspace production slot | `omit` |
| workspace production id | `client-workspace-production-claim-safety` |
| content preview slot | `omit` |
| content preview id | `client-content-preview-claim-safety` |
| content editor slot | `omit` |
| content editor id | `client-content-editor-claim-safety` |
| ALL DISTINCT | **YES** |
| COLLISIONS | **0** |
| Option-E without file | **PASS** |
| A38 | **PASS** |

---

## Authority evidence

| Field | Value |
|-------|--------|
| AUTHORITY | **UNCHANGED** |
| SPEC-006 | **UNCHANGED** |
| publication | canonical `AuthorizePublication` |
| advisory cores | `claimSafetyGateCore` / `claimSafetyCore` unchanged |
| save path | leftover `aiService.reviewDraftClaims` **PRESERVED** |
| NEW AUTHORITY | **0** |
| DIRECT DB | **0** |
| LEGACY CLAIMSAFETY UI AUTHORITY | **UNSERVED** |
| HANDLER FILE DEPENDENCY | **NO** |
| HANDLER RUNTIME DEPENDENCY | **NO** |
| HANDLER CLEANUP REQUIRED | **NO** |

---

## A43 unit (ClaimSafety leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — Workspace Production `ReactClientWorkspacePage` → `ReactClaimSafetyBadge` / `ReactClaimSafetyPanel`; Content Preview `ReactModals` → `ReactClaimSafetyPanel`; Editor P16 accepted omission (no live/stored React ClaimSafety panel) |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — workspace / preview / editor / rollback / Phase-2 oracles retained |
| C4 Authority | PASS — publication remains `AuthorizePublication` (SPEC-006); React ClaimSafety is `ADVISORY_PROJECTION` only; `reviewDraftClaims` save path preserved |
| C5 Tenant / security | PASS — no new authority; no direct `dbService` from served React ClaimSafety (prop-driven) |
| C6 Rollback | PASS — Option E without the file (`PHASE6_CLAIMSAFETY_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_CLAIMSAFETY_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, renamed equivalent, duplicate renderer, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| CLAIMSAFETY UNIT A43 | **PASS** |
| CLAIMSAFETY LOCAL A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/ClaimSafetyPanel.ts` only |
| SAFE SUBSET SIZE | **1** |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

Explicitly **outside** this subset: `contentHandlers.ts` save-path `reviewDraftClaims`, `ReactClaimSafetyPanel`, Workspace / Preview / Editor hosts, ClaimSafety slot files, exclusive-slot registry, CSS, `PageHeader.ts`, `SourceRegistryModal.ts`, `OnboardingWizard.ts`, Application, Domain, Auth, Persistence, SPEC-006.

---

## Boundary evidence

| Surface | State |
|---------|--------|
| Dossier T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| Opportunity T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| KPI T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| ClientProfile T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| ProofWall T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| PageHeader | **OUTSIDE CLAIMSAFETY SAFE SUBSET** |
| SourceRegistry | **OUTSIDE CLAIMSAFETY SAFE SUBSET** |
| Onboarding | **OUTSIDE CLAIMSAFETY SAFE SUBSET** |
| Whole remaining-legacy acceptance | **NO** |

---

## Verification

| Gate | Result |
|------|--------|
| WORKSPACE PRODUCTION | **10 PASS** |
| CONTENT PREVIEW | **10 PASS** |
| CONTENT EDITOR P16 | **10 PASS** |
| CLAIM EVIDENCE | **PASS** |
| CLAIMSAFETY CORE | **PASS** |
| PHASE-1 | **27 PASS** |
| PHASE-2 | **41 PASS** |
| ROLLBACK | **65 PASS** |
| NAVIGATION | **3 PASS** |
| CLOSED SUBSETS | **PASS** |
| FOCUSED | **26 files / 456 PASS** |
| FULL CHECK | **215 files / 2924 PASS** |
| BUILD | **PASS / 657 modules** |
| E2E | **NOT_REQUIRED / NOT_RUN** |
| BUSINESS / SECURITY | **PASS** |
| STALE ASSERTIONS | **0** |
| TEST WEAKENING | **0** |

---

## Nonblocking debt

| Class | Disposition |
|-------|-------------|
| Leftover-only CSS `.claim-review-ack` | **OUTSIDE_T603_NONBLOCKING_DEBT** — no served leftover DOM target. **Not cleaned.** |
| Comments in hosts / slots / `reactExclusiveSlots.ts` that still name `ClaimSafetyPanel.ts` | Outside subset / nonblocking. **Not cleaned.** |
| Host-oracle titles that still say “C6 is not yet verified; C7 and T603 are not executed” | Historical wording. Assertions remain valid (file ABSENT; `tasks.md` still `T-010-603 … NOT AUTHORIZED`). **Not cleaned.** |
| Historical SPEC / governance references | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Remaining leftover families `PageHeader.ts`, `SourceRegistryModal.ts`, `OnboardingWizard.ts` | Outside subset. Still present. **Not accepted here.** |

OUTSIDE SAFE SUBSET = YES  
BLOCKS FORMAL T603 ACCEPTANCE = NO  
**BLOCKING DEBT = NONE**  
**NONBLOCKING DEBT = PRESENT / SEPARATED**

Cleanup of CSS, comments, remaining leftover families, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

Workspace production slot `omit` · exclusive id `client-workspace-production-claim-safety` active · content preview slot `omit` · exclusive id `client-content-preview-claim-safety` active · content editor slot `omit` · exclusive id `client-content-editor-claim-safety` active · `reviewDraftClaims` retained · React ClaimSafety / commands / hooks / compatibility reads unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 CLAIMSAFETY UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| REMAINING OPEN FAMILIES | `PageHeader.ts`, `SourceRegistryModal.ts`, `OnboardingWizard.ts` |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, CSS/comment cleanup, PageHeader / SourceRegistry / Onboarding migration, T-010-604, or a global A43 PASS.
