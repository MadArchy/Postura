# T-010-604 — A25 SPEC-004 Strategic Planner Preservation Evidence

- **Status:** `POSTURA_A25_FORMALLY_PROMOTED`
- **Class:** `GOVERNANCE_EVIDENCE`
- **Branch:** `spec/010-react-migration`
- **Authorization:** `AUTHORIZE_POSTURA_A25_FORMAL_PROMOTION`
- **Fresh review:** `POSTURA_A25_FRESH_REFREEZE_REVIEW_COMPLETE` (authorization `AUTHORIZE_POSTURA_A25_FRESH_REFREEZE_REVIEW`)

| Field | Value |
|-------|-------|
| **A25 REVIEWED / FROZEN SHA** | `d53299e17fa733cecf73baf139a8c0514b2150cc` |
| **A25 PASS BAR** | `PRESERVED_SPEC004_CANONICAL_AUTHORITY` |
| **PROMOTION STATUS** | **FORMALLY PROMOTED BY THIS GOVERNANCE RECORD** |
| Promotion documentation commit | the later commit that adds this file (documentation only; it is **not** the reviewed application SHA) |

This record does **not** authorize T-010-604, A31 execution, CODE_COMPLETE or any production action.
It does **not** modify Product / Runtime / React / tests / rules / tooling.

---

## 1. Criterion and pass bar

**A25 (`acceptance.md`):** SPEC-004 preserved — Plan/PlanItem via canonical Application boundary.

**SPEC-004 = Strategic Planner.** Canonical entities: `StrategicPlan` (aggregate root) and `PlanItem`.
A25 is **not** a scoring gate. Scoring, AI, persistence and curation appear below only as complementary non-interference evidence.

**Human decision:** A25-P1 (2026-09-24, `PHASE6_T604_A25_HUMAN_PASSBAR_DECIDED_P1`).

**Pass bar meaning:** SPEC-010 did not recreate, bypass, duplicate, compete with or silently transfer canonical Strategic Planner authority. A React Planner surface is **not** required (A25-P2 `REQUIRED_REACT_PLANNER_MIGRATION` rejected as the current pass bar; a future separately governed Planner migration is not prohibited).

---

## 2. Previous baseline

| Field | Value |
|-------|-------|
| Previous A25 base / review SHA | `0324fec96c7f4a1c6f60b139418f1185265e7860` — `docs(spec): promote A41 behavioral parity` |
| Previous human decision | A25-P1 |
| Previous evidence | planned file `t-010-604-a25-preservation-evidence.md` was **never materialized** |
| Previous token | `STALE_AFTER_OPERATIONAL_COMMITS` (operational commits from `f5d4b7a` onward) |

---

## 3. SPEC-004 authority sources reviewed

Specification:

- `specs/004-strategic-planner/spec.md`
- `specs/004-strategic-planner/planner-model.md`
- `specs/004-strategic-planner/hexagonal-boundaries.md`
- `specs/004-strategic-planner/data-flow.md`
- `specs/004-strategic-planner/acceptance.md`

Canonical code:

- `src/domain/strategicPlanCore.ts`
- `src/domain/planItemCore.ts`
- `src/domain/planGateCore.ts`
- `src/domain/strategicPlanErrors.ts`
- `src/application/strategicPlan/**`
- `src/infrastructure/strategicPlan/**`
- `src/composition/strategicPlan/composeStrategicPlan.ts`
- `src/services/strategicPlanConsumer.ts`

---

## 4. Core preservation finding

| Check (`0324fec..d53299e`) | Result |
|----------------------------|--------|
| Commits reviewed | **30** |
| Planner authority-file changes | **0** |
| SPEC-004 specification changes affecting authority | **0** |
| Changed files (119) referencing `strategicPlan` / `StrategicPlan` / `PlanItem` / `planGate` / `strategicPlanConsumer` | **0** |
| Parallel React Planner authority (`src/ui/**` Planner references) | **0** |
| `react-ws-plan` in React | absent (E2E asserts count 0) |
| Competing `Plan` / `PlanItem` definition | **0** |
| `src/domain` + `src/application` changes in interval | `thesisProposalCore.ts` and AI input schemas only (`d81e181`) |
| `functions/**` changes in interval | **0** |

### Commit families (Planner authority impact)

| Commits | Family | Impact |
|---------|--------|--------|
| `f5d4b7a` `294f252` `c45ae9d` `2dfb51b` `1e4c92d` | UI / dev port / retired legacy controls | NONE |
| `b61c5d5` `99050c7` `4bda325` `64a43e5` `ac3b835` `2bb0439` | Persistence transport (timestamps, scoped reads, `createdAt`, CLIENT write scope, transition ordering, seed) | NONE |
| `7d46fc2` `e00999b` `a69b3d2` `7bfbaa4` `901652c` `edf4fb4` `fd006d8` `824ab25` | E2E isolation and persistence probes | NONE |
| `7c7f6fc` `2b4494e` | Radar scoring display / contested attribution (canonical `strategicSignalRouting` use cases) | NONE |
| `78a8cba` `d9da485` `b8640d9` | Delete/clear propagation; newest advice | NONE |
| `e6a94be` | H10 brief from curation (`createBriefFromCurationEntry`) | NONE |
| `558b477` `d81e181` | H19 / H20 thesis AI advisory | NONE |
| `15590e2` `bbd520b` | Strategic Brief Firestore persistence / refresh | PRESERVED (indirect, §6) |
| `d53299e` | SPEC-009 read-only production tooling | NONE |

---

## 5. Canonical invariants (preserved)

| Invariant | Authority |
|-----------|-----------|
| `StrategicPlan` remains the aggregate root | `strategicPlanCore.ts` |
| `PlanItem` cannot self-authorize | `planItemCore.ts` |
| PlanItem action ⊆ Brief `decision.authorizedAction`; `NONE` ⇒ nothing activates | `planGateCore.ts`, `AuthorizePlannedAction` |
| AI never approves or activates Planner state | `application/strategicPlan` (`ApproveStrategicPlan`, `ActivatePlanItem`) |
| Consumers go through `strategicPlanConsumer` | `services/strategicPlanConsumer.ts` |
| Planner reads Strategic Briefs through the canonical read boundary | `LocalStrategicBriefReader` (read-only, tenant-strict, fail-closed) |
| No React surface recreates Planner authority | `src/ui/**` has no Planner reference |

---

## 6. Strategic Brief indirect effect

The only material indirect change: Strategic Briefs now synchronize with Firestore (`15590e2`, `bbd520b`). Planner authority remains preserved because:

- remote merge (`LocalStrategicBriefStore.mergeRemoteRecords`) keeps the highest valid version (newest `updatedAt` on a tie);
- malformed remote records and tenant-mismatched Briefs are rejected;
- current rules forbid decreasing a Brief `version` and restrict Brief writes to ADMIN;
- `LocalStrategicBriefReader` remains read-only and fail-closed;
- a newer Brief can trigger canonical revalidation but does not itself bypass Planner authorization.

Brief overrides (`OverrideStrategicBrief`) require a trusted actor and a reason, preserve invariants, write an audit record, and cannot set `APPROVED` without explicit `ApproveStrategicBrief`; they therefore cannot authorize Planner actions. SPEC-003 remains Brief authority.

---

## 7. Complementary non-interference evidence

| Area | Finding |
|------|---------|
| Thesis stress-test | advisory only (no write in `thesisAdvisoryConsumer`) |
| AI proposal | does not auto-save (explicit `SaveThesis` required) |
| AI canonical score mutation | **NO** |
| AI Planner approval / activation | **NO** |
| Firestore | durability / persistence transport — **not** Planner business-decision authority |
| Delete / clear intents (`RemoteMutationIntent`, `deleteDoc`, `clearFields`) | converge persistence only; do not redefine `StrategicPlan`, `PlanItem` or Planner gates |

AI is not part of SPEC-004 authority.

---

## 8. Option E and related status

| Item | Value |
|------|-------|
| OPTION E | **AUTHORITATIVE** (`reactExclusiveSlots.ts` unchanged) |
| WHOLE-APP LEGACY ROLLBACK | **RETIRED** (`returnToLegacy` removed; `__posturaUi` DEV-only) |
| Production `window.__posturaUi` | **0** (no occurrence in `dist`) |
| H06 | CLOSED |
| H09 | CLOSED |
| P9 | STABLE |

---

## 9. R1 / R5 status

| Item | Status | A25 relevance |
|------|--------|---------------|
| H10 | IMPLEMENTED | none |
| H19 | IMPLEMENTED | none |
| H20 | IMPLEMENTED | none |
| H15 | **NOT IMPLEMENTED IN REACT** | **NON-BLOCKING** — downstream content generation, not part of the SPEC-004 Plan/PlanItem pass bar |
| H07 · H08 · H11 · H12 · H16 · H17 · H21 | R5 deferred (not completed) | non-blocking |

---

## 10. Known debt (non-A25 blockers, not closed)

| Debt | A25 blocker |
|------|-------------|
| Historical advice duplicate audit (`saveAdvice`) | NO |
| `strategicBriefId` null-path debt | NO |
| Legacy-only clears | NO |
| `clientFeedback` | NO |
| Notification retention | NO |
| `LocalLearningLoopStore` | NO |
| Content status-pair debt | NO |
| Production billing | NO |
| Production claims | NO |
| Production export | NO |
| API / secret / function cutover preparation | NO |

None touches Plan/PlanItem authority. Production items belong to A31 / CUTOVER-E.

---

## 11. Quality evidence (fresh review at `d53299e`)

| Gate | Result |
|------|--------|
| Architecture | 35 files / 425 tests PASS |
| Planner SPEC-004 | 10 files / 144 tests PASS |
| Briefs | 15 files / 217 tests PASS |
| Thesis / AI | 19 files / 209 tests PASS |
| Scoring / routing | 28 files / 279 tests PASS |
| Persistence | 23 files / 294 tests PASS |
| `npm run check` | 239 files / 3253 tests PASS |
| Lint | 0 errors / 2 warnings |
| Typecheck | PASS |
| Build | PASS |
| Rules | 106 / 106 PASS |
| Functions typecheck | PASS |
| Full E2E | 91 / 91 PASS |
| New regressions | 0 |
| `productionFirebaseRequests` | 0 |
| Secret scan | PASS / rotation NO |
| `git diff --check` | PASS |

---

## 12. Production boundary

A25 promotion is a repository canonical-authority decision. It does **not** authorize:

production cutover · Firestore rules deployment · Functions deployment · Hosting deployment · billing changes · API enablement · claim reprovision · secret creation · export.

CUTOVER-E keeps its operational hard gates (Blaze confirmation, managed Firestore export, claims audit/reprovision, required APIs, secrets, `aiComplete`, preview rehearsal).

---

## 13. Result

| Field | Value |
|-------|-------|
| A25 | **FORMALLY PROMOTED** |
| RESULT | `POSTURA_A25_FORMALLY_PROMOTED` |
| A25 frozen authority target | `d53299e17fa733cecf73baf139a8c0514b2150cc` |
| A31 | unblocked for review (read-only first) |
| Next governance gate | **A31** |
| T-010-604 | **NOT AUTHORIZED** |
