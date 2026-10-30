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

## Permanent coding-agent invariants

These apply to every implementation task. Any exception must follow an explicitly approved higher-authority requirement and its recorded scope or transition; issue wording alone does not create an exception.

1. **Keep scope focused.** Implement only the approved issue/work package using the smallest coherent change. Avoid unrelated cleanup, refactoring, upgrades, formatting, file moves, generated-file edits, or architectural changes. Report unrelated findings separately.
2. **Preserve product intent.** Change user-visible behavior, workflows, safety behavior, or domain rules only when the approved work authorizes it consistently with governing product requirements. Existing behavior does not resolve a conflicting requirement.
3. **Preserve approved architecture.** Change architectural boundaries, persistence, identity, schemas, APIs, provider boundaries, or security models only within approved technical decisions. Routine implementation choices within those boundaries require no escalation.
4. **Protect persisted data.** Preserve facts, relationships, and metadata except through explicit user actions or approved transformations. Persistence/schema changes must define migration, compatibility, failure behavior, and verification. Pause affected work when safe handling cannot be established.
5. **Preserve supported compatibility.** Keep supported formats, schemas, interfaces, workflows, and integrations compatible unless approved work explicitly defines the breaking change and transition. Escalate material uncertainty.
6. **Preserve test integrity.** Do not weaken, delete, bypass, skip, or rewrite valid tests merely to pass. Explain obsolete expectations and update them with the approved behavior change. Add or modify coverage where needed to prove acceptance and prevent regression.
7. **Diagnose failures before changing behavior.** Establish the cause of build, test, lint, migration, or runtime failures. Do not suppress errors, broaden exception handling, disable validation, or add fallbacks merely to obtain passing checks.
8. **Minimize dependencies and complexity.** Prefer the existing stack. Justify necessary runtime or development dependencies against approved work. Avoid abstractions for hypothetical future needs.
9. **Keep documentation and completion claims evidence-based.** Update the owning documentation when its described contract or assumptions change. Distinguish planned, implemented, tested, deployed, and accepted states. Verify acceptance criteria proportionately and report unverified criteria explicitly.
10. **Respect repository state.** Check branch/worktree, intended base, and working-tree changes before implementation. Preserve unexplained user changes, isolate unrelated work, and follow repository branch, commit, PR, and approval conventions.
11. **Resolve material ambiguity explicitly.** Apply Step 1's conflict procedure to material product, architecture, data, security, or compatibility uncertainty. Continue independent work only when clearly safe; routine choices within approved constraints remain implementation decisions.

## Efficient execution

Do only the work needed to deliver and verify the approved scope. These rules reduce overhead; they do not waive required acceptance criteria, data protections, verification or approval gates.

- **Read once, then read changes.** Reuse governing documents and decisions already read in the session when still current. On a new baseline, inspect relevant changes instead of rereading entire unchanged documents. Follow linked references only when they govern the task; avoid recursive background research.
- **Keep implementation and verification proportional.** Choose the smallest coherent change and checks that cover its acceptance criteria and affected contracts. Batch independent reads/checks. Start with focused local verification; use applicable CI for broader coverage rather than manually duplicating it. Repeat or broaden checks only for a new change, failure, explicit requirement or unresolved risk.
- **Keep one completion record.** Normally put the canonical completion report and AC mapping in the PR body; link to it from the issue and final response. Update owning documentation only when its contract changes or a governing rule requires a record. Do not create an issue-specific evidence document or repeat the report across several files by default. Keep required version/release updates concise and link evidence.
- **Avoid unnecessary data operations.** Presentation-only checks with disposable data do not by themselves require a Production backup, restore exercise or migration test. Existing persistence/migration backup gates still apply when those paths are actually being tested. Never use a user's saved data merely to verify a visual change.
- **Bound tool recovery.** Retry a failed route only when there is a concrete correction; do not repeat an unchanged failing request. If that correction fails, use at most one viable supported fallback, then report the limitation. Stop chasing optional screenshots, downloads or other artifacts once sufficient evidence exists. Required verification that remains unavailable stays UNVERIFIED and blocks the corresponding completion claim.
- **Stop when the authorized work is handled.** Avoid extra polishing, artifacts, checks, polling or documentation commits without a concrete task need. Batch evidence updates into one final record where practical. Identify genuine pending device/acceptance/approval gates and hand them off clearly; do not invent additional gates or request approval already recorded.

See [efficient execution in the workflow](docs/DEVELOPMENT_WORKFLOW.md#efficient-execution) for how this applies to preparation and reporting.

## Issue-driven implementation contract

New product work follows:

**Chat/product discussion → GitHub issue/spec → ordered backlog → Codex branch/PR → acceptance evidence → close issue**

Before implementing an issue:

- read the issue, dependency issues and governing product/architecture references; apply the hierarchy and conflict rule above;
- confirm the current `main` revision and current architecture;
- preserve unrelated behavior;
- do not add adjacent features merely because they seem useful;
- update durable documentation only when the issue changes a cross-cutting contract;
- verify the assigned Change Level and rationale, use the highest applicable level and satisfy any required proposal/approval gate;
- define a scope-appropriate Validation approach that proves the issue's acceptance criteria;
- report actual tests/evidence and explicitly identify anything required but not tested.

A PR should reference the issue it implements. A green CI run or open PR does not by itself satisfy the issue. Acceptance criteria require evidence. Keep an issue open until the agreed behavior is accepted.

Use `.github/ISSUE_TEMPLATE/implementation.md` for new implementation issues. Issue numbers and application versions are independent; one release may contain several issues.

## Definition of Done

Use unqualified **issue complete** or **Done** only when all eight applicable conditions below are satisfied for the approved scope. `Not applicable` is valid only when a condition genuinely does not apply. Partial implementation, blocked handoffs and review requests are not DoD completion.

1. **Approved scope delivered.** Required approved outcomes are implemented, with no silently included unrelated product, architecture, data, dependency, refactor, cleanup, formatting or other work. Scope deviations are approved and recorded; no unresolved material governance conflict affects the required outcome.
2. **Acceptance and verification evidenced.** Every acceptance criterion has an explicit `AC-N → method/evidence → PASS / FAIL / UNVERIFIED` result, and required scope-appropriate verification is complete. Required `FAIL` or `UNVERIFIED` results prevent unqualified completion; implementation existing or unrelated checks passing do not prove acceptance. Approved removal/deferral updates the approved scope and preserves the original requirement's disposition, without rewriting prior failure/unverified evidence as `PASS`.
3. **Applicable checks remain sound.** Existing valid checks affected by the change pass. Do not weaken, skip, bypass, delete or reinterpret them to declare completion. Explain expectations made obsolete by approved behavior changes, update them within scope and evidence their replacements.
4. **Data and compatibility obligations satisfied.** Where applicable, evidence and approvals cover persisted data, migrations, supported compatibility, integrity, failure/retry, recovery/rollback, concurrency, security, destructive operations, backup/restore and import/export integrity. Otherwise use `Not applicable`.
5. **Documentation and release handling accurate.** Update affected owning documentation and applicable release/version records to reflect actual changes and evidence. Distinguish planned, implemented, tested, accepted, merged and deployed; do not claim device verification, migration success, release acceptance or Production state without evidence. No documentation churn or version change is required when the relevant governed contract did not change.
6. **Repository delivery intentional.** Include only intended changes, preserve unexplained user changes, isolate unrelated work, avoid unnecessary generated-file changes and follow branch/commit/PR conventions. The final tree is clean after the final commit unless retained pre-existing changes or another specific condition is explained; never discard unexplained user work to obtain a clean tree.
7. **Completion report truthful and sufficient.** Provide the canonical [Completion report](docs/DEVELOPMENT_WORKFLOW.md#completion-report), including known negative evidence and pending actions. Do not omit known failures, skipped checks, limitations or unresolved risks.
8. **Required acceptance and claimed state supported.** Record approvals and acceptance required for the claimed state. Pending human acceptance is a handoff, not evidence of acceptance, merge, deployment, Production state or full issue completion. Required verification remains required when Codex lacks the tool to perform it; tool limits do not reclassify technical verification as optional human acceptance.

The DoD complements issue-specific requirements, acceptance criteria, Change Level, Validation approach, the source-of-truth hierarchy, permanent invariants and conflict procedure. It applies across all Change Levels with proportional evidence. An issue cannot independently waive higher-authority requirements; legitimate exceptions need justification, a record and approval at the appropriate authority level consistent with the hierarchy. Follow the workflow's [DoD application and completion states](docs/DEVELOPMENT_WORKFLOW.md#definition-of-done-and-completion-states) for exceptions and qualified handoffs.

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

## Change control and validation

**Change Level** is the sole numbered risk/change classification. **Validation approach** describes actual checks and evidence, not another numbered system. Follow the [full change-control model](docs/DEVELOPMENT_WORKFLOW.md#change-levels-and-validation):

- **Change Level 1 — Local / low-risk:** narrow, clear, reversible corrections or maintenance without material governed-contract change. Includes contained runtime/UI fixes and documentation corrections; normally no separate proposal.
- **Change Level 2 — Feature / domain behavior:** material behavior changes within approved product, architecture, persistence and compatibility boundaries. A `Ready` issue with explicit acceptance criteria normally needs no separate proposal.
- **Change Level 3 — Architecture / data / security / high-risk:** material foundational-contract change or substantial data, compatibility, security, destructive-operation, reversibility or uncertain-blast-radius risk. Requires a proposal/audit, recorded approval and explicit human acceptance. Import/export integrity, restore/recovery, duplicate protection and concurrency can require this level without a schema bump.

Check Change Level 3 triggers first, then behavior changes for Change Level 2; otherwise use Change Level 1 only for contained low-risk work. **Highest applicable level wins.** Authors assign and agents verify before implementation. Classify by risk and governed contracts, not file/line count, implementation time or apparent simplicity; routine choices inside approved boundaries need no escalation.

If work is materially under-classified, pause affected work, identify the risk/authority, explain the mismatch, recommend the appropriate level and obtain newly required decisions/approvals. Safe independent work follows the existing conflict procedure. Do not silently downgrade: lowering a level or removing an assigned control requires recorded rationale and appropriate approval.

Existing approved designs, decision issues, audits or other recognized approval may satisfy the Change Level 3 proposal gate when they cover the actual scope. Reference them; do not request approval again unless scope changes, risk changes materially or coverage is insufficient. A required pending gate prevents `Ready`. Existing merge and Production approval gates remain in force at every level.

Verification remains **risk-based and scope-appropriate** at every Change Level:

- Documentation-only work: verify consistency, Markdown/rendering, links/paths/references and no runtime/configuration/schema/Production-data changes. Do not rerun application suites, runtime Preview/device acceptance or migration tests solely for documentation changes.
- Runtime/UI work: focused tests where practical, relevant syntax/release/diff/regression and browser-console checks; Vercel Preview for user-visible runtime changes; affected desktop and ~320/~390 px responsive widths; physical iPhone evidence when required by the issue/acceptance criteria. Change Level 1 does not waive applicable browser/device evidence.
- High-risk implementation: applicable full relevant regression/integration, schema/migration replay, recovery/rollback, backup and source/destination content/relationship comparisons, retry/idempotency/concurrency and authorization/isolation/security checks; Preview and required physical-device/Production gates.

Additional verification alone does not raise Change Level; newly discovered foundational risk does. An architecture-only proposal needs design/decision evidence rather than migration tests when no implementation exists. Historical validation labels remain valid historical evidence and are not rewritten.

Never claim responsive Chromium proves physical Safari behavior. When physical checks are required, record actual device/iOS/browser/build/commit/results; otherwise state Not tested/pending rather than pretending.

Automatic CI is supporting evidence, not a requirement to manually repeat every suite. A PR must state the assigned Change Level, Validation approach, actual results and required evidence still pending.

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

Apply the [Definition of Done](#definition-of-done) and provide the canonical [Completion report](docs/DEVELOPMENT_WORKFLOW.md#completion-report), including for partial or blocked handoffs. Use the workflow's evidence-backed completion-state terminology; do not claim work is merged, deployed, physically tested, backed up, migrated or accepted unless that evidence actually exists.
