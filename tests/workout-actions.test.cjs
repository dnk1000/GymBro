const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

// A real JS runtime with no window, document, controls, dialogs or event objects.
function fixture(prepare = (state) => state) {
  const runtime = vm.createContext({ structuredClone });
  for (const file of [
    "seed.js",
    "workout-data.js",
    "workout-sessions.js",
    "workout-actions.js",
  ]) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
      runtime,
      { filename: file },
    );
  }
  let state = prepare(vm.runInContext("migrateData(seed)", runtime));
  let durable = JSON.stringify(state),
    writes = 0,
    commits = 0,
    sequence = 0;
  let fail = false,
    throwing = false;
  const factory = vm.runInContext("createWorkoutActions", runtime);
  const actions = factory({
    getState: () => state,
    setState: (next) => {
      commits++;
      state = next;
    },
    createId: () => `test-${++sequence}`,
    now: () => "2026-10-23T12:00:00.000Z",
    persist: (next) => {
      // The committed state must still be old while the candidate is written.
      assert.equal(JSON.stringify(state), durable);
      writes++;
      if (throwing) throw Error("disk failure");
      if (fail) return { ok: false, errors: ["quota exceeded"] };
      durable = JSON.stringify(next);
      return { ok: true };
    },
  });
  return {
    actions,
    runtime,
    state: () => JSON.parse(JSON.stringify(state)),
    durable: () => durable,
    writes: () => writes,
    commits: () => commits,
    failWrites: (throws = false) => {
      fail = true;
      throwing = throws;
    },
    normalize: (payload) =>
      vm.runInContext("normalizeInboxPayload", runtime)(payload),
  };
}
const input = (extra = {}) => ({
  date: "2026-10-23",
  exercise: "Bench Press",
  weight: 100,
  reps: 8,
  ...extra,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("set actions log, edit and delete without DOM; persist before committing", () => {
  const f = fixture();
  const initial = f.state();
  const result = f.actions.logSet(input({ notes: "first" }));
  assert.equal(result.ok, true);
  assert.equal(result.code, "OK");
  assert.equal(result.setId, "test-1");
  assert.equal(result.state.sets.length, initial.sets.length + 1);
  assert.equal(f.writes(), 1);
  assert.equal(f.commits(), 1);
  const edited = f.actions.editSet(result.setId, {
    reps: 12,
    notes: "corrected",
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.state.sets.at(-1).id, result.setId);
  assert.equal(edited.state.sets.at(-1).weight, 100);
  assert.equal(edited.state.sets.at(-1).reps, 12);
  const deleted = f.actions.deleteSet(result.setId);
  assert.equal(deleted.ok, true);
  assert.deepEqual(f.state(), initial);
  assert.equal(f.writes(), 3);
  assert.equal(f.durable(), JSON.stringify(initial));
});

test("state inspection and action results are detached JSON data", () => {
  const f = fixture();
  const before = f.state();
  const snapshot = f.actions.getWorkoutState();
  snapshot.sets[0].notes = "tampered";
  snapshot.program.templates.length = 0;
  assert.deepEqual(f.state(), before);
  const result = f.actions.logSet(input());
  result.state.sets.length = 0;
  result.state.preferences.extra = "tampered";
  assert.equal(f.state().sets.length, before.sets.length + 1);
  assert.equal(f.state().preferences.extra, undefined);
  assert.deepEqual(plain(f.actions.getWorkoutState()), f.state());
  assert.equal(vm.runInContext("typeof document", f.runtime), "undefined");
  assert.equal(vm.runInContext("typeof window", f.runtime), "undefined");
});

test("validation and unknown identifiers fail without writes or partial mutations", () => {
  const f = fixture();
  const initial = f.state();
  for (const call of [
    () => f.actions.logSet(input({ exercise: "New exercise", reps: -1 })),
    () => f.actions.logSet(input({ date: "2026-02-31" })),
    () => f.actions.logSet(null),
    () => f.actions.editSet(initial.sets[0].id, { weight: -1 }),
    () => f.actions.editSet("missing", { reps: 5 }),
    () => f.actions.deleteSet("missing"),
    () => f.actions.selectPlan({ templateId: "missing" }),
    () => f.actions.selectPlan({ templateId: "push", duration: 45 }),
    () => f.actions.selectPlan(null),
    () => f.actions.toggleSlotShort(null),
    () => f.actions.cycleSlotRole(null),
    () => f.actions.removeSlot(null),
    () => f.actions.addSlot(null),
    () =>
      f.actions.addSlot({
        templateId: "push",
        exercise: "New exercise",
        role: "invalid",
      }),
  ]) {
    const result = call();
    assert.equal(result.ok, false);
    assert(result.errors.length > 0);
    assert.deepEqual(plain(result.state), initial);
    assert.equal(result.changes.length, 0);
    assert.deepEqual(f.state(), initial);
  }
  assert.equal(f.writes(), 0);
  assert.equal(f.commits(), 0);
});

test("plans, bodyweights and template edits reuse the same action boundary", () => {
  const f = fixture();
  const original = f.state().program.templates[0];
  assert.equal(
    f.actions.selectPlan({ templateId: "push", duration: 30 }).ok,
    true,
  );
  assert.equal(f.state().program.activeTemplateId, "push");
  assert.equal(f.state().program.activeDuration, 30);
  assert.equal(
    f.actions.selectPlan({ templateId: "pull", duration: 60 }).ok,
    true,
  );
  assert.equal(f.state().program.activeTemplateId, "pull");
  assert.equal(f.state().program.activeDuration, 60);
  assert.equal(f.actions.clearPlan().ok, true);
  assert.equal(f.state().program.activeTemplateId, null);
  assert.equal(
    f.actions.logBodyweight({ date: "2026-10-23", value: 211.2 }).ok,
    true,
  );
  assert.equal(f.state().bodyweights.at(-1).value, 211.2);
  assert.equal(
    f.actions.toggleSlotShort({ templateId: "push", index: 0 }).ok,
    true,
  );
  assert.equal(
    f.state().program.templates[0].slots[0].short,
    !original.slots[0].short,
  );
  assert.equal(
    f.actions.cycleSlotRole({ templateId: "push", index: 0 }).ok,
    true,
  );
  assert.equal(f.state().program.templates[0].slots[0].role, "accessory");
  assert.equal(
    f.actions.addSlot({ templateId: "push", exercise: "New exercise" }).ok,
    true,
  );
  const index = f.state().program.templates[0].slots.length - 1;
  assert.equal(
    f.state().program.templates[0].slots[index].exercise,
    "New exercise",
  );
  assert.equal(f.actions.removeSlot({ templateId: "push", index }).ok, true);
  assert.equal(
    f.state().program.templates[0].slots.length,
    original.slots.length,
  );
});

test("import commit preserves IDs, notes, completeness and duplicate protection", () => {
  const f = fixture();
  const draft = f.normalize({
    date: "2026-10-23",
    importId: "existing-contract",
    notes: "Recovery day",
    bodyweight: 210,
    sets: [
      { exercise: "New exercise", weight: 0, reps: 8, complete: false },
      { exercise: "Bench Press", weight: 100, reps: null },
    ],
  });
  const incoming = plain(draft);
  const result = f.actions.commitImport(draft);
  assert.equal(result.ok, true);
  assert.equal(result.importId, "existing-contract");
  assert.deepEqual(plain(result.setIds), [
    "cg_existing-contract_01",
    "cg_existing-contract_02",
  ]);
  assert.equal(result.state.sets.at(-2).complete, false);
  assert.equal(result.state.sets.at(-1).complete, false);
  assert.equal(result.state.imports.at(-1).notes, "Recovery day");
  assert.equal(result.state.bodyweights.at(-1).value, 210);
  assert.deepEqual(
    plain(draft),
    incoming,
    "action must not mutate the review draft",
  );
  const imported = result.state.sets.at(-2);
  const edited = f.actions.editSet(imported.id, {
    reps: 10,
    id: "replacement",
    source: "manual",
    complete: false,
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.state.sets.at(-2).id, imported.id);
  assert.equal(edited.state.sets.at(-2).source, "chatgpt");
  assert.equal(edited.state.sets.at(-2).importBatch, imported.importBatch);
  assert.equal(f.actions.deleteSet(imported.id).ok, true);
  assert.equal(f.state().imports.at(-1).setCount, 1);
  const writes = f.writes();
  const duplicate = f.actions.commitImport(draft);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "DUPLICATE_IMPORT");
  assert.equal(f.writes(), writes);
});

test("failed persistence rolls back every action, including library and import metadata", () => {
  for (const throwing of [false, true]) {
    const f = fixture();
    const initial = f.state(),
      durable = f.durable();
    f.failWrites(throwing);
    const draft = f.normalize({
      date: "2026-10-23",
      importId: "failed-import",
      bodyweight: 210,
      sets: [{ exercise: "New exercise", weight: 10, reps: 8 }],
    });
    for (const call of [
      () => f.actions.logSet(input({ exercise: "New exercise" })),
      () => f.actions.editSet(initial.sets[0].id, { reps: 99 }),
      () => f.actions.deleteSet(initial.sets[0].id),
      () => f.actions.selectPlan({ templateId: "push", duration: 30 }),
      () => f.actions.clearPlan(),
      () => f.actions.logBodyweight({ date: "2026-10-23", value: 212 }),
      () => f.actions.toggleSlotShort({ templateId: "push", index: 0 }),
      () => f.actions.cycleSlotRole({ templateId: "push", index: 0 }),
      () => f.actions.removeSlot({ templateId: "push", index: 0 }),
      () => f.actions.addSlot({ templateId: "push", exercise: "New exercise" }),
      () => f.actions.commitImport(draft),
    ]) {
      const result = call();
      assert.equal(result.ok, false);
      assert.equal(result.code, "PERSISTENCE_ERROR");
      assert.deepEqual(plain(result.state), initial);
      assert.deepEqual(f.state(), initial);
      assert.equal(f.durable(), durable);
    }
    assert.equal(f.commits(), 0);
  }
});

test("invalid import is atomic and incomplete edits preserve uncertainty by default", () => {
  const f = fixture();
  const initial = f.state();
  const invalid = f.normalize({
    date: "2026-10-23",
    sets: [
      { exercise: "New exercise", weight: 10, reps: 8 },
      { exercise: "Bench Press", weight: 10, reps: -1 },
    ],
  });
  assert.equal(f.actions.commitImport(invalid).ok, false);
  assert.deepEqual(f.state(), initial);
  assert.equal(f.writes(), 0);
  const historical = initial.sets.find(
    (set) => !set.complete && set.weight != null && set.reps != null,
  );
  const edit = f.actions.editSet(historical.id, { notes: "reviewed" });
  assert.equal(edit.ok, true);
  assert.equal(
    edit.state.sets.find((row) => row.id === historical.id).complete,
    false,
  );
  assert.equal(edit.state.version, 6);
  assert.equal(edit.state.sets[0].id, initial.sets[0].id);
});

test("partial edits preserve every omitted field exactly, including imported text and metadata", () => {
  const f = fixture((state) => {
    Object.assign(state.sets[0], {
      exercise: " Bench Press ",
      notes: "  imported note\nwith deliberate whitespace  ",
      painArea: " right shoulder ",
      rpe: 7.5,
      rir: 1,
      pain: 2,
      source: "chatgpt",
      complete: false,
      importBatch: "cg_legacy-record",
      setNumber: 3,
      customMetadata: { attachment: "machine A", tags: ["legacy"] },
    });
    return state;
  });
  const before = f.state().sets[0];
  const result = f.actions.editSet(before.id, { reps: 11 });
  assert.equal(result.ok, true);
  assert.deepEqual(f.state().sets[0], { ...before, reps: 11 });
  assert.deepEqual(JSON.parse(f.durable()).sets[0], { ...before, reps: 11 });
  result.state.sets[0].customMetadata.tags.push("tampered");
  assert.deepEqual(f.state().sets[0].customMetadata, before.customMetadata);
});
