# T-010-603 — Proof wall legacy subset removal

**Status:** `PHASE6_PROOFWALL_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-22  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `c7f4e3d4b3c6e43929ce5f04d2bf5e4c259cae61`  
**Implementation commit:** `c7f4e3d4b3c6e43929ce5f04d2bf5e4c259cae61`  
**Physical removal subject:** `refactor(legacy): remove proof wall renderer`  
**Candidate:** `src/components/ProofWallPanel.ts`  
**Predelete SHA256:** `722f2ef4d80293a1e6260cd9d2968105ea64bedc48731025664955918cbf057f`

This record accepts the **bounded T-010-603 admission** of the already-removed ProofWall HTML renderer after C1–C7.

PHASE = 6  
UNIT = PROOFWALL  
T603 SAFE SUBSET = `src/components/ProofWallPanel.ts`  
REMOVAL COMMIT = `c7f4e3d4b3c6e43929ce5f04d2bf5e4c259cae61`  
REMOVAL SUBJECT = `refactor(legacy): remove proof wall renderer`  
C6 = `PHASE6_PROOFWALL_C6_VERIFIED_PASS`  
C7 = `PHASE6_PROOFWALL_C7_DELETION_ACCEPTANCE_VERIFIED`  
SAFE SUBSET RESULT = `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED`  
FORMAL DECISION = `PHASE6_PROOFWALL_T603_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
FORMALLY ACCEPTED = YES  
PROOFWALL LOCAL A43 = PASS  
PROOFWALL UNIT A43 = PASS  
GLOBAL C3 = PARTIAL  
GLOBAL A43 = PARTIAL  
GLOBAL T603 = OPEN  
T604 = NOT_AUTHORIZED  
T604 ELIGIBLE = NO

`ProofWallPanel.ts` is **already absent**. **No second deletion occurred.**  
It is **not** global T-010-603 completion.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** authorization to delete another legacy file.  
It does **not** accept PageHeader, ClaimSafety, SourceRegistry, or Onboarding.  
It does **not** promote global A43 to PASS.

Historical T-601 / T-602 snapshots, registry, dossier acceptance, opportunity acceptance, KPI acceptance, ClientProfile acceptance, and prior React-parity acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA / value |
|------|-------------|
| PORTAL THESIS CUTOVER | `d68e7070378e13b12cb4e016763e9fbe6bca9d51` |
| PORTAL SERVICE-LINES CUTOVER | `a3754e67c06885c58c64c1d46508f3947dd34261` |
| WORKSPACE OWNER | `af4f278415f1fa0007222ea65f1b74cd5ae838ac` |
| WORKSPACE PROOFWALL CUTOVER | `a7e5ea6b5fa3fe418a8a24c9ec137d9ef500e0a7` |
| WORKSPACE SERVICE-LINES CUTOVER | `d980c7f2c6acb44eccfb1d1b574fff066d9546ac` |
| FILE ABSENCE | `c7f4e3d4b3c6e43929ce5f04d2bf5e4c259cae61` |
| C6 | `PHASE6_PROOFWALL_C6_VERIFIED_PASS` |
| C7 | `PHASE6_PROOFWALL_C7_DELETION_ACCEPTANCE_VERIFIED` |
| T603 REVIEW | `PHASE6_PROOFWALL_T603_SAFE_SUBSET_READY_FOR_FORMAL_ACCEPTANCE` |
| FEATURE | `c7f4e3d4b3c6e43929ce5f04d2bf5e4c259cae61` |

Feature `c7f4e3d` is HEAD at acceptance. This commit adds the formal record and reconciles one stale oracle. Physical removal already happened under the separately governed file-absence / C6 sequence and was accepted by C7.

---

## Feature manifest (`c7f4e3d`)

| Kind | Files |
|------|-------|
| Deleted | `src/components/ProofWallPanel.ts` |
| Tests | `tests/phase6ProofWallWorkspaceServiceLinesCutover.test.ts`, `tests/phase6ProofWallWorkspaceProofWallCutover.test.ts`, `tests/phase6ProofWallWorkspaceReactOwner.test.ts`, `tests/phase6ProofWallPortalThesisCutover.test.ts`, `tests/phase6ProofWallPortalServiceLinesCutover.test.ts`, `tests/phase6ClientProfileCutover.test.ts`, `tests/phase6RollbackArchitecture.test.ts`, `tests/reactMigrationPhase2Architecture.test.ts`, `tests/reactParityWaveProofWallReadiness.test.ts` |
| Governance | **0** (matrix not updated at removal) |
| Product / React / handlers / hosts | **0** |

---

## Physical evidence

| Field | Value |
|-------|--------|
| ProofWallPanel.ts | **ABSENT** |
| stub / alias / redirect / wrapper / renamed equivalent / duplicate legacy renderer | **NONE** |
| product import graph | **0** |
| product call graph | **0** |
| dynamic / barrel / registry | **0** / **0** / **0** |
| runtime discovery | **0** |
| build reachability | **NO** |
| SECOND DELETE | **NO** |

---

## React replacement

| Surface | Owner | Status |
|---------|--------|--------|
| Workspace ProofWall | `ReactProofWallPanel` (`workspaceClientId={clientId}`) | **SERVED** |
| Workspace service-lines | `ReactMasterDossierPanel` (`workspaceClientId={clientId}`) | **SERVED** |
| Portal ProofWall | `ReactProofWallPanel` | **SERVED** |
| Portal service-lines | `ReactMasterDossierPanel` | **SERVED** |

---

## Presentation evidence

| Field | Value |
|-------|--------|
| workspace ProofWall slot | `omit` |
| workspace ProofWall id | `client-workspace-proof-wall` |
| workspace service-lines slot | `omit` |
| workspace service-lines id | `client-workspace-service-lines` |
| portal presentation | **ACTIVE / CUT OVER** |
| Option-E without file | **PASS** |
| A38 | **PASS** |

---

## Authority evidence

| Field | Value |
|-------|--------|
| READ AUTHORITY | **PASS** |
| ProofWall read | canonical `useProofWall` → `readProofWall` |
| WRITE AUTHORITY | **PASS** |
| ProofWall write | command #7 `useSetProofWallItemReadiness` → `masterProfileCommands` → `masterProfileConsumer` |
| service-lines read | canonical `useMasterDossier` → `readMasterDossier` |
| service-lines write | **NONE** |
| NEW AUTHORITY | **0** |
| DIRECT DB | **0** |
| LEGACY PROOFWALL AUTHORITY | **UNSERVED** |
| LEGACY SERVICE-LINES AUTHORITY | **UNSERVED** |
| HANDLER FILE DEPENDENCY | **NO** |
| HANDLER RUNTIME DEPENDENCY | **NO** |
| HANDLER CLEANUP REQUIRED | **NO** |

---

## A43 unit (ProofWall leaf)

| Condition | Result |
|-----------|--------|
| C1 React served | PASS — AppShell `ws-positioning` → `ReactClientWorkspacePage` → `ReactProofWallPanel` / `ReactMasterDossierPanel`; portal thesis serves the same React owners |
| C2 Vitest | PASS |
| C3 Dimensions | PASS — workspace / portal / owner / parity / rollback / Phase-2 oracles retained |
| C4 Authority | PASS — ProofWall read `useProofWall` → `readProofWall`; write command #7; service-lines read `useMasterDossier` → `readMasterDossier`; write NONE |
| C5 Tenant / security | PASS — no new authority; workspace narrowing via `narrowToClient`; no direct `dbService` from served React path |
| C6 Rollback | PASS — Option E without the file (`PHASE6_PROOFWALL_C6_VERIFIED_PASS`) |
| C7 Acceptance | PASS — `PHASE6_PROOFWALL_C7_DELETION_ACCEPTANCE_VERIFIED` |
| C8 GATE_FIRST | N/A |
| Legacy file | ABSENT — no stub, redirect, alias, wrapper, renamed equivalent, duplicate renderer, or second delete |
| Product imports / calls / runtime discovery | **0** / **0** / **0** |
| PROOFWALL UNIT A43 | **PASS** |
| PROOFWALL LOCAL A43 | **PASS** |
| FORMALLY ACCEPTED | **YES** |
| GLOBAL A43 | **PARTIAL** |

---

## Safe subset

| Field | Value |
|-------|--------|
| SAFE SUBSET | `src/components/ProofWallPanel.ts` only |
| FORMAL STATE | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` |
| OTHER CANDIDATES | unchanged |

Explicitly **outside** this subset: `profileHandlers.ts`, `thesisHandlers.ts`, `ReactProofWallPanel`, `ReactMasterDossierPanel`, ClientWorkspace, ClientPortal, workspace/portal slot files, exclusive-slot registry, CSS, `PageHeader.ts`, `ClaimSafetyPanel.ts`, `SourceRegistryModal.ts`, `OnboardingWizard.ts`, Application, Domain, Auth, Persistence, SPEC-006.

---

## Boundary evidence

| Surface | State |
|---------|--------|
| Dossier T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| ClientProfile T603 | **UNCHANGED / FORMALLY ACCEPTED** |
| PageHeader | **OUTSIDE PROOFWALL SAFE SUBSET** |
| ClaimSafety | **OUTSIDE PROOFWALL SAFE SUBSET** |
| SourceRegistry | **OUTSIDE PROOFWALL SAFE SUBSET** |
| Onboarding | **OUTSIDE PROOFWALL SAFE SUBSET** |
| Whole remaining-legacy acceptance | **NO** |

---

## Verification

| Gate | Result |
|------|--------|
| WORKSPACE SERVICE-LINES CUTOVER | **11 PASS** |
| WORKSPACE PROOFWALL CUTOVER | **11 PASS** |
| WORKSPACE OWNER | **11 PASS** |
| PROOFWALL PARITY | **11 PASS** |
| CR-1 | **28 PASS** |
| PORTAL PROOFWALL | **11 PASS** |
| PORTAL SERVICE-LINES | **11 PASS** |
| DOSSIER | **12 PASS** |
| CLIENTPROFILE | **14 PASS** |
| ONBOARDING | **23 PASS** |
| WAVE2 | **18 PASS** |
| PHASE-1 | **27 PASS** |
| PHASE-2 | **41 PASS** |
| ROLLBACK | **59 PASS** |
| NAVIGATION | **3 PASS** |
| CLOSED SUBSETS | **PASS** |
| FOCUSED | **18 files / 322 PASS** |
| FULL CHECK | **212 files / 2888 PASS** |
| BUILD | **PASS / 657 modules** |
| E2E | **NOT_REQUIRED / NOT_RUN** |
| BUSINESS / SECURITY | **PASS** |
| STALE ASSERTIONS | **0** |
| TEST WEAKENING | **0** |

---

## Nonblocking debt

| Class | Disposition |
|-------|-------------|
| Unreachable `profileHandlers.ts` leftover `.btn-toggle-proof-wall` / `updateProofWallItem` | **OUTSIDE_T603_NONBLOCKING_DEBT** — Product emitter = 0; no file import; no served DOM target. **Not cleaned.** |
| Unreachable `thesisHandlers.ts` leftover `#proof-wall-section` scroll | **OUTSIDE_T603_NONBLOCKING_DEBT** — wrapper removed; leftover unreachable. **Not cleaned.** |
| Stale comments / historical SPEC and governance references | Outside subset / nonblocking. Matrix and `tasks.md` **not** updated (precedent). |
| Remaining leftover families `PageHeader.ts`, `ClaimSafetyPanel.ts`, `SourceRegistryModal.ts`, `OnboardingWizard.ts` | Outside subset. Still present. **Not accepted here.** |

OUTSIDE SAFE SUBSET = YES  
BLOCKS FORMAL T603 ACCEPTANCE = NO  
**BLOCKING DEBT = NONE**

Cleanup of handlers, comments, remaining leftover families, matrix, or E2E was **not** performed by this admission.

---

## Boundaries (unchanged)

Workspace ProofWall slot `omit` · exclusive id `client-workspace-proof-wall` active · workspace service-lines slot `omit` · exclusive id `client-workspace-service-lines` active · portal thesis slots/ids active · `profileHandlers.ts` / `thesisHandlers.ts` retained · React ProofWall / Dossier / commands / hooks / compatibility reads unmodified · Application / Domain / Auth / persistence / SPEC-006 / registry / `tasks.md` / `migration-matrix.md` **0**.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| T603 PROOFWALL UNIT | **FORMALLY_ACCEPTED** |
| GLOBAL T603 | **OPEN** |
| GLOBAL A43 | **PARTIAL** |
| GLOBAL C3 | **PARTIAL** |
| T604 | **NOT_AUTHORIZED** |
| T604 ELIGIBLE | **NO** (A25 / A31) |
| NEXT FRONTIER | `AUTHORIZE_PHASE6_SAFE_SUBSET_FRONTIER_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |

This record does **not** authorize another deletion, handler/comment cleanup, PageHeader / ClaimSafety / SourceRegistry / Onboarding migration, T-010-604, or a global A43 PASS.
