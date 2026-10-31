const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const {cutoverConfig,validateApproval,parseApproval,marker,endMarker,approvalUrl,actions}=require('../api/cutover-config.js');
const {commandsFor,compareSchema}=require('../scripts/cutover-readiness.cjs');
const root=path.resolve(__dirname,'..'),build=vm.runInNewContext(fs.readFileSync(path.join(root,'app-version.js'),'utf8')+'\nAPP_VERSION.version');
const host='gymbro-synthetic-immutable.vercel.app',owner='99999999-9999-4999-8999-999999999939',sha='a'.repeat(40),ref='loowxditqikcwyeftfgx';
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_URL:host,VERCEL_GIT_COMMIT_REF:'codex/issue-84-production-readiness',
  VERCEL_GIT_COMMIT_SHA:sha,GYMBRO_CUTOVER_REHEARSAL:'true',GYMBRO_CLOUD_ENV:'production-rehearsal',SUPABASE_PROJECT_REF:ref,
  SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_fixture_only'};
const approval={version:1,issue:84,enabled:true,mode:'synthetic',projectRef:ref,branch:env.VERCEL_GIT_COMMIT_REF,
  deploymentUrl:'https://'+host,gitSha:sha,build,expiresAt:'2099-01-01T00:00:00Z',allowedOwners:[owner],
  actions,fixtureTag:'gymbro-issue84-unit'};
function fetcher(value=approval){return async(url,options)=>{assert.equal(url,approvalUrl);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  return {ok:true,json:async()=>({number:84,state:'open',body:marker+JSON.stringify(value)+endMarker})};};}
test('cutover is default-off and refuses Production, alias, wrong branch without fetching an approval',async()=>{
  for(const patch of [{GYMBRO_CUTOVER_REHEARSAL:'false'},{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'}]){
    const c=await cutoverConfig({...env,...patch},host,{fetcher:()=>assert.fail('no approval read permitted'),build});assert.notEqual(c.configured,true);
  }
  assert.notEqual((await cutoverConfig(env,'gymbro-git-codex-alias.vercel.app',{fetcher:()=>assert.fail('alias refused first'),build})).configured,true);
});
test('only exact immutable URL, platform SHA, canonical build, owner scope and approved backend can enable rehearsal',async()=>{
  const c=await cutoverConfig(env,host,{fetcher:fetcher(),build});assert.equal(c.configured,true);assert.equal(c.syntheticOnly,true);
  for(const patch of [{gitSha:'b'.repeat(40)},{deploymentUrl:'https://branch-alias.vercel.app'},{build:'wrong'},
    {allowedOwners:[]},{allowedOwners:[owner,owner]},{expiresAt:'2000-01-01'},{actions:['read','unknownMutation']},
    {mode:'personal',sourceByteDigest:null},{fixtureTag:'personal'},{enabled:false},{issue:85}]){
    const refused=await cutoverConfig(env,host,{fetcher:fetcher({...approval,...patch}),build});assert.notEqual(refused.configured,true);
    assert(!JSON.stringify(refused).includes(env.SUPABASE_PUBLISHABLE_KEY));
  }
  for(const patch of [{SUPABASE_PROJECT_REF:'obebuvpsqapgevwivwho'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_private'},
    {SUPABASE_URL:env.SUPABASE_URL+'/'},{GYMBRO_CLOUD_ENV:'preview'},{VERCEL:'0'},{VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)}])
    assert.notEqual((await cutoverConfig({...env,...patch},host,{fetcher:fetcher(),build})).configured,true);
});
test('approval revocation, missing/duplicate record, unavailable GitHub and quota failure never yield an enabled configuration',async()=>{
  assert.throws(()=>parseApproval(marker+'{}'+endMarker+marker+'{}'+endMarker));
  for(const f of [async()=>{throw Error('private-token');},async()=>({ok:false,status:429}),
    async()=>({ok:true,json:async()=>({number:84,state:'closed',body:marker+JSON.stringify(approval)+endMarker})}),
    async()=>({ok:true,json:async()=>({number:84,state:'open',body:'design approved, no operational record'})})]){
    const c=await cutoverConfig(env,host,{fetcher:f,build});assert.equal(c.configured,false);assert(!JSON.stringify(c).includes('private-token'));
  }
});
function browserGuard(config){
  let current=structuredClone(config),events=0;
  const context=vm.createContext({URL,URLSearchParams,AbortSignal,Event,Date,TextEncoder,crypto:webcrypto,
    location:{search:'?storage=cloud&rehearsal=production',origin:config.deploymentUrl},
    window:{dispatchEvent:()=>events++},OperationalDiagnostics:{failure:(code,message)=>Object.assign(Error(message),{code})},
    APP_VERSION:{version:build},WorkoutMigration:{digest:async text=>createHash('sha256').update(text).digest('hex')},
    fetch:async()=>({ok:true,json:async()=>current})});
  vm.runInContext(fs.readFileSync(path.join(root,'cutover-rehearsal.js'),'utf8'),context);
  return {guard:vm.runInContext('CutoverRehearsal',context),context,set:x=>{current=x;},events:()=>events};
}
test('every browser RPC/retry/resolution rechecks approved identity, scope and expiry; refusal precedes cloud transmission',async()=>{
  const config=validateApproval(approval,env,host,build),f=browserGuard(config);
  await f.guard.beforeFetch(config,config.url+'/rest/v1/rpc/gymbro_workout_mutate',{body:JSON.stringify({packet:{action:'logSet'}})});
  await f.guard.beforeFetch(config,config.url+'/rest/v1/rpc/gymbro_workout_resolve',{body:JSON.stringify({operation:['logSet','frozen-request']})});
  for(const patch of [{gitSha:'b'.repeat(40)},{deploymentUrl:'https://alias.vercel.app'},{build:'wrong'},
    {approvalDigest:'changed'},{expiresAt:'2000-01-01'},{configured:false}]){
    f.set({...config,...patch});await assert.rejects(f.guard.beforeFetch(config,config.url+'/rest/v1/rpc/gymbro_workout_mutate',{body:'{"packet":{"action":"logSet"}}'}));
  }
  f.set(config);for(const url of ['https://foreign.example/rest/v1/rpc/gymbro_workout_mutate',config.url+'/rest/v1/gymbro_sets',config.url+'/rest/v1/rpc/unchecked'])
    await assert.rejects(f.guard.beforeFetch(config,url,{body:'{}'}));
  await assert.rejects(f.guard.beforeFetch(config,config.url+'/rest/v1/rpc/gymbro_workout_mutate',{body:'{"packet":{"action":"invented"}}'}));
  f.context.location.origin='https://branch-alias.vercel.app';await assert.rejects(f.guard.configuration());assert(f.events()>0);
});
test('personal source selection is byte-exact and cannot gain a synthetic tag exemption',async()=>{
  const text='{"personal":"selected only in synthetic unit test"}',sourceByteDigest=createHash('sha256').update(text).digest('hex');
  const config=validateApproval({...approval,mode:'personal',sourceByteDigest},env,host,build),f=browserGuard(config);
  assert.equal(config.syntheticOnly,false);assert.equal(config.fixtureTag,null);await f.guard.sourceGuard(config,text);
  await assert.rejects(f.guard.sourceGuard(config,text+' '));
});
test('read-only tooling fixes Production target, requires exact revision approval and never supports apply/reset',()=>{
  const operator={GYMBRO_CUTOVER_PRODUCTION_READ_APPROVED:'true',GYMBRO_CUTOVER_READINESS_REVISION:sha};
  assert.deepEqual(commandsFor('plan',operator,sha),['db','push','--project-ref',ref,'--skip-vault','--dry-run']);
  for(const action of ['apply','reset','seed','delete','--db-url'])assert.throws(()=>commandsFor(action,operator,sha));
  for(const patch of [{CI:'true'},{VERCEL:'1'},{GYMBRO_CUTOVER_PRODUCTION_READ_APPROVED:'false'},{GYMBRO_CUTOVER_READINESS_REVISION:'b'.repeat(40)}])
    assert.throws(()=>commandsFor('inspect',{...operator,...patch},sha));
});
test('schema comparison rejects equal counts with altered definitions/ownership/constraints; missing evidence is not a pass',()=>{
  const expected={migration_ledger_present:true,schema_acl:'reviewed',tables:[{name:'gymbro_sets',rls:true}],columns:[],constraints:[{validated:true}],
    policies:[],grants:[],triggers:[],indexes:[],column_grants:[],functions:[{owner:'gymbro_workout_writer',definition:'reviewed'}],roles:[]};
  assert(compareSchema(expected,structuredClone(expected)).pass);
  for(const [section,key,value] of [['tables','rls',false],['constraints','validated',false],['functions','owner','authenticated'],['functions','definition','drift']]){
    const actual=structuredClone(expected);actual[section][0][key]=value;assert.equal(compareSchema(expected,actual).pass,false);
  }
  assert.equal(compareSchema({},{}).pass,false);
});
test('complete migration comparison detects equal-count personal-copy corruption in facts, metadata and relationship identities',async()=>{
  const f=await require('./lifecycle-fixture.cjs').setup();f.get(fs.readFileSync(path.join(root,'workout-migration.js'),'utf8'));
  const migration=f.get('WorkoutMigration'),candidate=await migration.prepareSource(JSON.stringify(f.source),f.owner);
  const rows=f.repository.project(candidate.document,f.owner,candidate.bodyweightIds,candidate.signatureSchemes);
  assert(migration.compare(candidate,{rows,revision:'1'},f.owner).pass);
  for(const change of [r=>r.sets[0].notes='changed',r=>r.sets[0].owner_id='88888888-8888-4888-8888-888888888888',
    r=>r.snapshot_slots[0].exercise_id=r.exercises.at(-1).exercise_id,r=>r.sets[0].set_id+='-changed']){
    const changed=structuredClone(rows);change(changed);assert.equal(migration.compare(candidate,{rows:changed,revision:'1'},f.owner).pass,false);
  }
});
