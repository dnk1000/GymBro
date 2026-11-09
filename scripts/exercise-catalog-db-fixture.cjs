const fs=require('node:fs'),path=require('node:path');const {setup}=require('../tests/lifecycle-fixture.cjs');
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
async function buildSql(){
  const f=await setup();f.get(fs.readFileSync(path.join(__dirname,'..','exercise-catalog.js'),'utf8'));
  const catalog=f.get('ExerciseCatalog'),source=f.document.catalog.exercises.find(e=>e.displayName==='Bench Press'),target=f.document.catalog.exercises.find(e=>e.displayName==='Smith Press');
  const base=structuredClone(f.handle);base.revision='1';
  // Completed guidance must remain immutable to ordinary writes after remap.
  base.document.data.sessions[0].status='completed';base.document.data.sessions[0].completedAt='2026-11-09T04:00:00.000Z';base.document.data.activeSessionId=null;
  base.rows=f.repository.project(base.document,f.owner,base.bodyweightIds,base.signatureSchemes);
  const init=f.repository.create({ownerId:f.owner,client:{}}).prepare(null,base,{action:'initialize',args:[],operation:['initialize','catalog-fixture'],result:{changes:['all']}});
  const input={exerciseId:source.id,targetId:target.id,confirmed:true,keepNameAlias:true};
  const prepared=catalog.prepare(base,'mergeCatalogExercises',[input]);
  const packet=catalog.createRepository({client:{},ownerId:f.owner}).prepare(base,prepared.candidate,{action:'mergeCatalogExercises',args:[input],operation:['mergeCatalogExercises','catalog-merge'],result:prepared.result});
  const bad=structuredClone(packet);bad.operation=['mergeCatalogExercises','tamper'];bad.next.exercises.find(e=>e.exercise_id===source.id).metadata.gymbroMerge.operation=bad.operation;bad.next.sets[0].notes='tampered fact';
  const owner=f.owner,other='88888888-8888-4888-8888-999999999917';
  return `begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('${owner}'),('${other}');
create temporary table catalog_packets(name text primary key,packet jsonb);
grant select on catalog_packets to authenticated;
insert into catalog_packets values('init',${literal(init)}),('merge',${literal(packet)}),('bad',${literal(bad)});
set local role authenticated;
select set_config('request.jwt.claim.sub','${owner}',true);
select set_config('request.jwt.claims','{"sub":"${owner}","is_anonymous":false}',true);
select is(public.gymbro_workout_mutate((select packet from catalog_packets where name='init'))->>'code','OK','initialize real canonical graph');
select throws_ok($test$select public.gymbro_catalog_mutate((select packet from catalog_packets where name='bad'))$test$,'23514',null,'forged fact change rejected atomically');
select is(public.gymbro_workout_snapshot()->>'revision','1','rejected packet leaves revision');
select is(public.gymbro_workout_normalize(public.gymbro_workout_snapshot()->'rows'),public.gymbro_workout_normalize(${literal(base.rows)}),'full before content preserved');
select is(public.gymbro_catalog_mutate((select packet from catalog_packets where name='merge'))->>'code','OK','merge completed historical graph');
select is(public.gymbro_lifecycle_snapshot()->>'status','healthy','v2 reconstruction healthy');
select is(public.gymbro_lifecycle_snapshot()#>>'{rows,workout_state,0,document_extra,identityVersion}','2','identity upgraded only on acknowledged catalog mutation');
select is(public.gymbro_catalog_mutate((select packet from catalog_packets where name='merge'))->>'code','REPLAY','exact old-base retry replays');
select is(public.gymbro_workout_snapshot()->>'revision','2','replay never increments revision');
select is(public.gymbro_workout_normalize(jsonb_set(public.gymbro_workout_snapshot()->'rows','{exercises}',
  (select jsonb_agg(case when e->>'exercise_id'='${source.id}' then jsonb_set(e,'{metadata,gymbroMerge,mergedAt}','null') else e end)
   from jsonb_array_elements(public.gymbro_workout_snapshot()#>'{rows,exercises}') e))),
  public.gymbro_workout_normalize((select packet->'next' from catalog_packets where name='merge')),'every field and relationship matches reviewed candidate except authoritative server timestamp');
select is((select count(*)::int from public.gymbro_sets),${base.rows.sets.length},'no duplicated sets');
select is((select count(*)::int from public.gymbro_exercise_aliases where label='Bench Press' and exercise_id='${target.id}'),1,'old name resolves to destination');
select is((select state from public.gymbro_exercises where exercise_id='${source.id}'),'archived','source retained archived');
select ok((select metadata#>>'{gymbroMerge,mergedAt}' is not null from public.gymbro_exercises where exercise_id='${source.id}'),'server merge timestamp retained');
select is((select count(*)::int from public.gymbro_guided_requests),${base.rows.guided_requests.length},'request tombstones unchanged');
select is(public.gymbro_catalog_mutate((select jsonb_set(packet,'{operation}','["mergeCatalogExercises","stale"]') from catalog_packets where name='merge'))->>'code','CONFLICT','stale review rejected before mutation');
select ok(not pg_has_role('authenticated','gymbro_catalog_writer','MEMBER'),'browser cannot assume catalog role');
select ok(not has_table_privilege('authenticated','public.gymbro_snapshot_slots','UPDATE'),'direct snapshot editing still denied');
select ok(not has_table_privilege('gymbro_workout_writer','public.gymbro_exercise_aliases','UPDATE'),'ordinary writer still cannot reassign aliases');
select ok(not has_table_privilege('gymbro_catalog_writer','public.gymbro_sets','DELETE'),'catalog cannot delete facts');
select ok(not has_table_privilege('gymbro_catalog_writer','public.gymbro_mutation_receipts','UPDATE'),'catalog cannot rewrite receipts');
select throws_ok($test$select public.gymbro_workout_mutate(jsonb_build_object('protocolVersion',1,'ownerId','${owner}','expectedRevision','2',
  'action','editSet','operation',jsonb_build_array('editSet','forged-snapshot-edit'),'args','[]'::jsonb,'result','{}'::jsonb,
  'base',public.gymbro_workout_snapshot()->'rows','next',jsonb_set(public.gymbro_workout_snapshot()->'rows','{snapshot_slots,0,role}',
    case when public.gymbro_workout_snapshot()#>>'{rows,snapshot_slots,0,role}'='core' then '"accessory"'::jsonb else '"core"'::jsonb end)))$test$,'23514',null,'ordinary mutation cannot edit snapshot after merge');
select is(public.gymbro_lifecycle_mutate(jsonb_build_object('protocolVersion',1,'ownerId','${owner}','action','restoreCompleteBackup',
  'operation',jsonb_build_array('restoreCompleteBackup','catalog-v2-backup-restore'),'expectedRevision','2','sourceOwnerId','${owner}',
  'fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint','status','healthy',
  'safety',jsonb_build_object('ownerId','${owner}','revision','2','fingerprint',public.gymbro_lifecycle_snapshot()->'fingerprint'),
  'base',public.gymbro_workout_snapshot()->'rows','next',public.gymbro_workout_snapshot()->'rows','result',jsonb_build_object('changes',jsonb_build_array('workoutData'))))->>'code','OK','complete lifecycle restore accepts the merged identity-v2 graph');
select is(public.gymbro_lifecycle_snapshot()->>'status','healthy','restored merged graph reconstructs');
select is(public.gymbro_workout_normalize(jsonb_set(public.gymbro_workout_snapshot()->'rows','{exercises}',
  (select jsonb_agg(case when e->>'exercise_id'='${source.id}' then jsonb_set(e,'{metadata,gymbroMerge,mergedAt}','null') else e end)
   from jsonb_array_elements(public.gymbro_workout_snapshot()#>'{rows,exercises}') e))),
  public.gymbro_workout_normalize((select packet->'next' from catalog_packets where name='merge')),'complete restore retains every merged fact, alias and audit field');
select set_config('request.jwt.claim.sub','${other}',true);
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":false}',true);
select throws_ok($test$select public.gymbro_catalog_mutate((select packet from catalog_packets where name='merge'))$test$,'23514',null,'foreign-owner mutation rejected');
select is_empty('select * from public.gymbro_sets','other owner cannot read facts');
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":true}',true);
select throws_ok($test$select public.gymbro_catalog_mutate((select packet from catalog_packets where name='merge'))$test$,'42501',null,'anonymous authenticated session cannot use catalog mutation');
reset role;
select * from finish();
rollback;
`;
}
if(require.main===module)buildSql().then(sql=>{fs.mkdirSync(path.join(__dirname,'..','test-results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'..','test-results','exercise-catalog.test.sql'),sql);console.log('Generated catalog integrity/ownership/receipt checks.');}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={buildSql};
