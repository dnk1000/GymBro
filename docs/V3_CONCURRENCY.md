# V3 concurrency/revision/retry boundary — issue #40

Implementation candidate from accepted main `7f4408aee7d51ff21aad421bf924c529baaae90e`, branch `codex/issue-40-implementation`. The owner approved [the design](V3_CONCURRENCY_PROPOSAL.md) and **3.6.0 for #40 alone** on October 30, 2026 in the attached execution request; recorded in [issue #40](https://github.com/dnk1000/GymBro/issues/40). Change Level 3. This record distinguishes implemented code, technical verification and human acceptance.

## Contract and activation

Normal workouts retain `daveGymTrackerV1` and schema **8**. Relational model **1** is unchanged. Protocol **1** metadata lives outside workout facts; migration `20261030043000_workout_concurrency.sql` adds `gymbro_workout_versions` and `gymbro_mutation_receipts`. No personal migration or Production operation is included. #28/#41/#29 are not started.

The repository returns one consistent `{protocolVersion, ownerId, revision, rows}` snapshot. Revisions are canonical nonnegative decimal strings and compared with `BigInt` in JavaScript. Existing synthetic owners begin at protocol revision zero; no past revisions/receipts are fabricated. Meaningful mutations increment once. Replays, rejections and cancellation do not increment workout revision.

Every checked mutation authenticates the permanent owner, takes the existing owner transaction lock, checks its receipt before revision/base, applies the existing constrained row diff, then commits facts/revision/receipt together. Both the loaded owner revision and full prepared-base comparison must pass. Existing guided `expectedRevision`, request signatures, tombstones, immutable intent and session relationships remain in force. Stale writes return `CONFLICT`; no automatic merge, rebase or last-write-wins exists.

Operation keys are arrays: `[action,requestId]`, or `["logGuidedSet",sessionId,requestId]`. The frozen packet includes action/arguments, original revision/base, candidate rows and generated result identities. The server fingerprints the complete PostgreSQL `jsonb` representation with SHA-256. Exact retries return `REPLAY`, original IDs and operation revision plus the latest snapshot. They never reapply corrected/deleted facts. Changed packets under committed keys return `REQUEST_CONFLICT`. Receipts are retained without pruning/reset.

`gymbro_workout_resolve` takes the same lock and either returns a durable receipt or inserts a terminal cancellation fence. A later original cannot commit after that fence. An absent receipt observed outside this resolver is not proof of failure.

Browser roles have SELECT only on the aggregate and metadata. The old `gymbro_workout_commit(jsonb,jsonb)` remains an internal invoker helper with authenticated EXECUTE revoked. Checked mutate/resolve RPCs are owned by `gymbro_workout_writer`, a non-login/non-superuser/non-BYPASSRLS role with narrow DML/helper grants, no schema CREATE and no browser membership. RLS remains enabled with permanent-owner policies. Auth/diagnostic tables remain outside this protocol. No service credential ships to a browser.

## Client interface and recovery

`WorkoutRepository.create({client,ownerId})` exposes `load`, `prepare`, `submit` and `resolve`. `prepare` allocates no new IDs and freezes the already prepared packet. `WorkoutRepository.createActions` reuses the accepted DOM-free domain rules and exposes `execute`, `retry`, `resolve`, `refresh`, `getStatus`, `getWorkoutState` and `dispose`. It requires the verified protocol load handle.

The action controller publishes only acknowledged state, blocks overlapping/new writes while pending/uncertain, and retries only the original frozen packet. It records only owner/operation/protocol recovery metadata in session storage before transmission. Marker failure prevents transmission. Hard reload does not recover unsaved draft values; it resolves the marker before allowing new writes. Different owners use independent markers; disposed generations cannot publish responses.

`OUTCOME_UNKNOWN` says confirmation was lost, without asserting saved or not saved. Explicit same-request retry or result resolution is required. Stale conflict retains input and requires explicit refresh/review. Refresh updates saved state separately from drafts and cannot automatically change their session/slot targets. Revision and refresh-generation guards reject older snapshots/responses. There are no timers, background retry senders or offline queues in the controller.

## Migration, compatibility and test transition

Applied migrations are unchanged. Use the [#38 exact reviewed-revision staging pipeline](V3_INFRASTRUCTURE.md#preview-promotion). Inspect schema/ledger before apply, verify fresh/replayed/populated upgrades and full content/relationships, then list/verify/no-op reapply. Recovery is inspected forward repair, not hosted reset, receipt removal, re-enabling unchecked writes or a destructive downgrade.

The intentional #39 synthetic write-interface transition requires checked packets; unsupported old writes fail visibly. Read mapping, local schema/interchange and domain rules remain compatible. Existing #16/#39 SQL assertions now exercise underlying constraints/RLS as the non-login writer. Their original integrity assertions remain, including forbidden append-only updates; new protocol assertions verify browser-role write denial and checked mutation paths. Existing JavaScript persistence tests use protocol envelopes and recovery metadata; the old definite-failure message expectation becomes `OUTCOME_UNKNOWN` for unclassified transport loss.

## Verification and completion report

Scope is #40 only, Change Level 3: owner-wide concurrency, durable request identity and browser write permissions affect data integrity and security. The approved design and 3.6.0 release mapping cover this implementation; PATCH corrections stay within #40. No material design deviation was required. Explicit Level 3 acceptance remains separate.

### Delivery and data boundary

- Accepted starting main: `7f4408aee7d51ff21aad421bf924c529baaae90e` (#39 merged via PR #59).
- Branch: `codex/issue-40-implementation`; [draft PR #65](https://github.com/dnk1000/GymBro/pull/65), open and unmerged. The design-only [PR #64](https://github.com/dnk1000/GymBro/pull/64) also remains unmerged.
- Last behavior-changing code commit: `10bccce0c706acba97c6ad20a34da71bc30ae2ff`. Passing protocol/test revision: `f6b394fa730d7f4c620fb07438334a07c390427e`. Final documentation delivery SHA is recorded in the PR and chat report (a commit cannot embed its own hash).
- Candidate `3.6.6-20261030T055653Z`; workout schema **8**, identity document **1**, relational model **1**, concurrency protocol **1**; migration **20261030043000**. Existing applied migrations and local JSON/interchange formats remain unchanged.
- New objects: two metadata tables, `gymbro_operation_valid`, definition-bound invoker claim helpers `gymbro_request_owner`/`gymbro_request_permanent`, snapshot/mutate/resolve RPCs and the narrow writer role. Existing read/commit helpers use the bound claims; commit finalizes an existing active session after its final guidance changes in the same transaction. All original guards/constraints remain.
- Browser DML on all 16 aggregate tables and metadata is revoked; old unchecked commit EXECUTE is revoked. Authenticated users retain owner-scoped reads and checked mutate/resolve access. Writer receipts remain append-only; no Auth-schema privilege is broadened, no browser role membership or schema CREATE is granted.
- No dependency changes, normal workout-cloud activation, personal migration, Production schema/data/configuration operation, backup claim or other issue is included. Original unrelated changes in `C:\Source\GymBro` and the proposal worktree are preserved.

### Technical evidence

Validation uses the approved matrix: complete content/relationship comparisons, actual independent PostgreSQL connections, real-commit acknowledgement loss, rollback, receipt/cancellation races, fresh/replayed/populated upgrades, bypass/security assertions, affected full regressions, exact staging promotion and signed Preview contexts. Test-transport and injected-claim evidence are identified below; neither proves a signed browser session.

[CI 41012263919](https://github.com/dnk1000/GymBro/actions/runs/41012263919), exact reviewed staging source `63ae2b16126c9d65918e177e8b7a50300aa2fdf4`, passed **218/218 application tests**, syntax/release/full-range diff checks and **335/335 SQL assertions on each of fresh and reset/populated-upgrade databases (670 total)**: 71 existing infrastructure/ownership assertions + 9 identity + 110 relational + 145 protocol per pass. The preceding [protocol run 41011858148](https://github.com/dnk1000/GymBro/actions/runs/41011858148) also passed. Node 24.19.0 and the lockfile-pinned Chromium ran in Ubuntu CI; local focused checks used Node 24.22.1/Windows Chrome. There are no skipped application tests.

All **13 independent transaction races PASS**, with full post-race content/relationships and at most one active session:
- start/start, edit/delete, delete/edit, log/finish, finish/log, Done/log, Skip/log, navigation/substitution, guided/guided and duplicate import: **OK / CONFLICT**, one meaningful revision increment.
- same-key duplicate submit and original-before-resolver: **OK / REPLAY**, one terminal receipt for the original operation.
- resolver-before-original: **CANCELLED / CANCELLED**, no workout revision increment.

The **real committed acknowledgement-loss fault PASS** uses the actual repository/controller over separate PostgreSQL transactions, deliberately throws only after the successful commit process exits, observes `OUTCOME_UNKNOWN`, then retries identical packet bytes and observes `REPLAY` with original ID, one fact, one receipt and one revision increment. pgTAP's deliberate late FK fault also proves full multirow rollback with no receipt/revision change. Old guided/import/init receipts replay after subsequent completion/correction/deletion without reapplying old facts.

The populated upgrade commits synthetic #39 data before applying #40, verifies all content and relationships unchanged, starts protocol revision zero, then confirms a checked mutation reaches revision one. Fresh migration, reset/replay, no-op migration apply, large decimal revisions above JavaScript precision, browser direct-DML denial on all 16 aggregate tables, old RPC denial, writer capabilities/search paths, anonymous and cross-owner RLS assertions PASS. These SQL tests set authenticated-role claims directly; they are not real signed-user evidence.

The local SQL driver opens a separate `psql` process/connection inside the exact disposable Supabase container. Races prove distinct backend PIDs/transaction IDs and observed lock overlap; sequential pgTAP calls are not presented as concurrency. Artifacts retain the machine-readable race results and generated synthetic SQL. Cleanup deletes only freshly generated test-owner UUIDs across the complete aggregate and metadata, then verifies zero Auth rows independently.

**Hosted GymBro-Staging promotion PASS for DDL/metadata only:** project `obebuvpsqapgevwivwho`, PostgreSQL **17.11**, reviewed clean revision `63ae2b16126c9d65918e177e8b7a50300aa2fdf4`. Inspection and dry-run identified only `20261030043000_workout_concurrency.sql`; guarded apply succeeded, the ledger lists all five expected migrations, metadata assertions confirmed old RPC revoked, browser writer-membership denied, narrow non-login/non-superuser/non-BYPASSRLS writer and RLS on all 16 aggregate + 2 metadata tables. Repeat plan/apply reported up to date with **zero pending migrations**.

Before/after counts and deterministic full-row-content fingerprints match for every aggregate table. **Staging had zero aggregate rows**, so this is an empty hosted-state preservation check; populated preservation is proven by the disposable upgrade above. No fixture owner/account was introduced by this promotion. Ignored local evidence: `test-results/staging-concurrency-promotion.json`, `staging-facts-before.json`, `staging-before-metadata.log`, `staging-after-metadata.log`. Hosted synthetic mutation/pgTAP and signed-session behavioral checks remain **UNVERIFIED**, pending account-fixture authorization.

Exact branch [Preview](https://gymbro-git-codex-issue-40-implementation-dnk-9999.vercel.app): the read-only smoke compared deployed runtime assets to local sources, then passed desktop **1280 px**, **390 px** and **320 px** on Windows headless Chrome with build `3.6.6-20261030T055653Z`, zero console warnings/errors, no horizontal overflow, zero normal-workout-key reads and correctly disabled submissions. Screenshots/JSON are in ignored `test-results/preview-concurrency-*.png` and `preview-concurrency-readonly.json`; the 320 px screenshot was visually inspected. Reads use the native Vercel CLI's authenticated protection-bypass support; it generated an operator bypass token without printing it, and deployment protection remains enabled. Vercel's injected feedback toolbar loads normally. This proves the disabled/unconfigured Preview page only.

Local browser tests use an explicit mock Auth/SQL transport and verify pending, conflict, unknown outcome, exact retry, reload resolution, delayed responses, account change during initial load, exact set/import draft retention (including 0/false/text/targets), normal local-store isolation and desktop/390/320 layouts. Controller tests additionally cover marker write/clear/read failures, unsupported markers, stale refresh phase guards, large decimal revisions, disposed generations and no automatic re-preparation. These do not replace the required configured, signed Preview checks.

**Required technical evidence still pending:** two permanent synthetic staging accounts with actual signed sessions; configured exact-branch Preview pending/conflict/unknown/resolution/cancellation and delayed/out-of-order responses; same-owner independent contexts, cross-owner facts/receipt isolation and account-switch publication prevention through the real SDK. No Supabase account-fixture admin key was retrieved or fixture account created. Automatic review rejected the operator helper; the explicit approval question remains pending in this chat. Its patch did not run. No alternative privileged route was used.

Physical iPhone/Safari: **not tested**. The execution contract does not require it solely for this synthetic page; no normal cloud-workout flow is activated. Responsive Chromium is not claimed as Safari evidence.

### Acceptance mapping

| Criterion | Method/evidence | Result |
| --- | --- | --- |
| AC-1 — reviewed concurrency matrix | Exact approved proposal at `bee6650f0dcac4cd6c0b537c224de401e5049e9a`, owner execution approval recorded on issue #40. | **PASS** |
| AC-2 — representative checked mutation paths | Actual SQL packets prepared by the real action/repository boundary: initialization, set log/edit/delete, note, template, bodyweight, reviewed import, guided log/finish; full acknowledgements compared. Hosted behavioral variant remains pending separately. | **PASS** |
| AC-3 — replay never duplicates sets/sessions/imports | Every SQL fixture packet replayed after later changes; original result revisions/IDs retained; no resurrection; independent duplicate-submit/import/start races and real-commit retry. | **PASS** |
| AC-4 — stale changes never silently overwrite | Revision plus full-base mismatch assertions, ten independent stale races, relationship comparison, guided/domain tests and explicit-refresh draft tests. | **PASS** |
| AC-5 — lost commit acknowledgement safely retried | Actual committed PostgreSQL mutation, deliberate transport loss, controller unknown state, exact packet retry, original ID and one fact/receipt/revision increment; rollback and both resolver/original race orders. | **PASS** |
| AC-6 — deterministic two-device active session | Independent start/start and finish/log/guided SQL races pass; required two actual authenticated Preview contexts remain unperformed. | **UNVERIFIED** |
| AC-7 — accurate conflict/error UI with retained input | Local mock-transport browser states/drafts pass; exact disabled Preview desktop/390/320/console passes. Configured signed Preview pending/conflict/unknown/cancellation/out-of-order tests remain unperformed. | **UNVERIFIED** |

### Negative evidence and resolutions

| Evidence | Observed failure and disposition |
| --- | --- |
| Initial local focused checks | Operation arrays were passed to a row-bundle comparator; default ID generation was missing. Corrected without weakening assertions. |
| [CI 41003113730](https://github.com/dnk1000/GymBro/actions/runs/41003113730) | 208 application tests passed; SQL stopped on operator SET ROLE denial. Explicit non-inherited postgres operator membership restored; browser membership remains denied. |
| [CI 41004617906](https://github.com/dnk1000/GymBro/actions/runs/41004617906), [41004918231](https://github.com/dnk1000/GymBro/actions/runs/41004918231) | Missing test pgTAP-schema USAGE, then protected Auth-schema name resolution. Transaction-only pgTAP grant and definition-bound invoker Auth helpers fixed these; no broader Auth privilege. A read-only staging audit established Auth is owned by supabase_admin and postgres lacks grant option. [PostgreSQL definition-bound SQL bodies](https://www.postgresql.org/docs/17/sql-createfunction.html) explain the chosen mechanism. |
| [CI 41006271282](https://github.com/dnk1000/GymBro/actions/runs/41006271282) | Source-copy replacement corrupted SQL dollar delimiters. Literal delimiters fixed before hosted apply. |
| New stale no-op test | Initially chose clearPlan, which always prepares a mutation. Corrected to the real guided-position no-op; retains the no-automatic-write assertion. One local command continued to commit after that new test failed; subsequent commands check exit status before commit, and corrected tests pass. |
| [CI 41006972938](https://github.com/dnk1000/GymBro/actions/runs/41006972938) | All 329 fresh SQL assertions passed; local CLI could not execute multi-statement race transactions. Replaced only local race transport with the existing container psql. |
| [CI 41007541706](https://github.com/dnk1000/GymBro/actions/runs/41007541706), [41009830944](https://github.com/dnk1000/GymBro/actions/runs/41009830944) | Race cleanup omitted the two catalog tables and masked an original failure; complete aggregate cleanup now succeeds and preserves original errors. Full JSON race comparison then exposed cross-VM Array prototype inequality; comparison now checks canonical full JSON content, retaining every field/order/relationship. |
| [CI 41010873993](https://github.com/dnk1000/GymBro/actions/runs/41010873993) | Real finish/log transaction exposed parent completion occurring before final guidance changes. Two-pass application finalizes the parent last, retaining original guards. Disposable transaction testing caught what same-transaction fixtures could not. |
| Preview smoke | Initially rejected Vercel's injected feedback-toolbar GET. Identified its exact provider origin, allowed its normal GET loading, and reran with zero console errors; arbitrary hosts/methods still fail. |
| Staging pre-migration metadata | The first audit failed because its writer role did not exist yet. A read-only operator-query correction uses the role OID subquery and now inspects both absent and installed protocol state. No application/BUILD change. |
| Infrastructure/tooling | Sandbox fetch/write/localhost restrictions required authorized reruns. Vercel CLI added duplicate ignore rules; existing protections were proved and duplicates restored to HEAD. Docker registry rate-limit messages occurred during successful CI bootstrap; database tests still ran and passed. |
| Automatic approval review | Rejected a combined version/commit/push command as a new release mapping; the explicit PATCH authorization in the execution request was then verified and narrower corrections approved. Separately rejected privileged staging key lookup/account creation; that operation remains unperformed and awaits explicit permission. |

### Exact changed files and handoff

Scope review: `git diff --name-only 7f4408aee7d51ff21aad421bf924c529baaae90e HEAD`, staged/unstaged checks and full-range whitespace checks. Only these 36 intended files differ:

```text
.github/workflows/ci.yml
README.md
api/concurrency-config.js
app-version.js
concurrency-test.html
concurrency-test.js
docs/CHANGELOG.md
docs/CURRENT_ARCHITECTURE.md
docs/README.md
docs/RELEASE_HISTORY.md
docs/V3_CONCURRENCY.md
docs/V3_CONCURRENCY_PROPOSAL.md
docs/V3_RELATIONAL_PERSISTENCE.md
docs/V3_RELEASE.md
docs/VERSION_POLICY.md
scripts/check-release.cjs
scripts/exercise-identity-db-fixture.cjs
scripts/serve-probe.cjs
scripts/verify-preview-concurrency-ui.cjs
scripts/verify-preview-relational.cjs
scripts/workout-concurrency-db-fixture.cjs
scripts/workout-concurrency-races.cjs
scripts/workout-concurrency-upgrade.cjs
scripts/workout-repository-db-fixture.cjs
supabase/migrations/20261030043000_workout_concurrency.sql
supabase/tests/exercise_identity.test.sql
supabase/verify-infrastructure.sql
tests/app-version.test.cjs
tests/concurrency-ui.test.cjs
tests/protocol-fixture.cjs
tests/relational-fixture.cjs
tests/release-tools.test.cjs
tests/workout-concurrency.test.cjs
tests/workout-repository.test.cjs
workout-concurrency.js
workout-repository.js
```

Owning docs describe implemented protocol/recovery/security/migration behavior and its verification limits; the approved proposal and prior release evidence remain historical records. Candidate versions are not accepted shipped releases. Documentation/tool-only commits retain BUILD. Documentation fence balance and all 158 local link paths across the ten changed Markdown files pass, as do release consistency and staged/unstaged/full-range whitespace checks.

**Claimed state: partial implementation / blocked technical verification. Not ready for Level 3 human acceptance.** Required signed/interactive Preview evidence remains technical work, not optional human acceptance. Next: resolve the pending fixture-account authorization, execute the remaining staging/signed Preview checks and record each result, then request explicit Level 3 acceptance. Issue #40 remains open. Neither PR is merged; no other issue is started. Final delivery tree/commit state is recorded in the PR and chat report.
