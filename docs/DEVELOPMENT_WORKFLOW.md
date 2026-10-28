# GymBro issue-driven development workflow

Status: current workflow authority for new GymBro product work.

## Operating model

GymBro uses a simple issue-driven workflow:

**Chat/product discussion → GitHub issue/specification → ordered backlog → Codex implementation branch/PR → acceptance evidence → close issue**

Chat is the product workshop. GitHub issues are the durable implementation specification and backlog. Pull requests are implementation/evidence records. Closing an issue means the accepted behavior is complete, not merely that code exists.

## Source-of-truth hierarchy

Authority follows the type of decision an artifact may govern:

1. **[GymBro_PRD.md](GymBro_PRD.md) — Product authority.** Defines intended product behavior, user experience, product principles, scope and requirements.
2. **Approved architecture/design documents — Technical authority.** Define how approved product requirements are represented through domain models, identity, persistence, schemas, APIs, migrations and architectural boundaries. Architecture must implement and support approved product requirements and cannot independently override them.
3. **GitHub issues — Approved implementation work.** Translate approved product and architecture decisions into bounded implementation work. Issues are executable specifications within those constraints; they may clarify implementation details but may not silently redefine product requirements or approved architecture.
4. **Repository code and tests — Implemented state.** Represent the current implementation and regression contract. Existing behavior or passing tests do not independently establish product requirements when they conflict with higher authority.

This hierarchy preserves existing approved decisions and explicitly delegated authority. Approved milestone/decision records, such as [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md), remain evidence of product approval, including explicit amendments to older requirements. Approved subsystem architecture documents remain authoritative within their technical domains. [VERSION_POLICY.md](VERSION_POLICY.md) retains explicitly delegated authority over versioning rules. Document recency alone does not determine precedence; an approved amendment must identify the decision and scope it changes.

GitHub `main` remains the authoritative code baseline, not an independent source of product requirements. Planning documents organize scope and dependencies; they do not independently approve product or architectural changes. Historical records preserve past behavior and evidence, and candidate designs remain proposals until approved. An old roadmap or unaccepted candidate does not authorize implementation.

## Governing references for implementation work

Identify the relevant PRD requirements, approved architecture/design sections, dependency issues and any applicable approved decision records in the implementation issue. Use [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md) to distinguish deployed behavior from the approved target and locate subsystem contracts. Cite relevant sections rather than copying entire specifications.

Read these references before implementing. An issue's required behavior and acceptance criteria must remain within their approved constraints. If the issue proposes changing those constraints, resolve and record the product or architecture decision before dependent implementation proceeds; issue wording alone does not override a governing requirement. Routine implementation choices within approved constraints remain the agent's responsibility.

## Material conflicts and decision resolution

When work reveals a material conflict, ambiguity or missing product/architecture decision, the coding agent must:

1. Identify the conflict, ambiguity or missing decision.
2. Identify the authorities involved, citing the relevant requirements or sections.
3. Explain the implementation impact and which work depends on the decision.
4. Recommend a resolution when useful, clearly distinguishing a proposal from an approved decision.
5. Pause the affected portion of the work until the decision is resolved.

Independent work may continue only when it is clearly safe and cannot prejudice or complicate the unresolved decision. Routine implementation choices within approved product and architectural constraints do not require escalation.

Obtain the necessary product or architecture approval and record the resolution, its scope and approval evidence in the issue or an approved decision record. Update the governing PRD/design documentation as applicable, or link the explicitly approved amendment, and align the issue's requirements and acceptance criteria before dependent implementation proceeds. Preserve prior decisions and historical evidence; do not resolve a conflict by silently treating code, tests, issue wording or a newer document as approval.

## Permanent coding-agent invariants

All implementation tasks inherit the [permanent coding-agent invariants in AGENTS.md](../AGENTS.md#permanent-coding-agent-invariants), the canonical operational definition. Apply them during issue preparation, implementation, validation, review and acceptance; the issue need not repeat the list.

Higher-authority approved decisions may explicitly authorize scoped exceptions or transitions. Record the approval and its scope using the decision-resolution procedure above before dependent implementation proceeds. Issue wording alone does not authorize an exception. Existing detailed domain, persistence, validation and release protections remain in force.

## One issue = one implementation unit

Each implementation issue should be small enough to review and accept independently. An issue may be a feature, data-model change, migration step, UX improvement, bug, or documentation task. A product release may contain several issues; issue numbers and application version numbers are independent.

Use the [implementation issue template](../.github/ISSUE_TEMPLATE/implementation.md) as the bounded Codex work package. It connects context and an outcome-oriented objective to governing references, requirements/preservation, dependencies and exclusions, data/migration/compatibility impact, acceptance criteria, verification/reporting, documentation/release implications, decisions/readiness and inherited governance. Keep entries brief; use `None` or `Not applicable` where appropriate and link governing sections rather than duplicating them.

Give observable acceptance criteria stable identifiers (`AC-1`, `AC-2`, etc.) so review can map evidence to each result. Requirement identifiers (`R-1`, `R-2`, etc.) are useful for larger issues but are not mandatory for a single trivial requirement. State issue-specific preservation and out-of-scope boundaries without repeating the permanent repository invariants. Distinguish required prerequisite issues from related work; optional blocking/related references should add implementation or sequencing value.

Record issue readiness explicitly:

- **Ready** — required prerequisites and proposal/approval gates are satisfied and material governing decisions are resolved.
- **Waiting on dependencies** — required prerequisites remain outstanding; related work alone is not a prerequisite.
- **Needs decision** — a material governing product, architecture, data, security or compatibility decision remains unresolved.

Routine choices within approved constraints do not prevent readiness. Do not mark an issue `Ready` while a material governing decision remains unresolved or a required proposal/approval gate is pending. If uncertainty affects only bounded work, apply the existing conflict procedure before continuing any clearly safe independent work.

If discussion reveals multiple independently useful implementation units, split them into separate issues rather than expanding one issue indefinitely.

## Ordering and dependencies

Order the backlog primarily by dependency, then by user/product value. Do not encode dependency solely in version-looking issue titles. Use explicit issue references such as:

- `Depends on #16`
- `Blocks #23`
- `Independent of #22`

The V3 implementation plan groups issues into broad phases, but the issues themselves are the executable work units.

## Change levels and validation

**Change Level** is the sole numbered classification for new work. It determines minimum proposal, approval, implementation and review process. **Validation approach** identifies the actual checks and acceptance evidence appropriate to the scope; it is not a second numbered classification. All levels inherit repository invariants, the conflict procedure and existing explicit merge/Production approval gates.

### Classification and assignment

Issue authors normally assign the Change Level with a short rationale; the coding agent verifies it before implementation. Evaluate product/architectural impact, governed contracts, persisted data, compatibility, security/privacy, reversibility, blast radius and uncertainty. **Highest applicable level wins.** Apply these rules in order:

- Check Change Level 3 triggers first.
- Without those triggers, material feature/workflow/domain behavior changes are Change Level 2.
- Otherwise use Change Level 1 only for narrow, clear, reversible and contained work.

File count, line count, implementation time and apparent code simplicity do not determine classification. A one-line authorization or schema-contract change can be Change Level 3; a multi-file contained CSS fix need not be. Routine implementation choices inside approved boundaries remain agent discretion, even when several coding approaches are reasonable.

### Change Level 1 — Local / low-risk

Use for narrow, reversible corrections or maintenance with clear intended behavior and no material change to product contracts, architecture, persisted-data meaning, supported compatibility, security/privacy boundaries or foundational cross-cutting behavior. Examples include contained CSS/layout or UI presentation fixes, copy/link corrections, documentation/process corrections, isolated bugs with established intended behavior and test/documentation maintenance preserving the governed contract. This level is not restricted to documentation.

**Normal process:** Approved issue/work package → implementation → proportional verification → PR/review. A separate implementation proposal is normally unnecessary. Applicable Preview, responsive, browser or device checks still apply when required by the issue or risk.

### Change Level 2 — Feature / domain behavior

Use when work adds or materially changes user-visible, workflow or domain behavior within approved product decisions, established architecture, approved persistence/data boundaries and supported compatibility, without a Change Level 3 trigger. Examples include user-facing features, workout/session behavior, significant UI workflows, approved progression/performance logic and feature work using established persistence patterns. Multiple files alone do not make work this level.

**Normal process:** Implementation-ready issue with explicit acceptance criteria → implementation → focused risk-based verification/regression → PR/review → applicable human acceptance. A separate proposal is not automatically required when product/architecture decisions are approved and the issue is `Ready`. Material unresolved decisions invoke the conflict procedure; routine implementation choices do not.

### Change Level 3 — Architecture / data / security / high-risk

Use for material foundational-contract changes or substantial risk involving persistence architecture, schemas, persisted identity, authentication/authorization, security/provider boundaries, public/API contracts, backup/import compatibility, migrations, recovery behavior, concurrency/data integrity, destructive operations, major architectural boundaries, difficult reversibility or substantial uncertain blast radius.

Import/export work is this level when it materially affects persisted facts, restore/recovery integrity, duplicate protection or supported compatibility, even without a schema-version change. Small implementation size does not reduce those risks.

**Normal process:** Proposal/audit → recorded approval → implementation-ready issue → implementation → enhanced applicable verification → PR/review → explicit human acceptance.

The proposal addresses current state, intended end state, implementation boundaries, architecture/data/security/compatibility effects, migration implications, alternatives or meaningful tradeoffs, risks and verification strategy, as applicable. Dependent implementation waits for the relevant approval to be recorded.

### Reuse approved material

An approved design, decision issue, audit/proposal or another recorded approval recognized by repository governance can satisfy the Change Level 3 proposal/approval gate when it covers the actual implementation scope. Reference that material rather than recreating it. Do not request approval again unless scope changes, risk changes materially or existing approval does not cover the implementation. Classification alone does not require a new large proposal.

Record the assigned level/rationale and proposal/approval gate in the issue's **Decisions and readiness** section. A required pending gate prevents `Ready`. Neither a level assignment nor design approval authorizes an otherwise unapproved merge, Production operation or destructive action.

### Escalation and reclassification

The assigned level is minimum process, not permission to ignore new risk. If the classification is materially too low, before or during implementation:

- Pause affected work.
- Identify the newly discovered risk or governed contract and involved authority.
- Explain why the current level is insufficient.
- Recommend the appropriate Change Level.
- Obtain any newly required decision or approval before dependent work proceeds.

Safe independent work may continue only under the existing conflict procedure. Do not silently downgrade: lowering a level or removing an assigned control requires recorded rationale and appropriate approval. Do not escalate routine choices within approved product/architecture boundaries merely because multiple implementations are possible.

### Scope-appropriate Validation approach

Select applicable checks against acceptance criteria and affected contracts; do not run broader or more expensive suites merely by habit. The Change Level establishes minimum process and applicable verification expectations, not a mandatory bundle of every possible test:

- **Documentation-only scope:** consistency/current-versus-historical wording, Markdown/rendering, links/paths/references and confirmation that runtime/configuration/schema/Production data are unchanged. Do not run application suites, runtime Preview/device acceptance or migration tests solely for documentation changes.
- **Runtime/UI scope:** focused automated coverage where practical; relevant syntax/release/diff/regression and affected browser-console checks; Vercel Preview for user-visible runtime changes; affected desktop and narrow-phone responsive checks. Physical iPhone evidence remains required when specified by the issue/acceptance criteria; a lower Change Level does not waive applicable issue/risk-specific device checks.
- **High-risk implementation scope:** applicable full relevant regression/integration, schema/migration replay, recovery/rollback, backup and source/destination content/relationship comparisons, retry/idempotency/concurrency and authorization/isolation/security checks; Preview and required physical-device/Production gates. Preserve existing backup, disposable-data and isolation protections.

More verification alone does not raise Change Level. A Change Level 1 mobile-layout fix may still require physical-device evidence. A Change Level 3 architecture-only proposal needs design/decision evidence rather than migration tests when no implementation exists. Discovering foundational risk can require escalation before additional checks are defined. Responsive Chromium does not prove physical Safari behavior; record actual device/build/commit/results when required, otherwise report unverified evidence explicitly.

Automatic CI is supporting evidence, not a command to manually repeat unrelated suites. Report the assigned Change Level, Validation approach, actual checks/results and anything required but unverified, using the issue's AC-to-evidence mapping.

### Historical terminology

The former numbered validation levels are retired for new work. Existing labels in historical issues, PRs, releases, subsystem evidence and acceptance records remain valid descriptions of the verification performed at that time. Do not rewrite or retroactively reclassify those records merely to adopt this terminology. New Change Level 1 intentionally includes contained runtime/UI work; it does not mean every earlier UI change should be relabeled.

## Codex execution contract

A Codex implementation request follows the hierarchy and conflict procedure above:

> Start from current accepted `main`. Read `AGENTS.md`, `README.md`, `docs/GymBro_PRD.md`, `docs/CURRENT_ARCHITECTURE.md`, this workflow, the target issue, and its governing references and dependency issues/documents. Verify the assigned Change Level and rationale and satisfy required proposal/approval gates. Implement only the target issue within approved product and architectural constraints. Preserve existing behavior and historical data unless the issue explicitly changes them within those constraints. Apply the conflict procedure before dependent implementation when a material conflict, ambiguity or missing decision is discovered. Use the existing repository, checkout, Vercel project, and approved architecture. Create a focused branch and pull request. Link the PR to the issue. Define a scope-appropriate Validation approach, perform applicable checks and report evidence. Do not merge or change Production data without explicit user approval.

The issue body should contain the product-specific prompt. A separate giant Codex prompt should normally be unnecessary.

## Pull requests and acceptance

Each implementation PR should:

- reference the issue it implements (`Closes #N` only when closure on accepted merge is appropriate; otherwise `Implements #N`);
- avoid unrelated cleanup or scope expansion;
- state user-visible behavior changes and preserved behavior;
- state data/schema/migration implications;
- identify the assigned Change Level and Validation approach and list tests/manual checks actually performed;
- identify anything required but not tested, especially physical iPhone behavior;
- include Preview evidence when the issue, affected runtime scope or risk requires it;
- remain unmerged until explicit user approval.

The completion report must identify branch, commit, PR, exact files changed, a concise implementation summary, data/schema impact, documentation changes, assigned Change Level, Validation approach and actual checks/results, deviations, unresolved risks, unverified criteria and required human acceptance. Include actual Preview/browser/device evidence when applicable. Map every criterion by its stable identifier: `AC-1 → verification method/evidence → PASS / FAIL / UNVERIFIED`. Unverified criteria must be explicit; code existing or unrelated checks passing do not establish verification.

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
- `AGENTS.md` — concise operational repository rules Codex must follow; this workflow provides the fuller governance explanation.
- `docs/README.md` — map of current versus historical documentation.
- `docs/GymBro_PRD.md` — product authority and North Star, including explicitly approved amendments evidenced in linked decision records.
- `docs/CURRENT_ARCHITECTURE.md` — deployed V2 versus approved V3 target architecture.
- `docs/V3_IMPLEMENTATION_PLAN.md` — ordered V3 phase/backlog view and dependencies.
- `docs/RELEASE_HISTORY.md` — accepted shipped releases and evidence.
- `docs/VERSION_POLICY.md` — application-version semantics and approved issue-to-release mappings; `app-version.js` remains the canonical build source.
- milestone/architecture documents — historical or subsystem-specific contracts; retain their historical context rather than rewriting the past.

When an issue changes a cross-cutting contract, update the relevant durable document in the same PR. Do not duplicate the full issue body into several documents.
