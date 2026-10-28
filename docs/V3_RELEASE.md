# V3 scoped-notes release candidate

Release status: **preparation**
Application version: `3.4.0-20261027T235417Z`
Data schema: `8`

Implements #25 alone; branch `codex/issue-25-note-scopes`, based on accepted main `08c57e38c7d8b0a68a78602a350f83b870a093c4`. The user approved 3.4.0 for #25 in this implementation conversation. See [note contract and compatibility](NOTE_SCOPES.md). The local key remains `daveGymTrackerV1`; PostgreSQL workout schema/integration and personal migration remain #39/#28. No SQL migration is added.

PR: [#49](https://github.com/dnk1000/GymBro/pull/49), open/unmerged. Runtime revision `18a788293bdf9c78bde9d746ff1667b2fd99ae92`; documentation-only evidence follow-up retains the same build.

Validation level: **3**.

| Evidence | Actual result |
| --- | --- |
| Local complete regression | `node --test tests/*.test.cjs`: 190/190 passed with desktop Chrome in disposable localhost contexts. The first full run was 188/189; the new `saveScopedNote` action was then added to the exact API inventory without removing prior assertions. |
| Final focused checks | 18/18 note-scope + identity tests after preserving direct schema-7 canonical conversion/verification; 17/17 note/release/version checks. Actual complete JSON download/restore repeated at 320/390/1280 px: 3/3 passed. |
| Browser/failure/layout | Five new browser scenarios cover scoped display, escaped text, reload, complete backup/restore, touch targets/no page overflow, quota failure/retry, draft retention across rerenders/occurrences, startup non-writing migration and stale-tab rejection. Screenshots at all three widths inspected at 320/390. Browser page-error assertions passed. Initial sandbox localhost run was denied; authorized reruns passed. |
| Syntax/release/diff/docs | 40 JS files passed syntax; canonical version/schema checks passed; staged/unstaged/base-range whitespace passed; 93 changed-document local links passed. |
| [CI at 18a7882](https://github.com/dnk1000/GymBro/actions/runs/40606811599) | Both regression and disposable database replay passed; syntax/release/diff and full test steps passed. No new SQL migration was required. |
| [Vercel deployment](https://vercel.com/dnk-9999/gymbro/AFt5UBdNV4BLRPjuNVJiWoahqhrZ) / [Preview](https://gymbro-git-codex-issue-25-note-scopes-dnk-9999.vercel.app/) | Deployment ready at `18a7882`. Fresh automated contexts reached Vercel login protection, so no automated live-save pass is claimed. Existing signed-in Chrome served exact 3.4.0 build; Dashboard, Exercises (durable setup/observation controls), and Workout manual/guided entry rendered; console warnings/errors empty. This live smoke was read-only. Save/backup/layout evidence above used disposable localhost contexts. |
| Database / personal / physical | No new SQL or hosted apply, or personal data/backup/migration test. Existing SQL was replayed only in disposable CI. Physical iPhone Safari not tested. #39/#28 own relational persistence/full migration; M0 personal-backup/device gates remain before personal migration. |

Tests use disposable synthetic data/browser storage. No Production configuration/data mutation, merge, acceptance or issue closure is claimed.

## Earlier #16 candidate evidence

# V3 exercise-identity release candidate

Release status: **preparation**
Application version: `3.3.0-20261027T233414Z`
Data schema: `7`

Issue #16 only, based on accepted main `b40156bd943d230bdfa2e636390b85f5be1fd639`; branch `codex/issue-16-exercise-identity`. The user approved 3.3.0 for #16 on October 27, 2026. See [identity contract](EXERCISE_IDENTITY.md). Identity document version 1 and SQL migration `20261027233000` are independent of the unchanged active workout schema 7.

PR: [#48](https://github.com/dnk1000/GymBro/pull/48), unmerged. Runtime implementation `893fa703d1d0bf804948168d90cd5da1bb428a72`; development-only SQL-fixture correction `320f1a0cbbbbdc27bbe95890cf5434db65550bdf` retains the same build.

| Level 3 evidence | Actual result |
| --- | --- |
| Focused identity and local regression | 10/10 identity tests and 177/177 full local tests passed using desktop Chrome and disposable localhost storage. Final focused identity/version tests: 11/11; release-tool tests: 8/8. Initial sandbox full run failed due to localhost/temp-Git restrictions; authorized rerun passed. |
| [CI at 320f1a0](https://github.com/dnk1000/GymBro/actions/runs/40603575072) | Passed 177/177 regressions, syntax for 39 JS files, canonical release and committed-range whitespace. [Database job](https://github.com/dnk1000/GymBro/actions/runs/40603575072/job/122537427430) passed 71 SQL assertions plus 9 generated full-field seed/catalog/set-fact assertions on both fresh and reset databases, followed by no-op apply and metadata verification. |
| Initial SQL-fixture failure | Schema/ownership tests passed 71/71, but the generated fixture used a temporary table referencing a permanent table, forbidden by PostgreSQL. Corrected only the development test to create a transaction-scoped fixture table that is rolled back. Assertions were retained; no runtime/SQL migration change. |
| Existing staging apply/retry | Applied only `20261027233000` at clean reviewed `320f1a0` to `obebuvpsqapgevwivwho`. Repeat dry-run/apply reported up to date. PostgreSQL 17.11 ledger includes the migration; both exercise/alias tables have RLS enabled with owner PERMISSIVE and permanent-user RESTRICTIVE policies. No workout data was loaded. |
| [Vercel deployment](https://vercel.com/dnk-9999/gymbro/2ucD2DLZ7THR3JXeTzzRH2ptwijA) and [Preview](https://gymbro-git-codex-issue-16-exercise-identity-dnk-9999.vercel.app/) | Deployment passed. Actual desktop Chrome Preview showed the exact build in title/footer; Dashboard and Data loaded, console warning/error log empty. This is a read-only smoke; no personal database or migration was exercised. Existing local browser regressions include 320/390/desktop widths; no live responsive or physical Safari claim. |
| Documentation checks | 84 changed-document local link targets passed. |
| Local database / physical device / personal data | Local Supabase start unavailable (`LocalDbRunningError`), so no local SQL pass. Physical iPhone, personal backup verification, full relational/personal migration and cloud workout parity not performed; M0 personal-data gates remain before #28. |

No Production configuration/schema/data operation, local workout conversion, cutover, issue closure or merge is claimed. #16's identity foundation is available for #39/#28; acceptance of full cloud workout migration still belongs to those later issues.

## Earlier #27 candidate evidence

Historical application version: `3.2.2-20261027T225348Z`, schema 7; based on main `1631253ba092af2ad7e3a017ccdcbb40fb5dd0cf`. The user approved 3.2.0 for #27. See [account contract and evidence](V3_ACCOUNT_ACCESS.md).

## Earlier #38 candidate evidence

# V3 infrastructure release candidate

Historical release status: **preparation**
Historical application version: `3.1.1-20261027T214344Z`
Historical data schema: `7`

Scope: [issue #38](https://github.com/dnk1000/GymBro/issues/38) alone under [VERSION_POLICY.md](VERSION_POLICY.md). Preview environment enforcement and reproducible diagnostic-schema migration/replay tooling; no account feature or workout cloud persistence. Production remains the accepted local workout app until explicitly approved delivery through the existing Vercel integration.

Baseline main `a0e9698`; branch `v3/issue-38-environment-migration-pipeline`; [PR #46](https://github.com/dnk1000/GymBro/pull/46), unmerged. Validated code revision `e08fd049cde492495964666fc204f7ea23da263a`; documentation evidence updates retain this build timestamp. Migration `20261027213000_connection_probe.sql` is independent of workout schema 7. Preview: `obebuvpsqapgevwivwho`; future Production: `loowxditqikcwyeftfgx`. See [the infrastructure procedure](V3_INFRASTRUCTURE.md).

Migration SHA-256 over LF-normalized source: `6179e07b43d3f2c28b2af034a1afa1a2fda7dc78f1baf12a8f6689be4764dc2c`.

## Level 3 validation

| Evidence | Status |
| --- | --- |
| Environment guards and diagnostic regression | Passed locally, including Production/unknown/mismatched target refusal and no workout writes. |
| Full action/browser suite | 157 passed, 0 failed, 0 skipped on Windows, then [V2 regression CI passed](https://github.com/dnk1000/GymBro/actions/runs/40589755400/job/122490603958) on code revision above. Initial stale V2 assertion was corrected before the successful full rerun. Twelve focused infrastructure/version checks also passed after the CLI fix. |
| Syntax/release/whitespace | Syntax (31 JS files), canonical 3.1.1/schema-7 metadata, 78 local documentation links, working-tree/staged and committed-range whitespace passed. CI also passed syntax/release/committed-range checks. |
| Empty DB replay, pgTAP policies, no-op retry | [Disposable database replay CI passed](https://github.com/dnk1000/GymBro/actions/runs/40589755400/job/122490603635): both 13-assertion pgTAP runs, empty replay, no-op retry and single-statement metadata query. Initial CI caught the prepared-query incompatibility; corrected before this successful run. Local Docker unavailable; no local DB pass claimed. |
| Live Preview migrations/apply/retry/schema | Baseline applied on reviewed `b6fb0b6`; local/remote ledger both `20261027213000`. Repeated apply on final code revision reported no migrations; known disposable row remained intact. Metadata verification passed: PostgreSQL 17.11, RLS enabled, three owner-only policies; authenticated SELECT/INSERT/UPDATE only, no anon grants. |
| Vercel Preview scopes/endpoint/Save/reload/Read | All five public diagnostic settings are branch-only Preview overrides, using the existing staging publishable key. [Deployment succeeded](https://vercel.com/dnk-9999/gymbro/HiZ93Ugp1Kfz7mKfXqFqEw5wgWXw). On the [exact branch Preview](https://gymbro-git-v3-issue-38-environment-migration-pipeline-dnk-9999.vercel.app/), saved `gymbro-issue38-20261027-preview`, reloaded, then retrieved it through a fresh Read with the same identity. Matching staging row verified by a read-only query after migration retry. |
| Normal workout compatibility on live Preview | Logged one explicitly disposable Seated Row set (1 lb × 1), reloaded, and verified its tagged note in History. Browser warning/error log empty after reload. Automated diagnostic tests also verify normal workout saves make no Supabase writes. |
| Supabase automatic PR-branch check | Skipped by integration: per-PR branches are disabled on the existing Free setup. Explicit shared staging migration/Preview evidence above is used instead; no paid branching assumed. |
| Production schema/data operation | Not performed; outside #38. |
| Physical iPhone/personal backup | Not tested in #38; M0 gates remain before workout migration. |

This is preparation/evidence, not Production acceptance or authorization to merge, tag, operate on Production or start another issue.

Live setup approval: the user explicitly approved the project assignments and, after the first Save exposed disabled anonymous Auth, approved enabling **Allow anonymous sign-ins** only on GymBro-Staging for the diagnostic. That setting was saved and verified; other Auth settings were preserved. Both hosted GitHub automatic database-production-deploy toggles are OFF (future Production already OFF; staging turned OFF). Vercel Production variables/schema/data were not changed. A read-only visit to the [Production config endpoint](https://gymbro-v15.vercel.app/api/supabase-probe-config) returned `{"enabled":false}`. No personal workout database or backup was accessed.

Preview lineage: `3.1.0-20261027T212930Z` introduced #38; `3.1.1-20261027T214344Z` fixes the CLI metadata-verification invocation. Both belong solely to #38, with no workout-schema change.
