# GymBro

GymBro is a mobile-first personal workout tracker/coaching application. The deployed V2 product is a static vanilla JavaScript app with guided workouts, explicit sessions, set-level history, bodyweight/performance context, corrections, reviewed JSON import, and complete JSON backup/restore.

The product North Star remains a frictionless virtual trainer, but the approved **V3.x generation is focused first on making GymBro a trustworthy database-backed system of record and completing core product behavior before external AI/provider integration.**

## Current status

### Deployed V2 today

The accepted runtime remains:

**UI / reviewed JSON import → DOM-independent workout actions → browser localStorage → History / analytics / backup**

Current workout data uses browser `localStorage` key `daveGymTrackerV1` and data schema **7**. Normal V2 operation requires no account, backend, provider login, AI API, or voice runtime.

### Approved V3.x direction

V3.x is the persistent-data/core-product-maturity generation. The approved transition introduces recoverable personal access, canonical exercise identity, verified Supabase/PostgreSQL migration, controlled Production cutover, exercise catalog/import normalization, History/data-model improvements, and the remaining live-workout adaptation gaps.

After accepted cutover, Supabase/PostgreSQL is intended to become the sole active workout store; indefinite dual writes and an automatic local-only workout fallback are not part of the approved target.

External AI/provider runtime integration, conversational automatic logging, adaptive AI coaching, and voice are deferred beyond V3.x unless a later explicit product decision changes that boundary.

Read [current architecture](docs/CURRENT_ARCHITECTURE.md) and the [V3 implementation plan](docs/V3_IMPLEMENTATION_PLAN.md) for the authoritative transition view. The limited [Supabase connection diagnostic](docs/SUPABASE_CONNECTION_TEST.md) proves connectivity only; it is not completed workout persistence or migration.

## Development workflow

Issue #16's `3.3.0` identity foundation defines canonical IDs, exact aliases and a lossless conversion boundary for later persistence work. See [identity and migration contract](docs/EXERCISE_IDENTITY.md). It does not automatically convert local workouts or enable catalog editing.

Issue #27's separate `3.2.0` account-access candidate adds Preview email-link sign-in, sign-out and recovery without uploading workouts. See [access/ownership and acceptance evidence](docs/V3_ACCOUNT_ACCESS.md). Account access remains disabled in Production.

Issue #38's `3.1.0` infrastructure candidate is described in [V3 infrastructure](docs/V3_INFRASTRUCTURE.md) and [release evidence](docs/V3_RELEASE.md). Its Preview diagnostic now requires the explicit staging project/environment variables; inherited Production configuration is rejected. The official Supabase CLI is a pinned development dependency for migrations/disposable DB tests, with no runtime package installation. Normal workouts remain local; Production database promotion requires separate approval.

GymBro now uses an issue-driven implementation workflow:

**Chat/product discussion → GitHub issue/specification → ordered backlog → Codex branch/PR → acceptance evidence → close issue**

For new implementation work, the target GitHub issue is the executable specification. Issues contain purpose, requirements, acceptance criteria, dependencies, non-goals, data/migration impact, and validation requirements. A separate giant Codex prompt should normally be unnecessary.

See [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) and the repository [AGENTS.md](AGENTS.md). The reusable issue template lives at `.github/ISSUE_TEMPLATE/implementation.md`.

GitHub `main` is the only authoritative code baseline. Start work from current `main`, use a focused feature branch, create a PR, run applicable validation, use Vercel Preview for runtime/UI acceptance, and do not merge or mutate Production data without explicit approval.

## Run the current app

Open `index.html` in a modern browser, or serve the repository locally:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

There is no application compilation/build step. Node dependencies are development/testing tools.

Development checks:

```sh
npm ci
npm run check:syntax
npm run check:release
npm run check:diff
npm test
```

Tests use disposable browser storage and must never touch a user's real workout database.

## Data safety and backups

Until V3 controlled cutover is accepted, the deployed V2 localStorage database remains authoritative for real workouts.

Before testing any issue that touches persistence or migration, export and verify a complete Production JSON backup. Preview and Production have different browser origins; an empty Preview does not mean Production history is missing.

Current complete JSON backup/restore preserves the supported database, including history, bodyweights, program/templates, exercise library, preferences, import metadata, sessions, plan snapshots, guidance state, and the active-session pointer. CSV is sets-only and is not a complete backup.

Startup must not destroy unsupported or malformed saved data. Failed saves must not be reported as successful. Existing IDs, dates, units, notes, pain/discomfort, incompleteness, provenance, session relationships, and unknown preserved fields must survive migration unless a specific approved issue deliberately changes their representation.

## Workout/data model today

The deployed product already separates:

- workout templates/program;
- workout sessions and immutable plan snapshots;
- sets and bodyweight records;
- guided workout state/actions;
- History and corrections;
- deterministic performance/trainer evidence;
- reviewed imports and backups.

V2 exercise identity is still name-key based. V3 issue #16 replaces that fragile identity model with stable canonical exercise IDs and aliases before full database migration is accepted. Exercise labels from imports/providers are input/provenance, not future identity keys.

## V3 backlog structure

The V3 implementation plan groups issues by dependency rather than treating every issue as a release number.

Foundation/database:
- #27 Recoverable User Access and Private Data Ownership
- #16 Exercise Identity Architecture
- #28 Full Workout Persistence and Preview Migration
- #29 Controlled Production Cutover and Local Workout-Storage Retirement

Core product/data maturity includes:
- #17 Exercise Catalog Management
- #18 Smart Import Resolution
- #20 Collapsible Workout Sessions
- #21 Group Sets by Exercise with Progressive Disclosure
- #22 History Search and Filters
- #23 Exercise Detail and Performance History
- #24 Friendlier Legacy and Source Presentation
- #25 Distinguish Session, Exercise, and Set Notes
- #26 Deterministic Session Highlights and Last-Time Comparison
- #30 Live-Workout Reordering and Duration Adaptation

V3 release acceptance is tracked by #31.

Issue numbers and application versions are independent. A release may contain one or several accepted issues.

## Documentation map

Start with [docs/README.md](docs/README.md) to distinguish current authorities from historical milestone records.

Key current documents:

- [Product requirements / North Star](docs/GymBro_PRD.md)
- [Approved V3 scope decisions](docs/V3_M0_SCOPE_AND_ACCEPTANCE.md)
- [Current architecture and transition](docs/CURRENT_ARCHITECTURE.md)
- [V3 implementation plan](docs/V3_IMPLEMENTATION_PLAN.md)
- [Issue-driven development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Physical-device acceptance](docs/REAL_PHONE_SMOKE_TEST.md)

Detailed V2 documents such as `V2_ARCHITECTURE.md`, `HISTORY_AND_BACKUPS.md`, `GUIDED_WORKOUTS.md`, and `TRAINER_EVIDENCE.md` remain important historical/subsystem contracts. Statements inside them about what was or was not implemented describe those releases; current roadmap authority comes from the hierarchy above.

## Product/version policy

Follow the [version and release policy](docs/VERSION_POLICY.md) approved in issue #43. `MAJOR.MINOR.PATCH-BUILD` means product generation, accepted release increment, non-feature bugfix/non-functional release, and committed UTC build timestamp. [app-version.js](app-version.js) remains the only canonical application-version source. Documentation-only changes do not bump it; application versions and data schemas remain independent.

The first planned V3 release, `3.1.0-BUILD`, maps to #38 infrastructure foundation alone. It is a planning assignment, not a shipped release or authorization to start another issue. Releases may contain one or several accepted issues through an approved mapping. The `V3.0/#16`, `V3.1/#17`, and `V3.2/#18` issue-title prefixes are capability labels, not application-release numbers. This replaces the older M0 milestone-to-minor mapping.

## Primary UX target

iPhone Safari remains the primary UX target. Responsive Chromium checks are useful regression evidence but do not substitute for physical iPhone acceptance. User-visible changes should remain touch-friendly, preserve manual fallback, and clearly distinguish saved facts from unsaved/transient input.
