# Issue #39 — relational schema and persistence boundary proposal

Status: **proposed; approval pending; implementation has not started**. Prepared for [issue #39](https://github.com/dnk1000/GymBro/issues/39) from accepted `main` `018004a971a5c44dbfb8b0098679f3e26cd9d261`. This document does not establish an implemented schema, approve a migration or declare an issue complete.

## Decision and implementation gate

**Change Level 3:** this work establishes authoritative workout relationships, database authorization/constraints and an asynchronous persistence boundary. Issue #39 specifies the required concepts but has no assigned Change Level, approved complete schema proposal or release mapping. The existing designs below cover important parts, not this complete model and transaction boundary.

[Development workflow](DEVELOPMENT_WORKFLOW.md#change-level-3--architecture--data--security--high-risk) requires: “Dependent implementation waits for the relevant approval to be recorded.” The safe independent deliverable is this design and verification proposal. Record the owner's approval and any amendments here before implementing the affected SQL/repository/action changes. Readiness is **Needs decision**; this is not a request to approve merge or Production work.

Recommended decision: approve the model and foundation-only boundary below for #39, with `3.5.0` reserved for #39 alone if implementation adds shipped JavaScript or executable deployment configuration. This version is a proposal under [VERSION_POLICY.md](VERSION_POLICY.md), not an existing assignment. Documentation-only preparation changes neither version nor BUILD. Detailed SQL/function names and internal helper organization remain implementation discretion within this contract.

## Governing contracts and current state

- [PRD](GymBro_PRD.md): current product scope; sections 7, 21, 22 and 24 require distinct templates/sessions/actual work, recovery, complete backups and persist-before-success actions. The [M0 decision](V3_M0_SCOPE_AND_ACCEPTANCE.md) approves staged cloud persistence, connectivity-required saves and later controlled cutover.
- [Current architecture](CURRENT_ARCHITECTURE.md), [V2 architecture](V2_ARCHITECTURE.md), [actions](WORKOUT_ACTIONS.md), [sessions](WORKOUT_SESSIONS.md) and [guidance](GUIDED_WORKOUTS.md): one workout state, immutable intent, explicit completion/membership and preserved request identities/tombstones.
- [#16 identity design](EXERCISE_IDENTITY.md): immutable owner-scoped UUIDs, exact aliases, original labels, lossless canonical projection and same-owner foreign keys. Reuse its existing tables and applied migration unchanged.
- [#25 notes](NOTE_SCOPES.md): session, exercise occurrence, durable setup and set scopes; unknown legacy meaning stays unknown.
- [#27 ownership](V3_ACCOUNT_ACCESS.md#database-ownership-contract-for-39): Auth UUID ownership, permanent-user/owner RLS and no client service credentials.
- [#38 infrastructure](V3_INFRASTRUCTURE.md): additive source-controlled migrations, clean reviewed-revision staging apply, disposable replay and explicit Production approval.

Dependency issues #16, #25, #27 and #38 and their issue discussions were read. Their implementation foundations are on accepted main. Open issues and merged code do not establish all acceptance: notably #27 still records outstanding hosted recovery, second-browser and signed-user isolation evidence. That remains a dependency for #39 acceptance; this proposal neither implements #27 nor relabels its pending results as passes.

The current checkout contains workout schema **8**, canonical identity document version **1**, and the local `daveGymTrackerV1` workout store. Documents describing deployed V2/schema 7 remain historical/deployment evidence; this proposal does not infer a Production rollout from main. `createWorkoutActions` currently requires synchronous persistence. Passing a Promise to that callback would violate its contract.

## Scope and activation

Implement only the relational foundation, lossless row/domain projection, repository adapter and DOM-free action integration needed to prove synthetic save/read behavior. Keep the current UI on its existing local adapter. Do not add startup loading, automatic upload, cloud/local dual writes, a cloud-workout UI switch or an automatic local fallback.

The foundation is exercised explicitly with disposable data on local/CI and the existing GymBro-Staging Preview database. It is not enabled for personal workouts. #40 still owns the complete multi-device revision/retry contract; #41 owns cloud restore/reset/account lifecycle; #28 owns full migration and Preview parity; #29 owns cutover. No other issue is started here. Existing account/diagnostic behavior, seven views, interchange and local backups remain supported.

## Proposed relationship model

All new tables use the `gymbro_` prefix. Every private row has an immutable `owner_id` referencing `auth.users(id)` without cascading account deletion. Every owned relationship includes `owner_id` in its foreign key. Existing session/set/template/import IDs remain exact nonempty text; only canonical exercise IDs are required to be UUIDs. Position is never substituted for an existing stable identity.

The following names describe the proposed tables; columns listed are the governing facts, not exhaustive DDL. Each applicable row/container also preserves unknown metadata and serialization information as described below.

| Table | Primary identity / stored facts / relationships |
| --- | --- |
| Existing `gymbro_exercises` and `gymbro_exercise_aliases` | Reuse #16's owner-scoped identity, metadata, status, provenance and exact aliases. No new name-key catalog. |
| `gymbro_workout_state` | One initialized record per owner; independent relational model version, program name/status, selected template FK and 30/60 selection, legacy preference text and root/program/container extension metadata. Absence means uninitialized, not an empty loaded workout. |
| `gymbro_templates` | `(owner_id, template_id)`; name, focus, intensity and explicit template array order. Current reusable definition, independent of historical snapshots. |
| `gymbro_template_slots` | `(owner_id, template_id, slot_index)`; canonical exercise FK, original label, role and short-mode inclusion. Index reflects the current index-addressed template contract; it is not exercise identity or historical snapshot-slot identity. |
| `gymbro_sessions` | `(owner_id, session_id)`; local workout date, lifecycle status, actual creation/completion timestamps, historical template-origin ID, selected duration, snapshot name/null and session array order. Historical template-origin ID deliberately has no FK to the mutable current template. |
| `gymbro_snapshot_slots` | `(owner_id, session_id, plan_slot_id)`; immutable slot ID/order, planned canonical exercise FK, original label and role. No FK to current template slots. |
| `gymbro_sets` | `(owner_id, set_id)`; actual canonical exercise FK and original label; date, load/unit/reps, RPE/RIR, pain/area, exact set notes, explicit completeness, source/import metadata, global array order, optional session/slot FKs and session-relative order. No second persisted set array. |
| `gymbro_bodyweights` | `(owner_id, bodyweight_id)`; local date, value, source and extension/import metadata, explicit array order. Equal date/value records are allowed. The new relational key is allocated once; it is not an inferred historical ID or timestamp. |
| `gymbro_guidance` | `(owner_id, session_id)`; current snapshot-slot FK and existing guided revision. Absence preserves unguided state. |
| `gymbro_guided_slots` | `(owner_id, session_id, plan_slot_id)`; actual canonical exercise FK/original label and explicit pending/completed/skipped status. One per snapshot slot when guidance exists, ordered by the immutable snapshot. |
| `gymbro_guided_requests` | `(owner_id, session_id, request_id)`; original submitted signature, stable submitted set ID and request array order. Unique submitted set ID within a session. Missing live sets remain tombstones; no cascading live-set FK. |
| `gymbro_imports` | `(owner_id, import_id)`; exact duplicate-protection ID, date, batch, template/duration context, original summary/count/notes and committed timestamp when present, plus array order. Keep the ID after deleting imported sets. |
| `gymbro_session_notes` | `(owner_id, session_id)`; exact scoped text and note metadata/order. Legacy `sessions[].notes` remains separately preserved extension data with scope unknown. |
| `gymbro_exercise_session_notes` | Unique `(owner_id, session_id, exercise_id, plan_slot_id)` with nulls treated as equal; session, actual canonical exercise and optional snapshot-slot FKs; original label, exact text and metadata/order. Null slot means manual/unplanned occurrence, never a fabricated slot. |
| `gymbro_exercise_setup_notes` | `(owner_id, exercise_id)`; exact durable setup text, original label and metadata/order. Separate from legacy preferences and session observations. |

`auth.users` supplies account identity; the singleton is workout initialization/settings, not a second identity provider. Current legacy preferences remain their exact label/text mapping as provenance, consistent with #16; they are not used as canonical identity keys. No new goals, injury classification or preferences taxonomy is inferred.

The active session ID is derived from the single active session rather than stored twice. Reads reconstruct the existing detached domain shape, including `activeSessionId` and `session.setIds`, from constrained relationships/order. Template order, set array order and session set order are independent stored ordering facts. They must survive a round trip even when they differ.

Bodyweights lack an existing ID. #39 tests use explicitly allocated disposable relational keys and prove order/content preservation. #28 must persist its source-to-destination key mapping for restartable migration; repeated identical bodyweights must not be collapsed or assigned new keys on retry. No personal migrator is implemented by this proposal or by #39.

## Constraints and security

1. **Ownership:** enable RLS on every new table; revoke public/anon access. Use #27's restrictive permanent-user policy (missing/anonymous claim fails closed) plus owner `USING`/`WITH CHECK`. Owner and existing stable IDs cannot be updated. Authenticated grants expose only supported foundation operations. No workout/account cascade deletion or reset entry point is introduced.
2. **References:** owner-composite FKs cover exercises, sessions and snapshot slots. A set's non-null slot requires a session. A composite `(owner_id, session_id, date)` FK enforces linked-set date equality. Source labels are provenance and do not need to equal today's canonical name.
3. **Lifecycle and order:** a partial unique index permits at most one active session per owner. Check status/duration/timestamp validity and nonnegative unique order positions at their proper scope. Completed sessions cannot gain set membership; ordinary corrections retain membership/date/slot. Deletion removes the set row/order entry and keeps the session and requests. Deferred checks permit valid multi-row transactions without accepting contradictory final state.
4. **Historical intent:** reject updates to session identity/date/original template intent/duration/snapshot and snapshot slots through ordinary action writes. Session completion updates only lifecycle facts; note/history corrections and current template changes do not mutate intent. Future #30 adaptation requires its own approved representation.
5. **Guidance and retries already supported:** current slot must exist in that session; guided slots must cover the saved snapshot exactly. Request IDs/signatures remain immutable. A live referenced set must belong to the request's session and a valid slot; a missing set is permitted as a tombstone. Check both request writes and set writes so later set insertion cannot create a contradictory reference. Exact guided replay writes nothing, changed-input reuse rejects, and deletion never recreates a set.
6. **Notes:** enforce same-owner targets and scoped uniqueness. A note's actual exercise can differ from planned/current guided exercise after substitution. Two slots and manual use of the same exercise remain distinct. Empty text is a recorded clear; absence is not silently converted to a note. Aliases explicitly mapped onto one target must not silently overwrite conflicting note text.
7. **Values and provenance:** enforce accepted supported units, finite numeric values/ranges, completeness and required shapes where SQL can safely do so; retain domain validation for action transitions, reviewed imports and contextual rules. Do not tighten schema acceptance beyond supported source contracts merely because current seed fixtures are narrower. Import batch strings are provenance: existing records do not prove a foreign-key relationship to an import summary, so do not invent one by parsing labels/IDs. Import IDs themselves remain owner-unique.
8. **Atomic access:** use invoker-rights, fixed-search-path RPCs with explicit authenticated/permanent-owner checks and narrowly granted execution. A commit applies a validated action's row changes in one database transaction; any failed constraint rolls back all its rows. Reads use one consistent database snapshot. No UI performs table calls or independently sequences a multi-table commit. Review triggers, RPCs and direct granted paths together; RLS does not replace relational constraints.

Implement common structural invariants with FK/unique/check constraints first, deferred constraint triggers where a final multi-row relationship must be checked, and shared domain validation where SQL cannot express the product rule safely. Do not use successful zero-row mutations as save acknowledgement. Database error detail must not expose credentials or another owner's data.

## Lossless representation and compatibility

Relational model version starts independently from workout backup schema 8 and identity document version 1. This issue does not bump workout `DATA_VERSION`, replace the local key or change complete-JSON/interchange formats. Database migration timestamps are independent identifiers.

Projection records canonical columns, original labels and original ordered relationships. Per-row/container extension objects preserve unknown keys without allowing them to overwrite known authoritative columns. Preserve optional-field presence separately where omission differs from explicit null; do not silently normalize a valid source record. Preserve opaque `noteScopes.legacyValue`, old note locations, legacy library definitions and unknown root/program/note-container metadata for recovery/comparison. They are compatibility material, not a second mutable catalog or workout store.

Local dates round-trip exactly as local calendar dates. Timestamps are stored only when actually present; typed database timestamps must reconstruct the exact canonical UTC ISO representation accepted by the source validator. Preserve numbers, zero, null, units, explicit `complete: false`, original request signatures, import metadata and all exact note text. Reject PostgreSQL-unrepresentable NUL/unpaired-UTF-16 input visibly before writes; no lossy cleanup is authorized. Verify decoded content and relationships, not JSON object key order or record counts alone.

Stored facts include selected mode, explicit slot status, submitted request signature, import provenance and array/session order. Derived values include current active pointer, session set-ID lists, displayed exercise name, counts for presentation, volume/rankings/comparisons and trainer evidence. Do not persist new derived performance fields. Existing import summary counts remain part of their accepted source/action contract rather than being reinterpreted as metrics.

## Persistence and domain-action boundary

Proposed direction:

```text
explicit caller -> DOM-free action preparation/validation -> repository commit
                                                        -> one transactional RPC
                    detached committed state <---------- durable acknowledgement
```

The repository owns row mapping, database access and complete validated read assembly. Shared domain actions own workout rules. UI adapters own rendering, confirmations and visible drafts. The repository never reads DOM/localStorage and never establishes a fallback workout authority.

Proposed public foundation interface:

- `load()` asynchronously returns a complete validated canonical state, or an explicit uninitialized/error result. Partial paginated reads, permission errors and failed loads cannot become empty success. Owner is authenticated session identity, not an arbitrary UI-supplied owner.
- `commit(preparedChange)` asynchronously applies one prepared domain action atomically and returns durable acknowledgement plus the resulting detached state/identifiers, or a structured failure. This is not an unchecked arbitrary whole-database replacement/upsert API. Restore/reset/migration orchestration remains outside this issue.
- A DOM-free asynchronous action facade accepts stable canonical exercise IDs, retains original labels and delegates to the existing action preparation/validation rules. Extract/reuse the narrow candidate-building logic needed by both transaction paths; do not rewrite the workout engine or route by mutable canonical display names. Keep the existing synchronous local factory/API unchanged for its current callers.

The asynchronous path is explicitly `prepare -> validate -> await commit -> publish committed state -> return success`. It does not call the local synchronous `persist` with a Promise, fake a successful save while a request is pending, or publish optimistic authoritative state. Failure preserves the prior committed state and returns errors; the future UI caller retains its draft. `NO_CHANGE` and accepted guided replay avoid database writes. A load error cannot reseed or initialize an account automatically.

The foundation's writes are opt-in synthetic, single-writer verification only. It must not claim cloud concurrency/retry safety or become the active workout store before #40/#41/#28 gates. Reuse existing guided revision/request semantics; do not design account-wide stale-write arbitration, automatic retries, delayed-response reconciliation, offline queues or cloud recovery policy here. Those are explicit follow-on issues, not missing features to silently add to #39.

## Migration, recovery and release handling

After design approval, add a new transactional additive migration; do not edit any applied #16/#27/#38 file. Reproduce it from empty local/CI PostgreSQL, reset only the disposable local stack, replay all migrations and verify no-op reapply. Extend the existing verification query/tests for the reviewed schema.

Before hosted apply, inspect staging schema/ledger and disposable records; review the exact committed SHA, migration list and passing relevant CI. Use only [#38's Preview procedure](V3_INFRASTRUCTURE.md#preview-promotion) for `obebuvpsqapgevwivwho`. Verify actual schema/constraints/RLS/ledger, insert/read/delete only uniquely identified synthetic test records, compare full content/relationships, and repeat apply as a no-op. Do not touch existing diagnostic/access markers or other test owners' rows.

On failure, inspect schema and ledger, preserve evidence and prefer an approved forward repair. A lost response may follow a committed transaction; do not blindly retry. Keep the prior app/local authority available; do not reset hosted databases, remove constraints, edit migration history or drop tables as rollback. Code rollback does not downgrade data.

M0's verified personal backup, existing-data confirmation and physical-iPhone gates remain required before personal migration testing in #28. This foundation uses synthetic records only and does not claim those gates passed. No Production schema/data/configuration change, personal dataset migration, cloud restore or cutover is included.

If the proposed `3.5.0` mapping is approved and shipped code changes, set one committed UTC BUILD in `app-version.js` and align release checks/candidate records with that exact build. Do not record a shipped release in `RELEASE_HISTORY.md` without actual acceptance/deployment evidence. The current documentation proposal changes no build.

## Validation approach and acceptance mapping

The eight identifiers below preserve issue #39's acceptance-criterion order. Proposed tests are requirements for implementation, not performed results. **All implementation criteria remain UNVERIFIED.**

| Criterion | Required evidence after approval | Current result |
| --- | --- | --- |
| AC-1: reviewed model implemented on Preview through approved pipeline | Recorded design approval; fresh/replayed disposable SQL passes; exact reviewed SHA/migration and hosted staging apply/ledger/schema/no-op evidence. | UNVERIFIED — proposed model only; no SQL added or applied. |
| AC-2: stable canonical identity | Reuse actual #16 catalog tables; automated ID-based row/action round trips, rename/alias tests, no fuzzy collapse and cross-owner FK rejection. | UNVERIFIED |
| AC-3: conservative note scopes | Full-content round trips of all four scopes, repeated slots, substitutes/manual use, exact legacy text and opaque fields; conflict/invalid-target rejection. | UNVERIFIED |
| AC-4: contextual template role/order | SQL and projection tests prove distinct per-template role/short/order values, independent catalog metadata and unchanged snapshots after current-template edits. | UNVERIFIED |
| AC-5: historical intent and actual set relationships | Multiple same-date sessions, sessionless history, differing global/session set order, unplanned sessions, substitutions, completed corrections/deletions and guided tombstones, with no invented links/times. | UNVERIFIED |
| AC-6: domain persistence boundary | DOM-free tests execute existing domain actions through the asynchronous facade and real disposable repository save/read; delayed/failing commit cannot publish success/state; current synchronous local regressions remain valid. | UNVERIFIED |
| AC-7: constraints/uniqueness coverage | pgTAP/integration tests of owner/anonymous/cross-user CRUD, ownership transfer, all same-owner FKs, note/request/order uniqueness, single active session, lifecycle/snapshot protections, atomic rollback and full-content reconstruction. Test direct granted paths as well as RPCs. | UNVERIFIED |
| AC-8: no personal Production dataset migration | Diff limited to this proposal/index; no application, configuration, SQL, stored data or provider operation in preparation. Retain this exclusion in implementation evidence. | PASS for preparation only; implementation-phase evidence remains required. |

Additional implementation checks: relevant action/session/guidance/identity/note/import/storage regressions, syntax/release/diff checks, and unchanged local UI/storage behavior. Test synthetic boundary values and unknown metadata, equal bodyweights, missing import summaries, missing-vs-null fields, unsupported encodings, atomic multi-row failure and fail-closed loads. Do not weaken accepted assertions to fit the new schema. If hosted verification or required integration is unavailable, report a blocked technical handoff rather than implementation complete.

As long as no workout UI is changed/activated, there is no new phone flow to accept in #39. Any affected UI requires appropriate Preview/browser/desktop/320/390 px checks; physical Safari evidence remains distinct. Explicit Level 3 human acceptance follows technical verification. #27's outstanding dependency evidence must be resolved or explicitly dispositioned by the governing owner before #39 acceptance.

## Preparation handoff

Only this proposal and its documentation-map entry are delivered. Runtime, SQL schema, dependencies, configuration, local workout data and Production are unchanged. This is **blocked pending design decision**, not implementation complete or Ready for human acceptance. Pending work is design approval/recording, the applicable release mapping, implementation, technical verification and explicit Level 3 acceptance. Merge remains separately prohibited without user approval.
