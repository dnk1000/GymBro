// Operator-only actual signed SDK/Preview verification, no mocked Auth/SQL.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {chromium}=require('playwright-core');
const {sdk,validate,project}=require('./issue40-staging-fixtures.cjs');
const {commandsFor}=require('./preview-db.cjs');
const {read,preview}=require('./verify-preview-concurrency-ui.cjs');
const {fixture}=require('../tests/relational-fixture.cjs');
const {storage}=require('../tests/protocol-fixture.cjs');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'test-results');
const pause=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const status=p=>p.locator('#status').textContent();
const waitStatus=(p,text)=>p.waitForFunction(s=>document.getElementById('status').textContent.startsWith(s),text);
const saved=async p=>JSON.parse(await p.locator('#saved').textContent());
async function setAction(p,name,args) {await p.locator('#action').selectOption(name);await p.locator('#arguments').fill(JSON.stringify(args,null,2));}
async function main() {
  if(process.argv.length!==2)throw Error('No arbitrary test flags supported.');
  const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();commandsFor('apply',process.env,revision);
  if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit reviewed test code first.');
  const state=validate(JSON.parse(fs.readFileSync(path.join(root,'.env.issue40-fixtures.json'),'utf8')));assert.equal(state.status,'ready');
  const config=JSON.parse((await read('/api/concurrency-config')).toString());
  assert.equal(config.enabled,true);assert.equal(config.configured,true);assert.equal(config.projectRef,project);assert.equal(config.fixtureTag,state.tag);
  assert.deepEqual(config.allowedOwners,state.accounts.map(a=>a.id));assert(config.publishableKey.startsWith('sb_publishable_'));
  const f=await fixture(),clients=[],repos=[];
  for(const a of state.accounts) {
    const client=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const signed=await client.auth.signInWithPassword({email:a.email,password:a.password});assert(!signed.error,'real permanent fixture sign-in');assert.equal(signed.data.user.id,a.id);assert.equal(signed.data.user.is_anonymous,false);
    clients.push(client);repos.push(f.repository.create({client,ownerId:a.id}));
  }
  const exercise=f.identity.resolveLabel(f.document.catalog,'Bench Press');
  const log=note=>({date:'2026-10-30',exercise,weight:0,reps:8,rir:0,complete:false,notes:note,sessionId:null});
  const nodeWrite=async(note,index=0)=> {
    const initial=await repos[index].load();const controller=f.repository.createActions({initial,repository:repos[index],recoveryStorage:storage(),createId:()=> 'issue40-signed-'+randomUUID()});
    const result=await controller.execute('logSet',log(note));assert.equal(result.code,'OK');return result;
  };
  const cache=new Map();
  for(const file of ['concurrency-test.html','app-version.js','workout-concurrency.js','workout-repository.js','concurrency-test.js']) {
    const body=await read('/'+file);cache.set('/'+file,body);
    if(file.endsWith('.js'))assert.equal(body.toString().replace(/\r\n/g,'\n'),fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),'exact deployed '+file);
  }
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const pages=[],errors=[],checks=[];let expectedAborts=0,observedAborts=0,receiptPacket;
  async function open(index,width=390) {
    const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
    const control={context,page,index,packets:[],intercept:null};pages.push(control);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(['error','warning'].includes(m.type())) {
      if(m.text()==='Failed to load resource: net::ERR_FAILED'&&observedAborts<expectedAborts){observedAborts++;return;}
      errors.push(m.text());
    }});
    await context.addInitScript(()=>{window.normalWorkoutReads=0;const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.normalWorkoutReads++;return get.call(this,k);};});
    await context.route('**/*',async route=> {
      const req=route.request(),url=new URL(req.url());
      if(url.origin===config.url) {
        if(url.pathname==='/rest/v1/rpc/gymbro_workout_mutate')control.packets.push(req.postDataJSON().packet);
        if(control.intercept&&await control.intercept(route,url))return;
        return route.continue();
      }
      if(url.origin==='https://vercel.live'&&req.method()==='GET')return route.continue();
      if(url.origin!==preview||req.method()!=='GET'){errors.push('Unexpected network destination/method');return route.abort();}
      try {
        const resource=url.pathname+url.search;let body=cache.get(resource);if(!body){body=await read(resource);cache.set(resource,body);}
        await route.fulfill({body,contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.startsWith('/api/')?'application/json':'text/html'});
      }catch{errors.push('Preview resource failed');await route.abort();}
    });
    await page.goto(preview+'/concurrency-test.html');await page.waitForFunction(()=>!document.getElementById('access').disabled);
    await signIn(page,index);return control;
  }
  async function signIn(page,index) {
    await page.locator('#email').fill(state.accounts[index].email);await page.locator('#password').fill(state.accounts[index].password);await page.locator('#signIn').click();
    await page.waitForFunction(()=>!document.getElementById('mutation').disabled);assert.equal(await page.locator('#password').inputValue(),'');
  }
  const add=(name,data={})=>{checks.push({name,result:'PASS',...data});console.log('Signed Preview PASS: '+name);};
  try {
    const a=await open(0,1280),b=await open(0,390),other=await open(1,320);
    const initial=await repos[0].load(),session=initial.document.data.sessions.find(s=>s.status==='active');
    if(session) {
      await setAction(a.page,'finishGuidedSession',[{sessionId:session.id,expectedRevision:session.guided.revision,allowPending:true}]);await a.page.locator('#submit').click();await waitStatus(a.page,'Saved.');
    } else {await nodeWrite('fixture continuation');await a.page.locator('#refresh').click();}
    const draft=JSON.stringify([log('  stale exact\n')],null,2);await b.page.locator('#arguments').fill(draft);await b.page.locator('#submit').click();await waitStatus(b.page,'Another tab or device');
    assert.equal(await b.page.locator('#arguments').inputValue(),draft);assert(await b.page.locator('#submit').isDisabled());
    await b.page.locator('#refresh').click();await b.page.waitForFunction(()=>!document.getElementById('submit').disabled);assert.equal(await b.page.locator('#arguments').inputValue(),draft);
    add('same-owner signed contexts conflict; explicit refresh preserves zero/false/notes/target');
    const start={date:'2026-10-30',templateId:'push',duration:60};await setAction(a.page,'createSession',[start]);await setAction(b.page,'createSession',[start]);
    const arrivals=[pause(),pause()],release=pause();
    [a,b].forEach((c,i)=>{c.intercept=async(route,url)=>{if(url.pathname.endsWith('/gymbro_workout_mutate')){c.intercept=null;arrivals[i].resolve();await release.promise;await route.continue();return true;}return false;};});
    await Promise.all([a.page.locator('#submit').click(),b.page.locator('#submit').click()]);await Promise.all(arrivals.map(x=>x.promise));release.resolve();
    await Promise.all([a.page.waitForFunction(()=>!document.getElementById('status').textContent.startsWith('A save is awaiting')),b.page.waitForFunction(()=>!document.getElementById('status').textContent.startsWith('A save is awaiting'))]);
    assert.deepEqual([await status(a.page),await status(b.page)].map(s=>s.startsWith('Saved.')?'OK':s.startsWith('Another tab or device')?'CONFLICT':s).sort(),['CONFLICT','OK']);
    const started=await repos[0].load();assert.equal(started.document.data.sessions.filter(s=>s.status==='active').length,1);
    add('simultaneous real signed browser starts yield one OK, one CONFLICT and one active session');
    for(const c of [a,b]){await c.page.locator('#refresh').click();await c.page.waitForFunction(()=>!document.getElementById('submit').disabled);}
    for(const width of [1280,390,320]) {
      const c=await open(0,width),p=c.page,before=await repos[0].load(),text=JSON.stringify([log('  signed width '+width+'\n')],null,2);
      await setAction(p,'logSet',[log('  signed width '+width+'\n')]);await p.locator('#loseAcknowledgement').check();await p.locator('#submit').click();await waitStatus(p,'Save confirmation was lost.');
      assert.equal(await p.locator('#arguments').inputValue(),text);assert(await p.locator('#submit').isDisabled());
      const marker=await p.evaluate(()=>JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(k=>k.startsWith('gymbro-request-recovery-')))));assert.deepEqual(Object.keys(marker).sort(),['operation','ownerId','protocolVersion']);
      const committed=await repos[0].load();assert.equal(committed.revision,(BigInt(before.revision)+1n).toString());
      await p.screenshot({path:path.join(dir,'signed-preview-unknown-'+width+'.png'),fullPage:true});
      await p.locator('#arguments').fill(text+'\n');await p.locator('#retry').click();await waitStatus(p,'Original request confirmed.');
      assert.equal(await p.locator('#arguments').inputValue(),text+'\n');assert.deepEqual(c.packets[0],c.packets[1]);
      const after=await repos[0].load(),id=c.packets[0].result.setId;assert.equal(after.revision,committed.revision);assert.equal(after.document.data.sets.filter(s=>s.id===id).length,1);
      receiptPacket??=c.packets[0];
      const receipt=await clients[0].from('gymbro_mutation_receipts').select('operation,status,committed_revision');assert(!receipt.error);assert.equal(receipt.data.filter(r=>JSON.stringify(r.operation)===JSON.stringify(c.packets[0].operation)).length,1);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.evaluate(()=>window.normalWorkoutReads),0);
      add('real committed lost acknowledgement and exact retry at '+width+'px',{revision:after.revision,oneFact:true,oneReceipt:true,build:await p.locator('#build').textContent()});
    }
    const c=await open(0,390),p=c.page;
    await setAction(p,'logSet',[log('reload resolution')]);await p.locator('#loseAcknowledgement').check();await p.locator('#submit').click();await waitStatus(p,'Save confirmation was lost.');const reloadRevision=(await repos[0].load()).revision;
    await p.reload();await p.waitForFunction(()=>!document.getElementById('access').disabled);await p.locator('#connect').click();await p.waitForFunction(()=>!document.getElementById('mutation').disabled);assert(await p.locator('#submit').isDisabled());
    await p.locator('#resolve').click();await waitStatus(p,'Original request confirmed.');assert.equal((await repos[0].load()).revision,reloadRevision);add('real reload resolves durable committed receipt');
    let late;const beforeCancel=(await repos[0].load()).revision;
    c.intercept=async(route,url)=>{if(url.pathname.endsWith('/gymbro_workout_mutate')){c.intercept=null;late=route.request().postDataJSON().packet;expectedAborts++;await route.abort();return true;}return false;};
    await setAction(p,'logSet',[log('cancel before late arrival')]);await p.locator('#submit').click();await waitStatus(p,'Save confirmation was lost.');await p.locator('#resolve').click();await waitStatus(p,'The unresolved submission did not commit and was cancelled.');
    const lateReply=await clients[0].rpc('gymbro_workout_mutate',{packet:late});assert(!lateReply.error);assert.equal(lateReply.data.code,'CANCELLED');assert.equal((await repos[0].load()).revision,beforeCancel);add('Preview cancellation fences a late exact original without workout writes');
    await setAction(p,'logSet',[log('delayed acknowledgement')]);await p.locator('#delayAcknowledgement').check();const response=p.waitForResponse(r=>r.url().endsWith('/gymbro_workout_mutate'));
    await p.locator('#submit').click();await waitStatus(p,'A save is awaiting');await response;await p.screenshot({path:path.join(dir,'signed-preview-pending.png'),fullPage:true});
    await nodeWrite('newer transaction while acknowledgement is held');const newest=(await repos[0].load()).revision;await p.locator('#refresh').click();await p.waitForFunction(rev=>JSON.parse(document.getElementById('saved').textContent).revision===rev,newest);await waitStatus(p,'Saved.');assert.equal((await saved(p)).revision,newest);add('delayed real acknowledgement cannot regress a newer saved refresh');
    const held=pause(),loaded=pause();c.intercept=async(route,url)=>{if(url.pathname.endsWith('/gymbro_workout_snapshot')){c.intercept=null;const response=await route.fetch();loaded.resolve();await held.promise;await route.fulfill({response});return true;}return false;};
    await p.locator('#refresh').click();await loaded.promise;await nodeWrite('another real context changes old refresh base');await setAction(p,'logSet',[log('retained after stale refresh')]);const staleDraft=await p.locator('#arguments').inputValue();await p.locator('#submit').click();await waitStatus(p,'Another tab or device');held.resolve();await p.waitForTimeout(150);assert(await p.locator('#submit').isDisabled());assert.equal(await p.locator('#arguments').inputValue(),staleDraft);await p.screenshot({path:path.join(dir,'signed-preview-conflict.png'),fullPage:true});
    await p.locator('#refresh').click();await p.waitForFunction(()=>!document.getElementById('submit').disabled);add('held older real refresh cannot clear a newer conflict or its exact draft');
    const importDraft=JSON.stringify([{importId:'signed-reviewed-'+randomUUID(),date:'2026-10-30',duration:30,template:'synthetic',sessionNotes:'  retained\n',bodyweight:null,sets:[{include:true,exercise,weight:0,reps:8,unit:'lb',rir:0,rpe:null,pain:0,painArea:'',notes:'  import\n',complete:false},{include:false,exercise:'unresolved'}]}],null,2);
    await nodeWrite('make reviewed import stale');await p.locator('#action').selectOption('commitImport');await p.locator('#arguments').fill(importDraft);await p.locator('#submit').click();await waitStatus(p,'Another tab or device');assert.equal(await p.locator('#arguments').inputValue(),importDraft);add('real stale import keeps included/excluded choices and falsy/text values');
    await setAction(other.page,'logSet',[log('second-owner-private')]);await other.page.locator('#submit').click();await waitStatus(other.page,'Saved.');
    const ownerA=state.accounts[0].id,ownerB=state.accounts[1].id,securityBefore=(await repos[0].load()).revision;
    for(const table of ['gymbro_sets','gymbro_mutation_receipts','gymbro_workout_versions']){const result=await clients[0].from(table).select('*').eq('owner_id',ownerB);assert(!result.error);assert.equal(result.data.length,0);}
    for(const table of [...f.repository.tables.map(t=>'gymbro_'+t),'gymbro_exercises','gymbro_exercise_aliases','gymbro_mutation_receipts','gymbro_workout_versions']) {
      const denied=await clients[0].from(table).insert({owner_id:ownerA});assert.equal(denied.error?.code,'42501','signed direct INSERT denied: '+table);
    }
    assert.equal((await clients[0].from('gymbro_sets').update({notes:'forbidden'}).eq('owner_id',ownerA)).error?.code,'42501');
    assert.equal((await clients[0].from('gymbro_sets').delete().eq('owner_id',ownerA)).error?.code,'42501');
    assert.equal((await clients[0].rpc('gymbro_workout_commit',{previous_rows:null,next_rows:null})).error?.code,'42501');
    const anonymous=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});assert.equal((await anonymous.rpc('gymbro_workout_snapshot')).error?.code,'42501');
    const captured=receiptPacket;
    assert.equal((await clients[0].rpc('gymbro_workout_mutate',{packet:{...captured,ownerId:ownerB}})).error?.code,'23514');
    assert.equal((await clients[0].rpc('gymbro_workout_mutate',{packet:{...captured,operation:[]}})).error?.code,'23514');
    const changed=structuredClone(captured);changed.args[0].notes='altered under original key';assert.equal((await clients[0].rpc('gymbro_workout_mutate',{packet:changed})).data?.code,'REQUEST_CONFLICT');
    assert.equal((await repos[0].load()).revision,securityBefore);assert(!(await repos[0].load()).document.data.sets.some(s=>s.notes==='second-owner-private'));
    add('real signed cross-owner isolation, all-table DML denial, old RPC, anonymous and malformed/altered requests');
    const switchHeld=pause(),switchLoaded=pause();c.intercept=async(route,url)=>{if(url.pathname.endsWith('/gymbro_workout_snapshot')){c.intercept=null;const response=await route.fetch();switchLoaded.resolve();await switchHeld.promise;await route.fulfill({response});return true;}return false;};
    await p.locator('#connect').click();await switchLoaded.promise;await p.locator('#signOut').click();await signIn(p,1);const second=await repos[1].load();assert.equal((await saved(p)).revision,second.revision);switchHeld.resolve();await p.waitForTimeout(150);assert.equal((await saved(p)).revision,second.revision);assert((await saved(p)).workout.data.sets.some(s=>s.notes==='second-owner-private'));assert(!(await saved(p)).workout.data.sets.some(s=>s.notes==='newer transaction while acknowledgement is held'));
    add('actual account switch during held initial load cannot publish the previous owner');
    assert.deepEqual(errors,[]);assert.equal(observedAborts,expectedAborts);
    for(const x of pages)assert.equal(await x.page.evaluate(()=>window.normalWorkoutReads),0);
    fs.writeFileSync(path.join(dir,'signed-preview-concurrency.json'),JSON.stringify({preview,sourceRevision:revision,project,fixtureTag:state.tag,checks,unexpectedConsoleErrors:0,expectedInjectedNetworkErrors:observedAborts,normalWorkoutReads:0,realSignedSdk:true,authSqlMocks:false},null,2));
    console.log(JSON.stringify({sourceRevision:revision,checks:checks.length,unexpectedConsoleErrors:0,expectedInjectedNetworkErrors:observedAborts,realSignedSdk:true}));
  } finally {await browser.close();for(const client of clients)await client.auth.signOut({scope:'local'});}
}
if(require.main===module)main().catch(error=>{console.error('Signed Preview verification failed: '+error.message.slice(0,600));process.exitCode=1;});
