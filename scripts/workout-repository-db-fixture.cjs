// Compose real DOM-free action preparation and relational mapping with pgTAP
// calls to the actual RPCs. Generated data is synthetic and transaction-scoped.
const fs=require("node:fs"),path=require("node:path");
const {fixture}=require("../tests/relational-fixture.cjs");
const {storage,handle}=require("../tests/protocol-fixture.cjs");
async function buildSql(capture) {
  const f=await fixture(),other="99999999-9999-4999-8999-999999999940";
  const bundles=[f.repository.project(f.document,f.owner,f.bodyweightIds)];
  const packets=[];let revision=0;
  const client={rpc:async(name,args)=> {
    if(name!=="gymbro_workout_mutate") throw Error("Unexpected generated RPC");
    packets.push(args.packet);bundles.push(args.packet.next);revision++;return {data:{code:"OK",operation:args.packet.operation,result:args.packet.result,operationRevision:String(revision),snapshot:{protocolVersion:1,ownerId:f.owner,revision:String(revision),rows:structuredClone(args.packet.next)}}};
  }};
  const repository=f.repository.create({client,ownerId:f.owner});
  let sequence=0;
  const actions=f.repository.createActions({initial:handle(f),repository,recoveryStorage:storage(),
    createId:()=>`synthetic-relational-new-${++sequence}`,createBodyweightId:()=>"synthetic-relational-new-bw",now:()=>"2026-10-28T04:30:00.000Z"});
  const id=f.identity.resolveLabel(f.document.catalog,"Bench Press");
  const steps=[
    ["logSet",{date:"2026-10-28",exercise:id,weight:0,reps:8,rir:0,notes:"  saved through domain\n",sessionId:null}],
    ["saveScopedNote",{scope:"exercise",exercise:id,text:"new exact setup\n",expectedText:"  setup\n"}],
    ["cycleSlotRole",{templateId:"push",index:0}],
    ["logBodyweight",{date:"2026-10-28",value:200}],
    ["editSet","synthetic-relational-new-1",{notes:"corrected after commit"}],
    ["deleteSet","synthetic-relational-new-1"],
    ["removeSlot",{templateId:"push",index:0}],
    ["commitImport",{importId:"synthetic-reviewed-rpc",date:"2026-10-28",template:"synthetic",duration:30,sessionNotes:"  reviewed summary\n",bodyweight:null,sets:[
      {include:true,exercise:id,originalLabel:"Bench Press",weight:10,reps:8,unit:"lb",rpe:null,rir:0,pain:0,painArea:"",notes:"  included import\n",complete:true},
      {include:false,exercise:"excluded unresolved label",weight:-1,reps:0,unit:"invalid"},
    ]}],
    ["logGuidedSet",{sessionId:f.sessionId,planSlotId:"slot-1",expectedRevision:3,requestId:"canonical-new",exercise:id,weight:10,reps:8}],
    ["finishGuidedSession",{sessionId:f.sessionId,expectedRevision:4,allowPending:true}],
    ["editSet","synthetic-relational-new-2",{notes:"corrected completed-session fact"}],
  ];
  for(const [name,...args] of steps) {const result=await actions.execute(name,...args);if(!result.ok)throw Error(name+": "+JSON.stringify(result));}
  const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
  const sql=[`begin;
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to gymbro_workout_writer;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id) values ('${f.owner}'),('${other}');
create temporary table relational_expected(step int primary key,rows jsonb);
grant select on relational_expected to gymbro_workout_writer;`];
  bundles.forEach((rows,i)=>sql.push(`insert into relational_expected values(${i},${literal(rows)});`));
  sql.push(`set local role gymbro_workout_writer;
select set_config('request.jwt.claim.sub','${f.owner}',true);
select set_config('request.jwt.claims','{"sub":"${f.owner}","is_anonymous":false}',true);
select is(jsonb_array_length(public.gymbro_workout_read()->'workout_state'),0,'empty is explicitly uninitialized');
select lives_ok($test$select public.gymbro_workout_commit(null,(select rows from relational_expected where step=0))$test$,'synthetic initial bundle commits atomically');
select is(public.gymbro_workout_normalize(public.gymbro_workout_read()),public.gymbro_workout_normalize((select rows from relational_expected where step=0)),'every initial field/label/relationship/extension round trips');`);
  for(let i=1;i<bundles.length;i++) sql.push(`select lives_ok($test$select public.gymbro_workout_commit((select rows from relational_expected where step=${i-1}),(select rows from relational_expected where step=${i}))$test$,'domain ${steps[i-1][0]} persists through RPC');
select is(public.gymbro_workout_normalize(public.gymbro_workout_read()),public.gymbro_workout_normalize((select rows from relational_expected where step=${i})),'domain ${steps[i-1][0]} full read acknowledgement matches');`);
  const last=bundles.length-1,session=f.sessionId,exercise=bundles[0].sets[0].exercise_id;
  sql.push(`select lives_ok($test$select public.gymbro_workout_commit((select rows from relational_expected where step=${last}),(select rows from relational_expected where step=${last}))$test$,'exact no-change bundle retains all facts');
select is((select count(*)::int from public.gymbro_bodyweights),3,'equal date/value bodyweights are not collapsed');
select is((select count(*)::int from public.gymbro_guided_requests),3,'request identities survive corrections/deletion/completion');
select is((select signature_scheme from public.gymbro_guided_requests where request_id='canonical-new'),'canonical-ids','new guided requests explicitly store canonical signature identity');
select is((select count(*)::int from public.gymbro_exercise_session_notes),2,'planned and manual occurrences remain separate');
select is((select count(*)::int from public.gymbro_imports),2,'existing and reviewed import duplicate-protection summaries retained');
select ok((select extra->>'notes'='unclassified legacy session text' from public.gymbro_sessions),'legacy note not reclassified');
select throws_ok($test$update public.gymbro_sessions set snapshot_name='rewritten' where session_id='${session}'$test$,'23514',null,'historical intent cannot be rewritten');
select throws_ok($test$update public.gymbro_sets set session_id=null,plan_slot_id=null,session_position=null where session_id is not null$test$,'23514',null,'correction cannot silently detach membership');
select throws_ok($test$update public.gymbro_sets set owner_id='${other}'$test$,'23514',null,'owner transfer rejected');
select throws_ok($test$update public.gymbro_template_slots set exercise_id='11111111-1111-4111-8111-111111111111'$test$,'23503',null,'unknown canonical reference rejected');
select throws_ok($test$insert into public.gymbro_exercise_session_notes select owner_id,session_id,exercise_id,original_label,'missing',text,position+10,present,extra from public.gymbro_exercise_session_notes limit 1$test$,'23503',null,'invalid snapshot note target rejected');
select throws_ok($test$insert into public.gymbro_imports select * from public.gymbro_imports$test$,'23505',null,'import ID uniqueness enforced');
select throws_ok($test$insert into public.gymbro_exercise_session_notes select * from public.gymbro_exercise_session_notes where plan_slot_id is null$test$,'23505',null,'manual note null target uniqueness enforced');
select throws_ok($test$update public.gymbro_sets set session_id='missing',session_position=0 where session_id is null$test$,'23503',null,'orphan session membership rejected');
select throws_ok($test$update public.gymbro_guidance set current_slot_id='missing'$test$,'23503',null,'guided current slot must exist');
select throws_ok($test$update public.gymbro_workout_state set selected_template_id='missing'$test$,'23503',null,'selected current template must exist');
select throws_ok($test$insert into public.gymbro_sessions(owner_id,session_id,workout_date,status,created_at,completed_at,template_origin_id,duration,snapshot_name,snapshot_extra,position,present,extra) select owner_id,'active-one',workout_date,'active',created_at,null,template_origin_id,duration,snapshot_name,snapshot_extra,1000,present,extra from public.gymbro_sessions where session_id='${session}'; insert into public.gymbro_sessions(owner_id,session_id,workout_date,status,created_at,completed_at,template_origin_id,duration,snapshot_name,snapshot_extra,position,present,extra) select owner_id,'active-two',workout_date,'active',created_at,null,template_origin_id,duration,snapshot_name,snapshot_extra,1001,present,extra from public.gymbro_sessions where session_id='${session}'$test$,'23505',null,'two active sessions are rejected atomically');
select throws_ok($test$update public.gymbro_guided_slots set position=position+50$test$,'23514',null,'guided order must exactly follow snapshot');
select throws_ok($test$update public.gymbro_snapshot_slots set role='substitute'$test$,'42501',null,'snapshot update is not granted');
select throws_ok($test$update public.gymbro_guided_requests set signature='changed'$test$,'42501',null,'request signature update is not granted');
select throws_ok($test$select public.gymbro_workout_commit((select rows from relational_expected where step=${last}),jsonb_set(jsonb_set((select rows from relational_expected where step=${last}),'{workout_state,0,duration}','30'),'{sets,0,exercise_id}','"11111111-1111-4111-8111-111111111111"'))$test$,'23503',null,'failed multi-row save rejects entire commit');
select is(public.gymbro_workout_normalize(public.gymbro_workout_read()),public.gymbro_workout_normalize((select rows from relational_expected where step=${last})),'failed commit changed neither early settings nor later facts');
select set_config('request.jwt.claim.sub','${other}',true);
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":false}',true);`);
  for(const table of Object.keys(bundles[0])) {
    const full=table==="aliases"?"gymbro_exercise_aliases":"gymbro_"+table;
    sql.push(`select is_empty('select * from public.${full}','${table} cross-owner reads see zero');
select ok((select relrowsecurity from pg_class where oid='public.${full}'::regclass),'${table} RLS enabled');
select ok(not has_table_privilege('anon','public.${full}','SELECT'),'${table} signed-out reads denied');`);
  }
  sql.push(`select is_empty($test$update public.gymbro_sets set notes='other user' returning *$test$,'cross-user update affects zero');
select is_empty($test$delete from public.gymbro_sets returning *$test$,'cross-user delete affects zero');
select throws_ok($test$insert into public.gymbro_session_notes select x.* from relational_expected,jsonb_populate_recordset(null::public.gymbro_session_notes,rows->'session_notes') x where step=0$test$,'42501',null,'direct table insert cannot claim another owner');
select throws_ok($test$select public.gymbro_workout_commit(null,(select rows from relational_expected where step=0))$test$,'42501',null,'RPC cannot supply another owner');
select lives_ok($test$select public.gymbro_workout_commit(null,${literal(f.repository.project(f.document,other,f.bodyweightIds))})$test$,'second owner can use same exercise IDs privately');
select throws_ok($test$update public.gymbro_sets set session_id='cross-owner-session',session_position=0 where session_id is null$test$,'23503',null,'another owner cannot supply missing relationship');
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":true}',true);
select throws_ok($test$select public.gymbro_workout_read()$test$,'42501',null,'anonymous Auth cannot read repository');
select is_empty('select * from public.gymbro_sets','anonymous Auth cannot read table');
select set_config('request.jwt.claims','{}',true);
select throws_ok($test$select public.gymbro_workout_read()$test$,'42501',null,'missing permanent claim fails closed');
select set_config('request.jwt.claim.sub','${f.owner}',true);
select set_config('request.jwt.claims','{"sub":"${f.owner}","is_anonymous":false}',true);
select is(public.gymbro_workout_normalize(public.gymbro_workout_read()),public.gymbro_workout_normalize((select rows from relational_expected where step=${last})),'original owner unchanged by isolation attempts');
select lives_ok($test$update public.gymbro_exercises set display_name=display_name||' renamed' where exercise_id='${exercise}'$test$,'canonical rename remains possible with actual workout references');
select is((select count(*)::int from public.gymbro_sets s left join public.gymbro_exercises e using(owner_id,exercise_id) where e.exercise_id is null),0,'canonical rename leaves every actual set reference intact');
select is((select count(*)::int from public.gymbro_snapshot_slots s left join public.gymbro_exercise_aliases a on a.owner_id=s.owner_id and a.label=s.original_label and a.exercise_id=s.exercise_id where a.exercise_id is null),0,'rename retains original snapshot provenance');
insert into public.gymbro_sessions(owner_id,session_id,workout_date,status,created_at,completed_at,template_origin_id,duration,snapshot_name,snapshot_extra,position,present,extra) select owner_id,'owner-a-only',workout_date,status,created_at,completed_at,template_origin_id,duration,snapshot_name,snapshot_extra,999,present,extra from public.gymbro_sessions where session_id='${session}';
select set_config('request.jwt.claim.sub','${other}',true);
select set_config('request.jwt.claims','{"sub":"${other}","is_anonymous":false}',true);
select throws_ok($test$update public.gymbro_sets set session_id='owner-a-only',session_position=99 where session_id is null$test$,'23503',null,'existing foreign-owner session cannot satisfy composite FK');
reset role;
select * from finish();
rollback;`);
  if(capture) Object.assign(capture,{f,bundles,packets,steps});
  return sql.join("\n")+"\n";
}
if(require.main===module) buildSql().then(sql=>{
  const target=path.join(__dirname,"..","test-results","workout-repository.test.sql");fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,sql);
  console.log("Generated synthetic relational/action/RPC pgTAP integration evidence.");
}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={buildSql};
