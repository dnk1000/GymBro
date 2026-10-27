# GymBro physical-phone smoke tests

October 27, 2026 M0 disposition: the user explicitly deferred the still-missing physical-iPhone and personal-production-backup evidence through M1 Preview-only account work, requiring it before M2 migration testing. No test result below is changed to Pass. The original cloud/device and build metadata is historical; record the actual device and current tested build/commit when completing the checklist. See [M0 acceptance and evidence owners](V3_M0_SCOPE_AND_ACCEPTANCE.md). The historical restriction on proceeding is superseded only by this narrow deferral; it does not establish final V2 acceptance.

Status: **Milestones 1–5 were accepted/merged by the user; physical device/OS/browser details were not supplied.** Historical checklists below remain as records, not evidence of an agent-run phone test. **Milestone 6 physical iPhone Safari acceptance is pending.** The cloud workspace has no attached iPhone or remote-device testing connector. Automated Chromium and synthetic lifecycle events are not physical acceptance. Use the Milestone 6 checklist below for the current preview.

Use a separate test copy/origin, not a browser profile containing real workout data. Open the complete app directory through a web server reachable from the phone. Keep its address unchanged throughout the test. No account or API key is needed.

**Before testing a milestone that touches persistence, export a complete JSON database backup from the production GymBro address and verify that the file was saved.** A Vercel Preview Deployment is a separate origin with its own local storage. Its initial/seeded records are not your production history. Use test records there, or deliberately import a copy of the backup; retain the original file. Do not restore test data over production.

Record:

- Device model:
- OS version:
- Browser and version:
- Code revision/date tested:
- Tester/date:
- Outcome and issues:

Checklist (leave unchecked until verified on the device):

- [ ] Export the production database as JSON, verify the saved file, and record the preview address separately from the production address.
- [ ] Open the app; confirm V1.6, the logo, dashboard and charts load.
- [ ] Visit all seven tabs in portrait and landscape. Confirm the Exercises page fits the screen, with wide tables scrolling within their cards rather than widening the page.
- [ ] Open the on-screen keyboard; confirm exercise, load, reps and notes remain editable and the save control is reachable.
- [ ] Select 30- and 60-minute plans, use Log, and save a manual set with notes. Confirm it appears in today's workout and History.
- [ ] Edit the set, reload, then close and reopen the browser tab. Verify the saved values and program selection persist at the same address.
- [ ] Add a bodyweight and confirm it remains after reload.
- [ ] Use Inbox's Example file (or paste the documented example), review, and commit. Verify history and session notes. Review the same import again and confirm duplicate protection.
- [ ] Import a test set with `unit: "assist lb"`, `weight: 75`, `reps: 8`. Confirm its exercise detail shows Latest as `75 assist lb × 8` while Best comparable set-work remains empty if it has no eligible external-load sets.
- [ ] Repeat with `unit: "bodyweight"`, `weight: 0`, `reps: 8`; verify Latest displays the record.
- [ ] Export JSON and CSV; confirm the phone can save/access both downloads. Inspect the JSON for the test sets and notes.
- [ ] On this test copy only, restore the exported JSON and verify history, program and preferences. Confirm reload preserves the restoration.
- [ ] Record any visible errors, blocked controls, lost values, layout issues or download failures. Record browser console errors if remote inspection is available.

Pass requires all checks to complete without data loss, unusable controls, page overflow or unexplained errors. Test iPhone Safari and Android Chrome if both are supported; record untested platforms explicitly.

## Milestone 3 — pending physical-device acceptance

Main `14b12a8` contains accepted Milestone 2; production served 2.2.5 before branching. Milestone 3 is not physically tested by automated Chromium checks. Follow [the History and backup checklist](HISTORY_AND_BACKUPS.md), recording actual device/OS/browser, commit, results and failures. Export and verify production JSON before testing; keep synthetic data on the preview origin only.

## Milestone 4 — pending physical-device acceptance

Start from accepted main `fd616fa` (Milestone 3). Test the 2.4.0 preview with the checklist in [GUIDED_WORKOUTS.md](GUIDED_WORKOUTS.md). Production JSON backup must be exported and verified first. Chromium viewport testing is not physical Safari acceptance. Do not mark completed without device/browser/build and actual results.

## Milestone 5 — pending physical-device acceptance

Milestone 4 was merged at `817fc17`; production was verified serving 2.4.0 before Milestone 5 began. No new workout interaction screens are introduced in Milestone 5. Follow [TRAINER_EVIDENCE.md](TRAINER_EVIDENCE.md) to check the 2.5.0 preview and retained guided/manual flows. Export/verify production JSON first. Record actual device/browser/build and results rather than inferring physical acceptance from Chromium tests.


## Milestone 6 — physical iPhone acceptance pending

Start point: accepted main `05728af`, PR #6. Work only on `v2/milestone-6-iphone-hardening`; no merge without explicit approval. See [IPHONE_HARDENING.md](IPHONE_HARDENING.md) for verified defects, corrections, automated coverage and remaining limitations.

**Export production complete JSON and verify the saved file before persistence testing.** Keep the original backup. Open the milestone preview (a separate storage origin), using disposable test records or a deliberate backup copy. Do not overwrite production with test data.

| Test metadata | Actual value |
| --- | --- |
| Device model | Pending — no physical device available in cloud |
| iOS version | Pending |
| Browser | iPhone Safari required; actual version pending |
| GymBro version | `2.6.0-20261023T220541Z` (verify full footer) |
| Commit SHA | Pending tester confirmation — record the preview's exact PR revision |
| Test date / tester | Pending |
| Preview URL / origin | Record the deployed PR preview; keep distinct from production |
| Production backup saved / verified | Pending user confirmation; agent cannot access the user's browser history |

Record **Pass / Fail / Not tested**, observations, failures and retest results individually. All rows below are currently **Not tested on physical iPhone**.

| # | Physical Safari check | Result / observations |
| --- | --- | --- |
| 1 | Start a 30-minute test workout; verify saved template, date and established short slots. | Not tested |
| 2 | Log multiple sets, including identical intentional sets; verify count, order, effort/pain/notes. | Not tested |
| 3 | Rapidly tap Log, Next, Previous, Done, Skip, Substitute and Finish; no accidental duplicate commits or skipped-over positions. | Not tested |
| 4 | Lock/unlock after a committed set and position change; verify same session and saved state. | Not tested |
| 5 | Switch to another application, return and continue the same workout. | Not tested |
| 6 | Background Safari, return later, confirm saved progress. | Not tested |
| 7 | Reload immediately after a successful set; verify it remains exactly once. Unsaved inputs may be lost. | Not tested |
| 8 | Close/reopen Safari; verify committed data persists at the same origin. | Not tested |
| 9 | Reopen GymBro/existing tab; verify session, template/mode, position, statuses and substitutions; no second active session. | Not tested |
| 10 | Open tab B, change progress in tab A, then try an edit in B. Verify warning/rejection, unchanged newer data, and deliberate reload recovery. | Not tested |
| 11 | Substitute after logging; preserve original plan and earlier actual exercises. Log subsequent sets under the substitute. | Not tested |
| 12 | Use Done/Skip/Previous/Next; navigation alone must not change status. Cancel an unsaved-input discard once. | Not tested |
| 13 | Focus load/reps/effort/notes fields; log with numeric/text keyboards open, scroll, reach controls and dismiss keyboard. Verify no unwanted focus zoom. | Not tested |
| 14 | Rotate portrait/landscape with keyboard and browser chrome changes; controls reachable, no page overflow or state changes. Tables may scroll within cards. | Not tested |
| 15 | Finish with pending slots: cancel confirmation once, then confirm; preserve pending statuses, sets and single completedAt; active pointer clears. | Not tested |
| 16 | Verify History matches actual exercises, order, statuses, notes, pain and manual/guided sets. Existing corrections still work. | Not tested |
| 17 | Preview only: Export → restore → export complete JSON. Verify schema 7, sessions/guidance/request history, active pointer (test before finishing too), sets, bodyweights, templates, library, preferences and metadata. Verify Files download/access. | Not tested |
| 18 | Manual log with no active workout and with an active workout; verify association, History and reload. Guided mode must remain optional. | Not tested |
| 19 | Browser Back/Forward/navigate away/return must not complete or abandon the workout. Confirm unsaved-input policy remains as established. | Not tested |

### Failures, fixes and remaining limitations

- Physical-device failures discovered: **Unknown — testing pending.** Do not interpret this as no failures.
- Verified automated findings/fixes: missed storage-event warning on page restoration/foreground now detected read-only; small mobile entry text corrected to 16px and primary logging targets to 44px. Record whether those fixes work on the actual device.
- Additional physical findings/fixes/retest commit: pending. Fix any reported defects on the same milestone branch/PR.
- Limitations: no cloud sync or offline shell; browser storage can be evicted or quota-limited; simultaneous localStorage writes lack atomic compare-and-swap; use one editing tab. Unsaved forms remain transient. Automated Chromium does not reproduce real phone suspension, OS termination, keyboard, safe-area or Safari chrome behavior.
- Acceptance: **Pending all required physical checks and documented results.** Do not merge or declare the hardening milestone accepted based only on automated tests.


Milestone 6 acceptance update: the user accepted PR #7 and explicitly authorized merge. No device model, iOS/browser version, test date or individual physical-test outcomes were supplied; the unfilled checklist above remains unfilled and is not evidence of agent-run device testing. Application release: `2.6.0-20261023T220541Z`, application revision `c87ca06`.


## Milestone 7 — release gate remains open

The user authorized CI/documentation/release-engineering preparation before the missing M6 physical results are recorded. This does not waive physical acceptance, authorize merge/final production acceptance or declare V2 complete. Reuse the required M6 device/iOS/browser/build/commit/date and individual test rows above; record actual outcomes and resolve defects. Retest the M7 Help wording/scrolling on physical Safari if it changes. Chromium is not acceptance. Production backup and final production smoke are separate gates in [PRODUCTION_DELIVERY.md](PRODUCTION_DELIVERY.md); no new physical results are claimed here.
