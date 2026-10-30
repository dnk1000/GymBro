// Disposable local upgrade proof. No hosted mode, credentials or personal data.
const {fixture}=require('../tests/relational-fixture.cjs');
const {queryClient,claims,prepare}=require('./workout-concurrency-races.cjs');
const {literal}=require('./workout-concurrency-db-fixture.cjs');
const assert=require('node:assert/strict');
async function main() {
  if(process.argv.length!==3||!['before','after'].includes(process.argv[2])) throw Error('Use before|after on the disposable local database only.');
  const query=queryClient(['--local']),f=await fixture();f.owner='90000040-0000-4000-8000-000000000040';
  if(process.argv[2]==='before') {
    const rows=f.repository.project(f.document,f.owner,f.bodyweightIds);
    const result=await query(`begin;insert into auth.users(id) values('${f.owner}');create table public.gymbro_issue40_upgrade_expected(rows jsonb not null);set local role authenticated;${claims(f.owner)}select public.gymbro_workout_commit(null,${literal(rows)});reset role;insert into public.gymbro_issue40_upgrade_expected select ${literal(rows)};select jsonb_build_object('prepared',true) as evidence;commit;`);
    assert.equal(result.prepared,true);console.log('Populated synthetic #39 state committed before protocol migration.');
  } else {
    const result=await query(`begin;set local role authenticated;${claims(f.owner)}select jsonb_build_object('revision',public.gymbro_workout_snapshot()->>'revision','snapshot',public.gymbro_workout_snapshot()) as evidence;commit;`);
    assert.equal(result.revision,'0');
    const unchanged=await query(`begin;${claims(f.owner)}select jsonb_build_object('same',public.gymbro_workout_normalize((select rows from public.gymbro_issue40_upgrade_expected))=public.gymbro_workout_normalize(public.gymbro_workout_read())) as evidence;commit;`);
    assert.equal(unchanged.same,true,'upgrade preserved complete content/relationships, not only counts');
    const initial={...f.repository.assemble(result.snapshot.rows,f.owner),initialized:true,protocolVersion:1,ownerId:f.owner,revision:'0'};
    const packet=await prepare(f,initial,'logBodyweight',[{date:'2026-10-30',value:201}],'after-populated-upgrade');
    const changed=await query(`begin;set local role authenticated;${claims(f.owner)}select jsonb_build_object('reply',public.gymbro_workout_mutate(${literal(packet)})) as evidence;commit;`);
    assert.equal(changed.reply.code,'OK');assert.equal(changed.reply.snapshot.revision,'1');
    const deletes=[...f.repository.tables].reverse().map(t=>`delete from public.${t==='aliases'?'gymbro_exercise_aliases':'gymbro_'+t} where owner_id='${f.owner}';`).join('');
    await query(`begin;set constraints all deferred;delete from public.gymbro_mutation_receipts where owner_id='${f.owner}';delete from public.gymbro_workout_versions where owner_id='${f.owner}';${deletes}delete from auth.users where id='${f.owner}';drop table public.gymbro_issue40_upgrade_expected;select jsonb_build_object('cleaned',true) as evidence;commit;`);
    console.log('Populated upgrade preserves every field/relationship, starts revision zero, then checked write reaches revision one. Synthetic fixture removed.');
  }
}
if(require.main===module) main().catch(e=>{console.error(e.message);process.exitCode=1;});
