// Domain actions: no document, window, event, controls, dialogs, or rendering.
// Local adapters may be synchronous; remote adapters commit only after awaiting persistence.
function createWorkoutActions({
  getState,
  setState,
  persist,
  createId,
  now = () => new Date().toISOString(),
}) {
  function getWorkoutState() {
    return JSON.parse(JSON.stringify(getState()));
  }
  function failure(code, errors) {
    return { ok: false, code, errors, changes: [], state: getWorkoutState() };
  }
  function reject(errors, code = "VALIDATION_ERROR") {
    const error = Error(errors.join("\n"));
    error.code = code;
    error.errors = errors;
    throw error;
  }
  function transaction(change) {
    let next, details;
    try {
      next = structuredClone(getState());
      details = change(next);
      validateData(next);
    } catch (error) {
      return failure(
        error.code || "VALIDATION_ERROR",
        error.errors || [error.message],
      );
    }
    if (details?.unchanged)
      return {
        ok: true,
        code: "NO_CHANGE",
        errors: [],
        changes: [],
        ...details,
        state: getWorkoutState(),
      };
    function finish(saved) {
      if (!saved || saved.ok !== true)
        return failure(
          "PERSISTENCE_ERROR",
          saved?.errors || ["Changes were not saved."],
        );
      setState(next);
      return {
        ok: true,
        code: "OK",
        errors: [],
        ...details,
        state: getWorkoutState(),
      };
    }
    try {
      const saved = persist(next);
      return saved && typeof saved.then === "function"
        ? Promise.resolve(saved).then(finish, (error) =>
            failure("PERSISTENCE_ERROR", [error.message]),
          )
        : finish(saved);
    } catch (error) {
      return failure("PERSISTENCE_ERROR", [error.message]);
    }
  }

  const cleanText = (value) =>
    typeof value === "string" ? value.trim() : value;
  function record(input, previous) {
    if (!isObject(input)) reject(["Set input must be an object."]);
    const fields = [
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
    const set = previous
      ? { ...previous }
      : {
          id: createId(),
          date: "",
          exercise: "",
          weight: null,
          unit: "lb",
          reps: null,
          rpe: null,
          rir: null,
          pain: 0,
          painArea: "",
          notes: "",
          source: "manual",
          complete: true,
        };
    for (const key of fields) if (hasOwn(input, key)) set[key] = input[key];
    for (const key of ["exercise", "painArea", "notes"])
      if (!previous || hasOwn(input, key)) set[key] = cleanText(set[key]);
    const errors = setErrors(set);
    if (!validDate(set.date)) errors.push("Choose a valid workout date.");
    if (typeof set.complete !== "boolean")
      errors.push("Complete must be true or false.");
    if (errors.length) reject(errors);
    set.complete = set.complete && set.weight != null && set.reps != null;
    return set;
  }
  function templateFor(next, id) {
    const template = next.program.templates.find((row) => row.id === id);
    if (!template) reject(["Workout template not found."], "NOT_FOUND");
    return template;
  }
  function slotFor(next, templateId, index) {
    const template = templateFor(next, templateId);
    if (!Number.isInteger(index) || index < 0 || index >= template.slots.length)
      reject(["Workout slot not found."], "NOT_FOUND");
    return template.slots[index];
  }
  function sessionFor(next, id) {
    const session = next.sessions.find((row) => row.id === id);
    if (!session) reject(["Workout session not found."], "NOT_FOUND");
    return session;
  }
  function linkSet(next, set, sessionId, planSlotId) {
    const session = sessionFor(next, sessionId);
    if (session.status !== "active" || next.activeSessionId !== session.id)
      reject(
        ["New sets can only be attached to the active session."],
        "INVALID_SESSION_STATE",
      );
    if (set.date !== session.date)
      reject(["Set date must match the session's local workout date."]);
    if (set.sessionId != null && set.sessionId !== sessionId)
      reject(["Set already belongs to another session."]);
    if (
      planSlotId != null &&
      !session.planSnapshot?.slots.some((slot) => slot.id === planSlotId)
    )
      reject(["Planned slot does not exist in the session snapshot."]);
    set.sessionId = sessionId;
    if (planSlotId != null) set.planSlotId = planSlotId;
    if (!session.setIds.includes(set.id)) session.setIds.push(set.id);
  }
  function makeSession(next, input = {}) {
    if (!isObject(input) || !validDate(input.date))
      reject(["Choose a valid local workout date."]);
    if (next.activeSessionId !== null)
      reject(
        ["Complete the active session before creating another."],
        "INVALID_SESSION_STATE",
      );
    const templateId = hasOwn(input, "templateId")
      ? input.templateId
      : next.program.activeTemplateId;
    const duration = hasOwn(input, "duration")
      ? input.duration
      : next.program.activeDuration;
    if (![30, 60].includes(duration))
      reject(["Choose a 30- or 60-minute mode."]);
    const template = templateId === null ? null : templateFor(next, templateId);
    const session = {
      id: `ws_${createId()}`,
      date: input.date,
      status: "active",
      createdAt: now(),
      completedAt: null,
      templateId,
      duration,
      planSnapshot: snapshotPlan(template, duration),
      setIds: [],
    };
    next.sessions.push(session);
    next.activeSessionId = session.id;
    return session;
  }
  function finishSession(next, id, options = {}) {
    const session = sessionFor(next, id);
    if (session.status !== "active" || next.activeSessionId !== id)
      reject(["Session is not active."], "INVALID_SESSION_STATE");
    if (session.guided) {
      if (options.expectedRevision !== session.guided.revision)
        reject(
          ["Guided progress changed; inspect it before finishing."],
          "STALE_GUIDANCE",
        );
      const pending = session.guided.slots.filter(
        (slot) => slot.status === "pending",
      ).length;
      if (pending && options.allowPending !== true)
        reject(
          [
            `${pending} unfinished exercises remain. Finish anyway? Their pending status will be preserved.`,
          ],
          "CONFIRM_UNFINISHED",
        );
      session.guided.revision++;
    }
    session.status = "completed";
    session.completedAt = now();
    next.activeSessionId = null;
    return { sessionId: id, changes: ["sessions", "activeSessionId"] };
  }
  const actions = {
    ...createPerformanceSelectors(getWorkoutState),
    ...createGuidedActions({
      transaction,
      reject,
      getWorkoutState,
      makeSession,
      sessionFor,
      record,
      linkSet,
      finishSession,
    }),
    getWorkoutState,
    getSession(id) {
      return getWorkoutState().sessions.find((row) => row.id === id) ?? null;
    },
    getActiveSession() {
      const state = getWorkoutState();
      return (
        state.sessions.find((row) => row.id === state.activeSessionId) ?? null
      );
    },
    createSession(input = {}) {
      return transaction((next) => {
        const session = makeSession(next, input);
        return {
          sessionId: session.id,
          changes: ["sessions", "activeSessionId"],
        };
      });
    },
    completeSession(id, options = {}) {
      return transaction((next) => finishSession(next, id, options));
    },
    attachSetToSession(input = {}) {
      return transaction((next) => {
        if (!isObject(input)) reject(["Attachment input must be an object."]);
        const set = next.sets.find((row) => row.id === input.setId);
        if (!set) reject(["Set not found."], "NOT_FOUND");
        linkSet(next, set, input.sessionId, input.planSlotId);
        return {
          setId: set.id,
          sessionId: set.sessionId,
          changes: ["sets", "sessions"],
        };
      });
    },
    logSet(input) {
      return transaction((next) => {
        const set = record(input);
        const sessionId = hasOwn(input, "sessionId")
          ? input.sessionId
          : next.activeSessionId;
        if (sessionId !== null) linkSet(next, set, sessionId, input.planSlotId);
        else if (input.planSlotId != null)
          reject(["A planned slot requires a session."]);
        ensureExercise(next, set.exercise);
        next.sets.push(set);
        return {
          setId: set.id,
          ...(set.sessionId ? { sessionId: set.sessionId } : {}),
          changes: [
            "sets",
            "exerciseLibrary",
            ...(set.sessionId ? ["sessions"] : []),
          ],
        };
      });
    },
    editSet(id, patch) {
      return transaction((next) => {
        const index = next.sets.findIndex((row) => row.id === id);
        if (index < 0) reject(["Set not found."], "NOT_FOUND");
        if (isObject(patch))
          for (const key of ["sessionId", "planSlotId"]) {
            if (hasOwn(patch, key) && patch[key] !== next.sets[index][key])
              reject([
                "Session relationships cannot be changed by editSet; use a supported attachment action.",
              ]);
          }
        const set = record(patch, next.sets[index]);
        ensureExercise(next, set.exercise);
        next.sets[index] = set;
        return { setId: id, changes: ["sets", "exerciseLibrary"] };
      });
    },
    deleteSet(id) {
      return transaction((next) => {
        const set = next.sets.find((row) => row.id === id);
        if (!set) reject(["Set not found."], "NOT_FOUND");
        next.sets = next.sets.filter((row) => row.id !== id);
        if (set.sessionId != null) {
          const session = sessionFor(next, set.sessionId);
          session.setIds = session.setIds.filter((setId) => setId !== id);
        }
        if (set.importBatch) {
          const summary = next.imports.find(
            (row) => row.batch === set.importBatch,
          );
          if (summary)
            summary.setCount = next.sets.filter(
              (row) => row.importBatch === summary.batch,
            ).length;
        }
        return {
          setId: id,
          changes: [
            "sets",
            ...(set.importBatch ? ["imports"] : []),
            ...(set.sessionId != null ? ["sessions"] : []),
          ],
        };
      });
    },
    logBodyweight(input) {
      return transaction((next) => {
        if (
          !isObject(input) ||
          !validDate(input.date) ||
          !validNumber(input.value, Number.MIN_VALUE)
        )
          reject(["Enter a valid date and positive bodyweight."]);
        next.bodyweights.push({
          date: input.date,
          value: input.value,
          source: "manual",
        });
        return {
          changes: ["bodyweights"],
          bodyweightIndex: next.bodyweights.length - 1,
        };
      });
    },
    selectPlan(input = {}) {
      return transaction((next) => {
        if (!isObject(input)) reject(["Action input must be an object."]);
        const { templateId, duration = 60 } = input;
        templateFor(next, templateId);
        if (![30, 60].includes(duration))
          reject(["Choose a 30- or 60-minute plan."]);
        next.program.activeTemplateId = templateId;
        next.program.activeDuration = duration;
        return { templateId, duration, changes: ["program"] };
      });
    },
    clearPlan() {
      return transaction((next) => {
        next.program.activeTemplateId = null;
        return { templateId: null, changes: ["program"] };
      });
    },
    toggleSlotShort(input = {}) {
      return transaction((next) => {
        if (!isObject(input)) reject(["Action input must be an object."]);
        const { templateId, index } = input;
        const slot = slotFor(next, templateId, index);
        slot.short = !slot.short;
        return { templateId, index, changes: ["program"] };
      });
    },
    cycleSlotRole(input = {}) {
      return transaction((next) => {
        if (!isObject(input)) reject(["Action input must be an object."]);
        const { templateId, index } = input;
        const slot = slotFor(next, templateId, index);
        slot.role =
          slot.role === "core"
            ? "accessory"
            : slot.role === "accessory"
              ? "substitute"
              : "core";
        return { templateId, index, changes: ["program"] };
      });
    },
    removeSlot(input = {}) {
      return transaction((next) => {
        if (!isObject(input)) reject(["Action input must be an object."]);
        const { templateId, index } = input;
        slotFor(next, templateId, index);
        templateFor(next, templateId).slots.splice(index, 1);
        return { templateId, index, changes: ["program"] };
      });
    },
    addSlot(input = {}) {
      return transaction((next) => {
        if (!isObject(input)) reject(["Action input must be an object."]);
        const { templateId, exercise, role = "accessory" } = input;
        const name = cleanText(exercise);
        if (!safeName(name)) reject(["Enter an exercise name."]);
        const template = templateFor(next, templateId);
        ensureExercise(next, name);
        template.slots.push({ exercise: name, role, short: false });
        return {
          templateId,
          index: template.slots.length - 1,
          changes: ["program", "exerciseLibrary"],
        };
      });
    },
    commitImport(draft) {
      return transaction((next) => {
        if (
          !isObject(draft) ||
          !Array.isArray(draft.sets) ||
          !draft.sets.every(isObject)
        )
          reject(["Invalid import draft."]);
        const issues = validateDraft(draft);
        if (issues.length) reject(issues);
        if (typeof draft.importId !== "string" || !draft.importId)
          reject(["Import ID is required."]);
        if (next.imports.some((row) => row.importId === draft.importId))
          reject(
            ["That workout has already been imported."],
            "DUPLICATE_IMPORT",
          );
        const chosen = draft.sets.filter((set) => set.include);
        const batch = "cg_" + draft.importId;
        const setIds = [];
        chosen.forEach((set, index) => {
          ensureExercise(next, set.exercise);
          const id = batch + "_" + String(index + 1).padStart(2, "0");
          setIds.push(id);
          next.sets.push({
            id,
            date: draft.date,
            exercise: set.exercise,
            weight: set.weight,
            unit: set.unit,
            reps: set.reps,
            rpe: set.rpe,
            rir: set.rir,
            pain: set.pain,
            painArea: set.painArea,
            notes: set.notes,
            source: "chatgpt",
            complete: set.complete && set.weight != null && set.reps != null,
            importBatch: batch,
            setNumber: index + 1,
          });
        });
        if (draft.bodyweight != null)
          next.bodyweights.push({
            date: draft.date,
            value: draft.bodyweight,
            source: "chatgpt",
            importBatch: batch,
          });
        next.imports.push({
          importId: draft.importId,
          batch,
          date: draft.date,
          template: draft.template,
          duration: draft.duration,
          setCount: chosen.length,
          notes: draft.sessionNotes,
          committedAt: now(),
        });
        return {
          importId: draft.importId,
          batch,
          setIds,
          count: chosen.length,
          changes: [
            "sets",
            "exerciseLibrary",
            "imports",
            ...(draft.bodyweight != null ? ["bodyweights"] : []),
          ],
        };
      });
    },
  };
  // Guard the complete mutation, including guided pre-transaction replay checks.
  const reads = new Set([
    "getWorkoutState",
    "getSession",
    "getActiveSession",
    "getGuidedWorkoutState",
    "getExercisePerformanceContext",
    "compareExercisePerformance",
    "getTrainerWorkoutContext",
  ]);
  let saving = false;
  for (const [name, action] of Object.entries(actions)) {
    if (reads.has(name)) continue;
    actions[name] = (...args) => {
      if (saving)
        return failure("PERSISTENCE_BUSY", ["A save is in progress."]);
      saving = true;
      try {
        const result = action(...structuredClone(args));
        if (result && typeof result.then === "function")
          return result.finally(() => {
            saving = false;
          });
        saving = false;
        return result;
      } catch (error) {
        saving = false;
        return failure("VALIDATION_ERROR", [error.message]);
      }
    };
  }
  return actions;
}
