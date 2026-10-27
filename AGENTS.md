# GymBro project rules

These rules apply throughout this repository. Preserve the product contracts below unless the user explicitly requests a change to them. Routine fixes within these contracts do not require renewed approval. If a requested change affects a contract, explain the behavior and compatibility impact before implementing it; do not treat adjacent cleanup as authorization to redesign the app.

## Authoritative source and active workflow

GitHub `main` is the only authoritative code baseline. Fetch and inspect it before new work, use a feature branch, and submit a GitHub PR. GitHub Actions provides CI; Vercel is the supported preview/production platform. Approved merges to `main` use the existing production integration. Do not maintain another source tree or ChatGPT/Codex-hosted runtime as a second authority, and do not merge without explicit user approval.

The current focus is standalone GymBro and its accepted V2 functionality. No Supabase/PostgreSQL persistence, OAuth, MCP, provider connection, account UI or external trainer runtime is active or required. Do not reintroduce the abandoned implementation from PR #9 or its `v3/integration-architecture` branch. Keep that branch unmodified as historical reference until separately authorized for deletion; do not push new work to it. See PRODUCTION_DELIVERY.md for manual staging quarantine.

User-authorized exception: the optional Preview/local Supabase connection checkpoint in SUPABASE_CONNECTION_TEST.md may store/read one short diagnostic value with a separate anonymous test identity and owner-only RLS. It must remain disabled in Production and must never migrate or replace workout localStorage, add mandatory accounts or reintroduce the abandoned integration. Live setup/acceptance and any production merge remain explicit separate steps.

External AI/provider runtime integration is **Future/optional integration concept — not currently scheduled.** This scope supersedes older roadmap wording below and in historical milestone records. Preserve accepted workout actions, sessions, guidance, trainer evidence/context, manual ChatGPT Inbox/interchange, history, backups, tests, release tooling and CI. Never remove functionality merely because a name mentions trainer, context or ChatGPT.

## Product and scope

- GymBro is a mobile-first, local-first personal workout tracking/coaching web app. Application version follows the policy below; Milestones 2 and 3 used schema **6**; Milestone 4 uses independent data schema **7**.
- **iPhone usability is the primary UX target.** Prioritize readable screens, reachable controls, touch input, on-screen keyboard behavior, and Safari compatibility; retain working desktop behavior.
- Preserve working functionality unless the task explicitly requires changing it. **Do not redesign the UI unless specifically requested.**
- Retain the vanilla JavaScript, static-file, no-build application. Node dependencies are development tooling, not runtime requirements.
- Do not replace the architecture because another framework is fashionable. Avoid unnecessary dependencies; use existing capabilities when practical and justify dependencies needed by the task.
- Do not introduce a framework, mandatory account, backend, cloud synchronization, analytics/telemetry, API dependency, or service worker without an explicit request.
- Preserve all seven views: Dashboard, Program, Workout, History, ChatGPT Inbox, Exercises, and Data. Do not remove working controls or narrow supported workflows to simplify implementation.
- Keep the five baseline templates, 30/60-minute plans, core/accessory/substitute roles, editable slots, exercise taxonomy, bodyweight tracking, pain/effort logging, guidance, charts, and backup workflows.
- Do not invent progression rules, reinterpret pain guidance, alter baseline exercise selections, or replace existing coaching preferences as part of a refactor.
- Make focused changes. Do not bump versions, rewrite the application, add features, or begin v2 merely because code could be cleaner.
- Prefer small, testable changes over large rewrites. When product behavior is uncertain, flag the specific question instead of inventing an answer. Continue independent work that does not depend on that answer.

## Architecture and roadmap

- Separate workout rules, calculations, validation, and state transitions from presentation/DOM logic wherever practical. Extract focused functions or modules incrementally when the task benefits from it; do not turn this principle into an unsolicited architectural rewrite.
- Keep workout actions and validation reusable by future input adapters rather than embedding new business rules solely in click handlers. Future AI/voice input should be able to use the same validated actions and persistence path as the UI without requiring an application rewrite.
- External AI/provider runtime integration is **Future/optional integration concept — not currently scheduled.** Do not add voice, transcription, conversational agents, provider services or their infrastructure without a new explicit request. The existing manual ChatGPT JSON Inbox remains supported without a provider login.
- Supporting that future direction means preserving clear boundaries now, not adding speculative abstractions, dependencies, or unused integrations.

## Repository guide

The app has no runtime package installation or build step. Serve the repository with `python3 -m http.server 8000 --bind 127.0.0.1` (also available as `npm start`). Keep the static assets together.

| File                                | Responsibility                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `performance-context.js`            | Read-only trainer context, record comparability, referenced arithmetic and conservative evidence-review policy.                                             |
| `TRAINER_EVIDENCE.md`               | Milestone 5 API/output contracts, approved evidence policy and acceptance checklist.                                                                        |
| `guided-workouts.js`                | DOM-free guided validation, state selectors and transaction-backed guided action extension.                                                                 |
| `guided-ui.js`                      | Guided Workout DOM adapter and transient form context; no committed draft persistence.                                                                      |
| `GUIDED_WORKOUTS.md`                | Schema-7 guidance contracts, action API, migration and iPhone acceptance steps.                                                                             |
| `history-view.js`                   | Detached DOM-free History presentation selector: explicit sessions in setIds order, sessionless date groups for display only, source filters.               |
| `HISTORY_AND_BACKUPS.md`            | History/recovery presentation contracts and Milestone 3 acceptance checklist.                                                                               |
| `ui-acronyms.js`                    | Presentation-only shared acronym glossary and native hover tooltips; never changes stored data.                                                             |
| `app-version.js`                    | Canonical immutable application version and export metadata helper; independent of data schema version.                                                     |
| `index.html`                        | Application shell, seven views, form markup, and script loading.                                                                                            |
| `styles.css`                        | Shared visual styling, responsive grids, forms, and mobile layout.                                                                                          |
| `app.js`                            | UI adapters, form/draft state, navigation, history, analytics, charts, and DOM rendering. Configures `workoutActions` and the `getWorkoutState()` selector. |
| `workout-actions.js`                | DOM-free workout action factory. Explicit inputs, detached state snapshots, structured results, and persist-before-commit transactions.                     |
| `workout-data.js`                   | DOM-free data validation, legacy migration, import normalization, and shared data helpers.                                                                  |
| `workout-sessions.js`               | DOM-free session validation, immutable plan snapshots, bidirectional set relationships, and conservative history merge.                                     |
| `storage.js`                        | Browser storage loading/writing, stale-tab detection, and recovery UI. `persistData()` reports write results without DOM effects.                           |
| `seed.js`                           | Original historical workout data, baseline program, exercise taxonomy, and coaching preferences.                                                            |
| `gymbro-logo.png`                   | Header and favicon branding asset.                                                                                                                          |
| `tests/app.test.cjs`                | Chromium regression tests using Node's test runner and Playwright Core; starts an isolated local server and disposable browser contexts.                    |
| `tests/workout-actions.test.cjs`    | Action/state tests in a JavaScript runtime without DOM or browser globals, including persistence failure and compatibility cases.                           |
| `tests/workout-sessions.test.cjs`   | Session/migration/snapshot/relationship and merge tests.                                                                                                    |
| `WORKOUT_SESSIONS.md`               | Exact schema-6 model, session actions, version-5 compatibility, and preview acceptance checklist.                                                           |
| `package.json`, `package-lock.json` | Development commands and pinned test dependencies.                                                                                                          |
| `README.md`                         | Run instructions, product behavior, data storage, backup semantics, and development workflow.                                                               |
| `CHATGPT_IMPORT_SCHEMA.md`          | Supported workout JSON interchange format and validation rules.                                                                                             |
| `CHANGELOG.md`                      | Meaningful version changes.                                                                                                                                 |
| `REAL_PHONE_SMOKE_TEST.md`          | Physical-device validation checklist and release-gate status.                                                                                               |
| `AGENTS.md`                         | Project rules for future Codex work.                                                                                                                        |

## Read before editing

- Read `README.md`, `CHATGPT_IMPORT_SCHEMA.md`, and the affected source and tests. For release readiness, also read `REAL_PHONE_SMOKE_TEST.md`.
- Inspect `git status` first. Preserve existing uncommitted/untracked work; do not reset, clean, or overwrite it blindly.
- Use the existing checkout. Cloud tasks are already isolated; do not create a worktree unless requested.
- Keep responsibilities separated: `index.html` for markup, `styles.css` for layout, `app.js` for actions/rendering/analytics, `storage.js` for validation/migration/persistence, and `seed.js` for the original dataset.

## Data safety is a product contract

- Preserve the existing local-storage key, **`daveGymTrackerV1`**. Changing a key or origin can make existing data appear lost.
- Preserve user history, program edits, preferences, exercise definitions, import metadata, notes, IDs, dates, units, sources, and explicit completeness flags. Do not regenerate IDs or normalize names/units silently.
- Treat `seed.js` as the original historical dataset and default program, not disposable test data. Do not change historical records or reseed an existing user's database to make tests pass.
- Startup must not rewrite saved data. Malformed or unsupported newer data must remain intact and downloadable, with recovery explained to the user.
- Route edits through the existing validated persistence path. Validate the proposed state before writing; failed saves must leave saved data, in-memory committed state, and unsaved form input intact.
- Retain stale-tab detection. Do not silently overwrite another tab's changes or claim local storage provides transactional concurrency.
- Destructive restore, reset, and clear operations must remain explicit user actions with confirmation. Never erase real data during development or tests.
- A future schema change requires a deliberate versioned migration and regression coverage for old data, customized programs, invalid input, and unsupported future versions. Do not downgrade newer data or silently discard fields.
- Before changing the workout data model, document migration and backward-compatibility implications, including existing local history, imported records, and exported backups. An upgrade must not lose existing workout history.
- **Export your GymBro database before testing any milestone that touches persistence.** For manual testing, export a complete JSON backup from the production address and verify the file is saved before opening the preview. Do not substitute a CSV export or claim a user's backup was made without access to that browser.
- Vercel previews have a different browser origin and separate local storage. Empty/seeded preview data is not evidence that production history disappeared. Identify which origin is under test, use test data or deliberately import a copy of the backup, and never overwrite production history just to match a preview. Automated tests must use isolated disposable storage, never a user's real browser database.

## Logging, history, and analytics

- Workout dates use the device's **local calendar date**, not a UTC date derived from `toISOString()`.
- Preserve zero values where valid. Missing values are not zero and must not be guessed. Reps must be positive whole numbers; validation ranges and supported units follow the documented import contract.
- Explicit `complete: false` means approximate/incomplete even when load and reps exist. Preserve it through review, commit, editing, migration, and backup.
- Sets from every source remain visible and correctable in history. Corrections/deletions must retain import duplicate protection.
- A plan's Log action starts a new set; it must not accidentally overwrite the set currently being edited.
- **Latest** in exercise detail is history, not a performance ranking: show the most recent set with recorded load and reps, including assisted, bodyweight, zero-load, and approximate sets.
- **Best comparable set-work**, performance charts, and gains use complete, positive external loads in the latest eligible matching unit for that exercise. Exclude assisted/bodyweight records from these rankings; never compare incompatible load units as equivalent.
- The existing Training days metric still counts unique dates; do not silently change it to count explicit sessions or redesign history during Milestone 2.
- Version-5 history remains sessionless. Never infer legacy sessions or timestamps. Session-linked sets must match session dates and appear exactly once in that session's ordered `setIds`, with a matching reverse `sessionId`.
- Session creation/completion/attachment must remain DOM-free and atomic. Only one session is active; completing it records completion and clears the pointer. Do not attach new members to completed sessions or invent a reopen/move/detach workflow.
- `logSet`: omitted `sessionId` uses the active session; explicit `null` is sessionless; an explicit ID must be the valid active session. Do not fabricate `planSlotId`; validate it against the same session snapshot. Preserve snapshot intent when permanent templates change.
- Deleting a linked set removes its session-order reference; normal field corrections preserve membership. Conflicting date or relationship edits fail, rather than changing a session date or moving a set silently.
- Refresh affected views after edits. Do not leave exercise details or plan displays showing stale values.

## Import and export compatibility

- Keep the `gym-tracker-chatgpt-v1` interchange schema and both supported input shapes: flat `sets` or nested `exercises`. Validate structure and values before commit.
- Imports remain **review before commit**. Invalid dates/numbers/units block commit; missing load/reps and unknown exercise names remain supported with warnings. Unchecked rows are excluded from validation and commit.
- Preserve session notes, pain areas, explicit incompleteness, stable import IDs, and V1.5-compatible generated IDs. Never remove duplicate protection when imported sets are edited or deleted.
- **Restore complete backup** replaces the complete validated database, including program/library/preferences. **Merge history only** preserves current settings and existing set IDs. Keep this choice explicit.
- JSON export preserves original data. CSV exports sets with correct quoting and spreadsheet-formula protection; it is not a complete backup.
- Treat all imported text as untrusted. Encode HTML and JavaScript argument contexts correctly; do not insert raw imported values into markup or inline handlers.

## Mobile and validation requirements

- Preserve touch-friendly controls, readable forms, and portrait/landscape layouts. Wide tables scroll inside their cards; they must not widen the page.
- Keep mobile single-column grids shrinkable (`minmax(0, 1fr)` or an equivalent tested constraint). Do not reintroduce intrinsic-width overflow on Exercises.
- For behavior changes, add focused regression coverage and run `npm test` after `npm ci` when dependencies are needed. The suite uses installed Chromium (`CHROMIUM_PATH` overrides `/usr/bin/chromium`) and an isolated temporary server/browser storage.
- For layout changes, check all seven views at narrow phone widths, including 320 and 390 px, and a desktop viewport. Viewport emulation is not physical-device testing.
- Verify affected logging, reload persistence, program editing, history, import/export, and browser console behavior. Run `git diff --check`. Documentation-only changes do not need an application test rerun.
- Do not weaken assertions, disable validation, delete tests, or substitute a trivial check to obtain a passing result. Report failed, skipped, blocked, and untested checks separately.
- If managed-browser policy blocks direct `file:` navigation, report that specific skip and validate through the local static server. Do not bypass administrator policy or claim the skipped path passed.

## Baseline and reporting

- The user confirmed Milestone 1 acceptance and Vercel **Ready · Production · main · `6f10b49`** before authorizing Milestone 2. The user subsequently accepted merging Milestone 2 as main `14b12a8`; its regression suite passed and production served 2.2.5. Do not invent physical-device details. The user accepted Milestone 3 via PR #4 at `fd616fa`; its full regression suite passed and production served 2.3.0. Milestone 4 device acceptance remains pending.

- V1.6 is **not yet frozen as the final stabilized baseline**. The physical-phone smoke test remains pending unless actual results have subsequently been recorded in `REAL_PHONE_SMOKE_TEST.md`.
- Do not mark the phone checklist complete from desktop/mobile emulation. Record the actual device, OS, browser, code revision, results, and remaining failures. Do not claim iPhone Safari support was tested using Chromium.
- Do not freeze/tag the stabilized baseline or begin v2 until the requested real-phone validation is completed and failures are resolved, or the user explicitly changes this requirement.
- Finish work with a concise account of changes, user-visible behavior changes, validation evidence, and remaining limitations. Distinguish implemented code, local validation, physical-device testing, and deployment/publication.
- Before completing a task, test the affected functionality and summarize what changed. For documentation-only work, verify the document and referenced paths rather than claiming application tests were rerun. Explicitly report any validation that could not be performed.

## GymBro v2 milestone delivery workflow

- Start each milestone from the latest GitHub `main`, on a dedicated branch named `v2/milestone-N-short-description`. Never implement milestone work directly on `main`.
- Implement only the approved milestone scope. Run all applicable tests before committing, use a clear commit message, and push the milestone branch to GitHub.
- Create or update a pull request against `main` when supported. Do not merge it unless the user explicitly approves and requests the merge. Bug fixes stay on the same milestone branch and update its existing PR/preview.
- Use a Vercel Preview Deployment for physical-iPhone testing. Do not deploy milestone branches directly to the production Vercel environment. Report missing integration/access instead of inventing a preview URL or claiming deployment succeeded.
- After pushing, report the branch, commit hash, tests/results, PR status/link, preview deployment status/link, and specific iPhone checks.
- Only after milestone approval should it be merged. After merge, verify production deployment from `main` succeeds before starting the next milestone.

## Application version policy

- Use **MAJOR.MINOR.PATCH-BUILD**. MAJOR is product generation (2 for v2, 3 for v3); MINOR is the milestone (Milestone 2 is 2.2.x); PATCH is a non-feature/bugfix release within that milestone (initial 0, then 1, 2...).
- BUILD is a committed UTC timestamp in `YYYYMMDDTHHmmssZ` form. Update it once for each deployable code build, including fixes. Never generate it at page load; the same committed build must report the same version after reload.
- `app-version.js` is the only canonical application version source. UI, diagnostics and complete JSON exports consume `APP_VERSION`. Do not independently hard-code full versions or maintain another application version in private npm tooling metadata.
- Keep `DATA_VERSION` independent: milestone/application updates do not imply schema migrations. Complete JSON backups use `appVersion` plus the existing `version` field for data schema; do not duplicate it as `dataVersion`.
- Restore compatibility depends on schema, never application build. Old backups without `appVersion` and different-build backups remain supported when their data schema is supported.

- Keep the application-wide Help dialog in `index.html` accurate when user-facing controls or workflows change. Help is a user guide, not preview acceptance instructions; its version label must use `APP_VERSION`.

- Keep the acronym glossary in `ui-acronyms.js` current for data-entry labels. Limit acronym tooltips to entry controls; do not add them to History or other display-only content. Preserve explicit incompleteness; never silently clear it solely because weight/reps exist. The edit form must explain how to mark corrected records complete.

## History and recovery presentation

- Session history uses the saved snapshot name and authoritative `setIds` order. Never group distinct sessions by date or substitute a current template for historical intent.
- Legacy/sessionless date groups are presentation only. Preserve every record and source filter; no inferred session identity or timestamps.
- Keep per-set fields, corrections, compact icon controls and expandable raw record details available. Source filters may hide nonmatching sets but must not renumber session order or rewrite counts as full-session totals.
- Complete restore replaces the validated database; history merge keeps the established merge semantics. Explain the operation and selected backup before confirmation. Cancellation and conflicts must leave storage unchanged.

- Update `RELEASE_HISTORY.md` for accepted releases with exact canonical application version, independent schema, application revision, linked PR and meaningful changes. Distinguish preview lineage from accepted releases; do not invent past versions or physical-device results. Documentation-only updates do not bump the application build.

## Guided workouts — Milestone 4

- Exercise identity is currently the exercise-library name key. Do not invent IDs, equivalence, set/rep targets, rest periods or progression thresholds. Preserve every 60-minute slot and the existing 30-minute `short` selections, including existing roles.
- Start guided sessions atomically with snapshot and initial progress. Schema 6→7 preserves all old records and does not invent guidance. Existing active sessions require explicit Enable guidance.
- Position is separate from status: navigation never marks Done/Skip, and logging never infers completion. Finishing may retain pending slots after confirmation. No session reopen workflow.
- Substitution changes session-local actual exercise for subsequent sets only. Snapshot, template and previously logged sets must stay unchanged.
- Guided actions require an expected revision. Set submissions require action request IDs, not value-based deduplication. Persist committed request history (including deletion tombstones) atomically; failed writes must not consume a request.
- Resume committed guided state after reload. Invalid current slots fail conservatively. Keep partially entered forms transient and confirm before guided navigation discards them.
- History changes stay limited to planned/actual exercise and explicit guided statuses. Use the same action/state layer for future v3 adapters; no AI/voice implementation here.

## Product north star

- Read the current-scope section of `GymBro_PRD.md` when assessing product or architecture changes. The standalone application owns structured workout memory, actions, local persistence and the dashboard. Preserve DOM-independent structured actions/state; historical trainer concepts are not active implementation requirements.
- The PRD is a roadmap, not blanket authorization to expand a milestone. Follow the specifically approved scope; do not add autonomous training prescriptions, AI/voice or later features merely because the PRD describes future capabilities.

## Trainer evidence — Milestone 5

- `performance-context.js` is read-only. Compose the existing guided selector for trainer workout context; never create parallel authoritative session/guidance state or persist derived evidence.
- Follow `TRAINER_EVIDENCE.md` (`trainer-evidence-v1`): exact actual exercise and unit, referenced arithmetic, separate modes as context, no substitution equivalence/conversion/1RM/composite scores or automatic increase/maintain recommendations.
- Require explicit asOfDate; never use a runtime clock or arbitrary stale cutoff to change deterministic evidence. Preserve same-day chronology uncertainty and legacy display-only grouping.
- Keep existing preference text unparsed; structured goals/constraints and working-set/failure classification are not modeled. Do not infer them from notes or add a trainer-profile schema without approval.
- Evidence selectors must not write storage or change templates, current inputs, guided state, historical records or future prescriptions. The historical reasoning/coaching concept is not an active runtime integration. Milestone 6 remains a separate historical scope.

## iPhone hardening — Milestone 6

- Lifecycle callbacks may check for stale storage and warn; never rely on them to save committed workout data or silently adopt another tab’s database. Resume checks preserve transient inputs; resolve stale tabs by deliberate reload.
- Preserve DOM-free guided/trainer/action APIs, schema 7, revision/request contracts and manual fallback. Any proposed persistence schema change requires explicit approval before implementation.
- Maintain 16px mobile entry text and at least 44px primary workout action heights. Compact History icons retain their existing contract.
- Physical iPhone Safari acceptance is mandatory and separate from automated Chromium. Record the actual device, iOS, browser, build, commit, date and individual outcomes in REAL_PHONE_SMOKE_TEST.md; leave unavailable results pending. No Milestone 7 without authorization.

## Production delivery — Milestone 7

- Follow PRODUCTION_DELIVERY.md, V2_ARCHITECTURE.md, PRD_COMPLIANCE.md and the current V2_RELEASE.md. CI runs the complete suite and npm run check:syntax/check:release/check:diff; committed-range whitespace matters even on clean CI checkouts. Use .nvmrc, npm ci and the lockfile-pinned browser.
- Classify PRD requirements as implemented in V2, intentionally deferred to V3, accepted V2 limitation or actual V2 discrepancy. External trainer reasoning/voice is optional and unscheduled; explicit underlying V2 action gaps must still be reported, not silently deferred or implemented out of scope.
- Preparation may proceed before physical acceptance. Do not merge M7, perform final production acceptance or declare M7/V2 complete until physical iPhone results and defects, production backup verification, PRD gap dispositions and explicit merge approval are resolved.
- Keep schema 7 and workout/domain modules unchanged unless a verified production-blocking defect is separately approved. No AI, voice, transport, backend or speculative V3 infrastructure.
- Vercel remains branch→Preview, accepted main→Production. CI does not deploy, and a green preview is not production acceptance. Verify required GitHub checks/Vercel settings; do not claim branch protection from inaccessible settings.
- V2_RELEASE.md is a preparation artifact until the final production SHA/deployment/smoke and physical/backup gates are actually recorded. No release tag or V3 start is implied. Code rollback never automatically restores or downgrades browser data.
