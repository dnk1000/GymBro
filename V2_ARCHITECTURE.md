# GymBro V2 architecture and trainer API baseline

This describes the accepted standalone V2 runtime. GitHub `main` is authoritative; development uses repository branches and reviewed PRs, GitHub Actions provides CI, and Vercel supplies previews and production. Milestone 7 release completion remains gated by [V2_RELEASE.md](V2_RELEASE.md).

**GymBro UI / reviewed manual JSON import → structured workout actions → browser localStorage → dashboard / History / backups**

GymBro stores facts, exposes detached state and evidence, validates explicit actions, and preserves workout history. There is no Supabase/PostgreSQL backend, OAuth, MCP, external trainer API, account/provider login or ChatGPT-hosted/provider-hosted runtime dependency. Node dependencies serve development tests only.

The original voice/text → trainer → structured actions diagram explains historical design motivation; it is not the current deployment architecture. External AI/provider runtime integration is **Future/optional integration concept — not currently scheduled.** PR #9's unmerged implementation is abandoned. Existing trainer-named selectors and the manual ChatGPT interchange remain accepted standalone functionality.

## Current boundaries

| Module | Responsibility |
| --- | --- |
| `seed.js` | Original history/library and established program; never rewritten to fix tests. |
| `workout-data.js`, `workout-sessions.js` | Schema validation/migration, immutable session snapshots, relationships and conservative merge. |
| `workout-actions.js` | Synchronous injected transaction adapter: clone candidate → validate → persist → commit. |
| `guided-workouts.js` | Guided action extension and detached selector over the same sessions/sets; position is separate from status. |
| `performance-context.js` | Derived read-only evidence, transparent comparisons and trainer context composed from guided state. |
| `storage.js` | localStorage adapter, raw-byte stale comparison and recovery notices; lifecycle checks never save drafts or silently adopt another tab. |
| `app.js`, `guided-ui.js`, `history-view.js`, `index.html`, `styles.css` | UI adapters/presentation. UI is not authoritative workout state. |
| `app-version.js` | Immutable committed application metadata; export helper adds appVersion without changing committed data. |

There is no application compilation/build step. Node, Playwright and CI are development tools. Schema is 7 under `daveGymTrackerV1`; v5→6 introduces empty session state, v6→7 introduces support for optional guidance without inventing any old session guidance. Startup migration is in memory; a subsequent successful mutation persists it. Unsupported future/corrupt storage is preserved and blocks editing.

## State and evidence APIs

All are methods of `workoutActions`; the browser also exposes `getWorkoutState()`. The factory runs without DOM globals. Return values are detached JSON; mutating them cannot change committed state.

| Interface | Contract |
| --- | --- |
| `getWorkoutState()` | Complete committed database, excluding form drafts and selected tabs. |
| `getSession(id)`, `getActiveSession()` | Session snapshot or null. |
| `getGuidedWorkoutState(sessionId?)` | Guided snapshot or null for no guidance; null does not rule out an active unguided session. Exposes session/template/mode, position/revision, planned/actual exercise, statuses, ordered sets, remaining pending slots, previous/next and factual previous performance. Resume means inspecting this persisted state, not creating another session. |
| `getExercisePerformanceContext({exercise, asOfDate, unit?, limit?, excludeSessionId?})` | Exact actual exercise identity, evidence/provenance and per-unit comparability; dates required explicitly, no browser clock inference. |
| `compareExercisePerformance({baselineSetId, currentSetId, asOfDate, unit?})` | Referenced arithmetic and exclusion reasons, not a prescription. |
| `getTrainerWorkoutContext({asOfDate, sessionId?, unit?, limit?})` | Composes the same guided selector; concise evidence, source IDs and explicit unknown goals/constraints/failure/working-set classification. No parallel workout model. |

Performance APIs return `{ok, code, errors, result}`. Invalid queries return validation failures; incompatible evidence returns explainable exclusions. Evidence policy `trainer-evidence-v1` produces only review/insufficient_evidence and recommendation=null. Exact exercise/unit rules, no conversion/equivalence/1RM/readiness model; pain is context, not a diagnosis. See [TRAINER_EVIDENCE.md](TRAINER_EVIDENCE.md).

## Mutations

| Interface | Purpose / essential parameters |
| --- | --- |
| `startGuidedSession({date, templateId, duration})` | Atomic session/snapshot/guidance creation; duration 30 or 60, reject existing active session. |
| `enableGuidance(sessionId)` | Explicitly enable on a suitable active snapshot; preserve sets, initialize pending statuses. |
| `selectGuidedSlot({sessionId, planSlotId, expectedRevision})` | Position only; not reorder or completion. |
| `moveGuidedSlot({sessionId, direction, expectedRevision})` | Previous/next position; reject boundaries. |
| `setGuidedSlotStatus({sessionId, planSlotId, status, expectedRevision})` | Explicit completed/skipped; no inferred threshold. |
| `substituteGuidedExercise({sessionId, planSlotId, exercise, expectedRevision})` | Existing name-key exercise for subsequent sets only; preserve plan, template and earlier records. |
| `logGuidedSet({sessionId, planSlotId, expectedRevision, requestId, ...setFields})` | Log current actual exercise/date, require exact current slot. Stable request ID identifies the logical submission. |
| `finishGuidedSession({sessionId, expectedRevision, allowPending?})` | Complete atomically; pending slots require explicit confirmation, remain pending. |
| `createSession({date, templateId?, duration?})`, `completeSession(id, options?)` | Manual lifecycle; guided completion also requires its revision/pending guards. |
| `logSet(input)` | Explicit date/exercise/load/unit/reps/effort/pain/notes/completeness. Omitted sessionId uses active session; null means sessionless; explicit ID must be active. planSlotId is optional and validated, never fabricated. |
| `editSet(id, patch)`, `deleteSet(id)` | Preserve omitted fields/IDs/metadata; cannot reassign relationships/date inconsistently. Delete maintains session.setIds. Historical corrections remain available, including completed history. |
| `attachSetToSession({setId, sessionId, planSlotId?})` | Explicit active-session link; no guessing or completed-session attachment. |
| `logBodyweight({date, value})`, `commitImport(draft)` | Validated bodyweight or reviewed import commit. Import hashes/IDs/duplicate guards preserved. |
| `selectPlan({templateId, duration?})`, `clearPlan()` | Current permanent plan selection; does not change an existing session snapshot/mode. |
| `toggleSlotShort({templateId,index})`, `cycleSlotRole({templateId,index})`, `removeSlot({templateId,index})`, `addSlot({templateId,exercise,role?})` | Established permanent template controls; not live-session reorder/adaptation. |

Mutations return `{ok, code, errors, changes, state, ...identifiers}`. Success follows durable persistence; validation or write failure commits nothing. `NO_CHANGE` reports already-satisfied state without another write. Action callbacks are trusted synchronous adapters; actions do not render, confirm or scrape controls.

Guided revision checks return STALE_GUIDANCE for outdated parameters. Inspect fresh state and reconsider intent; do not blindly substitute the latest revision. Guided set retries must retain the original request ID and submitted values. Exact retries return REPLAY without writing, including after completion/deletion (tombstone); changed values with the same ID return REQUEST_CONFLICT. A failed write does not consume the request. Two intentional identical sets require different IDs. Manual logSet has no request-id replay contract; do not retry a successful manual action blindly.

Storage conflicts return PERSISTENCE_ERROR with errors and unchanged local committed state. No per-database compare-and-swap is claimed. Finish with unresolved slots first returns CONFIRM_UNFINISHED; only confirmed allowPending=true finishes. Completed sessions reject new guided/membership mutations; no reopen workflow.

## Accepted limitations and unresolved PRD items

localStorage quota/eviction and concurrent write races; no cloud backup/sync/account portability/offline shell; name-key exercise identity; unknown equipment equivalence, structured goals/constraints and failure/working classifications; transient unsaved inputs; whole-database synchronous writes. No autonomous progression prescriptions or AI/voice runtime is implemented or scheduled. Legacy date groups are display only, never inferred sessions.

Persisted session reordering and live session mode/plan adaptation are not implemented; navigation/skip is not equivalent. These explicit V2 PRD items are identified as discrepancies in [PRD_COMPLIANCE.md](PRD_COMPLIANCE.md), not added or reclassified as V3 by this release work. Physical acceptance and final production verification remain gates. See [PRODUCTION_DELIVERY.md](PRODUCTION_DELIVERY.md).
