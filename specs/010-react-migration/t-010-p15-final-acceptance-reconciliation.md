# SPEC-010 P15 — Final Acceptance Reconciliation

**Status:** `FORMALLY_ACCEPTED`  
**Reconciliation date:** 2026-09-18  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `dd7219a47aae62eb21d87df914203fa9391c1320`

P15 is the Firebase restore + cockpit reactivity + T508 data-readiness program. It is **not** the #1 AcceptClientInvitation parity wave.

---

## Provenance

| Role | SHA | Subject / classification |
|------|-----|--------------------------|
| Remote base | `7830cf1967f0be7f6a2ac819e78c665423270bd1` | branch tip before local P15 commits |
| T508 main-world auth wait | `a4293936fa4ee045ed8854728e44882fa48968d0` | `test(react): align T508 auth wait with main world` — test-only; later rollback assertion superseded by `efaaf3d` |
| Firebase restore | `ad6a18bd32977286eb5d78c5dcbba939fe0d1407` | `fix(auth): publish restored Firebase session before sync` — product: notify trusted identity before Firestore sync |
| T508 rollback expectation | `efaaf3d524347505364a2747778e26fbe12ea00d` | `test(react): restore authenticated T508 rollback expectation` — test-only; restored `currentUser` + AppShell logout; ReactLogin is not success |
| Option B | `8de4437deeccebd4443fa4775b32845dc38e47e0` | `fix(react): invalidate compatibility queries on dbService changes` — product: QueryProvider invalidates `['postura','compatibility']` on store change |
| T508 readiness reconciliation | `dd7219a47aae62eb21d87df914203fa9391c1320` | `test(e2e): reconcile T508 data readiness expectations` — test/harness + T508 amendment; **PRODUCT_CODE_CHANGE = 0** |
| P15 formal acceptance | this commit | governance only |

Authoritative restore behavior is `ad6a18b` (identity before sync). Authoritative cockpit reactivity is Option B (`8de4437`). Authoritative T508 rollback assertion is `efaaf3d`. Authoritative T508 timing/readiness contract is `dd7219a` plus `t-010-508-workspace-readiness-expectation-amendment.md`. `a429393` is not the rollback success contract.

---

## Mandatory P15 acceptance matrix

P1–P14 pattern: T508 FULL **10/10**, Phase-5 E2E **21/21**, `npm run check` PASS, build PASS, product defects **0**, working tree clean before the acceptance record. P15 adds the program-specific focused readiness suite. No additional P15 gate is invented here (Rules / combined P1–P14 Playwright remain frozen prior-wave evidence, not a new P15 requirement).

| Gate | Required | Result |
|------|----------|--------|
| PRODUCT DEFECTS | 0 | **0** |
| OPTION B | PASS | **PASS** (`8de4437`) |
| FIREBASE RESTORE (identity before sync) | PASS | **PASS** (`ad6a18b`) |
| INTERACTIVE LOGIN | PASS | **PASS** |
| AUTHENTICATED RELOAD | PASS | **PASS** |
| COCKPIT AUTOMATIC UPDATE | PASS | **PASS** |
| REALTIME REACTIVITY | PASS | **PASS** |
| CLIENT CROSS-TENANT ISOLATION | PASS | **PASS** (no leak; distinct claims/scopes) |
| ROLLBACK STORAGE PARITY | PASS | **PASS** |
| AUTHENTICATED RESTORE (T508) | PASS | **PASS** (`efaaf3d` + T508 10/10) |
| FOCUSED T508 READINESS | PASS | **18/18 PASS** |
| T508 FULL | 10/10 | **10/10 PASS** |
| PHASE-5 E2E | 21/21 | **21/21 PASS** |
| FULL CHECK | PASS | **PASS** · Vitest **2493/2493** |
| BUILD | PASS | **PASS** |
| AUTH REGRESSION | NO | **NO** |
| T508 reconciliation product changes | 0 | **0** |
| SEMANTIC ASSERTIONS WEAKENED | NO | **NO** |
| WORKING TREE before this record | CLEAN | **CLEAN** at `dd7219a` |

---

## T508 debt after `dd7219a`

| Item | Status |
|------|--------|
| 15-second stale Abrir wait | **RESOLVED** |
| Cross-tenant pre-readiness sampling | **RESOLVED** |
| T508 red gate | **RESOLVED** (10/10) |
| Remote Firestore timing as P15 blocking debt | **NONBLOCKING** (gate green after semantic waits; not a product SLA) |
| Test expectation governance | **RECONCILED** (`t-010-508-workspace-readiness-expectation-amendment.md`) |

T508 GOVERNANCE AMENDMENT = **VALID**

The amendment records: identity ≠ data readiness; Abrir and workspace entry remain mandatory; cross-tenant isolation remains mandatory; hydrated-empty clients are valid; waits are semantic not elapsed-time SLAs; no product SLA; product code change 0; assertions not weakened.

`REMOTE_E2E_DEPENDENCY_EXISTING_DEBT` is **not** retained as a P15 blocker. Live remote Firestore remains the current E2E backend, as it was for historically green P1–P14 T508 runs.

---

## Remaining debt

| Item | Class |
|------|--------|
| 15s Abrir-from-AppShell wait | **RESOLVED** |
| Cross-tenant AUTH_READY_ONLY sampling | **RESOLVED** |
| T508 FAIL | **RESOLVED** |
| Cockpit query non-invalidation | **RESOLVED** (Option B) |
| Restore blocked on Firestore sync | **RESOLVED** (`ad6a18b`) |
| Live remote Firestore as E2E backend | **NONBLOCKING** (existing environment; T508 10/10) |
| Emulator / deterministic-backend redesign | **NOT P15 DEBT** · not authorized for this program |
| #31 / T603 / T604 / post-P15 implementation | **NOT P15 DEBT** · **NOT_AUTHORIZED** |

**BLOCKING DEBT COUNT = 0**  
**NONBLOCKING DEBT COUNT = 1** (live remote Firestore E2E backend; not a P15 waiver)  
**RESOLVED DEBT =** Abrir 15s coupling · client-portal pre-hydration sampling · T508 red · cockpit query invalidation · restore-before-sync

Nonblocking environment debt does not reopen T508. P1–P14 accepted with the same live backend while T508 was 10/10. Formal classification is therefore `FORMALLY_ACCEPTED`, not a Phase-5-style incomplete-task waiver.

---

## Acceptance evidence parity

| Check | P1–P14 pattern | P15 |
|-------|----------------|-----|
| T508 FULL | 10/10 required | **10/10 PASS** |
| PHASE-5 E2E | 21/21 required | **21/21 PASS** |
| FULL CHECK | PASS required | **PASS** |
| BUILD | PASS required | **PASS** |
| Product defects | 0 | **0** |

**ACCEPTANCE EVIDENCE PARITY = YES**

---

## Formal acceptance

**Classification:** `P15_FORMALLY_ACCEPTED`

| Field | Value |
|-------|--------|
| P15 PRODUCT STATE | **COMPLETE** |
| REMAINING PRODUCT DEFECTS | **0** |
| OPTION B COMMIT | `8de4437deeccebd4443fa4775b32845dc38e47e0` |
| T508 RECONCILIATION COMMIT | `dd7219a47aae62eb21d87df914203fa9391c1320` |
| AUTH / SECURITY | restore publishes trusted identity before sync; no auth regression |
| CROSS-TENANT | **PASS** · leak **NO** |
| ROLLBACK | **PASS** |
| POST-P15 FRONTIER | **NOT_AUTHORIZED** |
| T603 | **NOT_AUTHORIZED** |
| T604 | **NOT_AUTHORIZED** |
| SPEC-010 CODE_COMPLETE | **NO** |
| MVP CODE_COMPLETE | **NO** |

Reconciliation source/test modifications in this commit: **0** / **0** (governance record only).

**NEXT ACTION:** `SPEC010_POST_P15_FRONTIER_AUTHORIZATION_REVIEW` (authorization review only; no implementation in this step)
