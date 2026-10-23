# GymBro

A local-first, mobile-friendly personal workout log with an editable five-workout split, set logging, bodyweight and performance trends, and reviewed ChatGPT imports.

## Run

Open `index.html` in a modern browser, or serve this directory locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

There is no backend, account, API key, or application build. Keep `index.html`, `app.js`, `seed.js`, `workout-data.js`, `workout-sessions.js`, `workout-actions.js`, `storage.js`, `styles.css`, and `gymbro-logo.png` together. JavaScript, local storage, Canvas, and modern browser APIs are required. Node is only needed for development tests.

## Data and backups

The app saves the whole database in browser local storage under the existing `daveGymTrackerV1` key. The application uses independent data version **6**, adding explicit sessions while retaining the current workout UI. Version-5 databases upgrade in memory with empty sessions and a null active pointer; legacy sets retain their fields and remain sessionless. Opening the app does not rewrite existing data; the next successful edit saves its migrated state. Program edits and history are preserved. Older version-5 applications cannot read version-6 backups/databases; retain the pre-upgrade JSON backup rather than forcing a downgrade.

Data is specific to the browser profile and origin (protocol, hostname, and port). Direct-file storage behavior varies by browser. Use the same address consistently and export a JSON backup before moving devices or clearing browser data. There is no automatic cloud sync, server backup, or installed offline service worker.

Before testing any milestone that touches persistence, export a complete JSON backup from production and verify the saved file. A Vercel preview has separate browser storage; empty or seeded preview data does not indicate missing production history. Keep production and preview addresses/data distinct. Automated tests use disposable storage only.

- **Backup / Export JSON** includes history, bodyweights, program, exercise library, preferences, import metadata, sessions, plan snapshots, and the active-session pointer.
- **Restore complete backup** validates the entire file, then replaces all of those fields after confirmation.
- **Merge history only** adds sets, bodyweights, import metadata, and nonconflicting sessions while preserving current settings. Existing set IDs win; duplicate IDs inside a backup are rejected. Conflicting session identities/links or two different active sessions reject the entire merge rather than guessing a relationship.
- **Export sets CSV** exports sets only. Formula-like text is prefixed with an apostrophe for spreadsheet safety; JSON preserves original text exactly.

Unreadable or unsupported newer data is left untouched. A recovery notice offers an original-data download, full backup restore, or an explicit empty start. Failed saves do not commit in-memory edits or clear the form. If another tab changes storage, the old tab pauses saving until reloaded. Use one editing tab at a time; local storage is not a transactional multi-user database.

## Workout and import workflow

Choose a 30- or 60-minute plan, then log sets. Workout dates use the device's local date. History supports editing and deleting sets from all sources. The **Approximate / incomplete** checkbox preserves uncertainty even when numeric values are available.

Paste structured workout JSON into **ChatGPT Inbox**, review it, then commit. A nested `exercises` array or a flat `sets` array is supported. See [the import format](CHATGPT_IMPORT_SCHEMA.md); an example is available through the Inbox's **Example file** button.

Invalid dates, numbers, effort ranges, and unsupported units block commits. Missing load/reps and unknown exercise names produce review notes; incomplete records remain supported. Session notes and explicit `complete: false` survive commit and backup. Import IDs remain recorded when sets are corrected or deleted, preventing accidental reimport.

Performance charts and gains exclude incomplete records and compare positive external loads using the latest eligible unit for each exercise. Assisted and bodyweight sets remain visible in history but are excluded from load-times-reps rankings. These summaries are training context, not automatic individualized coaching. **Training days** counts unique dates, not separate sessions on the same date.

Exercise detail's **Latest** shows the most recent set with recorded load and reps, including assisted, bodyweight, zero-load, and approximate records. It is independent of ranking eligibility.

Milestone 2 session lifecycle actions are programmatic only; no new controls or history redesign are included. With no active session, manual logging works as before. With one active, new manual sets link to it and must use its local date; explicit `sessionId: null` in the action API logs sessionless. ChatGPT imports remain sessionless. See [the session schema and acceptance guide](WORKOUT_SESSIONS.md).

## Development

```sh
npm ci
npm test
```

Tests use Node's test runner, `playwright-core`, and an installed Chromium executable. Default: `/usr/bin/chromium`; set `CHROMIUM_PATH` to use another installation. The test harness starts its own temporary local server and isolated browser contexts; it does not touch real workout storage.

Managed Chromium may block direct `file:` navigation by administrator policy. The direct-file test reports a skip in that case; use the local static server in that environment.

A physical-phone smoke test is a separate release gate. See [the device checklist](REAL_PHONE_SMOKE_TEST.md). Responsive Chromium checks do not establish Safari or real-device readiness.

Files:

- `index.html`: form markup and the seven views.
- `styles.css`: responsive layout and visual styling.
- `app.js`: UI adapters, import review, analytics, and rendering; configures the workout actions.
- `workout-actions.js`: DOM-free actions with explicit inputs, structured results and state snapshots.
- `workout-data.js`: DOM-free validation, migration, import normalization and data helpers.
- `workout-sessions.js`: DOM-free session/relationship validation, plan snapshot construction, and conservative backup merge.
- `seed.js`: the original historical dataset and baseline program.
- `storage.js`: browser persistence, stale-tab detection, recovery, and legacy backup/reset adapters.
- `tests/app.test.cjs`: browser regression coverage for normal workflows and data-loss edge cases.
- `tests/workout-actions.test.cjs`: action/state regression tests without a DOM or browser globals.
- `tests/workout-sessions.test.cjs`: session lifecycle, migration, snapshot, relationship, rollback and merge regression tests.

See [the workout action interface](WORKOUT_ACTIONS.md) for the Milestone 1 boundary and [workout sessions](WORKOUT_SESSIONS.md) for the additive Milestone 2 APIs, version-5 migration, and physical-iPhone acceptance steps.

The existing vanilla JavaScript workflow is retained. V2 can introduce explicit session/exercise IDs and further module boundaries behind tested migrations. Exercise classification editing and cross-device synchronization remain future work.

## Application and data versions

`app-version.js` is the canonical release source. The format is **MAJOR.MINOR.PATCH-BUILD**: product generation, milestone, non-feature/bugfix release, and a fixed UTC build timestamp (`YYYYMMDDTHHmmssZ`). Milestone 2 starts at 2.2.0. Update the committed timestamp for each deployable build; do not derive it from the browser clock. The normal footer and page title show the complete version, also available as `APP_VERSION` for diagnostics.

Application releases and `DATA_VERSION` are independent. Complete JSON backups include `appVersion` and the existing `version: 6` schema field (no redundant `dataVersion` field). Export metadata does not mutate workout state. Restore uses only schema compatibility: missing or different application versions are accepted. Re-export identifies the exporting build. CSV and ChatGPT interchange remain unchanged. The private npm package contains tooling only and has no separate application version.

The header Help button opens the application user guide, including logging, history icon actions, program modes, imports and local backup/restore. Update the relevant help text when user-facing workflows change. History uses labelled pencil/trash controls with compact 28px buttons; wide tables scroll within their cards.

Hover over RPE and RIR in Workout and ChatGPT import entry labels for explanations. Display-only content, including History, has no acronym tooltips. Native hover tooltips do not require mobile interaction. When correcting an incomplete set, use Mark complete or uncheck Approximate / incomplete, then Save changes; correcting numbers alone intentionally preserves an explicit uncertainty flag. Mark complete requires recorded weight and reps and does not save until Save changes succeeds.

## Session history and recovery (Milestone 3)

History presents explicit sessions separately with saved plan name, mode, status, exercises and ordered sets. Multiple workouts on one date remain separate. Legacy/sessionless records remain fully visible in clearly labelled date groups used only for display. Source filters retain their existing meanings. Each set has compact edit/delete actions and expandable Record details for every saved field; History has no acronym tooltips.

Data explains complete JSON backup versus sets-only CSV, complete restore versus history merge, and shows a file/content/effect summary before the final native confirmation. Recovery explains the difference between original saved bytes and the open tab’s in-memory export. No schema, storage or workout-action changes are introduced. See [History and backup behavior](HISTORY_AND_BACKUPS.md) for exact semantics and iPhone acceptance steps.

See [release history](RELEASE_HISTORY.md) for accepted milestones, exact application builds, schema compatibility and preview lineage.
