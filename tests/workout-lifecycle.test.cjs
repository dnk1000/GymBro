const {test}=require('node:test');
const assert=require('node:assert/strict');
const {storage,plain}=require('./protocol-fixture.cjs');
const {setup}=require('./lifecycle-fixture.cjs');
test('cloud backup reconstructs all content and metadata; source account and format fail closed',async()=>{
  const f=await setup(),backup=f.lifecycle.backup(f.handle),text=JSON.stringify(backup);
  const parsed=await f.lifecycle.parse(text,f.owner);
  assert.deepEqual(plain(parsed.document),plain(f.document));assert.deepEqual(plain(parsed.bodyweightIds),f.bodyweightIds);
  assert.equal(backup.source.ownerId,f.owner);assert.equal(backup.source.revision,'12');
  assert.equal(f.lifecycle.verifySafety(text,f.handle).fingerprint,f.handle.fingerprint);
  await assert.rejects(f.lifecycle.parse(text,'88888888-8888-4888-8888-888888888888'),/different account/);
  for(const mutation of [x=>x.formatVersion=999,x=>delete x.payload.signatureSchemes,x=>x.payload.bodyweightIds.pop(),x=>x.payload.document.data.preferences.bad=0]){
    const invalid=structuredClone(backup);mutation(invalid);await assert.rejects(f.lifecycle.parse(JSON.stringify(invalid),f.owner));
  }
  assert.throws(()=>f.lifecycle.backup({...f.handle,status:'unreadable'}));
  assert.throws(()=>f.lifecycle.verifySafety(text,{...f.handle,revision:'13'}));
  const invalid=structuredClone(backup);invalid.payload.document.data.sets[0].notes='changed';
  assert.throws(()=>f.lifecycle.verifySafety(JSON.stringify(invalid),f.handle),/match/);
});
test('legacy conversion reuses deterministic identity, preserves exact content and freezes missing bodyweight IDs',async()=>{
  const f=await setup(),text=JSON.stringify(f.source);let seq=0;
  const a=await f.lifecycle.parse(text,f.owner,{createBodyweightId:()=>`bw-${++seq}`});
  const b=await f.lifecycle.parse(text,f.owner,{createBodyweightId:()=>`bw-${++seq}`});
  assert.deepEqual(plain(a.document),plain(b.document));assert.equal(a.kind,'legacy');assert.equal(a.sourceOwnerId,null);
  assert.deepEqual(plain(f.identity.restoreV2Source(a.document)),plain(f.source));
  assert.notDeepEqual(a.bodyweightIds,b.bodyweightIds);
});
test('history merge reuses accepted settings/order/note/duplicate behavior with canonical provenance',async()=>{
  const f=await setup(),incoming=await f.lifecycle.parse(JSON.stringify(f.source),f.owner);
  const merged=f.lifecycle.merge(f.handle,incoming,f.owner);
  assert.deepEqual(plain(merged.document),plain(f.document));assert.deepEqual(plain(merged.bodyweightIds),f.bodyweightIds);
  const next=structuredClone(incoming),sessionless=next.document.data.sets.find(s=>s.sessionId==null);next.document.data.sets.push({...sessionless,id:'new-set'});
  const added=f.lifecycle.merge(f.handle,next,f.owner);
  assert.equal(added.document.data.sets.length,f.document.data.sets.length+1);
  assert.deepEqual(plain(added.document.data.program),plain(f.document.data.program));
  assert.deepEqual(plain(added.document.data.preferences),plain(f.document.data.preferences));
  assert.deepEqual(plain(added.document.data.sets.at(-1).exercise),plain(sessionless.exercise));
  next.document.catalog.aliases[0].exerciseId=next.document.catalog.exercises.at(-1).id;
  assert.throws(()=>f.lifecycle.merge(f.handle,next,f.owner));
});
test('restore preparation requires recovery verification and uses the accepted uncertain request controller',async()=>{
  const f=await setup();let saved=f.handle,calls=0,fail=true,packet,resolve;
  const repo=f.lifecycle.createRepository({ownerId:f.owner,client:{rpc:async(name,args)=>{
    if(name==='gymbro_lifecycle_snapshot')return {data:saved};
    calls++;packet??=args.packet;
    if(fail){fail=false;throw Error('lost');}
    assert.deepEqual(plain(args.packet),plain(packet));
    return {data:{code:'REPLAY',operation:args.packet.operation,operationRevision:'13',result:args.packet.result,snapshot:{...saved,revision:'13'}}};
  }}});
  const controller=f.lifecycle.createController({initial:saved,repository:repo,recoveryStorage:storage()});
  const text=JSON.stringify(f.lifecycle.backup(saved));
  assert.equal((await controller.execute('restoreCompleteBackup',{text,confirmed:true})).code,'VALIDATION_ERROR');assert.equal(calls,0);
  const result=await controller.execute('restoreCompleteBackup',{text,confirmed:true,safety:f.lifecycle.verifySafety(text,saved)});
  assert.equal(result.code,'OUTCOME_UNKNOWN');assert.equal(calls,1);assert(Object.isFrozen(packet));
  assert.deepEqual(plain(controller.getWorkoutState()),plain(f.document));
  assert.equal((await controller.retry()).code,'REPLAY');assert.equal(controller.getStatus().revision,'13');assert.equal(calls,2);
});
test('emergency cannot be requested for healthy data or via network failure',async()=>{
  const f=await setup();let calls=0;
  const repository={ownerId:f.owner,prepare:()=>{calls++;throw Error('unexpected');}};
  const controller=f.lifecycle.createController({initial:f.handle,repository,recoveryStorage:storage()});
  const text=JSON.stringify(f.lifecycle.backup(f.handle));
  assert.equal((await controller.execute('restoreCompleteBackup',{text,confirmed:true,emergencyConfirmed:true,rawOffered:true})).code,'VALIDATION_ERROR');assert.equal(calls,0);
  const broken=f.lifecycle.createRepository({ownerId:f.owner,client:{rpc:async()=>({error:{code:'network'}})}});
  await assert.rejects(broken.load(),/Cloud operation could not be verified/);
});
test('local cleanup requires accepted cutover, exact raw backup, unchanged bytes and explicit separate confirmation',async()=>{
  const f=await setup(),s=storage();s.setItem('daveGymTrackerV1','{corrupt future raw');s.setItem('auth','retained');
  assert.throws(()=>f.lifecycle.localRecovery({storage:s}).capture(),/cutover/);
  const local=f.lifecycle.localRecovery({storage:s,cutoverAccepted:true});
  assert.equal(local.capture(),'{corrupt future raw');assert.throws(()=>local.verify('normalized'));
  local.verify('{corrupt future raw');assert.throws(()=>local.remove({confirmed:true}));
  s.setItem('daveGymTrackerV1','changed');assert.throws(()=>local.remove({confirmed:true,oldTabsClosed:true}),/changed/);
  local.capture();local.verify('changed');assert(local.remove({confirmed:true,oldTabsClosed:true}).ok);
  assert.equal(s.getItem('auth'),'retained');assert.equal(s.getItem('daveGymTrackerV1'),null);
});
