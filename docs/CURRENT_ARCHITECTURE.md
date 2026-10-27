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

V3.x is the **persistent-data and core-product-maturity generation**. It is not currently the AI-integration generation.

Approved direction:

1. recoverable personal account access and private ownership;
2. stable canonical exercise identity incorporated into the database model before full migration acceptance;
3. verified migration of the complete V2 dataset to Supabase/PostgreSQL on Preview;
4. controlled Production cutover after data/evidence gates;
5. Supabase/PostgreSQL becomes the sole active workout store after accepted cutover;
6. no indefinite dual writes or automatic local-only workout fallback after cutover;
7. preserve JSON backup/import/export and historical truth;
8. mature exercise catalog/import normalization, History and remaining core workout behavior before external AI/provider integration.

The approved scope and migration gates are recorded in [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md). Ordered implementation work is tracked through GitHub issues and summarized in [V3_IMPLEMENTATION_PLAN.md](V3_IMPLEMENTATION_PLAN.md).

## Target V3.x data boundaries

V3 should make these identities explicit and durable:

- **User/account identity** — owner of private GymBro data.
- **Workout template identity** — current reusable plan/program definition.
- **Workout session identity** — immutable historical context of what was planned and actually performed.
- **Exercise identity** — canonical immutable exercise ID independent of display names/aliases.
- **Set identity** — lowest-level recorded performance fact tied to exercise/session context where applicable.

GymBro owns these identities. Imported/provider-supplied labels are input/provenance, not persistent identity keys.

Exercise metadata intrinsic to the exercise belongs to canonical exercise identity (for example canonical name, aliases, muscles/equipment/status). Contextual use belongs to the template/session relationship (for example core/accessory/substitute role, order, short-workout inclusion, and session-local substitutions).

## Persistence transition rules

Until controlled cutover, the deployed V2 localStorage database remains authoritative for real workouts.

V3 migration work must:

- use deliberate Preview/test migration before Production;
- preserve all IDs, relationships, historical fields and unknown preserved metadata unless an explicitly approved migration changes them;
- compare content/relationships, not only record counts;
- be retry-safe and avoid duplicate records;
- fail visibly rather than present a cloud-load failure as an empty account;
- retain a verified legacy backup/inactive copy through cutover until explicit cleanup approval;
- require durable acknowledgement before reporting a cloud mutation saved;
- preserve visible unsaved input on save failure where the approved UI contract requires it.

Initial cloud operation requires connectivity to save. Offline workout-write queuing is not part of the approved initial V3 scope.

## AI/provider boundary

The mature product vision still includes an intelligent conversational trainer, but external provider integration is deliberately deferred beyond V3.x completion.

V3 should prepare clean, deterministic domain boundaries that a future trainer can consume. It should not add speculative provider abstractions or duplicate workout state merely to anticipate AI.

Future provider integrations must consume GymBro's canonical identities and authoritative records. They must not establish their own parallel exercise taxonomy, session truth, or persistence store.

## Source-of-truth hierarchy

For current work, read documents in this order when they overlap:

1. [GymBro_PRD.md](GymBro_PRD.md) current-scope authority and North Star;
2. [V3_M0_SCOPE_AND_ACCEPTANCE.md](V3_M0_SCOPE_AND_ACCEPTANCE.md) approved V3 transition decisions;
3. this current architecture summary;
4. [V3_IMPLEMENTATION_PLAN.md](V3_IMPLEMENTATION_PLAN.md) ordered V3 issue/backlog view;
5. [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) implementation process;
6. subsystem and historical milestone documents for detailed accepted contracts/evidence.

Historical documents do not authorize new implementation merely because they describe a future idea. GitHub issues are the implementation specification for newly approved work.
