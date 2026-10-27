const { test } = require("node:test");
const assert = require("node:assert/strict");
const { commandsFor } = require("../scripts/preview-db.cjs");
const { environments, previewEnvironment } = require("../api/_lib/supabase-environment.cjs");
const revision = "a".repeat(40);
const env = { GYMBRO_CLOUD_ENV: "preview", SUPABASE_PROJECT_REF: environments.preview.projectRef,
  SUPABASE_URL: `https://${environments.preview.projectRef}.supabase.co`, SUPABASE_ACCESS_TOKEN: "fixture-not-a-token" };

test("Preview boundary refuses Production, unknown and inconsistent project settings", () => {
  assert.notEqual(environments.preview.projectRef, environments.production.projectRef);
  assert.equal(previewEnvironment(env).ok, true);
  for (const change of [{ GYMBRO_CLOUD_ENV: "production" }, { SUPABASE_PROJECT_REF: environments.production.projectRef },
    { SUPABASE_URL: `https://${environments.production.projectRef}.supabase.co` },
    { SUPABASE_URL: `${env.SUPABASE_URL}/unexpected` }, { SUPABASE_PROJECT_REF: "unknown" }])
    assert.equal(previewEnvironment({ ...env, ...change }).ok, false);
});

test("remote migration tools require an operator and an explicit reviewed apply revision", () => {
  for (const change of [{ VERCEL: "1" }, { VERCEL_ENV: "preview" }, { CI: "true" }])
    assert.throws(() => commandsFor("apply", { ...env, ...change }, revision));
  for (const approved of [undefined, "main", "b".repeat(40)])
    assert.throws(() => commandsFor("apply", { ...env, GYMBRO_DB_APPLY_REVISION: approved }, revision));
  const commands = commandsFor("apply", { ...env, GYMBRO_DB_APPLY_REVISION: revision }, revision);
  assert.equal(commands.length, 2);
  assert.ok(commands[0].includes("--dry-run"));
  assert.ok(commands[1].includes("--yes"));
  for (const command of commands) {
    assert.ok(command.includes(environments.preview.projectRef));
    assert.ok(command.includes("--skip-vault"));
    assert.ok(!command.includes("--include-seed"));
    assert.ok(!command.includes("--linked"));
  }
  assert.throws(() => commandsFor("reset", env, revision));
});

test("plan/list/verify support inspection without enabling an apply", () => {
  assert.ok(commandsFor("plan", env, revision)[0].includes("--dry-run"));
  assert.equal(commandsFor("list", env, revision)[0][0], "migration");
  assert.deepEqual(commandsFor("verify", env, revision)[0].slice(-2), ["--file", "supabase/verify-infrastructure.sql"]);
});
