# T603 React Parity Wave — Accept Client Invitation (#1)

**Status:** `FORMALLY_ACCEPTED`  
**Acceptance date:** 2026-09-18  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `4a79f78d6bdff5581ad83fa0124c8979f5d1aeeb`  
**Registry:** `#1` — Accept invitation (Login / invite flow)  
**Application:** `AcceptClientInvitation`  
**Role:** unauthenticated invitee → activated `CLIENT`

This record accepts the **T603 React presentation wave** for registry `#1`.  
It is **not** SPEC-010 P15 Firebase restore + T508 (`t-010-p15-final-acceptance-reconciliation.md`).  
It is **not** T-010-603 legacy subset removal.  
Test/E2E artifacts remain named `reactParityWaveP15AcceptClientInvitation` from implementation commit `4279737`.

---

## Provenance

| Role | SHA |
|------|-----|
| CR-1 IMPLEMENTATION | `63e8db8543bf2a13ae29249b71748402007f959a` |
| CR-1 GOVERNANCE / FREEZE | `cf9350fb6de3a9b392b207d34e50714f49c13deb` |
| P14 (#34) FEATURE | `845d853e36bfba8ec15058fa7ef1f997ec7869d4` |
| #1 FEATURE | `4279737f4d6bf21393a43c0466840ec50595fbee` |
| Pre-acceptance HEAD (Firebase P15 accepted) | `4a79f78d6bdff5581ad83fa0124c8979f5d1aeeb` |

Feature `4279737` is an ancestor of HEAD. This commit adds governance only.

---

## Feature manifest (`4279737`)

| Kind | Files |
|------|-------|
| Production | `src/ui/modules/Login/ReactLogin.tsx`, `src/ui/hooks/useWave3Data.ts`, `src/services/auth.ts` |
| Tests / E2E | `tests/reactParityWaveP15AcceptClientInvitation.test.ts` (added), `e2e/reactParityWaveP15AcceptClientInvitation.spec.ts` (added), `tests/auth.test.ts`, `tests/reactParityWaveP14CreateClientWithInvite.test.ts` |
| Governance | **0** (in feature commit) |

`auth.ts` `registerFromInvite` activates a CR-1 pending `INVITED` account created by `#34` when email/clientId/organizationId match; otherwise rejects an existing ACTIVE account. That is identity-port activation, not a second AcceptClientInvitation.

**Unauthorized modifications in feature:** Domain **0** · Application `AcceptClientInvitation.ts` **0** · `#34` command **0** · routing **0** · rollback switch **0** · legacy Login form **0**.

---

## Accepted authority (unchanged)

| Field | Value |
|-------|-------|
| COMMAND | `AcceptClientInvitation` |
| CONSUMER | `clientLifecycleConsumer.acceptClientInvitation` |
| SEAM | `clientLifecycleCommands.acceptInvitation` |
| HOOK | `useAcceptClientInvitation` |
| SURFACE | `ReactLogin` native `?invite=` form |
| Public input | `token`, `password`, `displayName` only |
| Caller tenant / role / clientId / organizationId | **0** |
| CU? | **YES** |
| OWNER | CR-1 Client Lifecycle Application |
| Blocking phase | 3 (registry) / presentation wave post-P14 |
| React dbService | **0** |
| Direct Firestore business write from React | **0** |

Canonical loads invitation by token; validates PENDING, expiry, org/client match; activates identity via SPEC-009 port; marks invitation ACCEPTED; sets client `ACTIVE` / `onboardingStatus: IN_PROGRESS`.

---

## Registry reconciliation

| Field | Value |
|-------|-------|
| CURRENT DISPOSITION | `KEEP_LEGACY` (legacy UI invokes canonical consumer) |
| POST-ACCEPTANCE DISPOSITION | `KEEP_LEGACY` |
| Registry file modified | **NO** |

`KEEP_LEGACY` means the legacy presentation remains for rollback/parity, **not** that React is incomplete. Formal React parity does **not** mean `REMOVE_LEGACY` or T-010-603 deletion.

Historical P14 records still say `#1` / CLIENT ACCEPT INVITE = LEGACY. Those files are not rewritten.

---

## Presentation seam

| Layer | Artifact |
|-------|----------|
| Canonical | `createAcceptClientInvitation` → `useCases.acceptClientInvitation` |
| Consumer | `acceptClientInvitation({ token, password, displayName })` |
| React | `ReactLogin` → `useAcceptClientInvitation` → `clientLifecycleCommands.acceptInvitation` |
| Legacy | `src/components/Login.ts` `#form-accept-invite` → `loginHandlers.ts` → same consumer |
| Identity port | `createAuthIdentityActivationPort` → `authService.registerFromInvite` |
| Persistence | `InvitationPort.markAccepted` + `ClientShellPort.update` (dbService adapters) |

PRESENTATION ONLY DIFFERENCE = **YES** (same business authority).

Allowed presentation differences: React reads token from `?invite=` (display-only) vs legacy editable token field; React confirm-password field; React min-length 8 client-side schema. Token validation remains canonical only.

---

## Security / tenant invariants

| Invariant | Result |
|-----------|--------|
| TOKEN VALIDATION | **PASS** |
| ORG ASSIGNMENT | **PASS** (from stored invitation, not caller) |
| CLIENT ASSIGNMENT | **PASS** (from stored invitation, not caller) |
| ROLE ASSIGNMENT | **PASS** (`CLIENT` from pending account / new invitee account; caller cannot supply role) |
| INVALID TOKEN | **PASS** (`INVITATION_NOT_FOUND`; E2E no session) |
| EXPIRED TOKEN | **PASS** (canonical `INVITATION_EXPIRED`) |
| REPLAY / ALREADY ACCEPTED | **PASS** (canonical `INVITATION_NOT_PENDING`) |
| CROSS-TENANT PROTECTION | **PASS** (`CLIENT_TENANT_MISMATCH` / fail-closed org+client on invitation) |

SAME BUSINESS AUTHORITY = **YES**  
DUPLICATE WRITE PATH = **NO**  
CANONICAL CONSUMER REUSED = **YES**  
BUSINESS LOGIC DUPLICATED IN REACT = **NO**  
AUTHORITY EXPANDED = **NO**  
LEGACY REMOVED = **NO**

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY PRESENTATION RETAINED | **YES** (`Login.ts` + `loginHandlers.ts`) |
| ROLLBACK SWITCH | **YES** (`applyUiMode('legacy')` on email and invite cards) |
| CANONICAL STORAGE MODE-INDEPENDENT | **YES** |
| DATA MIGRATION REQUIRED | **NO** |
| T-010-603 DELETION AUTHORIZED | **NO** |
| LEGACY UI REMOVAL AUTHORIZED | **NO** |

---

## Mandatory gate matrix (this review)

| Gate | Result |
|------|--------|
| #1 FOCUSED | `tests/reactParityWaveP15AcceptClientInvitation.test.ts` **14/14 PASS** |
| #1 CR-1 Application | `tests/cr1ClientLifecycle.test.ts` **18/18 PASS** (AcceptClientInvitation **5/5**) |
| AUTH / registerFromInvite | `tests/auth.test.ts` **3/3 PASS** |
| P14 non-regression | `tests/reactParityWaveP14CreateClientWithInvite.test.ts` **16/16 PASS** |
| #1 E2E | `e2e/reactParityWaveP15AcceptClientInvitation.spec.ts` **3/3 PASS** (success → onboarding; invalid token no session; email login preserved) |
| T508 | **NOT_REQUIRED** for this invite journey (no T508 invite scenarios; Firebase P15 already **10/10** at HEAD) |
| FULL CHECK | **PASS** · Vitest **2493/2493** · lint **0 errors** |
| BUILD | **PASS** |
| PRODUCT DEFECTS | **0** |

---

## Debt

| Item | Class |
|------|--------|
| React `#1` presentation without formal record | **RESOLVED** (this file) |
| Canonical `#1` consumer | **RESOLVED** (CR-1 frozen) |
| Legacy Login invite form retained | **FUTURE_T603** (required until T-010-603) |
| Registry `KEEP_LEGACY` | **FUTURE_T603** (not a defect) |
| Test/E2E files named Wave P15 vs Firebase P15 | **NONBLOCKING** (naming collision; this record disambiguates) |
| Historical P14 files still list `#1` LEGACY | **NONBLOCKING** (historical; not rewritten) |
| Unused `code` helper lint warning in focused `#1` tests | **NONBLOCKING** (0 errors; tests not modified) |
| Live remote Firestore E2E backend | **NONBLOCKING** (existing P15 debt; does not block `#1`) |

BLOCKING COUNT = **0**  
NONBLOCKING COUNT = **4**  
FUTURE T603 ITEMS = legacy invite presentation + registry `KEEP_LEGACY` until authorized subset removal

---

## Handoff / frontier

| Item | Value |
|------|--------|
| #1 REACT PRESENTATION | **COMPLETE** |
| CLIENT ACCEPT INVITE | **NATIVE_REACT** (legacy retained) |
| Registry disposition | **KEEP_LEGACY** |
| SAFE LEGACY MODULES | **0** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| #31 SaveContentDraft | **READY_FOR_REVIEW** — not authorized to implement |
| SPEC-010 CODE_COMPLETE | **NO** |

**NEXT ACTION:** `T603_REACT_PARITY_POST_1_FRONTIER_REVIEW`  
**NEXT NODE AUTHORIZED:** **NO**
