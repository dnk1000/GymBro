// #41 opt-in cloud lifecycle. No startup store access or automatic migration.
const WorkoutLifecycle = (() => {
  const clone = x => structuredClone(x);
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const rowsOf = (value, owner) => WorkoutRepository.project(value.document,owner,value.bodyweightIds,value.signatureSchemes);
  function validatePayload(value, owner) {
    check(isObject(value) && isObject(value.signatureSchemes), 'Missing cloud recovery metadata.');
    const rows = rowsOf(value,owner), reconstructed = WorkoutRepository.assemble(rows,owner);
    check(sameSessionData(reconstructed.bodyweightIds,value.bodyweightIds) &&
      sameSessionData(reconstructed.signatureSchemes,value.signatureSchemes), 'Invalid recovery keys or signature schemes.');
    // Assembly canonicalizes only the unordered catalog table inventory.
    check(WorkoutRepository.project(reconstructed.document,owner,reconstructed.bodyweightIds,reconstructed.signatureSchemes), 'Invalid recovery payload.');
    return clone({document:value.document,bodyweightIds:value.bodyweightIds,signatureSchemes:value.signatureSchemes});
  }
  function backup(handle, now = () => new Date().toISOString()) {
    check(handle.status==='healthy' && handle.initialized && uuid.test(handle.ownerId), 'A verified healthy cloud snapshot is required.');
    const payload=validatePayload({document:handle.document,bodyweightIds:handle.bodyweightIds,signatureSchemes:handle.signatureSchemes},handle.ownerId);
    return { format:'gymbro-cloud-backup',formatVersion:1,appVersion:APP_VERSION.version,
      source:{ownerId:handle.ownerId,revision:handle.revision,modelVersion:1,identityVersion:1,workoutVersion:8,exportedAt:now()},payload };
  }
  async function parse(text, owner, {catalog,createBodyweightId=()=>crypto.randomUUID()} = {}) {
    check(uuid.test(owner),'Authenticated destination owner required.');
    const file=JSON.parse(text);
    if (isObject(file) && (file.format==='gymbro-cloud-backup' ||
      (!Array.isArray(file.sets) && (Object.hasOwn(file,'format') || Object.hasOwn(file,'formatVersion'))))) {
      check(file.format==='gymbro-cloud-backup' && file.formatVersion===1,'Unsupported cloud backup format. Keep the original file.');
      check(file.source?.ownerId===owner,'This cloud backup belongs to a different account. Cross-account restore is not supported.');
      check(file.source.modelVersion===1 && file.source.identityVersion===1 && file.source.workoutVersion===8 &&
        WorkoutConcurrency.revision(file.source.revision),'Unsupported cloud backup source version.');
      return { ...validatePayload(file.payload,owner),sourceOwnerId:file.source.ownerId,kind:'cloud' };
    }
    // A future/malformed cloud file cannot fall through into legacy normalization.
    const source=file?.version===DATA_VERSION ? (validateData(file),clone(file)) : migrateData(file);
    const document=await ExerciseIdentity.migrateV2(source,catalog?{catalog}:{});
    return {...validatePayload({document,bodyweightIds:source.bodyweights.map(createBodyweightId),signatureSchemes:{}},owner),sourceOwnerId:null,kind:'legacy'};
  }
  function verifySafety(text, handle) {
    const file=JSON.parse(text);
    check(file.format==='gymbro-cloud-backup' && file.formatVersion===1 && file.source?.ownerId===handle.ownerId &&
      file.source?.revision===handle.revision && handle.status==='healthy','Select the saved recovery file for this account and current revision.');
    validatePayload(file.payload,handle.ownerId);
    check(equalRows(rowsOf(file.payload,handle.ownerId),rowsOf(handle,handle.ownerId)), 'The recovery file does not match all current cloud content.');
    return {ownerId:handle.ownerId,revision:handle.revision,fingerprint:handle.fingerprint};
  }
  function equalRows(a,b) {
    const canonical = value => Array.isArray(value)?value.map(canonical):isObject(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
    const ordered = rows => Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.map(canonical).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)))]));
    return sameSessionData(ordered(a),ordered(b));
  }
  function references(data, visit) {
    data.sets.forEach((r,i)=>visit(r,'exercise',`set:${r.id}`,i));
    data.program.templates.forEach(t=>t.slots.forEach((r,i)=>visit(r,'exercise',`template:${t.id}:${i}`)));
    data.sessions.forEach(s=>{
      s.planSnapshot?.slots.forEach(r=>visit(r,'exercise',`plan:${s.id}:${r.id}`));
      s.guided?.slots.forEach(r=>visit(r,'actualExercise',`guided:${s.id}:${r.planSlotId}`));
    });
    for(const scope of ['exercise','exerciseSession']) data.noteScopes[scope].forEach(r=>visit(r,'exercise',JSON.stringify([scope,r.sessionId,r.planSlotId,r.exercise.exerciseId??r.exercise])));
  }
  function merge(base,incoming,owner) {
    validatePayload(base,owner);validatePayload(incoming,owner);
    const catalog=clone(base.document.catalog);
    for(const e of incoming.document.catalog.exercises) if(!catalog.exercises.some(x=>x.id===e.id)) catalog.exercises.push(clone(e));
    for(const a of incoming.document.catalog.aliases) {
      const prior=catalog.aliases.find(x=>x.label===a.label);
      check(!prior || prior.exerciseId===a.exerciseId,'Conflicting canonical identity or alias; no history was merged.');
      if(!prior) catalog.aliases.push(clone(a));
    }
    ExerciseIdentity.validateCatalog(catalog);
    const refs=new Map();
    const dto = h => {
      const data=clone(h.document.data);data.version=8;
      data.exerciseLibrary=Object.fromEntries(h.document.catalog.exercises.map(e=>[e.id,{primary:e.primary,secondary:clone(e.secondary),pattern:e.pattern,type:e.type,status:e.state}]));
      references(data,(r,k,key)=>{if(!refs.has(key)) refs.set(key,clone(r[k]));r[k]=r[k].exerciseId;});
      validateData(data);return data;
    };
    const current=dto(base),other=dto(incoming);
    // Existing session identity also protects original labels and signature metadata.
    for(const session of incoming.document.data.sessions) {
      const prior=base.document.data.sessions.find(s=>s.id===session.id);
      check(!prior || sameSessionData(prior,session),'Conflicting session ID in history merge.');
    }
    const next=mergeHistoryData(current,other);
    references(next,(r,k,key)=>{check(refs.has(key),'Missing canonical provenance.');r[k]=clone(refs.get(key));});
    delete next.version;delete next.exerciseLibrary;
    const used=new Set(base.document.catalog.exercises.map(e=>e.id)),labels=new Set(Object.keys(base.document.legacyExerciseLibrary));
    references(next,(r,k)=>{used.add(r[k].exerciseId);labels.add(r[k].originalLabel);});
    catalog.exercises=catalog.exercises.filter(e=>used.has(e.id));catalog.aliases=catalog.aliases.filter(a=>used.has(a.exerciseId));
    const document=clone(base.document);document.catalog=catalog;document.data=next;
    // Preserve current definitions; bring missing label definitions without rewriting settings.
    for(const [label,meta] of Object.entries(incoming.document.legacyExerciseLibrary))
      if(labels.has(label) && !Object.hasOwn(document.legacyExerciseLibrary,label)) document.legacyExerciseLibrary[label]=clone(meta);
    const keys=base.bodyweightIds.slice();
    for(let i=base.document.data.bodyweights.length;i<next.bodyweights.length;i++) {
      const index=incoming.document.data.bodyweights.findIndex(r=>sameSessionData(r,next.bodyweights[i]));
      const id=incoming.bodyweightIds[index];check(id && !keys.includes(id),'Conflicting bodyweight identity.');keys.push(id);
    }
    const schemes=clone(base.signatureSchemes);
    for(const [key,value] of Object.entries(incoming.signatureSchemes)) {
      check(!Object.hasOwn(schemes,key) || schemes[key]===value,'Conflicting request signature metadata.');schemes[key]=value;
    }
    return validatePayload({document,bodyweightIds:keys,signatureSchemes:schemes},owner);
  }
  function createRepository({client,ownerId}) {
    check(uuid.test(ownerId),'Verified owner required.');
    async function rpc(name,args={}) {
      const reply=await client.rpc(name,args);
      if(reply.error) {const e=Error('Cloud lifecycle operation was rejected.');e.code=reply.error.code;throw e;}
      check(reply.data,'Cloud acknowledgement missing.');return reply.data;
    }
    function decode(raw) {
      check(raw?.ownerId===ownerId && raw.protocolVersion===1 && WorkoutConcurrency.revision(raw.revision) &&
        /^[0-9a-f]{64}$/.test(raw.fingerprint??'') && ['healthy','unreadable','uninitialized'].includes(raw.status),'Invalid authoritative lifecycle snapshot.');
      if(raw.status==='healthy') return {...raw,initialized:true,...WorkoutRepository.assemble(raw.rows,ownerId)};
      return {...raw,initialized:false};
    }
    async function transmit(name,args,operation,packet) {
      let reply;
      try {reply=await rpc(name,args);} catch(e) {
        if(/^(?:22|23|42|P0001)/.test(e.code??'')) return {code:e.code==='42501'?'AUTHORIZATION_ERROR':'VALIDATION_ERROR'};
        throw e;
      }
      check(sameSessionData(reply.operation,operation),'Wrong lifecycle acknowledgement.');
      const saved=decode(reply.snapshot);
      if(['OK','REPLAY'].includes(reply.code)) check(WorkoutConcurrency.revision(reply.operationRevision) &&
        BigInt(reply.operationRevision)<=BigInt(saved.revision) && isObject(reply.result),'Invalid lifecycle receipt.');
      if(reply.code==='OK') check(equalRows(saved.rows,packet.next),'Cloud replacement acknowledgement differs.');
      return {code:reply.code,saved,result:reply.result,operationRevision:reply.operationRevision};
    }
    return Object.freeze({ownerId,load:async()=>decode(await rpc('gymbro_lifecycle_snapshot')),
      prepare(before,after,context) {
        const packet={protocolVersion:1,ownerId,action:context.action,operation:clone(context.operation),
          expectedRevision:before.revision,base:clone(before.rows),fingerprint:before.fingerprint,status:before.status,
          sourceOwnerId:after.sourceOwnerId??null,safety:after.safety??null,next:rowsOf(after,ownerId),result:{changes:['workoutData']}};
        const freeze=x=>{if(x && typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};return freeze(packet);
      },
      submit:packet=>transmit('gymbro_lifecycle_mutate',{packet},packet.operation,packet),
      resolve:operation=>transmit('gymbro_lifecycle_resolve',{operation},operation),
    });
  }
  async function prepareAction(base,name,args) {
      check(['restoreCompleteBackup','mergeHistoryBackup'].includes(name),'Unsupported lifecycle action.');
      const input=args[0];check(input?.confirmed===true,'Explicit confirmation required.');
      const incoming=await parse(input.text,base.ownerId,name==='mergeHistoryBackup'?{catalog:base.document?.catalog}:{});
      let candidate;
      if(name==='mergeHistoryBackup') {
        check(base.status==='healthy','History merge requires a healthy cloud dataset.');candidate=merge(base,incoming,base.ownerId);
      } else if(base.status==='healthy') {
        check(sameSessionData(input.safety,{ownerId:base.ownerId,revision:base.revision,fingerprint:base.fingerprint}),'Verify the saved recovery backup for the current revision first.');
        candidate={...incoming,safety:clone(input.safety)};
      } else {
        check(['uninitialized','unreadable'].includes(base.status) && input.emergencyConfirmed===true && input.rawOffered===true,
          'Emergency restore requires raw recovery material and separate confirmation.');candidate=incoming;
      }
      return {candidate,result:{ok:true,code:'PREPARED',changes:['workoutData']}};

  }
  function createController({initial,repository,...options}) {
    return WorkoutConcurrency.create({...options,initial,repository,prepare:prepareAction});
  }
  function localRecovery({storage,cutoverAccepted=false,onChange=()=>{}}) {
    const key='daveGymTrackerV1';let captured=null,verified=false,invalidated=false;
    const changed=event=>{if(event.key===key || event.key===null){invalidated=true;verified=false;onChange();}};
    globalThis.addEventListener?.('storage',changed);
    return Object.freeze({
      capture() {check(cutoverAccepted===true,'Local cleanup is disabled until accepted cutover.');captured=storage.getItem(key);check(captured!==null,'No local recovery copy is present.');verified=false;invalidated=false;return captured;},
      verify(text) {check(captured!==null && !invalidated && text===captured,'Select the exact saved raw recovery file.');verified=true;},
      remove({confirmed=false,oldTabsClosed=false}={}) {
        check(cutoverAccepted===true && confirmed && oldTabsClosed && verified && !invalidated && captured!==null,'Verify the raw file, close old app tabs, and confirm local cleanup.');
        check(storage.getItem(key)===captured,'Local recovery data changed; cleanup cancelled.');
        storage.removeItem(key);check(storage.getItem(key)===null,'Local recovery deletion was not confirmed.');captured=null;verified=false;return {ok:true};
      },
      dispose(){globalThis.removeEventListener?.('storage',changed);captured=null;verified=false;},
    });
  }
  return Object.freeze({prepareAction,backup,parse,verifySafety,merge,createRepository,createController,localRecovery,validatePayload,equalRows});
})();
