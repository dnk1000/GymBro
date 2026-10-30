// Explicit operator-only synthetic verification through the existing #38 guard.
// Never called by the application, CI or Vercel. Test transaction rolls back.
const {execFileSync,spawnSync}=require("node:child_process");
const fs=require("node:fs"),path=require("node:path");
const {commandsFor}=require("./preview-db.cjs");
const root=path.resolve(__dirname,"..");
async function main() {
  const concurrency=process.argv[2]==="--concurrency";
  if(process.argv.length!==2 && !(process.argv.length===3&&concurrency)) throw Error("Use no argument or exactly --concurrency.");
  const {buildSql}=require(concurrency?"./workout-concurrency-db-fixture.cjs":"./workout-repository-db-fixture.cjs");
  const git=args=>execFileSync("git",args,{cwd:root,encoding:"utf8"}).trim();
  const revision=git(["rev-parse","HEAD"]);
  // Reuse the exact staging/reviewed-revision/environment guard without applying DDL.
  const plan=commandsFor("apply",process.env,revision)[0];
  if(git(["status","--porcelain","--untracked-files=normal"])) throw Error("Commit the reviewed revision before hosted verification.");
  const file=path.join(root,"test-results",concurrency?"workout-concurrency-hosted.test.sql":"workout-repository.test.sql");
  const source=await buildSql();
  const assertions=(source.match(/^select (?:lives_ok|throws_ok|is|ok|is_empty)\(/gm)||[]).length;
  // The Management API query path needs no local Docker/pg_prove process.
  // Collect actual pgTAP results and raise on any failure before rollback;
  // a command's zero exit status alone is never treated as assertion evidence.
  const anchor=concurrency?'create temporary table protocol_packets':'create temporary table relational_expected';
  const sql=source.replace(anchor,
    'create temporary table repo_tap_report(output text);\ngrant insert,select on repo_tap_report to authenticated,gymbro_workout_writer;\n'+anchor)
    .replace(/^select (lives_ok|throws_ok|is|ok|is_empty)\(/gm,'insert into repo_tap_report select $1(')
    .replace('select * from finish();',`insert into repo_tap_report select * from finish();
do $assert$ begin
  if exists(select 1 from repo_tap_report where output like 'not ok%') or
    (select count(*) from repo_tap_report where output like 'ok %')<>${assertions} then
    raise exception 'Synthetic relational assertions failed';
  end if;
end; $assert$;`);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,sql);
  const ref=plan[plan.indexOf("--project-ref")+1];
  const result=spawnSync(process.execPath,[require.resolve("supabase/dist/supabase.js"),"db","query","--linked","--project-ref",ref,"--file",file],{cwd:root,env:process.env,encoding:"utf8"});
  if(result.error||result.status!==0) throw Error("Staging synthetic integration did not pass. No pass is claimed; CLI connection/error detail is withheld.");
  console.log(`Staging ${ref}; reviewed revision ${revision}; ${assertions} synthetic pgTAP assertions checked; transaction rolled back.`);
  let output=result.stdout;
  for(const [key,value] of Object.entries(process.env)) if(value&&/TOKEN|PASSWORD|SECRET|KEY|DATABASE_URL/.test(key)) output=output.split(value).join("[redacted]");
  process.stdout.write(output);
}
if(require.main===module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
