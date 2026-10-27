# GymBro V3.x implementation plan

Status: current V3 planning authority, October 27, 2026. V3.x is the **persistent-data and core-product-maturity generation**. Individual implementation work is authorized and executed through GitHub issues, not by this document alone.

## Product direction

The October 27 M0 decision approved staged cloud persistence. Subsequent product review refined the generation boundary:

> **Make the data trustworthy → make the core product complete → expose it to AI later.**

V3.x is therefore not the external-AI-integration generation. The mature conversational trainer remains the North Star, but provider/runtime AI, conversational automatic logging, adaptive AI coaching and voice are deferred until GymBro has a stable database-backed system of record and mature core domain behavior.

Current deployed V2 remains localStorage-based until controlled cutover is accepted. See [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md) and [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md).

## Planning model

GymBro now uses an issue-driven workflow. The roadmap groups work by phase/dependency; **the GitHub issue is the executable implementation specification**.

Issue numbers do not equal application versions. A release may contain one or several accepted issues. Dependencies should be expressed explicitly in issue bodies rather than inferred from version-looking names.

See [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## V3.x completion definition

V3.x should establish a trustworthy manual/guided product and durable system of record with:

- recoverable personal access and private data ownership;
- verified Supabase/PostgreSQL workout persistence;
- controlled retirement of localStorage as the active workout database;
- stable canonical exercise identity;
- maintainable exercise catalog, aliases, archive/merge behavior;
- robust import resolution for variant/unknown exercise labels;
- correct note/data semantics;
- usable long-term History and exercise-centric navigation;
- preserved corrections, backup/restore, imports/exports and historical truth;
- complete live-workout reordering/duration adaptation;
- documented physical iPhone and Production acceptance.

External AI/provider runtime integration is not required for V3.x completion.

## Ordered backlog

The order below is a recommended dependency/value order. Independent UI issues may be pulled earlier when they do not destabilize migration work.

### Phase A — Foundation and identity

**#27 — V3 Foundation: Recoverable User Access and Private Data Ownership**

Establish sign-in/sign-out/recovery, user isolation and Preview/Production separation without migrating personal workout history yet.

**#16 — V3.0: Exercise Identity Architecture**

Establish immutable canonical exercise IDs, aliases/provenance and the separation between intrinsic exercise metadata and contextual template/session role. This must be reflected in the database migration before the V2 dataset is considered fully migrated.

**#25 — Data Model: Distinguish Session, Exercise, and Set Notes**

Resolve note scope before the database model is finalized. Existing historical text must be preserved conservatively; do not guess old note scope.

Recommended dependency: #27 and #16 may proceed as separate foundation tracks, but #16 and #25 should be settled before #28 accepts the final migrated workout model.

### Phase B — Preview database migration

**#28 — V3 Foundation: Full Workout Persistence and Preview Migration**

Depends on #27 and #16 and incorporates the approved V3 data model. Move a deliberate test copy of the complete dataset to Supabase/PostgreSQL on Preview, exercise all persisted workflows, compare data/relationships, and prove retry/failure safety. Required personal-backup/physical-evidence gates from M0 apply before personal migration testing.

### Phase C — Production cutover

**#29 — V3 Foundation: Controlled Production Cutover and Local Workout-Storage Retirement**

Depends on accepted #28 and explicit Production rollout approval. After cutover, Supabase/PostgreSQL becomes the sole active workout store. No indefinite dual writes or automatic local-only workout fallback. Retain the legacy local copy only as deliberately managed recovery material until cleanup is separately approved.

### Phase D — Exercise/catalog/import maturity

**#17 — V3.1: Exercise Catalog Management**

Depends on #16. Provide canonical metadata editing, aliases, archive/restore, conservative duplicate detection and explicit Merge Exercises behavior without rewriting historical workout facts.

**#18 — V3.2: Smart Import Resolution**

Depends on #16 and should reuse #17 catalog operations. Exact canonical/alias matches may map automatically; unknown/ambiguous labels require review. Intentional mappings become remembered aliases. Fuzzy similarity is suggestion-only unless an explicit deterministic rule is approved.

### Phase E — History and exercise usability

These are core-product-maturity issues. Some can be implemented independently before database cutover; where practical, prefer stable exercise IDs for exercise-centric features.

**#20 — History: Collapsible Workout Sessions**

Collapsed-by-default session/date cards with summaries and Expand/Collapse All. Presentation only; no historical mutation.

**#21 — History: Group Sets by Exercise with Progressive Disclosure**

Within an expanded session, show exercise-level summaries before individual set rows while preserving actual sequence and corrections.

**#22 — History: Search and Filters**

Exercise/workout/date filtering, with optional reliable pain/discomfort filtering. Canonical exercise identity improves correctness.

**#23 — Exercise: Detail and Performance History View**

Depends on #16. One canonical exercise should have one navigable longitudinal history, including relevant setup metadata, pain context and deterministic performance context.

**#24 — History: Friendlier Legacy and Source Presentation**

Keep legacy/sessionless and provenance truth available without making implementation terminology dominate the normal UI. Never fabricate sessions.

**#26 — History: Deterministic Session Highlights and Last-Time Comparison**

Surface reliable facts and comparable prior performance without requiring an AI provider. Reuse existing comparison rules rather than inventing conflicting metrics.

### Phase F — Remaining workout behavior

**#30 — V3 Core: Complete Live-Workout Reordering and Duration Adaptation**

Close the known V2 gaps: persist temporary reordering and changes to the remaining workout/duration while preserving original plan intent, completed work and permanent templates. Prefer implementation after authoritative persistence so new state does not require another migration.

### Phase G — V3 acceptance

**#31 — V3 Release: Core Product Completeness and Acceptance Review**

Review the selected V3 release scope, migration integrity, account recovery, cloud authority, exercise identity/catalog/import behavior, History/core behavior, backup/recovery and physical iPhone evidence. Close V3 only when included issues have evidence or explicit disposition.

## Dependency summary

Core path:

`#27 → #28 → #29`

with `#16` and the approved V3 data semantics required before #28 migration acceptance.

Exercise path:

`#16 → #17 → #18`

Exercise-centric History:

`#16 → #23 → #26` (with #26 also reusing existing comparison contracts)

Workout adaptation:

`#29 → #30` is the preferred order, though final dependency should remain in the issue if architecture changes.

Release:

selected V3 issues → `#31`.

## Data and migration principles

V3 migration must preserve historical truth and be conservative:

- preserve stable IDs/relationships unless an explicit approved migration transforms them;
- preserve dates, units, load/reps, effort, pain/discomfort, notes, incompleteness, source/provenance and unknown supported metadata;
- preserve original imported/logged labels where practical even after canonical exercise mapping;
- never fuzzy-merge historical exercises silently;
- compare content and relationships, not only counts;
- make migration retry-safe/idempotent;
- never make a cloud-load failure look like an empty account;
- require durable acknowledgement before reporting a cloud write saved;
- maintain complete JSON backup/export capability and explicit recovery procedures.

## Exercise identity rule

GymBro owns exercise identity.

External tools, imports, users and future providers may supply labels such as `Rope Triceps Pressdown`, `Rope Triceps Pushdown`, or `Cable Rope Pushdown`; labels are not durable identity keys. A future trainer should consume one canonical GymBro exercise identity and authoritative history, not create a parallel taxonomy.

Template/session role (`core`, `accessory`, `substitute`), order, short-workout inclusion and session substitutions are contextual relationships, not solely intrinsic canonical-exercise properties.

## Deferred beyond V3.x

Unless a later explicit product decision changes the boundary, defer:

- external AI/provider runtime integration;
- ChatGPT/Claude/provider connection UX;
- natural-language automatic workout control/logging;
- AI-driven progression/program adaptation;
- provider-specific authorization beyond what V3 account/data ownership requires;
- voice/earbud workout control;
- GymBro-hosted open-weight AI.

The next trainer generation should be planned against the stable V3 database/domain actions rather than carrying forward the abandoned PR #9 architecture.

## Version numbering

The earlier M0 plan mapped milestone numbers directly to application versions (`3.1`, `3.2`, etc.). The issue-driven workflow deliberately separates implementation-unit order from release numbering.

Do not assign a concrete V3 application minor version merely because an issue title contains `V3.0`, `V3.1`, or `V3.2`. Those exercise issue titles are capability labels inherited from the product discussion. Decide the concrete release mapping before the first affected V3 deployable build and then use `MAJOR.MINOR.PATCH-BUILD` consistently.

## Execution rule

To implement work, select/approve a GitHub issue and hand that issue to Codex. Codex should read `AGENTS.md`, `README.md`, [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md), [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md), the target issue, and named dependencies; start from current accepted `main`; implement only the issue; create a focused PR; provide actual validation evidence; and not merge or change Production data without explicit approval.
