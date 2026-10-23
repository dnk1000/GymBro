// DOM-free guided execution. Exercise identity is the existing library name key.
function initialGuidance(session, library) {
  requireValue(
    session.planSnapshot?.slots.length > 0,
    "Guidance requires a nonempty saved plan. Manual logging is still available.",
  );
  for (const slot of session.planSnapshot.slots)
    requireValue(
      hasOwn(library, slot.exercise),
      "A planned exercise is missing from the library; use manual logging or restore a compatible backup.",
    );
  return {
    currentSlotId: session.planSnapshot.slots[0].id,
    revision: 0,
    slots: session.planSnapshot.slots.map((slot) => ({
      planSlotId: slot.id,
      actualExercise: slot.exercise,
      status: "pending",
    })),
    requests: [],
  };
}
function validateGuidance(data) {
  const sets = new Map(data.sets.map((set) => [set.id, set]));
  for (const session of data.sessions) {
    if (!hasOwn(session, "guided")) continue;
    const g = session.guided,
      planned = session.planSnapshot?.slots;
    requireValue(
      isObject(g) && planned?.length > 0,
      "Invalid guided session plan.",
    );
    requireValue(
      Number.isSafeInteger(g.revision) && g.revision >= 0,
      "Invalid guided revision.",
    );
    requireValue(
      planned.some((slot) => slot.id === g.currentSlotId),
      "Invalid current guided slot; progress was not changed.",
    );
    requireValue(
      Array.isArray(g.slots) && g.slots.length === planned.length,
      "Invalid guided slots.",
    );
    g.slots.forEach((slot, index) =>
      requireValue(
        isObject(slot) &&
          slot.planSlotId === planned[index].id &&
          safeName(slot.actualExercise) &&
          hasOwn(data.exerciseLibrary, slot.actualExercise) &&
          ["pending", "completed", "skipped"].includes(slot.status),
        "Invalid guided exercise or status.",
      ),
    );
    requireValue(
      Array.isArray(g.requests),
      "Invalid guided submission history.",
    );
    const ids = new Set(),
      setIds = new Set();
    for (const request of g.requests) {
      requireValue(
        isObject(request) &&
          typeof request.id === "string" &&
          request.id &&
          !ids.has(request.id) &&
          typeof request.setId === "string" &&
          request.setId &&
          !setIds.has(request.setId) &&
          typeof request.signature === "string" &&
          request.signature,
        "Invalid guided submission identifier.",
      );
      ids.add(request.id);
      setIds.add(request.setId);
      const set = sets.get(request.setId);
      requireValue(
        !set ||
          (set.sessionId === session.id &&
            planned.some((slot) => slot.id === set.planSlotId)),
        "Guided submission points to a different session or slot.",
      );
      // Missing sets are deliberate deletion tombstones: retries must not recreate them.
    }
  }
}
function guidedWorkoutState(data, sessionId = data.activeSessionId) {
  const session = data.sessions.find((row) => row.id === sessionId);
  if (!session?.guided) return null;
  const g = session.guided;
  const slots = g.slots.map((slot, index) => ({
    ...slot,
    plannedExercise: session.planSnapshot.slots[index].exercise,
    sets: session.setIds
      .map((id) => data.sets.find((set) => set.id === id))
      .filter((set) => set.planSlotId === slot.planSlotId),
  }));
  const index = slots.findIndex((slot) => slot.planSlotId === g.currentSlotId);
  requireValue(index >= 0, "Invalid current guided slot.");
  const current = slots[index];
  const eligible = data.sets.filter(
    (set) =>
      set.exercise === current.actualExercise &&
      set.sessionId !== session.id &&
      set.date <= session.date &&
      set.complete === true &&
      validNumber(set.weight, 0) &&
      validNumber(set.reps, 1, Infinity, true) &&
      UNITS.includes(set.unit) &&
      (["bodyweight", "assist lb"].includes(set.unit) || set.weight > 0),
  );
  const previousPerformance = [...new Set(eligible.map((set) => set.unit))].map(
    (unit) => {
      const rows = eligible
        .filter((set) => set.unit === unit)
        .sort((a, b) => a.date.localeCompare(b.date));
      const date = rows.at(-1).date;
      return {
        unit,
        kind:
          unit === "bodyweight"
            ? "bodyweight"
            : unit === "assist lb"
              ? "assisted"
              : "external load",
        date,
        sets: rows.filter((set) => set.date === date),
      };
    },
  );
  return JSON.parse(
    JSON.stringify({
      sessionId: session.id,
      activeSessionId: data.activeSessionId,
      session,
      revision: g.revision,
      currentSlotId: g.currentSlotId,
      currentExercise: current,
      previousExercise: slots[index - 1] ?? null,
      nextExercise: slots[index + 1] ?? null,
      slots,
      remainingSlots: slots.filter((slot) => slot.status === "pending"),
      setsLogged: session.setIds.map((id) =>
        data.sets.find((set) => set.id === id),
      ),
      previousPerformance,
    }),
  );
}
function guidedRequestSignature(input) {
  const keys = [
    "sessionId",
    "planSlotId",
    "date",
    "exercise",
    "weight",
    "unit",
    "reps",
    "rpe",
    "rir",
    "pain",
    "painArea",
    "notes",
    "complete",
  ];
  return JSON.stringify(
    Object.fromEntries(
      keys.filter((key) => hasOwn(input, key)).map((key) => [key, input[key]]),
    ),
  );
}
function createGuidedActions({
  transaction,
  reject,
  getWorkoutState,
  makeSession,
  sessionFor,
  record,
  linkSet,
  finishSession,
}) {
  function active(next, input, requireRevision = true) {
    if (!isObject(input)) reject(["Action parameters are required."]);
    const session = sessionFor(next, input.sessionId);
    if (
      session.status !== "active" ||
      next.activeSessionId !== session.id ||
      !session.guided
    )
      reject(["Guided session is not active."], "INVALID_SESSION_STATE");
    if (requireRevision && input.expectedRevision !== session.guided.revision)
      reject(
        [
          "Guided progress changed. Inspect current state and retry your intended action.",
        ],
        "STALE_GUIDANCE",
      );
    return session;
  }
  function slotFor(session, id) {
    const slot = session.guided.slots.find((row) => row.planSlotId === id);
    if (!slot) reject(["Planned slot not found."], "NOT_FOUND");
    return slot;
  }
  return {
    getGuidedWorkoutState(sessionId) {
      return guidedWorkoutState(getWorkoutState(), sessionId);
    },
    startGuidedSession(input = {}) {
      return transaction((next) => {
        const session = makeSession(next, input);
        session.guided = initialGuidance(session, next.exerciseLibrary);
        return {
          sessionId: session.id,
          changes: ["sessions", "activeSessionId"],
        };
      });
    },
    enableGuidance(sessionId) {
      return transaction((next) => {
        const session = sessionFor(next, sessionId);
        if (session.status !== "active" || next.activeSessionId !== sessionId)
          reject(["Session is not active."], "INVALID_SESSION_STATE");
        if (session.guided) return { sessionId, unchanged: true };
        session.guided = initialGuidance(session, next.exerciseLibrary);
        return { sessionId, changes: ["sessions"] };
      });
    },
    selectGuidedSlot(input) {
      return transaction((next) => {
        const session = active(next, input);
        slotFor(session, input.planSlotId);
        if (session.guided.currentSlotId === input.planSlotId)
          return { unchanged: true, sessionId: session.id };
        session.guided.currentSlotId = input.planSlotId;
        session.guided.revision++;
        return { sessionId: session.id, changes: ["sessions"] };
      });
    },
    moveGuidedSlot(input) {
      return transaction((next) => {
        const session = active(next, input),
          g = session.guided;
        if (!["previous", "next"].includes(input.direction))
          reject(["Choose previous or next."]);
        const index =
          g.slots.findIndex((slot) => slot.planSlotId === g.currentSlotId) +
          (input.direction === "next" ? 1 : -1);
        if (!g.slots[index]) reject(["No exercise in that direction."]);
        g.currentSlotId = g.slots[index].planSlotId;
        g.revision++;
        return { sessionId: session.id, changes: ["sessions"] };
      });
    },
    setGuidedSlotStatus(input) {
      return transaction((next) => {
        const session = active(next, input);
        if (!["completed", "skipped"].includes(input.status))
          reject(["Choose Done or Skip explicitly."]);
        const slot = slotFor(session, input.planSlotId);
        if (slot.status === input.status)
          return { unchanged: true, sessionId: session.id };
        slot.status = input.status;
        session.guided.revision++;
        return { sessionId: session.id, changes: ["sessions"] };
      });
    },
    substituteGuidedExercise(input) {
      return transaction((next) => {
        const session = active(next, input),
          slot = slotFor(session, input.planSlotId);
        if (
          typeof input.exercise !== "string" ||
          !hasOwn(next.exerciseLibrary, input.exercise)
        )
          reject(["Choose an exercise from the existing library."]);
        if (slot.actualExercise === input.exercise)
          return { unchanged: true, sessionId: session.id };
        slot.actualExercise = input.exercise;
        session.guided.revision++;
        return { sessionId: session.id, changes: ["sessions"] };
      });
    },
    logGuidedSet(input) {
      if (
        !isObject(input) ||
        typeof input.requestId !== "string" ||
        !input.requestId.trim()
      )
        return {
          ok: false,
          code: "VALIDATION_ERROR",
          errors: ["A unique submission request ID is required."],
          changes: [],
          state: getWorkoutState(),
        };
      const state = getWorkoutState();
      let signature;
      try {
        signature = guidedRequestSignature(input);
      } catch {
        return {
          ok: false,
          code: "VALIDATION_ERROR",
          errors: ["Submission parameters must be serializable set values."],
          changes: [],
          state,
        };
      }
      const prior = state.sessions
        .find((session) => session.id === input.sessionId)
        ?.guided?.requests.find((request) => request.id === input.requestId);
      if (prior) {
        if (prior.signature !== signature)
          return {
            ok: false,
            code: "REQUEST_CONFLICT",
            errors: ["Request ID was already used for a different submission."],
            changes: [],
            state,
          };
        return {
          ok: true,
          code: "REPLAY",
          errors: [],
          changes: [],
          sessionId: input.sessionId,
          setId: prior.setId,
          deleted: !state.sets.some((set) => set.id === prior.setId),
          state,
        };
      }
      return transaction((next) => {
        const session = active(next, input),
          g = session.guided;
        if (input.planSlotId !== g.currentSlotId)
          reject(["The logging slot is no longer current."], "STALE_GUIDANCE");
        const slot = slotFor(session, input.planSlotId);
        if (
          (hasOwn(input, "exercise") &&
            input.exercise !== slot.actualExercise) ||
          (hasOwn(input, "date") && input.date !== session.date)
        )
          reject([
            "Guided logging must match the current exercise and session date.",
          ]);
        const set = record({
          ...input,
          date: session.date,
          exercise: slot.actualExercise,
        });
        linkSet(next, set, session.id, slot.planSlotId);
        next.sets.push(set);
        g.requests.push({ id: input.requestId, setId: set.id, signature });
        g.revision++;
        return {
          sessionId: session.id,
          setId: set.id,
          changes: ["sets", "sessions"],
        };
      });
    },
    finishGuidedSession(input) {
      return transaction((next) => {
        const session = active(next, input);
        return finishSession(next, session.id, input);
      });
    },
  };
}
