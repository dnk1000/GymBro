// V3 identity boundary. No DOM, storage, network, or automatic migration.
// Call with a validated current source; #39/#28 own persistence and rollout.
const ExerciseIdentity = (() => {
  const VERSION = 1;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const origins = ["built-in", "user-created", "import-created", "legacy"];
  const clone = (value) => structuredClone(value);
  const check = (condition, message) => {
    if (!condition) throw Error(message);
  };
  const label = (value) => typeof value === "string" && value.trim() !== "";
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  function validateCatalog(catalog) {
    check(object(catalog) && Array.isArray(catalog.exercises) && Array.isArray(catalog.aliases), "Invalid exercise catalog.");
    const ids = new Set(), labels = new Map();
    for (const row of catalog.exercises) {
      check(object(row) && uuid.test(row.id) && !ids.has(row.id), "Invalid or duplicate exercise ID.");
      ids.add(row.id);
      check(label(row.displayName) && origins.includes(row.provenance) && ["active", "archived"].includes(row.state), "Invalid canonical exercise.");
      check(["primary", "pattern", "equipment", "type"].every((key) => typeof row[key] === "string") &&
        Array.isArray(row.secondary) && row.secondary.every((value) => typeof value === "string") && object(row.metadata), "Invalid canonical metadata.");
    }
    for (const row of catalog.aliases) {
      check(object(row) && label(row.label) && ids.has(row.exerciseId) && !labels.has(row.label) &&
        origins.includes(row.provenance), "Invalid, ambiguous or orphaned exercise alias.");
      labels.set(row.label, row.exerciseId);
    }
    for (const row of catalog.exercises)
      check(labels.get(row.displayName) === row.id, "Canonical display name must resolve to its immutable ID.");
    return catalog;
  }

  function resolveLabel(catalog, inputLabel) {
    validateCatalog(catalog);
    check(label(inputLabel), "Supply an exact label.");
    // Deliberately no trimming, case folding, similarity, or semantic equivalence.
    return catalog.aliases.find((row) => row.label === inputLabel)?.exerciseId ?? null;
  }

  function createExercise(catalog, input) {
    validateCatalog(catalog);
    const next = clone(catalog);
    const row = {
      id: input.id ?? crypto.randomUUID(),
      displayName: input.displayName,
      primary: input.primary ?? "",
      secondary: clone(input.secondary ?? []),
      pattern: input.pattern ?? "",
      equipment: input.equipment ?? "",
      type: input.type ?? "",
      state: input.state ?? "active",
      provenance: input.provenance,
      metadata: clone(input.metadata ?? {}),
    };
    next.exercises.push(row);
    next.aliases.push({ label: row.displayName, exerciseId: row.id, provenance: row.provenance });
    validateCatalog(next);
    return next;
  }

  function addAlias(catalog, input) {
    validateCatalog(catalog);
    const next = clone(catalog);
    const prior = next.aliases.find((row) => row.label === input.label);
    if (prior) {
      check(prior.exerciseId === input.exerciseId, "Alias already belongs to another exercise; explicit merge is outside #16.");
      return next;
    }
    next.aliases.push(clone(input));
    validateCatalog(next);
    return next;
  }

  function renameExercise(catalog, exerciseId, displayName) {
    const next = addAlias(catalog, { label: displayName, exerciseId, provenance: "user-created" });
    const row = next.exercises.find((exercise) => exercise.id === exerciseId);
    check(row, "Unknown exercise ID.");
    row.displayName = displayName;
    validateCatalog(next);
    // Old aliases and historical labels stay intact. There is no ID setter.
    return next;
  }

  // All current name-bearing relationships, including immutable snapshot intent
  // and session-local substitutions. Other text/preferences/request signatures
  // remain unparsed provenance and are never interpreted as identity references.
  function references(data, schemaVersion = DATA_VERSION) {
    const rows = [];
    data.sets.forEach((row) => rows.push([row, "exercise"]));
    data.program.templates.forEach((template) => template.slots.forEach((row) => rows.push([row, "exercise"])));
    data.sessions.forEach((session) => {
      session.planSnapshot?.slots.forEach((row) => rows.push([row, "exercise"]));
      session.guided?.slots.forEach((row) => rows.push([row, "actualExercise"]));
    });
    // Only schema-8 documents define this field; schema-7 may contain opaque
    // metadata under the same name and must remain uninterpreted.
    if (schemaVersion >= 8) {
      data.noteScopes.exercise.forEach((row) => rows.push([row, "exercise"]));
      data.noteScopes.exerciseSession.forEach((row) => rows.push([row, "exercise"]));
    }
    return rows;
  }

  async function legacyId(inputLabel) {
    // JSON string encoding preserves even unpaired UTF-16 surrogates. IDs are
    // allocated once from exact legacy labels, then persisted and never renamed.
    const bytes = new TextEncoder().encode(JSON.stringify(["gymbro-exercise-identity-v1", inputLabel]));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)).slice(0, 16);
    hash[6] = (hash[6] & 15) | 128; // UUIDv8: application-defined deterministic ID.
    hash[8] = (hash[8] & 63) | 128;
    const hex = [...hash].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function migrateV2(source, { catalog = { exercises: [], aliases: [] }, mappings = [] } = {}) {
    // Normalization of supported older backups remains migrateData's contract.
    // This function never reads a browser store or writes either source/destination.
    if (source?.version === 7) migrateData(source);
    else validateData(source);
    let nextCatalog = clone(validateCatalog(catalog));
    check(Array.isArray(mappings), "Explicit mappings must be an array.");
    const mappedLabels = new Set();
    for (const mapping of mappings) {
      check(object(mapping) && !mappedLabels.has(mapping.label), "Duplicate explicit mapping.");
      mappedLabels.add(mapping.label);
      nextCatalog = addAlias(nextCatalog, { ...mapping, provenance: "user-created" });
    }
    const data = clone(source), legacyExerciseLibrary = clone(source.exerciseLibrary);
    const labels = new Set([...Object.keys(legacyExerciseLibrary), ...references(data, source.version).map(([row, field]) => row[field])]);
    for (const name of [...labels].sort()) {
      if (resolveLabel(nextCatalog, name)) continue;
      const meta = Object.hasOwn(legacyExerciseLibrary, name) ? legacyExerciseLibrary[name] : {};
      nextCatalog = createExercise(nextCatalog, {
        id: await legacyId(name), displayName: name, provenance: "legacy",
        primary: meta.primary, secondary: meta.secondary, pattern: meta.pattern,
        equipment: typeof meta.equipment === "string" ? meta.equipment : "", type: meta.type,
        // Legacy status often means core/accessory, not archive state. Preserve
        // it verbatim without promoting a contextual role to canonical state.
        metadata: meta,
      });
    }
    for (const [row, field] of references(data, source.version))
      row[field] = { exerciseId: resolveLabel(nextCatalog, row[field]), originalLabel: row[field] };
    delete data.exerciseLibrary;
    delete data.version;
    const document = { identityVersion: VERSION, sourceSchemaVersion: source.version, catalog: nextCatalog, legacyExerciseLibrary, data };
    verifyV2Migration(source, document);
    return document;
  }

  function restoreV2Source(document) {
    check(object(document) && document.identityVersion === VERSION && [7, 8].includes(document.sourceSchemaVersion),
      "Unsupported exercise identity document.");
    validateCatalog(document.catalog);
    check(object(document.legacyExerciseLibrary), "Missing legacy exercise definitions.");
    for (const name of Object.keys(document.legacyExerciseLibrary))
      check(resolveLabel(document.catalog, name), "Legacy exercise definition lost its canonical identity.");
    const data = clone(document.data);
    check(object(data) && !Object.hasOwn(data, "version") && !Object.hasOwn(data, "exerciseLibrary"), "Invalid identity document data.");
    for (const [row, field] of references(data, document.sourceSchemaVersion)) {
      const ref = row[field];
      check(object(ref) && Object.keys(ref).length === 2 && label(ref.originalLabel) && uuid.test(ref.exerciseId) &&
        resolveLabel(document.catalog, ref.originalLabel) === ref.exerciseId, "Broken canonical exercise reference.");
      row[field] = ref.originalLabel;
    }
    data.exerciseLibrary = clone(document.legacyExerciseLibrary);
    data.version = document.sourceSchemaVersion;
    // Prior identity documents retain their exact schema-7 source on recovery.
    // Normalization validates their compatibility without modifying that source.
    if (document.sourceSchemaVersion === 7) migrateData(data);
    else validateData(data);
    return data;
  }

  function verifyV2Migration(source, document) {
    if (source?.version === 7) migrateData(source);
    else validateData(source);
    const restored = restoreV2Source(document);
    check(sameSessionData(source, restored), "Migration content/relationship mismatch; destination must not be committed.");
    return { ok: true, identityVersion: VERSION, exercises: document.catalog.exercises.length,
      references: references(document.data, document.sourceSchemaVersion).length, sets: source.sets.length, sessions: source.sessions.length };
  }

  function performanceContext(document, input) {
    restoreV2Source(document); // Validate relationships before producing evidence.
    check(object(input) && uuid.test(input.exerciseId), "Supply an immutable exerciseId.");
    const exercise = document.catalog.exercises.find((row) => row.id === input.exerciseId);
    check(exercise, "Unknown exercise ID.");
    // Reuse accepted numerical/session/comparability rules. Only the identity
    // projection changes: equal IDs aggregate, regardless of original labels.
    const projected = clone(document.data);
    for (const [row, field] of references(projected, document.sourceSchemaVersion)) row[field] = row[field].exerciseId;
    projected.exerciseLibrary = Object.fromEntries(document.catalog.exercises.map((row) => [row.id, row]));
    projected.preferences = {}; // Never guess how different label notes combine.
    const result = exercisePerformanceContext(projected, { ...input, exercise: input.exerciseId });
    const sets = new Map(document.data.sets.map((row) => [row.id, row]));
    const sessions = new Map(document.data.sessions.map((row) => [row.id, row]));
    function retainLabels(value) {
      const set = sets.get(value.references.setId);
      value.record = clone(set);
      value.actualExercise = clone(set.exercise);
      value.plannedExercise = clone(sessions.get(set.sessionId)?.planSnapshot?.slots.find((slot) => slot.id === set.planSlotId)?.exercise ?? null);
    }
    result.recentOccurrences.forEach((occurrence) => occurrence.records.forEach(retainLabels));
    result.lastComparableByUnit.forEach((unit) => unit.occurrences.forEach((occurrence) => occurrence.records.forEach(retainLabels)));
    result.painContext.forEach(retainLabels);
    result.exercise = { exerciseId: exercise.id, displayName: exercise.displayName,
      identityScheme: "gymbro_canonical_exercise_id", definition: clone(exercise) };
    result.sourcePreferences = Object.entries(document.data.preferences).filter(([name]) =>
      resolveLabel(document.catalog, name) === exercise.id).map(([originalLabel, recordedText]) => ({ originalLabel, recordedText }));
    return result;
  }

  function databaseRows(document, ownerId) {
    restoreV2Source(document);
    check(typeof ownerId === "string" && uuid.test(ownerId), "Supply an authenticated owner UUID.");
    return {
      exercises: document.catalog.exercises.map((row) => ({ owner_id: ownerId, exercise_id: row.id,
        display_name: row.displayName, primary_muscle: row.primary, secondary_muscles: clone(row.secondary),
        movement_pattern: row.pattern, equipment: row.equipment, exercise_type: row.type,
        state: row.state, provenance: row.provenance, metadata: clone(row.metadata) })),
      aliases: document.catalog.aliases.map((row) => ({ owner_id: ownerId, label: row.label,
        exercise_id: row.exerciseId, provenance: row.provenance })),
    };
  }

  function verifyDatabaseCatalog(document, ownerId, rows) {
    const expected = databaseRows(document, ownerId);
    check(object(rows) && Array.isArray(rows.exercises) && Array.isArray(rows.aliases), "Invalid database catalog response.");
    const ordered = (value) => ({
      exercises: [...value.exercises].sort((a, b) => a.exercise_id < b.exercise_id ? -1 : a.exercise_id > b.exercise_id ? 1 : 0),
      aliases: [...value.aliases].sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0),
    });
    check(sameSessionData(ordered(expected), ordered(rows)), "Database catalog content/ownership mismatch; migration is unverified.");
    return { ok: true, exercises: rows.exercises.length, aliases: rows.aliases.length };
  }

  return Object.freeze({ VERSION, validateCatalog, resolveLabel, createExercise, addAlias, renameExercise,
    migrateV2, restoreV2Source, verifyV2Migration, performanceContext, databaseRows, verifyDatabaseCatalog });
})();
