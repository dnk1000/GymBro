# Workout actions — v2 Milestone 1

Milestone 1 established this incremental extraction from V1.6 using data version 5. Milestone 2 extends it with [explicit sessions and data version 6](WORKOUT_SESSIONS.md). The application branding remains V1.6 and the storage key remains `daveGymTrackerV1`. Guided workouts, progression, AI and voice remain outside the implemented scope.

## Boundary

`workout-data.js` provides DOM-free validation, migration, import normalization, and existing numerical/text helpers. `workout-actions.js` defines `createWorkoutActions({ getState, setState, persist, createId, now })`. The factory can run in a JavaScript runtime without `window`, `document`, controls, or events.

The browser's `app.js` creates `workoutActions` using the existing in-memory database and `storage.js`'s `persistData()`. UI handlers collect form values, perform input conversion, call an action, and display its result. Confirmations, rendering, navigation, focus, clearing forms and import-draft presentation remain UI responsibilities. Direct action calls do not render or show dialogs.

Persistence and injected callbacks are synchronous. `persist(candidate)` must return `{ ok: true }` only after a successful write, or `{ ok: false, errors: [...] }`; a thrown write error is also handled. `setState(candidate)` must synchronously replace committed state without UI effects. These are trusted adapters, not a public arbitrary-mutation API.

## State and results

`getWorkoutState()` (also `workoutActions.getWorkoutState()`) returns a detached, JSON-serializable snapshot of the committed database: sets, bodyweights, preferences, exercise library, program, imports, sessions, active-session ID and data version. Mutating a snapshot or a result's state cannot alter committed data. Forms, selected tabs, edit mode, and the uncommitted import draft are excluded. Milestone 2 adds `getSession(id)` and `getActiveSession()` for focused session inspection.

Each action returns:

```js
{
  ok: true,                    // false on failure
  code: "OK",                  // or VALIDATION_ERROR, NOT_FOUND,
                               // DUPLICATE_IMPORT, PERSISTENCE_ERROR
  errors: [],                  // human-readable messages; UI decides presentation
  changes: ["sets"],           // affected database collections; empty on failure
  setId: "...",                // action-specific IDs/metadata where relevant
  state: { /* committed data snapshot */ }
}
```

The transaction clones current state, applies the proposed change to that candidate, validates it, persists it, then replaces committed state. UI rendering happens after the action returns. Failed validation never attempts a write. Failed persistence never replaces committed data, even if the candidate has added exercise definitions or import metadata. The storage adapter may update its error/stale notice metadata; that is separate from workout data.

## APIs

| Action                                    | Input/result notes                                                                                                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logSet(input)`                           | Explicit `date`, `exercise`, `weight`, `unit`, `reps`, `rpe`, `rir`, `pain`, `painArea`, `notes`, `complete`. Returns `setId`. Optional values retain current defaults: `lb`, null load/reps/effort, zero pain, empty notes. |
| `editSet(id, patch)`                      | Same editable fields, with omitted fields preserved. Existing ID, source, import batch and other metadata are retained. An explicit `complete: false` remains false until deliberately changed. Returns `setId`.             |
| `deleteSet(id)`                           | Removes the identified set, updates its import summary count, and retains the import ID for duplicate protection. Returns `setId`.                                                                                           |
| `logBodyweight({ date, value })`          | Records a positive bodyweight with manual source. Returns `bodyweightIndex`; no new bodyweight ID model is introduced.                                                                                                       |
| `selectPlan({ templateId, duration })`    | Selects an existing template and 30/60-minute mode (default 60). Returns `templateId` and `duration`.                                                                                                                        |
| `clearPlan()`                             | Clears selection while preserving the chosen duration, matching existing behavior.                                                                                                                                           |
| `toggleSlotShort({ templateId, index })`  | Toggles existing short-mode membership.                                                                                                                                                                                      |
| `cycleSlotRole({ templateId, index })`    | Cycles core → accessory → substitute → core.                                                                                                                                                                                 |
| `addSlot({ templateId, exercise, role })` | Adds a slot with current behavior: default accessory, not in short mode; creates an Uncategorized definition when needed. Returns its index.                                                                                 |
| `removeSlot({ templateId, index })`       | Removes a valid existing slot. Slot actions return `templateId` and `index`.                                                                                                                                                 |
| `commitImport(draft)`                     | Accepts the reviewed, normalized draft returned by `normalizeInboxPayload(payload)`, including selected rows. Returns `importId`, `batch`, `setIds`, and `count`. Does not clear or mutate the draft.                        |

Inputs are plain data. Dates are explicit local-calendar `YYYY-MM-DD` strings. Numeric action inputs are numbers or null where supported; UI string conversion remains in the adapter. There is no `exerciseId` migration: `exercise` remains the existing name key. Generated manual IDs and import batch/set IDs retain their current formats. Import normalization and generated V1.5-compatible import IDs are unchanged. Milestone 2 adds optional `sessionId`/`planSlotId` to `logSet`; relationship changes are not accepted through `editSet`. See the session guide for the omitted/null/explicit-ID distinction and lifecycle APIs.

Example:

```js
const result = workoutActions.logSet({
  date: "2026-10-23",
  exercise: "Bench Press",
  unit: "lb",
  weight: 100,
  reps: 8,
  rpe: 7,
  notes: "controlled",
  pain: 0,
});
if (!result.ok) {
  // Display result.errors; do not clear the user's input.
}
```

## Deliberately retained coupling and Milestone 2 concerns

- `app.js` still contains analytics/selectors mixed with rendering, DOM-based form prefilling, and import-review warning presentation. These were not redesigned.
- Complete-backup restore/history merge, reset/clear, and storage recovery still use their existing UI orchestration and `save()` adapter. They share `persistData()` and update the same committed database, so the state selector observes those replacements too.
- State ownership is still the existing in-memory `db`, accessed through injected callbacks. This is not a new store framework, subscription system, or schema.
- All writes are synchronous whole-database local-storage writes. Migration to asynchronous persistence would require an explicit transaction/await contract, not silently swapping in a Promise-returning adapter.
- Plan selection remains global, exercises remain name-keyed, and permanent template slots remain index-addressed. Milestone 2 adds stable session IDs, session-scoped snapshot slot IDs and active-state persistence. Guided resume controls, a stable exercise catalog and stronger cross-tab concurrency remain later work.
- Snapshots/results copy the database. Add targeted selectors if measured history size makes this expensive; no speculative cache or event bus is included now.

Run `npm test` for both browser workflows and DOM-free action tests. Physical-iPhone validation remains a separate requirement; see `REAL_PHONE_SMOKE_TEST.md`.

Before manually testing this persistence-related milestone, export the complete production GymBro database as JSON and verify that the file is saved. Test the milestone on its Vercel preview origin, whose local storage is separate from production. Use disposable records or import a copy of the backup intentionally; never mistake preview records for production history.
