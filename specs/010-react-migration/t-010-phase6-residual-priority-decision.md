# SPEC-010 Phase 6 — Residual frontier priority decision

**Class:** `GOVERNANCE_PRIORITY_DECISION`  
**Status:** `PHASE6_RESIDUAL_PRIORITY_28_P3B`  
**Branch:** `spec/010-react-migration`  
**Decision HEAD:** `a5974e41287f3cc234b3da70b9b3e0319643ba50`  
**Kind:** NEW Phase-6 priority policy — not a historical sequencing discovery

This record establishes the missing residual-frontier priority after
`RESIDUAL_FRONTIER_GOVERNANCE_SELECTION_UNRESOLVED`.

It is **not** implementation.  
It is **not** a design implementation.  
It is **not** T-010-603 authorization.  
It is **not** T-010-604 authorization.  
It does **not** reopen other residuals.  
It does **not** invent use cases or convert CU?=NO to CU?=YES.

---

## Historical governance vs this decision

| Item | Result |
|------|--------|
| Historical repository ordering | **UNRESOLVED** |
| Residual selection review | **COMPLETE** |
| Authorized candidate set | **5** |
| Implementation authorization before this record | **NONE** |
| This step | **NEW PHASE-6 PRIORITY DECISION** |

No prior acceptance file uniquely selected the next residual. This document
does not rewrite those files. It supplies the missing priority rule.

---

## Authorized candidate set considered

| ID | Residual |
|----|----------|
| A | `#16` `RemoveCuration` / `ReopenCuration` |
| B | `#21` advisor `AddAdviceActionToCuration` |
| C | `#28` / P3B — video / teleprompter / `attach_evidence` / recordings |
| D | Source Management — `#8` `#9` `#24` `#26` |
| E | `#33` `CreateContentDraft` |

Hard exclusions (not selectable): CU?=NO rows · `#22` · P5 AI · impersonation ·
Firestore push · pipeline controller · `ws-briefing` · P12 tab copy ·
T603 retention · POST_MVP `#23`.

---

## New Phase-6 priority policy

The next residual frontier should preferentially advance migration/cutover
completion while avoiding unnecessary expansion into missing business
authority or external-owner work.

Optimize for, in this order of application:

1. cutover-spine relevance;
2. existing frozen canonical authority;
3. ability to scope the design without inventing new business authority;
4. no required external-owner approval before the bounded design review can start;
5. reduction of active legacy dependency;
6. preservation of rollback;
7. bounded design surface;
8. no dependency on CU?=NO functionality being invented by SPEC-010.

---

## Stage-1 filter — migration-critical / cutover-spine

| Residual | Cutover-spine | Stage-1 |
|----------|---------------|---------|
| `#28` / P3B | **YES** | **IN** |
| Source Management `#8` `#9` `#24` `#26` | **YES** | **IN** |
| `#16` | NO | OUT — feature-completeness |
| `#21` advisor | NO | OUT — feature-completeness; new React advisor surface |
| `#33` | NO | OUT — SPEC-005 / create / security; SPEC-010 cannot design alone |

STAGE-1 CANDIDATES = `#28/P3B` · Source Management

`#16` and `#21` do not outrank migration-critical candidates under this policy.  
`#33` PRIORITY ELIGIBILITY = **DEPRIORITIZED** (external AI/create governance
required before a bounded SPEC-010-only design; not cutover-spine).

---

## Stage-2 filter — bounded design without missing authority

### `#28` / P3B

| Check | Result |
|-------|--------|
| Canonical command | `TransitionClientTask` **FROZEN** |
| Canonical authority complete | **YES** |
| New business authority | **NO** |
| CU?=NO blocker inside selected command | **NO** |
| External owner | **NO** for canonical task transition |
| Named prior decomposition | **YES** (`future P3B` in P3A) |
| P3B current authorization | **NO** (name ≠ authorization; this record authorizes priority only) |
| Product / media complexity | HIGH (does not disqualify a design review) |

### Source Management

| Check | Result |
|-------|--------|
| CU?=YES commands | `RegisterSource` · `PollRegisteredSource` · `RegisterManualSignal` **FROZEN** |
| New business authority for CU?=YES portion | **NO** |
| CU?=YES design review boundable without `#25` | **YES** |
| `#25` prevents design review | **NO** |
| `#25` prevents complete host cutover | **YES** |
| Full host replacement without `#25` | **NO** |
| Product replacement breadth | larger cluster / shared host |
| External/product owner coordination | Signal Intake owner + `#25` CU invention if host cutover is in scope |

STAGE-2 RESULT = `#28/P3B`

Source Management remains a coherent later design cluster. It does not win
this priority because complete host cutover depends on `#25` (CU?=NO) and the
T-010-26 product-replacement surface is broader than a single frozen command.

---

## Stage-3 filter — design-review boundedness

### `#28` / P3B

| Item | Result |
|------|--------|
| BOUNDARY CLARITY | `TransitionClientTask` intents `start` + `attach_evidence`; video teleprompter; recordings host |
| ADJACENT UNAUTHORIZED WORK | `#30` vault (CU?=NO); `#32` already accepted; P3A generic intents already accepted; pipeline |
| DESIGN REVIEW CAN REMAIN BOUNDED | **YES** |
| Rollback | KEEP_LEGACY / island rollback remains required |

### Source Management (finalist, not selected)

| Item | Result |
|------|--------|
| BOUNDARY CLARITY | CU?=YES trio vs full host replacement (T-010-26) |
| ADJACENT UNAUTHORIZED WORK | `#25` · discovery |
| DESIGN REVIEW CAN REMAIN BOUNDED | **YES** for CU?=YES only; host-level cutover **NO** |

---

## Formal priority decision

**FORMAL PRIORITY DECISION** = `PHASE6_RESIDUAL_PRIORITY_28_P3B`  
**SELECTED RESIDUAL** = `#28` / P3B  
**NEXT ACTION** = `AUTHORIZE_28_P3B_RESIDUAL_DESIGN_REVIEW`

Reasons (migration / cutover authority, not implementation convenience):

* cutover-spine residual with a frozen command;
* no new business authority and no external owner before design review can start;
* selected command has no CU?=NO core blocker;
* P3A already named this remainder as a distinct residual class;
* design review can stay inside `#28` video / `attach_evidence` / recordings
  without inventing use cases;
* rollback remains intact.

---

## Explicitly not selected

| Residual | Why not selected under this policy |
|----------|-------------------------------------|
| `#16` | Not cutover-spine; feature-completeness only; A43 LOW |
| `#21` advisor | Not cutover-spine; requires a new React advisor surface; A43 LOW |
| Source Management | Spine-relevant but `#25` blocks host cutover; larger product-replacement cluster |
| `#33` | Not spine; SPEC-005 AI / create / security; SPEC-010 cannot design alone |

Other residuals are **NOT REOPENED**.

---

## Non-authorizations

| Item | Status |
|------|--------|
| P3B DESIGN REVIEW | **NEXT ACTION ONLY** — not executed by this record |
| Residual implementation | **NOT_AUTHORIZED** |
| READ_ONLY_REACT write promotion | **NOT_AUTHORIZED** |
| Legacy deletion | **NOT_AUTHORIZED** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |
| CU?=NO work | **NOT_AUTHORIZED** |
| SAFE LEGACY SUBSET | **NONE** |
| PUSH | **NONE** |
