// Independent real PostgreSQL connections, never sequential calls offered as
// race evidence. Local CI by default; staging needs #38's clean/reviewed guard.
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {fixture}=require('../tests/relational-fixture.cjs');
const {storage}=require('../tests/protocol-fixture.cjs');
const {literal}=require('./workout-concurrency-db-fixture.cjs');
const {commandsFor}=require('./preview-db.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');
function queryClient(mode) {
  let count=0;
  return async sql=> {
    fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`race-${process.pid}-${++count}.sql`);fs.writeFileSync(file,sql);
    const args=[require.resolve('supabase/dist/supabase.js'),'db','query',...mode,'--file',file];
    const output=await new Promise((resolve,reject)=> {
      const child=spawn(process.execPath,args,{cwd:root,env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',error='';
      child.stdout.on('data',d=>{out+=d;});child.stderr.on('data',d=>{error+=d;});
      child.on('error',()=>reject(Error('Independent database connection could not start.')));
      child.on('close',code=>code===0?resolve(out):reject(Error('Independent SQL transaction failed; inspect synthetic test SQL privately. '+(mode.includes('--local')?error.slice(-1200):''))));
    });
    let parsed;try {parsed=JSON.parse(output);} catch {throw Error('Database output was not JSON.');}
    const rows=parsed.rows??parsed;
    const found=Array.isArray(rows)?rows.find(row=>row.evidence):null;
    if(!found) throw Error('Database returned no concurrency evidence.');
    return typeof found.evidence==='string'?JSON.parse(found.evidence):found.evidence;
  };
}
async function prepare(f,initial,action,args,id) {
  let packet;
  const repository=f.repository.create({ownerId:f.owner,client:{rpc:async(name,{packet:next})=> {
    assert.equal(name,'gymbro_workout_mutate');packet=next;
    return {data:{code:'OK',operation:packet.operation,result:packet.result,operationRevision:(BigInt(initial.revision)+1n).toString(),snapshot:{protocolVersion:1,ownerId:f.owner,revision:(BigInt(initial.revision)+1n).toString(),rows:packet.next}}};
  }}});
  const controller=f.repository.createActions({initial,repository,recoveryStorage:storage(),createId:()=>id,createRequestId:()=>id,now:()=> '2026-10-30T04:00:00.000Z'});
  const result=await controller.execute(action,...args);
  if(!result.ok || !packet) throw Error('Race fixture action did not prepare: '+action+' '+result.code);
  return packet;
}
function claims(owner) {return `select set_config('request.jwt.claim.sub','${owner}',true);select set_config('request.jwt.claims','{"sub":"${owner}","is_anonymous":false}',true);`;}
function normalize(rows) {
  const sort=x=>Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;
  return Object.fromEntries(Object.keys(rows).sort().map(k=>[k,rows[k].map(x=>JSON.stringify(sort(x))).sort()]));
}
async function run(mode) {
  const query=queryClient(mode),owners=[],evidence=[];
  try {
    for(const name of ['start-start','edit-delete','log-finish','finish-log','duplicate-submit','cancel-original','original-cancel']) {
      const f=await fixture();f.owner=randomUUID();owners.push(f.owner);
      if(name==='start-start') {f.document.data.sessions=[];f.document.data.sets=[];f.document.data.activeSessionId=null;f.document.data.noteScopes.session=[];f.document.data.noteScopes.exerciseSession=[];}
      const repo=f.repository.create({client:{},ownerId:f.owner});
      const init=repo.prepare(null,f,{action:'initialize',args:[],operation:['initialize','race-fixture'],result:{}});
      await query(`begin;insert into auth.users(id) values('${f.owner}');set local role authenticated;${claims(f.owner)}select jsonb_build_object('code',public.gymbro_workout_mutate(${literal(init)})->>'code') as evidence;commit;`);
      const initial={document:f.document,bodyweightIds:f.bodyweightIds,initialized:true,protocolVersion:1,ownerId:f.owner,revision:'1'};
      const exercise=f.identity.resolveLabel(f.document.catalog,'Bench Press');
      const log={date:'2026-10-28',exercise,weight:0,reps:8,sessionId:f.sessionId,planSlotId:'slot-1'};
      let a,b,resolveA=false,resolveB=false;
      if(name==='start-start') {
        a=await prepare(f,initial,'createSession',[{date:'2026-10-28',templateId:'push',duration:60}],'race-start-a');
        b=await prepare(f,initial,'createSession',[{date:'2026-10-28',templateId:'push',duration:60}],'race-start-b');
      } else if(name==='edit-delete') {
        a=await prepare(f,initial,'editSet',[f.document.data.sets[0].id,{notes:'first connection correction'}],'race-edit');
        b=await prepare(f,initial,'deleteSet',[f.document.data.sets[0].id],'race-delete');
      } else if(name==='log-finish'||name==='finish-log') {
        a=await prepare(f,initial,'logSet',[log],'race-log');
        b=await prepare(f,initial,'finishGuidedSession',[{sessionId:f.sessionId,expectedRevision:3,allowPending:true}],'race-finish');
        if(name==='finish-log') [a,b]=[b,a];
      } else {
        a=await prepare(f,initial,'logSet',[log],'race-identical');b=a;
        resolveA=name==='cancel-original';resolveB=name==='original-cancel';
      }
      const tag='gymbro-issue40-'+randomUUID();
      const call=(p,resolving)=>resolving?`public.gymbro_workout_resolve(${literal(p.operation)})`:`public.gymbro_workout_mutate(${literal(p)})`;
      const transaction=(p,resolving,hold)=>`begin;set local application_name='${hold?tag:tag+'-second'}';${hold?`select pg_advisory_xact_lock(hashtextextended('${f.owner}',39));select pg_sleep(4);`:''}set local role authenticated;${claims(f.owner)}select jsonb_build_object('pid',pg_backend_pid(),'transaction',pg_current_xact_id()::text,'started',transaction_timestamp(),'finished',clock_timestamp(),'reply',${call(p,resolving)}) as evidence;commit;`;
      const first=query(transaction(a,resolveA,true));
      let held=false;
      for(let i=0;i<20&&!held;i++) {
        const status=await query(`select jsonb_build_object('held',exists(select 1 from pg_locks l join pg_stat_activity s on s.pid=l.pid where s.application_name='${tag}' and l.locktype='advisory' and l.granted)) as evidence;`);
        held=status.held;
      }
      if(!held) {await first;throw Error('Could not observe first independent transaction holding the owner lock.');}
      const [one,two]=await Promise.all([first,query(transaction(b,resolveB,false))]);
      assert.notEqual(one.pid,two.pid);assert.notEqual(one.transaction,two.transaction);
      assert(new Date(two.started)<new Date(one.finished),'second transaction overlapped first');
      const expected=resolveA?['CANCELLED','CANCELLED']:resolveB||name==='duplicate-submit'?['OK','REPLAY']:['OK','CONFLICT'];
      assert.deepEqual([one.reply.code,two.reply.code],expected,name);
      assert.equal(two.reply.snapshot.revision,resolveA?'1':'2');
      const current=two.reply.snapshot.rows;
      f.repository.assemble(current,f.owner);
      assert.deepEqual(normalize(current),normalize(resolveA?init.next:a.next),'complete post-race facts/relationships');
      const checks=await query(`begin;set local role authenticated;${claims(f.owner)}select jsonb_build_object('active',(select count(*) from public.gymbro_sessions where status='active'),'receipts',(select count(*) from public.gymbro_mutation_receipts where operation=${literal(a.operation)}),'revision',public.gymbro_workout_snapshot()->>'revision') as evidence;commit;`);
      assert(checks.active<=1);assert.equal(checks.receipts,1);
      evidence.push({case:name,pids:[one.pid,two.pid],transactions:[one.transaction,two.transaction],overlap:true,codes:expected,...checks});
      console.log(`Independent ${name}: ${expected.join('/')} at revision ${checks.revision}; one terminal receipt; full relationships preserved.`);
    }
    fs.writeFileSync(path.join(dir,'concurrency-races.json'),JSON.stringify(evidence,null,2));
    return evidence;
  } finally {
    if(owners.length) {
      const ids=owners.map(o=>`'${o}'`).join(',');
      // Only this run's fresh UUIDs. Never reset a hosted database or touch
      // another fixture/user. Remove child rows before Auth identities.
      const deletes=[...(await fixture()).repository.tables].reverse().map(t=>`delete from public.${t==='aliases'?'gymbro_exercise_aliases':'gymbro_'+t} where owner_id in (${ids});`).join('');
      await query(`begin;set constraints all deferred;delete from public.gymbro_mutation_receipts where owner_id in (${ids});delete from public.gymbro_workout_versions where owner_id in (${ids});${deletes}delete from auth.users where id in (${ids});select jsonb_build_object('cleaned',true) as evidence;commit;`);
      const remaining=await query(`select jsonb_build_object('remaining',(select count(*) from auth.users where id in (${ids}))) as evidence;`);assert.equal(remaining.remaining,0);console.log('Independent race fixtures cleaned; separate query confirms zero Auth rows.');
    }
  }
}
async function main() {
  const mode=process.argv[2];if(!['--local','--staging'].includes(mode)||process.argv.length!==3) throw Error('Choose exactly --local or --staging.');
  let target=['--local'];
  if(mode==='--staging') {
    const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();const sha=git(['rev-parse','HEAD']);
    const plan=commandsFor('apply',process.env,sha)[0];if(git(['status','--porcelain','--untracked-files=normal'])) throw Error('Commit reviewed code before staging races.');
    target=['--linked','--project-ref',plan[plan.indexOf('--project-ref')+1]];
  }
  await run(target);
}
if(require.main===module) main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run,prepare,claims,queryClient};
