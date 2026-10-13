# T-010-604 — A31 SPEC-009 Security Boundary Preservation Evidence

- **Status:** `POSTURA_A31_FORMALLY_PROMOTED`
- **Class:** `GOVERNANCE_EVIDENCE`
- **Branch:** `spec/010-react-migration`
- **Authorization:** `AUTHORIZE_POSTURA_A31_FORMAL_PROMOTION`
- **Review:** `POSTURA_A31_POST_REFREEZE_SECURITY_REVIEW_COMPLETE` (authorization `AUTHORIZE_POSTURA_A31_POST_REFREEZE_SECURITY_REVIEW`)

| Field | Value |
|-------|-------|
| **A31 REVIEWED SHA** | `2f2a8ce787d575ed05e52c7813ed7a8448f70a3e` (current formal SPEC-009 re-freeze) |
| **A31 PASS BAR** | `SPEC009_SECURITY_BOUNDARY_PRESERVED_AND_REFROZEN` |
| **A31 OWNER** | SPEC-009 security boundary |
| **PROMOTION STATUS** | **FORMALLY PROMOTED BY THIS GOVERNANCE RECORD** |
| Promotion documentation commit | the later commit that adds this file (documentation only; it is **not** the reviewed security SHA) |
| Deployment required for A31 | **NO** — production deployment is a separate CUTOVER-E concern (**NOT_EXECUTED**) |

This record does **not** authorize T-010-604, A44, CODE_COMPLETE, CUTOVER-E or any production action.
It does **not** modify Product / Runtime / React / tests / rules / Functions / server / SPEC-009.

---

## 1. Criterion and pass bar

**A31 (`acceptance.md`, literal, unchanged):** SPEC-009 security boundary preserved — auth, tenant isolation, rules contracts unchanged.

| Field | Value |
|-------|-------|
| Previous state | ⏳ PENDING — "rules 91/91 unchanged, but no security review performed in Phase 1" |
| New state | ✅ PASS |
| Pass bar | `SPEC009_SECURITY_BOUNDARY_PRESERVED_AND_REFROZEN` |

**Pass bar meaning:** the SPEC-009 formal re-freeze is valid; security invariants are preserved or strengthened; every post-freeze rules/security change is explicitly classified; no current cross-tenant or role bypass is known in the reviewed privileged paths; the rules contract is the formally reaccepted SPEC-009 contract (Human Option B); rules and security suites are green; deployment remains separate.

**Truthful statement on "rules contracts unchanged":** `firestore.rules` **did change** after the original SPEC-009 freeze `9c351ef` (+32 / −4 lines, only in `4bda325` and `15590e2`). The rules are **not** byte-for-byte unchanged. The changes were not hidden: they were formally classified, revalidated (106/106) and reaccepted under Human Option B, and a new formal SPEC-009 freeze was established. The rules contract A31 requires to be unchanged is the **reaccepted SPEC-009 contract** at the current re-freeze; the criterion wording is not rewritten.

**Acceptance definition weakening = 0.** The criterion text is preserved verbatim; Option B satisfies it by explicit reacceptance, not by waiver or reinterpretation.

---

## 2. Freeze identity

| Identity | SHA | Meaning |
|----------|-----|---------|
| Old SPEC-009 freeze | `9c351ef7ac6fafdbce8ff8b8eb5a5678e2ceae99` (2026-08-23 09:43:28 −0500, `chore(security): declare SPEC-009 code complete`) | Valid when created (91/91 rules, CODE_COMPLETE, not deployed). Later security/rule evolution made it **stale**. Status **SUPERSEDED_BY_FORMAL_REFREEZE** |
| Security implementation SHA | `6e4c739a390a54a9fd2ae2a807d56a9d971f11fb` (`fix(auth): bind claim assignment to trusted organization`) | Last security code change; all re-freeze gates ran against it |
| Current formal SPEC-009 re-freeze | `2f2a8ce787d575ed05e52c7813ed7a8448f70a3e` (`docs(spec009): re-freeze security boundary for A31`) | Child of `6e4c739`; changes only the four SPEC-009 governance Markdown files. Identifies itself as "the commit introducing this addendum"; unique subject in Git history, so unambiguous |

Option B formally reaccepted the evolved security state; the current re-freeze supersedes the old freeze (`specs/009-security-hardening/acceptance.md` § Security re-freeze / reacceptance).

---

## 3. Human Option B

`A31_RULE_CONTRACT_DECISION = OPTION_B`

- Post-freeze changes were explicitly classified and reaccepted.
- The acceptance criterion was **not** waived.
- The rules were **not** falsely described as literally unchanged.
- Full security gates were rerun and a new freeze reference was recorded.

---

## 4. Classified post-freeze changes

**POST-HOC FORMAL CLASSIFICATION DURING A31 / SPEC-009 RE-FREEZE** — `4bda325` and `15590e2` were not classified under SPEC-009 when they landed.

| Commit | Subject | Classification | Security effect |
|--------|---------|----------------|-----------------|
| `4bda3256d31794b8785af922e0333d663a3f3f55` | `fix(firestore): preserve createdAt on updates` | `HARDENING_COMPATIBLE` | `createdAt` write-once on every UPDATE. Security weakened NO · tenant/role authority changed NO · existing access expanded NO · restriction increased YES. +7 rules tests |
| `15590e2f53c1124fd2437a01905ffb85843569f6` | `feat(briefs): persist Strategic Briefs, history and overrides to Firestore` | `SAFE_NEW_DOMAIN_SECURITY_EXTENSION` | `strategicBriefs` / `strategicBriefHistory` / `strategicBriefOverrides` (previously default-deny). ADMIN-only on envelope; CLIENT DENY; cross-org DENY. Pre-existing family permissions weakened NO · tenant/role model changed NO. +8 rules tests |
| `6aebe2136ab199910fb27e359fc9db6fbe60c529` | `fix(ai): bind admin client to trusted organization` | `SPEC009_BLOCKER_FIX` | Closes ADMIN body `clientId` ownership defect before Admin SDK `aiRuns` persistence in `aiComplete` |
| `cd20acdeba3c40641d4b095aa2a601427a760241` | `fix(ai): require client organization binding for aiComplete` | `SPEC009_BLOCKER_FIX` | Ownership verifier mandatory / fail-closed at every handler call site, including the dev route |
| `6e4c739a390a54a9fd2ae2a807d56a9d971f11fb` | `fix(auth): bind claim assignment to trusted organization` | `SPEC009_BLOCKER_FIX` | Closes `setPosturaClaims` cross-organization privilege escalation |

---

## 5. Other reviewed post-freeze Functions/server commits

These are **not** part of the five formal re-freeze classifications. The A31 review found they do not modify SPEC-009 auth/tenant security artifacts or weaken the security boundary.

| Commit | Subject | Disposition |
|--------|---------|-------------|
| `0179bb5` | `feat(ai): complete SPEC-005 phase 2 provider infrastructure` | `aiComplete` stack, owned outside original SPEC-009 acceptance (SPEC-005); later defects closed by classified blocker fixes |
| `60103eb` | `feat(ai): complete SPEC-005 phase 3 resilience` | Same (`aiComplete` stack / SPEC-005) |
| `31cb61d` | `feat(ai): migrate CONTENT_DRAFT to server gateway` | Same (`aiComplete` stack incl. dev route / SPEC-005) |
| `3085032` | `refactor(scoring): migrate strategic scoring consumers` | Ingestion scoring removal from `scheduledIngest.ts`; tenant-envelope derivation (`requireTenantOrganizationId`, `requireMatchingClientId`) unchanged |
| `e25500c` | `fix(sources): strip entity-escaped markup from RSS text` | RSS text sanitization; security boundary unchanged |

**Core auth artifact stability:** `functions/src/lib/httpAuth.ts`, `functions/src/lib/tenantEnvelope.ts`, `functions/src/lib/posturaClaims.ts` — **0 changed lines** between `9c351ef` and `2f2a8ce`.

---

## 6. `aiComplete` security (current)

| Invariant | Value |
|-----------|-------|
| Organization authority | verified auth token |
| Body `clientId` | untrusted candidate |
| Client ownership | server-side verified (`clients/{clientId}.organizationId`) |
| Lookup | mandatory |
| Missing lookup | fail closed |
| Cross-org client | DENIED |
| Nonexistent client | DENIED |
| Same-org client | ALLOWED |
| CLIENT role | claim-bound |
| Development route (`server/aiGatewayDevRoute.ts`) | same protection |
| Invalid gateway calls | 0 |
| Invalid persistence calls | 0 |

Evidence: `src/interfaces/ai/handleAiCompleteRequest.ts` (binding verified before `gateway.execute`); `tests/aiCompleteClientOrgBinding.test.ts`.

---

## 7. `setPosturaClaims` security (current)

| Invariant | Value |
|-----------|-------|
| Caller | authenticated ADMIN |
| ADMIN scope | organization-scoped |
| Platform admin | ABSENT |
| Trusted organization | caller token |
| Body organization authority | NONE |
| Existing target bound to another organization | DENIED |
| Self cross-org escalation | DENIED |
| Target cross-org reassignment | DENIED |
| CLIENT ownership | server-verified |
| Lookup failures | fail closed |
| Invalid `setCustomUserClaims` calls | 0 |

Evidence: `functions/src/lib/assignPosturaClaims.ts`, `functions/src/index.ts`; `tests/assignPosturaClaims.test.ts`.

---

## 8. Firestore rules security

| Invariant | Value |
|-----------|-------|
| Organization isolation | preserved |
| Client isolation | preserved |
| Trusted envelopes | preserved |
| ADMIN / CLIENT separation | preserved |
| Cross-org access | denied |
| `createdAt` | write-once / preserved |
| Strategic Brief families | tenant protected |
| History / overrides | immutable / append-only as accepted |
| Delete | denied where designed |

No rules modification by this promotion.

---

## 9. Privileged backend contract

Admin SDK and Admin Auth **bypass** Firestore Rules. Server-side authorization is therefore independently required on every privileged path.

| Path | Status |
|------|--------|
| `aiComplete` | secured |
| `setPosturaClaims` | secured |
| `rssProxy` | ADMIN-only / no Firestore business write |
| `tavilySearch` | ADMIN-only / no Firestore business write |
| `youtubeApi` | ADMIN-only / no Firestore business write |
| `topicAgentRun` | no business persistence (echo) |
| `ingestSourcesScheduled` | server-derived tenant context |
| `ingestSourcesManual` | server-derived tenant context |

**KNOWN A31 SECURITY DEFECTS = NONE** as of `2f2a8ce787d575ed05e52c7813ed7a8448f70a3e`, based on the bounded A31 review of the paths above. This is not a claim of global absence of every possible future vulnerability.

---

## 10. Nonblocking debt and notes

**`ingestSourcesManual` (NONBLOCKING A31 debt):** any organization ADMIN can currently trigger global manual ingestion; the response returns aggregate counters (e.g. `clientsScanned`) that may span tenants, which may disclose limited metadata/counts or create cost. Under current reviewed behavior it does **not** grant direct authority to write another tenant's data or expose tenant content.

| Field | Value |
|-------|-------|
| A31 blocker | NO |
| Follow-up security/hardening debt | YES (not fixed here) |

**Historical inventory note:** `specs/009-security-hardening/inventory.md` still contains historical language about default organization behavior for `setPosturaClaims`. HISTORICAL INVENTORY NOTE · A31 blocker NO · SPEC-009 not modified by this promotion.

---

## 11. Validation evidence

| Gate | Result | Provenance |
|------|--------|------------|
| `npm run test:rules` | **106/106 PASS** (91 original + 7 `createdAt` hardening + 8 Strategic Brief families; rules test file +217 / −0 lines since `9c351ef`, no original coverage removed) | fresh, A31 review @ `2f2a8ce` (emulator `demo-aurora-e2e`) |
| Targeted security | **2 files · 25/25 PASS** (`tests/aiCompleteClientOrgBinding.test.ts`, `tests/assignPosturaClaims.test.ts`) | fresh, A31 review @ `2f2a8ce` |
| Full security suite | **40 files · 880/880 PASS** | fresh, A31 review @ `2f2a8ce` (also PASS @ `6e4c739` pre-re-freeze) |
| `npm run check` | **241 files · 3278/3278 PASS · 0 lint errors** | reused, immediately pre-re-freeze @ `6e4c739`; the only later commit changed Markdown-only SPEC-009 governance files |
| `npm run build` | **PASS** · production `window.__posturaUi` = 0 | reused, same provenance |
| Full emulator E2E | **91/91 PASS** (accepted final) — run 1 = 90/91, run 2 = 90/91, run 3 = 91/91; the only failing test in runs 1–2 was `t010508` | reused, pre-re-freeze |
| `secret:scan` | `rotation_required_overall=NO` · 5 sanitized findings (accepted state) | reused, pre-re-freeze |

**`t010508`** ("mid-journey rollback leaves stable business storage unchanged") — timing race between the localStorage snapshot and Brief cache hydration.

| Field | Value |
|-------|-------|
| Security relevance | NO |
| A31 blocker | NO |
| T604 reliability debt | YES (instability recorded; test not modified) |

---

## 12. Production and cutover separation

| Item | Value |
|------|-------|
| Claims code security | FIXED (`6e4c739`) |
| Production user claims audit / reprovision | PENDING — A31 blocker NO · CUTOVER-E blocker YES |
| Deployment required for A31 | NO |
| Production deployment | NOT_EXECUTED |

A31 is security-boundary preservation acceptance, not production go-live. Production still serves the pilot-era rules.

**Outside A31 promotion — CUTOVER-E blockers as applicable:** production claims audit/reprovision · token refresh · envelope dry-run/backfill if required · Blaze/billing confirmation · APIs · managed export/backup · secrets · Storage · production rule deploy · `aiComplete` Functions deploy · Hosting deploy · post-deploy canaries.

---

## 13. Promotion effect

| Field | Before | After |
|-------|--------|-------|
| A31 | ⏳ PENDING | ✅ PASS |
| A25 | ✅ PASS | ✅ PASS (unchanged) |
| A44 | ⏳ PENDING | ⏳ PENDING (unchanged; `T604_SUCCESS_EVIDENCE_SATISFIES_A44`) |
| A1–A44 tally | 42 PASS · 0 PARTIAL · 0 FAIL · 2 PENDING | 43 PASS · 0 PARTIAL · 0 FAIL · 1 PENDING |
| Remaining PENDING | A31 · A44 | A44 |
| T604 | NOT_AUTHORIZED | NOT_AUTHORIZED |
| GLOBAL C3 | PARTIAL | PARTIAL (not required for T604) |

**Next governance unit:** FINAL PRE-T604 PREREQUISITE VERIFICATION (read-only first).
