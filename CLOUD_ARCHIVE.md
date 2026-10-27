# Cloud development archive — 2026-10-27

This branch preserves the complete unfinished cloud V3 Supabase-storage experiment for migration/reference. The user has suspended implementation and PR delivery and authorized moving development to a Windows folder, starting again from the authoritative V2 baseline in the existing GymBro project. **This is an archive, not a release or a branch to merge into main.** No new features were implemented for this archive operation.

## Baseline and preservation

- Repository: dnk1000/GymBro.
- Original cloud checkout: /workspace/GymBro on v3/supabase-storage, with all implementation changes uncommitted/untracked before archiving.
- Base commit: d2e6223f5d6020cb63c249ade4c02acaa7fe7cbd.
- V2 baseline application: 2.7.0-20261025T002624Z; workout schema 7.
- Archived candidate application: 3.0.0-20261027T022348Z; workout schema 7. This candidate version is not production acceptance.
- Every original tracked and nonignored untracked file was retained byte-for-byte. The archive adds only this note and an exact copy of the external handoff.
- GYMBRO_V3_HANDOFF.md is copied unchanged from /workspace/GYMBRO_V3_HANDOFF.md. Its earlier instructions to continue implementation/open a PR are historical and are superseded by the user's pause/archive direction and this note.
- The original external handoff remains in place. node_modules/ stays local and ignored; dependencies are reproducible from the committed lockfile. No new personal workout data or credential configuration is included.

The older abandoned v3/integration-architecture branch/PR #9 was not merged or cherry-picked. No PR is created for this archive; main and production are not updated. Future Windows development should use the user-approved V2/main baseline and inspect this archive only when specifically requested, rather than merge it automatically.

## Later work already present at archive time

The resumed review corrected the cloud reset test's nonexistent button selector and made its label reflect account storage, retained read epochs through initialization cleanup, added actual development-server/config/SDK bootstrap tests, and added a migration test with existing V2 raw bytes and active-session/history metadata. The account callback/read guards and post-restore/reset display cache fixes are included. All existing implementation files and tests are archived, not recreated.

## Observed validation before the pause

- npm ci passed with npm_config_cache pointing to /workspace/.npm-cache. The environment's default cache location was unavailable; that was an execution-environment issue, not a lockfile change.
- npm run check:syntax passed: 32 JavaScript files.
- npm run check:release passed: candidate 3.0.0-20261027T022348Z, schema 7.
- npm run check:diff and git diff --check passed before archiving.
- Latest full npm test: 161 tests, 160 passed, 0 failed, 1 skipped. The skip is managed Chromium's administrator-blocked direct file navigation; HTTP workflows were exercised.
- Latest isolated PostgreSQL suite: 9 tests, 9 passed, 0 failed/skipped.
- Focused browser suite: 8 passed, including preservation of existing raw V2 bytes, active sessions and metadata.
- The original handoff's older failed selector result is superseded by these observed results. No tests were weakened or deleted.

The browser suite loads the actual pinned Supabase SDK but simulates Auth/PostgREST responses. PostgreSQL tests use real restricted SQL roles/RLS in a disposable loopback database, with test substitutes for auth.uid()/auth.users. These do **not** establish live Supabase Auth or deployed end-to-end acceptance. Actual development-server routes were also tested, including all seven views at 320/390/1280px without browser errors or horizontal page overflow.

No real Supabase migration, live account acceptance, Vercel configuration/deployment, production data migration, or physical-iPhone test was performed. V2 physical-device, verified production JSON backup/data, and final release acceptance evidence remain outstanding.

## Setup references for later review only

See SUPABASE_STORAGE.md for the archived architecture and setup assumptions. The user's public intended project URL is https://loowxditqikcwyeftfgx.supabase.co. Runtime SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, Supabase management access, and Vercel management access were absent in the cloud execution environment when checked. User-applied migration/Preview bindings were not confirmed. An attempted public Supabase health request failed at the workspace proxy with CONNECT 403.

The archive's storage approach needs only that project's public URL/publishable key and reviewed SQL/Auth configuration; it does not require a runtime DATABASE_URL or service-role key. Do not paste credentials into chat or repository files. The SQL migration and setup instructions are retained for reference, not authorization to apply them. Do not change Vercel/Supabase/production settings as part of migration to Windows.

The synthetic local PostgreSQL container gymbro-v3-postgres was left intact on loopback port 55432. It is execution tooling, not a deployed GymBro database and not a required artifact to copy to Windows. Dependencies, caches, browser profiles, Docker data, and transient logs are not included in Git. Test results above record what was actually observed; rerunning tests is a separate development instruction.
