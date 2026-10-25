# Production delivery and rollback — GymBro V2

This is the Milestone 7 preparation/runbook. It does not authorize a merge or declare V2 complete. See [V2_RELEASE.md](V2_RELEASE.md) for the candidate/version and open gates; [PRD_COMPLIANCE.md](PRD_COMPLIANCE.md) for the audit.

## Reproducible validation

- Use Node from `.nvmrc`, `npm ci` and the pinned playwright-core lockfile. There are no runtime dependencies, application compilation step or backend.
- CI: `.github/workflows/ci.yml`, pull requests to main and pushes to main, job **V2 regression**. PR checkout tests GitHub’s merge candidate; full history enables base-SHA whitespace checks. Actions are commit-pinned, permissions are contents:read, no deployment secrets, no deployment jobs.
- CI installs the Playwright-pinned Chromium with Linux dependencies and sets CHROMIUM_PATH explicitly. Locally an installed /usr/bin/chromium remains supported, or set CHROMIUM_PATH to the Playwright executable.
- Run `npm run check:syntax`, `npm run check:release`, `npm run check:diff` and `npm test`. For an explicit committed range: `npm run check:diff -- <full-base-commit-SHA>`. Locally the default base is merge-base with origin/main; CI supplies the PR base SHA or push before SHA. Working-tree/staged edits are also checked. Untracked files are syntax checked; stage new files before final whitespace validation.
- The full suite includes version/UI/export, migration/future/corrupt schema, guided/recovery, trainer evidence, action/replay/rollback, History/session, import duplicate protection and backup/restore/merge. Failed assertions fail CI. Test logs are retained as artifacts even on test failure; no continue-on-error or failure suppression.
- The existing direct-file test skips only when managed Chromium explicitly blocks file navigation. Report that skip and retain the complete HTTP tests. Hosted Chromium may run it successfully; do not force a skip or equate Chromium with physical Safari.
- `check:release` validates committed UTC metadata, target milestone/schema, current release artifact/history/changelog and absence of independently hard-coded runtime builds. Browser tests validate actual UI/Help/export matching. Historical milestone documentation keeps historical versions. Update expected milestone policy deliberately for future authorized milestones.

## GitHub → Vercel path and observability

| Stage | Expected behavior |
| --- | --- |
| Dedicated milestone branch | Commit/push approved scope; no production CLI/promote command. |
| Pull request to main | GitHub CI + Vercel Preview. Verify the exact PR head, Vercel deployment revision and full version footer. Preview has independent localStorage. |
| Release gates | Record physical results, backup verification, PRD exceptions and explicit user approval before merge. |
| Accepted merge to main | Existing Vercel Git integration creates Production deployment automatically. Do not merge before the backup gate because deployment may start immediately. |
| Post-deploy | Verify merge SHA/status, production alias/assets/full displayed version, then controlled smoke and user’s real existing-data check. |

Observed: PR #7 deployment succeeded and accepted main `7548553` served the M6 build. No repository workflow or vercel.json existed before M7. Keep that static-root Git integration; no extra Vercel deployment workflow is necessary. No Vercel API settings access was available to verify production-branch/build overrides directly: confirm in Project Settings that repository is dnk1000/GymBro, Production Branch is main, framework is the existing static/Other setup, root is the repository root, and no unintended build/output overrides were introduced. Project display name gymbro-v1.5 does not control APP_VERSION.

Production alias previously verified: https://gymbro-v15.vercel.app/ . Keep the user's usual production origin unchanged. Deployment-specific/preview URLs are different origins and do not share user history.

Observe `gh pr checks <PR>`, workflow runs/artifacts and the Vercel check/dashboard. `gh api repos/dnk1000/GymBro/commits/<sha>/status` exposes Vercel status; GitHub Actions checks are separate. A green preview is not production acceptance and Vercel does not automatically wait for Actions before deploying main.

Branch protection/rulesets: the preparation audit could not read classic main protection (HTTP 403 Resource not accessible by integration); the accessible ruleset list was empty. Do not claim protection is enforced from that. A repository administrator should verify required PR/CI checks for **V2 regression**, required preview status as appropriate, and restrictions on direct production pushes. Changes must preserve this user-approved workflow; do not bypass protection or introduce production credentials. If permissions remain unavailable, report this as an external release check.

## Mandatory pre-merge checklist

- [ ] Exact candidate revision: CI green, complete counts/skips/reasons recorded, syntax/release/whitespace checks pass.
- [ ] Preview Ready for that revision; full 2.7.0 build displayed, Help loads, no unwanted UI/domain change.
- [ ] Schema 7 and unchanged key confirmed; round-trip test passes on disposable/copy data, preserving all supported sections and guidance/request history.
- [ ] M6 physical iPhone Safari results recorded in REAL_PHONE_SMOKE_TEST.md, including device/iOS/browser/version/commit/date and each required outcome. Any changed mobile Help content retested for scroll/reachability. Fix actual failures before acceptance.
- [ ] User exports **actual production complete JSON**, verifies file saved in Files/downloads, parses it as JSON (local editor/JSON.parse or `python3 -m json.tool <backup-file>`), verifies sections/schema and records pre-deployment application version. Retain the original safely; do not commit personal backups to GitHub.
- [ ] Record backup verification/test date/tester privately or in release notes without disclosing personal workout data. Agent cannot certify a user's browser backup without access/evidence.
- [ ] Document dispositions for actual V2 PRD discrepancies; do not add features under release-engineering scope.
- [ ] Confirm Vercel main production path, GitHub required-check protection and rollback target.
- [ ] Obtain explicit user merge approval. Preparation approval is insufficient.

## Safe preview / post-deployment smoke

Before merge, run on the preview. After approved merge, repeat against production in a fresh disposable browser context/profile with **no access to the user's normal localStorage**. Same URL is allowed: browser profiles/contexts isolate storage. Never use the user's personal tab for synthetic restore, reset or erasure. Never restore synthetic data over production user history.

Record version, commit, URL, browser/context, date, counts and any test record IDs. The fresh context may show seed history; this is not verification of the user's personal data. Export its complete JSON before mutating test state and retain a final test export until diagnosis is complete.

1. Load URL, verify logo/all seven tabs and full candidate version in UI; inspect uncaught console errors.
2. Check existing fixture/seed/copy data and five templates. Separately ask user to confirm their personal history/program still load in their usual production browser.
3. Start a test 30-minute workout (or resume an intentionally copied active session). Confirm template/snapshot/mode and single active identity. Record its test session ID.
4. Log a guided set, verify ordered set ID, revision/current exercise and factual trainer context; reload and confirm exactly once, same active session/progress.
5. Check History includes the committed actual exercise/load/reps/metadata. Use manual logging under existing association rules and confirm it persists. Finish only the disposable session, with pending-slot confirmation as applicable.
6. Export complete JSON; verify readable schema 7, canonical exporting version and all session/guidance/request/history/program/library/preferences/bodyweight/import sections. Verify export → restore → export using this disposable context only. Source data must reproduce trainer evidence; derived evidence is not persisted.
7. Close/discard the disposable context. Temporary records existed only there; list that fact/IDs in smoke results rather than deleting genuine history. Actual personal-data verification is read-only; if a real test record is ever needed, require an explicit agreed plan and record its ID/cleanup.

Automated production read-only URL/asset/version checks are useful but are not completion of the interactive smoke or physical Safari acceptance. Do not run final production acceptance for M7 while the physical gate remains open.

## Rollback: code and data are separate

1. Stop release acceptance if production verification fails. Record failing version/SHA/deployment, symptoms and whether any successful writes occurred. Keep actual history intact and retain the latest readable JSON.
2. Identify the last verified accepted release in RELEASE_HISTORY.md and Vercel deployment history. The immediate pre-M7 baseline is main `7548553`, application `2.6.0-20261023T220541Z`, schema 7. Confirm exact deployment/revision; do not select a preview by similar name.
3. Preferred code rollback: create a focused rollback branch from current main, revert the faulty merge with the correct mainline (`git revert -m 1 <faulty-merge-SHA>`), run regression/syntax/release checks appropriate to the restored version, and obtain explicit rollback approval through a PR. A whole M7 revert restores its earlier tooling/version contract too. Update documentation deliberately; do not force a stale 2.7 validator onto an intentionally restored 2.6 release.
4. Merge the approved rollback PR; verify the normal main→Production deployment. An emergency Vercel rollback to a previously verified **production** deployment requires explicit incident approval and confirmation of project support; never promote an unapproved preview. Reconcile main via the reviewed revert so future deployments do not immediately reintroduce the defect.
5. Rolling back code does **not** roll back localStorage. M6 and M7 both support schema 7, so valid current schema-7 data can normally remain. A code rollback by itself should not restore the old backup or discard post-upgrade sets.
6. Restore user data only if actual data damage warrants it: first export the latest readable state, retain both copies, explain loss of any newer records and obtain explicit confirmation. Restore complete backup replaces the full supported state. History merge has conservative conflict rules and is not a universal data-repair tool.
7. For an older code release that cannot read the current schema, stop. Never lower the schema number/delete fields/clear browser storage to force compatibility. Choose compatible code or propose a separately approved recovery/migration. Pre-deployment backups are recovery evidence, not automatic downgrade instructions.
8. After rollback, verify production version/status, data loading and safe smoke. Leave V2 release incomplete until the incident and all gates are resolved.

## Final completion record

Only after gated approval, merge and production verification: update V2_RELEASE.md with exact production SHA/deployment and results, accepted PRD dispositions, backup evidence and physical test reference. Update release history without changing application build for docs-only edits. Never invent acceptance results or start V3 as part of M7.
