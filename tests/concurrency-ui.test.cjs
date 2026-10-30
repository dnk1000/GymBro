const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {createServer}=require('../scripts/serve-probe.cjs');
const {concurrencyConfig}=require('../api/concurrency-config.js');
const {serverFixture}=require('./protocol-fixture.cjs');
const ref='obebuvpsqapgevwivwho';
const env={VERCEL_ENV:'preview',GYMBRO_CONCURRENCY_TEST:'true',GYMBRO_CLOUD_ENV:'preview',SUPABASE_PROJECT_REF:ref,
  SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only_public',
  GYMBRO_CONCURRENCY_TEST_OWNERS:'99999999-9999-4999-8999-999999999939',GYMBRO_CONCURRENCY_FIXTURE_TAG:'gymbro-issue40-browser-test'};
test('synthetic test config refuses Production, unknown projects, privileged keys and missing dedicated owners',()=>{
  assert.equal(concurrencyConfig(env).configured,true);
  for(const VERCEL_ENV of ['production','development','staging']) assert.deepEqual(concurrencyConfig({...env,VERCEL_ENV,GYMBRO_PROBE_LOCAL:'true'}),{enabled:false});
  assert.equal(concurrencyConfig({...env,VERCEL_ENV:'',GYMBRO_PROBE_LOCAL:'true'}).environment,'local');
  assert.deepEqual(concurrencyConfig({...env,VERCEL_ENV:'',VERCEL:'1',GYMBRO_PROBE_LOCAL:'true'}),{enabled:false});
  assert.deepEqual(concurrencyConfig({...env,GYMBRO_CONCURRENCY_TEST:'false'}),{enabled:false});
  for(const patch of [{SUPABASE_PROJECT_REF:'unknown'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_do_not_emit'},{GYMBRO_CONCURRENCY_TEST_OWNERS:''},{GYMBRO_CONCURRENCY_FIXTURE_TAG:'personal'}]) {
    const config=concurrencyConfig({...env,...patch});assert.equal(config.configured,false);assert.equal(JSON.stringify(config).includes('do_not_emit'),false);
  }
});
let server,browser,origin;
before(async()=> {
  server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function pageFor(t,f,width=390,configured=true,connectNow=true) {
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());
  const errors=[];
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['error','warning'].includes(m.type())) errors.push(m.text());});
  await context.route('**/api/concurrency-config',route=>route.fulfill({json:configured?concurrencyConfig({...env,GYMBRO_CONCURRENCY_TEST_OWNERS:f.owner}):{enabled:false}}));
  await context.route('**/vendor/supabase-2.118.0.js',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:${JSON.stringify(f.owner)},is_anonymous:false}}}),onAuthStateChange:callback=>{window.emitSyntheticAuth=callback;},signOut:async()=>({}),signInWithPassword:async()=>({})},rpc:async(name,args)=>{const response=await fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})});return response.json();}})};`}));
  await context.route('**/synthetic-rpc',async route=> {
    const {name,args}=route.request().postDataJSON();
    try {await route.fulfill({json:await f.client.rpc(name,args)});}catch {await route.abort();}
  });
  await page.goto(origin+'/concurrency-test.html');
  if(configured) {await page.waitForFunction(()=>!document.getElementById('access').disabled);if(connectNow){await page.locator('#connect').click();await page.waitForFunction(()=>!document.getElementById('mutation').disabled);}}
  t.after(()=>assert.deepEqual(errors,[],'uncaught browser errors'));
  return page;
}
async function synthetic() {const f=await serverFixture();f.document.data.extension.concurrencyFixture=env.GYMBRO_CONCURRENCY_FIXTURE_TAG;return f;}
const status=page=>page.locator('#status').textContent();
async function settled(page) {await page.waitForFunction(()=>!document.getElementById('status').textContent.startsWith('A save is awaiting'));}
test('guarded page is disabled without staging config and never contacts workout RPCs',async t=>{
  const f=await synthetic(),p=await pageFor(t,f,390,false);
  await p.waitForFunction(()=>document.getElementById('status').textContent.includes('disabled'));
  assert.equal(await p.locator('#mutation').evaluate(el=>el.disabled),true);assert.equal(await p.locator('#submit').isDisabled(),true);assert.equal(f.calls.length,0);
});
test('desktop/390/320 widths retain exact draft through unknown outcome and exact retry',async t=>{
  for(const width of [1280,390,320]) {
    const f=await synthetic(),p=await pageFor(t,f,width),draft=await p.locator('#arguments').inputValue();
    await p.locator('#loseAcknowledgement').check();await p.locator('#submit').click();
    await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Save confirmation was lost.'));
    assert.equal(await p.locator('#arguments').inputValue(),draft);assert.equal(await p.locator('#submit').isDisabled(),true);
    assert.doesNotMatch(await status(p),/^Saved\./);
    const marker=await p.evaluate(()=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('gymbro-request-recovery-')))));
    assert.deepEqual(Object.keys(marker).sort(),['operation','ownerId','protocolVersion']);
    await p.locator('#arguments').fill(draft+'\n');await p.locator('#retry').click();
    await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Original request confirmed.'));
    assert.equal(f.getSaved().revision,'1');assert.equal(await p.locator('#arguments').inputValue(),draft+'\n');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await p.evaluate(()=>localStorage.getItem('daveGymTrackerV1')),null);
    if(width===320) await p.screenshot({path:'test-results/concurrency-320.png',fullPage:true});
  }
});
test('two contexts keep stale set and import drafts during conflict and explicit refresh',async t=>{
  const f=await synthetic(),a=await pageFor(t,f),b=await pageFor(t,f);
  const draft=await b.locator('#arguments').inputValue();
  await a.locator('#submit').click();await a.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Saved.'));
  await b.locator('#submit').click();await b.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Another tab or device'));
  assert.equal(await b.locator('#arguments').inputValue(),draft);
  await b.locator('#refresh').click();await b.waitForFunction(()=>!document.getElementById('submit').disabled);
  assert.equal(await b.locator('#arguments').inputValue(),draft);
  // Import selection booleans and notes remain literal editor content on conflict.
  const importDraft=JSON.stringify([{importId:'browser-review',date:'2026-10-28',duration:30,template:'synthetic',sessionNotes:'  retain\n',bodyweight:null,sets:[{include:true,exercise:f.identity.resolveLabel(f.document.catalog,'Bench Press'),weight:0,reps:8,unit:'lb',rpe:null,rir:0,pain:0,painArea:'',notes:'',complete:false},{include:false,exercise:'unresolved'}]}],null,2);
  await a.locator('#refresh').click();await a.waitForFunction(()=>!document.getElementById('submit').disabled);await a.locator('#submit').click();await a.waitForFunction(()=>document.getElementById('status').textContent==='Saved. Revision 2.');
  await b.locator('#action').selectOption('commitImport');await b.locator('#arguments').fill(importDraft);await b.locator('#submit').click();
  await b.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Another tab or device'));
  assert.equal(await b.locator('#arguments').inputValue(),importDraft);assert.equal(f.getSaved().revision,'2');
});
test('reload resolves unknown operation and delayed acknowledgement cannot regress refreshed state',async t=>{
  const f=await synthetic(),p=await pageFor(t,f);
  await p.locator('#loseAcknowledgement').check();await p.locator('#submit').click();await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Save confirmation'));
  await p.reload();await p.waitForFunction(()=>!document.getElementById('access').disabled);await p.locator('#connect').click();
  await p.waitForFunction(()=>!document.getElementById('mutation').disabled);assert.equal(await p.locator('#submit').isDisabled(),true);
  await p.locator('#resolve').click();await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Original request confirmed.'));
  assert.equal(f.getSaved().revision,'1');
  await p.locator('#delayAcknowledgement').check();await p.locator('#submit').click();
  await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('A save is awaiting'));
  assert.equal(await p.locator('#submit').isDisabled(),true);
  await p.locator('#refresh').click();await settled(p);await p.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Saved. Revision 2.'));
  assert.match(await p.locator('#saved').textContent(),/"revision": "2"/);
});
test('account change while initial load is pending cannot publish the old owner snapshot',async t=>{
  const f=await synthetic(),original=f.client.rpc;let release,entered;
  const waiting=new Promise(r=>{entered=r;});
  f.client.rpc=async(name,args)=>{if(name==='gymbro_workout_snapshot'){await new Promise(r=>{release=r;entered();});}return original(name,args);};
  const p=await pageFor(t,f,390,true,false);await p.locator('#connect').click();await waiting;
  await p.evaluate(()=>window.emitSyntheticAuth('SIGNED_IN',{user:{id:'88888888-8888-4888-8888-888888888840'}}));
  const response=p.waitForResponse('**/synthetic-rpc');release();await response;
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await p.locator('#mutation').evaluate(el=>el.disabled),true);
  assert.equal(await p.locator('#saved').textContent(),'Not connected.');
  assert.match(await status(p),/Account changed/);
});
