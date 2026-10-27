# Draft prompt — V3 M1 recoverable access and private ownership

Recommended development model from the planning baseline: GPT-6 Astra, high reasoning. This is a prompt for a separately requested future task; saving or merging this document does not execute it.

---

Complete GymBro V3 Milestone 1: Recoverable user access and private data ownership, limited to Preview.

Continue in the existing Windows checkout at `C:\Users\David.Katz\OneDrive - NovaTech LLC\Documents\ChatGPT\GymBro`, the existing `dnk1000/GymBro` repository and existing Vercel `gymbro` project. Preserve all uncommitted work. Do not create another development environment or revive the abandoned PR #9 implementation.

## Establish the accepted baseline

Inspect git status, fetch origin/main and read AGENTS.md, README.md, docs/V3_M0_SCOPE_AND_ACCEPTANCE.md, docs/GymBro_PRD.md, docs/CHATGPT_IMPORT_SCHEMA.md, docs/SUPABASE_CONNECTION_TEST.md and the affected source/tests. Read docs/V3_IMPLEMENTATION_PLAN.md if it has been accepted into main; otherwise use M0's pinned proposal reference as context only.

Confirm the M0 acceptance record has been accepted into main before implementing this milestone. Do not merge a pending PR automatically or treat its proposed contents as accepted main. Start a dedicated `v3/milestone-1-recoverable-access` branch from the current accepted main. Refresh the actual app version, schema, CI and deployment evidence instead of assuming the older M0 SHA is still current.

## Approved scope and carried decisions

The user approved cloud persistence as the first V3 phase; recoverable personal sign-in; private ownership without sharing/teams; isolated Preview testing; eventual Supabase-only workout persistence after verified cutover; browser storage for sign-in/preferences; retention of the old workout copy until deliberate cleanup; connectivity-required cloud saves; and `3.N.PATCH-BUILD` versioning.

Physical-iPhone and verified personal Production JSON-backup evidence is explicitly deferred through this Preview-only M1 work and required before M2 migration testing. Do not re-ask for the approved deferral or mark missing evidence passed. Use disposable Preview identities/data only. Preserve the current local workout database and all existing features throughout M1.

## Deliverable

Provide a simple, recoverable sign-in/sign-out experience suitable for iPhone. The same personal user must regain the same account from another browser/device and after sign-out. The existing anonymous diagnostic identity is not the long-term account solution.

Choose a narrowly scoped implementation using the existing project. If the actual sign-in/recovery experience requires an unresolved user choice, present a concise recommendation and ask only for that choice while continuing independent work. Do not infer consent to add multiple providers, onboarding questionnaires, team features or a general account-management product.

Keep account functionality explicitly limited to Preview. Production must retain existing standalone behavior. Preserve the existing authentication protection of Vercel Previews. Do not change Production configuration, expose secrets, run live workout migrations or alter the user's actual workout data. If a necessary Preview setup action lacks authorization or requires the user's credentials, prepare concrete steps and identify the exact action needed; do not request secret values in chat.

## Required behavior

- Sign in, sign out, regain access and identify which account is active without disrupting current workout controls.
- Verify returning to the same account after reload, browser closure and a second-device/browser sign-in.
- Handle invalid/expired sign-in, failed recovery, cancelled sign-in, network failure and expired sessions clearly. Failure must preserve local workouts and unsaved workout input where the existing workflow promises it.
- Sign-out must not delete workout localStorage, personal backups or the legacy anonymous diagnostic record. Show no previous user's private account test data after account switching.
- Verify one test identity cannot read or change another's private disposable, non-workout test data. Inspecting only the UI is insufficient evidence of isolation.
- Keep Preview test data separate from actual Production workout data. This milestone does not associate, upload, synchronize or migrate browser workouts to an account; explain that boundary in the acceptance instructions so switching accounts is not mistaken for switching local workout datasets.
- Preserve manual logging, guided sessions, History, program/preferences, bodyweight, imports, backups and the existing diagnostic boundaries.

## Explicit exclusions

No M2 migration, workout cloud persistence, local-storage retirement, offline logging, schema changes to workout data, trainer/voice integration, exercise reordering, duration adaptation, unrelated UI redesign, framework rewrite, new environment or Production rollout. Do not modify the archived integration branches.

## Version and documentation

Use application version `3.1.0-BUILD` for the first deployable M1 code build, with the committed UTC build convention; fixes increment PATCH. Update canonical release validation and necessary version assertions without weakening unrelated checks. Keep workout data schema 7 unless the user separately approves a justified change; no such change is planned here.

Update user Help only for the user-facing account behavior actually introduced. Keep setup and Preview acceptance instructions in project documentation, including exact manual verification steps that do not expose secrets. Distinguish Preview capability from Production availability and from future workout migration.

## Acceptance and delivery

Run the existing relevant checks and complete regression suite. Add meaningful tests for recovery/session behavior, isolation, error cases and protection of existing local workouts. Verify actual Preview sign-in/recovery with disposable identities when the user-controlled verification step is available; distinguish mocked tests from live outcomes. Record unavailable human/device steps as pending.

Manual acceptance must cover account A signing in, reload/reopen, sign-out, recovery, a second browser/device returning to A, account B's isolation, failure states, Production feature gating, and existing local workout/import/export behavior. Do not claim physical Safari acceptance from Chromium emulation.

Commit, push and open a PR against main. Report the branch, exact commit, test outcomes, PR link, actual Vercel Preview status/link, setup actions and remaining manual checks. Do not merge without explicit user approval. Do not change Production. Do not begin M2.

At completion, state whether M1 acceptance is complete and list the physical-iPhone/personal-backup gates that must be satisfied before M2 migration testing. If account recovery or user isolation remains unverified, leave M1 acceptance pending rather than treating a successful connection probe as proof.
