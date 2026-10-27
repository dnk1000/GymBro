// Explicit operator check with two permanent staging test sessions, never service keys.
// Refuses existing markers. Creates/deletes only uniquely tagged disposable test rows.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { previewEnvironment } = require("../api/_lib/supabase-environment.cjs");
async function verify(env = process.env) {
  const boundary = previewEnvironment(env);
  if (!boundary.ok || env.VERCEL || env.CI) throw Error("An explicit staging operator session is required.");
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  const tokens = [env.GYMBRO_TEST_ACCESS_TOKEN_A, env.GYMBRO_TEST_ACCESS_TOKEN_B];
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key || "") || tokens.some(token => !token))
    throw Error("Provide the staging publishable key and two fresh test-user tokens privately.");
  async function request(index, endpoint, method = "GET", body) {
    const response = await fetch(boundary.url + endpoint, { method,
      headers: { apikey: key, Authorization: `Bearer ${tokens[index]}`,
        "Content-Type": "application/json", Prefer: "return=representation" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    return { status: response.status, data: await response.json() };
  }
  const owners = [];
  const endpoint = "/rest/v1/gymbro_private_access";
  for (const index of [0, 1]) {
    const auth = await request(index, "/auth/v1/user");
    assert.equal(auth.status, 200); assert.equal(auth.data.is_anonymous, false);
    assert.ok(auth.data.id && auth.data.email); owners.push(auth.data.id);
    const existing = await request(index, endpoint);
    assert.equal(existing.status, 200);
    assert.deepEqual(existing.data, [], "Use marker-empty test accounts; existing data is never replaced");
  }
  assert.notEqual(owners[0], owners[1]);
  const marker = `issue27-${randomUUID()}`;
  const target = index => `${endpoint}?owner_id=eq.${owners[index]}&value=eq.${marker}`;
  try {
    for (const index of [0, 1]) {
      const inserted = await request(index, endpoint, "POST", { owner_id: owners[index], value: marker });
      assert.equal(inserted.status, 201);
    }
    for (const index of [0, 1]) {
      const other = 1 - index;
      const unfiltered = await request(index, endpoint);
      assert.deepEqual(unfiltered.data, [{ owner_id: owners[index], value: marker }]);
      const hidden = await request(index, target(other));
      assert.equal(hidden.status, 200); assert.deepEqual(hidden.data, []);
      const inserted = await request(index, endpoint, "POST", { owner_id: owners[other], value: marker });
      assert.equal(inserted.status, 403); assert.equal(inserted.data.code, "42501");
      for (const [method, body] of [["PATCH", { value: marker }], ["DELETE", undefined]]) {
        const denied = await request(index, target(other), method, body);
        assert.equal(denied.status, 200); assert.deepEqual(denied.data, []);
      }
      const transfer = await request(index, target(index), "PATCH", { owner_id: owners[other] });
      assert.equal(transfer.status, 403); assert.equal(transfer.data.code, "42501");
      const intact = await request(other, target(other));
      assert.deepEqual(intact.data, [{ owner_id: owners[other], value: marker }]);
      const updated = await request(index, target(index), "PATCH", { value: marker });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.data, [{ owner_id: owners[index], value: marker }]);
    }
    for (const index of [0, 1]) {
      const deleted = await request(index, target(index), "DELETE");
      assert.equal(deleted.status, 200);
      assert.deepEqual(deleted.data, [{ owner_id: owners[index], value: marker }]);
      assert.deepEqual((await request(index, target(index))).data, []);
    }
  } finally {
    for (const index of [0, 1]) {
      const cleanup = await request(index, target(index), "DELETE");
      assert.equal(cleanup.status, 200, "Cleanup failed; inspect only this run's tagged test markers");
    }
  }
  console.log("Staging Auth/Data API owner CRUD and bidirectional isolation passed; only this run's tagged markers were used.");
}
if (require.main === module) verify().catch(() => {
  console.error("Ownership check failed or is unconfigured. Inspect test sessions privately; no pass is claimed.");
  process.exitCode = 1;
});
module.exports = { verify };
