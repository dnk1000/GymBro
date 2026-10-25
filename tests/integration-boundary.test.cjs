const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { domain } = require("../server/domain.cjs");
const { validateClaims, authenticator } = require("../server/auth.cjs");
const {
  permission,
  READ,
  WORKOUT,
  HISTORY,
  OWNER,
} = require("../contracts/permissions.cjs");
const { createConnectionController } = require("../connection-core.js");
const { digest } = require("../server/integrity.cjs");
const initial = () => {
  const state = domain().emptyData();
  state.preferences = {};
  return state;
};
test("async persistence waits, blocks competing writes, keeps synchronous selectors and detached state", async () => {
  const d = domain();
  let state = initial(),
    release;
  const old = JSON.stringify(state);
  let committed = 0;
  const actions = d.createWorkoutActions({
    getState: () => state,
    setState: (next) => {
      state = next;
      committed++;
    },
    persist: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    createId: randomUUID,
  });
  const pending = actions.logSet({
    date: "2026-10-25",
    exercise: "Bench Press",
    weight: 1,
    reps: 2,
  });
  assert.equal(committed, 0);
  assert.equal(JSON.stringify(state), old);
  assert.equal(
    actions.logBodyweight({ date: "2026-10-25", value: 100 }).code,
    "PERSISTENCE_BUSY",
  );
  assert.equal(actions.getWorkoutState().then, undefined);
  release({ ok: true });
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(committed, 1);
  result.state.sets[0].weight = 999;
  assert.equal(state.sets[0].weight, 1);
});
test("rejected async saves roll back and do not consume guided request IDs", async () => {
  const d = domain();
  let state = initial();
  let fail = false;
  const actions = d.createWorkoutActions({
    getState: () => state,
    setState: (next) => (state = next),
    persist: async () => {
      if (fail) throw Error("database unavailable");
      return { ok: true };
    },
    createId: randomUUID,
  });
  await actions.startGuidedSession({
    date: "2026-10-25",
    templateId: state.program.templates[0].id,
    duration: 30,
  });
  const g = actions.getGuidedWorkoutState();
  const input = {
    sessionId: g.sessionId,
    planSlotId: g.currentSlotId,
    expectedRevision: g.revision,
    requestId: "logical-set",
    weight: 10,
    reps: 2,
  };
  fail = true;
  const before = JSON.stringify(state);
  assert.equal((await actions.logGuidedSet(input)).code, "PERSISTENCE_ERROR");
  assert.equal(JSON.stringify(state), before);
  fail = false;
  assert.equal((await actions.logGuidedSet(input)).ok, true);
  assert.equal(actions.logGuidedSet(input).code, "REPLAY");
  const unchanged = actions.selectGuidedSlot({
    sessionId: g.sessionId,
    planSlotId: g.currentSlotId,
    expectedRevision: state.sessions[0].guided.revision,
  });
  assert.equal(unchanged.code, "NO_CHANGE");
});
test("issuer audience expiry user and client binding reject invalid verified claims", async () => {
  const url = "https://synthetic.supabase.co";
  const user = { id: randomUUID(), email: "synthetic@example.test" };
  const c = {
    sub: user.id,
    session_id: randomUUID(),
    iss: url + "/auth/v1",
    aud: "authenticated",
    role: "authenticated",
    iat: 100,
    exp: 200,
  };
  assert.equal(validateClaims(c, user, url, 150).clientId, null);
  assert.ok(
    validateClaims({ ...c, client_id: randomUUID() }, user, url, 150).clientId,
  );
  for (const patch of [
    { iss: "https://wrong/auth/v1" },
    { aud: "other" },
    { exp: 149 },
    { iat: 300 },
    { sub: randomUUID() },
    { session_id: null },
    { role: "service_role" },
    { client_id: "" },
    { client_id: null },
  ])
    assert.throws(() => validateClaims({ ...c, ...patch }, user, url, 150));
  await assert.rejects(
    authenticator({ url, key: "synthetic-public-key" })("not-a-jwt"),
    /Invalid|expired/,
  );
});
test("all trainer action permissions default deny; history never implies account administration", () => {
  const auth = { clientId: randomUUID(), issuedAt: 100 };
  for (const scope of ["training:read", "workout:write", "history:modify"]) {
    const grant = { not_before: 10, scopes: [scope], revoked_at: null };
    for (const [actions, required] of [
      [READ, "training:read"],
      [WORKOUT, "workout:write"],
      [HISTORY, "history:modify"],
    ])
      for (const action of actions) {
        if (scope === required)
          assert.doesNotThrow(() => permission(auth, action, grant));
        else assert.throws(() => permission(auth, action, grant));
      }
    for (const action of [
      ...OWNER,
      "restore",
      "reset",
      "consent",
      "__proto__",
      "constructor",
    ])
      assert.throws(() => permission(auth, action, grant));
  }
  assert.throws(() =>
    permission(auth, "getWorkoutState", {
      not_before: 101,
      scopes: ["training:read"],
    }),
  );
  assert.throws(() =>
    permission(auth, "getWorkoutState", {
      not_before: 1,
      scopes: ["training:read"],
      revoked_at: "today",
    }),
  );
});
function controller(request, options = {}) {
  let state = initial();
  const original = JSON.stringify(state),
    values = new Map();
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => {
      if (options.quota) throw Error("quota");
      values.set(k, v);
    },
    removeItem: (k) => values.delete(k),
  };
  const c = createConnectionController({
    storage,
    getState: () => state,
    setState: (s) => (state = s),
    validate: domain().validateData,
    request,
    localLoad: () => JSON.parse(original),
  });
  c.auth({
    access_token: "synthetic",
    user: { id: "user-a", email: "test@example.test" },
  });
  return { c, values, storage, state: () => state, original };
}
function importAPI({ readbackFailure = false, mismatch = false } = {}) {
  let state = null,
    revision = 0;
  return async (body) => {
    if (body.op === "import-preview")
      return {
        previewId: "preview",
        state: body.state,
        digest: digest(body.state),
        revision,
        summary: {
          sets: 0,
          sessions: 0,
          bodyweights: 0,
          imports: 0,
          schema: 7,
        },
      };
    if (body.op === "import-commit") {
      state = initial();
      revision = 1;
      return { ok: true };
    }
    if (body.op === "state") {
      if (readbackFailure) throw Error("read-back unavailable");
      if (mismatch) state.preferences.x = "unexpected";
      return { state, revision, digest: state ? digest(state) : null };
    }
    throw Error("unexpected request");
  };
}
test("migration switches authority only after verified readback; signout retains dataset", async () => {
  const { c, state, original, values } = controller(importAPI());
  await c.importPreview();
  assert.equal(c.isLocal(), true);
  await c.importCommit(async (x) => digest(x));
  assert.equal(c.isLocal(), false);
  assert.equal(c.status, "connected/server-authoritative");
  assert.equal(JSON.stringify(state()), original);
  const before = JSON.stringify(state());
  c.auth(null);
  assert.equal(c.isLocal(), false);
  assert.match(c.status, /cached/);
  assert.equal(JSON.stringify(state()), before);
  assert.equal((await c.mutate({ op: "reset" })).ok, false);
  c.useLocal();
  assert.equal(c.isLocal(), true);
  assert.equal(JSON.stringify(state()), original);
  assert.equal(values.size, 0);
});
test("read-back failure, integrity mismatch or final cache failure retains original local authority", async () => {
  for (const config of [{ readbackFailure: true }, { mismatch: true }, {}]) {
    const options = {};
    const { c, state, original } = controller(importAPI(config), options);
    await c.importPreview();
    if (!Object.keys(config).length) options.quota = true;
    await assert.rejects(c.importCommit(async (x) => digest(x)));
    assert.equal(c.isLocal(), true);
    assert.equal(JSON.stringify(state()), original);
  }
});
test("changed local state or user blocks migration; normal login never uploads", async () => {
  let calls = 0;
  const api = importAPI();
  const { c, state } = controller(async (b) => {
    calls++;
    return api(b);
  });
  assert.equal(calls, 0);
  await c.importPreview();
  state().preferences.changed = "yes";
  await assert.rejects(
    c.importCommit(async (x) => digest(x)),
    /changed/,
  );
  assert.equal(calls, 1);
});
test("network failure preserves input state and retries use the same receipt identity", async () => {
  let bodies = [],
    failed = true;
  const data = initial();
  data.preferences.server = "yes";
  const { c, state } = controller(async (b) => {
    if (b.op === "state") return { state: data, revision: 1 };
    bodies.push(b);
    if (failed) throw Error("offline");
    return { ok: true, state: data, revision: 2 };
  });
  await c.useServer();
  const before = JSON.stringify(state());
  assert.equal(
    (await c.mutate({ op: "action", action: "logSet", args: [{}] })).ok,
    false,
  );
  assert.equal(JSON.stringify(state()), before);
  assert.match(c.status, /cached/);
  assert.equal((await c.mutate({ op: "reset" })).ok, false);
  assert.equal(bodies.length, 1);
  failed = false;
  assert.equal(
    (await c.mutate({ op: "action", action: "logSet", args: [{}] })).ok,
    true,
  );
  assert.equal(bodies[0].requestId, bodies[1].requestId);
});
test("unauthenticated HTTP mutation is denied before runtime configuration", async () => {
  const handler = require("../api/gymbro.js");
  let status, body;
  const res = {
    setHeader() {},
    status(s) {
      status = s;
      return this;
    },
    json(b) {
      body = b;
      return this;
    },
  };
  await handler(
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: { op: "reset" },
    },
    res,
  );
  assert.equal(status, 401);
  assert.equal(body.code, "UNAUTHENTICATED");
});

test("staging configuration cannot accidentally activate an existing V2 project or expose a secret key", () => {
  const { stagingConfig } = require("../server/config.cjs");
  const env = {
    GYMBRO_DEPLOY_TARGET: "v3-staging",
    GYMBRO_SUPABASE_PROJECT_REF: "synthetic",
    SUPABASE_URL: "https://synthetic.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    DATABASE_URL: "postgresql://gymbro@db.synthetic.supabase.co:5432/postgres",
    GYMBRO_ORIGIN: "https://gymbro-staging.example.test",
  };
  assert.equal(stagingConfig(env).url, env.SUPABASE_URL);
  for (const patch of [
    { GYMBRO_DEPLOY_TARGET: "" },
    { SUPABASE_URL: "https://different.supabase.co" },
    { DATABASE_URL: "postgresql://gymbro@db.production.supabase.co/postgres" },
    { SUPABASE_PUBLISHABLE_KEY: "sb_secret_test" },
  ])
    assert.throws(() => stagingConfig({ ...env, ...patch }));
});

test("a session change during server selection cannot relabel another user’s data", async () => {
  let resolve;
  const { c, state, original } = controller(
    () => new Promise((r) => (resolve = r)),
  );
  const selecting = c.useServer();
  c.auth({ access_token: "another", user: { id: "user-b" } });
  resolve({ state: initial(), revision: 1 });
  await assert.rejects(selecting, /Authentication changed/);
  assert.equal(c.isLocal(), true);
  assert.equal(JSON.stringify(state()), original);
});
