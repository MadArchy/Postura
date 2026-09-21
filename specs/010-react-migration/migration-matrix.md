# Migration matrix 010 — React migration

**Baseline:** SPEC-008 frozen @ `642ae9390700a254fa390ba09a959bab3c37d616`
**Measured:** Phase-0 read-only discovery on that commit.

---

## Measurement correction (disclosed)

The Phase-0A discovery report stated "17 components / 12 importing dbService / ~6,872 lines". Exact
re-measurement of `src/components/*.ts` gives:

| Fact | Discovery report | **Measured truth** |
|------|------------------|--------------------|
| Component files | 17 | **16** (the 17th item was `src/main.ts`) |
| Components importing `dbService` | 12 | **11** |
| Component lines | ~6,872 | **6,873** |
| `src/main.ts` lines | 5,132 | **5,132** (confirmed) |
| Total legacy UI | ~12,004 | **12,005** |

Repository truth is authority; the corrected figures are used throughout this package.

---

## Full UI inventory — every file, no summarization

Legend — **Disposition:** MIGRATE · ADAPT · KEEP · COMPATIBILITY · REMOVE_AFTER_PARITY · OTHER_SPEC.
**Read source:** `dbService` = legacy direct · `consumer` = canonical · `none` = pure presentation.

| # | File | Lines | Responsibility | dbService reads | Consumer imports | Writes | Read source | Tenant scope | Business-rule risk | Complexity | Candidate React boundary | Wave | Disposition |
|---|------|-------|----------------|-----------------|------------------|--------|-------------|--------------|--------------------|------------|--------------------------|------|-------------|
| 1 | `src/main.ts` | **5,132** | bootstrap · navigation · auth wiring · event bus · render triggers · consumer invocation · legacy orchestration · notifications | many | 4 (`strategicBrief`, `strategicPlan`, `opportunityScout`, `learningLoop`) | **yes** (all UI-originated commands) | mixed | mixed | **HIGH** — sole command surface | **VERY HIGH** | decomposed across all waves → minimal bootstrap | **1→4** | **MIGRATE** (incremental strangler) |
| 2 | `ClaimSafetyPanel.ts` | 74 | claim-safety display | **0** | 0 | no | none | n/a | **NONE** | **LOW** | `<ClaimSafetyPanel/>` | **2** | **MIGRATE** |
| 3 | `Login.ts` | 91 | login form surface | **0** | 0 | no | none | n/a | **NONE** (auth owned by SPEC-009) | **LOW** | `<Login/>` | **1** | **MIGRATE** |
| 4 | `ProofWallPanel.ts` | 93 | proof-wall display | 3 (`getEvidenceById`, `getMasterDossier`, `getProofWallByClient`) | 0 | no | `dbService` | clientId | **LOW** | **LOW** | `<ProofWallPanel/>` | **2** | **MIGRATE** |
| 5 | `ClientProfilePanel.ts` | 107 | client profile display | 2 (`getClientById`, `getMasterProfile`) | 0 | no | `dbService` | clientId | **LOW** | **LOW** | `<ClientProfilePanel/>` | **2** | **MIGRATE** |
| 6 | `SourceRegistryModal.ts` | 117 | source registry modal | 4 (`getActiveTheses`, `getClientById`, `getSources`, `getSourcesByClient`) | 0 | no | `dbService` | clientId | **LOW** | **LOW** | `<SourceRegistryModal/>` | **2** | **MIGRATE** |
| 7 | `KpiWeeklyChart.ts` | 126 | KPI chart | 1 (`getResultsByClient`) | 0 | no | `dbService` | clientId | **NONE** | **LOW** | `<KpiWeeklyChart/>` | **2** | **MIGRATE** |
| 8 | `PageHeader.ts` | 132 | page header chrome | **0** | 0 | no | none | n/a | **NONE** | **LOW** | `<PageHeader/>` | **2** | **MIGRATE** |
| 9 | `MasterDossierPanel.ts` | 166 | master dossier display | **0** | 0 | no | none | n/a | **NONE** | **LOW** | `<MasterDossierPanel/>` | **2** | **REMOVE_AFTER_PARITY** |
| 10 | `OnboardingWizard.ts` | 221 | onboarding flow | 2 (`getClientById`, `getMasterProfile`) | 0 | no | `dbService` | clientId | **LOW** | **MEDIUM** (multi-step form) | `<OnboardingWizard/>` (RHF) | **2** | **MIGRATE** |
| 11 | `OpportunityPanel.ts` | 240 | Opportunity display | **0** | 1 (`opportunityScoutConsumer`) | no | **consumer** | canonical | **NONE** | **LOW** | `<OpportunityPanel/>` | **2** (reference module) | **REMOVE_AFTER_PARITY** |
| 12 | `AppShell.ts` | 271 | app chrome · nav · badge counts | 11 | 0 (+`authService`, `firebase/config`) | no | `dbService` | clientId | **MEDIUM** (nav ownership) | **MEDIUM** | `<AppShell/>` — Stage-A mount host | **1** | **MIGRATE** |
| 13 | `ThesisEditorModal.ts` | 307 | thesis editing form | 2 (`getClientById`, `getThesesByClient`) | 0 | no | `dbService` | clientId | **MEDIUM** (multi-thesis) | **MEDIUM** | `<ThesisEditorModal/>` (RHF+Zod) | **3** | **HYBRID · READ_ONLY_REACT_WITH_LEGACY_COMMAND** (T-010-301 — `ReactThesisEditorPage`; both save intents end in `dbService.saveThesis`, registry #11, so the save stays legacy) |
| 14 | `ManagerCockpit.ts` | 595 | manager dashboard | 10 (incl. `getAiRuns`, `getSignalOutcomes`, `getSubscription`) | 0 (+`firebase/config`) | no | `dbService` | clientId | **MEDIUM** | **HIGH** | `<ManagerCockpit/>` | **3** | **HYBRID · READ_ONLY_REACT_WITH_LEGACY_COMMAND** (T-010-303 — `ReactManagerCockpitPage`; all 5 commands blocked, registry #33–#34) |
| 15 | `Modals.ts` | 834 | multiple modal surfaces in one file | 7 | 1 (`strategicBriefConsumer`) | no | mixed | clientId | **MEDIUM** (`approvedBriefs[0]` default — AUDIT010-06) | **HIGH** | **decompose** into one component per modal | **3** | **HYBRID · HYBRID_MIGRATABLE** (T-010-302 — `modals/ReactModals.tsx`, 7 of 13 modals; 6 retain a blocked write, registry #30–#34; `approvedBriefs[0]` default not reproduced) |
| 16 | `ClientPortal.ts` | 937 | client-facing portal | 14 | 1 (`opportunityScoutConsumer`) | no | mixed | clientId | **MEDIUM** (`theses[0]` presentation default) | **HIGH** | `<ClientPortal/>` route tree | **3** | **HYBRID · HYBRID_MIGRATABLE** (T-010-304 — `ReactClientPortalPage`; 7 canonical commands migrated incl. #19 ack + #13 thesis review, 5 blocked, registry #7/#28/#30/#32; `client-thesis` = combined thesis review + dossier; P1 #19 + P2 #13 React presentation parity accepted) |
| 17 | `ClientWorkspace.ts` | **2,562** | primary manager workspace | **25** | 2 (`strategicBrief`, `learningLoop`) | no | mixed | clientId | **HIGH** (breadth of surfaces) | **VERY HIGH** | decomposed route + panel tree | **3** | **HYBRID · HYBRID_MIGRATABLE** (T-010-305 — `ReactClientWorkspacePage`, one component per tab; 2 canonical commands migrated, 22 blocked, registry #12/#14–#29; 2 `EFFECT_FIRST` render-time agent paths left legacy) |

**Totals:** 17 UI files · 16 components + `main.ts` · 12,005 lines · 11 components with `dbService` reads ·
4 components with canonical consumer reads · **0 components performing writes**.

### Non-UI dispositions

| Item | Disposition | Basis |
|------|-------------|-------|
| `src/domain/**` | **KEEP** | audit: *"Conservar y no reescribir primero"* |
| Vitest suites (`tests/**`) | **KEEP** | §24 step 6 *"Mantener tests de regresión"* |
| Firestore contracts / rules | **KEEP** | SPEC-009 owner |
| `src/application/**` | **OTHER_SPEC** | frozen |
| `src/infrastructure/**` | **OTHER_SPEC** | frozen |
| `src/composition/**` | **OTHER_SPEC** | frozen |
| `src/services/*Consumer.ts` | **KEEP** (reused as the seam) | canonical intent/projection boundary |
| `src/services/db.ts` (`dbService`) | **COMPATIBILITY** | direct React imports → 0; deletion **not** promised |
| `src/services/auth.ts` | **KEEP** | SPEC-009 trusted auth |
| `src/styles/index.css` | **ADAPT** | ownership follows DOM ownership |
| `src/lib/**` presentation helpers | **ADAPT** | non-authoritative |

---

## Read classification per component

Every legacy read is classified so no React module inherits an undeclared source.

| Classification | Meaning | Components affected |
|----------------|---------|--------------------|
| `CANONICAL_QUERY_AVAILABLE` | canonical consumer already exposes this projection | `OpportunityPanel` (all), `ClientWorkspace` / `ClientPortal` / `Modals` (brief, learning, opportunity slices) |
| `CANONICAL_QUERY_MISSING` | canonical owner exists but no UI-facing projection yet | learning/brief/plan slices not yet exposed for display |
| `LEGACY_COMPATIBILITY_READ` | only `dbService` provides it; wrap behind an explicit compatibility facade | clients, theses, signals, tasks, content, curation, deliveries, sources, campaigns, results, evidence vault, subscription, AI runs |
| `PRESENTATION_ONLY` | display default, never authority | `ClientPortal:541` `theses[0]`, `Modals:772` `approvedBriefs[0]`, `db.ts:1376` `getPrimaryThesis` |
| `MIGRATION_REQUIRED` | must move to a canonical projection before its module is cut over | any `CANONICAL_QUERY_MISSING` slice in a migrating wave |

**Rule:** do **not** create 12 new repositories. Reuse the four existing canonical consumers and add a
single compatibility read facade for legacy-only data. Prefer reuse over new ports.

---

## Read-path divergence rule

A React-migrated module must declare **one** read source:

1. If a canonical projection exists → **use it**.
2. If only a legacy read exists → wrap it behind an explicit compatibility read facade and label it
   `LEGACY_COMPATIBILITY_READ`. **Do not pretend it is canonical.**
3. Mixed canonical + `dbService` reads inside one React component are **forbidden** unless a formal
   transition design proves coherence for that specific module and records it here.

## Tenant read safety (AUDIT010-05)

Legacy reads are predominantly `clientId`-scoped; canonical stores require
`(organizationId, clientId, entityId)`. New React read contracts must carry both where the canonical model
requires both, and every query key must include trusted tenant scope. The same entity id in two
organizations must not collide in cache or in a read result.

---

## Wave status

| Wave | Status | Evidence |
|------|--------|----------|
| **W1 — Shell** | **FOUNDATION COMPLETE · NO CUTOVER** | Mount seam, toggle, providers, query/command seams, React `AppShell` + `Login` implemented and mountable. Legacy remains the served presentation. 27 architecture + 5 Playwright tests PASS |
| **W2 — Leaf components** | **EXTRACTION COMPLETE · NO CUTOVER** | 9 of 9 candidates extracted (4 with their commands, 5 display/read-only with commands retained in legacy per AUDIT010-09). 52 Vitest (34 architecture + 18 behaviour) + 5 Playwright PASS. All 9 legacy counterparts retained |
| W3 — Pages | **HYBRID COMPLETE · NO CUTOVER** | 5 pages migrated (Phase 3); `E2E3` + architecture tests PASS |
| W4 — Controller strangler | **STAGE B COMPLETE · NO CUTOVER** | T-403/T-404; Stage-B Playwright **11/11** |
| **W5 — Proof** | **EVIDENCE COMPLETE · NO CUTOVER** | Phase 5 (T-501…510): adversarial Vitest **73/73**, Playwright **21/21**, threats **23/3/0** |
| **W6 — Removal** | **NOT STARTED** | Phase 6 — legacy deletion after proven equivalence |

### Wave-2 component dispositions

| Legacy component | React module | Read source | Command source | Disposition |
|---|---|---|---|---|
| `PageHeader.ts` | `ReactPageHeader.tsx` | none | none | **MIGRATED** (metadata imported, not copied) |
| `ClaimSafetyPanel.ts` | `ReactClaimSafetyPanel.tsx` | props | presentation intent | **MIGRATED** |
| `MasterDossierPanel.ts` | `ReactMasterDossierPanel.tsx` | compatibility | `PRESENTATION_ONLY` via seam | **REMOVE_AFTER_PARITY** |
| `OpportunityPanel.ts` | `ReactOpportunityPanel.tsx` | **canonical** | **canonical consumer** ×4 | **REMOVE_AFTER_PARITY** |
| `KpiWeeklyChart.ts` | `ReactKpiWeeklyChart.tsx` | compatibility | **canonical consumer** | **MIGRATED** |
| `ClientProfilePanel.ts` | `ReactClientProfilePanel.tsx` | compatibility | none — 5 writes blocked | **PARTIAL · DISPLAY_ONLY_REACT** |
| `ProofWallPanel.ts` | `ReactProofWallPanel.tsx` | compatibility | none — toggle blocked | **PARTIAL · READ_ONLY_REACT** |
| `SourceRegistryModal.ts` | `ReactSourceRegistryPanel.tsx` | compatibility | none — 2 actions blocked | **PARTIAL · READ_ONLY_REACT** |
| `OnboardingWizard.ts` | `ReactOnboardingWizard.tsx` | compatibility | none — step write is `main.ts`-owned and blocked | **PARTIAL · DISPLAY_ONLY_REACT** (RHF + Zod shape validation; saving delegated to legacy) |

Seven of the nine wave-2 legacy files remain present. `MasterDossierPanel.ts` and
`OpportunityPanel.ts` were removed after the Phase-6 parity gate (`REMOVE_AFTER_PARITY`).
The remaining seven stay `MIGRATE` until their own Phase-6 subset removal.
No page was migrated: page orchestration is still entirely legacy.

React `AppShell` and `Login` exist alongside their legacy counterparts; neither legacy file was modified
or removed. `AppShell.ts` and `Login.ts` therefore stay `MIGRATE` (not `REMOVE_AFTER_PARITY`) until the
parity gate passes in Phase 6.

## Migration waves

Each wave requires: bounded module scope · declared read source · declared command source · behavior
parity · tenant parity · authority parity · test parity · rollback path. Legacy removal only after parity.

| Wave | §24 step | Scope | Why this order |
|------|----------|-------|----------------|
| **W1 — Shell** | 1, 3 | React shell + mount boundary + data-access seam + `AppShell`, `Login` | §24 requires the shell first; existing services are kept |
| **W2 — Leaves** | 2 | `ClaimSafetyPanel`, `PageHeader`, `MasterDossierPanel`, `OpportunityPanel`, `KpiWeeklyChart`, `ClientProfilePanel`, `ProofWallPanel`, `SourceRegistryModal`, `OnboardingWizard` | Lowest authority and lowest coupling: 5 have **zero** `dbService` reads and `OpportunityPanel` is already canonical-only, so it is the reference implementation |
| **W3 — Pages** ✔ **DELIVERED** | 4 | `ThesisEditorModal`, `ManagerCockpit`, `Modals` (decomposed), `ClientPortal`, `ClientWorkspace` — **5 of 5 migrated · 5 HYBRID · 0 FULL CUTOVER** | Page-by-page migration of the highly coupled surfaces. No page qualified for full cutover under §31: most commands a page needs are direct `dbService` writes with no canonical use case (AUDIT010-09), so presentation and reads moved to React while those writes stayed legacy and reachable |
| **W4 — Controller** ✔ **DELIVERED** | 5 | `main.ts` reduced to **15-line bootstrap** (4,473 → 15, **−99.7%**); legacy composition in `LegacyApp.ts` (**639** lines) + **18** handler modules + presentation controllers. **Stage B entered** (T-403 @ `66d849b3`) · **T-404 formally accepted** · React owns normal shell + navigation · legacy islands hosted | CR-1 cutover spine complete (#9/#18). T-403 E2E **11/11 PASS**. Phase 4 **FORMALLY_ACCEPTED** |
| **W5 — Proof** | 6 | parity, adversarial, tenant, E2E evidence | Regression tests maintained throughout, consolidated here |
| **W6 — Removal** | 7 | legacy deletion after proven equivalence | Last, never first |

`main.ts` shrinks in **every** wave; it is not rewritten in one step (§25).

---

## Per-wave rollback and deletion conditions

| Wave | Rollback mechanism | Legacy deletion condition |
|------|--------------------|---------------------------|
| W1 | disable React mount; legacy shell resumes | none — shell coexists |
| W2 | per-module toggle back to legacy renderer | parity gate passed for that module |
| W3 | per-page toggle back to legacy page | parity gate passed for that page |
| W4 | restore `main.ts` orchestration path | `main.ts` responsibility relocated and proven |
| W5 | n/a (evidence only) | n/a |
| W6 | re-enable retained legacy module | **all** parity-gate conditions met |

Rollback switches **presentation implementation only** and must never require a data migration or alter
canonical business state.

---

## AUDIT010 disposition

| ID | Sev | Finding | Phase-0 disposition |
|----|-----|---------|--------------------|
| AUDIT010-01 | P2 | formal SPEC-010 package absent | **RESOLVED** — this package |
| AUDIT010-02 | P2 | React target stack absent | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** — stack fixed exactly (§23); installation is Phase-1 (T-010-101) |
| AUDIT010-03 | P2 | `main.ts` 5,132-line controller/event bus | **EXTRACTION_COMPLETE (Phase 4, T-010-404)** — `main.ts` **15-line** bootstrap; event wiring in **18** handler modules + `LegacyApp.ts` compatibility host (**639** lines). Remaining deferred CR-1 writes stay in legacy handlers until CR-1 is granted — not a `main.ts` controller regression |
| AUDIT010-04 | P2 | 11 components import `dbService` for reads | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** — data-access seam + per-component read classification + one-read-source rule explicit |
| AUDIT010-05 | P3 | legacy reads not uniformly `organizationId`-scoped | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** — tenant-safe query keys and read contracts specified |
| AUDIT010-06 | P3 | `Modals.ts:772` `approvedBriefs[0]` presentation default | **RESOLVED_FOR_REACT_SURFACE (Phase 3, T-010-302)** — the React brief selector starts empty and carries no default marker; approval forwards a confirmed id that SPEC-003 revalidates. The legacy modal retains the default and is still reachable, so the finding stays open against legacy until Phase 6 removal |
| AUDIT010-07 | P3 | legacy `main.ts` side-effect ordering not fully audited | **AUDIT_COMPLETE · DEFECTS REGISTERED · 0 MIGRATED (Phase 4, T-010-401)** — all **86** material side-effecting controller paths classified: **80 `GATE_FIRST`**, **6 `EFFECT_FIRST`**, **0 `UNKNOWN`**; **0** effects at bind time or render time. The Phase-0 caution was justified: the 6 `EFFECT_FIRST` paths are real and are now **AUDIT010-10** (P2). None was migrated. Full evidence: `main-controller-audit.md` |
| AUDIT010-10 | P2 | 6 legacy paths run a material effect with no in-path authorization gate; 5 take tenant from a DOM attribute | **RESOLVED (Phase 4C)** — all gated on a trusted grant from `controllers/trustedTenant.ts`; `EFFECT_FIRST` **6 → 0** by re-audit; DOM-derived tenant authority **5 → 0**; button-visibility authorization **6 → 0**. Evidence: `tests/reactMigrationPhase4cSecurity.test.ts` (33/33) |
| AUDIT010-11 | P3 → **P2** | positional (`getClients()[0]`) default for **tenant** scope | **RESOLVED (Phase 4C)** — removed from all three authority sites. Reclassified P3→P2 first: it fed business writes, `getClients()` is not org-scoped, and `renderMainView` rendered *another tenant's portal* to a client session with no `clientId`. One display-only default retained per §10 and fenced by test |
| AUDIT010-12 | P3 | 6 internal helper methods execute an effect with no gate of their own | **OPEN** — gated by their callers, not in-path; `boot` is bootstrap. Not the AUDIT010-10 population. Closing it means verifying 12 call sites, which no phase has yet been authorized to do |
| AUDIT010-08 | P3 | Playwright absent | **DESIGN_RESOLVED_IMPLEMENTATION_PENDING** — E2E/parity harness plan complete in `parity-model.md`; installation is Phase-1 |

**RUNTIME P0:** **0** · **RUNTIME P1:** **0** · **P2:** 4 · **P3:** 4
**PHASE-0 DESIGN BLOCKERS:** **0**

P2/P3 remain open because **no implementation is authorized in Phase 0**. A discovery/runtime finding is
not a Phase-0 design blocker; nothing is suppressed.
