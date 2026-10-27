# V3 account-access release candidate

Release status: **preparation**
Application version: `3.2.2-20261027T225348Z`
Data schema: `7`

Issue #27 only, based on accepted main `1631253ba092af2ad7e3a017ccdcbb40fb5dd0cf`. The user approved 3.2.0 for #27 on October 27, 2026. See [account contract and evidence](V3_ACCOUNT_ACCESS.md). No workout migration, Production schema/data operation, merge or physical iPhone acceptance is claimed.

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
