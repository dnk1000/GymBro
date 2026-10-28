# GymBro release history

This file records accepted milestone releases and the preview builds that led to them. Application version is independent of data schema. Build timestamps are UTC and come from the committed `app-version.js`; no versions or device-test results are inferred retroactively. See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

## V3 scoped-notes candidate — not yet accepted

`3.4.0-20261027T235417Z`, workout schema 8; #25 alone, approved by the user in the implementation conversation on October 27. Based on accepted main `08c57e3`, branch `codex/issue-25-note-scopes`; [PR #49](https://github.com/dnk1000/GymBro/pull/49), runtime `18a7882`. Code CI passed both jobs; local 190/190 regression, scoped-note JSON roundtrip at three widths and signed-in read-only Preview smoke passed. Separate note scopes and conservative schema-7 compatibility; same local workout authority. See [note contract](NOTE_SCOPES.md) and [candidate evidence](V3_RELEASE.md). This is candidate lineage; no Production delivery, personal migration, physical-device test, issue closure or merge is claimed.
## V3 exercise-identity candidate — not yet accepted


`3.3.0-20261027T233414Z`, active workout schema 7; #16 alone, with identity document version 1 and database migration `20261027233000`. Based on accepted main `b40156bd943d230bdfa2e636390b85f5be1fd639`; user approved this release mapping on October 27. [PR #48](https://github.com/dnk1000/GymBro/pull/48) was unmerged at evidence capture and is verified merged at [`08c57e3`](https://github.com/dnk1000/GymBro/commit/08c57e38c7d8b0a68a78602a350f83b870a093c4); runtime revision `893fa70`, test-only correction `320f1a0`. Canonical IDs/aliases and lossless conversion foundation; current workout authority remains local. CI at `320f1a0` passed 177/177 regressions and both fresh/reset SQL runs (71 + 9 assertions each); staging additive apply/retry and live read-only Preview passed. See [identity contract](EXERCISE_IDENTITY.md) and [candidate evidence](V3_RELEASE.md). No personal migration, Production acceptance, cutover or physical-device result is claimed.

## V3 account-access candidate — not yet accepted

`3.2.2-20261027T225348Z` (earlier fix `3.2.1-20261027T224326Z`; initial Preview `3.2.0-20261027T222451Z`), workout schema 7; #27 only, approved release mapping in the October 27 implementation conversation. See [account evidence](V3_ACCOUNT_ACCESS.md). No Production acceptance, migration or cutover is claimed.

## V3 infrastructure candidate — not yet accepted

`3.1.1-20261027T214344Z`, workout schema 7, implements #38 alone; initial Preview build was `3.1.0-20261027T212930Z`. See [V3_RELEASE.md](V3_RELEASE.md) for Preview/CI evidence and [V3_INFRASTRUCTURE.md](V3_INFRASTRUCTURE.md) for environment/migration contracts. This is candidate lineage, not a shipped Production entry.

## Delivered connection checkpoint and documentation organization

- Application version: `2.7.2-20261027T152907Z`; data schema: `7`.
- Branch: [v3/supabase-connection-check](https://github.com/dnk1000/GymBro/tree/v3/supabase-connection-check), from main `38624d46268b638b78a37212453b075576f93cc2`.
- The subsequent standalone documentation baseline `e5f87a538dc2be8212d723024718e283816c748b` is incorporated; accepted workflow/quarantine guidance remains intact with only the narrow diagnostic exception documented.
- Optional Preview/local diagnostic only: one separate test value, anonymous Auth and owner-only RLS; normal workout persistence remains local. No archived V3 code is merged.
- Live Save -> reload -> fresh Read and matching Supabase row were verified on 2026-10-27 after user-applied setup. RLS is enabled and the expected policies are present. [PR #12](https://github.com/dnk1000/GymBro/pull/12) merged at `9db26f36626a0073d4939b28e2f93d4e54953e17`; its final-head [CI run](https://github.com/dnk1000/GymBro/actions/runs/40536834968) passed. The checkpoint adds no workout migration and remains disabled in Production. See [setup and manual verification](SUPABASE_CONNECTION_TEST.md).
- [PR #13](https://github.com/dnk1000/GymBro/pull/13) moved project guides into `docs/`, adjusted links and release-tool paths, and merged at `ffd556e154ec19752c9f44031a95890d5954f200`. App build/schema did not change. [PR CI](https://github.com/dnk1000/GymBro/actions/runs/40539985324) and [main CI](https://github.com/dnk1000/GymBro/actions/runs/40540523451) passed; [Vercel deployment](https://vercel.com/dnk-9999/gymbro/HGXbWFL3JAXcQBm6vkXyf5wxbkUk) reports success. M0 read-only checks confirmed the existing Production homepage/version asset return HTTP 200 and serve 2.7.2. They are not physical-device or personal-data smoke evidence.
- [V3 M0](V3_M0_SCOPE_AND_ACCEPTANCE.md) records approved future cloud scope and the explicit deferral of physical-iPhone/personal-backup evidence through M1 Preview-only work to before M2 migration testing. No V3 application build is produced by this documentation milestone.

## Delivered workflow verification patch

- Application version: `2.7.1-20261027T142145Z`; data schema: `7`.
- Branch: [v2/patch-2.7.1-workflow-verification](https://github.com/dnk1000/GymBro/tree/v2/patch-2.7.1-workflow-verification), from main `d2e6223f5d6020cb63c249ade4c02acaa7fe7cbd`.
- Scope: canonical version/build, matching version-check expectations and release notes only. The PR records its exact tested revision and hosted CI/preview results.
- Delivery: [PR #11](https://github.com/dnk1000/GymBro/pull/11), approved and merged at `38624d46268b638b78a37212453b075576f93cc2`; main CI and automatic Vercel production deployment passed. Live smoke at the usual production origin passed in a disposable context, including export/restore/export. Personal data and physical iPhone acceptance remain separately unverified. This patch does not close the outstanding V2 acceptance evidence or start the Supabase migration.

## Milestone releases

| Application release            | Data schema | Source and approval                                                                                                                                                                                                             | Changes                                                                                                                                                                                                                |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2.7.0-20261025T002624Z` | 7 | [PR #8](https://github.com/dnk1000/GymBro/pull/8); user explicitly approved and instructed merge; application/release preparation revision [1eb83c9](https://github.com/dnk1000/GymBro/commit/1eb83c9), CI follow-up [6e782b1](https://github.com/dnk1000/GymBro/commit/6e782b1). | CI, release validation, architecture/API contracts, PRD audit and delivery/rollback documentation. Physical-device, personal backup and final acceptance evidence remain open; V2 completion is not claimed. |
| `2.6.0-20261023T220541Z` | 7 | [PR #7](https://github.com/dnk1000/GymBro/pull/7); user accepted and authorized merge; application revision [c87ca06](https://github.com/dnk1000/GymBro/commit/c87ca06). Physical-device details/results were not supplied. | Read-only foreground/restoration stale-storage checks, 16px mobile entry text and 44px primary logging targets; expanded interruption, retry and rollback regression coverage. No schema or workout-policy changes. |
| `2.5.1-20261023T215514Z` | 7 | [PR #6](https://github.com/dnk1000/GymBro/pull/6); user accepted and authorized merge; application revision [cb4edd8](https://github.com/dnk1000/GymBro/commit/cb4edd8). | Read-only trainer context and explainable evidence, conservative comparability, and Exercise library session counts. No automatic prescriptions or schema changes. |
| `2.4.0-20261023T202348Z`       | 7           | [PR #5](https://github.com/dnk1000/GymBro/pull/5), merged at [817fc17](https://github.com/dnk1000/GymBro/commit/817fc17); production verified before Milestone 5                                                                | Atomic guided workouts, explicit progress and local substitutions, resume and retry-safe set logging; preserve manual fallback and historical truth.                                                                   |
| `2.3.0-20261023T195607Z`       | 6           | [PR #4](https://github.com/dnk1000/GymBro/pull/4), merged at [fd616fa](https://github.com/dnk1000/GymBro/commit/fd616fa); production verified; application revision [c4ce3c5](https://github.com/dnk1000/GymBro/commit/c4ce3c5) | Session-oriented History with preserved sessionless records, source filters and set corrections; clearer backup, restore, merge and recovery presentation.                                                             |
| `2.2.5-20261023T194400Z`       | 6           | [PR #3](https://github.com/dnk1000/GymBro/pull/3), merged at [14b12a8](https://github.com/dnk1000/GymBro/commit/14b12a8)                                                                                                        | Explicit sessions and active persistence, compatible migration/backups, canonical application version, Help and compact History actions. Production deployment was verified after merge.                               |
| V1.6 branding — v2 Milestone 1 | 5           | [PR #2](https://github.com/dnk1000/GymBro/pull/2), merged at [6f10b49](https://github.com/dnk1000/GymBro/commit/6f10b49)                                                                                                        | DOM-free workout actions, detached state inspection and persist-before-commit behavior; preserve omitted fields on partial edits. The later 2.1.x convention was not yet implemented, so no build version is invented. |

The original V1.6 stabilization included mobile overflow and Latest fixes, safer import/export, data recovery and regression coverage. Its historical details remain in CHANGELOG.md. A final V1.6 baseline tag was not recorded; approval of later milestones does not invent physical-device test details.

## Milestone 2 preview build lineage

Only the final 2.2.5 build above was merged as the accepted Milestone 2 production release. Earlier entries here identify review builds, not separate production releases.

| Preview build            | Application commit                                          | Change                                                                        |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `2.2.5-20261023T194400Z` | [97d2e39](https://github.com/dnk1000/GymBro/commit/97d2e39) | Entry-only acronym tooltips. Accepted Milestone 2 release in PR #3.           |
| `2.2.4-20261023T193842Z` | [e7ae9ca](https://github.com/dnk1000/GymBro/commit/e7ae9ca) | Acronym explanations and explicit completion of corrected incomplete records. |
| `2.2.3-20261023T192129Z` | [dff7c34](https://github.com/dnk1000/GymBro/commit/dff7c34) | Denser History icons and buttons.                                             |
| `2.2.2-20261023T191448Z` | [201ef04](https://github.com/dnk1000/GymBro/commit/201ef04) | Application-wide Help and accessible History icons.                           |
| `2.2.1-20261023T191011Z` | [7c6c99f](https://github.com/dnk1000/GymBro/commit/7c6c99f) | Single-line History dates.                                                    |
| `2.2.0-20261023T190414Z` | [95be2b4](https://github.com/dnk1000/GymBro/commit/95be2b4) | Canonical application version, footer and backup metadata.                    |

The initial session-model extraction was [1062a60](https://github.com/dnk1000/GymBro/commit/1062a60), before canonical application versioning was introduced; it retained V1.6 branding while advancing the data schema to 6.

## Compatibility and maintenance

- Use MAJOR.MINOR.PATCH-BUILD. Historical V2 MINOR values represented milestones; V3 MINOR represents an accepted release increment under [VERSION_POLICY.md](VERSION_POLICY.md). Issue #43's planned `3.1.0` mapping is not a shipped release entry. PATCH identifies non-feature bugfix/non-functional releases; BUILD is a committed UTC timestamp.
- Data schema 5 upgrades conservatively to 6; legacy sets stay sessionless with their original fields and IDs. Keep the storage key `daveGymTrackerV1`.
- Schema 6 backups include sessions and active state. `appVersion` identifies the exporting build; the existing `version` field controls data compatibility. Older backups without application metadata remain supported. Version-5 applications cannot read schema-6 databases; retain pre-upgrade backups rather than forcing a downgrade.
- Documentation-only release-history updates do not change the application version or schema.
- Update this file for each accepted release, recording the exact canonical version, schema, application revision, PR and meaningful changes. Keep preview builds distinct from accepted releases. The linked PR records the final merge commit; record production verification only after it succeeds.
- Automated testing and production deployment checks are not physical iPhone acceptance. Record actual device/browser/results separately in [REAL_PHONE_SMOKE_TEST.md](REAL_PHONE_SMOKE_TEST.md).
