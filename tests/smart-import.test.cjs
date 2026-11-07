const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {setup}=require('./lifecycle-fixture.cjs'),{storage,plain}=require('./protocol-fixture.cjs');
async function fixture(){
  const f=await setup();f.get(fs.readFileSync(path.join(__dirname,'../workout-cloud.js'),'utf8'));
  let saved=plain(f.handle),fault=null;const receipts=new Map(),calls=[];
  const client={rpc:async(name,args={})=>{
    calls.push({name,args:plain(args)});if(name==='gymbro_lifecycle_snapshot')return {data:saved};
    const packet=args.packet,op=packet?.operation??args.operation,key=JSON.stringify(op);let answer;
    if(receipts.has(key))answer=receipts.get(key);
    else if(name.endsWith('_resolve')){answer={code:'CANCELLED'};receipts.set(key,answer);}
    else if(packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
    else if(fault==='rollback'){fault=null;return {error:{code:'23514'}};}
    else {assert.deepEqual(plain(packet.base),plain(f.repository.project(saved.document,f.owner,saved.bodyweightIds,saved.signatureSchemes)),'base must be actual committed state');
      saved={...saved,...plain(f.repository.assemble(packet.next,f.owner)),rows:plain(packet.next),revision:String(BigInt(saved.revision)+1n)};
      answer={code:'OK',result:packet.result,operationRevision:saved.revision};receipts.set(key,{...answer,code:'REPLAY'});
      if(fault==='lost'){fault=null;throw Error('lost acknowledgement');}
    }
    return {data:{...answer,operation:op,snapshot:saved}};
  }};
  const recovery=storage(),create=()=>f.get('WorkoutCloud').create({client,ownerId:f.owner,initial:saved,recoveryStorage:recovery});
  return {...f,create,calls,receipts,getSaved:()=>plain(saved),fault:v=>{fault=v;},advance:()=>{saved.revision=String(BigInt(saved.revision)+1n);}};
}
function draft(f){const known=f.document.catalog.exercises[0];const input=f.get('normalizeInboxPayload')({importId:'reviewed-import',date:'2026-11-07',bodyweight:199,notes:'  original\n',sets:['Exact mapped label','Dumbbell new identity','Smith skipped identity'].map(exercise=>({include:true,exercise,weight:0,reps:7,unit:'lb',rpe:7,rir:2,pain:1,painArea:'area',notes:'note',complete:false}))});return {...input,resolutions:[{label:'Exact mapped label',kind:'map',exerciseId:known.id},{label:'Dumbbell new identity',kind:'create'},{label:'Smith skipped identity',kind:'skip'}]};}
test('cloud import atomically prepares aliases/exercises/facts against original base and freezes identity across lost-ack retry',async()=>{
  const f=await fixture(),a=f.create(),before=f.getSaved(),input=draft(f),original=plain(input);f.fault('lost');
  assert.equal((await a.execute('commitImport',input)).code,'OUTCOME_UNKNOWN');assert.deepEqual(plain(input),original);
  const committed=f.getSaved(),packet=f.calls.find(c=>c.args.packet).args.packet;
  assert.equal(committed.rows.sets.length,before.rows.sets.length+2);assert.equal(committed.rows.bodyweights.length,before.rows.bodyweights.length+1);
  assert.equal(committed.document.catalog.exercises.length,before.document.catalog.exercises.length+1);assert.equal(committed.document.catalog.aliases.length,before.document.catalog.aliases.length+2);
  assert.deepEqual(plain(a.getWorkoutState()),before.document,'unacknowledged state is not published');
  assert.equal((await a.retry()).code,'REPLAY');assert.deepEqual(f.getSaved(),committed);
  assert.deepEqual(f.calls.filter(c=>c.args.packet).map(c=>c.args.packet),[packet,packet]);
  assert.equal((await a.execute('commitImport',input)).code,'DUPLICATE_IMPORT');assert.deepEqual(f.getSaved(),committed);
  assert.equal(committed.document.data.sets.at(-2).exercise.originalLabel,'Exact mapped label');
  assert.equal(committed.document.data.sets.at(-1).complete,false);assert.equal(committed.document.data.sets.at(-1).weight,0);
  const backup=f.lifecycle.backup(committed),parsed=await f.lifecycle.parse(JSON.stringify(backup),f.owner);assert.deepEqual(plain(parsed.document),committed.document);
});
test('unresolved/colliding decisions and stale controller write nothing; refresh does not silently retarget',async()=>{
  const f=await fixture(),a=f.create(),before=f.getSaved(),input=draft(f);
  assert.equal((await a.execute('commitImport',{...input,resolutions:[]})).code,'VALIDATION_ERROR');assert.deepEqual(f.getSaved(),before);
  const wrong={...input,resolutions:[{label:input.sets[0].exercise,kind:'map',exerciseId:'unknown'}]};assert.equal((await a.execute('commitImport',wrong)).code,'VALIDATION_ERROR');
  f.advance();const newer=f.getSaved();assert.equal((await a.execute('commitImport',input)).code,'CONFLICT');assert.deepEqual(f.getSaved(),newer);
  await a.refresh();assert.equal((await a.execute('commitImport',input)).code,'OK');
});
test('server rejection preserves catalog/facts; hard reload resolves committed receipt without resending',async()=>{
  const f=await fixture(),a=f.create(),input=draft(f),before=f.getSaved();f.fault('rollback');
  assert.equal((await a.execute('commitImport',input)).code,'VALIDATION_ERROR');assert.deepEqual(f.getSaved(),before);assert.equal(f.receipts.size,0);
  f.fault('lost');assert.equal((await a.execute('commitImport',input)).code,'OUTCOME_UNKNOWN');const committed=f.getSaved();a.dispose();
  const reloaded=f.create();assert.equal(reloaded.getStatus().phase,'OUTCOME_UNKNOWN');const writes=f.calls.filter(c=>c.args.packet).length;
  assert.equal((await reloaded.resolve()).code,'REPLAY');assert.deepEqual(f.getSaved(),committed);assert.equal(f.calls.filter(c=>c.args.packet).length,writes);
});
