# Plan 009 — Security Hardening

## Spec metadata (reproducible)

| Campo | Valor |
|-------|--------|
| constitutionVersion | `1.0` |
| baselineAudit | `docs/audits/BASELINE_CONSTITUTION_AUDIT.md` |
| baselineGitCommitSHA | `3d7ea20b5c997d035736abdeb97d30d33a996bfc` |
| baselineGitBranch | `main` |
| implementationBranch | `spec/009-security-hardening` |
| NodeVersion | `v24.7.0` |
| FirebaseCLI | `15.14.0` |
| testBaseline | check 261 PASS; test:rules 7/7 pre-hardening |
| repositoryClean/Dirty | Dirty |
| Spec status | **`APPROVED`** · Phase 0 DONE · **do not start T-009-01** without new human go-ahead |
| Requirement IDs | `SEC-009-001` … `SEC-009-020` |

## Approach

Endurecimiento **incremental y testeable** de Auth claims + Firestore/Storage rules + secret policy, sin AI gateway ni rediseño de Learning Engine.

Orden:

1. **T-009-00 inventory completo** (Firestore ops + Storage ops + status machines reales).
2. **Decisión freeze:** parent `get()` vs denormalized envelope (sección abajo).
3. Helpers + verbos CREATE/READ/LIST/UPDATE/DELETE + org-scoped ADMIN.
4. Field allowlists + **CLIENT state transition matrices** (solo estados reales).
5. Timestamp policy (`request.time` / serverTimestamp).
6. Notifications LP + signalOutcomes manager-only.
7. Storage **matriz por asset** + automated tests.
8. SA fuera del tree + secret scanning.
9. `CODE_COMPLETE` → deploy (`DEPLOYED`) → `DONE` / `PARTIAL`.

## Decision: parent `get()` vs denormalized `organizationId`

### Frozen (T-009-00c)

> **Denormalized immutable `organizationId` (+ `clientId` when applicable)** on tenant-scoped docs.  
> **No primary `get(parent)`.** See `inventory.md` §F and Envelope freeze table below.

Historical preference text retained as rationale; freeze supersedes “pending”.

### Criterios de decisión (salida obligatoria de T-009-00)

Para cada subcolección en `CLIENT_SUBCOLLECTIONS` + `clients` + `organizations` + `auditLogs`:

| Pregunta | Si sí → |
|----------|---------|
| ¿Hay `query` / `onSnapshot` / posible `collectionGroup`? | Envelope denormalizado en el doc |
| ¿Rules LIST deben constrainear sin `get(parent)` frágil? | Denormalizado |
| ¿Doc siempre se crea con parent client conocido y solo get-by-id? | `get(parent)` puede bastar |
| ¿Costo de backfill aceptable? (ver `migration.md`) | Denormalizado viable |

### Tentative target helpers (ajustar tras inventario)

```javascript
function signedIn() {
  return request.auth != null;
}

function tokenOrg() {
  return request.auth.token.organizationId;
}

function isAdmin() {
  return signedIn() && request.auth.token.role == 'ADMIN';
}

function isClient() {
  return signedIn() && request.auth.token.role == 'CLIENT';
}

function adminOfOrg(orgId) {
  return isAdmin() && tokenOrg() != null && tokenOrg() == orgId;
}

// Preferido cuando envelope denormalizado:
function envelopeMatches(data) {
  return data.organizationId == tokenOrg()
    && (
      isAdmin()
      || (isClient() && data.clientId == request.auth.token.clientId)
    );
}

function createEnvelopeValid() {
  return request.resource.data.organizationId == tokenOrg()
    && (
      isAdmin()
      || (
        isClient()
        && request.resource.data.clientId == request.auth.token.clientId
      )
    );
}

function preservesEnvelope() {
  return request.resource.data.organizationId == resource.data.organizationId
    && request.resource.data.clientId == resource.data.clientId;
}
```

**Freeze:** completar tabla “colección → envelope strategy” en Decision log **antes** de IMPLEMENTING. Sin freeze → no merge de rules.

## Query isolation (SEC-009-014) — Q1 frozen

**Security Rules are not filters.**

`listFirestoreClientIds` today: `getDocs(collection(db, 'clients'))` — **hard-incompatible** with org-scoped LIST.

**Required app change (before org-scoped rules deploy):**

```text
query(collection(db, 'clients'), where('organizationId', '==', authenticatedOrganizationId))
```

(or equivalent demonstrably tenant-scoped architecture).

Do **not** rely on rules to return only same-org documents from an unscoped list.

## Actor-aware persistence (SEC-009-020) — frozen

`importSnapshotToFirestore` → `batch.set(..., { merge: true })` can attempt to persist the full in-memory snapshot.

**Frozen:** CLIENT persistence must only attempt authorized client-write resources. CLIENT must not write manager-only collections merely because they exist in memory.

**Task:** T-009-06p — minimal safe scoping of the CLIENT persistence gateway (not a full architecture rewrite).

**Acceptance:** A21.

## Operation design (SEC-009-015)

No diseñar seguridad solo con `update`/`diff()`.

| Op | Regla |
|----|-------|
| CREATE | Validar envelope en `request.resource.data`; rol; campos iniciales |
| READ | Envelope / ownsClient |
| LIST | Compatible con query del SDK |
| UPDATE | `preservesEnvelope()` + allowlist + state transition + timestamp policy |
| DELETE | Ownership sobre `resource`; ADMIN org-scoped o policy explícita |

## Field allowlists + state machines

Allowlists de campos se congelan tras T-009-00 (inventario de writes reales).

State matrices CLIENT: ver `spec.md` (estados reales). Confirmación UI en inventory.

### Timestamp policy (SEC-009-017)

Campos a revisar (nombres reales según tipos/usos):

| Campo | Entidad típica | Policy objetivo |
|-------|----------------|-----------------|
| `acknowledgedAt` | deliveries | set solo a `request.time` (o equivalencia rules); deny client-supplied arbitrary |
| review timestamps (`clientReviewedAt` / similares si existen en código) | contents | idem |
| `decidedAt` | — | **n/a** — field not present in codebase; do not invent |
| `completedAt` | tasks / opportunities | idem |
| `updatedAt` | varios | preferir server/`request.time` en paths de workflow; documentar excepciones |

Implementación rules típica: campo ausente en allowlist de strings libres **o** `request.resource.data.acknowledgedAt == request.time`.

App: preferir `serverTimestamp()` en writes CLIENT de workflow.

## Notifications (SEC-009-018) — frozen

CLIENT:

- READ: own notifications under `clients/{clientId}/notifications`.
- UPDATE: only `read` (boolean).
- CREATE: **policy frozen** — allowed **only** for documented manager-alert flow (`notifyManager` / `notificationService.push`).
- **Arbitrary notification CREATE → DENY.**
- **Exact field allowlist** (`organizationId`, `clientId`, `type`, recipient/target semantics, `read` initial, `createdAt`/`request.time`, allowed message fields) **must be frozen at T-009-04 before T-009-05n** rule implementation.
- DELETE: ADMIN org-scoped (CLIENT deny).

## signalOutcomes (SEC-009-019) — frozen

- CREATE/UPDATE/DELETE: **ADMIN (org) / system only** (`recordSignalOutcome` = manager radar).
- CLIENT write: **deny**.
- CLIENT read: **deny** (no ClientPortal usage; least privilege).
- Client feedback: `feedbackEvents` only.

## Envelope freeze (T-009-00c)

**Accepted:** denormalized immutable `organizationId` (+ `clientId` when applicable); **no** primary `get(parent)`. Full table: `inventory.md` §F.

| Collection | orgId denorm | clientId denorm | parent get | migration |
|------------|--------------|-----------------|------------|-----------|
| `clients` | yes | n/a | no | verify |
| typed subs with both | yes | yes | no | verify |
| `notifications` | **add** | require | no | **yes** |
| `recommendations` | **add** | yes | no | **yes** |
| `profile`/`dossier` | yes | yes | no | verify |

## Storage plan (SEC-009-008/009)

**No** usar un único 100 MB / MIME genérico como decisión final.

### Pre-inventory known asset

| path pattern | notes |
|--------------|-------|
| `organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm` | `storageRecordingPath`; upload/read/delete en `src/firebase/storageMedia.ts` |

### Matriz obligatoria (Phase 3 FROZEN)

| path | allowed roles | org condition | client condition | allowed MIME | max size (bytes) | CREATE | READ | UPDATE | DELETE |
|------|---------------|---------------|------------------|--------------|------------------|--------|------|--------|--------|
| `organizations/{orgId}/clients/{clientId}/recordings/{taskId}.webm` | CLIENT; ADMIN | `token.organizationId == orgId` | CLIENT: `token.clientId == clientId`; ADMIN: same-org only | `video/webm` or `video/webm;…` | **90_000_000** | yes | yes | **no** | yes |

**Size calculation (frozen numeric):**
- Product max recording duration: **10 minutes** (`MAX_RECORDING_DURATION_MS`) — UX bound; video tasks use estimatedMinutes 10–15.
- Explicit MediaRecorder `videoBitsPerSecond` = **1_000_000** (`RECORDING_VIDEO_BITS_PER_SECOND`) — product bitrate bound (avoids unbounded Chrome defaults).
- Raw: `1_000_000 × 600 / 8 = 75_000_000` bytes.
- Safety margin +20% → **90_000_000** bytes.
- Cap leaves headroom under Storage Emulator body-parser **130mb** (~136_314_880) including multipart framing so MAX+1 oversize DENY is automatable.
- Enforced in `storage.rules`, `recordingLimits.ts`, MediaRecorder options, and teleprompter auto-stop.

**MIME:** upload sets `contentType` via `resolveRecordingContentType` (never octet-stream).  
**UPDATE:** deny (`updateMetadata` has no call sites; overwrite = delete-then-create).  
**Unauth / cross-org / cross-client:** DENY.

Only Storage path family in repo (`storageRecordingPath`).

DONE de Storage security (code) = **automated** `tests/storage.rules.test.ts` PASS.  
Deploy Storage rules = separate gate (O1 / T-009-18s) — not Phase 3.

## Secrets / service account (SEC-009-012)

Objetivo:

1. Credencial **fuera del repository tree** (no `AURORA/secrets/...` como destino recomendado).
2. Fuera de ZIP/RAR/artifacts compartidos del proyecto.
3. Dev/ops: `GOOGLE_APPLICATION_CREDENTIALS` → ruta externa (p. ej. perfil usuario fuera del clone).
4. Verificaciones: git history, remote repo, archives/artifacts.
5. Si evidencia de exposición de credencial **válida** → **rotation required** antes de DONE.
6. Secret scanning (gitleaks u equivalente) como task/criterio de acceptance.

`.gitignore` de `secrets/` es **mínimo necesario**, no suficiente.

## Deploy vs code complete

| Gate | Significa |
|------|-----------|
| `CODE_COMPLETE` | Rules + callers + tests en repo verdes — **incluye T-009-14e** (final envelope; normal auth without parent get; ADMIN CREATE integrity get only) |
| `DEPLOYED` | After T-009-16 backfill verify: `firebase deploy` rules (+ storage si aplica) + claims reprovision en proyecto |
| `DONE` | Acceptance Required PASS + DEPLOYED (o `PARTIAL` documentado) |

**SDD:** Do not modify rules/app after `CODE_COMPLETE`. Sequence: **14e → 14 → 15 → 16 (data) → 17 → 18 (deploy)**.

### CODE_COMPLETE freeze (T-009-15)

| Field | Value |
|-------|--------|
| Branch | `spec/009-security-hardening` |
| Status | **CODE_COMPLETE** |
| Frozen suites | `test:rules` **91/91** · `check` **286/286** |
| Frozen commit SHA | `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` |
| Post-freeze changes | Only **CODE_COMPLETE BLOCKER FIX**, **MIGRATION DEFECT FIX**, **DEPLOYMENT DEFECT FIX**, **ROLLBACK FIX** — each requires full security suite rerun |

**CODE_COMPLETE ≠ DEPLOYED.** Repo rules = final post-backfill model; production may still run prior deployed rules until T-009-16 + T-009-18.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Full-snapshot merge push | Scope CLIENT push to own clientId (inventory risk) |
| Queries rotas tras org rules | Path-scoped lists OK; harden `clients` list + envelope |
| App updates anchos | allowlist + ajustar callers |
| Envelope backfill incompleto | `migration.md` dry-run + verification |
| Storage Console bloqueado | `PARTIAL`; automated tests still required for Storage DONE later |
| SA en tree / zip | política externa + scanning + rotation |
| Thesis CLIENT writes vs current rules | Allowlist approval fields in Phase 2 |
## Effort (estimate)

| Phase | Estimate |
|-------|----------|
| Inventory T-009-00 + envelope decision | 0.5–1 d |
| Firestore verbs + transitions + timestamps | 1–1.5 d |
| Storage matrix + automated tests | 0.5–1 d |
| SA policy + scanning + docs + migration dry-run prep | 0.5 d |
| Deploy + verify | 0.25–0.5 d |
| **Total** | **~3–4.5 días** |

## Decision log

| Date | Decision | Status |
|------|----------|--------|
| 2026-08-22 | ADMIN siempre org-scoped; no ADMIN global / PLATFORM_ADMIN en 009 | **Accepted** |
| 2026-08-22 | Denormalized envelope; no primary parent get | **Frozen (T-009-00c)** |
| 2026-08-22 | Notifications CLIENT CREATE exception (manager alerts) | **Frozen** |
| 2026-08-22 | signalOutcomes CLIENT read deny + write deny | **Frozen** |
| 2026-08-22 | Storage matrix: recordings `.webm` only; size **90_000_000**; bitrate 1 Mbps; duration cap 10m; UPDATE deny | **Frozen (Phase 3)** |
| 2026-08-22 | CLIENT allowlists / state / timestamps | **Frozen in `inventory.md` §C–E** |
| 2026-08-22 | Theses: CLIENT UPDATE approval allowlist only | **Frozen** |
| 2026-08-22 | Q1: Rules are not filters; `listFirestoreClientIds` must use tenant `where` (or equiv.) | **Frozen** |
| 2026-08-22 | SEC-009-020 actor-aware CLIENT persistence (T-009-06p / A21) | **Frozen** |
| 2026-08-22 | No hardcoded `org_aurora_01` in production UI writes (A22) | **Frozen** |
| 2026-08-22 | setPosturaClaims/provision: missing organizationId → fail; no default tenant | **Frozen** |
| 2026-08-22 | Notifications CREATE only manager-alert flow; arbitrary DENY; allowlist in T-009-04/05n | **Frozen** |
| 2026-08-22 | Thesis CLIENT approval only; deny strategic fields (A23) | **Frozen** |
| 2026-08-22 | **F-009-A MODEL B:** `pipelineStatus` + `updatedAt` canonical; `stateHistory` non-authoritative for CLIENT | **Frozen** |
| 2026-08-22 | **F-009-B:** Thesis CLIENT UPDATE uses single `clientThesisUpdateOk()` (one diff); proposed-key-only value match; A23 multi-field regression; DENY by policy not expression-budget | **Frozen** |
| 2026-08-22 | Admin SDK writers must write valid envelopes (T-009-10b) | **Frozen** |
| 2026-08-23 | **T-009-15 CODE_COMPLETE** declared on `spec/009-security-hardening` | **DONE** |
| 2026-08-23 | **T-009-14e DONE:** denormalized envelope in repo; normal tenant auth parent get = 0 | **DONE (repo)** |
| 2026-08-22 | Phase 1: `get(parent)` for `sameOrgAsClient` = **TEMPORARY** through Phases 2–4 | **Removed at T-009-14e** |
| 2026-08-22 | **T-009-14e** finalizes denormalized envelope rules **before** T-009-15 CODE_COMPLETE; T-009-16 = prod backfill only; T-009-18 = deploy | **Governance frozen** |
| | Live prod missing-envelope doc counts | **PENDING dry-run** |
| 2026-10-12 | **A31 rule-contract decision = OPTION B:** post-CODE_COMPLETE security changes are classified explicitly, the full security gates are rerun and a new freeze reference is recorded (reacceptance, not waiver) | **Accepted (human)** |
| 2026-10-12 | `4bda325` `createdAt` write-once in `preservesEnvelope()` — **HARDENING_COMPATIBLE**: more restrictive only; no tenant/org/role change. Post-hoc classification (not classified when it landed 2026-09-29) | **Accepted (re-freeze)** |
| 2026-10-12 | `15590e2` Strategic Brief families (`strategicBriefs`, `strategicBriefHistory`, `strategicBriefOverrides`) — **SAFE_NEW_DOMAIN_SECURITY_EXTENSION**: envelope = denormalized `organizationId` + `clientId` (same as other subcollections); ADMIN-only; CLIENT DENY; append-only history/overrides; no delete; version never decreases. Post-hoc classification | **Accepted (re-freeze)** |
| 2026-10-12 | `6aebe21` `aiComplete` ADMIN body `clientId` bound to token org via server ownership lookup before Admin SDK `aiRuns` persistence — **SPEC009_BLOCKER_FIX** | **Accepted (re-freeze)** |
| 2026-10-12 | `cd20acd` ownership lookup mandatory + fail-closed at `handleAiCompleteRequest`; dev route same verifier — **SPEC009_BLOCKER_FIX** | **Accepted (re-freeze)** |
| 2026-10-12 | `6e4c739` `setPosturaClaims` bound to caller token org; other-org target DENY; CLIENT ownership server-verified; fail-closed — **SPEC009_BLOCKER_FIX** (enforces existing "ADMIN siempre org-scoped" decision) | **Accepted (re-freeze)** |
| 2026-10-12 | Privileged backend contract: Admin SDK / Admin Auth paths must enforce tenant/role authority explicitly; Rules never protect them | **Frozen (re-freeze)** |
| 2026-10-12 | Security re-freeze: implementation `6e4c739`; frozen repository reference = re-freeze governance commit; old `9c351ef` superseded | **Frozen** |
