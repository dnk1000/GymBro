const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
function diagnostics(){const c=vm.createContext({crypto:webcrypto});for(const file of ['app-version.js','operational-diagnostics.js','workout-concurrency.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);return vm.runInContext('OperationalDiagnostics',c);}
for(const [input,expected] of [[{status:401},'AUTH'],[{code:'otp_expired'},'AUTH'],[{status:403},'DENIED'],[{code:'42501'},'DENIED'],[{status:429},'RATE_LIMIT'],[{name:'AbortError'},'TIMEOUT'],[{status:504},'TIMEOUT'],[{status:503},'DATABASE'],[{code:'57P01'},'DATABASE'],[{code:'PGRST202'},'COMPATIBILITY'],[{status:0},'NETWORK'],[{code:'secret arbitrary provider text'},'UNKNOWN']])test('safe diagnostic classification: '+JSON.stringify(input),()=>assert.equal(diagnostics().classify(input),expected));
test('provider messages, getters, private IDs and raw payloads cannot enter safe diagnostics',()=>{
 const d=diagnostics(),secret='NEVER_EMIT_SECRET',error={code:'PGRST301',details:secret,headers:{Authorization:secret},payload:{notes:secret}};
 Object.defineProperties(error,{message:{get(){throw Error('message getter evaluated');}},status:{get(){throw Error('status getter evaluated');}},name:{get(){throw Error('name getter evaluated');}}});
 assert.equal(d.classify(error),'AUTH');
 const model=d.describe({error,operation:secret,config:{configured:true,enabled:true,environment:'production',projectRef:secret},status:{phase:'OUTCOME_UNKNOWN',canRetry:false,canResolve:true,operation:['logGuidedSet',secret,secret]},handle:{ownerId:secret,rows:{sets:[{notes:secret}]}}});
 assert(!JSON.stringify(model).includes(secret));assert.match(model.message,/confirmation was lost/);assert.match(model.message,/sign-in link/);
 assert.equal(model.summary.acknowledgement,'unknown');assert.equal(model.summary.environment,'unknown/unverified');assert.equal(model.summary.actions.length,1);
 const hostile={};Object.defineProperty(hostile,'code',{get(){throw Error('code getter evaluated');}});assert.equal(d.classify(hostile),'UNKNOWN');
});
test('safe summaries distinguish supported versions, observed data and verified configuration',()=>{
 const d=diagnostics();let s=d.describe({config:{configured:true,enabled:true,environment:'preview',projectRef:'obebuvpsqapgevwivwho'}}).summary;
 assert.equal(s.environment,'Preview');assert.equal(s.observedWorkout,'unknown');assert.equal(s.supported.workout,8);
 s=d.describe({handle:{status:'healthy'}}).summary;assert.equal(s.observedWorkout,8);
});
test('only affirmative lifecycle states offer recovery, and parity never claims completed migration',()=>{
 const d=diagnostics();for(const status of ['unreadable','uninitialized'])assert.match(d.describe({handle:{status}}).message,/Verified cloud state.*not an empty valid account/);
 const fail=d.describe({error:{status:503}}).message;assert.match(fail,/could not load/);assert.doesNotMatch(fail,/emergency|Verified cloud state/);
 assert.match(d.describe({parity:true,handle:{status:'healthy'}}).message,/Editing is blocked/);
});
test('transport classification is supplemental and does not manufacture terminal acknowledgements',async()=>{
 const {serverFixture,storage}=require('./protocol-fixture.cjs'),f=await serverFixture(),store=storage();
 const original=f.client.rpc;let fail=true;
 f.client.rpc=async(name,args)=>{if(fail&&name==='gymbro_workout_mutate')return {status:401,error:{code:'PGRST301',message:'secret token'}};return original(name,args);};
 const a=f.create({recoveryStorage:store}),input={date:'2026-10-28',exercise:f.identity.resolveLabel(f.document.catalog,'Bench Press'),weight:0,reps:8,sessionId:null};
 const before=JSON.stringify(a.getWorkoutState());assert.equal((await a.execute('logSet',input)).code,'OUTCOME_UNKNOWN');
 assert.equal(a.getStatus().diagnostic,'AUTH');assert.equal(JSON.stringify(a.getWorkoutState()),before);assert.equal(a.getStatus().canRetry,true);assert.equal(a.getStatus().canResolve,true);
 assert(store.getItem('gymbro-request-recovery-v1-'+f.owner));fail=false;
 assert.equal((await a.retry()).code,'OK');assert.equal(f.getSaved().revision,'1');assert.equal(a.getStatus().diagnostic,null);
 f.client.rpc=async()=>({status:503,error:{code:'57P01',message:'private DB detail'}});await a.refresh();assert.equal(a.getStatus().phase,'LOAD_ERROR');assert.equal(a.getStatus().diagnostic,'DATABASE');
 f.client.rpc=original;await a.refresh();assert.equal(a.getStatus().phase,'READY');assert.equal(a.getStatus().diagnostic,null);
});
