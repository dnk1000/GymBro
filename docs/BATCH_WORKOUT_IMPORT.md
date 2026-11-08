# Batch Workout Import — issue #82

Candidate implementation under [PR #94](https://github.com/dnk1000/GymBro/pull/94) and the [approved Level 3 design](V3_BATCH_IMPORT_PROPOSAL.md). Technical evidence and human acceptance status are recorded in the PR; this document does not claim Production deployment.

## One upload, one deliberate confirmation

Load a JSON file through ChatGPT Inbox. The batch preview lists all workouts with date/session identity, exercise/set counts, warnings and disposition. Resolve only exceptional exercise labels, deselect any workouts not wanted, and select **Confirm selected workouts** once. Review and choices write nothing. Any invalid/unresolved/conflicting selected unit blocks the entire selected commit; explicitly deselect it to proceed with exactly the remaining valid selection. A skipped required historical exercise excludes the whole historical unit, preserving its graph.

The initial envelope is:

```json
{
  "format": "gymbro-workout-batch",
  "formatVersion": 1,
  "batchId": "optional-stable-batch-id",
  "source": "chatgpt",
  "workouts": [
    {"importId": "workout-1", "workout": {
      "schema": "gym-tracker-chatgpt-v1", "date": "2026-11-07",
      "sets": [{"exercise": "Seated Row", "weight": 0, "unit": "lb", "reps": 8, "complete": false}]
    }}
  ]
}
```

`workouts` must be nonempty and supports ten or more units. Each item has exactly one `workout` or `history` payload. `batchId` is optional; otherwise a SHA-256 identity is derived from canonical JSON (sorted object keys, preserved array order/field presence). Optional envelope `provenance` is preserved JSON data. Unsupported versions reject rather than falling through to single-workout parsing.

- `workout` uses the unchanged [single-workout interchange](CHATGPT_IMPORT_SCHEMA.md), with its normalization/validation, explicit or generated import IDs, deterministic set IDs, bodyweight and summary notes. Wrapper/inner explicit IDs must agree. These facts stay sessionless; dates never fabricate sessions/timestamps. Existing per-set exclusions remain part of that supported payload; the batch UI selects whole workouts.
- `history` is a complete existing supported GymBro portable JSON document or same-owner cloud-backup v1 containing one supplied completed session with its entire graph, or only sessionless facts on one supplied date. Active/multiple sessions/dates, foreign cloud owners and dangling/unrelated relationships reject. It is an existing record model, not a new partial session schema. Program/preferences/root context from the source are provenance, not replacements for current settings. Legacy source versions use the existing conservative migration. The current active workout remains unchanged.

Exact canonical IDs/names/aliases reuse #18. Explicit map/create/skip choices are shared across selected references; similar equipment/exercise names never imply equivalence. Supplied cloud exercise IDs cannot be retargeted. A conflicting canonical definition rejects the affected selection rather than rewriting it. A same-owner new identity can retain its supplied GymBro ID after explicit creation approval.

## Preservation, collisions and duplicates

Rich history copies supplied IDs, local dates, set arrays and session setIds order, snapshots, planned/actual relationships, guidance/signature metadata, scoped session/occurrence/setup notes, pain/RPE/RIR, units, zero/null/omitted fields, complete:false and supported unknown record metadata. It does not replay create/finish-session actions. Whole-record/key collisions require equal content or reject; no rekeying, overwrite or concatenation. Conflicting setup context is an explicit error. Equal bodyweight date/value does not erase a distinct supplied identity; missing relational bodyweight keys derive from unit ID/occurrence position. Root/container/exercise-definition source context is retained in import provenance without changing current settings.

Per-unit records in the existing imports collection carry versioned `batchImport` metadata: batch/envelope identity, unit digest, source/provenance, record IDs and exclusions. New rich IDs use `history-v1:<digest>` unless explicitly supplied; generated-ID prefixes are not assumed reserved. Existing user-ID collisions are checked. Reused IDs/digests remain duplicates even after imported sets are corrected/deleted. Existing pre-batch markers retain their ID-only duplicate contract and are labelled accordingly. New different content under a committed unit/batch ID is a conflict.

Whole-unit exclusion consumes no unit ID; the same unchanged batch can later import only never-committed units after fresh review. Exact reimports add no duplicate facts, identities, aliases, measurements or provenance. An all-duplicate/all-excluded batch is a visible no-op with no new ID reservation. Excluded sets inside an imported legacy unit still require a **separate future import with a new unit/import ID**, as in #18.

## Domain, transaction and recovery boundary

`BatchImport.review(base, payload, {selected, resolutions})` parses the complete collection and prepares a detached preview/candidate. `prepare` requires explicit confirmation and reruns validation against current acknowledged state. Strict batch append checks deliberately avoid the generic history merge's content-based bodyweight deduplication and keep-existing conflict rules. Existing single import/restore/history-merge workflows remain unchanged.

The cloud facade sends batch preparation through the existing `mergeHistoryBackup` lifecycle action, repository and checked RPC. All selected facts/catalog additions/notes/bodyweight keys/provenance commit in one transaction/revision/receipt, based on the original loaded aggregate. The server's existing additive-preservation rules remain intact. No new schema, RPC, writer grant, protocol or offline queue is introduced.

Uncertain confirmation retains the preview, reports unknown dispositions, and blocks editing/new submission. Use existing Data Retry same request or Check result controls; the frozen packet and IDs are reused. Hard reload resolves the existing owner marker before another write and does not promise to restore unsaved preview state. Conflicts require explicit refresh/review; no automatic rebase or subset retry. Confirmed outcomes show each unit's committed/duplicate/excluded disposition.

Preview verification uses existing tagged disposable owners and guarded branch settings; historical Preview sources must carry the matching synthetic tag. Source-pinned migration rehearsals do not accept batch uploads. Normal Production authority, backup formats and inactive local bytes are not changed. This work does not authorize any Production operation.

## Recorded technical verification — 2026-11-08 UTC

State: **implemented and technically verified; human acceptance pending** in [PR #94](https://github.com/dnk1000/GymBro/pull/94). Issue #82 remains open. The approved design revision is `5851f94b24fb5be9021f8bc94417d15630d8945b`; [implementation approval](https://github.com/dnk1000/GymBro/issues/82#issuecomment-6715988149) covers 3.18.0 and scoped PATCH fixes. Accepted implementation base is `fb7aef24c7aa07635896aee4809ce981a4689a1f`. Final runtime revision is `2d65eaaf28d7c4eaa766b26ebdae23d897eae3df`, candidate **3.18.2-20261108T023453Z**, schema 8 unchanged.

Evidence used below:

- **Domain:** seven passing `tests/batch-import.test.cjs` cases, including exact historical graph/content comparisons, strict set/setup collisions, cloud source metadata and supplied identities, foreign-owner rejection, ID spellings, deterministic duplicate markers and controller rollback/replay/conflict assertions. Existing #18 identity/resolution checks remain valid; no second resolver was introduced.
- **Controlled browser:** the three #82 cases in `tests/cutover-browser.test.cjs` passed at 320, 390 and 1280 px: file upload, selection, invalid/unresolved blocking, explicit creation, no review writes, uncertain-result lock and replay/dispositions. These exercise the real UI/controller with controlled transport; they are distinct from signed hosted checks.
- **Signed Preview:** `scripts/verify-issue82-preview.cjs` passed all seven check groups against staging project `obebuvpsqapgevwivwho`, two tagged disposable owners, Chrome/Chromium at 320/390/1280 px and exact served runtime assets. Source `9fad29eb5be4589b01084b202e6d493cef899824`, build `3.18.1-20261108T023052Z`, immutable [Preview deployment](https://gymbro-ojkx2xo5a-dnk-9999.vercel.app), deployment `dpl_C6R3gTktA6HKJbKLhesfuGTyMXrj`. Checks covered 10-unit transactions, full restored historical records/relationships and unchanged current program, mixed duplicates, real lost acknowledgements with identical retry, reload/result resolution, actual SQL whole-transaction rejection, concurrent OK/CONFLICT outcomes and foreign-owner read/write denial. No unexpected browser errors.
- **Final PATCH:** the only runtime change after that signed run tightened wrapper/inner legacy import-ID agreement. All four nested spelling combinations have domain coverage. The same verifier's `--wrapper-only` mode passed against exact final runtime assets, [final Preview deployment](https://gymbro-jbd3nky6v-dnk-9999.vercel.app), deployment `dpl_EtwHLSzU2FJNmrMMQcWuuM133uK7`: conflicting nested ID visibly blocks confirmation with unchanged complete cloud rows and no unexpected browser errors. The earlier preservation/recovery evidence is reused for unchanged paths.
- **CI:** [run 200](https://github.com/dnk1000/GymBro/actions/runs/42439217424) passed at the final runtime revision: complete regression suite, syntax/release/diff checks and disposable database replay. Focused release-tool tests also passed (8/8).

Stable AC identifiers follow the nine issue bullets in order. PASS below means technical evidence, not human acceptance.

| AC | Actual method/evidence | Result |
| --- | --- | --- |
| AC-1 | Domain ten-unit detached review; controlled file upload and signed ten-unit file at all three widths; complete cloud rows unchanged before confirmation | PASS |
| AC-2 | Controlled preview dates/counts/dispositions and deselection; domain exact selected candidate and later selection of previously excluded unit | PASS |
| AC-3 | Domain deep comparison of supplied session/set graph, snapshots/order, scoped notes, context, bodyweights and provenance; signed restored-content comparison; differing set/setup records reject | PASS |
| AC-4 | Shared #18 resolver map/create/skip and persisted alias assertions; supplied canonical IDs cannot retarget; signed explicit alias mapping; accepted strict identity/equipment checks reused | PASS |
| AC-5 | Domain marker replay after facts are removed; signed exact-envelope NO_CHANGE with identical complete rows/revision after lost acknowledgement and reload | PASS |
| AC-6 | Domain committed/excluded/new distinction and later selection; signed second/third ten-unit batches identify existing rich history and commit only the nine new units | PASS |
| AC-7 | Domain invalid/unresolved/collision/unsupported source rejection; controlled UI disables confirmation until explicit resolution/deselection; final signed ID-conflict check writes nothing | PASS |
| AC-8 | Domain frozen-packet replay/rollback/stale writer; real signed lost-ack retry at 320/1280, reload resolution at 390, SQL atomic rejection and competing OK/CONFLICT requests | PASS |
| AC-9 | Final CI complete existing single-workout/JSON/identity/lifecycle suite and database replay; legacy normalization, validators, ID algorithm and standalone restore/merge remain unchanged | PASS |

Cleanup passed: the existing exact-owner helper removed both tagged synthetic accounts, workout rows, receipts and revisions; independent SQL confirmed zero remaining owner rows and temporary passwords were removed. The eight temporary branch-only Preview settings were removed, that Preview redeployed, and a subsequent read confirmed its workout capability disabled. No Production deployment/settings/data operation occurred. Reports/screenshots remain in local ignored `test-results/`; this record preserves the non-secret results. Existing verified complete-backup evidence was reused for the unchanged store/schema; no fresh Production snapshot is claimed.

Negative evidence and disposition: initial browser checks exposed missing uncertain per-unit text and a generic retry handler clearing final dispositions; both were corrected and all three focused browser cases passed. Self-review found cloud source-envelope/catalog context loss and incomplete nested ID-spelling agreement; scoped 3.18.1/3.18.2 corrections and regression evidence address both. An initial sandboxed release-tool run could not initialize temporary Git metadata; the unchanged eight tests passed with the required filesystem access. No valid assertion was weakened or skipped. Physical iPhone/Safari was not tested and is not required by #82; responsive Chromium is not device evidence. No required technical verification remains outstanding. Final acceptance, merge and any Production decision remain with the owner.
