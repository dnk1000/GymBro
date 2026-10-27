// Real PostgreSQL test in a newly created disposable database. Not a live Supabase Auth test.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const raw = process.env.GYMBRO_TEST_DATABASE_URL;
if (!raw)
  throw Error(
    "Set GYMBRO_TEST_DATABASE_URL to an isolated loopback PostgreSQL admin connection.",
  );
const url = new URL(raw);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw Error("This fixture suite accepts only an isolated loopback database.");
const database = "gymbro_storage_" + randomUUID().replaceAll("-", "");
const a = randomUUID(),
  b = randomUUID();
let admin, pool, state;
before(async () => {
  admin = new Pool({ connectionString: raw });
  await admin.query("CREATE DATABASE " + database);
  url.pathname = "/" + database;
  pool = new Pool({ connectionString: url.toString(), max: 4 });
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; GRANT USAGE ON SCHEMA auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;",
  );
  await pool.query("INSERT INTO auth.users VALUES($1),($2)", [a, b]);
  const sql = fs.readFileSync("supabase/001_workout_storage.sql", "utf8");
  await pool.query(sql);
  await pool.query(sql);
  const context = vm.createContext({ structuredClone });
  for (const file of [
    "seed.js",
    "workout-data.js",
    "workout-sessions.js",
    "guided-workouts.js",
    "performance-context.js",
    "workout-actions.js",
  ])
    vm.runInContext(fs.readFileSync(file, "utf8"), context);
  state = vm.runInContext("migrateData(seed)", context);
  state.preferences.synthetic = "retained";
});
after(async () => {
  await pool?.end();
  if (admin) {
    await admin.query("DROP DATABASE IF EXISTS " + database);
    await admin.end();
  }
});
async function asUser(id, fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE authenticated");
    await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      id || "",
    ]);
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function save(id, revision, data = state, requestId = randomUUID()) {
  return asUser(
    id,
    async (c) =>
      (
        await c.query("SELECT public.gymbro_save($1,$2,$3) AS result", [
          data,
          revision,
          requestId,
        ])
      ).rows[0].result,
  );
}
test("repeatable migration installs RLS and leaves anonymous callers denied", async () => {
  await assert.rejects(
    asUser(null, (c) =>
      c.query("SELECT public.gymbro_save($1,0,$2)", [state, randomUUID()]),
    ),
    /Sign in required/,
  );
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE anon");
    await assert.rejects(
      c.query("SELECT * FROM public.gymbro_workout_state"),
      /permission denied/,
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("explicit initial saves create separate user records; revision-zero cannot overwrite existing state", async () => {
  assert.equal((await save(a, 0)).ok, true);
  assert.equal((await save(b, 0)).ok, true);
  assert.equal((await save(a, 0)).code, "REVISION_CONFLICT");
});
test("authenticated user A cannot select B or directly mutate the state table", async () => {
  await asUser(a, async (c) => {
    assert.equal(
      (
        await c.query(
          "SELECT * FROM public.gymbro_workout_state WHERE user_id=$1",
          [b],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (await c.query("SELECT * FROM public.gymbro_workout_state")).rowCount,
      1,
    );
  });
  await assert.rejects(
    asUser(a, (c) =>
      c.query("UPDATE public.gymbro_workout_state SET state=$1", [state]),
    ),
    /permission denied/,
  );
});
test("simultaneous writes with one revision commit once and reject stale clients", async () => {
  const results = await Promise.all([save(a, 1), save(a, 1)]);
  assert.equal(results.filter((x) => x.ok).length, 1);
  assert.equal(results.filter((x) => x.code === "REVISION_CONFLICT").length, 1);
});
test("same request replays its original revision; changed payload with that ID conflicts", async () => {
  const id = randomUUID();
  const first = await save(a, 2, state, id);
  assert.equal(first.ok, true);
  const again = await save(a, 2, state, id);
  assert.equal(again.code, "REPLAY");
  assert.equal(again.revision, first.revision);
  assert.equal(
    (await save(a, 2, { ...state, preferences: { changed: "yes" } }, id)).code,
    "REQUEST_CONFLICT",
  );
});
test("schema-7 JSONB preserves all IDs, ordering, guidance/tombstones, explicit incomplete and unknown metadata", async () => {
  const c = vm.createContext({ structuredClone });
  for (const file of [
    "seed.js",
    "workout-data.js",
    "workout-sessions.js",
    "guided-workouts.js",
    "performance-context.js",
    "workout-actions.js",
  ])
    vm.runInContext(fs.readFileSync(file, "utf8"), c);
  let current = structuredClone(state);
  let n = 0;
  const actions = vm.runInContext(
    "createWorkoutActions",
    c,
  )({
    getState: () => current,
    setState: (s) => (current = s),
    persist: () => ({ ok: true }),
    createId: () => String(++n),
  });
  actions.startGuidedSession({
    date: "2026-10-25",
    templateId: "push",
    duration: 30,
  });
  let g = actions.getGuidedWorkoutState();
  const logged = actions.logGuidedSet({
    sessionId: g.sessionId,
    planSlotId: g.currentSlotId,
    expectedRevision: g.revision,
    requestId: "original-logical-request",
    weight: 10,
    reps: 5,
    complete: false,
    notes: "preserve",
    pain: 2,
  });
  actions.deleteSet(logged.setId);
  current.customMetadata = { original: ["one", "two"] };
  assert.equal((await save(a, 3, current)).ok, true);
  const row = await asUser(
    a,
    async (q) =>
      (await q.query("SELECT state FROM public.gymbro_workout_state")).rows[0]
        .state,
  );
  assert.deepEqual(row, JSON.parse(JSON.stringify(current)));
  assert.equal(row.sessions[0].guided.requests[0].setId, logged.setId);
});
test("invalid schema/shape is rejected without changing the committed revision", async () => {
  await assert.rejects(save(a, 4, { ...state, version: 8 }), /Invalid schema/);
  await assert.rejects(save(a, 4, { version: 7, sets: [] }), /Invalid schema/);
  assert.equal(
    (
      await asUser(a, (c) =>
        c.query("SELECT revision FROM public.gymbro_workout_state"),
      )
    ).rows[0].revision,
    "4",
  );
});
test("transport receipts are private and user B cannot replay user A requests", async () => {
  await assert.rejects(
    asUser(a, (c) => c.query("SELECT * FROM gymbro_private.save_receipts")),
    /permission denied/,
  );
  const id = randomUUID();
  assert.equal((await save(a, 4, state, id)).ok, true);
  assert.equal((await save(b, 1, state, id)).code, "OK");
});
test("a replay after a later save reports that the account advanced without replacing newer data", async () => {
  const id = randomUUID();
  await save(a, 5, state, id);
  const changed = { ...state, preferences: { latest: "do not overwrite" } };
  await save(a, 6, changed);
  const replay = await save(a, 5, state, id);
  assert.equal(replay.code, "REPLAY");
  assert.equal(replay.revision, 6);
  assert.equal(replay.current_revision, 7);
  const row = await asUser(a, (c) =>
    c.query("SELECT state FROM public.gymbro_workout_state"),
  );
  assert.equal(row.rows[0].state.preferences.latest, "do not overwrite");
});
