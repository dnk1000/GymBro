# V3 infrastructure release candidate

Release status: **preparation**
Application version: `3.1.0-20261027T212930Z`
Data schema: `7`

Scope: [issue #38](https://github.com/dnk1000/GymBro/issues/38) alone under [VERSION_POLICY.md](VERSION_POLICY.md). Preview environment enforcement and reproducible diagnostic-schema migration/replay tooling; no account feature or workout cloud persistence. Production remains the accepted local workout app until explicitly approved delivery through the existing Vercel integration.

Baseline main `a0e9698`; branch `v3/issue-38-environment-migration-pipeline`. The PR records code SHA/CI/Preview links. Documentation evidence updates retain this build timestamp. Migration `20261027213000_connection_probe.sql` is independent of workout schema 7. Preview: `obebuvpsqapgevwivwho`; future Production: `loowxditqikcwyeftfgx`. See [the infrastructure procedure](V3_INFRASTRUCTURE.md).

## Level 3 validation

| Evidence | Status |
| --- | --- |
| Environment guards and diagnostic regression | Passed locally, including Production/unknown/mismatched target refusal and no workout writes. |
| Full action/browser suite | 157 passed, 0 failed, 0 skipped on Windows; disposable storage. The first run caught a stale V2 version assertion, corrected before this successful full rerun. |
| Syntax/release/whitespace | Release metadata and local whitespace passed; final committed-range check recorded in PR. |
| Empty DB replay, pgTAP policies, no-op retry | Pending automatic CI. Local Docker unavailable; startup reported `failed to inspect service`. |
| Live Preview migrations/apply/retry/schema | CLI authenticated; guarded dry-run identifies only `20261027213000_connection_probe.sql`. Apply/retry and schema inspection pending the clean reviewed commit. |
| Vercel Preview scopes/endpoint/Save/reload/Read | Pending configuration/deployment. |
| Production schema/data operation | Not performed; outside #38. |
| Physical iPhone/personal backup | Not tested in #38; M0 gates remain before workout migration. |

This is preparation/evidence, not Production acceptance or authorization to merge, tag, operate on Production or start another issue.
