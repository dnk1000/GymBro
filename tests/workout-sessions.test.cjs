const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const plain = (value) => JSON.parse(JSON.stringify(value));
const date = "2026-10-23";
const setInput = (extra) => ({
  date,
  exercise: "Bench Press",
  weight: 100,
  reps: 8,
  ...extra,
});

function fixture() {
  const runtime = vm.createContext({ structuredClone });
  for (const file of [
    "seed.js",
    "workout-data.js",
    "workout-sessions.js",
    "guided-workouts.js",
    "performance-context.js",
    "workout-actions.js",
  ])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      runtime,
      { filename: file },
    );
  const call = (name) => vm.runInContext(name, runtime);
  let state = call("migrateData")(
    vm.runInContext("structuredClone(seed)", runtime),
  );
  let durable = JSON.stringify(state),
    fail = false,
    writes = 0,
    sequence = 0;
  let time = "2026-10-23T12:00:00.000Z";
  const create = () =>
    call("createWorkoutActions")({
      getState: () => state,
      setState: (next) => {
        state = next;
      },
      createId: () => `test-${++sequence}`,
      now: () => time,
      persist: (next) => {
        assert.equal(
          JSON.stringify(state),
          durable,
          "write must precede committed state replacement",
        );
        writes++;
        if (fail) return { ok: false, errors: ["quota"] };
        durable = JSON.stringify(next);
        return { ok: true };
      },
    });
  return {
    actions: create(),
    state: () => plain(state),
    raw: () => durable,
    writes: () => writes,
    failWrites: () => {
      fail = true;
    },
    clock: (value) => {
      time = value;
    },
    reinitialize: () => {
      state = call("migrateData")(JSON.parse(durable));
      return create();
    },
    migrate: (input) => call("migrateData")(input),
    validate: (input) => call("validateData")(input),
    merge: (current, incoming) => call("mergeHistoryData")(current, incoming),
    normalize: (payload) => call("normalizeInboxPayload")(payload),
    legacy: () => ({ ...plain(vm.runInContext("seed", runtime)), version: 5 }),
  };
}

test("v5 migration is deterministic, nonmutating and preserves every historical field and ID", () => {
  const f = fixture(),
    legacy = f.legacy();
  legacy.sets[0].extra = { nested: ["legacy", 0] };
  legacy.sets[0].notes = "  exact note  ";
  legacy.custom = { kept: true };
  const original = plain(legacy),
    migrated = f.migrate(legacy);
  assert.deepEqual(plain(legacy), original);
  assert.equal(migrated.version, 7);
  assert.deepEqual(plain(migrated.sets), original.sets);
  assert.deepEqual(plain(migrated.bodyweights), original.bodyweights);
  assert.deepEqual(plain(migrated.program), original.program);
  assert.deepEqual(plain(migrated.custom), original.custom);
  assert.deepEqual(plain(migrated.sessions), []);
  assert.equal(migrated.activeSessionId, null);
  assert(migrated.sets.every((set) => !Object.hasOwn(set, "sessionId")));
  assert.deepEqual(plain(f.migrate(original)), plain(migrated));
});

test("session lifecycle has stable identity and allows independent same-day workouts", () => {
  const f = fixture(),
    a = f.actions;
  const first = a.createSession({ date, templateId: "push", duration: 30 });
  assert.equal(first.ok, true);
  assert.equal(first.state.version, 7);
  assert.equal(first.sessionId, "ws_test-1");
  const session = plain(a.getActiveSession());
  assert.equal(session.id, first.sessionId);
  assert.equal(session.status, "active");
  assert.equal(session.date, date);
  assert.equal(session.createdAt, "2026-10-23T12:00:00.000Z");
  assert.equal(session.completedAt, null);
  const before = f.raw();
  assert.equal(a.createSession({ date }).code, "INVALID_SESSION_STATE");
  assert.equal(f.raw(), before);
  assert.equal(a.logSet(setInput()).ok, true);
  f.clock("2026-10-23T13:00:00.000Z");
  assert.equal(a.completeSession(first.sessionId).ok, true);
  assert.equal(a.getActiveSession(), null);
  assert.equal(
    a.getSession(first.sessionId).completedAt,
    "2026-10-23T13:00:00.000Z",
  );
  const second = a.createSession({ date, templateId: "pull", duration: 60 });
  assert.equal(second.ok, true);
  assert.notEqual(second.sessionId, first.sessionId);
  const secondSet = a.logSet(setInput({ reps: 10 }));
  assert.equal(secondSet.ok, true);
  assert.equal(secondSet.state.sets.at(-1).sessionId, second.sessionId);
  assert.equal(a.getSession(first.sessionId).setIds.length, 1);
  assert.equal(a.getSession(second.sessionId).setIds.length, 1);
  const restarted = f.reinitialize();
  assert.equal(restarted.getActiveSession().id, second.sessionId);
  assert.equal(restarted.getSession(first.sessionId).status, "completed");
});

test("session selectors are detached and work without DOM or browser globals", () => {
  const f = fixture();
  const result = f.actions.createSession({ date, templateId: "push" });
  const session = f.actions.getSession(result.sessionId);
  session.planSnapshot.slots[0].exercise = "tampered";
  session.setIds.push("bogus");
  const active = f.actions.getActiveSession();
  active.status = "completed";
  assert.equal(
    f.actions.getSession(result.sessionId).planSnapshot.slots[0].exercise,
    "Smith Press",
  );
  assert.equal(f.actions.getActiveSession().status, "active");
  assert.equal(f.actions.getSession("missing"), null);
  assert.equal(f.state().sessions[0].setIds.length, 0);
});

test("set links are explicit, ordered and date-checked; sessionless manual logging still works", () => {
  const f = fixture(),
    a = f.actions;
  const manual = a.logSet(setInput());
  assert.equal(manual.ok, true);
  assert.equal(manual.state.sets.at(-1).sessionId, undefined);
  const created = a.createSession({ date, templateId: "push", duration: 30 });
  const slot = a.getActiveSession().planSnapshot.slots[0];
  const first = a.logSet(
    setInput({ exercise: "Substitute press", planSlotId: slot.id }),
  );
  assert.equal(first.ok, true);
  assert.equal(first.state.sets.at(-1).sessionId, created.sessionId);
  assert.equal(first.state.sets.at(-1).planSlotId, slot.id);
  const second = a.logSet(setInput({ sessionId: created.sessionId }));
  assert.equal(second.ok, true);
  const unlinked = a.logSet(setInput({ sessionId: null }));
  assert.equal(unlinked.ok, true);
  assert.equal(unlinked.state.sets.at(-1).sessionId, undefined);
  assert.deepEqual(plain(a.getActiveSession().setIds), [
    first.setId,
    second.setId,
  ]);
  const attached = a.attachSetToSession({
    setId: manual.setId,
    sessionId: created.sessionId,
  });
  assert.equal(attached.ok, true);
  assert.deepEqual(plain(a.getActiveSession().setIds), [
    first.setId,
    second.setId,
    manual.setId,
  ]);
  const before = f.raw();
  for (const result of [
    a.logSet(setInput({ date: "2026-10-22" })),
    a.logSet(setInput({ planSlotId: "missing" })),
    a.logSet(setInput({ sessionId: "missing" })),
    a.editSet(first.setId, { date: "2026-10-22" }),
  ])
    assert.equal(result.ok, false);
  assert.equal(f.raw(), before);
  assert.equal(a.deleteSet(first.setId).ok, true);
  assert(!a.getActiveSession().setIds.includes(first.setId));
  assert.equal(a.completeSession(created.sessionId).ok, true);
  assert.equal(a.editSet(second.setId, { notes: "correction" }).ok, true);
  assert.equal(a.logSet(setInput({ sessionId: created.sessionId })).ok, false);
  assert.equal(
    a.attachSetToSession({
      setId: unlinked.setId,
      sessionId: created.sessionId,
    }).ok,
    false,
  );
});

test("snapshots preserve original mode-filtered plan after template edits and deletion", () => {
  const f = fixture(),
    a = f.actions;
  assert.equal(a.selectPlan({ templateId: "push", duration: 30 }).ok, true);
  const created = a.createSession({ date });
  const original = plain(a.getActiveSession().planSnapshot);
  assert.equal(original.slots.length, 3);
  assert.deepEqual(
    original.slots.map((s) => s.id),
    ["slot-1", "slot-2", "slot-3"],
  );
  assert.equal(a.toggleSlotShort({ templateId: "push", index: 0 }).ok, true);
  assert.equal(a.removeSlot({ templateId: "push", index: 1 }).ok, true);
  assert.equal(a.cycleSlotRole({ templateId: "push", index: 0 }).ok, true);
  assert.equal(a.selectPlan({ templateId: "pull", duration: 60 }).ok, true);
  assert.deepEqual(
    plain(a.getSession(created.sessionId).planSnapshot),
    original,
  );
  const backup = f.state();
  backup.program.templates = backup.program.templates.filter(
    (t) => t.id !== "push",
  );
  assert.doesNotThrow(() => f.validate(backup));
  assert.equal(backup.sessions[0].templateId, "push");
  assert.equal(a.completeSession(created.sessionId).ok, true);
  const unplanned = a.createSession({ date, templateId: null, duration: 60 });
  assert.equal(unplanned.ok, true);
  assert.equal(a.getActiveSession().planSnapshot, null);
});

test("full backup round trips sessions and active state; old backups restore sessionless", () => {
  const f = fixture();
  f.actions.createSession({ date, templateId: "push" });
  f.actions.logSet(setInput());
  const exported = f.raw(),
    restored = f.migrate(JSON.parse(exported));
  assert.equal(JSON.stringify(restored), exported);
  const second = f.migrate(plain(restored));
  assert.equal(JSON.stringify(second), exported);
  const old = f.legacy(),
    migrated = f.migrate(old);
  assert.deepEqual(plain(migrated.sets), old.sets);
  assert.deepEqual(plain(migrated.sessions), []);
  assert.equal(migrated.activeSessionId, null);
});

test("existing ChatGPT hashes and duplicate protection are unchanged and imports stay sessionless", () => {
  const f = fixture(),
    a = f.actions;
  a.createSession({ date });
  const payload = {
    date,
    sets: [{ exercise: "Bench Press", weight: 100, reps: 8 }],
  };
  const draft = f.normalize(payload);
  assert.equal(draft.importId, "62886416");
  const imported = a.commitImport(draft);
  assert.equal(imported.ok, true);
  assert.equal(imported.state.sets.at(-1).id, "cg_62886416_01");
  assert.equal(imported.state.sets.at(-1).sessionId, undefined);
  assert.deepEqual(plain(a.getActiveSession().setIds), []);
  assert.equal(a.commitImport(draft).code, "DUPLICATE_IMPORT");
});

test("session validation rejects corrupt links, snapshots, pointers and future versions without altering input", () => {
  const f = fixture();
  f.actions.createSession({ date, templateId: "push" });
  f.actions.logSet(setInput());
  const valid = f.state();
  const mutations = [
    (d) => {
      d.activeSessionId = "missing";
    },
    (d) => {
      d.sessions[0].setIds = [];
    },
    (d) => {
      d.sets.at(-1).sessionId = "missing";
    },
    (d) => {
      d.sessions[0].setIds.push(d.sessions[0].setIds[0]);
    },
    (d) => {
      d.sessions[0].createdAt = "invented";
    },
    (d) => {
      d.sessions[0].planSnapshot.slots[1].id =
        d.sessions[0].planSnapshot.slots[0].id;
    },
    (d) => {
      d.sets.at(-1).planSlotId = "missing";
    },
    (d) => {
      delete d.sessions;
    },
    (d) => {
      delete d.activeSessionId;
    },
    (d) => {
      d.version = 8;
    },
  ];
  for (const mutate of mutations) {
    const invalid = plain(valid);
    mutate(invalid);
    const raw = JSON.stringify(invalid);
    assert.throws(() => f.migrate(invalid));
    assert.equal(JSON.stringify(invalid), raw);
  }
  assert.deepEqual(f.state(), valid);
});

test("failed writes cannot commit session creation, completion, links, deletions or migrated history", () => {
  const f = fixture(),
    before = f.state();
  f.failWrites();
  assert.equal(f.actions.createSession({ date }).code, "PERSISTENCE_ERROR");
  assert.deepEqual(f.state(), before);
  const g = fixture();
  const manual = g.actions.logSet(setInput());
  const created = g.actions.createSession({ date, templateId: "push" });
  const linked = g.actions.logSet(setInput());
  const stable = g.state(),
    raw = g.raw();
  g.failWrites();
  for (const operation of [
    () => g.actions.completeSession(created.sessionId),
    () =>
      g.actions.attachSetToSession({
        setId: manual.setId,
        sessionId: created.sessionId,
      }),
    () => g.actions.logSet(setInput()),
    () => g.actions.deleteSet(linked.setId),
  ]) {
    assert.equal(operation().code, "PERSISTENCE_ERROR");
    assert.deepEqual(g.state(), stable);
    assert.equal(g.raw(), raw);
  }
});

test("history merge preserves sessions and settings, is idempotent, and rejects ambiguous relationships", () => {
  const current = fixture(),
    incoming = fixture();
  incoming.actions.createSession({ date, templateId: "push" });
  incoming.actions.logSet(setInput());
  const data = incoming.state(),
    merged = plain(current.merge(current.state(), data));
  assert.deepEqual(merged.sessions, data.sessions);
  assert.equal(merged.activeSessionId, data.activeSessionId);
  assert.deepEqual(plain(current.merge(merged, data)), merged);
  const old = current.migrate(current.legacy());
  assert.deepEqual(plain(current.merge(merged, old)), merged);
  const conflict = plain(data);
  conflict.sessions[0].planSnapshot.name = "different intent";
  assert.throws(() => current.merge(merged, conflict));
  const twoActive = fixture();
  twoActive.actions.logSet(setInput());
  twoActive.actions.createSession({ date });
  assert.throws(() => current.merge(merged, twoActive.state()));
  const duplicateSet = plain(current.state());
  duplicateSet.sets.push({ ...data.sets.at(-1) });
  delete duplicateSet.sets.at(-1).sessionId;
  const original = plain(duplicateSet);
  assert.throws(() => current.merge(duplicateSet, data));
  assert.deepEqual(duplicateSet, original);
});

test("edits cannot reassign or detach relationships; deletes keep completed-session order consistent", () => {
  const f = fixture(),
    a = f.actions;
  const created = a.createSession({ date, templateId: "push" });
  const first = a.logSet(setInput({ planSlotId: "slot-1" })),
    second = a.logSet(setInput());
  const original = f.raw();
  for (const patch of [
    { sessionId: null },
    { sessionId: "different" },
    { planSlotId: "slot-2" },
    { planSlotId: null },
    { date: "2026-10-22" },
  ]) {
    assert.equal(a.editSet(first.setId, patch).ok, false);
    assert.equal(f.raw(), original);
  }
  assert.equal(a.completeSession(created.sessionId).ok, true);
  const completed = plain(a.getSession(created.sessionId));
  assert.equal(
    a.attachSetToSession({ setId: second.setId, sessionId: created.sessionId })
      .code,
    "INVALID_SESSION_STATE",
  );
  assert.equal(
    a.completeSession(created.sessionId).code,
    "INVALID_SESSION_STATE",
  );
  assert.equal(a.deleteSet(first.setId).ok, true);
  assert.deepEqual(plain(a.getSession(created.sessionId).setIds), [
    second.setId,
  ]);
  assert.equal(
    a.getSession(created.sessionId).completedAt,
    completed.completedAt,
  );
  assert.equal(a.getSession(created.sessionId).status, "completed");
});

test("planned slots are never fabricated and must belong to the linked session", () => {
  const f = fixture(),
    a = f.actions;
  const first = a.createSession({ date, templateId: "push" });
  const manual = a.logSet(setInput());
  assert.equal(Object.hasOwn(manual.state.sets.at(-1), "planSlotId"), false);
  a.completeSession(first.sessionId);
  const second = a.createSession({ date, templateId: "legs", duration: 60 });
  const state = f.state();
  const firstSession = state.sessions.find((s) => s.id === first.sessionId);
  firstSession.planSnapshot.slots[0].id = "only-first-session";
  state.sets.find((s) => s.id === manual.setId).planSlotId =
    "only-first-session";
  assert.doesNotThrow(() => f.validate(state));
  state.sets.find((s) => s.id === manual.setId).sessionId = second.sessionId;
  firstSession.setIds = [];
  state.sessions
    .find((s) => s.id === second.sessionId)
    .setIds.push(manual.setId);
  assert.throws(() => f.validate(state));
  const unplanned = fixture();
  unplanned.actions.createSession({ date, templateId: null });
  assert.equal(
    unplanned.actions.logSet(setInput({ planSlotId: "slot-1" })).ok,
    false,
  );
  const valid = unplanned.state();
  valid.sets.push({ ...f.legacy().sets[0], planSlotId: null });
  assert.throws(() => unplanned.validate(valid));
});

test("contradictory ordering or cross-session membership fails instead of repairing history", () => {
  const f = fixture(),
    a = f.actions;
  const first = a.createSession({ date });
  const linked = a.logSet(setInput());
  a.completeSession(first.sessionId);
  const second = a.createSession({ date });
  const valid = f.state();
  for (const mutate of [
    (d) => d.sessions[0].setIds.push("missing-set"),
    (d) => d.sessions[1].setIds.push(linked.setId),
    (d) => {
      d.sessions[0].setIds = [];
    },
    (d) => {
      d.sets.at(-1).sessionId = second.sessionId;
    },
  ]) {
    const broken = plain(valid);
    mutate(broken);
    assert.throws(() => f.validate(broken));
  }
  assert.equal(
    a.attachSetToSession({ setId: linked.setId, sessionId: second.sessionId })
      .ok,
    false,
  );
  assert.deepEqual(f.state(), valid);
});

test("legacy history merge never infers membership in the current active session", () => {
  const f = fixture();
  f.actions.createSession({ date });
  const before = f.state();
  const old = f.legacy();
  old.sets.push({ ...old.sets[0], id: "new-legacy-set", date });
  const merged = plain(f.merge(before, f.migrate(old)));
  const added = merged.sets.find((set) => set.id === "new-legacy-set");
  assert.equal(Object.hasOwn(added, "sessionId"), false);
  assert.deepEqual(merged.sessions, before.sessions);
  assert.equal(merged.activeSessionId, before.activeSessionId);
});
