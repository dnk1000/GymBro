// Read-only trainer evidence. No recommendations, state transitions, DOM or clock.
const TRAINER_EVIDENCE_POLICY = "trainer-evidence-v1";
const EVIDENCE_LIMITATIONS = Object.freeze([
  "TRAINER_JUDGMENT_REQUIRED",
  "WORKING_SET_CLASSIFICATION_UNKNOWN",
  "FAILURE_CLASSIFICATION_UNKNOWN",
  "EQUIPMENT_IDENTITY_NOT_RECORDED",
  "FRESHNESS_NOT_ASSESSED",
  "NO_PROGRESSION_RECOMMENDATION",
]);
const evidenceTextOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function evidenceOptions(input = {}) {
  requireValue(
    isObject(input) && validDate(input.asOfDate),
    "Supply an explicit valid asOfDate.",
  );
  requireValue(
    input.unit === undefined || UNITS.includes(input.unit),
    "Unsupported load unit.",
  );
  requireValue(
    input.limit === undefined ||
      (Number.isSafeInteger(input.limit) && input.limit > 0),
    "Limit must be a positive whole number.",
  );
  return { ...input, limit: input.limit ?? 5 };
}
function evidenceAge(date, asOfDate) {
  return (
    (Date.parse(`${asOfDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
    86400000
  );
}
function evidenceIndex(data) {
  return {
    sessions: new Map(data.sessions.map((session) => [session.id, session])),
    imports: new Map(
      data.imports.filter((row) => row.batch).map((row) => [row.batch, row]),
    ),
  };
}
function describeExerciseRecord(set, index, asOfDate) {
  const session = index.sessions.get(set.sessionId),
    slot = session?.planSnapshot?.slots.find(
      (row) => row.id === set.planSlotId,
    );
  const reasons = [];
  if (!set.complete) reasons.push("INCOMPLETE_RECORD");
  if (!validNumber(set.weight, 0)) reasons.push("MISSING_OR_INVALID_LOAD");
  if (!validNumber(set.reps, 1, Infinity, true))
    reasons.push("MISSING_OR_INVALID_REPS");
  if (Number.isFinite(set.reps) && !Number.isSafeInteger(set.reps))
    reasons.push("UNSAFE_REPETITION_PRECISION");
  if (set.date > asOfDate) reasons.push("AFTER_AS_OF_DATE");
  if (!UNITS.includes(set.unit)) reasons.push("UNSUPPORTED_UNIT");
  if (set.unit === "bodyweight") reasons.push("BODYWEIGHT_CONTEXT_ONLY");
  else if (set.unit === "assist lb") reasons.push("ASSISTED_CONTEXT_ONLY");
  else if (set.weight === 0) reasons.push("NONPOSITIVE_EXTERNAL_LOAD");
  return {
    references: {
      setId: set.id,
      sessionId: set.sessionId ?? null,
      planSlotId: set.planSlotId ?? null,
      importBatch: set.importBatch ?? null,
    },
    occurrenceKey: session
      ? `session:${session.id}`
      : `legacy-date:${set.date}`,
    occurrenceKind: session ? "session" : "legacy_date_group",
    record: set,
    plannedExercise: slot?.exercise ?? null,
    actualExercise: set.exercise,
    substitution: {
      known: !!slot,
      occurred: slot ? slot.exercise !== set.exercise : null,
    },
    sessionContext: session
      ? {
          id: session.id,
          date: session.date,
          status: session.status,
          templateId: session.templateId,
          name: session.planSnapshot?.name ?? null,
          duration: session.duration,
          createdAt: session.createdAt,
          slotStatus:
            session.guided?.slots.find(
              (row) => row.planSlotId === set.planSlotId,
            )?.status ?? null,
          setOrder: session.setIds.indexOf(set.id) + 1,
        }
      : null,
    importContext: index.imports.get(set.importBatch) ?? null,
    ageDays: evidenceAge(set.date, asOfDate),
    eligibility: {
      numericComparable: reasons.length === 0,
      reasonCodes: reasons,
    },
    failure: {
      classification: "unknown",
      reasonCode: "NO_STRUCTURED_FAILURE_FIELD",
    },
    setClassification: {
      value: "unknown",
      reasonCode: "NO_STRUCTURED_WORKING_SET_FIELD",
    },
  };
}
function evidenceReview(records) {
  const units = [...new Set(records.map((row) => row.record.unit))].sort(
    evidenceTextOrder,
  );
  const perUnit = units.map((unit) => {
    const eligible = records.filter(
      (row) => row.record.unit === unit && row.eligibility.numericComparable,
    );
    return {
      unit,
      comparableOccurrenceCount: new Set(
        eligible.map((row) => row.occurrenceKey),
      ).size,
      supportingRecordIds: eligible.map((row) => row.record.id),
    };
  });
  const enough = perUnit.some((unit) => unit.comparableOccurrenceCount >= 2);
  const pain = records.filter(
    (row) => row.record.pain > 0 || !!row.record.painArea?.trim(),
  );
  const reasons = [
    enough
      ? "COMPARABLE_EVIDENCE_AVAILABLE"
      : "INSUFFICIENT_COMPARABLE_OCCURRENCES",
  ];
  if (pain.length) reasons.push("PAIN_CONTEXT_PRESENT");
  reasons.push(
    ...new Set(records.flatMap((row) => row.eligibility.reasonCodes)),
    ...EVIDENCE_LIMITATIONS,
  );
  return {
    status: enough || pain.length ? "review" : "insufficient_evidence",
    policyId: TRAINER_EVIDENCE_POLICY,
    minimumComparableOccurrences: 2,
    reasonCodes: reasons,
    perUnit,
    painRecordIds: pain.map((row) => row.record.id),
    recommendation: null,
  };
}
function exercisePerformanceContext(data, rawInput) {
  const input = evidenceOptions(rawInput);
  requireValue(safeName(input.exercise), "Supply an exact exercise key.");
  requireValue(
    input.excludeSessionId === undefined ||
      data.sessions.some((session) => session.id === input.excludeSessionId),
    "Excluded session not found.",
  );
  const index = evidenceIndex(data);
  const all = data.sets
    .filter((set) => set.exercise === input.exercise)
    .map((set) => describeExerciseRecord(set, index, input.asOfDate));
  const excluded = [],
    available = [];
  for (const row of all) {
    const reasons = [];
    if (row.record.date > input.asOfDate) reasons.push("AFTER_AS_OF_DATE");
    if (
      input.excludeSessionId !== undefined &&
      row.references.sessionId === input.excludeSessionId
    )
      reasons.push("CURRENT_SESSION_EXCLUDED");
    if (input.unit !== undefined && row.record.unit !== input.unit)
      reasons.push("UNIT_FILTER_MISMATCH");
    if (reasons.length)
      excluded.push({ references: row.references, reasonCodes: reasons });
    else available.push(row);
  }
  const buckets = new Map();
  for (const row of available) {
    if (!buckets.has(row.occurrenceKey))
      buckets.set(row.occurrenceKey, {
        key: row.occurrenceKey,
        kind: row.occurrenceKind,
        date: row.record.date,
        session: row.sessionContext,
        records: [],
      });
    buckets.get(row.occurrenceKey).records.push(row);
  }
  const occurrences = [...buckets.values()].sort(
    (a, b) =>
      evidenceTextOrder(b.date, a.date) || evidenceTextOrder(a.key, b.key),
  );
  for (const occurrence of occurrences) {
    if (occurrence.kind === "session")
      occurrence.records.sort(
        (a, b) => a.sessionContext.setOrder - b.sessionContext.setOrder,
      );
    occurrence.withinDateOrder =
      occurrences.filter((other) => other.date === occurrence.date).length > 1
        ? "unknown"
        : "not_applicable";
    occurrence.legacyGroupingIsDisplayOnly =
      occurrence.kind === "legacy_date_group";
    occurrence.completeRecordedTotals = [
      ...new Set(occurrence.records.map((row) => row.record.unit)),
    ]
      .sort(evidenceTextOrder)
      .map((unit) => {
        const rows = occurrence.records.filter(
          (row) =>
            row.record.unit === unit &&
            row.record.complete === true &&
            validNumber(row.record.reps, 1, Infinity, true) &&
            validNumber(row.record.weight, 0),
        );
        return {
          unit,
          completeRecordedSetCount: rows.length,
          totalRecordedReps:
            rows.every((row) => Number.isSafeInteger(row.record.reps)) &&
            Number.isSafeInteger(
              rows.reduce((total, row) => total + row.record.reps, 0),
            )
              ? rows.reduce((total, row) => total + row.record.reps, 0)
              : null,
          numericReasonCode:
            rows.every((row) => Number.isSafeInteger(row.record.reps)) &&
            Number.isSafeInteger(
              rows.reduce((total, row) => total + row.record.reps, 0),
            )
              ? null
              : "UNSAFE_INTEGER_TOTAL",
          supportingRecordIds: rows.map((row) => row.record.id),
          ruleId: "sum-complete-recorded-reps-v1",
          representsWorkingSets: false,
        };
      });
  }
  const orderedEvidence = occurrences.flatMap(
    (occurrence) => occurrence.records,
  );
  const units = [...new Set(available.map((row) => row.record.unit))].sort(
    evidenceTextOrder,
  );
  const lastComparableByUnit = units.map((unit) => {
    const candidates = occurrences.filter((occurrence) =>
      occurrence.records.some(
        (row) => row.record.unit === unit && row.eligibility.numericComparable,
      ),
    );
    const date = candidates[0]?.date ?? null;
    return {
      unit,
      date,
      ageDays: date ? evidenceAge(date, input.asOfDate) : null,
      chronologyAmbiguous:
        candidates.filter((row) => row.date === date).length > 1,
      occurrences: candidates
        .filter((row) => row.date === date)
        .map((row) => ({
          key: row.key,
          kind: row.kind,
          records: row.records.filter(
            (record) =>
              record.record.unit === unit &&
              record.eligibility.numericComparable,
          ),
        })),
    };
  });
  const recent = occurrences.slice(0, input.limit);
  return {
    policyId: TRAINER_EVIDENCE_POLICY,
    asOfDate: input.asOfDate,
    exercise: {
      key: input.exercise,
      displayName: input.exercise,
      identityScheme: "exercise_library_name_key",
      definition: hasOwn(data.exerciseLibrary, input.exercise)
        ? data.exerciseLibrary[input.exercise]
        : null,
    },
    unitFilter: input.unit ?? null,
    limit: input.limit,
    totalOccurrenceCount: occurrences.length,
    recentOccurrences: recent,
    lastComparableByUnit,
    exclusions: excluded,
    unshownOccurrenceCount: Math.max(0, occurrences.length - recent.length),
    painContext: orderedEvidence.filter(
      (row) => row.record.pain > 0 || !!row.record.painArea?.trim(),
    ),
    preference: {
      recordedText: hasOwn(data.preferences, input.exercise)
        ? data.preferences[input.exercise]
        : null,
      interpretation: "unparsed_recorded_text",
    },
    structuredConstraints: null,
    structuredFailureClassification: "unknown",
    evidenceReview: {
      ...evidenceReview(orderedEvidence),
      scope: "all_matching_records_through_asOfDate",
    },
    limitations: [...EVIDENCE_LIMITATIONS],
    trend: {
      status: "not_calculated",
      reasonCode: "RECENT_SEQUENCE_NOT_A_TREND_SCORE",
    },
  };
}
function compareExerciseRecords(data, rawInput) {
  const input = evidenceOptions(rawInput),
    index = evidenceIndex(data);
  const baseline = data.sets.find((set) => set.id === input.baselineSetId),
    current = data.sets.find((set) => set.id === input.currentSetId);
  requireValue(baseline && current, "Both supporting set IDs must exist.");
  const a = describeExerciseRecord(baseline, index, input.asOfDate),
    b = describeExerciseRecord(current, index, input.asOfDate);
  const reasons = [
    ...new Set([...a.eligibility.reasonCodes, ...b.eligibility.reasonCodes]),
  ];
  if (baseline.id === current.id) reasons.push("SAME_RECORD");
  if (baseline.exercise !== current.exercise)
    reasons.push("DIFFERENT_ACTUAL_EXERCISE");
  if (
    baseline.unit !== current.unit ||
    (input.unit !== undefined &&
      (baseline.unit !== input.unit || current.unit !== input.unit))
  )
    reasons.push("INCOMPATIBLE_UNITS");
  const comparable = reasons.length === 0,
    calculations = [];
  const difference = (metric, field, unit, ruleId) => ({
    metric,
    value: current[field] - baseline[field],
    unit,
    ruleId,
    operation: "current - baseline",
    inputs: [
      { setId: baseline.id, value: baseline[field] },
      { setId: current.id, value: current[field] },
    ],
  });
  let relationship = "not_comparable";
  const effort = {
    rpe: {
      baseline: baseline.rpe ?? null,
      current: current.rpe ?? null,
      delta: null,
      reasonCode: "WORKLOAD_MISMATCH",
    },
    rir: {
      baseline: baseline.rir ?? null,
      current: current.rir ?? null,
      delta: null,
      reasonCode: "WORKLOAD_MISMATCH",
    },
  };
  if (comparable) {
    const sameLoad = baseline.weight === current.weight,
      sameReps = baseline.reps === current.reps;
    relationship =
      sameLoad && sameReps
        ? "same_load_and_reps"
        : sameLoad
          ? "same_load"
          : sameReps
            ? "same_reps"
            : "load_and_reps_changed";
    calculations.push(
      difference(
        "loadDifference",
        "weight",
        current.unit,
        sameReps
          ? "same-reps-load-difference-v1"
          : "component-load-difference-no-ranking-v1",
      ),
    );
    calculations.push(
      difference(
        "repetitionDifference",
        "reps",
        "reps",
        sameLoad
          ? "same-load-rep-difference-v1"
          : "component-rep-difference-no-ranking-v1",
      ),
    );
    for (const field of ["rpe", "rir"]) {
      const present =
        Number.isFinite(baseline[field]) && Number.isFinite(current[field]);
      effort[field].reasonCode =
        !sameLoad || !sameReps
          ? "WORKLOAD_MISMATCH"
          : !present
            ? "MISSING_REPORTED_EFFORT"
            : "MATCHED_LOAD_AND_REPS";
      if (sameLoad && sameReps && present) {
        const calculation = difference(
          `${field}Difference`,
          field,
          field.toUpperCase(),
          `matched-workload-reported-${field}-difference-v1`,
        );
        calculations.push(calculation);
        effort[field].delta = calculation.value;
      }
    }
  }
  const review = evidenceReview(
    baseline.exercise === current.exercise &&
      baseline.unit === current.unit &&
      baseline.id !== current.id
      ? [a, b]
      : [],
  );
  if (!comparable) {
    review.status = [a, b].some(
      (row) => row.record.pain > 0 || !!row.record.painArea?.trim(),
    )
      ? "review"
      : "insufficient_evidence";
    review.painRecordIds = [
      ...new Set(
        [a, b]
          .filter((row) => row.record.pain > 0 || !!row.record.painArea?.trim())
          .map((row) => row.record.id),
      ),
    ];
    review.reasonCodes = [
      ...new Set([
        ...reasons,
        ...(review.painRecordIds.length ? ["PAIN_CONTEXT_PRESENT"] : []),
        ...review.reasonCodes,
      ]),
    ];
  }
  const sameOccurrence = a.occurrenceKey === b.occurrenceKey;
  return {
    policyId: TRAINER_EVIDENCE_POLICY,
    asOfDate: input.asOfDate,
    baseline: a,
    current: b,
    comparable,
    reasonCodes: reasons,
    comparisonScope: sameOccurrence
      ? "within_occurrence"
      : "caller_selected_occurrences",
    chronologicalOrder:
      current.date > baseline.date
        ? "baseline_before_current_by_date"
        : current.date < baseline.date
          ? "current_before_baseline_by_date"
          : sameOccurrence && a.sessionContext && b.sessionContext
            ? "session_set_order_available"
            : "same_date_order_unknown",
    relationship,
    calculations,
    effort,
    evidenceReview: review,
    limitations: [
      ...EVIDENCE_LIMITATIONS,
      ...(relationship === "load_and_reps_changed"
        ? ["NO_GLOBAL_PERFORMANCE_RANKING"]
        : []),
      ...(sameOccurrence ? ["WITHIN_OCCURRENCE_ONLY"] : []),
    ],
  };
}
function trainerWorkoutContext(data, rawInput) {
  const input = evidenceOptions(rawInput),
    sessionId = input.sessionId ?? data.activeSessionId;
  const session = data.sessions.find((row) => row.id === sessionId) ?? null;
  requireValue(
    input.sessionId === undefined ||
      (typeof input.sessionId === "string" && !!session),
    "Session not found.",
  );
  // Compose the SAME authoritative selector used by getGuidedWorkoutState().
  const guided = guidedWorkoutState(data, sessionId);
  const base = {
    policyId: TRAINER_EVIDENCE_POLICY,
    asOfDate: input.asOfDate,
    guidedWorkout: guided,
    session,
    structuredConstraints: null,
    structuredGoals: null,
    reasonCodes: [],
  };
  if (!guided)
    return {
      ...base,
      exerciseContext: null,
      reasonCodes: [session ? "GUIDANCE_NOT_ENABLED" : "NO_ACTIVE_SESSION"],
    };
  const exercise = guided.currentExercise.actualExercise,
    planned = guided.currentExercise.plannedExercise,
    index = evidenceIndex(data);
  const slotSets = guided.currentExercise.sets;
  const currentEvidence = guided.setsLogged
    .filter((set) => set.exercise === exercise)
    .map((set) => describeExerciseRecord(set, index, input.asOfDate));
  return {
    ...base,
    exerciseContext: exercisePerformanceContext(data, {
      ...input,
      exercise,
      excludeSessionId: session.id,
    }),
    currentSlotSets: slotSets,
    currentActualExerciseSets: slotSets.filter(
      (set) => set.exercise === exercise,
    ),
    currentSessionExerciseEvidence: currentEvidence,
    currentPainContext: currentEvidence.filter(
      (row) => row.record.pain > 0 || !!row.record.painArea?.trim(),
    ),
    preferences: {
      planned: {
        exercise: planned,
        recordedText: hasOwn(data.preferences, planned)
          ? data.preferences[planned]
          : null,
      },
      actual: { exercise, recordedText: data.preferences[exercise] ?? null },
      interpretation: "unparsed_recorded_text",
    },
    trainerDecision: {
      status: "review",
      recommendation: null,
      reasonCodes: ["TRAINER_JUDGMENT_REQUIRED"],
      policyId: TRAINER_EVIDENCE_POLICY,
    },
  };
}
function createPerformanceSelectors(getWorkoutState) {
  function read(calculate, input) {
    try {
      return JSON.parse(
        JSON.stringify({
          ok: true,
          code: "OK",
          errors: [],
          result: calculate(getWorkoutState(), input),
        }),
      );
    } catch (error) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        errors: [error.message],
        result: null,
      };
    }
  }
  return {
    getExercisePerformanceContext: (input) =>
      read(exercisePerformanceContext, input),
    compareExercisePerformance: (input) => read(compareExerciseRecords, input),
    getTrainerWorkoutContext: (input) => read(trainerWorkoutContext, input),
  };
}
