const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {createServer}=require('../scripts/serve-probe.cjs');
const {lifecycleConfig}=require('../api/lifecycle-config.js');
const {setup}=require('./lifecycle-fixture.cjs');
const {plain}=require('./protocol-fixture.cjs');
const ref='obebuvpsqapgevwivwho';
const env={VERCEL_ENV:'preview',GYMBRO_LIFECYCLE_TEST:'true',GYMBRO_CLOUD_ENV:'preview',SUPABASE_PROJECT_REF:ref,
  SUPABASE_URL:`https://${ref}.supabase.co`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_fixture_only',GYMBRO_LIFECYCLE_FIXTURE_TAG:'gymbro-issue41-ui'};
test('lifecycle configuration cannot activate in Production or without dedicated synthetic identities',()=>{
  const owner='99999999-9999-4999-8999-999999999939';assert.equal(lifecycleConfig({...env,GYMBRO_LIFECYCLE_TEST_OWNERS:owner}).configured,true);
  for(const patch of [{VERCEL_ENV:'production'},{GYMBRO_LIFECYCLE_TEST:'false'},{SUPABASE_PROJECT_REF:'unknown'},{SUPABASE_PUBLISHABLE_KEY:'sb_secret_private'}])
    assert.notEqual(lifecycleConfig({...env,GYMBRO_LIFECYCLE_TEST_OWNERS:owner,...patch}).configured,true);
  assert.equal(lifecycleConfig(env).configured,false);
});
let server,browser,origin;
before(async()=>{server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function open(t,width=390,enabled=true,stateStatus='healthy'){
  const f=await setup();f.document.data.extension.lifecycleFixture=env.GYMBRO_LIFECYCLE_FIXTURE_TAG;
  let saved=plain({...f.handle,document:f.document,rows:f.repository.project(f.document,f.owner,f.bodyweightIds)});
  if(stateStatus!=='healthy')saved={protocolVersion:1,ownerId:f.owner,revision:'0',status:stateStatus,fingerprint:'c'.repeat(64),
    rows:stateStatus==='uninitialized'?Object.fromEntries(Object.keys(saved.rows).map(k=>[k,[]])):saved.rows};
  const receipts=new Map(),calls=[];
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});t.after(()=>assert.deepEqual(errors,[]));
  await context.route('**/api/lifecycle-config',route=>route.fulfill({json:enabled?lifecycleConfig({...env,GYMBRO_LIFECYCLE_TEST_OWNERS:f.owner}):{enabled:false}}));
  await context.route('**/vendor/supabase-2.118.0.js',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:${JSON.stringify(f.owner)},is_anonymous:false}}}),onAuthStateChange:callback=>{window.syntheticAuth=callback;},signOut:async()=>({}),signInWithPassword:async()=>({})},rpc:async(name,args)=>fetch('/synthetic-rpc',{method:'POST',body:JSON.stringify({name,args})}).then(r=>r.json())})};`}));
  await context.route('**/synthetic-rpc',async route=>{
    const {name,args}=route.request().postDataJSON();calls.push({name,args});
    if(name==='gymbro_lifecycle_snapshot')return route.fulfill({json:{data:saved}});
    const packet=args.packet,key=JSON.stringify(packet?.operation??args.operation),receipt=receipts.get(key);
    let answer;
    if(receipt)answer=receipt;else if(packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
    else {saved={...saved,...plain(f.repository.assemble(packet.next,f.owner)),status:'healthy',rows:packet.next,revision:String(BigInt(saved.revision)+1n),fingerprint:'b'.repeat(64)};
      answer={code:'REPLAY',operationRevision:saved.revision,result:packet.result};receipts.set(key,answer);answer={...answer,code:'OK'};}
    return route.fulfill({json:{data:{...answer,operation:packet?.operation??args.operation,snapshot:saved}}});
  });
  await page.goto(origin+'/lifecycle-test.html');
  if(enabled){await page.waitForFunction(()=>!document.getElementById('access').disabled);await page.locator('#connect').click();await page.locator('[data-review]').waitFor();}
  return {...f,page,calls,saved:()=>saved};
}
const upload=(p,selector,name,text)=>p.locator(selector).setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
async function content(download){const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks).toString();}
test('disabled Preview performs no workout call and keeps normal local store unopened',async t=>{
  const f=await open(t,390,false);await f.page.waitForFunction(()=>document.getElementById('status').textContent.includes('disabled'));
  assert.equal(f.calls.length,0);assert.equal(await f.page.locator('[data-review]').count(),0);
});
test('desktop/390/320 complete download, reopened safety file, confirmation cancellation and lost-ack retry',async t=>{
  for(const width of [1280,390,320]){
    const f=await open(t,width),p=f.page;
    const downloaded=p.waitForEvent('download');await p.locator('[data-export]').click();const safetyText=await content(await downloaded);
    const file=JSON.parse(safetyText);assert.equal(file.source.ownerId,f.owner);assert.deepEqual(file.payload.bodyweightIds,f.bodyweightIds);
    const incoming=structuredClone(file);incoming.payload.document.data.sets[0].notes='  exact replacement\n🚀';
    const text=JSON.stringify(incoming);
    await upload(p,'[data-incoming]','incoming.json',text);await p.locator('[data-review]').click();await p.waitForFunction(()=>document.querySelector('[data-summary]').textContent.includes('COMPLETE RESTORE'));
    await p.locator('[data-commit]').click();await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Verify the saved'));
    assert.equal(f.calls.filter(c=>c.name==='gymbro_lifecycle_mutate').length,0);
    await upload(p,'[data-safety]','safety.json',safetyText);await p.locator('[data-verify]').click();await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('recovery file verified'));
    p.once('dialog',d=>d.dismiss());await p.locator('[data-commit]').click();assert.equal(f.calls.filter(c=>c.name==='gymbro_lifecycle_mutate').length,0);
    await p.locator('#loseAcknowledgement').check();p.once('dialog',d=>d.accept());await p.locator('[data-commit]').click();
    await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.startsWith('Save confirmation was lost'));
    assert.equal(await p.locator('[data-commit]').isDisabled(),true);
    assert.equal(await p.locator('[data-incoming]').evaluate(e=>e.files[0].name),'incoming.json');
    await p.locator('[data-retry]').click();await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Cloud request REPLAY'));
    const packets=f.calls.filter(c=>c.name==='gymbro_lifecycle_mutate').map(c=>c.args.packet);assert.deepEqual(packets[0],packets[1]);
    assert.equal(f.saved().document.data.sets[0].notes,'  exact replacement\n🚀');assert.equal(f.saved().revision,'13');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await p.locator('[data-local-delete]').isDisabled(),true);
    assert.equal(await p.evaluate(()=>localStorage.getItem('daveGymTrackerV1')),null);
  }
});
test('account mismatch and malformed files never send, account switch disables the panel',async t=>{
  const f=await open(t),p=f.page,file=f.lifecycle.backup(f.handle);file.source.ownerId='88888888-8888-4888-8888-888888888888';
  await upload(p,'[data-incoming]','foreign.json',JSON.stringify(file));await p.locator('[data-review]').click();
  await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('different account'));assert.equal(await p.locator('[data-commit]').isDisabled(),true);
  await upload(p,'[data-incoming]','broken.json','{');await p.locator('[data-review]').click();
  await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('JSON'));
  assert.equal(f.calls.filter(c=>c.name==='gymbro_lifecycle_mutate').length,0);
  await p.evaluate(()=>window.syntheticAuth('SIGNED_OUT',null));assert.equal(await p.locator('[data-review]').count(),0);
});
test('uninitialized and unreadable recovery expose raw diagnostics and stronger explicit emergency confirmation',async t=>{
  for(const status of ['uninitialized','unreadable']){
    const f=await open(t,320,true,status),p=f.page,text=JSON.stringify(f.lifecycle.backup(f.handle));
    assert.equal(await p.locator('[data-export]').isDisabled(),true);
    await upload(p,'[data-incoming]','recovery.json',text);await p.locator('[data-review]').click();await p.waitForFunction(()=>document.querySelector('[data-summary]').textContent.includes('COMPLETE RESTORE'));
    await p.locator('[data-commit]').click();await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Download raw diagnostic'));
    assert.equal(f.calls.filter(c=>c.name==='gymbro_lifecycle_mutate').length,0);
    const download=p.waitForEvent('download');await p.locator('[data-raw]').click();const raw=JSON.parse(await content(await download));
    assert.equal(raw.format,'gymbro-raw-diagnostics');assert.equal(raw.status,status);
    await p.locator('[data-emergency]').check();p.once('dialog',async d=>{assert.match(d.message(),/EMERGENCY RESTORE/);await d.accept();});
    await p.locator('[data-commit]').click();await p.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('Cloud request OK'));
    assert.equal(f.saved().status,'healthy');assert.equal(f.saved().revision,'1');
  }
});
