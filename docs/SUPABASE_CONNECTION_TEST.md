# Supabase connection checkpoint

The optional diagnostic saves one non-personal string and reads it freshly after reload. Workout schema 7, localStorage, history and normal workout saves remain unchanged. No mandatory account is added.

## Current setup — issue #38

Follow [V3_INFRASTRUCTURE.md](V3_INFRASTRUCTURE.md) for the approved environment inventory, exact Vercel variable scopes, pinned CLI migration procedure and failure/recovery steps. Preview now uses **GymBro-Staging (`obebuvpsqapgevwivwho`)**. The old checkpoint project (`loowxditqikcwyeftfgx`) is reserved for future Production; its existing data is retained.

Apply the source-controlled `20261027213000_connection_probe.sql` migration through the documented Preview guard; do not run the deleted standalone SQL path or improvise Production SQL. The migration enables owner-only RLS, grants authenticated SELECT/INSERT/UPDATE only, and no client DELETE. Staging Auth must permit anonymous test sign-ins and Data API must expose public. Preserve CAPTCHA/security protections; any change to existing Auth/access settings requires the applicable approval. This diagnostic identity is not the recoverable account feature from #27.

The Preview variables are `GYMBRO_SUPABASE_PROBE=true`, `GYMBRO_CLOUD_ENV=preview`, `SUPABASE_PROJECT_REF=obebuvpsqapgevwivwho`, the matching staging URL and its existing publishable key. Use Preview/branch scopes, redeploy the Preview, and check Data displays the correct project. Production always disables the endpoint. Local tests use ignored `.env.local` based on [.env.example](../.env.example); no credentials belong in Git/chat.

## Save, reload, fresh Read

1. Open the exact protected PR Preview and select Data. Confirm staging project `obebuvpsqapgevwivwho`. Configured proves syntax/boundary only, not a working live connection.
2. Save a unique non-personal test string. Wait for Saved in Supabase; input is not echoed as a retrieved result.
3. Reload, return to Data and choose Read test value. The fresh remote result must equal the saved string. Each Read makes a request; no local value fallback.
4. Inspect the matching `owner_id` row in staging Table Editor. Update/Save/Read retains one row per identity. A different disposable browser context has its own identity and row. Never upload personal workout data.
5. Confirm normal logging/reload/History remains local under `daveGymTrackerV1`; normal saves must make no Supabase write. Diagnostic Auth uses only `gymbro-probe-auth-<project-ref>`.
6. Inspect staging grants/RLS and migration ledger using the documented `db:preview -- verify` command. A live test is distinct from mocked browser tests and does not establish account-recovery acceptance.

Changing origin/profile creates a different identity, not lost workout history. There is no automatic cleanup; deleting test rows/users is a separately authorized operation. Failed auth/table/network access retains input and never switches workout persistence. A mismatched environment/ref/URL returns Not configured without a key.

The SDK remains vendored unchanged with its [license/provenance](../vendor/README.md), loaded only after an enabled action. Static/local use still works independently. Local/mock tests and real integration evidence are distinguished in [V3_RELEASE.md](V3_RELEASE.md).

## Historical checkpoint evidence

Live checkpoint verified on 2026-10-27 in [PR #12's Preview](https://gymbro-git-v3-supabase-connection-check-dnk-9999.vercel.app/), build `2.7.2-20261027T152907Z`, project `loowxditqikcwyeftfgx`. After the user enabled anonymous sign-ins and ran the supplied SQL, a real Save succeeded, the page was fully reloaded, and a fresh Read returned the matching value with the same identity. Supabase Table Editor showed the matching single row; RLS was enabled, the three expected authenticated policies were present, and the SELECT owner predicate was inspected. This verifies the basic live connection checkpoint, not a workout migration or a comprehensive cross-user security audit. Production and workout storage remain unchanged. CI/mock tests alone are not substitutes for repeating this live check when configuration changes.

