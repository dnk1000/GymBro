# Preview account access and ownership — issue #27

Candidate only. Based on accepted main `1631253ba092af2ad7e3a017ccdcbb40fb5dd0cf` (#46 merged). Branch `codex/issue-27-recoverable-access`. The user approved `3.2.0` for #27 on October 27, 2026. No Production rollout, workout migration or issue #39 implementation is included.

## Access and recovery

On an enabled Preview, open Data → Account access, enter an email you control and request a sign-in/recovery link. Open the newest email link in the browser where you want access. The existing pinned official Supabase client validates the returned session, removes the URL fragment and retains account state under `gymbro-account-auth-<staging-ref>`. The anonymous diagnostic uses its own storage key and is never promoted into a recoverable account.

Sign out of this browser ends that browser's session. It leaves other devices signed in and preserves local workouts. To recover after sign-out, clearing browser data or changing devices/origins, request a fresh link for the same email and open it in the intended browser. Confirm that the same account UUID is restored using the private access marker/authorized test evidence. No password is required. Mailbox access is the recovery mechanism; lost-mailbox recovery and email changes are outside this issue.

An expired/used link, unavailable network or rejected request must not report sign-in success. Request a fresh link after the provider's cooldown (normally 60 seconds). Refresh account retries session verification. Inputs remain available after failed requests. The pinned SDK may clear local credentials even when server logout fails; the UI then reports local sign-out with server revocation unconfirmed, rather than claiming successful remote revocation. No provider error text, token, password or service credential is displayed or logged by GymBro.

Supabase's default email templates support links. The staging Free-plan console currently requires custom SMTP or Pro for editing templates, so this implementation does not depend on a custom OTP template or a paid upgrade. Email delivery may be restricted to organization-authorized addresses by the default mail service. Configure an existing authorized SMTP sender privately if other test addresses need delivery; do not commit mail credentials or silently purchase/enable a paid service.

References: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Environment contract

Reuse [#38 infrastructure](V3_INFRASTRUCTURE.md) and `supabase/environments.json`:

- Preview only: `GYMBRO_ACCOUNT_ACCESS=true`, `GYMBRO_CLOUD_ENV=preview`, `SUPABASE_PROJECT_REF=obebuvpsqapgevwivwho`, matching staging HTTPS URL and `sb_publishable_...` key. Initially scope these to `codex/issue-27-recoverable-access` in the existing Vercel project. Redeploy Preview after setting variables.
- Production always returns `{"enabled":false}` even if the account flag is accidentally inherited. Wrong/missing project/environment or privileged/legacy keys fail closed. Account access is independent of `GYMBRO_SUPABASE_PROBE`.
- Local intentional staging tests also require `GYMBRO_PROBE_LOCAL=true`; this is never a hosted flag. Ordinary static/file use remains account-free.
- Hosted staging Auth: email provider and confirmed-email signups enabled. Preserve other provider/security settings. Add only the exact branch Preview origin `/` to Auth's Redirect URLs; use that Preview as Site URL for this milestone so failures cannot fall back to Production or localhost. These URLs are public configuration. Never allow a Production callback in staging.
- Sessions are origin-scoped; request a new link when changing Preview origin. The SDK uses the default implicit email-link flow; there is no custom callback server, privileged client or token in an HTTP query/log.

The app requests an email only on an explicit button action. Opening Preview never creates an account, anonymous identity, ownership row or workout import. A returned sign-in link restores only authentication. “Check private access” deliberately writes/reads one fixed non-workout marker.

## Database ownership contract for #39

Migration `20261027223000_private_access.sql` creates only `gymbro_private_access(owner_id, value)`, a disposable marker table. It does not design or store workouts. Use #38's reviewed, clean-revision Preview migration procedure; applied baseline migrations remain immutable. Disable the account flag to roll back UI exposure without deleting account/marker data. No destructive hosted rollback is authorized.

For downstream private workout tables:

- `owner_id` is an immutable Auth UUID referencing `auth.users(id)`, never email, a display label, client metadata or diagnostic identity.
- Enable RLS and explicitly revoke public/anon privileges. Grant authenticated users only the operations the product supports.
- Each SELECT/DELETE and UPDATE `USING` restricts existing rows to `(select auth.uid()) = owner_id`; INSERT and UPDATE `WITH CHECK` enforce the same owner for the resulting row. Ownership transfer is rejected.
- A restrictive permanent-user policy also requires signed `auth.jwt()->>'is_anonymous' = 'false'`. Missing/null claims fail closed. Anonymous Auth users have the authenticated database role and must not acquire workout ownership through that role alone.
- Relationships between owned records must preserve the same owner at the database boundary (e.g. composite owner/ID foreign keys in #39). A bare UUID relationship or UI filter is insufficient. Review views, RPCs, security-definer functions and grants for equivalent enforcement; privileged service credentials never enter the client.
- Cross-user SELECT/UPDATE/DELETE normally see/affect zero rows; INSERT/ownership-transfer fail with RLS errors. Zero affected rows are rejection evidence, not proof that a mutation succeeded. Verify the original owner's row remains intact.

Auth deletion currently cascades only disposable markers. This does not approve workout/account deletion semantics; #41 owns that decision. No private workouts are associated with an account, shared, uploaded, copied between accounts or cleared on sign-out in #27. Local schema stays 7 and key stays `daveGymTrackerV1`.

## Level 3 acceptance evidence

Required evidence remains pending until recorded on the exact PR revision:

| Check | Status |
| --- | --- |
| Syntax/release/whitespace, focused account and full relevant local regressions | Pending |
| Disposable DB replay and 22-assertion ownership pgTAP tests, including anon/permanent and cross-user CRUD/transfer rejection | Pending CI/local runtime |
| Hosted staging migration/ledger/no-op retry and matching RLS metadata | Pending |
| Vercel Preview guard/config, desktop/320/390 px, console and preserved local workout bytes | Pending |
| Email sign-in → sign-out → recover twice, same UUID, same user in a second browser/device | Pending live tester/mailbox access |
| Two live test users through Data API: own CRUD succeeds; unfiltered/targeted other-owner read, insert, update, delete and owner transfer rejected; original row intact | Pending live identities |
| Physical iPhone Safari email-link flow | Not tested; user tester needed. M0 personal-workout/backup gates remain before migration. |
| Production schema/data/personal storage/backup/merge/cutover | Not performed; outside this issue |

Test only disposable storage and non-personal Preview markers. Keep issue #27 open until its acceptance criteria are demonstrated and accepted. CI/mocks are not evidence of hosted email delivery or physical Safari.
