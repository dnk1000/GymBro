const {test}=require('node:test'),assert=require('node:assert/strict');
const {setupBatch,workouts,history}=require('./batch-import-fixture.cjs'),{plain,storage}=require('./protocol-fixture.cjs');
const {cloudBatchFixture}=require('./batch-import-fixture.cjs');
test('ten workouts review without mutation; exact selected candidate, markers and corrected/deleted replay',async()=>{
  const f=await setupBatch(),payload=workouts(f),before=plain(f.handle);
  const review=await f.batch.review(f.handle,payload,{selected:[0,2,5]});assert.equal(review.units.length,10);assert.equal(review.newCount,3);assert.deepEqual(plain(f.handle),before);
  const prepared=await f.batch.prepare(f.handle,{text:JSON.stringify(payload),selected:[0,2,5],confirmed:true});assert(prepared.candidate);assert.equal(prepared.candidate.document.data.sets.length,before.document.data.sets.length+3);
  assert(prepared.candidate.document.data.sets.slice(-3).every(s=>s.weight===0&&s.complete===false&&s.rpe===7&&s.pain===1&&s.notes==='  exact\n'&&!s.sessionId));
  const saved={...f.handle,...prepared.candidate};saved.document.data.sets=saved.document.data.sets.filter(s=>!s.importBatch?.startsWith('cg_batch-workout'));
  assert.equal((await f.batch.prepare(saved,{text:JSON.stringify(payload),selected:[0,2,5],confirmed:true})).result.code,'NO_CHANGE');
  const later=await f.batch.review(saved,payload,{selected:[0,1]});assert.equal(later.units[0].status,'duplicate');assert.equal(later.units[1].status,'ready');assert.equal(later.newCount,1);
});
test('invalid/unresolved selected unit blocks atomically; explicit exclusion and #18 map/create/skip',async()=>{
  const f=await setupBatch(),payload=workouts(f,3);payload.workouts[1].workout.sets[0].exercise='Unresolved dumbbell variant';payload.workouts[2].workout.sets[0].reps=-1;
  const blocked=await f.batch.review(f.handle,payload);assert.equal(blocked.candidate,null);assert(blocked.errors.length>=2);
  const excluded=await f.batch.review(f.handle,payload,{selected:[0,1],resolutions:[{label:'Unresolved dumbbell variant',kind:'map',exerciseId:f.document.catalog.exercises[0].id}]});assert(excluded.candidate);assert.equal(excluded.newCount,2);
  assert(excluded.candidate.document.catalog.aliases.some(a=>a.label==='Unresolved dumbbell variant'));assert.equal(excluded.units[2].status,'excluded');
  const created=await f.batch.review(f.handle,payload,{selected:[1],resolutions:[{label:'Unresolved dumbbell variant',kind:'create'}]});assert(created.candidate);assert.equal(created.candidate.document.catalog.exercises.length,f.document.catalog.exercises.length+1);
});
test('historical session/snapshot/set order/notes/bodyweights survive, with strict fact/context conflicts',async()=>{
  const f=await setupBatch(),source=history(f),base=structuredClone(f.handle);
  base.document.data.sets=[];base.document.data.sessions=[];base.document.data.activeSessionId=null;base.document.data.bodyweights=[];base.bodyweightIds=[];base.document.data.imports=[];
  base.document.data.noteScopes.session=[];base.document.data.noteScopes.exerciseSession=[];base.document.data.noteScopes.exercise=[];
  base.rows=f.repository.project(base.document,f.owner,base.bodyweightIds,base.signatureSchemes);
  const payload={format:'gymbro-workout-batch',formatVersion:1,workouts:[{importId:'rich-history',history:source}]};
  const prepared=await f.batch.prepare(base,{text:JSON.stringify(payload),confirmed:true});assert(prepared.candidate);
  const restored=f.identity.restoreV2Source(prepared.candidate.document);
  for(const key of ['sets','sessions','bodyweights'])assert.deepEqual(plain(restored[key]),plain(source[key]),key);
  for(const scope of ['session','exerciseSession','exercise'])assert.deepEqual(plain(restored.noteScopes[scope]),plain(source.noteScopes[scope]));
  assert.equal(prepared.candidate.bodyweightIds.length,2);assert.notEqual(prepared.candidate.bodyweightIds[0],prepared.candidate.bodyweightIds[1]);
  assert.deepEqual(plain(prepared.candidate.document.data.program),plain(base.document.data.program));
  const saved={...base,...prepared.candidate},conflicting=structuredClone(payload);conflicting.workouts[0].importId='different-import';conflicting.workouts[0].history.sets[0].notes='conflict';
  const rejected=await f.batch.review(saved,conflicting);assert.equal(rejected.candidate,null);assert(rejected.errors.some(e=>e.includes('Conflicting set')));
  const noteConflict=structuredClone(payload);noteConflict.workouts[0].importId='note-conflict';noteConflict.workouts[0].history.noteScopes.exercise[0].text='do not replace';
  assert.equal((await f.batch.review(saved,noteConflict)).candidate,null);
});
test('batch identity conflicts, bodyweight identity and unsupported envelopes fail visibly',async()=>{
  const f=await setupBatch(),payload=workouts(f,2),prepared=await f.batch.prepare(f.handle,{text:JSON.stringify(payload),confirmed:true});
  const saved={...f.handle,...prepared.candidate},changed=structuredClone(payload);changed.workouts[0].workout.sets[0].notes='changed';await assert.rejects(f.batch.review(saved,changed),/Batch ID/);
  await assert.rejects(f.batch.review(f.handle,{...payload,formatVersion:9}),/Unsupported/);
  const invalid=history(f);invalid.sessions[0].status='active';invalid.sessions[0].completedAt=null;invalid.activeSessionId=invalid.sessions[0].id;
  const result=await f.batch.review(f.handle,{...payload,workouts:[{history:invalid}]});assert.equal(result.candidate,null);assert(result.units[0].errors.length);
});
test('all supported inner import-ID spellings must agree with the batch wrapper',async()=>{
  const f=await setupBatch();for(const wrapper of ['session','workout'])for(const spelling of ['importId','import_id']){
    const payload=workouts(f,1),body=payload.workouts[0].workout;
    payload.workouts[0].workout={[wrapper]:{...body,[spelling]:'different-inner-id'}};
    const rejected=await f.batch.review(f.handle,payload);assert.equal(rejected.candidate,null);assert.match(rejected.units[0].errors.join(' '),/IDs disagree/);
    payload.workouts[0].importId='different-inner-id';assert((await f.batch.review(f.handle,payload)).candidate);
  }
});
test('one lifecycle transaction, exact lost-ack replay/disposition, hard reload, rollback and stale writes',async()=>{
  const f=await cloudBatchFixture(),a=f.create(),payload=workouts(f),input={batch:true,text:JSON.stringify(payload),confirmed:true,selected:[0,1,2]},before=f.getSaved();
  f.fault('rollback');assert.equal((await a.execute('mergeHistoryBackup',input)).code,'VALIDATION_ERROR');assert.deepEqual(f.getSaved(),before);
  f.fault('lost');assert.equal((await a.execute('mergeHistoryBackup',input)).code,'OUTCOME_UNKNOWN');const committed=f.getSaved();assert.equal(committed.rows.sets.length,before.rows.sets.length+3);assert.deepEqual(plain(a.getWorkoutState()),before.document);
  assert.equal((await a.retry()).code,'REPLAY');assert.deepEqual(f.getSaved(),committed);assert.equal(f.calls.filter(c=>c.args.packet).at(-1).args.packet.action,'mergeHistoryBackup');
  const packets=f.calls.filter(c=>c.args.packet).slice(-2).map(c=>c.args.packet);assert.deepEqual(packets[0],packets[1]);
  assert.equal((await a.execute('mergeHistoryBackup',input)).code,'NO_CHANGE');
  f.fault('lost');const second={...input,selected:[3]};assert.equal((await a.execute('mergeHistoryBackup',second)).code,'OUTCOME_UNKNOWN');a.dispose();const restored=f.create();assert.equal((await restored.resolve()).code,'REPLAY');
  const all=f.getSaved();f.advance();assert.equal((await restored.execute('mergeHistoryBackup',{...input,selected:[4]})).code,'CONFLICT');assert.equal(f.getSaved().rows.sets.length,all.rows.sets.length);
});
test('same-owner cloud history keeps supplied canonical/bodyweight identities; unresolved and skip remain reviewable',async()=>{
  const f=await setupBatch(),source=history(f),base=structuredClone(f.handle);
  for(const k of ['sets','sessions','bodyweights','imports'])base.document.data[k]=[];base.document.data.activeSessionId=null;base.bodyweightIds=[];
  for(const scope of ['session','exerciseSession','exercise'])base.document.data.noteScopes[scope]=[];
  source.exerciseLibrary['Explicit new cable identity']={primary:'Uncategorized',secondary:[],pattern:'',type:'',status:'accessory'};source.sets[0].exercise='Explicit new cable identity';
  const document=await f.identity.migrateV2(source),cloud=f.lifecycle.backup({...f.handle,document,bodyweightIds:['incoming-measurement-a','incoming-measurement-b']});
  const payload={format:'gymbro-workout-batch',formatVersion:1,workouts:[{importId:'cloud-history',history:cloud}]};
  cloud.payload.document.sourceExtension={preserve:[0,false,null]};cloud.source.originalExportContext='literal source context';
  const unresolved=await f.batch.review(base,payload);assert.equal(unresolved.units[0].status,'blocked');assert(unresolved.groups.some(g=>g.label==='Explicit new cable identity'));
  const skipped=await f.batch.review(base,payload,{resolutions:[{label:'Explicit new cable identity',kind:'skip'}]});assert.equal(skipped.units[0].status,'excluded');assert(skipped.groups.some(g=>g.status==='skipped'));assert.equal(skipped.newCount,0);
  const created=await f.batch.review(base,payload,{resolutions:[{label:'Explicit new cable identity',kind:'create'}]});assert(created.candidate,created.errors.join('\n'));
  assert.equal(created.candidate.document.data.sets[0].exercise.exerciseId,f.identity.resolveLabel(document.catalog,'Explicit new cable identity'));
  assert.deepEqual(plain(created.candidate.bodyweightIds),['incoming-measurement-a','incoming-measurement-b']);
  const provenance=created.candidate.document.data.imports.find(r=>r.importId==='cloud-history');
  assert.deepEqual(plain(provenance.historyIdentityMetadata.sourceExtension),{preserve:[0,false,null]});assert.equal(provenance.historySourceMetadata.source.originalExportContext,'literal source context');assert.deepEqual(plain(provenance.historyCatalog),plain(document.catalog));
  const foreign=structuredClone(payload);foreign.workouts[0].history.source.ownerId='88888888-8888-4888-8888-888888888888';assert.equal((await f.batch.review(base,foreign)).candidate,null);
  const conflicting=structuredClone(payload),second=structuredClone(conflicting.workouts[0]);second.importId='conflicting-catalog-history';
  const newId=f.identity.resolveLabel(document.catalog,'Explicit new cable identity');
  second.history.payload.document.catalog.exercises.find(e=>e.id===newId).equipment='Different equipment';conflicting.workouts.push(second);
  const rejected=await f.batch.review(base,conflicting,{resolutions:[{label:'Explicit new cable identity',kind:'create'}]});assert.equal(rejected.candidate,null);assert.match(rejected.errors.join(' '),/Canonical metadata conflicts/);
  assert((await f.batch.review(base,conflicting,{selected:[0],resolutions:[{label:'Explicit new cable identity',kind:'create'}]})).candidate);
});

test('historical UUID-shaped original labels survive the shared resolver unchanged',async()=>{
  const f=await setupBatch(),source=history(f),document=await f.identity.migrateV2(source),base=structuredClone(f.handle);
  for(const k of ['sets','sessions','bodyweights','imports'])base.document.data[k]=[];base.document.data.activeSessionId=null;base.bodyweightIds=[];
  for(const scope of ['session','exerciseSession','exercise'])base.document.data.noteScopes[scope]=[];
  const reference=document.data.sets[0].exercise,id=reference.exerciseId;
  for(const catalog of [document.catalog,base.document.catalog])catalog.aliases.push({label:id,exerciseId:id,provenance:'user-created'});
  reference.originalLabel=id;
  const cloud=f.lifecycle.backup({...f.handle,document,bodyweightIds:['uuid-label-measurement-a','uuid-label-measurement-b']});
  const payload={format:'gymbro-workout-batch',formatVersion:1,workouts:[{importId:'uuid-label-history',history:cloud}]};
  const prepared=await f.batch.prepare(base,{text:JSON.stringify(payload),confirmed:true});assert(prepared.candidate);
  assert.deepEqual(plain(prepared.candidate.document.data.sets[0]),plain(document.data.sets[0]));
  const rows=f.repository.project(prepared.candidate.document,f.owner,prepared.candidate.bodyweightIds,prepared.candidate.signatureSchemes);
  const restored=f.repository.assemble(rows,f.owner);assert.deepEqual(plain(restored.document.data.sets[0]),plain(document.data.sets[0]));
});

test('#98 maps multiple labels to one planned identity independent of decision and reference order',async()=>{
 const f=await setupBatch(),payload=workouts(f,2);payload.workouts[0].workout.sets[0].exercise='New label B';payload.workouts[1].workout.sets[0].exercise='New label A';
 const resolutions=[{label:'New label B',kind:'map',plannedLabel:'New label A'},{label:'New label A',kind:'create'}],before=plain(f.handle);
 const review=await f.batch.review(f.handle,payload,{resolutions});assert(review.candidate,review.errors.join(' '));assert.deepEqual(plain(f.handle),before);
 const prepared=await f.batch.prepare(f.handle,{text:JSON.stringify(payload),resolutions:resolutions.toReversed(),confirmed:true});assert(prepared.candidate);
 const catalog=prepared.candidate.document.catalog,added=catalog.exercises.filter(e=>!f.document.catalog.exercises.some(old=>old.id===e.id));assert.equal(added.length,1);
 assert.equal(catalog.aliases.find(a=>a.label==='New label B').exerciseId,added[0].id);
 for(const label of ['New label A','New label B']){const set=prepared.candidate.document.data.sets.find(s=>s.exercise.originalLabel===label);assert.equal(set.exercise.exerciseId,added[0].id);}
});

test('#98 stale planned targets and excluded-only decisions cannot leak identities or aliases',async()=>{
 const f=await setupBatch(),payload=workouts(f,2);payload.workouts[0].workout.sets[0].exercise='Planned A';payload.workouts[1].workout.sets[0].exercise='Alias B';
 const choices=[{label:'Planned A',kind:'create'},{label:'Alias B',kind:'map',plannedLabel:'Planned A'}];
 for(const resolutions of [choices.filter(d=>d.label!=='Planned A'),[{label:'Planned A',kind:'skip'},choices[1]],[{label:'Planned A',kind:'map',exerciseId:f.document.catalog.exercises[0].id},choices[1]]]){
  const r=await f.batch.review(f.handle,payload,{resolutions});assert.equal(r.candidate,null);assert(!r.resolutions.some(d=>d.plannedLabel));
 }
 const excluded=await f.batch.review(f.handle,payload,{selected:[1],resolutions:choices});assert.equal(excluded.candidate,null);assert.equal(excluded.resolutions.length,0);
 const onlyA=await f.batch.review(f.handle,payload,{selected:[0],resolutions:choices});assert(onlyA.candidate);assert(!onlyA.candidate.document.catalog.aliases.some(a=>a.label==='Alias B'));
 const none=await f.batch.prepare(f.handle,{text:JSON.stringify(payload),selected:[],resolutions:choices,confirmed:true});assert.equal(none.result.code,'NO_CHANGE');
 const renamed=structuredClone(payload);renamed.workouts[0].workout.sets[0].exercise='Changed A';assert.equal((await f.batch.review(f.handle,renamed,{resolutions:choices})).candidate,null);
});

test('#98 planned aliases share a frozen atomic request, replay idempotently, and reject stale catalog collisions',async()=>{
 const f=await cloudBatchFixture(),a=f.create(),payload=workouts(f,2);payload.workouts[0].workout.sets[0].exercise='Planned cable A';payload.workouts[1].workout.sets[0].exercise='Explicit different grip B';
 const input={batch:true,text:JSON.stringify(payload),confirmed:true,resolutions:[{label:'Planned cable A',kind:'create'},{label:'Explicit different grip B',kind:'map',plannedLabel:'Planned cable A'}]},before=f.getSaved();
 f.fault('rollback');assert.equal((await a.execute('mergeHistoryBackup',input)).code,'VALIDATION_ERROR');assert.deepEqual(f.getSaved(),before);
 f.fault('lost');assert.equal((await a.execute('mergeHistoryBackup',input)).code,'OUTCOME_UNKNOWN');const saved=f.getSaved();assert.equal(saved.document.catalog.exercises.length,before.document.catalog.exercises.length+1);
 assert.equal((await a.retry()).code,'REPLAY');assert.deepEqual(f.getSaved(),saved);const packets=f.calls.filter(c=>c.args.packet).slice(-2).map(c=>c.args.packet);assert.deepEqual(packets[0],packets[1]);
 assert.equal((await a.execute('mergeHistoryBackup',input)).code,'NO_CHANGE');assert.deepEqual(f.getSaved(),saved);
 const fresh=await setupBatch(),collision=structuredClone(fresh.handle);collision.document.catalog=fresh.identity.createExercise(collision.document.catalog,{displayName:'Planned cable A',provenance:'user-created'});
 assert.equal((await fresh.batch.review(collision,payload,{resolutions:input.resolutions})).candidate,null);
 const differing=structuredClone(payload);differing.workouts[0].workout.sets[0].exercise=fresh.document.catalog.exercises[0].displayName;
 assert.equal((await fresh.batch.review(fresh.handle,differing,{resolutions:[{label:differing.workouts[0].workout.sets[0].exercise,kind:'map',plannedLabel:'Explicit different grip B'},{label:'Explicit different grip B',kind:'create'}]})).candidate,null);
});

test('#98 planned mapping never retargets distinct supplied historical identities',async()=>{
 const f=await setupBatch(),source=history(f);
 for(const label of ['Supplied cable A','Supplied attachment B'])source.exerciseLibrary[label]={primary:'Uncategorized',secondary:[],pattern:'',type:'',status:'accessory'};
 source.sets[0].exercise='Supplied cable A';source.sets[1].exercise='Supplied attachment B';
 const document=await f.identity.migrateV2(source),cloud=f.lifecycle.backup({...f.handle,document,bodyweightIds:['identity-a','identity-b']});
 const payload={format:'gymbro-workout-batch',formatVersion:1,workouts:[{importId:'supplied-distinct-identities',history:cloud}]};
 const r=await f.batch.review(f.handle,payload,{resolutions:[{label:'Supplied cable A',kind:'create'},{label:'Supplied attachment B',kind:'map',plannedLabel:'Supplied cable A'}]});
 assert.equal(r.candidate,null);assert.match(r.errors.join(' '),/cannot be retargeted/);
});
