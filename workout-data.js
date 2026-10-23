// V1.6 keeps the existing storage key and migrates V1–V1.5 records in memory.
const DATA_VERSION = 5;
const UNITS = ["lb", "lb/side", "assist lb", "bodyweight"];
const hasOwn = (object, key) => Object.hasOwn(object, key);
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function requireValue(condition, message) {
  if (!condition) throw Error(message);
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T12:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function validNumber(value, min, max = Infinity, integer = false) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
  );
}
function safeName(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !["__proto__", "constructor", "prototype"].includes(value)
  );
}
function setErrors(set) {
  const errors = [];
  if (!safeName(set.exercise)) errors.push("Enter an exercise name.");
  if (!UNITS.includes(set.unit)) errors.push("Choose a supported load unit.");
  if (set.weight != null && !validNumber(set.weight, 0))
    errors.push("Weight must be a finite, nonnegative number.");
  if (set.reps != null && !validNumber(set.reps, 1, Infinity, true))
    errors.push("Reps must be a positive whole number.");
  if (
    set.weight != null &&
    set.reps != null &&
    !Number.isFinite(set.weight * set.reps)
  )
    errors.push("Weight and reps are too large to calculate.");
  if (set.rpe != null && !validNumber(set.rpe, 1, 10))
    errors.push("RPE must be 1–10.");
  if (set.rir != null && !validNumber(set.rir, 0, 10, true))
    errors.push("RIR must be a whole number from 0–10.");
  if (!validNumber(set.pain ?? 0, 0, 10)) errors.push("Pain must be 0–10.");
  return errors;
}
function migrateData(input) {
  requireValue(isObject(input), "Backup must be an object.");
  const data = structuredClone(input);
  const version = data.version ?? 1;
  requireValue(
    Number.isInteger(version) && version >= 1 && version <= DATA_VERSION,
    "Unsupported data version. Use a compatible GymBro version.",
  );
  requireValue(
    Array.isArray(data.sets) && Array.isArray(data.bodyweights),
    "Sets and bodyweights must be arrays.",
  );
  // Supply only absent legacy fields. Invalid present fields must never be silently replaced.
  if (!hasOwn(data, "exerciseLibrary"))
    data.exerciseLibrary = structuredClone(seed.exerciseLibrary);
  if (!hasOwn(data, "preferences")) data.preferences = {};
  if (!hasOwn(data, "imports")) data.imports = [];
  if (!hasOwn(data, "program")) data.program = structuredClone(seed.program);
  requireValue(isObject(data.program), "Invalid program.");
  if (!hasOwn(data.program, "activeDuration")) data.program.activeDuration = 60;
  if (!hasOwn(data.program, "activeTemplateId"))
    data.program.activeTemplateId = null;
  data.sets.forEach((set) => {
    requireValue(isObject(set), "Invalid set record.");
    for (const [key, value] of Object.entries({
      weight: null,
      reps: null,
      unit: "lb",
      rpe: null,
      rir: null,
      pain: 0,
      painArea: "",
      notes: "",
      source: "imported",
    }))
      if (!hasOwn(set, key)) set[key] = value;
    if (!hasOwn(set, "complete"))
      set.complete = set.weight != null && set.reps != null;
  });
  data.version = DATA_VERSION;
  validateData(data);
  return data;
}
function validateData(data) {
  const ids = new Set();
  data.sets.forEach((set, index) => {
    const prefix = `Set ${index + 1}: `;
    requireValue(
      typeof set.id === "string" && set.id && !ids.has(set.id),
      prefix + "missing or duplicate ID.",
    );
    ids.add(set.id);
    requireValue(validDate(set.date), prefix + "invalid date.");
    requireValue(
      setErrors(set).length === 0,
      prefix + setErrors(set).join(" "),
    );
    requireValue(
      typeof set.complete === "boolean" &&
        (!set.complete || (set.weight != null && set.reps != null)),
      prefix + "invalid completeness.",
    );
    for (const field of ["notes", "painArea", "source"])
      requireValue(
        typeof set[field] === "string",
        prefix + `invalid ${field}.`,
      );
  });
  data.bodyweights.forEach((row) =>
    requireValue(
      isObject(row) &&
        validDate(row.date) &&
        validNumber(row.value, Number.MIN_VALUE),
      "Invalid bodyweight record.",
    ),
  );
  requireValue(
    isObject(data.preferences) &&
      Object.values(data.preferences).every(
        (value) => typeof value === "string",
      ),
    "Invalid preferences.",
  );
  requireValue(isObject(data.exerciseLibrary), "Invalid exercise library.");
  for (const [name, meta] of Object.entries(data.exerciseLibrary)) {
    requireValue(
      safeName(name) && isObject(meta),
      "Invalid exercise definition.",
    );
    for (const key of ["primary", "pattern", "type", "status"])
      requireValue(typeof meta[key] === "string", "Invalid exercise metadata.");
    requireValue(
      Array.isArray(meta.secondary) &&
        meta.secondary.every((value) => typeof value === "string"),
      "Invalid secondary muscles.",
    );
  }
  requireValue(Array.isArray(data.imports), "Invalid import history.");
  const importIds = new Set();
  data.imports.forEach((row) => {
    requireValue(
      isObject(row) &&
        typeof row.importId === "string" &&
        row.importId &&
        !importIds.has(row.importId),
      "Invalid or duplicate import ID.",
    );
    importIds.add(row.importId);
    requireValue(
      validDate(row.date) && validNumber(row.setCount, 0, Infinity, true),
      "Invalid import summary.",
    );
    for (const key of ["template", "batch", "notes", "committedAt"])
      requireValue(
        row[key] == null || typeof row[key] === "string",
        "Invalid import metadata.",
      );
    requireValue(
      row.duration == null || validNumber(row.duration, Number.MIN_VALUE),
      "Invalid workout duration.",
    );
  });
  requireValue(Array.isArray(data.program.templates), "Invalid templates.");
  requireValue(
    [30, 60].includes(data.program.activeDuration),
    "Invalid active duration.",
  );
  const templates = new Set();
  data.program.templates.forEach((template) => {
    requireValue(
      isObject(template) &&
        typeof template.id === "string" &&
        template.id &&
        !templates.has(template.id),
      "Invalid or duplicate template ID.",
    );
    templates.add(template.id);
    for (const key of ["name", "focus", "intensity"])
      requireValue(
        typeof template[key] === "string",
        "Invalid template details.",
      );
    requireValue(Array.isArray(template.slots), "Invalid template slots.");
    template.slots.forEach((slot) =>
      requireValue(
        isObject(slot) &&
          safeName(slot.exercise) &&
          ["core", "accessory", "substitute"].includes(slot.role) &&
          typeof slot.short === "boolean",
        "Invalid template slot.",
      ),
    );
  });
  requireValue(
    data.program.activeTemplateId === null ||
      templates.has(data.program.activeTemplateId),
    "Active template does not exist.",
  );
}

function emptyData() {
  return {
    ...structuredClone(seed),
    sets: [],
    bodyweights: [],
    imports: [],
    version: DATA_VERSION,
  };
}

function ensureExercise(data, name) {
  if (!hasOwn(data.exerciseLibrary, name))
    data.exerciseLibrary[name] = {
      primary: "Uncategorized",
      secondary: [],
      pattern: "",
      type: "",
      status: "new",
    };
}
function numeric(value) {
  return value == null || (typeof value === "string" && value.trim() === "")
    ? null
    : typeof value === "number" || typeof value === "string"
      ? Number(value)
      : NaN;
}

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
function normalizeInboxPayload(x) {
  requireValue(isObject(x), "Workout JSON must be an object.");
  requireValue(
    x.schema == null || x.schema === "gym-tracker-chatgpt-v1",
    "Unsupported import schema.",
  );
  const src = x.session ?? x.workout ?? x;
  requireValue(isObject(src), "Workout must be an object.");
  const text = (value, fallback = "") => {
    requireValue(
      value == null || typeof value === "string",
      "Text fields must contain text.",
    );
    return value ?? fallback;
  };
  const date = text(src.date ?? x.date);
  const template = text(src.template ?? src.workoutTemplate);
  const duration = numeric(src.duration ?? src.durationMinutes);
  const sessionNotes = text(src.notes ?? src.sessionNotes);
  const bodyweight = numeric(src.bodyweight ?? src.bodyWeight);
  requireValue(
    !(src.sets != null && src.exercises != null),
    "Supply sets or exercises, not both.",
  );
  let rows = [];
  if (src.sets != null) {
    requireValue(Array.isArray(src.sets), "Sets must be an array.");
    rows = src.sets;
  }
  if (src.exercises != null) {
    requireValue(Array.isArray(src.exercises), "Exercises must be an array.");
    src.exercises.forEach((e) => {
      requireValue(
        isObject(e) && Array.isArray(e.sets),
        "Each exercise needs a sets array.",
      );
      e.sets.forEach((z, i) => {
        requireValue(isObject(z), "Invalid set.");
        rows.push({
          ...z,
          exercise: z.exercise ?? e.exercise ?? e.name,
          setNumber: z.setNumber ?? i + 1,
        });
      });
    });
  }
  const sets = rows.map((z, i) => {
    requireValue(isObject(z), "Invalid set.");
    requireValue(
      z.complete == null || typeof z.complete === "boolean",
      "Complete must be true or false.",
    );
    return {
      include: z.include !== false,
      exercise: text(z.exercise ?? z.name).trim(),
      weight: numeric(z.weight),
      unit: text(z.unit, "lb"),
      reps: numeric(z.reps),
      rpe: numeric(z.rpe),
      rir: numeric(z.rir),
      pain: numeric(z.pain) ?? 0,
      painArea: text(z.painArea ?? z.pain_area),
      notes: text(z.notes),
      complete: z.complete !== false,
      setNumber: z.setNumber ?? i + 1,
    };
  });
  // Retain V1.5 generated IDs, including its completeness representation.
  const legacySets = sets.map(({ include, ...z }, i) => ({
    ...z,
    complete:
      rows[i].complete !== false &&
      rows[i].weight != null &&
      rows[i].reps != null,
  }));
  const importId =
    text(x.importId ?? x.import_id ?? src.importId ?? src.import_id) ||
    simpleHash(JSON.stringify({ date, template, duration, sets: legacySets }));
  return { importId, date, template, duration, sessionNotes, bodyweight, sets };
}
function validateDraft(d) {
  const issues = [];
  if (!validDate(d.date))
    issues.push("Choose a real workout date (YYYY-MM-DD).");
  if (d.duration != null && !validNumber(d.duration, Number.MIN_VALUE))
    issues.push("Duration must be a positive number.");
  if (d.bodyweight != null && !validNumber(d.bodyweight, Number.MIN_VALUE))
    issues.push("Bodyweight must be a positive number.");
  const selected = d.sets.filter((s) => s.include);
  if (!selected.length) issues.push("Select at least one set.");
  d.sets.forEach((s, i) => {
    if (s.include)
      setErrors(s).forEach((error) => issues.push(`Set ${i + 1}: ${error}`));
  });
  return issues;
}
