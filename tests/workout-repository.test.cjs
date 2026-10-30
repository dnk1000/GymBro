const {test}=require("node:test");
const assert=require("node:assert/strict");
const {fixture}=require("./relational-fixture.cjs");
const plain=x=>JSON.parse(JSON.stringify(x));
const {makeActions,handle}=require("./protocol-fixture.cjs");
test("relational projection preserves complete content, optional presence, original labels and independent ordering",async()=>{
  const f=await fixture(), rows=f.repository.project(f.document,f.owner,f.bodyweightIds);
  Object.values(rows).forEach(list=>list.reverse());
  const back=f.repository.assemble(rows,f.owner);
  assert.deepEqual(plain(f.identity.restoreV2Source(back.document)),plain(f.source));
  assert.deepEqual(plain(back.bodyweightIds),f.bodyweightIds);
  assert.equal(Object.hasOwn(back.document.data.sets[0],"rpe"),false);
  assert.equal(rows.guided_requests.length,2);
  assert.equal(rows.sets.some(s=>s.set_id===rows.guided_requests.find(r=>r.request_id==="request-b").set_id),false);
  assert(rows.sets.some(s=>s.session_id===null));
  assert.notEqual(rows.snapshot_slots[0].exercise_id,rows.guided_slots.at(-1).exercise_id);
});
test("assembly fails closed for partial, cross-owner, orphan, duplicate and contradictory rows",async()=>{
  const f=await fixture();
  for(const corrupt of [r=>delete r.imports,r=>r.sets[0].owner_id="88888888-8888-4888-8888-888888888888",r=>r.sets[0].session_position=999,
    r=>r.sets.push(structuredClone(r.sets[0])),r=>r.session_notes[0].session_id="orphan",r=>r.sets[0].extra.notes="shadow",r=>r.guided_slots.pop()]) {
    const rows=plain(f.repository.project(f.document,f.owner,f.bodyweightIds));corrupt(rows);
    assert.throws(()=>f.repository.assemble(rows,f.owner));
  }
});
test("unsupported database text rejects without modifying source; literal escapes and valid Unicode survive",async()=>{
  const f=await fixture(), before=plain(f.document);
  for(const text of ["\0","\ud800","\udfff"]) {
    const doc=structuredClone(f.document);doc.data.extension.bad=text;
    assert.throws(()=>f.repository.project(doc,f.owner,f.bodyweightIds),/PostgreSQL/);
  }
  assert.deepEqual(plain(f.document),before);
});
test("DOM-free actions await durable acknowledgement; failed/late saves do not publish candidate state",async()=>{
  const f=await fixture();let resolve, calls=0;
  const repository={commit:async(before,after)=>{calls++;await new Promise(r=>{resolve=r;});return after;}};
  const actions=makeActions(f,{initial:{document:f.document,bodyweightIds:f.bodyweightIds},repository,createId:()=>"synthetic-next"});
  const before=plain(actions.getWorkoutState()), id=f.identity.resolveLabel(f.document.catalog,"Bench Press");
  const pending=actions.execute("logSet",{date:"2026-10-28",exercise:id,weight:15,reps:8,sessionId:null});
  await new Promise(setImmediate); // preparation now precedes the remote protocol
  assert.equal(calls,1);assert.deepEqual(plain(actions.getWorkoutState()),before);
  assert.equal((await actions.execute("clearPlan")).ok,false);
  resolve();const saved=await pending;assert.equal(saved.ok,true);assert.equal(saved.code,"OK");
  assert.equal(saved.state.data.sets.at(-1).exercise.exerciseId,id);
  const failing=makeActions(f,{initial:{document:f.document,bodyweightIds:f.bodyweightIds},repository:{commit:async()=>{throw Error("rejected");}},createId:()=>"failed"});
  const failure=await failing.execute("logSet",{date:"2026-10-28",exercise:id,weight:1,reps:1,sessionId:null});
  assert.equal(failure.code,"OUTCOME_UNKNOWN");assert.deepEqual(plain(failing.getWorkoutState()),before);
});
test("canonical facade reuses guidance replay/tombstones, corrections, note and template rules",async()=>{
  const f=await fixture();let writes=0;
  const actions=makeActions(f,{initial:{document:f.document,bodyweightIds:f.bodyweightIds},repository:{commit:async(_,next)=>{writes++;return next;}},createId:()=>"facade-id"});
  const id=f.identity.resolveLabel(f.document.catalog,"Bench Press");
  const tombstone=await actions.execute("logGuidedSet",{sessionId:f.sessionId,planSlotId:"slot-1",expectedRevision:3,requestId:"request-b",weight:20,reps:8});
  assert.equal(tombstone.code,"REPLAY");assert.equal(tombstone.deleted,true);assert.equal(writes,0);
  const conflict=await actions.execute("logGuidedSet",{sessionId:f.sessionId,planSlotId:"slot-1",expectedRevision:3,requestId:"request-b",weight:21,reps:8});
  assert.equal(conflict.code,"REQUEST_CONFLICT");assert.equal(writes,0);
  const snapshot=plain(actions.getWorkoutState().data.sessions[0].planSnapshot);
  assert.equal((await actions.execute("removeSlot",{templateId:"push",index:0})).ok,true);
  assert.deepEqual(plain(actions.getWorkoutState().data.sessions[0].planSnapshot),snapshot);
  assert.equal((await actions.execute("saveScopedNote",{scope:"exercise",exercise:id,text:"changed setup",expectedText:"  setup\n"})).ok,true);
  assert.equal((await actions.execute("logSet",{date:"2026-10-28",exercise:"Bench Press",weight:1,reps:1})).code,"VALIDATION_ERROR");
});
test("repository transport uses single RPC loads and acknowledges complete matching committed facts",async()=>{
  const f=await fixture(),rows=f.repository.project(f.document,f.owner,f.bodyweightIds);let fail=false;
  const calls=[];
  const snapshot=(rows,revision="0")=>({protocolVersion:1,ownerId:f.owner,revision,rows});
  const repo=f.repository.create({ownerId:f.owner,client:{rpc:async(name,args)=>{calls.push(name);return fail?{error:{message:"private details"}}:{data:name==="gymbro_workout_mutate"?{code:"OK",operation:args.packet.operation,operationRevision:"1",result:args.packet.result,snapshot:snapshot(args.packet.next,"1")}:snapshot(rows)};}}});
  assert.equal((await repo.load()).initialized,true);
  const packet=repo.prepare(null,f,{action:"initialize",args:[],operation:["initialize","fixture"],result:{}});
  assert((await repo.submit(packet)).saved.document);
  assert.deepEqual(calls,["gymbro_workout_snapshot","gymbro_workout_mutate"]);
  fail=true;await assert.rejects(repo.load(),/rejected/);
  const empty=Object.fromEntries(Object.keys(rows).map(t=>[t,[]]));
  const uninitialized=f.repository.create({ownerId:f.owner,client:{rpc:async()=>({data:snapshot(empty)})}});
  assert.deepEqual(plain(await uninitialized.load()),{initialized:false,protocolVersion:1,ownerId:f.owner,revision:"0"});
});
test("new snapshots/guidance retain recorded template labels after canonical rename",async()=>{
  const f=await fixture(),id=f.identity.resolveLabel(f.document.catalog,"Smith Press");
  const doc=structuredClone(f.document);
  doc.data.sessions=[];doc.data.activeSessionId=null;doc.data.sets=[];
  doc.data.noteScopes.session=[];doc.data.noteScopes.exerciseSession=[];
  doc.catalog=f.identity.renameExercise(doc.catalog,id,"Renamed canonical press");
  const actions=makeActions(f,{initial:{document:doc,bodyweightIds:f.bodyweightIds},repository:{commit:async(_,after)=>after},createId:()=>"new-synthetic-session",now:()=>"2026-10-28T05:00:00.000Z"});
  const result=await actions.execute("startGuidedSession",{date:"2026-10-28",templateId:"push",duration:60});
  assert.equal(result.ok,true);
  assert.equal(result.state.data.sessions[0].planSnapshot.slots[0].exercise.originalLabel,"Smith Press");
  assert.equal(result.state.data.sessions[0].guided.slots[0].actualExercise.originalLabel,"Smith Press");
  const saved=await actions.execute("logGuidedSet",{sessionId:result.sessionId,planSlotId:"slot-1",expectedRevision:0,requestId:"new-canonical",exercise:id,weight:10,reps:8,originalLabel:"Smith Press"});
  assert.equal(saved.ok,true);assert.equal(saved.state.data.sets[0].exercise.originalLabel,"Smith Press");
});
test("request identity schemes distinguish UUID-shaped legacy labels from canonical IDs across reload",async()=>{
  const f=await fixture(),doc=structuredClone(f.document);
  const a=f.identity.resolveLabel(doc.catalog,"Smith Press"),b=f.identity.resolveLabel(doc.catalog,"Bench Press");
  doc.catalog=f.identity.addAlias(doc.catalog,{label:a,exerciseId:b,provenance:"user-created"});
  const legacy={sessionId:f.sessionId,planSlotId:"slot-1",exercise:a,weight:7,reps:2};
  const signature=f.get("guidedRequestSignature")(legacy);
  doc.data.sessions[0].guided.requests.push({id:"legacy-uuid-label",setId:"legacy-dead",signature});
  let rows=plain(f.repository.project(doc,f.owner,f.bodyweightIds));
  let revision=0;
  const repository=f.repository.create({ownerId:f.owner,client:{rpc:async(name,args)=> {
    if(name==="gymbro_workout_mutate") {
      rows=plain(args.packet.next);revision++;
      return {data:{code:"OK",operation:args.packet.operation,result:args.packet.result,operationRevision:String(revision),snapshot:{protocolVersion:1,ownerId:f.owner,revision:String(revision),rows}}};
    }
    return {data:{protocolVersion:1,ownerId:f.owner,revision:String(revision),rows}};
  }}});
  let actions=makeActions(f,{initial:{document:doc,bodyweightIds:f.bodyweightIds},repository,createId:()=>"canonical-request-set"});
  assert.equal((await actions.execute("logGuidedSet",{...legacy,exercise:b,requestId:"legacy-uuid-label",expectedRevision:3})).code,"REPLAY");
  assert.equal((await actions.execute("substituteGuidedExercise",{sessionId:f.sessionId,planSlotId:"slot-1",expectedRevision:3,exercise:a})).ok,true);
  const input={sessionId:f.sessionId,planSlotId:"slot-1",expectedRevision:4,requestId:"canonical-id",exercise:a,weight:10,reps:8};
  assert.equal((await actions.execute("logGuidedSet",input)).ok,true);
  const loaded=await repository.load();
  assert.equal(loaded.signatureSchemes[JSON.stringify([f.sessionId,"canonical-id"])],"canonical-ids");
  actions=makeActions(f,{initial:loaded,repository,createId:()=>"unused"});
  assert.equal((await actions.execute("logGuidedSet",input)).code,"REPLAY");
  assert.equal((await actions.execute("logGuidedSet",{...input,weight:11})).code,"REQUEST_CONFLICT");
  assert.equal(actions.getWorkoutState().data.sessions[0].guided.requests.find(r=>r.id==="legacy-uuid-label").signature,signature);
});
test("reviewed imports resolve only included rows and preserve duplicate protection and provenance",async()=>{
  const f=await fixture(),id=f.identity.resolveLabel(f.document.catalog,"Bench Press");let writes=0;
  const actions=makeActions(f,{initial:{document:f.document,bodyweightIds:f.bodyweightIds},repository:{commit:async(_,after)=>{writes++;return after;}},createBodyweightId:()=>"import-bodyweight"});
  const draft={importId:"selected-canonical-import",date:"2026-10-28",template:"synthetic",duration:30,sessionNotes:"  exact summary\n",bodyweight:201,sets:[
    {include:true,exercise:id,originalLabel:"Bench Press",weight:10,reps:8,unit:"lb",rpe:null,rir:0,pain:0,painArea:"",notes:"  exact imported\n",complete:true},
    {include:false,exercise:"unresolved excluded label",weight:-10,reps:0,unit:"invalid"},
  ]};
  const result=await actions.execute("commitImport",draft);
  assert.equal(result.ok,true);assert.equal(result.count,1);assert.equal(writes,1);
  assert.equal(result.state.data.sets.at(-1).exercise.originalLabel,"Bench Press");
  assert.equal(result.state.data.imports.at(-1).notes,draft.sessionNotes);
  assert.equal(result.state.catalog.aliases.some(a=>a.label==="unresolved excluded label"),false);
  assert.equal((await actions.execute("commitImport",draft)).code,"DUPLICATE_IMPORT");assert.equal(writes,1);
});
test("unknown legacy signature fields remain opaque and cannot become a false exact replay",async()=>{
  const f=await fixture(),doc=structuredClone(f.document),id=f.identity.resolveLabel(doc.catalog,"Bench Press");
  const signature=JSON.stringify({sessionId:f.sessionId,planSlotId:"slot-1",exercise:"Bench Press",weight:10,reps:8,futureMeaning:"must not discard"});
  doc.data.sessions[0].guided.requests.push({id:"opaque-request",setId:"opaque-tombstone",signature});let writes=0;
  const actions=makeActions(f,{initial:{document:doc,bodyweightIds:f.bodyweightIds},repository:{commit:async(_,after)=>{writes++;return after;}}});
  const result=await actions.execute("logGuidedSet",{sessionId:f.sessionId,planSlotId:"slot-1",expectedRevision:3,requestId:"opaque-request",exercise:id,weight:10,reps:8});
  assert.equal(result.code,"REQUEST_CONFLICT");assert.equal(writes,0);
  assert.equal(actions.getWorkoutState().data.sessions[0].guided.requests.at(-1).signature,signature);
});
