// Operator-only: actual signed staging owners, protected deployed assets and
// targeted transport faults. Never log credentials, tokens or workout payloads.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {read,preview,guard}=require('./issue42-preview.cjs');
const {sdk,validate}=require('./issue28-staging-fixtures.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
  if(process.argv.length!==2)throw Error('No arbitrary flags.');const sha=guard();
  const state=validate(JSON.parse(fs.readFileSync(path.join(root,'.env.issue28-fixtures.json'),'utf8'))),config=JSON.parse(await read('/api/workout-config'));
  assert(config.enabled&&config.configured&&config.syntheticOnly);assert.equal(config.fixtureTag,state.tag);assert.deepEqual(config.allowedOwners,state.accounts.map(a=>a.id));
  const f=await require('../tests/lifecycle-fixture.cjs').setup();f.get(fs.readFileSync(path.join(root,'workout-migration.js'),'utf8'));
  const clients=[],repos=[],cache=new Map(),checks=[],errors=[],faults=new Map(),packets=new Map(),expectedFailures=[];
  for(const account of state.accounts){const client=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const signed=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!signed.error);assert.equal(signed.data.user.id,account.id);
    clients.push(client);repos.push(f.lifecycle.createRepository({client,ownerId:account.id}));}
  for(const file of ['index.html','app-version.js','operational-diagnostics.js','account-access.js','cloud-ui.js','workout-cloud.js','workout-concurrency.js','workout-repository.js','workout-lifecycle.js','workout-lifecycle-panel.js']){
    const body=await read('/'+file);let comparable=body.toString().replaceAll('\r\n','\n');
    if(file==='index.html')comparable=comparable.replace(/<script\b[^>]*src=["']https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js["'][^>]*><\/script>/g,'');
    assert.equal(comparable,fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'),'exact deployed asset '+file);cache.set('/'+file,Promise.resolve(body));}
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),contexts=[];
  const check=name=>{checks.push(name);console.log(name+' PASS');};
  const ready=p=>p.waitForFunction(()=>cloudController?.getStatus().phase==='READY'&&cloudReady);
  async function open(width,index=0,initialFault){
    const signed=await clients[index].auth.getSession(),session=signed.data.session;
    const context=await browser.newContext({viewport:{width,height:844}});contexts.push(context);const page=await context.newPage();faults.set(page,initialFault);
    await context.addInitScript(({session,key})=>{localStorage.setItem(key,JSON.stringify(session));window.workoutReads=0;window.workoutWrites=0;
      const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
      Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.workoutReads++;return get.call(this,k);};
      Storage.prototype.setItem=function(k,v){if(k==='daveGymTrackerV1')window.workoutWrites++;return set.call(this,k,v);};
    },{session,key:'gymbro-account-auth-'+config.projectRef});
    page.on('pageerror',()=>errors.push('Unexpected page exception'));
    page.on('console',m=>{if(['warning','error'].includes(m.type())&&!expectedFailures.some(x=>x.page===page&&m.location().url===x.url))errors.push('Unexpected browser console error');});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url()),fault=faults.get(page);
      if(url.origin===config.url){
        const snapshot=url.pathname==='/rest/v1/rpc/gymbro_lifecycle_snapshot';
        if((snapshot&&['database','auth','offline','compatibility'].includes(fault))||(url.pathname==='/auth/v1/user'&&fault==='account')){
          expectedFailures.push({page,url:req.url()});if(fault==='offline')return route.abort('internetdisconnected');
          return route.fulfill({status:fault==='database'?503:fault==='compatibility'?404:401,json:{code:fault==='database'?'57P01':fault==='compatibility'?'PGRST202':'PGRST301',message:'NEVER_EMIT_SECRET',details:'private provider details'}});
        }
        if(url.pathname==='/rest/v1/rpc/gymbro_workout_mutate'){
          const seen=packets.get(page)??[];seen.push(req.postDataJSON().packet);packets.set(page,seen);
          if(fault==='lost'){faults.set(page,null);const response=await route.fetch();assert(response.ok());expectedFailures.push({page,url:req.url()});return route.abort('failed');}
        }
        return route.continue();
      }
      if(url.origin==='https://vercel.live'&&req.method()==='GET')return route.continue();
      if(url.origin!==preview||req.method()!=='GET'){errors.push('Unexpected network destination/method');return route.abort();}
      if(!cache.has(url.pathname))cache.set(url.pathname,read(url.pathname));
      return route.fulfill({body:await cache.get(url.pathname),contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.startsWith('/api/')?'application/json':url.pathname.endsWith('.png')?'image/png':'text/html'});
    });
    page.on('dialog',d=>d.accept());await page.goto(preview+'/?storage=cloud');await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');
    await page.locator('#cloudConnect').click();
    if(initialFault)await page.waitForFunction(()=>document.getElementById('cloudStatus').textContent.includes('could not load'));else await page.waitForFunction(()=>!!cloudController);
    return page;
  }
  try{
    const first=await repos[0].load();assert(['uninitialized','healthy'].includes(first.status),'qualified fixture state required');
    f.source.extension.previewMigrationFixture=state.tag;const text=JSON.stringify(f.source),candidate=await f.get('WorkoutMigration').prepareSource(text,state.accounts[0].id);
    if(first.status==='healthy')assert(f.lifecycle.equalRows(first.rows,f.repository.project(candidate.document,state.accounts[0].id,candidate.bodyweightIds,candidate.signatureSchemes)),'resume requires exact initialized synthetic source');
    const page=await open(1280);if(first.status==='uninitialized'){await page.locator('#migrationFile').setInputFiles({name:'synthetic-diagnostics.json',mimeType:'application/json',buffer:Buffer.from(text)});
    await page.locator('#migrationReview').click();await page.waitForFunction(()=>!document.getElementById('migrationCommit').disabled);await page.locator('#migrationCommit').click();await ready(page);}
    assert(f.lifecycle.equalRows((await repos[0].load()).rows,f.repository.project(candidate.document,state.accounts[0].id,candidate.bodyweightIds,candidate.signatureSchemes)));
    check('signed synthetic setup verified by complete row/relationship equality');
    for(const width of [1280,390,320]){
      const p=await open(width,0,'database');assert.equal(await p.evaluate(()=>cloudController),null);assert.equal(await p.locator('#workout fieldset').evaluate(e=>e.hidden&&e.disabled),true);
      const support=JSON.parse(await p.locator('#previewCloud > details pre').textContent());assert.equal(support.classification,'DATABASE');assert.equal(support.environment,'Preview');assert.equal(support.appVersion,f.get('APP_VERSION.version'));
      faults.set(p,null);await p.locator('#cloudConnect').click();await ready(p);const before=await repos[0].load(),id=before.document.catalog.exercises[0].id;
      await p.locator('[data-view="workout"]').click();await p.evaluate(()=>useManualLogging());await p.locator('#fExercise').selectOption(id);await p.locator('#fDate').fill('2026-10-28');await p.locator('#fWeight').fill('0');await p.locator('#fReps').fill('7');await p.locator('#fNotes').fill('  retained private draft\n');
      await p.locator('[data-view="data"]').click();for(const fault of ['offline','database','auth','compatibility']){
        faults.set(p,fault);await p.locator('#cloudRefresh').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='LOAD_ERROR');
        assert.equal(await p.locator('#fNotes').inputValue(),'  retained private draft\n');assert(f.lifecycle.equalRows((await repos[0].load()).rows,before.rows));
        const summary=await p.locator('#previewCloud > details pre').textContent();assert(!summary.includes('NEVER_EMIT_SECRET'));assert(!summary.includes('private draft'));assert(!summary.includes(state.accounts[0].id));
        faults.set(p,null);await p.locator('#cloudRefresh').click();await ready(p);
      }
      check('read/auth/database/compatibility faults recover with retained drafts at '+width+'px');
      faults.set(p,'lost');await p.locator('[data-view="workout"]').click();await p.locator('#saveSetBtn').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='OUTCOME_UNKNOWN');
      const committed=await repos[0].load(),original=packets.get(p).at(-1);assert(f.lifecycle.equalRows(committed.rows,original.next));assert.equal(BigInt(committed.revision),BigInt(before.revision)+1n);
      await p.locator('[data-view="data"]').click();await p.locator('#cloudConnect').click();assert.equal(await p.locator('#fNotes').inputValue(),'  retained private draft\n');assert.equal(await p.evaluate(()=>cloudController.getStatus().phase),'OUTCOME_UNKNOWN');
      await p.locator('#cloudRetry').click();await ready(p);assert.deepEqual(packets.get(p).at(-1),original);assert.equal((await repos[0].load()).revision,committed.revision);assert(f.lifecycle.equalRows((await repos[0].load()).rows,committed.rows));
      await p.locator('#previewCloud > details').evaluate(e=>e.open=true);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(await p.evaluate(()=>[workoutReads,workoutWrites]),[0,0]);
      await p.screenshot({path:path.join(root,'test-results','issue42-signed-'+width+'.png'),fullPage:true});check('initial-load, four refresh faults and real committed lost-ack exact retry at '+width+'px');
    }
    const other=await open(390),latest=await repos[0].load();await page.locator('#cloudRefresh').click();await page.waitForFunction(r=>cloudController.getStatus().phase==='READY'&&cloudController.getStatus().revision===r,latest.revision);
    await page.evaluate(id=>workoutActions.logSet({date:'2026-10-31',exercise:id,weight:0,reps:8,sessionId:null}),latest.document.catalog.exercises[0].id);
    const winner=await repos[0].load();const stale=await other.evaluate(id=>workoutActions.logSet({date:'2026-10-31',exercise:id,weight:0,reps:9,sessionId:null}),latest.document.catalog.exercises[0].id);assert.equal(stale.code,'CONFLICT');assert(f.lifecycle.equalRows((await repos[0].load()).rows,winner.rows));
    await other.locator('#cloudRefresh').click();await ready(other);check('two independent signed contexts reject stale write and deliberately refresh');
    faults.set(other,'account');await other.locator('#accountRefresh').click();await other.waitForFunction(()=>!cloudReady);assert.match(await other.locator('#cloudStatus').textContent(),/account session/);
    faults.set(other,null);await other.locator('#accountRefresh').click();await ready(other);check('failed signed account verification pauses controls and explicit reauthentication recovers');
    const foreign=await open(390,1);assert.equal(await foreign.evaluate(()=>cloudController.getSnapshot().status),'uninitialized');assert.equal((await repos[1].load()).rows.sets.length,0);check('independently signed second owner sees no first-owner workouts');
    assert.deepEqual(errors,[]);check('zero unexpected console errors or network destinations; injected faults identified separately');
    fs.writeFileSync(path.join(root,'test-results','issue42-signed-preview.json'),JSON.stringify({sha,preview,project:config.projectRef,appVersion:f.get('APP_VERSION.version'),browser:browser.version(),checks,expectedInjectedFailures:expectedFailures.length,unexpectedErrors:errors},null,2));
  } finally {for(const c of contexts)await c.close();await browser.close();for(const c of clients)await c.auth.signOut({scope:'local'});}
}
if(require.main===module)main().catch(error=>{const line=/verify-issue42-signed-preview\.cjs:(\d+):/.exec(error.stack??'')?.[1]??'unknown';console.error('Signed #42 Preview verification failed at harness line '+line+'; private response and credentials withheld. No success claimed.');process.exitCode=1;});
