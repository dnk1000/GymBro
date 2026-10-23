# GymBro V1.6 physical-phone smoke test

Status: **Pending — not executed on a physical phone.** The cloud workspace has no attached phone or remote-device testing connector. Automated mobile viewport checks are not a substitute for this test. Do not freeze the stabilized baseline or begin v2 until the physical test is recorded and any failures are resolved.

Use a separate test copy/origin, not a browser profile containing real workout data. Open the complete app directory through a web server reachable from the phone. Keep its address unchanged throughout the test. No account or API key is needed.

Record:

- Device model:
- OS version:
- Browser and version:
- Code revision/date tested:
- Tester/date:
- Outcome and issues:

Checklist (leave unchecked until verified on the device):

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
