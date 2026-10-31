// All cloud/approval responses are disposable controlled transport, never hosted data.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto'),{chromium}=require('playwright-core');
const {setup}=require('./lifecycle-fixture.cjs');
const {actions}=require('../api/cutover-config.js');
const root=path.resolve(__dirname,'..'),origin='https://gymbro-synthetic-immutable.vercel.app';
const build=vm.runInNewContext(fs.readFileSync(path.join(root,'app-version.js'),'utf8')+'\nAPP_VERSION.version');
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});});
after(async()=>{await browser?.close();});
async function open(t,width,{failedLoad=false,alias=false}={}){
  const f=await setup(),source=JSON.stringify(f.source);let saved=structuredClone(f.handle),bad=false,failLoad=failedLoad,authorityChecks=0;
  const receipts=new Map(),calls=[],errors=[];
  const config={enabled:true,configured:true,rehearsal:true,environment:'production-rehearsal',projectRef:'loowxditqikcwyeftfgx',
    url:'https://loowxditqikcwyeftfgx.supabase.co',publishableKey:'sb_publishable_synthetic_fixture_only',allowedOwners:[f.owner],
    syntheticOnly:false,fixtureTag:null,sourceByteDigest:createHash('sha256').update(source).digest('hex'),actions,
    deploymentUrl:origin,gitSha:'a'.repeat(40),build,expiresAt:'2099-01-01T00:00:00Z',approvalDigest:'b'.repeat(64)};
  const context=await browser.newContext({viewport:{width,height:844}});t.after(()=>context.close());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({owner})=>{
    window.keyReads=0;window.keyWrites=0;const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
    Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.keyReads++;return get.call(this,k);};
    Storage.prototype.setItem=function(k,v){if(k==='daveGymTrackerV1')window.keyWrites++;return set.call(this,k,v);};
    window.supabase={createClient:(url,key,options)=>({auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),
      getUser:async()=>{try{return {data:await (await options.global.fetch(url+'/auth/v1/user')).json()};}catch(error){return {error};}},
      onAuthStateChange:()=>{}},rpc:async(name,args={})=>{try{return await (await options.global.fetch(url+'/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)})).json();}catch(error){return {error};}}})};
  },{owner:f.owner});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===config.url){
      calls.push(url.pathname);
      if(url.pathname==='/auth/v1/user')return route.fulfill({json:{user:{id:f.owner,is_anonymous:false,email:'synthetic@example.invalid'}}});
      const name=url.pathname.split('/rpc/')[1],args=req.postDataJSON()??{};
      if(name==='gymbro_lifecycle_snapshot')return route.fulfill({json:failLoad?{error:{code:'57P01'}}:{data:saved}});
      const packet=args.packet,key=JSON.stringify(args.operation??packet?.operation);let answer;
      if(receipts.has(key))answer={code:'REPLAY',result:receipts.get(key),operationRevision:saved.revision};
      else if(name.endsWith('_resolve'))answer={code:'CANCELLED'};
      else if(packet.expectedRevision!==saved.revision)answer={code:'CONFLICT'};
      else {saved={...saved,...structuredClone(f.repository.assemble(packet.next,f.owner)),rows:structuredClone(packet.next),
        revision:String(BigInt(saved.revision)+1n),fingerprint:'c'.repeat(64)};receipts.set(key,packet.result);answer={code:'OK',result:packet.result,operationRevision:saved.revision};}
      return route.fulfill({json:{data:{...answer,operation:args.operation??packet.operation,snapshot:saved}}});
    }
    if(![origin,'https://branch-alias.vercel.app'].includes(url.origin))return route.abort();
    if(url.pathname==='/api/cutover-config'){authorityChecks++;return route.fulfill({json:bad?{...config,gitSha:'c'.repeat(40)}:config});}
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{enabled:false}});
    const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(relative.includes('..')||!/^([a-zA-Z0-9_-]+\.(js|html|css|png)|vendor\/[a-zA-Z0-9_.-]+\.js)$/.test(relative))return route.abort();
    const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'};
    return route.fulfill({body:fs.readFileSync(path.join(root,relative)),contentType:types[path.extname(relative)]});
  });
  await page.goto((alias?'https://branch-alias.vercel.app':origin)+'/?storage=cloud&rehearsal=production');
  if(!alias){await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');await page.locator('#cloudConnect').click();
    if(failedLoad)await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('could not load'));
    else await page.waitForFunction(()=>cloudReady&&cloudController?.getStatus().phase==='READY');}
  t.after(()=>assert.deepEqual(errors,[],'no unexpected page exceptions'));
  return {f,page,calls,source,saved:()=>saved,checks:()=>authorityChecks,mismatch:()=>{bad=true;},recover:()=>{bad=false;failLoad=false;}};
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
test('failed Production cloud load does not show an empty account, initialize, seed or access local workout storage',async t=>{
  const f=await open(t,390,{failedLoad:true});assert.equal(await f.page.evaluate(()=>cloudController),null);
  assert(!f.calls.some(x=>x.includes('_initialize')||x.endsWith('_mutate')));
  assert.deepEqual(await f.page.evaluate(()=>[keyReads,keyWrites]),[0,0]);
});
test('a mutable branch alias cannot obtain rehearsal access even when config claims an approved immutable source',async t=>{
  const f=await open(t,390,{alias:true});await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('could not load'));
  assert.equal(f.calls.length,0);assert.equal(await f.page.evaluate(()=>cloudController),null);
});
