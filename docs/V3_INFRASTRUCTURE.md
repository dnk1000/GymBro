# V3 environment and migration pipeline — issue #38

Infrastructure only. #27 accounts, workout persistence/migration and Production cutover remain separate issues. Workout schema 7 and `daveGymTrackerV1` remain authoritative for workouts.

## Approved environments

The user approved these existing assignments on October 27, 2026. Public IDs live in [environments.json](../supabase/environments.json).

| Environment | Supabase project | Data boundary |
| --- | --- | --- |
| Preview | GymBro-Staging / `obebuvpsqapgevwivwho` / BrownStone Systems | Disposable diagnostic data only; no personal workout import. Shared across explicitly enabled Preview branches, not one DB per PR. |
| Future Production | GymBro / `loowxditqikcwyeftfgx` / DNK9999 | Reserved for approved rollout. #38 leaves schema and older checkpoint data untouched. |
| Local/CI | `gymbro-infrastructure`, PostgreSQL 17, Docker | Disposable Supabase DB rebuilt from migrations; no hosted credentials or personal data. |

Both hosted projects use Free plans; automatic PR branches require a paid upgrade and are not assumed. Supabase's `main PRODUCTION` badge means a project's default database branch. GymBro-Staging's default branch is the application Preview target.

Keep the existing repository and Vercel `dnk-9999/gymbro` delivery project. Do not use the abandoned `gymbro-v3-staging` Vercel project or PR #9 code. Reusing the empty Supabase staging project does not revive that implementation.

## Vercel variable contract

Configure **Preview-only**, initially restricted to `v3/issue-38-environment-migration-pipeline`. Later authorized branches need the same reviewed assignments. New values require a new Preview deployment.

| Variable | Preview | Production |
| --- | --- | --- |
| `GYMBRO_SUPABASE_PROBE` | `true` for explicit testing | Unset/false; function always disables it in Production. |
| `GYMBRO_CLOUD_ENV` | `preview` | No cloud runtime enabled by #38. |
| `SUPABASE_PROJECT_REF` | `obebuvpsqapgevwivwho` | No new value required by #38. |
| `SUPABASE_URL` | `https://obebuvpsqapgevwivwho.supabase.co` | Existing values untouched. |
| `SUPABASE_PUBLISHABLE_KEY` | Existing `sb_publishable_...` key from GymBro-Staging | Never copy Preview credentials to Production. |
| `VERCEL_ENV`, `VERCEL` | Platform-managed; never override | Platform-managed. |
| `GYMBRO_PROBE_LOCAL` | Unset | Unset; local-only flag. |

At #38 start URL/key were scoped to All Environments. Preview overrides must explicitly select staging; inheritance alone is not separation. Production values are unchanged. The endpoint fails closed on inconsistent environment/ref/URL or unknown/Production targets. Live Save/Read supplements key-format validation to prove a working project/key pair.

Only public URL/ref/publishable key cross the config endpoint. Secret/service-role and legacy JWT keys are rejected. Never put database passwords, `DATABASE_URL`, `SUPABASE_ACCESS_TOKEN`, migration or service credentials in browser assets, Vercel runtime variables, logs, Git or chat. CLI credentials belong in the operator's private local store/process; CI needs none. The diagnostic creates an anonymous identity only after explicit Save/Read and never uploads workouts.

## Schema and disposable replay

The official CLI `2.122.0` is pinned in the development lockfile. [Timestamped migrations](../supabase/migrations) and its `supabase_migrations.schema_migrations` ledger define schema history, independently of app versions. The first migration `20261027213000_connection_probe.sql` versions only the prior diagnostic table/policies, preserving existing rows and adding no workout schema. It replaces the standalone SQL path to retain one authoritative definition.

Applied migrations are immutable: add forward migrations, never edit applied files or repair ledger entries to hide failure. Unexpected schema/history requires investigation; the CLI ledger is not a general drift detector. [config.toml](../supabase/config.toml) defines only the local PostgreSQL-17 stack with no seed data. Never run `config push` against hosted projects. Hosted Auth/recovery belongs to #27.

Prerequisites: Node from `.nvmrc`, `npm ci`, Docker for local DB tests. On this Windows checkout the existing `.\.local-development\gymbro.cmd` can replace `npm`.

```sh
npm ci
npm run db:local:start
npm run db:local:apply
npm run db:local:test
```

Only in a known disposable **local** stack, replay and retry:

```sh
npx --no-install supabase db reset --local --no-seed
npm run db:local:test
npm run db:local:apply
npx --no-install supabase db query --local --file supabase/verify-infrastructure.sql
```

Never reset with `--linked` or `--db-url`. CI performs this local replay with no hosted tokens. pgTAP uses disposable Auth UUIDs in a rolled-back transaction to test actual SQL/RLS owner access and rejected cross-owner writes/ownership transfer; it does not prove hosted recovery or #27. The application suite uses disposable workout storage. CI validates only; it neither migrates hosted DBs nor deploys Vercel.

## Preview promotion

1. Review exact Git SHA and passing applicable CI; inspect staging for unexpected schema/data. Use disposable data only.
2. Authenticate privately: `npx --no-install supabase login`. Dashboard login does not authenticate the CLI. Use the narrowest provider-supported database/project-inspection scope; never share tokens in chat.
3. Copy [.env.example](../.env.example) to ignored `.env.local` without overwriting private settings. It supplies public Preview environment/ref/URL; enter the matching publishable key privately only for app testing.
4. Inspect:

```sh
npm run db:preview -- plan
npm run db:preview -- list
```

5. Set `GYMBRO_DB_APPLY_REVISION` in the operator process to the full reviewed HEAD SHA. From a clean committed checkout:

```sh
npm run db:preview -- apply
npm run db:preview -- list
npm run db:preview -- verify
npm run db:preview -- apply
```

Apply plans first, then pushes pending migrations with explicit project ref, `--skip-vault` and no seed. Repeat must report no pending work and retain the diagnostic row. Saved `.temp` links cannot redirect it. Extra flags, unknown/Production targets, Vercel/automatic CI invocation, dirty checkouts and mismatched review SHAs are rejected. Errors do not echo connection details or claim success.

6. Configure/redeploy only the branch Preview. Data must identify staging. Save a non-personal value, reload, Read fresh, and inspect the matching staging row/ledger. Check normal workout logging stays local. Do not test personal Production storage or claim a personal backup was made. See [diagnostic guide](SUPABASE_CONNECTION_TEST.md).

The guard prevents accidental targeting; database authorization and private operator credentials remain necessary.

## Production and recovery

No automatic hosted migration workflow is included. Future Production's GitHub **Deploy to production** toggle was observed OFF; preserve it. Verify staging automation before merge too. A GitHub merge/Vercel deployment must not implicitly apply Production schema.

A later Production promotion requires approval naming the project, accepted Git SHA, migration list/checksums, passing disposable/Preview evidence, current schema/ledger inspection and provider backup/recovery. An authorized operator uses the pinned CLI with explicit Production `--project-ref`, reviews `db push --dry-run --skip-vault`, and applies `db push --skip-vault` only after approval. Record ledger/schema/smoke evidence. The #38 guard has no Production apply path; bypassing it is not authorization. #29 retains cutover approval. #38 promotes no workout data.

Migrations should be transactional where PostgreSQL permits. On failure inspect schema and ledger; files are not one combined transaction. An interrupted response may have committed, so inspect history before retrying pending work. Rehearse recovery on disposable data. Prefer forward repair; never reset hosted DBs, edit applied files or erase ledger entries blindly. Code rollback does not undo schema/data. Destructive repair/restoration needs separate approval. Disabling the diagnostic need not delete its table/users; #38 performs no automatic cleanup.

## Evidence

Baseline: main `a0e9698`; staging showed **No tables or views** in `public` and **No migrations**. Future Production's **Deploy to production** was OFF. Vercel showed inherited URL/key and the old-branch-only flag. No credential values were recorded. Actual checks are in [V3_RELEASE.md](V3_RELEASE.md). Pending checks remain pending; mocked HTTP/local replay is not live integration. M0 physical-iPhone/personal-backup gates remain before workout migration.

References: [Supabase migrations](https://supabase.com/docs/guides/local-development/database-migrations), [CLI](https://supabase.com/docs/reference/cli/supabase-db-push), [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration), [Vercel scopes](https://vercel.com/docs/environment-variables).
