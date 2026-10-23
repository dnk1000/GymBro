# GymBro project rules

These rules apply throughout this repository. Preserve the product contracts below unless the user explicitly requests a change to them. Routine fixes within these contracts do not require renewed approval. If a requested change affects a contract, explain the behavior and compatibility impact before implementing it; do not treat adjacent cleanup as authorization to redesign the app.

## Product and scope

- GymBro is a mobile-first, local-first personal workout tracking/coaching web app. The current version is **V1.6**, with internal data version **5**.
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
- **Voice and AI interaction are planned for GymBro v3, not v2.** Do not add voice capture, transcription, conversational agents, AI services, or their infrastructure during v2 work unless the user explicitly changes the roadmap. The existing manual ChatGPT JSON Inbox remains supported.
- Supporting that future direction means preserving clear boundaries now, not adding speculative abstractions, dependencies, or unused integrations.

## Repository guide

The app has no runtime package installation or build step. Serve the repository with `python3 -m http.server 8000 --bind 127.0.0.1` (also available as `npm start`). Keep the static assets together.

| File | Responsibility |
| --- | --- |
| `index.html` | Application shell, seven views, form markup, and script loading. |
| `styles.css` | Shared visual styling, responsive grids, forms, and mobile layout. |
| `app.js` | Application actions, workout logging, import review, history, analytics, charts, and DOM rendering. Currently contains mixed concerns; separate them gradually when practical. |
| `storage.js` | Data validation, legacy migration, safe persistence, stale-tab detection, and recovery. |
| `seed.js` | Original historical workout data, baseline program, exercise taxonomy, and coaching preferences. |
| `gymbro-logo.png` | Header and favicon branding asset. |
| `tests/app.test.cjs` | Chromium regression tests using Node's test runner and Playwright Core; starts an isolated local server and disposable browser contexts. |
| `package.json`, `package-lock.json` | Development commands and pinned test dependencies. |
| `README.md` | Run instructions, product behavior, data storage, backup semantics, and development workflow. |
| `CHATGPT_IMPORT_SCHEMA.md` | Supported workout JSON interchange format and validation rules. |
| `CHANGELOG.md` | Meaningful version changes. |
| `REAL_PHONE_SMOKE_TEST.md` | Physical-device validation checklist and release-gate status. |
| `AGENTS.md` | Project rules for future Codex work. |

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

## Logging, history, and analytics

- Workout dates use the device's **local calendar date**, not a UTC date derived from `toISOString()`.
- Preserve zero values where valid. Missing values are not zero and must not be guessed. Reps must be positive whole numbers; validation ranges and supported units follow the documented import contract.
- Explicit `complete: false` means approximate/incomplete even when load and reps exist. Preserve it through review, commit, editing, migration, and backup.
- Sets from every source remain visible and correctable in history. Corrections/deletions must retain import duplicate protection.
- A plan's Log action starts a new set; it must not accidentally overwrite the set currently being edited.
- **Latest** in exercise detail is history, not a performance ranking: show the most recent set with recorded load and reps, including assisted, bodyweight, zero-load, and approximate sets.
- **Best comparable set-work**, performance charts, and gains use complete, positive external loads in the latest eligible matching unit for that exercise. Exclude assisted/bodyweight records from these rankings; never compare incompatible load units as equivalent.
- Training days count unique workout dates. Do not imply the current model distinguishes multiple sessions on one date.
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

- V1.6 is **not yet frozen as the final stabilized baseline**. The physical-phone smoke test remains pending unless actual results have subsequently been recorded in `REAL_PHONE_SMOKE_TEST.md`.
- Do not mark the phone checklist complete from desktop/mobile emulation. Record the actual device, OS, browser, code revision, results, and remaining failures. Do not claim iPhone Safari support was tested using Chromium.
- Do not freeze/tag the stabilized baseline or begin v2 until the requested real-phone validation is completed and failures are resolved, or the user explicitly changes this requirement.
- Finish work with a concise account of changes, user-visible behavior changes, validation evidence, and remaining limitations. Distinguish implemented code, local validation, physical-device testing, and deployment/publication.
- Before completing a task, test the affected functionality and summarize what changed. For documentation-only work, verify the document and referenced paths rather than claiming application tests were rerun. Explicitly report any validation that could not be performed.
