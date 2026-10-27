# GymBro V3.x implementation plan

Status: current V3 planning authority, October 27, 2026. V3.x is the **persistent-data and core-product-maturity generation**. Individual implementation work is authorized and executed through GitHub issues, not by this document alone.

## Product direction

The October 27 M0 decision approved staged cloud persistence. Subsequent product review refined the generation boundary:

> **Make the data trustworthy → make the core product complete → expose it to AI later.**

V3.x is not the external-AI-integration generation. The mature conversational trainer remains the North Star, but provider/runtime AI, conversational automatic logging, adaptive AI coaching and voice are deferred until GymBro has a stable database-backed system of record and mature core domain behavior.

Current deployed V2 remains localStorage-based until controlled cutover is accepted. See [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md) and [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md).

## Planning model

GymBro uses an issue-driven workflow:

**Chat/product discussion → GitHub issue/specification → ordered backlog → Codex branch/PR → acceptance evidence → close issue**

The GitHub issue is the executable implementation specification. Issue numbers do not equal application versions. A release may contain one or several accepted issues. Dependencies are explicit in issue bodies. See [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

## V3.x completion definition

V3.x should establish a trustworthy manual/guided product and durable system of record with:

- recoverable personal access and database-enforced private data ownership;
- reproducible Preview/Production infrastructure and source-controlled database migrations;
- a reviewed authoritative relational schema and persistence boundary;
- deterministic concurrency/revision/retry behavior for multi-device use;
- verified Supabase/PostgreSQL workout migration and behavioral parity;
- controlled retirement of localStorage as the active workout database;
- complete cloud backup/restore/reset/recovery semantics;
- supportable recoverable error states and safe diagnostics;
- stable canonical exercise identity;
- maintainable exercise catalog, aliases, archive/merge behavior;
- robust import resolution for variant/unknown exercise labels;
- correct note/data semantics;
- usable long-term History, Program, Dashboard and Exercises UX on desktop and iPhone;
- complete live-workout reordering/duration adaptation;
- documented physical iPhone and Production acceptance;
- an explicit V3 application-version/release mapping.

External AI/provider runtime integration is not required for V3.x completion.

## Ordered backlog

The order below is recommended by dependency first, then product value. Independent UI issues may be pulled earlier when they do not destabilize foundation work.

### Phase A — Infrastructure, ownership, identity and schema

**#38 — V3 Infrastructure: Preview/Production Environment and Database Migration Pipeline**  
Establish reproducible Preview/Production Supabase/Vercel boundaries, source-controlled database migrations, safe configuration/secrets handling and a disposable test strategy.

**#27 — V3 Foundation: Recoverable User Access and Private Data Ownership**  
Provide sign-in/sign-out/recovery plus database-enforced user isolation/RLS. This issue does not migrate personal workout history.

**#16 — V3.0: Exercise Identity Architecture**  
Introduce immutable canonical exercise IDs, aliases/provenance and the separation between intrinsic exercise metadata and contextual template/session role.

**#25 — Data Model: Distinguish Session, Exercise, and Set Notes**  
Define note scope before the relational schema is finalized. Preserve historical text conservatively; do not guess old note scope.

**#39 — V3 Data: Authoritative Relational Schema and Persistence Boundary**  
Define/implement the V3 relational model for users, exercises/aliases, templates, sessions/snapshots, sets, bodyweights, guided/request state, imports, preferences and notes. Establish one persistence boundary under the existing domain actions.

**#40 — V3 Data: Concurrency, Revision, and Retry Contract**  
Define stale-write, optimistic revision, retry/idempotency, delayed-response and two-device behavior before migration acceptance.

### Phase B — Backup/recovery semantics and Preview migration

**#41 — V3 Data: Cloud Backup, Restore, Reset, and Account Data Lifecycle**  
Define cloud-authority export, complete restore, history merge, local recovery-copy cleanup, cloud reset and account/data deletion semantics.

**#28 — V3 Foundation: Full Workout Migration and Preview Parity Verification**  
Migrate a deliberate verified test copy onto the established V3 platform and prove complete data/relationship/behavior parity. This issue no longer owns infrastructure, target schema design or concurrency-policy design.

**#42 — V3 Operations: Diagnostics and Recoverable Error States**  
Provide supportable failure states for auth, network, database, stale writes, migration/schema mismatches and failed initial loads without adding broad analytics/telemetry.

### Phase C — Controlled Production cutover

**#29 — V3 Foundation: Controlled Production Cutover and Local Workout-Storage Retirement**  
After accepted Preview migration and explicit Production approval, make Supabase/PostgreSQL the sole active workout store. Do not keep indefinite dual writes or automatic local-only fallback. Retain legacy local data only as deliberately managed recovery material until cleanup is separately approved.

### Phase D — Exercise/catalog/import maturity

**#17 — V3.1: Exercise Catalog Management**  
Canonical metadata editing, aliases, archive/restore, duplicate suggestions and explicit safe Merge Exercises workflow.

**#18 — V3.2: Smart Import Resolution**  
Exact canonical/alias matches map automatically; unknown/ambiguous labels require review. Approved mappings become remembered aliases. Fuzzy similarity is suggestion-only.

**#35 — Exercises: Move Taxonomy and Categorization out of Program**  
Make Exercises the owner of taxonomy/catalog metadata and keep Program focused on template structure.

**#23 — Exercise: Detail and Performance History View**  
One canonical exercise gets one longitudinal history/detail experience.

**#37 — Exercises: Mobile-Friendly Library Layout**  
Use a phone-friendly card/list presentation rather than squeezing the desktop table into narrow widths.

### Phase E — History and dashboard/program usability

**#20 — History: Collapsible Workout Sessions**  
Collapsed-by-default session/date cards with concise summaries.

**#21 — History: Group Sets by Exercise with Progressive Disclosure**  
Exercise-level summaries inside expanded sessions, with individual set rows revealed only when needed.

**#36 — History: Mobile-Friendly Set Layout**  
Phone-friendly stacked set presentation while preserving efficient desktop tables.

**#22 — History: Search and Filters**  
Exercise/workout/date filtering, with optional reliable pain/discomfort filtering.

**#24 — History: Friendlier Legacy and Source Presentation**  
Keep provenance true but reduce internal `legacy/sessionless` language in the normal user experience.

**#26 — History: Deterministic Session Highlights and Last-Time Comparison**  
Surface factual highlights and comparable prior performance without an AI provider.

**#32 — Dashboard: Desktop Layout and Information Hierarchy**  
Use desktop space better, simplify the header, remove low-value KPI cards, align charts and improve deterministic Problems/Flags copy while preserving the good phone layout.

**#33 — Backlog: Revisit Performance Calculation and Dashboard Metric**  
Analysis-only decision issue: document the current calculation, define what question the metric should answer and create follow-on implementation issue(s) if the metric changes.

**#34 — Program: Improve Split and Template Editing UX**  
Clarify split/template selection and selected 30/60-minute context while preserving existing functionality discovered during implementation.

### Phase F — Remaining live-workout behavior

**#30 — V3 Core: Complete Live-Workout Reordering and Duration Adaptation**  
Persist temporary reordering and changes to the remaining workout/duration while preserving original plan intent, completed work and permanent templates.

### Phase G — Release/version decision and V3 acceptance

**#43 — V3 Release: Version Numbering and Issue-to-Release Mapping Decision**  
Resolve the collision between capability labels and application `3.x` minor versions. Issue order and release numbers remain independent; multiple accepted issues may ship in one minor release.

**#31 — V3 Release: Core Product Completeness and Acceptance Review**  
Review selected V3 scope, migration integrity, account recovery/isolation, cloud authority, catalog/import behavior, backup/recovery, core UX/workout behavior, diagnostics and physical iPhone evidence. Close V3 only when included issues have evidence or explicit disposition.

## Recommended execution sequence

The grouped backlog above is organized by architectural area. It is **not** intended to mean "implement top to bottom exactly as displayed." For a primarily sequential Codex workflow, use the dependency-safe sequence below unless a later issue explicitly changes a dependency.

1. **#43 — Version Numbering and Issue-to-Release Mapping Decision** — settle release semantics before the first deployable V3 build.
2. **#38 — Preview/Production Environment and Database Migration Pipeline** — establish reproducible environments and schema-promotion mechanics.
3. **#27 — Recoverable User Access and Private Data Ownership** — establish authentication, recovery and database-enforced isolation/RLS.
4. **#16 — Exercise Identity Architecture** — settle canonical identity before final schema/migration work.
5. **#25 — Distinguish Session, Exercise, and Set Notes** — settle note semantics before final schema/migration work.
6. **#39 — Authoritative Relational Schema and Persistence Boundary** — implement the target V3 data model and persistence boundary.
7. **#40 — Concurrency, Revision, and Retry Contract** — make cloud writes deterministic and retry-safe.
8. **#41 — Cloud Backup, Restore, Reset, and Account Data Lifecycle** — make recovery/destructive semantics correct for cloud authority.
9. **#28 — Full Workout Migration and Preview Parity Verification** — migrate a verified V2 copy onto the established V3 platform and prove parity.
10. **#42 — Diagnostics and Recoverable Error States** — harden failure/recovery behavior before Production cutover.
11. **#29 — Controlled Production Cutover and Local Workout-Storage Retirement** — move Production authority to Supabase/PostgreSQL only after Preview acceptance and explicit approval.
12. **#17 — Exercise Catalog Management** — add canonical catalog maintenance/merge/archive behavior.
13. **#18 — Smart Import Resolution** — resolve incoming labels against the canonical catalog safely.
14. **#35 — Move Taxonomy and Categorization out of Program** — align information architecture with the final catalog ownership model.
15. **#23 — Exercise Detail and Performance History View** — build one canonical longitudinal exercise view.
16. **#37 — Exercises Mobile-Friendly Library Layout** — adapt the final Exercises experience to narrow screens.
17. **#20 — History Collapsible Workout Sessions** — make History session-first and scan-friendly.
18. **#21 — Group Sets by Exercise with Progressive Disclosure** — add exercise-level disclosure inside sessions.
19. **#36 — History Mobile-Friendly Set Layout** — adapt the final History detail model to narrow screens.
20. **#22 — History Search and Filters** — add long-term retrieval/navigation.
21. **#24 — Friendlier Legacy and Source Presentation** — improve terminology while preserving provenance truth.
22. **#26 — Deterministic Session Highlights and Last-Time Comparison** — add factual derived summaries on stable identities/history.
23. **#34 — Program Split and Template Editing UX** — polish Program against the final template/exercise model.
24. **#32 — Dashboard Desktop Layout and Information Hierarchy** — polish Dashboard after the underlying data/history model is stable.
25. **#33 — Revisit Performance Calculation and Dashboard Metric** — analysis-only; create separate follow-on implementation issue(s) if the metric decision changes behavior.
26. **#30 — Live-Workout Reordering and Duration Adaptation** — complete remaining active-workout behavior on authoritative persistence.
27. **#31 — Core Product Completeness and Acceptance Review** — final V3 acceptance after selected issues are accepted/closed or explicitly dispositioned.

### Parallelization rule

UI-only issues such as #20, #32, #34, #35, #36 and #37 may be pulled forward when convenient because they do not need to block the database path. However:

- do not let early UI work invent a competing data model;
- build exercise-centric UI on the final #16/#17/#23 identity/catalog path when those dependencies materially affect the screen;
- build History mobile/progressive-disclosure work so #20/#21/#36 compose rather than compete;
- keep the core platform sequence `#38 → #27 → #39 → #40 → #41 → #28 → #42 → #29` dependency-ordered;
- implement one issue per focused PR unless an issue explicitly requires a coupled change;
- accept/merge each dependency before starting the next dependent issue when using the safest sequential workflow.

For Codex, the normal handoff should be simply: **Implement issue #N according to its execution contract; do not start another issue.**

## Dependency summary

Primary platform path:

`#38 → #27 → #39 → #40 → #41 → #28 → #42 → #29`

with `#16` and `#25` required before #39/#28 acceptance.

Exercise path:

`#16 → #17 → #18`

Exercise-centric History:

`#16 → #23 → #26`

Responsive/catalog work should build on final dependencies rather than create parallel UI/data paths:

`#35/#37` reuse #16/#17/#23 as available; `#20/#21/#36` should compose rather than compete.

Workout adaptation:

`#29 → #30` is the preferred order so the new active-workout state does not require a second persistence migration.

Release management:

`#43` before the first deployable V3 version; selected V3 issues → `#31` final acceptance.

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
- maintain complete JSON backup/export capability and explicit recovery procedures;
- keep Preview and Production data/configuration boundaries explicit;
- keep database schema changes reproducible from reviewed migration state;
- do not expose privileged credentials to browser code.

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

Until #43 is accepted, do not assign a concrete V3 application minor version merely because an issue title contains `V3.0`, `V3.1`, or `V3.2`. Those exercise issue titles are capability labels inherited from product discussion, not automatic release numbers.

## Execution rule

To implement work, select/approve a GitHub issue and hand that issue to Codex. Codex should read `AGENTS.md`, `README.md`, [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md), [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md), the target issue, and named dependencies; start from current accepted `main`; implement only the issue; create a focused PR; provide actual validation evidence; and not merge or change Production data without explicit approval.
