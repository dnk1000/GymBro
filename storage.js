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

const storageState = { raw: null, blocked: false, stale: false, message: "" };
function emptyData() {
  return {
    ...structuredClone(seed),
    sets: [],
    bodyweights: [],
    imports: [],
    version: DATA_VERSION,
  };
}
function load() {
  try {
    storageState.raw = localStorage.getItem(KEY);
    return storageState.raw === null
      ? migrateData(seed)
      : migrateData(JSON.parse(storageState.raw));
  } catch (error) {
    storageState.blocked = true;
    storageState.message = `Saved data could not be opened: ${error.message} The original has not been changed. Download it before restoring a backup or starting over.`;
    return emptyData();
  }
}
function save(next, recovery = false) {
  try {
    if ((storageState.blocked && !recovery) || storageState.stale)
      throw Error("Saving is paused. Resolve the storage notice first.");
    const current = localStorage.getItem(KEY);
    if (current !== storageState.raw) {
      storageState.stale = true;
      throw Error(
        "Another tab changed your data. Export this tab if needed, then reload before editing.",
      );
    }
    validateData(next);
    const raw = JSON.stringify(next);
    localStorage.setItem(KEY, raw);
    storageState.raw = raw;
    storageState.blocked = false;
    storageState.message = "";
    renderStorageNotice();
    return true;
  } catch (error) {
    storageState.message = `Changes were not saved. ${error.message} Your previously saved data is unchanged. Export a backup if storage is full or unavailable.`;
    renderStorageNotice();
    alert(storageState.message);
    return false;
  }
}
function changeDB(change) {
  const next = structuredClone(db);
  try {
    change(next);
  } catch (error) {
    alert(error.message);
    return false;
  }
  if (!save(next)) return false;
  db = next;
  renderAll();
  return true;
}
function renderStorageNotice() {
  const notice = document.getElementById("storageNotice");
  notice.hidden = !storageState.message;
  document.getElementById("storageMessage").textContent = storageState.message;
  document.getElementById("recoverStorage").hidden =
    !storageState.blocked || storageState.stale;
}
function downloadStoredData() {
  if (storageState.raw === null) {
    alert("No stored data is available to download.");
    return;
  }
  download("gymbro-original-data.json", "application/json", storageState.raw);
}
function recoverStorage() {
  if (
    !confirm(
      "Replace the unreadable saved data with an empty workout history? Download the original first.",
    )
  )
    return;
  const next = emptyData();
  if (save(next, true)) {
    db = next;
    clearInbox();
    renderAll();
  }
}
window.addEventListener("storage", (event) => {
  if (
    event.storageArea === localStorage &&
    (event.key === KEY || event.key === null)
  ) {
    storageState.stale = true;
    storageState.message =
      "Another tab changed your data. Export this tab if needed, then reload before editing.";
    renderStorageNotice();
  }
});
