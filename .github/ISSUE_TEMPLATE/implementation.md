---
name: Implementation issue
description: Codex-ready GymBro feature, architecture, data, UX, migration, bug, or documentation work
title: ""
labels: ""
assignees: ""
---

Use a concise, outcome-oriented GitHub title. Preserve meaningful established capability/milestone labels; they do not assign application versions.

Keep entries brief. Use `None` or `Not applicable` where appropriate, and link specific governing sections instead of copying them.

## Context and objective

- **Context:** Why this work exists and which approved problem or decision led to it.
- **Objective:** The observable end condition this issue should achieve.

## Governing references

- **Product:** Relevant `docs/GymBro_PRD.md` sections and approved product decision records. Explicitly state when no product behavior changes.
- **Architecture / technical contracts:** Relevant documents and sections, or `Not applicable`.

## Requirements and preservation

- Required outcomes: Specific, bounded and testable where practical. Use `R-1`, `R-2`, etc. where useful; a single trivial requirement needs no identifier. Prescribe code structure only when approved architecture requires it.
- Issue-specific preservation: Additional things that must remain unchanged, or `None`. Do not repeat the permanent repository invariants.

## Dependencies and out of scope

- **Depends on:** Required prerequisite issue(s), or `None`.
- **Blocks / related issues (optional):** Include only when useful; distinguish related work from true prerequisites.
- **Out of scope:** Adjacent work this issue must not absorb.

## Data, migration and compatibility

`None`, or describe affected persisted data, schemas or interfaces; migration and supported compatibility expectations; failure/retry behavior; backup/recovery implications; rollout/rollback behavior and required approval gates. Do not imply compatibility beyond what GymBro supports.

## Acceptance criteria

- [ ] AC-1: Observable outcome proving the required result.
- [ ] AC-2: Additional observable outcome, where needed.

Keep identifiers stable so completion evidence can reference them. Implementation activity alone does not prove completion.

## Verification and completion report

**Validation level:** Select 1 / 2 / 3 under `docs/DEVELOPMENT_WORKFLOW.md` with a brief risk-based rationale. Do not require full regression, Preview or device testing by default.

**Required checks:** Specify known test/fixture, Preview, browser/device, migration or other evidence requirements. Otherwise let the agent select a proportionate verification mechanism for each criterion.

**Completion report:** Return branch, commit, PR, exact files changed and a concise implementation summary; selected validation level, actual checks/results and applicable Preview/browser/device evidence; data/schema impact, documentation changes, deviations, unresolved risks, unverified criteria and anything requiring human acceptance.

Map every acceptance criterion to actual evidence:

`AC-1 → verification method/evidence → PASS / FAIL / UNVERIFIED`

Report unverified criteria explicitly. Do not infer verification merely because code exists or unrelated checks passed.

## Documentation and release notes

- **Documentation:** Owning documents that must change, or `None`. Avoid churn when no documented contract, behavior, setup or operational assumption changes.
- **Release notes / version impact:** `None`, or the user-visible change and applicable approved release mapping. Follow `docs/VERSION_POLICY.md`; issue numbers, labels and sequencing do not independently assign application versions.

## Decisions and readiness

- **Approved decisions:** Implementation-relevant approval references, or `None`.
- **Material unresolved decisions:** `None`, or the decision needed and affected work.
- **Implementation discretion:** Bounded uncertainty the agent may resolve within approved constraints, or `None`.
- **Readiness:** `Ready` / `Waiting on dependencies` / `Needs decision`.

Do not mark `Ready` while a material governing product, architecture, data, security or compatibility decision remains unresolved. Routine choices within approved boundaries do not prevent readiness. If a decision affects only a bounded portion, follow the repository conflict procedure for affected and independent work.

## Codex execution contract

This issue inherits all repository agent invariants in `AGENTS.md`.

It also inherits the repository source-of-truth hierarchy and the conflict procedure in `docs/DEVELOPMENT_WORKFLOW.md`. Read governing references and dependencies before implementation; implement only approved issue scope. Escalate material unresolved decisions under that procedure and provide acceptance evidence before claiming completion.
