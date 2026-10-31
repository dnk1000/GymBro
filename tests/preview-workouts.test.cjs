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
async function open(t,f,width){
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{window.workoutReads=0;window.workoutWrites=0;const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.workoutReads++;return get.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(k==='daveGymTrackerV1')window.workoutWrites++;return set.call(this,k,v);};});
  await context.route('**/api/*',route=>route.fulfill({json:route.request().url().endsWith('/workout-config')?workoutConfig({...env,GYMBRO_PREVIEW_WORKOUT_OWNERS:f.owner}):{enabled:false}}));
  await context.route('**/synthetic-rpc',async route=>{const {name,args}=route.request().postDataJSON();try{await route.fulfill({json:await f.rpc(name,args)});}catch{await route.abort();}});
  await page.goto(origin+'/?storage=cloud');
  assert.deepEqual(errors,[]);
  await page.evaluate(({owner,ref})=>window.dispatchEvent(new CustomEvent('gymbro-account',{detail:{user:{id:owner},config:{projectRef:ref},client:{auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}}})},rpc:async(name,args)=>fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())}}})),{owner:f.owner,ref});
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
  const download=page.waitForEvent('download');await page.locator('#cloudLifecycle [data-export]').click();const exported=await download;
  assert.equal(exported.suggestedFilename(),'gymbro-cloud-backup.json');
  assert.deepEqual(await page.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.evaluate(({owner,ref})=>window.dispatchEvent(new CustomEvent('gymbro-account',{detail:{user:{id:owner},config:{projectRef:ref},client:{auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}}})},rpc:async(name,args)=>fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())}}})),{owner:f.owner,ref});
  await page.locator('#cloudConnect').click();await page.waitForFunction(()=>cloudReady);assert.equal(await page.evaluate(()=>db.activeSessionId),f.sessionId);
  assert.deepEqual(await page.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);
});
