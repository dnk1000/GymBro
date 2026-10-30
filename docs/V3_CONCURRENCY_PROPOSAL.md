# Approved implementation decision — October 30, 2026

The owner approved this exact proposal at bee6650f0dcac4cd6c0b537c224de401e5049e9a and 3.6.0 for #40 alone in the attached execution request. This satisfies the Level 3 design/release gate. The original preparation status below is retained as historical evidence and is superseded by this approval. No new design is proposed. Implementation evidence: [V3_CONCURRENCY.md](V3_CONCURRENCY.md). Merge and Production remain unauthorized.

# Issue #40 — concurrency, revision and retry proposal

Status: **proposed; implementation blocked pending design approval**. Prepared for [issue #40](https://github.com/dnk1000/GymBro/issues/40) from accepted `main` **7f4408aee7d51ff21aad421bf924c529baaae90e** on October 29, 2026 (America/New_York). This is a design deliverable, not an implemented protocol or an acceptance claim.

## Decision required

**Change Level 3** applies: account-wide concurrency, durable request identity, replay after uncertain delivery, database write permissions and historical-data integrity change foundational contracts. Issue #40 has no recorded proposal approval or release mapping. The approved [#39 design](V3_RELATIONAL_SCHEMA_PROPOSAL.md#persistence-and-domain-action-boundary) explicitly excludes this protocol; its approval does not cover #40.

The [development workflow](DEVELOPMENT_WORKFLOW.md#change-level-3--architecture--data--security--high-risk) requires: “Dependent implementation waits for the relevant approval to be recorded.” Approve this design, including its write-permission transition and guarded synthetic Preview UI, before SQL/runtime implementation. Record the decision and any amendments in this document and issue #40. Pending approval means the issue is **Needs decision**, not Ready.

Recommended release decision: reserve **3.6.0 for #40 alone** for the new concurrency/retry protocol capability. This is proposed under [VERSION_POLICY.md](VERSION_POLICY.md), not an approved assignment. Subsequent fixes within that candidate use PATCH and a committed UTC BUILD. This documentation preparation changes neither application version nor BUILD. Design/version approval does not authorize merge, Production work, personal migration or cutover.

## Authorities and inspected baseline

- [PRD](GymBro_PRD.md), [M0 decisions](V3_M0_SCOPE_AND_ACCEPTANCE.md) and [current architecture](CURRENT_ARCHITECTURE.md): historical truth, connectivity-required cloud saves, durable acknowledgement, explicit staged migration and no automatic local fallback.
- [Issue #39](https://github.com/dnk1000/GymBro/issues/39), its approved design and [implemented boundary](V3_RELATIONAL_PERSISTENCE.md): schema-8 canonical documents, independent relational model 1, owner-scoped relationships, immutable snapshots, ordered facts and an opt-in asynchronous repository. GitHub marks #39 closed and its implementation is merged in this baseline; older pending/unmerged wording in its delivery record is historical evidence, not an instruction to reopen or implement #39.
- [Actions](WORKOUT_ACTIONS.md), [sessions](WORKOUT_SESSIONS.md), [guidance](GUIDED_WORKOUTS.md) and their source/tests: clone/validate/persist/publish, existing guided `expectedRevision`, original request signatures, exact replay, changed-input rejection and deletion tombstones. Local `storage.js` detects changed saved bytes and pauses writes; it cannot provide a PostgreSQL transaction across devices.
- Existing `workout-repository.js` uses one read RPC and one atomic commit RPC. The commit obtains an owner advisory transaction lock and compares the entire prepared base. The action facade prevents overlapping calls and publishes only after acknowledgement. Transport errors become a generic error, and a lost acknowledgement cannot currently be reconciled safely. This is the documented #39 limitation, not evidence that #40 already passes.
- [#38 infrastructure](V3_INFRASTRUCTURE.md#preview-promotion) owns additive migrations, exact reviewed-revision staging apply, disposable replay and recovery. [#27 ownership](V3_ACCOUNT_ACCESS.md#database-ownership-contract-for-39) owns permanent-user claims and private Auth UUID ownership.

## Bounded implementation and activation

Extend the existing repository/action boundary. Keep normal workout UI on the accepted local adapter and `daveGymTrackerV1`. Do not start #28, #41, #29 or another issue, migrate personal data, enable cloud workouts on startup, add real-time collaboration, introduce an offline write queue, or add provider/voice behavior.

Implement the protocol across the existing supported mutation facade, with representative evidence for session creation/finish, manual and guided set logging, corrections/deletion, reviewed import, notes and template changes. Do not leave uncovered mutation methods on a last-write-wins path. Retain existing domain validation, canonical IDs, signature schemes, original labels, notes, unknown metadata and complete content/relationship checks.

Add a small, explicitly opened staging test page using the same repository/actions and conflict adapter. Use the existing fail-closed Preview configuration, permanent-user authentication and existing GymBro-Staging project. The page operates only on dedicated synthetic test accounts, verifies the expected fixture identity, refuses unexpected existing contents and never reads local workout storage. No privileged key or fixture seeding privilege ships to a browser. Fixture setup/cleanup follows the reviewed operator path. Production configuration cannot enable the page's data operations. This page supplies real conflict/error UI and two-context evidence without changing normal workout authority.

## One concurrency boundary

Use one monotonically increasing **owner workout revision** for the complete authoritative aggregate returned by the repository, including its catalog references. It is transport metadata, separate from workout schema 8, identity document version 1 and each session's existing guided revision. Return revisions as validated decimal strings to avoid JavaScript integer precision loss.

Every mutation submits its loaded owner revision and prepared base. Under the existing owner transaction lock, the server compares both against current saved state before writing. Keep the complete-base comparison as a fail-closed integrity check; a revision is not permission to replace arbitrary content. A successful meaningful mutation advances the owner revision once and commits facts, revision and receipt together. Failed validation, stale input and receipt replay change no workout facts/revision. Initialization is serialized with a defined uninitialized revision; applying the migration to an existing synthetic owner starts its protocol counter at zero without inventing historical versions.

Owner-wide serialization deliberately rejects otherwise independent stale changes too. It fits the existing complete-state action model, preserves relationships and avoids a new field-merge engine. There is no automatic rebase, blind revision replacement or last-write-wins. Record-level revisions/automatic merging are alternatives deferred until a separately justified need exists.

Keep guided `expectedRevision` and its domain checks. The owner revision protects cross-device authoritative state; the guided revision still protects slot/session intent. A caller must never replace a stale guided revision or retarget a set/session automatically. Active-session contention uses the same transaction, lifecycle guards and single-active-session constraint; no device lease or device ownership transfer is added.

## Request identity and durable receipts

Every remotely submitted mutation has one immutable operation key and frozen prepared packet. For guided logging, derive the operation key from the existing `(sessionId, requestId)` namespace; preserve the original domain signature and tombstone semantics. Other mutations use one caller-generated request ID per intentional submission. Scope operation keys by owner and namespace so unrelated sessions/actions cannot collide. Equal intentional sets with different IDs remain distinct.

Before transmission, freeze action name/arguments, original owner revision, original guided context, generated session/set/bodyweight IDs, timestamps and prepared before/after facts. A retry resends that packet; it does not rerun ID allocation, timestamps or domain preparation. Reusing a key with a different frozen packet is `REQUEST_CONFLICT`, including after other changes. Existing semantic guided replays continue to recognize the original domain request after navigation, correction or deletion; the transport receipt does not replace that ledger.

Persist an owner-scoped receipt atomically with the facts. It identifies the protocol version, operation key, server-computed canonical packet fingerprint, committed owner revision and original result identifiers. Fingerprint the complete submitted packet using a versioned deterministic database representation; do not rely on JavaScript object property order or a client-supplied digest alone. Retain receipts and explicit cancellation tombstones for the initial protocol; no expiration, eviction, pruning or automatic reset is permitted here.

Under the same owner lock, **look for the receipt before testing the old base revision**. An exact committed retry returns `REPLAY` and the original result identifiers with a fresh consistent snapshot and its current revision, even when later actions changed the account. It never reapplies the old candidate, restores an edited fact or recreates a deleted set. Return the operation's committed revision separately from the snapshot's current revision. A replayed deletion remains deleted; a replayed creation can identify a subsequently deleted target without recreating it. Only the authenticated owner can inspect its receipts.

A retry that arrives before the original simply competes for the same owner lock/key. At most one can commit. The receipt, facts and revision are one transaction: constraints or rollback cannot leave an acknowledged receipt for absent facts. Imports additionally retain their existing import-ID duplicate protection. A user retry is never silently converted into a different intentional submission.

## Database enforcement and interface transition

The current authenticated direct-table DML grants and old two-argument commit RPC must not remain ways to bypass revision/receipt checks. Add a new migration rather than editing an applied migration. Transition all tables participating in the returned aggregate, including canonical catalog/alias writes, to authenticated reads plus the new checked mutation RPC. Keep the diagnostic/access-check tables outside this workout protocol.

Proposed enforcement is a narrowly scoped `SECURITY DEFINER` mutation RPC owned by a dedicated non-login, non-superuser, non-`BYPASSRLS` writer role. Grant that role only required workout/catalog/receipt DML and helper access; give browser roles no membership or ability to assume it. Keep RLS enabled and extend its owner/permanent-user policies to the writer role. Functions use fixed empty search paths, qualified objects and explicit `auth.uid()`/permanent-user checks. All submitted owner identities must match that authenticated UUID; errors must not expose another owner's state. Never use client service credentials or a general-purpose definer SQL endpoint.

Read/status RPCs must return a complete consistent owner snapshot with protocol version/revision. A narrowly scoped resolver can inspect or terminally fence a request under the same owner lock. The only mutation entry points are checked commit and request resolution; resolution cannot change workout facts. Audit function EXECUTE grants, table DML, triggers and role capabilities, and test hostile direct paths as well as normal repository calls. If this enforcement cannot be achieved without broader privileges, pause the affected implementation for a design amendment.

Old #39 write clients must fail visibly after the staging transition rather than succeed without the protocol. Keep complete read/projection compatibility where safe; explicitly reject an unsupported write protocol before mutation. This intentional transition affects only the opt-in synthetic foundation, not local workout/backup formats or an accepted cloud-workout deployment. Adapt old RPC-specific tests with an explanation of the approved transition and retain their original integrity assertions through the new path. No valid ownership/relationship test may be weakened.

## Client state, errors and recovery

Extend the existing asynchronous facade with explicit pending, outcome-unknown, conflict and ready presentation states and detached results. Keep the committed document private until a validated acknowledgement arrives. Expose structured codes and plain messages; the UI retains all entered values on pending/error/conflict, including explicit zero, false, notes and selected import rows.

An uncertain network result is `OUTCOME_UNKNOWN`: **“Save confirmation was lost. Your entry is still here. Check the result or retry this same request before submitting it again.”** It must not say either “Saved” or “The server did not save.” Preserve the frozen packet in memory and block new mutations until it is resolved; this avoids generating a duplicate intentional set. Only an explicit user retry/resolution makes another request. No timer, background sender or offline queue is added.

Retain only owner-scoped recovery identifiers/protocol metadata in session storage across reload, not workout drafts, before/after bundles, auth credentials or queued commands. This is an uncertainty marker, never a local workout authority. If writing that marker fails, do not transmit a new mutation whose identity could be lost. On reload, authenticate the same owner and resolve the marker before new mutations. Draft loss on hard reload remains explicit; do not claim otherwise. Signing into a different owner cannot resolve, replay or expose the previous owner's request.

Receipt lookup absence alone is **not** proof of failure: an original request could arrive later. Explicit “Check result”/reload resolution therefore takes the owner lock and either returns the durable receipt or records a terminal cancellation tombstone for that request key before releasing the lock. If the original committed first, return its receipt; if the cancellation won, every late original/retry is rejected without workout writes. Tell the user when an uncommitted submission was cancelled and require review before a new intentional request. A failed resolver leaves uncertainty in place. Session-storage markers are cleared only after a validated terminal result; unknown or incompatible markers fail closed and remain available for recovery.

On a definitive stale-write rejection use `CONFLICT`: **“Another tab or device changed this workout. Your entry has been kept. Refresh saved data, review the change, then submit again.”** Refresh explicitly loads committed state without clearing the draft or changing its original session/slot target. The UI shows a removed/changed target and requires review; it cannot silently attach an old draft to the newly active session. A new intentional submission follows that review. Authorization/load failures pause writes; they cannot become an empty account, a successful save or automatic local fallback.

Each request/refresh carries a client generation and server snapshot revision. Ignore responses from an older owner/session generation and snapshots older than the latest accepted revision. A delayed acknowledgement may resolve its original operation but cannot replace a newer accepted document. A stale refresh cannot clear a newer conflict/pending state. Duplicate clicks while pending share the original request or return a pending result without another prepared mutation.

## Concurrency matrix

The following are required outcomes and future test cases, **not performed results**.

| Case | Server outcome | Client/UI outcome |
| --- | --- | --- |
| Fresh manual set, session start or other mutation | Validate base/revision; commit facts, one revision and receipt atomically. | Publish acknowledged state; only then show success/clear saved input. |
| Double tap while awaiting acknowledgement | At most one packet/key is sent; any duplicate can only replay. | Keep input; show pending; do not allocate another set/session ID. |
| Exact retry after commit with lost response | Find receipt before stale-base check; return original IDs and current snapshot. | Show confirmed result once; no duplicate set/session/bodyweight/import. |
| Retry after server rollback | No committed receipt/facts; original frozen packet may commit once if its base is still current. | Keep input until acknowledgement; do not regenerate identities. |
| Same key, changed packet | Reject `REQUEST_CONFLICT`; no workout writes. | Keep changed input and explain that the original request must be resolved. |
| Same intentional values, new request IDs | Each valid sequential submission may commit. | Preserve legitimate repeated identical sets. |
| Two devices edit/delete the same fact | First valid transaction wins; second stale base conflicts. | Keep second draft; refresh/review explicitly; no overwrite or resurrection. |
| Two devices make independent stale changes | Conservative owner-wide conflict for the second. | Explain refresh/review; no automatic field merge. |
| Two devices start a workout from the same revision | One session/receipt commits; second conflicts and single-active constraint holds. | Show saved active workout on explicit refresh; never silently start another. |
| Two devices navigate/log/Done/Skip/substitute | Owner and guided revisions select one accepted ordering. | Preserve losing input; refresh/review exact slot/session; navigation never means completion. |
| Device finishes while another logs | If finish wins, stale logging cannot append to completed session; if logging wins, stale finish conflicts. | Show current facts/pending statuses for explicit reconsideration. |
| Retry a guided set after navigation/finish | Existing request identity replays; new stale requests fail. | Never log against a different current slot/session. |
| Retry creation after later correction/deletion | Receipt returns original identity and current target status; no old facts reapplied. | Show current corrected/deleted result; keep tombstones. |
| Duplicate import from two devices | Revision plus import-ID uniqueness prevent a second accepted batch. | Refresh/review; report existing import rather than logging again. |
| Delayed write acknowledgement after newer refresh | Receipt is valid, returned snapshot cannot regress published revision. | Resolve operation; retain newer state/draft status. |
| Out-of-order refreshes or account switch | Owner checks remain enforced on every call. | Generation/revision guards reject stale or wrong-owner publication. |
| Disconnect before submission | No transmission; no automatic queue. | Keep draft and report connectivity/save failure. |
| Disconnect at an unknown point after submission | Commit may or may not exist; preserve request identity. | `OUTCOME_UNKNOWN`; block a new mutation until explicit same-key retry/resolution. |
| Reload with uncertain request | Resolve receipt or atomically fence its absent key; late original cannot commit after a winning fence. | Load saved state; explain confirmed/cancelled result and any lost unsaved draft. |
| Direct DML, old RPC, anonymous/cross-owner call | Reject bypass/unauthorized paths; no facts/revision/receipt leak or mutation. | Visible failure; never fallback/reseed. |

## Migration, compatibility and recovery

Add protocol metadata/receipt storage and the checked RPCs through #38's pipeline on a clean reviewed revision. Never edit applied #39 SQL. Preserve all current facts/relationships/metadata; protocol rows do not become performance facts or change complete JSON/interchange semantics. Existing synthetic owners get a protocol baseline, not inferred historical request receipts. An old request with no new receipt remains protected by existing guided/import identities and the complete base check.

Verify migration from both empty and populated synthetic #39 state, full-content before/after equality, fresh/reset replay, no-op reapply, supported read assembly and explicit old-write rejection. Recovery after failed apply uses ledger/schema inspection and reviewed forward repair. Do not reset hosted data, prune receipts, remove constraints or re-enable the unchecked writer as a rollback. Code rollback must continue to fail closed if it cannot use the new write protocol. Future restore/reset/account deletion and receipt disposition belong to #41, not this implementation.

Use only GymBro-Staging `obebuvpsqapgevwivwho` for hosted verification. Inspect current schema/ledger, review exact SHA and passing relevant CI, plan/apply/list/verify and no-op reapply through the guarded operator tooling. Use uniquely identified synthetic fixtures and verify their cleanup; preserve unrelated staging records. No Production schema/data/configuration action or personal backup/migration is authorized or claimed. Existing M0 backup and physical-device gates remain before personal migration testing.

## Validation approach and acceptance evidence

The identifiers preserve the seven acceptance bullets in issue #40. These are required implementation checks after approval. Written coverage alone does not prove runtime guarantees.

| Criterion | Required method/evidence | Current result |
| --- | --- | --- |
| AC-1: written concurrency matrix | Review the matrix above against every required stale/retry/two-device scenario. | **PASS for proposal coverage only**; design approval pending. |
| AC-2: representative mutations through persistence boundary | DOM-free action/repository tests plus actual SQL RPC tests for create/log/edit/delete/finish/import/note/template; preserve action validation and publication ordering. | **UNVERIFIED** — implementation gated. |
| AC-3: no duplicate sets/sessions/imports on replay | Exact same-key retries, overlapping duplicates, new-key equal sets, independent repeated bodyweights, import IDs, corrections/deletion tombstones and conflicting packet tests against real transactions. | **UNVERIFIED** |
| AC-4: stale edits reject or reconcile explicitly | Real competing database connections, changed/deleted targets, owner/guided revision tests, direct-path rejection and full relationship/order comparison after rejection. | **UNVERIFIED** |
| AC-5: server commit with lost client response | Fault-inject acknowledgement loss after a real committed RPC; retry frozen packet; prove one mutation/receipt/revision and original IDs. Also test rollback, resolution fencing and late originals. | **UNVERIFIED** |
| AC-6: deterministic active session across devices | Concurrent real transactions for start/start, log/finish and guided mutations; exact outcomes, single active session, immutable intent and ordered memberships. Two authenticated independent Preview browser contexts exercise the same boundary. | **UNVERIFIED** |
| AC-7: conflict/error UI preserves input and explains outcome | Guarded synthetic Preview page and automated desktop/320/390 px tests for pending, stale conflict, unknown outcome, rejected request, reload/fencing and out-of-order replies; assert exact retained zero/false/text/import choices and no false saved message. Record browser/console evidence. | **UNVERIFIED** |

Additional technical evidence: ownership/anonymous/real signed-session isolation, non-login writer-role privilege audit, migration fresh/replay/populated upgrade, atomic rollback, receipt retention, revision precision, failed session-storage marker, two-owner generation guards, full affected regressions, syntax/release/diff checks and exact reviewed-revision staging evidence. Do not present sequential pgTAP calls as proof of concurrent independent transactions. Keep failed/negative evidence; missing environments/checks remain required, not optional human-owned work.

Existing synchronous local APIs and complete backup/import/session/guidance/note tests remain valid and must pass. Do not rerun these solely for this documentation proposal. The implementation's new test page requires Preview/desktop/narrow-width evidence; responsive Chromium is not physical Safari. No normal cloud-workout/iPhone flow is activated here; existing physical-device and personal migration gates remain with their governing scope. Explicit Level 3 human acceptance is still required after technical verification.

## Preparation completion report

**Scope and delivery:** #40 only; branch `codex/issue-40-concurrency-contract` from accepted main `7f4408aee7d51ff21aad421bf924c529baaae90e`. Preparation changes exactly `docs/V3_CONCURRENCY_PROPOSAL.md` and its `docs/README.md` index entry. The final delivery commit and unmerged PR are supplied in the chat/PR report. Runtime behavior changes: none. Unexpected changes: none. The original `C:\Source\GymBro` checkout's modified `workout-actions.js` and untracked `workout-repository.js`/migration are preserved; this isolated managed worktree does not use them as a baseline.

**Classification and verification:** intended implementation is Change Level 3 for the reasons above. Preparation checks passed for all 48 local link occurrences across the two changed documents (including anchors), Markdown fence balance and consistency with the inspected contracts. Delivery also checks base/staged/unstaged whitespace and the exact two-file scope before committing. Application suites, SQL replay, Preview/device tests and hosted operations are not performed for this documentation-only change; the implementation criteria remain explicitly unverified above.

**Data and documentation:** no schema/data/permissions/configuration/dependency/runtime changes, no application/BUILD change and no release acceptance record. This proposal is indexed as proposed rather than an accepted subsystem contract. No Production operation or personal backup/migration is claimed.

**Deviations and negative evidence:** runtime implementation has not begun because the required design approval and release mapping are absent; this is a gated preparation handoff, not an approved deferral or a replacement for any implementation AC. No known implementation failure is relabeled as a pass. Initial sandbox `git fetch` failed before writing `FETCH_HEAD`; the authorized fetch then succeeded. Git status in the new managed worktree required authorized shell access; it confirmed a clean detached baseline before branch creation. No automatic approval rejection occurred.

**Claimed state and handoff:** **blocked pending design/release decision**. Owner approval of this concrete design and proposed 3.6.0 mapping is next; record it before SQL/runtime work. Remaining work includes all implementation, required technical verification AC-2 through AC-7 and design review of AC-1, followed by explicit Level 3 acceptance. No merge is authorized. No other issue is started.
