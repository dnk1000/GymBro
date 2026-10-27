# GymBro V3.x implementation plan

Status: revised product direction, October 27, 2026. This document is the implementation-planning authority for the V3.x family, subject to review/merge. Individual milestones still require explicit implementation authorization.

## Baseline and authority

Continue the existing `dnk1000/GymBro` repository, checkout and Vercel project from accepted `main`. Do not revive abandoned PR #9 or create a parallel application/runtime authority.

Sources: [PRD](GymBro_PRD.md), [M0 scope and acceptance](V3_M0_SCOPE_AND_ACCEPTANCE.md), [compliance audit](PRD_COMPLIANCE.md), [release record](V2_RELEASE.md), [physical-phone acceptance](REAL_PHONE_SMOKE_TEST.md), [Supabase checkpoint](SUPABASE_CONNECTION_TEST.md), root [README](../README.md) and [project rules](../AGENTS.md).

The October 27 M0 decision approved staged cloud persistence as the first V3 phase. This revision sharpens that direction: **V3.x is primarily the persistent-data and core-product-maturity generation, not the AI-integration generation.** The mature conversational trainer remains a product North Star, but provider/runtime AI and voice are deferred until GymBro's data model, database migration, exercise identity, catalog management, import resolution and remaining core workout behavior are stable.

This sequencing avoids exposing unstable identifiers and incomplete domain behavior to an AI/provider boundary and avoids performing a database migration twice.

## V3.x product principle

V3.x should make GymBro a trustworthy system of record first.

The V3.x family should establish:

- recoverable user access and private data ownership;
- Supabase/PostgreSQL as the eventual sole active workout store after controlled cutover;
- complete verified migration from the V2 local dataset;
- stable canonical exercise identity independent of display labels;
- maintainable exercise catalog metadata, aliases and duplicate merging;
- robust import resolution for unknown/variant exercise names;
- durable cross-device workout/session state;
- completion of known live-workout adaptation gaps;
- preservation of existing JSON backup/import/export and historical truth;
- clear domain boundaries that a future trainer can safely consume.

External AI/provider integration, conversational workout control and voice are **not required for V3.x completion**. They should begin only after a separate post-V3 product decision confirms that the core platform is mature enough to expose.

## Exercise identity rule

GymBro owns exercise identity.

External providers, imports and users may supply exercise labels, but provider-supplied/free-text names must not become persistent identity keys. Canonical exercises use immutable internal identifiers. Aliases may resolve alternate labels to canonical identity. Historical/import provenance should retain the original supplied label where practical.

Template/session role (`core`, `accessory`, `substitute`, order, short-workout inclusion and similar contextual properties) belongs to the workout/template relationship rather than being treated solely as an intrinsic exercise property.

Migration must be conservative: deterministic known mappings may resolve automatically, but fuzzy semantic similarity must not silently merge historical exercises.

## Version-label note

The previously approved M0 version mapping used M1 -> `3.1.0-BUILD`, M2 -> `3.2.0-BUILD`, etc. The newly approved capability names also use `V3.0`, `V3.1` and `V3.2`. Until release numbering is explicitly remapped, this plan uses the requested `V3.0/V3.1/V3.2` labels as **capability phases**, not automatic application-version assignments. Do not create two meanings for the same shipped version number. Resolve the concrete app-version mapping before the first affected release.

## Sequencing overview

### Foundation track — cloud persistence

The existing M0 cloud-persistence decisions remain valid: recoverable access, complete Preview migration, controlled Production cutover, connectivity-required durable saves initially, Preview/Production separation, no indefinite dual writes and no automatic local-only fallback after cutover.

### Exercise-data track

Exercise identity architecture must be incorporated into the database schema/migration before the V2 dataset is treated as fully migrated. Catalog management and smart import resolution build on that identity model.

### Core workout-completion track

After stable persistence and exercise identity, complete the known workout-adaptation gaps and any other core product gaps discovered through real use before integrating an AI runtime.

### Future trainer generation

Trainer/provider integration, natural-language control, adaptive AI coaching and voice move to a later separately approved generation. V3 may prepare clean domain contracts for them, but does not need to implement them.

## Milestones / capability phases

### M0 — Scope and baseline acceptance

Status: decision work complete; see [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md).

Outcome: approved cloud-persistence-first direction, connectivity behavior, migration gates, storage-retirement boundaries and Preview/Production separation.

The new V3.x direction in this document supersedes the old assumption that later M5-M9 AI/trainer milestones are part of V3 completion.

### M1 — Recoverable user access and private data ownership

Outcome: the same person can access their own GymBro account from another browser/device without moving personal workout history yet.

- Simple sign-in/sign-out/recovery suitable for iPhone.
- User isolation and Preview/Production separation.
- Existing V2 workout behavior preserved while account access is tested.
- No personal workout migration merely by opening Preview.

Acceptance: repeatable account recovery and second-device access; one test user cannot read/change another's data; Preview does not touch Production workout data.

### V3.0 — Exercise Identity Architecture — Issue #16

Issue: https://github.com/dnk1000/GymBro/issues/16

Outcome: stable exercise identity is part of the V3 database model before complete workout migration is accepted.

Requirements:

- immutable internal `exercise_id` or equivalent;
- canonical display name and structured exercise metadata;
- normalized aliases to canonical identity;
- logged sets/workout records reference stable exercise identity rather than name text;
- workout-template entries reference stable exercise identity;
- preserve original imported/logged label where practical for provenance;
- support primary muscle/category, secondary muscles where modeled, equipment/type, active/archive state and provenance;
- keep contextual template/session role separate from intrinsic exercise identity;
- domain/API boundaries use stable identity;
- external/imported labels are suggestions, not identity keys.

Migration rules:

- incorporate this model into the main V3 database migration rather than correcting identity after cutover;
- preserve all historical workout facts and relationships;
- no fuzzy automatic historical merges;
- explicit/deterministic known mappings may resolve safely;
- ambiguous existing labels remain separate until user-reviewed merge.

Acceptance: renames do not break history; alternate labels can resolve to one canonical exercise; migration preserves complete data and provenance; no silent fuzzy collapse of distinct exercises.

### M2 — Full workout persistence and migration on Preview

Depends on M1 and V3.0 exercise identity architecture. Outcome: a deliberate test copy of the complete existing dataset operates through Supabase with existing GymBro behavior intact.

- Migrate explicitly selected local data or a verified complete backup.
- Preserve sets, bodyweight, program, exercise catalog/identity, preferences, imports/duplicate protection, sessions, snapshots, active guidance, request history, IDs, dates, units, notes, pain and completeness.
- Exercise every persisted workflow: manual/guided logging, edits/deletes, program/catalog/preferences, bodyweight, session recovery, imports, restore, history merge and exports.
- Compare content and relationships, not just counts.
- Repeated/interrupted migration must not duplicate records or destroy destination data.
- Test rejected writes, connection loss, retries, expired access, stale views and simultaneous-device changes.
- Preserve existing JSON interchange/backward compatibility unless an explicit schema decision changes it.

Acceptance: complete comparison passes; active workout survives reload/second-device access; failed saves preserve visible input and committed data; exercise references resolve through stable identity; no live Production migration yet.

### M3 — Controlled cutover and local workout-storage retirement

Depends on accepted M2 and explicit rollout approval. Outcome: Supabase/PostgreSQL is the sole active workout store.

- Rehearse cutover/recovery with disposable data.
- Verify retained backup and cloud dataset before ending local workout reads/writes.
- Remove supported local-only workout mode and automatic local fallback.
- Fresh browser works without legacy workout keys after sign-in.
- Cloud load failure must not appear as an empty account or trigger reseeding.
- Retain inactive legacy copy only as explicitly approved recovery material until deliberate cleanup.
- Define recovery for post-cutover cloud writes.

Acceptance: normal workout workflows use cloud data; cross-device changes are durable/visible; approved Production smoke and physical-iPhone evidence are recorded.

### V3.1 — Exercise Catalog Management — Issue #17

Issue: https://github.com/dnk1000/GymBro/issues/17

Depends on V3.0 stable exercise identity. Outcome: the canonical exercise catalog can be safely maintained without corrupting historical performance.

Requirements:

- edit canonical display name without changing identity;
- edit structured metadata such as primary/secondary muscles and equipment/type;
- manage aliases;
- archive/restore exercises instead of destructive deletion where history exists;
- user-driven Merge Exercises workflow;
- merged-away names can remain aliases;
- preserve merge/audit provenance;
- conservative possible-duplicate suggestions requiring explicit user action;
- preserve all historical sets/session/template relationships and recorded facts.

Acceptance: rename preserves history; metadata edits do not rewrite workout facts; duplicate exercises can be intentionally merged without lost/duplicated sets; archived exercises remain valid in history.

### V3.2 — Smart Import Resolution — Issue #18

Issue: https://github.com/dnk1000/GymBro/issues/18

Depends on V3.0 and should reuse V3.1 catalog operations. Outcome: imports no longer create accidental duplicate exercises merely because labels vary.

Resolution paths:

1. exact canonical match -> automatic import;
2. explicit alias match -> automatic canonical mapping, reported in summary;
3. unknown/ambiguous label -> user review before commit.

For unresolved names, allow selecting an existing exercise or creating a new canonical exercise. When the user intentionally maps an incoming label to an existing exercise, remember that mapping as an alias.

Provide an import preview showing known matches, alias mappings, unresolved names and new exercises to be created.

Fuzzy/semantic similarity may suggest possible matches but must not silently merge related-but-distinct exercises.

Acceptance: variant labels can resolve without duplicate history; saved aliases prevent repeated prompts; new exercises can be created intentionally; ambiguous matches require user choice; retries remain duplicate-safe; JSON compatibility is preserved or changed only through explicit schema/versioning approval.

### M4 — Complete live-workout adaptation

Outcome: close the two known V2 functional gaps after persistence is stable.

- Persist temporary exercise reordering during an active workout.
- Persist changes to remaining plan/duration during an active workout.
- Preserve original intent, completed sets, actual substitutions and permanent templates unless separately edited.
- Retain explicit skip, finish, manual fallback and clear remaining-workout state.

Acceptance: start a 60-minute workout, log sets, shorten remaining session, reorder an occupied exercise, substitute another, reload and verify original context plus actual performance.

### M5 — Core V3.x completeness review

Outcome: decide whether GymBro's non-AI product foundation is mature enough to close V3.x and become the basis for the future trainer generation.

Review at minimum:

- account recovery and user isolation;
- complete historical migration and database integrity;
- local workout-store retirement;
- cross-device session behavior;
- canonical exercise identity;
- catalog editing/aliases/merge;
- smart import resolution;
- workout adaptation/reordering;
- History, corrections, backup/restore and exports;
- physical iPhone acceptance;
- remaining product gaps discovered through real use.

Acceptance: V3.x is supportable as a complete manual/guided workout product and trustworthy system of record without requiring any AI/provider runtime.

## Explicitly deferred beyond V3.x

The following are valuable future directions but are not V3.x completion criteria:

- external AI/provider runtime integration;
- ChatGPT/Claude/provider connection UX;
- conversational natural-language workout control;
- automatic logging from provider conversation;
- AI-generated/adaptive program evolution;
- provider-specific authorization boundary beyond what is required by the future integration design;
- voice/earbud workout control;
- GymBro-hosted open-weight AI.

Before starting that generation, define a new product/architecture plan against the stable V3 database and domain actions. The future trainer should consume GymBro's canonical identities and factual records rather than create its own parallel taxonomy or state.

## Boundaries for future milestone prompts

Each implementation prompt must identify:

- current accepted `main` revision;
- approved milestone/capability and dependencies;
- concrete user-visible behavior;
- preserved behavior/data;
- explicit exclusions;
- migration/recovery behavior where relevant;
- acceptance scenarios;
- automated/manual verification;
- required branch, PR and Vercel Preview evidence.

Use the existing repository/project. Keep each milestone independently reviewable. No unsolicited UI redesign, framework rewrite, social features, nutrition ecosystem or generalized health record. No merge or Production data change without applicable user approval.

## Product rationale

AI integration becomes substantially safer and more useful after GymBro has stable database-backed identity and reliable core behavior. A future trainer should be able to reason over one canonical `exercise_id`, one authoritative workout/session state and one durable historical record even when humans or providers use different labels such as `Rope Triceps Pressdown`, `Rope Triceps Pushdown` or `Cable Rope Pushdown`.

The desired ordering is therefore:

**make the data trustworthy -> make the product complete -> expose it to AI.**
