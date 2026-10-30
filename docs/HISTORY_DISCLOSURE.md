# History disclosure — issue #20

Candidate from accepted main `2da1ef92bd7fa491b499c5f5a1d674bb7eeef546`, branch `codex/issue-20-history-collapse`. The user requested #20 alone and approved **3.7.0 for #20 alone** on October 30, 2026. Change Level **2**: new History presentation interactions within the existing model, with no foundational data/security change or separate proposal gate.

## Interaction contract

Each explicit session and legacy/date display group has an independent native `details` disclosure. Cards start collapsed on entering History or reloading. The whole summary is a keyboard/touch target with a visible chevron. It shows the local date, saved snapshot name or Unplanned workout, reliable existing mode/status, set and exercise counts and exercise names. Legacy/sessionless wording and the explanation that no saved session identity exists remain visible.

Expand all and Collapse all affect cards in the current source filter. Disclosure state survives rerenders, repeated History-tab clicks and source-filter changes during the visit, including temporarily hidden groups. Leaving and returning starts a new collapsed visit. State lives only in the UI; it is not part of workout persistence or backups.

Expanded details retain the existing ordered set table, scoped notes, guided status and edit/delete/correction actions. `getHistoryGroups`, session identity, snapshots, source filtering, session set ordering and action rules are unchanged. Empty explicit sessions remain available under All history. Nested Record details and Guided exercise status remain independent controls. Tables retain their existing internal horizontal scroll on phones.

Workout schema 8, the localStorage key `daveGymTrackerV1`, cloud model/protocol, interchange and backup compatibility are unchanged. No migration or Production-data operation is needed. Future #21/#36 may compose inside the disclosure; neither issue is implemented here.

## Validation and acceptance evidence

Validation approach: focused browser disclosure/state/touch/keyboard regressions; existing History grouping, correction/deletion, notes and release regressions; syntax/release/diff checks and CI. Verify the exact Vercel Preview at 320/390/1280 px with disposable data and console checks. Physical iPhone Safari is a separate required AC-9 check.

Local verification: **225/225** complete application tests passed (zero failures/skips), including four new disclosure/responsive cases. The focused History run passed 22/22 selected tests/files. Syntax (58 JavaScript files), canonical release and whitespace checks passed. Browser: installed desktop Chrome, disposable localhost contexts at 320/390/1280 px; page-error assertions passed. Screenshots were inspected. Exact Preview/console and CI evidence remain pending.

| Criterion | Method / evidence | Result |
| --- | --- | --- |
| AC-1 — Initially collapsed | New browser disclosure regression | PASS — local |
| AC-2 — Scan summaries without visible set rows | Summary/count/visibility assertions, responsive screenshots | PASS — local |
| AC-3 — Header opens the correct ordered details | Independent identity/order assertions, full-header touch and keyboard checks | PASS — local |
| AC-4 — Repeated header activation collapses | Mouse/touch/Enter/Space assertions | PASS — local |
| AC-5 — Multiple cards open independently | Same-date sessions plus legacy date group, rerender/filter assertions | PASS — local |
| AC-6 — Expand all / Collapse all | Bulk-control assertions | PASS — local |
| AC-7 — Explicit and legacy/sessionless support | Existing grouping/fixture/source tests and new disclosure checks | PASS — local |
| AC-8 — Historical facts/order and correction actions unchanged | Existing History/action/note tests; disclosure counts zero storage writes and compares full memory/raw storage | PASS — local |
| AC-9 — iPhone Safari layout | Responsive Chromium does not establish physical Safari behavior | UNVERIFIED — physical device pending |

## Completion report

- Scope/delivery: #20 only; focused branch above. Runtime changes: `app.js`, `index.html`, `styles.css`, canonical `app-version.js`. Verification changes: `tests/app.test.cjs`, release checker and its tests. Documentation: this contract, existing History guidance and version/candidate records. Exact revision/PR and final diff are pending. Intended file set: `app-version.js`, `app.js`, `index.html`, `styles.css`, `scripts/check-release.cjs`, `tests/app-version.test.cjs`, `tests/app.test.cjs`, `tests/release-tools.test.cjs`, `docs/CHANGELOG.md`, `docs/HISTORY_AND_BACKUPS.md`, `docs/HISTORY_DISCLOSURE.md`, `docs/RELEASE_HISTORY.md`, `docs/V3_RELEASE.md`, `docs/VERSION_POLICY.md`.
- Data/documentation: no schema, persistence, identity, migration or supported-format change. Existing detail regressions now explicitly use Expand all before exercising their original assertions; those assertions are preserved. Release metadata follows the approved mapping; previous candidate evidence is retained.
- Deviations/negative evidence: no scope deviations. The initial affected-domain run passed 40/41: a stale exact application-version assertion still expected 3.6.6. It was aligned to approved 3.7.0 without weakening immutability/schema checks; the subsequent complete run passed 225/225. Physical iPhone Safari remains untested. No personal backup, personal-data testing, migration, Production delivery, acceptance or merge is claimed.
- Claimed state/handoff: verification in progress. Required technical checks/Preview evidence remain pending; AC-9 needs actual device/iOS/browser/build/revision/results. Keep #20 open and the PR unmerged.
