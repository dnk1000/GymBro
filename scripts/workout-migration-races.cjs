// Real independent disposable PostgreSQL transactions; never a Production path.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');const {setup}=require('../tests/lifecycle-fixture.cjs');
const {queryClient,claims}=require('./workout-concurrency-races.cjs');
const {literal}=require('./workout-concurrency-db-fixture.cjs');const {storage}=require('../tests/protocol-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function run(){const query=queryClient(['--local']),owners=[],workers=[],evidence=[];
  const load=owner=>query(`begin;set local role authenticated;${claims(owner)}select public.gymbro_lifecycle_snapshot() as evidence;commit;`);
  const invoke=(owner,call)=>query(`begin;set local role authenticated;${claims(owner)}select ${call} as evidence;commit;`);
  try{
    for(const name of ['distinct-initialization','duplicate-initialization','cancel-before-original']){
      const f=await setup();f.owner=randomUUID();owners.push(f.owner);f.get(fs.readFileSync(path.join(root,'workout-migration.js'),'utf8'));
      await query(`insert into auth.users(id) values('${f.owner}');select jsonb_build_object('created',true) as evidence;`);
      const base=await load(f.owner),candidate=await f.get('WorkoutMigration').prepareSource(JSON.stringify(f.source),f.owner);
      const packet=f.lifecycle.createRepository({ownerId:f.owner,client:{}}).prepare(base,candidate,{action:'initializeMigration',operation:['initializeMigration','race'],result:{}});
      const call=p=>`public.gymbro_migration_initialize(${literal(p)})`;
      const first=name==='cancel-before-original'?`public.gymbro_lifecycle_resolve(${literal(packet.operation)})`:call(packet);
      const second=call(name==='distinct-initialization'?{...packet,operation:['initializeMigration','other']}:packet),marker=randomUUID();
      const one=query(`begin;set local role authenticated;${claims(f.owner)}select pg_advisory_xact_lock(hashtextextended('${f.owner}',39));select set_config('application_name','${marker}',true);select pg_sleep(3);select jsonb_build_object('pid',pg_backend_pid(),'tx',pg_current_xact_id()::text,'result',${first}) as evidence;commit;`);workers.push(one);
      let overlap=false;for(let i=0;i<8;i++){const found=await query(`select jsonb_build_object('active',exists(select 1 from pg_stat_activity where application_name='${marker}' and state='active')) as evidence;`);if(found.active){overlap=true;break;}}
      assert(overlap);const two=invoke(f.owner,`jsonb_build_object('pid',pg_backend_pid(),'tx',pg_current_xact_id()::text,'result',${second})`);workers.push(two);
      const [a,b]=await Promise.all([one,two]);assert.notEqual(a.pid,b.pid);assert.notEqual(a.tx,b.tx);
      const codes=[a.result.code,b.result.code];assert.deepEqual(codes,name==='duplicate-initialization'?['OK','REPLAY']:name==='cancel-before-original'?['CANCELLED','CANCELLED']:['OK','CONFLICT']);
      const saved=await load(f.owner);assert.equal(saved.revision,name==='cancel-before-original'?'0':'1');
      assert(f.lifecycle.equalRows(saved.rows,name==='cancel-before-original'?base.rows:packet.next));
      evidence.push({name,overlap,pids:[a.pid,b.pid],transactions:[a.tx,b.tx],codes,revision:saved.revision,fullEquality:true});
    }
    const f=await setup();f.owner=randomUUID();owners.push(f.owner);
    for(const file of ['workout-migration.js','workout-cloud.js'])f.get(fs.readFileSync(path.join(root,file),'utf8'));
    await query(`insert into auth.users(id) values('${f.owner}');select jsonb_build_object('created',true) as evidence;`);
    let lose=true;const packets=[];
    const client={rpc:async(name,args={})=>{const answer=await invoke(f.owner,`public.${name}(${args.packet?literal(args.packet):args.operation?literal(args.operation):''})`);
      if(name==='gymbro_migration_initialize'){packets.push(args.packet);if(lose){lose=false;throw Error('Real commit response lost');}}return {data:answer};}};
    const repository=f.lifecycle.createRepository({client,ownerId:f.owner}),initial=await repository.load(),controller=f.get('WorkoutCloud').create({client,ownerId:f.owner,initial,recoveryStorage:storage()});
    assert.equal((await controller.execute('initializeMigration',{text:JSON.stringify(f.source),confirmed:true})).code,'OUTCOME_UNKNOWN');
    assert.equal((await controller.retry()).code,'REPLAY');assert.deepEqual(packets[0],packets[1]);
    const saved=await repository.load();assert.equal(saved.revision,'1');assert(f.lifecycle.equalRows(saved.rows,packets[0].next));
    evidence.push({name:'real-commit-lost-response',codes:['OUTCOME_UNKNOWN','REPLAY'],revision:'1',samePacket:true,fullEquality:true});
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results/migration-races.json'),JSON.stringify(evidence,null,2));console.log('4 migration independent-race/committed-loss cases PASS');
  }finally{
    await Promise.allSettled(workers);if(owners.length){const ids=owners.map(x=>`'${x}'`).join(','),f=await setup();
      const deletes=[...f.repository.tables,'exercises','aliases'].reverse().map(t=>`delete from public.${t==='aliases'?'gymbro_exercise_aliases':'gymbro_'+t} where owner_id in (${ids});`).join('');
      await query(`begin;set constraints all deferred;delete from public.gymbro_mutation_receipts where owner_id in (${ids});delete from public.gymbro_workout_versions where owner_id in (${ids});${deletes}delete from auth.users where id in (${ids});select jsonb_build_object('cleaned',true) as evidence;commit;`);
      const check=await query(`select jsonb_build_object('remaining',count(*)) as evidence from auth.users where id in (${ids});`);assert.equal(check.remaining,0);
    }
  }
}
if(require.main===module){if(process.argv.length!==3||process.argv[2]!=='--local')throw Error('Only --local disposable databases are supported.');run().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={run};
