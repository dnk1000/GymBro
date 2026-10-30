# GymBro application version and release policy

Decision: [issue #43](https://github.com/dnk1000/GymBro/issues/43), October 27, 2026 (America/New_York). The user approved the policy and selected **`3.1.0` = #38 infrastructure foundation alone** in the implementation conversation. Documentation delivery remains subject to PR review and explicit merge approval.

This policy supersedes the M0 milestone-to-minor mapping and older roadmap version wording for V3. It does not renumber historical releases, authorize another issue, approve a deployment, or change data compatibility. The #43 documentation decision produced no application build: its baseline was `2.7.2-20261027T152907Z`, workout schema 7. The subsequent #38 candidate is tracked in [V3_RELEASE.md](V3_RELEASE.md); a candidate is not an accepted Production release.

## Version components

Keep `MAJOR.MINOR.PATCH-BUILD`:

| Component | Meaning |
| --- | --- |
| MAJOR | Product generation. V3 is the persistent-data/core-product-maturity generation. |
| MINOR | Accepted release increment within the generation, independent of issue number, implementation order, capability label, or historical milestone number. Start the planned V3 sequence at `3.1.0`; subsequent feature releases increment MINOR and reset PATCH to 0. |
| PATCH | Non-feature bugfix or non-functional application release within a minor. Increment for each deployable fix, including Preview fixes; a fix does not consume a new minor. |
| BUILD | Fixed, committed UTC timestamp in `YYYYMMDDTHHmmssZ` form identifying each deployable code build. Never generated at page load. |

A release may contain one or several accepted issues. Each issue normally retains its own focused PR and acceptance evidence. Bundling issues requires an explicit approved mapping; dependency order or merged PRs alone do not choose a release bundle. A proposed Preview version identifies a candidate, not an accepted Production release or completion of the V3 generation.

## First planned V3 release

| Application version | Included implementation issue | Meaning and limits |
| --- | --- | --- |
| `3.1.0-BUILD` | [#38 — Preview/Production Environment and Database Migration Pipeline](https://github.com/dnk1000/GymBro/issues/38) only | Initial V3 infrastructure foundation: reproducible environment/configuration boundaries and database migration mechanics, within #38's execution contract. No recoverable-account feature, personal workout migration, or Production cutover is included. |

`BUILD` above is a placeholder, not a timestamp to commit. Choose the actual UTC timestamp when producing the first deployable #38 build. This initial generation/release assignment applies even though #38 is infrastructure work; later non-feature application releases use PATCH.

Issue #43 is the documentation prerequisite, not a second bundled application feature. Issue #27 account access remains separate from `3.1.0`. On October 27, 2026 the user explicitly approved `3.2.0` for #27 in its implementation conversation. The user subsequently approved **`3.3.0` for #16 alone** in the #16 implementation conversation. These mappings do not declare Production acceptance. Issues #17–#18 and the remaining backlog have no application minor assigned by this decision. No `3.0.0` release is implied or invented.

If #38 ultimately produces only documentation/development tooling and no deployable application or deployment-configuration change, do not force a version bump to fill the reservation. Record that outcome and obtain an explicit revised mapping before another issue uses `3.1.0`. Starting #38, any merge, and any Production action still require their own authorization.

## Capability labels are not application versions

Keep the existing issue titles; identify them by issue number and capability:

| Existing title label | Capability | Application-release implication |
| --- | --- | --- |
| [V3.0 / #16](https://github.com/dnk1000/GymBro/issues/16) | Exercise Identity Architecture | None; not application `3.0.0`. |
| [V3.1 / #17](https://github.com/dnk1000/GymBro/issues/17) | Exercise Catalog Management | None; not the planned application `3.1.0`. |
| [V3.2 / #18](https://github.com/dnk1000/GymBro/issues/18) | Smart Import Resolution | None; not an assignment to application `3.2.0`. |

These are inherited capability labels, including references between those issues. Use issue numbers for dependencies and full application versions for builds. Do not infer release content from title prefixes.

The user explicitly approved **3.5.0 for #39 alone** on October 28, 2026. The approved [relational proposal](V3_RELATIONAL_SCHEMA_PROPOSAL.md) and issue #39 record this mapping. It does not approve personal migration, Production delivery or merge.

## When to change the version

On October 27, 2026 the user explicitly approved **`3.4.0` for #25 alone** in the #25 implementation conversation. Its independent workout schema is 8 for explicit note scopes; this mapping is not Production acceptance or merge approval.

- Documentation-only changes, planning decisions and release-history corrections change neither version components nor BUILD, even if the hosting integration automatically republishes the unchanged application.
- Development-only tests/tooling changes do not create an application release by themselves. Changes to shipped runtime assets, dependencies or executable deployment configuration require a deployable build. A non-feature change within an existing release increments PATCH and BUILD; a new feature follows an approved minor-release mapping.
- Set BUILD once in the code commit for each new deployable build, including Preview fixes. Multiple files in that build share the same value. A new fix commit gets a new PATCH and UTC BUILD; documentation-only follow-up commits do not.
- Reload, test execution, retrying CI, or redeploying/promoting the exact same code build does not change BUILD. Never generate a different version per environment. Promotion is still subject to the applicable approval and acceptance gates.
- Record the exact version, included issues/PRs, code revision, independent schemas/migrations and evidence in release documentation. Keep candidate/Preview lineage separate from accepted shipped entries in [RELEASE_HISTORY.md](RELEASE_HISTORY.md).

## Canonical source and release checks

[app-version.js](../app-version.js), through its immutable `APP_VERSION`, remains the only canonical application-version source. The UI, Help version label, diagnostics and complete JSON exports consume it. This document defines policy and planned mappings; it is not a second runtime version source. Private npm tooling metadata must not introduce another application version.

[scripts/check-release.cjs](../scripts/check-release.cjs) validates the current build against release records, timestamp format, immutability, schema expectations and the absence of duplicate runtime version literals. #43 retained its V2 expectations; #38 updates them and [tests/release-tools.test.cjs](../tests/release-tools.test.cjs) to the `3.1.0` candidate and independent schema 7, using [V3_RELEASE.md](V3_RELEASE.md). They do not calculate versions from issues or milestones.

Each deployable code PR must keep those expectations/tests, the corresponding release record and changelog/build lineage aligned. Keep historical [V2_RELEASE.md](V2_RELEASE.md) intact and retain literal UTC BUILD, immutable metadata, documentation consistency, independent schema compatibility and single-source runtime checks. Do not disable assertions to accept a new version.

## Independent schemas and migrations

Application versions do not define storage, backup or interchange compatibility. Current complete JSON backups retain `appVersion` for exporting-build metadata and `version` for the data schema; do not add a duplicate `dataVersion`. Supported old backups without `appVersion`, and backups from a different application build with a supported schema, remain valid.

Keep workout `DATA_VERSION`, any future explicitly versioned cloud/backup schemas, database migration identifiers and `gym-tracker-chatgpt-v1` interchange semantics independent of application MINOR/PATCH/BUILD. A schema change requires its own approved migration and backward-compatibility contract; neither bumping an app version nor assigning a release authorizes one. Record applicable schema versions/migration identifiers alongside each release, without inventing future values here. Code rollback never implies safe data downgrade.

The user explicitly approved **3.6.0 for #40 alone** on October 30, 2026, with the [concurrency design](V3_CONCURRENCY_PROPOSAL.md). This is a candidate mapping, not Production acceptance or merge approval.

The user explicitly approved **3.7.0 for #20 alone** on October 30, 2026 in the #20 implementation conversation. This maps the History disclosure feature to its own candidate; no acceptance, merge or Production approval is implied.

The user explicitly approved **3.8.0 for #21 alone** on October 30, 2026 in the #21 implementation conversation. This maps exercise-level History disclosure to its own candidate; no acceptance, merge or Production approval is implied.

The user approved **3.9.0 for #36 alone** on October 30, 2026 in its implementation conversation. Separate unmerged PR; no Production or acceptance approval.
The user approved **3.10.0 for #22 alone** on October 30, 2026, following #36 in a separate PR from accepted main. No acceptance, merge or Production approval.

On October 30, 2026 the user approved **3.11.0 for #36/PR #69** after #22/PR #70 merged as 3.10.1. This supersedes #36's prior 3.9.x mapping for subsequent builds; historical builds/evidence remain intact. No merge, Production or device acceptance approval.
