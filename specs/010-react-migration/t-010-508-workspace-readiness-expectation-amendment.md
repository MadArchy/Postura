# T-010-508 — Workspace Readiness Expectation Governance Amendment

**Human decision:** `AUTHORIZE_T508_TEST_EXPECTATION_RECONCILIATION` then `AUTHORIZE_T508_CLIENT_PORTAL_READINESS_RECONCILIATION`  
**Classification:** `NARROW_T508_TEST_EXPECTATION_RECONCILIATION` + `NARROW_T508_CLIENT_PORTAL_READINESS_RECONCILIATION`  
**Starting checkpoint:** `8de4437deeccebd4443fa4775b32845dc38e47e0`  
**PRODUCT_CODE_CHANGE = 0**

Supporting precedent only: B6 (`t-010-508-rollback-stable-storage-amendment.md`) and P2 (`STALE_PRE_STAGE_B_TEST_EXPECTATION`).

---

## Frozen semantic invariant (unchanged)

T508 must still prove:

authenticated manager → cockpit → client becomes available → **`Abrir workspace`** → workspace entry.

Also unchanged: authenticated restore, React ↔ legacy parity, rollback/storage parity, cross-tenant isolation.

`Abrir workspace` remains mandatory. Workspace-entry semantics are not weakened.

Cross-tenant isolation remains mandatory:

each authenticated CLIENT resolves only its authorized `organizationId` + `clientId` + business state and must not observe another client's data.

---

## What was stale

### 1. Manager cockpit / Abrir

The helper `enterClientWorkspaceFromShell` required `Abrir workspace` to become visible within a fixed **`15_000 ms`** starting from the early AppShell / data-not-ready cockpit.

That wait is **not** a product acceptance SLA. Trusted identity may publish before business-data readiness. Business-data readiness may follow authentication asynchronously.

### 2. Client portal distinctness

`two client sessions see distinct portal scopes` sampled `react-client-portal` `innerText` immediately after identity publication (`AUTH_READY_ONLY`).

Juan and Elena both render the same generic empty portal before their own client projections hydrate. Identical pre-hydration empty presentation does **not** prove identical tenant/client scope.

Portal-copy inequality is only a proxy for isolation and is valid only after each session has reached its own client-data readiness point.

Elena's legitimate post-hydration business state is empty. Readiness therefore must **not** require task/opportunity/briefing counts, non-empty UI, or portal text that differs from the generic empty copy.

Early trusted identity publication remains valid and must remain unchanged. Auth publication must not wait for data readiness.

---

## Representation rule (amended)

1. Identity readiness and client-business-data readiness are separate.

2. T508 manager workspace entry waits on the semantic condition: the authenticated cockpit exposes **`Abrir workspace`**.

3. Firebase claims establish CLIENT authority (`role`, `organizationId`, `clientId`) early.

4. T508 client-portal isolation waits until the authenticated client's **own client record** is present in its tenant-scoped projection (hydrated, including legitimately empty).

5. Portal business-state comparison occurs after that semantic readiness. Identical pre-hydration empty UI is not isolation evidence.

6. Cross-tenant assertions still require:

   - Juan bound to `client_juan_001`
   - Elena bound to `client_elena_002`
   - neither session displaying the other's known business data
   - portal-copy inequality retained as supporting evidence

It does **not** define product correctness as “data arrives within N seconds of AppShell.”

A finite Playwright **test-run safety ceiling** remains required so a hung test fails. That ceiling is the existing T508 mid-journey rollback test timeout (`90_000` in `e2e/t010508-phase5-parity.spec.ts`), reused as harness safety only.

**PRODUCT DATA-READINESS SLA = NONE**

---

## This amendment does NOT authorize

- product / React / auth / QueryProvider / Firebase / Firestore / domain / application / client-portal product changes
- fixture manipulation or changing Juan/Elena demo business data to force different strings
- weaker tenant assertions, deleting distinctness/isolation, or proving isolation from Firebase UIDs alone
- restoring auth/data coupling
- arbitrary sleeps or timeout inflation (including replacing 15s with observed hydration latency)
- global Playwright timeout increase
- `test.skip` / `test.fixme` / retry inflation
- remote-data mutation or production Firestore seeding
- emulator migration / deterministic-backend redesign
- #31 / T603 / T604 / post-P15 work

---

## Implementation surface (test/harness + this amendment only)

| File | Role |
|------|------|
| `e2e/helpers/spec010Auth.ts` | Condition-driven `waitForCockpitAbrirWorkspace`; `waitForAuthenticatedClientProjection`; readiness policy |
| `e2e/t010403-stage-b-seam.spec.ts` | Same stale 15s duplicate Abrir wait replaced by the shared waiter (Phase-5 21/21) |
| `e2e/t010508-phase5-parity.spec.ts` | Cross-tenant samples after each client's semantic projection readiness |
| `tests/t508WorkspaceReadinessExpectation.test.ts` | Focused PASS/FAIL invariants (Abrir A–F, client projection A–I) |

**Production files modified by this amendment:** **0**
