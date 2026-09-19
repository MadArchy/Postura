# T603 React Parity Wave P16 — Save Content Draft (#31)

**Status:** `FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-18  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `116c600be083c8ca21dde76a58b4ad930769d12a`  
**Implementation commit:** `116c600be083c8ca21dde76a58b4ad930769d12a`  
**Registry:** `#31` — Save content (`Modals` content-editor)  
**Application:** `SaveContentDraft`  
**Role:** ADMIN only

This record accepts the **T603 React presentation wave** for registry `#31`.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** `#33` `CreateContentDraft`.

---

## Provenance

| Role | SHA |
|------|-----|
| CR-1 IMPLEMENTATION | `63e8db8543bf2a13ae29249b71748402007f959a` |
| CR-1 GOVERNANCE / FREEZE | `cf9350fb6de3a9b392b207d34e50714f49c13deb` |
| #1 FEATURE / ACCEPTANCE | `4279737` / `23997e080cd60b0a1d08233240fbe2e3ce8f42e8` |
| #31 FEATURE | `116c600be083c8ca21dde76a58b4ad930769d12a` |
| Pre-acceptance HEAD | `116c600be083c8ca21dde76a58b4ad930769d12a` |

Feature `116c600` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`116c600`)

| Kind | Files |
|------|-------|
| PRODUCT_UI | `src/ui/modules/pages/ReactClientWorkspacePage.tsx`, `src/ui/modules/pages/modals/ReactModals.tsx`, `src/ui/legacy/shellTabs.ts`, `src/ui/modules/AppShell/ReactAppShell.tsx` |
| PRODUCT_HOOK | `src/ui/hooks/useWave3Data.ts` |
| QUERY_READ | `src/ui/data/compatibilityReads.ts` |
| TEST | `tests/reactParityWaveP16SaveContentDraft.test.ts` |
| E2E | `e2e/reactParityWaveP16SaveContentDraft.spec.ts` |

**Unauthorized modifications in feature:** Application **0** · Domain **0** · Auth **0** · Firebase **0** · Firestore service **0** · canonical `SaveContentDraft` **0** · `CreateContentDraft` **0** · Registry **0** · T508 **0** · legacy deletions **0**.

SUBJECT = `feat(react): add SaveContentDraft parity`

---

## Accepted authority (unchanged)

| Field | Value |
|-------|-------|
| COMMAND | `SaveContentDraft` (`createSaveContentDraft`) |
| CONSUMER | `executionDeliveryConsumer.saveContentDraft` |
| SEAM | `executionDeliveryCommands.saveContentDraft` |
| HOOK | `useSaveContentDraft` |
| SURFACE | `ReactContentEditorModal` on `ws-production` / `ProductionPanel` |
| Public input | `requestedClientId` (from trusted narrowed scope), `contentId`, `fields`, optional `requestedTargetStatus` |
| Editable fields | title, body, type, targetPlatform, teleprompterScript (VIDEO_SCRIPT), managerNotes |
| Caller organization / role / mutation class / Brief / publication verdict | **0** |
| CU? | **YES** |
| OWNER | CR-1 Execution Delivery Application |
| React dbService business write | **0** |
| Direct Firestore business write from React | **0** |
| CREATE CONTENT AUTHORITY | **0** |
| AI GENERATION AUTHORITY | **0** |

Canonical `SaveContentDraft` remains responsible for ADMIN role, tenant/client match, `CONTENT_NOT_FOUND`, mutation classification, SPEC-003 `ContentStrategicBriefGatePort`, SPEC-006 publication gate, and `assertClaimSafeTransition` when `requestedTargetStatus` differs.

---

## Presentation seam

| Layer | Artifact |
|-------|----------|
| Canonical | `createSaveContentDraft` |
| Consumer | `executionDeliveryConsumer.saveContentDraft` |
| React read | `useWorkspaceContent` → `readWorkspaceContent`; `useContentDetail` → `readContentDetail` |
| Query keys | `tenantQueryKey(scope, 'compatibility', 'workspace-content')`; `tenantQueryKey(scope, 'compatibility', 'content-detail', contentId)` |
| React mutation | `ReactContentEditorModal` → `useSaveContentDraft` → `executionDeliveryCommands.saveContentDraft` |
| Scope | ADMIN workspace `narrowToClient(tenantScope, workspaceClientId)` — never caller-forged org/client authority |
| Invalidation | `tenantInvalidationKey(scope, 'compatibility')` on success |
| Legacy | `renderContentEditorModal` / `#form-edit-content` → `contentHandlers.ts` → same consumer |

PRESENTATION ONLY DIFFERENCE = **YES** (same business authority).

Allowed presentation differences: native React editor layout; local empty title/body validation before command invocation; claim-safety AI review panel omitted (advisory COMPATIBILITY_ONLY; canonical transition gate retained).

#33 generate-content and pipeline-generation actions remain `LegacyHandoff`. Portal `#32` `Editar` remains `ReviewClientArticle`.

---

## Registry reconciliation

| Field | Value |
|-------|-------|
| CURRENT DISPOSITION | `KEEP_LEGACY` (legacy UI invokes canonical consumer) |
| POST-ACCEPTANCE DISPOSITION | `KEEP_LEGACY` |
| Registry file modified | **NO** |

`KEEP_LEGACY` means the legacy presentation remains for rollback/parity, **not** that React is incomplete. Formal React parity does **not** mean `REMOVE_LEGACY` or T-010-603 deletion.

---

## Security / tenant invariants

| Invariant | Result |
|-----------|--------|
| ADMIN REQUIRED | **YES** |
| TENANT ISOLATION | **PASS** |
| CLIENT ISOLATION | **PASS** (`narrowToClient` + canonical client match) |
| WRONG TENANT / CLIENT | **FAIL CLOSED** (`TENANT_CONTEXT_INVALID`) |
| NON-ADMIN | **FAIL CLOSED** (workspace `react-ws-not-admin`; canonical `requireAdminRole`) |
| CALLER SPOOF FIELDS | **NOT EXPOSED** |
| CROSS-TENANT MUTATION | **NO** |
| MISSING CONTENT | **FAIL CLOSED** (`react-content-editor-missing` / `CONTENT_NOT_FOUND`) |

SAME BUSINESS AUTHORITY = **YES**  
DUPLICATE WRITE PATH = **NO**  
CANONICAL CONSUMER REUSED = **YES**  
BUSINESS LOGIC DUPLICATED IN REACT = **NO**  
AUTHORITY EXPANDED = **NO**  
LEGACY REMOVED = **NO**  
#31 / #33 SEPARATION = **PASS**

---

## Strategic / publication gates

| Gate | Owner | Result |
|------|-------|--------|
| Strategic Brief | canonical `ContentStrategicBriefGatePort` inside `SaveContentDraft` | **PASS** |
| Publication | canonical SPEC-006 publication gate | **PASS** |
| Claim-safety transition | canonical `assertClaimSafeTransition` when status request differs | **PASS** |
| React duplicate policy logic | — | **NO** |

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY `renderContentEditorModal` | **RETAINED** |
| LEGACY `#form-edit-content` | **RETAINED** |
| LEGACY `contentHandlers.ts` | **RETAINED** |
| ROLLBACK SWITCH | **YES** (`applyUiMode('legacy')`) |
| LEGACY MODE | **FUNCTIONAL** |
| REACT MODE | **FUNCTIONAL** |
| CANONICAL STORAGE MODE-INDEPENDENT | **YES** |
| DATA MIGRATION REQUIRED | **NO** |
| T-010-603 DELETION AUTHORIZED | **NO** |
| LEGACY UI REMOVAL AUTHORIZED | **NO** |

---

## Mandatory gate matrix (this review)

| Gate | Required | Result |
|------|----------|--------|
| FOCUSED TESTS | PASS | `tests/reactParityWaveP16SaveContentDraft.test.ts` **16/16 PASS** |
| NEW #31 E2E | PASS | `e2e/reactParityWaveP16SaveContentDraft.spec.ts` **3/3 PASS** |
| FINAL E2E AFTER ROLLBACK FIX | YES | **YES** (committed island-reachable `#form-edit-content`; superseded intermediate sidebar timeout ignored) |
| T508 | 10 / 10 | **10/10 PASS** (`e2e/t010508-phase5-parity.spec.ts` unchanged) |
| FULL CHECK | PASS | **2509 / 2509 PASS** |
| BUILD | PASS | **PASS** |
| CANONICAL AUTHORITY | PASS | **PASS** |
| STRATEGIC BRIEF | PASS | **PASS** |
| TENANT ISOLATION | PASS | **PASS** |
| #31 / #33 SEPARATION | PASS | **PASS** |
| ROLLBACK | PASS | **PASS** |
| PRODUCT DEFECTS | 0 | **0** |
| LEGACY REMOVAL | 0 | **0** |

No additional governed acceptance requirement was found beyond this matrix.

---

## Presentation parity

| Item | Result |
|------|--------|
| EDIT EXISTING CONTENT | **PASS** |
| FIELD PARITY | **PASS** |
| SAVE | **PASS** |
| ERROR PARITY | **PASS** |
| STATUS TRANSITION AUTHORITY | **PASS** (request only; validation canonical) |
| SUCCESS REFRESH | **PASS** |
| NO CREATE AUTHORITY | **PASS** |
| FUNCTIONAL PARITY | **PASS** |

---

## Debt

| Item | Class |
|------|--------|
| React `#31` presentation without formal record | **RESOLVED** (this file) |
| Canonical `#31` consumer | **RESOLVED** (CR-1 frozen) |
| Legacy content editor retained | **FUTURE_T603** (required until independent T-010-603 subset-removal authorization) |
| Registry `KEEP_LEGACY` | **FUTURE_T603** (not a defect) |
| Historical P15 file still lists `#31` READY_FOR_REVIEW | **NONBLOCKING** (historical; not rewritten) |
| Test/E2E artifacts named Wave P16 vs registry `#31` | **NONBLOCKING** (implementation naming; this record binds them) |
| Live remote Firestore E2E backend | **NONBLOCKING** (existing P15-class debt; does not block `#31`) |

BLOCKING COUNT = **0**  
NONBLOCKING COUNT = **3**  
FUTURE T603 ITEMS = legacy content editor + registry `KEEP_LEGACY` until authorized subset removal

Required legacy retention is **not** a product defect.

---

## Handoff / frontier

| Item | Value |
|------|--------|
| #31 REACT PRESENTATION | **COMPLETE** |
| #31 FORMAL ACCEPTANCE | **YES** |
| Registry disposition | **KEEP_LEGACY** |
| #33 CreateContentDraft | **UNCHANGED** / not included |
| SAFE LEGACY SUBSET | **0** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |

**NEXT ACTION:** `T603_REACT_PARITY_POST_31_FRONTIER_REVIEW`  
**NEXT NODE AUTHORIZED:** **NO**
