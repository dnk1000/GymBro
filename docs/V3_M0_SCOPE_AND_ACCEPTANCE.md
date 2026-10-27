# V3 Milestone 0 — scope and baseline acceptance

Decision date: October 27, 2026 (America/New_York).

**Later version-policy decision:** [issue #43 / VERSION_POLICY.md](VERSION_POLICY.md) supersedes only this record's milestone-to-minor mapping. The first planned `3.1.0-BUILD` now maps to #38 infrastructure foundation alone, not M1/#27 account access. The original approval below remains historical evidence; its storage, backup and physical-device gates are unchanged. Use current GitHub issues for implementation scope.

**M0 product decisions and documentation work: complete.** The user explicitly approved the scope below, connectivity-required saves, and deferral of physical-iPhone/personal-backup gates through M1 Preview-only work to before M2 migration testing. Documentation delivery remains subject to PR review/merge. This record does not declare V2 physically accepted or authorize execution of M1 in the M0 task.

**M1 readiness:** ready for a separately requested Preview-only account milestone after the M0 record is accepted into main. The user must explicitly launch M1; no account implementation, live configuration or production change was performed in M0. M2 remains blocked until its deferred evidence gates are satisfied.

## Verified starting baseline

| Item | Evidence and limit |
| --- | --- |
| Repository and checkout | `dnk1000/GymBro`; existing Windows GymBro checkout. Clean at M0 start; no user changes were discarded. |
| Accepted main | `ffd556e154ec19752c9f44031a95890d5954f200`, fetched from GitHub on October 27, 2026; [PR #13](https://github.com/dnk1000/GymBro/pull/13) merged. |
| App version | `2.7.2-20261027T152907Z`, from [canonical metadata](../app-version.js); also read from the existing Production version asset during M0. |
| Data schema | `7`, from [workout-data.js](../workout-data.js). Application versions do not determine backup compatibility. |
| Active workout persistence | Browser localStorage, existing key `daveGymTrackerV1`. No workout migration or recoverable GymBro account exists. |
| PR #11 | [Merged](https://github.com/dnk1000/GymBro/pull/11) at `38624d46268b638b78a37212453b075576f93cc2`; 2.7.1 workflow verification. Recorded Production smoke used a disposable browser context, not the user's personal data or a physical iPhone. |
| PR #12 | [Merged](https://github.com/dnk1000/GymBro/pull/12) at `9db26f36626a0073d4939b28e2f93d4e54953e17`; optional Supabase diagnostic. Final head `c6f42c419b8490b0870e9e4eb417bdd00b137c8e`; [CI 40536834968](https://github.com/dnk1000/GymBro/actions/runs/40536834968) completed successfully. Earlier pending/unmerged text is historical. |
| PR #13 | Documentation organization only; head `fa8ee461d7b03bbf5c0b498c06258138bb4b9ca0`; [PR CI 40539985324](https://github.com/dnk1000/GymBro/actions/runs/40539985324) passed. The prior task recorded 153 local regression passes. |
| Current main CI | [Push run 40540523451](https://github.com/dnk1000/GymBro/actions/runs/40540523451), exact main SHA above: completed successfully. Read through GitHub CLI because the connected workflow-list tool returns PR-triggered runs only. No application suite rerun in M0. |
| Vercel deployment | GitHub's Vercel status is success for exact main SHA; [deployment](https://vercel.com/dnk-9999/gymbro/HGXbWFL3JAXcQBm6vkXyf5wxbkUk). No deployment/settings change in M0. |
| Live Production read | [Existing production](https://gymbro-v15.vercel.app/) and [version asset](https://gymbro-v15.vercel.app/app-version.js) returned HTTP 200; asset declares 2.7.2 and build 20261027T152907Z. This establishes served metadata, not a new interactive smoke test or personal-data verification. |
| Supabase checkpoint | [Recorded live Save/reload/fresh Read](SUPABASE_CONNECTION_TEST.md) and matching row verified on October 27, 2026 in project `loowxditqikcwyeftfgx`. Production disables this diagnostic. Does not establish workout persistence, durable account recovery or comprehensive user isolation. |
| Planning proposal | [PR #14](https://github.com/dnk1000/GymBro/pull/14) was open/unmerged at M0 verification. Read the [plan at ceaa676](https://github.com/dnk1000/GymBro/blob/ceaa676aff05cb30a3823975d5234690ab8e8983/docs/V3_IMPLEMENTATION_PLAN.md) as a proposal. M0 starts from main, not that branch; this PR does not merge or copy the unaccepted plan into main. |

## Explicit user decisions

Approval evidence: in the M0 conversation on October 27, the user answered **"Approve this scope"**, **"Yes—connectivity required initially"**, and **"defer to M2 migration testing"** to the three decision questions. The approved scope is enumerated below so future prompts do not need to infer it from shorthand.

| Decision | Status | Accepted meaning |
| --- | --- | --- |
| Cloud persistence first | Approved | First delivery phase is M1 recoverable access, M2 complete migration/persistence on Preview, M3 controlled cutover/local workout-storage retirement. Each receives its own implementation request and review. |
| Recoverable sign-in | Approved | Same personal user can sign in, sign out and recover access across browsers/devices. The anonymous diagnostic identity is not the accepted long-term account experience. |
| Initial audience | Approved | Personal use; private data ownership, no sharing, teams or collaboration features. Test identities may be used to verify isolation. |
| Preview/Production separation | Approved | Disposable Preview tests must not modify actual Production workout data. M1 is Preview-only; M0 creates no infrastructure or live configuration. |
| Authoritative workout store | Approved future outcome | Supabase becomes the sole active workout store after verified cutover. No indefinite dual writes or automatic local-only fallback. Current V2 remains localStorage-based until the approved transition. |
| Other browser storage | Approved | Browser storage may retain authentication state and harmless preferences; it must not become a competing workout database. |
| Legacy local data | Approved | Retain the old local workout copy inactive after cutover until verified migration and a deliberate cleanup decision. No automatic deletion during initial migration. |
| Connectivity | Approved | Initial cloud release requires connectivity to save. Keep visible unsaved input on failure, offer deliberate retry, and confirm saved only after durable storage acknowledges it. Offline workout logging is outside initial scope; unsaved input is not promised to survive a browser restart. |
| Existing product/data | Approved and continuing contract | Preserve seven views, manual/guided workflows, all historical fields/IDs/relationships, program/preferences, import duplicate protection and JSON import/export compatibility. No unrelated redesign or changed training policy. |
| Reordering and active-duration gaps | Approved disposition | Carry the two actual V2 gaps to V3 M4. This accepts their absence for the baseline and M1–M3; it does not mark them implemented or remove them from the PRD. |
| Version numbering | Approved | M0 documentation does not bump 2.7.2. M1 initial code release is `3.1.0-BUILD`; M2 `3.2.0-BUILD`, etc. Fixes increment PATCH; BUILD is a committed UTC timestamp. Schema version changes only for a separately justified data change. |
| Later trainer work | Approved boundary | M4 and later features require separately scoped requests. Trainer/conversation/voice implementation remains conditional, not authorized merely by this plan. |
| V2 evidence deferral | Approved | Physical-iPhone acceptance and verified personal complete JSON backup are deferred through M1 Preview-only account work. Both must be satisfied before M2 migration testing. Deferral does not turn untested checks into passes. |

No M0 product decision remains unresolved. The actual sign-in method and later trainer experience are implementation/product choices to resolve in their respective milestone prompts; M0 selects no provider protocol, architecture, database design or voice technology.

## Remaining evidence and owners

| Gate | Required evidence | Owner / deadline |
| --- | --- | --- |
| Physical iPhone Safari | Device, iOS/Safari version, app build, commit, URL, tester/date; individual Pass/Fail/Not tested results and defect retests for the 19 M6 checks below. | User/physical-device tester; before M2 migration testing. Developer resolves reported defects. |
| Personal Production backup | Complete JSON exported from the user's actual Production origin; date/build/schema recorded, saved file accessible and parseable, expected personal records/settings present, original retained. CSV or a disposable seeded-context export does not satisfy this. Do not commit the personal backup. | User verifies their browser/file; agent may assist with a separately authorized local read. Before M2 migration testing, refresh if data changed. |
| Personal existing-data confirmation | User confirms expected personal History/program and active-workout state on the served build. M0's HTTP reads and PR #11's disposable smoke are not that evidence. | User, alongside backup/baseline acceptance before M2. |
| M1 acceptance | Recoverable access on a second browser/device, isolation between test users, Preview/Production separation and existing local workout behavior preserved. | M1 developer plus user tester, on exact PR Preview before accepting M1. |
| Production cutover | Verified complete migration, recovery rehearsal, post-cutover data check and explicit rollout approval. | M3 developer/user; cannot be inferred from M0 approval or a documentation merge. |

The exact physical checklist remains in [REAL_PHONE_SMOKE_TEST.md](REAL_PHONE_SMOKE_TEST.md#milestone-6--physical-iphone-acceptance-pending). Its original build/device placeholders are historical; record the actual tested current build and commit.

| Existing check numbers | Required physical behavior |
| --- | --- |
| 1–3 | Start the 30-minute plan; log multiple/identical intentional sets with fields/order intact; rapid control taps do not cause unintended commits/navigation. |
| 4–9 | Lock/unlock, app switching, backgrounding, immediate reload, Safari reopen and existing-tab resume preserve the one active session and committed progress. |
| 10 | A stale second tab rejects edits, preserves newer data and recovers after deliberate reload. |
| 11–12 | Substitution preserves original intent and earlier sets; Done/Skip and navigation remain distinct; cancel an unsaved-input discard. |
| 13–14 | Keyboard, focus, scrolling, reachable controls, portrait/landscape and Safari chrome changes remain usable without page overflow or state changes. |
| 15–16 | Finish cancellation/confirmation, pending statuses, completion and History/corrections preserve actual records. |
| 17 | Preview-only complete JSON export/restore/export, Files access and equality of every supported section, including active guidance/request history. |
| 18–19 | Manual logging with/without an active session and browser Back/Forward/navigation preserve correct association and lifecycle. |

Missing results remain **Not tested / unverified**. V2 final physical/personal-data acceptance remains incomplete despite the authorized deferral and merged releases.

## Scope and exclusions

M0 authorizes documentation, read-only baseline verification and recorded decisions. The next proposed implementation scope is M1 recoverable access/private ownership on the existing project's Preview, preserving all current local workout behavior. Account work must not upload or migrate workouts.

No application implementation, architecture, database/table design, SQL, infrastructure, environment-variable change, real-data mutation, version bump, deployment action or merge occurs in M0. No new project/environment, abandoned PR #9 reuse, UI redesign, sharing/team functionality, offline write queue, trainer runtime or voice work is approved here. The existing repository, Windows checkout and Vercel project remain the workflow.

## M1 readiness and authorization

- [x] Main/app/schema and CI/deployment evidence identified; stale current records corrected without changing historical audit classifications.
- [x] Cloud/access scope, connectivity, storage retirement boundaries and version mapping explicitly decided.
- [x] V2 adaptation gaps explicitly assigned to M4; device/backup evidence explicitly deferred only through M1.
- [x] Existing data/feature contracts and Preview-only boundary retained in the governing documents.
- [ ] M0 documentation PR accepted/merged through explicit user approval; refresh main before M1.
- [ ] User explicitly requests execution of the separately scoped M1 prompt.

**M0 decision work is complete; the documentation PR is the reviewable deliverable. M1 is ready to be requested, but is not started or authorized for execution by this M0 task.** The earlier evidence gates do not block M1 Preview-only account work under the explicit deferral. They do block M2 migration testing until satisfied. No further scope-approval question is needed for decisions already recorded above.

The [draft M1 prompt](V3_M1_PROMPT.md) carries these decisions forward for a separate user-requested task; it has not been executed.
