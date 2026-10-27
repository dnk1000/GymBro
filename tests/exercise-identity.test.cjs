const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
function runtime() {
  const context = vm.createContext({ structuredClone, crypto: webcrypto, TextEncoder });
  for (const file of ["seed.js", "workout-data.js", "workout-sessions.js", "guided-workouts.js", "performance-context.js", "exercise-identity.js"])
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  return {
    identity: vm.runInContext("ExerciseIdentity", context),
    normalize: vm.runInContext("migrateData", context),
    seed: () => vm.runInContext("migrateData(seed)", context),
  };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
function fixture() {
  const r = runtime();
  const data = r.normalize(JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/session-v6.json"))));
  const meta = data.exerciseLibrary["Bench Press"];
  data.exerciseLibrary["Rope Triceps Pressdown"] = structuredClone(meta);
  data.exerciseLibrary["Rope Triceps Pushdown"] = { ...structuredClone(meta), status: "accessory", unknown: { value: 0 } };
  const session = data.sessions[0];
  session.planSnapshot.slots.push({ id: "slot-2", exercise: "Rope Triceps Pressdown", role: "accessory" });
  session.guided = { revision: 9, currentSlotId: "slot-2", slots: [
    { planSlotId: "slot-1", actualExercise: "Bench Press", status: "completed" },
    { planSlotId: "slot-2", actualExercise: "Rope Triceps Pushdown", status: "pending" },
  ], requests: [{ id: "deleted-request", setId: "deleted-set", signature: '{"exercise":"original request label"}' }] };
  data.sets = [
    { id: "a", date: "2026-10-22", exercise: "Rope Triceps Pressdown", weight: 40, unit: "lb", reps: 10, rpe: 7, rir: 0, pain: 0, painArea: "", notes: "  exact note  ", source: "manual", complete: true },
    { id: "b", date: session.date, exercise: "Rope Triceps Pushdown", weight: 50, unit: "lb", reps: 8, rpe: null, rir: 2, pain: 1, painArea: "original text", notes: "substituted", source: "imported", complete: true, sessionId: session.id, planSlotId: "slot-2", importBatch: "batch" },
    { id: "c", date: "2026-10-21", exercise: "Rope Triceps Pushdown", weight: 0, unit: "assist lb", reps: null, rpe: null, rir: 0, pain: 0, painArea: "", notes: "uncertain", source: "legacy", complete: false, unknown: { references: { setId: "untrusted" }, record: { keep: true } } },
  ];
  session.setIds = ["b"];
  data.bodyweights.push({ date: "2026-10-23", value: 210, note: "original" });
  data.preferences = { "Rope Triceps Pressdown": "set up A", "Rope Triceps Pushdown": "set up B", other: "not exercise metadata" };
  data.imports = [{ importId: "import-a", date: "2026-10-23", setCount: 1, batch: "batch", notes: "do not reclassify", custom: [0, false] }];
  data.unknown = { zero: 0, absent: null, text: "retain" };
  return { ...r, data };
}
const id = "55555555-5555-4555-8555-555555555555";
function explicitCatalog(identity) {
  return identity.createExercise({ exercises: [], aliases: [] }, { id, displayName: "Rope Triceps Pressdown", provenance: "user-created" });
}

test("schema-7 conversion preserves every fact/relationship, snapshot, request tombstone and unknown field", async () => {
  const { identity, data } = fixture(), before = structuredClone(data);
  const result = await identity.migrateV2(data);
  assert.deepEqual(data, before, "source is immutable");
  assert.deepEqual(plain(identity.restoreV2Source(result)), plain(data));
  assert.equal(result.identityVersion, 1);
  assert.equal(result.sourceSchemaVersion, 7);
  assert.equal(Object.hasOwn(result.data, "exerciseLibrary"), false);
  assert.equal(Object.hasOwn(result.data, "version"), false);
  assert.deepEqual(plain(result.data.sessions[0].guided.requests), plain(data.sessions[0].guided.requests));
  assert.deepEqual(plain(result.data.sessions[0].setIds), ["b"]);
  assert.equal(result.data.sets[0].sessionId, undefined, "sessionless remains sessionless");
  assert.equal(result.data.sets[2].complete, false);
  assert.equal(result.data.program.templates[0].slots[0].role, "core");
  assert.equal(result.catalog.exercises.some((row) => Object.hasOwn(row, "role")), false);
  assert.equal(result.catalog.exercises.find((row) => row.displayName.endsWith("Pushdown")).metadata.status, "accessory");
  assert.equal(identity.verifyV2Migration(data, result).ok, true);
});

test("exact labels remain distinct without explicit mappings; normalization and fuzzy guesses are absent", async () => {
  const { identity, data } = fixture();
  const result = await identity.migrateV2(data);
  const a = identity.resolveLabel(result.catalog, "Rope Triceps Pressdown");
  const b = identity.resolveLabel(result.catalog, "Rope Triceps Pushdown");
  assert.notEqual(a, b);
  assert.equal(identity.resolveLabel(result.catalog, "rope triceps pressdown"), null);
  assert.equal(identity.resolveLabel(result.catalog, " Rope Triceps Pressdown"), null);
  assert.equal(result.data.sets[0].exercise.exerciseId, a);
  assert.equal(result.data.sets[1].exercise.exerciseId, b);
});

test("explicit aliases aggregate performance by ID and rename retains history and all original labels", async () => {
  const { identity, data } = fixture();
  let catalog = explicitCatalog(identity);
  const before = structuredClone(catalog);
  catalog = identity.addAlias(catalog, { label: "Rope Triceps Pushdown", exerciseId: id, provenance: "user-created" });
  assert.deepEqual(catalog.exercises, before.exercises);
  const result = await identity.migrateV2(data, { catalog });
  const input = { exerciseId: id, asOfDate: "2026-10-24", limit: 10 };
  const evidence = identity.performanceContext(result, input);
  assert.equal(evidence.totalOccurrenceCount, 3);
  assert.deepEqual(plain(evidence.evidenceReview.perUnit.find((row) => row.unit === "lb").supportingRecordIds), ["b", "a"]);
  assert.equal(evidence.evidenceReview.perUnit.find((row) => row.unit === "assist lb").comparableOccurrenceCount, 0);
  assert.equal(evidence.recentOccurrences[0].records[0].actualExercise.originalLabel, "Rope Triceps Pushdown");
  assert.equal(evidence.recentOccurrences[0].records[0].substitution.occurred, false, "explicitly equivalent labels share identity");
  assert.equal(evidence.sourcePreferences.length, 2, "notes remain scoped to their original labels");
  const oldData = structuredClone(result.data);
  result.catalog = identity.renameExercise(result.catalog, id, "Cable Rope Extension");
  assert.deepEqual(plain(result.data), plain(oldData));
  assert.equal(identity.resolveLabel(result.catalog, "Rope Triceps Pressdown"), id);
  assert.equal(identity.resolveLabel(result.catalog, "Cable Rope Extension"), id);
  const renamed = identity.performanceContext(result, input);
  assert.equal(renamed.exercise.exerciseId, id);
  assert.equal(renamed.exercise.displayName, "Cable Rope Extension");
  assert.deepEqual(plain(renamed.recentOccurrences), plain(evidence.recentOccurrences));
  assert.deepEqual(plain(identity.restoreV2Source(result)), plain(data));
  assert.throws(() => identity.performanceContext(result, { exercise: "Cable Rope Extension", asOfDate: input.asOfDate }), /exerciseId/);
});

test("repeat conversion and retry with persisted/renamed catalog are deterministic and duplicate-free", async () => {
  const { identity, data } = fixture();
  const first = await identity.migrateV2(data);
  assert.deepEqual(plain(await identity.migrateV2(data)), plain(first));
  assert.deepEqual(plain(await identity.migrateV2(data, { catalog: first.catalog })), plain(first));
  const exerciseId = first.data.sets[0].exercise.exerciseId;
  const catalog = identity.renameExercise(first.catalog, exerciseId, "A renamed display name");
  const retry = await identity.migrateV2(data, { catalog });
  assert.deepEqual(plain(retry.data), plain(first.data));
  assert.equal(retry.catalog.exercises.length, first.catalog.exercises.length);
  assert.equal(retry.catalog.exercises.find((row) => row.id === exerciseId).displayName, "A renamed display name");
});

test("explicit mapping cannot silently reassign an existing identity or overwrite a destination catalog", async () => {
  const { identity, data } = fixture();
  const prior = await identity.migrateV2(data);
  const before = structuredClone(prior.catalog);
  const other = prior.data.sets[1].exercise.exerciseId;
  await assert.rejects(identity.migrateV2(data, { catalog: prior.catalog, mappings: [{ label: "Rope Triceps Pressdown", exerciseId: other }] }), /another exercise/);
  assert.deepEqual(plain(prior.catalog), plain(before));
  assert.throws(() => identity.renameExercise(prior.catalog, other, "Rope Triceps Pressdown"), /another exercise/);
  assert.throws(() => identity.addAlias(prior.catalog, { label: "unknown", exerciseId: id, provenance: "user-created" }), /orphaned/);
  assert.throws(() => identity.createExercise(prior.catalog, { id: prior.catalog.exercises[0].id, displayName: "new", provenance: "user-created" }), /duplicate exercise ID/);
});

test("verification rejects content corruption and wrong/dangling relationships even when counts match", async () => {
  const { identity, data } = fixture();
  const result = await identity.migrateV2(data);
  for (const change of [
    (doc) => { doc.data.sets[0].weight++; },
    (doc) => { doc.data.sets[0].notes = "rewritten"; },
    (doc) => { doc.data.sets[2].complete = true; },
    (doc) => { doc.data.sessions[0].setIds = []; },
    (doc) => { doc.data.sets[0].exercise.exerciseId = doc.data.sets[1].exercise.exerciseId; },
    (doc) => { doc.data.sessions[0].guided.requests = []; },
    (doc) => { doc.legacyExerciseLibrary["Bench Press"].secondary = []; },
    (doc) => { doc.data.unknown.zero = 1; },
  ]) {
    const corrupted = structuredClone(result);
    change(corrupted);
    assert.throws(() => identity.verifyV2Migration(data, corrupted));
  }
});

test("archived identity, special labels, deterministic IDs and unsupported input fail safely", async () => {
  const { identity, data } = fixture();
  data.exerciseLibrary["a\ud800"] = structuredClone(data.exerciseLibrary["Bench Press"]);
  data.exerciseLibrary["a\ud801"] = structuredClone(data.exerciseLibrary["Bench Press"]);
  const result = await identity.migrateV2(data);
  assert.notEqual(identity.resolveLabel(result.catalog, "a\ud800"), identity.resolveLabel(result.catalog, "a\ud801"));
  result.catalog.exercises[0].state = "archived";
  assert.equal(identity.verifyV2Migration(data, result).ok, true);
  await assert.rejects(identity.migrateV2({ ...data, version: 99 }), /Unsupported/);
  const unsupported = structuredClone(result);
  unsupported.identityVersion = 99;
  assert.throws(() => identity.restoreV2Source(unsupported), /Unsupported/);
});

test("complete shipped seed and V5/sessionless history survive a lossless identity projection", async () => {
  const { identity, seed, normalize } = runtime();
  const source = seed();
  const document = await identity.migrateV2(source);
  assert.deepEqual(plain(identity.restoreV2Source(document)), plain(source));
  const legacy = normalize({ ...source, version: 5 });
  const old = await identity.migrateV2(legacy);
  assert(old.data.sets.every((row) => !Object.hasOwn(row, "sessionId")));
  assert.deepEqual(plain(identity.restoreV2Source(old)), plain(legacy));
});

test("database projection verifies complete catalog content and owner, independent of row order", async () => {
  const { identity, data } = fixture();
  const document = await identity.migrateV2(data);
  const rows = identity.databaseRows(document, id);
  rows.exercises.reverse();
  rows.aliases.reverse();
  assert.equal(identity.verifyDatabaseCatalog(document, id, rows).ok, true);
  for (const change of [
    (value) => { value.exercises[0].display_name = "tampered"; },
    (value) => { value.exercises[0].metadata.status = "rewritten"; },
    (value) => { value.exercises[0].owner_id = "66666666-6666-4666-8666-666666666666"; },
    (value) => { value.aliases[0].exercise_id = value.aliases[1].exercise_id; },
    (value) => { value.exercises.pop(); },
  ]) {
    const corrupted = structuredClone(rows);
    change(corrupted);
    assert.throws(() => identity.verifyDatabaseCatalog(document, id, corrupted), /mismatch/);
  }
});

test("unreferenced library definitions and explicit mapping decisions participate in verification", async () => {
  const { identity, data } = fixture();
  data.exerciseLibrary["Unused definition"] = structuredClone(data.exerciseLibrary["Bench Press"]);
  const document = await identity.migrateV2(data, { catalog: explicitCatalog(identity),
    mappings: [{ label: "Rope Triceps Pushdown", exerciseId: id }] });
  assert.equal(document.data.sets[1].exercise.exerciseId, id);
  const unusedId = identity.resolveLabel(document.catalog, "Unused definition");
  document.catalog.exercises = document.catalog.exercises.filter((row) => row.id !== unusedId);
  document.catalog.aliases = document.catalog.aliases.filter((row) => row.exerciseId !== unusedId);
  assert.throws(() => identity.verifyV2Migration(data, document), /lost its canonical identity/);
});
