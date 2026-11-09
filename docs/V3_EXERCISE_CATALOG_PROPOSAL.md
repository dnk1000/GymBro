# Issue #17 — exercise catalog and merge proposal

Status: **proposed; not approved or implemented**. Prepared November 8, 2026
(America/New_York) from accepted `main`
`df7e162bac9cee5cae0a1db32aa24fc5707e50c6`.

The owner authorized implementing, committing and merging #17, then #37, then
#34 in that order. That supplies merge permission. It does not specify how to
resolve the architectural conflicts below or assign an application release.
This proposal makes those decisions reviewable before dependent implementation.

## Governing requirements and findings

- [Issue #17](https://github.com/dnk1000/GymBro/issues/17) requires canonical
  rename/metadata/aliases/archive, explicit relationship-preserving merge,
  provenance and conservative duplicate suggestions.
- [PRD](GymBro_PRD.md#current-product-scope-and-authority) and
  [current architecture](CURRENT_ARCHITECTURE.md) govern normal authenticated
  cloud authority. The accepted cutover amendment takes precedence over their
  retained historical local-authority descriptions.
- [Exercise identity](EXERCISE_IDENTITY.md#identity-and-ownership) makes IDs
  immutable, aliases exact and owner-scoped, and historical labels provenance.
  It explicitly reserves catalog merging for #17.
- [Relational design](V3_RELATIONAL_SCHEMA_PROPOSAL.md),
  [concurrency](V3_CONCURRENCY_PROPOSAL.md) and
  [lifecycle](V3_DATA_LIFECYCLE_PROPOSAL.md) govern atomic writes, immutable
  historical intent, owner isolation, receipts and recovery.
- [Note scopes](NOTE_SCOPES.md) preserve distinct setup and occurrence notes.
  [Brand/UI](BRAND_AND_UI.md) governs presentation.
- [Version policy](VERSION_POLICY.md) requires an approved release mapping;
  #17 has none. Current main is `3.18.11-20261108T034614Z`.

`app.js` already provides one Exercises list/detail path (`renderExercises` /
`showExercise`), usage counts, deterministic performance and scoped notes.
`exercise-identity.js` already provides pure rename and alias additions.
`WorkoutCloud` already routes writes through one revision/recovery controller.
Reuse these surfaces and primitives; do not build a second catalog/store.

The existing SQL blocks alias reassignment and snapshot mutation:

- `20261030043000_workout_concurrency.sql` treats `aliases`, `snapshot_slots`
  and `guided_requests` as append-only and rejects changed existing rows.
- `20261028042000_workout_relational_foundation.sql` additionally protects
  historical snapshot/completed-guidance changes, and gives setup notes a
  single `(owner_id, exercise_id)` key. Exercise occurrence notes also have
  identity-based uniqueness.
- Existing repository action/operation allowlists contain no catalog merge.
  Whole-backup replacement is a distinct confirmed lifecycle operation, not
  permission to implement ordinary merges through a generic replacement.

Consequently #17 is **Change Level 3**: persisted identity, historical
relationships, alias integrity, recovery and authorization are affected.
Existing approvals establish the foundations but do not approve this merge
exception. Readiness is **Needs decision** under the
[decision-resolution procedure](DEVELOPMENT_WORKFLOW.md#material-conflicts-and-decision-resolution).

## Recommended implementation contract for approval

### Catalog editing and archive

Use the existing canonical detail panel for display name, modeled intrinsic
metadata, explicit alias addition and archive/restore. Keep contextual
role/order/short inclusion on template/session relationships. Rename preserves
the ID, former aliases, original source labels and every workout fact.
Exact alias/name collisions reject atomically. Alias removal/reassignment is
not exposed as a general editor capability in this issue; merge has the sole
scoped reassignment path described below. No fuzzy normalization is introduced.

Archive filters ordinary new-exercise pickers while preserving History,
current template contents, active-session recovery and deliberately selected
archived entries. Restore is explicit. Filtering must not silently drop an
already selected template/session exercise.

### Explicit merge with a narrow historical identity exception

Recommend an atomic **source into destination** operation, with both IDs shown
in review and one explicit confirmation. Keep the destination ID/metadata.
Retain the source record as archived merge provenance; never delete it or reuse
its ID. Record source/destination IDs and names, owner, server timestamp,
operation identity, previous source metadata/aliases and affected references
in durable audit metadata that participates in complete backup/restore.

The narrowly approved exception would allow this operation alone to change
`exercise_id` references in sets, current template slots, snapshot slots,
guided actual-exercise slots and scoped notes from source to destination.
Preserve all original labels, record IDs, slot IDs, array positions, session
membership, historical template/role/duration intent, timestamps, numbers,
units, effort, pain, notes, explicit uncertainty and unknown metadata.
Snapshot identity remapping must never allow snapshot editing or extension.
Guided request signatures/tombstones stay byte-for-byte intact; old request
replay must continue to resolve its original receipt rather than log again.

Move source aliases to the destination under the same transaction. Keep the old
display name as an alias by default. If the user explicitly declines that alias,
preserve its historical label/reference provenance and audit disposition;
validate that historical reconstruction no longer relies on that alias being
an active matcher. Existing display-name alias triggers and same-owner foreign
keys need a deliberately reviewed transition, not a blanket grant relaxation.

If two notes would collide at a unique setup/occurrence key, **reject the merge
without writes** and show the conflicting scoped notes for explicit resolution
through existing note editing. Do not concatenate, overwrite, discard or infer
note meaning. The user can resolve the conflict deliberately and review again.
Reject self-merges and already merged/invalid targets. Review may be cancelled
without writes; stale reviews require refresh and renewed review.

Implement a dedicated checked catalog mutation path within the existing
repository/controller, owner lock, revision, receipt and resolution/fence
protocol. Its SQL validator must prove the exact permitted transformation from
the authoritative base. Any temporary writer capability must remain private,
owner-scoped, non-login/non-BYPASSRLS and unavailable to ordinary mutations.
Do not disable global guards or widen browser DML grants. SQL/function names and
internal helpers are implementation choices inside this approved boundary.

Use an additive migration; never edit applied migrations. Keep existing backups
readable. Before approving the implementation, verify that the chosen audit
representation and archived-source handling round-trip through current complete
backup validation and lifecycle reconstruction. If a format/model version
change proves necessary, amend this proposal with the exact compatibility
transition before implementing it. Code rollback retains committed merged facts
and audit; it must not restore stale data or reverse a merge automatically.
Undo/unmerge is outside scope.

### Duplicate suggestions and scope

Use a deterministic, read-only similarity suggestion over visible catalog
names/aliases. Explain that entries are possible duplicates, never equivalent
exercises. Suggestions only open the same explicit source/destination review.
No automatic merges, training taxonomy generation, import redesign, provider
integration, or #37/#34 layout changes belong in #17.

## Verification and acceptance plan

Stable identifiers below follow the original issue's seven ACs in order. All
are currently **UNVERIFIED**; this document is planning evidence only.

| AC | Required evidence |
| --- | --- |
| AC-1 | Rename, reload and compare stable-ID performance/history continuity and exact source labels. |
| AC-2 | Metadata edits change only approved catalog fields; full historical content/relationships compare equal. |
| AC-3 | Merge Rope Triceps Pressdown into Rope Triceps Pushdown across sets, templates, active/completed sessions and notes; every intended reference resolves to the destination. |
| AC-4 | Keep former-name alias, reload and resolve a future import; separately verify explicit alias exclusion and historical reconstruction. |
| AC-5 | Full before/after preservation comparison, exact expected identity-only changes, no duplicate sets, opaque request-signature preservation, receipt replay, collision rejection and failed-write rollback. |
| AC-6 | Archive survives reload; old History/current templates/active sessions remain accessible; ordinary new selection excludes archived entries; deliberate selection/restore works. |
| AC-7 | Suggestions write nothing; cancel writes nothing; merge occurs only after explicit reviewed confirmation. |

Run focused identity/catalog/repository/controller/backup/import/performance
regressions, disposable PostgreSQL fresh/replay migration and exact relational
comparisons. Exercise note/alias collisions, stale review and competing
merge/import requests, committed-response loss, retry/reload/resolution/fence,
owner isolation and attempts to change any non-permitted field. Confirm normal
mutation paths still reject alias reassignment and historical snapshot edits.
Test canonical complete backup/restore of merged data and pre-change backups.

Use the existing Vercel project and exact-source Preview at desktop, 320 and
390 px with disposable data and console checks. Hosted schema apply and tagged
synthetic-owner setup/use/cleanup require a concrete reviewed operational scope;
this document performs or authorizes none. Required physical iPhone evidence
must record device/iOS/Safari/SHA/build/results; responsive Chromium cannot
substitute. No owner's workout data or Production mutation is needed to develop
the feature. Production schema promotion and final Level 3 acceptance remain
separate gates.

## Decisions needed and proposed release

Approve the bounded historical-reference/alias exception and conflict behavior
above, or choose an alternative and update the design before implementation.
The alternative is a persisted canonical redirect graph: retain every old FK
and alias target, but resolve all selectors/imports/performance through redirects.
That avoids physical snapshot rewrites at the cost of a new identity-resolution
and backup compatibility contract across every consumer. It is not a safe
unapproved shortcut. Generic whole-backup replacement is not recommended.

Propose **3.19.0 for #17 alone**, with scoped PATCH fixes, subject to explicit
approval under VERSION_POLICY.md. Do not infer this from the issue title or
publish that version yet. #37 and #34 keep separate PRs and later explicit
release mappings. Both require actual physical iPhone review before acceptance
per their issues; advance permission cannot stand in for observed device results.

Approval must identify the exact proposal revision and amendments. The owner's
existing commit/merge permission remains valid for the authorized scope; it need
not be requested again. After design/version approval, implement #17, gather
required evidence, obtain applicable final acceptance, and then use that merge
permission before starting #37 followed by #34.
