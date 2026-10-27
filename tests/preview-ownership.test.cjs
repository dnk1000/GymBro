const { test } = require("node:test");
const assert = require("node:assert/strict");
const { verify } = require("../scripts/verify-preview-ownership.cjs");
const env = { GYMBRO_CLOUD_ENV: "preview", SUPABASE_PROJECT_REF: "obebuvpsqapgevwivwho",
  SUPABASE_URL: "https://obebuvpsqapgevwivwho.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_public_value_only",
  GYMBRO_TEST_ACCESS_TOKEN_A: "test-a", GYMBRO_TEST_ACCESS_TOKEN_B: "test-b" };
test("hosted ownership operator check refuses Production, automation and missing user tokens before network access", async () => {
  for (const change of [{ SUPABASE_PROJECT_REF: "loowxditqikcwyeftfgx" }, { CI: "true" },
    { VERCEL: "1" }, { GYMBRO_TEST_ACCESS_TOKEN_A: "" }, { SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" }])
    await assert.rejects(verify({ ...env, ...change }));
});
test("hosted ownership operator check writes nothing when an existing marker is present", async t => {
  const original = global.fetch, methods = [];
  t.after(() => { global.fetch = original; });
  global.fetch = async (url, options) => {
    methods.push(options.method);
    return { status: 200, json: async () => url.endsWith('/user') ?
      { id: 'test-a', email: 'fixture@example.invalid', is_anonymous: false } :
      [{ owner_id: 'test-a', value: 'preserve this pre-existing marker' }] };
  };
  await assert.rejects(verify(env), /existing data is never replaced/);
  assert.deepEqual(methods, ["GET", "GET"]);
});
