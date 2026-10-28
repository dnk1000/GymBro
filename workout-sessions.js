// Session relationships and backup merging. No DOM, storage writes, or inference.
function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function snapshotPlan(template, duration) {
  if (!template) return null;
  return {
    name: template.name,
    slots: template.slots.flatMap((slot, index) =>
      duration === 30 && !slot.short
        ? []
        : [
            {
              id: `slot-${index + 1}`,
              exercise: slot.exercise,
              role: slot.role,
            },
          ],
    ),
  };
}

function validateSessions(data) {
  requireValue(Array.isArray(data.sessions), "Sessions must be an array.");
  requireValue(
    data.activeSessionId === null || typeof data.activeSessionId === "string",
    "Invalid active session ID.",
  );
  const sessions = new Map();
  const sets = new Map(data.sets.map((set) => [set.id, set]));
  const active = [];
  for (const session of data.sessions) {
    requireValue(
      isObject(session) &&
        typeof session.id === "string" &&
        session.id &&
        !sessions.has(session.id),
      "Invalid or duplicate session ID.",
    );
    sessions.set(session.id, session);
    requireValue(validDate(session.date), "Invalid session date.");
    requireValue(
      ["active", "completed"].includes(session.status),
      "Invalid session status.",
    );
    requireValue(
      validTimestamp(session.createdAt),
      "Invalid session creation timestamp.",
    );
    if (session.status === "active") {
      active.push(session.id);
      requireValue(
        session.completedAt === null,
        "Active sessions cannot have a completion timestamp.",
      );
    } else {
      requireValue(
        validTimestamp(session.completedAt) &&
          session.completedAt >= session.createdAt,
        "Invalid session completion timestamp.",
      );
    }
    requireValue(
      [30, 60].includes(session.duration),
      "Invalid session duration.",
    );
    requireValue(
      session.templateId === null ||
        (typeof session.templateId === "string" && session.templateId),
      "Invalid session template ID.",
    );
    const slots = new Set();
    if (session.templateId === null) {
      requireValue(
        session.planSnapshot === null,
        "Unplanned sessions must have a null snapshot.",
      );
    } else {
      const plan = session.planSnapshot;
      requireValue(
        isObject(plan) &&
          typeof plan.name === "string" &&
          Array.isArray(plan.slots),
        "Invalid session plan snapshot.",
      );
      for (const slot of plan.slots) {
        requireValue(
          isObject(slot) &&
            typeof slot.id === "string" &&
            slot.id &&
            !slots.has(slot.id) &&
            safeName(slot.exercise) &&
            ["core", "accessory", "substitute"].includes(slot.role),
          "Invalid snapshot slot.",
        );
        slots.add(slot.id);
      }
    }
    requireValue(
      Array.isArray(session.setIds) &&
        new Set(session.setIds).size === session.setIds.length,
      "Invalid or duplicate ordered session set IDs.",
    );
    for (const id of session.setIds) {
      const set = sets.get(id);
      requireValue(
        typeof id === "string" &&
          set &&
          set.sessionId === session.id &&
          set.date === session.date,
        "Session set references must match their session and date.",
      );
    }
  }
  requireValue(
    active.length <= 1 && data.activeSessionId === (active[0] ?? null),
    "Active session pointer does not match session status.",
  );
  for (const set of data.sets) {
    if (set.sessionId == null) {
      requireValue(
        !hasOwn(set, "planSlotId"),
        "A planned slot requires a session.",
      );
      continue;
    }
    const session = sessions.get(set.sessionId);
    requireValue(
      typeof set.sessionId === "string" &&
        session &&
        session.setIds.includes(set.id),
      "Set references an unknown session or is missing from its order.",
    );
    if (hasOwn(set, "planSlotId"))
      requireValue(
        typeof set.planSlotId === "string" &&
          session.planSnapshot?.slots.some(
            (slot) => slot.id === set.planSlotId,
          ),
        "Set references an unknown planned slot.",
      );
  }
}

// Compare JSON objects independent of property order, preserving array order.
function sameSessionData(left, right) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : isObject(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function mergeHistoryData(current, incoming) {
  validateData(current);
  validateData(incoming);
  const next = structuredClone(current);
  const ids = new Set(next.sets.map((set) => set.id));
  for (const set of incoming.sets)
    if (!ids.has(set.id)) {
      next.sets.push(structuredClone(set));
      ids.add(set.id);
      ensureExercise(next, set.exercise);
    }
  for (const session of incoming.sessions) {
    const existing = next.sessions.find((row) => row.id === session.id);
    requireValue(
      !existing || sameSessionData(existing, session),
      "Conflicting session ID in history merge. Use a complete restore to choose one database.",
    );
    if (!existing) next.sessions.push(structuredClone(session));
  }
  requireValue(
    !next.activeSessionId ||
      !incoming.activeSessionId ||
      next.activeSessionId === incoming.activeSessionId,
    "Cannot merge two different active sessions. Complete one first or use a complete restore.",
  );
  next.activeSessionId = next.activeSessionId ?? incoming.activeSessionId;
  const weights = new Set(
    next.bodyweights.map((row) => JSON.stringify([row.date, row.value])),
  );
  for (const row of incoming.bodyweights) {
    const key = JSON.stringify([row.date, row.value]);
    if (!weights.has(key)) {
      next.bodyweights.push(structuredClone(row));
      weights.add(key);
    }
  }
  const imports = new Set(next.imports.map((row) => row.importId));
  for (const row of incoming.imports)
    if (!imports.has(row.importId)) {
      next.imports.push(structuredClone(row));
      imports.add(row.importId);
    }
  for (const row of next.imports)
    if (row.batch)
      row.setCount = next.sets.filter(
        (set) => set.importBatch === row.batch,
      ).length;
  // History brings contextual notes. Durable setup is a current setting: keep
  // current entries and import it only for previously unknown exercises.
  for (const scope of ["session", "exerciseSession", "exercise"]) {
    for (const note of incoming.noteScopes[scope]) {
      if (scope === "exercise" && hasOwn(current.exerciseLibrary, note.exercise)) continue;
      if (scope !== "session") ensureExercise(next, note.exercise);
      const existing = next.noteScopes[scope].find((row) => sameNoteTarget(row, note));
      requireValue(!existing || sameSessionData(existing, note), "Conflicting scoped note in history merge. Use complete restore to choose one database.");
      if (!existing) next.noteScopes[scope].push(structuredClone(note));
    }
  }
  // Existing set IDs win; reject conflicting relationships rather than rewriting them.
  validateData(next);
  return next;
}

// Schema-8 note contract. Set notes stay on the original set record. The other
// scopes live outside snapshots/guidance so saving a note cannot rewrite intent,
// set membership, or exercise selection. Exact labels are the current V2 keys;
// ExerciseIdentity projects these references to canonical IDs for #39/#28.
function noteTarget(input) {
  if (input.scope === "session") return { sessionId: input.sessionId };
  if (input.scope === "exercise") return { exercise: input.exercise };
  return { sessionId: input.sessionId, exercise: input.exercise, planSlotId: input.planSlotId ?? null };
}
function sameNoteTarget(a, b) {
  return a.sessionId === b.sessionId && a.exercise === b.exercise && a.planSlotId === b.planSlotId;
}
function validateNoteScopes(data) {
  const notes = data.noteScopes;
  requireValue(isObject(notes), "Missing scoped notes.");
  for (const scope of ["session", "exerciseSession", "exercise"]) {
    requireValue(Array.isArray(notes[scope]), "Invalid note scope.");
    const keys = new Set();
    for (const row of notes[scope]) {
      requireValue(isObject(row) && typeof row.text === "string", "Invalid note text.");
      const target = noteTarget({ ...row, scope });
      requireValue(Object.keys(target).every((key) => hasOwn(row, key)), "Missing note target.");
      if (scope !== "exercise") {
        const session = data.sessions.find((s) => s.id === row.sessionId);
        requireValue(session, "Note references an unknown session.");
        if (scope === "exerciseSession" && row.planSlotId !== null)
          requireValue(session.planSnapshot?.slots.some((slot) => slot.id === row.planSlotId), "Note references an unknown session slot.");
      }
      if (scope !== "session")
        requireValue(safeName(row.exercise) && hasOwn(data.exerciseLibrary, row.exercise), "Note references an unknown exercise.");
      // Reject contradictory scope keys, but retain unknown metadata verbatim.
      if (scope === "session") requireValue(!hasOwn(row, "exercise") && !hasOwn(row, "planSlotId"), "Session note has an exercise target.");
      if (scope === "exercise") requireValue(!hasOwn(row, "sessionId") && !hasOwn(row, "planSlotId"), "Durable note has a session target.");
      const key = JSON.stringify(target);
      requireValue(!keys.has(key), "Duplicate note target.");
      keys.add(key);
    }
  }
}
function scopedNote(data, input) {
  const row = data.noteScopes[input.scope].find((row) => sameNoteTarget(row, noteTarget(input)));
  return row?.text ?? "";
}
function exerciseNoteContext(data, exercise) {
  const sessions = data.sessions.filter((session) =>
    session.planSnapshot?.slots.some((slot) => slot.exercise === exercise) ||
    session.guided?.slots.some((slot) => slot.actualExercise === exercise) ||
    data.sets.some((set) => set.sessionId === session.id && set.exercise === exercise) ||
    data.noteScopes.exerciseSession.some((note) => note.sessionId === session.id && note.exercise === exercise));
  return structuredClone({
    setup: data.noteScopes.exercise.filter((row) => row.exercise === exercise),
    exerciseSession: data.noteScopes.exerciseSession.filter((row) => row.exercise === exercise),
    session: data.noteScopes.session.filter((row) => sessions.some((session) => session.id === row.sessionId)),
    sets: data.sets.filter((set) => set.exercise === exercise && set.notes !== ""),
  });
}
