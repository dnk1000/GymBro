# GymBro project rules

These rules apply throughout the repository. Preserve accepted behavior and user data unless the target GitHub issue explicitly changes them.

## Authority and workflow

For current work, read in this order when documents overlap:

1. `docs/GymBro_PRD.md` for product vision/North Star;
2. `docs/V3_M0_SCOPE_AND_ACCEPTANCE.md` for approved V3 transition decisions;
3. `docs/CURRENT_ARCHITECTURE.md` for deployed V2 versus approved V3 target architecture;
4. the target GitHub issue and its dependency issues — **the executable implementation specification**;
5. `docs/V3_IMPLEMENTATION_PLAN.md` for ordered backlog/dependency context;
6. `docs/DEVELOPMENT_WORKFLOW.md` for the development process;
7. subsystem/historical documents for detailed accepted contracts and release evidence.

Historical milestone documents remain evidence of what existed at that release. Old future-roadmap language inside them does not authorize new work.

GitHub `main` is the only authoritative code baseline. Start each implementation issue from current accepted `main`, use the existing repository/checkout/Vercel project, create a focused branch and PR, and do not merge or mutate Production data without explicit user approval. Do not create a parallel GymBro runtime/source authority.

## Issue-driven implementation contract

New product work follows:

**Chat/product discussion → GitHub issue/spec → ordered backlog → Codex branch/PR → acceptance evidence → close issue**

Before implementing an issue:

- read the issue and dependency issues;
- confirm the current `main` revision and current architecture;
- preserve unrelated behavior;
- do not add adjacent features merely because they seem useful;
- update durable documentation only when the issue changes a cross-cutting contract;
- report actual tests/evidence and explicitly identify anything not tested.

A PR should reference the issue it implements. A green CI run or open PR does not by itself satisfy the issue. Acceptance criteria require evidence. Keep an issue open until the agreed behavior is accepted.

Use `.github/ISSUE_TEMPLATE/implementation.md` for new implementation issues. Issue numbers and application versions are independent; one release may contain several issues.

## Current product/architecture boundary

### Deployed V2 today

The accepted runtime is a mobile-first vanilla HTML/CSS/JavaScript app delivered through GitHub → Vercel. Browser `localStorage` key `daveGymTrackerV1` is currently the authoritative workout store and data schema is 7.

Accepted V2 capabilities include:

- seven views: Dashboard, Program, Workout, History, ChatGPT Inbox, Exercises, Data;
- workout templates and 30/60-minute modes;
- explicit sessions and immutable plan snapshots;
- guided workout state/actions;
- set/bodyweight logging, RPE/RIR, pain/discomfort, notes and incompleteness;
- History corrections/deletions;
- deterministic performance/trainer evidence selectors;
- reviewed JSON import and complete JSON backup/restore;
- stale-tab protection and persist-before-success action semantics.

Normal deployed V2 operation requires no account, backend, provider login, AI API, or voice runtime.

### Approved V3.x direction

V3.x is the persistent-data/core-product-maturity generation, not the external-AI-integration generation.

Approved V3 direction includes:

- recoverable personal access/private ownership;
- stable canonical exercise identity before accepted full migration;
- verified Supabase/PostgreSQL migration on Preview;
- controlled Production cutover;
- Supabase/PostgreSQL as the sole active workout store after accepted cutover;
- no indefinite dual writes or automatic local-only workout fallback after cutover;
- exercise catalog/alias/merge and smart import normalization;
- data-model/History/core-workout maturity;
- completion of live-workout reordering/duration adaptation gaps.

External AI/provider integration, conversational automatic logging, adaptive AI coaching, and voice are deferred beyond V3.x unless a later explicit product decision changes that boundary. Preserve clean domain boundaries for future use, but do not add speculative provider infrastructure.

Do not revive abandoned PR #9 or develop on `v3/integration-architecture`.

## Product and UX rules

- iPhone Safari is the primary UX target; preserve useful desktop behavior.
- Preserve working functionality unless the target issue explicitly changes it.
- Do not redesign unrelated UI as cleanup.
- Keep touch targets, forms, tables, scrolling and keyboard behavior usable at narrow widths.
- Retain manual fallback even as guided/core behavior evolves.
- Do not invent training prescriptions, progression thresholds, pain interpretations, rest timers, exercise equivalence, or medical classifications unless explicitly approved.
- Keep presentation state separate from authoritative workout state.
- Keep workout rules/validation/state transitions reusable outside DOM handlers.
- Avoid unnecessary dependencies and framework rewrites.

## Data safety is a product contract

Until accepted V3 cutover, preserve the existing localStorage key `daveGymTrackerV1`; changing the key/origin can make data appear lost.

Always preserve, unless an approved migration explicitly transforms them:

- history and bodyweight records;
- program/templates and exercise definitions;
- preferences and import metadata;
- stable IDs and relationships;
- dates and units;
- notes and pain/discomfort fields;
- explicit `complete: false` uncertainty;
- session snapshots, set ordering, guidance/request identities;
- unknown preserved metadata.

Never rewrite historical workout facts or reseed an existing user's database to make tests pass. Never infer missing legacy sessions/timestamps. Version-5/sessionless history remains historical/sessionless unless an explicit user action or approved migration defines otherwise.

Startup must not destroy corrupt/unsupported future data. Failed saves must leave saved/committed state intact and must not be reported as success. Keep unsaved visible input when the approved interaction contract requires retry.

Before persistence/migration testing, export and verify a complete Production JSON backup. Preview and Production are different origins/data scopes. Automated tests use disposable storage only.

A data-model change requires explicit migration/backward-compatibility handling and regression coverage. For V3 migration, compare relationships/content rather than only record counts; retries must not duplicate or silently overwrite data.

## Exercise identity and import rules

Deployed V2 uses name-key exercise identity. V3 issue #16 replaces that with stable canonical IDs.

For V3 target architecture:

- GymBro owns canonical exercise identity;
- canonical display name and aliases are separate from immutable identity;
- provider/import/user labels are input/provenance, not identity keys;
- fuzzy similarity must not silently merge historical exercises;
- template/session role/order/short-workout use are contextual relationships, not solely intrinsic exercise metadata;
- preserve original incoming/logged labels where practical for provenance.

Current reviewed JSON interchange remains supported until an approved issue/versioned schema changes it. Imports remain review-before-commit and duplicate-safe. Treat imported text as untrusted.

## Sessions, History and performance

- Workout dates use the device's local calendar date.
- Preserve zero values where valid; missing is not zero.
- Session-linked sets must remain consistent with authoritative session order/relationships.
- Normal field corrections preserve membership; deletion removes the corresponding session-order reference.
- Do not move a set between sessions or change session date relationships implicitly.
- Position/navigation is not completion; Done/Skip remains explicit.
- Substitution is session-local unless a separate permanent program edit is explicitly requested.
- Historical template intent is preserved by snapshots when the current template later changes.

Performance comparisons must remain deterministic and explainable. Respect units and existing comparability rules. Do not convert assisted/bodyweight/incompatible units into fake rankings or inferred one-rep-max equivalents unless a later issue explicitly establishes such behavior.

History presentation may evolve through approved issues (#20–#26), but presentation changes must not rewrite historical facts or fabricate session identity.

## Backup/import/export

Complete JSON is the authoritative backup format. CSV is sets-only and is not a full database backup.

Keep these operations distinct:

- complete restore replaces the complete validated database after explicit confirmation;
- history merge preserves current settings according to the established merge contract;
- rejected/conflicting operations write nothing;
- original raw data must remain downloadable when recovery is required.

Application version and data schema are independent. Restore compatibility is based on supported data schema, not matching application build numbers.

## Validation requirements

For behavior changes:

- add/update focused automated coverage where practical;
- run applicable syntax/release/diff checks and regression tests;
- verify browser console behavior;
- for layout/UI changes, check narrow phone widths (including ~320 and 390 px) and desktop;
- use Vercel Preview for user-visible runtime acceptance;
- never claim responsive Chromium proves physical Safari behavior.

Physical iPhone checks must record actual device/iOS/browser/build/commit/results when required. Missing physical evidence stays Not tested / pending.

Documentation-only changes do not require pretending the application suite was rerun; verify document consistency, links and referenced paths instead.

Do not weaken assertions, remove validation, or delete tests merely to obtain green results.

## Version/release policy

Application version format is `MAJOR.MINOR.PATCH-BUILD` with a committed UTC timestamp build. `app-version.js` is the canonical application-version source. Data schema version is independent.

The older M0 plan mapped milestone numbers directly to V3 minor versions. The issue-driven workflow now separates issue order from release numbering. Do not assign concrete V3 release numbers until the release mapping is explicitly decided; never create two meanings for the same `3.x` version.

Update `docs/RELEASE_HISTORY.md` for accepted shipped releases with actual application version, schema, revision/PR, and meaningful evidence. Do not record previews or unperformed physical tests as accepted Production results.

## Repository/document guide

Current authorities:

- `README.md` — concise current product/run/data/workflow summary.
- `AGENTS.md` — these repository/Codex rules.
- `docs/README.md` — documentation map and current-vs-historical classification.
- `docs/GymBro_PRD.md` — product vision and North Star; newer approved V3 transition decisions supersede older scheduling/hosting assumptions when they conflict.
- `docs/V3_M0_SCOPE_AND_ACCEPTANCE.md` — approved V3 transition decisions/gates.
- `docs/CURRENT_ARCHITECTURE.md` — deployed V2 versus approved V3 target.
- `docs/V3_IMPLEMENTATION_PLAN.md` — V3 ordered issue backlog.
- `docs/DEVELOPMENT_WORKFLOW.md` — issue-driven workflow.

Detailed V2/subsystem documents (`V2_ARCHITECTURE.md`, `GUIDED_WORKOUTS.md`, `TRAINER_EVIDENCE.md`, `HISTORY_AND_BACKUPS.md`, `WORKOUT_SESSIONS.md`, etc.) remain important accepted contracts/history. Preserve their historical context rather than rewriting them to pretend V3 already existed.

## Finish every task with evidence

Report:

- issue implemented;
- branch and PR;
- user-visible behavior changes;
- data/schema/migration impact;
- tests/checks actually performed;
- Preview/physical-device evidence when applicable;
- known limitations or deferred acceptance items.

Do not claim work is merged, deployed, physically tested, backed up, migrated, or accepted unless that evidence actually exists.
