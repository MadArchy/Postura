# Tasks 009 — Security Hardening

Status legend: `TODO` · `DOING` · `DONE` · `BLOCKED`  
Spec gate: **`APPROVED`**. **Implementation `CODE_COMPLETE`** (T-009-15). Phases 0–4.1 **PASS**. **T-009-14e/14 DONE**. **Do not start T-009-16** without authorization.

Requirement IDs: `SEC-009-001` … `SEC-009-020`.  
Inventory: `specs/009-security-hardening/inventory.md`.  
Branch: `spec/009-security-hardening`.

**Frozen (Phase 0 final correction):** Q1 query strategy · actor-aware persistence (SEC-009-020).

---

## Phase 0 — Inventory (ampliado)

- [x] **T-009-00** `DONE` — Inventario completo en `inventory.md` (§A–E, G–H). Firestore ops centralizadas en `sync.ts`; Storage en `storageMedia.ts`; **Q1 hard-incompatible** (Rules are not filters).
- [x] **T-009-00b** `DONE` — Envelope presence matrix in `inventory.md` §F (type + seed; live prod counts pending dry-run).
- [x] **T-009-00c** `DONE` — Envelope freeze in `plan.md` + `inventory.md` §F/K (denormalized; no primary parent get).

## Phase 1 — Firestore helpers + org + verbs + query isolation

- [x] **T-009-01** `DONE` — Helpers: `signedIn`, `tokenOrg`, `isAdmin`, `isClient`, `adminOfOrg`, `envelopeMatches`, `createEnvelopeValid`, `preservesEnvelope`, `ownsClient`/`sameOrgAsClient` (no PLATFORM_ADMIN).
- [x] **T-009-02** `DONE` — Verbos CREATE/READ/LIST/UPDATE/DELETE + org-scoped ADMIN en todos los `match`; `auditLogs` solo ADMIN misma org.
- [x] **T-009-03** `DONE` — Emulator tests: unauth deny; ADMIN same/cross-org; CLIENT own/other/cross-org; envelope create/update/delete denies (**21** tests).
- [x] **T-009-03q** `DONE` — `listFirestoreClientIds` → auth-org `where`; arg must match auth org; unscoped list DENY tests.

**Phase 1 note (historical):** `sameOrgAsClient` used **TEMPORARY** `get(parent)` through Phases 2–4. **Removed at T-009-14e** — denormalized envelope is final in repo. **T-009-16** = prod backfill only; **T-009-18** = deploy.

## Phase 2 — Field-level, state transitions, timestamps, notifications, outcomes

- [x] **T-009-04** `DONE` — Allowlists + matrices frozen; **notification CREATE schema frozen** in `inventory.md` §C.7.
- [x] **T-009-05** `DONE` — CLIENT UPDATE: allowlist + state transition + `preservesEnvelope`.
- [x] **T-009-05t** `DONE` — Trusted timestamps via `serverTimestamp`/`request.time`; forged deny tests.
- [x] **T-009-05n** `DONE` — Notifications: CLIENT read; UPDATE `read` only; CREATE manager-alert allowlist only; DELETE deny.
- [x] **T-009-05o** `DONE` — signalOutcomes: CLIENT deny read+write; ADMIN same-org only.
- [x] **T-009-06** `DONE` — Callers: remove hardcoded `org_aurora_01` UI writes; notification `organizationId` from client context (A22).
- [x] **T-009-06p** `DONE` — Actor-aware CLIENT `importSnapshotToFirestore` (SEC-009-020 / A21).
- [x] **T-009-06b** `DONE` — Emulator + unit tests for field/state/timestamp/notification/outcomes/persistence.

## Phase 3 — Storage

- [x] **T-009-07** `DONE` — Storage matrix frozen (numeric size); `storage.rules`; upload contentType + delete-then-create; product max duration 10m.
- [x] **T-009-08** `DONE` — `tests/storage.rules.test.ts`; `npm run test:rules` runs Firestore + Storage emulators.
- [x] **T-009-09** `N/A` — Storage emulator available; not BLOCKED.

### Pre–CODE_COMPLETE follow-ups (mandatory — do not skip before T-009-14/15)

- [x] **F-009-A** `RESOLVED` — **MODEL B:** `pipelineStatus` = canonical workflow state; `updatedAt` = trusted audit clock; `stateHistory` non-authoritative / not CLIENT-persisted. Evidence: usage inventory + `tests/contentHistoryPolicy.test.ts` + existing content transition without stateHistory ALLOW.
- [x] **F-009-B** `RESOLVED` — Thesis strategic helpers use **one** `changedKeys()`/diff; approval transition checked before strategic apply; multi-field pendingRevision regression tests added (A23 preserved).
- [x] **F-009-C** `DONE` (Phase 4 / T-009-10) — No default tenant: `parsePosturaClaims` / `auth.toUser` / provision / `setPosturaClaims` fail closed when `organizationId` missing.

## Phase 4 — Claims, secrets, scanning, docs

- [x] **T-009-10** `DONE` — Provision + `setPosturaClaims` + parse/auth fail-closed; no `org_aurora_01` default; CLIENT requires clientId; ADMIN clientId forced null.
- [x] **T-009-10b** `DONE` — Admin SDK writer inventory; `scheduledIngest` requires explicit org envelope; A24 unit tests.
- [x] **T-009-11** `DONE` — Prep-check + provision reject in-repo SA paths; **Phase 4.1:** active SA moved to `%USERPROFILE%\.firebase-credentials\`, in-repo copy removed, `firebase:prep` PASS with external `GOOGLE_APPLICATION_CREDENTIALS`.
- [x] **T-009-12** `DONE` — `docs/ops/firebase.md`: claims, refresh/re-login, CODE_COMPLETE vs DEPLOYED, migration order.
- [x] **T-009-13** `DONE` — `npm run secret:scan` (+ gitleaks if available); exposure classification documented (no secret values in report).
- [x] **T-009-13b** `DONE` — `migration.md` aligned with Phase-4 findings; migration **not** executed.

## Phase 5 — Finalize envelope rules, verify, code complete, migrate, deploy

**SDD gate:** Do **not** change rules/app implementation after declaring **`CODE_COMPLETE`** except as a classified blocker fix (or explicitly governed compatible security change) + full security suite rerun + updated freeze reference (see T-009-15r). Prod backfill (**T-009-16**) and deploy (**T-009-18**) operate on already-finalized repo artifacts.

- [x] **T-009-14e** `DONE` — **Finalize denormalized security envelope rules:** existing-resource auth = envelope only (no parent get). **ADMIN CREATE** adds narrowly scoped `get(clients/{clientId})` referential-integrity check (`adminCreateParentClientOrgOk`). CLIENT CREATE = token/path/request envelope only. Helpers: `rootClientReadable`, `existingSubEnvelopeValid`, `createSubEnvelopeValid`, `adminCreateSub`, `clientCreateSub`, `adminWriteSub`, `adminDeleteSub`, `ownsSubResource`. **91** rules tests PASS. **Repo rules ≠ production deployed rules** until T-009-18.
- [x] **T-009-14** `DONE` — Final security verification audit: SEC-009-001..020 traceability PASS (automated where required); acceptance A1–A11, A14q, A15–A24 PASS; A12/A13/A14 not declared; **91/91** `test:rules` + **286/286** `check` green; no implementation blockers before T-009-15.
- [x] **T-009-15** `DONE` — **`CODE_COMPLETE` declared** · frozen SHA `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` · **91/91** `test:rules` · **286/286** `check`.
- [x] **T-009-15r** `DONE` (2026-10-12, governance only) — **Security re-freeze / reacceptance for SPEC-010 A31** (human decision **OPTION B**). Post-hoc classification: `4bda325` HARDENING_COMPATIBLE · `15590e2` SAFE_NEW_DOMAIN_SECURITY_EXTENSION · `6aebe21` / `cd20acd` / `6e4c739` SPEC009_BLOCKER_FIX. Implementation `6e4c739`; frozen reference = re-freeze governance commit; `9c351ef` superseded. Gates: **106/106** `test:rules` · **880/880** security suite · **3278/3278** `check` · build · **91/91** E2E · secret scan NO rotation. **No deploy; T-009-16..19 unchanged.**
- [ ] **T-009-16** `TODO` — Ejecutar `migration.md` **data path only** (backup → dry-run → backfill → verify) según autorización. **No rules code change here.**
- [ ] **T-009-17** `TODO` — Claims reprovision + obligatoriedad re-login / token refresh.
- [ ] **T-009-18** `TODO` — `firebase deploy --only firestore:rules` (rules already finalized at T-009-14e) → progreso **`DEPLOYED`** (Firestore).
- [ ] **T-009-18s** `TODO` / `BLOCKED` — `firebase deploy --only storage` cuando Console lo permita.
- [ ] **T-009-19** `TODO` — Post-deploy verification + smoke; marcar Spec `DONE` o `PARTIAL`; actualizar audit Spec Gaps.

---

## Suggested order

```text
T-009-00 → 00b → 00c
 → 01 → 02 → 03 → 03q
 → 04 → 05 → 05t → 05n → 05o → 06 → 06p → 06b
 → 07 → 08 → 09
 → 10 → 10b → 11 → 12 → 13 → 13b
 → 14e → 14 → 15 → 15r → 16 → 17 → 18 → 18s → 19
```

### Envelope / get(parent) lifecycle (governance)

```text
TEMPORARY get(parent)  (Phases 1–4)
        ↓
T-009-14e  Finalize denormalized envelope rules + fixture tests
        ↓
T-009-14   test:rules PASS
        ↓
T-009-15   CODE_COMPLETE
        ↓
T-009-16   Backup → backfill prod → verify backfill   (data only)
        ↓
T-009-17   Claims reprovision
        ↓
T-009-18   Deploy final rules (already in repo at CODE_COMPLETE)
```

## Out of this Spec

- `005-ai-gateway`, App Check, Blaze, OTel, React (`010`)
- `PLATFORM_ADMIN` / ADMIN global
- Rediseño Learning Engine (solo integridad de outcomes)
