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
  // Existing set IDs win; reject conflicting relationships rather than rewriting them.
  validateData(next);
  return next;
}
