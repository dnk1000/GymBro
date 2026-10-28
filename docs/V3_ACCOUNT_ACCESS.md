# Preview account access and ownership — issue #27

Candidate only. Based on accepted main `1631253ba092af2ad7e3a017ccdcbb40fb5dd0cf` (#46 merged). Branch `codex/issue-27-recoverable-access`. The user approved `3.2.0` for #27 on October 27, 2026. No Production rollout, workout migration or issue #39 implementation is included.

## Access and recovery

On an enabled Preview, open Data → Account access, enter an email you control and request a sign-in/recovery link. Open the newest email link in the browser where you want access. The existing pinned official Supabase client validates the returned session, removes the URL fragment and retains account state under `gymbro-account-auth-<staging-ref>`. The anonymous diagnostic uses its own storage key and is never promoted into a recoverable account.

Sign out of this browser ends that browser's session. It leaves other devices signed in and preserves local workouts. To recover after sign-out, clearing browser data or changing devices/origins, request a fresh link for the same email and open it in the intended browser. Record the Auth UUID through authorized provider/client evidence before and after recovery; the generic access-check message alone does not prove that identity stayed the same. No password is required. Mailbox access is the recovery mechanism; lost-mailbox recovery and email changes are outside this issue.

An expired/used link, unavailable network or rejected request must not report sign-in success. Request a fresh link after the provider's cooldown (normally 60 seconds). Refresh account retries session verification. Inputs remain available after failed requests. The pinned SDK may clear local credentials even when server logout fails; the UI then reports local sign-out with server revocation unconfirmed, rather than claiming successful remote revocation. No provider error text, token, password or service credential is displayed or logged by GymBro.

Supabase's default email templates support links. The staging Free-plan console currently requires custom SMTP or Pro for editing templates, so this implementation does not depend on a custom OTP template or a paid upgrade. Email delivery may be restricted to organization-authorized addresses by the default mail service. Configure an existing authorized SMTP sender privately if other test addresses need delivery; do not commit mail credentials or silently purchase/enable a paid service.

References: [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Environment contract

Reuse [#38 infrastructure](V3_INFRASTRUCTURE.md) and `supabase/environments.json`:

- Preview only: `GYMBRO_ACCOUNT_ACCESS=true`, `GYMBRO_CLOUD_ENV=preview`, `SUPABASE_PROJECT_REF=obebuvpsqapgevwivwho`, matching staging HTTPS URL and `sb_publishable_...` key. Initially scope these to `codex/issue-27-recoverable-access` in the existing Vercel project. Redeploy Preview after setting variables.
- Production always returns `{"enabled":false}` even if the account flag is accidentally inherited. Wrong/missing project/environment or privileged/legacy keys fail closed. Account access is independent of `GYMBRO_SUPABASE_PROBE`.
- Local intentional staging tests also require `GYMBRO_PROBE_LOCAL=true`; this is never a hosted flag. Ordinary static/file use remains account-free.
- Hosted staging Auth: email provider and confirmed-email signups enabled. Preserve other provider/security settings. Add only the exact branch Preview origin `/` to Auth's Redirect URLs; use that Preview as Site URL for this milestone so failures cannot fall back to Production or localhost. These URLs are public configuration. Never allow a Production callback in staging.
- Sessions are origin-scoped; request a new link when changing Preview origin. The SDK uses the default implicit email-link flow; there is no custom callback server or privileged client. Supabase consumes the email's one-time verification token at its own endpoint; GymBro receives the session in a fragment, not a GymBro HTTP query, and does not log it.

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

PR: [#47](https://github.com/dnk1000/GymBro/pull/47), recorded as draft and unmerged at evidence capture; verified merged at [`b40156b`](https://github.com/dnk1000/GymBro/commit/b40156bd943d230bdfa2e636390b85f5be1fd639). Final code `9785f6965201b87a36316425e5028f966542fa01`, `3.2.2-20261027T225348Z`: [CI](https://github.com/dnk1000/GymBro/actions/runs/40599003092) and [Vercel deployment](https://vercel.com/dnk-9999/gymbro/7iiYxZSUneFAm5aA9HC9SHjXMkni) passed. Earlier live account testing used `3.2.1-20261027T224326Z` at `d8bea0fea3e8a1c7311b61a0a4c17b67cbda2290`; development-only exact SQL-error assertion correction `f00b363` retained that build. `3.2.2` changes only the runtime rate-limit wording and adds the development-only guarded ownership helper. Final live Preview title/card/config verified; no further email request was made after the provider rate limit.

| Check | Status |
| --- | --- |
| Syntax/release/whitespace, focused account and full relevant local regressions | Passed. Full local suite: 163/163 before adding expired-link/failed-verification cases; final focused account/release/helper-safety suite: 19/19. [Final CI full regression](https://github.com/dnk1000/GymBro/actions/runs/40599003092/job/122522130698): 167/167, plus syntax (36 JS files)/release/committed-range checks. Disposable storage only. Changed-document local links: 75 passed. |
| Disposable DB replay and 22-assertion ownership pgTAP tests, including anon/permanent and cross-user CRUD/transfer rejection | [Final CI passed](https://github.com/dnk1000/GymBro/actions/runs/40599003092/job/122522130338): both empty/replay runs passed 35 SQL assertions each (13 existing diagnostic + 22 ownership), plus no-op apply and metadata query. Initial CI caught the restrictive-policy error text mismatch; fixed before the passing run. No local Docker pass claimed. |
| Hosted staging migration/ledger/no-op retry and matching RLS metadata | Passed on reviewed clean `4e9acc3a1ea663d9f2ef410c3b60b26499c7924a`: only `20261027223000` pending/applied, repeat apply reported up-to-date. Hosted PostgreSQL 17.11: RLS enabled, permanent-user RESTRICTIVE + owner PERMISSIVE policies, authenticated CRUD and no anon/public table grants. Production untouched. |
| Vercel Preview guard/config, desktop/320/390 px, console and preserved local workout bytes | Five branch-only Preview variables saved in the existing Vercel project; staging Auth Site URL and the sole redirect URL point to the exact branch Preview. [Deployment](https://vercel.com/dnk-9999/gymbro/DgiVPttcnBf66PmQfDmhmVUFod1w) passed. Actual desktop Chrome sign-in/marker/sign-out passed. Automated local browser checks passed 320/390/1280 px and unchanged raw local workout bytes; these are not live phone/Safari results. A separate unauthenticated live automation attempt encountered deployment protection and is not a pass; protections were preserved. |
| Email sign-in → sign-out → recover twice, same UUID, same user in a second browser/device | Partially verified live: first test user's emailed signup link restored a permanent account, SDK cleared the fragment, private marker save/read succeeded, and browser sign-out succeeded. The user confirmed the second mailbox link and clicked Check private access; the agent then verified the second account signed in with a successful remote marker save/read on `3.2.2` in Chrome. The fresh recovery email was rate-limited by Supabase's default mail service, so repeat recovery/same-UUID/second-browser acceptance remains pending; no provider upgrade or SMTP/security change was made. |
| Two live test users through Data API: own CRUD succeeds; unfiltered/targeted other-owner read, insert, update, delete and owner transfer rejected; original row intact | Pending live identities |
| Physical iPhone Safari email-link flow | Not tested; user tester needed. M0 personal-workout/backup gates remain before migration. |
| Production schema/data/personal storage/backup/merge/cutover | Not performed; outside this issue |

Preview: [issue #27 branch](https://gymbro-git-codex-issue-27-recoverable-access-dnk-9999.vercel.app/). Supplied test email addresses and authentication tokens are deliberately not committed. Only confirmed live actions above count as performed. The default email service accepted two confirmation requests and rate-limited the next email request; wait for its allowance or configure a separately authorized existing SMTP service before the remaining recovery tests. No email quota/reset time is inferred from the response.

For real signed-token Data API isolation evidence, [the operator check](../scripts/verify-preview-ownership.cjs) accepts private `GYMBRO_TEST_ACCESS_TOKEN_A/B` values from two distinct permanent **marker-empty** staging test accounts, with #38's staging URL/ref/publishable-key environment. It refuses Production, CI/Vercel, missing credentials and pre-existing markers. It only creates/deletes uniquely tagged disposable rows from that run. Never use service credentials or a real workout table. Run privately with Node's `--env-file` on an ignored local env file, then remove that private token file. This helper has not been run against live signed sessions; passing SQL-policy CI is separate evidence. Its occupied-account safety test proves no mutations occur when a pre-existing marker is found.

Test only disposable storage and non-personal Preview markers. Keep issue #27 open until its acceptance criteria are demonstrated and accepted. CI/mocks are not evidence of hosted email delivery or physical Safari.
