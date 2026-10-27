# GymBro V3 storage handoff — 2026-10-27

## User's current request

Build a first V3.0 replacing local workout storage with Supabase, in the existing GymBro repository and existing Vercel project, on a branch from main. Do not start a new project. The user then requested a handoff to a new chat; implementation paused with uncommitted work preserved.

## Workspace and safety

- Repository: `/workspace/GymBro`, GitHub `dnk1000/GymBro`.
- Current branch: `v3/supabase-storage`.
- HEAD/base: `d2e6223f5d6020cb63c249ade4c02acaa7fe7cbd` (accepted main V2 baseline).
- All new work is UNCOMMITTED. Do not reset, clean, switch branches over it, or recreate files blindly. Inspect status/diff and untracked files first.
- No new PR, push, merge or deployment has been made for this branch yet. Do not merge or modify production without approval.
- Old PR #9 / `v3/integration-architecture` is abandoned and retained for history. Do not revive/cherry-pick it. Cleanup PR #10 remains open and unmerged; this branch intentionally starts from main, not that cleanup branch.
- User's intended new Supabase project URL: `https://loowxditqikcwyeftfgx.supabase.co` (GymBro). Do not reuse abandoned staging project credentials/configuration.
- No keys/passwords should be requested in chat, logged or committed. Only public config belongs in browser. No runtime DATABASE_URL/service-role key is needed by this implementation.
- Supabase/Vercel management credentials and runtime config were absent in this execution environment when checked. Direct hosted app/Supabase requests can be blocked by workspace proxy. GitHub CLI works.
- Preserve outstanding V2 physical-iPhone, verified production backup/data and final acceptance evidence; not completed by these tests.

## Architecture implemented

This is a narrow storage milestone, not the old provider-integration architecture:

- Same vanilla frontend, seven views, existing V2 actions/selectors/validation, schema 7.
- Supabase Auth browser SDK + direct PostgREST, per-user complete JSONB state, independent account revision, RLS and authenticated save RPC.
- No custom workout API, trainer grants, OAuth implementation, MCP, AI, voice, provider integration, reordering, live adaptation or offline queue.
- Configured cloud writes await durable saves and never fall back to localStorage.
- Unconfigured static/development mode explicitly retains legacy local behavior for V2 compatibility and usability while provisioning.
- Explicit preview/confirmation/import or empty account; commit/read-back/canonical integrity check before replacing displayed data. Original V2 local bytes never auto-uploaded, deleted or mutated by cloud operations.
- Signout retains displayed dataset read-only, including tab reload via non-authoritative sessionStorage display cache.
- sessionStorage also holds SDK auth session and one uncertain save candidate/request UUID for explicit retry, not a background queue.
- Full backup restore/merge/reset remain first-party account operations with existing validation and confirmations, async in cloud mode.

## Code and docs present (read before editing)

- `supabase/001_workout_storage.sql`: repeatable SQL Editor migration, user state + private receipts, FORCE RLS/read-own policy, no direct authenticated writes, SECURITY DEFINER fixed-search-path RPC bound to auth.uid(), per-user advisory lock, CAS/replay receipts, structural schema-7 checks.
- `supabase-storage.js`: real SDK transport captures authenticated token/user binding; async store validates state; revision/idempotency/pending outcome handling; initialization read-back comparison; signout; canonical JSON comparison.
- `workout-actions.js`: compatibility-preserving sync/Promise persistence boundary, candidate→validate→persist→commit; whole-action guard including guided replay; detached sync selectors.
- `storage.js`: preserves legacy load/save, adds cloud routing/read-only failures/tab display cache.
- `database-ui.js`: compact account controls, signup/signin/signout, initial import/empty preview/commit, reload, resolve uncertain save, original local download. Real installed SDK, PKCE/email-password via Supabase.
- `app.js`, `guided-ui.js`: await mutation persistence, preserve input on failure, UI mutation guard; backup/import/reset await cloud commits.
- `index.html`, `styles.css`: minimal account panel, original seven views retained.
- `api/config.js`: returns only public URL/publishable key; disabled if both absent; partial/invalid config fails read-only. Requires key starts sb_publishable_.
- `api/supabase-sdk.js`, `vercel.json`: serve pinned installed browser SDK, no external CDN; existing Vercel project.
- `scripts/serve.cjs`, npm dev command: real local config/SDK endpoints with static app.
- `package.json`/lock: pinned @supabase/supabase-js 2.118.0, dev pg 8.23.1, retained playwright-core 1.58.2.
- `.github/workflows/ci.yml`: existing V2 regression job retained; adds isolated PostgreSQL service/test job.
- `SUPABASE_STORAGE.md`, `V3_RELEASE.md`, README, AGENTS, CHANGELOG, RELEASE_HISTORY, V2_ARCHITECTURE updated. Old release history retained.
- Version `3.0.0-20261027T022348Z` in canonical app-version.js; schema stays 7. Release checks/tests updated to validate this candidate.

Security limitation explicitly documented: full domain validation is existing browser engine; SQL validates envelope/structure. An authenticated owner can intentionally corrupt their own details via direct RPC; other users remain isolated. This is user-owned storage, not an API for untrusted external trainers. Receipts are unpruned; whole-state JSONB scale/quotas and sessionStorage availability remain limitations.

## Latest review fixes (not yet full-suite revalidated)

- Fixed duplicate account callbacks to share current account-loading promise.
- Store has read epochs/loading guard so stale reads cannot reopen signed-out state or enable stale writes.
- Rejected second database UI action no longer releases another action's busy flag.
- Backup restore/reset now refreshes display cache only after save success.
- FileReader import callback guards account/other UI saves through completion.

## Exact validation state

- Earlier `npm ci`, syntax/release checks passed; rerun after final changes.
- Before the last concurrency/cache fixes and additional tests: full `npm test` = 155 total, 154 passed, 0 failed, 1 existing managed-Chromium direct-file skip. Log `/tmp/gymbro-supabase-final-full.log`.
- Real isolated local PostgreSQL suite: 9/9 passed. Uses disposable DB, real anon/authenticated roles, stub auth.uid/users (NOT real Supabase Auth), RLS, wrong-user isolation/direct-write denial, CAS concurrency, replay and schema-7 historical roundtrip. Must rerun final if SQL changes.
- Latest focused run after review fixes: `node --test tests/supabase-storage.test.cjs tests/database-browser.test.cjs` = 14 tests, 13 passed, 1 failed. Log `/tmp/gymbro-database-focused.log`.
- The ONE latest failure is a newly added reset browser test using nonexistent button label `Clear all data`; existing UI label is `Erase all local data`. Test timed out at tests/database-browser.test.cjs:373. Next chat should correct the test and consider making the visible reset label accurately describe database mode (confirmation already does). Do not report this latest run as passing.
- New empty-account/guided browser test passed: start, set log, reload, complete, immutable snapshot/set identity, history visible, original local untouched.
- New superseded-read store test passed.
- Browser tests use ACTUAL installed Supabase SDK with simulated Auth/PostgREST HTTP responses, not real hosted Supabase. No live Auth/session verification or deployed cloud end-to-end acceptance performed.

## Pending user setup

User supplied URL above. Asked user (no reply yet) to run `supabase/001_workout_storage.sql` in the GymBro SQL Editor and reply “migration applied”. Also asked them to enter SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY securely in existing Vercel project Preview settings. Do not assume either is complete.

Auth email/password and exact preview-origin Site URL/allowed redirect configuration also need live verification. Signup uses emailRedirectTo location.origin; email confirmation may require a real test mailbox. No personal data should be imported without explicit review/commit.

## Recommended continuation

1. Inspect branch/status/diff/untracked files, preserve work. Read GymBro_PRD.md, AGENTS.md, accepted V2 contracts and new SUPABASE_STORAGE.md/V3_RELEASE.md.
2. Fix the one known new browser test selector, review cloud label clarity, finish critical review of account/storage/restore paths. Do not restart implementation.
3. Run npm ci, syntax/release/whitespace checks, full regression suite, separate database suite. Exercise actual npm run dev endpoints/browser bootstrap too (not only fixture route).
4. Local DB service is already running in Docker container gymbro-v3-postgres at 127.0.0.1:55432. Only synthetic local data; preserve container. Run `GYMBRO_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/postgres npm run test:database`. Suite refuses non-loopback and creates/drops its own random DB. Do NOT point it at Supabase/production.
5. Review diff and secret absence; commit/push v3/supabase-storage; open review PR against main, do not merge. Retain existing repository/project.
6. Check actual GitHub CI and existing Vercel branch preview status/URL, do not invent a URL or equate Ready with cloud configured. Where possible exercise the deployed preview with actual new Supabase project/test accounts after user setup.
7. Report implemented/local-tested/live-tested/deployed categories separately, exact failures/skips/blocked setup, PR and preview status, schema/version. No production modifications or acceptance claims.

Handoff requested before commit/PR/live validation completion. Nothing has been discarded.
