// Unwired #17 candidate/compatibility audit. Never loaded by the application.
// No persistence or merge transport exists here; identity-v1 refuses merge.
const ExerciseCatalog = (() => {
  const clone = x => structuredClone(x);
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const editable = ['primary', 'secondary', 'pattern', 'equipment', 'type', 'state'];
  function prepare(base, action, args) {
    check(base.status === 'healthy', 'Load healthy cloud data first.');
    const candidate = clone(base), document = candidate.document, input = args[0];
    const catalog = document.catalog;
    const row = catalog.exercises.find(e => e.id === input.exerciseId);
    check(row && !row.metadata.gymbroMerge, 'Select an unmerged exercise.');
    if (action === 'editCatalogExercise') {
      document.catalog = ExerciseIdentity.renameExercise(catalog, row.id, input.displayName);
      const next = document.catalog.exercises.find(e => e.id === row.id);
      for (const key of editable) if (Object.hasOwn(input, key)) next[key] = clone(input[key]);
    } else if (action === 'addCatalogAlias') {
      document.catalog = ExerciseIdentity.addAlias(catalog, {exerciseId: row.id, label: input.label, provenance: 'user-created'});
    } else if (action === 'mergeCatalogExercises') {
      check(input.confirmed === true && typeof input.keepNameAlias === 'boolean', 'Review and confirm this merge.');
      const target = catalog.exercises.find(e => e.id === input.targetId);
      check(target && target.id !== row.id && !target.metadata.gymbroMerge, 'Select a different unmerged destination.');
      for (const scope of ['exercise', 'exerciseSession']) {
        const keys = new Set();
        for (const note of document.data.noteScopes[scope]) {
          const id = note.exercise.exerciseId === row.id ? target.id : note.exercise.exerciseId;
          const key = JSON.stringify([id, note.sessionId ?? null, note.planSlotId ?? null]);
          check(!keys.has(key), 'Resolve conflicting setup or occurrence notes before merging.');
          keys.add(key);
        }
      }
      const affected = {};
      const visit = (record, key, path) => {
        if (record[key].exerciseId !== row.id) return;
        (affected[path.split(':')[0]] ??= []).push(path);
        record[key].exerciseId = target.id;
      };
      document.data.sets.forEach(r => visit(r, 'exercise', 'set:' + r.id));
      document.data.program.templates.forEach(t => t.slots.forEach((r, i) => visit(r, 'exercise', `template:${t.id}:${i}`)));
      document.data.sessions.forEach(s => {
        s.planSnapshot?.slots.forEach(r => visit(r, 'exercise', `snapshot:${s.id}:${r.id}`));
        s.guided?.slots.forEach(r => visit(r, 'actualExercise', `guided:${s.id}:${r.planSlotId}`));
      });
      for (const scope of ['exercise', 'exerciseSession']) document.data.noteScopes[scope].forEach((r, i) => visit(r, 'exercise', `note:${scope}:${i}`));
      const previous = clone(row), aliases = clone(catalog.aliases.filter(a => a.exerciseId === row.id));
      catalog.aliases.forEach(a => { if (a.exerciseId === row.id) a.exerciseId = target.id; });
      row.state = 'archived';
      row.metadata.gymbroMerge = {sourceId: row.id, targetId: target.id, sourceName: row.displayName,
        targetName: target.displayName, ownerId: base.ownerId, operation: null, mergedAt: null,
        previous, aliases, affected, excludedLabel: input.keepNameAlias ? null : row.displayName};
    } else throw Error('Unsupported catalog operation.');
    ExerciseIdentity.restoreV2Source(document);
    return {candidate, result: {ok: true, code: 'PREPARED', changes: ['catalog'], exerciseId: input.targetId ?? row.id}};
  }
  function suggestions(catalog, exerciseId) {
    const source = catalog.exercises.find(e => e.id === exerciseId);
    if (!source || source.metadata.gymbroMerge) return [];
    const words = name => new Set(name.toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(Boolean));
    const a = words(source.displayName);
    return catalog.exercises.filter(e => e.id !== exerciseId && !e.metadata.gymbroMerge && (() => {
      const b = words(e.displayName), shared = [...a].filter(w => b.has(w)).length;
      return shared >= 2 && shared / Math.max(a.size, b.size) >= 0.6;
    })()).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  function selectable(catalog, id) { const row = catalog.exercises.find(e => e.id === id); return row?.state === 'active' && !row.metadata.gymbroMerge; }
  return Object.freeze({prepare, suggestions, selectable});
})();
