# GymBro documentation map

This directory contains both **current authorities** and **historical milestone records**. Historical documents are intentionally retained because they describe accepted behavior, migration contracts, and release evidence at the time they were created. They are not automatically current roadmap authority.

## Read first for current work

1. [GymBro_PRD.md](GymBro_PRD.md) — product vision, product constraints, and North Star. When older scheduling/hosting statements conflict with the approved V3 transition below, the newer approved transition decisions govern.
2. [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md) — approved V3 cloud-transition decisions and gates.
3. [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md) — current deployed V2 architecture versus approved V3 target architecture.
4. [V3_IMPLEMENTATION_PLAN.md](V3_IMPLEMENTATION_PLAN.md) — ordered V3 issue/backlog view.
5. [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) — issue-driven Chat → issue → Codex PR → acceptance workflow.
6. Root [AGENTS.md](../AGENTS.md) — mandatory repository/Codex rules.
7. Root [README.md](../README.md) — concise current product/run/data summary.

For application numbering and release mapping, use [VERSION_POLICY.md](VERSION_POLICY.md), the issue #43 decision. It supersedes older milestone-to-minor wording; `app-version.js` remains the canonical application-version source.

For new implementation work, the **target GitHub issue is the executable specification**. Documents provide durable cross-cutting rules and context; a roadmap paragraph alone does not authorize implementation.

## Current subsystem contracts

- [NOTE_SCOPES.md](NOTE_SCOPES.md) — #25 schema-8 session/exercise-occurrence/setup/set notes, conservative compatibility, canonical projection and downstream relational contract.

- [EXERCISE_IDENTITY.md](EXERCISE_IDENTITY.md) — #16 canonical IDs/aliases, lossless V2 conversion, SQL ownership/constraints and downstream #39/#28 boundary.

- [V3_INFRASTRUCTURE.md](V3_INFRASTRUCTURE.md) — #38 environment inventory, Vercel variable contract, migrations, disposable replay, promotion and recovery.
- [V3_RELEASE.md](V3_RELEASE.md) — current V3 candidate and actual acceptance evidence; not a Production release declaration.

These remain relevant to the deployed V2 baseline and must be preserved or deliberately migrated by V3 issues:

- [GUIDED_WORKOUTS.md](GUIDED_WORKOUTS.md) — guided-workout state/action contracts.
- [TRAINER_EVIDENCE.md](TRAINER_EVIDENCE.md) — deterministic read-only performance/trainer evidence contract.
- [HISTORY_AND_BACKUPS.md](HISTORY_AND_BACKUPS.md) — historical Milestone 3 History/backup behavior that remains part of the V2 baseline unless a later issue changes presentation.
- [CHATGPT_IMPORT_SCHEMA.md](CHATGPT_IMPORT_SCHEMA.md) — current reviewed JSON interchange contract.
- [REAL_PHONE_SMOKE_TEST.md](REAL_PHONE_SMOKE_TEST.md) — physical-device acceptance checklist/evidence.
- [SUPABASE_CONNECTION_TEST.md](SUPABASE_CONNECTION_TEST.md) — limited diagnostic checkpoint; not evidence of completed workout migration.

## Historical architecture/release records

Read these for provenance, accepted past behavior, and migration constraints. Do not treat old future-roadmap language inside them as current implementation authority:

- [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)
- [V2_RELEASE.md](V2_RELEASE.md)
- [PRD_COMPLIANCE.md](PRD_COMPLIANCE.md)
- [PRODUCTION_DELIVERY.md](PRODUCTION_DELIVERY.md)
- [IPHONE_HARDENING.md](IPHONE_HARDENING.md)
- [WORKOUT_SESSIONS.md](WORKOUT_SESSIONS.md)
- [WORKOUT_ACTIONS.md](WORKOUT_ACTIONS.md)
- [RELEASE_HISTORY.md](RELEASE_HISTORY.md)
- [CHANGELOG.md](CHANGELOG.md)

Historical documents may correctly say that localStorage was authoritative, that cloud persistence was not yet implemented, or that a feature was not in that milestone. Those statements describe that historical baseline. For **current direction**, use the read-first hierarchy above.

## V3 issue families

The current V3 backlog is intentionally issue-driven rather than encoded as a long sequence of prose-only milestones.

Foundation/database work includes issues #27–#29 plus exercise identity issue #16. Core data/product work includes exercise/catalog/import issues #17–#18, History/UI issues #20–#26, note semantics #25, and live-workout adaptation #30. Release acceptance is issue #31.

External AI/provider integration, conversational automatic logging, adaptive AI coaching, and voice are deferred beyond V3.x completion unless a later explicit product decision changes that boundary.
## Issue #27 account candidate

[V3_ACCOUNT_ACCESS.md](V3_ACCOUNT_ACCESS.md) defines Preview email-link recovery, private ownership requirements for #39, setup and pending acceptance evidence. Local workout schema remains 7.
