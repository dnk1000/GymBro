# Changes

## 2.5.1 — Exercise library counts (preview)

- Add # Sessions beside Sets, counting explicit session IDs and legacy/sessionless dates separately before summing. Explain legacy date grouping and align exercise detail counts. No persistence changes.

## 2.5.0 — Milestone 5 (preview)

- Add read-only trainer performance/workout context composed from existing guided state, with exact exercise/unit evidence, source/session references, pain, unparsed notes/preferences and explicit unknown classifications.
- Add transparent set comparisons and complete-recorded-repetition totals, with missing/ambiguous/unsafe evidence reasons. Return review/insufficient_evidence only; no progression prescriptions, score, 1RM or inferred working/failure classes.
- Keep guided/manual UI, workout actions, persistence schema 7, import hashes, backups and authoritative records unchanged. No Milestone 6.

## 2.4.0 — Milestone 4 (preview)

- Add atomic guided session start, explicit Done/Skip, persisted navigation and session-local substitutions over immutable plan snapshots. Preserve earlier sets and manual logging.
- Show factual previous performance by exact exercise and unit without prescriptions or progression. Add gym-sized controls near the current card and set form.
- Add schema 6→7 migration without inventing progress; back up guidance and committed request IDs for safe retries, rollback and resume. Preserve the storage key, old history and imports.
- Show guided statuses/planned-versus-current selections in existing session History. Finish after confirmation can retain unfinished slots.

## 2.3.0 — Milestone 3

- Present separate explicit sessions with saved plan, mode/status, exercises and authoritative set order; retain legacy/sessionless records in labelled date groups for display only.
- Preserve source filters, compact corrections, completeness/source/pain/notes, both RPE and RIR, and expandable full record details.
- Explain complete backups, CSV limits, restore/merge effects and recovery downloads. Summarize selected file and contents before committing; validate conflicting merges before confirmation.
- Keep schema 6, localStorage, migrations, action APIs and workout behavior unchanged.

## 2.2.5

- Limit acronym tooltips to Workout and ChatGPT import entry labels; remove them from History and other display-only content.

## 2.2.4

- Explain RPE, RIR, JSON and CSV with native hover tooltips in labels, help, history, workout summaries and import review.
- Make the preserved incomplete flag explicit in the edit form and add Mark complete for reliable corrected values; Save changes still commits the edit atomically.

## 2.2.3

- Condense History actions to 28px buttons, 14px icons and 4px spacing (60px total), preserving accessible names and existing behavior.

## 2.2.2

- Add application-wide Help covering all tabs, logging, program modes, imports and local backup/restore.
- Replace History action text with accessible pencil/trash icons, keeping touch-sized actions on one line.

## 2.2.1

- Widen the History date column and keep dates on one line, retaining horizontal scrolling inside the history card on narrow screens.

## v2 Milestone 2 (preview development)

- Introduce canonical MAJOR.MINOR.PATCH-BUILD application versioning, a fixed UTC build ID, a shared version footer/page title and complete JSON backup `appVersion` metadata. Keep schema version 6 independent and accept old/different-build backups.

- Add schema-6 explicit sessions, persisted active identity, stable set relationships and self-contained mode-filtered plan snapshots.
- Keep version-5 sets/IDs/metadata sessionless and unchanged; preserve storage key, ChatGPT interchange/hashes and duplicate protection.
- Extend DOM-free actions for lifecycle/attachment and manual logging's omitted/null/explicit session selection. Validate reciprocal order, matching dates and snapshot slots; protect completed sessions from new membership.
- Include sessions in complete backups; reject ambiguous history merges atomically. Keep localStorage, failed-write recovery and stale-tab protections.
- Retain the current UI and workout split. Guided workouts, history redesign, progression, AI/voice and later milestones are not included.

## 1.6

- V2 Milestone 1: extract DOM-free workout actions and validation helpers with explicit inputs, structured results, detached state inspection, and persist-before-commit behavior. Keep the existing UI, data version and import IDs.
- Fix mobile Exercises overflow by allowing the single-column grid to shrink; wide tables scroll inside their cards.
- Restore exercise-detail Latest across load units, independently of performance-ranking filters.
- Preserve unreadable/future-version storage, surface failures, roll back failed edits, and detect stale tabs before saving.
- Validate complete backups before applying them; distinguish full restore from history merge.
- Validate workout dates, numerical values and units at review and commit; retain approximate records and session notes.
- Allow corrections and deletion of sets from all sources while retaining import duplicate protection.
- Use local workout dates, consistent completeness rules, comparable units, and refreshed exercise detail.
- Encode dynamic handler arguments and imported text safely; protect spreadsheet exports from formula interpretation.
- Extract JavaScript and CSS from the HTML and reuse the existing logo asset. Keep the no-build, local-first workflow.
- Add browser regression tests and document migration/recovery behavior.
