# V3 relational foundation — issue #39

Candidate implementation from accepted main `bec9d865cb41d9d56c204ba48468f2259f9664ab`, branch `codex/issue-39-relational-implementation`. The user approved the [design](V3_RELATIONAL_SCHEMA_PROPOSAL.md) and **3.5.0 for #39 alone** in this conversation; approval is recorded in [issue #39](https://github.com/dnk1000/GymBro/issues/39). This record distinguishes implemented code from verification and acceptance.

## Authority and activation

The workout UI retains schema **8** and `daveGymTrackerV1`. It does not load the new repository, contact workout tables, upload data on sign-in, dual-write or fall back between stores. The independent relational model is **1**; migration **20261028042000_workout_relational_foundation.sql** is additive. Applied #16/#27/#38 migrations are unchanged. No personal Production dataset is migrated. #28/#40/#41/#29 remain separate issues.

## Tables and facts

[The migration](../supabase/migrations/20261028042000_workout_relational_foundation.sql) reuses `gymbro_exercises` and `gymbro_exercise_aliases`. New owner-scoped tables are:

| Tables | Authoritative content |
| --- | --- |
| `gymbro_workout_state` | Initialization/model version, selected template/mode, program settings, existing preferences and root/container compatibility metadata. |
| `gymbro_templates`, `gymbro_template_slots` | Current names/details; per-template order, canonical exercise, original label, role and short inclusion. |
| `gymbro_sessions`, `gymbro_snapshot_slots` | Stable session and snapshot-slot identities, local date, lifecycle/timestamps, historical template origin/mode and immutable plan intent/order. Historical template origin is deliberately independent of current-template existence. |
| `gymbro_sets`, `gymbro_bodyweights` | Actual facts, canonical exercise/source labels, independent global and session order, units, zero/null/completeness, source/notes and optional-field presence. Bodyweight relational keys are supplied once, not inferred historical facts; duplicate date/value rows remain distinct. |
| `gymbro_guidance`, `gymbro_guided_slots`, `gymbro_guided_requests` | Navigation/revision, explicit status/actual substitution, exact original request signatures and set-ID tombstones. |
| `gymbro_imports` | Owner-unique duplicate-protection ID and exact existing summary/provenance, even after deleting its sets. Batch strings are not invented foreign keys. |
| `gymbro_session_notes`, `gymbro_exercise_session_notes`, `gymbro_exercise_setup_notes` | Separate #25 scopes with exact text/metadata/order, including planned-slot/manual occurrence distinction. Set notes stay on sets. |

All owned relationships include owner identity. Canonical label/ID composite FKs also ensure original labels resolve to the referenced exercise. Snapshot/session identity and request payloads are protected; ordinary corrections preserve linked membership, and completed sessions cannot acquire new members. A freshly inserted synthetic historical bundle may contain completed facts; this is not a personal migration workflow. New owned tables require an initialized workout owner. No account/workout reset or cascading account deletion is granted.

Foreign keys, unique constraints (including null manual-note targets), checks and deferred relationship checks enforce structural integrity. RLS requires both the authenticated owner and the restrictive permanent-user claim; public/anon access is revoked. RPCs run with invoker rights and fixed search paths. App/client code receives no privileged credential. Review metadata with [the existing verification query](../supabase/verify-infrastructure.sql).

`extra` contains only source properties not projected into columns. Sorted `present` keys retain omitted-vs-null semantics. Snapshot/root/program/note-container extension objects retain unknown content without shadowing canonical facts. The legacy exercise library is comparison/recovery metadata, not a mutable catalog. Unsupported PostgreSQL text encoding fails before writes. Original local dates and canonical ISO timestamp text remain exact; no historical times or note meanings are inferred.

Active pointer and session set-ID arrays are reconstructed from constrained facts/order. Display names, counts, performance/rankings and trainer evidence remain derived. No redundant performance metrics are added.

## Repository and action interface

[workout-repository.js](../workout-repository.js) exposes immutable `WorkoutRepository` and is intentionally absent from `index.html`:

- `project(document, ownerId, bodyweightIds)` validates a schema-8 canonical identity document and creates complete relational rows. Bodyweight keys must be supplied and retained separately. It neither writes nor migrates a destination.
- `assemble(rows, ownerId)` reconstructs the canonical state and bodyweight keys, validates it through accepted validators and reprojects every row to reject loss, orphan/duplicate rows, incorrect ownership/order, incomplete responses and shadowed facts. Database array order is immaterial; stored positions are not.
- `create({client, ownerId})` accepts the existing authenticated Supabase client and the verified session's Auth UUID. SQL derives authority from `auth.uid()`, not from the supplied UUID. `load()` uses one consistent-snapshot `gymbro_workout_read` RPC; it returns explicit `initialized: false` only when workout tables are empty, never on error. The RPC avoids capped/paginated table reads. `commit(before, after)` invokes one atomic `gymbro_workout_commit` and validates the acknowledged full read.
- `createActions({initial, repository, createId, now, createBodyweightId})` returns `getWorkoutState()` and asynchronous `execute(actionName, ...arguments)`. Mutation arguments keep existing field names, but `exercise` is a canonical UUID. Reviewed imports must already resolve each exercise explicitly; no smart resolution/catalog UX is added. Optional `originalLabel` on a new/changed exercise reference must be an exact alias for that ID. Existing provenance is retained on ordinary corrections.

The facade reuses `createWorkoutActions` and guidance/session/note validators. Its private candidate view uses canonical IDs as exercise keys. `prepareOnly: true` returns `PREPARED` without persistence or committed-state publication. Current local callers remain synchronous and unchanged. The facade validates the candidate, awaits the repository and only then publishes detached state/returns `OK`. Pending calls cannot publish a second candidate; failures keep prior committed state. No-op and exact guided replay avoid writes. Known legacy signature exercise fields are compared in the private candidate view by canonical ID; stored signatures retain their original bytes and opaque signatures remain opaque.

The SQL commit diffs the supplied before/after row bundles, performs only supported changed-row/deletion operations and verifies the complete acknowledgement inside the same transaction. Append-only facts cannot be replaced. A failed constraint rolls back earlier rows too. A fail-closed exact-base precondition prevents this synthetic foundation from blindly replacing unexpected saved content; it does not define #40's revision protocol, retry/rebase policy, two-device UX or delayed-response recovery. There are no automatic retries/offline queues. This adapter remains opt-in for synthetic single-writer verification until later acceptance/activation gates.

## Migration and recovery

Use only [#38's reviewed-revision pipeline](V3_INFRASTRUCTURE.md#preview-promotion). The target is existing GymBro-Staging `obebuvpsqapgevwivwho`; Production is excluded. A clean committed revision, passing relevant CI, staging schema/ledger inspection, explicit plan/apply, subsequent list/verify and no-op apply are required. CI rebuilds only its disposable local database, with no hosted credentials. No runtime deployment applies SQL automatically.

Recovery is ledger/schema inspection and a reviewed forward repair, not resetting hosted data, deleting identities, editing applied migrations or weakening constraints. Code rollback keeps the local workout authority and additive tables. No destructive downgrade is implemented. M0 personal-backup/device evidence remains required before #28's personal migration tests.

## Verification and acceptance evidence

Current implementation validation is in progress. No database/Preview pass is inferred from code or generated fixtures. The [synthetic fixture](../tests/relational-fixture.cjs) uses explicitly fabricated records; no personal browser data or tokens are read. [Node tests](../tests/workout-repository.test.cjs) verify projection, action reuse, pending/failing acknowledgements and fail-closed loads. [Generated integration tests](../scripts/workout-repository-db-fixture.cjs) compose actual domain-action row changes with real RPCs, constraints, full-content read comparisons and owner/anonymous isolation on a rolled-back PostgreSQL transaction, both fresh and after reset/replay in CI.

| Criterion | Evidence / current result |
| --- | --- |
| AC-1 | Approved model implemented in source; required disposable SQL and hosted Preview pipeline evidence pending — **UNVERIFIED**. |
| AC-2 | Canonical-ID/alias projection round trip passes locally; real relational constraint tests pending — **UNVERIFIED**. |
| AC-3 | All scopes, legacy text, optional fields and unknown metadata round trip locally; SQL targets/uniqueness pending — **UNVERIFIED**. |
| AC-4 | Contextual template changes preserve snapshots in local action tests; SQL integration pending — **UNVERIFIED**. |
| AC-5 | Independent order/sessionless facts/substitutions/tombstones preserved locally; database enforcement pending — **UNVERIFIED**. |
| AC-6 | Seven focused Node tests pass, including await/failure/no-state-publication and DOM-free actions; actual database save/read pending — **UNVERIFIED**. |
| AC-7 | SQL/integration test implementation exists; execution pending — **UNVERIFIED**. |
| AC-8 | Only synthetic fixtures used; no personal dataset/provider/Production mutation — **PASS for work performed**, to reconfirm at final handoff. |

Local Docker is unavailable (`docker` is not installed/on PATH). No local SQL pass is claimed. Full local regression passed **196/196**, including existing responsive browser workflows. Syntax (44 JS files), canonical release checks and 220 local documentation links passed. An initial restricted run failed only the temporary-Git tests because the sandbox denied Git fixture writes; the authorized full rerun above passed them without assertion changes. CI fresh/replay, hosted staging apply/no-op/metadata and exact code/build evidence remain required. Read-only staging ledger inspection matched the three accepted baseline migrations and showed only #39 pending. No physical iPhone or personal backup evidence is claimed. #27's hosted recovery/second-browser/signed-user-isolation evidence remains an acceptance dependency; it does not block this bounded foundation implementation. Explicit Level 3 human acceptance and merge approval remain pending.

Initial [CI 40760092303](https://github.com/dnk1000/GymBro/actions/runs/40760092303): 196/196 application regressions passed; SQL migration and existing SQL suites applied, but the new integration fixture failed its initial commit because row xmin differs under pgTAP subtransactions. Subsequent dependent assertions failed against the rolled-back empty state. The pending migration is corrected before hosted apply: a database-managed immutable creation-transaction marker handles this explicitly, and ordinary set upserts are distinguished from tombstone resurrection. Focused provenance regression also verifies new snapshots/guidance after canonical rename. No checks were removed or weakened.

For staging synthetic integration, set the existing reviewed `GYMBRO_DB_APPLY_REVISION` to clean HEAD, then run `node --env-file-if-exists=.env.local scripts/verify-preview-relational.cjs`. It reuses #38 staging/revision guards, executes generated pgTAP assertions through the pinned Management API query path (no local Docker), raises on any failed/missing assertion and rolls the transaction back. Raw CLI failure details are withheld.
