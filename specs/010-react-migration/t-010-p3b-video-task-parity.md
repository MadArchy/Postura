# T603 React Parity Wave P3B — Video Task / Recordings (#28)

**Status:** `FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `6ae9dfd3688472c930888a90d8718b71fae6f023`  
**Implementation commit:** `6ae9dfd3688472c930888a90d8718b71fae6f023`  
**Priority decision:** `PHASE6_RESIDUAL_PRIORITY_28_P3B`  
**Registry:** `#28` — Execution Delivery / Client Tasks  
**Application:** `TransitionClientTask`  
**Presentation model:** `P3B_VIDEO_START_ATTACH_EVIDENCE_COMPLETE`

This record accepts the **T603 React presentation wave** for residual `#28 / P3B`.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** `#30` Evidence Vault create.  
It is **not** pipeline `client_in_progress` / `manager_finalizing`.

Historical P3A records are **not** rewritten.

---

## Provenance

| Role | SHA |
|------|-----|
| CR-1 IMPLEMENTATION | `63e8db8543bf2a13ae29249b71748402007f959a` |
| CR-1 GOVERNANCE / FREEZE | `cf9350fb6de3a9b392b207d34e50714f49c13deb` |
| P3A IMPLEMENTATION | `e65f20120ef44fc14ebd782743b2c585d2178cbe` |
| P3A FORMAL ACCEPTANCE | `t-010-p3a-final-acceptance-reconciliation.md` |
| #31 FEATURE / ACCEPTANCE | `116c600` / `a5974e4` |
| PHASE-6 PRIORITY | `0c3d984` · `PHASE6_RESIDUAL_PRIORITY_28_P3B` |
| #28 / P3B FEATURE | `6ae9dfd3688472c930888a90d8718b71fae6f023` |
| Pre-acceptance HEAD | `6ae9dfd3688472c930888a90d8718b71fae6f023` |

Feature `6ae9dfd` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`6ae9dfd`)

SUBJECT = `feat(react): add P3B video task parity`

| Class | Files |
|-------|--------|
| PRODUCT_UI | `src/ui/modules/pages/ReactClientPortalPage.tsx`, `src/ui/modules/pages/ReactTeleprompterModal.tsx`, `src/ui/modules/pages/ReactClientWorkspacePage.tsx`, `src/ui/modules/pages/ReactTaskRecordingBlock.tsx` |
| PRODUCT_HOOK | `src/ui/hooks/useWave3Data.ts` |
| QUERY_READ | `src/ui/data/compatibilityReads.ts` |
| MEDIA_ADAPTER | `src/ui/media/persistTrustedRecording.ts` |
| TEST | `tests/reactParityWaveP3bVideoTaskParity.test.ts`, `tests/reactParityWaveP8AssignCancelTask.test.ts` (residual pin only) |
| E2E | `e2e/reactParityWaveP3bVideoTaskParity.spec.ts` |

**Unauthorized modifications in feature:** Application **0** · Domain **0** · Auth **0** · Firebase rules **0** · Firestore business authority **0** · canonical `TransitionClientTask` **0** · Registry **0** · Governance **0** · `#30` **0** · legacy deletions **0** · unrelated **0**.

---

## Accepted authority (unchanged)

| Field | Value |
|-------|-------|
| COMMAND | `TransitionClientTask` (`createTransitionClientTask`) |
| CONSUMER | `executionDeliveryConsumer.transitionClientTask` |
| SEAM | `executionDeliveryCommands.transitionClientTask` |
| HOOK | `useTransitionClientTask` |
| P3B INTENTS | `start` · `attach_evidence` · video `complete` |
| P3A INTENTS (unchanged) | `view` · generic `complete` · `request_changes` |
| Public input | `requestedClientId` (trusted scope), `taskId`, `intent`, optional `evidenceUrl` / `clientNotes` |
| Caller organization / role / storage root / status table | **0** |
| CU? | **YES** |
| OWNER | CR-1 Execution Delivery Application |
| React dbService business write | **0** |
| Direct Firestore business write from React | **0** |
| LOCAL TASK TRANSITION LOGIC | **NO** |
| PIPELINE AUTHORITY | **NO** |
| EVIDENCE VAULT CREATE AUTHORITY | **NO** |
| ARTICLE AUTHORITY | **NO** |
| CANCEL AUTHORITY | **NO** |

Canonical `TransitionClientTask` remains responsible for role, tenant/client match, ownership, and `TASK_TRANSITIONS` eligibility.

Mutation path:

React P3B UI → `useTransitionClientTask` → `executionDeliveryCommands.transitionClientTask` → canonical `TransitionClientTask`.

---

## Presentation seam

| Layer | Artifact |
|-------|----------|
| Canonical | `createTransitionClientTask` |
| Consumer | `executionDeliveryConsumer.transitionClientTask` |
| React portal video | `ReactClientPortalPage` `VideoTaskActions` → `ReactTeleprompterModal` |
| React teleprompter | `src/ui/modules/pages/ReactTeleprompterModal.tsx` |
| React workspace recordings | `ReactTaskRecordingBlock` on `ReactClientWorkspacePage` |
| React reads | `readClientTasks` (`scriptPayload`); `readClientTaskScriptPayload`; `readWorkspaceTasks` (`recordingRef`, `clientNotes`) |
| Scope | trusted `tenantScope`; ADMIN workspace `narrowToClient` — never caller-forged org/client/storage root |
| Invalidation | `tenantInvalidationKey(scope, 'compatibility')` on success |
| Media | `persistTrustedRecording` → existing `persistRecording` |
| Legacy | `teleprompterController.ts` / `renderTeleprompterModal` → same consumer |

PRESENTATION ONLY DIFFERENCE = **YES** (same business authority).

Allowed presentation differences: native React teleprompter/camera layout; E2E may stub `__posturaUi.persistRecording` to IndexedDB so tests do not mutate live Storage; list query exposes only string `scriptPayload`.

---

## #28 / #30 separation

| Field | Value |
|-------|-------|
| #28 `attach_evidence` | attaches a trusted recording reference minted by existing media persistence to an existing task |
| #30 | **UNCHANGED** |
| `addEvidenceItem` FROM P3B | **NO** |
| Evidence Vault creation | **NO** |
| #28 / #30 SEPARATION | **PASS** |

---

## Video start / complete semantics

| Field | Value |
|-------|-------|
| MODAL OPEN MUTATES TASK | **NO** |
| FIRST RECORDING START | canonical `start` (first Grabar; `startedRef` once) |
| RECORDING SEND | existing `persistRecording` via `persistTrustedRecording` |
| FINAL TASK COMPLETE | canonical `complete` + trusted recording reference |
| LOCAL TASK TRANSITION RULES | **NO** |
| FUNCTIONAL VIDEO PARITY | **PASS** |

Permission denial shows a bounded failure, does not invoke `start`, and does not persist or mutate the task.

---

## Teleprompter / media / workspace

| Item | Result |
|------|--------|
| TELEPROMPTER PARITY | **PASS** (script, camera, mic, record/stop, preview, retake, send, scroll, speed 1–5, 10-minute cap, WebM bitrate, `facingMode: 'user'`, `playsInline`) |
| MEDIA CAPTURE PARITY | **PASS** |
| DEVICE PARITY | **PASS** (desktop/mobile browser; no new camera-switch / orientation / codec framework) |
| PLAY | **PASS** |
| DOWNLOAD | **PASS** |
| RE-UPLOAD | **PASS** (persist → canonical `attach_evidence`) |
| PIPELINE CONTROLS ADDED | **NO** |
| EVIDENCE VAULT AUTHORITY ADDED | **NO** |
| WORKSPACE RECORDING PARITY | **PASS** |

---

## Media infrastructure

| Field | Value |
|-------|-------|
| Service | existing `src/services/recordings.ts` |
| Adapter | `src/ui/media/persistTrustedRecording.ts` |
| IndexedDB | `postura_recordings_v1` **PRESERVED** |
| Firebase Storage | existing `storageRecordingPath(org, client, task)` when enabled **PRESERVED** |
| NEW RECORDING REPOSITORY | **NO** |
| NEW FIREBASE STORAGE AUTHORITY | **NO** |
| NEW FIRESTORE BLOB WRITE | **NO** |
| MEDIA INFRASTRUCTURE | **PASS** |

---

## Security / tenant invariants

| Invariant | Result |
|-----------|--------|
| CAMERA PERMISSION | **PASS** (fail closed; no `start`) |
| MIC PERMISSION | **PASS** (same `getUserMedia` denial path) |
| MEDIA CLEANUP | **PASS** (tracks, recorder, object URLs on retake / close / unmount / successful send) |
| TENANT ISOLATION | **PASS** |
| CLIENT ISOLATION | **PASS** (trusted scope + canonical match) |
| UPLOAD AUTHORIZATION | **PASS** (org/client/task from trusted scope into existing persist) |
| CROSS-TENANT MEDIA LEAK | **NO** |
| CALLER-SUPPLIED STORAGE ROOT | **NO** |
| MEDIA SECURITY | **PASS** |

SAME BUSINESS AUTHORITY = **YES**  
DUPLICATE WRITE PATH = **NO**  
CANONICAL CONSUMER REUSED = **YES**  
BUSINESS LOGIC DUPLICATED IN REACT = **NO**  
AUTHORITY EXPANDED = **NO**  
LEGACY REMOVED = **NO**  
PIPELINE EXCLUDED = **YES**

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY `teleprompterController.ts` | **RETAINED** |
| LEGACY `renderTeleprompterModal` | **RETAINED** |
| LEGACY ClientPortal / ClientWorkspace recording UI | **RETAINED** |
| LEGACY `tasksHandlers.ts` | **RETAINED** |
| LEGACY `recordings.ts` / Storage adapter | **RETAINED** |
| ROLLBACK SWITCH | **YES** (`applyUiMode('legacy')`) |
| LEGACY MODE | **FUNCTIONAL** |
| REACT MODE | **FUNCTIONAL** |
| DATA MIGRATION REQUIRED | **NO** |
| T-010-603 DELETION AUTHORIZED | **NO** |
| LEGACY UI REMOVAL AUTHORIZED | **NO** |
| LEGACY DELETION | **0** |
| ROLLBACK | **PASS** |

---

## Registry reconciliation

| Field | Value |
|-------|-------|
| CURRENT DISPOSITION | `READ_ONLY_REACT` (legacy UI still invokes canonical consumer) |
| POST-ACCEPTANCE DISPOSITION | `READ_ONLY_REACT` (unchanged) |
| Registry file modified | **NO** |

Formal React parity does **not** mean `REMOVE_LEGACY` or T-010-603 deletion.

---

## Mandatory gate matrix (this review)

| Gate | Required | Result |
|------|----------|--------|
| P3B FOCUSED | PASS, ≥16 | `tests/reactParityWaveP3bVideoTaskParity.test.ts` **18/18 PASS** |
| P3B E2E | 4 / 4 | `e2e/reactParityWaveP3bVideoTaskParity.spec.ts` **4/4 PASS** |
| P3A FOCUSED | 26 / 26 | **26/26 PASS** |
| P3A E2E | PASS | **PASS** |
| P4 / P8 / #28 | PASS | P4 **15/15 + E2E PASS**; P8 **9/9 + E2E PASS**; CR-1 #28 **108/108 PASS** |
| T508 | 10 / 10 | **10/10 PASS** (`e2e/t010508-phase5-parity.spec.ts` unchanged) |
| FULL CHECK | PASS | **2527 / 2527 PASS** |
| BUILD | PASS | **PASS** |
| CANONICAL AUTHORITY | PASS | **PASS** |
| #28 / #30 SEPARATION | PASS | **PASS** |
| MEDIA SECURITY | PASS | **PASS** |
| TENANT ISOLATION | PASS | **PASS** |
| ROLLBACK | PASS | **PASS** |
| PRODUCT DEFECTS | 0 | **0** |
| LEGACY REMOVAL | 0 | **0** |

These are the final implementation-tree runs after P3B product fixes, immediately before commit `6ae9dfd`.

No additional governed acceptance requirement was found beyond this matrix.

---

## Debt

| Item | Class |
|------|--------|
| React `#28` P3B presentation without formal record | **RESOLVED** (this file) |
| Canonical `#28` consumer | **RESOLVED** (CR-1 frozen) |
| Historical P3A files still list `start` / `attach_evidence` / video as legacy | **NONBLOCKING** (historical; not rewritten) |
| Live remote Firestore / E2E backend environment | **NONBLOCKING** (existing P15-class debt; does not block P3B) |
| Pipeline `client_in_progress` / `manager_finalizing` extras | **FUTURE_RESIDUAL** (explicitly excluded; not a defect) |
| Manager notification / extra audit outside canonical command | **FUTURE_RESIDUAL** (legacy extras deferred) |
| `#30` Evidence Vault create | **FUTURE_RESIDUAL** (CU?=NO; authority separation required) |
| Legacy teleprompter / recordings / registry `READ_ONLY_REACT` | **FUTURE_T603** (required until independent T-010-603 subset-removal authorization) |

BLOCKING COUNT = **0**  
NONBLOCKING COUNT = **2**  
FUTURE RESIDUALS = pipeline extras · notification/audit extras · `#30` · T603 legacy retention

Required legacy retention is **not** a product defect.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| P3B PRODUCT IMPLEMENTATION | **COMPLETE** |
| P3B FORMAL ACCEPTANCE | **YES** |
| SAFE LEGACY SUBSET | **NONE** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |
| NEXT FRONTIER CANDIDATE | Source Management `#8` / `#9` / `#24` / `#26` (remaining Stage-1 cutover-spine residual from `PHASE6_RESIDUAL_PRIORITY_28_P3B`) |
| NEXT FRONTIER AUTHORIZED | **NO** |

**NEXT ACTION:** `T603_REACT_PARITY_POST_P3B_FRONTIER_REVIEW`  
**NEXT NODE AUTHORIZED:** **NO**
