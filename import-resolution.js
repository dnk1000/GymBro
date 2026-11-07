// Exact canonical resolution only. Review is pure; allocation occurs at prepare.
const ImportResolution = (() => {
  const clone = value => structuredClone(value);
  function review(catalog, references, decisions = [], { materialize = false } = {}) {
    ExerciseIdentity.validateCatalog(catalog);
    if (!Array.isArray(references) || !Array.isArray(decisions)) throw Error('Invalid import resolution input.');
    const choices = new Map();
    for (const d of decisions) {
      if (!d || typeof d.label !== 'string' || choices.has(d.label) || !['map','create','skip'].includes(d.kind))
        throw Error('Invalid or duplicate resolution decision.');
      choices.set(d.label, d);
    }
    let next = clone(catalog);
    const groups = new Map(), errors = [];
    const rows = references.map((input, index) => {
      const row = { ...clone(input), index, originalLabel: input.exercise, status: 'excluded' };
      if (!input.include) return row;
      const label = input.exercise;
      if (typeof label !== 'string' || !label.trim()) { errors.push(`Set ${index + 1}: supply an exercise.`); return row; }
      if (!groups.has(label)) {
        const byId = catalog.exercises.find(e => e.id === label);
        const id = byId?.id ?? ExerciseIdentity.resolveLabel(catalog, label);
        const exercise = catalog.exercises.find(e => e.id === id), decision = choices.get(label);
        const group = { label, exerciseId: id, displayName: exercise?.displayName, count: 0,
          status: id ? (byId || exercise.displayName === label ? 'canonical' : 'alias') : 'unresolved' };
        if (decision) {
          if (decision.kind === 'skip') group.status = 'skipped';
          else if (decision.kind === 'map') {
            const target = catalog.exercises.find(e => e.id === decision.exerciseId);
            if (!target || (id && id !== target.id)) group.error = 'Mapping conflicts with saved exercise identity. Review again.';
            else {
              group.exerciseId = target.id; group.displayName = target.displayName; group.status = 'mapped';
              // An ID is an input reference, not an alias to save.
              if (!byId) next = ExerciseIdentity.addAlias(next, { label, exerciseId: target.id, provenance: 'user-created' });
            }
          } else if (id) group.error = 'This label now exists. Review again before creating an exercise.';
          else {
            group.status = 'new'; group.displayName = label;
            if (materialize) {
              const temporary = { exerciseLibrary: {} }; ensureExercise(temporary, label);
              const meta = temporary.exerciseLibrary[label];
              next = ExerciseIdentity.createExercise(next, { displayName: label, provenance: 'import-created', ...meta, metadata: meta });
              group.exerciseId = ExerciseIdentity.resolveLabel(next, label);
            }
          }
        }
        groups.set(label, group);
      }
      const group = groups.get(label); group.count++;
      row.status = group.status; row.exerciseId = group.exerciseId;
      row.originalLabel = catalog.exercises.find(e => e.id === label)?.displayName ?? label;
      if (group.status === 'skipped') row.include = false;
      if (group.error || group.status === 'unresolved') errors.push(`Set ${index + 1}: ${group.error ?? 'choose an existing exercise, create new, or skip.'}`);
      return row;
    });
    return { catalog: next, rows, groups: [...groups.values()], errors,
      included: rows.filter(r => r.include).length, excluded: rows.filter(r => !r.include).length };
  }
  function prepare(catalog, draft) {
    const result = review(catalog, draft.sets, draft.resolutions, { materialize: true });
    if (result.errors.length) throw Error(result.errors.join('\n'));
    const resolved = clone(draft);
    resolved.sets = result.rows.map(row => ({ ...row, exercise: row.exerciseId ?? row.exercise }));
    const errors = validateDraft(resolved);
    if (errors.length) throw Error(errors.join('\n'));
    return { ...result, draft: resolved };
  }
  return Object.freeze({ review, prepare });
})();
