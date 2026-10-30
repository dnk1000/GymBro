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

## Verification and completion report — in progress

Scope: #40 only. Implemented SQL metadata/security/RPC boundary and client packet/recovery controller. Exact changed files, code/delivery revisions, PR, current candidate build, totals and environment evidence will be recorded after final verification. No implementation-complete claim is made.

Validation approach: [approved concurrency matrix and AC mapping](V3_CONCURRENCY_PROPOSAL.md#validation-approach-and-acceptance-evidence), real concurrent database connections, commit/acknowledgement fault injection, full-content relationship checks, migration replay/upgrade, authorization/bypass audit, exact staging apply and two signed Preview contexts. Desktop/320/390 px/console evidence is required for the synthetic test page; physical Safari is separate and not claimed.

Current focused local evidence: **18/18** repository/controller tests pass, using a test transport. This proves client behavior, not actual SQL/concurrency or hosted acceptance. Initial focused failures exposed a table-bundle comparator being used for an operation array and missing default ID generation; corrected without weakening assertions. Initial shell write was denied by the sandbox; authorized write succeeded. No automatic approval rejection occurred.

| Criterion | Current method/evidence | Result |
| --- | --- | --- |
| AC-1 | Existing concurrency matrix explicitly approved in the execution request. | PASS |
| AC-2 | Protocol paths implemented; actual SQL integration pending. | UNVERIFIED |
| AC-3 | Test-transport replay/identity cases pass; actual SQL race evidence pending. | UNVERIFIED |
| AC-4 | Test-transport stale rejection passes; actual database evidence pending. | UNVERIFIED |
| AC-5 | Test-transport lost-ack retry passes; real-commit fault injection pending. | UNVERIFIED |
| AC-6 | Real independent transactions and signed Preview contexts pending. | UNVERIFIED |
| AC-7 | Guarded synthetic UI and browser verification pending. | UNVERIFIED |

Claimed state: **partial implementation, verification in progress**. Approval covers this bounded implementation and 3.6.0 mapping, not Level 3 acceptance, merge or Production. All required missing technical evidence remains required. No other issue, Production operation, personal backup/migration or physical Safari result is claimed. The clean proposal worktree and original checkout's unrelated uncommitted #39 files are preserved.

Initial [CI 41003113730](https://github.com/dnk1000/GymBro/actions/runs/41003113730) passed 208 application tests; SQL stopped on operator SET ROLE denial before protocol tests. Explicit non-inherited writer membership is retained for the existing privileged postgres operator; browser roles cannot assume it. Five focused synthetic UI/config tests now pass locally, including desktop/390/320 px, browser console, unchanged local workout storage, retained set/import drafts, unknown-outcome retry/reload and delayed acknowledgement.

Automatic approval review rejected one combined version/commit/push/Preview-link command as an unapproved 3.6.1 mapping and broad metadata change; nothing ran. Read-only inspection of the execution request confirmed its explicit PATCH-for-fixes authorization. A separate candidate-only 3.6.1 correction was then approved and applied. No merge/Production permission was inferred from that review. Initial sandbox browser localhost access was denied; the authorized rerun passed. A UI test initially used the disabled-control predicate on a fieldset; it now checks the fieldset's actual disabled property and its disabled Submit control, preserving the guard assertion.

CI 41004617906 passed the full 213 application tests but stopped on missing test-only pgTAP schema USAGE; transaction-scoped test grants fixed that. CI 41004918231 passed 71 existing + 9 identity SQL assertions, then diagnosed protected Auth-schema name resolution. A read-only staging audit confirmed postgres has Auth USAGE without grant option, with schema owned by supabase_admin. Definition-bound SECURITY INVOKER claim helpers retain the same Auth/RLS semantics without broader privileges; the original invoker diff/read helpers change only their Auth lookup calls. See [PostgreSQL SQL-body definition](https://www.postgresql.org/docs/17/sql-createfunction.html). No #40 migration has been applied to staging yet. Local focused repository/controller/UI checks now pass 24/24, including account switch during initial load.
