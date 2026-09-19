# T-010 — Master Profile Fact Lifecycle React Write Parity

**Status:** `PROFILE_FACT_REACT_PARITY_FORMALLY_ACCEPTED_WITH_NONBLOCKING_DEBT`  
**Acceptance date:** 2026-09-19  
**Branch:** `spec/010-react-migration`  
**Pre-acceptance HEAD:** `edb29b999819b0c568ca3a0276d41e865b74f875`  
**Implementation commit:** `edb29b999819b0c568ca3a0276d41e865b74f875`  
**Owner:** CR-1 Master Profile Application  
**Residuals:** `#2` · `#3` · `#4` · `#5` · `#6`  
**CU?:** YES  
**Canonical status:** `CANONICALIZED_AND_FROZEN`  
**Implementation shape:** ONE_WAVE

This record accepts the **React presentation write wave** for Master Profile fact lifecycle residuals `#2`–`#6`.  
It is **not** canonical command change.  
It is **not** registry / `CU?` conversion.  
It is **not** `#7` ProofWall readiness.  
It is **not** T-010-603 legacy subset removal.  
It is **not** T-010-604 CODE_COMPLETE.

Historical `#21`, `#16`, Source Management, P-wave, canonical fact-authority, and earlier acceptance records are **not** rewritten.

---

## Provenance

| Role | Value |
|------|--------|
| OWNER DECISION | APPROVE — fact lifecycle `#2`–`#6` |
| CANONICAL IMPLEMENTATION | `40f9b59472a194f3e27e19f668e223863780a15e` |
| CANONICAL ACCEPTANCE | `14a8436fca83c61b0bdfd69f96272c803f810b45` |
| REGISTRY RECONCILIATION | `1b7ac89509be14d291554d29471c2b2f38c48b16` |
| DESIGN DECISION | `PROFILE_FACT_REACT_PARITY_READY_FOR_BOUNDED_IMPLEMENTATION` |
| IMPLEMENTATION DECISION | `PROFILE_FACT_REACT_PARITY_IMPLEMENTATION_VERIFIED_READY_FOR_COMMIT` |
| FEATURE | `edb29b999819b0c568ca3a0276d41e865b74f875` |
| SUBJECT | `feat(react): add profile fact write parity` |
| Pre-acceptance HEAD | `edb29b999819b0c568ca3a0276d41e865b74f875` |

Feature `edb29b9` is HEAD at this review. This commit adds governance only.

---

## Feature manifest (`edb29b9`)

| Class | File |
|-------|------|
| PRODUCT_UI | `src/ui/modules/ClientProfile/ReactClientProfilePanel.tsx` |
| PRODUCT_HOOK | `src/ui/hooks/useWave2Data.ts` |
| COMMAND_ADAPTER | `src/ui/commands/commandSeam.ts` |
| QUERY_READ | `src/ui/data/compatibilityReads.ts` |
| TEST | `tests/reactParityWaveProfileFactLifecycle.test.ts` |
| E2E | `e2e/reactParityWaveProfileFactLifecycle.spec.ts` |
| TEST / STALE_EXPECTATION_RECONCILIATION | `tests/reactMigrationPhase2Architecture.test.ts` |

**Unauthorized modifications in feature:** Application **0** · Domain **0** · Auth **0** · persistence **0** · Registry **0** · Governance **0** · legacy business **0** · legacy delete **0** · `#7` **0** · other residual **0** · unrelated **0**.

---

## Accepted React authority (unchanged canonical commands)

| Residual | Command |
|----------|---------|
| `#2` | `AddProfileFact` |
| `#3` | `ConfirmProfileFact` |
| `#4` | `RejectProfileFact` |
| `#5` | `UpdateProfileFact` |
| `#6` | `ImportProfileFactsFromCv` |

`ApplyOnboardingStep` (#10) remains unchanged.

| Field | Value |
|-------|-------|
| HOST | `ReactClientProfilePanel` · Wave2 `client-profile` · “Mi perfil” |
| ADMIN NATIVE WORKSPACE TAB | **NONE** |
| IMPERSONATION CHANGED | **NO** |
| CLIENT ROUTING CHANGED | **NO** |
| READ | `useProfileOverview` → `readProfileOverview` · key `profile-overview` |
| READ EXTENSION | `cvExtractedText` from already-loaded `getMasterProfile` only |
| NEW BUSINESS QUERY | **0** |
| SEAM | `masterProfileCommands` five adapters |
| HOOKS | `useAddProfileFact` · `useConfirmProfileFact` · `useRejectProfileFact` · `useUpdateProfileFact` · `useImportProfileFactsFromCv` in `useWave2Data.ts` |
| useWave3Data | **0** |
| GENERIC MUTATOR | **NO** |
| CONSUMER | `masterProfileConsumer` → frozen Application commands |
| CALLER ROLE / ORG / ACTOR | **0** |
| STATUS / SOURCE AUTHORITY | **0** |
| INVALIDATION | `tenantInvalidationKey(scope, 'compatibility')` for all five |
| GLOBAL / SESSION / RADAR / DELIVER / SOURCE INVALIDATION | **NO** |
| MANUAL CACHE PATCH | **NO** |
| COMPLETENESS MATH | **0** — consumes `profileCompleteness` |
| React dbService write | **0** |
| Direct Firestore write | **0** |
| LOCAL TRANSITION AUTHORITY | **0** |
| CV EXTRACTION / DEDUP / CLASSIFICATION IN REACT | **0** |
| AI / NETWORK / REMOTE UPLOAD | **NO** |

Mutation path:

`ReactClientProfilePanel` → Wave2 hook → `masterProfileCommands` → `masterProfileConsumer` → frozen command.

---

## Product surface

| Action | Control | Component input | Success |
|--------|---------|-----------------|---------|
| `#2` Add | `+ Añadir` inline | `{ section, label, value }` | `Fact añadido` |
| `#3` Confirm | `Confirmar` | `{ factId }` | `Fact confirmado` |
| `#4` Reject | `Descartar` | `{ factId }` | `Fact descartado` |
| `#5` Update | `Editar` value only | `{ factId, value }` | `Fact actualizado` |
| `#6` CV import | paste + `.txt/.md` `file.text()` + `Extraer facts candidatos` | `{ cvText }` | `N facts candidatos extraídos` or `No se encontraron facts nuevos` |

| Field | Value |
|-------|-------|
| PRESENTATION MATRIX | candidate = Confirm + Reject · confirmed = Edit · rejected hidden by factual read |
| CV PREFILL | `cvExtractedText.slice(0, 2000)` presentation only |
| FILE SIZE POLICY INVENTED | **NO** |
| ERROR SURFACE | inline `statusMessage` · `CommandResult.message` |
| ERROR CODE LEAK | **NO** |
| PENDING | disable active add / row / CV submit |
| BUSINESS IDEMPOTENCY INVENTED | **NO** |
| PRODUCT SURFACE | **PASS** |

---

## Role / tenant

| Field | Value |
|-------|-------|
| COMPONENT SCOPE | `useSession().tenantScope.clientId` |
| HOOK | `requestedClientId: scope.clientId` |
| CONSUMER | `requireTenantScope` |
| UI AUTHORIZATION REPLACEMENT | **NO** |
| CLIENT FOREIGN | **FAIL-CLOSED** (`No puedes operar sobre otro cliente.`) |
| NEW MANAGER ROUTE | **0** |
| NEW ROLE / TENANT POLICY | **0** |
| ROLE/TENANT | **PASS** |

---

## Historical test reconciliation

Only `tests/reactMigrationPhase2Architecture.test.ts` was reconciled. CLASS = `STALE_EXPECTATION_RECONCILIATION`.

| Item | OLD | NEW | WHY |
|------|-----|-----|-----|
| A `BLOCKED_MUTATORS` | banned `addProfileFact` / `confirmProfileFact` / `rejectProfileFact` / `updateProfileFact` | those four names removed; comment records canonical seam path | CU?=YES and React write authorized; names now appear in seam/hooks |
| B `importCandidateFactsFromCv` | blocked | **still blocked** | legacy persistence symbol; React uses `importProfileFactsFromCv` |
| C `updateProofWallItem` | blocked | **still blocked** | `#7` remains CU?=NO |
| D exclusive `DISPLAY_ONLY` | profile panel required `data-authority="DISPLAY_ONLY"` | profile required `PRESENTATION`; ProofWall/SourceRegistry still `READ_ONLY`/`DISPLAY_ONLY` | native writes make exclusive display-only stale |
| E full delegation | profile panel required in read-only “interfaz anterior” list | profile removed from that list; ProofWall/SourceRegistry remain | full delegation is no longer the write path |
| F rollback | implied by delegation list | explicit: profile still requires `applyUiMode` + `interfaz anterior` | rollback retained |
| G P6 wizard | forbids profile CRUD | **unchanged** in `reactParityWaveP6ClientOnboardingWrite.test.ts` | wizard isolation still valid |

TEST WEAKENING = **0**  
UNRELATED TEST CHANGE = **0**  
HISTORICAL TEST RECONCILIATION = **PASS**

---

## Mandatory gate matrix (this review)

| Gate | Required | Result |
|------|----------|--------|
| HOST | PASS | Wave2 `client-profile` only · no manager tab |
| READ EXTENSION | PASS | `cvExtractedText` only |
| COMMAND SEAM | PASS | five adapters · consumer only |
| HOOKS | PASS | five Wave2 hooks |
| COMPONENT INPUT SECURITY | PASS | DTOs as designed |
| CALL PATH | PASS | panel → hook → seam → consumer → command |
| ADD / CONFIRM / REJECT / UPDATE | PASS | |
| PRESENTATION MATRIX | PASS | |
| CV IMPORT / PREFILL | PASS | text only · `file.text()` · slice 2000 |
| INVALIDATION | PASS | tenant compatibility only |
| COMPLETENESS | PASS | consume only |
| FEEDBACK/PENDING | PASS | |
| ROLE/TENANT | PASS | |
| HISTORICAL RECONCILIATION | PASS | stale-expectation only |
| FOCUSED | 26 PASS | `tests/reactParityWaveProfileFactLifecycle.test.ts` **26/26** |
| E2E | 4 / 4 | `e2e/reactParityWaveProfileFactLifecycle.spec.ts` **4/4** |
| CANONICAL | 58 PASS | `tests/cr1MasterProfileFactLifecycle.test.ts` **58/58** |
| CR-1 | 19 PASS | `tests/cr1MasterProfile.test.ts` **19/19** |
| SECURITY | 50 PASS | CR-3 **17** + Phase-4C **33** |
| PHASE2/WAVE2 | PASS | architecture **40** · Wave2 **18** · P6 wizard isolation **PASS** |
| ROLLBACK | PASS | legacy panel + handlers + `applyUiMode('legacy')` |
| #7 | PASS | `READ_ONLY_REACT` · `updateProofWallItem` blocked · 0 modifications |
| FULL CHECK | PASS | **2669 / 2669** (reconfirmed at `edb29b9`) |
| BUILD | PASS | **PASS** |
| PRODUCT DEFECTS | 0 | **0** |
| NEW BUSINESS AUTHORITY | 0 | **0** |
| LEGACY DELETION | 0 | **0** |
| TEST WEAKENING | 0 | **0** |

REMOTE AI = **NO**  
REMOTE NETWORK (CV) = **NO**  
REMOTE FIRESTORE (CV / fact writes) = **NO**  
DETERMINISTIC FIXTURE = **YES** (`pinLocalDemoData` local seed after login)

---

## Rollback contract

| Field | Value |
|-------|-------|
| LEGACY `ClientProfilePanel.ts` | **RETAINED** |
| LEGACY `profileHandlers.ts` | **RETAINED** |
| LEGACY `ClientPortal.ts` `client-profile` | **RETAINED** |
| LEGACY add / confirm / reject / edit / CV | **RETAINED** |
| ROLLBACK SWITCH | **YES** (`applyUiMode('legacy')`) |
| LEGACY DELETION | **0** |
| LEGACY BUSINESS CHANGE | **0** |
| T-010-603 DELETION AUTHORIZED | **NO** |
| ROLLBACK | **PASS** |

Formal React parity does **not** mean `REMOVE_LEGACY` or T-010-603 deletion.  
Registry disposition remains `DISPLAY_ONLY_REACT`. Registry file was **not** modified.

---

## #7 hard boundary

| Field | Value |
|-------|-------|
| #7 CU? | **NO** |
| #7 COMMAND | **NONE** |
| #7 DESIGN | **NOT_STARTED** |
| #7 REACT | `READ_ONLY_REACT` |
| #7 MODIFICATIONS | **0** |
| `updateProofWallItem` BLOCKED | **YES** |
| OWNER DECISION | APPROVED (unchanged; design not started) |
| #7 BOUNDARY | **PASS** |

---

## Debt

| Item | Class |
|------|--------|
| React `#2`–`#6` write parity without formal record | **RESOLVED** (this file) |
| Canonical `#2`–`#6` commands | **RESOLVED** (`40f9b59` / `14a8436`) |
| Registry / CU? | **RESOLVED** (`1b7ac89`; unchanged this wave) |
| Historical Phase-2 display-only / blocked-mutator negatives | **RESOLVED** (stale-expectation reconciliation) |
| Fact-lifecycle audit event names | **NONBLOCKING** — inherited `AUDIT_NONBLOCKING_GOVERNANCE_DEBT`; consumer still does not invent names |
| E2E local pin when Firebase session is enabled | **NONBLOCKING** — `pinLocalDemoData` stops realtime sync and reseeds locally; CV/AI/network remain unused |
| Legacy `ClientProfilePanel` / `profileHandlers` | **FUTURE_T603** (rollback required; not a product defect) |
| `#7` ProofWall readiness | **FUTURE_RESIDUAL** (CU?=NO · design NOT_STARTED) |

BLOCKING DEBT = **0**  
NONBLOCKING DEBT = audit-event-name gap · Firebase-enabled E2E local pin  
Intentional legacy retention for rollback is **not** a product defect.

---

## Cutover recomputation (independent)

| Question | Answer |
|----------|--------|
| `ClientProfilePanel.ts` safe removable leaf? | **NO** |
| WHY | rollback independently requires `renderClientProfileBody` via `ClientPortal` / `applyUiMode('legacy')` |
| `profileHandlers.ts` still required? | **YES** |
| Remaining listeners | `#btn-extract-cv-facts` · `.input-cv-upload` · `.btn-confirm-profile-fact` · `.btn-reject-profile-fact` · `.btn-edit-profile-fact` · `.btn-add-profile-fact` · `.btn-toggle-proof-wall` (`#7`) |
| #7 still blocks handler removal? | **YES** |
| Rollback independently blocks panel removal? | **YES** |
| SAFE LEGACY SUBSET COUNT | **0** |
| SAFE LEGACY SUBSET | **NONE** |

A43 8-condition T603 gate is still not removable: C6 rollback remains required; C7 acceptance of this wave does not authorize deletion; mixed Wave2 profile host still includes `#7` ProofWall.

| Field | Value |
|-------|-------|
| A43 | **PARTIAL** |
| PROFILE FACT CUTOVER | **ACCEPTED** (React write parity only) |
| ACTIVE PROFILE-RELATED LEGACY GAPS | `ClientProfilePanel.ts` rollback · `profileHandlers.ts` fact/CV + `#7` · `ProofWallPanel` `#7` |
| OTHER MIXED HOSTS | Wave2 profile group (Onboarding + ProofWall) · `ClientWorkspace` / `ClientPortal` remaining residuals |
| LEGACY REMOVALS | **0** |
| Can A43 pass now? | **NO** |
| WHY | A43 requires legacy removal after the full 8-condition gate; rollback + `#7` + mixed hosts keep the gate PARTIAL |

---

## T603 recomputation

| Field | Value |
|-------|-------|
| T603 SAFE SUBSET EXISTS | **NO** |
| T603 SUBSET REVIEW MEANINGFUL | **NO** |
| T603 IMPLEMENTATION AUTHORIZED | **NO** |
| T-010-603 | **NOT_AUTHORIZED** |
| T-010-604 | **NOT_AUTHORIZED** |

---

## #7 frontier effect

| Field | Value |
|-------|-------|
| #7 OWNER DECISION | APPROVED |
| #7 CU? | **NO** |
| #7 COMMAND | **NONE** |
| #7 DESIGN | **NOT_STARTED** |
| #7 DESIGN REVIEW ELIGIBLE | **YES** |
| CUTOVER IMPACT | remaining profile-handler and Wave2 profile-group blocker; panel/handler cannot become a T603 leaf until `#7` is off that bundle and rollback is separately authorized |
| EXTERNAL OWNER REQUIRED | **NO** |
| NEW OWNER DECISION REQUIRED | **NO** |

---

## Handoff / frontier

| Item | Value |
|------|--------|
| `#2`–`#6` REACT IMPLEMENTATION | **COMPLETE** |
| `#2`–`#6` FORMAL ACCEPTANCE | **YES** |
| `#2`–`#6` CU? | **YES** |
| `#2`–`#6` CANONICAL | **FROZEN** |
| SAFE LEGACY SUBSET | **NONE** |
| A43 | **PARTIAL** |
| T603 REVIEW MEANINGFUL | **NO** |
| SPEC-010 CODE_COMPLETE | **NO** |
| NEXT FRONTIER | `AUTHORIZE_PROOFWALL_READINESS_CANONICAL_AUTHORITY_DESIGN_REVIEW` |
| NEXT FRONTIER AUTHORIZED | **NO** |
| RATIONALE | `#7` is the remaining profile-handler blocker, already owner-approved, still CU?=NO with no command; the next bounded step is canonical authority design, not React writes, not T603 deletion |

This record does **not** authorize `#7` design, implementation, T-010-603, or T-010-604.
