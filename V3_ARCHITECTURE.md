# V3.0 integration architecture and provider boundary

Product authority is GymBro_PRD.md. GymBro owns structured training facts, actions, persistence and the dashboard. A replaceable trainer supplies conversation, reasoning and coaching. This milestone implements infrastructure, not the complete V3 north star.

## Components

Vanilla browser / authorized trainer → Vercel Node API → shared V2-derived domain → per-user PostgreSQL JSONB. Supabase Auth provides account identity and OAuth 2.1. No microservices, queues, event bus or second workout engine.

- `workout-actions.js`: same actions with sync/Promise persistence, detached outputs and a whole-action busy guard. Selectors stay synchronous. Local callers retain synchronous behavior.
- `server/domain.cjs`: loads the same trusted source files in a DOM-free Node context, as the existing domain tests do. This is module isolation, not a security sandbox for untrusted code. No browser/source text supplied by a client is evaluated.
- `contracts/permissions.cjs`: explicit allowlist of selectors/actions and required application scopes; unknown operations default deny.
- `server/auth.cjs`: SDK getClaims cryptographic verification plus getUser; checks issuer, audience, expiry, role, subject, session and OAuth client binding. No custom tokens or signing keys. Auth values are never logged.
- `server/store.cjs`, `server/service.cjs`: restricted database transaction, grant checks, account revision, request receipts, action invocation and first-party account operations.
- `api/`: Vercel HTTP endpoints, public account config and installed/pinned Supabase SDK asset. `npm run dev` supplies the local HTTP adapter. Static local-only serving still works.
- `connection-core.js`, `account-ui.js`: authority state, reviewed migration, explicit dataset choice, account authentication, consent/revocation and conservative failed-save handling.

## Identity, permission and provider ownership

Supabase identity JWTs must have this project's `/auth/v1` issuer, audience `authenticated`, role `authenticated`, valid expiry/session/subject. `client_id` marks a Supabase OAuth client; its absence denotes a direct GymBro login. A malformed present client claim is rejected. Request-body user IDs never select an account. Anonymous and service-role tokens are rejected.

Enable Supabase's OAuth server and pre-register clients with exact redirect URIs and PKCE. Dynamic registration is outside this milestone. Supabase issues/refreshes/verifies tokens and manages authorization requests. GymBro's consent screen displays Supabase-verified client identity, requested identity scopes and redirect address. Users choose GymBro permissions explicitly, with history modification a separate unchecked option.

Supabase OIDC scopes (`openid`, `email`, `profile`, `phone`) are identity scopes, not GymBro permissions. GymBro stores grants keyed by user/client with allowed application scopes, token issue-time cutoff and revocation time. Re-granting excludes older tokens; the browser waits for the cutoff before returning the authorization code. A database failure after Supabase consent still denies GymBro access. An existing Supabase auto-consent redirect cannot silently create or broaden a GymBro grant; request fresh consent to change permissions.

| Scope | Allowed surface |
|---|---|
| training:read | State/session/guided/evidence selectors, including explicit dates for evidence |
| workout:write | Start/finish, guidance, navigation, status, substitutions, logging and bodyweight; manual trainer set logging requires an active session |
| history:modify | Set corrections/deletion, explicit attachment, reviewed historical import |

Permanent program controls remain first-party in V3.0. No trainer grant authorizes complete backup restore, complete replacement/reset, initial migration, grant administration or account administration. Write-only responses omit full state, including failures and receipt replays. Historical content returned by training:read includes user notes/pain; consent is data access, not permission for a provider to invent facts.

Revocation updates the GymBro grant before attempting upstream Supabase revocation. Requests serialize on the same account lock: an already-authorized in-flight mutation may finish before revocation, but requests after revocation commit fail. Failed upstream revocation is reported separately; GymBro remains denied. Data is retained. Providers may have retained previously read data; revocation cannot erase external copies.

## API and concurrency

POST `/api/gymbro`, JSON, `Authorization: Bearer <Supabase access token>`. Browser origins must match GYMBRO_ORIGIN; no credentialed cross-origin allowance. Native trainer clients use bearer tokens. Limits: 1 MB request payload, bounded database statement timeout, small connection pool. Deployment-level abuse/rate controls remain a staging gate.

Operations: `state`; `action` with an allowlisted action and positional `args`; first-party `import-preview`, `import-commit`, `restore`, `merge`, `reset`, `grants`, `consent-details`, `consent`, `revoke`.

Mutations require a stable `requestId` and `expectedRevision`. PostgreSQL locks the user account row, checks current grants, checks existing receipts, checks expected account revision, invokes the shared action, validates and writes JSONB plus receipt in one transaction, then COMMITs before returning success. Receipts retain action identifiers and parameter signatures, not copies of old workout history. Replays return current permitted state and original identifiers, never resurrect old/deleted sets. Same ID with different parameters fails. Account revisions are independent of guided revisions. Domain NO_CHANGE/REPLAY does not rewrite workout data.

Guided request/tombstone semantics remain unchanged. Distinct intentional identical sets require distinct logical IDs. A stale account or guided revision requires inspection; never silently substitute the latest revision. A network failure after COMMIT may be ambiguous, not a guaranteed rollback: the client retains the single attempted request and its receipt identity for explicit retry. This is not an offline queue; new writes cannot proceed while that outcome is unresolved. No automatic offline replay or background synchronization.

Legacy restore/merge/reset use the same established validators and merge rules, inside first-party transactions. Restore never resets account revision or erases receipt records. Backup exports preserve schema 7; appVersion remains export metadata. Local originals are untouched by connected operations.

## Authority and migration

Authentication and data authority are separate. The visible status is local-only, connected/server-authoritative, or cached connected data while unavailable. The local key stays daveGymTrackerV1. The separate gymbroConnectedV3 envelope records connected account identity, state and revision; it is a cache, never a write authority.

Login does not upload or select data. The user may explicitly select an existing server dataset, preview importing local data, or preview an empty account with default program settings and no personal history/preferences. Logout retains the current dataset as read-only cached data. Returning to the original local dataset requires Use local-only GymBro. A different login cannot write the displayed previous account's cache.

Migration validates and previews a snapshot with counts, schema and digest. The preview is bound to user, account revision and a 15-minute expiry. Confirmation commits only into an uninitialized account. It cannot replace existing data. The browser reads server state back, validates it, compares canonical SHA-256 integrity against the preview, checks unchanged local state/user, and finally persists one connected authority envelope before switching the display. Any failure retains local authority and original bytes. Repeating the identical commit is receipt-idempotent. If the server committed but verification failed, explicit retry/read-back can finish; an account already containing data rejects a different initial import.

Connected mutations await server results before clearing inputs; failures preserve input. Connected mode never falls back to local writes. Existing local storage quota/recovery/stale-tab semantics remain. Account changes require explicit dataset selection; no merge is inferred.

## Database/RLS and security assumptions

`gymbro.accounts`: user ID, nullable initial schema-7 JSONB and monotonic account revision. `grants`: client/user/scope/revocation binding. `receipts`: actor/request/signature/result. `import_previews`: expiring reviewed payloads.

All tables enable and FORCE RLS. Policies compare user_id to transaction-local server-verified user context. API role has only needed DML, no schema creation, ownership or RLS bypass. Browser Supabase anon/authenticated roles have no direct access to the private schema. A separate migration administrator installs schema/role; the runtime login must not be superuser/BYPASSRLS. Runtime TLS verifies certificates.

The Node API and its database credential are trusted: an attacker controlling them could impersonate the transaction-local user context. RLS protects missing context/cross-user queries, not full API compromise. Supabase signing keys/SDK, registered redirects, HTTPS, and Vercel secret isolation are prerequisites. Browser XSS can access session/cache data; this change renders account/provider names through textContent and does not introduce provider HTML. Device cache persists after signout by explicit product requirement; use shared devices accordingly.

## Limits and deferred work

No AI coaching, ChatGPT integration, voice, natural-language interpretation, exercise reordering, live-plan adaptation, autonomous progression, offline synchronization or provider-specific business logic. OAuth protocol interoperability is staging-dependent. Full-state JSONB copies and per-user serialization are intentional initial limits; no realtime subscriptions or merge-on-conflict. Receipt retention is unbounded pending a separately reviewed retention policy. Local stale-tab detection is not atomic cross-tab CAS. Physical Safari, staged OAuth, deployment hardening and V2 final acceptance remain separate gates.
