# Guided workouts — v2 Milestone 4

Application version is the canonical 2.4.0 build in `app-version.js`. Data schema advances independently from **6 to 7**, retaining `daveGymTrackerV1`. No Milestone 5, progression, timers, voice, AI, backend or synchronization is included.

## Established rules, not new prescriptions

The five existing templates specify ordered exercises, roles, `short` selections, Hard/Light labels and exercise-specific notes. They do not specify target sets/reps, rest periods, completion thresholds or substitution equivalence. None is introduced. 60-minute mode copies all existing slots (including those currently labelled substitute); 30-minute mode copies only `short` slots. Durations are approximate, not timers or guarantees.

Exercise identity is the existing library's exact exercise-name key. There are no separate stable exercise IDs in the current repository. Guided substitutions choose existing keys; no parallel identity system, renaming migration or equivalence map is created. Display snapshots keep original names.

## Schema 7

Sessions optionally have:

```js
guided: {
  currentSlotId: "slot-1",
  revision: 0,
  slots: [
    { planSlotId: "slot-1", actualExercise: "Smith Press", status: "pending" }
  ],
  requests: [
    { id: "unique-submission-id", setId: "existing-set-id", signature: "serialized submitted parameters" }
  ]
}
```

- `currentSlotId` is navigation only and must refer to an existing snapshot slot.
- `revision` guards delayed/duplicate actions. Each successful meaningful guided mutation advances it.
- `slots` exactly follows snapshot slot identities/order. Actual exercise can change locally; statuses are pending/completed/skipped and only explicit actions change them. Neither navigation, logging, deletion, nor editing infers status.
- `requests` records committed guided submissions. Request identity is independent of values; identical intentional sets with different IDs are allowed. Signature records original submitted parameters, not a recommendation or unsaved draft. Expected revision is excluded so exact retries can replay after subsequent actions. Reusing an ID with different input fails.
- Deleted set IDs remain as submission tombstones. Replays return the original ID and `deleted: true`, without recreating the set. Edits preserve request history; retries do not overwrite corrected historical records. Duplicate replays do not write storage.
- Sets retain all existing fields, stable IDs and `sessionId`/`planSlotId` relationships. There is no second set history or duplicate slot-level set array in persistence.

Migration 6→7 changes the schema version without creating guided state, timestamps or inferred completion. Supported older versions retain their prior conservative migration. Starting guidance or explicitly enabling it on an existing active session initializes every status pending, preserving the snapshot and all existing sets/slot links. Empty/unplanned/missing-library plans are rejected for guidance and remain usable manually. Corrupt guidance (including an invalid position) is rejected without repair or overwrite.

Older schema-6 applications safely reject schema-7 databases/backups. Keep the pre-upgrade JSON backup; never force a downgrade by removing fields or changing version numbers.

## DOM-free action interface

All mutations use the existing clone → validate → persist → commit transaction, returning `{ok, code, errors, changes, state, ...identifiers}`. Failed validation/persistence changes neither committed progress nor request history. No-op repeats report `NO_CHANGE` without writes. Existing stale-tab protections remain.

| API                                                                                | Purpose                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startGuidedSession({date, templateId, duration})`                                 | Create session, snapshot and initial guidance together in one write; reject an existing active session.                                                                                                                                            |
| `enableGuidance(sessionId)`                                                        | Explicitly initialize an active session with its original nonempty snapshot. Never infer statuses from existing sets.                                                                                                                              |
| `getGuidedWorkoutState(sessionId?)`                                                | Detached state: session/active pointer, revision, current/previous/next exercises, planned/actual names, statuses, ordered sets, remaining pending slots and factual previous performance. Defaults to active session; null for unguided sessions. |
| `selectGuidedSlot({sessionId, planSlotId, expectedRevision})`                      | Set position only.                                                                                                                                                                                                                                 |
| `moveGuidedSlot({sessionId, direction, expectedRevision})`                         | Move previous/next without changing status; reject boundaries.                                                                                                                                                                                     |
| `setGuidedSlotStatus({sessionId, planSlotId, status, expectedRevision})`           | Explicit Done (`completed`) or Skip (`skipped`), with no minimum work threshold.                                                                                                                                                                   |
| `substituteGuidedExercise({sessionId, planSlotId, exercise, expectedRevision})`    | Choose an existing library key for subsequent sets, without changing snapshot, template or older sets.                                                                                                                                             |
| `logGuidedSet({sessionId, planSlotId, expectedRevision, requestId, ...setFields})` | Log against the current slot and actual exercise using the session's local date. Supplied date/exercise must match. Exact retries return `REPLAY`; changed-input request reuse reports `REQUEST_CONFLICT`.                                         |
| `finishGuidedSession({sessionId, expectedRevision, allowPending?})`                | Finish atomically. Pending exercises require explicit `allowPending: true`; otherwise `CONFIRM_UNFINISHED` is returned without writes. Keep all pending statuses intact.                                                                           |

Existing `completeSession(id, options)` applies the same revision/pending guards to guided sessions; unguided calls keep their previous semantics. Completing records completedAt and clears the active pointer. Completed sessions cannot receive new members or guided mutations. There is no reopen workflow.

Active slots can still receive extra sets, or have Done/Skip explicitly changed, while the session remains active. Logging never changes the existing status; set records, including those before a substitution, remain authoritative about actual work performed.

## Previous performance

Use the exact actual exercise key, excluding the current session, future local dates and incomplete/invalid records. Return records from the most recent eligible date separately per unit. External loads require positive load; bodyweight and assisted records remain labelled separately, not ranked against external loads. No units are converted, no substitutes are treated as equivalent, and nothing becomes a target or is automatically prefilled as a load recommendation. Legacy records without explicit sessions remain eligible when otherwise suitable.

## UI, manual logging and resume

Workout offers template/date/approximate mode and Start workout. Active guidance exposes the current slot, saved intent, factual previous performance, recorded sets, Done/Skip, navigation, substitution and Finish. Log current exercise uses the existing set form, locking its guided date/exercise; manual mode remains available. Extra Done/Skip/Next controls sit beside the set form for gym use. Manual logging retains omitted/null/explicit session semantics and does not invent slot links.

A guided form has only transient adapter context: session/slot/revision/request ID. New intentional entry after success gets a new request ID; repeated taps on the just-saved form do not log another set. Rapid navigation taps are briefly guarded in the UI; domain actions also reject duplicate expected revisions. Unsaved meaningful input requires confirmation before guided navigation discards it. Failed saves preserve it. Partially entered forms do not persist or resume.

Reload/reopen restores committed position, choices, statuses and sets. Use Log current exercise to re-enter the guided set form. Normal backgrounding requires no final save, because each committed action already persisted. If Safari reloads the page, only unsaved form values are lost. History adds planned/current exercise and explicit status details inside the existing session card; it is not redesigned again.

Complete JSON backup/restore/merge retains guided state and request history. Identical session copies merge; differing progress/snapshot copies reject under the existing conservative session-conflict rule. Old backups restore without guidance. CSV and ChatGPT interchange/hashes remain unchanged and do not acquire guided-state fields.

## iPhone acceptance — pending

1. **Export production JSON and verify the file first.** Test only the milestone preview with disposable data or an intentional copy of the backup. Never restore test data over production.
2. Confirm the full 2.4.0 build footer. Choose a template and 30-minute mode, start, and verify only its established short slots. Finish on test data, then start 60-minute mode and verify all original slots.
3. Log two sets, including identical values intentionally entered again. Rapidly tap Log/Next and verify no unintended duplicate sets or skipped-over positions. Check keyboard-open usability and the controls beside the form.
4. Review previous performance and unit labels; it must be factual, with no targets or substitution equivalence. Check effort/pain/notes and incomplete records.
5. Mark Done, navigate back/forward and Skip. Navigation alone must not change status. Substitute after logging a set; verify earlier actual exercises, saved intent and permanent template remain unchanged.
6. Enter a partial set, try Next, cancel discard and confirm values remain. Save a set, move to another slot, background/reopen Safari, reload and reopen the tab. Verify saved position/status/substitution/sets. Unsaved partial form values are intentionally not restored after a reload.
7. Finish with pending slots, cancel once, then confirm. History should retain pending statuses, planned versus actual choices and all set records. Start another session only after finishing.
8. Use manual logging before and during guidance; confirm the established session association and History remain coherent. Restore a copied schema-6 active-session backup: guidance must require an explicit Enable guidance action.
9. Export → restore → export schema-7 JSON and verify guidance/request history, sessions/active pointer and all original database sections. A conflicting progress merge must reject without loss.
10. Record actual device, iOS/browser, build/commit and failures in `REAL_PHONE_SMOKE_TEST.md`. Chromium viewport checks are not physical Safari testing.

## Remaining product questions and debt

Training prescriptions, rest policy, completion thresholds and substitution equivalence remain undefined and unimplemented. The existing 60-minute inclusion of substitute-role slots is preserved pending a future product decision. No progression or Milestone 5 work is included.

Name-key exercise identity has the repository's existing rename limitations. localStorage is synchronous, quota/eviction-limited and not fully transactional across simultaneous tabs; request signatures add some backup/storage size. No draft recovery or cloud sync is added. Guided state changes are conservative whole-database transactions rather than a new persistence backend.
