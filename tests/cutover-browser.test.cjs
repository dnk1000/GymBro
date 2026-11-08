// All cloud/approval responses are disposable controlled transport, never hosted data.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto'),{chromium}=require('playwright-core');
const {setup}=require('./lifecycle-fixture.cjs');
const {actions}=require('../api/cutover-config.js');
const productionOrigin=require('../cloud-authority.js');
const root=path.resolve(__dirname,'..'),origin='https://gymbro-synthetic-immutable.vercel.app';
const build=vm.runInNewContext(fs.readFileSync(path.join(root,'app-version.js'),'utf8')+'\nAPP_VERSION.version');
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();});
async function open(t,width,{failedLoad=false,alias=false,production=false,empty=false,disabled=false,mismatch=false,localRaw=null}={}){
  const f=await setup(),source=JSON.stringify(f.source);let saved=structuredClone(f.handle),bad=false,failLoad=failedLoad,authorityChecks=0,failMutation=false;
  if(empty)saved={...saved,status:'uninitialized',initialized:false,document:null,bodyweightIds:[],
    rows:Object.fromEntries(Object.keys(saved.rows).map(key=>[key,[]])),revision:'0'};
  const receipts=new Map(),calls=[],errors=[];let loseAck=false;
  const config={enabled:true,configured:true,rehearsal:true,environment:'production-rehearsal',projectRef:'loowxditqikcwyeftfgx',
    url:'https://loowxditqikcwyeftfgx.supabase.co',publishableKey:'sb_publishable_synthetic_fixture_only',allowedOwners:[f.owner],
    syntheticOnly:false,fixtureTag:null,sourceByteDigest:createHash('sha256').update(source).digest('hex'),actions,
    deploymentUrl:origin,gitSha:'a'.repeat(40),build,expiresAt:'2099-01-01T00:00:00Z',approvalDigest:'b'.repeat(64)};
  const normalConfig={enabled:true,configured:true,environment:'production',projectRef:config.projectRef,
    url:config.url,publishableKey:config.publishableKey,allowedOwners:config.allowedOwners};
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({owner,localRaw})=>{
    const key='daveGymTrackerV1',get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
    if(!sessionStorage.getItem('local-fixture-seeded')){
      if(localRaw!==null)set.call(localStorage,key,localRaw);
      sessionStorage.setItem('local-fixture-seeded','yes');
    }
    window.localWorkoutBytes=()=>get.call(localStorage,key);
    window.keyReads=0;window.keyWrites=0;window.keyRemovals=0;
    Storage.prototype.removeItem=function(k){if(this===localStorage&&k===key)window.keyRemovals++;return remove.call(this,k);};
    Storage.prototype.clear=function(){if(this===localStorage)window.keyRemovals++;return clear.call(this);};
    Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.keyReads++;return get.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(k==='daveGymTrackerV1')window.keyWrites++;return set.call(this,k,v);};
    window.supabase={createClient:(url,key,options)=>({auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),
      getUser:async()=>{try{return {data:await (await options.global.fetch(url+'/auth/v1/user')).json()};}catch(error){return {error};}},
      onAuthStateChange:()=>{}},rpc:async(name,args={})=>{try{return await (await options.global.fetch(url+'/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)})).json();}catch(error){return {error};}}})};
  },{owner:f.owner,localRaw});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===config.url){
      calls.push(url.pathname);
      if(url.pathname==='/auth/v1/user')return route.fulfill({json:{user:{id:f.owner,is_anonymous:false,email:'synthetic@example.invalid'}}});
      const name=url.pathname.split('/rpc/')[1],args=req.postDataJSON()??{};
      if(name==='gymbro_lifecycle_snapshot')return route.fulfill({json:failLoad?{error:{code:'57P01'}}:{data:saved}});
      if(failMutation&&name.endsWith('_mutate'))return route.abort('failed');
      const packet=args.packet,key=JSON.stringify(args.operation??packet?.operation);let answer;
      if(receipts.has(key))answer={code:'REPLAY',result:receipts.get(key),operationRevision:saved.revision};
      else if(name.endsWith('_resolve'))answer={code:'CANCELLED'};
      else if(packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
      else {saved={...saved,...structuredClone(f.repository.assemble(packet.next,f.owner)),rows:structuredClone(packet.next),status:'healthy',initialized:true,
        revision:String(BigInt(saved.revision)+1n),fingerprint:'c'.repeat(64)};receipts.set(key,packet.result);answer={code:'OK',result:packet.result,operationRevision:saved.revision};}
      if(loseAck&&name.endsWith('_mutate')){loseAck=false;return route.abort('failed');}
      return route.fulfill({json:{data:{...answer,operation:args.operation??packet.operation,snapshot:saved}}});
    }
    if(![origin,productionOrigin,'https://branch-alias.vercel.app'].includes(url.origin))return route.abort();
    if(url.pathname==='/api/cutover-config'){authorityChecks++;return route.fulfill({json:bad?{...config,gitSha:'c'.repeat(40)}:config});}
    if(production&&url.pathname==='/api/account-config')return route.fulfill({json:disabled?{enabled:false}:normalConfig});
    if(production&&url.pathname==='/api/workout-config')return route.fulfill({json:mismatch?{...normalConfig,publishableKey:'sb_publishable_other_fixture'}:normalConfig});
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{enabled:false}});
    const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(relative.includes('..')||!/^([a-zA-Z0-9_-]+\.(js|html|css|png)|vendor\/[a-zA-Z0-9_.-]+\.js)$/.test(relative))return route.abort();
    const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'};
    return route.fulfill({body:fs.readFileSync(path.join(root,relative)),contentType:types[path.extname(relative)]});
  });
  await page.goto(production?productionOrigin+'/':(alias?'https://branch-alias.vercel.app':origin)+'/?storage=cloud&rehearsal=production');
  if(!production&&!alias){await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');await page.locator('#cloudConnect').click();
    if(failedLoad)await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('could not load'));
    else await page.waitForFunction(()=>cloudReady&&cloudController?.getStatus().phase==='READY');}
  t.after(()=>assert.deepEqual(errors,[],'no unexpected page exceptions'));
  return {f,page,calls,source,saved:()=>saved,checks:()=>authorityChecks,loseAck:()=>{loseAck=true;},failMutation:()=>{failMutation=true;},mismatch:()=>{bad=true;},recover:()=>{bad=false;failLoad=false;}};
}
for(const width of [320,390,1280])test('Production rehearsal controlled transport retains local authority/drafts and refuses changed identity at '+width+'px',async t=>{
  const f=await open(t,width),p=f.page;
  assert.match(await p.locator('#accountEnvironment').textContent(),/Production rehearsal/);
  assert.equal(await p.locator('#cloudLifecycle [data-local-cleanup]').count(),0);
  await p.locator('[data-view="workout"]').click();await p.evaluate(()=>useManualLogging());
  await p.locator('#fExercise').selectOption(f.f.document.catalog.exercises[0].id);await p.locator('#fDate').fill('2026-10-28');
  await p.locator('#fWeight').fill('0');await p.locator('#fReps').fill('7');await p.locator('#fNotes').fill('  retained rehearsal draft\n');
  const revision=f.saved().revision,checks=f.checks();f.mismatch();await p.locator('#saveSetBtn').click();
  await p.waitForFunction(()=>!cloudReady);assert.equal(await p.locator('#fNotes').inputValue(),'  retained rehearsal draft\n');
  assert.equal(f.saved().revision,revision);assert(f.checks()>checks);assert(!f.calls.some(x=>x.endsWith('_mutate')));
  f.recover();await p.locator('[data-view="data"]').click();await p.locator('#accountRefresh').click();
  await p.waitForFunction(()=>cloudReady);await p.locator('#cloudRetry').click();
  await p.waitForFunction(()=>cloudController.getStatus().phase==='READY');assert.equal(BigInt(f.saved().revision),BigInt(revision)+1n);
  assert.equal(f.saved().rows.sets.at(-1).notes,'  retained rehearsal draft\n');
  await p.locator('#migrationFile').setInputFiles({name:'unapproved.json',mimeType:'application/json',buffer:Buffer.from(f.source+' ')});
  await p.locator('#migrationReview').click();assert.equal(await p.locator('#migrationCommit').isDisabled(),true);
  assert.deepEqual(await p.evaluate(()=>[keyReads,keyWrites]),[0,0]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
test('normal Production origin starts empty on explicit choice and an acknowledged set survives reload',async t=>{
  const f=await open(t,390,{production:true,empty:true}),p=f.page;
  await p.locator('#cloudStartEmpty').waitFor({state:'visible'});
  assert.equal(f.saved().revision,'0');
  assert(!f.calls.some(x=>x.endsWith('_mutate')));
  await p.locator('#cloudStartEmpty').click();
  await p.waitForFunction(()=>cloudReady);
  assert.match(await p.locator('#cloudLifecycle [data-authority]').textContent(),/Workout data is saved to this cloud account/);
  assert.equal(await p.locator('#cloudLifecycle [data-local-note]').textContent(),'Local recovery cleanup is disabled. Any retained browser copy is kept intact.');
  assert(await p.locator('#cloudLifecycle [data-local-delete]').isDisabled());
  assert.equal(f.saved().rows.sets.length,0);
  assert.equal(f.saved().rows.bodyweights.length,0);
  await p.locator('[data-view="workout"]').click();await p.evaluate(()=>useManualLogging());
  await p.locator('#fExercise').selectOption(f.saved().document.catalog.exercises[0].id);
  await p.locator('#fDate').fill('2026-10-28');await p.locator('#fWeight').fill('0');await p.locator('#fReps').fill('7');
  await p.locator('#saveSetBtn').click();
  await p.waitForFunction(()=>cloudController.getWorkoutState().data.sets.length===1);
  await p.reload();await p.waitForFunction(()=>cloudReady);
  assert.equal(await p.evaluate(()=>cloudController.getWorkoutState().data.sets[0].reps),7);
  assert.deepEqual(await p.evaluate(()=>[keyReads,keyWrites]),[0,0]);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
test('qualified empty Production account reviews JSON and commits only on confirmation',async t=>{
  const f=await open(t,1280,{production:true,empty:true}),p=f.page;
  await p.locator('#cloudStartEmpty').waitFor({state:'visible'});
  const file=p.locator('#migrationFile');
  await file.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await p.locator('#migrationReview').click();
  assert(await p.locator('#migrationCommit').isDisabled());assert.equal(f.saved().revision,'0');
  await file.setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(f.source)});
  await p.locator('#migrationReview').click();
  await p.waitForFunction(()=>document.getElementById('migrationSummary').textContent.includes('backup.json'));
  assert.equal(f.saved().revision,'0');
  p.once('dialog',d=>d.accept());
  await p.locator('#migrationCommit').click();
  await p.waitForFunction(()=>cloudReady);
  f.f.get(fs.readFileSync(path.join(root,'workout-migration.js'),'utf8'));
  const migration=f.f.get('WorkoutMigration'),candidate=await migration.prepareSource(f.source,f.f.owner);
  assert(migration.compare(candidate,f.saved(),f.f.owner).pass);
  assert.deepEqual(await p.evaluate(()=>[keyReads,keyWrites]),[0,0]);
});
for(const options of [{disabled:true},{mismatch:true},{failedLoad:true}])test('normal Production route fails closed with '+Object.keys(options)[0],async t=>{
  const f=await open(t,320,{production:true,...options}),p=f.page;
  await p.waitForFunction(id=>/configuration|could not load|unavailable/i.test(document.getElementById(id).textContent),
    options.disabled?'accountStatus':'cloudStatus');
  assert.equal(await p.evaluate(()=>cloudController),null);
  assert(await p.locator('#cloudStartEmpty').isHidden());
  assert(!f.calls.some(x=>x.endsWith('_mutate')));
  assert.deepEqual(await p.evaluate(()=>[keyReads,keyWrites]),[0,0]);
});
test('failed Production cloud load does not show an empty account, initialize, seed or access local workout storage',async t=>{
  const f=await open(t,390,{failedLoad:true});assert.equal(await f.page.evaluate(()=>cloudController),null);
  assert(!f.calls.some(x=>x.includes('_initialize')||x.endsWith('_mutate')));
  assert.deepEqual(await f.page.evaluate(()=>[keyReads,keyWrites]),[0,0]);
});
test('a mutable branch alias cannot obtain rehearsal access even when config claims an approved immutable source',async t=>{
  const f=await open(t,390,{alias:true});await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('could not load'));
  assert.equal(f.calls.length,0);assert.equal(await f.page.evaluate(()=>cloudController),null);
});

// #86: normal Production authority was retired from localStorage by #85.
// These are controlled browser transports, not signed or hosted DB campaigns.
for(const [label,localRaw] of [
  ['absent',null],
  ['retained valid',JSON.stringify({version:8,sets:[{id:'inactive-legacy-only'}],backupMetadata:'preserve exactly'})],
  ['retained corrupt','{original unreadable backup bytes'],
  ['retained future',JSON.stringify({version:999,unknown:{preserve:true}})],
])test('#86 '+label+' local copy stays inactive through cloud save, History, JSON import and failed save',async t=>{
  const fixture=await setup();
  const retained=label==='retained valid'?JSON.stringify(fixture.source):localRaw;
  const f=await open(t,390,{production:true,localRaw:retained}),p=f.page;
  await p.waitForFunction(()=>cloudReady);
  const assertInactive=async()=>assert.deepEqual(await p.evaluate(()=>({reads:keyReads,writes:keyWrites,removals:keyRemovals,raw:localWorkoutBytes()})),
    {reads:0,writes:0,removals:0,raw:retained});
  await assertInactive();
  const initialCount=f.saved().rows.sets.length;
  await p.locator('[data-view="workout"]').click();await p.evaluate(()=>useManualLogging());
  await p.locator('#fExercise').selectOption(f.saved().document.catalog.exercises[0].id);
  await p.locator('#fDate').fill('2026-10-28');await p.locator('#fWeight').fill('0');await p.locator('#fReps').fill('7');
  await p.locator('#fNotes').fill('cloud-only #86 evidence');await p.locator('#saveSetBtn').click();
  await p.waitForFunction(count=>cloudController.getWorkoutState().data.sets.length===count,initialCount+1);
  await p.locator('[data-view="history"]').click();
  assert.match(await p.locator('#historyTable').textContent(),/cloud-only #86 evidence/);
  await assertInactive();
  await p.locator('[data-view="inbox"]').click();
  await p.locator('#inboxRaw').fill(JSON.stringify({schema:'gym-tracker-chatgpt-v1',importId:'issue-86-reviewed-json',date:'2026-10-28',
    sets:[{exercise:f.saved().document.catalog.exercises[0].displayName,weight:0,unit:'lb',reps:8,notes:'reviewed JSON retained'}]}));
  await p.getByRole('button',{name:'Review import',exact:true}).click();
  assert.equal(f.saved().rows.sets.length,initialCount+1,'review writes nothing');
  await p.locator('#commitInboxBtn').click();
  await p.waitForFunction(count=>cloudController.getWorkoutState().data.sets.length===count,initialCount+2);
  assert.equal(f.saved().rows.sets.at(-1).notes,'reviewed JSON retained');
  await assertInactive();
  await p.reload();await p.waitForFunction(()=>cloudReady);await assertInactive();
  await p.locator('[data-view="workout"]').click();await p.evaluate(()=>useManualLogging());
  await p.locator('#fExercise').selectOption(f.saved().document.catalog.exercises[0].id);
  await p.locator('#fDate').fill('2026-10-28');await p.locator('#fWeight').fill('0');await p.locator('#fReps').fill('9');
  await p.locator('#fNotes').fill('unsaved cloud failure draft');
  const saved=structuredClone(f.saved());f.failMutation();
  const alert=new Promise((resolve,reject)=>p.once('dialog',async dialog=>{
    const failure={type:dialog.type(),message:dialog.message()};
    try{await dialog.accept();resolve(failure);}catch(error){reject(error);}
  }));
  await p.locator('#saveSetBtn').click();
  const failure=await alert;assert.equal(failure.type,'alert');assert.match(failure.message,/cloud|network|connection|saved|request|confirm/i);
  assert.equal(await p.locator('#fNotes').inputValue(),'unsaved cloud failure draft');
  assert.deepEqual(f.saved(),saved,'failed cloud mutation leaves acknowledged data intact');
  await assertInactive();
});

for(const localRaw of [null,'{retained original bytes'])test('#86 failed normal-origin cloud load never adopts '+(localRaw===null?'absent':'retained')+' local storage',async t=>{
  const f=await open(t,320,{production:true,failedLoad:true,localRaw}),p=f.page;
  await p.waitForFunction(()=>/could not load/i.test(document.getElementById('cloudStatus').textContent));
  assert.equal(await p.evaluate(()=>cloudController),null);
  assert.deepEqual(await p.evaluate(()=>[keyReads,keyWrites,keyRemovals,localWorkoutBytes()]),[0,0,0,localRaw]);
  assert(!f.calls.some(x=>x.endsWith('_mutate')));
  assert(await p.locator('#cloudStartEmpty').isHidden());
});

for(const width of [320,390,1280])test('#18 explicit resolution, exclusions, lost acknowledgement and alias reuse at '+width+'px',async t=>{
  const f=await open(t,width,{production:true}),p=f.page;
  await p.waitForFunction(()=>cloudReady);
  const before=structuredClone(f.saved()),target=before.document.catalog.exercises[0],alias='Imported cable label <img src=x onerror=alert(1)>',fresh='Dumbbell distinct exercise',skip='Smith distinct skipped exercise';
  const draft={schema:'gym-tracker-chatgpt-v1',importId:'issue18-'+width,date:'2026-11-07',bodyweight:201,notes:'import summary',sets:[alias,fresh,skip,target.displayName].map(exercise=>({exercise,weight:0,reps:7,unit:'lb',rpe:7,rir:2,pain:1,painArea:'exact',notes:'  preserved\n',complete:false}))};
  await p.locator('[data-view="inbox"]').click();await p.locator('#inboxRaw').fill(JSON.stringify(draft));await p.getByRole('button',{name:'Review import',exact:true}).click();
  assert(await p.locator('#commitInboxBtn').isDisabled());assert.equal(await p.locator('#inboxResolution select').count(),3);
  assert.equal(await p.locator('#inboxResolution img').count(),0);assert.deepEqual(f.saved(),before,'preview writes nothing');
  await p.getByRole('combobox',{name:'Resolve exercise 1',exact:true}).selectOption('map:'+target.id);
  await p.getByRole('combobox',{name:'Resolve exercise 2',exact:true}).selectOption('create');
  await p.getByRole('combobox',{name:'Resolve exercise 3',exact:true}).selectOption('skip');
  assert.match(await p.locator('#inboxResolution').textContent(),/3 sets to import; 1 excluded/);
  assert.match(await p.locator('#inboxResolution').textContent(),/separate future import with a new import ID/);
  assert.deepEqual(f.saved(),before,'decisions write nothing');assert(!(await p.locator('#commitInboxBtn').isDisabled()));
  f.loseAck();const alert=new Promise(resolve=>p.once('dialog',async d=>{await d.accept();resolve();}));await p.locator('#commitInboxBtn').click();await alert;
  await p.waitForFunction(()=>cloudController.getStatus().phase==='OUTCOME_UNKNOWN');assert.equal(await p.locator('#inboxResolution').count(),1);
  assert(await p.getByRole('combobox',{name:'Resolve exercise 1',exact:true}).isDisabled());
  const uncertain=structuredClone(f.saved());assert.equal(uncertain.rows.sets.length,before.rows.sets.length+3);
  await p.locator('[data-view="data"]').click();await p.locator('#cloudRetry').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='READY');
  assert.deepEqual(f.saved(),uncertain,'same request does not duplicate anything');await p.locator('[data-view="inbox"]').click();assert.equal(await p.locator('#inboxResolution').count(),0);
  const doc=f.saved().document,sets=doc.data.sets.slice(-3);assert.equal(doc.catalog.exercises.length,before.document.catalog.exercises.length+1);
  assert.equal(sets[0].exercise.exerciseId,target.id);assert.equal(sets[0].exercise.originalLabel,alias);assert.notEqual(sets[1].exercise.exerciseId,target.id);
  assert(!doc.catalog.aliases.some(a=>a.label===skip));assert(sets.every(s=>s.weight===0&&s.complete===false&&s.notes==='  preserved\n'&&!s.sessionId));
  await p.reload();await p.waitForFunction(()=>cloudReady);await p.locator('[data-view="inbox"]').click();
  await p.locator('#inboxRaw').fill(JSON.stringify({...draft,importId:'alias-next-'+width,sets:[draft.sets[0]]}));await p.getByRole('button',{name:'Review import',exact:true}).click();
  assert.match(await p.locator('#inboxResolution').textContent(),/Saved alias: 1/);assert.equal(await p.locator('#inboxResolution select').count(),0);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await p.screenshot({path:path.join(root,'test-results','issue18-'+width+'.png'),fullPage:true});
});

for(const width of [320,390,1280])test('#82 file upload, 10-workout consolidated preview, selection and uncertain retry at '+width+'px',async t=>{
  const f=await open(t,width,{production:true}),p=f.page;await p.waitForFunction(()=>cloudReady);
  const before=structuredClone(f.saved()),name=before.document.catalog.exercises[0].displayName;
  const payload={format:'gymbro-workout-batch',formatVersion:1,batchId:'browser-batch-'+width,workouts:Array.from({length:10},(_,i)=>({importId:'browser-'+width+'-'+i,workout:{date:'2026-11-07',sets:[{exercise:i===1?'Unknown dumbbell variant':name,weight:0,unit:'lb',reps:i===9?-1:7,rpe:7,pain:1,notes:'  retained\n',complete:false}]}}))};
  await p.locator('[data-view="inbox"]').click();await p.locator('#inboxFile').setInputFiles({name:'batch.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await p.getByRole('checkbox',{name:'Select workout 10',exact:true}).waitFor();assert.match(await p.locator('#inboxStatus').textContent(),/10 workouts/);assert(await p.locator('#commitInboxBtn').isDisabled());assert.deepEqual(f.saved(),before);
  await p.getByRole('checkbox',{name:'Select workout 10',exact:true}).uncheck();await p.getByRole('combobox',{name:'Resolve batch exercise 2',exact:true}).selectOption('create');
  await p.waitForFunction(()=>!document.getElementById('commitInboxBtn').disabled);assert.deepEqual(f.saved(),before);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  f.loseAck();await p.locator('#commitInboxBtn').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='OUTCOME_UNKNOWN');assert.match(await p.locator('#inboxStatus').textContent(),/outcome unknown/i);assert(await p.getByRole('checkbox',{name:'Select workout 1',exact:true}).isDisabled());
  const committed=structuredClone(f.saved());assert.equal(committed.rows.sets.length,before.rows.sets.length+9);
  await p.locator('[data-view="data"]').click();await p.locator('#cloudRetry').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='READY');assert.deepEqual(f.saved(),committed);
  await p.locator('[data-view="inbox"]').click();assert.match(await p.locator('#inboxStatus').textContent(),/committed/);assert.match(await p.locator('#inboxStatus').textContent(),/excluded/);
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await p.screenshot({path:path.join(root,'test-results','issue82-'+width+'.png'),fullPage:true});
  await p.locator('#inboxFile').setInputFiles({name:'batch.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await p.getByRole('checkbox',{name:'Select workout 10',exact:true}).waitFor();await p.getByRole('checkbox',{name:'Select workout 10',exact:true}).uncheck();await p.waitForFunction(()=>document.getElementById('inboxStatus').textContent.includes('0 ready'));assert.deepEqual(f.saved(),committed);
});
