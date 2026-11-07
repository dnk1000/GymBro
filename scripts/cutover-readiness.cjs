// Read-only operator inspection. No apply/reset/seed/delete path is provided.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const {environments}=require('../api/_lib/supabase-environment.cjs');
const root=path.resolve(__dirname,'..'),ref=environments.production.projectRef;
function commandsFor(action,env,revision){
  if(!['list','plan','inspect'].includes(action))throw Error('Choose manifest, list, plan or inspect. No mutations are supported.');
  if(env.VERCEL||env.VERCEL_ENV||env.CI||env.GYMBRO_CUTOVER_PRODUCTION_READ_APPROVED!=='true'||
    !/^[a-f0-9]{40}$/.test(revision)||env.GYMBRO_CUTOVER_READINESS_REVISION!==revision)
    throw Error('An explicit operator read-only approval for this exact reviewed revision is required.');
  const target=['--project-ref',ref];
  return action==='list'?['migration','list',...target]:action==='plan'?['db','push',...target,'--skip-vault','--dry-run']:
    ['db','query','--linked',...target,'--file','supabase/inspect-cutover.sql','--output','json'];
}
function manifest(directory=root){
  const git=args=>execFileSync('git',args,{cwd:directory});
  const revision=git(['rev-parse','HEAD']).toString().trim();
  if(git(['status','--porcelain','--untracked-files=normal']).toString().trim())throw Error('A clean committed reviewed checkout is required.');
  const files=git(['ls-tree','-r','--name-only','HEAD','supabase/migrations']).toString().trim().split('\n').filter(Boolean);
  return {format:'gymbro-cutover-source-manifest',version:1,revision,projectRef:ref,inspectionOnly:true,
    migrations:files.map(file=>({file,sha256:crypto.createHash('sha256').update(git(['show','HEAD:'+file])).digest('hex')}))};
}
function compareSchema(expected,actual){
  const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const fields=['migration_ledger_present','schema_acl','tables','columns','constraints','policies','grants','triggers','indexes','column_grants','functions','roles'];
  return {pass:fields.every(k=>Object.hasOwn(expected,k)&&Object.hasOwn(actual,k)&&JSON.stringify(canonical(expected[k]))===JSON.stringify(canonical(actual[k]))),
    sections:fields.map(section=>({section,pass:Object.hasOwn(expected,section)&&Object.hasOwn(actual,section)&&JSON.stringify(canonical(expected[section]))===JSON.stringify(canonical(actual[section]))}))};
}
function main(argv=process.argv.slice(2),env=process.env){
  if(argv.length!==1)throw Error('Provide exactly one action.');
  const source=manifest();
  if(argv[0]==='manifest'){console.log(JSON.stringify(source,null,2));return;}
  const command=commandsFor(argv[0],env,source.revision);
  const result=spawnSync(process.execPath,[require.resolve('supabase/dist/supabase.js'),...command],{cwd:root,env,encoding:'utf8',windowsHide:true});
  if(result.error||result.status!==0)throw Error('Read-only Production inspection failed. Private CLI output withheld; no readiness is claimed.');
  const folder=path.join(root,'test-results');fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'issue84-'+argv[0]+'.json'),JSON.stringify({source,action:argv[0],rawMetadata:result.stdout},null,2));
  console.log('Read-only '+argv[0]+' captured privately under test-results. Inspect metadata before approval; no schema or data was changed.');
}
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={commandsFor,manifest,compareSchema};
