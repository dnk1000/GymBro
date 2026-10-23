# Workout sessions — v2 Milestone 2

Milestone 2 adds a data model and DOM-free actions, not guided-workout controls or a new history interface. UI branding remains V1.6 while v2 is developed incrementally. Milestone 1 acceptance and production `main` commit `6f10b49` were confirmed by the user before this work began.

## Schema 6

The storage key remains `daveGymTrackerV1`; the database version advances from **5 to 6**. Two top-level fields are added:

```js
{
  version: 6,
  sessions: [],
  activeSessionId: null,
  // All previous database fields remain present and compatible.
}
```

Each newly created session persists exactly these fields:

| Field          | Purpose                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Stable generated identity (`ws_` plus the existing ID generator), independent of date, exercise name, or position.                                 |
| `date`         | Explicit local workout date, `YYYY-MM-DD`. It is not derived from a UTC timestamp.                                                                 |
| `status`       | `active` or `completed`; defines lifecycle independently of set completeness.                                                                      |
| `createdAt`    | Actual creation time as a canonical UTC ISO timestamp, not an inferred historical workout time.                                                    |
| `completedAt`  | Actual completion time, or `null` while active. Completion cannot precede creation.                                                                |
| `templateId`   | Selected permanent template identity, or `null` for an unplanned session. Historical validity does not require that template to continue existing. |
| `duration`     | Selected 30/60-minute mode, not measured elapsed time or a new exercise prescription.                                                              |
| `planSnapshot` | Immutable intent at creation: `null`, or `{ name, slots: [{ id, exercise, role }] }`.                                                              |
| `setIds`       | Ordered stable set references. Array order expresses order; IDs, rather than positions, establish membership.                                      |

Set records are not replaced. Session-linked sets additionally have `sessionId`; optional `planSlotId` refers to a snapshot slot. Existing fields and unknown persisted metadata are retained. Actual exercise remains on the set, so a future substitution can differ from the intended snapshot slot without rewriting the original plan. No substitution workflow is implemented here.

## Conservative migration

**Choose legacy records remaining sessionless.** A date alone cannot prove session boundaries, the selected plan, completion state, or timestamps. Deterministically inferring one session per date would still assert grouping that is not known.

The version-5 migration clones and validates the database, adds `sessions: []` and `activeSessionId: null`, and changes only the top-level version to 6. Existing valid set records retain every field and ID exactly; no session IDs, timestamps, or inferred sessions are added. Earlier supported versions continue through their existing field-default migration first.

Repeated migration produces the same result. Startup does not write storage. A successful action or explicit restore persists the new schema atomically; failure retains the original stored bytes and committed data. Present invalid fields are never silently replaced with empty session state. Version 6 requires both session fields. Versions above 6 are rejected without overwriting them.

**Backward compatibility is an upgrade path, not a downgrade:** V1.6/version-5 backups restore in the new app. An older app that supports only version 5 will safely reject a version-6 database/backup. Keep the pre-upgrade production JSON export; do not strip session fields or lower its version to force an old deployment to read it.

## Plan snapshot decision

- Template ID alone is smallest, but cannot preserve historical intent after edits/deletion.
- An ID plus hash detects changes but requires retaining a separate archive of template versions to reconstruct intent.
- A lightweight snapshot is self-contained and requires no version archive or template changes. This is the selected approach.

The snapshot copies the plan name and ordered slots selected by the existing mode rules: all slots for 60 minutes, only existing `short` slots for 30 minutes. Slot IDs (`slot-1`, etc.) are assigned once from original template positions and are scoped by session ID; relationships never recalculate them from a later template. It stores no speculative targets, rest prescriptions, AI fields, or elapsed-duration guesses. Later template edits and plan selection leave the snapshot unchanged.

## Action API

All lifecycle actions use the Milestone 1 synchronous transaction: clone → validate candidate → persist → replace committed state. They return the same structured result/error/state contract and do not access the DOM, show dialogs, or render.

| API                                                                     | Behavior                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workoutActions.createSession({ date, templateId?, duration? })`        | Creates and activates a session; returns `sessionId`. Omitted template/mode use current plan selection. Explicit `templateId: null` means unplanned. Rejects creation if another session is active.                                                     |
| `workoutActions.getSession(id)`                                         | Detached session data or `null`; read-only, no persistence.                                                                                                                                                                                             |
| `workoutActions.getActiveSession()`                                     | Detached active session data or `null`; reads the persisted pointer, not a form or tab.                                                                                                                                                                 |
| `workoutActions.completeSession(id)`                                    | Marks the active session completed using actual current time, retains all its data, and clears the active pointer. Repeated completion fails without changing its timestamp.                                                                            |
| `workoutActions.attachSetToSession({ setId, sessionId, planSlotId? })`  | Explicitly links a sessionless set to the active, same-date session and appends its ID to the session order. Repeating the same link does not duplicate membership. It does not move sets between sessions or attach new members to completed sessions. |
| `workoutActions.logSet({ ...existingFields, sessionId?, planSlotId? })` | Omitted session ID uses the active session; explicit `null` logs sessionless. Explicit IDs must identify the active session. A supplied planned slot must exist in that session's snapshot.                                                             |
| `getWorkoutState()`                                                     | Includes sessions and active pointer as detached JSON data. Form/edit/draft state remains excluded.                                                                                                                                                     |

One session is active at a time. Multiple workouts on the same local date are created sequentially with independent IDs, not merged by date. Invalid session transitions report `INVALID_SESSION_STATE`. Missing targets report `NOT_FOUND`. Invalid links or dates report validation errors. Failed writes report `PERSISTENCE_ERROR` and commit nothing.

Session-linked sets must match the session date. A conflicting date edit fails atomically; other corrections remain supported, including after completion. Deleting a set also removes its ID from the session order, retaining the session and its original plan. This milestone does not add moving/detaching sessions, session deletion, date reassignment, resume buttons, or guided navigation.

The database validator checks IDs, timestamps, mode, snapshot slots, both directions of set membership, and a single consistent active pointer. A dangling link or contradictory backup is rejected, rather than silently repaired by removing history.

## Backup, merge and import behavior

- Complete JSON export contains the entire database, including completed sessions, active session and set links. Restore validates the whole database before replacement. Export → restore → export preserves version-6 content.
- Restoring an old version-5 backup explicitly replaces the database with its migrated, sessionless state. It does not retain sessions from the replaced database.
- History merge preserves current settings and existing set IDs. It unions nonconflicting sessions and their links, and is idempotent. Conflicting copies of a session ID, incompatible set relationships, or two different active sessions reject the entire merge. Use complete restore to explicitly choose one database, rather than silently overwriting either history.
- ChatGPT interchange and normalization are unchanged, including V1.5-generated hashes, batch/set IDs, source metadata, session-level notes, and duplicate protection. ChatGPT imports remain sessionless even if a local session is active; no optional session extension is introduced. Explicit later attachment is possible through the existing attachment action.
- CSV format remains sets-only; it is not a full database backup and does not carry the new relationships.
- localStorage, failed-write behavior, future/corrupt-data recovery, and stale-tab protections are retained. No IndexedDB, backend, synchronization or accounts are introduced.

## Acceptance testing on an iPhone

1. **Export and verify the production JSON backup first.** Use only the milestone preview address and disposable data for the following checks; preview storage is a different origin.
2. Import a copy of the production/version-5 backup into the preview. Verify history, program edits, notes and imports remain visible. Export JSON: expect version 6, empty `sessions`, null active pointer, and unchanged historical set IDs/fields.
3. Download the synthetic [active-session fixture](tests/fixtures/session-v6.json) to Files and restore it on the preview only. It contains no real workout history; its fixed workout date is **2026-10-23**.
4. Log a test set with that date using the existing manual form. Reload, close/reopen the tab, and export JSON. Confirm the same active session ID, a set `sessionId` reference, and the set ID in the session's `setIds`.
5. Verify JSON export/restore/export retains this session and its snapshot. Check phone file-download/import behavior and existing manual logging/history controls.
6. If Safari Web Inspector is available, exercise completion and a second same-date session using the calls below, then reload/export to verify the first remains completed and the second has a different ID. Otherwise record this action-level check as covered by automated tests, not physically executed.

```js
const active = workoutActions.getActiveSession();
workoutActions.completeSession(active.id); // inspect ok before continuing
workoutActions.createSession({
  date: "2026-10-23",
  templateId: "demo-plan",
  duration: 30,
});
```

No session buttons have been added intentionally. The guided-workout interface and redesigned history remain later milestones. Physical-device status is pending for this branch until actual acceptance results are recorded.

## Remaining constraints

localStorage still stores a complete JSON database synchronously, subject to browser quota and origin/profile eviction. Larger histories and snapshots may eventually justify IndexedDB for transactional structured storage, but that requires its own approved migration and does not replace backups. Current stale-tab detection does not make simultaneous writes fully transactional. Sessions are name-keyed through their actual exercises and use immutable snapshot slot IDs; a broader stable exercise catalog and guided-workout state are not part of this milestone.
