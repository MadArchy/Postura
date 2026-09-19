# T603 React Parity Wave — Source Management Write (`#8` / `#9` / `#24` / `#26`)

**Status:** `FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `37dede570f70ba7ef3e9f6dfc5f71e155e044888`  
**Implementation commit:** `37dede570f70ba7ef3e9f6dfc5f71e155e044888`  
**Priority decision:** `PHASE6_RESIDUAL_PRIORITY_28_P3B` (Stage-1 remaining cluster after P3B)  
**Registry:** `#8` `#9` `#24` `#26` — Signal Intake / Source Management  
**Application:** CR-1 Signal Intake  
**Presentation model:** `ONE_WAVE_REGISTER_POLL_MANUAL`

This record accepts the **T603 React presentation wave** for residual cluster  
`#8` / `#9` / `#24` / `#26`.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** `#25` source lifecycle.  
It is **not** discovery / Tavily / curated / bulk-add.  
It is **not** `#22` scoring / `scoreSignal`.

Historical P3B and earlier acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA |
|------|-----|
| CR-1 SIGNAL INTAKE / FREEZE | existing `RegisterSource` · `PollRegisteredSource` · `PollAllActiveSources` · `RegisterManualSignal` |
| PHASE-6 PRIORITY | `0c3d984` · `PHASE6_RESIDUAL_PRIORITY_28_P3B` |
| P3B FEATURE / ACCEPTANCE | `6ae9dfd` / `921994f` |
| SOURCE MANAGEMENT FEATURE | `37dede570f70ba7ef3e9f6dfc5f71e155e044888` |
| Pre-acceptance HEAD | `37dede570f70ba7ef3e9f6dfc5f71e155e044888` |

Feature `37dede5` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`37dede5`)

SUBJECT = `feat(react): add source management write parity`

| Class | Files |
|-------|--------|
| PRODUCT_UI | `src/ui/modules/pages/ReactClientWorkspacePage.tsx` |
| PRODUCT_HOOK | `src/ui/hooks/useWave3Data.ts` |
| COMMAND_ADAPTER | `src/ui/commands/commandSeam.ts` |
| TEST | `tests/reactParityWaveSourceManagement.test.ts` |
| E2E | `e2e/reactParityWaveSourceManagement.spec.ts` |

**Unauthorized modifications in feature:** Application **0** · Domain **0** · Auth **0** · canonical Signal Intake commands **0** · Firebase rules **0** · Firestore business authority **0** · Registry **0** · Governance **0** · `#25` **0** · discovery authority **0** · `#22` **0** · legacy deletions **0** · unrelated **0**.

---

## Accepted authority (unchanged)

| Field | Value |
|-------|-------|
| `#8` / `#24` COMMAND | `RegisterSource` (`createRegisterSource`) — **one command** |
| `#9` COMMAND | `PollRegisteredSource` / `PollAllActiveSources` |
| `#26` COMMAND | `RegisterManualSignal` |
| CONSUMER | `signalIntakeConsumer` |
| SEAM | `signalIntakeCommands` |
| HOOKS | `useRegisterSource` · `usePollRegisteredSource` · `usePollAllActiveSources` · `useRegisterManualSignal` |
| HOST | `SourcesPanel` on `ReactClientWorkspacePage` |
| Public input | `requestedClientId` from trusted/narrowed scope; name/type/optional url/interval; `sourceId` for poll-one; title for manual |
| Caller organization / role | **0** |
| CU? | **YES** for `#8` `#9` `#24` `#26` |
| OWNER | CR-1 Signal Intake Application |
| React dbService business write | **0** |
| Direct Firestore business write from React | **0** |
| LOCAL QUOTA / TENANT / OWNERSHIP | **NO** |
| LOCAL POLL / FEED / ROUTING | **NO** |
| LOCAL SIGNAL CREATE / DEDUP / SCORE | **NO** |
| SOURCE LIFECYCLE AUTHORITY | **NO** |
| DISCOVERY AUTHORITY | **NO** |

Canonical commands remain responsible for ADMIN role, trusted org/client, source ownership reload on poll, quota, persistence, ingest, and fingerprint dedup.

Mutation paths:

React SourcesPanel → `useRegisterSource` → `signalIntakeCommands.registerSource` → consumer → `RegisterSource`.

React SourcesPanel → `usePollRegisteredSource` / `usePollAllActiveSources` → seam → consumer → `PollRegisteredSource` / `PollAllActiveSources`.

React SourcesPanel → `useRegisterManualSignal` → `signalIntakeCommands.registerManualSignal` → consumer → `RegisterManualSignal`.

---

## #8 / #24 shared path

| Field | Value |
|-------|-------|
| SAME CANONICAL COMMAND | **YES** |
| ONE REACT WRITE SURFACE | **YES** (`SourcesPanel`) |
| SECOND COMMAND PATH | **NO** |
| `ReactSourceRegistryPanel` write | **NO** (retained read-only) |
| DIRECT REACT `dbService.addSource` | **NO** |
| REGISTER SOURCE AUTHORITY | **PASS** |

---

## #9 poll

| Field | Value |
|-------|-------|
| POLL-ONE | **PASS** |
| POLL-ALL | **PASS** (Application owns iteration) |
| DIRECT REACT NETWORK FETCH | **NO** |
| DIRECT `fetchSourceItems` | **NO** |
| DIRECT `recordSourceRun` | **NO** |
| DIRECT `updateSourceStatus` | **NO** |
| LOCAL ROUTING | **NO** |
| POLL AUTHORITY | **PASS** |

---

## #26 manual signal

| Field | Value |
|-------|-------|
| MANUAL SIGNAL | **PASS** |
| DIRECT SIGNAL DB WRITE | **NO** |
| LOCAL SIGNAL CREATION | **NO** |
| LOCAL DEDUP | **NO** |
| POST-PERSIST `scoreSignal` | **NO** |
| `#22` INVOKED | **NO** |

---

## #25 / discovery exclusion

| Field | Value |
|-------|-------|
| REACT PAUSE / REACTIVATE / ARCHIVE / TEST-FEED | **NO** |
| `updateSourceStatus` FROM REACT | **NO** |
| `#25` | **UNCHANGED / LEGACY** |
| `#25` EXCLUSION | **PASS** |
| DISCOVERY | **LEGACY / OUT_OF_SCOPE** |
| REACT DISCOVERY AUTHORITY | **NO** |
| `runSourceDiscoveryAgent` / Tavily / curated / bulk | **NO** |
| DISCOVERY EXCLUSION | **PASS** |
| SourcesPanel handoff | `pausarlas o archivarlas` · `el descubrimiento automático` |

---

## Tenant isolation / query invalidation

| Field | Value |
|-------|-------|
| CLIENT SCOPE | trusted / `narrowToClient(workspaceClientId)` |
| ORG SCOPE | session-derived |
| ROLE | session-derived (canonical ADMIN) |
| CALLER-SUPPLIED ROLE / TRUSTED ORG | **NO** |
| CROSS-CLIENT REGISTER / POLL / MANUAL | **FAIL-CLOSED** |
| TENANT ISOLATION | **PASS** |
| SOURCE KEYS INVALIDATED | `compatibility` / `workspace-sources` · `compatibility` / `sources` |
| RADAR/SIGNAL KEYS INVALIDATED | `compatibility` / `workspace-radar` (poll + manual) |
| UNRELATED CANONICAL/SESSION KEYS | **NO** |
| P15 COMPATIBILITY CONTRACT PRESERVED | **YES** (tenant-scoped keys; invalidate, do not patch) |
| QUERY INVALIDATION | **PASS** |

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY `SourceRegistryModal.ts` | **RETAINED** |
| LEGACY `ClientWorkspace` source controls | **RETAINED** |
| LEGACY `sourcesHandlers.ts` | **RETAINED** |
| LEGACY `sourceAutomationScheduler.ts` | **RETAINED** |
| LEGACY `#25` | **RETAINED** |
| LEGACY discovery / agent | **RETAINED** |
| ROLLBACK SWITCH | **YES** (`applyUiMode('legacy')` / shell to-legacy) |
| LEGACY MODE | **FUNCTIONAL** |
| REACT MODE | **FUNCTIONAL** |
| DATA MIGRATION | **NONE** |
| T-010-603 DELETION AUTHORIZED | **NO** |
| LEGACY DELETION | **0** |
| ROLLBACK | **PASS** |

Formal React parity does **not** mean `REMOVE_LEGACY` or T-010-603 deletion.  
Registry disposition remains `READ_ONLY_REACT`. Registry file was **not** modified.

---

## Mandatory gate matrix (this review)

| Gate | Required | Result |
|------|----------|--------|
| SOURCE FOCUSED | PASS, ≥18 | `tests/reactParityWaveSourceManagement.test.ts` **19/19 PASS** |
| SOURCE E2E | 6 / 6 | `e2e/reactParityWaveSourceManagement.spec.ts` **6/6 PASS** |
| CR-1 SIGNAL INTAKE | PASS | **52/52 PASS** |
| STAGE-B SIGNAL INTAKE | PASS | **9/9 PASS** |
| REACT SOURCE REGRESSIONS | PASS | Phase-2 architecture · Phase-3 pages · Phase-3 architecture **PASS** |
| STAGE-B SOURCE E2E | PASS | `e2e/t010403-stage-b-seam.spec.ts` **11/11 PASS** (includes `#9` hosted poll) |
| FULL CHECK | PASS | **2546 / 2546 PASS** |
| BUILD | PASS | **PASS** |
| TENANT ISOLATION | PASS | **PASS** |
| REGISTER AUTHORITY | PASS | **PASS** |
| POLL AUTHORITY | PASS | **PASS** |
| MANUAL SIGNAL AUTHORITY | PASS | **PASS** |
| `#25` EXCLUSION | PASS | **PASS** |
| DISCOVERY EXCLUSION | PASS | **PASS** |
| NEW BUSINESS AUTHORITY | 0 | **0** |
| PRODUCT DEFECTS | 0 | **0** |
| LEGACY DELETION | 0 | **0** |
| ROLLBACK | PASS | **PASS** |

These are the final implementation-tree runs immediately before commit `37dede5`.

`e2e/wave3-pages.spec.ts` is **not** a mandatory Source Management product gate. It is an unauthenticated Stage-B presentation-ownership suite and does not exercise register / poll / manual-signal writes.

---

## `wave3-pages` environment failure

| Field | Value |
|-------|-------|
| Suite | `e2e/wave3-pages.spec.ts` |
| FAILURE BEFORE PRODUCT ASSERTION | **YES** (browser launch; ~1–2 ms) |
| MISSING PLAYWRIGHT BINARY | **YES** |
| BINARY | `chromium_headless_shell` |
| PRODUCT CODE REACHED | **NO** |
| SOURCE MANAGEMENT FLOW REACHED | **NO** |
| CAUSED BY SOURCE MANAGEMENT IMPLEMENTATION | **NO** |
| Classification | `NONBLOCKING_E2E_ENVIRONMENT_DEBT` |

Equivalent relevant product paths have separate green evidence: Source E2E **6/6** and T-010-403 **11/11**. No product assertion failed.

Do not treat a missing local Playwright runtime as a Source Management product defect.

---

## Debt

| Item | Class |
|------|--------|
| React `#8/#9/#24/#26` presentation without formal record | **RESOLVED** (this file) |
| Canonical Signal Intake commands | **RESOLVED** (CR-1 frozen) |
| `ReactSourceRegistryPanel` remains read-only | **NONBLOCKING** (intentional one-command-path; catalog handoff retained) |
| `e2e/wave3-pages.spec.ts` missing `chromium_headless_shell` | **ENVIRONMENT_DEBT** / **NONBLOCKING** |
| `#25` pause / reactivate / archive / test-feed | **INTENTIONAL_BOUNDARY** / **FUTURE_RESIDUAL** |
| Discovery / Tavily / curated / bulk | **INTENTIONAL_BOUNDARY** / **FUTURE_RESIDUAL** |
| `#22` post-persist `scoreSignal` | **INTENTIONAL_BOUNDARY** / **FUTURE_RESIDUAL** |
| Legacy source hosts / registry `READ_ONLY_REACT` | **FUTURE_T603** (required until independent T-010-603 subset-removal authorization) |

BLOCKING COUNT = **0**  
NONBLOCKING COUNT = **2**  
FUTURE RESIDUALS = `#25` · discovery · `#22` · remaining Phase-6 rows · T603 legacy retention

Required legacy retention and `#25` / discovery exclusion are **not** product defects.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| SOURCE MANAGEMENT PRODUCT IMPLEMENTATION | **COMPLETE** |
| SOURCE MANAGEMENT FORMAL ACCEPTANCE | **YES** |
| SAFE LEGACY SUBSET | **NONE** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |
| NEXT FRONTIER CANDIDATE | `#16` `RemoveCuration` / `ReopenCuration` (leading remaining CU?=YES residual after Stage-1 spine `P3B` + Source Management; not selected by this record) |
| NEXT FRONTIER AUTHORIZED | **NO** |

Stage-1 cutover-spine residuals named by `PHASE6_RESIDUAL_PRIORITY_28_P3B` are now accepted. Remaining candidates (`#16`, `#21` advisor, `#33`, CU?=NO, A43 / T603) require a separate residual-priority or design review.

**NEXT ACTION:** `T603_REACT_PARITY_POST_SOURCE_MANAGEMENT_FRONTIER_REVIEW`  
**NEXT NODE AUTHORIZED:** **NO**
