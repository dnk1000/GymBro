# Changes

## 3.5.5 — preserve opaque request-signature meaning

`3.5.5-20261028T205308Z`, schema 8; #39 only. Only recognized legacy signature serialization is normalized for canonical comparison. Unknown signature fields remain opaque and cannot become false exact replays. Ten focused tests pass; schema migration/SQL fixture are unchanged. [Evidence](V3_RELATIONAL_PERSISTENCE.md).

## 3.5.4 — preserve excluded reviewed-import rows

`3.5.4-20261028T204314Z`, schema 8; #39 only. The canonical adapter requires resolved IDs only for included import rows, retaining existing review/exclusion semantics, provenance and duplicate protection. Nine focused tests pass; the unchanged applied relational migration is retested with 110 SQL assertions. [Current evidence](V3_RELATIONAL_PERSISTENCE.md).

## 3.5.3 — explicit request signature identity

`3.5.3-20261028T202536Z`, schema 8; #39 only. Relational request metadata explicitly distinguishes legacy exercise labels from canonical UUIDs; original signature bytes remain unchanged. Eight focused repository tests pass, including UUID-shaped aliases and replay after reload. [Evidence](V3_RELATIONAL_PERSISTENCE.md).

## 3.5.2 — atomic relationship staging fix

`3.5.2-20261028T201618Z`, schema 8; #39 only. Each RPC defers relationship staging then forces constraints before acknowledgement, including repeated invocations in one transaction. No scope or constraint reduction. Verification/acceptance is tracked in [the implementation record](V3_RELATIONAL_PERSISTENCE.md).

## 3.5.1 — relational foundation validation fixes

Correct database creation detection across subtransactions and preserve recorded template labels in new snapshots/guidance after canonical rename. Build `3.5.1-20261028T200955Z`; schema 8 unchanged. Initial SQL failure and retest evidence remain in [the implementation record](V3_RELATIONAL_PERSISTENCE.md).

## 3.5.0 — #39 relational foundation candidate

Owner-scoped relational workout schema, lossless canonical row mapping, and an opt-in DOM-free asynchronous repository under existing domain actions. No UI/storage-authority change or personal migration. Build `3.5.0-20261028T195515Z`; workout schema 8 is unchanged. Validation/acceptance evidence: [V3_RELATIONAL_PERSISTENCE.md](V3_RELATIONAL_PERSISTENCE.md).

## 3.4.0 — scoped notes candidate

Issue #25: separate session, exercise/session, durable exercise setup and set notes in Workout, History and the existing Exercise Detail panel. Workout schema 8 preserves all older text without guessed scope; complete JSON and canonical identity projection preserve scoped targets and exact text. Failed/stale saves retain committed state and visible drafts. Workouts remain local; no personal/cloud migration or Production cutover.

## 3.3.0 — exercise identity foundation candidate

Issue #16: immutable canonical exercise UUIDs, exact aliases, metadata/provenance and owner-scoped SQL constraints/RLS. Lossless V2 identity conversion and ID-based performance boundary preserve original labels and historical relationships. Current schema-7 UI/storage/interchange stay active until the separately approved persistence/migration issues. No automatic workout conversion, catalog/merge/import UX or Production cutover.

## 3.2.2 — email-link rate-limit wording

Use link terminology consistently in provider rate-limit feedback. No schema or ownership-policy changes.

## 3.2.1 — callback verification feedback

Report an actionable retry state if the SDK cannot verify an emailed session. No schema or ownership-policy changes.

## 3.2.0 — account access candidate

Issue #27: Preview email-link sign-in, sign-out and recovery; database-enforced private access markers. Workouts remain local, schema 7. Production rollout and acceptance remain pending.

## 3.1.1 — Preview verification fix

- Pass the pinned CLI's required `--linked` flag for metadata queries while retaining explicit Preview project targeting; use one read-only metadata query compatible with local prepared execution and hosted execution. No schema change.

## 3.1.0 — Infrastructure foundation (Preview candidate)

- Issue #38: explicit Preview/Production project boundaries, fail-closed diagnostic configuration, pinned Supabase migration tooling and disposable SQL/RLS replay CI.
- Workout schema remains 7 in localStorage. No account feature, workout migration or Production cutover.

## 2.7.2 — Supabase connection checkpoint (Preview only)

- Add an optional Data-view test that saves and freshly retrieves one short diagnostic value using anonymous Supabase Auth and an owner-only RLS table. Workout data, schema 7 and localStorage persistence are unchanged.
- Gate public configuration to explicitly enabled Preview/local testing; Production is always disabled. Vendor the pinned official client for lazy loading without a runtime CDN or app build.
- Provide a minimal test-table SQL script, local configuration server, focused tests and manual Supabase/Vercel setup/verification guide. The live one-value Save/reload/Read checkpoint and matching database row were verified on 2026-10-27 after user-applied setup. No production configuration or data migration.

## 2.7.1 — Windows workflow verification (preview)

- Update the canonical version/build to verify Windows development, GitHub PR/CI and the existing Vercel preview/production delivery path before starting V3.
- Align version assertions and release records. Workout behavior, UI controls, dependencies, schema 7 and localStorage persistence are unchanged.
- Production delivery awaits explicit approval to merge. Existing physical-iPhone, personal backup and V2 acceptance evidence remain open.

## 2.7.0 — Milestone 7 (preparation; not released)

- Prepare GitHub PR/main CI with pinned Node/browser tooling, complete regressions, syntax, committed-range whitespace and canonical release checks; retain failed-test output.
- Document the V2 trainer/API boundary, four-category PRD audit, accepted limitations, production backup/smoke/rollback procedure and pending V2 release artifact. Clarify Help without changing workout controls.
- Keep schema 7 and all workout/domain modules unchanged. Physical iPhone results, PRD discrepancy disposition, verified production backup and explicit merge approval remain release gates. No production acceptance or V2 completion is claimed.

## 2.6.0 — Milestone 6 (preview; physical iPhone acceptance pending)

- Detect missed cross-tab storage changes when a page becomes visible or is restored. Warn and pause stale writes without adopting new data, saving drafts, or overwriting committed state. Storage read failures require reload rather than offering an empty reset.
- Use 16px mobile entry text to avoid Safari focus zoom and 44px primary logging/form-action touch targets; preserve compact History controls and existing layouts.
- Add mutation rollback/retry, lifecycle recovery, rapid interaction, trainer-context preservation and quota-exception regression coverage. Keep schema 7 and all training/backup semantics unchanged.

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
