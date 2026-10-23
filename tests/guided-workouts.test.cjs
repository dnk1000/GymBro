const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const plain = (value) => JSON.parse(JSON.stringify(value));
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
  const get = (name) => vm.runInContext(name, runtime);
  let state = get("migrateData")(plain(get("seed"))),
    raw = JSON.stringify(state),
    fail = false,
    writes = 0,
    commits = 0,
    sequence = 0;
  const wrap = (actions) =>
    Object.fromEntries(
      Object.entries(actions).map(([name, fn]) => [
        name,
        (...args) => plain(fn(...args)),
      ]),
    );
  const initialize = () =>
    wrap(
      get("createWorkoutActions")({
        getState: () => state,
        setState: (next) => {
          commits++;
          state = next;
        },
        createId: () => `guided-${++sequence}`,
        now: () => "2026-10-23T22:00:00.000Z",
        persist: (next) => {
          assert.equal(JSON.stringify(state), raw, "persist before commit");
          writes++;
          if (fail === "throw") throw new Error("quota exception");
          if (fail) return { ok: false, errors: ["quota"] };
          raw = JSON.stringify(next);
          return { ok: true };
        },
      }),
    );
  const a = initialize();
  return {
    a,
    state: () => plain(state),
    raw: () => raw,
    writes: () => writes,
    commits: () => commits,
    fail: (value) => {
      fail = value;
    },
    reload: () => {
      state = get("migrateData")(JSON.parse(raw));
      return initialize();
    },
    migrate: get("migrateData"),
    validate: get("validateData"),
    merge: get("mergeHistoryData"),
    seed: () => plain(get("seed")),
  };
}
const start = (f, duration = 60) =>
  f.a.startGuidedSession({ date: "2026-10-23", templateId: "push", duration });
function command(f, extra = {}) {
  const state = f.a.getGuidedWorkoutState();
  return {
    sessionId: state.sessionId,
    planSlotId: state.currentSlotId,
    expectedRevision: state.revision,
    ...extra,
  };
}
const set = (f, requestId, extra = {}) =>
  command(f, {
    requestId,
    weight: 50,
    unit: "lb/side",
    reps: 8,
    rpe: 7,
    rir: 3,
    pain: 0,
    painArea: "",
    notes: "",
    complete: true,
    ...extra,
  });

test("6→7 migration preserves exact sections and metadata without inventing guidance", () => {
  const f = fixture();
  f.a.createSession({ date: "2026-10-23", templateId: "push" });
  f.a.logSet({
    date: "2026-10-23",
    exercise: "Smith Press",
    weight: 40,
    reps: 8,
    unit: "lb/side",
    planSlotId: "slot-1",
  });
  const legacy = f.state();
  legacy.version = 6;
  legacy.custom = { source: ["old"] };
  legacy.sets[0].importExtra = { exact: true };
  const before = plain(legacy),
    migrated = plain(f.migrate(legacy));
  assert.deepEqual(legacy, before);
  assert.deepEqual(migrated, { ...before, version: 7 });
  assert.ok(
    migrated.sessions.every((session) => !Object.hasOwn(session, "guided")),
  );
  assert.deepEqual(plain(f.migrate(migrated)), migrated);
});

test("guided start is one atomic transaction with exact 60/30 snapshots and no DOM", () => {
  for (const duration of [60, 30]) {
    const f = fixture(),
      result = start(f, duration);
    assert.equal(result.ok, true);
    assert.equal(f.writes(), 1);
    assert.equal(f.commits(), 1);
    const s = f.a.getGuidedWorkoutState(),
      template = f.state().program.templates.find((t) => t.id === "push");
    assert.deepEqual(
      s.session.planSnapshot.slots.map((slot) => slot.exercise),
      template.slots
        .filter((slot) => duration === 60 || slot.short)
        .map((slot) => slot.exercise),
    );
    assert.equal(s.currentExercise.actualExercise, "Smith Press");
    assert.equal(s.previousExercise, null);
    assert.equal(s.nextExercise.actualExercise, "Lateral Raise");
    assert.equal(s.remainingSlots.length, s.slots.length);
    assert.ok(s.slots.every((slot) => slot.status === "pending"));
    s.currentExercise.actualExercise = "tamper";
    s.session.planSnapshot.name = "tamper";
    assert.equal(
      f.a.getGuidedWorkoutState().currentExercise.actualExercise,
      "Smith Press",
    );
    assert.equal(start(f).ok, false);
    assert.equal(f.writes(), 1);
  }
});

test("failed guided initialization cannot leave a partial session or consume active identity", () => {
  const f = fixture(),
    before = f.state(),
    raw = f.raw();
  f.fail(true);
  assert.equal(start(f).code, "PERSISTENCE_ERROR");
  assert.deepEqual(f.state(), before);
  assert.equal(f.raw(), raw);
  assert.equal(f.commits(), 0);
  f.fail(false);
  assert.equal(
    f.a.startGuidedSession({ date: "2026-10-23", templateId: null }).ok,
    false,
  );
  assert.deepEqual(f.state(), before);
  assert.equal(start(f).ok, true);
});

test("navigation never implies completion; duplicate revision commands do not double-advance", () => {
  const f = fixture();
  start(f);
  const input = command(f, { direction: "next" });
  assert.equal(f.a.moveGuidedSlot(input).ok, true);
  const writes = f.writes();
  assert.equal(f.a.moveGuidedSlot(input).code, "STALE_GUIDANCE");
  assert.equal(f.writes(), writes);
  assert.equal(
    f.a.getGuidedWorkoutState().currentExercise.actualExercise,
    "Lateral Raise",
  );
  assert.ok(
    f.a
      .getGuidedWorkoutState()
      .slots.every((slot) => slot.status === "pending"),
  );
  assert.equal(
    f.a.moveGuidedSlot(command(f, { direction: "previous" })).ok,
    true,
  );
  assert.equal(
    f.a.setGuidedSlotStatus(command(f, { status: "completed" })).ok,
    true,
  );
  assert.equal(
    f.a.getGuidedWorkoutState().currentExercise.sets.length,
    0,
    "Done has no minimum-work threshold",
  );
  assert.equal(f.a.moveGuidedSlot(command(f, { direction: "next" })).ok, true);
  assert.equal(
    f.a.setGuidedSlotStatus(command(f, { status: "skipped" })).ok,
    true,
  );
  const selected = f.a.getGuidedWorkoutState();
  assert.equal(selected.slots[0].status, "completed");
  assert.equal(selected.slots[1].status, "skipped");
  assert.equal(
    f.a.selectGuidedSlot(
      command(f, { planSlotId: selected.slots.at(-1).planSlotId }),
    ).ok,
    true,
  );
  assert.equal(f.a.getGuidedWorkoutState().slots.at(-1).status, "pending");
});

test("multiple identical intentional sets are allowed, retries replay, deleted requests stay tombstoned", () => {
  const f = fixture();
  start(f);
  const input = set(f, "submission-a"),
    first = f.a.logGuidedSet(input);
  assert.equal(first.ok, true);
  const raw = f.raw(),
    writes = f.writes();
  assert.equal(f.a.logGuidedSet(input).code, "REPLAY");
  assert.equal(f.raw(), raw);
  assert.equal(f.writes(), writes);
  assert.equal(
    f.a.logGuidedSet({ ...input, reps: 9 }).code,
    "REQUEST_CONFLICT",
  );
  assert.equal(f.writes(), writes);
  assert.equal(f.a.logGuidedSet(set(f, "submission-b")).ok, true);
  assert.equal(f.a.getGuidedWorkoutState().currentExercise.sets.length, 2);
  assert.equal(f.a.getGuidedWorkoutState().currentExercise.status, "pending");
  f.a.deleteSet(first.setId);
  const replay = f.reload().logGuidedSet(input);
  assert.equal(replay.code, "REPLAY");
  assert.equal(replay.deleted, true);
  assert.equal(f.a.getGuidedWorkoutState().currentExercise.sets.length, 1);
});

test("failed guided logs do not remember requests; validation and failed progress writes roll back", () => {
  const f = fixture();
  start(f);
  const input = set(f, "retry-after-failure"),
    before = f.state(),
    raw = f.raw();
  f.fail(true);
  assert.equal(f.a.logGuidedSet(input).code, "PERSISTENCE_ERROR");
  assert.deepEqual(f.state(), before);
  assert.equal(f.raw(), raw);
  assert.equal(
    f.a.moveGuidedSlot(command(f, { direction: "next" })).code,
    "PERSISTENCE_ERROR",
  );
  assert.deepEqual(f.state(), before);
  f.fail(false);
  assert.equal(f.a.logGuidedSet({ ...input, reps: -1 }).ok, false);
  assert.deepEqual(f.state(), before);
  assert.equal(f.a.logGuidedSet(input).ok, true);
  assert.equal(f.a.getGuidedWorkoutState().session.guided.requests.length, 1);
});

test("substitutions preserve planned intent, library identity, permanent templates and all earlier sets", () => {
  const f = fixture();
  start(f);
  const first = f.a.logGuidedSet(set(f, "before-sub"));
  const old = f.state().sets.find((row) => row.id === first.setId),
    plan = f.state().program,
    snapshot = f.a.getActiveSession().planSnapshot;
  assert.equal(
    f.a.substituteGuidedExercise(command(f, { exercise: "Bench Press" })).ok,
    true,
  );
  assert.deepEqual(f.state().program, plan);
  assert.deepEqual(f.a.getActiveSession().planSnapshot, snapshot);
  assert.deepEqual(
    f.state().sets.find((row) => row.id === first.setId),
    old,
  );
  assert.equal(f.a.logGuidedSet(set(f, "after-sub", { unit: "lb" })).ok, true);
  const sets = f.a.getGuidedWorkoutState().currentExercise.sets;
  assert.deepEqual(
    sets.map((row) => row.exercise),
    ["Smith Press", "Bench Press"],
  );
  assert.ok(
    sets.every(
      (row) => row.sessionId === first.sessionId && row.planSlotId === "slot-1",
    ),
  );
  assert.equal(
    f.a.substituteGuidedExercise(command(f, { exercise: "Made-up identity" }))
      .ok,
    false,
  );
});

test("enabling guidance on a schema-6 active session is explicit and never guesses status", () => {
  const f = fixture();
  f.a.createSession({ date: "2026-10-23", templateId: "push" });
  f.a.logSet({
    date: "2026-10-23",
    exercise: "Smith Press",
    weight: 40,
    reps: 8,
    unit: "lb/side",
    planSlotId: "slot-1",
  });
  const old = f.state(),
    active = f.a.getActiveSession();
  assert.equal(f.a.getGuidedWorkoutState(), null);
  assert.equal(f.a.enableGuidance(active.id).ok, true);
  assert.deepEqual(f.state().sets, old.sets);
  assert.deepEqual(f.a.getActiveSession().planSnapshot, active.planSnapshot);
  assert.ok(
    f.a
      .getGuidedWorkoutState()
      .slots.every((slot) => slot.status === "pending"),
  );
  assert.equal(f.a.getGuidedWorkoutState().currentExercise.sets.length, 1);
  const writes = f.writes();
  assert.equal(f.a.enableGuidance(active.id).code, "NO_CHANGE");
  assert.equal(f.writes(), writes);
  const other = fixture();
  other.a.createSession({ date: "2026-10-23", templateId: null });
  const prior = other.state();
  assert.equal(other.a.enableGuidance(prior.activeSessionId).ok, false);
  assert.deepEqual(other.state(), prior);
});

test("persisted position/substitution/status survive reinitialization, template changes, full backup and merge", () => {
  const f = fixture();
  start(f, 30);
  f.a.setGuidedSlotStatus(command(f, { status: "skipped" }));
  f.a.moveGuidedSlot(command(f, { direction: "next" }));
  f.a.substituteGuidedExercise(command(f, { exercise: "Bench Press" }));
  f.a.logGuidedSet(set(f, "resume", { unit: "lb" }));
  const before = plain(f.a.getGuidedWorkoutState());
  assert.deepEqual(plain(f.reload().getGuidedWorkoutState()), before);
  f.a.removeSlot({ templateId: "push", index: 1 });
  assert.deepEqual(
    f.a.getActiveSession().planSnapshot,
    before.session.planSnapshot,
  );
  const backup = f.state();
  assert.deepEqual(
    plain(f.migrate(JSON.parse(JSON.stringify(backup)))),
    backup,
  );
  assert.deepEqual(plain(f.merge(backup, backup)), backup);
});

test("finish permits unfinished slots only after explicit confirmation, retaining pending statuses and atomic rollback", () => {
  const f = fixture();
  start(f);
  f.a.setGuidedSlotStatus(command(f, { status: "completed" }));
  const state = f.state(),
    input = command(f);
  assert.equal(f.a.finishGuidedSession(input).code, "CONFIRM_UNFINISHED");
  assert.deepEqual(f.state(), state);
  assert.equal(f.a.completeSession(input.sessionId).code, "STALE_GUIDANCE");
  f.fail(true);
  assert.equal(
    f.a.finishGuidedSession({ ...input, allowPending: true }).code,
    "PERSISTENCE_ERROR",
  );
  assert.deepEqual(f.state(), state);
  f.fail(false);
  assert.equal(
    f.a.finishGuidedSession({ ...input, allowPending: true }).ok,
    true,
  );
  const done = f.a.getSession(input.sessionId);
  assert.equal(done.status, "completed");
  assert.ok(done.completedAt);
  assert.equal(f.state().activeSessionId, null);
  assert.deepEqual(done.guided.slots, state.sessions[0].guided.slots);
  const writes = f.writes();
  assert.equal(
    f.a.finishGuidedSession({ ...input, allowPending: true }).ok,
    false,
  );
  assert.equal(f.writes(), writes);
});

test("previous performance is factual, exact-exercise and unit separated; manual logging coexists", () => {
  const f = fixture();
  for (const [unit, weight, complete] of [
    ["lb", 90, true],
    ["lb/side", 40, true],
    ["assist lb", 30, true],
    ["bodyweight", 0, true],
    ["lb", 999, false],
  ])
    f.a.logSet({
      date: "2026-10-22",
      exercise: "Bench Press",
      weight,
      unit,
      reps: 8,
      complete,
    });
  start(f);
  f.a.substituteGuidedExercise(command(f, { exercise: "Bench Press" }));
  const before = plain(f.a.getGuidedWorkoutState().previousPerformance);
  assert.deepEqual(
    before.map((row) => row.unit).sort(),
    ["assist lb", "bodyweight", "lb", "lb/side"].sort(),
  );
  assert.ok(
    before.every((group) =>
      group.sets.every(
        (row) =>
          row.exercise === "Bench Press" &&
          row.unit === group.unit &&
          row.weight !== 999,
      ),
    ),
  );
  assert.equal(f.a.logGuidedSet(set(f, "today", { unit: "lb" })).ok, true);
  assert.deepEqual(
    plain(f.a.getGuidedWorkoutState().previousPerformance),
    before,
  );
  assert.equal(
    f.a.logSet({
      date: "2026-10-23",
      exercise: "Bench Press",
      weight: 20,
      reps: 8,
    }).ok,
    true,
  );
  assert.equal(f.state().sets.at(-1).sessionId, f.state().activeSessionId);
  assert.equal(f.state().sets.at(-1).planSlotId, undefined);
  assert.equal(
    f.a.logSet({
      date: "2026-10-22",
      sessionId: null,
      exercise: "Bench Press",
      weight: 25,
      reps: 8,
    }).ok,
    true,
  );
  assert.equal(f.state().sets.at(-1).sessionId, undefined);
});

test("corrupt guided position/requests/identity and future schema are rejected rather than repaired", () => {
  const f = fixture();
  start(f);
  for (const mutate of [
    (d) => {
      d.sessions[0].guided.currentSlotId = "missing";
    },
    (d) => {
      d.sessions[0].guided.slots[0].actualExercise = "missing";
    },
    (d) => {
      d.sessions[0].guided.slots[0].planSlotId = "missing";
    },
    (d) => {
      d.sessions[0].guided.slots[0].status = "inferred";
    },
    (d) => {
      d.sessions[0].guided.requests = null;
    },
    (d) => {
      d.sessions[0].guided.revision = -1;
    },
    (d) => {
      d.version = 8;
    },
  ]) {
    const invalid = f.state();
    mutate(invalid);
    const raw = JSON.stringify(invalid);
    assert.throws(() => f.migrate(invalid));
    assert.equal(JSON.stringify(invalid), raw);
  }
});

test("unserializable guided parameters return validation errors without writes or throws", () => {
  const f = fixture();
  start(f);
  const before = f.state(),
    writes = f.writes();
  const cyclic = {};
  cyclic.self = cyclic;
  for (const notes of [cyclic, 1n]) {
    const result = f.a.logGuidedSet(set(f, "invalid-serialization", { notes }));
    assert.equal(result.code, "VALIDATION_ERROR");
    assert.deepEqual(f.state(), before);
    assert.equal(f.writes(), writes);
  }
});

test("all active guided mutations roll back on rejected/throwing writes and safely reject duplicate revisions", () => {
  const operations = [
    ["selectGuidedSlot", (f) => command(f, { planSlotId: "slot-2" })],
    ["moveGuidedSlot", (f) => command(f, { direction: "next" })],
    ["setGuidedSlotStatus", (f) => command(f, { status: "completed" })],
    ["setGuidedSlotStatus", (f) => command(f, { status: "skipped" })],
    [
      "substituteGuidedExercise",
      (f) => command(f, { exercise: "Bench Press" }),
    ],
    ["logGuidedSet", (f) => set(f, "hardening-retry")],
    ["finishGuidedSession", (f) => command(f, { allowPending: true })],
  ];
  for (const failure of [true, "throw"]) {
    for (const [name, params] of operations) {
      const f = fixture();
      start(f, 30);
      const input = params(f),
        before = f.state(),
        raw = f.raw(),
        commits = f.commits();
      f.fail(failure);
      const rejected = f.a[name](input);
      assert.equal(rejected.ok, false, name);
      assert.equal(rejected.code, "PERSISTENCE_ERROR", name);
      assert.ok(rejected.errors.length);
      assert.deepEqual(f.state(), before, name);
      assert.equal(f.raw(), raw, name);
      assert.equal(f.commits(), commits, name);
      f.fail(false);
      assert.equal(f.a[name](input).ok, true, name);
      const committed = f.state(),
        writes = f.writes();
      const retry = f.a[name](input);
      assert.equal(
        retry.code,
        name === "logGuidedSet"
          ? "REPLAY"
          : name === "finishGuidedSession"
            ? "INVALID_SESSION_STATE"
            : "STALE_GUIDANCE",
        name,
      );
      assert.equal(f.writes(), writes, name);
      assert.deepEqual(f.state(), committed, name);
      assert.deepEqual(f.reload().getWorkoutState(), committed, name);
    }
  }
});

test("completed guided sessions keep completion time and reject every new workout mutation", () => {
  for (const pending of [true, false]) {
    const f = fixture();
    start(f, 30);
    const first = set(f, "before-finish");
    f.a.logGuidedSet(first);
    f.a.logSet({
      date: "2026-10-23",
      exercise: "Bench Press",
      weight: 50,
      reps: 8,
    });
    if (!pending) {
      for (const slot of f.a.getGuidedWorkoutState().slots)
        f.a.setGuidedSlotStatus(
          command(f, {
            planSlotId: slot.planSlotId,
            status: slot.planSlotId === "slot-1" ? "completed" : "skipped",
          }),
        );
    }
    const input = command(f, { allowPending: pending });
    assert.equal(f.a.finishGuidedSession(input).ok, true);
    const done = f.state(),
      raw = f.raw();
    for (const result of [
      f.a.moveGuidedSlot({ ...input, direction: "next" }),
      f.a.selectGuidedSlot({ ...input, planSlotId: "slot-2" }),
      f.a.setGuidedSlotStatus({ ...input, status: "completed" }),
      f.a.substituteGuidedExercise({ ...input, exercise: "Bench Press" }),
      f.a.logGuidedSet({ ...first, requestId: "new-after-completion" }),
      f.a.finishGuidedSession(input),
      f.a.logSet({
        date: "2026-10-23",
        exercise: "Bench Press",
        weight: 50,
        reps: 8,
        sessionId: input.sessionId,
      }),
    ]) {
      assert.equal(result.ok, false);
      assert.equal(result.code, "INVALID_SESSION_STATE");
    }
    assert.equal(f.a.logGuidedSet(first).code, "REPLAY");
    assert.deepEqual(f.state(), done);
    assert.equal(f.raw(), raw);
    assert.equal(done.activeSessionId, null);
    assert.ok(done.sessions[0].completedAt);
    assert.equal(done.sessions[0].setIds.length, 2);
    assert.equal(
      f.reload().getSession(input.sessionId).completedAt,
      done.sessions[0].completedAt,
    );
  }
});

test("explicit Enable guidance remains atomic when storage throws", () => {
  const f = fixture();
  f.a.createSession({ date: "2026-10-23", templateId: "push", duration: 30 });
  const before = f.state(),
    raw = f.raw();
  f.fail("throw");
  const result = f.a.enableGuidance(before.activeSessionId);
  assert.equal(result.code, "PERSISTENCE_ERROR");
  assert.deepEqual(f.state(), before);
  assert.equal(f.raw(), raw);
  assert.equal(f.a.getGuidedWorkoutState(), null);
  f.fail(false);
  assert.equal(f.a.enableGuidance(before.activeSessionId).ok, true);
  assert.deepEqual(
    f.a.getActiveSession().planSnapshot,
    before.sessions[0].planSnapshot,
  );
  assert.deepEqual(f.a.getWorkoutState().sets, before.sets);
});
