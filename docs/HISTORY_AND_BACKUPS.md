# Milestone 3: History and backup presentation

Issue #20 adds collapsed-by-default session/date cards over this existing grouping/detail contract; see [History disclosure](HISTORY_DISCLOSURE.md) for current interaction behavior and acceptance evidence. The milestone record below retains its original release context.

Issue #21 adds collapsed exercise occurrences inside expanded session/date cards. A consecutive run of the exact recorded exercise name is one display occurrence; A → B → A stays three occurrences, including when a source filter hides B. Each summary shows its matching set count and up to three recorded load/unit/reps tuples, retaining zero values, missing values and explicit incompleteness without rankings or unit conversion. Open an exercise to see its unchanged set rows/actions. Expand all / Collapse all continue to affect session/date cards, preserving independent exercise choices. Exercise choices share the existing transient History-visit lifecycle; no presentation state is saved. Notes/guided status remain at their existing scopes. No schema, identity or historical fact changes; the mobile set-layout work in #36 remains separate. Current #21 verification/acceptance belongs in its PR completion report.

Historical milestone documentation: Milestone 4 adds schema 7 and guided actions; see [GUIDED_WORKOUTS.md](GUIDED_WORKOUTS.md) for current guidance contracts. Existing unguided behavior remains supported.

This milestone starts from accepted main `14b12a88166d8c9cb7dfb3d70bccb0f68d0c8d34`. Application version is the independent canonical 2.3.0 build in `app-version.js`. Data schema stays **6**, storage key stays `daveGymTrackerV1`, and no migration or workout-action changes are introduced.

## History

- Explicit sessions are separate cards even on the same local date. They show the saved snapshot name (or Unplanned workout), 30/60-minute mode, status, exercises shown and counts. Later template edits do not rename historical intent.
- Cards sort by local date descending, then actual session creation timestamp descending. No legacy timestamps are invented. Equal timestamps retain persisted session array order.
- Session sets follow `session.setIds`, not the database sets array. Displayed order numbers refer to that full sequence even under source filtering. Both RPE and RIR are visible when recorded; no acronym tooltips are added to History.
- Every row retains date, exercise, load/unit, reps, effort, pain/area, notes, completeness/source and compact edit/delete controls. Record details exposes the entire saved set as escaped JSON, including ID, session/slot references and all import/unknown metadata. Open details does not modify data.
- Legacy/sessionless records are grouped by date **for display only**. This includes old backups, manual sessionless logging and ChatGPT imports without explicit attachment. No identities, sessions, timestamps or claims about workout boundaries are inferred.
- All source choices remain: all history, imported, manual and ChatGPT. Filtered sessions show matching sets versus the original full-session count; sessions with no matching sets disappear under a source filter. Empty explicit sessions remain visible under All history. Legacy rows preserve their stored relative order within a date.
- Existing validated actions still handle corrections/deletions. Deleting the last set retains the session, its status and snapshot. Completed sessions remain protected against new membership; date/link constraints remain. There are no reopen, session-edit, guided-workout or lifecycle buttons in this milestone.

`getHistoryGroups(data, source)` in `history-view.js` creates detached, DOM-free display data. It never writes or adds fields to persisted records. It assumes validated application data, like the existing UI.

## History search and filters — issue #22 candidate

Exercise selection matches exact recorded labels in the current name-key local runtime; the separate canonical conversion is not activated. Workout / session matches immutable saved snapshot names (or Unplanned workout); Legacy / sessionless selects date display groups without assigning identity. Date bounds are inclusive local calendar dates, using each explicit session's date or legacy set date. Source and exercise filters intersect and reveal matching sets, retaining full-session counts and original order/occurrence boundaries. Empty explicit sessions remain under unrestricted exercise/source selection. A reversed range shows an explanation and no results; no matches show an explicit empty state. Reset clears exercise, workout, both dates and source. Controls and expansion choices are transient UI state with no writes; selected options survive corrections removing their last record until reset. Notes, actions and historical context remain at existing scopes. PR completion report owns current verification and acceptance.

## Backup and recovery

1. **Complete backup:** Export JSON or header Backup exports the entire supported database. It includes sessions/active pointer, sets, bodyweights, program/templates, library, preferences, import metadata, unknown preserved fields, schema `version` and the canonical exporting `appVersion`. CSV is explicitly sets-only and cannot restore the database.
2. **Complete restore:** Validate/migrate the file, explain its name/version/counts/active state and that the complete current database will be replaced, then ask for confirmation. The database is replaced only after successful persistence.
3. **History merge:** Validate the candidate merge first. Explain additions and preservation before confirmation. Keep current program, existing exercise definitions, preferences and existing set IDs; add compatible sets/sessions/bodyweights/import records and missing exercise names according to existing rules. Retain the current active pointer or adopt an incoming one when none is active. Conflicting sessions/links or two different active workouts reject the entire merge, without writing or asking to commit an invalid candidate.
4. **Recovery notice:** Download original data preserves the exact saved bytes, even when corrupt/unsupported. Export this tab downloads the currently open in-memory database, which can be empty or stale during recovery. Keep both when uncertain. Reload reads saved data; Start empty remains destructive and confirmed. No error-handling or stale-tab protections are removed.

Export → restore → export preserves the complete supported content in the same build. A different exporting build refreshes `appVersion` as intended; compatibility depends only on schema. Old backups without application metadata still work. Startup and History navigation do not save data. Cancellation, failed writes and rejected imports retain existing protections and original stored data.

## iPhone acceptance (not yet performed)

1. **Export production JSON and verify the saved file before testing.** Use only the milestone preview and disposable data, or import a deliberate copy of your backup. Preview storage is a separate origin. Never restore synthetic records to production.
2. Verify the footer matches the 2.3.0 build. Restore your copied old backup. Confirm every legacy record remains available and labelled sessionless; verify imported/incomplete notes, pain and fields. Check all source filters.
3. Download [the synthetic History fixture](../tests/fixtures/history-v6.json) from the preview to Files, then restore it **on the preview only**. Its fixed local date is 2026-10-23; every record/timestamp is synthetic test data, not inferred history. It contains two separate same-day sessions, active/completed status, 30/60 modes, ordered sets, an imported incomplete linked record, one legacy record, bodyweight and preferences. The sets array deliberately differs from session order.
4. Inspect both session cards and the legacy group. Verify saved plan names, both effort values, pain/notes, source and incomplete badges. Swipe each set table internally; dates and icon actions should stay on one line, without horizontal page overflow. Expand Record details.
5. Edit a linked set, including explicitly marking a corrected incomplete record complete. Save/reload. Confirm order and session identity persist. Cancel a delete, then delete disposable data and verify the remaining order and import duplicate protection.
6. Export JSON, restore it and export again. Confirm sessions/active pointer and other database sections remain. Verify native file downloads/imports on Safari.
7. In Data, switch Restore/Merge. Read the operation explanation and file summary. Cancel each and verify nothing changes. Test a compatible merge on disposable data; local settings should remain. A conflicting session merge should reject without losing either saved history.
8. Read Help’s updated History/Data guidance. Record actual device, OS, browser, build/commit, results and failures in `REAL_PHONE_SMOKE_TEST.md` when reporting acceptance.

## Remaining limits

Full set tables scroll inside session/date cards on narrow phones. Large histories are still rendered in one pass without pagination or virtualization. Full JSON record details are an advanced inspection fallback; editing unknown metadata is not introduced. localStorage remains synchronous and subject to quota/eviction, and simultaneous tabs are not fully transactional. No backend, cloud backup, accounts, guided workouts or progression work is included. Manual logging still works without a session; creating/guiding sessions remains later work.
