# T603 React Parity — `#16` Remove / Reopen Curation

**Status:** `CURATION_16_FORMALLY_ACCEPTED`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `8a1c23cb077fb26cad80ccf5e7770b9528cd8e1a`  
**Implementation commit:** `8a1c23cb077fb26cad80ccf5e7770b9528cd8e1a`  
**Priority / frontier:** `POST_SOURCE_FRONTIER_16`  
**Registry:** `#16` — ClientWorkspace deliver · Remove / reopen curation  
**Application:** CR-1 Execution Delivery  
**Canonical commands:** `RemoveCuration` · `ReopenCuration`  
**Presentation model:** `ONE_WAVE`

This record accepts the **T603 React presentation wave** for residual `#16`.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** `#21` advisor `AddAdviceActionToCuration`.  
It is **not** `#22` scoring / recommendations.  
It is **not** `#33` `CreateContentDraft` / SPEC-005.

The filename uses residual `#16`, not wave **P16** (`t-010-p16-save-content-draft-parity.md` remains `#31`).

Historical Source Management, P3B, P16, and earlier acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA |
|------|-----|
| CR-1 `#16-R` / `#16-O` FREEZE | Wave B6 `RemoveCuration` · `ReopenCuration` |
| PHASE-6 PRIORITY | `0c3d984` · `PHASE6_RESIDUAL_PRIORITY_28_P3B` |
| SOURCE MANAGEMENT ACCEPTANCE | `ef68ae0` |
| POST-SOURCE FRONTIER | `POST_SOURCE_FRONTIER_16` |
| DESIGN DECISION | `CURATION_16_READY_FOR_BOUNDED_IMPLEMENTATION` |
| FEATURE | `8a1c23cb077fb26cad80ccf5e7770b9528cd8e1a` |
| Pre-acceptance HEAD | `8a1c23cb077fb26cad80ccf5e7770b9528cd8e1a` |

Feature `8a1c23c` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`8a1c23c`)

SUBJECT = `feat(react): add remove reopen curation parity`

| Class | Files |
|-------|--------|
| PRODUCT_UI | `src/ui/modules/pages/ReactClientWorkspacePage.tsx` |
| PRODUCT_HOOK | `src/ui/hooks/useWave3Data.ts` |
| COMMAND_ADAPTER | `src/ui/commands/commandSeam.ts` |
| TEST | `tests/reactParityWave16RemoveReopenCuration.test.ts` |
| TEST | `tests/reactMigrationPhase3Architecture.test.ts` |
| TEST | `tests/reactParityWaveP10DecideCuration.test.ts` |
| TEST | `tests/reactParityWaveP7DeliverySend.test.ts` |
| E2E | `e2e/reactParityWave16RemoveReopenCuration.spec.ts` |

**Unauthorized modifications in feature:** Application **0** · Domain **0** · Auth **0** · canonical `RemoveCuration` **0** · canonical `ReopenCuration` **0** · Firebase rules **0** · Firestore business authority **0** · Registry **0** · Governance **0** · `#21` **0** · `#22` **0** · `#33` **0** · SPEC-005 **0** · pipeline **0** · legacy deletions **0** · unrelated **0**.

---

## Accepted authority (unchanged)

| Field | Value |
|-------|-------|
| `#16-R` COMMAND | `RemoveCuration` (`createRemoveCuration`) — physical delete |
| `#16-O` COMMAND | `ReopenCuration` (`createReopenCuration`) — decision reset |
| CONSUMER | `executionDeliveryConsumer.removeCuration` / `reopenCuration` |
| SEAM | `executionDeliveryCommands.removeCuration` / `reopenCuration` |
| HOOKS | `useRemoveCuration` · `useReopenCuration` |
| HOST | existing `DeliverPanel` on `ReactClientWorkspacePage` |
| Public input | `requestedClientId` from trusted / `narrowToClient` scope · `curationEntryId` |
| Caller organization / role | **0** |
| CU? | **YES** |
| OWNER | CR-1 Execution Delivery Application |
| React dbService business write | **0** |
| Direct Firestore business write from React | **0** |
| LOCAL DELETE / REOPEN RESET | **NO** |
| LOCAL TRANSITION TABLE | **NO** |
| EXTRA REACT `CURATION_REMOVED` AUDIT | **NO** (Application owns none; legacy handler extra is not ported) |

Canonical commands remain responsible for ADMIN role, trusted org/client, authoritative curation reload, ownership match, physical delete, and decision reset (destination/rationale/decided fields; preserved angle/brief/package/signal/thesis).

Mutation paths:

React DeliverPanel pending row → `Quitar` → `useRemoveCuration` → `executionDeliveryCommands.removeCuration` → consumer → `RemoveCuration`.

React DeliverPanel readyEntries row → `Reabrir` → `useReopenCuration` → `executionDeliveryCommands.reopenCuration` → consumer → `ReopenCuration`.

`CURATION_NOT_FOUND` maps to bounded failure (`El ítem de curación ya no existe.`). It is not converted into a success toast.

---

## Button visibility

| Field | Value |
|-------|-------|
| pending membership | **Quitar** |
| readyEntries membership | **Reabrir** |
| packaged / draft items | **no Reabrir** (`#17` item Quitar retained) |
| NEW READ FIELDS | **0** |
| LOCAL TRANSITION TABLE | **NO** |
| CONFIRMATION | **NONE** (legacy parity) |
| FACTUAL VISIBILITY | **PASS** |

---

## Tenant isolation / query invalidation

| Field | Value |
|-------|-------|
| CLIENT SCOPE | trusted / `narrowToClient(workspaceClientId)` |
| ORG SCOPE | session-derived |
| ROLE | session-derived (canonical ADMIN) |
| CALLER-SUPPLIED ROLE / TRUSTED ORG | **NO** |
| CROSS-CLIENT REMOVE / REOPEN | **FAIL-CLOSED** |
| UNKNOWN ID | **FAIL-CLOSED** (`CURATION_NOT_FOUND` compat → error) |
| CLIENT ROLE | `ACTOR_NOT_AUTHORIZED` |
| TENANT ISOLATION | **PASS** |
| KEYS INVALIDATED | `compatibility` / `workspace-deliver` |
| RADAR / TASK / SESSION / GLOBAL TENANT | **NO** |
| P15 COMPATIBILITY CONTRACT PRESERVED | **YES** (tenant-scoped key; invalidate, do not patch) |
| QUERY INVALIDATION | **PASS** |

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY `ClientWorkspace.ts` | **RETAINED** |
| LEGACY `curationHandlers.ts` | **RETAINED** |
| LEGACY Quitar (`btn-remove-curation`) | **RETAINED** |
| LEGACY Reabrir (`btn-reopen-curation`) | **RETAINED** |
| ROLLBACK SWITCH | **YES** (`applyUiMode('legacy')` / shell to-legacy) |
| LEGACY MODE | **FUNCTIONAL** |
| REACT MODE | **FUNCTIONAL** |
| DATA MIGRATION | **NONE** |
| T-010-603 DELETION AUTHORIZED | **NO** |
| LEGACY DELETION | **0** |
| ROLLBACK | **PASS** |

Formal React parity does **not** mean `REMOVE_LEGACY` or T-010-603 deletion.  
Registry disposition remains `DISPLAY_ONLY_REACT`. Registry file was **not** modified.

---

## Historical test reconciliation

All three historical edits in `8a1c23c` are `STALE_EXPECTATION_RECONCILIATION`.

| File | Previous intent | New intent | Why required |
|------|-----------------|------------|--------------|
| `tests/reactMigrationPhase3Architecture.test.ts` | treat `removeCuration` / `reopenCuration` as blocked Phase-3 db mutators | drop those two names from `BLOCKED_MUTATORS`; comment that they are CR-1 `#16` via the seam | `#16` is now an intentional React-native seam call (`\bremoveCuration\s*\(` would false-fail) |
| `tests/reactParityWaveP10DecideCuration.test.ts` | DeliverPanel/seam must not contain the substrings `proposeAngle` / `removeCuration` / `reopenCuration` | panel forbids **direct function calls** (`\bname\s*\(`); seam still requires `runCurationDecidePresentation` and no `dbService`; decide **composite** still forbids `#16` | hook identifiers (`useRemoveCuration`) and new seam adapters made file-wide substring bans obsolete |
| `tests/reactParityWaveP7DeliverySend.test.ts` | workspace/modal must not contain those substrings | forbid **direct consumer invocation** with word-boundary `name(` | prevent false match on hook names; still proves P7 send UI does not call those consumers |

Specifically:

A. Removing `#16` from blocked mutators is correct because `#16` is now intentionally React-native.  
B. Stale “`#16` must be absent” negatives no longer apply; `addRecommendation`, `dbService`, Deliver handoff, and the decide composite `#16` ban remain.  
C. The P7 word-boundary adjustment prevents false matching and does **not** reduce the consumer-invocation assertion.

TEST WEAKENING = **0**  
UNRELATED TEST CHANGE = **0**  
HISTORICAL TEST RECONCILIATION = **PASS**

---

## Mandatory gate matrix (this review)

| Gate | Required | Result |
|------|----------|--------|
| `#16` FOCUSED | PASS, ≥18 | `tests/reactParityWave16RemoveReopenCuration.test.ts` **19/19 PASS** (A–R + authority boundary) |
| `#16` E2E | 4 / 4 | `e2e/reactParityWave16RemoveReopenCuration.spec.ts` **4/4 PASS** (remove · reopen · fail-closed · rollback) |
| CR-1 WAVE B6 | PASS | `tests/cr1WaveB6RemoveReopenCuration.test.ts` **25/25 PASS** |
| DELIVER REGRESSIONS | PASS | P10 **14** · P11 **16** · P12 **18** · P13 **22** PASS |
| REACT REGRESSION | PASS | Phase-3 pages **19** · Phase-3 architecture **27** PASS |
| DELIVER E2E | 8 PASS | P7/P10/P11/P12/P13 **8/8 PASS** |
| HISTORICAL TEST RECONCILIATION | PASS | **PASS** (stale-expectation only) |
| FULL CHECK | PASS | **2565 / 2565 PASS** |
| BUILD | PASS | **PASS** |
| TENANT ISOLATION | PASS | **PASS** |
| REMOVE AUTHORITY | PASS | **PASS** (canonical) |
| REOPEN AUTHORITY | PASS | **PASS** (canonical) |
| `#21` EXCLUSION | PASS | **PASS** |
| `#22` EXCLUSION | PASS | **PASS** |
| `#33` EXCLUSION | PASS | **PASS** |
| NEW BUSINESS AUTHORITY | 0 | **0** |
| PRODUCT DEFECTS | 0 | **0** |
| LEGACY DELETION | 0 | **0** |
| ROLLBACK | PASS | **PASS** |

These are the final implementation-tree runs immediately before commit `8a1c23c`.

REMOTE NETWORK = **NO**  
REMOTE FIRESTORE = **NO**  
DETERMINISTIC FIXTURES = **YES**

---

## Focused coverage (`tests/reactParityWave16RemoveReopenCuration.test.ts`)

CASE COUNT = **19**

| Case | Proves |
|------|--------|
| A | pending renders `Quitar` |
| B | readyEntries renders `Reabrir` |
| C | packaged/draft items do not expose `Reabrir` |
| D | remove delegates to canonical `RemoveCuration` |
| E | reopen delegates to canonical `ReopenCuration` |
| F/G | narrowed workspace `requestedClientId` only |
| H | no direct curation DB write |
| I | no local transition table |
| J/K | wrong-client fail-closed |
| L | CLIENT / missing ADMIN fails closed |
| M | `CURATION_NOT_FOUND` is bounded failure |
| N/O | invalidate only `workspace-deliver` |
| P | `#21` unchanged |
| Q | `#22` / `#33` unchanged |
| R | legacy Quitar/Reabrir retained |
| authority boundary | React does not import Application writers |

canonical remove = **YES**  
canonical reopen = **YES**  
cross-client fail-closed = **YES**  
CLIENT unauthorized = **YES**  
no direct DB writes = **YES**  
no local transition table = **YES**  
query invalidation bounded = **YES**  
adjacent residuals unchanged = **YES**  
legacy retained = **YES**  
FOCUSED EVIDENCE = **PASS**

---

## Adjacent residual exclusion

| Field | Value |
|-------|-------|
| `#21` MODIFICATIONS | **0** |
| `#21` ADVISOR AUTHORITY | **UNCHANGED** |
| `#22` MODIFICATIONS | **0** |
| `#22` AUTHORITY | **UNCHANGED** |
| `#33` MODIFICATIONS | **0** |
| SPEC-005 MODIFICATIONS | **0** |
| PIPELINE MODIFICATIONS | **0** |
| EXCLUSION CONTRACT | **PASS** |

---

## Debt

| Item | Class |
|------|--------|
| React `#16` presentation without formal record | **RESOLVED** (this file) |
| Canonical `RemoveCuration` / `ReopenCuration` | **RESOLVED** (CR-1 Wave B6 frozen) |
| Historical P7/P10/Phase-3 `#16`-absent negatives | **RESOLVED** (stale-expectation reconciliation) |
| Legacy `ClientWorkspace` / `curationHandlers` Quitar/Reabrir | **FUTURE_T603** (required until independent T-010-603 subset-removal authorization) |
| A43 / T-010-603 SAFE LEGACY SUBSET | **FUTURE_RESIDUAL** (still **NONE**; not unlocked by `#16`) |
| `#21` advisor `AddAdviceActionToCuration` | **FUTURE_RESIDUAL** |
| `#33` `CreateContentDraft` / SPEC-005 | **FUTURE_RESIDUAL** (external-owner constrained) |

BLOCKING COUNT = **0**  
NONBLOCKING COUNT = **0**  
FUTURE RESIDUALS = legacy deliver host · A43 / T603 · `#21` · `#33` · remaining Phase-6 rows

Intentional legacy retention for rollback is **not** a product defect.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| `#16` PRODUCT IMPLEMENTATION | **COMPLETE** |
| `#16` FORMAL ACCEPTANCE | **YES** |
| SAFE LEGACY SUBSET | **NONE** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |
| NEXT FRONTIER CANDIDATE | `#21` `AddAdviceActionToCuration` (leading remaining CU?=YES residual after Stage-1 spine + Source Management + `#16`; not selected by this record) |
| NEXT FRONTIER AUTHORIZED | **NO** |

Stage-1 cutover-spine residuals named by `PHASE6_RESIDUAL_PRIORITY_28_P3B` remain accepted. `#16` is now accepted. Remaining candidates (`#21` advisor, `#33`, CU?=NO, A43 / T603) require a separate residual-priority or design review.

**NEXT ACTION:** `T603_REACT_PARITY_POST_16_FRONTIER_REVIEW`  
**NEXT NODE AUTHORIZED:** **NO**
