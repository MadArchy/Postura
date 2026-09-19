# T-010 — Master Profile Fact Lifecycle Canonical Authority

**Status:** `PROFILE_FACT_CANONICAL_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `40f9b59472a194f3e27e19f668e223863780a15e`  
**Implementation commit:** `40f9b59472a194f3e27e19f668e223863780a15e`  
**Owner:** CR-1 Master Profile Application  
**Owner decision:** APPROVED (fact lifecycle #2–#6)  
**Residuals:** `#2` · `#3` · `#4` · `#5` · `#6`  
**Package:** `GP-PROFILE-PROOF` / `MASTER_PROFILE_FACT_LIFECYCLE`  
**Implementation shape:** ONE_WAVE

This record accepts **canonical CR-1 Application authority** for profile fact lifecycle mutations.  
It is **not** React parity.  
It is **not** registry / `CU?` conversion.  
It is **not** `#7` ProofWall readiness.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.

Historical `#21`, `#16`, Source Management, P-wave, and earlier acceptance records are **not** rewritten.

---

## Provenance

| Role | Value |
|------|--------|
| OWNER DECISION | APPROVE — fact lifecycle `#2`–`#6` |
| DESIGN DECISION | `PROFILE_FACT_AUTHORITY_READY_FOR_BOUNDED_CANONICAL_IMPLEMENTATION` |
| IMPLEMENTATION DECISION | `PROFILE_FACT_CANONICAL_IMPLEMENTATION_VERIFIED_READY_FOR_COMMIT` |
| FEATURE | `40f9b59472a194f3e27e19f668e223863780a15e` |
| SUBJECT | `feat(master-profile): canonicalize profile fact lifecycle` |
| Pre-acceptance HEAD | `40f9b59472a194f3e27e19f668e223863780a15e` |

Feature `40f9b59` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`40f9b59`)

| Class | File |
|-------|------|
| APPLICATION_COMMAND | `src/application/masterProfile/AddProfileFact.ts` |
| APPLICATION_COMMAND | `src/application/masterProfile/ConfirmProfileFact.ts` |
| APPLICATION_COMMAND | `src/application/masterProfile/RejectProfileFact.ts` |
| APPLICATION_COMMAND | `src/application/masterProfile/UpdateProfileFact.ts` |
| APPLICATION_COMMAND | `src/application/masterProfile/ImportProfileFactsFromCv.ts` |
| APPLICATION_COMMAND | `src/application/masterProfile/profileFactAuthority.ts` |
| APPLICATION_ERROR | `src/application/masterProfile/errors.ts` |
| APPLICATION_COMPOSITION | `src/application/masterProfile/index.ts` |
| APPLICATION_COMPOSITION | `src/composition/masterProfile/composeMasterProfile.ts` |
| APPLICATION_CONSUMER | `src/services/masterProfileConsumer.ts` |
| TEST | `tests/cr1MasterProfileFactLifecycle.test.ts` |

**Unauthorized modifications in feature:** React **0** · Domain business logic **0** · Auth **0** · persistence behavior **0** · Firestore business authority **0** · Registry **0** · Governance **0** · legacy handler **0** · legacy delete **0** · `#7` **0** · other residual **0** · unrelated **0**.

---

## Command family

COMMAND COUNT = 5  
GENERIC MUTATE COMMAND = NO  
COMBINED CONFIRM/REJECT = NO  
AUTHORITY BOUNDARIES = PASS

| Residual | Command |
|----------|---------|
| `#2` | `AddProfileFact` |
| `#3` | `ConfirmProfileFact` |
| `#4` | `RejectProfileFact` |
| `#5` | `UpdateProfileFact` |
| `#6` | `ImportProfileFactsFromCv` |

`ApplyOnboardingStep` (#10) remains unchanged.

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
| TENANT MODEL | PASS |
| ADMIN (chosen client in trusted org) | PASS |
| CLIENT OWN CLIENT | PASS |
| CLIENT FOREIGN CLIENT | FAIL-CLOSED |
| ROLE POLICY | PASS |
| CROSS-CLIENT | FAIL-CLOSED |
| ORG MISMATCH | FAIL-CLOSED |
| PROFILE ENVELOPE MISMATCH | FAIL-CLOSED |
| FOREIGN FACT | FAIL-CLOSED |
| TENANT ISOLATION | PASS |

Optional claimed org/client exist only for spoof detection.

---

## Fact-state matrix

| Intent | Result |
|--------|--------|
| new manual add | `confirmed` + `manual` |
| new CV import | `candidate` + `cv` |
| candidate confirm | `confirmed` |
| candidate reject | `rejected` (stored; presentation hides) |
| candidate edit | DENY `INVALID_FACT_STATE` |
| confirmed confirm | DENY |
| confirmed reject | DENY |
| confirmed value edit | ALLOW |
| rejected confirm | DENY (no reopen) |
| rejected reject | DENY |
| rejected edit | DENY |

No new states. No recover command.

FACT STATE MATRIX = PASS  
ADD AUTHORITY = PASS  
CONFIRM AUTHORITY = PASS  
REJECT AUTHORITY = PASS  
UPDATE AUTHORITY = PASS  

Update mutates **value** only. Id, section, label, status, source, createdAt, and tenant remain Application-owned.

---

## CV import / PII

CV IMPORT AUTHORITY = PASS

| Field | Value |
|-------|-------|
| Domain reuse | `extractCandidateFactsFromCv` unchanged |
| NEW DOMAIN EXTRACTION LOGIC | 0 |
| AI | NO |
| NETWORK | NO |
| EXTERNAL SERVICE | NO |
| Line / fact limits | Domain 80 lines / 24 facts |
| `cvExtractedText` | ≤ 12000 |
| Dedup | case-insensitive value |
| PII SCOPE | trusted client only |
| CROSS-CLIENT PII | NO |
| RETENTION POLICY INVENTED | NO |
| CV PII BOUNDARY | PASS |

---

## Persistence / completeness / Domain

| Field | Value |
|-------|-------|
| Port | existing `MasterProfileRepository` |
| Mutation path | authoritative reload + in-memory mutate + `saveProfile` |
| DIRECT `dbService` FROM APPLICATION | 0 |
| NEW FACT-SPECIFIC PORT | 0 |
| NEW RAW STATUS / GENERIC UPDATE PORT | 0 |
| PERSISTENCE BOUNDARY | PASS |
| APPLICATION COMPLETENESS FORMULA | 0 |
| REACT COMPLETENESS FORMULA | 0 |
| Completeness owner | adapter `saveMasterProfile` → `refreshProfileCompleteness` → Domain `computeProfileCoverage` |
| COMPLETENESS | PASS |
| DOMAIN BUSINESS LOGIC CHANGES | 0 |
| DOMAIN BOUNDARY | PASS |

---

## Errors / consumer / legacy debt not copied

ERROR CONTRACT = PASS  
`INVALID_STEP` USED FOR FACT LIFECYCLE = NO

Codes: `INVALID_INPUT` · `ACTOR_NOT_AUTHORIZED` · `TENANT_CONTEXT_INVALID` · `CLIENT_NOT_FOUND` · `PROFILE_NOT_FOUND` · `FACT_NOT_FOUND` · `INVALID_FACT_STATE` · `PERSISTENCE_ERROR`

CONSUMER = PASS — `masterProfileConsumer` derives trusted context, delegates to the five commands, does not persist facts, does not own transitions, does not accept caller role/org/client authority.

| Debt class | Copied |
|------------|--------|
| UNSAFE LEGACY BEHAVIOR | 0 |
| SECURITY DEBT | 0 |
| ERROR-HANDLING DEBT | 0 |
| PERSISTENCE PERMISSIVENESS | 0 |

Not copied: DOM client authority, no-role/no-org, missing-profile success, ignored false persist, unguarded confirm/reject, generic label/status edit, silent missing entities.

---

## Audit classification

| Field | Value |
|-------|-------|
| FACT-LIFECYCLE AUDIT EVENT EXISTS | NO |
| MANDATORY AUDIT EVENT REQUIRED FOR CONSUMER VALIDITY | NO |
| NEW AUDIT CODE INVENTED | NO |
| #10 AUDIT CHANGED | NO |
| CLASSIFICATION | `AUDIT_NONBLOCKING_GOVERNANCE_DEBT` |

`ONBOARDING_STEP_COMPLETED` / `COMPLETE_ONBOARDING` remain #10-only. Consumer fact operations do not invent action identifiers. Architecture has no closed audit catalog that would make consumer completion invalid.

---

## Verification evidence (implementation wave)

| Gate | Result |
|------|--------|
| FOCUSED | PASS · 58 (`tests/cr1MasterProfileFactLifecycle.test.ts`) |
| CR-1 | PASS · 19 (`tests/cr1MasterProfile.test.ts`) · `ApplyOnboardingStep` unchanged |
| SECURITY | PASS · 50 (`cr3TrustedTenantEntitlement` + `reactMigrationPhase4cSecurity`) |
| FULL CHECK | PASS · 2642 |
| BUILD | PASS |
| PRODUCT DEFECTS | 0 |
| NEW UNAUTHORIZED BUSINESS AUTHORITY | 0 |

---

## Hard boundaries

| Boundary | Result |
|----------|--------|
| REACT MODIFICATIONS | 0 |
| REACT PARITY | NOT_STARTED |
| REGISTRY MODIFICATIONS | 0 |
| CU? | NO (unchanged) |
| #7 COMMAND / DESIGN / IMPLEMENTATION | NONE / NOT_STARTED / NONE |
| #7 MODIFICATIONS | 0 |
| LEGACY HANDLERS | retained |
| LEGACY DELETION | 0 |
| T-010-603 | NOT_AUTHORIZED |
| T-010-604 | NOT_AUTHORIZED |
| A43 | PARTIAL |
| SAFE LEGACY SUBSET | NONE |
| #7 BOUNDARY | PASS |
| REACT / REGISTRY BOUNDARY | PASS |

---

## Debt

**BLOCKING DEBT = 0**

**NONBLOCKING DEBT**

- Fact-lifecycle audit event names = `AUDIT_NONBLOCKING_GOVERNANCE_DEBT`

**FUTURE GOVERNANCE**

- React parity for `#2`–`#6`
- Registry / `CU?` reconciliation for `#2`–`#6`
- Legacy `profileHandlers` retained until React parity + separately authorized T603
- `#7` ProofWall = separate owner-approved design review (`AUTHORIZE_PROOFWALL_READINESS_CANONICAL_AUTHORITY_DESIGN_REVIEW`)

---

## Formal decision

`PROFILE_FACT_CANONICAL_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`

All mandatory acceptance gates pass. Blocking debt = 0. Explicit nonblocking audit-name debt remains. React, `CU?`, `#7`, and T603/T604 are not started by this record.

---

## Next frontier (not executed)

**NEXT FRONTIER =** `AUTHORIZE_PROFILE_FACT_REGISTRY_CU_RECONCILIATION_REVIEW`  
**NEXT FRONTIER AUTHORIZED =** NO

Registry `CU?` means a canonical Application use case exists. Those commands now exist, but this acceptance must not flip `CU?` or start React. A separate reconciliation review is required before registry change. React parity remains blocked until that review. `#7` remains a separate already-named action and is not this family's acceptance closure.
