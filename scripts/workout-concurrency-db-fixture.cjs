// Actual domain packets + actual checked SQL. Synthetic data; always rolled back.
const fs=require('node:fs'),path=require('node:path');
const {buildSql:relational}=require('./workout-repository-db-fixture.cjs');
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
async function buildSql() {
  const data={};await relational(data);const {f,bundles,packets,steps}=data;
  const init=f.repository.create({ownerId:f.owner,client:{}}).prepare(null,f,{action:'initialize',args:[],operation:['initialize','protocol-fixture'],result:{changes:['all']}});
  const all=[init,...packets.map((p,i)=>({...p,expectedRevision:String(i+1)}))];
  const owner=f.owner,other='88888888-8888-4888-8888-888888888840',last=all.length-1;
  const call=i=>`public.gymbro_workout_mutate((select packet from protocol_packets where step=${i}))`;
  const sql=[`begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id) values('${owner}'),('${other}');
create temporary table protocol_packets(step int primary key,packet jsonb);
grant select on protocol_packets to authenticated;`];
  all.forEach((p,i)=>sql.push(`insert into protocol_packets values(${i},${literal(p)});`));
  sql.push(`set local role authenticated;
select set_config('request.jwt.claim.sub','${owner}',true);
select set_config('request.jwt.claims','{"sub":"${owner}","is_anonymous":false}',true);
select is(public.gymbro_workout_snapshot()->>'revision','0','new owner revision zero');`);
  all.forEach((p,i)=>sql.push(`select is(${call(i)}->>'code','OK','checked ${i===0?'initialize':steps[i-1][0]} commits');
select is(public.gymbro_workout_snapshot()->>'revision','${i+1}','exactly one revision per mutation ${i}');
select is(public.gymbro_workout_normalize(public.gymbro_workout_snapshot()->'rows'),public.gymbro_workout_normalize((select packet->'next' from protocol_packets where step=${i})),'all fields and relationships match packet ${i}');`));
  all.forEach((p,i)=>sql.push(`select is(${call(i)}->>'code','REPLAY','old-base exact request ${i} replays before stale check');
select is(${call(i)}->>'operationRevision','${i+1}','original operation revision ${i} retained');`));
  sql.push(`select is(public.gymbro_workout_snapshot()->>'revision','${all.length}','replay never increments revision');
select is((select count(*)::int from public.gymbro_mutation_receipts),${all.length},'one receipt per committed mutation');
select is((select count(*)::int from public.gymbro_sets where set_id='synthetic-relational-new-1'),0,'retry does not resurrect deleted set');
select is((select notes from public.gymbro_sets where set_id='synthetic-relational-new-2'),'corrected completed-session fact','retry never restores old corrected contents');
select is(public.gymbro_workout_mutate(jsonb_set((select packet from protocol_packets where step=1),'{args,0,notes}','"altered"'))->>'code','REQUEST_CONFLICT','same key altered packet rejected');
select is(public.gymbro_workout_mutate(jsonb_set((select packet from protocol_packets where step=1),'{operation}',${literal(['logSet','stale-new-key'])}))->>'code','CONFLICT','stale distinct request conflicts');`);
  sql.push(`select throws_ok($test$select public.gymbro_workout_resolve('[]')$test$,'23514',null,'malformed operation rejected');
select is(public.gymbro_workout_resolve('["logSet","cancelled-before-arrival"]')->>'code','CANCELLED','resolver fences missing original');
select is(public.gymbro_workout_resolve('["logSet","cancelled-before-arrival"]')->>'code','CANCELLED','cancellation is terminal and idempotent');
select is(public.gymbro_workout_mutate(jsonb_set((select packet from protocol_packets where step=1),'{operation}','["logSet","cancelled-before-arrival"]'))->>'code','CANCELLED','late original cannot pass a winning cancellation');
select is(public.gymbro_workout_snapshot()->>'revision','${all.length}','cancellation and rejection do not increment revision');
select throws_ok($test$select public.gymbro_workout_mutate(jsonb_set((select packet from protocol_packets where step=1),'{ownerId}','"${other}"'))$test$,'23514',null,'supplied owner cannot override authenticated owner');
select throws_ok($test$select public.gymbro_workout_commit(null,null)$test$,'42501',null,'old unchecked RPC execution revoked');
select ok(not pg_has_role('authenticated','gymbro_workout_writer','MEMBER'),'browser cannot assume writer role');
select ok(not exists(select 1 from pg_roles where rolname='gymbro_workout_writer' and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)),'writer is narrow non-login/non-bypass role');
select ok(not has_schema_privilege('gymbro_workout_writer','public','CREATE'),'writer cannot create objects');
select ok(not has_table_privilege('authenticated','public.gymbro_mutation_receipts','INSERT'),'browser cannot forge receipts');
select ok(not has_table_privilege('gymbro_workout_writer','public.gymbro_mutation_receipts','UPDATE'),'even checked writer cannot rewrite receipt');
select ok((select bool_and(prosecdef and proowner='gymbro_workout_writer'::regrole and proconfig @> array['search_path=""']) from pg_proc where oid in ('public.gymbro_workout_mutate(jsonb)'::regprocedure,'public.gymbro_workout_resolve(jsonb)'::regprocedure)),'only scoped role owns fixed-search-path entry points');`);
  for(const t of f.repository.tables) {
    const full=t==='aliases'?'gymbro_exercise_aliases':'gymbro_'+t;
    for(const verb of ['INSERT','UPDATE','DELETE']) sql.push(`select ok(not has_table_privilege('authenticated','public.${full}','${verb}'),'browser ${t} ${verb} bypass denied');`);
  }
  // Constraint fault after an early settings mutation must roll back the entire
  // RPC, including metadata, not merely the later invalid set.
  const lastRows=bundles.at(-1);
  const bad=structuredClone(lastRows);bad.workout_state[0].duration=bad.workout_state[0].duration===30?60:30;
  bad.sets[0].exercise_id='11111111-1111-4111-8111-111111111111';
  const invalid={...all[last],operation:['editSet','atomic-failure'],action:'editSet',args:['synthetic'],expectedRevision:String(all.length),base:lastRows,next:bad};
  const badBase=structuredClone(invalid);badBase.operation=['editSet','wrong-base'];badBase.base=bad;badBase.next=lastRows;
  sql.push(`select is(public.gymbro_workout_mutate(${literal(badBase)})->>'code','CONFLICT','matching revision cannot bypass full-base comparison');
select throws_ok($test$select public.gymbro_workout_mutate(${literal(invalid)})$test$,'23503',null,'constraint fault rolls back entire mutation');
select is((select count(*)::int from public.gymbro_mutation_receipts where operation='["editSet","atomic-failure"]'),0,'rollback leaves no receipt');
select is(public.gymbro_workout_snapshot()->>'revision','${all.length}','rollback leaves revision unchanged');
select is(public.gymbro_workout_normalize(public.gymbro_workout_snapshot()->'rows'),public.gymbro_workout_normalize(${literal(lastRows)}),'rollback preserves every original fact and relationship');
select set_config('request.jwt.claim.sub','${other}',true);
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":false}',true);
select is_empty('select * from public.gymbro_mutation_receipts','other owner cannot inspect receipts');
select is_empty('select * from public.gymbro_workout_versions','other owner cannot inspect revision');
select is(jsonb_array_length(public.gymbro_workout_snapshot()->'rows'->'sets'),0,'signed second owner sees no workout facts');
select throws_ok($test$select ${call(0)}$test$,'23514',null,'cross-owner packet fails before mutation');
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":true}',true);
select throws_ok($test$select public.gymbro_workout_snapshot()$test$,'42501',null,'anonymous auth cannot read snapshot');
select throws_ok($test$select ${call(0)}$test$,'42501',null,'anonymous auth cannot mutate');
select throws_ok($test$select public.gymbro_workout_resolve('["logSet","other"]')$test$,'42501',null,'anonymous auth cannot create fences');
reset role;
select * from finish();
rollback;`);
  return sql.join('\n')+'\n';
}
if(require.main===module) buildSql().then(sql=>{const target=path.join(__dirname,'..','test-results','workout-concurrency.test.sql');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,sql);console.log('Generated protocol integration assertions from real domain actions.');}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={buildSql,literal};
