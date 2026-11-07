# GymBro current architecture and transition authority

Status: current architecture summary as of October 27, 2026. This document distinguishes the **deployed V2 runtime today** from the **approved V3.x target direction**. Historical milestone documents remain valid descriptions of what existed at their respective releases.

## Today: deployed V2 runtime

The accepted application remains a static, mobile-first web app delivered through GitHub → Vercel:

**UI / reviewed JSON import → DOM-independent workout actions → browser localStorage → History / analytics / backup**

Current deployed characteristics:

- vanilla HTML/CSS/JavaScript runtime;
- browser `localStorage` key `daveGymTrackerV1` is the active workout store;
- data schema 7;
- explicit workout sessions and immutable plan snapshots;
- guided workout state/actions;
- deterministic performance/trainer evidence selectors;
- History, corrections, import/export and complete JSON backup/restore;
- no required account, cloud workout database, external AI provider, or voice runtime for normal V2 operation.

The detailed accepted V2 module/action contracts remain in [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md), [GUIDED_WORKOUTS.md](GUIDED_WORKOUTS.md), [TRAINER_EVIDENCE.md](TRAINER_EVIDENCE.md), and related historical documents.

## Approved V3.x direction

The #27 candidate adds Preview-only recoverable email-link access and a minimal private access-check table. It leaves every workout local and defines the database owner contract for #39 in [V3_ACCOUNT_ACCESS.md](V3_ACCOUNT_ACCESS.md). Candidate code is not account acceptance or Production cutover.

Issue #38's infrastructure candidate adds an explicit staging boundary for the optional diagnostic and reproducible migration/CI mechanics. It does not migrate workouts or change the local workout authority above. See [V3_INFRASTRUCTURE.md](V3_INFRASTRUCTURE.md) and [candidate evidence](V3_RELEASE.md); candidate code is not evidence of Production cutover.

V3.x is the **persistent-data and core-product-maturity generation**. It is not currently the AI-integration generation.

Approved direction:

1. recoverable personal account access and private ownership;
2. stable canonical exercise identity in the existing database model;
3. a qualified empty cloud start or an explicit owner-scoped import of supported GymBro JSON;
4. controlled Production cutover after focused cloud verification and explicit approval;
5. Supabase/PostgreSQL becomes the sole active workout store after accepted cutover;
6. no indefinite dual writes or automatic local-only workout fallback after cutover;
7. preserve JSON backup/import/export and historical truth;
8. mature exercise catalog/import normalization, History/data semantics, and remaining core workout behavior before external AI/provider integration.

The current cutover decision is recorded in the [PRD](GymBro_PRD.md) and [#29](https://github.com/dnk1000/GymBro/issues/29). The [M0 record](V3_M0_SCOPE_AND_ACCEPTANCE.md) retains the original milestones and evidence.

## Target V3.x data boundaries

Issue #41's approved [cloud lifecycle contract](V3_DATA_LIFECYCLE_PROPOSAL.md) extends the opt-in boundary with complete same-account cloud backups, confirmed atomic replacement, additive history merge and server-qualified emergency recovery. Migration `20261030180000` adds fixed-search-path lifecycle snapshot/mutate/resolve functions and a dedicated non-login/non-BYPASSRLS owner-scoped writer. It can replace only the workout aggregate; transport receipts/fences and live revision remain outside replacement, and the ordinary writer keeps its immutable-intent/deletion restrictions. Browser direct DML and unchecked RPC remain revoked. Reset/account deletion remain deferred. The reusable cloud Data panel is staged on a guarded synthetic page; normal local workout authority is unchanged until separately accepted #28/#29 integration. [Backup/recovery instructions](HISTORY_AND_BACKUPS.md#approved-cloud-lifecycle-boundary--issue-41) describe the operational contract; [PR #79](https://github.com/dnk1000/GymBro/pull/79) owns verification and pending acceptance.

Issue #39's approved [relational design](V3_RELATIONAL_SCHEMA_PROPOSAL.md) is implemented as an opt-in synthetic foundation, with actual validation tracked in [V3_RELATIONAL_PERSISTENCE.md](V3_RELATIONAL_PERSISTENCE.md). It adds owner-scoped workout tables and a DOM-free asynchronous repository under the existing action rules. The workout UI keeps its current local adapter; this is not #28 migration, #40 concurrency acceptance or Production cutover.

Issue #25's candidate introduces [note scopes](NOTE_SCOPES.md) in workout schema 8, retaining the existing local key and conservative in-memory compatibility for schemas 1–7. It adds no cloud workout tables, personal migration or cutover. Session/exercise-occurrence/setup/set scopes project through canonical exercise identity for #39/#28. The deployed schema-7 baseline above remains the pre-candidate authority until approved delivery.

Issue #16 supplies the [canonical exercise identity contract](EXERCISE_IDENTITY.md), additive owner-scoped exercise/alias tables and a verified, lossless schema-7 identity projection. The current V2 UI/storage is not automatically converted; #39/#28 integrate this foundation with the authoritative workout schema and deliberate migration. Source labels are preserved provenance, while V3 domain references use immutable IDs.

V3 should make these identities explicit and durable:

- **User/account identity** — owner of private GymBro data.
- **Workout template identity** — current reusable plan/program definition.
- **Workout session identity** — immutable historical context of what was planned and actually performed.
- **Exercise identity** — canonical immutable exercise ID independent of display names/aliases.
- **Set identity** — lowest-level recorded performance fact tied to exercise/session context where applicable.

GymBro owns these identities. Imported/provider-supplied labels are input/provenance, not persistent identity keys.

Exercise metadata intrinsic to the exercise belongs to canonical exercise identity (for example canonical name, aliases, muscles/equipment/status). Contextual use belongs to the template/session relationship (for example core/accessory/substitute role, order, short-workout inclusion, and session-local substitutions).

Notes should preserve scope rather than collapsing all free text into one concept: workout/session context, exercise-within-session context, durable exercise setup metadata, and set-specific observations are distinct when the V3 data model supports them.

## Persistence transition rules

Issue #84's approved [Phase 1 rehearsal contract](V3_CUTOVER_READINESS_PROPOSAL.md) adds a distinct default-off capability on an explicitly approved immutable Vercel deployment, exact Git SHA/build, owners/actions/source and expiry. Existing staging guards and normal local authority remain. Every rehearsal cloud request rechecks the recorded operational approval against platform deployment metadata; aliases/mismatches/unavailable approval refuse access without reseeding or local fallback. Read-only inspection tooling does not apply Production schema. Implementation/verification and required live-operation approvals: [PR #87](https://github.com/dnk1000/GymBro/pull/87). This is not a cutover or accepted Production readiness claim.

Until controlled cutover, the deployed V2 localStorage database remains authoritative for real workouts.

Use the existing authenticated repository, checked RPCs and lifecycle controller for the normal cloud path. Offer an explicit empty start only after the server qualifies the owner and destination as uninitialized. Use the existing reviewed initialization path for an optional portable backup into an empty account and the existing owner-bound, explicitly confirmed lifecycle paths for supported populated-account imports. Validation or conflict writes nothing. Preserve format, owner and retry checks, and require durable acknowledgement before reporting success.

Verify these paths with disposable data on Preview. Personal history transfer and exhaustive parity are optional. A failed load cannot initialize, reseed or consult legacy workout data. After cutover, keep any local copy inactive and retain acknowledged cloud writes during recovery. A rollback that would re-enable stale local authority requires a separate decision and preservation of any newer cloud writes.

Initial cloud operation requires connectivity to save. Offline workout-write queuing is not part of the approved initial V3 scope.

### Approved #85 rollout design

Keep the existing app and project. Select cloud authority at startup for the normal Production origin in the reviewed cutover build, before any local workout read. The account and workout configuration endpoints must agree on the native Production environment, pinned project/URL, publishable key and private owner scope. Missing or conflicting configuration blocks cloud operation. Keep the existing staging and immutable #84 rehearsal guards separate. Use existing private recoverable accounts and keep account creation out of this cutover.

On a qualified empty destination, offer **Start empty** and **Import JSON**. Start empty explicitly initializes the existing empty workout model using the checked initialization path, without reading localStorage. Import uses the existing validation, review and initialization or lifecycle operation appropriate to the destination. Confirm durable results through the existing controller. Exercise the same startup and persistence paths with disposable Preview data and targeted signed denial tests. Keep Production configuration and the authority switch outside implementation approval.

The cutover candidate requires the canonical `https://gymbro-v15.vercel.app` origin, native Vercel Production metadata, `GYMBRO_PRODUCTION_WORKOUTS=true`, `GYMBRO_CLOUD_ENV=production`, the pinned `SUPABASE_PROJECT_REF` and `SUPABASE_URL`, a publishable key, and an explicit `GYMBRO_PRODUCTION_WORKOUT_OWNERS` UUID allowlist. Before an approved switch, verify the designated private account and exact Auth callback, preserve any desired local export and close legacy tabs. After activation, smoke the approved build with a signed save, reload and reauthentication. If a failure occurs after a possible cloud write, pause writes and keep the cloud records and receipts intact. Use forward repair or obtain separate approval for a recovery plan that preserves those writes.

## AI/provider boundary

The mature product vision still includes an intelligent conversational trainer, but external provider integration is deliberately deferred beyond V3.x completion.

V3 should prepare clean, deterministic domain boundaries that a future trainer can consume. It should not add speculative provider abstractions or duplicate workout state merely to anticipate AI.

Future provider integrations must consume GymBro's canonical identities and authoritative records. They must not establish their own parallel exercise taxonomy, session truth, or persistence store.

## Implementation units

The executable work is tracked as GitHub issues. Core dependencies currently include:

- #27 recoverable user access/private ownership;
- #16 stable exercise identity;
- #28 full Preview persistence/migration;
- #29 controlled Production cutover/local workout-store retirement;
- #17 exercise catalog management;
- #18 smart import resolution;
- #20–#26 History/exercise-detail/note/highlight improvements;
- #30 live-workout reordering/duration adaptation;
- #31 V3 core-product release acceptance.

Issue ordering is dependency/product priority, not application-version numbering.

## Source-of-truth hierarchy

Follow the [development governance hierarchy](DEVELOPMENT_WORKFLOW.md#source-of-truth-hierarchy): **PRD product authority → approved architecture/design technical authority → GitHub issues for approved implementation work → code and tests as implemented state**. This document and approved subsystem designs implement and support approved product requirements; they cannot independently override them. Issues specify bounded implementation within those constraints, and existing code or passing tests do not independently establish conflicting product requirements.

Approved milestone/decision records remain approval evidence, subsystem designs retain their technical authority, and explicitly delegated policies retain their scope. Document recency alone does not determine precedence. Historical future-roadmap text and unaccepted candidates do not authorize new implementation.

Apply the [material conflict and decision-resolution procedure](DEVELOPMENT_WORKFLOW.md#material-conflicts-and-decision-resolution) when authorities conflict or a material decision is ambiguous or missing. Pause affected work until resolved; independent work may continue only when clearly safe and unable to prejudice or complicate the decision. Routine choices within approved constraints need no escalation.

Issue #40 adds an opt-in checked [concurrency/retry boundary](V3_CONCURRENCY.md) and synthetic staging verification. Current normal workouts retain their local adapter; this does not activate cloud workout migration or cutover. Verification status is recorded in that document.

## Current visual design authority

[BRAND_AND_UI.md](BRAND_AND_UI.md) is the canonical Heritage Utility design authority for shared presentation and future UI issues. It implements product intent without changing domain, storage or workflow contracts. Its committed design board is directional, not pixel-perfect.

## Issue #28 Preview integration candidate

The approved [migration design](V3_PREVIEW_MIGRATION_PROPOSAL.md) integrates the existing seven-view app with canonical repository actions and one shared concurrency/lifecycle controller in explicit `?storage=cloud` mode. The server capability defaults off, rejects Production and admits configured synthetic staging owners/sources only. Dedicated `initializeMigration` requires an empty aggregate/catalog under the existing owner lock; exact canonical reruns are no-ops. Normal local operation remains authoritative for real workouts; no cutover, local retirement or cloud-to-local fallback. Personal migration and M0/#27 readiness remain gated. Actual verification and pending evidence are in [PR #80](https://github.com/dnk1000/GymBro/pull/80).
