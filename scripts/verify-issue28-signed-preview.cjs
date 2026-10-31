// Actual signed synthetic users and exact protected normal-app Preview assets.
// Credentials stay in operator memory / disposable browser contexts, never logs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {read,preview,guard}=require('./issue28-preview.cjs');
const {sdk,validate}=require('./issue28-staging-fixtures.cjs');
const {setup}=require('../tests/lifecycle-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function downloadText(download){const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);return Buffer.concat(chunks).toString();}
async function main(){
  if(process.argv.length!==2)throw Error('No arbitrary flags.');const sha=guard();
  const state=validate(JSON.parse(fs.readFileSync(path.join(root,'.env.issue28-fixtures.json'),'utf8'))),config=JSON.parse(await read('/api/workout-config'));
  assert(config.enabled&&config.configured&&config.syntheticOnly);assert.equal(config.fixtureTag,state.tag);assert.deepEqual(config.allowedOwners,state.accounts.map(a=>a.id));
  const f=await setup();for(const file of ['workout-migration.js'])f.get(fs.readFileSync(path.join(root,file),'utf8'));
  const clients=[],repos=[],cache=new Map(),checks=[],errors=[],faults=[];
  for(const account of state.accounts){
    const client=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const signed=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!signed.error);assert.equal(signed.data.user.id,account.id);assert.equal(signed.data.user.is_anonymous,false);
    clients.push(client);repos.push(f.lifecycle.createRepository({client,ownerId:account.id}));
  }
  for(const file of ['index.html','app-version.js','app.js','guided-ui.js','cloud-ui.js','account-access.js','workout-cloud.js','workout-migration.js','workout-repository.js','workout-lifecycle.js','workout-lifecycle-panel.js','storage.js']){
    const body=await read('/'+file);let comparable=body.toString().replaceAll('\r\n','\n');
    if(file==='index.html') {const toolbar=comparable.match(/<script\b[^>]*src=["']https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js["'][^>]*><\/script>/g)??[];assert.equal(toolbar.length,1,'only the identified provider toolbar may be excluded');comparable=comparable.replace(toolbar[0],'');}
    assert.equal(comparable,fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));cache.set('/'+file,Promise.resolve(body));
  }
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),contexts=[];
  const upload=(p,selector,name,text)=>p.locator(selector).setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
  const ready=p=>p.waitForFunction(()=>cloudController?.getStatus().phase==='READY');
  const status=(p,text)=>p.waitForFunction(text=>document.getElementById('cloudStatus').textContent.includes(text),text);
  function check(name){checks.push(name);fs.writeFileSync(path.join(root,'test-results/issue28-signed-progress.json'),JSON.stringify({sha,checks},null,2));console.log(name+' PASS');}
  let loseFor=null;
  async function open(width,index=0){
    const account=state.accounts[index],login=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});clients.push(login);
    const signed=await login.auth.signInWithPassword({email:account.email,password:account.password});assert(!signed.error);assert.equal(signed.data.user.id,account.id);const session=signed.data.session;

    const context=await browser.newContext({viewport:{width,height:844}});contexts.push(context);const page=await context.newPage();
    await context.addInitScript(({session,key})=>{
      localStorage.setItem(key,JSON.stringify(session));window.workoutReads=0;window.workoutWrites=0;
      const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
      Storage.prototype.getItem=function(k){if(k==='daveGymTrackerV1')window.workoutReads++;return get.call(this,k);};
      Storage.prototype.setItem=function(k,v){if(k==='daveGymTrackerV1')window.workoutWrites++;return set.call(this,k,v);};
    },{session,key:'gymbro-account-auth-'+config.projectRef});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{
      if(!['warning','error'].includes(m.type()))return;
      if(faults.some(x=>x.page===page&&m.location().url===x.url)&&/net::ERR_FAILED/.test(m.text()))return;
      errors.push(m.text());
    });
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin===config.url){
        if(loseFor===page&&url.pathname==='/rest/v1/rpc/gymbro_workout_mutate'){
          loseFor=null;const response=await route.fetch();assert(response.ok());faults.push({page,url:req.url()});return route.abort('failed');
        }
        return route.continue();
      }
      if(url.origin==='https://vercel.live'&&req.method()==='GET')return route.continue();
      if(url.origin!==preview||req.method()!=='GET'){errors.push('Unexpected network destination/method');return route.abort();}
      if(!cache.has(url.pathname))cache.set(url.pathname,read(url.pathname+url.search));
      const body=await cache.get(url.pathname);
      return route.fulfill({body,contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.startsWith('/api/')?'application/json':url.pathname.endsWith('.png')?'image/png':'text/html'});
    });
    page.on('dialog',d=>d.accept());await page.goto(preview+'/?storage=cloud');
    await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');
    await page.locator('#cloudConnect').click();try{await page.waitForFunction(()=>!!cloudController);}catch(error){const diagnostic=await page.evaluate(()=>({accountStatus:document.getElementById('accountStatus')?.textContent,cloudStatus:document.getElementById('cloudStatus')?.textContent}));fs.writeFileSync(path.join(root,'test-results/issue28-connect-failure.json'),JSON.stringify({width,diagnostic,errors},null,2));throw error;}return page;
  }
  try{
    const initial=await repos[0].load();assert(['uninitialized','healthy'].includes(initial.status));
    f.source.extension.previewMigrationFixture=state.tag;const source=JSON.stringify(f.source),candidate=await f.get('WorkoutMigration').prepareSource(source,state.accounts[0].id);
    if(initial.status==='healthy')assert(f.get('WorkoutMigration').compare(candidate,initial,state.accounts[0].id).pass,'Existing fixture must exactly match the selected canonical source; no automatic reset.');
    const expectedInitialRevision=initial.status==='uninitialized'?String(BigInt(initial.revision)+1n):initial.revision;
    const page=await open(1280);
    await upload(page,'#migrationFile','synthetic-complete-source.json',source);await page.locator('#migrationReview').click();await page.waitForFunction(()=>!document.getElementById('migrationCommit').disabled);
    await page.locator('#migrationCommit').click();await status(page,'Migration verified');
    let saved=await repos[0].load();assert(f.get('WorkoutMigration').compare(candidate,saved,state.accounts[0].id).pass);assert.equal(saved.revision,expectedInitialRevision);
    const reportDownload=page.waitForEvent('download');await page.locator('#migrationReport').click();const report=JSON.parse(await downloadText(await reportDownload));assert(report.pass&&report.tables.length===16);
    await page.locator('#migrationReview').click();await page.locator('#migrationCommit').click();await status(page,'Migration verified');assert.equal((await repos[0].load()).revision,expectedInitialRevision);
    check('complete actual SQL migration/readback and exact canonical rerun no-op');
    assert.equal(await page.locator('#importFile').isVisible(),false,'local restore controls stay hidden despite grid CSS');
    for(const view of ['dashboard','program','workout','history','inbox','exercises','data'])await page.locator('[data-view="'+view+'"]').click();
    const taxonomy=await page.locator('#taxonomySummary').textContent();assert(taxonomy.includes('Bench Press'));assert(!taxonomy.includes(candidate.document.catalog.exercises[0].id));
    await page.locator('[data-view="workout"]').click();await page.locator('#bwDate').fill('2026-10-28');await page.locator('#bwValue').fill('201');await page.evaluate(()=>addBodyweight());
    await page.locator('#sessionNote').fill('signed session note');await page.evaluate(()=>saveNoteEditor('sessionNote'));
    await page.locator('#occurrenceNote').fill('signed planned occurrence');await page.evaluate(()=>saveNoteEditor('occurrenceNote'));
    const manualTarget=await page.locator('#noteOccurrence option').evaluateAll(options=>options.find(o=>JSON.parse(o.value).planSlotId===null).value);await page.locator('#noteOccurrence').selectOption(manualTarget);await page.locator('#occurrenceNote').fill('signed manual occurrence');await page.evaluate(()=>saveNoteEditor('occurrenceNote'));
    await page.locator('[data-view="exercises"]').click();await page.evaluate(id=>showExercise(id),candidate.document.catalog.exercises[0].id);await page.locator('#setupNote').fill('signed durable setup');await page.evaluate(()=>saveNoteEditor('setupNote'));
    saved=await repos[0].load();assert(saved.document.data.noteScopes.exerciseSession.some(n=>n.text==='signed planned occurrence'&&n.planSlotId));assert(saved.document.data.noteScopes.exerciseSession.some(n=>n.text==='signed manual occurrence'&&n.planSlotId===null));assert(saved.document.data.noteScopes.exercise.some(n=>n.text==='signed durable setup'));assert.deepEqual(saved.document.data.preferences,candidate.document.data.preferences);
    await page.locator('[data-view="program"]').click();await page.evaluate(async()=>{await toggleShort('push',0);await cycleRole('push',0);editTemplate('push');});
    const slotCount=(await repos[0].load()).document.data.program.templates.find(t=>t.id==='push').slots.length;await page.locator('#addEx_push').fill('Signed synthetic program exercise');await page.evaluate(()=>addSlot('push'));
    saved=await repos[0].load();const added=saved.document.data.program.templates.find(t=>t.id==='push').slots.at(-1);assert.equal(f.identity.resolveLabel(saved.document.catalog,'Signed synthetic program exercise'),added.exercise.exerciseId);
    await page.evaluate(index=>removeSlot('push',index),slotCount);assert.equal((await repos[0].load()).document.data.program.templates.find(t=>t.id==='push').slots.length,slotCount);
    saved=await repos[0].load();assert.equal(saved.document.data.sessions[0].planSnapshot.slots[0].role,candidate.document.data.sessions[0].planSnapshot.slots[0].role);
    await page.locator('[data-view="workout"]').click();await page.evaluate(()=>logCurrentExercise());await page.locator('#fWeight').fill('12');await page.locator('#fReps').fill('8');await page.locator('#saveSetBtn').click();await ready(page);
    saved=await repos[0].load();const last=saved.document.data.sets.at(-1);assert.equal(last.sessionId,f.sessionId);assert.equal(last.planSlotId,'slot-1');
    await page.evaluate(id=>editSet(id),last.id);await page.locator('#fNotes').fill('signed correction');await page.locator('#saveSetBtn').click();await ready(page);
    assert.equal((await repos[0].load()).document.data.sets.at(-1).notes,'signed correction');await page.evaluate(id=>deleteSet(id),last.id);
    saved=await repos[0].load();assert(!saved.document.data.sets.some(s=>s.id===last.id));assert(saved.document.data.sessions[0].guided.requests.some(r=>r.setId===last.id));
    await page.locator('[data-view="inbox"]').click();await page.locator('#inboxRaw').fill(JSON.stringify({schema:'gym-tracker-chatgpt-v1',importId:'signed-preview-import',date:'2026-10-28',exercises:[{exercise:'Signed synthetic import label',sets:[{weight:0,unit:'bodyweight',reps:7,notes:'exact signed import'}]},{exercise:'Excluded synthetic label',sets:[{weight:1,unit:'lb',reps:5}]}]}));
    await page.evaluate(()=>parseInbox());await page.evaluate(()=>updateDraft(1,'include',false));await page.evaluate(()=>commitInbox());saved=await repos[0].load();assert(saved.document.data.imports.some(i=>i.importId==='signed-preview-import'&&i.setCount===1));assert.equal(f.identity.resolveLabel(saved.document.catalog,'Excluded synthetic label'),null);
    const count=saved.document.data.sets.length;await page.evaluate(()=>parseInbox());await page.evaluate(()=>commitInbox());assert.equal((await repos[0].load()).document.data.sets.length,count);
    check('seven-view normal app: bodyweight, all note scopes, template/catalog add/remove and immutable snapshot intent, guided log/correction/deletion, canonical import/exclusion/repeat');
    for(const width of [1280,390,320]){
      const p=width===1280?page:await open(width);await p.locator('[data-view="workout"]').click();await p.evaluate(()=>useManualLogging());
      const before=await repos[0].load(),id=before.document.catalog.exercises[0].id;
      await p.locator('#fExercise').selectOption(id);await p.locator('#fDate').fill('2026-10-28');await p.locator('#fWeight').fill('0');await p.locator('#fReps').fill('7');await p.locator('#fNotes').fill('  signed retained draft\n');
      loseFor=p;await p.locator('#saveSetBtn').click();await status(p,'confirmation was lost');assert.equal(await p.locator('#fNotes').inputValue(),'  signed retained draft\n');
      await p.locator('[data-view="data"]').click();await p.locator('#cloudRetry').click();await status(p,'REPLAY');
      const after=await repos[0].load();assert.equal(after.document.data.sets.length,before.document.data.sets.length+1);assert.equal(after.document.data.sets.at(-1).notes,'  signed retained draft\n');
      assert.equal(BigInt(after.revision),BigInt(before.revision)+1n);assert.deepEqual(await p.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.screenshot({path:path.join(root,'test-results','issue28-signed-'+width+'.png'),fullPage:true});
      check('real commit/lost acknowledgement/exact retry, retained draft and zero local workout access at '+width+'px');
    }
    const other=await open(390),current=await repos[0].load(),id=current.document.catalog.exercises[0].id;
    await page.locator('#cloudRefresh').click();await page.waitForFunction(revision=>cloudController.getStatus().revision===revision,current.revision);
    const winning=await page.evaluate(async id=>workoutActions.logSet({date:'2026-10-28',exercise:id,weight:0,reps:8,sessionId:null}),id);assert(winning.ok,winning.code);
    const winner=await repos[0].load();await other.locator('[data-view="workout"]').click();await other.locator('#fExercise').selectOption(id);await other.locator('#fDate').fill('2026-10-28');await other.locator('#fWeight').fill('0');await other.locator('#fReps').fill('9');await other.locator('#fNotes').fill('signed stale draft');
    await other.locator('#saveSetBtn').click();await other.waitForFunction(()=>cloudController.getStatus().phase==='CONFLICT');assert.equal(await other.locator('#fNotes').inputValue(),'signed stale draft');
    assert(f.lifecycle.equalRows((await repos[0].load()).rows,winner.rows));await other.locator('[data-view="data"]').click();await other.locator('#cloudRefresh').click();await ready(other);assert.equal(await other.locator('#fNotes').inputValue(),'signed stale draft');
    check('independent signed same-owner context rejects stale write, retains draft and refreshes without retry');
    await page.locator('#cloudRefresh').click();await ready(page);const backupEvent=page.waitForEvent('download');await page.locator('#cloudLifecycle [data-export]').click();const text=await downloadText(await backupEvent),backup=JSON.parse(text);
    for(const [kind,name]of [['legacy','gymbro-legacy-compatibility.json'],['csv','gymbro-sets.csv']]){
      const event=page.waitForEvent('download');await page.locator('#cloudLifecycle [data-'+kind+']').click();const file=await event,value=await downloadText(file);assert.equal(file.suggestedFilename(),name);
      if(kind==='legacy'){const parsed=JSON.parse(value),source=f.identity.restoreV2Source((await repos[0].load()).document);for(const field of ['sets','sessions','bodyweights','program','exerciseLibrary','preferences','noteScopes','imports'])assert.deepEqual(JSON.parse(JSON.stringify(parsed[field])),JSON.parse(JSON.stringify(source[field])));}
      else {assert(value.startsWith('date,exercise,weight,unit,reps'));assert(value.includes('Bench Press'));}
    }
    const directCSVEvent=page.waitForEvent('download');await page.evaluate(()=>exportCSV());const directCSV=await downloadText(await directCSVEvent);assert(directCSV.includes('Bench Press'));for(const exercise of (await repos[0].load()).document.catalog.exercises)assert(!directCSV.includes(exercise.id));
    check('cloud-authority legacy complete JSON and both sets-only CSV paths preserve accepted labels and compatibility');
    const restored=structuredClone(backup);restored.payload.document.data.sets[0].notes='signed whole restore';
    await upload(page,'#cloudLifecycle [data-incoming]','synthetic-restore.json',JSON.stringify(restored));await page.locator('#cloudLifecycle [data-review]').click();await page.waitForFunction(()=>!document.querySelector('#cloudLifecycle [data-commit]').disabled);
    await upload(page,'#cloudLifecycle [data-safety]','verified-current.json',text);await page.locator('#cloudLifecycle [data-verify]').click();await page.waitForFunction(()=>document.querySelector('#cloudLifecycle [data-status]').textContent.includes('verified'));
    await page.locator('#cloudLifecycle [data-commit]').click();await ready(page);saved=await repos[0].load();
    assert(f.lifecycle.equalRows(saved.rows,f.repository.project(restored.payload.document,state.accounts[0].id,restored.payload.bodyweightIds,restored.payload.signatureSchemes)));
    const merge=structuredClone(restored),record=merge.payload.document.data.sets.find(s=>s.sessionId==null);merge.payload.document.data.sets.push({...record,id:'signed-merge-history'});merge.payload.document.data.preferences.unwanted='not imported';
    await page.locator('#cloudLifecycle [data-mode]').selectOption('merge');await upload(page,'#cloudLifecycle [data-incoming]','synthetic-merge.json',JSON.stringify(merge));await page.locator('#cloudLifecycle [data-review]').click();await page.waitForFunction(()=>!document.querySelector('#cloudLifecycle [data-commit]').disabled);await page.locator('#cloudLifecycle [data-commit]').click();await ready(page);
    saved=await repos[0].load();assert(saved.document.data.sets.some(s=>s.id==='signed-merge-history'));assert.equal(saved.document.data.preferences.unwanted,undefined);
    check('normal-app complete export, reopened safety file, full-content confirmed restore and settings-preserving merge');
    await page.locator('[data-view="workout"]').click();await page.evaluate(()=>guidedCommand('finish'));await ready(page);assert.equal((await repos[0].load()).document.data.activeSessionId,null);
    await page.evaluate(()=>useManualLogging());await page.locator('#fExercise').selectOption(id);await page.locator('#fDate').fill('2026-10-28');await page.locator('#fWeight').fill('0');await page.locator('#fReps').fill('6');await page.locator('#saveSetBtn').click();await ready(page);
    assert.equal((await repos[0].load()).document.data.sets.at(-1).sessionId??null,null);
    await page.locator('#guidedTemplate').selectOption('push');await page.locator('#guidedDuration').selectOption('30');await page.locator('#guidedDate').fill('2026-10-28');await page.evaluate(()=>startGuidedWorkout());await ready(page);
    const newSession=(await repos[0].load()).document.data.activeSessionId;assert(newSession&&newSession!==f.sessionId);
    const command=async(name,value)=>{await page.waitForFunction(()=>Date.now()>=guidedActionUntil);await page.evaluate(({name,value})=>guidedCommand(name,value),{name,value});await ready(page);};
    await command('status','completed');await command('move','next');
    const planned=await page.evaluate(()=>workoutActions.getGuidedWorkoutState().currentExercise.plannedExercise);
    const substitute=(await repos[0].load()).document.catalog.exercises.find(e=>e.id!==planned).id;await page.locator('#guidedSubstitute').selectOption(substitute);await command('substitute');await command('status','skipped');
    assert.equal(await page.evaluate(()=>workoutActions.getGuidedWorkoutState().currentExercise.plannedExercise),planned);assert.equal(await page.evaluate(()=>workoutActions.getGuidedWorkoutState().currentExercise.actualExercise),substitute);
    check('explicit finish, sessionless manual fallback, new 30-minute session, navigation/Done/Skip and session-local substitution preserve plan intent');
    const foreign=await clients[1].from('gymbro_sets').select('*').eq('owner_id',state.accounts[0].id);assert(!foreign.error);assert.equal(foreign.data.length,0);
    const denied=await clients[1].from('gymbro_sets').insert(saved.rows.sets[0]);assert(denied.error);assert.equal((await repos[1].load()).status,'uninitialized');
    check('real signed cross-owner read isolation and direct-DML rejection');
    await page.reload();await page.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');await page.locator('#cloudConnect').click();await page.waitForFunction(()=>cloudReady);
    assert.equal(await page.evaluate(()=>db.activeSessionId),newSession);assert.deepEqual(await page.evaluate(()=>[window.workoutReads,window.workoutWrites]),[0,0]);
    await page.locator('#accountSignOut').click();await page.waitForFunction(()=>cloudController===null);assert.equal(await page.locator('#fNotes').inputValue(),'');
    check('actual account restoration/reload retains active workout; sign-out clears prior-owner view');
    assert.equal(faults.length,3);assert.deepEqual(errors,[]);
    const result={sha,build:backup.appVersion,preview,project:config.projectRef,checks,expectedNetworkFaults:faults.length,unexpectedConsoleErrors:errors.length,physicalSafari:'not tested',personalMigration:'not performed'};
    fs.writeFileSync(path.join(root,'test-results','issue28-signed-preview.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();for(const client of clients)await client.auth.signOut({scope:'local'});}
}
if(require.main===module)main().catch(error=>{fs.writeFileSync(path.join(root,'test-results/issue28-signed-failure.txt'),String(error.stack??error));console.error('Signed #28 verification failed; no success claimed. Private account/token details withheld.');process.exitCode=1;});
