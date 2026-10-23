# Changes

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
