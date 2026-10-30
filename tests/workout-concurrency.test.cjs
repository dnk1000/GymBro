const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serverFixture,storage,plain,handle}=require('./protocol-fixture.cjs');
const input=f=>({date:'2026-10-28',exercise:f.identity.resolveLabel(f.document.catalog,'Bench Press'),weight:0,reps:8,rir:0,notes:'  keep\n',complete:false,sessionId:null});
test('lost acknowledgement retries the frozen packet; preserves falsy fields and allocates identities once',async()=>{
  const f=await serverFixture();let ids=0;const store=storage();
  const a=f.create({recoveryStorage:store,createId:()=>`exact-${++ids}`});
  f.setFault('lost');const before=plain(a.getWorkoutState());
  const failed=await a.execute('logSet',input(f));
  assert.equal(failed.code,'OUTCOME_UNKNOWN');assert.deepEqual(plain(a.getWorkoutState()),before);
  assert.equal(f.getSaved().revision,'1');assert.equal(ids,1);
  assert.equal((await a.execute('logSet',input(f))).code,'OUTCOME_UNKNOWN');
  const retried=await a.retry();assert.equal(retried.code,'REPLAY');assert.equal(retried.setId,'exact-1');
  assert.equal(ids,1);assert.equal(f.getSaved().revision,'1');assert.equal(f.receipts.size,1);
  assert.deepEqual(f.calls[0].args.packet,f.calls[1].args.packet);
  const saved=a.getWorkoutState().data.sets.at(-1);
  assert.equal(saved.weight,0);assert.equal(saved.rir,0);assert.equal(saved.complete,false);assert.equal(saved.notes,'  keep\n');
  assert.equal(store.getItem(`gymbro-request-recovery-v1-${f.owner}`),null);
});
test('failed recovery marker prevents all transmission; malformed marker never becomes a fresh submission',async()=>{
  const f=await serverFixture(); const denied={getItem:()=>null,setItem:()=>{throw Error('quota');}};
  const a=f.create({recoveryStorage:denied});assert.equal((await a.execute('logSet',input(f))).code,'RECOVERY_ERROR');assert.equal(f.calls.length,0);
  const corrupt=storage();corrupt.setItem(`gymbro-request-recovery-v1-${f.owner}`,'broken');
  const b=f.create({recoveryStorage:corrupt});assert.equal((await b.execute('logSet',input(f))).code,'RECOVERY_ERROR');assert.equal(f.calls.length,0);
});
test('reload resolves committed request and a cancellation fences late original packets',async()=>{
  const f=await serverFixture(),store=storage();const a=f.create({recoveryStorage:store});
  f.setFault('lost');await a.execute('logSet',input(f));
  const b=f.create({recoveryStorage:store});assert.equal(b.getStatus().phase,'OUTCOME_UNKNOWN');assert.equal((await b.resolve()).code,'REPLAY');
  const op=['logSet','arrives-later'];const packet=f.repository.prepare(f.getSaved(),f.getSaved(),{action:'logSet',args:[input(f)],operation:op,result:{setId:'late'}});
  assert.equal((await f.repository.resolve(op)).code,'CANCELLED');
  assert.equal((await f.repository.submit(packet)).code,'CANCELLED');assert.equal(f.getSaved().revision,'1');
});
test('two contexts reject stale changes and refresh explicitly before reviewed new submission',async()=>{
  const f=await serverFixture();const a=f.create(),b=f.create();
  assert.equal((await a.execute('logSet',input(f))).code,'OK');
  assert.equal((await b.execute('logSet',input(f))).code,'CONFLICT');
  assert.equal(b.getWorkoutState().data.sets.length,f.document.data.sets.length);
  assert.equal((await b.execute('logSet',input(f))).code,'CONFLICT');
  await b.refresh();assert.equal((await b.execute('logSet',input(f))).code,'OK');assert.equal(f.getSaved().revision,'2');
});
test('replay after edit/deletion returns original ID with current facts and does not resurrect a set',async()=>{
  const f=await serverFixture();const a=f.create({createId:()=> 'original'});
  f.setFault('lost');await a.execute('logSet',input(f));
  const b=f.create();assert.equal((await b.execute('editSet','original',{notes:'corrected'})).code,'OK');
  assert.equal((await a.retry()).code,'REPLAY');assert.equal(a.getWorkoutState().data.sets.at(-1).notes,'corrected');
  const packet=f.calls.find(c=>c.name==='gymbro_workout_mutate').args.packet;
  await b.execute('deleteSet','original');const replay=await f.repository.submit(packet);
  assert.equal(replay.code,'REPLAY');assert.equal(replay.result.setId,'original');assert.equal(replay.saved.document.data.sets.some(s=>s.id==='original'),false);
});
test('overlapping click prepares one mutation; older refresh and account generation cannot publish late data',async()=>{
  const f=await serverFixture();const a=f.create();let resolve;
  const original=f.client.rpc;
  f.client.rpc=async(name,args)=>name==='gymbro_workout_mutate'?await new Promise(r=>{resolve=()=>original(name,args).then(r);}):original(name,args);
  const pending=a.execute('logSet',input(f));await new Promise(setImmediate);
  assert.equal((await a.execute('logSet',input(f))).code,'PENDING');
  a.dispose();resolve();assert.equal((await pending).code,'DISPOSED');assert.equal(a.getWorkoutState().data.sets.length,f.document.data.sets.length);
  const b=f.create();let first,second;
  const base=plain(await f.repository.load());
  f.client.rpc=async()=>new Promise(r=>{if(!first) first=()=>r({data:{protocolVersion:1,ownerId:f.owner,revision:'0',rows:plain(f.get("WorkoutRepository").project(f.document,f.owner,f.bodyweightIds))}});else second=()=>r({data:{protocolVersion:1,ownerId:f.owner,revision:base.revision,rows:plain(f.get("WorkoutRepository").project(base.document,f.owner,base.bodyweightIds))}});});
  const r1=b.refresh(),r2=b.refresh();second();await r2;first();await r1;
  assert.equal(b.getStatus().revision,base.revision);
});
test('decimal revision precision, mismatched owner/protocol and malformed acknowledgements fail closed',async()=>{
  const f=await serverFixture();assert.throws(()=>f.create({initial:{...handle(f),revision:0}}));
  assert.throws(()=>f.create({initial:{...handle(f),ownerId:'other'}}));
  const big='9007199254740993123456789';const a=f.create({initial:{...handle(f),revision:big}});
  await a.refresh();assert.equal(a.getStatus().revision,big);
  f.client.rpc=async()=>({data:{code:'OK',operation:['wrong','key']}});
  const b=f.create();assert.equal((await b.execute('logSet',input(f))).code,'OUTCOME_UNKNOWN');
});
test('definitive rollback keeps state and request reuse with altered packet cannot overwrite receipts',async()=>{
  const f=await serverFixture(),a=f.create();f.setFault('rollback');
  assert.equal((await a.execute('logSet',input(f))).code,'VALIDATION_ERROR');assert.equal(f.receipts.size,0);assert.equal(f.getSaved().revision,'0');
  assert.equal((await a.execute('logSet',input(f))).code,'OK');
  const p=f.calls.at(-1).args.packet,changed=structuredClone(p);changed.args[0].notes='altered';
  assert.equal((await f.repository.submit(changed)).code,'REQUEST_CONFLICT');assert.equal(f.getSaved().revision,'1');
});
