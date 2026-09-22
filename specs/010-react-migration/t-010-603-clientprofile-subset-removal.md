# T-010-603 — Client profile legacy subset removal

**Status:** `PHASE6_CLIENTPROFILE_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-21  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `5b2a5ed50e715d266e3b2f44bfb6e28ce57f8899`  
**Implementation commit:** `5b2a5ed50e715d266e3b2f44bfb6e28ce57f8899`  
**Physical removal subject:** `refactor(legacy): remove client profile renderer`  
**Candidate:** `src/components/ClientProfilePanel.ts`  
**Predelete SHA256:** `57d0eb0c4647052d4492892f7985fa84e13f088ad6039b3b7ba526156f3da934`

This record accepts the **bounded T-010-603 admission** of the already-removed ClientProfile HTML renderer after C1–C7.

PHASE = 6  
UNIT = CLIENTPROFILE  
T603 SAFE SUBSET = `src/components/ClientProfilePanel.ts`  
REMOVAL COMMIT = `5b2a5ed50e715d266e3b2f44bfb6e28ce57f8899`  
REMOVAL SUBJECT = `refactor(legacy): remove client profile renderer`  
C6 = `PHASE6_CLIENTPROFILE_C6_VERIFIED_PASS`  
C7 = `PHASE6_CLIENTPROFILE_C7_DELETION_ACCEPTANCE_VERIFIED`  
SAFE SUBSET RESULT = `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED`  
FORMAL DECISION = `PHASE6_CLIENTPROFILE_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
FORMALLY ACCEPTED = YES  
CLIENTPROFILE LOCAL A43 = PASS  
CLIENTPROFILE UNIT A43 = PASS  
GLOBAL C3 = PARTIAL  
GLOBAL A43 = PARTIAL  
GLOBAL T603 = OPEN  
T604 = NOT_AUTHORIZED  
T604 ELIGIBLE = NO

`ClientProfilePanel.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** accept the whole profile bundle.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, KPI acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| CUTOVER | `b80b75446f9f4c9f0e30666d58bd15f6fe2b5a8f` |
| FILE ABSENCE | `5b2a5ed50e715d266e3b2f44bfb6e28ce57f8899` |
| C6 | `PHASE6_CLIENTPROFILE_C6_VERIFIED_PASS` |
| C7 | `PHASE6_CLIENTPROFILE_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_CLIENTPROFILE_T603_SAFE_SUBSET_READY_FOR_FORMAL_ACCEPTANCE` |
| FEATURE | `5b2a5ed50e715d266e3b2f44bfb6e28ce57f8899` |

Feature `5b2a5ed` is HEAD at acceptance. This commit adds governance only. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`5b2a5ed`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/ClientProfilePanel.ts` |
| Tests | `tests/phase6ClientProfileCutover.test.ts`, `tests/phase6RollbackArchitecture.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts`, `tests/reactParityWaveProfileFactLifecycle.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## Physical evidence

| Field | Value |
|-------|--------|
| ClientProfilePanel.ts | **ABSENT** |
| stub / alias / redirect / wrapper | **NONE** |
| product import graph | **0** |
| product call graph | **0** |
| runtime discovery | **0** |
| build reachability | **NO** |
| React owner | `ReactClientProfilePanel` |
| live count | **1** |
| slot | `omit` |
| exclusive id | `client-portal-profile` |
| Option-E without file | **PASS** |
| A38 | **PASS** |

---

## Authority evidence

| Field | Value |
|-------|--------|
| READ AUTHORITY | **PASS** |
| READ PATH | `ReactClientProfilePanel` → `useProfileOverview` → `readProfileOverview` |
| WRITE AUTHORITY | **PASS** |
| WRITE PATH | CU #2–#6 → `masterProfileCommands` → `masterProfileConsumer` |
| NEW AUTHORITY | **0** |
| LEGACY CLIENTPROFILE AUTHORITY | **UNSERVED** |
| HANDLER FILE DEPENDENCY | **NO** |
| HANDLER RUNTIME DEPENDENCY | **NO** |

---

## A43 unit (ClientProfile leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — AppShell `client-profile` → Wave2 `profile` → `ReactClientProfilePanel` |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — cutover / profile parity / rollback / Phase-2 oracles retained |
| C4 Authority | PASS — read `useProfileOverview` → `readProfileOverview`; write CU #2–#6 → `masterProfileCommands` → `masterProfileConsumer` |
| C5 Tenant / security | PASS — no new authority; no direct `dbService` / repository from React profile |
| C6 Rollback | PASS — Option E without the file (`PHASE6_CLIENTPROFILE_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_CLIENTPROFILE_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| CLIENTPROFILE UNIT A43 | **PASS** |
| CLIENTPROFILE LOCAL A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/ClientProfilePanel.ts` only |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

Explicitly **outside** this subset: `profileHandlers.ts`, `ProofWallPanel.ts`, `OnboardingWizard.ts`, ClientPortal, `ReactClientProfilePanel`, slot files, exclusive-slot registry, CSS, Application, Domain, Auth, Persistence, SPEC-006.

---

## Boundary evidence

| Surface | State |
|---------|--------|
| ProofWall thesis | **PRESERVED** |
| ProofWall workspace | **PRESERVED** |
| ProofWall | **OUTSIDE CLIENTPROFILE SAFE SUBSET** |
| Onboarding modal / workspace entry / auto-modal | **PRESERVED** |
| React onboarding inline | **SERVED** |
| Onboarding | **OUTSIDE CLIENTPROFILE SAFE SUBSET** |
| Whole profile-bundle acceptance | **NO** |

---

## Verification

| Gate | Result |
|------|--------|
| CUTOVER | **14 PASS** |
| PROFILE PARITY | **26 PASS** |
| PROOFWALL | **11 PASS** |
| ONBOARDING | **23 PASS** |
| WAVE2 | **18 PASS** |
| PHASE-1 | **PASS** |
| PHASE-2 | **PASS** |
| ROLLBACK | **47 PASS** |
| CLOSED LEAVES | **PASS** |
| FOCUSED | **12 files / 250 PASS** |
| FULL CHECK | **207 files / 2821 PASS** |
| BUILD | **PASS / 658 modules** |
| E2E | **NOT_REQUIRED / NOT_RUN** |
| BUSINESS / SECURITY | **PASS** |
| STALE ASSERTIONS | **0** |
| TEST WEAKENING | **0** |
| FILE-PRESENCE CONFLICTS | **0** |

---

## Nonblocking debt

| Class | Disposition |
|-------|-------------|
| Unserved `profileHandlers.ts` fact/CV write code | **OUTSIDE_T603_NONBLOCKING_DEBT** — no file import, no served DOM target, no init failure. **Not cleaned.** |
| Stale comments / spec RETAINED text | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Future ProofWall migration | Outside subset. Thesis + workspace remain product-served. |
| Future Onboarding migration | Outside subset. Modal, workspace entry, auto-modal, and React inline remain served. |
| Unserved `ReactClientPortalPage` `tab === 'results'` nest | Not live; `client-profile` is Wave2-owned. Outside subset. |
| Empty service-lines visual delta | Nonblocking visual. Outside subset. |

OUTSIDE SAFE SUBSET = YES  
BLOCKS FORMAL T603 ACCEPTANCE = NO  
**BLOCKING DEBT = 0**

Cleanup of handlers, comments, ProofWall, Onboarding, stale React paths, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

Slot `omit` · exclusive id `client-portal-profile` active · whole-profile id **NONE** · ProofWall id **NONE** · Onboarding id **NONE** · `profileHandlers.ts` retained · React profile / commands / hooks / compatibility reads unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 CLIENTPROFILE UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, handler/comment cleanup, ProofWall or Onboarding migration, T-010-604, or a global A43 PASS.
