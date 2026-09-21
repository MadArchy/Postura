# T-010-603 — Client portal opportunity legacy subset removal

**Status:** `PHASE6_OPPORTUNITY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-21  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `7b194545fa3054624bd63e5a1f2ee926d4ff651a`  
**Implementation commit:** `7b194545fa3054624bd63e5a1f2ee926d4ff651a`  
**Candidate:** `src/components/OpportunityPanel.ts`  
**Predelete SHA256:** `e397cd65bcdf6db54f9784ec7ce20286a8bbe99cc112b62c6deaf737e331f4b6`

This record accepts the **bounded T-010-603 removal** of the ClientPortal opportunity HTML renderer after C1–C7.  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| CUTOVER | `09e5ecd4638836c1c997562a818c1a6a53903df6` |
| C6 | `PHASE6_OPPORTUNITY_C6_VERIFIED_PASS` |
| C7 | `PHASE6_OPPORTUNITY_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_OPPORTUNITY_T603_SUBSET_REVIEW_READY_FOR_IMPLEMENTATION` |
| FEATURE | `7b194545fa3054624bd63e5a1f2ee926d4ff651a` |

Feature `7b19454` is HEAD at acceptance. This commit adds governance only.

---

## Feature manifest (`7b19454`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/OpportunityPanel.ts` |
| Tests | `tests/phase6OpportunityCutover.test.ts`, `tests/phase6RollbackArchitecture.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts`, `tests/opportunityScoutPhase4.test.ts`, `tests/opportunityScoutPhase5Architecture.test.ts`, `tests/opportunityScoutConsumerArchitecture.test.ts` |
| Governance | `specs/010-react-migration/migration-matrix.md` |
| Product / React / handlers / ClientPortal | **0** |

---

## A43 unit (opportunity leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — `ReactOpportunityPanel` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — T-010-202 + cutover oracles retained |
| C4 Authority | PASS — canonical read `canonicalReads.ts` / `listOpportunitiesForClient`; consumer retained |
| C5 Tenant / security | PASS |
| C6 Rollback | PASS — Option E without the file |
| C7 Acceptance | PASS |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT |
| OPPORTUNITY UNIT A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/OpportunityPanel.ts` only |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

---

## Verification

| Gate | Result |
|------|--------|
| FULL CHECK | **2764 PASS** |
| BUILD | **PASS** · 660 modules · `OpportunityPanel` resolution **0** |
| Focused 8-file aggregate | **173 PASS** |
| Phase-1 A38 | **27 PASS** |
| Handler / bootstrap `t010404MainBootstrapReduction` | **9 PASS** |
| FILE-PRESENCE CONFLICTS | **0** |
| PRODUCT E2E FAILURES CAUSED BY T603 | **0** |
| TEST WEAKENING | **0** |
| TEN ASSERTIONS RECONCILED | **10 / 10** |

---

## Nonblocking debt

| Class | Count | Disposition |
|-------|-------|-------------|
| Option-E E2E still expecting `#app` visible under `legacy` | 4 | Stale vs exclusive-slot cutover (already served React). **Not caused by `7b19454`.** Future: `AUTHORIZE_PHASE6_OPTION_E_E2E_RECONCILIATION` |
| P2 E2E seed-state | 1 | `SEED_STATE` — pre-existing; React / E2E files unchanged by this commit |
| Wave2 Playwright Chromium missing | 5 | `ENVIRONMENT_FAILURE` — unit Wave2 **18 PASS** |
| Remaining T603 candidates | 7 wave-2 leaves + blocked hosts | Global T603 **OPEN** |

**BLOCKING DEBT = 0**

---

## Boundaries (unchanged)

ClientPortal slot `omit` · exclusive slot `client-portal-opportunity` · dossier exclusive slot retained · `clientPortalHandlers.ts` retained · React opportunity / commands / hooks / canonical reads unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 OPPORTUNITY UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, Option-E E2E test edits, T-010-604, or a global A43 PASS.
