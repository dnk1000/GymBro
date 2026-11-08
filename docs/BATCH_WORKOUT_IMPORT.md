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
