// Collection preparation only; all persistence stays in the checked lifecycle path.
const BatchImport = (() => {
  const clone = x => structuredClone(x), check = (ok, text) => { if (!ok) throw Error(text); };
  const canonical = x => Array.isArray(x) ? x.map(canonical) : isObject(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
  const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  async function digest(x) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(x)))))].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  async function stableId(x) { const h=await digest(x);return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; }
  function references(data) {
    const refs=[];const add=(row,key)=>refs.push([row,key]);
    data.sets.forEach(r=>add(r,'exercise'));
    data.sessions.forEach(s=>{s.planSnapshot?.slots.forEach(r=>add(r,'exercise'));s.guided?.slots.forEach(r=>add(r,'actualExercise'));});
    for(const scope of ['exercise','exerciseSession'])data.noteScopes[scope].forEach(r=>add(r,'exercise'));
    return refs;
  }
  const marker = row => row?.batchImport?.format==='gymbro-workout-unit' && row.batchImport.version===1 ? row.batchImport : null;
  function append(target, incoming, key, label) {
    for(const row of incoming){const previous=target.find(r=>key(r)===key(row));check(!previous||equal(previous,row),`Conflicting ${label} identity; no selected workouts were saved.`);if(!previous)target.push(clone(row));}
  }
  async function parse(payload, owner, fixtureTag) {
    check(isObject(payload)&&payload.format==='gymbro-workout-batch'&&payload.formatVersion===1,'Unsupported batch envelope/version.');
    check(Array.isArray(payload.workouts)&&payload.workouts.length>0,'A batch needs a nonempty workouts collection.');
    check(payload.batchId===undefined||(typeof payload.batchId==='string'&&payload.batchId.length>0),'Invalid batch ID.');
    check(payload.source===undefined||typeof payload.source==='string','Invalid batch source.');
    const envelopeDigest=await digest(payload),batchId=payload.batchId??`batch-v1:${envelopeDigest}`,units=[];
    for(const [index,item] of payload.workouts.entries()){
      const unit={index,errors:[],status:'new'};units.push(unit);
      try{
        check(isObject(item)&&Object.hasOwn(item,'workout')!==Object.hasOwn(item,'history'),'Each item needs exactly one workout or history payload.');
        check(item.importId===undefined||(typeof item.importId==='string'&&item.importId.length>0),'Invalid workout import ID.');
        unit.digest=await digest(item);unit.kind=Object.hasOwn(item,'workout')?'workout':'history';
        if(unit.kind==='workout'){
          unit.draft=normalizeInboxPayload(item.workout);
          const src=item.workout.session??item.workout.workout??item.workout;
          const inner=item.workout.importId??item.workout.import_id??src.importId??src.import_id;
          check(item.importId===undefined||inner==null||item.importId===inner,'Wrapper and workout import IDs disagree.');
          if(item.importId)unit.draft.importId=item.importId;
          unit.id=unit.draft.importId;unit.date=unit.draft.date;
          if(unit.draft.sets.some(r=>r.include&&(!r.complete||r.weight==null||r.reps==null)))unit.warning='Includes incomplete/approximate sets; existing performance eligibility is preserved.';
          unit.refs=unit.draft.sets.map((r,i)=>({exercise:r.exercise,include:r.include,key:i}));
        }else{
          const source=item.history;
          unit.historySourceMetadata=source?.format==='gymbro-cloud-backup'?clone(Object.fromEntries(Object.entries(source).filter(([key])=>key!=='payload'))):null;
          if(fixtureTag)check((source?.payload?.document?.data??source)?.extension?.previewMigrationFixture===fixtureTag,'Preview historical sources must carry the configured synthetic fixture tag.');
          let bodyweightIndex=0;
          const keys=[];
          const rawCount=source?.bodyweights?.length??0;
          unit.id=item.importId??`history-v1:${unit.digest}`;
          for(let i=0;i<rawCount;i++)keys.push(await stableId(['batch-bodyweight-v1',unit.id,i]));
          unit.history=await WorkoutLifecycle.parse(JSON.stringify(source),owner,{createBodyweightId:()=>keys[bodyweightIndex++]});
          const data=unit.history.document.data;
          check(!data.activeSessionId&&data.sessions.length<=1&&data.sessions.every(s=>s.status==='completed'),'History must contain one completed session or sessionless facts, never an active/multi-session unit.');
          check(data.sessions.length?data.sets.every(s=>s.sessionId===data.sessions[0].id):data.sets.every(s=>!s.sessionId),'History contains unrelated session facts.');
          const dates=new Set([...data.sets,...data.sessions,...data.bodyweights].map(r=>r.date));
          check(dates.size===1&&validDate([...dates][0]),'History must have one supplied workout date.');
          unit.date=[...dates][0];unit.sessionId=data.sessions[0]?.id;
          unit.refs=references(data).map(([r,k],i)=>({exercise:r[k].originalLabel,include:true,key:i,sourceId:unit.history.kind==='cloud'?r[k].exerciseId:null}));
        }
      }catch(error){unit.errors=[error.message];unit.status='blocked';}
    }
    return {batchId,envelopeDigest,source:payload.source??null,provenance:clone(payload.provenance??null),units};
  }
  async function review(base,payload,{selected,resolutions=[],materialize=false,fixtureTag}={}) {
    check(base.status==='healthy','Load a healthy cloud account before reviewing a batch.');
    const parsed=await parse(payload,base.ownerId,fixtureTag),chosen=new Set(selected??parsed.units.map(u=>u.index));
    check([...chosen].every(i=>Number.isInteger(i)&&i>=0&&i<parsed.units.length),'Invalid selected workout.');
    const candidate=clone(base),errors=[],units=parsed.units;
    const savedImports=base.document.data.imports;
    for(const row of savedImports){const m=marker(row);if(m?.batchId===parsed.batchId)check(m.envelopeDigest===parsed.envelopeDigest,'Batch ID belongs to different contents.');}
    const pending=[];
    for(const u of units){
      if(!chosen.has(u.index)){u.status='excluded';continue;}
      if(u.errors.length){errors.push(`Workout ${u.index+1}: ${u.errors.join(' ')}`);continue;}
      const old=savedImports.find(r=>r.importId===u.id);
      if(old){const m=marker(old);if(m&&m.unitDigest!==u.digest){u.status='blocked';u.errors=['Import ID belongs to different contents.'];errors.push(`Workout ${u.index+1}: ${u.errors[0]}`);}else{u.status='duplicate';u.warning=m?'Already imported':'Already imported (legacy ID-only protection)';}continue;}
      if(u.kind==='history'&&u.refs.some(r=>resolutions.some(d=>d.label===r.exercise&&d.kind==='skip'))){u.status='excluded';u.warning='Entire history unit excluded by explicit exercise skip.';continue;}
      pending.push(u);
    }
    const allRefs=pending.flatMap(u=>u.refs.map(r=>({...r,unit:u.index}))),forced=new Map(),previewIds=new Map();
    const block=(index,message)=>{const u=units[index];if(!u.errors.includes(message)){u.status='blocked';u.errors.push(message);errors.push(`Workout ${index+1}: ${message}`);}};
    for(const r of allRefs)if(r.sourceId){
      if(forced.has(r.exercise)&&forced.get(r.exercise)!==r.sourceId)block(r.unit,'Conflicting supplied exercise IDs.');
      else forced.set(r.exercise,r.sourceId);
      if(resolutions.some(d=>d.label===r.exercise&&d.kind==='create')&&base.document.catalog.exercises.some(e=>e.id===r.sourceId))block(r.unit,'This canonical ID exists; explicitly map to it rather than create another exercise.');
    }
    const inputRefs=allRefs.filter(r=>units[r.unit].status!=='blocked');forced.clear();
    for(const r of inputRefs){
      if(r.sourceId)forced.set(r.exercise,r.sourceId);
      if(!previewIds.has(r.exercise))previewIds.set(r.exercise,await stableId(['batch-preview-exercise-v1',parsed.batchId,r.exercise]));
    }
    const resolution=ImportResolution.review(candidate.document.catalog,inputRefs,resolutions,{materialize:true,createId:label=>forced.get(label)??(materialize?crypto.randomUUID():previewIds.get(label))});
    for(const d of resolutions.filter(d=>d.kind==='skip'))if(!resolution.groups.some(g=>g.label===d.label)&&units.some(u=>chosen.has(u.index)&&u.kind==='history'&&u.refs?.some(r=>r.exercise===d.label)))resolution.groups.push({label:d.label,status:'skipped',count:0});
    for(const r of resolution.rows)if(r.include&&r.sourceId&&r.status!=='unresolved'&&r.exerciseId!==r.sourceId)block(r.unit,'A supplied canonical exercise ID cannot be retargeted.');
    candidate.document.catalog=resolution.catalog;
    for(const u of pending){
      if(u.status==='blocked')continue;
      const resolved=resolution.rows.filter(r=>r.unit===u.index);
      if(resolved.some(r=>r.status==='unresolved')||resolution.groups.some(g=>g.error&&resolved.some(r=>r.exercise===g.label))){u.status='blocked';u.errors=['Resolve the included exercise identities before confirmation.'];errors.push(`Workout ${u.index+1}: ${u.errors[0]}`);continue;}
      try{
        const prior=candidate.document.data.imports.find(r=>r.importId===u.id);
        if(prior){check(marker(prior)?.unitDigest===u.digest,'Conflicting import IDs inside batch.');u.status='duplicate';continue;}
        let imported;
        if(u.kind==='workout'){
          const draft=clone(u.draft);draft.sets=draft.sets.map((r,i)=>({...r,include:resolved[i].include,exercise:resolved[i].exerciseId??r.exercise,originalLabel:resolved[i].originalLabel}));
          const issues=validateDraft(draft);check(!issues.length,issues.join(' '));
          let bw=0;const keys=[];for(let i=0;i<(draft.bodyweight==null?0:1);i++)keys.push(await stableId(['batch-bodyweight-v1',u.id,i]));
          const prepared=await WorkoutRepository.prepareAction(candidate,'commitImport',[draft],{createId:()=>crypto.randomUUID(),createBodyweightId:()=>keys[bw++]});
          check(prepared.candidate,prepared.result.errors?.join(' ')??'Invalid workout.');
          candidate.document=prepared.candidate.document;candidate.bodyweightIds=prepared.candidate.bodyweightIds;candidate.signatureSchemes=prepared.candidate.signatureSchemes;
          imported=candidate.document.data.imports.find(r=>r.importId===u.id);
        }else{
          const incoming=clone(u.history),data=incoming.document.data;
          references(data).forEach(([r,k],i)=>{r[k]={exerciseId:resolved[i].exerciseId,originalLabel:resolved[i].originalLabel};});
          const existing=candidate.document.data;
          // Add records directly under existing validators, never use the lossy
          // generic merge's bodyweight/content deduplication or overwrite rules.
          append(existing.sets,data.sets,r=>r.id,'set');append(existing.sessions,data.sessions,r=>r.id,'session');
          append(existing.noteScopes.session,data.noteScopes.session,r=>r.sessionId,'session note');
          append(existing.noteScopes.exerciseSession,data.noteScopes.exerciseSession,r=>JSON.stringify([r.sessionId,r.exercise.exerciseId,r.planSlotId]),'occurrence note');
          append(existing.noteScopes.exercise,data.noteScopes.exercise,r=>r.exercise.exerciseId,'setup note');
          for(const [i,row] of data.bodyweights.entries()){
            const key=incoming.bodyweightIds[i],index=candidate.bodyweightIds.indexOf(key);
            check(index<0||equal(existing.bodyweights[index],row),'Conflicting bodyweight identity.');
            if(index<0){candidate.bodyweightIds.push(key);existing.bodyweights.push(clone(row));}
          }
          append(existing.imports,data.imports,r=>r.importId,'import provenance');
          for(const [key,value] of Object.entries(incoming.signatureSchemes)){check(!Object.hasOwn(candidate.signatureSchemes,key)||candidate.signatureSchemes[key]===value,'Conflicting signature metadata.');candidate.signatureSchemes[key]=value;}
          for(const [label,id] of forced)if(resolved.some(r=>r.sourceId===id)){
            const source=incoming.document.catalog.exercises.find(e=>e.id===id),current=base.document.catalog.exercises.find(e=>e.id===id);
            if(current)check(equal(source,current),'Canonical metadata conflicts; history cannot rewrite the catalog.');
            else{for(const a of incoming.document.catalog.aliases.filter(a=>a.exerciseId===id))candidate.document.catalog=ExerciseIdentity.addAlias(candidate.document.catalog,a);const target=candidate.document.catalog.exercises.findIndex(e=>e.id===id);candidate.document.catalog.exercises[target]=clone(source);}
          }
          imported={importId:u.id,date:u.date,setCount:data.sets.length,notes:'Batch historical import',committedAt:new Date().toISOString()};
          check(!existing.imports.some(r=>r.importId===u.id),'Historical import ID collides with supplied import provenance.');existing.imports.push(imported);
          // Source root/container metadata is provenance, not new current settings.
          imported.historyContext=clone(Object.fromEntries(Object.entries(data).filter(([key])=>!['sets','sessions','bodyweights','noteScopes','imports'].includes(key))));
          imported.historyNoteMetadata=clone(Object.fromEntries(Object.entries(data.noteScopes).filter(([key])=>!['session','exerciseSession','exercise'].includes(key))));
          imported.historyExerciseDefinitions=clone(incoming.document.legacyExerciseLibrary);
          imported.historyCatalog=clone(incoming.document.catalog);
          imported.historyIdentityMetadata=clone(Object.fromEntries(Object.entries(incoming.document).filter(([key])=>!['catalog','data','legacyExerciseLibrary'].includes(key))));
          imported.historySourceMetadata=clone(u.historySourceMetadata);
        }
        for(const r of resolved.filter(r=>r.include))if(!Object.hasOwn(candidate.document.legacyExerciseLibrary,r.originalLabel))candidate.document.legacyExerciseLibrary[r.originalLabel]=clone(u.history?.document.legacyExerciseLibrary[r.originalLabel]??{});
        imported.batchImport={format:'gymbro-workout-unit',version:1,batchId:parsed.batchId,envelopeDigest:parsed.envelopeDigest,unitDigest:u.digest,source:parsed.source,provenance:parsed.provenance,recordIds:u.kind==='history'?u.history.document.data.sets.map(r=>r.id):candidate.document.data.sets.filter(r=>r.importBatch===imported.batch).map(r=>r.id),excluded:resolved.filter(r=>!r.include).map(r=>r.key)};
        WorkoutLifecycle.validatePayload(candidate,base.ownerId);u.status='ready';u.count=imported.setCount;
      }catch(error){u.status='blocked';u.errors=[error.message];errors.push(`Workout ${u.index+1}: ${error.message}`);}
    }
    return { ...parsed,units,groups:resolution.groups,errors,candidate:errors.length?null:candidate,newCount:units.filter(u=>u.status==='ready').length };
  }
  async function prepare(base,input,options={}) {
    check(input.confirmed===true,'Confirm the selected batch explicitly.');
    const reviewed=await review(base,JSON.parse(input.text),{...options,selected:input.selected,resolutions:input.resolutions,materialize:true});
    check(!reviewed.errors.length,reviewed.errors.join('\n'));
    const batchDisposition=reviewed.units.map(u=>({index:u.index,importId:u.id,date:u.date,sessionId:u.sessionId??null,status:u.status==='ready'?'committed':u.status,count:u.count??0}));
    if(!reviewed.newCount)return {result:{ok:true,code:'NO_CHANGE',changes:[],batchDisposition}};
    return {candidate:reviewed.candidate,result:{ok:true,code:'PREPARED',changes:['workoutData'],batchDisposition}};
  }
  return Object.freeze({review,prepare,digest});
})();
