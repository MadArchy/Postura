# AUDIT010-09 registry — `LEGACY_COMMAND_WITHOUT_CANONICAL_USE_CASE`

**SPEC:** 010-react-migration
**Finding:** AUDIT010-09 · severity **P3**
**Status:** **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** (registered, non-blocking for the phase as a whole)
**Opened:** Phase 1 · extended by the Phase-2 command screen · extended by the Phase-3 page screen · **Phase-4 controller audit added AUDIT010-10/-11 and the formal CR inventory; registry count unchanged at 34**

---

## The rule this registry enforces

> A legacy command that writes business state and has **no canonical Application
> use case** MUST NOT be migrated into React.

SPEC-010 owns presentation. It does not own the authority to create a business
use case, and it may not invent one to make a UI migration look complete.
Wrapping a raw `dbService` write in a React handler would move a business
mutation into the presentation layer, which is exactly the boundary the
migration exists to establish.

**Consequence for the user: none.** Every blocked capability stays available on
the legacy surface, which remains served and unmodified. The React view either
omits the action or points at the legacy surface that still owns it.

## Allowed dispositions

| Disposition | Meaning |
|---|---|
| `KEEP_LEGACY` | The whole capability stays legacy for now. |
| `DISPLAY_ONLY_REACT` | Read/display migrated; all writes stay legacy. |
| `READ_ONLY_REACT` | React renders a read-only projection; the action is absent as it is in the legacy read-only view. |
| `MIGRATION_BLOCKED_OTHER_SPEC` | Unblocking requires new Application authority owned by another SPEC. |

## Registry

`CU?` = does a canonical Application use case exist for this write?

| # | Component | User action | Legacy symbol(s) | Business write | CU? | Disposition | Owning SPEC | Blocking phase |
|---|---|---|---|---|---|---|---|---|
| 1 | `Login` / invite flow | Accept invitation | `acceptClientInvitation` → Application `AcceptClientInvitation` (legacy symbols: `markInvitationAccepted`, `updateClient`) | invitation state + client record | **YES** | `KEEP_LEGACY` (legacy UI invokes canonical consumer) | **CR-1 Client Lifecycle Application** | 3 |
| 2 | `ClientProfilePanel` | Add fact | `addProfileFact` → Application `AddProfileFact` (legacy symbol: `dbService.addProfileFact`) | master profile facts | **YES** | `DISPLAY_ONLY_REACT` | **CR-1 Master Profile Application** · `#2 CANONICALIZED_AND_FROZEN` · implementation `40f9b59` · acceptance `14a8436` · React not started | 3 |
| 3 | `ClientProfilePanel` | Confirm fact | `confirmProfileFact` → Application `ConfirmProfileFact` (legacy symbol: `dbService.confirmProfileFact`) | fact verification state | **YES** | `DISPLAY_ONLY_REACT` | **CR-1 Master Profile Application** · `#3 CANONICALIZED_AND_FROZEN` · candidate → confirmed · React not started | 3 |
| 4 | `ClientProfilePanel` | Reject fact | `rejectProfileFact` → Application `RejectProfileFact` (legacy symbol: `dbService.rejectProfileFact`) | fact verification state | **YES** | `DISPLAY_ONLY_REACT` | **CR-1 Master Profile Application** · `#4 CANONICALIZED_AND_FROZEN` · candidate → rejected · no reopen · React not started | 3 |
| 5 | `ClientProfilePanel` | Edit fact value | `updateProfileFact` → Application `UpdateProfileFact` (legacy symbol: `dbService.updateProfileFact`) | master profile facts | **YES** | `DISPLAY_ONLY_REACT` | **CR-1 Master Profile Application** · `#5 CANONICALIZED_AND_FROZEN` · confirmed value-only · not raw persist label/status mutation · React not started | 3 |
| 6 | `ClientProfilePanel` | Extract facts from CV (paste or upload) | `importProfileFactsFromCv` → Application `ImportProfileFactsFromCv` (legacy symbol: `dbService.importCandidateFactsFromCv`) | bulk candidate facts | **YES** | `DISPLAY_ONLY_REACT` | **CR-1 Master Profile Application** · `#6 CANONICALIZED_AND_FROZEN` · local Domain extract · no AI/network · React not started | 3 |
| 7 | `ProofWallPanel` | Mark asset ready / pending | `dbService.updateProofWallItem` | proof-wall item status | **NO** | `READ_ONLY_REACT` | **CR-1 Master Profile Application** · OWNER_RESOLVED_BY_CURRENT_EVIDENCE | 3 |
| 8 | `SourceRegistryModal` | Register source | `registerSource` → Application `RegisterSource` (persistence: `dbService.addSource` via adapter) | source registry | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Signal Intake Application** | 3 |
| 9 | `SourceRegistryModal` | Ingest now (one / all) | `pollRegisteredSource` / `pollAllActiveSources` → Application `PollRegisteredSource` | signals produced downstream | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Signal Intake Application** · `PollRegisteredSource` · Stage B blocker **COMPLETE** | 3 |
| 10 | `OnboardingWizard` | Submit onboarding step / finish (handler owned by `main.ts`) | `applyOnboardingStep` → Application `ApplyOnboardingStep` (legacy symbol: `dbService.applyOnboardingStep` DEPRECATED) | client + master profile | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Master Profile Application** | 3 |

### Phase-3 page screen — 24 further blocked writes

The Phase-3 screen inventoried all five wave-3 pages. It found that the large
majority of their actions write business state directly through `dbService` with
no canonical Application use case, which is why every wave-3 page is HYBRID or
READ_ONLY rather than a full cutover. Grouped by capability:

| # | Page | User action | Legacy symbol(s) | Business write | CU? | Disposition | Owning SPEC | Blocking phase |
|---|---|---|---|---|---|---|---|---|
| 11 | `ThesisEditorModal` | Save draft / send to client | `saveThesis` → Application `SaveThesis` (persistence: `dbService.saveThesis` via adapter) | thesis record + revision | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Thesis Lifecycle Application** | 4 |
| 12 | `ClientWorkspace` positioning | Activate thesis | `activateThesis` → Application `ActivateThesis` (Domain `activateThesisByManager`; persistence via adapter) | thesis status | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Thesis Lifecycle Application** | 4 |
| 13 | `ClientPortal` thesis | Approve / request changes | `decideThesisClientReview` → Application `DecideThesisClientReview` (Domain `approveThesisByClient` / `rejectThesisByClient`) | client approval state | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Thesis Lifecycle Application** | 4 |
| 14 | `ClientWorkspace` deliver | Confirm destination | `DecideCuration` · `discardSignalForCurationComposite` on DISCARD | curation decision | **YES** | `DISPLAY_ONLY_REACT` | **CR-1 Execution Delivery Application** · `#14 CANONICALIZED_AND_FROZEN` (Wave B3) · SPEC-003 gate | 4 |
| 15 | `ClientWorkspace` deliver | Propose angle | `proposeAngle` → Application `ProposeAngle` (persistence: `CurationAnglePersistencePort` via adapter) | curation angle | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · `#15 CANONICALIZED_AND_FROZEN` (Wave B5) · SPEC-005 AI | 4 |
| 16 | `ClientWorkspace` deliver | Remove / reopen curation | `removeCuration` → Application `RemoveCuration` · `reopenCuration` → Application `ReopenCuration` (persistence via narrow ports) | curation lifecycle | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · `#16-R/#16-O CANONICALIZED_AND_FROZEN` (Wave B6) | 4 |
| 17 | `ClientWorkspace` deliver | Assemble briefing | `ensureDraftDelivery` · `addCurationToDelivery` · `removeDeliveryItemFromDelivery` · `updateDeliveryPackageMetadata` · `discardDraftDelivery` → Application equivalents | delivery package | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · `#17 CANONICALIZED_AND_FROZEN` (Wave B4) | 4 |
| 18 | `ClientWorkspace` deliver | Send to client | `sendDeliveryPackage` → Application `SendDeliveryPackage` | delivery + notification | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · `SendDeliveryPackage` · Stage B blocker **COMPLETE** | 4 |
| 19 | `ClientPortal` home | Mark briefing read | `acknowledgeDelivery` → Application `AcknowledgeDelivery` (persistence: `dbService.acknowledgeDelivery` via adapter) | delivery acknowledgement | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · `#19 CANONICALIZED_AND_FROZEN` (Wave B7) | 4 |
| 20 | `ClientWorkspace` radar | Discard signal | `discardSignal` → Application `DiscardSignal` (persistence: `dbService.decideSignal` via adapter) | signal decision | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Signal Intake Application** · `DiscardSignal` | 4 |
| 21 | `ClientWorkspace` radar | Add to delivery | `addSignalToCuration` → Application `AddSignalToCuration` · `addAdviceActionToCuration` → Application `AddAdviceActionToCuration` · `markSignalSaved` → Application `MarkSignalSaved` (#21a B1/B2 + #21b A2) | curation entry | **YES** | `DISPLAY_ONLY_REACT` (legacy UI invokes canonical consumer) | **COMPOSITE — Execution Delivery + Signal Intake** · `#21 CANONICALIZED_AND_FROZEN` (Wave B1/B2/A2) | 4 |
| 22 | `ClientWorkspace` radar | Score signal | canonical routing use case, then `dbService.addRecommendation` | recommendation | **PARTIAL** | `DISPLAY_ONLY_REACT` | **CR-1 Signal Intake Application** (recommendation persist only) · SPEC-001 routing · `PHASE6_REMOVE_LATER_CANDIDATE` | 4 |
| 23 | `ClientWorkspace` radar | Pin / unpin topic | `dbService.toggleTopicPin` | topic pin | **NO** | `DISPLAY_ONLY_REACT` | **POST_MVP_PRESENTATION_STATE** · no Application owner | 4 |
| 24 | `ClientWorkspace` sources | Register source (activate/pause remain legacy) | `registerSource` → Application `RegisterSource` (same command as #8) | source registry | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Signal Intake Application** | 4 |
| 25 | `ClientWorkspace` sources | Pause / reactivate / archive / test feed | `dbService.updateSourceStatus`, `recordSourceRun` | source state | **NO** | `READ_ONLY_REACT` | **CR-1 Signal Intake Application** · OWNER_RESOLVED_EXISTING | 4 |
| 26 | `ClientWorkspace` sources | Manual signal | `registerManualSignal` → Application `RegisterManualSignal` (persistence: `dbService.addSignal` via adapter) | signal record | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Signal Intake Application** | 4 |
| 27 | `ClientWorkspace` tasks | Assign / cancel task | `assignClientTask` · `cancelClientTask` → Application (legacy symbols: `dbService.addTask`, `updateTaskStatus` via adapters) | task record | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · `#27 CANONICALIZED_AND_FROZEN` (Wave B10) | 4 |
| 28 | `ClientPortal` feed | Open / complete / request changes on a task | `transitionClientTask` → Application `TransitionClientTask` (Domain `TASK_TRANSITIONS`; persistence via adapter) | task state + evidence | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** | 4 |
| 29 | `ClientWorkspace` positioning | Assign evidence to thesis | `dbService.toggleEvidenceThesis` | evidence assignment | **NO** | `DISPLAY_ONLY_REACT` | **CR-1 Master Profile Application** · OWNER_RESOLVED_BY_CURRENT_EVIDENCE | 4 |
| 30 | `Modals` add-evidence | Add evidence item | `dbService.addEvidenceItem` | evidence vault | **NO** | `KEEP_LEGACY` | **CR-1 Master Profile Application** · SPEC-006 publication gate only | 4 |
| 31 | `Modals` content-editor | Save content | `saveContentDraft` → Application `SaveContentDraft` (SPEC-003 Brief gate for strategic content + Domain `contentPipeline` + SPEC-006 gate consumption) | content record | **YES** | `KEEP_LEGACY` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** | 4 |
| 32 | `Modals` article-review | Save / approve / reject article | `reviewClientArticle` → Application `ReviewClientArticle` (Domain `articleReviewCore` + `contentPipeline`) | content + pipeline | **YES** | `KEEP_LEGACY` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** | 4 |
| 33 | `Modals` generate-content | Generate draft | `createContentDraft` → Application `CreateContentDraft` (legacy symbols: `aiService.generateContentDraft`, `dbService.saveContent`) | content record | **YES** | `READ_ONLY_REACT` (legacy UI invokes canonical consumer) | **CR-1 Execution Delivery Application** · SPEC-003 auth · SPEC-005 AI · create ≠ `SaveContentDraft` | 4 |
| 34 | `ManagerCockpit` / `Modals` create-client | Create client + invite | `createClientWithInvite` → Application `CreateClientWithInvite` (legacy symbols: `createClient`, `createInvitation`, `createPendingAccount`) | tenancy + identity | **YES** | `KEEP_LEGACY` (legacy UI invokes canonical consumer) | **CR-1 Client Lifecycle Application** (SPEC-009 remains authz/RBAC only) | 4 |

Items 18 and 22 are recorded as `CU? PARTIAL` deliberately: their *authorization*
is canonical but their *persistence* is not. A partially canonical command is not
a migratable command — routing it through React would move the non-canonical half
into the presentation layer — so both stay legacy in full.

**#18:** Execution Delivery owns the write group; Stage B blocker (orchestration in
`main.ts`). **#22:** SPEC-001 owns routing (`scoreAndRouteSignal`); Signal Intake
owns legacy `addRecommendation` persistence only (`NONAUTHORITATIVE_COMPATIBILITY_ADVISORY`).

Item 34 also mutates the session (`impersonateClient`) on the neighbouring "ver
como cliente" control, which is SPEC-009 authority and out of scope regardless.

### A separate, non-AUDIT010-09 blocker: brief creation

`createBriefFromCurationEntry` (SPEC-003) **is** a canonical consumer, so
AUDIT010-09 does not apply. **CR-2 (2026-08-28)** remediated caller snapshot
authority: production callers pass `curationEntryId` only; the consumer reloads
authoritatively via `dbService.getCurationById`. Brief creation remains on the
legacy UI path (not React seam) by presentation migration policy, not by
aggregate-signature blocker.

Class was `CANONICAL_CONSUMER_REQUIRES_CALLER_AGGREGATE` — **resolved** by CR-2.
See `cr-2-brief-from-curation-entry.md`.

**Noncutover ownership ratified (CR-1 Phase B).** The 22 rows with `CU? = NO`
(or `PARTIAL` for #18/#22) now have final **business Application owners** recorded
in the `Owning SPEC` column and in `cr-1-noncutover-ownership.md`. Owner
resolution does **not** change `CU?` or implement canonical use cases. Cutover
spine rows (#1, #8, #10, #11, #12, #13, #24, #26, #28, #31, #32, #34) are
unchanged.

### Item 10 changed disposition without changing the blocker

The T-010-205 reconciliation moved item 10 from `KEEP_LEGACY` to
`DISPLAY_ONLY_REACT`: the onboarding form's presentation and its two
compatibility reads are now in React, while the write stays exactly where it was.
The blocker itself is unchanged — no canonical use case exists, none was invented,
and `applyOnboardingStep` appears nowhere in `src/ui/**`. The handler was always
owned by `main.ts`, whose extraction is Phase 4, so it was never inside the
component boundary that T-010-205 migrates.

### Item 9 has a second reason to stay legacy

Source polling triggers ingestion, which produces signals that later reach
scoring and routing. That is a side-effect chain owned by the radar/signal
SPECs. Even with a canonical write for `addSource`, "ingest now" would still not
belong behind a React button in a bounded component phase.

### The legacy modal's render-time agent run is not reproduced

`SourceRegistryModal` calls `runSourceDiscoveryAgent` while rendering. A React
read facade must not launch an agent run as a side effect of rendering, so the
recommendation chips are not migrated. They remain on the legacy surface.

## What was NOT blocked

The screen also found commands that are already canonical. These migrated
because doing so changes the caller and nothing else — React and legacy converge
on the identical use case:

| Component | Action | Canonical target | Class |
|---|---|---|---|
| `OpportunityPanel` | Accept | `acceptClientOpportunity` (SPEC-007) | `CANONICAL_CONSUMER` |
| `OpportunityPanel` | Decline (notes required) | `declineClientOpportunity` | `CANONICAL_CONSUMER` |
| `OpportunityPanel` | Toggle checklist item | `toggleClientOpportunityChecklistItem` | `CANONICAL_CONSUMER` |
| `OpportunityPanel` | Mark submission sent | `submitClientOpportunity` | `CANONICAL_CONSUMER` |
| `KpiWeeklyChart` | Register consultation (+1) | `registerResultRecordIntent` (SPEC-008) | `CANONICAL_CONSUMER` |
| `MasterDossierPanel` | Copy / download Markdown | `dossierExport` formatter + audit log | `PRESENTATION_ONLY` |
| `ClaimSafetyPanel` | Go to phrase | editor cursor move | `PRESENTATION_ONLY` |
| `PageHeader` | — | — | `NO_COMMAND` |

Phase 3 added two more, on the same basis:

| Page | Action | Canonical target | Class |
|---|---|---|---|
| `ClientWorkspace` radar | Signal outcome "¿sirvió?" Sí/No | `registerSignalOutcomeIntent` (SPEC-008) | `CANONICAL_CONSUMER` |
| `ClientWorkspace` briefs | Approve Strategic Brief | `approveStrategicBrief` (SPEC-003) | `CANONICAL_CONSUMER` |

## Enforcement

The rule is enforced mechanically, not by review. `tests/reactMigrationPhase2Architecture.test.ts`
and `tests/reactMigrationPhase3Architecture.test.ts` assert that none of the
blocked symbols above appears anywhere under `src/ui/**`, that the compatibility
facade exports only `read*` functions, and that no component or page imports a
consumer or service command directly instead of going through the command seam.
The Phase-3 suite additionally asserts that every page holding a blocked action
renders the `LegacyHandoff` element, so a blocked action cannot be quietly
dropped instead of delegated, and that `createBriefFromCurationEntry` is absent
from the seam.

## Why this is not RESOLVED

Leaving the affected commands on the legacy path is the correct handling of the
finding, not a resolution of it. The finding closes when each capability either
gains a canonical Application use case (other-SPEC work) or is formally retired.
Until then it stays **MIGRATION_BLOCKER_FOR_AFFECTED_CAPABILITY** at **P3**: no
capability loss, and no defect introduced by the migration.

> **Corrected in Phase 4.** This section previously read "ordering sound in every
> case (gate before effect)". The Phase-4 controller audit
> (`main-controller-audit.md`) disproves that for **6** of the legacy paths,
> including registry item 10 — `dbService.applyOnboardingStep` takes its tenant
> from a DOM attribute and runs with no authorization check. The earlier claim
> rested on a tolerant gate pattern that counted optional chaining as a gate.
> The paths are unchanged and still legacy; only the claim about them was wrong.
> Recorded as **AUDIT010-10** below.

---

# Phase-4 additions

**Opened:** Phase 4 · T-010-401 controller audit
**Registry count:** unchanged at **34** blocked writes. Phase 4 extracted no
command and canonicalized nothing, so no row moved.

## AUDIT010-10 — material effect with no in-path authorization gate

**Severity P2 · opened Phase 4 · `RETAINED_LEGACY_REMEDIATION_REQUIRED`
→ Phase 4C: `RESOLVED`** (remediation below)

Six legacy paths execute a material effect without an authorization check in the
path. Authorization is by UI visibility — the control is not rendered for users
who should not have it — and in three cases the tenant comes from a DOM
attribute. Full evidence in `main-controller-audit.md` §3.

| Path | Effect | Tenant source |
|---|---|---|
| `main.ts:743` | `pushCurrentLocalToFirestore()` | session |
| `main.ts:883` | `dbService.applyOnboardingStep` (registry #10) | **DOM attribute** |
| `main.ts:1232` | `aiService.generateThesisProposal` | **DOM attribute** |
| `main.ts:2315` | `runResearchSignalsAgent` | workspace scope |
| `main.ts:2688` | `generatePositioningAdvice` | **DOM attribute** |
| `main.ts:2704` | `runTopicAgent` | workspace scope |

Four of the six are advisory AI/agent generators. They produce proposals a human
must accept, so they hold no business authority — but they spend a provider
budget from a click that nothing in-path authorizes.

Not P0/P1: all six are pre-existing legacy paths, untouched by this phase, and
tenant isolation is enforced by SPEC-009 Firestore rules (91/91 passing) rather
than by these call sites. Remediation means adding gates to legacy code, which is
not an extraction task and is not authorized here.

**Migration impact:** these paths must not be migrated until gated. §20 forbids
migrating an `EFFECT_FIRST` path, and 0 were migrated.

## AUDIT010-11 — positional default for tenant selection

**Severity P3 (recorded Phase 4) → P2 (reclassified Phase 4B evidence) · `LEGACY_BEHAVIOUR_PRESERVED`
→ Phase 4C: `RESOLVED`** (remediation below)

`main.ts` `resolveClientId()` falls back to `dbService.getClients()[0]?.id` — a
first-record default for **tenant** scope. It is not thesis positional authority,
so multi-thesis governance is unaffected and `PRIMARY/FIRST THESIS AUTHORITY`
stays 0. But a first-record fallback for tenant scope should be an explicit
refusal, not a silent pick. Behaviour preserved unchanged in Phase 4; recorded so
that whoever migrates these paths does not carry the fallback across.

## AUDIT010-07 — closed as an audit

**Was:** `AUDIT_REQUIRED_IMPLEMENTATION_PENDING` since Phase 0, on the grounds
that ordering could not be proven statically across 5,132 lines.

**Now:** `AUDIT_COMPLETE · DEFECTS REGISTERED · 0 MIGRATED`. All **86** material
side-effecting paths in the controller are classified: **80 `GATE_FIRST`**,
**6 `EFFECT_FIRST`** (AUDIT010-10), **0 `UNKNOWN`**. Zero `EFFECT_FIRST` and zero
`UNKNOWN` paths were migrated. The audit obligation is discharged; the six
defects it surfaced are open remediation items on legacy code.

---

# Formal change-request inventory (§11)

Consolidated here because §8 requires the debt to stay visible and §10 forbids
Phase 4 from discharging it.

| CR | Capability | Blocked writes | Why blocked | Candidate owner | Cut-over impact |
|---|---|---|---|---|---|
| **CR-1** | Onboarding, profile facts, proof wall, source registration, curation, delivery, tasks, evidence, content, thesis, **client lifecycle + master profile (partial)** | **34** registry rows · **12** canonicalized (cutover spine) · **22** noncutover owned but not implemented | Cutover spine complete; noncutover owners ratified Phase B; implementations deferred | **COMPLETE (ownership)** — five Application boundaries; see `cr-1-noncutover-ownership.md` | Cutover spine done; T-010-403/404 blocked on Stage B + #9/#18; Phase 6 awaits canonicalization debt |
| **CR-2** | Strategic Brief creation from a curation entry | 1 (not counted in the 34 — the consumer exists) | Consumer requires the caller to pass the whole `CurationEntry` aggregate | **SPEC-003** (frozen) | Blocks migrating brief creation; approval already migrated |
| **CR-3** | Trusted tenant entitlement in four consumer `buildTrusted*Context` builders | 4 builders (003/004/007/008) | Trusted `organizationId` was derived from the requested client record | **SPEC-003 · 004 · 007 · 008** | **RESOLVED** — see `cr-3-trusted-tenant-entitlement.md`; implementation `af49c59c9c8042b925e29c8a71ac1cd585d2f941` |

**FORMAL CHANGE REQUESTS:** CR-1 **CODE_COMPLETE_WITH_DEBT** (ownership complete · noncutover implementation deferred) · CR-2 **COMPLETE** · CR-3 **RESOLVED** (security amendment; not a product CR).

## CR-2 — SPEC-003 consumer signature (§12)

**Status:** **COMPLETE / FROZEN** (CR-2 remediation @ base `85fbdb707eab531d198c154d517ae435d3fb9d45`)

| Field | Repository truth |
|---|---|
| Consumer | `createBriefFromCurationEntry` |
| File | `src/services/strategicBriefConsumer.ts` |
| **Before signature** | `{ entry: CurationEntry; destination; briefId?; now? }` |
| **After signature** | `{ curationEntryId: string; destination; briefId?; now? }` |
| Authoritative reload | `dbService.getCurationById(curationEntryId)` |
| Trusted tenant | CR-3 `buildTrustedBriefContext` → `requireTenantScope` |
| Production call sites | `main.ts` — `curationEntryId` only |
| Caller curation snapshot authority | **0** |
| Unsafe aggregate overload active | **0** |
| Frozen SPEC owner | **SPEC-003** (Strategic Brief) — integration only; Domain **0** changes |
| Evidence | `cr-2-brief-from-curation-entry.md`; `tests/cr2BriefFromCurationEntry.test.ts` |

### Historical defect (closed)

The consumer previously derived business-material values from a caller-supplied
`CurationEntry` without authoritative re-read. CR-2 enforces load-before-trust:

```text
curationEntryId → getCurationById → requireTenantScope(entry.clientId) → create
```

**NEXT ACTION (post-CR-2):** `AUTHORIZE_STAGE_B_BLOCKER_CANONICALIZATION` (#9, #18)

---

# Phase 4C — local security remediation

**Scope:** AUDIT010-10 and AUDIT010-11 only. No cross-SPEC implementation, no
canonical use case created, no registry row removed. **CR-1 stays at 34 blocked
writes and CR-2 stays `CHANGE_REQUIRED`** — this phase fixed how the legacy
paths establish *who is acting on which tenant*, not who owns the commands.

## The gate

`src/controllers/trustedTenant.ts` — `requireTenantScope` and
`requireAdminActor`. It is a **gate, not a tenant authority**: it holds no state,
imports no store or service, and receives identity through injected
dependencies. §6 forbids a second tenant authority, so nothing here can mint
identity; the organization is always the actor's own.

| Rule | Behaviour |
|---|---|
| No session | refuse `NO_SESSION` |
| Session without `organizationId` | refuse `NO_TRUSTED_ORG` |
| `CLIENT` actor proposing another client | refuse `CLIENT_SCOPE_VIOLATION` |
| `CLIENT` actor | pinned to trusted `user.clientId`; a proposal is only ever accepted when it matches |
| `ADMIN` actor, nothing chosen | refuse `NO_CLIENT_SCOPE` — no positional default |
| `ADMIN` actor, unknown client | refuse `UNKNOWN_CLIENT` |
| `ADMIN` actor, client in another org | refuse `CROSS_ORG` |
| Grant | `organizationId` from the **session**, never from the client record |

That last row is the substantive fix. `main.ts` `resolveOrganizationId()` reads
the organization from the client record first, so it answers *"does this client
have an org?"* — a presence check that **any existing client passes**. It never
answered *"may this actor act on this client?"*. The gate answers the second
question, which is the one that matters when the proposed client id arrives from
a DOM attribute.

## AUDIT010-10 — the six paths, remediated

| Path | Effect | Tenant before | Tenant after | Gate added |
|---|---|---|---|---|
| `btn-firebase-push-local` | `pushCurrentLocalToFirestore()` | session | n/a (org-wide) | `requireAdminActor` — role from trusted session |
| `form-onboarding-step` | `dbService.applyOnboardingStep` (registry #10) | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-generate-thesis-proposal` | `aiService.generateThesisProposal` | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-research-all-signals` | `runResearchSignalsAgent` | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-generate-advice` | `generatePositioningAdvice` | **DOM attribute** | trusted grant | `requireTenantScope` |
| `btn-run-topic-agent` | `runTopicAgent` | **DOM attribute** | trusted grant | `requireTenantScope` |

Three adjacent sites were gated in the same pass, because leaving a twin
ungated would have gated only what was counted: the deferred
`generateThesisProposal` auto-run, the per-signal `.btn-research-signal`
handler, and the `btn-onboarding-skip` write (whose `if (clientId)` was a
presence check before `dbService.updateClient`).

**Mechanical evidence.** `scripts/auditHandlerOrdering.mjs` — the same script
that produced the finding — now reports **`EFFECT_FIRST: 0`** across all 157
handlers, down from 6. `scripts/auditMainController.mjs` no longer flags
`bindOnboarding`.

**DOM-derived tenant authority: 5 → 0. Button-visibility authorization: 6 → 0.**
`data-client-id` still exists in markup and is still passed in, but it is now
`DISPLAY_ONLY` input to a gate that can refuse it.

## AUDIT010-11 — positional tenant authority removed

The Phase-4B analysis found `resolveClientId`'s `getClients()[0]` fallback.
Writing the test found **two more sites the analysis had missed**, and one was
worse than the recorded finding:

| Site | Behaviour before | Behaviour after |
|---|---|---|
| `resolveClientId()` | ended in `dbService.getClients()[0]?.id`, feeding business writes | returns `''`; callers must pass it through the gate |
| `renderMainView()` | a `CLIENT` session with no `clientId` fell through to `getClients()[0]`, **rendering another tenant's portal** | fails closed with an explanatory empty state |
| `tickScheduledIngest()` | with no active workspace, ingested for `getClients()[0]` — a background effect choosing tenant by position | requires a grant; skips the tick otherwise |

The `renderMainView` case is the reason the severity reclassification was right.
A first-record *default* is untidy; rendering a different tenant's portal to a
client whose session lacks a `clientId` is a tenant-isolation defect. It was
reachable only for a malformed client session, and SPEC-009 rules would still
have refused the reads server-side, so no P0/P1 is claimed — but it is not P3.

One positional pick remains, deliberately and per §10: `displayClientId()`,
used **only** for the modal presenter's fallback. `DISPLAY DEFAULT ≠ BUSINESS
CLIENT AUTHORITY`, and a test asserts it is the only `getClients()[0]` left in
the controller's code and that it is confined to that method.

## AUDIT010-12 — internal helpers with no gate of their own (new, P3)

**Severity P3 · `DEFENCE_IN_DEPTH_GAP`**

The method-level scan reports 6 command-method bodies that execute an effect
with no in-path gate: `boot`, `completeLinkedArticleTask`,
`markVideoCaptureStarted`, `markArticleReviewStarted`, `pollSources`,
`pollOneSource`. These are **not** the AUDIT010-10 population — they are
internal helpers reached from handlers that are themselves gated, and `boot` is
bootstrap rather than a user action.

Registered rather than closed or ignored, for two honest reasons. Static
ordering analysis cannot prove a helper is safe from its callers' gates, and
each of these has 1–4 call sites that would each need verifying. And the
Phase-4 audit's accounting attributed all 6 `EFFECT_FIRST` paths to handlers,
which the method-level view does not support; the populations were never
reconciled. Verifying the 12 call sites is the remediation, and it is not this
phase's authorized scope.

## Severity after Phase 4C

Row-level derivation, not an edited total. Entering: P2 **4** recorded / **5**
evidence-supported (AUDIT010-11 reclassified P3→P2), P3 **7** / **6**.

| Change | P2 | P3 |
|---|---|---|
| Evidence-supported entry | 5 | 6 |
| AUDIT010-10 resolved | −1 | — |
| AUDIT010-11 resolved (at P2) | −1 | — |
| AUDIT010-12 opened | — | +1 |
| **Exit** | **3** | **7** |

**P0 0 · P1 0 · P2 3 · P3 7.**

## What Phase 4C did not touch

| Item | State |
|---|---|
| CR-1 blocked writes | **34** registry rows · **12** canonicalized (cutover spine complete: #1/#8/#10/#11/#12/#13/#24/#26/#28/#31/#32/#34) · **22** noncutover owned · **22** still CU?=NO (or PARTIAL #18/#22) |
| CR-1 ownership | **CUTOVER_SPINE_COMPLETE** · **NONCUTOVER_OWNER_DISPOSITION_COMPLETE** — five operational Application boundaries ratified |
| CR-1 noncutover map | **22 IDs** — `cr-1-noncutover-ownership.md` (Phase B ratified · content `e4bc16f5f8667792d443217d4ab2a6572274aa22`) |
| CR-1 provisional groups | Superseded by Phase B ratification — IDs 2–6, 7, 9, 14–23, 25, 27, 29–30, 33 final owners recorded |
| CR-2 / SPEC-003 | **CHANGE_REQUIRED**, `CALLER_SNAPSHOT_AUTHORITY_PRESENT` — unchanged |
| SPEC-003 modifications | **0** |
| T-010-403 / T-010-404 | **BLOCKED_BY_OTHER_PRECONDITION** — cutover spine canonical; remaining 22 CU?=NO writes + Stage B precondition (`main.ts` still event bus) |

Gating a legacy write does not canonicalize it. **Exceptions (CR-1):** all **12**
cutover-spine registry IDs now have canonical Application use cases; legacy UI
invokes consumers only (double authority 0). The remaining **22** CU?=NO rows
still write through `dbService` with no Application use case and remain barred
from React until separately owned.

---

## CR-1 Workstream 1 — Client Lifecycle (post-adoption note)

| Field | Value |
|---|---|
| Registry IDs | **#34**, **#1** |
| Commands | `CreateClientWithInvite`, `AcceptClientInvitation` |
| Owner | CR-1 Client Lifecycle Application (operational) |
| Previous legacy authority | `main.ts` orchestrated `createClient` + `createInvitation` + `createPendingAccount` / `markInvitationAccepted` + `updateClient` |
| Compatibility path | Legacy login + create-client forms call `clientLifecycleConsumer`; React remains `KEEP_LEGACY` / LegacyHandoff until presentation migration |
| Removal eligibility | Not eligible — cutover-spine writes remain; T-010-403/404 stay blocked |
| Evidence | `specs/010-react-migration/cr-1-client-lifecycle.md`; `tests/cr1ClientLifecycle.test.ts` |

---

## CR-1 Workstream 2 — Master Profile (post-adoption note)

| Field | Value |
|---|---|
| Registry ID | **#10** |
| Command | `ApplyOnboardingStep` |
| Owner | CR-1 Master Profile Application (operational) |
| Previous legacy authority | `main.ts` → `dbService.applyOnboardingStep` (now DEPRECATED fail-closed) |
| Domain reuse | `buildFactsFromProfile`, `computeProfileCoverage` / `nextIncompleteOnboardingStep` (resume) |
| Completeness | Domain-derived on `saveMasterProfile` refresh — not caller/legacy constant authority |
| IDs 2–6 | Master Profile · `#2`–`#6 CANONICALIZED_AND_FROZEN` · `AddProfileFact` / `ConfirmProfileFact` / `RejectProfileFact` / `UpdateProfileFact` / `ImportProfileFactsFromCv` · implementation `40f9b59` · acceptance `14a8436` · React `DISPLAY_ONLY_REACT` not started · legacy handlers still call `dbService` |
| IDs 7, 29, 30 | Master Profile noncutover · ratified Phase B |
| Compatibility path | Legacy onboarding form → `masterProfileConsumer`; React remains `DISPLAY_ONLY_REACT` |
| Removal eligibility | Not eligible — 9 other cutover-spine writes remain |
| Evidence | `specs/010-react-migration/cr-1-master-profile.md`; `tests/cr1MasterProfile.test.ts` |

---

## CR-1 Workstream 3 — Thesis Lifecycle (post-adoption note)

| Field | Value |
|---|---|
| Registry IDs | **#11**, **#12**, **#13** |
| Commands | `SaveThesis`, `ActivateThesis`, `DecideThesisClientReview` |
| Owner | CR-1 Thesis Lifecycle Application (operational) |
| Previous legacy authority | `main.ts` orchestrated `planThesisSave` / `activateThesisByManager` / `approveThesisByClient` / `rejectThesisByClient` → `dbService.saveThesis` |
| Domain reuse | `planThesisSave`, `assertThesisReadyForReview`, `activateThesisByManager` / `canActivateThesis`, `approveThesisByClient`, `rejectThesisByClient` |
| Multi-thesis | Explicit `thesisId` required — positional thesis authority **0** |
| SPEC-001 | Integration via ACTIVE thesis state only — routing unmodified |
| Compatibility path | Legacy ThesisEditor / ClientWorkspace / ClientPortal → `thesisLifecycleConsumer`; React remains `DISPLAY_ONLY_REACT`; command seam exposes `thesisLifecycleCommands` |
| Removal eligibility | Not eligible — 6 other cutover-spine writes remain |
| Evidence | `specs/010-react-migration/cr-1-thesis-lifecycle.md`; `tests/cr1ThesisLifecycle.test.ts` |

---

## CR-1 Workstream 4 — Signal Intake (post-adoption note)

| Field | Value |
|---|---|
| Registry IDs | **#8**, **#24**, **#26** |
| Commands | `RegisterSource` (#8+#24 consolidated), `RegisterManualSignal` (#26) |
| Owner | CR-1 Signal Intake Application (operational) |
| Previous legacy authority | `main.ts` → `dbService.addSource` / `dbService.addSignal` with caller-built org ownership |
| Dedup disposition | Signal fingerprint content identity unchanged; **lookup client-scoped** per F6 §186 (was global leakage) |
| SPEC-001 | Intake ends at persistence; routing/scoring remain SPEC-001 after return |
| Noncutover | IDs **9, 20, 22, 25** · see `cr-1-noncutover-ownership.md` |
| Compatibility path | Legacy SourceRegistry / ClientWorkspace → `signalIntakeConsumer`; React remains `READ_ONLY_REACT`; seam exposes `signalIntakeCommands` |
| Removal eligibility | Not eligible — 3 other cutover-spine writes remain (#28/#31/#32) |
| Evidence | `specs/010-react-migration/cr-1-signal-intake.md`; `tests/cr1SignalIntake.test.ts` |

---

## CR-1 Workstream 5 — Execution Delivery (post-adoption note)

| Field | Value |
|---|---|
| Registry IDs | **#28**, **#31**, **#32** |
| Commands | `TransitionClientTask`, `SaveContentDraft`, `ReviewClientArticle` |
| Owner | CR-1 Execution Delivery Application (operational) |
| Domain reuse | `TASK_TRANSITIONS`, `contentPipeline`, `articleReviewCore`, `claimSafetyGateCore` (shim) |
| SPEC-003 | Consumed via `ContentStrategicBriefGatePort` → `AuthorizeStrategicDownstream` for strategic ContentItem updates — ownership expansion **0** |
| SPEC-006 | Consumed via `ContentPublicationGatePort` — ownership expansion **0** |
| SPEC-004 / SPEC-008 | Not owned — expansion **0** / learning authority **0** |
| Compatibility path | Legacy ClientPortal / content-editor / article-review / teleprompter complete → `executionDeliveryConsumer`; seam exposes `executionDeliveryCommands` |
| Remediation | P1 Brief gate + P2 teleprompter closed; **classification R2** fail-closes thesis-only / ambiguous legacy (`LEGACY_AMBIGUOUS`) — see `cr-1-execution-delivery-classification-r2.md` |
| Noncutover | IDs **14–19, 27, 33** Execution Delivery · **21** composite · see `cr-1-noncutover-ownership.md` |
| Removal eligibility | Cutover spine complete — noncutover 22 owned but not canonicalized; T-010-403/404 `BLOCKED_BY_OTHER_PRECONDITION` |
| Evidence | `specs/010-react-migration/cr-1-execution-delivery.md`; `cr-1-execution-delivery-remediation.md`; `cr-1-execution-delivery-classification-r2.md`; `cr-1-noncutover-ownership.md`; `tests/cr1ExecutionDelivery.test.ts` |

---

## CR-1 noncutover ownership — Phase B ratified

**Governance artifact:** `cr-1-noncutover-ownership.md`  
**Base checkpoint:** `6579f9a9c247eb9c2ac2f57cd8251d52470786a6`  
**Status:** NONCUTOVER OWNER DISPOSITION **COMPLETE** · implementation **DEFERRED**

Per-row debt metadata (owner resolution does not change `CU?`):

| # | Final owner | Owner state | Integration SPEC | CU? | Stage B | MVP E2E | Canonicalization target |
|---|---|---|---|---|---|---|---|
| 2 | Master Profile | `#2` canonical | — | **YES** | LEGACY_ISLAND | PARTIAL | `AddProfileFact` · `#2 CANONICALIZED_AND_FROZEN` · implementation `40f9b59` · acceptance `14a8436` · React not started |
| 3 | Master Profile | `#3` canonical | — | **YES** | LEGACY_ISLAND | PARTIAL | `ConfirmProfileFact` · `#3 CANONICALIZED_AND_FROZEN` · candidate → confirmed · React not started |
| 4 | Master Profile | `#4` canonical | — | **YES** | LEGACY_ISLAND | PARTIAL | `RejectProfileFact` · `#4 CANONICALIZED_AND_FROZEN` · candidate → rejected · no reopen · React not started |
| 5 | Master Profile | `#5` canonical | — | **YES** | LEGACY_ISLAND | PARTIAL | `UpdateProfileFact` · `#5 CANONICALIZED_AND_FROZEN` · confirmed value-only · React not started |
| 6 | Master Profile | `#6` canonical | — | **YES** | LEGACY_ISLAND | PARTIAL | `ImportProfileFactsFromCv` · `#6 CANONICALIZED_AND_FROZEN` · local Domain extract · no AI/network · React not started |
| 7 | Master Profile | OWNER_RESOLVED_BY_CURRENT_EVIDENCE | — | NO | LEGACY_ISLAND | NOT_REQUIRED | Proof wall toggle |
| 9 | Signal Intake | OWNER_RESOLVED_EXISTING | SPEC-001 post-ingest consumer | **YES** | COMPLETE | REQUIRED | `PollRegisteredSource` / `PollAllActiveSources` |
| 14 | Execution Delivery | `#14` canonical | SPEC-003 gate | **YES** | LEGACY_ISLAND | REQUIRED | `DecideCuration` · Wave B3 **CANONICALIZED_AND_FROZEN** |
| 15 | Execution Delivery | OWNER_RESOLVED_BY_CURRENT_EVIDENCE | SPEC-005 AI (live) · local heuristic fallback | **YES** | LEGACY_ISLAND | REQUIRED | `ProposeAngle` · Wave B5 **CANONICALIZED_AND_FROZEN** |
| 16 | Execution Delivery | `#16-R`/`#16-O` canonical | — | **YES** | LEGACY_ISLAND | PARTIAL | Remove / reopen curation |
| 17 | Execution Delivery | `#17` canonical | — | **YES** | LEGACY_ISLAND | REQUIRED | Delivery package assembly · Wave B4 **CANONICALIZED_AND_FROZEN** |
| 18 | Execution Delivery | OWNER_RESOLVED_BY_CURRENT_EVIDENCE | SPEC-003/004/006/007 via adapter | **YES** | COMPLETE | REQUIRED | `SendDeliveryPackage` orchestration |
| 19 | Execution Delivery | `#19` canonical | — | **YES** | LEGACY_ISLAND | REQUIRED | `AcknowledgeDelivery` · Wave B7 **CANONICALIZED_AND_FROZEN** |
| 20 | Signal Intake | OWNER_RESOLVED_BY_CURRENT_EVIDENCE | — | **YES** | LEGACY_ISLAND | REQUIRED | `DiscardSignal` · Wave A1 **CANONICALIZED_AND_FROZEN** |
| 21 | **COMPOSITE** Execution Delivery + Signal Intake | SPLIT_AUTHORITY | — | **YES** | LEGACY_ISLAND | REQUIRED | **#21a radar CANONICALIZED_AND_FROZEN** (Wave B1) · **#21a advisor CANONICALIZED_AND_FROZEN** (Wave B2) · **#21b CANONICALIZED_AND_FROZEN** (Wave A2) · full composite canonical |
| 22 | Signal Intake (recommendation only) | OWNER_RESOLVED | SPEC-001 routing | PARTIAL | LEGACY_ISLAND · PHASE6_REMOVE_LATER | PARTIAL | Retire or replace recommendation store |
| 23 | POST_MVP_PRESENTATION_STATE | POST_MVP | — | NO | POST_MVP | NOT_REQUIRED | None required |
| 25 | Signal Intake | OWNER_RESOLVED_EXISTING | — | NO | LEGACY_ISLAND | PARTIAL | Source status / run record |
| 27 | Execution Delivery | `#27` canonical | — | **YES** | LEGACY_ISLAND | REQUIRED | `AssignClientTask` / `CancelClientTask` · Wave B10 **CANONICALIZED_AND_FROZEN** |
| 29 | Master Profile | OWNER_RESOLVED_BY_CURRENT_EVIDENCE | — | NO | LEGACY_ISLAND | PARTIAL | Toggle evidence ↔ thesis |
| 30 | Master Profile | OWNER_RESOLVED_BY_CURRENT_EVIDENCE | SPEC-006 publication only | NO | LEGACY_ISLAND | PARTIAL | Add evidence vault item |
| 33 | Execution Delivery | OWNER_RESOLVED (ratified) | SPEC-003 · SPEC-005 · create ≠ SaveContentDraft | **YES** | LEGACY_ISLAND | REQUIRED | **CANONICALIZED_AND_FROZEN** (Wave B9) |

### Special representations

**#21 — split authority (do not collapse):**

| Mutation | Owner | Status |
|---|---|---|
| `addToCuration(...)` radar `.btn-send-to-curation` | Execution Delivery Application | **CANONICALIZED_AND_FROZEN** (#21a Wave B1) |
| `addToCuration(...)` advisor `.btn-advice-to-curation` | Execution Delivery Application | **CANONICALIZED_AND_FROZEN** (#21a Wave B2) |
| `MarkSignalSaved` / `decideSignal(..., SAVED)` | Signal Intake Application | **CANONICALIZED_AND_FROZEN** (#21b) |

Composite handler `.btn-send-to-curation` is **fully canonical** (#21a B1 + #21b A2). Advisor path **canonical** under B2.
Registry row #21 `CU? = YES` — all #21a/#21b authoritative production paths migrated; infrastructure `DbCurationAdapter` retains sole legacy `dbService.addToCuration` seam.

**#30 — verified flag:** legacy UI `verified: true` = **NONAUTHORITATIVE_LEGACY_METADATA**.
Formal SPEC-006 Verification / `AuthorizePublication` authority **0**. Compatibility
advisory readers (`claimSafetyCore`, `thesisStrengthCore`) may use the flag
heuristically only.

**#33 — create path:** `CreateContentDraft` (Wave B9) covers all three initial-create
presentation intents (`FORM_GENERATE`, `SCIENTIFIC_ARTICLE`, `RECOMMENDATION_TASK_SCRIPT`).
`SaveContentDraft` contract **not expanded** — remains edit-existing only (#31 frozen).

**NEXT ACTION (post-ratification):** `IMPLEMENT_CR2`
