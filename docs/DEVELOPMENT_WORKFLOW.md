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
- **Testing / evidence** — automated and manual checks required for acceptance.
- **Release notes** — user-visible change or `none` when purely internal/documentation.

If discussion reveals multiple independently useful implementation units, split them into separate issues rather than expanding one issue indefinitely.

## Ordering and dependencies

Order the backlog primarily by dependency, then by user/product value. Do not encode dependency solely in version-looking issue titles. Use explicit issue references such as:

- `Depends on #16`
- `Blocks #23`
- `Independent of #22`

The V3 implementation plan groups issues into broad phases, but the issues themselves are the executable work units.

## Codex execution contract

Unless an issue explicitly says otherwise, a Codex implementation request means:

> Start from current accepted `main`. Read `AGENTS.md`, `README.md`, `docs/GymBro_PRD.md`, this workflow, the target issue, and any dependency issues/documents named by it. Implement only the target issue. Preserve existing behavior and historical data unless the issue explicitly changes them. Use the existing repository, checkout, Vercel project, and approved architecture. Create a focused branch and pull request. Link the PR to the issue. Run applicable validation and report evidence. Do not merge or change Production data without explicit user approval.

The issue body should contain the product-specific prompt. A separate giant Codex prompt should normally be unnecessary.

## Pull requests and acceptance

Each implementation PR should:

- reference the issue it implements (`Closes #N` only when closure on accepted merge is appropriate; otherwise `Implements #N`);
- avoid unrelated cleanup or scope expansion;
- state user-visible behavior changes and preserved behavior;
- state data/schema/migration implications;
- list tests and manual checks actually performed;
- identify anything not tested, especially physical iPhone behavior;
- include Preview evidence when user-visible/runtime behavior changes;
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

## Documentation ownership

Use documents for durable cross-cutting contracts and history:

- `README.md` — current product/run/storage summary and links.
- `AGENTS.md` — repository rules Codex must follow.
- `docs/GymBro_PRD.md` — product authority and North Star.
- `docs/V3_IMPLEMENTATION_PLAN.md` — ordered V3 phase/backlog view and dependencies.
- `docs/RELEASE_HISTORY.md` — accepted shipped releases and evidence.
- milestone/architecture documents — historical or subsystem-specific contracts; retain their historical context rather than rewriting the past.

When an issue changes a cross-cutting contract, update the relevant durable document in the same PR. Do not duplicate the full issue body into several documents.
