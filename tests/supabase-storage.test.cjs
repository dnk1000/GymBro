const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  createSupabaseStore,
  canonicalWorkoutJSON,
} = require("../supabase-storage.js");
function initial() {
  const c = vm.createContext({ structuredClone });
  for (const f of [
    "seed.js",
    "workout-data.js",
    "workout-sessions.js",
    "guided-workouts.js",
    "performance-context.js",
    "workout-actions.js",
  ])
    vm.runInContext(fs.readFileSync(f, "utf8"), c);
  return { c, state: vm.runInContext("migrateData(seed)", c) };
}
function storage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}
function fixture() {
  const { state } = initial();
  let row = null,
    fail = false,
    wrong = false;
  const calls = [],
    receipts = new Map();
  const transport = {
    read: async () =>
      wrong
        ? {
            state: { ...state, preferences: { unexpected: "yes" } },
            revision: 1,
          }
        : structuredClone(row),
    write: async (user, body) => {
      calls.push({ user, ...structuredClone(body) });
      if (fail) throw Error("network unavailable");
      const sig = canonicalWorkoutJSON(body);
      const prev = receipts.get(body.p_request_id);
      if (prev)
        return prev.sig === sig
          ? { ...prev.result, code: "REPLAY", current_revision: row.revision }
          : { ok: false, code: "REQUEST_CONFLICT" };
      if ((row?.revision || 0) !== body.p_expected_revision)
        return { ok: false, code: "REVISION_CONFLICT" };
      row = {
        state: structuredClone(body.p_state),
        revision: body.p_expected_revision + 1,
      };
      const result = {
        ok: true,
        revision: row.revision,
        current_revision: row.revision,
      };
      receipts.set(body.p_request_id, { sig, result });
      return result;
    },
  };
  const store = createSupabaseStore({
    transport,
    storage: storage(),
    validate: (s) => vm.runInContext("validateData", initial().c)(s),
  });
  return {
    store,
    state,
    calls,
    setFail: (x) => (fail = x),
    setWrong: (x) => (wrong = x),
    row: () => row,
    transport,
  };
}
test("initial import requires explicit initialization and verified readback; later writes use revisions", async () => {
  const f = fixture();
  assert.equal(await f.store.open("user-a"), null);
  assert.equal((await f.store.write(f.state)).ok, false);
  const state = await f.store.initialize(f.state, canonicalWorkoutJSON);
  assert.deepEqual(state, JSON.parse(JSON.stringify(f.state)));
  assert.equal(f.row().revision, 1);
  assert.equal(
    (await f.store.write({ ...state, preferences: { changed: "yes" } })).ok,
    true,
  );
  assert.equal(f.row().revision, 2);
});
test("network failure retains the candidate request ID and does not acknowledge durability", async () => {
  const f = fixture();
  await f.store.open("a");
  await f.store.initialize(f.state, canonicalWorkoutJSON);
  const next = { ...f.state, preferences: { next: "yes" } };
  f.setFail(true);
  assert.equal((await f.store.write(next)).ok, false);
  assert.equal(
    (await f.store.write({ ...next, preferences: { other: "yes" } })).ok,
    false,
  );
  f.setFail(false);
  assert.equal((await f.store.write(next)).ok, true);
  assert.equal(f.calls.at(-1).p_request_id, f.calls.at(-2).p_request_id);
});
test("readback mismatch cannot finish initial import", async () => {
  const f = fixture();
  await f.store.open("a");
  f.setWrong(true);
  await assert.rejects(
    f.store.initialize(f.state, canonicalWorkoutJSON),
    /read-back differs/,
  );
});
test("signout stops writes and does not delete database history", async () => {
  const f = fixture();
  await f.store.open("a");
  await f.store.initialize(f.state, canonicalWorkoutJSON);
  f.store.signOut();
  assert.equal((await f.store.write(f.state)).ok, false);
  assert.equal(f.row().state.sets.length, f.state.sets.length);
});
test("concurrent async mutations are refused until save completes; selectors stay synchronous", async () => {
  const { c, state } = initial();
  let current = state,
    release,
    writes = 0;
  const factory = vm.runInContext("createWorkoutActions", c);
  const actions = factory({
    getState: () => current,
    setState: (s) => (current = s),
    persist: () => {
      writes++;
      return new Promise((r) => (release = r));
    },
    createId: () => "test-id",
  });
  const pending = actions.logSet({
    date: "2026-10-25",
    exercise: "Bench Press",
    weight: 10,
    reps: 2,
  });
  assert.equal(actions.getWorkoutState().then, undefined);
  assert.equal(current.sets.length, 84);
  assert.equal(
    actions.logBodyweight({ date: "2026-10-25", value: 100 }).code,
    "PERSISTENCE_BUSY",
  );
  release({ ok: true });
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(writes, 1);
  result.state.sets.length = 0;
  assert.equal(current.sets.length, 85);
});
test("async persistence failure rolls back state, revisions and guided request identity", async () => {
  const { c, state } = initial();
  let current = state,
    fail = false;
  const actions = vm.runInContext(
    "createWorkoutActions",
    c,
  )({
    getState: () => current,
    setState: (s) => (current = s),
    persist: async () => {
      if (fail) throw Error("write failed");
      return { ok: true };
    },
    createId: () => "request-test",
  });
  await actions.startGuidedSession({
    date: "2026-10-25",
    templateId: "push",
    duration: 30,
  });
  const g = actions.getGuidedWorkoutState();
  const input = {
    sessionId: g.sessionId,
    planSlotId: g.currentSlotId,
    expectedRevision: g.revision,
    requestId: "stable-request",
    weight: 1,
    reps: 2,
  };
  const before = JSON.stringify(current);
  fail = true;
  assert.equal((await actions.logGuidedSet(input)).code, "PERSISTENCE_ERROR");
  assert.equal(JSON.stringify(current), before);
  fail = false;
  assert.equal((await actions.logGuidedSet(input)).ok, true);
  assert.equal(actions.logGuidedSet(input).code, "REPLAY");
});
test("superseded account reads cannot enable stale writes or reopen a signed-out store", async () => {
  const { state } = initial();
  const reads = [];
  const store = createSupabaseStore({
    transport: {
      read: () => new Promise((resolve) => reads.push(resolve)),
      write: () => {
        throw Error("unexpected write");
      },
    },
    storage: storage(),
    validate: () => {},
  });
  const first = store.open("a");
  const second = store.open("a");
  assert.equal((await store.write(state)).ok, false);
  reads[1]({ state, revision: 2 });
  await second;
  reads[0]({ state, revision: 1 });
  await assert.rejects(first, /superseded/);
  const third = store.open("a");
  store.signOut();
  reads[2]({ state, revision: 2 });
  await assert.rejects(third, /Account changed/);
  assert.equal(store.ready, false);
});
