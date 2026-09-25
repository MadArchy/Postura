# T-010-604 W3 — A41 Six-Dimension Governance Disposition

**Status:** `PHASE6_T604_W3_A41_DIMENSION_DISPOSITION_COMPLETE`  
**Class:** `GOVERNANCE_DISPOSITION`  
**Branch:** `spec/010-react-migration`  
**Checkpoint HEAD:** `ba3b55ac3b964ed9500b41d92a8ba9f044517080`  
**Authorization freeze:** `PHASE6_T604_W3_A41_DISPOSITION_AUTHORIZATION_FROZEN`  
**Authorization:** `AUTHORIZE_PHASE6_T604_W3_A41_DIMENSION_DISPOSITION`  
**Human PASS-bar freeze:** `PHASE6_T604_W3_HUMAN_PASSBAR_DECISION_FROZEN`

This record formally dispositions the six previously unresolved A41 applicable-dimension
cells under frozen **A41-C**.

It does **not** promote A41 to PASS.  
It does **not** modify `acceptance.md`.  
It does **not** change GLOBAL C3.  
It does **not** authorize T-010-604.  
It does **not** migrate deferred legacy commands.  
It does **not** remove hybrid hosts.  
It does **not** modify Product / Runtime / React / tests.

---

## 1. Purpose

Record evidence-backed dispositions for A41 dimensions **1 · 7 · 8 · 10 · 14 · 17**
across all **16** migrated modules in the governed SPEC-010 Phase-6 boundary, so that
a later separate gate may consider A41 governance promotion.

---

## 2. Governing human decisions

| Decision | Value |
|----------|--------|
| A10 HUMAN DECISION | **A10-B** |
| A10 PASS BAR | `REACT_PHASE6_OWNED_COMMAND_CONVERGENCE` |
| A10 STATUS | **PASS** (`ba3b55ac`) |
| A41 HUMAN DECISION | **A41-C** |
| A41 PASS BAR | `MIGRATED_MODULE_APPLICABLE_DIMENSION` |
| A41 STATUS (this record) | **PARTIAL** (unchanged) |
| GLOBAL T603 SCOPE DECISION | **A** |
| GLOBAL C3 | **PARTIAL** |
| C3 DIRECT T604 PREREQUISITE | **NO** |
| A41 CAN CLOSE WITH C3 PARTIAL | **YES** |

---

## 3. Frozen A41-C pass bar

For every module actually migrated within the governed SPEC-010 Phase-6 boundary,
every applicable parity dimension must be either:

1. demonstrated **PARITY**; or  
2. **FORMALLY_DISPOSITIONED** with traceable repository evidence.

Allowed disposition classes used in this record:

- `PARITY`
- `DEFERRED_LEGACY_COMMAND`
- `ACCEPTED_SECURITY_STRENGTHENING`
- `ACCEPTED_BEHAVIOR_CHANGE`
- `NONBLOCKING_ACCESSIBILITY_LIMITATION`
- `NOT_APPLICABLE`

Forbidden: generic PARTIAL · unknown · TBD · blank · silent waiver.

---

## 4. Authoritative evidence sources (READ-ONLY)

| Source | Role |
|--------|------|
| `specs/010-react-migration/parity-model.md` | 18-dim model; Phase-3 table; named quirks; `DEFERRED_LEGACY_COMMAND` taxonomy |
| `specs/010-react-migration/t-010-phase6-pre-removal-gates.md` | Reconciled 18-dim states; deferred CR-1 groups |
| `specs/010-react-migration/t-010-603-global-closure.md` | Decision A; nine families; broader hosts OUT |
| T603 family subset-removal records | Leaf removal + family A38 PASS |
| `src/ui/commands/commandSeam.ts` | React-owned command inventory; #22 not exposed |
| `tests/t010506DualAuthorityAdversarial.test.ts` | React dual-command authority = 0 |
| `tests/t010503WritePathAdversarial.test.ts` | React write-path / facade |
| `tests/t010509AccessibilityPerformance.test.ts` | T-509 static a11y (7) |
| `specs/010-react-migration/t-010-phase5-regression-parity-security-e2e.md` | T-509 PARTIAL / NONBLOCKING_DEBT |
| A10-B promotion evidence @ `ba3b55ac` | React-owned command convergence PASS |

---

## 5. Exact module inventory (16)

### T603 nine (legacy leaves ABSENT; React surfaces served)

| # | Module ID | React surface |
|---|-----------|---------------|
| M01 | MasterDossier | `ReactMasterDossierPanel.tsx` |
| M02 | Opportunity | `ReactOpportunityPanel.tsx` |
| M03 | KPI | `ReactKpiWeeklyChart.tsx` |
| M04 | ClientProfile | `ReactClientProfilePanel.tsx` |
| M05 | ProofWall | `ReactProofWallPanel.tsx` |
| M06 | ClaimSafety | `ReactClaimSafetyPanel.tsx` |
| M07 | PageHeader | `ReactPageHeader.tsx` |
| M08 | SourceRegistry | `ReactSourceRegistryPanel.tsx` |
| M09 | Onboarding | `ReactOnboardingWizard.tsx` |

### Wave-3 / hybrid React surfaces

| # | Module ID | React surface |
|---|-----------|---------------|
| M10 | ThesisEditor | `ReactThesisEditorPage.tsx` |
| M11 | ManagerCockpit | `ReactManagerCockpitPage.tsx` |
| M12 | Modals | `ReactModals.tsx` |
| M13 | ClientPortal | `ReactClientPortalPage.tsx` |
| M14 | ClientWorkspace | `ReactClientWorkspacePage.tsx` |

### Additional React surfaces

| # | Module ID | React surface |
|---|-----------|---------------|
| M15 | ReactLogin | `ReactLogin.tsx` |
| M16 | ReactAppShell | `ReactAppShell.tsx` |

**MODULE COUNT = 16.** Broader legacy hosts (`LegacyApp`, dual `Login`/`AppShell` legacy twins as deletion targets) are **not** listed as migrated modules.

---

## 6. Exact dimension inventory (6)

| ID | Dimension |
|----|-----------|
| D1 | Rendered capability |
| D7 | Permissions |
| D8 | Commands / actions |
| D10 | Validation |
| D14 | Legacy quirks |
| D17 | Accessibility |

**DIMENSION COUNT = 6.**

---

## 7. Module × dimension disposition matrix

Legend: **P** = `PARITY` · **DLC** = `DEFERRED_LEGACY_COMMAND` · **ASS** = `ACCEPTED_SECURITY_STRENGTHENING` · **ABC** = `ACCEPTED_BEHAVIOR_CHANGE` · **NAL** = `NONBLOCKING_ACCESSIBILITY_LIMITATION` · **NA** = `NOT_APPLICABLE`

| Module | D1 | D7 | D8 | D10 | D14 | D17 |
|--------|----|----|----|-----|-----|-----|
| M01 MasterDossier | P | ASS | P | P | NA | NAL |
| M02 Opportunity | P | ASS | P | P | NA | NAL |
| M03 KPI | P | ASS | P | P | NA | NAL |
| M04 ClientProfile | P | ASS | P | P | NA | NAL |
| M05 ProofWall | P | ASS | P | P | NA | NAL |
| M06 ClaimSafety | P | ASS | P | P | NA | NAL |
| M07 PageHeader | P | ASS | P | P | NA | NAL |
| M08 SourceRegistry | P | ASS | P | P | NA | NAL |
| M09 Onboarding | P | ASS | P | P | NA | NAL |
| M10 ThesisEditor | P | ASS | P | P | ABC | NAL |
| M11 ManagerCockpit | P | ASS | P | P | ABC | NAL |
| M12 Modals | DLC | ASS | DLC | DLC | ABC | NAL |
| M13 ClientPortal | DLC | ASS | DLC | DLC | ABC | NAL |
| M14 ClientWorkspace | DLC | ASS | DLC | DLC | ABC | NAL |
| M15 ReactLogin | P | ASS | P | P | NA | NAL |
| M16 ReactAppShell | P | ASS | P | P | NA | NAL |

**BLANK CELLS = 0 · GENERIC PARTIAL CELLS = 0 · CELLS = 96.**

Where a hybrid cell is **DLC**, React-served subsets remain at capability/action/validation parity; the cell disposition records the residual deferred-legacy class that previously kept the dimension PARTIAL under A41-C.

---

## 8. Dimension 1 — Rendered capability

### Aggregate disposition

| Class | Applies to |
|-------|------------|
| `PARITY` | M01–M11, M15–M16 — React-served capabilities reachable / truthful |
| `DEFERRED_LEGACY_COMMAND` | M12 Modals · M13 ClientPortal · M14 ClientWorkspace — residual capabilities retained on legacy / LegacyHandoff |

### Deferred residuals (D1)

| Behavior | Modules | Owner | User-visible | Why not a true A41-C gap |
|----------|---------|-------|--------------|-------------------------|
| Deferred CR-1 / registry writes not React-owned | M12–M14 | Legacy handlers + CR-1 registry | YES (handoff / legacy island) | Classified deferred; React does not falsely claim the capability |
| Hybrid page blocked actions | M12–M14 | Legacy | YES | Truthful handoff / disabled; see dim 8/9 evidence in parity-model |

**TRUE GAP = 0 · CODE REQUIRED = NO · BLOCKING TEST = NO**

Evidence: `parity-model.md` (dim 1 PARTIAL rationale) · `t-010-phase6-pre-removal-gates.md` · T603 family closures (M01–M09 served).

---

## 9. Dimension 7 — Permissions

### Aggregate disposition

All 16 modules: **`ACCEPTED_SECURITY_STRENGTHENING`**

| Field | Record |
|-------|--------|
| Legacy | Mixed shell/session inheritance; some surfaces weaker fail-open historically |
| React | No migrated page renders without trusted session; fail-closed tenant/actor scope (T-501 · E2E3 · shell) |
| Trusted-session authority | Preserved; React cannot establish tenant/actor |
| Security effect | Strengthened / fail-closed — **not** a regression |
| SECURITY REGRESSION | **0** |
| AUTHORITY WEAKENING | **0** |
| TRUE GAP | **0** |
| CODE REQUIRED | **NO** |

Evidence: `parity-model.md` dim 7 · T-010-501 adversarial · T-508 auth journeys · Stage-B shell.

---

## 10. Dimension 8 — Commands / actions

### Aggregate disposition

| Class | Applies to |
|-------|------------|
| `PARITY` | M01–M11, M15–M16 — React-owned actions via `commandSeam` → consumer/Application |
| `DEFERRED_LEGACY_COMMAND` | M12–M14 — residual legacy-only actions coexist with seam-owned actions |

Reconciled with frozen **A10-B**: React-owned strategic commands converge on the seam; legacy-only writes outside React ownership do **not** block A10 and are dispositioned here for A41-C.

### Deferred legacy-only inventory (explicit)

| ID | Name | Owner | REACT-OWNED | COMPETES | MIGRATED | Classification | Evidence |
|----|------|-------|-------------|----------|----------|----------------|----------|
| #22 | addRecommendation / score-investigate UI | Signal Intake (persist PARTIAL) | **NO** | **NO** | **NO** | `DEFERRED_LEGACY_COMMAND` | `commandSeam.ts` L1000 “NOT exposed”; workspace radarHandlers |
| #23 | Topic pin | POST_MVP / presentation | **NO** | **NO** | **NO** | `DEFERRED_LEGACY_COMMAND` | filtersHandlers; gates POST_MVP |
| #25 | Source pause / activate / archive | Signal Intake CU?=NO | **NO** | **NO** | **NO** | `DEFERRED_LEGACY_COMMAND` | sourcesHandlers; LegacyHandoff |
| #29 | Evidence ↔ thesis | Master Profile CU?=NO | **NO** | **NO** | **NO** | `DEFERRED_LEGACY_COMMAND` | thesisHandlers |
| #30 | Add evidence | Master Profile CU?=NO | **NO** | **NO** | **NO** | `DEFERRED_LEGACY_COMMAND` | content/portal; KEEP_LEGACY |
| #33 | CreateContentDraft **legacy UI** | Execution Delivery (App may exist) | **NO** (UI) | **NO** | **NO** (UI) | `DEFERRED_LEGACY_COMMAND` | seam note “#33 presentation (legacy)”; Modals |

These writes are **not** represented as migrated.

**TRUE GAP = 0 · CODE REQUIRED = NO** (for A41-C disposition)

Evidence: A10-B @ `ba3b55ac` · `commandSeam.ts` · T-506 · audit010-09 / CR-1 noncutover · pre-removal gates.

---

## 11. Dimension 10 — Validation

### Aggregate disposition

| Class | Applies to |
|-------|------------|
| `PARITY` | M01–M11, M15–M16 — RHF/Zod shape-only; Domain remains authoritative on migrated actions |
| `DEFERRED_LEGACY_COMMAND` | M12–M14 — full rejection-outcome parity deferred with deferred commands |

| Module class | Legacy validation | React validation | Difference | Classification |
|--------------|-------------------|------------------|------------|----------------|
| Migrated actions | Domain / legacy UI | Shape UI + Domain reject | Domain authority preserved | `PARITY` |
| Deferred-only actions | Legacy UI + Domain | Not React-owned | N/A on React surface | `DEFERRED_LEGACY_COMMAND` |

**TRUE GAP = 0 · CODE REQUIRED = NO**

Evidence: `parity-model.md` dim 10 · T-501 · A10-B seam coverage.

---

## 12. Dimension 14 — Legacy quirks (`ACCEPTED_BEHAVIOR_CHANGE`)

### Traceable quirk register

| QUIRK ID | MODULE | LEGACY BEHAVIOR | REACT BEHAVIOR | RATIONALE | INTENTIONAL | EVIDENCE | SECURITY | USER IMPACT | BLOCKING |
|----------|--------|-----------------|----------------|-----------|-------------|----------|----------|-------------|----------|
| Q14-01 | M12 Modals | Unescaped `diffHtml` injection | Safe text rendering | XSS / injection hardening | **YES** | `parity-model.md` L67; `ReactModals.tsx`; `compatibilityReads.ts` ~L1021 | Improves | Visual diff text-only | **NO** |
| Q14-02 | M10 ThesisEditor | Silent fallback to create-on-unknown-id | Explicit error / no silent create | Removes accidental authority | **YES** | `parity-model.md` L67; `ReactThesisEditorPage.tsx` | Improves | Clearer error | **NO** |
| Q14-03 | M12 Modals | `approvedBriefs[0]` authority assumption | Explicit empty / confirmed id | Multi-thesis native | **YES** | `parity-model.md` L67; `ReactModals.tsx`; `canonicalReads.ts` | Improves | No implicit brief | **NO** |
| Q14-04 | M11 ManagerCockpit | `getActiveTheses(id)[0]` authority | Count / all titles / explicit scope | Multi-thesis native | **YES** | `parity-model.md` L67; `ReactManagerCockpitPage.tsx`; `compatibilityReads.ts` ~L553 | Improves | No primary thesis | **NO** |
| Q14-05 | M14 ClientWorkspace | Two render-time agent runs | Intentionally retained legacy / not React authority | Avoid recreating EFFECT_FIRST in React | **YES** | `parity-model.md` L67; `compatibilityReads.ts` L514–516 | Neutral | Legacy retains runs | **NO** |

### Additional named extras (traceable; included)

| QUIRK ID | MODULE | Summary | EVIDENCE | BLOCKING |
|----------|--------|---------|----------|----------|
| Q14-06 | M11 ManagerCockpit | `aiService.isServerGatewayAvailable()` render probe not reproduced | `tasks.md` L360; `compatibilityReads.ts` L517–519 | **NO** |
| Q14-07 | M13 ClientPortal | `awaiting[0] \|\| ACTIVE \|\| theses[0]` positional fallback removed | `tasks.md` L374–375; portal multi-thesis notes | **NO** |

Modules without applicable named quirks: **`NOT_APPLICABLE`** (M01–M09, M15–M16).

**UNTRACEABLE ACCEPTED CHANGES = 0 · TRUE GAP = 0**

---

## 13. Dimension 17 — Accessibility

### Aggregate disposition

All 16 modules: **`NONBLOCKING_ACCESSIBILITY_LIMITATION`**

| Field | Record |
|-------|--------|
| Evidence | `tests/t010509AccessibilityPerformance.test.ts` (7) — T-010-509 |
| Static a11y | Labels · `role=alert/status` · PanelState · keyboard buttons · disabled/error association |
| Keyboard / focus | Architectural/static evidence present |
| Labels / ARIA | Static evidence present |
| Contrast / runtime audit tooling | **Absent** — documented NONBLOCKING_DEBT |
| Why nonblocking under A41-C | Phase-5 formal closure records T-509 PARTIAL / NONBLOCKING_DEBT; no blocking a11y FAIL; migrated modules carry semantic controls |
| T-509 SUFFICIENT for A41-C | **YES** |
| ADDITIONAL BLOCKING TARGETED TEST | **NO** |
| CODE REMEDIATION | **NO** |
| TRUE GAP | **0** |
| External WCAG certification | **NOT CLAIMED** |

Evidence: `t-010-phase5-regression-parity-security-e2e.md` · `t-010-phase5-formal-closure.md` · T-509 test file.

---

## 14. GLOBAL C3 relationship

| Field | Value |
|-------|--------|
| GLOBAL C3 | **PARTIAL** |
| C3 DIRECT T604 PREREQUISITE | **NO** |
| A41-C relation | Uses migrated-module applicable-dimension bar |
| A41 CAN CLOSE WHILE C3 REMAINS PARTIAL | **YES** |
| This record changes C3 | **NO** |
| This record implies GLOBAL 18-dim completion | **NO** |

---

## 15. Gap summary

| Metric | Count |
|--------|------:|
| TRUE GAPS | **0** |
| BLOCKING TEST GAPS | **0** |
| CODE REMEDIATION GAPS | **0** |
| EXTERNAL DEPENDENCIES | **0** |
| UNRESOLVED PASS-BAR HUMAN DECISIONS | **0** |
| FORMAL DISPOSITION DIMENSIONS | **6 / 6** |
| MODULES COVERED | **16 / 16** |
| BLANK MATRIX CELLS | **0** |
| GENERIC PARTIAL CELLS | **0** |
| UNTRACEABLE ACCEPTED CHANGES | **0** |

---

## 16. Promotion-readiness conclusion

| Field | Value |
|-------|--------|
| A41 STATUS | **PARTIAL** |
| A41 SIX DIMENSIONS FORMALLY DISPOSITIONED | **YES** |
| A41 PROMOTION READINESS | **READY_FOR_SEPARATE_GOVERNANCE_PROMOTION** |
| A41 PROMOTED BY THIS RECORD | **NO** |
| Matrix unchanged | **40 PASS / 1 PARTIAL / 3 PENDING** |

Next gate class (not executed here):

`PHASE6_T604_W3_A41_GOVERNANCE_PROMOTION_AUTHORIZATION_FREEZE_REQUIRED`

---

## 17. Non-authorizations

| Item | Status |
|------|--------|
| A41 PROMOTED | **NO** |
| acceptance.md modified | **NO** |
| A25 / A31 / A44 work | **NO** |
| T-010-604 authorized | **NO** |
| CODE_COMPLETE | **NO** |
| Phase 6 complete | **NO** |
| Deployment authorized | **NO** |
| Deferred command migration | **NO** |
| Hybrid host removal | **NO** |
| Test / Product / Runtime / React mutation | **NO** |
| Push | **NONE** |

---

## 18. Record integrity

| Field | Value |
|-------|--------|
| ARTIFACT | `specs/010-react-migration/t-010-604-w3-a41-dimension-disposition.md` |
| MODE | **NEW** |
| FILE COUNT | **1** |
| SUPPORTING FILES MODIFIED | **0** |
