# GymBro release history

This file records accepted milestone releases and the preview builds that led to them. Application version is independent of data schema. Build timestamps are UTC and come from the committed `app-version.js`; no versions or device-test results are inferred retroactively. See [CHANGELOG.md](CHANGELOG.md) for detailed changes.

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

- Use MAJOR.MINOR.PATCH-BUILD: product generation, milestone, non-feature/bugfix release, committed UTC build timestamp.
- Data schema 5 upgrades conservatively to 6; legacy sets stay sessionless with their original fields and IDs. Keep the storage key `daveGymTrackerV1`.
- Schema 6 backups include sessions and active state. `appVersion` identifies the exporting build; the existing `version` field controls data compatibility. Older backups without application metadata remain supported. Version-5 applications cannot read schema-6 databases; retain pre-upgrade backups rather than forcing a downgrade.
- Documentation-only release-history updates do not change the application version or schema.
- Update this file for each accepted release, recording the exact canonical version, schema, application revision, PR and meaningful changes. Keep preview builds distinct from accepted releases. The linked PR records the final merge commit; record production verification only after it succeeds.
- Automated testing and production deployment checks are not physical iPhone acceptance. Record actual device/browser/results separately in [REAL_PHONE_SMOKE_TEST.md](REAL_PHONE_SMOKE_TEST.md).

## Supabase storage review candidate — not accepted production

`3.0.0-20261027T022348Z`, workout schema 7, branch `v3/supabase-storage`, from main `d2e6223`. This is a fresh storage-only implementation, separate from the abandoned unmerged PR #9. Deployment/physical-device/production acceptance must be recorded separately; the candidate is not an accepted production release.
