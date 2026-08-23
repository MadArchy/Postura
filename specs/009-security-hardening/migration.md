# Migration 009 — Security Hardening

**Do not execute until Spec status is `APPROVED` and a human authorizes the migration window.**

This document is the **data/deploy runbook** (T-009-16+). Rules/app implementation reached **`CODE_COMPLETE` at T-009-15**. This runbook must **not** change rules code — only backup, backfill, verify, then deploy already-finalized artifacts.

---

## Purpose

Habilitar rules org-scoped + envelope denormalizado (si el freeze lo exige) sin dejar el piloto en estado inconsistente.

## Preconditions

- Spec `APPROVED`
- T-009-00 / T-009-00c freeze (envelope strategy) complete
- **T-009-14e DONE** — final denormalized envelope in repo; normal tenant auth has **no** parent get; **ADMIN CREATE** uses one referential-integrity `get(clients/{clientId})`
- **T-009-15 `CODE_COMPLETE`** — tests green against those final rules
- Backup completed (step 2)
- SA credential usable vía path **externo** al repo (`GOOGLE_APPLICATION_CREDENTIALS`)
- JDK + `npm run test:rules` verdes against **CODE_COMPLETE** rules (emulator)

---

## 1. Inventory

**Status: COMPLETE** (Phase 0 — see `inventory.md`).  
**Envelope freeze: COMPLETE** (T-009-00c — denormalized; Q1 query strategy frozen; SEC-009-020 frozen).

Inputs (available):

- Salida T-009-00 (ops Firestore/Storage + status + timestamps) — `inventory.md`
- Tabla colección → envelope strategy (`plan.md` / `inventory.md` §F)
- Type gaps requiring backfill design: `notifications`, `recommendations` (+ verify prod)

Deliverable for migration window: checklist de paths a backfillear + Firestore index needs for Q1 `where('organizationId','==', …)`.

---

## 2. Backup

- Export Firestore (Console export o `gcloud firestore export`) del proyecto `aurora-postura-app`
- Anotar timestamp + GCS/local path del export
- Confirmar que **no** se empaqueta la SA dentro del archive de backup del código

**Ops tooling (post–CODE_COMPLETE; does not change frozen SHA `9c351ef`):**

| Script | npm command | Purpose |
|--------|-------------|---------|
| `scripts/spec009-firestore-backup.mjs` | `npm run spec009:backup` | Managed export + poll until SUCCESS + GCS metadata validation |
| `scripts/spec009-envelope-dryrun.mjs` | `npm run spec009:dryrun` | Read-only inventory + dry-run (`--skip-backup`; use backup script separately) |

Reports written outside repo: `%USERPROFILE%\.firebase-credentials\spec009-reports\`

**T-009-16A / 16A.1 status (2026-08-23):** Production inventory + dry-run **PASS** (2 root clients, 286 subdocs, 4 safe backfill). Managed export **BLOCKED** — Firestore export API returns `billing must be enabled` on `aurora-postura-app`; no prior `spec009-backups/` objects in GCS. Re-run `npm run spec009:backup` after Blaze/billing propagates.

---

## 3. Dry run

- En emulator o proyecto staging (si existe): aplicar backfill script en dry-run / read-only report
- Contar docs missing envelope vs expected
- Ejecutar rules tests contra datos de muestra post-backfill simulado
- **Stop** si counts ≠ expected sin plan de remediación

---

## 4. organizationId (envelope) backfill

Backfill must produce documents matching **T-009-14e final rules** before deploy (T-009-18). Do **not** deploy strict final rules against unbackfilled production documents.

### Backfill matrix (T-009-16)

| Collection / path | organizationId | clientId | Derive organizationId from | Derive clientId from | Validation | Rollback |
|-------------------|----------------|----------|----------------------------|----------------------|------------|----------|
| `clients/{clientId}` | **required** | n/a (path id) | existing field; else claims/demo fixture org for that client | n/a | spot-check Q1 query; deny if null | redeploy old rules; extra fields usually safe |
| `clients/{id}/sources` | **required** | **required** == path | parent `clients/{id}.organizationId` | path `{id}` | rules emulator sample post-backfill | same |
| `clients/{id}/signals` | required | required | parent client doc | path | same | same |
| `clients/{id}/curation` | required | required | parent | path | same | same |
| `clients/{id}/theses` | required | required | parent | path | same | same |
| `clients/{id}/recommendations` | **required (type gap)** | required | parent | path | count missing orgId | same |
| `clients/{id}/campaigns` | required | required | parent | path | same | same |
| `clients/{id}/campaignMilestones` | required | required | parent | path | same | same |
| `clients/{id}/advices` | required | required | parent | path | same | same |
| `clients/{id}/deliveries` | required | required | parent | path | same | same |
| `clients/{id}/notifications` | **required (type gap)** | **required** | parent | path | CREATE rules require both | same |
| `clients/{id}/tasks` | required | required | parent | path | same | same |
| `clients/{id}/contents` | required | required | parent | path | same | same |
| `clients/{id}/opportunities` | required | required | parent | path | same | same |
| `clients/{id}/profile/data` | required | required | parent | path | same | same |
| `clients/{id}/dossier/data` | required | required | parent | path | same | same |
| `clients/{id}/evidence` | required | required | parent | path | same | same |
| `clients/{id}/results` | required | required | parent | path | same | same |
| `clients/{id}/feedbackEvents` | required | required | parent | path | same | same |
| `clients/{id}/signalOutcomes` | required | required | parent | path | same | same |
| `clients/{id}/proofWallItems` | required | required | parent | path | same | same |
| `clients/{id}/aiRuns` | required | required | parent | path | same | same |

**Strategy:** Idempotent merge-set `organizationId` and `clientId` where missing; never overwrite a correct value with a cross-org value. Dry-run reports: scanned / updated / skipped / errors.

**CREATE parent integrity check:** independent of T-009-16 backfill (validates live parent client doc at ADMIN CREATE time).

**Repo vs production:** Final rules exist in git after T-009-14e. Production deployment waits for backfill verification (step 5) then T-009-18.

- Escribir `organizationId` (y `clientId` cuando aplique) en documentos tenant-scoped según freeze
- Preservar valores existentes correctos; no overwrite cross-org
- Idempotente: re-run seguro
- Registrar métricas: scanned / updated / skipped / errors

*(Script concreto se añade en IMPLEMENTING; este runbook no lo ejecuta ahora.)*

---

## 5. Verification (pre-deploy rules)

- Spot-check docs Juan/Elena/manager seed
- Queries inventariadas siguen retornando filas expected en same-org
- Ningún doc requerido con envelope `null` en colecciones “denormalized required”

---

## 6. Claims reprovision

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

Deploy the rules **already finalized at T-009-14e** and locked at CODE_COMPLETE. Do **not** edit `firestore.rules` in this step to remove `get(parent)` — that work is T-009-14e.

Orden recomendado:

1. Confirm backfill verification (step 5) PASS
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

1. Redeploy **previous** `firestore.rules` / `storage.rules` from git tag/commit conocido
2. No revertir backfill a ciegas si las rules viejas toleran envelope extra (campos adicionales suelen ser safe)
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
| Backup | **BLOCKED** (T-009-16A.1 — billing not enabled on export API; re-run `spec009:backup`) |
| Dry run | **PASS** (T-009-16A — 282 valid, 4 would backfill, 0 conflicts) |
| Backfill | NOT EXECUTED |
| Verification (pre-deploy rules) | NOT EXECUTED (T-009-16) |
| CODE_COMPLETE checkpoint (T-009-15) | **DONE** — frozen SHA `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` |
| Claims reprovision (prod) | NOT EXECUTED |
| Token refresh (prod users) | NOT EXECUTED |
| Rules deployment | NOT EXECUTED |
| Post-deploy verification | NOT EXECUTED |
| Rollback | N/A |

**Phase 4 documentation alignment only — NO MIGRATION / DEPLOY EXECUTED.**

### Sequence (locked)

```text
CODE implementation (Phases 1–4)
→ final envelope rules (T-009-14e)
→ tests (T-009-14)
→ CODE_COMPLETE (T-009-15)
→ backup → dry-run → production envelope backfill (T-009-16)
→ claims reprovision (T-009-17)
→ token refresh / re-login
→ rules deploy (T-009-18 / 18s)
→ post-deploy verification (T-009-19)
```
