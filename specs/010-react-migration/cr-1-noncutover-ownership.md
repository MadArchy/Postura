# CR-1 — Noncutover Ownership Ratification

**Class:** `GOVERNANCE_RATIFICATION`  
**Status:** `COMPLETE`  
**Umbrella:** CR-1 — Cutover-Critical Application Ownership  
**Human governance authorization:** APPROVED (Phase B noncutover ownership finalization)  
**Authorized base checkpoint:** `6579f9a9c247eb9c2ac2f57cd8251d52470786a6`  
**Governance content SHA:** `e4bc16f5f8667792d443217d4ab2a6572274aa22`  
**Timezone:** America/Bogota

---

## Checkpoint SHAs

| Role | SHA |
|------|-----|
| Authorized start | `6579f9a9c247eb9c2ac2f57cd8251d52470786a6` |
| Governance content (ratification) | `e4bc16f5f8667792d443217d4ab2a6572274aa22` |
| Tip pin | points at governance content above (not self) |

## Scope

Ratifies final **business ownership** and **disposition** for the **22** remaining
AUDIT010-09 registry rows with `CU? = NO` (non-cutover). Does **not** implement
Application use cases, change cutover spine evidence, or modify frozen SPEC
ownership.

| Item | Value |
|------|--------|
| Noncutover IDs | **2, 3, 4, 5, 6, 7, 9, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 27, 29, 30, 33** |
| Cutover spine | **12/12 unchanged** (#1, #8, #10, #11, #12, #13, #24, #26, #28, #31, #32, #34) |
| New Application boundary | **0** |
| New product module | **0** |
| New SPEC ID | **0** |
| Noncutover implementations this pass | **0** |

**Owner resolution ≠ canonicalization.** All 22 rows remain `CU? = NO` except
#18 and #22 where `CU? = PARTIAL` (canonical gate/routing half only).

---

## Five Application boundaries (final)

1. **Client Lifecycle Application**
2. **Master Profile Application**
3. **Thesis Lifecycle Application**
4. **Signal Intake Application**
5. **Execution Delivery Application**

No sixth operational Application boundary is required.

---

## Final owner map

### Master Profile Application

**IDs:** 2, 3, 4, 5, 6, 7, 29, 30

| ID | Capability | Owner state |
|----|------------|-------------|
| 2–6 | Profile fact lifecycle / CV extract | `#2`–`#6` canonical |
| 7 | ProofWallItem readiness checklist | `#7` canonical |
| 29 | Evidence ↔ thesis dossier association | OWNER_RESOLVED_BY_CURRENT_EVIDENCE |
| 30 | Evidence vault CRUD | OWNER_RESOLVED_BY_CURRENT_EVIDENCE |

**#7 rule:** ProofWallItem is service/profile readiness — not EvidenceVault claim
verification, not SPEC-006 publication authority.

**#30 rule:** Master Profile owns vault/dossier materialization. SPEC-006 owns
claim/evidence safety and publication authorization only. Legacy UI field
`verified: true` is **NONAUTHORITATIVE_LEGACY_METADATA** — it does not constitute
formal SPEC-006 Verification authority and must not authorize publication or
satisfy claim verification. Compatibility advisory consumers
(`claimSafetyCore`, `thesisStrengthCore`) may read the flag heuristically; formal
`AuthorizePublication` does not treat it as verification authority
(`evidenceCore.ts`).

### Signal Intake Application

**IDs:** 9, 20, 22 (recommendation persistence only), 25

| ID | Capability | Owner state |
|----|------------|-------------|
| 9 | Source poll / scheduled ingest → signals | OWNER_RESOLVED_EXISTING |
| 20 | Manager signal discard triage | OWNER_RESOLVED_BY_CURRENT_EVIDENCE · **CANONICALIZED Wave A1** |
| 22 | Legacy `addRecommendation` persistence | OWNER_RESOLVED (compatibility advisory) |
| 25 | Source pause / resume / archive / probe runs | OWNER_RESOLVED_EXISTING |

**#22 rule:** `scoreAndRouteSignal` routing half remains **SPEC-001** (unchanged).
`addRecommendation` is **NONAUTHORITATIVE_COMPATIBILITY_ADVISORY** under Signal
Intake — not routing, scoring, Brief, Planner, Opportunity, or Learning
authority. Disposition: `LEGACY_ISLAND_ALLOWED_STAGE_B` ·
`PHASE6_REMOVE_LATER_CANDIDATE` pending Phase-5 parity review.

### Execution Delivery Application

**IDs:** 14, 15, 16, 17, 18, 19, 27, 33

| ID | Capability | Owner state |
|----|------------|-------------|
| 14–16 | Curation editorial pipeline | OWNER_RESOLVED_BY_CURRENT_EVIDENCE |
| 17–19 | Delivery package / send / client ack | OWNER_RESOLVED_BY_CURRENT_EVIDENCE |
| 27 | Manager task assign / cancel | OWNER_RESOLVED_EXISTING |
| 33 | ContentItem creation persistence | OWNER_RESOLVED (human ratification) |

**Curation (#14–16):** CurationEntry is pre-delivery compatibility pipeline.
SPEC-003 = Brief authorization gate. SPEC-005 = AI for `proposeAngle` where
applicable. Neither owns curation CRUD.

**#33 rule:** SPEC-003 = strategic authorization · SPEC-005 = AI execution ·
Execution Delivery = ContentItem creation/persistence lifecycle. **Do not** force
new content through current `SaveContentDraft` — repository evidence establishes
`SaveContentDraft` = **edit existing ContentItem**. Legacy `saveContent` create
path remains `LEGACY_ISLAND_ALLOWED_STAGE_B`. Future canonicalization requires a
separate Execution Delivery **create** path preserving Brief gate, SPEC-005,
SPEC-006 boundary, tenant isolation, human approval, and `strategicBriefId`
traceability.

### Composite / split authority

**ID 21 — COMPOSITE_APPLICATION_INTENT / SPLIT_AUTHORITY**

| Mutation | Owner |
|----------|--------|
| `addToCuration(...)` | **Execution Delivery Application** |
| `decideSignal(..., SAVED)` | **Signal Intake Application** |

No single false owner. Future canonicalization must compose two Application
authorities without duplicating Domain rules. `CU? = NO`. MVP E2E = REQUIRED.

### Post-MVP presentation state

**ID 23 — POST_MVP_NO_CURRENT_OWNER_REQUIRED**

`toggleTopicPin` mutates global `topicPins[]` workspace UI preference — not
Signal Intake business lifecycle, not SPEC-001 routing state, not strategic
authority. Registry owner label: `POST_MVP_PRESENTATION_STATE`. No Application
use case required for ownership bookkeeping. MVP E2E = NOT_REQUIRED.

---

## Human decisions ratified (Phase B)

| ID | Decision |
|----|----------|
| **21** | Split: Execution Delivery + Signal Intake; no sixth boundary |
| **22** | Signal Intake owns legacy recommendation persistence only; SPEC-001 routing unchanged |
| **23** | POST_MVP presentation workspace state |
| **30** | Master Profile vault owner; `verified: true` = nonauthoritative legacy metadata |
| **33** | Execution Delivery content create owner; SaveContentDraft contract not expanded |

---

## Stage B disposition

| Class | IDs |
|-------|-----|
| **REQUIRED BEFORE STAGE B** | **9, 18** (scheduler ingest + `sendDelivery` orchestration anchored in `main.ts`) |
| **LEGACY ISLANDS ALLOWED** | 2, 3, 4, 5, 6, 7, 14, 15, 16, 17, 19, 20, 21, 22, 25, 27, 29, 30, 33 |
| **POST_MVP** | 23 |

---

## MVP E2E disposition

| Class | IDs |
|-------|-----|
| **REQUIRED** | 9, 14, 15, 16, 17, 18, 19, 20, 21, 27, 33 |
| **PARTIAL** | 2, 3, 4, 5, 6, 22, 25, 29, 30 |
| **NOT REQUIRED** | 7, 23 |

---

## CR-1 status after ratification

| Field | Value |
|-------|--------|
| CR-1 OWNERSHIP DECISION | **COMPLETE** |
| CR-1 CUTOVER SPINE | **12/12** |
| CR-1 FIVE WORKSTREAMS | **COMPLETE** |
| CR-1 NONCUTOVER OWNER DISPOSITION | **COMPLETE** |
| CR-1 NONCUTOVER IMPLEMENTATION | **DEBT / DEFERRED** |
| CR-1 UMBRELLA | **CODE_COMPLETE_WITH_DEBT** |
| CR-2 | **OPEN** (no dependency among these 22) |
| T-010-403 / T-010-404 | **BLOCKED_BY_OTHER_PRECONDITION** |
| Phase 5 | **NOT_AUTHORIZED** |

---

## Evidence

- Phase A reconciliation: read-only trace at `6579f9a9c247eb9c2ac2f57cd8251d52470786a6`
- Registry reconciliation: `specs/010-react-migration/audit010-09-registry.md`
- Cutover workstreams: `cr-1-client-lifecycle.md` … `cr-1-execution-delivery-classification-r2.md`

**NEXT ACTION:** `IMPLEMENT_CR2` (CR-2 signature remediation — not authorized in this pass)
