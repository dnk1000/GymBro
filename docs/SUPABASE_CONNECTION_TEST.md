# Supabase connection checkpoint

This Preview-only diagnostic proves one short value can travel from GymBro -> Supabase -> a separate fresh read in GymBro. It is **not** a workout-storage migration. Schema 7, `daveGymTrackerV1`, history, program, imports and normal saves remain unchanged. No registration or mandatory GymBro account is added.

## 1. Prepare the intended Supabase test project

1. Open the intended GymBro test project in Supabase. The previously recorded project reference was `loowxditqikcwyeftfgx`; verify this is still the project you want. Do not use the abandoned integration project's credentials.
2. From the project's Connect/API settings, copy its `https://<project-ref>.supabase.co` Project URL and its **publishable key**, beginning `sb_publishable_`. They must come from the same project. Do not use a secret/service-role key or database password. Do not paste keys into chat, screenshots or Git.
3. In **Authentication -> Sign In / Providers**, enable **Anonymous Sign-Ins** for this intended test project. Dashboard wording may vary. This creates an anonymous test user on the first explicit Save/Read; opening GymBro alone creates no user. No email/phone provider or OAuth redirect is required for this test.
4. Open **SQL Editor** in that same project. Read and run [connection-probe.sql](../supabase/connection-probe.sql). It creates only `public.gymbro_connection_probe` with `owner_id` and `value`, enables RLS and grants authenticated users only SELECT/INSERT/UPDATE on their own row. It touches no workout tables/data. The script is repeatable for this dedicated table. The agent does not run it against a live project.
5. Ensure the project's **Data API** is enabled and the `public` schema/test table is exposed to it. The script supplies explicit table grants; do not disable RLS or grant anonymous public writes to make a test pass.

Anonymous Auth users have the `authenticated` database role; they are distinct from unauthenticated callers using only a publishable key. Supabase applies anonymous-signup rate limits. Keep the Preview's existing Vercel authentication protection; this diagnostic is not a public anonymous-signup product. If CAPTCHA is already required, preserve it; that project needs a supported CAPTCHA flow before this minimal diagnostic can authenticate. Do not turn off existing protections to get a green result. Review any other authenticated-role policies before enabling anonymous users in a shared project.

## 2. Configure the existing Vercel project

Use the existing **gymbro** project connected to `dnk1000/GymBro`. Do not create another project or change Production variables/settings.

In **Settings -> Environment Variables**, add the following for **Preview only**, preferably restricted to branch `v3/supabase-connection-check` while testing:

| Name | Value |
| --- | --- |
| `GYMBRO_SUPABASE_PROBE` | `true` |
| `SUPABASE_URL` | The intended project's `https://<project-ref>.supabase.co` URL |
| `SUPABASE_PUBLISHABLE_KEY` | Its `sb_publishable_...` publishable key |

Save these, then **redeploy the branch's Preview deployment**. Environment-variable changes apply to new deployments, not already-running ones. Vercel sets `VERCEL_ENV=preview`; do not create or override that variable. Do not set `GYMBRO_PROBE_LOCAL` in Vercel. Neither a Vercel Marketplace binding nor a `DATABASE_URL` is needed.

The Node function at `/api/supabase-probe-config` reads these deployment variables and returns only the approved public URL/key. Browser JavaScript does not attempt to read `process.env`. Production always receives `{ "enabled": false }`, even if test toggles were set accidentally. Configuration responses are not cached.

To verify the configuration without exposing keys, open the exact Preview -> **Data**. The card says **Configured** and displays **Vercel Preview** plus the project reference. Compare that reference with Supabase's project URL. Do not print, screenshot or share the API response's key. A successful read/write is the final proof that the URL/key pair and permissions actually work; Configured alone only validates their format.

## 3. Manual end-to-end test

1. Open the PR's exact Vercel **Preview URL** while signed in to Vercel if deployment protection asks. Do not use the usual production URL for this test.
2. Open **Data -> Supabase connection test**. Check the expected project reference. If it says Not configured, fix the Preview variables and redeploy.
3. Enter a unique non-personal value, for example `gymbro-check-20261027-a`, and click **Save test value**. Wait for **Saved in Supabase**. Input is not automatically read back or copied into the result.
4. Reload the page. Return to **Data**, then click **Read test value**. The **Retrieved from Supabase** result must exactly match your saved value. A fresh Supabase request is made on every Read; there is no local value fallback.
5. Copy the displayed **Test identity** UUID. In Supabase's **Table Editor -> public.gymbro_connection_probe**, find the row with that `owner_id` and confirm its `value`. Only diagnostic test strings belong here, never personal workout information.
6. Change the value and Save, then Read again. There should still be only one row for that identity, containing the new value.
7. Optional isolation check: use a separate browser profile/incognito session that can access the protected Preview. Read should say no value for its new identity. If you Save a second test value there, it should have a different `owner_id` and should not replace the first row. This supplements, rather than replaces, the RLS policy inspection below.
8. Verify normal GymBro logging still works with disposable Preview data: log a set, reload, and check History. In browser DevTools -> Application -> Local Storage, the workout remains under `daveGymTrackerV1`. The diagnostic uses only a separate `gymbro-probe-auth-<project-ref>` authentication session key; no workout database is sent to Supabase. No Supabase request should occur when normal workouts are saved.

The identity survives reload in the same browser/origin. Clearing browser data or switching Preview origins creates a different identity; this is not loss of workout history. There is no automatic test-user cleanup. Any later cleanup should target only known diagnostic rows/users and requires its own explicit action.

## 4. Inspect grants and RLS in Supabase

These read-only queries can be run in the same test project's SQL Editor:

```sql
select relrowsecurity
from pg_class
where oid = 'public.gymbro_connection_probe'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'gymbro_connection_probe';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'gymbro_connection_probe';
```

Expected: RLS is true; three owner-only policies use `auth.uid() = owner_id` for SELECT/INSERT/UPDATE; `authenticated` has SELECT/INSERT/UPDATE and `anon`/PUBLIC have no table grants. Administrative/table-owner privileges may also appear. No DELETE privilege is needed for this test.

## Local development and automated tests

Normal `npm start`/static GymBro still works and hides the diagnostic. To exercise the configuration route locally:

1. Copy `.env.example` to ignored `.env.local` and privately enter the intended project URL/publishable key. Leave both intentional local flags true. Never commit this file.
2. Run `npm run dev:probe` (Windows launcher: `.\.local-development\gymbro.cmd run dev:probe`). It serves only loopback at `http://127.0.0.1:8000` and uses the same configuration handler as Vercel. Restart after changing local variables.
3. Run the existing `npm test`, `check:syntax`, `check:release`, and `check:diff` commands. Diagnostic browser tests load the **actual pinned SDK** but mock Supabase HTTP responses; they do not establish live integration or live RLS enforcement. The config/server tests cover Production disabled, intentional local enablement, missing/unsafe settings, and private-file exclusion.

The SDK is vendored unchanged with its MIT license and provenance in [vendor/README.md](../vendor/README.md), loaded only after an enabled test action. No framework, build or npm runtime installation is added to normal app operation.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No test card | Use the correct Preview; enable `GYMBRO_SUPABASE_PROBE=true` for that branch and redeploy. Production/static mode intentionally hides it. |
| Not configured | Check exact variable names, Preview/branch scope, URL format, publishable-key prefix and new deployment. |
| Configured, request fails | Verify the URL/key pair is from the same project; project is running; inspect sanitized status and network status without sharing tokens. |
| Anonymous sign-ins disabled | Enable Anonymous Sign-Ins in the intended test project. Preserve existing CAPTCHA/security policies. |
| Table unavailable | Run the supplied SQL in that project; confirm Data API exposure. |
| Access denied | Inspect grants and all three owner-only RLS policies; do not disable RLS or use a service-role key. |
| No value after changing origin/browser | A different identity has a different row. Return to the same Preview origin/profile. |
| Rate limit | Reuse the same identity and wait; do not repeatedly clear auth storage. |
| Network/SDK failure | Retry when connectivity returns. Workout persistence remains local; diagnostic failures never switch workout storage. |

Setup sources: [Supabase anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [JavaScript SDK](https://supabase.com/docs/reference/javascript/installing), [Vercel environment variables](https://vercel.com/docs/environment-variables), [Node functions](https://vercel.com/docs/functions/runtimes/node-js).

Live checkpoint verified on 2026-10-27 in [PR #12's Preview](https://gymbro-git-v3-supabase-connection-check-dnk-9999.vercel.app/), build `2.7.2-20261027T152907Z`, project `loowxditqikcwyeftfgx`. After the user enabled anonymous sign-ins and ran the supplied SQL, a real Save succeeded, the page was fully reloaded, and a fresh Read returned the matching value with the same identity. Supabase Table Editor showed the matching single row; RLS was enabled, the three expected authenticated policies were present, and the SELECT owner predicate was inspected. This verifies the basic live connection checkpoint, not a workout migration or a comprehensive cross-user security audit. Production and workout storage remain unchanged. CI/mock tests alone are not substitutes for repeating this live check when configuration changes.
