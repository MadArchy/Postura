# Acceptance 010 — React migration

**Phase 0:** **COMPLETE** · Human SPEC approval **APPROVED** (T-010-010, 2026-08-26 America/Bogota)
**Phase 1:** **COMPLETE** — React foundation, shell, strangler seams, query/command boundaries, E2E foundation
**Phase 2:** **COMPLETE** — 9 bounded components, read seams, canonical commands
**Phase 3:** **COMPLETE** — 5 pages migrated (all HYBRID), 34 blocked writes registered
**Phase 4:** **FORMALLY_ACCEPTED** (T-010-401…405 · A39 reconciled · `t-010-phase4-formal-closure.md`)
**Phase 5:** **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** (T-010-501…510 · `t-010-phase5-formal-closure.md`)
**Phase 6:** **PRE_REMOVAL_GATES_COMPLETE** (T-010-601…602 · `t-010-phase6-pre-removal-gates.md`) · T-603 **FORMALLY_CLOSED** (`t-010-603-global-closure.md`) · T-604 **NOT AUTHORIZED**
**A1-A44:** **39 PASS** · **2 PARTIAL** · **0 FAIL** · **3 PENDING** (T-601 reconciled · A43 PASS · W2 promoted 30 W1-verified stale PARTIAL rows · A10/A41 remain PARTIAL · A25/A31/A44 PENDING)
**CODE_COMPLETE:** **NO**
**DEPLOYED:** **NO** · **DONE:** **NO** · **DEPLOYMENT:** **NOT_STARTED**

Spec **APPROVED** — T-010-010 human SPEC approval **RECORDED**.
Spec **CODE_COMPLETE** requires Required (A\*) full PASS + human sign-off (T-010-604) — **NOT STARTED**.

**Human SPEC approval model:** TASK-LEVEL only (T-010-010).
**Human CODE_COMPLETE model:** TASK-LEVEL only (T-010-604).
**Baseline:** SPEC-008 CODE_COMPLETE final freeze `642ae9390700a254fa390ba09a959bab3c37d616`
**Branch:** `spec/010-react-migration`

**Acceptance count = 44.** Derived from the functional, security and migration requirements in `spec.md`
and the boundary rules in `ui-architecture.md` / `hexagonal-boundaries.md`. The count is **not** chosen for
symmetry with other SPECs.

Only criteria provable by Phase-0 governance evidence are marked PASS. Everything requiring
implementation is **PENDING** — no implementation is authorized.

---

## Required (implementation → CODE_COMPLETE)

| # | Criterion | Phase | Status | Evidence target |
|---|-----------|-------|--------|-----------------|
Status legend — ✅ **PASS** fully evidenced · ⚠️ **PARTIAL** evidenced for the foundation/wave-1 scope,
open for later waves or Phase-5 adversarial proof · ⏳ **PENDING** no evidence yet.

`ARCH` = `tests/reactMigrationPhase1Architecture.test.ts` (27/27 PASS) ·
`E2E` = `e2e/strangler-foundation.spec.ts` (5/5 PASS).

| # | Criterion | Phase | Status | Evidence |
|---|-----------|-------|--------|----------|
| A1 | Constitutional purpose documented as incremental React strangler UI migration | 0 | ✅ PASS | `spec.md` + §23/§24/§25/§26 |
| A2 | Target stack exact — React · TypeScript · Vite · TanStack Query · React Hook Form · Zod (+ Playwright E2E); no substitution | 0–1 | ✅ PASS | T-010-101: exact stack installed, versions recorded, no substitution, Vite not upgraded; build PASS |
| A3 | Big-bang rewrite prohibited; strangler is the only sanctioned strategy | 0–1 | ✅ PASS | §25 + coexisting implementations behind the toggle; legacy untouched and still served |
| A4 | Constitutional §24 seven-step order preserved verbatim and mapped to phases | 0–1 | ✅ PASS | `ui-architecture.md` § phase mapping — all 7 steps mapped, order preserved |
| A5 | Behavior preserved before architecture improved; business logic not rewritten to suit UI | 1–6 | ✅ PASS | W1/W2 stale-status promotion: E2E rollback + 0 business-logic rewrite preserved; T-508 21/21; T603 nine-leaf closure `0adb5868` / `t-010-603-global-closure.md` — no domain rewrite for UI |
| A6 | UI authority = presentation/intent only; UI write authority remains 0 | 1–6 | ✅ PASS | W1/W2: ARCH + T-010-503 — React UI write authority 0 (no lifecycle/persistence writes in React UI scope) |
| A7 | SPEC-010 owns no business-domain aggregate and adds no business lifecycle | 0–1 | ✅ PASS | No `domain-model.md`; no lifecycle added by Phase 1 |
| A8 | React modules import `dbService` directly: **0** | 2–6 | ✅ PASS | W1/W2: ARCH/T-010-503 — React UI `dbService` importers = only `compatibilityReads.ts` (legacy handlers excluded from React UI scope by T-010-404) |
| A9 | Canonical read boundary — every React read goes through a query hook → facade/consumer → Application | 1–6 | ✅ PASS | W1/W2: hooks declare one read source in cache keys; canonicalReads/consumers; Phase-2/3 ARCH + T-010-502 |
| A10 | Canonical command boundary — React intent → consumer/Application → Domain → Ports → Infrastructure | 1–6 | ⚠️ PARTIAL | `commandSeam.ts` delegates to trusted auth; `ARCH` proves no direct persistence. Strategic commands pending |
| A11 | TanStack Query cache is non-authoritative; no strategic decision from cached data | 2–6 | ✅ PASS | W1/W2: ARCH staleTime:0/retry:0 + T-010-502 cache adversarial PASS — cache non-authoritative |
| A12 | React local/presentation state non-authoritative | 2–6 | ✅ PASS | W1/W2: presentation state tab/filter/UI only; no strategic authority from local React state (Phase-1–4 ARCH) |
| A13 | Form state non-authoritative; Zod UI validation never bypasses Domain gates | 2–6 | ✅ PASS | W1/W2: Zod shape-only on ReactLogin/ReactOnboardingWizard; Domain/trusted auth decide — T-010-501 PASS |
| A14 | Optimistic UI state non-authoritative; failure reconciles to canonical state | 2–6 | ✅ PASS | W1/W2: 0 optimistic mutations / 0 setQueryData authority in React UI (ARCH + T-010-502) |
| A15 | Stale cached aggregate never used as mutation authority; caller snapshot authority 0 | 2–6 | ✅ PASS | W1/W2: commands carry ids not cached aggregates — T-010-502 PASS |
| A16 | Trusted tenant — React cannot establish `organizationId`/`clientId`; caller tenant authority 0 | 1–6 | ✅ PASS | W1/W2: TrustedTenantScope branded; caller tenant authority 0 — T-010-501 PASS |
| A17 | Trusted actor — React cannot establish `actorUid`/`actorType`/role/HUMAN; caller actor authority 0 | 1–6 | ✅ PASS | W1/W2: session projection setter-free; 0 actor literals in React UI — T-010-501 PASS |
| A18 | Caller role authority 0 — no admin/manager escalation from UI | 1–6 | ✅ PASS | W1/W2: 0 role escalation assignments in React UI — T-010-501 PASS |
| A19 | Tenant-safe query keys — every key carries trusted tenant scope; no cross-tenant cache bleed | 2–6 | ✅ PASS | W1/W2: tenant-scoped query keys; cross-tenant bleed 0 — T-010-502 PASS |
| A20 | Multi-thesis native — no authoritative `theses[0]`/`primaryThesisId`/`getPrimaryThesis`/score winner | 2–6 | ✅ PASS | W1/W2: no authoritative theses[0]/primaryThesisId/getPrimaryThesis — T-010-507 PASS |
| A21 | Presentation defaults explicitly non-authoritative; command carries a confirmed, revalidated id | 2–6 | ✅ PASS | W1/W2: non-authoritative presentation defaults; confirmed ids on commands — T-010-507 + P4C |
| A22 | SPEC-001 preserved — React displays routing, owns no routing decision | 2–6 | ✅ PASS | W1/W2: React displays routingState only; 0 routing authority — T-010-505 PASS |
| A23 | SPEC-002 preserved — no scoring formula recreated in components/hooks | 2–6 | ✅ PASS | W1/W2: 0 scoring formulas / weight arithmetic in React UI/controllers — T-010-505 PASS |
| A24 | SPEC-003 preserved — Brief consumed via canonical consumer; no lifecycle duplication | 2–6 | ✅ PASS | W1/W2: Brief via strategicBriefConsumer; CR-2 COMPLETE/FROZEN; no Brief lifecycle duplication in React |
| A25 | SPEC-004 preserved — Plan/PlanItem via canonical Application boundary | 2–6 | ⏳ PENDING | no migrated React surface exposes a plan command |
| A26 | SPEC-005 preserved — direct AI provider access from React: **0** | 1–6 | ✅ PASS | W1/W2: 0 AI provider imports/endpoints in React UI — ARCH + T-010-503 |
| A27 | SPEC-006 preserved — React never verifies claims or authorizes publication | 2–6 | ✅ PASS | W1/W2: claim verdict display-only; 0 publication/verify authority in React — ARCH3 + T-010-505 |
| A28 | SPEC-007 preserved — no recreation of OpportunityScore / lifecycle / Materialize | 2–6 | ✅ PASS | W1/W2: Opportunity via canonical consumer only; 0 score/lifecycle/materialize recreation — ARCH |
| A29 | SPEC-008 preserved — no auto-approve, no auto-apply, no `feedbackScoringHints`, no auto-rescore | 2–6 | ✅ PASS | W1/W2: 0 auto-approve / auto-apply / feedbackScoringHints / auto-rescore — T-010-504 PASS |
| A30 | SPEC010→SPEC008 mutation authority = **0** | 2–6 | ✅ PASS | W1/W2: SPEC010→SPEC008 mutation authority 0 via registerSignalOutcomeIntent trusted context — T-010-504 |
| A31 | SPEC-009 security boundary preserved — auth, tenant isolation, rules contracts unchanged | 1–6 | ⏳ PENDING | rules 91/91 unchanged, but no security review performed in Phase 1 |
| A32 | React → canonical store (`Local*Store`) direct write: **0** | 2–6 | ✅ PASS | W1/W2: 0 Local*Store imports in React UI — ARCH + T-010-503 |
| A33 | React → Firestore direct write: **0** | 2–6 | ✅ PASS | W1/W2: 0 Firebase/Firestore imports in React UI — ARCH + T-010-503 |
| A34 | No business logic in hooks — no duplicated scoring/routing/lifecycle/approval logic | 2–6 | ✅ PASS | W1/W2: 0 scoring/routing/lifecycle/approval duplication in hooks/controllers — T-010-505 PASS |
| A35 | No dual command authority — legacy and React invoke the same canonical command | 2–6 | ✅ PASS | W1/W2: single command seam; React/legacy invoke same canonical commands — T-010-506 PASS |
| A36 | No dual read authority — one declared read source per module | 2–6 | ✅ PASS | W1/W2: one declared read source per hook (in cache key) — ARCH + T-010-506 |
| A37 | Single auth/session authority; React Context projects only | 1–6 | ✅ PASS | W1/W2: single auth/session projection; setter-free Context — T-010-506 PASS |
| A38 | No competing DOM/CSS ownership of a subtree | 1–6 | ✅ PASS | `ARCH` + `E2E`: sibling containers, exclusive owners, never both visible, no cross-nesting, CSS scoped to the two ids, clean unmount |
| A39 | `main.ts` strangler — ceases to be a controller/event bus; shrinks per wave | 1–4 | ✅ PASS | T-010-404: `main.ts` **15-line** bootstrap (4,473 → 15); **0** business imports, **0** shell authority, **0** navigation authority, **0** business orchestration. Feature wiring in **18** handler modules + presentation controllers; `LegacyApp.ts` (**639** lines) is a compatibility host only. `t010404MainBootstrapReduction.test.ts` **9/9**; Stage-B Playwright **11/11**. Deferred CR-1 writes remain in legacy handlers by design |
| A40 | Component migration matrix complete — a row per UI file, dispositioned | 0 | ✅ PASS | `migration-matrix.md` (17 files) |
| A41 | Behavioral parity proven per migrated module across all applicable dimensions | 5 | ⚠️ PARTIAL | Page-level evidence for 12 of 18 dimensions per migrated page; dimensions whose legacy command stays outside React are classified, not claimed. **0** modules cut over — cutover parity is Phase 5 |
| A42 | E2E/parity harness (Playwright) implemented; legacy-vs-React journeys pass | 5 | ✅ PASS | W1/W2: Playwright harness + legacy-vs-React journeys — T-508 + Stage-B **21/21 PASS** (Planner excluded by governed MVP) |
| A43 | Legacy removed only after parity gate; rollback exercised without data migration | 6 | ✅ PASS | Global T-010-603 formally closed under scope decision **A** (`t-010-603-global-closure.md`): **9/9** bounded legacy leaves removed and formally accepted (DOSSIER · OPPORTUNITY · KPI · CLIENTPROFILE · PROOFWALL · CLAIMSAFETY · PAGEHEADER · SOURCEREGISTRY · ONBOARDING); governed Product graph **ZERO**; C6/C7/safe-subset complete; family A38 **PASS**; blocking debt **NONE**; Option E + T-508 rollback retained; broader non-leaf hosts remain outside T-603 |
| A44 | Full check + rules regression at CODE_COMPLETE; no unintended regression | 6 | ⏳ PENDING | **T602 REGRESSION_GATE_PASS** @ 1965/1965 · 91/91 · BUILD · 73/73 · 21/21. **A44 formal PASS** requires CODE_COMPLETE Required A* + T-604 |

**Acceptance count:** **44** (A1–A44) — unchanged.

| Milestone | PASS | PARTIAL | FAIL | PENDING |
|-----------|------|---------|------|---------|
| Phase 0 exit | 6 | 0 | 0 | 38 |
| Phase 1 exit | 7 | 24 | 0 | 13 |
| Phase 2 exit | 7 | 26 | 0 | 11 |
| Phase 3 exit | 7 | 33 | 0 | 4 |
| **Phase 4 exit** | **8** | **33** | **0** | **3** |

### Row/summary reconciliation (governance finding, documentation-only)

Recorded rather than silently fixed, because Phase 3 already logged a tally-drift
defect and this is the same class.

At the Phase-3 checkpoint the summary line read **7 PASS / 33 PARTIAL / 0 FAIL /
4 PENDING**, but the criteria table itself still showed **7 / 25 / 0 / 12**. Nine
rows — A21, A22, A23, A24, A27, A28, A29, A30, A41 — were evidenced as PARTIAL in
the Phase-3 movement section while their table rows still read `⏳ PENDING` with
placeholder evidence ("boundary tests"). The evidence was real; the table was not
updated to match it.

Phase 4 updated those nine rows to the verdicts their recorded evidence already
supported, and advanced A39 on its own Phase-4 evidence. Table and summary now
agree at **7 / 34 / 0 / 3**, verified mechanically by
`scripts/acceptanceTally.mjs` and asserted by the Phase-4 architecture suite, so
the two cannot drift apart again.

Severity **P3**, documentation defect, no code impact. The distinction worth
keeping: in Phase 3 the *rows* were authoritative and the summary had drifted; here
the rows were stale and the movement sections held the evidence. Neither is
automatically the source of truth — the evidence is.

### Phase-4 acceptance movement (T-010-401, 402, 405)

`ARCH4` = `tests/reactMigrationPhase4Architecture.test.ts` (28/28) ·
`P4` = `tests/reactMigrationPhase4Controllers.test.ts` (26/26) ·
`E2E4` = `e2e/phase4-controller-strangler.spec.ts` (6/6) ·
`AUDIT` = `main-controller-audit.md`.

**One criterion advanced: A39, from PENDING to PARTIAL.** It is the criterion this
phase owns, and it advances to PARTIAL rather than PASS because the controller has
not yet ceased to be an event bus — its method and handler counts are unchanged.

| # | Was | Now | Why |
|---|-----|-----|-----|
| **A39** | ⏳ PENDING | ⚠️ PARTIAL | The first responsibilities actually left `main.ts`: presentation state, toasts, modal dispatch and navigation rules, into four modules that import no service, no `dbService`, no Application and no domain module (`ARCH4`). 5,138 → **5,041** lines; named component imports **28 → 11**. `P4` proves behavioural equivalence per responsibility and `E2E4` proves the shell still boots through the extracted orchestration. Not PASS: 25 business-write methods and all 158 handler sites remain, so it is still a controller. T-010-403/404 are blocked on CR-1 |

Criteria that stayed PARTIAL but gained materially stronger evidence:

| # | Phase-4 evidence |
|---|------------------|
| A5 | `AUDIT` classifies all 86 material side-effecting controller paths (80 `GATE_FIRST`, 6 `EFFECT_FIRST`, **0 `UNKNOWN`**) and proves **0** effects run at bind time or render time. Behaviour was preserved in the awkward places too: `P4` asserts the four filters that reset on client entry *and* the four that deliberately do not |
| A8 | `ARCH4` re-asserts after the extraction that the React `dbService` importer list is exactly `compatibilityReads.ts`, that the facade exposes 0 mutators, and that no extracted controller writes through `dbService` |
| A34 | `ARCH4` extends the ban to the new surface: no extracted controller defines a score function, weight arithmetic, a routing assignment, a canonical-status assignment, or imports a domain module. `A34`'s scope is now `src/ui/**` *and* `src/controllers/**` |
| A35 | `ARCH4` + `E2E4`: exactly one presentation root visible, and the toast sink is a body-level sibling nested inside neither root |
| A38 | `E2E4` proves toggle and rollback still work after the extraction with business storage byte-identical |

Criteria deliberately **not** advanced:

| # | Why not |
|---|---------|
| A21–A30 | Phase 4 migrated no command and no read, so no cross-SPEC surface changed. A24 gained analysis (the SPEC-003 signature CR) but no new evidence of *consumption* |
| A25 | SPEC-004 still has no migrated React surface |
| A31 | No security review was performed; that is Phase 5 |
| A41 | No new parity dimension was closed — no page cut over |
| A43 | No legacy was removed, by design (§19) |
| A44 | CODE_COMPLETE regression is Phase 6 |

### Phase-4C acceptance movement (local security remediation)

`P4C` = `tests/reactMigrationPhase4cSecurity.test.ts` (33/33).

**No criterion advanced category, and none advanced to PASS.** Phase 4C migrated
nothing and canonicalized nothing, so no acceptance criterion about migration
coverage could move. Four criteria gained materially stronger evidence, all
about trusted identity:

| # | Phase-4C evidence |
|---|------------------|
| A5 | `EFFECT_FIRST` across all 157 handlers is **0**, down from 6, re-measured by the script that produced the finding. Six user-triggered effect paths gate before the effect; three adjacent sites were gated in the same pass so that no twin was left ungated. Behaviour preserved: the legitimate flows still reach the same effects with the same arguments |
| A16 | Trusted tenant hardened where it was weakest — the legacy controller. `P4C` proves a `CLIENT` actor cannot propose another tenant, an `ADMIN` actor cannot reach outside its own organization, an unknown client is refused, and the grant's `organizationId` always comes from the session and never from the client record. Caller tenant authority is now 0 on these paths adversarially rather than by inspection: a DOM-injected client id cannot redirect an effect |
| A17 | Trusted actor — the tenant-less admin sync utility gates on the session role instead of on whether its button was rendered. `P4C` proves a `CLIENT` actor and a sessionless caller are both refused |
| A18 | Caller role authority 0 — role is read from the trusted session in the gate; button visibility, `disabled` and `hidden` are proven not to serve as authorization |
| A21 | The display-default / business-authority split made explicit. `P4C` proves `resolveClientId` no longer resolves a tenant by array position, that a client session without a trusted `clientId` renders no portal at all, that the ingest scheduler skips a tick rather than picking the first client, and that the single remaining `getClients()[0]` is confined to the display-only `displayClientId()` |

Criteria deliberately **not** advanced: everything about migration coverage
(A21–A30, A39, A41, A43), because gating a legacy write does not migrate it.
A39 in particular stays PARTIAL — `main.ts` grew by 89 lines, since fail-closed
gates cost lines, and §17 forbids treating line count as acceptance either way.

### Phase-4 formal closure (T-010-403, 404, hygiene + A39 reconciliation)

`T404` = `tests/t010404MainBootstrapReduction.test.ts` (9/9) ·
`E2E403` = `e2e/t010403-stage-b-seam.spec.ts` (11/11, Chrome channel) ·
closure record = `t-010-phase4-formal-closure.md`.

**One criterion advanced: A39, from PARTIAL to PASS.** T-010-404 reduced `main.ts`
to a **15-line** bootstrap/composition entrypoint. Event wiring and legacy
presentation moved to **18** feature-local handler modules plus presentation
controllers; `LegacyApp.ts` (**639** lines) is a compatibility/coordination host,
not a relocated monolith. The read-only Phase-4 closure review found a dirty
working tree (30 paths); hygiene reconciliation proved **0** semantic deltas vs
`6257877` (29 line-ending-only, 1 whitespace-only indent in `LegacyApp.ts`).

| # | Was | Now | Why |
|---|-----|-----|-----|
| **A39** | ⚠️ PARTIAL | ✅ **PASS** | `main.ts` ceased to be a controller/event bus: **0** `addEventListener`, **0** `dbService`, **0** Consumer/Application/domain imports, **0** shell or navigation authority. Handler sites remain legacy by design (deferred CR-1), but they no longer live in `main.ts`. `T404` + `E2E403` prove bootstrap purity and Stage-B invariants |

Criteria deliberately **not** advanced at closure: A21–A30, A41, A43, A44 (Phase 5–6 scope); **T-010-20** stays PARTIAL (display-only scoring in React — **NON_BLOCKER**).

**SPEC-010 Phase 4:** **FORMALLY_ACCEPTED** · Phase 5 authorization **NO** · Phase 5 readiness **READY_FOR_AUTHORIZATION_REVIEW**

### Phase-5 formal closure (T-010-501…510)

Closure record: `t-010-phase5-formal-closure.md` · implementation evidence: `t-010-phase5-regression-parity-security-e2e.md`.

| Task | Verdict |
|------|---------|
| T-010-501…508, T-010-510 | **PASS** |
| T-010-509 | **PARTIAL** — static/architectural a11y + perf evidence only; **no runtime a11y audit tooling** (**NONBLOCKING_DEBT**) |

Threat ledger: **23 PASS · 3 PARTIAL · 0 FAIL** (T-010-20, 25, 26 governed debt preserved).

Playwright stability at closure: rollback **5/5** · T508 suite **3/3** · Stage-B+T508 **2/2** · final **21/21 PASS**.

**SPEC-010 Phase 5:** **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** · Phase 6 **PRE_REMOVAL_GATES_COMPLETE** · next **`SPEC010_T603_SUBSET_REMOVAL_AUTHORIZATION_REVIEW`**

### Phase-6 pre-removal gates (T-010-601…602)

Evidence: `t-010-phase6-pre-removal-gates.md` · `t-010-phase6-a1-a44-reconciliation.md`

| Task | Verdict |
|------|---------|
| T-010-601 | **COMPLETE** — 44/44 criteria reconciled; T603 inventory recorded; **0** false PASS promotions |
| T-010-602 | **COMPLETE** — `REGRESSION_GATE_PASS`; **A44 remains PENDING** (formal CODE_COMPLETE gate) |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |

**T603 manifest:** 5 future subset candidates (wave-2 leaves) · 12+ blocked · **FULL LEGACY DELETION READY = NO**

### Phase-6 T-010-603 dossier subset (bounded)

Evidence: `t-010-603-dossier-subset-removal.md` · implementation `564aa1f0064551e32a4850c524d5f0fec48d8f90`.

| Item | Verdict |
|------|---------|
| Dossier unit C1–C7 / C8 | **PASS / N/A** |
| `MasterDossierPanel.ts` | **ABSENT** (`REMOVE_AFTER_PARITY`) |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (this file only) |
| T-010-603 **global** | **OPEN** — not DONE |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

T-601 / T-602 snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 opportunity subset (bounded)

Evidence: `t-010-603-opportunity-subset-removal.md` · implementation `7b194545fa3054624bd63e5a1f2ee926d4ff651a`.

| Item | Verdict |
|------|---------|
| Opportunity unit C1–C7 / C8 | **PASS / N/A** |
| `OpportunityPanel.ts` | **ABSENT** (`REMOVE_AFTER_PARITY`) |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (this file only) |
| T-010-603 **global** | **OPEN** — not DONE |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

T-601 / T-602 / dossier subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 KPI weekly chart subset (bounded)

Evidence: `t-010-603-kpiweeklychart-subset-removal.md` · implementation `1ca331fb25a625a93f820ebefcc935eaba3d8ded`.

| Item | Verdict |
|------|---------|
| KPI unit C1–C7 / C8 | **PASS / N/A** |
| `KpiWeeklyChart.ts` | **ABSENT** (already removed @ `1ca331f`; no second delete) |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/KpiWeeklyChart.ts` only) |
| C6 / C7 | **VERIFIED PASS** / **ACCEPTED** |
| T-010-603 KPI unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| KPI unit A43 | **PASS** |
| T-010-603 **global** | **OPEN** — not DONE |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking handler / scanner / comment / E2E debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 ClientProfile subset (bounded)

Evidence: `t-010-603-clientprofile-subset-removal.md` · implementation `5b2a5ed50e715d266e3b2f44bfb6e28ce57f8899`.

| Item | Verdict |
|------|---------|
| ClientProfile unit C1–C7 / C8 | **PASS / N/A** |
| `ClientProfilePanel.ts` | **ABSENT** (already removed @ `5b2a5ed`; no second delete) |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/ClientProfilePanel.ts` only) |
| C6 / C7 | **VERIFIED_PASS** / **ACCEPTED** |
| T-010-603 ClientProfile unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| CLIENTPROFILE UNIT A43 | **PASS** |
| T-010-603 **global** | **OPEN** — not DONE |
| C3 **global** | **PARTIAL** |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking handler / comment / ProofWall / Onboarding / stale-path / visual debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity / KPI subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 ProofWall subset (bounded)

Evidence: `t-010-603-proofwall-subset-removal.md` · implementation `c7f4e3d4b3c6e43929ce5f04d2bf5e4c259cae61`.

| Item | Verdict |
|------|---------|
| ProofWall unit C1–C7 / C8 | **PASS / N/A** |
| `ProofWallPanel.ts` | **ABSENT** (already removed @ `c7f4e3d`; no second delete) |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/ProofWallPanel.ts` only) |
| C6 / C7 | **VERIFIED_PASS** / **ACCEPTED** |
| T-010-603 ProofWall unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| PROOFWALL LOCAL A43 | **PASS** |
| PROOFWALL UNIT A43 | **PASS** |
| T-010-603 **global** | **OPEN** — not DONE |
| C3 **global** | **PARTIAL** |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking handler / comment / remaining leftover-family debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity / KPI / ClientProfile subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 ClaimSafety subset (bounded)

Evidence: `t-010-603-claimsafety-subset-removal.md` · implementation `824e13b5e6b60fe18344b871dede048f37041de1`.

| Item | Verdict |
|------|---------|
| ClaimSafety unit C1–C7 / C8 | **PASS / N/A** |
| `ClaimSafetyPanel.ts` | **ABSENT** (already removed @ `824e13b`; no second delete) |
| PRODUCT GRAPH | **ZERO** |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/ClaimSafetyPanel.ts` only) |
| C6 / C7 | **VERIFIED_PASS** / **ACCEPTED** |
| T603 SAFE SUBSET REVIEW | `PHASE6_CLAIMSAFETY_T603_SAFE_SUBSET_VERIFIED` |
| T-010-603 ClaimSafety unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| CLAIMSAFETY LOCAL A43 | **PASS** |
| CLAIMSAFETY UNIT A43 | **PASS** |
| BLOCKING DEBT | **NONE** |
| NONBLOCKING DEBT | leftover `.claim-review-ack` CSS; comments; historical oracle titles; historical SPEC refs — **SEPARATED** |
| T-010-603 **global** | **OPEN** — not DONE |
| C3 **global** | **PARTIAL** |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking CSS / comment / historical-title / remaining leftover-family debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity / KPI / ClientProfile / ProofWall subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 PageHeader subset (bounded)

Evidence: `t-010-603-pageheader-subset-removal.md` · implementation `1a606a7a4c7d7de818d9818bd683ed20493b42ae`.

| Item | Verdict |
|------|---------|
| PageHeader unit C1–C7 / C8 | **PASS / N/A** |
| `PageHeader.ts` | **ABSENT** (already removed @ `1a606a7`; no second delete) |
| PRODUCT GRAPH | **ZERO** |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/PageHeader.ts` only) |
| C6 / C7 | **VERIFIED_PASS** / **ACCEPTED** |
| T603 SAFE SUBSET REVIEW | `PHASE6_PAGEHEADER_T603_SAFE_SUBSET_VERIFIED` |
| T-010-603 PageHeader unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| PAGEHEADER LOCAL A43 | **PASS** |
| PAGEHEADER UNIT A43 | **PASS** |
| BLOCKING DEBT | **NONE** |
| NONBLOCKING DEBT | unreachable leftover header-id binds; shared `.page-header*` CSS retained for React; comments; historical SPEC refs; remaining leftover families — **SEPARATED** |
| T-010-603 **global** | **OPEN** — not DONE |
| C3 **global** | **PARTIAL** |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking handler / CSS / comment / remaining leftover-family debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity / KPI / ClientProfile / ProofWall / ClaimSafety subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 SourceRegistry subset (bounded)

Evidence: `t-010-603-sourceregistry-subset-removal.md` · implementation `1441fe1e642c952950d08137d1c36ee57bc35a3a`.

| Item | Verdict |
|------|---------|
| SourceRegistry unit C1–C7 / C8 | **PASS / N/A** |
| `SourceRegistryModal.ts` | **ABSENT** (already removed @ `1441fe1`; no second delete) |
| PRODUCT GRAPH | **ZERO** |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/SourceRegistryModal.ts` only) |
| C6 / C7 | **VERIFIED_PASS** / **ACCEPTED** |
| T603 SAFE SUBSET REVIEW | `PHASE6_SOURCEREGISTRY_T603_SAFE_SUBSET_VERIFIED` |
| T-010-603 SourceRegistry unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| SOURCEREGISTRY LOCAL A43 | **PASS** |
| SOURCEREGISTRY UNIT A43 | **PASS** |
| BLOCKING DEBT | **NONE** |
| NONBLOCKING DEBT | unreachable `#btn-open-source-registry`; `.btn-open-agent-sources` with no live Product emitter; orphan `.source-suggestion-*` CSS; comments; negative-test text; Onboarding remains open — **SEPARATED** |
| T-010-603 **global** | **OPEN** — not DONE |
| C3 **global** | **PARTIAL** |
| A43 **global** | **PARTIAL** |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking handler / CSS / comment / remaining leftover-family debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity / KPI / ClientProfile / ProofWall / ClaimSafety / PageHeader subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 Onboarding subset (bounded)

Evidence: `t-010-603-onboarding-subset-removal.md` · implementation `8ba24a5ef4e03efe75e9e97e556a5f0f26eb8722`.

| Item | Verdict |
|------|---------|
| Onboarding unit C1–C7 / C8 | **PASS / N/A** |
| `OnboardingWizard.ts` | **ABSENT** (already removed @ `8ba24a5`; no second delete) |
| PRODUCT GRAPH | **ZERO** |
| SAFE SUBSET | `SAFE_LEGACY_SUBSET_REMOVED_AND_ACCEPTED` (`src/components/OnboardingWizard.ts` only) |
| C6 / C7 | **VERIFIED_PASS** / **ACCEPTED** |
| T603 SAFE SUBSET REVIEW | `PHASE6_ONBOARDING_T603_SAFE_SUBSET_VERIFIED` |
| T-010-603 Onboarding unit | **FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT** |
| ONBOARDING LOCAL A43 | **PASS** |
| ONBOARDING UNIT A43 | **PASS** |
| BLOCKING DEBT | **NONE** |
| NONBLOCKING DEBT | unreachable `#btn-open-onboarding`; leftover `activeModal='onboarding'` handler; historical docs/comments; absence-oracle path strings — **SEPARATED** |
| T-010-603 **global** | **DONE — FORMALLY_CLOSED** (see global closure section below) |
| C3 **global** | **PARTIAL** |
| A43 **global** | **PASS** (on global T-603 closure) |
| T-010-604 | **NOT_AUTHORIZED** |

Nonblocking handler / comment / absence-oracle debt remains **outside** the accepted subset and was **not** cleaned.  
T-601 / T-602 / dossier / opportunity / KPI / ClientProfile / ProofWall / ClaimSafety / PageHeader / SourceRegistry subset snapshot rows above are historical and are **not** rewritten.

### Phase-6 T-010-603 global closure (bounded nine-family program)

Evidence: `t-010-603-global-closure.md` · authorization `AUTHORIZE_PHASE6_GLOBAL_T603_CLOSURE_REVIEW` · scope decision **A** · human freeze `GLOBAL_T603_HUMAN_SCOPE_AND_AUTHORIZATION_FROZEN`.

| Item | Verdict |
|------|---------|
| AUTHORITATIVE FAMILY SET | DOSSIER · OPPORTUNITY · KPI · CLIENTPROFILE · PROOFWALL · CLAIMSAFETY · PAGEHEADER · SOURCEREGISTRY · ONBOARDING |
| FAMILY COUNT / ACCEPTED / OPEN | **9 / 9 / 0** |
| GOVERNED LEGACY FILES | **ALL ABSENT** (PRESENT **0** · STUBS **0** · ALIASES **0**) |
| GOVERNED PRODUCT GRAPH | **ZERO** |
| C6 / C7 / SAFE-SUBSET / FORMAL ACCEPTANCE | **PASS** / **VERIFIED** / **VERIFIED** / **COMPLETE** |
| GLOBAL BLOCKING DEBT | **NONE** |
| GLOBAL NONBLOCKING DEBT | aggregate `OUTSIDE_T603_NONBLOCKING_DEBT` — **PRESERVED** |
| GLOBAL AUTHORITY | **PASS** |
| FAMILY A38 | **PASS** |
| T-010-603 **global** | **DONE — FORMALLY_CLOSED** (`PHASE6_GLOBAL_T603_FORMALLY_CLOSED`) |
| C3 **global** | **PARTIAL** (not required for T-603; not modified) |
| A43 **global** | **PASS** |
| T-010-604 | **NOT_AUTHORIZED** |
| PHASE 6 COMPLETE | **NO** |

Broader legacy hosts (`ClientWorkspace`, `LegacyApp`, `Login`, `AppShell`, …) are **not** part of this T-603 completion scope.  
Prior family subset snapshot rows above remain historical local acceptances and are **not** rewritten except the Onboarding global status lines reconciled here.

### Phase-3 acceptance movement (T-010-301…306)

`ARCH3` = `tests/reactMigrationPhase3Architecture.test.ts` (28/28) ·
`P3` = `tests/reactMigrationPhase3Pages.test.ts` (19/19) ·
`E2E3` = `e2e/wave3-pages.spec.ts` (6/6).

Seven criteria advanced from PENDING to PARTIAL. Each is a cross-SPEC
preservation criterion that could not be evidenced before Phase 3, because
before Phase 3 no React surface touched the SPEC in question. None advances to
PASS: full PASS requires the Phase-5 adversarial suites (T-010-501…510).

| # | Was | Now | Why |
|---|-----|-----|-----|
| **A21** | ⏳ PENDING | ⚠️ PARTIAL | `Modals.ts` decomposed (7 of 13). `ARCH3` proves no presentation default is authoritative: the `approvedBriefs[0]` pre-selection is not reproduced, the brief and thesis selectors start empty, and `P3` proves the returned brief list carries no `selected`/`isDefault` marker. Command revalidation by SPEC-003 is proven for approval; the full set of strategic commands remains Phase 4–6 |
| **A22** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-001 surface migrated (radar). The React panel *displays* `routingDecision.routingState` and shows attribution only when routing declared it CLEAR; CONTESTED defers to the legacy decision surface. `ARCH3` bans routing computation and first-thesis selection in any page |
| **A23** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-002 surface migrated. `ARCH3` asserts no score function and no weight arithmetic exists in any page; every displayed score comes from the projection, and scoring itself was not migrated |
| **A24** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-003 consumed canonically: briefs are read through `strategicBriefConsumer`, approval forwards ids only, and `P3` proves the governed `authorizedAction` is carried through rather than recomputed. Brief *creation* deliberately not wrapped (registry) |
| **A27** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-006 preserved: the claim verdict is displayed as data, and no React surface verifies a claim or authorizes publication — pipeline actions and the publication gate stayed legacy. `ARCH3` bans `PUBLISHED` assignment in any page |
| **A29** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-008 preserved: the only migrated learning command is the signal-outcome *intent*. `P3` proves it forwards ids and a kind with no actor, no role and no aggregate, and `ARCH3` bans `APPROVED`/`APPLIED` assignment. No auto-approve, no auto-apply, no `feedbackScoringHints`, no rescore |
| **A30** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-010 → SPEC-008 mutation authority **0**: the intent reaches `registerSignalOutcomeIntent`, which resolves its own trusted context and rules on the transition. `ARCH3` proves no page imports an Application module or a consumer directly |

Criteria that stayed PARTIAL but gained materially stronger evidence:

| # | Phase-3 evidence |
|---|------------------|
| A5 | Five pages migrated with authority `PRESENTATION`/`INTENT` only; `ARCH3` proves no business authority, no manufactured identity, no DOM escape |
| A8 | React → `dbService` direct page imports **0**; the facade remains the only importer in `src/ui` and still exposes **0** mutators, both asserted |
| A9 | 14 wave-3 queries, each with exactly one declared read source carried inside the cache key; 3 of them canonical |
| A10 | 2 further canonical commands flow React intent → seam → consumer; `P3` proves the forwarded payloads are ids only |
| A19 | `P3` proves all 14 wave-3 keys are tenant-scoped and collision-free across organizations, clients, read sources and thesis ids |
| A20 | `ARCH3` proves no page selects a thesis, campaign or brief by position; the facade returns an unresolved marker instead of a fallback |
| A35 | `ARCH3` proves a tab owned by a wave-3 page does not additionally render its wave-2 group — no surface has two owners |
| A38 | `E2E3` proves React mounts without a second DOM owner across all 9 wave-3 surfaces, and that rollback leaves business state byte-identical |
| A41 | Page-level parity evidence now exists for 12 of 18 dimensions per migrated page; dimensions where the legacy command intentionally stays outside React are classified rather than claimed. Cutover parity remains Phase 5 |

Criteria deliberately **not** advanced:

| # | Why not |
|---|---------|
| A25 | SPEC-004 (Plan/PlanItem) has no migrated React surface — no wave-3 page exposes a plan command, so there is nothing to evidence |
| A31 | Rules remain 91/91 and SPEC-009 production is untouched, but no security review was performed in Phase 3; that is Phase 5 |
| A39 | `main.ts` is 5,138 lines before and after, asserted by test. Extraction is Phase 4 |
| A44 | CODE_COMPLETE regression is Phase 6 |

### Phase-2 acceptance movement (T-010-201…206)

`ARCH2` = `tests/reactMigrationPhase2Architecture.test.ts` (29/29) ·
`W2` = `tests/reactMigrationPhase2Wave2.test.ts` (13/13) ·
`E2E2` = `e2e/wave2-components.spec.ts` (5/5).

Two criteria advanced from PENDING to PARTIAL, because Phase 2 produced the
first evidence that could bear on them at all:

| # | Was | Now | Why |
|---|-----|-----|-----|
| **A28** | ⏳ PENDING | ⚠️ PARTIAL | SPEC-007 surface migrated. `ARCH2` + `W2`: OpportunityScore, lifecycle and Materialize are **not** recreated — the four commands reach `opportunityScoutConsumer`, and derived flags come from the canonical facade |
| **A41** | ⏳ PENDING | ⚠️ PARTIAL | Parity evidence now exists per migrated component (rendered information, loading, empty, error, tenant context, actions, disabled actions, validation, freshness, rollback). Cutover parity remains Phase 5 |

Criteria that stayed PARTIAL but gained materially stronger evidence:

| # | Phase-2 evidence |
|---|------------------|
| A6 | `ARCH2`: 9 components carry reads and 5 canonical commands, with **0** persistence writes and **0** lifecycle assignments |
| A8 | `ARCH2`: React → `dbService` direct component imports **0**; facade remains the only importer and exposes **0** mutators |
| A9 | Canonical read path exercised by a real component (`readClientOpportunityCards`); 7 hooks, each with one declared source |
| A10 | 5 commands now flow React intent → seam → canonical consumer; `W2` proves the forwarded payload |
| A11 / A15 | `ARCH2`: `invalidateQueries` only, never `setQueryData`; commands carry ids, never aggregates |
| A14 | Wave 2 introduces **0** optimistic business mutations |
| A16 / A17 / A18 | `W2`: trusted scope forwarded as claimed identity; **0** actor/role fields sent; portfolio scope fails closed |
| A19 | `W2`: runtime cross-tenant, cross-client and cross-source key separation |
| A20 | `ARCH2`: no primary/first-thesis pattern; the spotlight is `DISPLAY_ONLY` |
| A26 | `ARCH2`: **0** provider imports across wave 2 |
| A32 / A33 | `ARCH2`: **0** store and **0** Firestore imports across wave 2 |
| A34 | `ARCH2`: no domain calculation runs in a component or hook |
| A35 | `ARCH2`: components cannot import a consumer directly — one command entry point |
| A36 | One read source per module, provenance in the key |
| A13 | `ReactOnboardingWizard` (T-010-205): RHF + Zod validate input shape only; the schemas hold **0** identity, role, lifecycle or completion fields, Zod strips injected ones, the suggested step is computed by `domain/profileCoverage`, and the form performs **0** writes — so no Zod pass can bypass a Domain gate |
| A38 | `ARCH2` + `E2E2`: 9 new components, **0** new DOM roots, no cross-nesting |
| A42 | Playwright now 10/10 (5 foundation + 5 wave-2 focused) |
| A43 | `E2E2`: rollback after wave 2 leaves business storage byte-identical; **0** legacy files removed |

Criteria deliberately **not** advanced:

| # | Why not |
|---|---------|
| A5 | Behaviour parity per module needs cutover evidence (Phase 5) |
| A21 | `Modals.ts` not migrated (T-010-302) |
| A22, A23, A24, A25, A27, A29, A30 | No routing, scoring, Brief, Plan, Claim or Learning-approval surface was migrated |
| A31 | No security review performed in Phase 2; rules unchanged at 91/91 |
| A39 | `main.ts` is **5,138 lines before and after** — 0 responsibilities extracted. Phase 4 owns this |
| A44 | CODE_COMPLETE regression is T-010-602 |

Phase 1 advanced A2, A3, A4 to full PASS (stack installed, strangler demonstrated, mapping verified) and
newly passed A38. No criterion depending on page migration, `main.ts` extraction, legacy deletion, full
E2E parity, Phase-5 security or Phase-6 closure is claimed.

---

## Deployment separation (D1–D3)

| # | Criterion | Status |
|---|-----------|--------|
| D-A1 | CODE_COMPLETE does not require production deploy | ✅ PASS (design) |
| D-A2 | SPEC-009 production rules unchanged until authorized | ✅ PASS (design) |
| D-A3 | Frontend rollout/rollback separate from Phases 0–6 | ✅ PASS (design) |

---

## Phase 0 exit checklist

| Gate | Status |
|------|--------|
| Formal package complete (11 files) | ✅ |
| Constitutional purpose exact | ✅ |
| Target stack exact (§23) | ✅ |
| §24 seven-step order preserved verbatim | ✅ |
| Big-bang prohibition recorded (§25) | ✅ |
| Strangler seam formalized | ✅ |
| Authority model formalized | ✅ |
| UI owns presentation only | ✅ |
| Data-access seam formalized | ✅ |
| `dbService` direct-read migration strategy explicit | ✅ |
| `main.ts` decomposition explicit | ✅ |
| Query authority model explicit | ✅ |
| TanStack cache non-authoritative | ✅ |
| Command boundary explicit | ✅ |
| Trusted tenant explicit | ✅ |
| Trusted actor explicit | ✅ |
| Multi-thesis explicit | ✅ |
| First-selection defaults non-authoritative | ✅ |
| SPEC-001…009 boundaries explicit | ✅ |
| SPEC008 mutation authority target 0 | ✅ |
| Component inventory complete (17 UI files) | ✅ |
| Migration matrix complete | ✅ |
| Behavior parity model complete | ✅ |
| Legacy deletion gate complete | ✅ |
| Playwright/E2E strategy complete | ✅ |
| Side-effect ordering audit strategy complete | ✅ |
| Rollback model complete | ✅ |
| Acceptance complete (44) | ✅ |
| Threat model complete (26) | ✅ |
| Tasks complete | ✅ |
| Deployment separation complete | ✅ |
| Human T-010-010 | **PENDING** |
| Phase-1 authorization | **NO** |
| Product files changed | **0** |
| Test files changed | **0** |
| Dependency files changed | **0** |
| SPEC-001…009 modifications | **0** |

**PHASE-0 DESIGN BLOCKERS:** **0**
**RUNTIME P0:** **0** · **RUNTIME P1:** **0** · **P2:** 4 · **P3:** 4

---

## Human SPEC approval (T-010-010) — REQUIRED

| Field | Value |
|-------|--------|
| **Task** | T-010-010 |
| **Title** | Human SPEC-010 approval |
| **Status** | **TODO · PENDING HUMAN** |
| **Classification** | HUMAN |
| **Authorization text** | «Apruebo formalmente SPEC-010 — React migration y autorizo el cierre de T-010-010 y el inicio de la Phase 1 de implementación.» |

No automation may write this statement, infer it, or mark T-010-010 DONE.

## Human CODE_COMPLETE (T-010-604) — FUTURE

| Field | Value |
|-------|--------|
| **Task** | T-010-604 |
| **Status** | **TODO** |
| **Authorization text** | «Apruebo formalmente el CODE_COMPLETE de SPEC-010 — React migration y autorizo el cierre de T-010-604.» |

Required (A\*) criteria must be **PASS** before T-010-604 may close.
