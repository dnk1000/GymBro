const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {setup}=require('./lifecycle-fixture.cjs');
const {storage,plain}=require('./protocol-fixture.cjs');
async function migrationFixture(){
  const f=await setup();for(const file of ['workout-migration.js','workout-cloud.js'])f.get(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  return {...f,migration:f.get('WorkoutMigration'),cloud:f.get('WorkoutCloud')};
}
test('migration preserves every source field and deterministically allocates distinct bodyweight keys across preparation/restart',async()=>{
  const f=await migrationFixture(),text=JSON.stringify(f.source),a=await f.migration.prepareSource(text,f.owner),b=await f.migration.prepareSource(text,f.owner);
  assert.deepEqual(plain(a),plain(b));assert.equal(new Set(a.bodyweightIds).size,2);
  assert(a.bodyweightIds.every(x=>/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x)));
  assert.deepEqual(plain(f.identity.restoreV2Source(a.document)),plain(f.source));
  const order=Object.fromEntries(Object.entries(f.source).reverse());
  const c=await f.migration.prepareSource(JSON.stringify(order),f.owner);assert.deepEqual(plain(c.bodyweightIds),plain(a.bodyweightIds));
  assert.notEqual(c.byteDigest,a.byteDigest);assert.equal(c.sourceDigest,a.sourceDigest);
});
test('no-op requires exact frozen canonical content, keys and relationships, never counts or display-equivalence',async()=>{
  const f=await migrationFixture(),text=JSON.stringify(f.source),candidate=await f.migration.prepareSource(text,f.owner);
  const saved={...f.handle,...candidate};assert(f.migration.compare(candidate,saved,f.owner).pass);
  assert.equal((await f.migration.prepareAction(saved,'initializeMigration',[{text,confirmed:true}])).result.code,'NO_CHANGE');
  for(const change of [x=>x.bodyweightIds.reverse(),x=>x.document.data.sets[0].notes+='changed',x=>x.document.data.sessions[0].setIds.reverse(),x=>x.document.catalog.exercises[0].metadata.unseen=false]){
    const other=structuredClone(saved);change(other);assert.equal(f.migration.compare(candidate,other,f.owner).pass,false);
    await assert.rejects(f.migration.prepareAction(other,'initializeMigration',[{text,confirmed:true}]),/differs/);
  }
});
test('catalog-only/unreadable targets and unconfirmed migration reject without candidate publication',async()=>{
  const f=await migrationFixture(),text=JSON.stringify(f.source),empty={...f.handle,status:'uninitialized',document:undefined,rows:Object.fromEntries(Object.keys(f.handle.rows).map(k=>[k,[]]))};
  assert((await f.migration.prepareAction(empty,'initializeMigration',[{text,confirmed:true}])).candidate);
  await assert.rejects(f.migration.prepareAction(empty,'initializeMigration',[{text,confirmed:false}]));
  for(const target of [{...empty,status:'unreadable'},{...empty,rows:{...empty.rows,exercises:f.handle.rows.exercises}}])
    await assert.rejects(f.migration.prepareAction(target,'initializeMigration',[{text,confirmed:true}]),/empty/);
  const backup=f.lifecycle.backup(f.handle),parsed=await f.migration.prepareSource(JSON.stringify(backup),f.owner);
  assert.deepEqual(plain(parsed.bodyweightIds),f.bodyweightIds);
  await assert.rejects(f.migration.prepareSource(JSON.stringify(backup),'88888888-8888-4888-8888-888888888888'),/different account/);
});
// In-memory transport is client/controller evidence only; real SQL is separate.
async function cloudFixture(){
  const f=await migrationFixture();let saved=plain(f.handle),fault=false;const receipts=new Map(),calls=[];
  const client={rpc:async(name,args={})=>{
    calls.push({name,args:plain(args)});if(name==='gymbro_lifecycle_snapshot')return {data:saved};
    const op=args.packet?.operation??args.operation,key=JSON.stringify(op);let answer;
    if(receipts.has(key)){const r=receipts.get(key);answer={code:'REPLAY',result:r.result,operationRevision:r.revision};}
    else if(name==='gymbro_lifecycle_resolve')answer={code:'CANCELLED'};
    else if(args.packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
    else {const packet=args.packet;
      saved={...saved,...plain(f.repository.assemble(packet.next,f.owner)),rows:plain(packet.next),revision:String(BigInt(saved.revision)+1n),fingerprint:'b'.repeat(64)};
      receipts.set(key,{result:packet.result,revision:saved.revision});answer={code:'OK',result:packet.result,operationRevision:saved.revision};
      if(fault){fault=false;throw Error('committed response lost');}
    }
    return {data:{...answer,operation:op,snapshot:saved}};
  }};
  return {...f,client,calls,receipts,getSaved:()=>saved,setFault:()=>{fault=true;}};
}
test('one cloud controller serializes ordinary/lifecycle requests; real prepared packet survives loss and crosses refresh safely',async()=>{
  const f=await cloudFixture(),events=[],controller=f.cloud.create({client:f.client,ownerId:f.owner,initial:f.handle,recoveryStorage:storage(),onChange:(c,r)=>events.push([c,r?.code])});
  f.setFault();const result=await controller.execute('logSet',{date:'2026-10-28',exercise:f.document.catalog.exercises[0].id,weight:0,reps:5,sessionId:null,notes:'  preserved\n',complete:false});
  assert.equal(result.code,'OUTCOME_UNKNOWN');
  assert.equal((await controller.execute('restoreCompleteBackup',{})).code,'OUTCOME_UNKNOWN');
  assert.equal((await controller.retry()).code,'REPLAY');assert.equal(f.getSaved().document.data.sets.length,f.document.data.sets.length+1);
  assert.equal(f.receipts.size,1);assert(events.every(([c])=>c===controller));
  const ordinary=f.calls.filter(x=>x.name==='gymbro_workout_mutate');assert.deepEqual(ordinary[0],ordinary[1]);
  const dto=f.repository.presentation(controller.getWorkoutState());assert.equal(typeof dto.sets[0].exercise,'string');
  dto.sets[0].notes='presentation only';assert.notEqual(controller.getWorkoutState().data.sets[0].notes,dto.sets[0].notes);
});
test('new manual exercise is canonical and atomic with its set; synthetic controller rejects personal lifecycle sources',async()=>{
  const f=await cloudFixture(),controller=f.cloud.create({client:f.client,ownerId:f.owner,initial:f.handle,recoveryStorage:storage(),fixtureTag:'gymbro-issue28-unit'});
  const result=await controller.execute('logSet',{date:'2026-10-28',exercise:'Exact new label',weight:0,reps:5,sessionId:null});
  assert(result.ok,JSON.stringify(result));const id=f.identity.resolveLabel(controller.getWorkoutState().catalog,'Exact new label');
  assert(id);assert.equal(controller.getWorkoutState().data.sets.at(-1).exercise.exerciseId,id);
  const writes=f.calls.filter(x=>x.name.endsWith('_mutate')).length;
  assert.equal((await controller.execute('initializeMigration',{text:JSON.stringify(f.source),confirmed:true})).code,'VALIDATION_ERROR');
  assert.equal(f.calls.filter(x=>x.name.endsWith('_mutate')).length,writes);
});
module.exports={migrationFixture,cloudFixture};
