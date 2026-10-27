# GymBro 3.0.0 — Supabase workout storage

This release uses the existing dnk1000/GymBro repository, a feature branch from current GitHub main, the existing Vercel project, and the user's GymBro Supabase project. It creates no new application project or repository. The old PR #9 integration implementation stays closed and unmerged; none was cherry-picked. No ChatGPT/provider integration, trainer authorization, MCP, AI, voice, reordering or live adaptation is included.

## Storage and compatibility

The vanilla frontend, seven views and existing DOM-free workout engine remain. Data is still the complete validated schema-7 JSON state: sessions, IDs, original plan snapshots, ordered set relationships, substitutions, explicit incomplete values, effort/pain/notes, program/library/preferences, import metadata and guided revision/request tombstones. The database storage envelope adds a separate account revision; it does not increment workout schema.

The shared action transaction validates a candidate, persists it, then commits the displayed state and returns success. It accepts the existing synchronous local adapter or awaited database adapter. A whole-mutation guard covers guided replay checks too; selectors remain synchronous and detached. UI handlers await saves and preserve input on failure. Async saves block duplicate submissions and editing the active form while the write is pending.

With valid Supabase configuration, workout writes go to Supabase only. Supabase Auth identifies the user; the browser SDK sends that user's verified access token to PostgREST. No custom workout API/server, admin database login, runtime DATABASE_URL or service-role key is used. Two small Vercel functions return public configuration and the installed lockfile-pinned browser SDK. No external CDN is required.

For compatibility while provisioning and for the original V2 regression suite, an unconfigured/static development deployment explicitly reports Legacy local mode. A partially configured or unreachable cloud setup reports read-only/unavailable, not local fallback. A tab that already displayed cloud data does not change to a local dataset merely because configuration later becomes unavailable. Connected failures never persist a workout into localStorage.

The original `daveGymTrackerV1` bytes remain untouched by cloud imports, saves, restore, merge and reset. Supabase Auth and a non-authoritative display cache live in tab sessionStorage, so signout/reload retains the displayed cloud dataset read-only within that tab. This is a cache, not a second workout database or offline queue. New tabs load their own authenticated database session; there is no background/offline synchronization.

## Existing-project setup

The user confirmed project URL `https://loowxditqikcwyeftfgx.supabase.co`. Use that project's own publishable key; do not reuse keys/URLs from the abandoned project. All values go into the existing Vercel project's **Preview** environment for this feature branch first. Do not change Production settings or merge until explicitly approved.

1. In that Supabase project, open SQL Editor and run [001_workout_storage.sql](supabase/001_workout_storage.sql). It is repeatable and imports no personal records. It creates `public.gymbro_workout_state`, a private receipt table and the authenticated `gymbro_save` function, with RLS/grants.
2. In Authentication, enable email/password sign-in and configure the project's Site URL/allowed redirect URLs for the exact Vercel preview origin. The signup flow requests return to that origin. If email confirmation is enabled, confirm each synthetic user's email before sign-in. Use test accounts for preview acceptance.
3. In the **existing Vercel project's** environment settings, add `SUPABASE_URL` (the base HTTPS URL without `/rest/v1/`) and `SUPABASE_PUBLISHABLE_KEY` (starts `sb_publishable_`) for Preview. No password, secret/service-role key, project-reference variable, staging marker or DATABASE_URL belongs in the browser/runtime configuration. A publishable key is intentionally public; never substitute an administrative key.
4. Vercel builds the existing feature branch as a normal preview. `vercel.json` only packages the SDK asset function; it adds no staging/production deployment guard or environment-specific project creation. npm ci installs pinned dependencies. Keep the existing framework/static-root deployment behavior.
5. Open the exact feature preview and verify the full version, database status, sign-in and an explicit migration/empty start before testing writes. A Ready preview without the environment variables is still legacy local mode and does not prove cloud acceptance.

If the migration cannot be applied or preview variables/network access are unavailable, report live validation as blocked. Do not treat local fixtures or mocked HTTP responses as proof of a working hosted database. Do not create a parallel ChatGPT/Codex application environment or store credentials in the repository/chat/logs.

## Database authority, isolation and concurrency

`public.gymbro_workout_state` holds `user_id`, state, revision and updated_at. RLS/FORCE RLS restrict SELECT to `auth.uid()`. Anonymous callers have no table access; authenticated users cannot directly insert/update/delete. Only `gymbro_save` can write: it is a narrowly granted SECURITY DEFINER function with a fixed search_path, derives identity exclusively from auth.uid(), and never accepts a user ID argument. The Auth token is verified by Supabase/PostgREST, not by custom application cryptography.

The function serializes each user with a transaction advisory lock, checks the expected account revision, and atomically writes state plus a receipt keyed by user/request UUID. This covers both first imports and updates. The receipt signature is SHA-256 over PostgreSQL's canonical JSONB representation and original expected revision. Reusing an ID with changed input gives REQUEST_CONFLICT; stale revisions give REVISION_CONFLICT. Same-ID retries report the original committed revision and the current revision. A replay after a later write requires reading current data and never replaces that newer data with an older candidate.

The browser validates the full established workout model; the RPC additionally checks schema and top-level structure. It is a user-owned storage boundary, not a new server-side workout engine or API for untrusted external trainers. An authenticated owner can deliberately submit malformed domain details via direct HTTP; subsequent client loading fails conservatively rather than rewriting them. This limitation is explicit; RLS still prevents access to other users. Future external-client/domain enforcement is not included in this storage milestone.

An uncertain network result retains exactly one attempted save and UUID in tab sessionStorage before sending. New writes cannot silently replace that unresolved candidate. Resolve save explicitly retries it and reloads current database data; there is no automatic queue or background replay. If it cannot be resolved while signed out/offline, displayed data and original local bytes remain independently downloadable. Do not clear browser storage to force a retry with a new logical set.

Receipts are currently retained without automatic pruning to preserve replay safety. Whole-state JSONB copying is the intentional first implementation; large histories/quota/performance and a reviewed retention policy remain limitations. Cloud availability is required for new cloud writes.

## Migration and account operation behavior

Sign-in alone never uploads local data. An account with no database row offers Preview V2 local import or Preview empty account. Empty starts retain default templates/library but have no original personal history, bodyweights, imports, sessions or preferences. Import preview shows counts, schema and active-workout presence; the exact candidate and user are captured. Confirmation is required. Revision-zero initialization cannot replace a nonempty account.

After the database commits, the client reads back the row, validates it and compares canonical state integrity with the reviewed candidate before replacing the displayed dataset. Failure preserves the original visible/local data and does not claim migration success. If the server committed but read-back failed, Reload database explicitly inspects that account's state; a different initial import is refused. Original local bytes are never deleted or mutated by the migration.

Normal Data exports produce a complete schema-7 JSON backup of the displayed dataset with the canonical exporting appVersion. Restore, history merge, clear/reset and explicit original-seed restore follow the existing validations/confirmations but await authenticated database persistence when configured. The personal original seed is never silently loaded into a new cloud account. Cloud reset/restore does not reset the account revision or remove receipt history.

Signout ends the account session and blocks new writes; the current dataset stays visible read-only, including tab reload via the display cache. Signing into an account and loading its database explicitly selects that account's record. No silent merge between accounts or local history occurs. Unsaved form fields remain transient; do not claim they survive reload.

## Validation

Use .nvmrc, `npm ci`, `npm run check:syntax`, `npm run check:release`, `npm run check:diff`, and `npm test`. The ordinary suite includes all existing V2 tests, async persistence tests and browser tests that load the **actual pinned Supabase SDK**. Browser fixtures simulate Auth/PostgREST HTTP responses, not the SDK; this validates bootstrap/transport/UI but not live Supabase configuration or authentication. Managed Chromium may skip direct-file navigation under administrator policy; HTTP checks still run.

`npm run test:database` separately runs `tests/supabase-postgres.cjs` against an isolated loopback PostgreSQL admin URL supplied through GYMBRO_TEST_DATABASE_URL. The suite creates and drops its own uniquely named disposable database. It supplies a test auth.uid()/auth.users equivalent, uses actual anon/authenticated PostgreSQL roles, and tests the real migration twice, RLS, direct-write denial, user isolation, revisions, simultaneous clients, receipts and schema-7 round trips. It refuses non-loopback hosts. Never run this fixture suite against Supabase or production.

GitHub CI retains the existing V2 regression job and adds a separate disposable PostgreSQL isolation job. Real acceptance must additionally exercise the deployed Vercel preview with the actual Supabase project and two synthetic Auth users: signup/confirmation/sign-in/signout/session refresh, import/empty initialization, normal manual/guided logging/reload, conflicting devices, unknown-response retry, backup/restore/merge, user isolation and denied anonymous access. Record actual results and failures. Physical iPhone Safari, production backup/data acceptance and outstanding V2 final acceptance evidence remain separate gates. No merge or production deployment follows automatically from a passing preview.
