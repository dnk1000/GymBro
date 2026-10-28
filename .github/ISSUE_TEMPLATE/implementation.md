---
name: Implementation issue
description: Codex-ready GymBro feature, architecture, data, UX, migration, bug, or documentation work
title: ""
labels: ""
assignees: ""
---

## Purpose / problem

Describe the user or architectural problem this issue solves.

## Governing references / unresolved decisions

Cite relevant sections; keep references brief and state `none` where applicable.

- Product requirements: `docs/GymBro_PRD.md` section(s) and applicable approved decision records.
- Approved architecture/design: document(s) and section(s).
- Known unresolved decisions: none / decision needed and affected work.

## Required behavior

- 

## Acceptance criteria

- [ ] 

## Dependencies

- Depends on: none / #
- Blocks: none / #
- Independent of: #

## Non-goals / exclusions

- 

## Data / migration impact

State `none` or describe schema, identity, migration, import/export, backup, compatibility, rollback, and historical-data requirements.

## Validation level

Choose the lowest level that fully covers the risk of this issue. Do not run broader or more expensive validation merely by habit.

- [ ] **Level 1 — Documentation/process only:** verify changed-document consistency, Markdown/rendering where relevant, links/paths/references, issue numbers/names, and confirm no runtime/schema behavior changed. Full application regression and device testing are not required unless the documentation change also changes executable configuration/code.
- [ ] **Level 2 — UI/behavioral:** run focused automated coverage where practical, relevant regression/syntax checks, Vercel Preview for user-visible runtime changes, and affected desktop/narrow-phone checks. Physical iPhone evidence is required only when the issue/acceptance criteria call for it.
- [ ] **Level 3 — Data/infrastructure/high-risk:** run the applicable full regression/integration/migration/recovery/security/concurrency checks, Preview evidence, backup/data comparisons, and physical-device/Production gates required by the issue.

## Testing / evidence

List the checks actually required by the selected validation level and the issue's acceptance criteria. Explicitly record anything required but not tested. Automatic CI may run additional checks; that does not mean Codex must manually repeat unrelated suites.

- [ ] Required focused checks completed
- [ ] Required Preview/device checks completed or explicitly recorded as not required/not tested
- [ ] Required data/migration/backup/recovery checks completed where applicable

## Release notes

State the user-visible change, or `none` for internal/documentation-only work.

## Codex execution contract

This issue inherits all repository agent invariants in `AGENTS.md`.

Start from current accepted `main`. Read `AGENTS.md`, `README.md`, `docs/GymBro_PRD.md`, `docs/CURRENT_ARCHITECTURE.md`, `docs/DEVELOPMENT_WORKFLOW.md`, this issue, and its governing references and dependency issues/documents. Inherit the repository hierarchy and conflict procedure defined in `AGENTS.md` and `docs/DEVELOPMENT_WORKFLOW.md`: PRD → approved architecture/design → approved implementation issue → code/tests as implemented state. This issue may clarify implementation details within approved constraints, but cannot silently redefine product requirements or approved architecture. Material conflicts, ambiguities or missing decisions require the prescribed explanation, pause of affected work and recorded resolution before dependent implementation proceeds; routine choices within approved constraints need no escalation.

Implement only this issue; preserve existing behavior and historical data unless it explicitly changes them within approved constraints. Use the existing repository, checkout, Vercel project, and approved architecture. Create a focused branch and pull request that references this issue. Select the lowest risk-based validation level that fully covers the issue and its acceptance criteria, run only the applicable validation, and report actual evidence. Do not merge or change Production data without explicit user approval.
