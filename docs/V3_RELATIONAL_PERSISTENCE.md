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

- `project(document, ownerId, bodyweightIds, signatureSchemes = {})` validates a schema-8 canonical identity document and creates complete relational rows. Bodyweight keys must be supplied and retained separately. The returned load handle also carries declared request signature schemes; retain that handle when creating the action facade. It neither writes nor migrates a destination.
- `assemble(rows, ownerId)` reconstructs the canonical state, bodyweight keys and request signature schemes, validates it through accepted validators and reprojects every row to reject loss, orphan/duplicate rows, incorrect ownership/order, incomplete responses and shadowed facts. Database array order is immaterial; stored positions are not.
- `create({client, ownerId})` accepts the existing authenticated Supabase client and the verified session's Auth UUID. SQL derives authority from `auth.uid()`, not from the supplied UUID. `load()` uses one consistent-snapshot `gymbro_workout_read` RPC; it returns explicit `initialized: false` only when workout tables are empty, never on error. The RPC avoids capped/paginated table reads. `commit(before, after)` invokes one atomic `gymbro_workout_commit` and validates the acknowledged full read.
- `createActions({initial, repository, createId, now, createBodyweightId})` returns `getWorkoutState()` and asynchronous `execute(actionName, ...arguments)`. Mutation arguments keep existing field names, but `exercise` is a canonical UUID. Reviewed imports must already resolve each exercise explicitly; no smart resolution/catalog UX is added. Optional `originalLabel` on a new/changed exercise reference must be an exact alias for that ID. Existing provenance is retained on ordinary corrections.

The facade reuses `createWorkoutActions` and guidance/session/note validators. Its private candidate view uses canonical IDs as exercise keys. `prepareOnly: true` returns `PREPARED` without persistence or committed-state publication. Current local callers remain synchronous and unchanged. The facade validates the candidate, awaits the repository and only then publishes detached state/returns `OK`. Pending calls cannot publish a second candidate; failures keep prior committed state. No-op and exact guided replay avoid writes. Known legacy signature exercise fields are compared in the private candidate view by canonical ID; stored signatures retain their original bytes and opaque signatures remain opaque.

The SQL commit diffs the supplied before/after row bundles, performs only supported changed-row/deletion operations and verifies the complete acknowledgement inside the same transaction. Append-only facts cannot be replaced. A failed constraint rolls back earlier rows too. A fail-closed exact-base precondition prevents this synthetic foundation from blindly replacing unexpected saved content; it does not define #40's revision protocol, retry/rebase policy, two-device UX or delayed-response recovery. There are no automatic retries/offline queues. This adapter remains opt-in for synthetic single-writer verification until later acceptance/activation gates.

## Migration and recovery

Use only [#38's reviewed-revision pipeline](V3_INFRASTRUCTURE.md#preview-promotion). The target is existing GymBro-Staging `obebuvpsqapgevwivwho`; Production is excluded. A clean committed revision, passing relevant CI, staging schema/ledger inspection, explicit plan/apply, subsequent list/verify and no-op apply are required. CI rebuilds only its disposable local database, with no hosted credentials. No runtime deployment applies SQL automatically.

Recovery is ledger/schema inspection and a reviewed forward repair, not resetting hosted data, deleting identities, editing applied migrations or weakening constraints. Code rollback keeps the local workout authority and additive tables. No destructive downgrade is implemented. M0 personal-backup/device evidence remains required before #28's personal migration tests.

## Verification and acceptance evidence

Final executable code: `826c77a6df9814be3bfa80765f2b51cacce1493f`, application **3.5.5-20261028T205308Z**. The bounded #39 foundation passed its technical checks; overall acceptance remains pending the #27 dependency and explicit Level 3 human acceptance. The [synthetic fixture](../tests/relational-fixture.cjs) fabricates its records and never reads personal browser data. [Node tests](../tests/workout-repository.test.cjs) test the actual DOM-free adapter. [Generated SQL tests](../scripts/workout-repository-db-fixture.cjs) compose existing domain-action packets with real RPCs, full-content reads, constraints and RLS in a rolled-back transaction.

| Criterion | Actual method/evidence | Result |
| --- | --- | --- |
| AC-1 | Approved model, source migration, fresh/reset replay and reviewed #38 staging apply, matching ledger/schema and no-op reapply. | **PASS** |
| AC-2 | Canonical/alias FKs, full-content round trips and rename with live set/snapshot references; explicit request schemes and UUID-shaped-alias replay after reload. | **PASS** |
| AC-3 | Separate scopes, exact legacy text/unknown metadata, null manual-target uniqueness and invalid snapshot-note FK rejection. | **PASS** |
| AC-4 | Actual template role/removal writes preserve contextual relationships, catalog identity and original immutable snapshots. | **PASS** |
| AC-5 | Sessionless facts, independent order, planned/actual substitutions, completed corrections, original request bytes and tombstones; unknown signature formats stay opaque. | **PASS** |
| AC-6 | Ten DOM-free tests and actual SQL RPC save/read packets, including reviewed imports; delayed/failed acknowledgement preserves committed state, excluded rows stay excluded and duplicate import writes nothing. | **PASS** |
| AC-7 | 110 new relational assertions: ownership/anonymous/cross-user paths, FKs, uniqueness, single-active, append-only intent/requests and multi-row atomic rollback. Fresh/reset/hosted passes. | **PASS** |
| AC-8 | Synthetic fixtures only; independent post-test query found zero fixture Auth/workout owners; no personal Production dataset migration/mutation. | **PASS** |

## Completion report

**Scope and delivery:** #39 only, [PR #59](https://github.com/dnk1000/GymBro/pull/59). Starting main `bec9d865cb41d9d56c204ba48468f2259f9664ab`; branch `codex/issue-39-relational-implementation`; final code SHA above. Subsequent commits change only evidence documentation; the PR records the final delivery SHA. Scope checked with base-to-HEAD filenames/diff, staged/unstaged/base whitespace and clean-tree checks. No unexplained user changes were discarded. The interrupted agent work was preserved in stash before the fresh implementation branch. Unexpected changes: None. Exact 22-file list below.

**Classification and release:** Change Level 3; design and 3.5.0 mapping approved in issue #39. Candidate patch builds record the verified corrections within that release; final build is **3.5.5-20261028T205308Z**. Workout schema **8**, relational model **1**, migration **20261028042000**. No material design deviation; creation markers, explicit signature schemes and deferred graph staging implement the approved integrity contracts. No new local backup/interchange schema. Applied earlier migrations remain unchanged. Candidate records in [V3_RELEASE.md](V3_RELEASE.md), [CHANGELOG.md](CHANGELOG.md) and [RELEASE_HISTORY.md](RELEASE_HISTORY.md) do not declare an accepted Production release.

**Final code CI:** [40767524072](https://github.com/dnk1000/GymBro/actions/runs/40767524072) passed both jobs. [Application job](https://github.com/dnk1000/GymBro/actions/runs/40767524072/job/123095566421): **200/200**, syntax **45 JS files**, canonical release and base-range whitespace. Existing 320/390/desktop, backup/import, storage, session/guidance and note workflows remain covered. [Database job](https://github.com/dnk1000/GymBro/actions/runs/40767524072/job/123095566754): **71 existing + 9 identity + 110 relational = 190 assertions**, on BOTH fresh and reset/replayed PostgreSQL databases, followed by no-op apply and metadata verification. Final focused local repository suite **10/10**; original local full regression **196/196** before the four added focused cases. Final CI covers all additions.

**Hosted staging:** existing GymBro-Staging `obebuvpsqapgevwivwho`, PostgreSQL **17.11**, October 28, 2026. Clean reviewed `f970d2e0d3da284dc4c5914b6e6bd4bc34888bdb` initially applied only the new migration through #38's plan/apply procedure. The ledger contained all four expected versions. Read-only metadata reported **16 tables including the reused catalog**, all RLS enabled, and **166 constraints**, all validated. Applied workspace migration SHA-256: `0AB93C0A7E8146640C06910B94FEC7E9B6CE4F2256EB9CCDA96F81B36B5342FB`. The migration is byte-for-byte unchanged at final code SHA `826c77a`; no applied file was edited.

**Final hosted integration/recovery:** at the exact clean final code SHA, the guarded [operator helper](../scripts/verify-preview-relational.cjs) ran **110/110 actual pgTAP assertions** through the Management API query path, checking collected output/count and raising on failures. Its transaction rolled back; a separate targeted query again found **0 synthetic Auth rows and 0 synthetic workout owners**. Reapply at that SHA reported up to date. This is SQL-role/RPC/RLS evidence with synthetic identities, not #27's pending real signed-session/recovery evidence. No hosted reset/destructive downgrade or personal migration occurred.

**Vercel/browser:** [final-code deployment](https://vercel.com/dnk-9999/gymbro/6y5WPykqDPQhA1Uk2HT6U34dV6Sd) succeeded. [Exact branch Preview](https://gymbro-git-codex-issue-39-relational-implementation-dnk-9999.vercel.app/) served **3.5.5-20261028T205308Z**; authenticated desktop Chrome read-only Dashboard/Data checks passed with **no console warnings/errors**. DOM inspection confirmed that the workout UI does not load the repository. Initial Vercel protection was preserved; the user signed in normally before retest. No live browser workout mutation was performed. Responsive Chromium is not physical Safari evidence.

**Known negative evidence and limits:** local Docker was unavailable; no local SQL pass is claimed. An initial sandbox run blocked temporary-Git fixtures; authorized rerun passed without weakening tests. [Initial SQL CI](https://github.com/dnk1000/GymBro/actions/runs/40760092303) exposed an invalid xmin/subtransaction assumption; the database-managed creation marker fixed it. [The next run](https://github.com/dnk1000/GymBro/actions/runs/40761312974) exposed immediate FK state across repeated RPCs and a test reaching immutable-target protection before its intended FK; explicit deferred staging/forced validation and a valid invalid-insert test corrected the causes. Later regressions failed before fixes for excluded import rows and opaque signature fields; those tests remain and pass. Constraints/assertions were not weakened. Prior candidate/build evidence remains in the release records and immutable CI runs.

**Data and handoff:** no Production schema/configuration/data operation, personal backup/migration, cloud-authority activation or cutover. No physical iPhone Safari test is claimed; no new phone flow is activated, and M0 gates remain before #28. The local key/schema and existing manual/guided UI stay active. Full migration, final concurrency/retry policy, cloud lifecycle/restore/reset, catalog/smart-import UX, AI and voice remain separate. All eight #39 technical ACs pass individually above. Overall acceptance/closure remains pending **#27 hosted recovery/second-browser/signed-user isolation** and **explicit Level 3 human acceptance**. No other issue was started. The issue remains open and PR unmerged; review readiness is not acceptance, merge or Production approval. No required technical verification is reclassified as optional human work.

Exact changed files (22), grouped for review:

- Runtime: `app-version.js`, `workout-actions.js`, `workout-repository.js`.
- SQL: `supabase/migrations/20261028042000_workout_relational_foundation.sql`, `supabase/verify-infrastructure.sql`.
- Verification: `.github/workflows/ci.yml`, `scripts/check-release.cjs`, `scripts/verify-preview-relational.cjs`, `scripts/workout-repository-db-fixture.cjs`, `tests/app-version.test.cjs`, `tests/release-tools.test.cjs`, `tests/relational-fixture.cjs`, `tests/workout-repository.test.cjs`.
- Documentation: `README.md`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/CURRENT_ARCHITECTURE.md`, `docs/RELEASE_HISTORY.md`, `docs/V3_RELATIONAL_PERSISTENCE.md`, `docs/V3_RELATIONAL_SCHEMA_PROPOSAL.md`, `docs/V3_RELEASE.md`, `docs/VERSION_POLICY.md`.
