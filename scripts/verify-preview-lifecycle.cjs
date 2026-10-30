// Exact reviewed staging validation. --rehearse rolls back DDL and fixtures;
// normal verification requires the migration already promoted by #38.
const fs=require('node:fs'),path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
const {commandsFor}=require('./preview-db.cjs');
const {buildSql}=require('./workout-lifecycle-db-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function main(){if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=='--rehearse'))throw Error('Use no argument or --rehearse.');
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),plan=commandsFor('apply',process.env,sha)[0];
  if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the reviewed revision first.');
  const source=await buildSql(),assertions=(source.match(/^select (?:is|ok|throws_ok)\(/gm)||[]).length;
  let sql=source.replace('create temporary table lifecycle_packets',
    'create temporary table lifecycle_report(output text);grant select,insert on lifecycle_report to authenticated;create temporary table lifecycle_packets')
    .replace(/^select (is|ok|throws_ok)\(/gm,'insert into lifecycle_report select $1(')
    .replace('select * from finish();',`insert into lifecycle_report select * from finish();
do $verify$ begin if exists(select 1 from lifecycle_report where output like 'not ok%') or
  (select count(*) from lifecycle_report where output like 'ok %')<>${assertions} then raise exception 'Lifecycle assertions failed';end if;end $verify$;
select jsonb_build_object('passed',(select count(*) from lifecycle_report where output like 'ok %'),'outputs',(select jsonb_agg(output) from lifecycle_report)) as lifecycle_evidence;`);
  if(process.argv[2]==='--rehearse'){
    const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261030180000_workout_lifecycle.sql'),'utf8').replace(/^begin;\r?\n/m,'').replace(/commit;\s*$/,'');
    sql='begin;\n'+migration+'\n'+sql.replace(/^begin;/,'');
  }
  const file=path.join(root,'test-results/lifecycle-hosted.sql');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,sql);
  const result=spawnSync(process.execPath,[require.resolve('supabase/dist/supabase.js'),'db','query','--linked','--project-ref',plan[plan.indexOf('--project-ref')+1],'--file',file],{cwd:root,env:process.env,encoding:'utf8',windowsHide:true});
  if(result.status!==0){const detail=(result.stderr.match(/ERROR:[^\r\n]*/)||[])[0]??'Private connection/error details withheld.';throw Error('Lifecycle staging validation failed: '+detail);}
  const data=JSON.parse(result.stdout),rows=data.rows??data,evidence=rows.find(r=>r.lifecycle_evidence)?.lifecycle_evidence;
  if(!evidence)throw Error('No assertion evidence.');fs.writeFileSync(path.join(root,'test-results/lifecycle-hosted.json'),JSON.stringify({sha,rehearsal:!!process.argv[2],evidence},null,2));
  console.log(`Staging ${plan[plan.indexOf('--project-ref')+1]}; ${sha}; ${assertions} actual lifecycle assertions PASS; ${process.argv[2]?'DDL and fixtures':'fixtures'} rolled back.`);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
