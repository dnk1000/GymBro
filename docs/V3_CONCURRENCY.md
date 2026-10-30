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

**Claimed state: implementation complete / Ready for Level 3 human acceptance.** All seven ACs have passing technical evidence. Explicit human acceptance, issue closure, merge and Production remain pending. No unqualified issue-complete claim is made.

### Scope, authority and delivery

Change Level **3** applies to owner-wide concurrency, durable request identity, retry/recovery and write permissions. The owner approved the exact proposal at `bee6650f0dcac4cd6c0b537c224de401e5049e9a` and **3.6.0 for #40 alone**; PATCH fixes stay within that candidate. On October 30, 2026 the owner explicitly answered **“Approve staging fixture setup and cleanup”**, authorizing the existing staging admin key in operator-process memory, two synthetic accounts, ignored temporary passwords and exact cleanup. This resolved the prior automatic-review block. No material design deviation was required.

- Accepted starting main: `7f4408aee7d51ff21aad421bf924c529baaae90e`; #39 was merged via PR #59.
- Branch: `codex/issue-40-implementation`; [PR #65](https://github.com/dnk1000/GymBro/pull/65), unmerged. Design-only PR #64 remains unmerged historical preparation.
- Last behavior-changing runtime commit: `10bccce0c706acba97c6ad20a34da71bc30ae2ff`; exact signed Preview, hosted SQL/race and current technical CI source: `c241e30c563c6bcd822941bd8fa927a019b9ce61`. Final evidence-only delivery SHA is recorded in the PR/chat report; a commit cannot embed its own hash.
- Candidate: **3.6.6-20261030T055653Z**; workout schema **8**, identity document **1**, relational model **1**, protocol **1**; migration **20261030043000**. Development-only harnesses/documentation retain BUILD.
- Added DB objects: `gymbro_workout_versions`, `gymbro_mutation_receipts`, operation validator, bound invoker owner/permanent-claim helpers, snapshot/mutate/resolve RPCs and the narrow non-login writer role. Existing read/commit helpers use bound claims; commit applies final guidance before completing an existing active parent in the same transaction. Original immutable-intent and relationship guards remain.
- Browser DML on all **16** aggregate tables and both metadata tables is revoked; old unchecked commit EXECUTE is revoked. Authenticated owner reads and checked mutation/resolution remain. Writer receipts are append-only, writer has no schema CREATE or browser membership, and no Auth-schema privilege is broadened. No admin key enters browser assets, runtime variables, logs or files.
- Normal workouts retain their local adapter and current JSON/interchange behavior. No dependency change, other issue, personal migration, Production schema/data/configuration operation or personal-backup claim is included. Original unrelated changes in `C:\Source\GymBro` and the proposal worktree are preserved.

### Validation approach and regression evidence

Validation follows the approved matrix: complete content/relationship comparisons, actual independent PostgreSQL connections, post-commit acknowledgement loss, rollback, resolver/original races, fresh/replayed/populated upgrades, bypass/security audits, affected full regressions, guarded staging promotion and real signed Preview contexts. Injected-claim SQL evidence is distinguished from signed SDK evidence.

[CI 41052582568](https://github.com/dnk1000/GymBro/actions/runs/41052582568), exact source `c241e30c563c6bcd822941bd8fa927a019b9ce61`, passed **221/221 application tests**, syntax/release/full-range diff checks and **335/335 SQL assertions on each fresh and reset/populated-upgrade database (670 total)**: 71 existing infrastructure/ownership + 9 identity + 110 relational + 145 protocol per pass. No skipped application tests. Node **24.19.0** and lockfile-pinned Chromium ran in Ubuntu CI; local operator checks used Node **24.22.1**, Windows and Chrome **156.0.8078.48**. Earlier [CI 41012263919](https://github.com/dnk1000/GymBro/actions/runs/41012263919) passed the previous 218-test candidate before three fixture-guard tests were added.

All **13 real independent transaction races pass in disposable CI and hosted staging**. Ten distinct-key races return OK/CONFLICT; duplicate submit and original-before-resolver return OK/REPLAY; resolver-before-original returns CANCELLED/CANCELLED without a workout increment. Each compares complete canonical row content/relationships, confirms at most one active session and one terminal receipt for the raced operation. Distinct backend PIDs/transaction IDs and observed lock overlap prove actual concurrency; sequential pgTAP calls are not offered as race evidence.

The real committed-acknowledgement fault passes in both environments using the actual repository/controller: after the PostgreSQL commit process returns, the transport deliberately throws; client returns OUTCOME_UNKNOWN, exact frozen retry returns REPLAY with original ID, one fact/receipt and one revision increment. A deliberate later FK failure proves full multirow rollback with no receipt/revision change. Receipt replays after later correction/deletion/completion never reapply old facts. Populated #39 upgrade preserves every field/relationship, starts protocol revision zero and advances to one on the first checked mutation. Fresh/reset replay, no-op apply, huge exact decimal revisions, guided semantics and affected backup/import/identity/note/local UI checks pass.

### Hosted staging and signed Preview

**GymBro-Staging only**, project `obebuvpsqapgevwivwho`, PostgreSQL **17.11**. Migration applied through #38's clean exact-reviewed-SHA guard at `63ae2b16126c9d65918e177e8b7a50300aa2fdf4`. Ledger/schema/role/grant/RLS checks pass; final guarded no-op reapply at c241e30 reports no pending migrations. All five expected ledger entries remain. Before/after full-table counts and content fingerprints match; staging was empty of aggregate rows before testing, so populated preservation evidence comes from the disposable upgrade.

At reviewed c241e30, hosted **110 relational + 145 protocol pgTAP assertions (255 total) PASS**, each transaction rolled back. Hosted Management API queries also pass all 13 independent races and real committed-loss retry, with full relationships and exact cleanup checked. Durable hosted race identity evidence:

| Hosted case | Backend PIDs | Transaction IDs | Outcomes | Workout revision |
| --- | --- | --- | --- | --- |
| start-start | 512488 / 512493 | 1534 / 1533 | OK / CONFLICT | 2 |
| edit-delete | 512506 / 512511 | 1542 / 1541 | OK / CONFLICT | 2 |
| delete-edit | 512523 / 512529 | 1551 / 1550 | OK / CONFLICT | 2 |
| log-finish | 512543 / 512549 | 1567 / 1566 | OK / CONFLICT | 2 |
| finish-log | 512560 / 512565 | 1575 / 1574 | OK / CONFLICT | 2 |
| done-log | 512577 / 512583 | 1584 / 1583 | OK / CONFLICT | 2 |
| skip-log | 512597 / 512604 | 1593 / 1592 | OK / CONFLICT | 2 |
| navigate-substitute | 512616 / 512623 | 1602 / 1601 | OK / CONFLICT | 2 |
| guided-guided | 512635 / 512641 | 1611 / 1610 | OK / CONFLICT | 2 |
| duplicate-import | 512671 / 512675 | 1625 / 1624 | OK / CONFLICT | 2 |
| duplicate-submit | 512685 / 512691 | 1633 / 1632 | OK / REPLAY | 2 |
| cancel-original | 512702 / 512706 | 1641 / 1640 | CANCELLED / CANCELLED | 1 |
| original-cancel | 512719 / 512726 | 1651 / 1650 | OK / REPLAY | 2 |

Every row above has observed overlap, distinct PIDs/transaction IDs, one terminal operation receipt and full post-race fact/relationship equality. Machine-readable details are retained locally in ignored `test-results/concurrency-races.json` and CI database artifacts retain the disposable equivalent.

The configured [exact Preview](https://gymbro-aiv4195kq-dnk-9999.vercel.app), deployment `dpl_FKGA5VR2tAu7PjW381c9cmndovPK`, used actual source **c241e30c563c6bcd822941bd8fa927a019b9ce61**, branch `codex/issue-40-implementation`, existing Vercel project `prj_UAp7aba6hCNO1nGBKRcowQH1dhjH` and build **3.6.6-20261030T055653Z**. Native provider metadata verifies the Git SHA; the CLI identifies Preview (the raw API's target is null). Deployed runtime files were compared to exact sources. Protection stayed enabled; native Vercel curl used its operator protection-bypass token without printing it. Vercel's injected feedback toolbar loaded normally.

**12 signed Preview checks PASS**, using two permanent synthetic owners, independent same-owner browser contexts, the pinned actual SDK and real Auth/PostgREST/RPC responses. No Auth/SQL mocks:

1. Same-owner stale conflict and explicit refresh preserve exact zero/false/notes/session target.
2. Barrier-released simultaneous real browser starts yield one OK, one CONFLICT and one active session.
3. Real successful commit with lost acknowledgement, identical retry, original ID, one fact/receipt/revision at **1280 px**.
4. The same real lost-ack/retry and draft checks at **390 px**.
5. The same checks at **320 px**, including no horizontal overflow.
6. Hard reload resolves the durable committed receipt without another mutation.
7. An intercepted not-yet-transmitted original becomes uncertain; explicit resolver cancels it, and a later exact real RPC returns CANCELLED with no workout write.
8. A delayed real acknowledgement cannot regress a newer separately committed/refreshed revision.
9. A held older real refresh cannot clear a newer conflict or its exact retained draft.
10. A stale reviewed import retains included/excluded choices, zero/false and literal text.
11. Real signed cross-owner facts/receipt/revision reads see zero foreign rows; direct inserts across all 18 aggregate/metadata tables, set update/delete, old RPC, anonymous and malformed-owner/operation calls are denied; altered original key returns REQUEST_CONFLICT without a revision change.
12. Actual sign-out/sign-in to the second owner during a held first-owner initial load cannot publish the old owner's response.

There are **zero unexpected console warnings/errors**, **one expected deliberately injected network error**, and **zero normal-workout-key reads**. The expected error is matched only to its recorded aborted transport, not broadly suppressed. Screenshots of pending/conflict/unknown states and JSON results are retained under ignored `test-results/signed-preview-*.png` and `signed-preview-concurrency.json`; the actual signed 320 px unknown-state screenshot was visually inspected. Local mock-transport browser/controller regressions separately cover marker failures, future metadata, generation/revision guards and packet preparation without replacing real signed evidence.

### Cleanup and acceptance mapping

Both approved permanent fixture accounts were created with `email_confirm: true`; no invite/email-sending API was invoked. The existing admin key stayed only in operator-process memory. Their workouts were initialized through real signed clients. The helper validates exact planned email/tag/owner identity and refuses unexpected existing data. Cleanup deleted only these fixtures and the race suite's separately generated owners. Independent final SQL confirms **zero test Auth rows, zero receipts, zero versions**, and all **16 aggregate-table fingerprints/counts match the pre-test baseline (zero rows)**. Temporary passwords were removed from the ignored operator record. No admin key was saved, printed, passed as a command argument or sent to a browser.

Only seven temporary **Preview + issue-40 branch** variables were added and then removed; no Production variables changed. The [branch Preview](https://gymbro-git-codex-issue-40-implementation-dnk-9999.vercel.app) was redeployed with fixture mutation functionality disabled. Post-cleanup desktop/390/320 checks again pass with zero console errors, zero workout-store reads and disabled submission. Existing migrations/security remain installed; cleanup is not a destructive rollback or a product account/reset workflow.

| Criterion | Method/evidence | Result |
| --- | --- | --- |
| AC-1 — reviewed concurrency matrix | Exact approved proposal and recorded owner implementation/fixture approvals. | **PASS** |
| AC-2 — representative checked mutation paths | Actual domain/repository packets through disposable and hosted SQL; real signed initialization/log/finish/start and complete acknowledgement comparisons. | **PASS** |
| AC-3 — replay never duplicates sets/sessions/imports | All SQL fixture packets replayed after later changes; original IDs/revisions retained; concurrent duplicate/import/start cases and actual signed exact retries. | **PASS** |
| AC-4 — stale changes never silently overwrite | Revision/full-base checks, ten independent stale race cases in both environments, signed same-owner conflicts and explicit-refresh exact-draft checks. | **PASS** |
| AC-5 — lost commit acknowledgement safely retried | Real commits and actual controller faults in CI/staging; signed browser faults at three widths; identical packet, original ID, one fact/receipt/revision; rollback and resolver races. | **PASS** |
| AC-6 — deterministic two-device active session | Independent SQL races plus simultaneous real authenticated Preview contexts: one start succeeds, one conflicts, at most one active session; cross-owner and account-switch checks. | **PASS** |
| AC-7 — accurate conflict/error UI with retained input | Actual signed Preview pending/conflict/unknown/reload/cancellation/delayed/out-of-order states, exact set/import drafts, desktop/390/320 and console checks. | **PASS** |

Physical iPhone/Safari: **not tested**. The execution contract does not require it solely for this synthetic page; no normal cloud-workout flow is activated. Responsive Chrome is not claimed as Safari evidence. No required technical verification remains unperformed for this bounded scope; explicit Level 3 human acceptance remains required.

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
| Automatic approval review | Rejected a combined version/commit/push command as a new release mapping; the explicit PATCH authorization in the execution request was then verified and narrower corrections approved. Separately rejected privileged staging key lookup/account creation. The owner explicitly approved the bounded setup and cleanup on October 30; the approved operation then ran with its key confined to process memory. |
| Prior blocked handoff | Delivery 285ec36 correctly left AC-6/AC-7 UNVERIFIED. The later explicit fixture approval enabled the hosted/signed evidence recorded above; this does not rewrite the earlier unverified state as a pass. |
| Fixture helper checks | A hard-coded tag-prefix offset rejected valid synthetic identities in a new unit test; corrected using the actual prefix length, preserving all assertions. An empty local public-key setting stopped setup before any privileged key lookup; the existing public staging key was then loaded into ignored operator configuration. |
| Deployment metadata check | The raw provider API represents Preview target as null, while native CLI reports preview. The initial over-strict metadata assertion failed; the exact source SHA and CLI environment were then checked together. No deployment/source mismatch occurred. |

### Exact changed files and handoff

Scope review uses `git diff --name-only 7f4408aee7d51ff21aad421bf924c529baaae90e HEAD`, staged/unstaged/full-range whitespace checks and an exact report-inventory comparison. Only these **39** intended files differ:

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
scripts/issue40-staging-fixtures.cjs
scripts/serve-probe.cjs
scripts/verify-issue40-signed-preview.cjs
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
tests/issue40-staging-fixtures.test.cjs
tests/protocol-fixture.cjs
tests/relational-fixture.cjs
tests/release-tools.test.cjs
tests/workout-concurrency.test.cjs
tests/workout-repository.test.cjs
workout-concurrency.js
workout-repository.js
```

Owning documentation covers implemented protocol/recovery/security/migration behavior, actual results and historical failures. The approved proposal and prior release/partial-handoff evidence remain historical. Candidate release records distinguish technical verification from acceptance/shipping. Documentation-only/operator-only commits retain BUILD. Final link/fence, release and whitespace checks are recorded in the PR/chat report.

**Ready for explicit Level 3 human acceptance.** Issue #40 remains open; neither PR is merged. No other issue, personal migration or Production operation was started. Final delivery SHA and clean-tree verification are in the PR/chat report. The next actor is the owner reviewing the concrete PR and acceptance evidence; acceptance does not implicitly authorize merge or Production cutover.
