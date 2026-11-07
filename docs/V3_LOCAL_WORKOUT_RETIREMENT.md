# Local workout authority retirement — issue #86

## Accepted scope and result

Audit baseline: accepted main `70586d6649eabd97600d5d8082c2a4af90de8cb0`, application `3.16.2-20261107T025231Z`, schema 8. The owner accepted and closed [#85](https://github.com/dnk1000/GymBro/issues/85#issuecomment-6701487937), then selected audit plus focused regression coverage for [#86](https://github.com/dnk1000/GymBro/issues/86#issuecomment-6701528603). No runtime removal is necessary for normal Production operation: #85 already retired its local workout authority. Non-Production V2 development/regression paths are retained by that scoped decision; this is not a claim that all origins or source files are cloud-only.

Change Level 2 is retained for #86. This PR changes only test coverage and this audit/current architecture record. Under VERSION_POLICY, tests/documentation alone do not bump the application or BUILD. The conditional 3.16.3 PATCH approval is unused because no deployable runtime change is needed.

## Path inventory

| Path | Normal Production behavior | Disposition |
| --- | --- | --- |
| Startup: `app.js`, `cloud-authority.js` | The pinned normal origin sets `productionCloud` and `cloudMode` before the database expression; `emptyData()` is transient presentation state. `load()` is not called. | Retired by #85; bare-origin browser coverage retained/extended. |
| Workout actions: `app.js` | Creates a prepare-only action object; mutation calls require a ready cloud controller and use `controller.execute`. No local persist adapter is selected. | Retired by #85; save and failed-save tests verify zero local reads/writes/removals. |
| History: `cloud-ui.js` | Published cloud revisions supply the presentation database; failed loads do not adopt the browser copy or qualify an empty cloud account. | Existing behavior preserved and directly checked. |
| `storage.js` load/persist/save/recovery and resume listeners | Normal startup does not call load/persist/save. Cloud-mode guards disable local recovery, storage-event and resume handling. | Inactive on normal Production; retained for existing non-Production regression/development workflows per owner selection. |
| Local backup restore/merge/reset/clear handlers in `app.js` | Cloud-mode guards refuse these local actions; old Data controls are hidden by `cloud-ui.js`. | No obsolete active normal path found. No deletion/cleanup action added or enabled. |
| JSON import | New-account reviewed JSON and populated-account cloud lifecycle controls remain; reviewed ChatGPT Inbox JSON commits through the cloud controller. | Supported; no format or implementation changes. Reuse #85 backup-import evidence; focused Inbox review/commit checked. |
| Inactive local recovery material | Normal operation never reads, writes, removes or clears the workout key; local cleanup remains disabled. | Existing bytes remain untouched, including unreadable and future-schema bytes. |

The browser tests instrument getItem/setItem/removeItem/clear for the legacy workout key. Fixtures seed disposable local bytes once, outside the observation counters, and use an original getter only for independent byte comparison. Assertions cover both before and after reload; fixture seeding cannot conceal a runtime write. Cloud responses are controlled in-process transport fixtures, never live Production data.

## Acceptance and verification

- AC-1 → Bare normal-origin startup, save, History, reviewed Inbox JSON, reload, failed save and failed load with no local key; explicit error and retained failed-save draft → PASS in focused browser tests. Existing #85 reviewed backup import evidence reused.
- AC-2 → Valid, corrupt and future-schema inactive copies remain byte-for-byte unchanged with zero reads/writes/removals through cloud operations and save failure; retained bytes also survive failed startup → PASS in focused browser tests. Signed durability/isolation evidence is reused from #85.
- AC-3 → Inventory above establishes #85 already retired every normal-origin local authority path; owner approved retaining non-Production development/regression paths. No runtime, schema, cloud data or JSON format changes → PASS by source audit and scoped diff.

Focused command: `node --test --test-name-pattern='#86|normal Production route fails closed' tests/cutover-browser.test.cjs`, with CHROMIUM_PATH pointing to installed Chrome. Nine selected cases cover 390 px operation and 320 px failed-load paths. Final local result: **9/9 PASS**, zero unexpected page exceptions; test-file syntax and working-tree diff checks PASS. No migration, database, security or historical parity campaigns are repeated.

Existing evidence: [#85 Production signed save/reload/reauthentication and PostgreSQL persistence](https://github.com/dnk1000/GymBro/issues/85#issuecomment-6701252538), [owner-reported Chrome offline error/draft/local-copy/online-recovery PASS](https://github.com/dnk1000/GymBro/issues/85#issuecomment-6701338422), [final acceptance mapping](https://github.com/dnk1000/GymBro/issues/85#issuecomment-6701418640), and [PR #91 focused copy/Preview evidence](https://github.com/dnk1000/GymBro/pull/91).

## Limits and handoff

Initial new-test runs failed due to the test waiting for a modal dismissal after awaiting the initiating click, then a dialog-event race. The fixture now awaits acceptance and assertions explicitly; no runtime behavior or valid product assertion was weakened. The final corrected run passed all nine selected cases.

No live browser outage test, signed database test or physical iPhone/Safari test is claimed by this audit. Existing #85 evidence is retained. There is no new user-visible runtime change requiring new device or runtime Preview acceptance. Production workout data, receipts, configuration, deployment and local backups are untouched. #86 remains open pending human review/acceptance; merge and deployment require separate approval.
