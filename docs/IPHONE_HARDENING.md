# Milestone 6 — iPhone hardening

Status: implementation/automated validation for preview; **physical iPhone Safari acceptance pending**. Start point: accepted main `05728af`, Milestone 5 PR #6. Application version is the fixed 2.6.0 build in `app-version.js`; schema remains **7**, key `daveGymTrackerV1`. No persisted fields, migrations, dependencies or workout policies added.

## Product and scope

Read [GymBro_PRD.md](GymBro_PRD.md). The architecture remains User voice/text → ChatGPT virtual trainer → GymBro structured actions/state → persistent workout data → dashboard. GymBro remains memory/control/persistence, not autonomous coaching. No AI, voice, prescriptions, timers, notifications, accounts, cloud sync, analytics redesign or Milestone 7.

## Verified defects and minimal corrections

1. A page that missed a cross-tab storage event showed no warning when restored/foregrounded. The existing write-time comparison already rejected a later write. A regression reproduces this by changing isolated storage without a storage event, then dispatching pageshow/visibilitychange. Add a read-only comparison on visible pageshow/visibilitychange. Changed raw data raises the existing stale-tab warning; no automatic reload/merge/adoption or form clearing. Read exceptions pause editing until reload without offering an empty-data reset. Existing corrupt-data recovery notices are preserved.
2. Workout entry controls computed to ~13.33px. Set mobile entry text to 16px to avoid Safari’s focus-zoom trigger and ensure primary logging/form buttons are at least 44px tall. Existing guided controls already met that height. Keep the layout and intentionally compact History icons. Actual keyboard/chrome behavior still needs physical Safari verification.

The new tests failed before these corrections and passed after them. No other functional changes were justified by the audit. No claim of physical Safari testing is made.

## Mutation and trainer-contract audit

- Guided start/enable/select/move/Done/Skip/substitute/log/finish use the existing domain transaction: clone → mutate candidate → validate → persist → commit. UI effects occur after the structured result. No unload/pagehide/background save dependency.
- Candidate mutation and ID allocation do not commit state. Rejected writes and thrown quota exceptions retain committed state/raw storage, revisions, membership and request history. Failed UI submissions keep their form/request identity for deliberate retry.
- Guided request IDs represent submissions; exact retries replay without writing, including after reload/completion. Distinct intentional IDs may record identical values. Revision guards reject repeated mutation parameters. UI navigation burst guards supplement domain checks; no new deduplication protocol.
- Completed sessions retain completedAt and pending/skipped/completed facts. New membership and guided mutations are rejected. Existing History corrections remain intentionally supported; no reopen workflow.
- Manual logging remains usable sessionless or against an active session under existing omitted/null/explicit-ID semantics. Manual logSet does not acquire a new idempotency contract; callers must not blindly retry a successful manual submission. Guided callers continue using the request-ID API.
- getGuidedWorkoutState, getTrainerWorkoutContext, exercise evidence selectors and all structured action results remain unchanged and DOM-independent. Recovery tests compare trainer context before/after navigation, reload and reopened tabs. No parallel state model.
- Schema migration, corrupt/future rejection, complete backups, restore/merge, import hashes, session relationships and source metadata remain unchanged and covered by the full suite. No runtime code change to the action or trainer modules was necessary.

## Automated validation

New tests cover missed events on visible resume, read exceptions without destructive recovery, unchanged resume without writes, portrait/landscape widths and field/target sizing, browser Back/Forward, immediate reload, reopening a tab in the same browser context, persisted guidance/substitutions/manual sets and trainer context, request replay, rapid command bursts, real QuotaExceededError, every guided mutation’s rollback/revision retries, explicit Enable guidance failure, and completed-session protections.

Run `npm test`, all JS/CJS `node --check` checks and `git diff --check`. Existing version, migration, backup/restore, guided, trainer/performance, action/idempotency, session/history and duplicate-import tests remain enabled. Tests use disposable browser contexts/VM fixtures; production browser data is not accessible or modified.

Synthetic lifecycle dispatch and reopened automated tabs are regression models, **not** actual iPhone suspension, OS termination, phone locking, Safari reopening or on-screen-keyboard testing. Follow [the physical checklist](REAL_PHONE_SMOKE_TEST.md#milestone-6--physical-iphone-acceptance-pending) before acceptance.

## Remaining limitations

localStorage is synchronous, quota/eviction-limited and lacks atomic cross-tab compare-and-swap. Existing stale guards safely reject observed conflicts; simultaneous tabs are not collaborative editing. Storage eviction/deletion cannot be repaired without a backup. No offline app shell/service worker or cloud recovery is introduced. Unsaved form values can be lost on reload/termination by established policy. Physical Safari findings may require fixes on this same branch before acceptance.
