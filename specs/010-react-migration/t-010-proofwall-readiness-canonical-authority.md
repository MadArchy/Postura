# T-010 — ProofWall Readiness Canonical Authority

**Status:** `PROOFWALL_READINESS_CANONICALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `a0855e93b0b77081ec6ea64798a271baac0cf1ec`  
**Implementation commit:** `a0855e93b0b77081ec6ea64798a271baac0cf1ec`  
**Owner:** CR-1 Master Profile Application  
**Owner decision:** APPROVED (ProofWall readiness #7)  
**Residual:** `#7`  
**Package:** `GP-PROFILE-PROOF` / `PROOFWALL_READINESS`  
**Implementation shape:** ONE_WAVE  
**Command:** `SetProofWallItemReadiness`

This record accepts **canonical CR-1 Application authority** for ProofWall checklist readiness (`pending` / `complete`).  
It is **not** React parity.  
It is **not** registry / `CU?` conversion.  
It is **not** SPEC-006 publication, verification, or evidence-vault authority.  
It is **not** `#2`–`#6` fact-lifecycle reopen.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.

Prior `#2`–`#6` fact-lifecycle and React acceptance records are **not** rewritten.

---

## Provenance

| Role | Value |
|------|--------|
| OWNER DECISION | APPROVE — ProofWall readiness `#7` |
| DESIGN DECISION | `PROOFWALL_READINESS_AUTHORITY_READY_FOR_BOUNDED_IMPLEMENTATION` |
| IMPLEMENTATION DECISION | `PROOFWALL_READINESS_CANONICAL_IMPLEMENTATION_VERIFIED_READY_FOR_COMMIT` |
| FEATURE | `a0855e93b0b77081ec6ea64798a271baac0cf1ec` |
| SUBJECT | `feat(master-profile): canonicalize proofwall readiness` |
| Pre-acceptance HEAD | `a0855e93b0b77081ec6ea64798a271baac0cf1ec` |

Feature `a0855e9` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`a0855e9`)

| Class | File |
|-------|------|
| APPLICATION_COMMAND | `src/application/masterProfile/SetProofWallItemReadiness.ts` |
| APPLICATION_COMMAND / AUTHORITY | `src/application/masterProfile/proofWallReadinessAuthority.ts` |
| APPLICATION_PORT | `src/application/masterProfile/ports/ProofWallItemRepository.ts` |
| APPLICATION_ERROR | `src/application/masterProfile/errors.ts` |
| APPLICATION_EXPORT | `src/application/masterProfile/index.ts` |
| APPLICATION_COMPOSITION | `src/composition/masterProfile/composeMasterProfile.ts` |
| APPLICATION_CONSUMER | `src/services/masterProfileConsumer.ts` |
| PERSISTENCE_ADAPTER | `src/infrastructure/masterProfile/DbProofWallItemAdapter.ts` |
| PERSISTENCE_ADAPTER_EXPORT | `src/infrastructure/masterProfile/index.ts` |
| PERSISTENCE_ADAPTER_SUPPORT_ONLY | `src/services/db.ts` (`getProofWallItem` / `saveProofWallItem` snapshot load/save) |
| TEST | `tests/cr1ProofWallReadiness.test.ts` |

**Unauthorized modifications in feature:** React **0** · Domain business logic **0** · Auth **0** · Registry **0** · Governance **0** · legacy handler **0** · legacy delete **0** · `updateProofWallItem` behavior **0** · SPEC-006 **0** · `#2`–`#6` business change **0** · other residual **0** · unrelated **0**.

PERSISTENCE BUSINESS CHANGE = 0  
LEGACY BUSINESS CHANGE = 0

---

## Command

COMMAND COUNT = 1  
COMMAND SHAPE = ONE_COMMAND  
GENERIC RAW UPDATE WRAPPER = NO  
SEPARATE READY/PENDING COMMANDS = NO  
AUTHORITY BOUNDARY = PASS

| Residual | Command |
|----------|---------|
| `#7` | `SetProofWallItemReadiness` |

Target = `targetStatus: 'pending' \| 'complete'`. Product terms remain `Pendiente` / `Listo`. Persisted tokens remain `pending` / `complete`.

`ApplyOnboardingStep` (#10) and `#2`–`#6` fact commands remain unchanged.

---

## Trusted context / role / tenant

TRUSTED CONTEXT = existing `TrustedMasterProfileContext` (`actorId`, `actorRole`, `organizationId`, `clientId`, `now`) produced by consumer `requireTenantScope`.

| Check | Result |
|-------|--------|
| TRUSTED ACTOR | YES |
| TRUSTED ROLE | YES |
| TRUSTED ORGANIZATION | YES |
| TRUSTED CLIENT | YES |
| CALLER-SUPPLIED ROLE AUTHORITY | NO |
| CALLER-SUPPLIED ORG AUTHORITY | NO |
| CALLER-SUPPLIED CLIENT AUTHORITY | NO |
| ADMIN (chosen client in trusted org) | PASS |
| CLIENT OWN CLIENT | DENY |
| CLIENT FOREIGN CLIENT | DENY |
| ROLE POLICY | PASS |
| CLIENT RELOAD | PASS |
| ITEM MEMBERSHIP | PASS |
| ORG MATCH | PASS |
| CLIENT MATCH | PASS |
| CROSS-CLIENT | FAIL-CLOSED |
| CROSS-ORG | FAIL-CLOSED |
| TENANT ISOLATION | PASS |

This role policy differs intentionally from `#2`–`#6` CLIENT-own fact writes. Optional claimed org/client exist only for spoof detection.

---

## Aggregate / state / mutation

AGGREGATE BOUNDARY = PASS  
`ProofWallItem` remains a sibling collection (`proofWallItems` / `postura_proof_wall_v1`). It is not stored on `ClientProfile`.

| Check | Result |
|-------|--------|
| PROFILE RELOAD REQUIRED | NO |
| `saveProfile` USED | NO |
| ProofWall item load/save | YES |
| PENDING | VALID |
| COMPLETE | VALID |
| OTHER | INVALID |
| STATE MODEL | PASS |

| Current | Target | Result |
|---------|--------|--------|
| `pending` | `complete` | ALLOW |
| `complete` | `pending` | ALLOW |
| `pending` | `pending` | ALLOW / idempotent |
| `complete` | `complete` | ALLOW / idempotent |
| unknown persisted status | any | FAIL-CLOSED `INVALID_PROOF_WALL_STATE` |
| missing item | any | FAIL-CLOSED `PROOF_WALL_ITEM_NOT_FOUND` |

STATE MATRIX = PASS  
STATUS-ONLY MUTATION = PASS

Unchanged: `organizationId`, `clientId`, `category`, `title`, `description`, `sourceUrl`, `evidenceId`, `sortOrder`.

---

## Persistence / adapter

| Field | Value |
|-------|--------|
| Port | `ProofWallItemRepository` · `getProofWallItem` / `saveProofWallItem` |
| Adapter | `createDbProofWallItemRepository` |
| Raw Application `updateProofWallItem(itemId, status)` port | NO |
| DIRECT `dbService` FROM APPLICATION | NO |
| Adapter role / tenant / transition rules | NO |
| Legacy `dbService.updateProofWallItem` | unchanged |
| PERSISTENCE PORT | PASS |
| ADAPTER | PASS |
| PERSISTENCE BUSINESS CHANGE | 0 |

---

## Errors / SPEC-006 / side effects

ERROR CONTRACT = PASS

Codes used by `#7`: `INVALID_INPUT` · `ACTOR_NOT_AUTHORIZED` · `TENANT_CONTEXT_INVALID` · `CLIENT_NOT_FOUND` · `PROOF_WALL_ITEM_NOT_FOUND` · `INVALID_PROOF_WALL_STATE` · `PERSISTENCE_ERROR`

`FACT_NOT_FOUND` used = NO  
`INVALID_FACT_STATE` used = NO  
`PROFILE_NOT_FOUND` required = NO

| Boundary | Result |
|----------|--------|
| SPEC-006 CALLS | 0 |
| PUBLICATION MUTATION | 0 |
| VERIFICATION MUTATION | 0 |
| VAULT MUTATION | 0 |
| SPEC-006 BOUNDARY | PASS |
| PROFILE COMPLETENESS | NO |
| PROOF SCORE | NO |
| CLIENT BADGE PERSIST | NO |
| ONBOARDING | NO |
| FACT LIFECYCLE | NO |
| SIDE EFFECT BOUNDARY | PASS |

Read-time `{complete}/{total} listos` and ≥70 badge remain presentation-derived.

---

## Consumer / composition / legacy debt not copied

CONSUMER = PASS — `masterProfileConsumer.setProofWallItemReadiness` derives trusted context via `requireTenantScope(requestedClientId)`, delegates to `SetProofWallItemReadiness`, does not implement the transition, and does not authorize from UI/`editable`.

COMPOSITION = PASS — ProofWall adapter → canonical Application command → Master Profile consumer. SECOND AUTHORITY PATH = NO. RAW PERSISTENCE EXPOSED TO UI = NO.

UNSAFE LEGACY BEHAVIOR COPIED = 0

Not copied: DOM as tenant authority, missing role/org/client checks, silent `false` on missing item, success after failed persist, cross-tenant id lookup, presentation `editable` as authorization, arbitrary runtime status.

BUSINESS SEMANTICS = PASS — bidirectional `pending` ↔ `complete`, same-state idempotence, listo/pendiente product language, ADMIN write authority, status-only mutation.

---

## Audit classification

| Field | Value |
|-------|--------|
| EXACT PROOFWALL EVENT | NONE |
| MANDATORY AUDIT EVENT REQUIRED FOR CONSUMER VALIDITY | NO |
| EVENT INVENTED | NO |
| UNRELATED EVENT REUSED | NO |
| #10 AUDIT CHANGED | NO |
| AUDIT BLOCKS CANONICAL VALIDITY | NO |
| CLASSIFICATION | `AUDIT_NONBLOCKING_GOVERNANCE_DEBT` |

`ONBOARDING_STEP_COMPLETED` / `COMPLETE_ONBOARDING` remain #10-only. Consumer `#7` does not invent action identifiers.

---

## Verification evidence (implementation wave)

| Gate | Result |
|------|--------|
| FOCUSED | PASS · 28 (`tests/cr1ProofWallReadiness.test.ts`) |
| PROFILE DEPENDENCY | NONE · missing Master Profile does not block readiness |
| CR-1 | PASS · 19 (`tests/cr1MasterProfile.test.ts`) |
| PROFILE FACT | PASS · 58 (`tests/cr1MasterProfileFactLifecycle.test.ts`) · `#2`–`#6` command changes **0** |
| SECURITY | PASS · 53 (`reactMigrationPhase4cSecurity` 33 + `cr3TrustedTenantEntitlement` 17 + `adminTenantEnvelope` 3) |
| PROOFWALL/PERSISTENCE | PASS · 63 (`reactMigrationPhase2Architecture` 40 + Wave2 read 18 + `actorAwarePersistence.q2` 5) |
| FULL CHECK | PASS · 2697 |
| BUILD | PASS |
| PRODUCT DEFECTS | 0 |
| NEW UNAUTHORIZED BUSINESS AUTHORITY | 0 |

Focused coverage includes ADMIN both directions, same-state, invalid target, CLIENT deny (own + foreign), wrong org/client, missing client/item, foreign item, unknown state, persistence failure, no profile dependency, no publication/verification/SPEC-006, cross-client fail-closed, spoof resistance.

---

## Hard boundaries

| Boundary | Result |
|----------|--------|
| REACT MODIFICATIONS | 0 |
| REACT DISPOSITION | `READ_ONLY_REACT` |
| REGISTRY MODIFICATIONS | 0 |
| CU? | NO (unchanged) |
| #2–#6 BUSINESS MODIFICATIONS | 0 |
| LEGACY HANDLERS | retained (`profileHandlers.ts` still owns the live toggle) |
| LEGACY DELETION | 0 |
| SPEC-006 MODIFICATIONS | 0 |
| T-010-603 | NOT_AUTHORIZED |
| T-010-604 | NOT_AUTHORIZED |
| A43 | PARTIAL |
| SAFE LEGACY SUBSET | NONE |
| T603 REVIEW MEANINGFUL | NO |
| REACT / REGISTRY BOUNDARY | PASS |

---

## Debt

**BLOCKING DEBT = 0**

**NONBLOCKING DEBT**

- ProofWall audit event names = `AUDIT_NONBLOCKING_GOVERNANCE_DEBT`
- `#7` React remains `READ_ONLY_REACT`
- Registry `#7` `CU?` remains NO until a separate reconciliation review
- Legacy ProofWall toggle and `profileHandlers.ts` retained (intentional; not a product defect)
- Rollback retention remains; T603 is not meaningful from this acceptance alone

**FUTURE GOVERNANCE**

- Registry / `CU?` reconciliation for `#7`
- React parity design (only after CU reconciliation, matching `#2`–`#6` sequence)
- React parity implementation / acceptance
- Legacy `profileHandlers` ProofWall listener retained until React parity + separately authorized T603

---

## Formal decision

`PROOFWALL_READINESS_CANONICALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`

All mandatory acceptance gates pass. Blocking debt = 0. Explicit nonblocking audit-name, React-read-only, `CU?=NO`, and legacy-retention debt remain. React, registry/`CU?`, SPEC-006, `#2`–`#6`, and T603/T604 are not started by this record.

---

## Post-acceptance effects (not executed)

REGISTRY RECONCILIATION ELIGIBLE = YES  
REACT DESIGN ELIGIBLE NOW = NO

Repository precedent from `#2`–`#6`: canonical implementation → formal canonical acceptance → registry/`CU?` reconciliation → React parity design. React write design must not start while `#7` `CU?` remains NO.

`profileHandlers.ts` still needed = YES  
legacy ProofWall toggle still needed = YES  
SAFE LEGACY SUBSET = NONE  
T603 REVIEW MEANINGFUL = NO

---

## Next frontier (not executed)

**NEXT FRONTIER =** `AUTHORIZE_PROOFWALL_READINESS_REGISTRY_CU_RECONCILIATION_REVIEW`  
**NEXT FRONTIER AUTHORIZED =** NO

Registry `CU?` means a canonical Application use case exists. `SetProofWallItemReadiness` now exists and is formally accepted, but this acceptance must not flip `CU?` or start React. A separate reconciliation review is required before registry change.
