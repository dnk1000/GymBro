// Operator-only #28 synthetic setup/cleanup; exact reviewed staging revision required. Never imported by the app.
// Admin key exists only in this process; only temporary synthetic passwords
// and account identities are saved to the ignored operator file.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync,spawnSync}=require('node:child_process');
const {randomUUID,randomBytes,webcrypto}=require('node:crypto');
const {commandsFor}=require('./preview-db.cjs');
const root=path.resolve(__dirname,'..'),file=path.join(root,'.env.issue28-fixtures.json');
const project='obebuvpsqapgevwivwho',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
class FixtureError extends Error {}
function sdk() {
  return vm.runInNewContext(fs.readFileSync(path.join(root,'vendor/supabase-2.118.0.js'),'utf8')+';supabase',
    {fetch,URL,Headers,Request,Response,AbortController,TextEncoder,TextDecoder,atob,btoa,setTimeout,clearTimeout,setInterval,clearInterval,crypto:webcrypto,WebSocket,console});
}
function validate(state) {
  if(state?.project!==project || !String(state.tag).startsWith('gymbro-issue28-') || !uuid.test(String(state.tag).slice('gymbro-issue28-'.length)) || !Array.isArray(state.accounts)||state.accounts.length!==2)
    throw new FixtureError('Unexpected fixture identity. Refusing account/data operations.');
  for(const [i,a] of state.accounts.entries()) if(a.email!==`${state.tag}-${i}@example.invalid` || (a.id!==null&&!uuid.test(a.id)))
    throw new FixtureError('Unexpected fixture account. Refusing account/data operations.');
  if(new Set(state.accounts.filter(a=>a.id).map(a=>a.id)).size!==state.accounts.filter(a=>a.id).length) throw new FixtureError('Duplicate fixture owner.');
  return state;
}
const read=()=>validate(JSON.parse(fs.readFileSync(file,'utf8')));
const write=s=>fs.writeFileSync(file,JSON.stringify(validate(s),null,2),{mode:0o600});
function guard() {
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  commandsFor('apply',process.env,revision);
  if(execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim()) throw new FixtureError('Commit reviewed operator code before fixture operations.');
  if(!process.env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new FixtureError('Matching public staging key required.');
  return revision;
}
async function query(sql) {
  const target=path.join(root,'test-results','issue28-fixture-operator.sql');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,sql);
  const r=spawnSync(process.execPath,[require.resolve('supabase/dist/supabase.js'),'db','query','--linked','--project-ref',project,'--file',target],{cwd:root,env:process.env,encoding:'utf8',windowsHide:true});
  if(r.status!==0) throw new FixtureError('Fixture SQL operation failed; private connection details withheld.');
  const value=JSON.parse(r.stdout),rows=value.rows??value;const answer=rows.find(r=>r.evidence)?.evidence;
  if(!answer) throw new FixtureError('Missing fixture SQL evidence.');return typeof answer==='string'?JSON.parse(answer):answer;
}
function admin(clientSdk) {
  // Explicit project/ref, reveal only into captured process memory. Never echo
  // CLI output/errors, save this key, or pass it to any browser/runtime config.
  let raw;try {raw=execFileSync(process.execPath,[require.resolve('supabase/dist/supabase.js'),'projects','api-keys','--project-ref',project,'--reveal','--output','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true});}catch {throw new FixtureError('Staging admin key lookup failed; details withheld.');}
  const data=JSON.parse(raw),keys=data.api_keys??data;
  if(!Array.isArray(keys)) throw new FixtureError('Unexpected key response; nothing disclosed.');
  const key=keys.find(k=>k.type==='secret'&&k.api_key?.startsWith('sb_secret_'))?.api_key ?? keys.find(k=>k.name==='service_role'&&k.api_key?.startsWith('eyJ'))?.api_key;
  if(!key) throw new FixtureError('No existing staging admin key identified; nothing disclosed.');
  return clientSdk.createClient(`https://${project}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function setup() {
  const revision=guard(),clientSdk=sdk();
  let state;
  if(fs.existsSync(file)) {state=read();if(state.status==='cleaned')throw new FixtureError('This fixture run is already cleaned.');}
  else {
    const tag='gymbro-issue28-'+randomUUID();state={project,tag,createdAt:new Date().toISOString(),revision,status:'planned',accounts:[0,1].map(i=>({email:`${tag}-${i}@example.invalid`,password:randomBytes(24).toString('base64url'),id:null}))};
    fs.writeFileSync(file,JSON.stringify(state,null,2),{flag:'wx',mode:0o600});
  }
  const privileged=admin(clientSdk);
  for(const a of state.accounts) {
    if(!a.id) {
      // Resolve an uncertain create response by exact planned email/tag before
      // another create. This reads IDs only; Auth creation uses its admin API.
      const prior=await query(`select jsonb_build_object('ids',coalesce(jsonb_agg(id),'[]')) as evidence from auth.users where email='${a.email}' and raw_user_meta_data->>'gymbro_fixture'='${state.tag}';`);
      if(prior.ids.length>1)throw new FixtureError('Ambiguous planned fixture account.');
      if(prior.ids.length===1) a.id=prior.ids[0];
      else {
        const created=await privileged.auth.admin.createUser({email:a.email,password:a.password,email_confirm:true,user_metadata:{gymbro_fixture:state.tag}});
        if(created.error||!created.data.user)throw new FixtureError('Synthetic confirmed-account creation failed; details withheld.');
        a.id=created.data.user.id;
      }
      write(state);
    }
    const checked=await privileged.auth.admin.getUserById(a.id);
    if(checked.error||checked.data.user?.email!==a.email||checked.data.user?.user_metadata?.gymbro_fixture!==state.tag)throw new FixtureError('Fixture account identity mismatch.');
    const client=clientSdk.createClient(`https://${project}.supabase.co`,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const signed=await client.auth.signInWithPassword({email:a.email,password:a.password});
    if(signed.error||signed.data.user?.id!==a.id||signed.data.user?.is_anonymous)throw new FixtureError('Permanent fixture sign-in failed; details withheld.');
    const f=await require('../tests/lifecycle-fixture.cjs').setup();
    const repository=f.lifecycle.createRepository({client,ownerId:a.id}),loaded=await repository.load();
    if(loaded.status!=='uninitialized'||Object.values(loaded.rows).some(rows=>rows.length))throw new FixtureError('Expected empty dedicated synthetic owner; never reseed.');
    await client.auth.signOut({scope:'local'});
  }
  state.status='ready';write(state);
  console.log(JSON.stringify({project,revision,fixtureTag:state.tag,owners:state.accounts.map(a=>a.id),permanentAccounts:2,signedInitialization:false,credentials:'ignored operator file only; no admin key saved'}));
}
async function cleanup() {
  guard();const state=read();if(state.status==='cleaned')throw new FixtureError('Fixture run already cleaned.');
  const privileged=admin(sdk()),alreadyDeleted=new Set();
  for(const a of state.accounts) {
    if(!a.id) {
      const found=await query(`select jsonb_build_object('ids',coalesce(jsonb_agg(id),'[]')) as evidence from auth.users where email='${a.email}' and raw_user_meta_data->>'gymbro_fixture'='${state.tag}';`);
      if(found.ids.length>1)throw new FixtureError('Ambiguous cleanup identity.');a.id=found.ids[0]??null;write(state);
    }
    if(a.id) {
      const user=await privileged.auth.admin.getUserById(a.id);
      if(user.error) {
        const check=await query(`select jsonb_build_object('remaining',count(*)) as evidence from auth.users where id='${a.id}';`);
        if(check.remaining!==0)throw new FixtureError('Cleanup account access failed; no deletion.');
        alreadyDeleted.add(a.id);
      } else if(user.data.user?.email!==a.email||user.data.user?.user_metadata?.gymbro_fixture!==state.tag)throw new FixtureError('Cleanup identity mismatch; no deletion.');
    }
  }
  const ids=state.accounts.filter(a=>a.id).map(a=>`'${a.id}'`).join(',');
  if(ids) {
    const tables=[...(await require('../tests/relational-fixture.cjs').fixture()).repository.tables,'exercises','aliases'];
    const deletes=tables.reverse().map(t=>`delete from public.${t==='aliases'?'gymbro_exercise_aliases':'gymbro_'+t} where owner_id in (${ids});`).join('');
    await query(`begin;set constraints all deferred;do $guard$ begin if exists(select 1 from public.gymbro_workout_state where owner_id in (${ids}) and extra#>>'{extension,previewMigrationFixture}' is distinct from '${state.tag}') then raise exception 'Unexpected fixture contents';end if;end $guard$;delete from public.gymbro_mutation_receipts where owner_id in (${ids});delete from public.gymbro_workout_versions where owner_id in (${ids});${deletes}select jsonb_build_object('removedWorkoutFixtures',true) as evidence;commit;`);
    for(const a of state.accounts.filter(a=>a.id&&!alreadyDeleted.has(a.id))) if((await privileged.auth.admin.deleteUser(a.id)).error)throw new FixtureError('Fixture account deletion failed; keep operator record for retry.');
    const result=await query(`select jsonb_build_object('auth',(select count(*) from auth.users where id in (${ids})),'workouts',(select count(*) from public.gymbro_workout_state where owner_id in (${ids})),'receipts',(select count(*) from public.gymbro_mutation_receipts where owner_id in (${ids})),'versions',(select count(*) from public.gymbro_workout_versions where owner_id in (${ids}))) as evidence;`);
    if(Object.values(result).some(n=>n!==0))throw new FixtureError('Independent cleanup check failed.');
  }
  state.status='cleaned';state.cleanedAt=new Date().toISOString();state.accounts.forEach(a=>delete a.password);write(state);
  console.log('Two synthetic fixture accounts/workouts/receipts/revisions cleaned; separate SQL confirms zero remaining owner rows. Temporary passwords removed.');
}
if(require.main===module) {const action=process.argv[2];if(process.argv.length!==3||!['setup','cleanup'].includes(action))throw new FixtureError('Choose exactly setup or cleanup.');(action==='setup'?setup():cleanup()).catch(error=>{if(error instanceof FixtureError)console.error(error.message);console.error('Fixture operation did not finish; no success claimed. Private credentials/details withheld. Keep the ignored operator record for recovery.');process.exitCode=1;});}
module.exports={sdk,validate,project};
