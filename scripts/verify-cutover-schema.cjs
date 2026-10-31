// Disposable local CI only; never accepts a hosted target or arbitrary CLI flags.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {queryClient}=require('./workout-concurrency-races.cjs');
const {compareSchema}=require('./cutover-readiness.cjs');
const root=path.resolve(__dirname,'..'),file=path.join(root,'test-results/issue84-schema-before.json');
async function main(argv=process.argv.slice(2)){
  assert(argv.length===1&&['capture','compare'].includes(argv[0]),'Choose local capture or compare.');
  const actual=await queryClient(['--local'])(fs.readFileSync(path.join(root,'supabase/inspect-cutover.sql'),'utf8'));
  assert(actual.migration_ledger_present);assert(actual.tables.length>=18);assert(actual.tables.every(t=>t.rls));
  assert(actual.constraints.every(c=>c.validated));
  for(const name of ['gymbro_migration_initialize','gymbro_lifecycle_snapshot','gymbro_lifecycle_mutate','gymbro_lifecycle_resolve','gymbro_workout_mutate','gymbro_workout_resolve'])
    assert(actual.functions.some(f=>f.name===name),'required function '+name);
  if(argv[0]==='capture')fs.writeFileSync(file,JSON.stringify(actual,null,2));
  else {const result=compareSchema(JSON.parse(fs.readFileSync(file,'utf8')),actual);
    fs.writeFileSync(path.join(root,'test-results/issue84-schema-replay.json'),JSON.stringify(result,null,2));assert(result.pass,JSON.stringify(result));}
  console.log('Disposable cutover schema '+argv[0]+' PASS; complete definitions, relationships, RLS/grants and writer metadata.');
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
