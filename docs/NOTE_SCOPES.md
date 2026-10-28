# Note scopes — issue #25

Candidate from accepted main `08c57e38c7d8b0a68a78602a350f83b870a093c4`, branch `codex/issue-25-note-scopes`. The user approved **3.4.0 for #25 alone** in the implementation conversation on October 27, 2026. This issue does not start #39, #23 or #28, create a cloud workout repository, migrate personal data, or authorize Production delivery.

## Authoritative representation

Workout schema **8** adds `noteScopes` with three required arrays. Set notes remain on the original set record. Notes contain exact user text, including whitespace, line breaks and Unicode. Empty text is an explicit cleared note; it is not inferred from a missing value. Unknown metadata on note rows and containers survives complete backup/restore and canonical conversion.

| Scope | Stored location / unique target | Meaning |
| --- | --- | --- |
| Session | `noteScopes.session`: `{sessionId, text}` | Context for this explicit workout, such as a hotel gym or time constraint. |
| Exercise within session | `noteScopes.exerciseSession`: `{sessionId, exercise, planSlotId, text}` | Observation for this exercise occurrence. `planSlotId` distinguishes repeated planned slots; explicit `null` means manual/unplanned use within this session. |
| Durable exercise setup | `noteScopes.exercise`: `{exercise, text}` | Guidance intended to remain with the exercise across workouts. |
| Set | Existing `sets[].notes` | Observation attached to this particular set. |

Session IDs must resolve; non-null slot IDs must exist in that session's immutable snapshot. Exercise references must resolve in the current library. Duplicate targets, invalid text and contradictory scope keys reject. Saving a note cannot alter session membership, date, set order, snapshot, guidance progress, substitution, or permanent templates. A completed session can receive a note correction through the domain action without being reopened.

The current local runtime still uses exact exercise names. For the V3 boundary, `ExerciseIdentity.migrateV2` projects both exercise-bearing note arrays to `{exerciseId, originalLabel}`, using the same immutable canonical IDs and exact aliases as sets/templates/snapshots. Session and slot targets stay unchanged. Canonical rename does not rewrite original labels or note text. Scope is separate from canonical exercise metadata; session observations never become durable setup.

## Conservative compatibility and recovery

`migrateData` upgrades supported schemas 1–7 in memory and leaves every prior field intact, including `sets[].notes`, preferences, import-summary notes, any `sessions[].notes`, free text in exercise metadata, snapshots, request identities, pain and unknown metadata. No text parsing, inferred session, copied note, guessed scope or guessed durable setup is involved. Set notes have an existing deterministic set-record contract and retain that field. Other existing fields retain their original location/meaning.

Schema 7 had no reserved `noteScopes` contract. If an old backup already has that unknown root field, its complete value is preserved under `noteScopes.legacyValue`; the three new arrays start empty. Repeating a schema-8 load does not wrap or duplicate it. Legacy preferences remain labelled as existing exercise preferences, separate from new durable setup. Existing session free text is shown in History as scope not recorded. Import summaries remain import summaries, never fabricated sessions.

Startup writes nothing. Schema-8 data missing or corrupting required note structures, and unsupported future schemas, fail visibly through the existing raw-data recovery path. Older builds cannot read schema-8 backups safely; retain the original complete pre-upgrade JSON for recovery. Do not downgrade the version number on a schema-8 file. No rollback is claimed to downgrade data automatically.

The existing `daveGymTrackerV1` key remains authoritative. The first successful deliberate save persists the validated schema-8 candidate through the existing persist-before-commit/stale-tab guard. Failed saves keep committed data/raw storage and visible drafts intact. Drafts retain their original target across unrelated renders or exercise selection; they are transient and are not promised to survive reload. Successful complete restore/reset clears obsolete drafts. The domain action additionally requires `expectedText` to reject a stale same-note edit.

## UI and interchange

- Workout offers a session-note editor and an exercise-occurrence selector/editor while an explicit session is active. Manual/unplanned exercise occurrences remain available. Selecting a substitute does not move old notes to it.
- History shows session context at session level, exercise/session observations under that workout with their exercise/occurrence label, and original set notes in set rows. Durable setup is not displayed as a historical fact. Sessionless history stays sessionless.
- Existing Exercise Detail separates durable setup editing from dated session/exercise/set observations. It retains existing performance behavior. This is note-specific support; the broader canonical navigation/history/catalog work remains #23/#17.
- Complete JSON export/restore preserves all scoped notes and exact text. CSV remains sets-only, with the existing set-note column; it is not a full backup. The reviewed `gym-tracker-chatgpt-v1` interchange retains its existing set notes and import-summary session text contract; it does not gain an inferred explicit workout or a new scope schema here. Use complete JSON for scoped-note transfers.
- History merge imports session/exercise-session notes, rejects conflicting same-target content atomically, and is idempotent. Current durable setup wins for known exercises; notes for newly introduced exercises are brought with them. Current settings/legacy extension metadata retain the existing current-wins merge contract. Complete restore replaces all notes after validation and explicit confirmation.

## Integration contract for #39 / #28

The relational schema must represent these targets separately, enforce same-owner session/slot/exercise foreign keys and target uniqueness, and retain legacy text/provenance. Durable setup must be exercise-owned; exercise/session notes must reference an occurrence including its actual canonical exercise and optional planned slot. The same exercise may occur in two slots or as an earlier substitute, so `(session_id, exercise_id)` alone is insufficient. Manual/unplanned observations must not require fabricated snapshot slots. Historical sessionless sets continue owning their own notes.

This PR implements the local schema and canonical projection only. Authoritative PostgreSQL tables/repository integration belong to #39; full source/destination relational comparison, transactional retry and personal migration belong to #28/#40. The original identity-document version 1 can still recover schema-7 documents exactly; new conversions use source schema 8. Full-content verification includes the new note relationships and original text. No SQL migration is added or applied by #25.

## Acceptance evidence

Validation level **3**: schema/backup/persistence changes with focused note-scope regressions plus the relevant existing action/session/guidance/import/storage/browser regressions. Test data/storage are disposable. See [candidate release evidence](V3_RELEASE.md) for actual commands, counts, revisions and Preview results.

No personal Production backup, personal migration, hosted workout database, physical iPhone Safari test, Production data change, merge, or issue closure is claimed. The M0 personal-backup/device gates still apply before personal migration testing in #28. Responsive Chromium is not physical Safari evidence.
