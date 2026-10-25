# V3.0 staging setup and validation

Use a separate Vercel staging project and **GymBro-Staging** Supabase project (East US / North Virginia). Do not reuse gymbro-v1.5 or its integrated Supabase project. No production migration or merge is authorized. Vercel's ignoreCommand skips deployment unless explicit V3 staging configuration passes; the runtime also fails closed. Production rollout needs a future reviewed change to this guard.

## Secure configuration

Inspect presence only; do not paste credentials into chat, commit environment files, or print connection strings.

| Setting | Purpose |
|---|---|
| GYMBRO_DEPLOY_TARGET=v3-staging | Explicit deployment/runtime opt-in |
| GYMBRO_SUPABASE_PROJECT_REF | Exact GymBro-Staging project reference; verified against Auth URL and DB destination |
| SUPABASE_URL | HTTPS URL of that project's Auth service |
| SUPABASE_PUBLISHABLE_KEY | Public project key, deliberately returned to browser; never substitute a secret/service-role key |
| DATABASE_URL | Restricted database LOGIN connection, supplied securely as a runtime variable; never use postgres/admin/service role |
| DATABASE_CA_FILE | Optional trusted CA file path for verified PostgreSQL TLS; no rejectUnauthorized=false or insecure URL SSL overrides |
| GYMBRO_ORIGIN | Exact staging browser origin, or explicit loopback origin for local development against staging |

The environment currently lacks these staging bindings. Publishable settings alone cannot install migrations or validate the runtime role. Migration administration requires a **separate staging migration credential**, not an elevated API login. Supply credentials through environment settings or the platform secret store. Do not request values in chat.

Allow the exact staging Supabase HTTPS hostname. PostgreSQL also requires supported TCP routing to the selected direct database/session-pooler destination; HTTPS permission is insufficient. Hosted Vercel needs outbound TLS connectivity. `api.github.com` is required to create/check the PR. No broad Supabase wildcard is needed.

## Database installation

With a staging migration administrator, apply `migrations/001_integration.sql`. The migration is repeatable. It creates the private gymbro schema, NOLOGIN gymbro_api privilege role, tables, RLS and explicit grants. It revokes direct anon/authenticated/service_role access to that schema. Never expose it through Supabase Data API settings.

Create a dedicated staging LOGIN role with NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS and a securely provisioned password; grant only gymbro_api membership. Do not put passwords in a script or repository. Set DATABASE_URL to that login, using Supabase's documented session pooler or direct TLS connection. A pooler username must identify the restricted login and staging project reference. The server uses SET LOCAL ROLE gymbro_api within each transaction. The migration administrator and API login must be different.

Check session_user/current_user and pg_roles; verify neither runtime login nor effective role has bypass/ownership privileges or unrelated memberships. The tables must be owned by the migration role, not the API role. Inspect policies, privileges and Supabase schema exposure explicitly. Policies require transaction-local verified user context; absence denies access. RLS does not protect against a fully compromised trusted API credential.

## Supabase Auth/OAuth

Enable email/password Auth, configure confirmation email and the exact staging site/redirect URLs. Enable Supabase OAuth 2.1 server, with the authorization path pointing to the staging GymBro page (authorization_id query parameter). Pre-register a synthetic test trainer client with exact redirect URI and authorization-code PKCE. Keep dynamic client registration disabled. Supabase owns codes, signing keys, token expiry and refresh. Do not create an OpenAI key or provider-specific integration.

GymBro consent selects training:read, workout:write and separately history:modify. Supabase identity scopes do not confer these permissions. Tests must use actual Supabase sessions and OAuth tokens, not the local synthetic fixtures. Confirm issuer/audience/client_id match the expected project and registered client. Confirm existing identity-only consent cannot silently broaden GymBro permissions.

## Local development and tests

Use Node from .nvmrc. `npm ci`; `npm run dev` starts the Node API/static server on loopback port 8000 (PORT overrides). `npm start` retains the Python static local-only server. Verify the seven views and account status using disposable browser storage. If no staging configuration exists, connected mode reports unavailable; local-only operation remains functional.

Run:

```sh
npm run check:syntax
npm run check:release
npm test
npm run check:diff
```

The ordinary suite includes V2 domain/browser regressions plus simulated account and security-boundary tests. Supabase browser/session fixtures are explicitly mocked; they do not establish OAuth interoperability.

The separate PostgreSQL suite needs a disposable loopback database with migration-admin access. It creates fixtures and roles; never run it on staging or production. In a managed cloud environment follow the runtime skill's Docker proxy/CA guidance. The validated container uses postgres:17-bookworm (downloaded digest sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27), bound only to 127.0.0.1:55432 with trust authentication for disposable data. The runtime test pool switches to its separately created restricted login. Do not expose this container beyond loopback.

```sh
# Only against the isolated local fixture, never a real account database:
GYMBRO_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/postgres npm run test:postgres
```

The suite exercises real migrations, actual restricted-role RLS, two-user isolation, revision races, receipts/replays/tombstones, scoped action execution, revocation, import and first-party restore/reset. It uses synthetic verified auth contexts; Supabase token verification remains a separate staging check.

## Required staged acceptance (not yet performed)

1. Confirm separate project IDs, guarded Vercel build, exact commit/version and TLS/secret configuration. Verify no changes to V2 production project/integration.
2. Apply migrations and verify RLS/role ownership/privileges. Test missing-context denial and user A/B SELECT/INSERT/UPDATE isolation using the real restricted login, including pool connection reuse.
3. Create two test accounts. Verify confirmed login, invalid/expired/wrong-project tokens, OAuth client binding, PKCE/redirect rejection and no authentication-driven data upload/switch.
4. On disposable local data, preview import, commit, read back and compare integrity. Repeat the same request, test changed-preview/revision rejection, and interrupt after server commit. Original local bytes must remain unchanged and authority must remain local until verification/switch completes.
5. Test trainer read-only, write-only and separately consented historical permissions. Write-only results must not expose full state. Reject restore/reset/migration/grant administration even with all trainer permissions.
6. Test normal manual/guided writes, simultaneous stale revisions, exact retry, changed request, deletion tombstone, completed-session guards and evidence queries.
7. Revoke while a trainer token is still valid. Future reads/writes must fail, history remains intact; record any upstream revocation failure independently.
8. Exercise connected first-party complete restore/history merge/reset, no offline writes, cached display after signout/reload and explicit return to local-only. Check 320/390px and real iPhone Safari; automation is not device acceptance.
9. Verify Supabase Auth rate limits, Vercel request/abuse controls, private schema exclusion, secret/log redaction, bundle asset restrictions and retained-cache disclosure before public staging access.
10. Record actual project, commit/build, test account identifiers (not credentials), outcomes and deployment status. No production rollout/merge follows automatically.

## Open gates

No live Supabase Auth/OAuth, restricted staging database, Vercel staging deployment or physical iPhone acceptance has been verified by the local suites. V2 production JSON backup/data acceptance and final V2 release evidence also remain open. No AI coaching, voice, ChatGPT integration, exercise reordering, live-plan adaptation or offline synchronization is delivered here.
