# GymBro project rules

These rules apply throughout the repository. Preserve accepted behavior and user data unless the target GitHub issue explicitly changes them within approved product and architectural constraints.

## Authority and workflow

Apply this source-of-truth hierarchy:

1. **`docs/GymBro_PRD.md` — Product authority:** intended behavior, user experience, product principles, scope and requirements.
2. **Approved architecture/design documents — Technical authority:** domain models, identity, persistence, schemas, APIs, migrations and boundaries. Architecture must implement and support approved product requirements; it cannot independently override them.
3. **GitHub issues — Approved implementation work:** bounded work translating approved product and architecture decisions. Issues may clarify implementation details within those constraints, but may not silently redefine them.
4. **Repository code and tests — Implemented state:** current implementation and regression contract. Existing code or passing tests do not independently establish product requirements when they conflict with higher authority.

Preserve approved decisions and delegated authority: milestone/decision records remain approval evidence, subsystem designs govern their technical domains, and `docs/VERSION_POLICY.md` retains explicitly delegated versioning authority. Document recency alone does not determine precedence. See [development governance](docs/DEVELOPMENT_WORKFLOW.md#source-of-truth-hierarchy) for the fuller explanation and governing references.

For a material conflict, ambiguity or missing decision, identify the problem and authorities involved, explain the implementation impact, recommend a resolution when useful, and pause the affected work until resolved. Independent work may continue only when clearly safe and unable to prejudice or complicate the decision. Routine implementation choices within approved constraints need no escalation. Record approval and the resolved governing decision before dependent implementation proceeds; follow [decision resolution](docs/DEVELOPMENT_WORKFLOW.md#material-conflicts-and-decision-resolution).

Historical milestone documents remain evidence of what existed at that release. Old future-roadmap language inside them does not authorize new work.

GitHub `main` is the only authoritative code baseline. Start each implementation issue from current accepted `main`, use the existing repository/checkout/Vercel project, create a focused branch and PR, and do not merge or mutate Production data without explicit user approval. Do not create a parallel GymBro runtime/source authority.

## Issue-driven implementation contract

New product work follows:

**Chat/product discussion → GitHub issue/spec → ordered backlog → Codex branch/PR → acceptance evidence → close issue**

Before implementing an issue:

- read the issue, dependency issues and governing product/architecture references; apply the hierarchy and conflict rule above;
- confirm the current `main` revision and current architecture;
- preserve unrelated behavior;
- do not add adjacent features merely because they seem useful;
- update durable documentation only when the issue changes a cross-cutting contract;
- select the lowest validation level that fully covers the issue risk and acceptance criteria;
- report actual tests/evidence and explicitly identify anything required but not tested.

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
- Preserve working functionality unless the target issue explicitly changes it within approved product and architectural constraints.
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

Performance comparisons must remain deterministic and explainable. Respect units and existing comparability rules. Do not convert assisted/bodyweight/incompatible units into fake rankings or inferred one-rep-max equivalents unless a later issue implements an explicitly approved decision establishing such behavior.

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

Validation is **risk-based and scope-appropriate**. Use the lowest level that fully proves the target issue's acceptance criteria. Do not manually run broad or expensive suites merely by habit.

### Level 1 — Documentation/process only

Use for Markdown, planning, process, issue-template, or other non-executable documentation changes.

Required evidence normally includes:

- changed-document consistency;
- Markdown/rendering sanity where relevant;
- links, paths, filenames, issue references and terminology;
- confirmation that runtime code, executable configuration, schema and Production data were not changed.

Do not manually rerun the full application regression suite, Vercel runtime acceptance, browser/device tests, or migration tests solely for documentation changes. If normal CI runs automatically, it may complete as supporting evidence; do not duplicate unrelated checks manually.

### Level 2 — UI/behavioral

Use for user-facing runtime behavior, responsive/layout work, ordinary features and low-risk application logic.

Run only applicable evidence, such as:

- focused automated coverage where practical;
- relevant syntax/release/diff and regression checks;
- browser-console verification where affected;
- Vercel Preview for user-visible runtime changes;
- affected desktop and narrow-phone widths (including ~320 and 390 px) for responsive UI;
- physical iPhone testing only when the issue/acceptance criteria require it.

Never claim responsive Chromium proves physical Safari behavior. When physical checks are required, record actual device/iOS/browser/build/commit/results; otherwise state Not tested/pending rather than pretending.

### Level 3 — Data/infrastructure/high-risk

Use for authentication/authorization, schema, persistence, migrations, backup/restore, destructive operations, concurrency/retry, security-sensitive infrastructure and Production cutover.

Run the applicable high-risk evidence, including where relevant:

- full relevant regression/integration tests;
- schema/migration replay and recovery/rollback checks;
- backup and source/destination data comparisons;
- retry/idempotency/concurrency testing;
- authorization/isolation/security testing;
- Preview validation and required physical-device/Production gates.

Automatic CI is supporting evidence, not a requirement to manually repeat every suite. A PR must state the validation level selected, what was actually run, and what required evidence remains pending.

Do not weaken assertions, remove validation, or delete tests merely to obtain green results.

## Version/release policy

Follow [docs/VERSION_POLICY.md](docs/VERSION_POLICY.md), the issue #43 decision, for V3 versioning. Keep `MAJOR.MINOR.PATCH-BUILD`: product generation, accepted release increment, non-feature bugfix/non-functional release, and committed UTC timestamp. `app-version.js` remains the only canonical application-version source; data schemas and migration identifiers are independent.

The first planned V3 release is `3.1.0-BUILD` for #38 infrastructure foundation alone. This mapping does not authorize starting #38 or a deployment. One or several accepted issues may form a release only through an explicit approved mapping. The `V3.0`, `V3.1` and `V3.2` prefixes on #16, #17 and #18 are capability labels, not application release numbers. This supersedes the older M0 milestone-to-minor mapping.

Documentation-only and development-only tooling changes do not bump the app or BUILD. New deployable builds receive a committed UTC BUILD; fixes within a release increment PATCH. Reload/redeployment of the same build retains its version. Keep release-check expectations aligned with the actual canonical build; the first V3 code PR must update the current V2-specific expectations and tests without weakening checks.

Update `docs/RELEASE_HISTORY.md` for accepted shipped releases with actual application version, schema, revision/PR, and meaningful evidence. Do not record previews or unperformed physical tests as accepted Production results.

## Repository/document guide

Current authorities:

- `README.md` — concise current product/run/data/workflow summary.
- `AGENTS.md` — these repository/Codex rules.
- `docs/README.md` — documentation map and current-vs-historical classification.
- `docs/GymBro_PRD.md` — product authority and North Star, including explicitly approved amendments evidenced in linked decision records.
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
- validation level selected;
- tests/checks actually performed;
- Preview/physical-device evidence when applicable;
- known limitations or deferred acceptance items.

Do not claim work is merged, deployed, physically tested, backed up, migrated, or accepted unless that evidence actually exists.
