// Domain actions: no document, window, event, controls, dialogs, or rendering.
// Inject synchronous persistence so a failed write cannot commit candidate state.
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
    try {
      const saved = persist(next);
      if (!saved || saved.ok !== true)
        return failure(
          "PERSISTENCE_ERROR",
          saved?.errors || ["Changes were not saved."],
        );
    } catch (error) {
      return failure("PERSISTENCE_ERROR", [error.message]);
    }
    // Persist first, commit second. UI effects happen only after this returns.
    setState(next);
    return {
      ok: true,
      code: "OK",
      errors: [],
      ...details,
      state: getWorkoutState(),
    };
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
      set[key] = cleanText(set[key]);
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
  return {
    getWorkoutState,
    logSet(input) {
      return transaction((next) => {
        const set = record(input);
        ensureExercise(next, set.exercise);
        next.sets.push(set);
        return { setId: set.id, changes: ["sets", "exerciseLibrary"] };
      });
    },
    editSet(id, patch) {
      return transaction((next) => {
        const index = next.sets.findIndex((row) => row.id === id);
        if (index < 0) reject(["Set not found."], "NOT_FOUND");
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
          changes: set.importBatch ? ["sets", "imports"] : ["sets"],
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
}
