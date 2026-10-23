# Changes

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
