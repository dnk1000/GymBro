# Batch Workout Import — issue #82 proposal

Status: **Approved for bounded implementation.** The owner approved proposal `5851f94b24fb5be9021f8bc94417d15630d8945b`, 3.18.0/scoped PATCH fixes and bounded disposable staging verification in this implementation chat; approval is recorded in #82. Required priorities are exact historical preservation/rejection and a simple consolidated workflow. Merge and Production operations remain excluded. The preparation record below is historical. Baseline: newly accepted main `fb7aef24c7aa07635896aee4809ce981a4689a1f` (merged PR #93), branch `codex/issue-82-batch-import`. The owner requested bounded #82 preparation, with approval before uncovered data-contract implementation. No runtime/schema/build change or test-data mutation is included here.

## Authority and existing capabilities

Governing references: [#82 execution contract](https://github.com/dnk1000/GymBro/issues/82), [PRD](GymBro_PRD.md#current-product-scope-and-authority), [current architecture](CURRENT_ARCHITECTURE.md), [workflow](DEVELOPMENT_WORKFLOW.md), [version policy](VERSION_POLICY.md), [JSON interchange](CHATGPT_IMPORT_SCHEMA.md), [sessions](WORKOUT_SESSIONS.md), [note scopes](NOTE_SCOPES.md), [identity](EXERCISE_IDENTITY.md), [accepted #18 resolver](SMART_IMPORT_RESOLUTION.md), [relational persistence](V3_RELATIONAL_PERSISTENCE.md), [#40 recovery](V3_CONCURRENCY.md), and [approved #41 history/backup boundary](V3_DATA_LIFECYCLE_PROPOSAL.md).

The final #18 implementation/evidence was reviewed against all eight criteria; final-head CI 42373973262 passed and no unresolved review thread/substantive blocker was found. GitHub already reported PR #93 merged at the baseline above; no second merge was performed. The owner conditionally authorized final acceptance/merge/closure in this chat; [final acceptance and #18 closure](https://github.com/dnk1000/GymBro/issues/18#issuecomment-6715890676) are recorded. No tests were repeated and no Production state is inferred from the merge.

Reuse existing #16 identity and #39/#40 repository/recovery foundations, and #18's `ImportResolution.review` collection interface. #39/#40 are closed; #16's open issue does not require rebuilding its integrated canonical primitives. Full #17 catalog management is not a prerequisite. The approved #85/#86 cloud authority and inactive-local-copy boundary remain in force.

**Change Level 3:** new versioned import envelope, persistent import identity/provenance, historical relationships, collision behavior, additive commit and retry integrity. Existing approvals cover infrastructure, not these new batch contracts. Approval requested below; runtime work waits.

## Proposed interchange: envelope, existing record models

Use `format: "gymbro-workout-batch"`, `formatVersion: 1`, optional `batchId`, optional string `source`, optional JSON provenance, and required nonempty `workouts` array. Reject unsupported versions and malformed envelope structure; never fall through to single-workout parsing. Accept at least ten workouts without special cases.

Each item has an explicit stable `importId` where provided and **exactly one** of:

- `workout`: the existing `gym-tracker-chatgpt-v1` payload, including its supported flat/nested shapes and optional wrappers. Reuse `normalizeInboxPayload`/`validateDraft` unchanged. Its date/template/duration/bodyweight/notes/set meanings stay unchanged; it produces sessionless facts, not an invented historical session. Preserve the existing single-workout explicit/generated import ID and deterministic set-ID algorithm. If wrapper and inner IDs are both supplied they must agree.
- `history`: an existing supported complete GymBro JSON document representing one historical unit, parsed with the existing backup/data/identity validators. Accept schema-8 portable JSON (or supported older input through existing conservative migration) and same-owner cloud-backup v1. It must contain exactly one supplied completed session with its complete set-order/snapshot/context graph, or only sessionless facts on one supplied date. Reject active sessions, multiple sessions/dates, dangling references or unrelated session facts; do not guess how to split them. This restriction defines v1's historical-unit boundary, not a new workout/session model. Programs/preferences in a complete source are validation/recovery context only and are not applied by a history import; preview states this explicitly. Existing restore/merge workflows remain available separately.

Example envelope (the historical payload is a complete existing validated file, not a new partial-record schema):

```json
{
  "format": "gymbro-workout-batch",
  "formatVersion": 1,
  "batchId": "training-archive-01",
  "source": "chatgpt",
  "workouts": [
    {
      "importId": "archive-2026-10-21",
      "workout": {
        "schema": "gym-tracker-chatgpt-v1",
        "date": "2026-10-21",
        "sets": [{"exercise": "Seated Row", "weight": 0, "unit": "lb", "reps": 8, "complete": false}]
      }
    }
  ]
}
```

All nine #82 criteria remain in scope. The richer `history` form is required to satisfy preservation; wrapping the legacy Inbox format alone cannot preserve supplied sessions/IDs/setup context. Do not change that legacy format to pretend it already carries them. No unstructured prose, arbitrary provider format, batch restore, training inference or automatic active-session migration is included.

## Pure preparation and one review

Parse/normalize every item before any writes. Structural envelope errors block the batch. Per-item errors remain visible in the consolidated preview so the user can explicitly deselect invalid units; never silently select a successful subset. The preview shows total workouts, dates and supplied session IDs, exercise/set counts, duplicate/conflict/unresolved status, errors/warnings, selection and exact final disposition. Duplicates are shown as already imported, excluded from new writes, and not disguised as new selected work. A valid selected batch commits all selected new units or none.

Keep a DOM-independent collection preparation boundary separate from file reading. Flatten selected units' actual/planned/scoped-note exercise references through #18's exact resolver, using stable item/reference keys. Known IDs/names/aliases need no repetitive confirmation. Share a decision for the same unresolved label across selected units; distinct exercise/equipment identities remain distinct. A skipped required reference cannot leave a broken historical session graph: for a historical unit, exclude/review the whole workout rather than dropping sets/snapshot slots/notes silently. Legacy per-set selection retains #18 semantics and its explicit separate-future-import/new-ID warning. Deselecting an entire never-imported workout does not consume its individual import ID.

Review/catalog changes allocate no persisted identities. Final preparation revalidates selected units, identities and registry against the latest acknowledged controller state. Approved alias/create decisions use `ExerciseIdentity`; snapshot intent, actual substitutions and source labels remain separate. New canonical IDs belong to GymBro. Same-owner cloud history retains compatible supplied GymBro exercise IDs; a conflicting ID/name/alias rejects rather than reallocating or merging silently. Foreign-owner cloud backups remain rejected. Portable label-based history uses the reviewed canonical catalog, not the backup parser's current unknown-label auto-creation shortcut.

## Historical preservation and collisions

Preserve valid supplied set/session IDs byte-for-byte, local dates, units, zero/null/omitted distinctions, complete:false, notes, RPE/RIR, pain/area, source metadata, session membership/setIds order, immutable snapshots, planned/actual references, scoped session/occurrence/setup notes, known guidance/signature/tombstone metadata and unknown preserved metadata supported by the source contract. Do not call createSession/completeSession to reconstruct history or invent timestamps. Existing current settings/program/preferences/active workout and all prior facts remain unchanged.

New-format set/session ID collisions, whether within the batch or against saved facts, require complete content/relationship equality for a known duplicate; differing content is a conflict and blocks that selected unit. Never overwrite, retarget, rekey or silently drop a colliding record. A stable ID of a deleted/edited prior imported record stays protected by its import marker and #40 receipts; replay does not recreate original facts.

Scoped note key collisions with different text/metadata are conflicts; do not concatenate, replace or discard incoming context. Existing setup-note collisions may therefore require the user to exclude that unit and resolve it separately. Identical shared context is retained once with its existing identity. Explicit incoming bodyweight identities are preserved when the supported source carries them; otherwise allocate stable destination keys once from the unit identity and original occurrence position. Equal date/value measurements alone are not proof of duplication. Do not collapse distinct supplied bodyweight facts.

These are batch-specific stricter preconditions. The existing `mergeHistoryData`/`WorkoutLifecycle.merge` paths currently keep existing conflicting settings/facts and deduplicate some bodyweights by content; calling them blindly would not prove #82 preservation. Reuse their validators, reference projection and compatible merge logic, adding focused strict batch preparation where necessary. Do not change existing standalone restore/history-merge semantics as incidental cleanup.

## Import identity, provenance and selections

Propose SHA-256 over deterministic canonical JSON (object keys sorted, array order and actual field presence preserved) for new batch/unit fingerprints. An explicit batch ID binds to the original complete envelope fingerprint; changed content under that ID is a conflict. Without a batch ID derive one from that fingerprint. Explicit per-unit IDs are preferred; legacy units retain their existing ID-generation contract, while rich units without an explicit ID receive a fingerprint-derived import ID. Fingerprints do not assert semantic exercise equivalence.

Use the existing owner-scoped imports collection/table and preserved metadata on per-unit import records; no new ledger/table/service or synthetic workout-shaped batch row is proposed. Each successfully imported unit retains its batch ID/envelope digest, source provenance, original payload digest, effective imported record/reference IDs and explicit exclusions. Existing import summary dates are the unit's actual supplied date, never an invented batch workout date. Generated rich-unit IDs use an explicitly versioned prefix, but collisions with existing user IDs are validated rather than assuming any prefix is reserved. Keep arbitrary source metadata as data, escaped in UI, never instructions.

For new markers, matching ID/digest means already imported, even if facts were later corrected/deleted; differing input under the ID is a conflict. For pre-existing single-workout markers without a digest, preserve their established ID-only duplicate protection, label that evidence limitation and never infer that missing facts should be recreated. Detect compatible identical facts already present under stable IDs; differing facts reject. A deliberate whole-unit exclusion consumes no unit marker. Later selection of such a unit is allowed after fresh review, even from the same unchanged batch envelope. Already imported units stay duplicates.

Successful per-unit records bind the batch ID to the envelope, not to a permanent all-or-nothing selection tombstone. Check their batch references/digests when reviewing another selection. An all-duplicate/all-excluded batch is a visible no-op: no new batch provenance or ID reservation is persisted. Exact retries/reimports add no duplicate import/provenance records, aliases, identities, sets, sessions, notes or bodyweights. A later different selection may import only previously excluded/uncommitted units; it does not reapply completed units. The existing #18 rule still applies to excluded sets inside an imported legacy unit: a separate future unit/import ID is required. Preview explains this distinction before confirmation.

## Atomic persistence and recovery

Prepare one complete additive candidate against the original loaded owner revision/base. Reuse existing lifecycle repository preparation/submission under the checked `mergeHistoryBackup` operation, #40 controller, owner lock, full-base/revision checks, durable receipts, retry and resolver fencing. Adapt only the batch preparation route and result/disposition metadata; do not loop separate commitImport calls or save aliases first. The history-capable lifecycle writer already supports complete historical graphs; the normal Inbox action deliberately does not. Batch preparation must prove the candidate is additive and preserves every existing row/relationship/settings, and retain the lifecycle server's current merge-preservation checks.

No new RPC, database table, privilege, protocol/version, second storage authority or offline queue is proposed. If review/implementation establishes that the existing checked boundary cannot enforce this candidate safely, stop and propose the specific uncovered contract; do not broaden writer grants or bypass guards. Do not misuse complete restore to implement append-only batch import.

All selected facts, canonical additions, bodyweight keys, note/context relationships and import/provenance markers share one transaction/revision/receipt. Definitive validation/alias/ID/concurrency rejection writes none. Report each unit as committed, duplicate, deliberately excluded, blocked or outcome unknown. A network failure never yields a false partial-success claim. Keep the selected preview in memory and freeze editing/new writes while pending/uncertain. Retry only the original packet/identities. Conflict requires deliberate refresh/review; no automatic rebase or subset retry. Reload resolves the established owner-bound marker before any new write, without promising restoration of unsaved draft values. Code rollback retains all acknowledged data/markers; no deletion/reset/receipt pruning is recovery.

## Validation and acceptance mapping

Identifiers follow #82's original nine bullets in order. All implementation results are **UNVERIFIED** now; design coverage is not implementation evidence.

| AC | Planned focused evidence | Current result |
| --- | --- | --- |
| AC-1 | File with 10+ mixed supported units; complete review/normalization with zero writes | UNVERIFIED |
| AC-2 | Browser preview of dates/session IDs/dispositions; deselection changes the exact candidate only | UNVERIFIED |
| AC-3 | Rich historical fixture with supplied IDs, snapshot vs actual substitution, ordered sets, notes/scoped setup, pain/RPE/RIR, units, zero/null/uncertainty and provenance; full before/after relationship/content comparison | UNVERIFIED |
| AC-4 | Reuse accepted #18 tests/evidence; focused collection-reference mapping/create/skip, strict equipment variants and conflicts across units | UNVERIFIED |
| AC-5 | Reimport same envelope/selection after reload and after correcting/deleting saved facts; no reapplication or new facts/markers | UNVERIFIED |
| AC-6 | Mixed already-imported/new units, legacy ID-only markers, same envelope later selection and marker/record collisions | UNVERIFIED |
| AC-7 | Invalid/unresolved selected unit blocks whole selection; deliberate whole-unit deselection permits exactly the remaining valid selection; no silent loss of bodyweights/notes | UNVERIFIED |
| AC-8 | Real signed lost-ack replay, hard-reload resolution and same-owner competing batch/import on existing #40 machinery; full aggregate/revision/receipt comparisons; SQL rollback with aliases/notes/registry included | UNVERIFIED |
| AC-9 | Existing single Inbox/interchange/backup/history-merge regressions and IDs unchanged; supported older input remains conservative/sessionless | UNVERIFIED |

Implementation verification should add only focused pure collection/projection tests, relevant existing regressions, actual disposable SQL atomicity/constraint cases, and signed exact-source Preview checks at desktop/390/320 px. Reuse #18/#40 identity/isolation/recovery evidence for unchanged infrastructure; do not repeat broad migration/security/backup campaigns. One representative foreign-owner read/write denial and relevant competing requests are sufficient new integration evidence. Preserve failed/unverified evidence and valid tests. Physical Safari is not specifically required by #82; do not infer it from Chromium. Record any actual physical evidence separately.

Before persistence tests, reuse a sufficiently current verified complete Production backup or perform only the existing authorized read-only export/verification if needed by repository rules; keep all backup contents and file-specific metadata local. No personal import or Production mutation is part of verification. Hosted testing would use at most two tagged disposable staging accounts, existing guarded helpers and exact branch Preview settings, followed by verified exact cleanup; request that bounded fixture scope with implementation approval. Documentation-only preparation requires links/anchors, Markdown/fence, scope and diff checks, not application/device/SQL test repetition.

## Release, decisions and handoff

Propose **3.18.0-BUILD for #82 alone**, following accepted 3.17.0/#18, plus necessary scoped PATCH fixes under the existing version policy. Approval is pending; recheck accepted main/reservations before runtime work. No app/BUILD bump for this document. On implementation update the owning batch/interchange/action docs and candidate release/check records together; do not invent shipped Production release evidence. Existing schemas/models/protocol remain unchanged unless a specific necessary change is separately approved.

Approval requested: (1) this narrow envelope/two-existing-payload contract and historical-unit restrictions; (2) collision, note/bodyweight preservation and duplicate/selection/provenance contracts; (3) one additive lifecycle transaction under existing checked recovery, with focused validation and no new infrastructure; (4) 3.18.0/#82 and scoped PATCH mapping; (5) at-most-two-owner disposable staging setup/use/cleanup and branch-only Preview verification. These are new batch decisions; #18 approval does not authorize them. Implementation stays paused until recorded approval, while this reviewable proposal is delivered.

Preparation completion report: one new file `docs/V3_BATCH_IMPORT_PROPOSAL.md`, focused branch from accepted `fb7aef2`; final commit/PR and actual doc-check results recorded in the PR/chat report. No runtime/configuration/schema/generated-file/Production-data changes, version bump or deployment acceptance. AC-1 through AC-9 UNVERIFIED for implementation. Existing checkouts/user changes preserved. No application/SQL/device suites rerun for preparation. State: **design ready for owner review / Needs decision**, not implementation complete or issue Done. Next action is approval/amendment of the concrete proposal; no #82 merge or Production operation is authorized.
