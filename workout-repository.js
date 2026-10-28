// Opt-in #39 foundation. Not loaded by the workout UI. No DOM or local storage.
const WorkoutRepository = (() => {
  const clone = (x) => structuredClone(x);
  const check = (x, message) => { if (!x) throw Error(message); };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const tables = ["workout_state", "templates", "template_slots", "sessions", "snapshot_slots", "sets", "bodyweights",
    "guidance", "guided_slots", "guided_requests", "imports", "session_notes", "exercise_session_notes", "exercise_setup_notes"];
  // Mapped columns contain facts; extra contains only the remaining source keys.
  const mappings = {
    templates: { id: "template_id", name: "name", focus: "focus", intensity: "intensity" },
    template_slots: { role: "role", short: "short" },
    sessions: { id: "session_id", date: "workout_date", status: "status", createdAt: "created_at", completedAt: "completed_at", templateId: "template_origin_id", duration: "duration" },
    snapshot_slots: { id: "plan_slot_id", role: "role" },
    sets: { id: "set_id", date: "workout_date", weight: "weight", unit: "unit", reps: "reps", rpe: "rpe", rir: "rir", pain: "pain", painArea: "pain_area", notes: "notes", source: "source", complete: "complete", sessionId: "session_id", planSlotId: "plan_slot_id" },
    bodyweights: { date: "workout_date", value: "value" },
    guidance: { currentSlotId: "current_slot_id", revision: "revision" },
    guided_slots: { planSlotId: "plan_slot_id", status: "status" },
    guided_requests: { id: "request_id", setId: "set_id", signature: "signature" },
    imports: { importId: "import_id", date: "workout_date", setCount: "set_count" },
    session_notes: { sessionId: "session_id", text: "text" },
    exercise_session_notes: { sessionId: "session_id", planSlotId: "plan_slot_id", text: "text" },
    exercise_setup_notes: { text: "text" },
  };
  function representable(value) {
    if (typeof value === "string") check(!value.includes("\0") &&
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value), "PostgreSQL cannot preserve this text.");
    else if (Array.isArray(value)) value.forEach(representable);
    else if (isObject(value)) Object.entries(value).forEach(([k,v])=>{ representable(k); representable(v); });
  }
  function references(data) {
    const refs = [];
    data.sets.forEach(r => refs.push([r, "exercise"]));
    data.program.templates.forEach(t => t.slots.forEach(r => refs.push([r, "exercise"])));
    data.sessions.forEach(s => {
      s.planSnapshot?.slots.forEach(r => refs.push([r, "exercise"]));
      s.guided?.slots.forEach(r => refs.push([r, "actualExercise"]));
    });
    data.noteScopes.exercise.forEach(r => refs.push([r, "exercise"]));
    data.noteScopes.exerciseSession.forEach(r => refs.push([r, "exercise"]));
    return refs;
  }
  function validate(document) {
    check(document.sourceSchemaVersion === 8, "Repository requires current scoped-note source schema.");
    ExerciseIdentity.restoreV2Source(document);
    representable(document);
  }
  function pack(type, source, owner, position, omitted = [], refField) {
    const extra = clone(source), present = Object.keys(source).sort(), row = { owner_id: owner, position, present, extra };
    for (const [key, column] of Object.entries(mappings[type] ?? {})) {
      row[column] = source[key] ?? null;
      delete extra[key];
    }
    for (const key of omitted) delete extra[key];
    if (refField) {
      row.exercise_id = source[refField].exerciseId;
      row.original_label = source[refField].originalLabel;
      delete extra[refField];
    }
    return row;
  }
  function unpack(type, row, refField) {
    check(Array.isArray(row.present) && isObject(row.extra), "Invalid relational extension metadata.");
    const source = clone(row.extra);
    for (const [key, column] of Object.entries(mappings[type] ?? {})) {
      check(!Object.hasOwn(source, key), "Extension shadows a stored fact.");
      if (row.present.includes(key)) source[key] = row[column];
    }
    if (refField) source[refField] = { exerciseId: row.exercise_id, originalLabel: row.original_label };
    return source;
  }
  function project(document, owner, bodyweightIds) {
    validate(document);
    check(uuid.test(owner), "Authenticated owner UUID required.");
    check(Array.isArray(bodyweightIds) && bodyweightIds.length === document.data.bodyweights.length && new Set(bodyweightIds).size === bodyweightIds.length && bodyweightIds.every(x => typeof x === "string" && x), "Supply persistent relational bodyweight keys.");
    const rows = Object.fromEntries(tables.map(t => [t, []]));
    const data = document.data;
    const root = clone(document); delete root.catalog; delete root.data;
    const extra = clone(data);
    for (const key of ["sets", "bodyweights", "sessions", "activeSessionId", "program", "imports", "noteScopes"]) delete extra[key];
    const program = clone(data.program); delete program.templates; delete program.activeTemplateId; delete program.activeDuration;
    const notes = clone(data.noteScopes); for (const key of ["session", "exerciseSession", "exercise"]) delete notes[key];
    rows.workout_state.push({ owner_id: owner, model_version: 1, selected_template_id: data.program.activeTemplateId,
      duration: data.program.activeDuration, document_extra: root, extra, program_extra: program, notes_extra: notes });
    data.program.templates.forEach((t, i) => {
      rows.templates.push(pack("templates", t, owner, i, ["slots"]));
      t.slots.forEach((s, j) => rows.template_slots.push({ ...pack("template_slots", s, owner, j, [], "exercise"), template_id: t.id }));
    });
    data.sessions.forEach((s, i) => {
      const row = pack("sessions", s, owner, i, ["planSnapshot", "setIds", "guided"]);
      row.snapshot_name = s.planSnapshot?.name ?? null;
      row.snapshot_extra = s.planSnapshot ? clone(s.planSnapshot) : null;
      if (row.snapshot_extra) { delete row.snapshot_extra.name; delete row.snapshot_extra.slots; }
      rows.sessions.push(row);
      s.planSnapshot?.slots.forEach((slot, j) => rows.snapshot_slots.push({ ...pack("snapshot_slots", slot, owner, j, [], "exercise"), session_id: s.id }));
      if (s.guided) {
        rows.guidance.push({ ...pack("guidance", s.guided, owner, 0, ["slots", "requests"]), session_id: s.id });
        s.guided.slots.forEach((slot, j) => rows.guided_slots.push({ ...pack("guided_slots", slot, owner, j, [], "actualExercise"), session_id: s.id }));
        s.guided.requests.forEach((r, j) => rows.guided_requests.push({ ...pack("guided_requests", r, owner, j), session_id: s.id }));
      }
    });
    data.sets.forEach((s, i) => rows.sets.push({ ...pack("sets", s, owner, i, [], "exercise"),
      session_position: s.sessionId == null ? null : data.sessions.find(r => r.id === s.sessionId).setIds.indexOf(s.id) }));
    data.bodyweights.forEach((r, i) => rows.bodyweights.push({ ...pack("bodyweights", r, owner, i), bodyweight_id: bodyweightIds[i] }));
    data.imports.forEach((r, i) => rows.imports.push(pack("imports", r, owner, i)));
    for (const [scope, table] of [["session", "session_notes"], ["exerciseSession", "exercise_session_notes"], ["exercise", "exercise_setup_notes"]])
      data.noteScopes[scope].forEach((r, i) => rows[table].push(pack(table, r, owner, i, [], scope === "session" ? undefined : "exercise")));
    return { ...rows, ...ExerciseIdentity.databaseRows(document, owner) };
  }
  function assemble(rows, owner) {
    check(uuid.test(owner), "Authenticated owner UUID required.");
    for (const table of [...tables, "exercises", "aliases"])
      check(Array.isArray(rows[table]) && rows[table].every(r => r.owner_id === owner), "Incomplete or cross-owner database response.");
    check(rows.workout_state.length === 1 && rows.workout_state[0].model_version === 1, "Uninitialized or unsupported relational state.");
    const sorted = (t, id) => rows[t].filter(r => id === undefined || r.session_id === id).slice().sort((a,b) => a.position-b.position);
    const r = rows.workout_state[0];
    const document = { ...clone(r.document_extra), catalog: {
      exercises: rows.exercises.map(e => ({ id: e.exercise_id, displayName: e.display_name, primary: e.primary_muscle,
        secondary: clone(e.secondary_muscles), pattern: e.movement_pattern, equipment: e.equipment, type: e.exercise_type,
        state: e.state, provenance: e.provenance, metadata: clone(e.metadata) })),
      aliases: rows.aliases.map(a => ({ label: a.label, exerciseId: a.exercise_id, provenance: a.provenance })),
    }, data: { ...clone(r.extra), program: { ...clone(r.program_extra), activeTemplateId: r.selected_template_id, activeDuration: r.duration,
      templates: sorted("templates").map(t => ({ ...unpack("templates",t), slots: rows.template_slots.filter(s => s.template_id === t.template_id).sort((a,b)=>a.position-b.position).map(s=>unpack("template_slots",s,"exercise")) })) },
      sets: sorted("sets").map(s=>unpack("sets",s,"exercise")), bodyweights: sorted("bodyweights").map(b=>unpack("bodyweights",b)),
      imports: sorted("imports").map(i=>unpack("imports",i)), sessions: [], activeSessionId: null,
      noteScopes: { ...clone(r.notes_extra) } } };
    document.data.sessions = sorted("sessions").map(s => {
      const session = { ...unpack("sessions",s), planSnapshot: s.snapshot_name === null ? null : { ...clone(s.snapshot_extra), name: s.snapshot_name,
        slots: sorted("snapshot_slots",s.session_id).map(x=>unpack("snapshot_slots",x,"exercise")) },
        setIds: rows.sets.filter(x=>x.session_id===s.session_id).sort((a,b)=>a.session_position-b.session_position).map(x=>x.set_id) };
      const g = rows.guidance.find(x=>x.session_id===s.session_id);
      if (g) session.guided = { ...unpack("guidance",g), slots: sorted("guided_slots",s.session_id).map(x=>unpack("guided_slots",x,"actualExercise")),
        requests: sorted("guided_requests",s.session_id).map(x=>unpack("guided_requests",x)) };
      return session;
    });
    document.data.activeSessionId = document.data.sessions.find(s=>s.status==="active")?.id ?? null;
    for (const [scope,table] of [["session","session_notes"],["exerciseSession","exercise_session_notes"],["exercise","exercise_setup_notes"]])
      document.data.noteScopes[scope] = sorted(table).map(x=>unpack(table,x,scope === "session" ? undefined : "exercise"));
    validate(document);
    // Reject extra/orphan rows, duplicate/order corruption and shadowed fields by
    // reprojecting the entire model; row order from PostgREST is immaterial.
    const keys = sorted("bodyweights").map(x=>x.bodyweight_id);
    const projected = project(document, owner, keys);
    check(equalRows(projected,rows), "Relational content/relationships failed reconstruction.");
    return { document, bodyweightIds: keys };
  }
  function equalRows(a,b) {
    function sorted(x) { return Array.isArray(x) ? x.map(sorted) : isObject(x) ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])) : x; }
    const normalize = x=>Object.fromEntries(Object.keys(x).sort().map(t=>[t,x[t].map(r=>JSON.stringify(sorted(r))).sort()]));
    return sameSessionData(normalize(a),normalize(b));
  }
  // Transport is one authenticated RPC call; load never relies on capped table
  // SELECTs. SQL returns all owner rows in a single consistent snapshot.
  function create({ client, ownerId }) {
    check(uuid.test(ownerId), "Verified authenticated owner UUID required.");
    async function rpc(name, args) {
      const result = await client.rpc(name, args);
      check(!result.error && result.data, "Database operation was not acknowledged.");
      return result.data;
    }
    return Object.freeze({
      async load() {
        const rows = await rpc("gymbro_workout_read", {});
        if (rows.workout_state?.length === 0) {
          check(tables.slice(1).every(t=>rows[t]?.length===0), "Uninitialized account has orphan workout rows.");
          return { initialized: false };
        }
        return { initialized: true, ...assemble(rows,ownerId) };
      },
      async commit(before, after) {
        const oldRows = before ? project(before.document, ownerId, before.bodyweightIds) : null;
        const newRows = project(after.document, ownerId, after.bodyweightIds);
        const rows = await rpc("gymbro_workout_commit", { previous_rows: oldRows, next_rows: newRows });
        const saved = assemble(rows,ownerId);
        // Read order for canonical catalog rows is unspecified.
        check(equalRows(project(saved.document,ownerId,saved.bodyweightIds),newRows), "Database acknowledgement differs from submitted facts.");
        return saved;
      },
    });
  }
  function createActions({ initial, repository, createId, now, createBodyweightId = () => crypto.randomUUID() }) {
    validate(initial.document);
    let committed = clone(initial), pending = false;
    const state = () => clone(committed.document);
    return Object.freeze({ getWorkoutState: state,
      async execute(name, ...args) {
        if (pending) return { ok: false, code: "PERSISTENCE_ERROR", errors: ["An action is pending."], changes: [], state: state() };
        pending = true;
        let saving = false;
        try {
          const document = state(), dto = clone(document.data);
          dto.version = 8;
          dto.exerciseLibrary = Object.fromEntries(document.catalog.exercises.map(e=>[e.id,{ primary:e.primary, secondary:clone(e.secondary), pattern:e.pattern, type:e.type, status:e.state }]));
          references(dto).forEach(([r,k])=>{ r[k]=r[k].exerciseId; });
          // Legacy request signatures retain their original bytes in storage.
          // The private candidate view compares their known exercise field by
          // canonical identity, just like every other domain reference.
          dto.sessions.forEach(s=>s.guided?.requests.forEach(r=> {
            try { const p=JSON.parse(r.signature); if(isObject(p) && typeof p.exercise==="string") {
              const id=ExerciseIdentity.resolveLabel(document.catalog,p.exercise);
              if(id) r.signature=guidedRequestSignature({...p,exercise:id});
            } } catch { /* Opaque historical signatures are never reinterpreted. */ }
          }));
          const actions = createWorkoutActions({ getState:()=>dto, createId, now, prepareOnly:true });
          // Only mutation APIs, never arbitrary selectors/prototype access.
          check(["logSet","editSet","deleteSet","logBodyweight","selectPlan","clearPlan","toggleSlotShort","cycleSlotRole","addSlot","removeSlot","createSession","completeSession","attachSetToSession","startGuidedSession","enableGuidance","selectGuidedSlot","moveGuidedSlot","setGuidedSlotStatus","substituteGuidedExercise","logGuidedSet","finishGuidedSession","saveScopedNote","commitImport"].includes(name), "Unsupported repository action.");
          // Inputs use the existing `exercise` property with a canonical UUID.
          for (const input of args) if (isObject(input) && Object.hasOwn(input,"exercise"))
            check(document.catalog.exercises.some(e=>e.id===input.exercise), "Canonical exercise ID required.");
          if(name === "commitImport") for(const row of args[0]?.sets ?? []) check(document.catalog.exercises.some(e=>e.id===row.exercise), "Resolve reviewed import labels to canonical IDs first.");
          const result = actions[name](...clone(args));
          if (!result.ok || result.code !== "PREPARED") return { ...result, state:state() };
          const next = result.state;
          const retain = (r,k,prior,input) => {
            const id=r[k], exercise=document.catalog.exercises.find(e=>e.id===id);
            check(exercise, "Canonical exercise ID required.");
            const supplied = prior?.[k]?.exerciseId===id || input?.exercise!==id ? undefined : input?.originalLabel;
            if(supplied !== undefined) check(ExerciseIdentity.resolveLabel(document.catalog,supplied)===id,"Original label must resolve to canonical ID.");
            r[k]=prior?.[k]?.exerciseId===id ? clone(prior[k]) : {exerciseId:id,originalLabel:supplied ?? exercise.displayName};
            if (!Object.hasOwn(document.legacyExerciseLibrary,r[k].originalLabel)) document.legacyExerciseLibrary[r[k].originalLabel] = {
              primary:exercise.primary, secondary:clone(exercise.secondary), pattern:exercise.pattern, type:exercise.type, status:exercise.state };
          };
          next.sets.forEach(s=> {
            const importIndex=result.setIds?.indexOf(s.id) ?? -1;
            retain(s,"exercise",document.data.sets.find(p=>p.id===s.id),name==="commitImport" && importIndex>=0 ? args[0].sets.filter(r=>r.include)[importIndex] : args.find(isObject));
          });
          next.program.templates.forEach(t=>t.slots.forEach((s,i)=> {
            const index=name==="removeSlot" && args[0].templateId===t.id && i>=args[0].index ? i+1 : i;
            retain(s,"exercise",document.data.program.templates.find(p=>p.id===t.id)?.slots[index],args.find(isObject));
          }));
          next.sessions.forEach(s=> {
            const old=document.data.sessions.find(p=>p.id===s.id);
            const template=document.data.program.templates.find(t=>t.id===s.templateId);
            const planned=template ? snapshotPlan(template,s.duration) : null;
            s.planSnapshot?.slots.forEach(p=>retain(p,"exercise",old?.planSnapshot?.slots.find(q=>q.id===p.id) ?? planned?.slots.find(q=>q.id===p.id)));
            s.guided?.slots.forEach(p=>retain(p,"actualExercise",old?.guided?.slots.find(q=>q.planSlotId===p.planSlotId) ??
              {actualExercise:s.planSnapshot?.slots.find(q=>q.id===p.planSlotId)?.exercise},args.find(isObject)));
            s.guided?.requests.forEach(r=>{ const prior=old?.guided?.requests.find(p=>p.id===r.id); if(prior) r.signature=prior.signature; });
          });
          for(const scope of ["exercise","exerciseSession"]) next.noteScopes[scope].forEach(n=>retain(n,"exercise",document.data.noteScopes[scope].find(p=>
            p.exercise.exerciseId===n.exercise && p.sessionId===n.sessionId && p.planSlotId===n.planSlotId),args.find(isObject)));
          delete next.version; delete next.exerciseLibrary;
          document.data = next;
          const keys = committed.bodyweightIds.slice();
          while(keys.length < next.bodyweights.length) keys.push(createBodyweightId());
          saving = true;
          const saved = await repository.commit(committed,{document,bodyweightIds:keys});
          committed = clone(saved);
          return { ...result, code:"OK", state:state() };
        } catch {
          return { ok:false, code:saving ? "PERSISTENCE_ERROR" : "VALIDATION_ERROR", errors:[saving ? "Workout was not committed; inspect saved state before retrying." : "Invalid canonical workout action."], changes:[], state:state() };
        } finally { pending = false; }
      },
    });
  }
  return Object.freeze({ MODEL_VERSION:1, tables:Object.freeze(tables), project, assemble, create, createActions });
})();
