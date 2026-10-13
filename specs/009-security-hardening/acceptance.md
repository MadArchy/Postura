# Acceptance 009 — Security Hardening

Spec **DONE** solo con Required PASS + deploy aplicable.  
**Manual review ≠ Storage DONE.**  
**`CODE_COMPLETE` ≠ `DEPLOYED` ≠ `DONE`.**

Estados Spec: ver `spec.md` (DRAFT → … → DONE / PARTIAL / BLOCKED).

**Governance:** Spec status **`APPROVED`**. Implementation **`CODE_COMPLETE`** (T-009-15). Phases 0–4.1 **PASS**. F-009-A/B **RESOLVED**. **Repo rules ≠ production deployed rules** until T-009-16 backfill + T-009-18 deploy.

---

## Required (CODE_COMPLETE → toward DONE)

| # | Criterion | Maps to | Status |
|---|-----------|---------|--------|
| A1 | Helpers Firestore exigen `organizationId` match; ADMIN org-scoped only (no global) | SEC-009-002, SEC-009-003 | ✅ Phase 1 (rules tests) |
| A2 | ADMIN otra org: get/list/write deny | SEC-009-003 | ✅ Phase 1 (rules tests) |
| A3 | CLIENT otro clientId: deny | SEC-009-004 | ✅ Phase 1 (rules tests) |
| A4 | CLIENT no crea signals/aiRuns/sources (manager-only); theses CREATE/DELETE deny | SEC-009-006 | ✅ Phase 2 (rules tests; thesis CREATE still ADMIN) |
| A5 | CLIENT update fuera de allowlist fail | SEC-009-005 | ✅ Phase 2 |
| A6 | Deliveries CLIENT solo `SENT → ACKNOWLEDGED` (+ keys) | SEC-009-007, SEC-009-016 | ✅ Phase 2 |
| A7 | Storage path exige org + ownsClient; matriz por asset aplicada | SEC-009-008 | ✅ Phase 3 |
| A8 | **Automated** Storage rules tests PASS (si Storage en scope DONE) | SEC-009-009, SEC-009-013 | ✅ Phase 3 (emulator) |
| A9 | Provision **and** `setPosturaClaims` validate `organizationId` (no default tenant); + `clientId` for CLIENT | SEC-009-011 | ✅ Phase 4 |
| A10 | SA fuera del repo tree; scanning ejecutado; rotation si exposición válida | SEC-009-012 | ✅ Phase 4.1 (external SA + in-repo copy removed; prep PASS; `secret:scan` rotation=NO) |
| A11 | `npm run test:rules` PASS (Firestore; + Storage si no PARTIAL storage) | SEC-009-013 | **Firestore 73 + Storage 18 = 91 PASS** · **Overall A11 = PASS** (incl. T-009-14e envelope + ADMIN CREATE integrity) |
| A12 | `npm run check` PASS → **`CODE_COMPLETE`** elegible | governance | ✅ **PASS** (T-009-15; **286/286** check + **91/91** test:rules) |
| A13 | Firestore rules **`DEPLOYED`** en proyecto objetivo | governance | ☐ |
| A14 | Call sites piloto no rotos (writes/queries allowlisted) | SEC-009-014/015 | ☐ |
| A14q | **same-org query/list allow** + **cross-org query/list deny**; `listFirestoreClientIds` uses tenant `where` (or equiv.) — **Rules are not filters** | SEC-009-014 | ✅ Phase 1 (rules + Q1 unit tests) |
| A15 | Verbos: create wrong `organizationId` deny; update `organizationId` deny; update `clientId` deny; delete cross-org deny | SEC-009-015 | ✅ Phase 1 (rules tests incl. DELETE) |
| A16 | **unauthenticated deny** | SEC-009-001 | ✅ Phase 1 (rules tests) |
| A17 | **invalid state transition deny** (CLIENT) en colecciones con status en scope | SEC-009-016 | ✅ Phase 2 |
| A17t | **forged workflow timestamp deny** cuando la regla aplique | SEC-009-017 | ✅ Phase 2 |
| A18 | Notifications: CLIENT CREATE **only** manager-alert flow with exact create allowlist; arbitrary CREATE deny; UPDATE only `read` | SEC-009-018 | ✅ Phase 2 |
| A19 | signalOutcomes: CLIENT write deny (and read deny per freeze) | SEC-009-019 | ✅ Phase 2 |
| A20 | Spec docs/metadata aligned; Phase 0 complete | governance | ✅ PASS (T-009-15 governance freeze) |
| A21 | CLIENT modifies one allowed task/content/opportunity and the Firestore write batch **does not** include unauthorized manager-only resources | SEC-009-020, T-009-06p | ✅ Phase 2 |
| A22 | No production UI write path uses a hardcoded tenant `organizationId` | T-009-06 | ✅ Phase 2 |
| A23 | CLIENT may only execute documented Thesis approval/revision workflow; DENY modify of strategic fields | SEC-009-006 | ✅ Phase 2 |
| A24 | Admin SDK writers persist valid envelope; must not rely on Rules for isolation | T-009-10b | ✅ Phase 4 |

### Phase 1+2 evidence map (automated only)

| ID | Test name(s) | Source |
|----|--------------|--------|
| A1 | `ADMIN same-org read ALLOW`; `ADMIN cross-org read DENY` | `tests/firestore.rules.test.ts` |
| A2 | `ADMIN cross-org read DENY`; `ADMIN cross-org write DENY`; `DELETE cross-org DENY`; `Q1 cross-org clients query DENY` | `tests/firestore.rules.test.ts` |
| A3 | `CLIENT other client read DENY` | `tests/firestore.rules.test.ts` |
| A4 | `impide al cliente crear señales (solo manager)`; `permite al cliente leer aiRuns propios pero no escribirlos` | `tests/firestore.rules.test.ts` |
| A5 | `CLIENT field outside allowlist DENY`; `Profile CLIENT allowlisted nested update ALLOW`; `Profile CLIENT organizationId mutation DENY`; `Profile CLIENT outside allowlist field DENY` | `tests/firestore.rules.test.ts` |
| A6 | `permite ACK de entrega por el cliente`; `Delivery invalid transition DENY` | `tests/firestore.rules.test.ts` |
| A14q | `Q1 same-org clients query/list ALLOW`; `Q1 unscoped clients list DENY (Rules are not filters)`; `Q1 cross-org clients query DENY`; `resolveTenantOrganizationIdForQuery rejects mismatched requested org` | `tests/firestore.rules.test.ts`; `tests/listFirestoreClientIds.q1.test.ts` |
| A15 | `CREATE client with wrong organizationId DENY`; `UPDATE organizationId DENY`; `UPDATE clientId on task DENY`; `DELETE cross-org DENY` | `tests/firestore.rules.test.ts` |
| A16 | `unauthenticated read DENY` | `tests/firestore.rules.test.ts` |
| A17 | `Delivery invalid transition DENY`; `Task invalid transition DENY`; `Content manager-only transition DENY`; `Opportunity illegal transition DENY` | `tests/firestore.rules.test.ts` |
| A17t | `Forged workflow timestamp DENY`; `Forged stateHistory.at DENY on valid content transition`; `Content transition without stateHistory mutation ALLOW`; `Forged completedAt DENY`; `Forged clientApprovedAt DENY`; `Forged submittedAt DENY` | `tests/firestore.rules.test.ts` |
| A18 | `Notification mark read ALLOW`; `Arbitrary notification create DENY`; `Approved manager-alert notification create ALLOW` | `tests/firestore.rules.test.ts` |
| A19 | `signalOutcomes CLIENT read DENY`; `signalOutcomes CLIENT write DENY` | `tests/firestore.rules.test.ts` |
| A21 | `Actor-aware CLIENT persistence excludes manager-only resources` | `tests/actorAwarePersistence.q2.test.ts` |
| A22 | `production UI write paths do not hardcode org_aurora_01`; `full src/ scan: no write-path module depends on hardcoded org_aurora_01` | `tests/actorAwarePersistence.q2.test.ts` |
| A23 | `Thesis approval workflow ALLOW`; `Thesis pendingRevision apply ALLOW`; `Thesis pendingRevision proposes X but CLIENT writes Y DENY`; `Thesis strategic-field modification DENY`; `Thesis strategic field during invalid approval transition DENY`; `Thesis organizationId mutation DENY`; `Thesis clientId mutation DENY` | `tests/firestore.rules.test.ts` |

### Phase 4 evidence map

| ID | Test name(s) / evidence | Source |
|----|-------------------------|--------|
| A9 | `ADMIN valid claims PASS`; `CLIENT valid claims PASS`; `missing organizationId DENY/throw`; `CLIENT missing clientId DENY/throw`; `invalid role DENY/throw`; `ADMIN/CLIENT cannot silently inherit demo tenant` | `tests/posturaClaimsCore.test.ts`; `tests/firebaseClaims.test.ts` |
| A10 | prep-check PASS with external SA; in-repo SA absent; `npm run secret:scan` sanitized report | `scripts/firebase-prep-check.mjs`; `scripts/secret-scan.mjs`; `secret-exposure-review.md`; `docs/ops/firebase.md` |
| A24 | `requires explicit organizationId`; `does not fall back to org_aurora_01`; writer matrix in inventory §H.2 | `tests/adminTenantEnvelope.test.ts`; `functions/src/lib/scheduledIngest.ts` |

### Pre–CODE_COMPLETE follow-ups evidence

| ID | Evidence | Source |
|----|----------|--------|
| F-009-A | MODEL B freeze; strip policy; content transition without stateHistory ALLOW; forged stateHistory DENY | `src/domain/contentHistoryPolicy.ts`; `tests/contentHistoryPolicy.test.ts`; `tests/firestore.rules.test.ts` |
| F-009-B | single-diff thesis strategic helpers; multi-field pendingRevision ALLOW/DENY; A23 suite retained | `firestore.rules`; `tests/firestore.rules.test.ts` (`Thesis F-009-B …`) |

### T-009-14e final envelope evidence

| ID | Test name(s) | Source |
|----|--------------|--------|
| Envelope | `T-009-14e denormalized envelope` block | `tests/firestore.rules.test.ts` |
| ADMIN CREATE integrity | `T-009-14e ADMIN CREATE referential integrity` (A–I): alien-path forged-org DENY; same-org ALLOW; CLIENT paths | `tests/firestore.rules.test.ts` |
| Parent get classification | Normal tenant auth: **0** `get(`; ADMIN CREATE integrity: **1** (`parentClientDoc` → `clients/{clientId}`) | `firestore.rules` |

### Final authorization model (T-009-14e)

| Operation | Model |
|-----------|--------|
| READ / UPDATE / DELETE (existing resources) | Denormalized immutable envelope on `resource.data` — **no parent get** |
| CLIENT CREATE (subcollections) | `token.organizationId` + `token.clientId` + path + `request.resource` envelope — **no parent get** |
| ADMIN CREATE (subcollections) | Request envelope + **`get(clients/{clientId}).organizationId == tokenOrg()`** (referential integrity only) |
| Root `clients/{clientId}` CREATE | `organizationId` on request; no duplicated `clientId`; **no parent get** |

Zero-lookups cannot prove path `clientId` ∈ token org at ADMIN CREATE time with the current Firestore path model; the parent lookup is an **explicit architectural exception**, not primary tenant authorization.

### get(parent) — REMOVED for normal tenant auth (T-009-14e)

Phase 1–4 used `get(/clients/{clientId})` inside `sameOrgAsClient` / `ownsClient`. **Removed.** Tenant authorization is denormalized: `resource.data.organizationId` (+ `clientId` on subcollections). Root `clients/{clientId}` uses path id for CLIENT ownership; no duplicated `clientId` field required.

**Repo state:** final envelope rules in git. **Production:** still on prior deployed rules until T-009-16 backfill + T-009-18 deploy.

### CODE_COMPLETE checkpoint (T-009-15)

| Field | Value |
|-------|--------|
| Branch | `spec/009-security-hardening` |
| **FROZEN COMMIT SHA** | `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` |
| Date | 2026-08-23 |
| `test:rules` | **91/91 PASS** |
| `npm run check` | **286/286 PASS** |
| Prior HEAD (pre-checkpoint) | `e47f552` |

**Freeze rule:** No normal SPEC-009 implementation changes after this SHA without classified blocker fix + full security suite rerun.

**CODE_COMPLETE ≠ DEPLOYED.** Production may still use prior deployed rules until T-009-16 backfill + T-009-18.

| Gate | Result |
|------|--------|
| SEC-009-001..020 | **PASS** (automated evidence where required) |
| Acceptance A1–A11, A14q, A15–A24 | **PASS** |
| A12 CODE_COMPLETE | ✅ **PASS** (T-009-15 declared) |
| A13 DEPLOYED | **NOT declared** |
| A14 pilot call sites | **PENDING** (post-deploy smoke; non-blocking for code) |
| A20 docs | **PASS** (spec/plan/inventory/migration aligned) |
| `test:rules` | **91/91 PASS** |
| `check` | **286/286 PASS** |
| `secret:scan` | **rotation_required_overall=NO** |
| CODE_COMPLETE readiness | **CODE_COMPLETE** (frozen at `9c351ef`) |

### Security re-freeze / reacceptance (A31, 2026-10-12)

The CODE_COMPLETE checkpoint above was valid when approved (2026-08-23 09:43 -0500, `9c351ef`, 91/91 rules, not deployed). It became **stale** relative to the repository because security-relevant rules and privileged-backend changes landed after it. Under the freeze rule above (*classified blocker fix + full security suite rerun*), they are classified here and the boundary is formally reaccepted.

| Field | Value |
|-------|--------|
| Human decision | **`A31_RULE_CONTRACT_DECISION = OPTION_B`** — explicit classification + full gate rerun + new freeze reference. Reacceptance, **not** a waiver |
| Old frozen SHA | `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` → **SUPERSEDED_BY_FORMAL_REFREEZE** (historical evidence above retained) |
| Security implementation SHA | `6e4c739a390a54a9fd2ae2a807d56a9d971f11fb` (branch `spec/010-react-migration`) |
| Current frozen repository reference | The governance commit that introduces this addendum (`docs(spec009): re-freeze security boundary for A31`), child of `6e4c739` |
| Classification timing | **Post-hoc formal classification during the A31 re-freeze**; `4bda325` and `15590e2` were not classified under SPEC-009 when they landed |
| Status | **REFROZEN / REACCEPTED** · CODE_COMPLETE ≠ DEPLOYED · deployment **NOT EXECUTED** |

| Commit | Subject | Classification | Security effect |
|--------|---------|----------------|-----------------|
| `4bda325` | `fix(firestore): preserve createdAt on updates` | **HARDENING_COMPATIBLE** | `preservesEnvelope()` makes `createdAt` write-once on every UPDATE (no change/add/remove); CLIENT notification mark-read can no longer re-stamp `createdAt`. Existing rule contract changed in the **more restrictive** direction only; no tenant, org or role authority change; no family weakened. +7 rules tests |
| `15590e2` | `feat(briefs): persist Strategic Briefs, history and overrides to Firestore` | **SAFE_NEW_DOMAIN_SECURITY_EXTENSION** | `clients/{id}/strategicBriefs`, `strategicBriefHistory`, `strategicBriefOverrides` (previously default-deny; no wildcard match). ADMIN-only via `existingSubEnvelopeValid` / `adminCreateSub` / `adminWriteSub`; CLIENT DENY; cross-org DENY; Brief version never decreases; history/overrides identical-rewrite only; delete DENY. Pre-existing families unchanged. +8 rules tests |
| `6aebe21` | `fix(ai): bind admin client to trusted organization` | **SPEC009_BLOCKER_FIX** | ADMIN body `clientId` could reach Admin SDK `clients/{clientId}/aiRuns` persistence without proving the client belongs to the token organization. Now verified server-side before gateway/provider/persistence |
| `cd20acd` | `fix(ai): require client organization binding for aiComplete` | **SPEC009_BLOCKER_FIX** | Ownership lookup mandatory at `handleAiCompleteRequest`; missing/unusable lookup fails closed; Vite dev route `/api/ai/gateway-complete` uses the same verifier |
| `6e4c739` | `fix(auth): bind claim assignment to trusted organization` | **SPEC009_BLOCKER_FIX** | `setPosturaClaims` accepted arbitrary body organization/client from any ADMIN. Now caller token organization is authoritative; existing other-org target DENY; CLIENT `clients/{clientId}.organizationId` verified server-side; lookup failure fails closed; invalid paths call `setCustomUserClaims` 0 times |

**Reaccepted security model:**

- Security principles: **PRESERVED_AND_HARDENED** — invariants preserved/strengthened; implementation **evolved under classified changes** (not "unchanged implementation").
- `PLATFORM_ADMIN` **ABSENT**; ADMIN is organization-scoped; cross-organization administrative authority **DENY**.
- Tenant authority = verified auth token / trusted server context — never request-body `organizationId`. Client relationships are proven by claims or a server-side canonical ownership lookup (`clients/{clientId}.organizationId`).
- Firestore Rules: organization isolation, client isolation, envelope validation, ADMIN/CLIENT separation, controlled immutable fields (`createdAt` write-once) and Strategic Brief family coverage. No weakening found in post-freeze rule changes.
- Privileged backend contract: Admin SDK / Admin Auth **bypass** Rules; every privileged path must enforce equivalent server authorization. Covered by blocker fixes: `aiComplete` (incl. dev route) and `setPosturaClaims`. Rules do **not** protect these paths.
- `aiComplete`: ADMIN `clientId` = untrusted candidate · ownership lookup mandatory · cross-org / nonexistent DENY · missing lookup fail-closed · invalid gateway calls 0 · invalid persistence calls 0. (Secret Manager / provider ownership stays with `005`.)
- `setPosturaClaims`: body organization authority NONE · existing other-org target DENY · CLIENT ownership server-verified · lookup failure fail-closed · invalid `setCustomUserClaims` calls 0. **Distinct from** production claims audit/reprovision (T-009-17), which remains **NOT EXECUTED**.

**Fresh validation at `6e4c739` (re-freeze):**

| Gate | Result |
|------|--------|
| `test:rules` | **106/106 PASS** (old freeze 91/91; +7 `4bda325` hardening, +8 `15590e2` new-family coverage; 0 original rules tests removed) |
| Security suite (SPEC-009 / tenant / AI binding / claims) | **40 files · 880/880 PASS** |
| Functions typecheck | **PASS** |
| `npm run check` | **241 files · 3278/3278 PASS** · 0 lint errors |
| `npm run build` | **PASS** · production `window.__posturaUi` = 0 |
| Full emulator E2E | **91/91 PASS** · production Firebase requests 0 |
| `secret:scan` | **rotation_required_overall=NO** |

**Freeze rule (unchanged, now anchored to the re-freeze reference):** no normal SPEC-009 implementation change after the current frozen repository reference without classified blocker fix (or explicitly governed compatible security change) + full security suite rerun + updated freeze reference.

This re-freeze authorizes governance only — **not** CUTOVER-E, rules/Functions/Hosting deploy, T-009-16..19, SPEC-010 T604 or A44. Production still serves the pilot-era rules.

## Deploy gates (separados)

| # | Criterion | Status |
|---|-----------|--------|
| D1 | `CODE_COMPLETE` declarado (A11–A12 + **T-009-14e** + Required code items) | ✅ T-009-15 |
| D2 | Migration dry-run + backfill + verification (`migration.md` / **T-009-16** — data only) | ☐ |
| D3 | Claims reprovision + users re-login / token refresh | ☐ |
| D4 | Firestore rules deployed (A13) — artifacts from T-009-14e | ☐ |
| D5 | Post-deploy verification | ☐ |
| D6 | Spec `DEPLOYED` / `DONE` / `PARTIAL` explícito | ☐ |

## Ops-gated / PARTIAL

| # | Criterion | Notes | Status |
|---|-----------|-------|--------|
| O1 | Storage rules deployed | Console / deploy gate — **not** Phase 3 | ☐ PENDING (no prod deploy) |
| O2 | Storage automated tests PASS | Emulator suite | ✅ Phase 3 |
| O3 | SA rotation | Solo si exposición de credencial válida | ☐ / N/A |

## Explicit non-acceptance

- AI Secret Manager / `aiComplete` → `005`
- `PLATFORM_ADMIN` / ADMIN global
- App Check, OTel, React migration
- Learning Engine redesign

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Spec author (docs) | | 2026-08-22 | Phase 0 + final correction complete |
| Human approver | | 2026-08-22 | Spec **`APPROVED`**; Phase 0 authorized/completed |
| Implementer | | | *(pending T-009-01 authorization)* |
| Reviewer | | | |

**Result options (implementation):** `PASS` · `PARTIAL` · `FAIL` · `BLOCKED`  
**Current:** Spec APPROVED · **Implementation CODE_COMPLETE** (T-009-15) · **Security REFROZEN / REACCEPTED** (A31 re-freeze, Option B; implementation `6e4c739`) · A13 DEPLOY / A14 smoke / O1 deploy **PENDING** · T-009-16 **NOT STARTED**.

### PARTIAL allowed when

- Firestore Required PASS + DEPLOYED, y Storage O1/O2 BLOCKED por Console/emulator.
- Nota obligatoria en `docs/ops/firebase.md`: Storage rules/tests pending; Spec status `PARTIAL`.

---

## Quick verification commands

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm run test:rules
npm run check
# post-implementation authorization only:
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## Traceability matrix (acceptance ↔ requirements)

| Acceptance | Requirements / Tasks |
|------------|----------------------|
| A16 | SEC-009-001 |
| A1–A3 | SEC-009-002, SEC-009-003, SEC-009-004 |
| A5 | SEC-009-005 |
| A4, A23 | SEC-009-006 |
| A6 | SEC-009-007, SEC-009-016 |
| A7–A8, O1–O2 | SEC-009-008, SEC-009-009 |
| A1 (auditLogs) | SEC-009-010 |
| A9 | SEC-009-011 · T-009-10 |
| A10 | SEC-009-012 |
| A11 | SEC-009-013 |
| A14q | SEC-009-014 · T-009-03q · T-009-06 (Q1) |
| A15 | SEC-009-015 |
| A17 | SEC-009-016 |
| A17t | SEC-009-017 |
| A18 | SEC-009-018 · T-009-04 (allowlist freeze) · T-009-05n |
| A19 | SEC-009-019 |
| A21 | SEC-009-020 · T-009-06p |
| A22 | T-009-06 |
| A23 | SEC-009-006 · T-009-04..06b |
| A24 | T-009-10b |
| A12–A13, D1–D6 | governance CODE_COMPLETE / DEPLOYED / DONE |
