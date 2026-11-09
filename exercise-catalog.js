// Detached catalog candidates. One checked catalog RPC owns durable mutation.
const ExerciseCatalog = (() => {
  const clone = x => structuredClone(x);
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const editable = ['primary', 'secondary', 'pattern', 'equipment', 'type', 'state'];
  function prepare(base, action, args) {
    check(base.status === 'healthy', 'Load healthy cloud data first.');
    const candidate = clone(base), document = candidate.document, input = args[0];
    const catalog = document.catalog;
    const beforeRows = WorkoutRepository.project(base.document, base.ownerId, base.bodyweightIds, base.signatureSchemes);
    document.identityVersion = 2;
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
      const keys = {template_slots:['template_id','position'],snapshot_slots:['session_id','plan_slot_id'],sets:['set_id'],guided_slots:['session_id','plan_slot_id'],exercise_session_notes:['session_id','exercise_id','plan_slot_id'],exercise_setup_notes:['exercise_id']};
      const auditAffected = Object.fromEntries(Object.entries(keys).map(([table,columns]) => [table, beforeRows[table].filter(r => r.exercise_id === row.id).map(r => columns.map(c => r[c])).sort((a,b) => JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0)]));
      const previous = clone(beforeRows.exercises.find(e => e.exercise_id === row.id)), aliases = clone(beforeRows.aliases.filter(a => a.exercise_id === row.id)).sort((a,b)=>a.label<b.label?-1:a.label>b.label?1:0);
      catalog.aliases.forEach(a => { if (a.exerciseId === row.id) a.exerciseId = target.id; });
      row.state = 'archived';
      row.metadata.gymbroMerge = {sourceId: row.id, targetId: target.id, sourceName: row.displayName,
        targetName: target.displayName, ownerId: base.ownerId, operation: null, mergedAt: null,
        previous, aliases, affected:auditAffected, excludedLabel: input.keepNameAlias ? null : row.displayName};
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
  const actions = ['editCatalogExercise','addCatalogAlias','mergeCatalogExercises'];
  function createRepository({client,ownerId}) {
    const domain=WorkoutRepository.create({client,ownerId}), lifecycle=WorkoutLifecycle.createRepository({client,ownerId});
    return Object.freeze({ownerId,load:lifecycle.load,resolve:lifecycle.resolve,
      prepare(before,after,context) {
        const packet=clone(domain.prepare(before,after,context));
        const source=packet.next.exercises.find(e=>e.exercise_id===context.args[0].exerciseId);
        if(context.action==='mergeCatalogExercises') source.metadata.gymbroMerge.operation=clone(context.operation);
        return packet;
      },
      async submit(packet) {
        const reply=await client.rpc('gymbro_catalog_mutate',{packet});
        if(reply.error) {
          if(/^(?:22|23|42|P0001)/.test(reply.error.code??''))return {code:reply.error.code==='42501'?'AUTHORIZATION_ERROR':'VALIDATION_ERROR'};
          throw OperationalDiagnostics.transport(reply.error);
        }
        const value=reply.data;
        check(value && sameSessionData(value.operation,packet.operation),'Wrong catalog acknowledgement.');
        const raw=value.snapshot;
        check(raw?.ownerId===ownerId && raw.protocolVersion===1 && WorkoutConcurrency.revision(raw.revision) && raw.status==='healthy','Invalid catalog snapshot.');
        const saved={...raw,initialized:true,...WorkoutRepository.assemble(raw.rows,ownerId)};
        if(['OK','REPLAY'].includes(value.code))check(WorkoutConcurrency.revision(value.operationRevision)&&BigInt(value.operationRevision)<=BigInt(raw.revision),'Invalid catalog receipt.');
        if(value.code==='OK') {
          const expected=clone(packet.next);
          if(packet.action==='mergeCatalogExercises') {
            check(typeof value.result?.mergedAt==='string' && new Date(value.result.mergedAt).toISOString()===value.result.mergedAt,'Missing server merge time.');
            expected.exercises.find(e=>e.exercise_id===packet.args[0].exerciseId).metadata.gymbroMerge.mergedAt=value.result.mergedAt;
          }
          check(WorkoutLifecycle.equalRows(expected,raw.rows),'Catalog acknowledgement differs from requested changes.');
        }
        return {code:value.code,saved,result:value.result,operationRevision:value.operationRevision};
      }});
  }
  return Object.freeze({actions,createRepository,prepare, suggestions, selectable});
})();
