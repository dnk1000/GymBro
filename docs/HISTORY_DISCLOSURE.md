# History disclosure — issue #20

Candidate from accepted main `2da1ef92bd7fa491b499c5f5a1d674bb7eeef546`, branch `codex/issue-20-history-collapse`. The user requested #20 alone and approved **3.7.0 for #20 alone** on October 30, 2026. Change Level **2**: new History presentation interactions within the existing model, with no foundational data/security change or separate proposal gate.

## Approved compact refinement — 3.7.1 candidate

Approved October 30, 2026 in the #20 conversation. Compact three-line summaries retain date/name/counts, show two exercise names plus +N, and move full names/badges/legacy explanation into expanded details. Card spacing and the page header are condensed. Existing disclosure and data/action rules remain unchanged. Focused History checks passed 22/22 and release tests passed 9/9; syntax/release/diff checks passed. Exact Preview and CI results are tracked in PR #66; earlier 3.7.0 results remain historical. Physical Safari AC-9 remains UNVERIFIED. Normal collapsed rows now show date/name, set/exercise counts, and a single-line preview of two names plus +N remaining exercises. All names, reliable mode/status badges and the legacy explanation remain in expanded details. Padding is 10 px vertically and gaps are 6 px; short-title rows target 85–100 px while long titles may wrap. The user approved this change in the current #20 conversation. Current AC evidence belongs in [PR #66](https://github.com/dnk1000/GymBro/pull/66); the original 3.7.0 evidence below remains historical.

## Original interaction contract — 3.7.0

Each explicit session and legacy/date display group has an independent native `details` disclosure. Cards start collapsed on entering History or reloading. The whole summary is a keyboard/touch target with a visible chevron. It shows the local date, saved snapshot name or Unplanned workout, reliable existing mode/status, set and exercise counts and exercise names. Legacy/sessionless wording and the explanation that no saved session identity exists remain visible.

Expand all and Collapse all affect cards in the current source filter. Disclosure state survives rerenders, repeated History-tab clicks and source-filter changes during the visit, including temporarily hidden groups. Leaving and returning starts a new collapsed visit. State lives only in the UI; it is not part of workout persistence or backups.

Expanded details retain the existing ordered set table, scoped notes, guided status and edit/delete/correction actions. `getHistoryGroups`, session identity, snapshots, source filtering, session set ordering and action rules are unchanged. Empty explicit sessions remain available under All history. Nested Record details and Guided exercise status remain independent controls. Tables retain their existing internal horizontal scroll on phones.

Workout schema 8, the localStorage key `daveGymTrackerV1`, cloud model/protocol, interchange and backup compatibility are unchanged. No migration or Production-data operation is needed. Future #21/#36 may compose inside the disclosure; neither issue is implemented here.

## Validation and acceptance evidence

Validation approach: focused browser disclosure/state/touch/keyboard regressions; existing History grouping, correction/deletion, notes and release regressions; syntax/release/diff checks and CI. Verify the exact Vercel Preview at 320/390/1280 px with disposable data and console checks. Physical iPhone Safari is a separate required AC-9 check.

Local verification: **225/225** complete application tests passed (zero failures/skips), including four new disclosure/responsive cases. The focused History run passed 22/22 selected tests/files. Syntax (58 JavaScript files), canonical release and whitespace checks passed. Browser: installed desktop Chrome, disposable localhost contexts at 320/390/1280 px; page-error assertions passed. Screenshots were inspected. Runtime revision [`d0f10bde04a610e1c003f25bfe50353cb57e8056`](https://github.com/dnk1000/GymBro/commit/d0f10bde04a610e1c003f25bfe50353cb57e8056) passed both application regression and disposable database replay jobs in [CI 41068557901](https://github.com/dnk1000/GymBro/actions/runs/41068557901). No database source was changed; its automatic CI remains supporting evidence. The external Supabase per-PR branch check was skipped because that integration is disabled, matching existing project configuration.

| Criterion | Method / evidence | Result |
| --- | --- | --- |
| AC-1 — Initially collapsed | New browser disclosure regression | PASS |
| AC-2 — Scan summaries without visible set rows | Summary/count/visibility assertions, responsive screenshots | PASS |
| AC-3 — Header opens the correct ordered details | Independent identity/order assertions, full-header touch and keyboard checks | PASS |
| AC-4 — Repeated header activation collapses | Mouse/touch/Enter/Space assertions | PASS |
| AC-5 — Multiple cards open independently | Same-date sessions plus legacy date group, rerender/filter assertions | PASS |
| AC-6 — Expand all / Collapse all | Bulk-control assertions | PASS |
| AC-7 — Explicit and legacy/sessionless support | Existing grouping/fixture/source tests and new disclosure checks | PASS |
| AC-8 — Historical facts/order and correction actions unchanged | Existing History/action/note tests; disclosure counts zero storage writes and compares full memory/raw storage | PASS |
| AC-9 — iPhone Safari layout | Responsive Chromium does not establish physical Safari behavior | UNVERIFIED — physical device pending |

## Exact Preview verification

[Branch Preview](https://gymbro-git-codex-issue-20-history-collapse-dnk-9999.vercel.app/) / [deployment](https://vercel.com/dnk-9999/gymbro/326H5uFLtpTKN5w5qAvawmY6yQgW), runtime revision `d0f10bd`, build `3.7.0-20261030T135802Z`, checked October 30, 2026. Desktop Chrome **156.0.8078.48**, signed-in browser; requested viewport widths 320/390/1280 px (browser reported 320/391/1281 px respectively). Each stayed within the viewport; expanded tables retained internal overflow. Viewport override was reset afterward.

The task-owned branch origin used the existing seeded sample history plus one explicitly tagged disposable session/set (1 lb × 1) and session note created through the normal UI. No existing record was deleted or replaced, no complete restore was submitted, and no Production origin was used. Initial collapsed summaries, explicit and legacy disclosure, independent expansion, retained filter state, nested guidance/scoped notes/set fields, bulk controls, keyboard Enter, and a new collapsed History visit were checked. Browser warning/error logs were empty. The native screenshot was captured to the task artifact folder; tab screenshot capture itself was unavailable.

## Completion report

- Scope/delivery: #20 only; focused branch above. Runtime changes: `app.js`, `index.html`, `styles.css`, canonical `app-version.js`. Verification changes: `tests/app.test.cjs`, release checker and its tests. Documentation: this contract, existing History guidance and version/candidate records. Runtime revision `d0f10bde04a610e1c003f25bfe50353cb57e8056`; [draft PR #66](https://github.com/dnk1000/GymBro/pull/66), open/unmerged. The evidence follow-up changes documentation only and retains this build. Scope checked using `git diff --name-only 2da1ef92bd7fa491b499c5f5a1d674bb7eeef546...HEAD`: exactly the 14 intended files; no unexpected changes. The issue worktree was clean after the runtime commit. Original checkout issue #39 edits/untracked files were verified unchanged in place. Intended file set: `app-version.js`, `app.js`, `index.html`, `styles.css`, `scripts/check-release.cjs`, `tests/app-version.test.cjs`, `tests/app.test.cjs`, `tests/release-tools.test.cjs`, `docs/CHANGELOG.md`, `docs/HISTORY_AND_BACKUPS.md`, `docs/HISTORY_DISCLOSURE.md`, `docs/RELEASE_HISTORY.md`, `docs/V3_RELEASE.md`, `docs/VERSION_POLICY.md`.
- Data/documentation: no schema, persistence, identity, migration or supported-format change. Existing detail regressions now explicitly use Expand all before exercising their original assertions; those assertions are preserved. Release metadata follows the approved mapping; previous candidate evidence is retained.
- Deviations/negative evidence: no scope deviations. The initial affected-domain run passed 40/41: a stale exact application-version assertion still expected 3.6.6. It was aligned to approved 3.7.0 without weakening immutability/schema checks; the subsequent complete run passed 225/225. The first fresh-browser Preview attempt reached Vercel sign-in; it established no application result. Signed-in browser verification then succeeded. The browser download wait and tab screenshot APIs timed out; no verified backup or restore was claimed. Native Chrome screenshot inspection supplied visual evidence, alongside local screenshots. Physical iPhone Safari remains untested. No personal backup, personal-data testing, migration, Production delivery, acceptance or merge is claimed.
- Claimed state/handoff: Available automated, responsive Preview and console checks passed. Required physical AC-9 verification remains outstanding and needs actual device/iOS/Safari/build/revision/results. State: **implementation ready for device testing**, with overall issue completion blocked pending AC-9 and acceptance. Keep #20 open and the PR unmerged.

## Physical iPhone handoff — pending

Use the issue #20 Preview above with disposable data. Record the physical device, iOS version, Safari version, build and code revision. Check collapsed summaries, independent explicit/legacy cards, full-header tap/repeated collapse, Expand all/Collapse all, source-filter state and the existing ordered detail/notes/actions. Check page width, internal table swipe, keyboard/form behavior and existing edit/delete/correction flows on disposable records. Record PASS/FAIL and any regressions against AC-9; Chromium evidence above does not resolve this criterion. Acceptance and explicit merge approval remain separate gates.
