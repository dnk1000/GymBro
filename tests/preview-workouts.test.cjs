const {test,before,after}=require('node:test');const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');const {createServer}=require('../scripts/serve-probe.cjs');
const {setup}=require('./lifecycle-fixture.cjs');const {plain}=require('./protocol-fixture.cjs');
const {workoutConfig}=require('../api/workout-config.js');
const tag='gymbro-issue28-browser',ref='obebuvpsqapgevwivwho';
const env={VERCEL_ENV:'preview',GYMBRO_PREVIEW_WORKOUTS:'true',GYMBRO_CLOUD_ENV:'preview',SUPABASE_PROJECT_REF:ref,
  SUPABASE_URL:'https://'+ref+'.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_fixture_only',GYMBRO_PREVIEW_WORKOUT_FIXTURE_TAG:tag};
test('Preview cloud capability refuses Production, privileged config, missing owners/tag and disabled environments',()=>{
  const base={...env,GYMBRO_PREVIEW_WORKOUT_OWNERS:'99999999-9999-4999-8999-999999999939'};
  assert.equal(workoutConfig(base).syntheticOnly,true);assert.equal(workoutConfig(base).configured,true);
  for(const patch of [{VERCEL_ENV:'production'},{GYMBRO_PREVIEW_WORKOUTS:'false'},{SUPABASE_PROJECT_REF:'wrong'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_never_emit'},{GYMBRO_PREVIEW_WORKOUT_FIXTURE_TAG:'personal'},{GYMBRO_PREVIEW_WORKOUT_OWNERS:''}]){
    const c=workoutConfig({...base,...patch});assert.notEqual(c.configured,true);assert(!JSON.stringify(c).includes('never_emit'));
  }
});
let server,browser,origin;
before(async()=>{server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function fixture(){
  const f=await setup();f.source.extension.previewMigrationFixture=tag;
  let saved={protocolVersion:1,ownerId:f.owner,revision:'0',fingerprint:'a'.repeat(64),status:'uninitialized',rows:Object.fromEntries(Object.keys(f.handle.rows).map(k=>[k,[]]))},lost=false;
  const receipts=new Map(),calls=[];
  return {...f,calls,getSaved:()=>saved,lose:()=>{lost=true;},rpc:async(name,args={})=>{
    calls.push({name,args});if(name==='gymbro_lifecycle_snapshot')return {data:saved};
    const op=args.packet?.operation??args.operation,key=JSON.stringify(op),receipt=receipts.get(key);let answer;
    if(receipt)answer={code:'REPLAY',result:receipt.result,operationRevision:receipt.revision};
    else if(name==='gymbro_lifecycle_resolve')answer={code:'CANCELLED'};
    else if(args.packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
    else {
      const p=args.packet;saved={...saved,status:'healthy',rows:plain(p.next),revision:String(BigInt(saved.revision)+1n),fingerprint:'b'.repeat(64)};
      receipts.set(key,{result:p.result,revision:saved.revision});answer={code:'OK',result:p.result,operationRevision:saved.revision};
      if(lost){lost=false;throw Error('lost response');}
    }
    return {data:{...answer,operation:op,snapshot:saved}};
  }};
}
async function open(t,f,width,accountModule=false){
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{window.workoutReads=0;window.workoutWrites=0;const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.workoutReads++;return get.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(k==='daveGymTrackerV1')window.workoutWrites++;return set.call(this,k,v);};});
  await context.route('**/api/*',route=>route.fulfill({json:(route.request().url().endsWith('/workout-config')||(accountModule&&route.request().url().endsWith('/account-config')))?workoutConfig({...env,GYMBRO_PREVIEW_WORKOUT_OWNERS:f.owner}):{enabled:false}}));
  await context.route('**/synthetic-rpc',async route=>{const {name,args}=route.request().postDataJSON();try{await route.fulfill({json:await f.rpc(name,args)});}catch{await route.abort();}});
  if(accountModule)await context.addInitScript(({owner})=>{window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),getUser:async()=>({data:{user:{id:owner,is_anonymous:false,email:'synthetic@example.invalid'}}}),onAuthStateChange:()=>{}},rpc:async(name,args)=>fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())})};},{owner:f.owner});
  await page.goto(origin+'/?storage=cloud');
  assert.deepEqual(errors,[]);
  if(!accountModule)await page.evaluate(({owner,ref})=>window.dispatchEvent(new CustomEvent('gymbro-account',{detail:{user:{id:owner},config:{projectRef:ref},client:{auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}}})},rpc:async(name,args)=>fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())}}})),{owner:f.owner,ref});
  if(accountModule)await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');
  await page.locator('#cloudConnect').click();await page.waitForFunction(()=>!document.getElementById('migrationControls').disabled);
  t.after(()=>assert.deepEqual(errors,[],'uncaught normal-app browser errors'));
  return page;
}
for(const width of [320,390,1280])test('normal seven-view cloud app migrates, preserves drafts under lost ack, reloads and exports at '+width+'px',async t=>{
  const f=await fixture(),page=await open(t,f,width);
  const upload=async source=>page.locator('#migrationFile').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});
  await upload({...f.source,extension:{}});await page.locator('#migrationReview').click();await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('untagged'));
  assert.equal(f.calls.filter(c=>c.args.packet).length,0);
  await upload(f.source);await page.locator('#migrationReview').click();await page.waitForFunction(()=>!document.getElementById('migrationCommit').disabled);
  page.on('dialog',d=>d.accept());await page.locator('#migrationCommit').click();await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('Migration verified'));
  assert.equal(f.getSaved().revision,'1');const original=plain(f.getSaved().rows);
  await page.locator('#migrationReview').click();await page.locator('#migrationCommit').click();await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('Migration verified'));
  assert.equal(f.getSaved().revision,'1');assert.deepEqual(f.getSaved().rows,original);
  for(const view of ['dashboard','program','workout','history','inbox','exercises','data'])await page.locator('[data-view="'+view+'"]').click();
  await page.locator('[data-view="workout"]').click();await page.evaluate(()=>useManualLogging());
  const id=f.getSaved().rows.exercises[0].exercise_id;await page.locator('#fExercise').selectOption(id);
  await page.locator('#fDate').fill('2026-10-28');await page.locator('#fWeight').fill('0');await page.locator('#fReps').fill('7');await page.locator('#fNotes').fill('  exact draft\n');
  f.lose();await page.locator('#saveSetBtn').click();await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('confirmation was lost'));
  assert.equal(await page.locator('#fNotes').inputValue(),'  exact draft\n');
  await page.locator('[data-view="data"]').click();await page.locator('#cloudRetry').click();await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('REPLAY'));
  assert.equal(f.getSaved().revision,'2');assert.equal(f.getSaved().rows.sets.length,original.sets.length+1);
  assert.equal(f.getSaved().rows.sets.at(-1).notes,'  exact draft\n');
  if(width===390){
    await page.locator('[data-view="workout"]').click();
    await page.locator('#bwDate').fill('2026-10-28');await page.locator('#bwValue').fill('201');await page.evaluate(()=>addBodyweight());
    assert.equal(f.getSaved().rows.bodyweights.at(-1).value,201);
    await page.locator('#sessionNote').fill('session context');await page.evaluate(()=>saveNoteEditor('sessionNote'));
    assert.equal(f.getSaved().rows.session_notes[0].text,'session context');
    await page.locator('[data-view="program"]').click();await page.evaluate(async()=>{await toggleShort('push',0);await cycleRole('push',0);});
    assert.equal(f.getSaved().rows.snapshot_slots[0].role,original.snapshot_slots[0].role,'template edit cannot rewrite historical snapshot');
    await page.locator('[data-view="exercises"]').click();await page.evaluate(id=>showExercise(id),id);await page.locator('#setupNote').fill('durable setup');await page.evaluate(()=>saveNoteEditor('setupNote'));
    assert(f.getSaved().rows.exercise_setup_notes.some(n=>n.text==='durable setup'));
    await page.locator('[data-view="workout"]').click();await page.evaluate(()=>logCurrentExercise());await page.locator('#fWeight').fill('12');await page.locator('#fReps').fill('8');await page.locator('#saveSetBtn').click();await page.waitForFunction(()=>cloudController.getStatus().phase==='READY');
    const last=f.getSaved().rows.sets.at(-1);assert.equal(last.session_id,f.sessionId);assert.equal(last.plan_slot_id,'slot-1');
    await page.evaluate(id=>editSet(id),last.set_id);await page.locator('#fNotes').fill('corrected set');await page.locator('#saveSetBtn').click();await page.waitForFunction(()=>cloudController.getStatus().phase==='READY');
    assert.equal(f.getSaved().rows.sets.at(-1).notes,'corrected set');await page.evaluate(id=>deleteSet(id),last.set_id);
    assert(!f.getSaved().rows.sets.some(s=>s.set_id===last.set_id));
    assert(f.getSaved().rows.guided_requests.some(r=>r.set_id===last.set_id),'deleted guided request retains original request identity as a tombstone');
    await page.locator('[data-view="inbox"]').click();await page.locator('#inboxRaw').fill(JSON.stringify({schema:'gym-tracker-chatgpt-v1',importId:'synthetic-inbox',date:'2026-10-28',exercises:[{exercise:'New synthetic import label',sets:[{weight:0,unit:'bodyweight',reps:7,notes:'exact import'}]}]}));
    await page.evaluate(()=>parseInbox());await page.evaluate(()=>commitInbox());
    assert.equal(f.getSaved().rows.imports.at(-1).import_id,'synthetic-inbox');
    const count=f.getSaved().rows.sets.length;await page.evaluate(()=>parseInbox());await page.evaluate(()=>commitInbox());assert.equal(f.getSaved().rows.sets.length,count);
    await page.locator('[data-view="data"]').click();
  }
  const download=page.waitForEvent('download');await page.locator('#cloudLifecycle [data-export]').click();const exported=await download;
  assert.equal(exported.suggestedFilename(),'gymbro-cloud-backup.json');
  if(width===390){
    const csvEvent=page.waitForEvent('download');await page.evaluate(()=>exportCSV());const csvDownload=await csvEvent,csvParts=[];for await(const part of await csvDownload.createReadStream())csvParts.push(part);const csv=Buffer.concat(csvParts).toString();
    assert.deepEqual({namedExercise:csv.includes('Bench Press'),canonicalIdLeaked:csv.includes(f.getSaved().rows.exercises[0].exercise_id),legacyRestoreVisible:await page.locator('#importFile').isVisible(),catalogLabelVisible:(await page.locator('#taxonomySummary').textContent()).includes('Bench Press'),catalogIdLeaked:(await page.locator('#taxonomySummary').textContent()).includes(f.getSaved().rows.exercises[0].exercise_id)},{namedExercise:true,canonicalIdLeaked:false,legacyRestoreVisible:false,catalogLabelVisible:true,catalogIdLeaked:false});
    const chunks=[];for await(const chunk of await exported.createReadStream())chunks.push(chunk);const aText=Buffer.concat(chunks).toString(),a=JSON.parse(aText),b=structuredClone(a);
    b.payload.document.data.sets[0].notes='restored exact note';
    await page.locator('#cloudLifecycle [data-incoming]').setInputFiles({name:'synthetic-B.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))});
    await page.locator('#cloudLifecycle [data-review]').click();await page.waitForFunction(()=>!document.querySelector('#cloudLifecycle [data-commit]').disabled);
    await page.locator('#cloudLifecycle [data-safety]').setInputFiles({name:'saved-A.json',mimeType:'application/json',buffer:Buffer.from(aText)});await page.locator('#cloudLifecycle [data-verify]').click();
    await page.waitForFunction(()=>document.querySelector('#cloudLifecycle [data-status]').textContent.includes('verified'));
    await page.evaluate(()=>noteDrafts.set('obsolete',{text:'draft retained until acknowledgement'}));
    await page.locator('#cloudLifecycle [data-commit]').click();await page.waitForFunction(()=>cloudController.getStatus().phase==='READY'&&noteDrafts.size===0);
    assert(f.lifecycle.equalRows(f.getSaved().rows,f.repository.project(b.payload.document,f.owner,b.payload.bodyweightIds,b.payload.signatureSchemes)),'complete restored canonical content and relationship equality');
    const incoming=structuredClone(b),row=incoming.payload.document.data.sets.find(s=>s.sessionId==null);incoming.payload.document.data.sets.push({...row,id:'synthetic-history-addition'});
    incoming.payload.document.data.preferences.notImported='incoming setting must not replace current';incoming.payload.document.data.program.activeDuration=30;
    await page.locator('#cloudLifecycle [data-mode]').selectOption('merge');await page.locator('#cloudLifecycle [data-incoming]').setInputFiles({name:'synthetic-merge.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
    await page.locator('#cloudLifecycle [data-review]').click();await page.waitForFunction(()=>!document.querySelector('#cloudLifecycle [data-commit]').disabled);await page.locator('#cloudLifecycle [data-commit]').click();
    await page.waitForFunction(()=>cloudController.getStatus().phase==='READY'&&db.sets.some(s=>s.id==='synthetic-history-addition'));
    assert.deepEqual(f.repository.assemble(f.getSaved().rows,f.owner).document.data.preferences,b.payload.document.data.preferences);
    assert.deepEqual(plain(f.repository.assemble(f.getSaved().rows,f.owner).document.data.program),b.payload.document.data.program);
    const count=f.getSaved().rows.sets.length;await page.locator('#cloudLifecycle [data-review]').click();await page.locator('#cloudLifecycle [data-commit]').click();await page.waitForFunction(()=>cloudController.getStatus().phase==='READY');assert.equal(f.getSaved().rows.sets.length,count);
    const other=await open(t,f,390);other.on('dialog',d=>d.accept());
    await page.evaluate(async id=>{await workoutActions.logSet({date:'2026-10-28',exercise:id,weight:0,reps:8,sessionId:null});},id);
    const winner=plain(f.getSaved().rows);await other.locator('[data-view="workout"]').click();await other.locator('#fExercise').selectOption(id);await other.locator('#fDate').fill('2026-10-28');await other.locator('#fWeight').fill('0');await other.locator('#fReps').fill('9');await other.locator('#fNotes').fill('stale draft');
    await other.locator('#saveSetBtn').click();await other.waitForFunction(()=>cloudController.getStatus().phase==='CONFLICT');assert.equal(await other.locator('#fNotes').inputValue(),'stale draft');assert.deepEqual(f.getSaved().rows,winner);
    await other.locator('[data-view="data"]').click();await other.locator('#cloudRefresh').click();await other.waitForFunction(()=>cloudController.getStatus().phase==='READY');assert.equal(await other.locator('#fNotes').inputValue(),'stale draft');assert.deepEqual(f.getSaved().rows,winner);
  }
  assert.deepEqual(await page.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})))));
  await page.reload();await page.evaluate(({owner,ref})=>window.dispatchEvent(new CustomEvent('gymbro-account',{detail:{user:{id:owner},config:{projectRef:ref},client:{auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}}})},rpc:async(name,args)=>fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())}}})),{owner:f.owner,ref});
  await page.locator('#cloudConnect').click();await page.waitForFunction(()=>cloudReady);assert.equal(await page.evaluate(()=>db.activeSessionId),f.sessionId);
  assert.deepEqual(await page.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);
});

test('cloud entry initializes the existing account module before connecting, without a second Data click',async t=>{const f=await fixture(),page=await open(t,f,390,true);assert.equal(await page.locator('#accountStatus').textContent(),'Account restored.');assert.equal(f.calls.filter(x=>x.args.packet).length,0);assert.deepEqual(await page.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);});

test('verified refresh of the same account retains the cloud controller and selected migration file',async t=>{const f=await fixture(),page=await open(t,f,390,true);await page.locator('#migrationFile').setInputFiles({name:'selected-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(f.source))});await page.evaluate(()=>{window.originalCloudController=cloudController;});await page.locator('#accountRefresh').click();await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');assert.equal(await page.evaluate(()=>cloudController===window.originalCloudController),true);assert.equal(await page.locator('#migrationFile').evaluate(e=>e.files[0]?.name),'selected-synthetic.json');});
