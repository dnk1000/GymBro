# Canonical exercise identity — issue #16

Issue [#16](https://github.com/dnk1000/GymBro/issues/16), based on accepted main `b40156bd943d230bdfa2e636390b85f5be1fd639`. Branch `codex/issue-16-exercise-identity`. The user approved application `3.3.0` for this candidate on October 27, 2026. This foundation does not switch workout persistence or run a personal migration.

## Identity and ownership

GymBro allocates an immutable UUID for each canonical exercise. Canonical display name, primary/secondary muscles, movement pattern, equipment, type, active/archive state, provenance and preserved metadata belong to that record. Template role/order/short inclusion stay on the template relationship; session snapshot intent and actual guided substitution stay on their existing relationships. Legacy `status: core/accessory/...` is preserved as metadata, not interpreted as archive state.

Aliases are exact, case-sensitive, whitespace-sensitive labels mapping to one ID within one owner. The current display name is also registered as an alias. Renames retain former names and all historical source labels. A label collision rejects the entire change. Similar-looking labels remain separate unless the caller supplies an existing explicit alias or deliberate mapping. There is no fuzzy matching, equivalence list, catalog editor or merge UI here; #17/#18 own those interactions.

Database migration [20261027233000_exercise_identity.sql](../supabase/migrations/20261027233000_exercise_identity.sql) creates `gymbro_exercises` and `gymbro_exercise_aliases`. Their keys are `(owner_id, exercise_id)` and `(owner_id, label)`, with a composite alias foreign key preventing cross-owner references. IDs/owners cannot be updated. The display-name trigger registers aliases atomically and rejects another identity's label. Authenticated permanent users may select/insert/update their own exercises and select/insert aliases. Deletion and alias reassignment are not granted; archive preserves identity. Account deletion semantics remain #41's responsibility; there is no cascading workout deletion decision here.

Both tables enforce [#27's ownership contract](V3_ACCOUNT_ACCESS.md): Auth UUID owner, owner RLS plus restrictive permanent-user RLS, no signed-out privileges, no privileged browser credentials. Trigger functions use invoker privileges and an empty search path. #39 must use same-owner composite foreign keys for template/session/set references. This issue intentionally does not create those authoritative tables or a second workout repository.

## DOM-independent conversion/API boundary

Issue #25 extends the source contract to workout schema 8 and projects both exercise-bearing [scoped-note arrays](NOTE_SCOPES.md) through these same canonical IDs. New conversions use `sourceSchemaVersion: 8`; prior identity-version-1/schema-7 documents still recover their exact original source, including opaque metadata. The schema-7 descriptions below record the original #16 foundation; #25 does not reinterpret their notes or change the catalog SQL migration.

[exercise-identity.js](../exercise-identity.js) defines immutable API object `ExerciseIdentity`. Load it after the existing data/session/guidance modules; `performanceContext` additionally uses the accepted performance module. It is not called at startup or loaded by the current V2 UI. There are no storage/network/DOM operations.

| API | Contract |
| --- | --- |
| `createExercise(catalog, input)` | Detached catalog with a new UUID (or supplied GymBro UUID), explicit provenance and display-name alias. |
| `resolveLabel(catalog, label)` | Exact lookup returns ID or `null`; no normalization or automatic creation. |
| `addAlias(catalog, mapping)` | Explicit mapping to an existing ID; repeat same mapping is harmless, reassignment rejects. |
| `renameExercise(catalog, exerciseId, displayName)` | ID remains fixed; old aliases remain and collisions reject. |
| `migrateV2(source, {catalog, mappings})` | Async, nonmutating conversion of validated schema-7 input. Normalize supported older backups with existing `migrateData` first. |
| `restoreV2Source(document)` | Validate every canonical relationship and recover the complete original schema-7 source. This is verification/recovery material, not an active fallback store. |
| `verifyV2Migration(source, document)` | Compare complete content/relationships and array order after lossless projection, including unknown metadata. Reject mismatches even when counts agree. |
| `performanceContext(document, {exerciseId, asOfDate, ...})` | Aggregate by stable ID through accepted deterministic numerical/unit/session rules. Historical records retain original labels. Label-scoped preference text remains separate, unparsed `sourcePreferences`. |
| `databaseRows(document, ownerId)` | Project every canonical field and alias to the SQL table column contract; no writes. |
| `verifyDatabaseCatalog(document, ownerId, rows)` | Compare full returned catalog content, alias relationships and ownership independent of database row order; counts alone cannot pass. |

The identity document uses independent `identityVersion: 1` and `sourceSchemaVersion: 7`; it is not a schema-7 backup and must never be passed to current V2 restore. `data` contains the original source sections without root `version`/`exerciseLibrary`. Each set/template-slot/snapshot-slot `exercise`, and guided-slot `actualExercise`, becomes `{exerciseId, originalLabel}`. The ID is authoritative; the label is provenance. This nested representation avoids overwriting unknown fields on existing records. All other record fields, IDs, session ordering, dates, units, notes, pain, explicit uncertainty, request signatures/tombstones, preferences and import metadata remain unchanged.

`legacyExerciseLibrary` preserves the exact source definitions for comparison/recovery, including conflicting metadata from explicitly mapped labels. It is not consulted as a mutable canonical catalog. Canonical provenance is `built-in`, `user-created`, `import-created`, or `legacy` when original creation provenance is unknown; conversion does not fabricate that origin. Unknown historical exercises missing from the library get their own canonical record with empty unspecified metadata.

For a first conversion, IDs are deterministic UUIDv8 values derived from SHA-256 of the exact JSON-encoded legacy label and a GymBro namespace. This is allocation only: persist the resulting catalog and reuse its aliases on retry. Renaming does not recompute identity. Hash collisions reject as duplicate IDs rather than merge. UUIDs are owner-scoped, so different owners can independently retain the same deterministic legacy ID. New exercises use random UUIDs unless an explicit existing GymBro ID is supplied.

Conversion is a pure candidate build: interruption cannot alter source/destination. Repeating it with the same source/catalog yields identical output; repeating against a renamed persisted catalog retains IDs and the rename. Existing alias conflicts reject instead of overwriting a populated destination. #28 must still coordinate a transactional/restartable destination import using #39/#40's persistence contract, compare database content, and retain a verified backup. `databaseRows` is not an unchecked upsert/replacement implementation. PostgreSQL text/JSON encoding limitations (such as NUL or unpaired UTF-16) must fail visibly at the persistence boundary; no lossy text cleanup is authorized.

## Deployment, recovery and acceptance

Use [#38's migration pipeline](V3_INFRASTRUCTURE.md). This additive migration runs only through explicit reviewed-revision staging apply; opening a Preview does not apply schema or upload workouts. Production promotion remains separately approved. On failure, retain source/backup and inspect the migration ledger; the migration transaction rolls back partial DDL. Recovery is a reviewed forward fix or reusing the prior app build while retaining the additive tables, not deleting identities. Never edit an applied migration or apply a destructive downgrade to get green tests.

Validation level: **3**. The focused Node tests cover full-content preservation, all name-bearing relationships, explicit aliases, canonical renaming, ID-based performance, exact-label separation, seed/V5 conversion, repeat/retry, destination conflicts and deliberate corruption. SQL tests cover constraints, immutability, rename atomicity, archive retention, owner/permanent-user enforcement and cross-owner rejection. [The generated disposable test](../scripts/exercise-identity-db-fixture.cjs) passes the actual converted shipped seed through PostgreSQL exercise/alias tables plus a transaction-scoped test set-fact table with canonical foreign keys, comparing full fields and facts. It runs on both fresh and replayed CI databases. The transaction-scoped test fact table is test evidence, not #39's future schema.

Local Docker/Supabase start was unavailable (`LocalDbRunningError: failed to inspect service`); no local SQL pass is claimed. [PR #48](https://github.com/dnk1000/GymBro/pull/48) and [release evidence](V3_RELEASE.md) record passing CI fresh/reset replay, hosted staging apply/no-op retry/RLS metadata, the exact revisions and the read-only live Preview check. Physical iPhone Safari, personal Production backup verification, full relational/personal migration and cloud workout parity are not performed here. M0's personal-data gates still apply before #28. Keep #16 open until its evidence is accepted; a green build alone is not acceptance.

Current V2 UI/actions, schema 7, `daveGymTrackerV1`, reviewed interchange and complete backup/restore remain active. The V3 boundary is ready for #39/#28 integration; the live workout UI continues its accepted name-key behavior until that deliberate transition. No catalog UX, smart-import UX, note reclassification, AI/provider integration, Production data/configuration operation or merge is included.
