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
  const data = get("migrateData")(plain(get("seed")));
  Object.assign(data, {
    sets: [],
    sessions: [],
    activeSessionId: null,
    imports: [],
    bodyweights: [],
    preferences: {
      "Bench Press": "Keep original free-text preference; shoulder history",
    },
  });
  let state = plain(data),
    writes = 0,
    commits = 0,
    sequence = 0;
  const actions = get("createWorkoutActions")({
    getState: () => state,
    setState: (next) => {
      commits++;
      state = next;
    },
    persist: () => {
      writes++;
      return { ok: true };
    },
    createId: () => `evidence-${++sequence}`,
    now: () => "2026-10-23T22:00:00.000Z",
  });
  return {
    a: Object.fromEntries(
      Object.entries(actions).map(([name, fn]) => [
        name,
        (...args) => plain(fn(...args)),
      ]),
    ),
    state: () => plain(state),
    replace: (next) => {
      get("validateData")(next);
      state = plain(next);
    },
    writes: () => writes,
    commits: () => commits,
  };
}
const options = (extra = {}) => ({
  exercise: "Bench Press",
  asOfDate: "2026-10-23",
  ...extra,
});
function logged(f, extra = {}) {
  const result = f.a.logSet({
    date: "2026-10-20",
    exercise: "Bench Press",
    sessionId: null,
    weight: 100,
    unit: "lb",
    reps: 8,
    rpe: 8,
    rir: 2,
    pain: 0,
    painArea: "",
    notes: "",
    complete: true,
    ...extra,
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.setId;
}
function result(value) {
  assert.equal(value.ok, true, JSON.stringify(value.errors));
  return value.result;
}
const compare = (f, baselineSetId, currentSetId) =>
  result(
    f.a.compareExercisePerformance({
      baselineSetId,
      currentSetId,
      asOfDate: "2026-10-23",
    }),
  );
function start(f, duration = 30, date = "2026-10-23") {
  const value = f.a.startGuidedSession({ date, templateId: "push", duration });
  assert.equal(value.ok, true);
  return value.sessionId;
}
function current(f, extra = {}) {
  const g = f.a.getGuidedWorkoutState();
  return {
    sessionId: g.sessionId,
    planSlotId: g.currentSlotId,
    expectedRevision: g.revision,
    ...extra,
  };
}

test("trainer context composes the exact guided selector and separates planned/current actual exercise evidence", () => {
  const f = fixture();
  logged(f);
  start(f);
  assert.equal(
    f.a.logGuidedSet(
      current(f, {
        requestId: "planned",
        weight: 40,
        unit: "lb/side",
        reps: 8,
      }),
    ).ok,
    true,
  );
  assert.equal(
    f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" })).ok,
    true,
  );
  assert.equal(
    f.a.logGuidedSet(
      current(f, {
        requestId: "actual",
        weight: 100,
        unit: "lb",
        reps: 9,
        pain: 2,
        painArea: "shoulder",
        notes: "recorded discomfort",
      }),
    ).ok,
    true,
  );
  const context = result(f.a.getTrainerWorkoutContext(options()));
  assert.deepEqual(context.guidedWorkout, f.a.getGuidedWorkoutState());
  assert.equal(
    context.guidedWorkout.currentExercise.plannedExercise,
    "Smith Press",
  );
  assert.equal(
    context.guidedWorkout.currentExercise.actualExercise,
    "Bench Press",
  );
  assert.deepEqual(
    context.currentSlotSets.map((set) => set.exercise),
    ["Smith Press", "Bench Press"],
  );
  assert.equal(context.currentActualExerciseSets.length, 1);
  assert.equal(context.currentPainContext.length, 1);
  assert.equal(context.exerciseContext.recentOccurrences.length, 1);
  assert.equal(context.exerciseContext.exclusions.length, 1);
  assert.equal(
    context.exerciseContext.recentOccurrences[0].records[0].record.reps,
    8,
  );
  assert.equal(context.structuredConstraints, null);
  assert.equal(context.structuredGoals, null);
  assert.equal(
    context.preferences.actual.recordedText,
    "Keep original free-text preference; shoulder history",
  );
  assert.equal(context.preferences.interpretation, "unparsed_recorded_text");
  assert.equal(context.trainerDecision.recommendation, null);
});

test("selectors are detached, deterministic, serializable and never persist or commit", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { date: "2026-10-21", reps: 10 });
  start(f);
  f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" }));
  const original = f.state(),
    writes = f.writes(),
    commits = f.commits();
  for (const call of [
    () => f.a.getExercisePerformanceContext(options()),
    () => f.a.getTrainerWorkoutContext(options()),
    () =>
      f.a.compareExercisePerformance({
        baselineSetId: a,
        currentSetId: b,
        asOfDate: "2026-10-23",
      }),
  ]) {
    const first = call();
    assert.deepEqual(call(), first);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
    first.result.asOfDate = "tampered";
    assert.equal(call().result.asOfDate, "2026-10-23");
  }
  const context = result(f.a.getTrainerWorkoutContext(options()));
  context.guidedWorkout.session.planSnapshot.name = "tamper";
  context.exerciseContext.recentOccurrences[0].records[0].record.notes =
    "tamper";
  assert.deepEqual(f.state(), original);
  assert.equal(f.writes(), writes);
  assert.equal(f.commits(), commits);
});

test("exact same load compares repetitions with referenced operands, without a progression command", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { date: "2026-10-21", reps: 10 });
  const value = compare(f, a, b);
  assert.equal(value.comparable, true);
  assert.equal(value.relationship, "same_load");
  assert.deepEqual(
    value.calculations.find((row) => row.metric === "repetitionDifference"),
    {
      metric: "repetitionDifference",
      value: 2,
      unit: "reps",
      ruleId: "same-load-rep-difference-v1",
      operation: "current - baseline",
      inputs: [
        { setId: a, value: 8 },
        { setId: b, value: 10 },
      ],
    },
  );
  assert.equal(value.evidenceReview.status, "review");
  assert.equal(value.evidenceReview.recommendation, null);
  assert.ok(value.limitations.includes("WORKING_SET_CLASSIFICATION_UNKNOWN"));
});

test("same reps compares load, changed load/reps exposes components without ranking", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { date: "2026-10-21", weight: 110 }),
    c = logged(f, { date: "2026-10-22", weight: 120, reps: 6 });
  const matched = compare(f, a, b);
  assert.equal(matched.relationship, "same_reps");
  assert.equal(matched.calculations[0].value, 10);
  assert.equal(matched.calculations[0].ruleId, "same-reps-load-difference-v1");
  const tradeoff = compare(f, b, c);
  assert.equal(tradeoff.relationship, "load_and_reps_changed");
  assert.equal(tradeoff.calculations[0].value, 10);
  assert.equal(tradeoff.calculations[1].value, -2);
  assert.ok(tradeoff.limitations.includes("NO_GLOBAL_PERFORMANCE_RANKING"));
});

test("reported RPE/RIR changes require matched workload and never convert or fill missing effort", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { date: "2026-10-21", rpe: 7, rir: 3 }),
    c = logged(f, { date: "2026-10-22", rpe: null, rir: null }),
    d = logged(f, { date: "2026-10-22", weight: 110, rpe: 6, rir: 4 });
  const value = compare(f, a, b);
  assert.equal(value.effort.rpe.delta, -1);
  assert.equal(value.effort.rir.delta, 1);
  assert.equal(
    value.calculations.find((row) => row.metric === "rpeDifference").ruleId,
    "matched-workload-reported-rpe-difference-v1",
  );
  const missing = compare(f, b, c);
  assert.equal(missing.effort.rpe.current, null);
  assert.equal(missing.effort.rpe.delta, null);
  assert.equal(missing.effort.rpe.reasonCode, "MISSING_REPORTED_EFFORT");
  const mismatch = compare(f, b, d);
  assert.equal(mismatch.effort.rir.delta, null);
  assert.equal(mismatch.effort.rir.reasonCode, "WORKLOAD_MISMATCH");
});

test("different actual exercises and incompatible units never receive direct comparison", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { date: "2026-10-21", exercise: "Smith Press" }),
    c = logged(f, { date: "2026-10-21", unit: "lb/side" });
  for (const [id, reason] of [
    [b, "DIFFERENT_ACTUAL_EXERCISE"],
    [c, "INCOMPATIBLE_UNITS"],
  ]) {
    const value = compare(f, a, id);
    assert.equal(value.comparable, false);
    assert.equal(value.calculations.length, 0);
    assert.ok(value.reasonCodes.includes(reason));
    assert.equal(value.evidenceReview.status, "insufficient_evidence");
  }
});

test("session-local substitutions remain evidence about actual exercise, not the planned movement", () => {
  const f = fixture();
  start(f, 60, "2026-10-20");
  f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" }));
  const value = f.a.logGuidedSet(
    current(f, { requestId: "sub", weight: 100, unit: "lb", reps: 8 }),
  );
  assert.equal(value.ok, true);
  const context = result(f.a.getExercisePerformanceContext(options()));
  const record = context.recentOccurrences[0].records[0];
  assert.equal(record.plannedExercise, "Smith Press");
  assert.equal(record.actualExercise, "Bench Press");
  assert.deepEqual(record.substitution, { known: true, occurred: true });
  assert.equal(record.references.planSlotId, "slot-1");
  assert.equal(
    result(
      f.a.getExercisePerformanceContext(options({ exercise: "Smith Press" })),
    ).totalOccurrenceCount,
    0,
  );
});

test("30 and 60 minute records are otherwise comparable and retain authoritative session order", () => {
  const f = fixture();
  start(f, 30, "2026-10-20");
  f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" }));
  const a = f.a.logGuidedSet(
    current(f, { requestId: "short", weight: 100, unit: "lb", reps: 8 }),
  ).setId;
  f.a.finishGuidedSession(current(f, { allowPending: true }));
  start(f, 60, "2026-10-21");
  f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" }));
  const b = f.a.logGuidedSet(
    current(f, { requestId: "standard", weight: 100, unit: "lb", reps: 10 }),
  ).setId;
  const value = compare(f, a, b);
  assert.equal(value.comparable, true);
  assert.equal(value.baseline.sessionContext.duration, 30);
  assert.equal(value.current.sessionContext.duration, 60);
  const reversed = f.state();
  reversed.sets.reverse();
  f.replace(reversed);
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.equal(context.recentOccurrences[0].records[0].references.setId, b);
});

test("legacy same-date records remain a display group, not inferred sessions or distinct workouts", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f);
  const original = f.state();
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.equal(context.totalOccurrenceCount, 1);
  assert.equal(context.recentOccurrences[0].kind, "legacy_date_group");
  assert.equal(context.recentOccurrences[0].legacyGroupingIsDisplayOnly, true);
  assert.deepEqual(
    context.recentOccurrences[0].records.map((row) => row.references.setId),
    [a, b],
  );
  assert.equal(
    context.recentOccurrences[0].records[0].references.sessionId,
    null,
  );
  assert.equal(context.evidenceReview.status, "insufficient_evidence");
  assert.equal(compare(f, a, b).comparisonScope, "within_occurrence");
  assert.deepEqual(f.state(), original);
});

test("same-day explicit sessions stay separate and latest comparable results do not invent within-date order", () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) {
    start(f, 30, "2026-10-20");
    f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" }));
    f.a.logGuidedSet(
      current(f, {
        requestId: `same-day-${i}`,
        weight: 100,
        unit: "lb",
        reps: 8 + i,
      }),
    );
    f.a.finishGuidedSession(current(f, { allowPending: true }));
  }
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.equal(context.totalOccurrenceCount, 2);
  assert.ok(
    context.recentOccurrences.every((row) => row.withinDateOrder === "unknown"),
  );
  assert.equal(context.lastComparableByUnit[0].chronologyAmbiguous, true);
  assert.equal(context.lastComparableByUnit[0].occurrences.length, 2);
  const a = context.recentOccurrences[0].records[0].record.id,
    b = context.recentOccurrences[1].records[0].record.id;
  assert.equal(compare(f, a, b).chronologicalOrder, "same_date_order_unknown");
});

test("incomplete records and missing values stay visible but cannot support numeric comparisons", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { date: "2026-10-21", complete: false }),
    c = logged(f, { date: "2026-10-22", weight: null, reps: null });
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.equal(context.recentOccurrences.length, 3);
  assert.equal(context.evidenceReview.status, "insufficient_evidence");
  for (const id of [b, c]) {
    const value = compare(f, a, id);
    assert.equal(value.comparable, false);
    assert.deepEqual(value.calculations, []);
    assert.ok(value.reasonCodes.includes("INCOMPLETE_RECORD"));
  }
  assert.ok(compare(f, a, c).reasonCodes.includes("MISSING_OR_INVALID_LOAD"));
});

test("bodyweight and assisted exercises expose raw facts but no external-load progression arithmetic", () => {
  for (const [unit, weights] of [
    ["bodyweight", [0, 0]],
    ["assist lb", [50, 40]],
  ]) {
    const f = fixture(),
      a = logged(f, { unit, weight: weights[0] }),
      b = logged(f, { date: "2026-10-21", unit, weight: weights[1], reps: 10 });
    const value = compare(f, a, b);
    assert.equal(value.comparable, false);
    assert.equal(value.calculations.length, 0);
    assert.ok(
      value.reasonCodes.includes(
        unit === "bodyweight"
          ? "BODYWEIGHT_CONTEXT_ONLY"
          : "ASSISTED_CONTEXT_ONLY",
      ),
    );
    const context = result(f.a.getExercisePerformanceContext(options()));
    assert.equal(
      context.recentOccurrences[0].records[0].record.weight,
      weights[1],
    );
  }
});

test("pain and contextual notes are first-class referenced evidence without diagnosis or prescriptions", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, {
      date: "2026-10-21",
      pain: 3,
      painArea: "shoulder",
      notes: "felt discomfort; use another movement",
    });
  const value = compare(f, a, b);
  assert.equal(value.evidenceReview.status, "review");
  assert.ok(value.evidenceReview.reasonCodes.includes("PAIN_CONTEXT_PRESENT"));
  assert.deepEqual(value.evidenceReview.painRecordIds, [b]);
  assert.equal(value.evidenceReview.recommendation, null);
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.equal(context.painContext[0].references.setId, b);
  assert.equal(
    context.painContext[0].record.notes,
    "felt discomfort; use another movement",
  );
});

test("failure and warm-up notes or unknown source fields are preserved without inferred classification", () => {
  const f = fixture(),
    id = logged(f, { notes: "warm-up; failed rep 8" });
  const state = f.state();
  state.sets[0].externalFailureMetadata = { failed: true, attemptedReps: 8 };
  f.replace(state);
  const context = result(f.a.getExercisePerformanceContext(options()));
  const record = context.recentOccurrences[0].records[0];
  assert.equal(record.failure.classification, "unknown");
  assert.equal(record.setClassification.value, "unknown");
  assert.equal(record.record.notes, "warm-up; failed rep 8");
  assert.deepEqual(record.record.externalFailureMetadata, {
    failed: true,
    attemptedReps: 8,
  });
  assert.equal(record.references.setId, id);
});

test("import IDs, notes, incompleteness and source metadata stay available as evidence", () => {
  const f = fixture(),
    id = logged(f, { complete: false, notes: "exact reps not known" });
  const data = f.state();
  Object.assign(data.sets[0], {
    source: "chatgpt",
    importBatch: "batch-test",
    sourceDetail: { originalLine: 4 },
  });
  data.imports.push({
    importId: "original-import",
    batch: "batch-test",
    date: "2026-10-20",
    setCount: 1,
    notes: "original session notes",
  });
  f.replace(data);
  const record = result(f.a.getExercisePerformanceContext(options()))
    .recentOccurrences[0].records[0];
  assert.equal(record.record.source, "chatgpt");
  assert.equal(record.importContext.importId, "original-import");
  assert.equal(record.importContext.notes, "original session notes");
  assert.deepEqual(record.record.sourceDetail, { originalLine: 4 });
  assert.equal(record.references.setId, id);
  assert.equal(record.eligibility.numericComparable, false);
});

test("explicit asOfDate controls history and age without a clock or invented stale cutoff", () => {
  const f = fixture();
  const old = logged(f, { date: "2020-01-01" }),
    future = logged(f, { date: "2026-10-24" });
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.equal(context.recentOccurrences.length, 1);
  assert.equal(context.lastComparableByUnit[0].ageDays, 2487);
  assert.ok(context.limitations.includes("FRESHNESS_NOT_ASSESSED"));
  assert.deepEqual(context.exclusions, [
    {
      references: {
        setId: future,
        sessionId: null,
        planSlotId: null,
        importBatch: null,
      },
      reasonCodes: ["AFTER_AS_OF_DATE"],
    },
  ]);
  assert.equal(
    context.lastComparableByUnit[0].occurrences[0].records[0].references.setId,
    old,
  );
});

test("recent sequence does not rank conflicting loads/reps or create trend/progression scores", () => {
  const f = fixture();
  logged(f, { date: "2026-10-20", weight: 100, reps: 8 });
  logged(f, { date: "2026-10-21", weight: 110, reps: 6 });
  logged(f, { date: "2026-10-22", weight: 90, reps: 12 });
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.deepEqual(
    context.recentOccurrences.map((row) => [
      row.records[0].record.weight,
      row.records[0].record.reps,
    ]),
    [
      [90, 12],
      [110, 6],
      [100, 8],
    ],
  );
  assert.equal(context.trend.status, "not_calculated");
  assert.equal(context.evidenceReview.status, "review");
  assert.equal(context.evidenceReview.recommendation, null);
});

test("display limit does not become a training or freshness rule; units stay separate", () => {
  const f = fixture();
  logged(f, { date: "2026-10-20" });
  logged(f, { date: "2026-10-21" });
  logged(f, { date: "2026-10-22", unit: "lb/side" });
  const full = result(f.a.getExercisePerformanceContext(options())),
    limited = result(f.a.getExercisePerformanceContext(options({ limit: 1 })));
  assert.equal(limited.recentOccurrences.length, 1);
  assert.deepEqual(limited.evidenceReview, full.evidenceReview);
  assert.equal(limited.evidenceReview.status, "review");
  const filtered = result(
    f.a.getExercisePerformanceContext(options({ unit: "lb/side" })),
  );
  assert.equal(filtered.totalOccurrenceCount, 1);
  assert.equal(filtered.evidenceReview.status, "insufficient_evidence");
  assert.ok(
    filtered.exclusions.every((row) =>
      row.reasonCodes.includes("UNIT_FILTER_MISMATCH"),
    ),
  );
});

test("complete recorded totals explain operands and never claim working sets", () => {
  const f = fixture(),
    a = logged(f, { reps: 8 }),
    b = logged(f, { reps: 10 });
  logged(f, { reps: 12, complete: false });
  const totals = result(f.a.getExercisePerformanceContext(options()))
    .recentOccurrences[0].completeRecordedTotals[0];
  assert.equal(totals.completeRecordedSetCount, 2);
  assert.equal(totals.totalRecordedReps, 18);
  assert.deepEqual(totals.supportingRecordIds, [a, b]);
  assert.equal(totals.representsWorkingSets, false);
  assert.equal(totals.ruleId, "sum-complete-recorded-reps-v1");
});

test("unsafe numeric totals are withheld explicitly instead of silently serialized as null or rounded evidence", () => {
  const f = fixture();
  logged(f, { weight: 1, reps: Number.MAX_SAFE_INTEGER });
  logged(f, { weight: 1, reps: 1 });
  const totals = result(f.a.getExercisePerformanceContext(options()))
    .recentOccurrences[0].completeRecordedTotals[0];
  assert.equal(totals.totalRecordedReps, null);
  assert.equal(totals.numericReasonCode, "UNSAFE_INTEGER_TOTAL");
});

test("absent guidance/preferences/constraints remain absent rather than inferred from notes or prototypes", () => {
  const f = fixture();
  logged(f, { exercise: "toString", notes: "shoulder pain; training goal" });
  const raw = f.state();
  delete raw.exerciseLibrary.toString;
  f.replace(raw);
  const context = result(
    f.a.getExercisePerformanceContext(options({ exercise: "toString" })),
  );
  assert.equal(context.exercise.definition, null);
  assert.equal(context.preference.recordedText, null);
  assert.equal(context.structuredConstraints, null);
  const empty = result(f.a.getTrainerWorkoutContext(options()));
  assert.equal(empty.guidedWorkout, null);
  assert.equal(empty.session, null);
  assert.deepEqual(empty.reasonCodes, ["NO_ACTIVE_SESSION"]);
  f.a.createSession({ date: "2026-10-23", templateId: "push" });
  const manual = result(f.a.getTrainerWorkoutContext(options()));
  assert.equal(manual.guidedWorkout, null);
  assert.deepEqual(manual.reasonCodes, ["GUIDANCE_NOT_ENABLED"]);
  assert.ok(manual.session);
  assert.equal(f.a.getActiveSession().guided, undefined);
});

test("invalid queries, missing records and same-record comparisons return explicit reasons without writes", () => {
  const f = fixture(),
    id = logged(f),
    writes = f.writes(),
    original = f.state();
  for (const input of [
    {},
    { asOfDate: "invalid", exercise: "Bench Press" },
    options({ unit: "kg" }),
    options({ limit: 0 }),
    options({ exercise: "" }),
  ])
    assert.equal(
      f.a.getExercisePerformanceContext(input).code,
      "VALIDATION_ERROR",
    );
  assert.equal(
    f.a.compareExercisePerformance({
      baselineSetId: id,
      currentSetId: "missing",
      asOfDate: "2026-10-23",
    }).code,
    "VALIDATION_ERROR",
  );
  assert.equal(
    f.a.getTrainerWorkoutContext(options({ sessionId: "missing" })).code,
    "VALIDATION_ERROR",
  );
  assert.equal(compare(f, id, id).comparable, false);
  assert.ok(compare(f, id, id).reasonCodes.includes("SAME_RECORD"));
  assert.equal(f.writes(), writes);
  assert.deepEqual(f.state(), original);
});

test("withheld comparisons still expose exact pain evidence, including when units differ", () => {
  const f = fixture(),
    a = logged(f),
    b = logged(f, { unit: "lb/side", pain: 2, painArea: "elbow" });
  const value = compare(f, a, b);
  assert.equal(value.comparable, false);
  assert.equal(value.evidenceReview.status, "review");
  assert.deepEqual(value.evidenceReview.painRecordIds, [b]);
  assert.ok(value.evidenceReview.reasonCodes.includes("PAIN_CONTEXT_PRESENT"));
  assert.ok(value.reasonCodes.includes("INCOMPATIBLE_UNITS"));
  assert.deepEqual(value.calculations, []);
  assert.deepEqual(compare(f, b, b).evidenceReview.painRecordIds, [b]);
});

test("unsafe individual repetition precision cannot become a comparison operand", () => {
  const f = fixture(),
    a = logged(f, { weight: 1 }),
    b = logged(f, {
      date: "2026-10-21",
      weight: 1,
      reps: Number.MAX_SAFE_INTEGER + 1,
    });
  const value = compare(f, a, b);
  assert.equal(value.comparable, false);
  assert.ok(value.reasonCodes.includes("UNSAFE_REPETITION_PRECISION"));
  assert.deepEqual(value.calculations, []);
  assert.equal(value.current.record.reps, Number.MAX_SAFE_INTEGER + 1);
});

test("supporting record IDs follow session.setIds even when database array order differs", () => {
  const f = fixture();
  start(f, 30, "2026-10-20");
  f.a.substituteGuidedExercise(current(f, { exercise: "Bench Press" }));
  const a = f.a.logGuidedSet(
    current(f, {
      requestId: "ordered-first",
      weight: 100,
      unit: "lb",
      reps: 8,
    }),
  ).setId;
  const b = f.a.logGuidedSet(
    current(f, {
      requestId: "ordered-second",
      weight: 100,
      unit: "lb",
      reps: 9,
    }),
  ).setId;
  const state = f.state();
  state.sets.reverse();
  f.replace(state);
  const context = result(f.a.getExercisePerformanceContext(options()));
  assert.deepEqual(
    context.recentOccurrences[0].records.map((row) => row.references.setId),
    [a, b],
  );
  assert.deepEqual(context.evidenceReview.perUnit[0].supportingRecordIds, [
    a,
    b,
  ]);
});
