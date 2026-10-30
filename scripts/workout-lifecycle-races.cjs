// Actual independent connections and post-commit lost-response injection.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{execFileSync}=require('node:child_process');
const {setup}=require('../tests/lifecycle-fixture.cjs');
const {queryClient,claims,prepare}=require('./workout-concurrency-races.cjs');
const {literal}=require('./workout-concurrency-db-fixture.cjs');
const {commandsFor}=require('./preview-db.cjs');
const {storage}=require('../tests/protocol-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function run(mode){const query=queryClient(mode),owners=[],workers=[],evidence=[];
  try{for(const name of ['restore-write','write-restore','restore-restore','duplicate-restore','cancel-original','original-cancel']){
    const f=await setup();f.owner=randomUUID();owners.push(f.owner);
    const init=f.repository.create({ownerId:f.owner,client:{}}).prepare(null,f,{action:'initialize',args:[],operation:['initialize','lifecycle-race'],result:{}});
    await query(`begin;insert into auth.users(id) values('${f.owner}');set local role authenticated;${claims(f.owner)}select public.gymbro_workout_mutate(${literal(init)}) as evidence;commit;`);
    const snapshot=await query(`begin;set local role authenticated;${claims(f.owner)}select public.gymbro_lifecycle_snapshot() as evidence;commit;`);
    const base={...snapshot,...f.repository.assemble(snapshot.rows,f.owner)};
    const repo=f.lifecycle.createRepository({ownerId:f.owner,client:{}}),after=structuredClone(base);after.document.data.sets[0].notes='restored-race';
    after.safety={ownerId:f.owner,revision:base.revision,fingerprint:base.fingerprint};
    const a=repo.prepare(base,after,{action:'restoreCompleteBackup',operation:['restoreCompleteBackup','race-a'],result:{}});
    const b=name==='restore-restore'?{...a,operation:['restoreCompleteBackup','race-b']}:
      name==='duplicate-restore'||name.includes('cancel')?a:
      await prepare(f,base,'logSet',[{date:'2026-10-30',exercise:f.document.catalog.exercises[0].id,weight:0,reps:8,sessionId:null}],'race-write');
    const restore=p=>`public.gymbro_lifecycle_mutate(${literal(p)})`,write=p=>`public.gymbro_workout_mutate(${literal(p)})`;
    const first=name==='write-restore'?write(b):name==='cancel-original'?`public.gymbro_lifecycle_resolve(${literal(a.operation)})`:restore(a);
    const second=name==='write-restore'?restore(a):name==='restore-write'?write(b):name==='original-cancel'?`public.gymbro_lifecycle_resolve(${literal(a.operation)})`:restore(b);
    const marker=randomUUID(),firstSql=`begin;set local role authenticated;${claims(f.owner)}select pg_advisory_xact_lock(hashtextextended('${f.owner}',39));
select set_config('application_name','${marker}',true);select pg_sleep(5);select jsonb_build_object('pid',pg_backend_pid(),'tx',pg_current_xact_id()::text,'result',${first}) as evidence;commit;`;
    const one=query(firstSql);workers.push(one);
    // Observe the actual open first transaction before starting the competing connection.
    let overlap=false;for(let i=0;i<8;i++){const observed=await query(`select jsonb_build_object('active',exists(select 1 from pg_stat_activity where application_name='${marker}' and state='active')) as evidence;`);if(observed.active){overlap=true;break;}}
    assert(overlap,'first transaction must be observed active');
    const two=query(`begin;set local role authenticated;${claims(f.owner)}select jsonb_build_object('pid',pg_backend_pid(),'tx',pg_current_xact_id()::text,'result',${second}) as evidence;commit;`);workers.push(two);
    const [x,y]=await Promise.all([one,two]);assert.notEqual(x.pid,y.pid);assert.notEqual(x.tx,y.tx);
    assert.deepEqual([x.result.code,y.result.code],name==='duplicate-restore'||name==='original-cancel'?['OK','REPLAY']:name==='cancel-original'?['CANCELLED','CANCELLED']:['OK','CONFLICT']);
    const final=await query(`begin;set local role authenticated;${claims(f.owner)}select public.gymbro_lifecycle_snapshot() as evidence;commit;`);
    assert.equal(final.revision,name==='cancel-original'?'1':'2');
    const expected=name==='write-restore'?b.next:name==='cancel-original'?snapshot.rows:a.next;
    assert(f.lifecycle.equalRows(final.rows,expected),'complete facts and relationships equal the winning operation');
    evidence.push({name,overlap,pids:[x.pid,y.pid],transactions:[x.tx,y.tx],codes:[x.result.code,y.result.code],revision:final.revision});
  }
  const f=await setup();f.owner=randomUUID();owners.push(f.owner);
  const init=f.repository.create({ownerId:f.owner,client:{}}).prepare(null,f,{action:'initialize',args:[],operation:['initialize','lost-ack'],result:{}});
  await query(`begin;insert into auth.users(id) values('${f.owner}');set local role authenticated;${claims(f.owner)}select public.gymbro_workout_mutate(${literal(init)}) as evidence;commit;`);
  let lost=true,packets=[];
  const transport={rpc:async(name,args)=>{const value=await query(`begin;set local role authenticated;${claims(f.owner)}select public.${name}(${args?.packet?literal(args.packet):''}) as evidence;commit;`);
    if(name==='gymbro_lifecycle_mutate'){packets.push(args.packet);if(lost){lost=false;throw Error('Real committed response deliberately lost');}}return {data:value};}};
  const repo=f.lifecycle.createRepository({client:transport,ownerId:f.owner}),initial=await repo.load();
  const controller=f.lifecycle.createController({initial,repository:repo,recoveryStorage:storage()});
  const file=f.lifecycle.backup(initial);file.payload.document.data.sets[0].notes='real lost restore response';
  assert.equal((await controller.execute('restoreCompleteBackup',{text:JSON.stringify(file),safety:f.lifecycle.verifySafety(JSON.stringify(f.lifecycle.backup(initial)),initial),confirmed:true})).code,'OUTCOME_UNKNOWN');
  assert.equal((await controller.retry()).code,'REPLAY');assert.deepEqual(packets[0],packets[1]);assert.equal((await repo.load()).revision,'2');
  evidence.push({name:'real-committed-lost-response',codes:['OUTCOME_UNKNOWN','REPLAY'],revision:'2',samePacket:true});
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results/lifecycle-races.json'),JSON.stringify(evidence,null,2));
  console.log(`${evidence.length} lifecycle independent-race/real-lost-response cases PASS.`);return evidence;
  }finally{await Promise.allSettled(workers);if(owners.length){const ids=owners.map(id=>`'${id}'`).join(',');
    const tables=[...(await setup()).repository.tables,'exercises','aliases'].reverse().map(t=>`delete from public.${t==='aliases'?'gymbro_exercise_aliases':'gymbro_'+t} where owner_id in (${ids});`).join('');
    await query(`begin;set constraints all deferred;delete from public.gymbro_mutation_receipts where owner_id in (${ids});delete from public.gymbro_workout_versions where owner_id in (${ids});${tables}delete from auth.users where id in (${ids});select jsonb_build_object('cleaned',true) as evidence;commit;`);
    const remaining=await query(`select jsonb_build_object('remaining',count(*)) as evidence from auth.users where id in (${ids});`);assert.equal(remaining.remaining,0);console.log('Lifecycle race synthetic owners independently confirmed cleaned.');
  }}
}
async function main(){if(process.argv.length!==3||!['--local','--staging'].includes(process.argv[2]))throw Error('Choose --local or --staging.');let mode=['--local'];
  if(process.argv[2]==='--staging'){const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(),sha=git(['rev-parse','HEAD']);
    const plan=commandsFor('apply',process.env,sha)[0];if(git(['status','--porcelain']))throw Error('Commit reviewed code first.');mode=['--linked','--project-ref',plan[plan.indexOf('--project-ref')+1]];}
  await run(mode);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={run};
