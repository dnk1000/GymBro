const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");
const plain = (value) => JSON.parse(JSON.stringify(value));
function fixture(prepare = (data) => data) {
  const runtime = vm.createContext({ structuredClone, crypto: webcrypto, TextEncoder });
  for (const file of ["seed.js", "workout-data.js", "workout-sessions.js", "guided-workouts.js", "performance-context.js", "workout-actions.js", "exercise-identity.js", "app-version.js"])
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), runtime);
  const call = (name) => vm.runInContext(name, runtime);
  let state = prepare(call("migrateData")(vm.runInContext("seed", runtime))), raw = JSON.stringify(state), sequence = 0, fail = false;
  const actions = call("createWorkoutActions")({ getState: () => state, setState: (next) => { state = next; },
    createId: () => `note-test-${++sequence}`, now: () => "2026-10-27T12:00:00.000Z",
    persist: (next) => { assert.equal(JSON.stringify(state), raw); if (fail) throw Error("quota"); raw = JSON.stringify(next); return { ok: true }; } });
  return { call, actions, state: () => plain(state), raw: () => raw, fail: (value) => { fail = value; } };
}
function start(f) {
  const result = f.actions.startGuidedSession({ date: "2026-10-27", templateId: "push", duration: 60 });
  assert.equal(result.ok, true);
  return result.sessionId;
}
function save(f, scope, target, text, expectedText = "") {
  return f.actions.saveScopedNote({ scope, ...target, text, expectedText });
}

test("schema-7 upgrade retains every historical field and unknown note scope without guesses or mutation", () => {
  const f = fixture(), old = f.state();
  old.version = 7;
  old.noteScopes = { session: "opaque legacy field", exercise: ["not scoped"] };
  old.sets[0].notes = "  exact\nset text 🚀  ";
  old.custom = { notes: "unknown", zero: 0 };
  old.imports.push({ importId: "old", date: "2026-10-27", setCount: 0, notes: "hotel workout?" });
  const before = plain(old), upgraded = plain(f.call("migrateData")(old));
  assert.deepEqual(old, before);
  assert.deepEqual(upgraded.noteScopes, { session: [], exerciseSession: [], exercise: [], legacyValue: before.noteScopes });
  const recovered = { ...upgraded, version: 7, noteScopes: upgraded.noteScopes.legacyValue };
  assert.deepEqual(recovered, before);
  assert.deepEqual(plain(f.call("migrateData")(upgraded)), upgraded, "upgrade retries are idempotent");
  assert(upgraded.sets.every((set) => !set.sessionId), "no inferred sessions");
});

test("four scopes coexist; notes never alter snapshot, membership, order, or guidance", () => {
  const f = fixture(), sessionId = start(f), session = f.state().sessions[0];
  const target = { sessionId, exercise: session.planSnapshot.slots[0].exercise, planSlotId: "slot-1" };
  const initial = f.state();
  assert.equal(save(f, "session", { sessionId }, "  Hotel gym; 35 minutes\n ").ok, true);
  assert.equal(save(f, "exerciseSession", target, "Seat 6 today").ok, true);
  assert.equal(save(f, "exercise", { exercise: target.exercise }, "Usual setup: seat 4").ok, true);
  assert.deepEqual(f.state().sessions, initial.sessions);
  const logged = f.actions.logSet({ date: session.date, exercise: target.exercise, weight: 0, reps: 8, unit: "lb", notes: "  one set only\n", sessionId, planSlotId: "slot-1" });
  assert.equal(logged.ok, true);
  assert.equal(f.state().sets.at(-1).notes, "  one set only\n");
  const context = plain(f.call("exerciseNoteContext")(f.state(), target.exercise));
  assert.equal(context.setup[0].text, "Usual setup: seat 4");
  assert.equal(context.exerciseSession[0].text, "Seat 6 today");
  assert.equal(context.session[0].text, "  Hotel gym; 35 minutes\n ");
  context.setup[0].text = "detached";
  assert.equal(f.state().noteScopes.exercise[0].text, "Usual setup: seat 4");
});

test("same-day sessions, repeated slots, unplanned uses and substitutions retain distinct note targets", () => {
  const f = fixture();
  const plan = f.state().program.templates.find((row) => row.id === "push");
  assert.equal(f.actions.addSlot({ templateId: "push", exercise: plan.slots[0].exercise, role: "accessory" }).ok, true);
  const sessionId = start(f), session = f.state().sessions[0], exercise = session.planSnapshot.slots[0].exercise;
  const repeated = session.planSnapshot.slots.at(-1).id;
  for (const [slot, text] of [["slot-1", "first"], [repeated, "second"], [null, "manual"]])
    assert.equal(save(f, "exerciseSession", { sessionId, exercise, planSlotId: slot }, text).ok, true);
  const guide = f.actions.getGuidedWorkoutState();
  assert.equal(f.actions.substituteGuidedExercise({ sessionId, planSlotId: "slot-1", expectedRevision: guide.revision, exercise: "Bench Press" }).ok, true);
  assert.equal(save(f, "exerciseSession", { sessionId, exercise: "Bench Press", planSlotId: "slot-1" }, "replacement").ok, true);
  assert.equal(f.state().noteScopes.exerciseSession.length, 4);
  assert.equal(f.state().noteScopes.exerciseSession[0].exercise, exercise);
  assert.equal(f.actions.completeSession(sessionId, { expectedRevision: f.actions.getGuidedWorkoutState().revision, allowPending: true }).ok, true);
  const nextId = start(f);
  assert.equal(save(f, "session", { sessionId }, "first workout").ok, true);
  assert.equal(save(f, "session", { sessionId: nextId }, "second workout").ok, true);
  assert.notEqual(nextId, sessionId);
  assert.equal(f.state().noteScopes.session.length, 2);
});

test("failed writes, stale note edits, invalid targets and corrupt/future backups leave committed state intact", () => {
  const f = fixture(), sessionId = start(f), before = f.raw();
  f.fail(true);
  assert.equal(save(f, "session", { sessionId }, "retry me").code, "PERSISTENCE_ERROR");
  assert.equal(f.raw(), before);
  f.fail(false);
  assert.equal(save(f, "session", { sessionId }, "retry me").ok, true);
  const saved = f.raw();
  for (const result of [save(f, "session", { sessionId }, "stale"), save(f, "session", { sessionId: "missing" }, "x"),
    save(f, "exercise", { exercise: "missing" }, "x"), save(f, "exerciseSession", { sessionId, exercise: "Bench Press", planSlotId: "no-slot" }, "x")]) {
    assert.equal(result.ok, false);
    assert.equal(f.raw(), saved);
  }
  for (const mutate of [d => { d.version = 9; }, d => { delete d.noteScopes; }, d => { d.noteScopes.session[0].text = {}; },
    d => { d.noteScopes.session.push(plain(d.noteScopes.session[0])); }, d => { d.noteScopes.session[0].exercise = "Bench Press"; }]) {
    const invalid = f.state(); mutate(invalid); const original = plain(invalid);
    assert.throws(() => f.call("migrateData")(invalid));
    assert.deepEqual(invalid, original);
  }
});

test("complete JSON export/restore and canonical migration preserve exact scoped text and every reference", async () => {
  const f = fixture(), sessionId = start(f), exercise = f.state().sessions[0].planSnapshot.slots[0].exercise;
  for (const [scope, target, text] of [["session", { sessionId }, " hotel\n "] , ["exerciseSession", { sessionId, exercise, planSlotId: "slot-1" }, "  seat 6  "], ["exercise", { exercise }, "usual setup <script>🚀</script>"]])
    assert.equal(save(f, scope, target, text).ok, true);
  const source = f.state();
  source.noteScopes.exercise[0].custom = { provenance: "retained", zero: 0 };
  const backup = plain(f.call("createCompleteBackup")(source));
  assert.deepEqual(plain(f.call("migrateData")(JSON.parse(JSON.stringify(backup)))), backup);
  const identity = f.call("ExerciseIdentity"), document = await identity.migrateV2(source);
  assert.deepEqual(plain(identity.restoreV2Source(document)), source);
  assert.equal(document.data.noteScopes.exercise[0].exercise.exerciseId, identity.resolveLabel(document.catalog, exercise));
  assert.equal(document.data.noteScopes.exerciseSession[0].planSlotId, "slot-1");
  assert.equal(document.data.noteScopes.session[0].sessionId, sessionId);
  const renamed = plain(document);
  renamed.catalog = identity.renameExercise(renamed.catalog, identity.resolveLabel(renamed.catalog, exercise), "Renamed setup exercise");
  assert.deepEqual(plain(identity.restoreV2Source(renamed)), source);
  renamed.data.noteScopes.exerciseSession[0].text += "changed";
  assert.throws(() => identity.verifyV2Migration(source, renamed), /mismatch/);
});

test("prior schema-7 identity documents recover exactly, including opaque root fields", async () => {
  const f = fixture(), identity = f.call("ExerciseIdentity"), source = f.state();
  // The former identity boundary has no scoped note references, and remains a
  // valid conversion/verification input after schema 8 is introduced.
  source.version = 7;
  source.noteScopes = { exercise: "unclassified old text" };
  const document = plain(await identity.migrateV2(source));
  assert.equal(document.sourceSchemaVersion, 7);
  const restored = plain(identity.restoreV2Source(document));
  assert.equal(restored.version, 7);
  assert.deepEqual(restored.noteScopes, document.data.noteScopes);
  assert.equal(identity.verifyV2Migration(source, document).ok, true);
  assert.deepEqual(plain(f.call("migrateData")(restored)).noteScopes.legacyValue, restored.noteScopes);
});

test("an explicit setup note supports historical exercises absent from the library without changing old facts", () => {
  const f = fixture((data) => { data.sets[0].exercise = "Historical machine"; return data; });
  const before = f.state();
  f.fail(true);
  assert.equal(save(f, "exercise", { exercise: "Historical machine" }, "Seat 3").ok, false);
  assert.deepEqual(f.state(), before);
  f.fail(false);
  assert.equal(save(f, "exercise", { exercise: "Historical machine" }, "Seat 3").ok, true);
  assert.deepEqual(f.state().sets, before.sets);
  assert.equal(f.state().exerciseLibrary["Historical machine"].primary, "Uncategorized");
});

test("history merge keeps durable settings, adds contextual notes idempotently, and rejects same-target conflicts", () => {
  const f = fixture(), sessionId = start(f), exercise = "Bench Press";
  save(f, "session", { sessionId }, "context");
  save(f, "exerciseSession", { sessionId, exercise, planSlotId: null }, "manual occurrence");
  save(f, "exercise", { exercise }, "backup setup");
  const incoming = f.state(), current = f.call("emptyData")();
  current.noteScopes.exercise.push({ exercise, text: "current setup" });
  const merged = plain(f.call("mergeHistoryData")(current, incoming));
  assert.equal(merged.noteScopes.exercise[0].text, "current setup");
  assert.deepEqual(merged.noteScopes.session, incoming.noteScopes.session);
  assert.deepEqual(merged.noteScopes.exerciseSession, incoming.noteScopes.exerciseSession);
  assert.deepEqual(plain(f.call("mergeHistoryData")(merged, incoming)), merged);
  const conflict = plain(incoming); conflict.noteScopes.session[0].text = "conflict";
  const before = plain(merged);
  assert.throws(() => f.call("mergeHistoryData")(merged, conflict), /Conflicting scoped note/);
  assert.deepEqual(merged, before);
});
