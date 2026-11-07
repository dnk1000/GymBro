# Smart Import Resolution — issue #18

Implementation contract for [PR #93](https://github.com/dnk1000/GymBro/pull/93), under the [approved Level 3 proposal](V3_SMART_IMPORT_RESOLUTION_PROPOSAL.md). Actual verification and pending human acceptance are recorded in the PR. This document does not claim Production deployment.

## Review and commit

The normal cloud ChatGPT Inbox accepts the existing [JSON interchange](CHATGPT_IMPORT_SCHEMA.md). Known canonical UUIDs, exact display names and saved exact aliases resolve automatically. The summary reports canonical matches, saved aliases, unresolved labels, approved mappings, new exercises, skipped labels, and included/excluded set counts. Repeated unresolved labels share one choice:

- **Use an existing exercise:** explicitly map the incoming label to that immutable ID and save the label as a user-approved alias.
- **Create new exercise:** allocate a GymBro UUID at commit preparation, using existing Uncategorized/default metadata and import-created provenance.
- **Skip these sets:** deliberately exclude that label's rows. Existing per-set include controls still work.

Preview and choices write nothing. Included unresolved/invalid rows block commit. Equipment variants and similar names remain distinct; there is no fuzzy matching, normalization beyond existing interchange trimming, inferred equivalence or silent merge. Exact owner-scoped aliases cannot be reassigned. A changed incoming label invalidates its previous decision. A refreshed catalog is revalidated; a now-colliding creation or incompatible mapping must be reviewed again.

**Excluded sets are not saved. Once the selected workout is committed, importing excluded sets later requires a separate future import with a new import ID.** The original import ID remains consumed, including after corrections/deletions. This preserves existing per-set selection semantics; it does not add partial-workout continuation or semantic duplicate detection.

## Domain and persistence boundary

`ImportResolution.review(catalog, references, decisions)` is DOM/storage/network independent and accepts a collection of normalized references. It returns detached rows, exact-label groups, errors/counts and a candidate catalog. Preview does not allocate new exercises; `ImportResolution.prepare(catalog, draft)` materializes explicitly approved new identities once and validates the resolved single-workout draft. This collection boundary is reusable by #82; no batch format or batch workflow is implemented here.

`WorkoutCloud` reuses `commitImport`, `ExerciseIdentity.addAlias/createExercise`, the existing canonical repository projection and #40's checked controller/RPC. Approved aliases/new catalog records and the selected sessionless sets, optional bodyweight, import metadata, revision and receipt share one transaction. The packet compares against the original loaded state, not the candidate catalog. Rejections/conflicts cannot publish partial aliases or facts. Original incoming labels remain provenance on canonical references; other existing notes/pain/effort/zero/null/completeness/date/unit semantics and import-ID generation remain unchanged.

Lost confirmation retains the preview and blocks edits/new submission. Use the existing Data Retry same request or Check result controls; the frozen original packet reuses its allocated IDs. An acknowledged successful import/replay clears the preview. Conflict requires deliberate refresh/review; hard reload resolves the recovery marker before new writes and does not promise unsaved draft restoration. No offline queue or background retry is added.

Manual logging/program creation, backups/history merge and non-Production V2 development adapters retain their own existing contracts. Full catalog editing, merge, archive policy, duplicate suggestions, rich session interchange and batch UI remain outside #18. No schema/migration/permission/protocol changes are introduced.

## Verification and acceptance

The PR's canonical report maps AC-1 through AC-8 to actual resolver/controller/browser and disposable SQL/signed Preview results, negative evidence, exact SHA/build and fixture cleanup. Physical iPhone/Safari evidence is reported separately when available. Explicit Level 3 human acceptance and merge remain pending until recorded; green tests alone do not close #18.
