# V2 PRD compliance audit — Milestone 7 preparation

## Current disposition — October 27, 2026

Accepted main is `ffd556e154ec19752c9f44031a95890d5954f200`: PR #12's diagnostic and PR #13's documentation move are merged, current-main CI passed and Vercel reports a successful deployment. Production serves application `2.7.2-20261027T152907Z`, schema 7. Earlier statements below about unmerged preparation are historical audit evidence, not current branch/deployment status.

The user explicitly assigned temporary exercise reordering and live-session duration/remaining-plan adaptation to V3 M4, accepting their absence for the intervening baseline milestones. Their historical classifications remain intact; neither feature is implemented by this disposition. Physical-iPhone and verified personal JSON-backup evidence remains missing, with explicit deferral through Preview-only M1 account work and a requirement to satisfy both before M2 migration testing. V2 final acceptance is not claimed. See [M0 scope and acceptance](V3_M0_SCOPE_AND_ACCEPTANCE.md) for approved cloud/access scope, exact remaining evidence and M1 readiness.

## Historical audit

Current scope: standalone GymBro on GitHub `main`, with Git branches/PRs, GitHub CI and Vercel previews/production. External AI/provider runtime integration is **Future/optional integration concept — not currently scheduled.** Accepted V2 trainer evidence/context, guided actions and manual interchange remain supported without an external runtime. PR #9's integration experiment is abandoned and must not be imported into `main`.

The matrix below is a historical Milestone 7 audit, retained without rewriting its classifications or evidence. Its phrase "intentionally deferred to V3" records the roadmap at that time; it is not a current schedule or active integration commitment. The standalone scope does not silently close previously recorded domain discrepancies, physical-device, backup or final acceptance gaps.

Authority: [GymBro_PRD.md](GymBro_PRD.md), original version 1.1 with the current-scope clarification. Audit baseline: accepted main `7548553`, plus Milestone 7 release-engineering preparation. This is not a claim that V2 is complete. The user authorized preparation while physical iPhone acceptance is outstanding.

Each row uses exactly one classification. Broad future-state outcomes do not become missing V2 features. Conversely, explicit V2 action/state requirements are not silently relabelled as future AI work. No functionality is added to resolve this matrix. Final acceptance must explicitly disposition actual discrepancies.

| PRD sections / requirement | Classification | Implementation, evidence or boundary |
| --- | --- | --- |
| 3, 12–13, 24, 28, 37, 44: GymBro memory/actions/persistence; trainer reasoning separate | implemented in V2 | DOM-free action factory and selectors; guided UI is an adapter. Domain/DOM-free tests and V2_ARCHITECTURE.md. No implemented conversational transport is implied. |
| 1–5, 27–36, 42–43: live coaching, language/voice interpretation, automatically generated/adapted programs and hands-free logging | intentionally deferred to V3 | Future ChatGPT responsibilities; V2 stores facts and executes explicit supported actions. No AI/voice/backend features introduced. |
| 7, 14–15, 21, 41: explicit sessions, immutable intent, identities/order, lifecycle, active recovery | implemented in V2 | Session snapshots/relationships; active/completed lifecycle; guided and session tests. Physical lifecycle acceptance is separately gated below. |
| 14, 16: optional session notes, per-set timestamps and separate exercise IDs | accepted V2 limitation | The PRD says these fields may be present. Current minimal sessions/sets preserve recorded fields without inventing timestamps; exercise-library exact name keys are identity. Session notes from imports/metadata are retained, not a new session-notes workflow. |
| 14: possible abandoned session status | accepted V2 limitation | Approved lifecycle has active/completed only; no abandonment/reopen workflow. Listed as a possible state, not silently inferred from navigation. |
| 8, 17–18, 26.4: create standard/short workout and expose its mode/state | implemented in V2 | Existing 60-minute slots and short selections snapshot at start. Approximate durations, no timer guarantees or invented prescriptions. |
| 18: structured switching/adaptation of an already active session’s duration/plan | actual V2 discrepancy | Creation supports 30/60; changing permanent plan selection does not adapt an active snapshot. PRD explicitly asks for underlying support during live workouts. Scope remains unchanged; needs explicit product disposition before claiming full compliance. |
| 13, 19, 26.4: structured temporary exercise reordering | actual V2 discrepancy | select/move navigates fixed slots but does not persist a reordered execution plan. Skip/navigation is not a substitute for this requirement. Previously outside approved Milestone 4 scope; no new action in Milestone 7. |
| 17, 19: current/previous/next, explicit Done/Skip, session-local substitution and planned/actual evidence | implemented in V2 | Existing guided selector/actions; snapshot and earlier sets are unchanged by substitution; tests preserve actual/performed history. |
| 16, 20: load/reps/RPE/RIR/completeness/notes/pain/source facts | implemented in V2 | Stored set fields and raw metadata; imports/history/evidence retain these facts. No diagnosis or classification inferred from notes. |
| 5, 20, 23: structured trainer profile/medical constraints, working/failure/equipment classification | accepted V2 limitation | Approved M5 returns unknown/null where not modeled; existing preference text remains unparsed. No profile schema or autonomous interpretation. Future reasoning itself is V3. |
| 21–22, 41: detailed History, legacy records, corrections and full backup/restore/merge | implemented in V2 | Session-oriented History and date-only legacy presentation; ordered set links; complete JSON includes active guidance/request history. Regression round trips and conflict checks. |
| 23, 26.5: factual trainer performance evidence and explainable comparisons | implemented in V2 | Exact actual exercise/unit context, supporting IDs, deterministic arithmetic; conservative review/insufficient_evidence, recommendation=null. No autonomous prescriptions. |
| 23, 33: coaching judgment about progression, pain, substitutions or readiness | intentionally deferred to V3 | Future trainer uses evidence; no hidden weight/rep/rest/progression engine in GymBro. |
| 10, 25, 38: lightweight iPhone/manual dashboard and reviewed manual JSON Inbox | implemented in V2 | Seven preserved views, manual fallback, compact History and existing reviewed import interface. No accounts or external services. |
| 26.6, 40: reload/reopen, quota rollback, stale tabs, retries and interruption models | implemented in V2 | M6 runtime protections plus complete regression suite. Automated checks establish only the modeled cases. |
| 26.6, 40: physical iPhone Safari reliability acceptance | actual V2 discrepancy | M6 was accepted/merged, but device/iOS/browser/individual results remain unrecorded. Explicit release-completion/merge gate; not evidence of a proven failure or permission to fabricate results. |
| 26.7: CI/version checks/release procedure/API baseline/rollback | implemented in V2 | Implemented in the M7 preparation branch; hosted CI/preview outcomes must be recorded in the PR. Not accepted main/production until gates pass and user authorizes merge. |
| 26.7, 43: verified production baseline and V2 completion artifact | actual V2 discrepancy | V2_RELEASE.md is preparation only; final M7 production SHA/deployment, backup and smoke-test results remain pending by design. Close only after gated approved merge and verification. |
| 39: canonical application build independent of schema | implemented in V2 | Fixed committed APP_VERSION, UI/export matching and release checks; schema remains 7. |
| 40–41: zero-loss durability under storage eviction or simultaneous browser writes | accepted V2 limitation | localStorage is quota/eviction-limited, no cross-tab atomic CAS, cloud recovery or draft recovery. Successful writes are synchronous and observed conflicts rejected; complete backups remain necessary. |

## Historical release decision

Future ChatGPT/voice/coaching behavior is intentionally V3, not a V2 gap. Persisted reordering and live-session mode/plan adaptation are explicit underlying V2 discrepancies; they require a documented product decision (accepted exception or separately scoped work), not a release-engineering feature expansion. Missing physical results and M7 final deployment evidence are open gates. This audit must not be used to silently declare the PRD satisfied or V2 complete.
