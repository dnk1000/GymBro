# GymBro issue-driven development workflow

Status: current workflow authority for new GymBro product work.

## Operating model

GymBro uses a simple issue-driven workflow:

**Chat/product discussion → GitHub issue/specification → ordered backlog → Codex implementation branch/PR → acceptance evidence → close issue**

Chat is the product workshop. GitHub issues are the durable implementation specification and backlog. Pull requests are implementation/evidence records. Closing an issue means the accepted behavior is complete, not merely that code exists.

## One issue = one implementation unit

Each implementation issue should be small enough to review and accept independently. An issue may be a feature, data-model change, migration step, UX improvement, bug, or documentation task. A product release may contain several issues; issue numbers and application version numbers are independent.

An implementation issue should contain:

- **Purpose / problem** — what user or architectural problem is being solved.
- **Required behavior** — concrete product and data behavior.
- **Acceptance criteria** — observable conditions that prove completion.
- **Dependencies** — issues that must precede it, issues it blocks, or an explicit statement that it is independent.
- **Non-goals / exclusions** — adjacent work that is intentionally not included.
- **Data / migration impact** — required for persistence, schema, identity, import/export, or historical-data changes.
- **Validation level / testing evidence** — checks proportional to the actual risk and acceptance criteria.
- **Release notes** — user-visible change or `none` when purely internal/documentation.

If discussion reveals multiple independently useful implementation units, split them into separate issues rather than expanding one issue indefinitely.

## Ordering and dependencies

Order the backlog primarily by dependency, then by user/product value. Do not encode dependency solely in version-looking issue titles. Use explicit issue references such as:

- `Depends on #16`
- `Blocks #23`
- `Independent of #22`

The V3 implementation plan groups issues into broad phases, but the issues themselves are the executable work units.

## Risk-based validation

Validation must be proportional to the risk and scope of the change. Use the lowest level that fully proves the issue's acceptance criteria; do not run broader or more expensive checks merely by habit.

### Level 1 — Documentation/process only

Use when only Markdown, process documentation, planning text, issue templates, or other non-executable documentation changes.

Required evidence normally includes:

- document consistency and correct current-vs-historical wording;
- Markdown/rendering sanity where relevant;
- links, paths, issue references and filenames;
- confirmation that no runtime code, executable configuration, schema, or Production data changed.

Do **not** manually rerun the full application regression suite, Vercel acceptance, browser/device tests, or migration tests solely for documentation changes. If CI triggers automatically, let it run, but Codex does not need to duplicate unrelated suites manually.

### Level 2 — UI/behavioral

Use for user-facing runtime behavior, layout/responsive changes, normal feature changes, and low-risk application logic.

Required evidence should be scoped to what changed, such as:

- focused automated tests where practical;
- relevant syntax/regression checks rather than every unrelated suite;
- Vercel Preview for user-visible runtime changes;
- affected desktop and narrow-phone checks for responsive UI;
- physical iPhone evidence only when the issue or acceptance criteria require it.

### Level 3 — Data/infrastructure/high-risk

Use for authentication/authorization, schema, migrations, persistence, backup/restore, destructive operations, concurrency, Production cutover, security-sensitive infrastructure, and other changes that can lose/corrupt/expose user data.

Required evidence may include:

- full applicable regression/integration coverage;
- schema/migration replay and rollback/recovery checks;
- backup and source/destination data comparisons;
- retry/idempotency/concurrency testing;
- authorization/isolation/security checks;
- Preview evidence and explicit physical-device/Production gates required by the issue.

Automatic CI is supporting evidence, not a command to manually repeat all tests. A PR must state which validation level was used, what was actually run, and what required evidence remains pending.

## Codex execution contract

Unless an issue explicitly says otherwise, a Codex implementation request means:

> Start from current accepted `main`. Read `AGENTS.md`, `README.md`, `docs/GymBro_PRD.md`, `docs/CURRENT_ARCHITECTURE.md`, this workflow, the target issue, and any dependency issues/documents named by it. Implement only the target issue. Preserve existing behavior and historical data unless the issue explicitly changes them. Use the existing repository, checkout, Vercel project, and approved architecture. Create a focused branch and pull request. Link the PR to the issue. Select the lowest risk-based validation level that fully covers the issue and its acceptance criteria, run the applicable validation, and report evidence. Do not merge or change Production data without explicit user approval.

The issue body should contain the product-specific prompt. A separate giant Codex prompt should normally be unnecessary.

## Pull requests and acceptance

Each implementation PR should:

- reference the issue it implements (`Closes #N` only when closure on accepted merge is appropriate; otherwise `Implements #N`);
- avoid unrelated cleanup or scope expansion;
- state user-visible behavior changes and preserved behavior;
- state data/schema/migration implications;
- identify the validation level used and list tests/manual checks actually performed;
- identify anything required but not tested, especially physical iPhone behavior;
- include Preview evidence when the selected validation level/user-visible runtime scope requires it;
- remain unmerged until explicit user approval.

An issue is complete only when its acceptance criteria have evidence. A green CI run or an open PR alone does not make the issue complete.

## Suggested labels

Use a small label vocabulary rather than a large project-management taxonomy:

### Type / area
- `architecture`
- `data-model`
- `migration`
- `ui`
- `history`
- `exercise`
- `import`
- `bug`
- `documentation`

### Priority
- `P0` — blocks safe continuation or risks user data
- `P1` — important near-term/core product work
- `P2` — useful but can follow core work
- `P3` — later/polish/idea backlog

### State when useful
- `blocked`
- `needs-decision`

Do not create redundant labels for release numbers or milestones when an issue title/dependency and the implementation plan already express sequencing.

## Product generations versus issues

Product generations describe architectural/product eras, not individual issues.

- **V2** — accepted local/manual/guided workout application and domain-action baseline.
- **V3.x** — persistent database/core-product-maturity generation: recoverable access, database migration/cutover, stable exercise identity, catalog/import normalization, data-model cleanup, History/product maturity, and remaining core workout behavior.
- **Future trainer generation** — provider/AI integration, conversational control, adaptive AI behavior, and voice after the V3 system of record is stable.

Minor/patch application releases may bundle one or several accepted issues. Do not assume one issue equals one release.

Use [VERSION_POLICY.md](VERSION_POLICY.md) for version components, BUILD changes, capability-label distinctions and approved release mappings. Issue #43 assigns the first planned `3.1.0-BUILD` to #38 infrastructure foundation alone. Other issues need their own release mapping; selecting a version does not authorize implementation, merge or deployment. Documentation-only work leaves the canonical application version unchanged.

For each deployable code PR, identify its approved release mapping and update `app-version.js`, applicable release records and release-check expectations together. Keep Preview candidates distinct from accepted releases. The first V3 code PR must replace the checker's current V2-specific expectations with the actual V3 build/record and update focused tests while preserving all integrity checks.

## Documentation ownership

Use documents for durable cross-cutting contracts and history:

- `README.md` — current product/run/storage summary and links.
- `AGENTS.md` — repository rules Codex must follow.
- `docs/README.md` — map of current versus historical documentation.
- `docs/GymBro_PRD.md` — product North Star and durable product requirements; newer approved transition decisions govern when older scheduling/hosting text conflicts.
- `docs/CURRENT_ARCHITECTURE.md` — deployed V2 versus approved V3 target architecture.
- `docs/V3_IMPLEMENTATION_PLAN.md` — ordered V3 phase/backlog view and dependencies.
- `docs/RELEASE_HISTORY.md` — accepted shipped releases and evidence.
- `docs/VERSION_POLICY.md` — application-version semantics and approved issue-to-release mappings; `app-version.js` remains the canonical build source.
- milestone/architecture documents — historical or subsystem-specific contracts; retain their historical context rather than rewriting the past.

When an issue changes a cross-cutting contract, update the relevant durable document in the same PR. Do not duplicate the full issue body into several documents.
