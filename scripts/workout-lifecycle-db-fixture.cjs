// Synthetic actual lifecycle packets; transaction rolls back including Auth.
const fs=require('node:fs'),path=require('node:path');
const {setup}=require('../tests/lifecycle-fixture.cjs');
const {literal}=require('./workout-concurrency-db-fixture.cjs');
async function buildSql(){
  const f=await setup(),owner=f.owner,other='88888888-8888-4888-8888-888888888841';
  const rows=f.handle.rows,restored=structuredClone(rows);restored.sets[0].notes='restored whole history';restored.sessions[0].snapshot_name='Restored historical intent';
  const repo=f.lifecycle.createRepository({ownerId:owner,client:{}});
  const packet=repo.prepare({...f.handle,revision:'1'},f,{action:'restoreCompleteBackup',operation:['restoreCompleteBackup','replace'],result:{}});
  const init=f.repository.create({ownerId:owner,client:{}}).prepare(null,f,{action:'initialize',args:[],operation:['initialize','lifecycle'],result:{}});
  // Fingerprints are always obtained from real PostgreSQL snapshots, not a JS approximation.
  const sql=[`begin;create extension if not exists pgtap with schema extensions;set local search_path=public,extensions;select no_plan();
insert into auth.users(id) values('${owner}'),('${other}');
create temporary table lifecycle_packets(name text primary key,packet jsonb);grant select,insert,update on lifecycle_packets to authenticated;
insert into lifecycle_packets values('restore',${literal({...packet,next:restored})});
set local role authenticated;
select set_config('request.jwt.claim.sub','${owner}',true);select set_config('request.jwt.claims','{"sub":"${owner}","is_anonymous":false}',true);
select is(public.gymbro_lifecycle_snapshot()->>'status','uninitialized','empty owner is positively uninitialized, never healthy backup');
select is(public.gymbro_workout_mutate(${literal(init)})->>'code','OK','initialize actual complete fixture');
select is(public.gymbro_lifecycle_snapshot()->>'status','healthy','representative full aggregate is reconstructable');
select ok(not public.gymbro_lifecycle_readable(jsonb_set(${literal(rows)},'{sessions,0,created_at}','"invalid"')),'invalid timestamp is server-qualified unreadable');
select ok(not public.gymbro_lifecycle_readable(jsonb_set(${literal(rows)},'{sets,0,extra,notes}','"shadow"')),'shadowed reconstruction metadata is unreadable');
select ok(not public.gymbro_lifecycle_readable(jsonb_set(${literal(rows)},'{sets,0,position}','999')),'noncontiguous source order is unreadable');
select ok(not public.gymbro_lifecycle_readable(jsonb_set(${literal(rows)},'{templates,0,present}','[]')),'missing required source keys cannot be called healthy');
select ok(public.gymbro_lifecycle_timestamp('0000-02-29T00:00:00.000Z'),'valid year-zero ISO timestamp retains accepted compatibility');
update lifecycle_packets set packet=packet||jsonb_build_object('fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint',
  'safety',jsonb_build_object('ownerId','${owner}','revision','1','fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint'));
select is(public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='restore'))->>'code','OK','confirmed complete replacement commits');
select is(public.gymbro_workout_normalize(public.gymbro_lifecycle_snapshot()->'rows'),public.gymbro_workout_normalize(${literal(restored)}),'all restored content and relationships equal chosen backup');
select is(public.gymbro_lifecycle_snapshot()->>'revision','2','restore advances live revision');
select is((select count(*)::int from public.gymbro_mutation_receipts),2,'ordinary receipt survives replacement');
select is(public.gymbro_workout_mutate(${literal(init)})->>'code','REPLAY','old creation replays without resurrecting erased facts');
select is(public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='restore'))->>'code','REPLAY','lost restore acknowledgement retry is idempotent');
select is(public.gymbro_lifecycle_snapshot()->>'revision','2','replays never rewind or increment revision');
select is(public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='restore'),'{operation}','["restoreCompleteBackup","stale"]'))->>'code','CONFLICT','stale restore cannot overwrite new state');
select is(public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='restore'),'{result}','{"changed":true}'))->>'code','REQUEST_CONFLICT','same key altered input conflicts');
select is(public.gymbro_lifecycle_resolve('["restoreCompleteBackup","cancelled"]')->>'code','CANCELLED','cancellation fence created');
select is(public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='restore'),'{operation}','["restoreCompleteBackup","cancelled"]'))->>'code','CANCELLED','late restore cannot cross fence');
insert into lifecycle_packets select 'recovery',packet||jsonb_build_object('operation','["restoreCompleteBackup","recover-A"]'::jsonb,'expectedRevision','2','base',${literal(restored)},
  'next',${literal(rows)},'fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint',
  'safety',jsonb_build_object('ownerId','${owner}','revision','2','fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint')) from lifecycle_packets where name='restore';
select throws_ok($q$select public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='recovery'),'{safety}','null'))$q$,'23514',null,'healthy data cannot bypass safety through emergency claim');
select throws_ok($q$select public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='recovery'),'{sourceOwnerId}','"${other}"'))$q$,'42501',null,'cloud source account mismatch denied');
select throws_ok($q$select public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='recovery'),'{next,sets,0,exercise_id}','"11111111-1111-4111-8111-111111111111"'))$q$,'23503',null,'late constraint failure rolls back deletion and inserts');
select is(public.gymbro_workout_normalize(public.gymbro_lifecycle_snapshot()->'rows'),public.gymbro_workout_normalize(${literal(restored)}),'failure preserves entire prior dataset');
select is(public.gymbro_lifecycle_snapshot()->>'revision','2','failure preserves revision');
select is((select count(*)::int from public.gymbro_mutation_receipts where operation='["restoreCompleteBackup","recover-A"]'),0,'failure leaves no receipt');
select is(public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='recovery'))->>'code','OK','new explicitly confirmed recovery restores A');
select is(public.gymbro_workout_normalize(public.gymbro_lifecycle_snapshot()->'rows'),public.gymbro_workout_normalize(${literal(rows)}),'complete A recovery content equality');
select is(public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='restore'))->>'code','REPLAY','old B restore never reapplies after recovery');
select is(public.gymbro_workout_normalize(public.gymbro_lifecycle_snapshot()->'rows'),public.gymbro_workout_normalize(${literal(rows)}),'replay leaves A intact');
reset role;
-- Deliberately corrupt only synthetic extension metadata that typed relational columns cannot validate.
update public.gymbro_workout_state set extra=jsonb_set(extra,'{preferences}','{"invalid":7}') where owner_id='${owner}';
set local role authenticated;
select is(public.gymbro_lifecycle_snapshot()->>'status','unreadable','server verifies invalid reconstruction metadata');
select ok(public.gymbro_lifecycle_snapshot()->'rows' is not null,'raw diagnostic rows remain available, never normalized to empty');
insert into lifecycle_packets select 'emergency',packet||jsonb_build_object('operation','["restoreCompleteBackup","emergency"]'::jsonb,'expectedRevision','3',
  'base',public.gymbro_lifecycle_snapshot()->'rows','fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint','status','unreadable','safety',null) from lifecycle_packets where name='recovery';
select is(public.gymbro_lifecycle_mutate(jsonb_set((select packet from lifecycle_packets where name='emergency'),'{fingerprint}','"stale-raw"'))->>'code','CONFLICT','changed raw-state fingerprint rejects emergency');
select is(public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='emergency'))->>'code','OK','bounded emergency recovery succeeds from unreadable state');
select is(public.gymbro_lifecycle_snapshot()->>'status','healthy','recovery reestablishes valid state');
select is(public.gymbro_lifecycle_snapshot()->>'revision','4','emergency revision continues monotonically');
select is((select count(*)::int from public.gymbro_mutation_receipts where operation='["restoreCompleteBackup","cancelled"]' and status='cancelled'),1,'emergency retains cancellation fence');
select throws_ok($q$delete from public.gymbro_sets$q$,'42501',null,'direct browser deletion remains denied');
select throws_ok($q$select public.gymbro_workout_commit(null,null)$q$,'42501',null,'unchecked helper remains private');
select ok(not pg_has_role('authenticated','gymbro_lifecycle_writer','MEMBER'),'browser cannot assume lifecycle role');
select ok(not has_schema_privilege('gymbro_lifecycle_writer','public','CREATE'),'lifecycle role cannot create objects');
select ok(not has_table_privilege('gymbro_lifecycle_writer','public.gymbro_mutation_receipts','DELETE'),'lifecycle cannot erase receipts');
select ok(not has_table_privilege('gymbro_lifecycle_writer','public.gymbro_mutation_receipts','UPDATE'),'lifecycle cannot rewrite receipts');
select ok(not has_table_privilege('gymbro_workout_writer','public.gymbro_sessions','DELETE'),'ordinary writer does not inherit lifecycle deletion');
select set_config('request.jwt.claim.sub','${other}',true);select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":false}',true);
select is(public.gymbro_lifecycle_snapshot()->>'status','uninitialized','other owner remains untouched');
select is(jsonb_array_length(public.gymbro_lifecycle_snapshot()->'rows'->'sets'),0,'no foreign content leak');
select throws_ok($q$select public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='emergency'))$q$,'23514',null,'cross-owner destination denied');
insert into lifecycle_packets select 'empty',packet||jsonb_build_object('ownerId','${other}','sourceOwnerId',null,'operation','["restoreCompleteBackup","empty-legacy"]'::jsonb,
  'expectedRevision','0','status','uninitialized','base',public.gymbro_lifecycle_snapshot()->'rows','fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint',
  'next',(select jsonb_object_agg(t,(select coalesce(jsonb_agg(jsonb_set(r,'{owner_id}','"${other}"')),'[]') from jsonb_array_elements(v) r)) from jsonb_each(packet->'next') x(t,v))) from lifecycle_packets where name='emergency';
select is(public.gymbro_lifecycle_mutate((select packet from lifecycle_packets where name='empty'))->>'code','OK','legacy owner-neutral recovery into uninitialized authenticated account');
select is(public.gymbro_lifecycle_snapshot()->>'revision','1','uninitialized recovery establishes revision one');
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":true}',true);
select throws_ok($q$select public.gymbro_lifecycle_snapshot()$q$,'42501',null,'anonymous cannot obtain diagnostics');
select throws_ok($q$select public.gymbro_lifecycle_resolve('["restoreCompleteBackup","anon"]')$q$,'42501',null,'anonymous cannot resolve/cancel');
reset role;select * from finish();rollback;`];
  return sql.join('\n');
}
if(require.main===module)buildSql().then(sql=>{const dir=path.join(__dirname,'..','test-results');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'workout-lifecycle.test.sql'),sql);console.log('Synthetic lifecycle SQL generated.');}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={buildSql};
