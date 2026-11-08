const fs=require('node:fs'),path=require('node:path');
const {setup}=require('./lifecycle-fixture.cjs');
async function setupBatch(){const f=await setup();for(const file of ['batch-import.js','workout-cloud.js'])f.get(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));return {...f,batch:f.get('BatchImport'),cloud:f.get('WorkoutCloud')};}
function workouts(f,n=10){return {format:'gymbro-workout-batch',formatVersion:1,batchId:'batch-example',source:'chatgpt',workouts:Array.from({length:n},(_,i)=>({importId:'batch-workout-'+i,workout:{date:'2026-11-07',notes:'unit '+i,sets:[{exercise:f.document.catalog.exercises[0].displayName,weight:0,unit:'lb',reps:7,rpe:7,rir:2,pain:1,painArea:'raw',notes:'  exact\n',complete:false}]}}))};}
function history(f){const source=structuredClone(f.source);const session=source.sessions[0];session.status='completed';session.completedAt='2026-10-28T05:00:00.000Z';source.activeSessionId=null;source.sets=source.sets.filter(s=>s.sessionId===session.id);source.imports=[];return source;}
async function cloudBatchFixture(){
  const f=await setupBatch(),{storage,plain}=require('./protocol-fixture.cjs');let saved=plain(f.handle),fault=null;const calls=[],receipts=new Map();
  const client={rpc:async(name,args={})=>{
    calls.push({name,args:plain(args)});if(name==='gymbro_lifecycle_snapshot')return {data:saved};
    const packet=args.packet,op=packet?.operation??args.operation,key=JSON.stringify(op);let answer;
    if(receipts.has(key))answer=receipts.get(key);
    else if(name.endsWith('_resolve')){answer={code:'CANCELLED'};receipts.set(key,answer);}
    else if(packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
    else if(fault==='rollback'){fault=null;return {error:{code:'23514'}};}
    else{saved={...saved,...plain(f.repository.assemble(packet.next,f.owner)),rows:plain(packet.next),revision:String(BigInt(saved.revision)+1n)};answer={code:'OK',result:packet.result,operationRevision:saved.revision};receipts.set(key,{...answer,code:'REPLAY'});if(fault==='lost'){fault=null;throw Error('Committed acknowledgement lost');}}
    return {data:{...answer,operation:op,snapshot:saved}};
  }};
  const recovery=storage(),create=()=>f.cloud.create({client,ownerId:f.owner,initial:saved,recoveryStorage:recovery});
  return {...f,create,calls,receipts,getSaved:()=>plain(saved),fault:v=>{fault=v;},advance:()=>{saved.revision=String(BigInt(saved.revision)+1n);}};
}
module.exports={setupBatch,workouts,history,cloudBatchFixture};
