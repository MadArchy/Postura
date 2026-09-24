# T-010-603 Global Legacy Removal Closure

**Status:** `PHASE6_GLOBAL_T603_FORMALLY_CLOSED`  
**Acceptance date:** 2026-09-24  
**Branch:** `spec/010-react-migration`  
**Pre-closure HEAD:** `429bdf84eb0c554a805a06854c8340dd40235e10`  
**Scope decision:** `GLOBAL_T603_SCOPE_DECISION = A`  
**Human freeze:** `GLOBAL_T603_HUMAN_SCOPE_AND_AUTHORIZATION_FROZEN`  
**Authorization:** `AUTHORIZE_PHASE6_GLOBAL_T603_CLOSURE_REVIEW`

This record closes **global T-010-603** for the bounded Phase-6 nine-family legacy-leaf program.  
It aggregates the nine already-accepted family subset records. It does **not** reopen them.  
It does **not** delete product/runtime/React code. It does **not** clean nonblocking debt.  
It does **not** authorize T-010-604. It does **not** mark Phase 6 complete. It does **not** promote C3 to PASS.

---

## Scope

| Field | Value |
|-------|--------|
| TITLE | T-010-603 Global Legacy Removal Closure |
| SCOPE DECISION | **A** |
| AUTHORITATIVE FAMILY SET | DOSSIER · OPPORTUNITY · KPI · CLIENTPROFILE · PROOFWALL · CLAIMSAFETY · PAGEHEADER · SOURCEREGISTRY · ONBOARDING |
| FAMILY COUNT | **9** |
| OPEN LOCAL FAMILIES | **0** |
| BROADER HOSTS IN T603 | **NO** (`ClientWorkspace`, `LegacyApp`, `Login`, `AppShell`, and other non-leaf hosts remain outside this closure) |

---

## Family acceptance matrix

| FAMILY | FORMAL STATUS | FORMAL ACCEPTANCE COMMIT | GOVERNED LEGACY FILE | PHYSICAL | C6 | C7 | SAFE-SUBSET | A38 | BLOCKING |
|--------|---------------|--------------------------|----------------------|----------|----|----|-------------|-----|----------|
| DOSSIER | `PHASE6_DOSSIER_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `e95ad6302c853320218211008cfc43269e041620` | `MasterDossierPanel.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| OPPORTUNITY | `PHASE6_OPPORTUNITY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `b4f87b776e68151d3694f03a4a32b8891a411652` | `OpportunityPanel.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| KPI | `PHASE6_KPI_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `0b025913bd8408a9de563ae04d30391d80bf9f9b` | `KpiWeeklyChart.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| CLIENTPROFILE | `PHASE6_CLIENTPROFILE_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `101efc099a263e693fff3364bdc2a7dfd0df8d65` | `ClientProfilePanel.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| PROOFWALL | `PHASE6_PROOFWALL_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `24f70e37f58a522b4e69113dc5f470ebe1ee2916` | `ProofWallPanel.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| CLAIMSAFETY | `PHASE6_CLAIMSAFETY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `5e79ea9ceb49d77cfa84345f204bced1d4a993f0` | `ClaimSafetyPanel.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| PAGEHEADER | `PHASE6_PAGEHEADER_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `4574338c070168fa0a6bd536d822cdb9fcc56259` | `PageHeader.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| SOURCEREGISTRY | `PHASE6_SOURCEREGISTRY_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `da733f1176c5a07097db6e395a6df4e13d398a7c` | `SourceRegistryModal.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |
| ONBOARDING | `PHASE6_ONBOARDING_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT` | `429bdf84eb0c554a805a06854c8340dd40235e10` | `OnboardingWizard.ts` | ABSENT | PASS | VERIFIED | ACCEPTED | PASS | NONE |

Family evidence records:

- `t-010-603-dossier-subset-removal.md`
- `t-010-603-opportunity-subset-removal.md`
- `t-010-603-kpiweeklychart-subset-removal.md`
- `t-010-603-clientprofile-subset-removal.md`
- `t-010-603-proofwall-subset-removal.md`
- `t-010-603-claimsafety-subset-removal.md`
- `t-010-603-pageheader-subset-removal.md`
- `t-010-603-sourceregistry-subset-removal.md`
- `t-010-603-onboarding-subset-removal.md`

---

## Aggregate invariants

| Invariant | Verdict |
|-----------|---------|
| ALL 9 FAMILIES FORMALLY ACCEPTED | **YES** |
| GOVERNED LEGACY FILES PRESENT | **0** |
| STUBS / ALIASES / RE-EXPORT COMPATIBILITY SHELLS | **0** |
| GLOBAL GOVERNED PRODUCT GRAPH ZERO | **YES** |
| LEGACY STATIC PRODUCT IMPORTERS (governed leaves) | **0** |
| LEGACY PRODUCT CALLERS (governed leaves) | **0** |
| LEGACY LIVE PRESENTERS / OWNERS (governed leaves) | **0** |
| LEGACY BUILD-REACHABLE LEAVES | **0** |
| ALL REQUIRED C6 | **PASS** |
| ALL REQUIRED C7 | **VERIFIED** |
| ALL SAFE-SUBSET REVIEWS | **VERIFIED** |
| ALL FORMAL ACCEPTANCES | **COMPLETE** |
| GLOBAL BLOCKING DEBT | **NONE** |
| GLOBAL AUTHORITY | **PASS** (AUTHORITY/ROLE/TENANT/TRUST/AUTH CHANGE = 0) |
| FAMILY A38 AGGREGATE | **PASS** |
| GLOBAL TEST WEAKENING | **0** |

---

## C3 independence

| Field | Value |
|-------|--------|
| GLOBAL C3 | **PARTIAL** |
| GLOBAL C3 REQUIRED BEFORE T603 | **NO** |
| T603 CLOSURE MODIFIES C3 | **NO** |
| EXPECTED POST-T603 C3 | **PARTIAL** |

---

## A43

| Field | Value |
|-------|--------|
| A43 PRE-CLOSURE | **PARTIAL** |
| A43 PRE-CLOSURE MUST ALREADY BE PASS | **NO** |
| A43 RELATIONSHIP | `T603_CLOSURE_EVIDENCE_SATISFIES_A43` |
| A43 CLOSURE EVIDENCE | **SATISFIED** (9/9 accepted · physical absence · product graph zero · C6/C7 · safe-subset · formal acceptance · blocking debt none · authority PASS · family A38 PASS · test weakening 0 · full check PASS · build PASS) |
| A43 POST-CLOSURE | **PASS** |

---

## Global nonblocking debt (preserved)

Aggregate `OUTSIDE_T603_NONBLOCKING_DEBT` across accepted families. **Not cleaned** by this closure.

Includes at minimum:

- Onboarding: unreachable `#btn-open-onboarding`; leftover `activeModal='onboarding'` handler; historical docs/comments; absence-oracle path strings
- SourceRegistry: opener/CSS debt
- PageHeader: CSS/bind debt
- ClaimSafety: CSS/title debt
- Prior family outside-subset handler/comment/scanner debt

| GLOBAL NONBLOCKING DEBT | **PRESERVED / DOCUMENTED** |
| BLOCKS GLOBAL T603 | **NO** |

---

## Closure validation

| Gate | Result |
|------|--------|
| FULL CHECK | **223 files / 3030 tests PASS** (closure-run) |
| BUILD | **661 modules PASS** (closure-run) |
| E2E | **NOT_REQUIRED / NOT_RUN** (governance-only; no Product/runtime/React change) |
| TEST WEAKENING | **0** |

---

## Boundaries

| Item | Value |
|------|--------|
| PRODUCT / RUNTIME / REACT / TEST FILES CHANGED | **0** |
| APPLICATION / DOMAIN / AUTH / PERSISTENCE / SPEC-006 | **0** |
| FAMILY ACCEPTANCE RECORDS REOPENED | **0** |
| DEBT CLEANUP | **0** |
| DATA MIGRATION | **NONE** |
| BUSINESS / SECURITY | **PASS** |

Governance-only file inventory for this closure:

1. ADD `specs/010-react-migration/t-010-603-global-closure.md`
2. MODIFY `specs/010-react-migration/acceptance.md`
3. MODIFY `specs/010-react-migration/tasks.md`

---

## Result

| Item | Value |
|------|--------|
| T603 RESULT | `PHASE6_GLOBAL_T603_FORMALLY_CLOSED` |
| T-010-603 | **DONE — FORMALLY_CLOSED** |
| GLOBAL T603 | **FORMALLY_CLOSED** |
| A43 | **PASS** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | dependency on T603 **SATISFIED**; authorization **NO** |
| PHASE 6 COMPLETE | **NO** |
| REMAINING PHASE-6 WORK | T-010-604 · A44 · CODE_COMPLETE / deployment gates |
| CODE_COMPLETE | **NO** |
| PUSH | **NONE** |

This record does **not** authorize T-010-604, A44 PASS, Phase 6 completion, deployment, debt cleanup, or any product/runtime change.
