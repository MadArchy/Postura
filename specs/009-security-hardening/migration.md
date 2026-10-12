# Migration 009 — Security Hardening

**Do not execute until Spec status is `APPROVED` and a human authorizes the migration window.**

This document is the **data/deploy runbook** (T-009-16+). Rules/app implementation reached **`CODE_COMPLETE` at T-009-15**. This runbook must **not** change rules code — only backup, verify, then deploy already-finalized artifacts.

SPEC-009 is **not deployed**. Everything below the "Current production state" section describes future steps unless a status explicitly says otherwise.

---

## Current production state (observed 2026-10-12, read-only)

| Item | State |
|------|-------|
| SPEC-009 rules live | **NO** |
| Firestore rules in production | pilot-era ruleset (see Rollback baseline) |
| Live Hosting | **no release** (only a preview channel exists) |
| `aiComplete` function | **not deployed** (0 functions) |
| Envelope audit 2026-10-12 | **1003 scanned / 1003 valid / 0 backfill candidates** across 6 root clients |
| Auth claims | **not yet audited** (read-only audit identity cannot list Auth users) |
| Billing | **`MANUAL_CONSOLE_CONFIRMATION_REQUIRED`** — not readable with existing credentials; do not assume Blaze |
| Cloud Storage buckets | none exist |

The 2026-10-12 counts are a dated historical checkpoint, not an expected value. Every future run computes state dynamically.

Because no backfill candidate exists, T-009-16 is a **read-only re-verification**, not an expected backfill.

---

## CUTOVER-E order (authoritative)

1. Confirm Blaze (human, console: Firebase Console → *Usage and billing* → plan "Blaze").
2. Enable required APIs (Cloud Build, Artifact Registry, Cloud Run, Secret Manager, Eventarc).
3. Capture rollback identifiers (current Firestore ruleset release, Hosting channels, functions list).
4. Create/verify the backup bucket (location compatible with the `nam5` database → `US` multi-region).
5. Firestore managed export — `npm run spec009:prod:backup` (see Tooling). **Must end `BACKUP = VERIFIED`.**
6. Run the read-only envelope audit — `npm run spec009:prod:audit`.
7. **STOP** if any envelope is invalid (human review; any repair is a separately authorized unit).
8. Claims audit / reprovision (§6).
9. User re-login (§7).
10. Verify claims (`role`, `organizationId`, `clientId` for CLIENT) in fresh ID tokens.
11. Deploy Firestore rules (`firebase deploy --only firestore:rules`).
12. Storage rules only if Storage/bucket functionality is enabled.
13. Configure secrets / IAM for the function.
14. Deploy **only** `functions:aiComplete` (never `--only functions`: it would also deploy scheduled ingestion that writes production).
15. Build web with `VITE_POSTURA_FUNCTIONS_BASE`.
16. Preview rehearsal on a Hosting preview channel.
17. Human go/no-go.
18. First live Hosting release.
19. Canaries / monitoring.

There is no combined command for these steps. Each step is invoked and checked on its own.

---

## Hard stops

Abort CUTOVER-E (no fall-through to later steps) when any of these holds:

- Blaze not confirmed;
- backup/export unsuccessful (`spec009:prod:backup` exit ≠ 0);
- envelope audit cannot complete (auth/permission, network/API or configuration exit);
- any invalid envelope (exit 2);
- ambiguous tenant ownership (orphans, conflicts, unexpected parent documents);
- claims not audited;
- any user missing the `organizationId` claim;
- users not reauthenticated after reprovision;
- rule tests fail;
- function deployment fails;
- preview canary fails;
- cross-tenant access unexpectedly succeeds;
- production canary fails.

---

## Rollback baseline

| Surface | Identifier | Note |
|---------|-----------|------|
| Firestore rules | ruleset `f437c33d-0657-480f-829b-edd1eb70228b` (release `cloud.firestore`) | **CAPTURED 2026-10-12 — MUST BE REVERIFIED BEFORE CUTOVER** |
| Hosting live | no release | rollback of a first release = `firebase hosting:disable` |
| Functions | none deployed | rollback = delete `aiComplete` |

Rules rollback re-points release `cloud.firestore` to the re-verified previous ruleset.

---

## Tooling

Both scripts mint a short-lived token in memory with gcloud. They never read service-account JSON keys (key flags are refused), never print the token, and require an explicit `--project`.

### Read-only envelope audit — `npm run spec009:prod:audit`

```powershell
npm run spec009:prod:audit -- --project aurora-postura-app `
  --impersonate-service-account postura-prod-audit-ro@aurora-postura-app.iam.gserviceaccount.com
```

- Identity: the read-only audit service account via impersonation (Firestore data read only). Firebase Admin SDK identities are refused; any other identity prints a warning. If a read is denied, the audit fails — it never escalates credentials.
- Reads only `organizationId` / `clientId` (field mask) plus document paths. No business payload is fetched or printed. Output paths contain internal document IDs only.
- Requests are restricted to document reads (`GET` list and `listCollectionIds`). Anything else is blocked as an incident. It never writes, exports, invokes the backup, deploys rules or backfills.
- Root clients are listed with `showMissing` so subcollections under a missing parent document are reported as orphans.
- Optional `--report-file <path>` (must be outside the repository).
- Local check: `--emulator-host 127.0.0.1:8080` with an emulator project.

Exit codes: `0` all envelopes valid · `2` invalid envelopes · `3` auth/permission · `4` network/API · `5` configuration.

Totals reported: root clients scanned, subdocuments scanned, valid, missing organizationId, missing clientId, missing both, organization conflicts, client conflicts, orphans, affected families.

**Routine envelope audits must never use an Admin JSON key** (`firebase-sa.json` or any `firebase-adminsdk` identity).

### Firestore managed export — `npm run spec009:prod:backup`

```powershell
# Plan only (default): validates inputs, sends no request
npm run spec009:prod:backup -- --project aurora-postura-app --output-uri-prefix gs://<bucket>/spec009-backups

# Execute (only after Blaze is confirmed by a human and the bucket exists)
npm run spec009:prod:backup -- --project aurora-postura-app --output-uri-prefix gs://<bucket>/spec009-backups --execute --confirm-blaze

# Re-check an operation
npm run spec009:prod:backup -- --project aurora-postura-app --verify-operation projects/aurora-postura-app/databases/(default)/operations/<id>
```

- Separate from the audit; the audit never calls it.
- Writes into a unique timestamped folder under the given prefix and prints the operation name.
- Identity: gcloud active account, or `--impersonate-service-account` of an identity allowed to export.
- Exit codes: `0` plan printed / export verified · `3` auth/permission · `4` network/API · `5` configuration · `6` export failed or output unverified · `7` export still pending.
- The 2026-08 attempt failed with "billing must be enabled". Billing status is still `MANUAL_CONSOLE_CONFIRMATION_REQUIRED`.

There is **no backfill command**. If a future audit finds invalid envelopes: STOP → human review → separate authorization.

---

## Purpose

Habilitar rules org-scoped + envelope denormalizado (si el freeze lo exige) sin dejar el piloto en estado inconsistente.

## Preconditions

- Spec `APPROVED`
- T-009-00 / T-009-00c freeze (envelope strategy) complete
- **T-009-14e DONE** — final denormalized envelope in repo; normal tenant auth has **no** parent get; **ADMIN CREATE** uses one referential-integrity `get(clients/{clientId})`
- **T-009-15 `CODE_COMPLETE`** — tests green against those final rules
- Backup completed and verified (CUTOVER-E step 5)
- Read-only audit identity usable via impersonation (no JSON key for audits)
- JDK + `npm run test:rules` verdes against **CODE_COMPLETE** rules (emulator)

---

## 1. Inventory

**Status: COMPLETE** (Phase 0 — see `inventory.md`).  
**Envelope freeze: COMPLETE** (T-009-00c — denormalized; Q1 query strategy frozen; SEC-009-020 frozen).

Inputs (available):

- Salida T-009-00 (ops Firestore/Storage + status + timestamps) — `inventory.md`
- Tabla colección → envelope strategy (`plan.md` / `inventory.md` §F)
- Type gaps requiring backfill design: `notifications`, `recommendations` (+ verify prod)

---

## 2. Backup

- Managed export via `npm run spec009:prod:backup` (or `gcloud firestore export gs://<bucket>/<prefix> --project aurora-postura-app`)
- Requires confirmed Blaze billing and an existing bucket; neither is assumed
- Record operation name, timestamp and GCS prefix; the export must reach `SUCCESSFUL` with metadata files present
- Confirmar que **no** se empaqueta ninguna credencial dentro del archive de backup del código

---

## 3. Dry run / envelope audit

- `npm run spec009:prod:audit` (read-only, field-masked) against production
- Contar docs missing envelope vs expected; any invalid envelope is a **STOP**
- History (T-009-16A / 16A.1, 2026-08-23, historical branch commit `6aacbce`, commands `spec009:dryrun` / `spec009:backup` using an external Admin key): dry-run PASS — 2 root clients, 286 subdocs, 282 valid, 4 would backfill, 0 conflicts; managed export BLOCKED (`billing must be enabled`). Those commands are superseded by `spec009:prod:audit` / `spec009:prod:backup`.
- 2026-10-12 read-only audit (audit identity, field-masked): 6 root clients, 1003 / 1003 valid, 0 backfill candidates.

---

## 4. organizationId (envelope) matrix

Documents must match **T-009-14e final rules** before deploy (T-009-18). Do **not** deploy strict final rules against documents with invalid envelopes.

### Envelope matrix (current HEAD, 25 families)

Every `clients/{clientId}/<family>` match in `firestore.rules` reads through `existingSubEnvelopeValid`, which requires both fields. A family with no documents in production counts as **0 valid documents**, not as an error.

| Collection / path | Scope | organizationId | clientId | Verification |
|-------------------|-------|----------------|----------|--------------|
| `clients/{clientId}` | root | **required** | n/a (path id) | non-empty `organizationId` |
| `clients/{id}/sources` | subcollection | required | required | `organizationId` == parent client org; `clientId` == path id |
| `clients/{id}/signals` | subcollection | required | required | same |
| `clients/{id}/curation` | subcollection | required | required | same |
| `clients/{id}/theses` | subcollection | required | required | same |
| `clients/{id}/recommendations` | subcollection | required (type gap) | required | same |
| `clients/{id}/campaigns` | subcollection | required | required | same |
| `clients/{id}/campaignMilestones` | subcollection | required | required | same |
| `clients/{id}/advices` | subcollection | required | required | same |
| `clients/{id}/deliveries` | subcollection | required | required | same |
| `clients/{id}/notifications` | subcollection | required (type gap) | required | same |
| `clients/{id}/tasks` | subcollection | required | required | same |
| `clients/{id}/contents` | subcollection | required | required | same |
| `clients/{id}/opportunities` | subcollection | required | required | same |
| `clients/{id}/profile/data` | subcollection | required | required | same |
| `clients/{id}/dossier/data` | subcollection | required | required | same |
| `clients/{id}/evidence` | subcollection | required | required | same |
| `clients/{id}/results` | subcollection | required | required | same |
| `clients/{id}/feedbackEvents` | subcollection | required | required | same |
| `clients/{id}/signalOutcomes` | subcollection | required | required | same |
| `clients/{id}/proofWallItems` | subcollection | required | required | same |
| `clients/{id}/aiRuns` | subcollection | required | required | same |
| `clients/{id}/strategicBriefs` | subcollection (T604, ADMIN-only) | required | required | same |
| `clients/{id}/strategicBriefHistory` | subcollection (T604, ADMIN-only, append-only) | required | required | same |
| `clients/{id}/strategicBriefOverrides` | subcollection (T604, ADMIN-only, append-only) | required | required | same |

Classification per subdocument: `VALID`, `MISSING_ORGANIZATION_ID`, `MISSING_CLIENT_ID`, `MISSING_BOTH`, `CONFLICT` (organization and/or client mismatch with the path-derived tenant), `ORPHAN` (parent client document missing or without `organizationId`). Collections found under a client that are not in the matrix are reported as unmatrixed (no rule matches them, so they are unreachable by clients).

**Historical backfill strategy (not automated):** idempotent merge-set of `organizationId` and `clientId` where missing; never overwrite a correct value with a cross-org value. Any repair requires a separately authorized unit.

**CREATE parent integrity check:** independent of T-009-16 (validates live parent client doc at ADMIN CREATE time).

---

## 5. Verification (pre-deploy rules)

- Envelope audit exit 0 immediately before the rules deploy
- Spot-check Juan/Elena/manager seed via the app after rules deploy (post-deploy canary)
- Ningún doc requerido con envelope `null` en colecciones “denormalized required”

---

## 6. Claims reprovision

Claims audit is **required before rule deploy**; reprovision is required if tokens lack the current SPEC-009 claims. This tooling unit does not change `firebase:provision`.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="<PATH_EXTERNO_AL_REPO>\firebase-sa.json"
npm run firebase:provision
```

Validar claims: `role`, `organizationId`, `clientId` (CLIENT).

---

## 7. Token refresh / re-login

- Usuarios demo (manager, Juan, Elena) deben **cerrar sesión y volver a entrar** (o forzar refresh de ID token) para recibir claims nuevos
- Documentar en ops: tokens viejos pueden fallar o comportarse distinto tras deploy

---

## 8. Rules deployment

Deploy the rules **already finalized at T-009-14e** and locked at CODE_COMPLETE. Do **not** edit `firestore.rules` in this step.

Orden recomendado:

1. Confirm envelope audit (step 5) exit 0 and claims verified
2. Confirm `CODE_COMPLETE` still green (no post-complete rule edits)
3. `firebase deploy --only firestore:rules` (**T-009-18**)
4. Si Storage Console activo y tests Storage PASS: `firebase deploy --only storage`
5. Marcar Spec `DEPLOYED` (o `PARTIAL` si Storage pendiente)

---

## 9. Post-deploy verification

- Login manager: lee solo su org
- Login Juan: lee solo su client; update allowlisted OK; update ilegal deny
- Intento cross-org (segundo org de prueba o token de test): deny
- Query/list cross-org: deny
- Storage recording upload/read si DEPLOYED Storage
- `npm run test:rules` sigue PASS en CI/local

---

## 10. Rollback

Si falla post-deploy:

1. Re-point `cloud.firestore` to the re-verified previous ruleset (see Rollback baseline); Storage only if deployed
2. No revertir envelopes a ciegas si las rules viejas toleran envelope extra (campos adicionales suelen ser safe)
3. Si claims breaking: re-provision al esquema anterior **solo** si se revierten rules que lo exijan
4. Restaurar export Firestore **solo** ante corrupción de datos (último recurso)
5. Comunicar a usuarios: re-login

---

## Status of this runbook

| Step | Status |
|------|--------|
| Inventory | **COMPLETE** (`inventory.md`) |
| Envelope freeze | **COMPLETE** (T-009-00c) |
| Q1 query strategy | **FROZEN** (app change required; executed in Phase 1 for `listFirestoreClientIds`) |
| Actor-aware persistence | **COMPLETE** Phase 2 (SEC-009-020) |
| Claims fail-closed / no default tenant | **COMPLETE** Phase 4 (T-009-10) — production reprovision **NOT EXECUTED** |
| Admin SDK envelope (scheduledIngest) | **COMPLETE** Phase 4 (T-009-10b) |
| External SA + prep-check | **COMPLETE** Phase 4 (T-009-11) |
| Ops docs (refresh / gates) | **COMPLETE** Phase 4 (T-009-12) |
| Secret scan (local) | **COMPLETE** Phase 4 (T-009-13) — see scan report; rotation decision documented |
| Final envelope rules | **DONE** T-009-14e (repo only; not deployed; ADMIN CREATE integrity get documented) |
| CODE_COMPLETE checkpoint (T-009-15) | **DONE** — frozen SHA `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` |
| Read-only audit / backup tooling | **READY** (`spec009:prod:audit`, `spec009:prod:backup`; not executed against production) |
| Backup | NOT EXECUTED (2026-08 attempt failed: billing) |
| Envelope audit (pre-deploy) | Observation 2026-10-12: 1003 / 1003 valid; must be re-run in the cutover window |
| Backfill | NOT REQUIRED as of 2026-10-12 (0 candidates); no tooling |
| Claims audit / reprovision (prod) | NOT EXECUTED — hard gate |
| Token refresh (prod users) | NOT EXECUTED |
| Rules deployment | NOT EXECUTED |
| Post-deploy verification | NOT EXECUTED |
| Rollback | N/A |

**NO MIGRATION / DEPLOY EXECUTED.**

### Sequence (locked)

```text
CODE implementation (Phases 1–4)
→ final envelope rules (T-009-14e)
→ tests (T-009-14)
→ CODE_COMPLETE (T-009-15)
→ Blaze + APIs → rollback capture → verified backup
→ read-only envelope audit (T-009-16; STOP on any invalid envelope)
→ claims audit/reprovision (T-009-17) → re-login → claims verified
→ rules deploy (T-009-18 / 18s)
→ functions:aiComplete → web preview → go/no-go → live Hosting
→ post-deploy verification / canaries (T-009-19)
```
