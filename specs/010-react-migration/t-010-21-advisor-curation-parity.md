# T603 React Parity — `#21` Advisor `AddAdviceActionToCuration`

**Status:** `ADVISOR_21_FORMALLY_ACCEPTED`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `b76774db060ec173410455fc6daade64cb452ef2`  
**Implementation commit:** `b76774db060ec173410455fc6daade64cb452ef2`  
**Priority / frontier:** `POST_16_FRONTIER_21_ADVISOR`  
**Registry:** `#21` advisor half — ClientWorkspace positioning / existing advice actions  
**Application:** CR-1 Execution Delivery  
**Canonical command:** `AddAdviceActionToCuration`  
**Presentation model:** `ONE_WAVE` · `CLICK_ONLY`

This record accepts the **T603 React presentation wave** for residual `#21 advisor`.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.  
It is **not** P9 radar `#21` (`AddSignalToCuration` / `MarkSignalSaved`).  
It is **not** AI `generatePositioningAdvice` / P5.  
It is **not** `runTopicAgent`.  
It is **not** `#22` scoring / recommendations.  
It is **not** `#33` `CreateContentDraft` / SPEC-005.

The filename uses residual `#21`, not a P-wave number. P9 radar remains `t-010-p9-radar-discard-curation-parity.md`.

Historical `#16`, Source Management, P3B, P16, and earlier acceptance records are **not** rewritten.

---

## Provenance

| Role | SHA |
|------|-----|
| CR-1 `#21a` B2 FREEZE | Wave B2 `AddAdviceActionToCuration` |
| PHASE-6 PRIORITY | `0c3d984` · `PHASE6_RESIDUAL_PRIORITY_28_P3B` |
| `#16` ACCEPTANCE | `3bfd6ca` |
| POST-#16 FRONTIER | `POST_16_FRONTIER_21_ADVISOR` |
| DESIGN DECISION | `ADVISOR_21_READY_FOR_BOUNDED_IMPLEMENTATION` |
| FEATURE | `b76774db060ec173410455fc6daade64cb452ef2` |
| Pre-acceptance HEAD | `b76774db060ec173410455fc6daade64cb452ef2` |

Feature `b76774d` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`b76774d`)

SUBJECT = `feat(react): add advisor curation parity`

| Class | Files |
|-------|--------|
| QUERY_READ | `src/ui/data/compatibilityReads.ts` |
| PRODUCT_HOOK | `src/ui/hooks/useWave3Data.ts` |
| COMMAND_ADAPTER | `src/ui/commands/commandSeam.ts` |
| PRODUCT_UI | `src/ui/modules/pages/ReactClientWorkspacePage.tsx` |
| TEST | `tests/reactParityWave21AdvisorCuration.test.ts` |
| E2E | `e2e/reactParityWave21AdvisorCuration.spec.ts` |
| TEST | `tests/reactParityWaveP9RadarDiscardCuration.test.ts` |
| TEST | `tests/reactParityWave16RemoveReopenCuration.test.ts` |

**Unauthorized modifications in feature:** Application **0** · Domain **0** · Auth **0** · canonical `AddAdviceActionToCuration` **0** · AI / model **0** · topic agent **0** · `#22` **0** · `#33` **0** · SPEC-005 **0** · pipeline **0** · Firebase rules **0** · Firestore business authority **0** · Registry **0** · Governance **0** · legacy deletions **0** · unrelated **0**.

---

## Accepted authority (unchanged)

| Field | Value |
|-------|-------|
| COMMAND | `AddAdviceActionToCuration` (`createAddAdviceActionToCuration`) — new pending `CurationEntry` |
| CONSUMER | `executionDeliveryConsumer.addAdviceActionToCuration` |
| SEAM | `executionDeliveryCommands.addAdviceActionToCuration` |
| HOOKS | `useWorkspaceAdvice` · `useAddAdviceActionToCuration` |
| READ | `readWorkspaceAdvice` (compatibility, presentation-only) |
| HOST | `AdviceActionsPanel` on existing positioning tab of `ReactClientWorkspacePage` |
| Public input | `requestedClientId` from trusted / `narrowToClient` scope · `adviceActionId` |
| Caller organization / role | **0** |
| CU? | **YES** |
| OWNER | CR-1 Execution Delivery Application |
| React dbService business write | **0** |
| Direct Firestore business write from React | **0** |
| LOCAL CURATION CREATE | **NO** |
| LOCAL ADVICE MUTATION | **NO** |
| LOCAL AI / TOPIC AGENT / SCORE | **NO** |
| EXTRA REACT `ADVICE_TO_CURATION` AUDIT | **NO** (legacy handler extra is not ported) |

Canonical command remains responsible for ADMIN role, trusted org/client, authoritative advice-action reload, advice ownership, curation persistence, and error classification (`INVALID_INPUT` / `ACTOR_NOT_AUTHORIZED` / `TENANT_CONTEXT_INVALID` / `ADVICE_ACTION_NOT_FOUND` / `PERSISTENCE_ERROR`).

Mutation path:

React positioning `AdviceActionsPanel` existing action → `Preparar entrega` → `useAddAdviceActionToCuration` → `executionDeliveryCommands.addAdviceActionToCuration` → consumer → frozen `AddAdviceActionToCuration`.

`ADVICE_ACTION_NOT_FOUND` maps to bounded failure (`El consejo ya no existe.`). It is not converted into success.

---

## Advice read

| Field | Value |
|-------|-------|
| READ SOURCE | `dbService.getLatestAdvice(clientId)` via `readWorkspaceAdvice(scope)` |
| FIELDS | `adviceId` · `actions[].id` · `title` · `why` · `how` · `horizon` · `category` · `impact` |
| TENANT/CLIENT SCOPE | `requireClient(scope)` — trusted / narrowed workspace client |
| NEW BUSINESS QUERY | **0** |
| NEW APPLICATION QUERY | **0** |
| DIRECT WRITE | **0** |
| AI INVOCATION | **0** |
| READ AUTHORITY | **PASS** |

---

## Product surface

| Field | Value |
|-------|-------|
| FIELDS DISPLAYED | title · why · how · horizon · category · impact |
| ACTION LABEL | `Preparar entrega` |
| EMPTY STATE | `No hay acciones de consejo para este cliente.` |
| GENERATE / REGENERATE / AI / TOPIC / #22 / #33 | **NO** |
| PRODUCT SURFACE | **PASS** |
| CLICK-ONLY BOUNDARY | **PASS** |
| ADVICE GENERATION | **NO** |
| AI MODEL CALL | **NO** |
| TOPIC AGENT | **NO** |
| SOURCE DISCOVERY | **NO** |
| SIGNAL SCORING | **NO** |
| DRAFT GENERATION | **NO** |
| PIPELINE | **NO** |

---

## Duplicate semantics

The frozen command has no dedup / idempotency protection.

| Field | Value |
|-------|-------|
| already-added persisted state | **NO** |
| client-side business dedup | **NO** |
| permanent disable after success | **NO** |
| local curation existence check | **NO** |
| in-flight disable of the clicked action | **YES** (presentation only) |
| BUSINESS DEDUP INVENTED | **NO** |
| DUPLICATE SEMANTICS PRESERVED | **YES** |

---

## Tenant isolation / query invalidation

| Field | Value |
|-------|-------|
| CLIENT SCOPE | trusted / `narrowToClient(workspaceClientId)` |
| ORG SCOPE | session-derived |
| ROLE | session-derived (canonical ADMIN) |
| CALLER-SUPPLIED ROLE / TRUSTED ORG | **NO** |
| CROSS-CLIENT ACTION | **FAIL-CLOSED** |
| FOREIGN ADVICE ACTION | **FAIL-CLOSED** |
| SPOOFED CLIENT | `TENANT_CONTEXT_INVALID` |
| CLIENT ROLE | `ACTOR_NOT_AUTHORIZED` |
| TENANT ISOLATION | **PASS** |
| KEYS INVALIDATED | `compatibility` / `workspace-deliver` |
| ADVICE / RADAR / SESSION / GLOBAL TENANT | **NO** |
| P15 COMPATIBILITY CONTRACT PRESERVED | **YES** (tenant-scoped key; invalidate, do not patch) |
| QUERY INVALIDATION | **PASS** |

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY `ClientWorkspace.ts` | **RETAINED** |
| LEGACY `advisorHandlers.ts` | **RETAINED** |
| LEGACY `ws-briefing` island | **RETAINED** |
| LEGACY `Preparar entrega` (`btn-advice-to-curation`) | **RETAINED** |
| LEGACY advice rendering | **RETAINED** |
| LEGACY AI generation (`btn-generate-advice`) | **RETAINED** |
| LEGACY topic agent (`btn-run-topic-agent`) | **RETAINED** |
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

Both historical edits in `b76774d` are `STALE_EXPECTATION_RECONCILIATION`.

| File | Previous intent | New intent | Why required |
|------|-----------------|------------|--------------|
| `tests/reactParityWaveP9RadarDiscardCuration.test.ts` | file-wide React seam and workspace page must not contain `addAdviceActionToCuration` | `radarCommands` block and `RadarPanel` slice must not contain `addAdviceActionToCuration` | authorized click-only advisor now lives in `executionDeliveryCommands` and `AdviceActionsPanel`; file-wide negatives became stale. Radar still uses `addSignalToCuration` / `markSignalSaved`. `addRecommendation`, `dbService`, radarHandlers, and radar composite advisor bans remain |
| `tests/reactParityWave16RemoveReopenCuration.test.ts` | entire `useWave3Data.ts` must not contain `addAdviceActionToCuration` | `useRemoveCuration` and `useReopenCuration` blocks must not contain it | new authorized advisor hooks share the hook file. `deliverPanel()` and the `#16` seam slice already isolated Deliver `#16` from advisor |

Specifically:

A. P9 still proves Radar `#21` remains on its existing canonical signal path.  
B. Radar does **not** invoke `AddAdviceActionToCuration`.  
C. Advisor click does not migrate into Radar.  
D. `#16` remove/reopen authority, tenant isolation, and rollback protections are unchanged.  
E. `addRecommendation`, AI, topic-agent, and other previously blocked mutators remain absent from Radar and Deliver `#16`.

P9 CLASSIFICATION = `STALE_EXPECTATION_RECONCILIATION`  
#16 CLASSIFICATION = `STALE_EXPECTATION_RECONCILIATION`  
TEST WEAKENING = **0**  
UNRELATED TEST CHANGE = **0**  
HISTORICAL TEST RECONCILIATION = **PASS**

---

## Mandatory gate matrix (this review)

| Gate | Required | Result |
|------|----------|--------|
| `#21` FOCUSED | PASS, ≥18 | `tests/reactParityWave21AdvisorCuration.test.ts` **19/19 PASS** (A–R + authority boundary) |
| `#21` E2E | 4 / 4 | `e2e/reactParityWave21AdvisorCuration.spec.ts` **4/4 PASS** (success · foreign fail-closed · no AI · rollback) |
| CR-1 WAVE B2 | PASS | `tests/cr1ExecutionDelivery.test.ts` `-t "Wave B2"` **19/19 PASS** |
| P9 REGRESSION | PASS | `tests/reactParityWaveP9RadarDiscardCuration.test.ts` **13/13 PASS** |
| DELIVER REGRESSIONS | PASS | P10 **14** · P13 **22** PASS |
| PHASE-3 | PASS | Phase-3 pages **19** · Phase-3 architecture **27** PASS |
| LEGACY ADVISOR | PASS | CR-1 B2 advisor handlers + P9 advisor rollback + T403 island **11** + `#16` **19** PASS |
| HISTORICAL TEST RECONCILIATION | PASS | **PASS** (stale-expectation only) |
| FULL CHECK | PASS | **2584 / 2584 PASS** |
| BUILD | PASS | **PASS** |
| TENANT ISOLATION | PASS | **PASS** |
| CANONICAL DELEGATION | PASS | **PASS** |
| CLICK-ONLY BOUNDARY | PASS | **PASS** |
| NO AI | PASS | **PASS** |
| NO TOPIC AGENT | PASS | **PASS** |
| `#22` EXCLUSION | PASS | **PASS** |
| `#33` EXCLUSION | PASS | **PASS** |
| NEW BUSINESS AUTHORITY | 0 | **0** |
| PRODUCT DEFECTS | 0 | **0** |
| LEGACY DELETION | 0 | **0** |
| ROLLBACK | PASS | **PASS** |

These are the final implementation-tree runs immediately before commit `b76774d`.

REMOTE AI = **NO**  
REMOTE NETWORK = **NO**  
REMOTE FIRESTORE = **NO**  
DETERMINISTIC FIXTURE = **YES** (`dbService.saveAdvice`)

---

## Focused coverage (`tests/reactParityWave21AdvisorCuration.test.ts`)

CASE COUNT = **19**

| Case | Proves |
|------|--------|
| A | seeded existing advice action appears via `readWorkspaceAdvice` |
| B | factual title / why / how / horizon / category / impact |
| C | `Preparar entrega` exists; no generate controls |
| D | click delegates to canonical `AddAdviceActionToCuration` |
| E | exact `adviceActionId` reaches consumer |
| F | client from narrowed workspace scope |
| G | no direct curation DB write |
| H | no local curation creation |
| I | foreign advice action fail-closed |
| J | CLIENT / unauthorized role fail-closed |
| K | invalidate only `workspace-deliver` |
| L | advice query is not invalidated |
| M | `ADVICE_ACTION_NOT_FOUND` is bounded failure |
| N | no `generatePositioningAdvice` |
| O | no `runTopicAgent` |
| P | no `#22` mutation |
| Q | no `#33` / `CreateContentDraft` |
| R | legacy advisor path retained |
| authority boundary | React does not import Application writers |

advice read = **YES**  
factual fields = **YES**  
Preparar entrega = **YES**  
canonical mutation = **YES**  
exact action id = **YES**  
narrowed client = **YES**  
no direct DB writes = **YES**  
no local curation creation = **YES**  
cross-client fail-closed = **YES**  
CLIENT unauthorized = **YES**  
bounded query invalidation = **YES**  
`ADVICE_ACTION_NOT_FOUND` failure = **YES**  
no AI = **YES**  
no topic-agent = **YES**  
no `#22` = **YES**  
no `#33` = **YES**  
legacy retained = **YES**  
FOCUSED EVIDENCE = **PASS**

---

## Adjacent residual exclusion

| Field | Value |
|-------|-------|
| `generatePositioningAdvice` INVOCATION | **0** |
| AI MODEL INVOCATION | **0** |
| `runTopicAgent` INVOCATION | **0** |
| TOPIC-AGENT MODIFICATION | **0** |
| P5 MODIFICATION | **0** |
| `#22` MODIFICATIONS | **0** |
| `#22` COMMAND INVOCATIONS | **0** |
| `#33` MODIFICATIONS | **0** |
| `CreateContentDraft` INVOCATIONS | **0** |
| SPEC-005 MODIFICATIONS | **0** |
| PIPELINE MODIFICATIONS | **0** |
| P9 RADAR `#21` SIGNAL PATH | **UNCHANGED** |
| ADVISOR COMMAND IN RADAR | **NO** |
| EXCLUSION CONTRACT | **PASS** |

---

## Debt

| Item | Class |
|------|--------|
| React `#21` click-only presentation without formal record | **RESOLVED** (this file) |
| Canonical `AddAdviceActionToCuration` | **RESOLVED** (CR-1 Wave B2 frozen) |
| Historical P9 / `#16` advisor-absent negatives | **RESOLVED** (stale-expectation reconciliation) |
| Legacy `ClientWorkspace` / `advisorHandlers` / `ws-briefing` | **FUTURE_T603** (retained because generation / topic-agent siblings remain; required until independent T-010-603 subset-removal authorization) |
| AI generation (`generatePositioningAdvice` / P5) | **FUTURE_RESIDUAL** (EXTERNAL) |
| Topic agent (`runTopicAgent`) | **FUTURE_RESIDUAL** |
| `#22` score / investigate / recommended sources | **FUTURE_RESIDUAL** (blocked / partial) |
| `#33` `CreateContentDraft` / SPEC-005 | **FUTURE_RESIDUAL** (external-owner constrained) |
| A43 / T-010-603 SAFE LEGACY SUBSET | **FUTURE_RESIDUAL** (still **NONE**; not unlocked by `#21`) |

BLOCKING COUNT = **0**  
NONBLOCKING COUNT = **0**  
FUTURE RESIDUALS = legacy advisor island / AI generation / topic agent / `#22` / `#33` / CU?=NO rows / A43 / T603

Intentional legacy retention for rollback and sibling AI / topic-agent surfaces is **not** a product defect.

SAFE LEGACY SUBSET CREATED BY `#21` = **NO**

---

## Handoff / frontier

| Item | Value |
|------|--------|
| `#21` PRODUCT IMPLEMENTATION | **COMPLETE** |
| `#21` FORMAL ACCEPTANCE | **YES** |
| SAFE LEGACY SUBSET | **NONE** |
| A43 | **PARTIAL** (8-condition T603 gate still not removable; no proven subset) |
| T603 REVIEW MEANINGFUL | **NO** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |
| NEXT FRONTIER | remaining Phase-6 residuals after `#21` — no remaining CU?=YES click-only isolable React write; `#33` EXTERNAL; CU?=NO / `#22` / P5 AI / pipeline / impersonation / A43-T603 |
| NEXT FRONTIER AUTHORIZED | **NO** |

Stage-1 cutover-spine residuals named by `PHASE6_RESIDUAL_PRIORITY_28_P3B` remain accepted. `#16` remains accepted. `#21` advisor click-only is now accepted. Remaining candidates require a separate residual-priority or design review. This record does **not** select or authorize the next residual.

**NEXT ACTION:** `T603_REACT_PARITY_POST_21_FRONTIER_REVIEW`  
**NEXT NODE AUTHORIZED:** **NO**
