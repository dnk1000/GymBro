// Approved #18 disposable staging only; reuse #28 helpers and the real #40 path.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
process.env.GYMBRO_PREVIEW_VERIFICATION_ISSUE='18';
const {read,preview,guard}=require('./issue28-preview.cjs');
const {sdk,validate,project}=require('./issue28-staging-fixtures.cjs');
const {setup}=require('../tests/lifecycle-fixture.cjs'),{storage,plain}=require('../tests/protocol-fixture.cjs');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
async function main(){
  assert.equal(process.argv.length,2);const sha=guard(),state=validate(JSON.parse(fs.readFileSync(path.join(root,'.env.issue28-fixtures.json'),'utf8')));
  assert.equal(state.status,'ready');const config=JSON.parse(await read('/api/workout-config'));
  assert(config.enabled&&config.configured&&config.syntheticOnly);assert.equal(config.projectRef,project);assert.equal(config.fixtureTag,state.tag);assert.deepEqual(config.allowedOwners,state.accounts.map(a=>a.id));
  const f=await setup();for(const file of ['workout-migration.js','workout-cloud.js'])f.get(fs.readFileSync(path.join(root,file),'utf8'));
  const clients=[],repos=[],checks=[],errors=[],cache=new Map(),contexts=[];
  const check=name=>{checks.push(name);console.log(name+' PASS');fs.writeFileSync(path.join(root,'test-results/issue18-signed-progress.json'),JSON.stringify({sha,checks},null,2));};
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    for(const account of state.accounts){
      const client=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const signed=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!signed.error);assert.equal(signed.data.user.id,account.id);assert.equal(signed.data.user.is_anonymous,false);
      clients.push(client);const repo=f.lifecycle.createRepository({client,ownerId:account.id});repos.push(repo);
      const initial=await repo.load();assert.equal(initial.status,'uninitialized','never reseed a populated fixture');
      const source=structuredClone(f.source);source.extension.previewMigrationFixture=state.tag;f.get('ensureExercise')(source,'Rope Triceps Pushdown');
      const controller=f.get('WorkoutCloud').create({client,ownerId:account.id,initial,recoveryStorage:storage(),fixtureTag:state.tag});
      assert((await controller.execute('initializeMigration',{text:JSON.stringify(source),confirmed:true})).ok);
    }
    const owner=state.accounts[0].id,baseline=await repos[0].load(),target=f.identity.resolveLabel(baseline.document.catalog,'Rope Triceps Pushdown');assert(target);
    for(const file of ['index.html','app-version.js','app.js','cloud-ui.js','import-resolution.js','workout-cloud.js','exercise-identity.js','workout-repository.js','workout-concurrency.js','workout-data.js']){
      const body=await read('/'+file);let comparable=body.toString().replaceAll('\r\n','\n');
      if(file==='index.html')comparable=comparable.replace(/<script\b[^>]*src=["']https:\/\/vercel\.live\/_next-live\/feedback\/feedback\.js["'][^>]*><\/script>/g,'');
      assert.equal(comparable,fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));cache.set('/'+file,Promise.resolve(body));
    }
    check('exact-source Preview assets and two signed isolated synthetic owners');
    let loseFor=null;const expectedFaults=new Set();
    async function open(width){
      const session=(await clients[0].auth.getSession()).data.session,context=await browser.newContext({viewport:{width,height:844}});contexts.push(context);const p=await context.newPage();p.setDefaultTimeout(20000);
      await context.addInitScript(({session,key})=>{localStorage.setItem(key,JSON.stringify(session));},{session,key:'gymbro-account-auth-'+config.projectRef});
      p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!(expectedFaults.has(p)&&/net::ERR_FAILED/.test(m.text())))errors.push(m.text());});
      await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
        if(url.origin===config.url){if(loseFor===p&&url.pathname==='/rest/v1/rpc/gymbro_workout_mutate'){loseFor=null;const response=await route.fetch();assert(response.ok());expectedFaults.add(p);return route.abort('failed');}return route.continue();}
        if(url.origin==='https://vercel.live'&&req.method()==='GET')return route.continue();
        if(url.origin!==preview||req.method()!=='GET'){errors.push('Unexpected network destination/method');return route.abort();}
        if(!cache.has(url.pathname))cache.set(url.pathname,read(url.pathname+url.search));const body=await cache.get(url.pathname);
        return route.fulfill({body,contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.startsWith('/api/')?'application/json':url.pathname.endsWith('.png')?'image/png':'text/html'});
      });
      p.on('dialog',d=>d.accept());await p.goto(preview+'/?storage=cloud');await p.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');await p.locator('#cloudConnect').click();await p.waitForFunction(()=>cloudReady);return p;
    }
    for(const width of [1280,390,320]){
      const p=await open(width),before=await repos[0].load(),alias=width===1280?'Rope Triceps Pressdown':'Exact cable alias '+width,fresh='Dumbbell distinct '+width,skip='Smith distinct excluded '+width;
      const input={schema:'gym-tracker-chatgpt-v1',importId:'issue18-ui-'+width,date:'2026-11-07',bodyweight:200,notes:'  original summary\n',sets:[alias,fresh,skip].map(exercise=>({exercise,weight:0,unit:'lb',reps:7,rpe:7,rir:2,pain:1,painArea:'raw area',notes:'  raw note\n',complete:false}))};
      await p.locator('[data-view="inbox"]').click();await p.locator('#inboxRaw').fill(JSON.stringify(input));await p.getByRole('button',{name:'Review import',exact:true}).click();
      assert(await p.locator('#commitInboxBtn').isDisabled());
      await p.getByRole('combobox',{name:'Resolve exercise 1',exact:true}).selectOption('map:'+target);
      await p.getByRole('combobox',{name:'Resolve exercise 2',exact:true}).selectOption('create');await p.getByRole('combobox',{name:'Resolve exercise 3',exact:true}).selectOption('skip');
      assert.match(await p.locator('#inboxResolution').textContent(),/2 sets to import; 1 excluded/);assert.match(await p.locator('#inboxResolution').textContent(),/separate future import with a new import ID/);
      assert(f.lifecycle.equalRows((await repos[0].load()).rows,before.rows),'review writes nothing');
      loseFor=p;await p.locator('#commitInboxBtn').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='OUTCOME_UNKNOWN');
      const committed=await repos[0].load();assert.equal(committed.rows.sets.length,before.rows.sets.length+2);assert.equal(committed.rows.bodyweights.length,before.rows.bodyweights.length+1);
      assert(await p.getByRole('combobox',{name:'Resolve exercise 1',exact:true}).isDisabled());
      await p.locator('[data-view="data"]').click();await p.locator('#cloudRetry').click();await p.waitForFunction(()=>cloudController.getStatus().phase==='READY');
      const replay=await repos[0].load();assert.equal(replay.revision,committed.revision);assert(f.lifecycle.equalRows(replay.rows,committed.rows));
      const sets=replay.document.data.sets.slice(-2);assert.equal(sets[0].exercise.exerciseId,target);assert.equal(sets[0].exercise.originalLabel,alias);assert.notEqual(sets[1].exercise.exerciseId,target);
      assert(sets.every(s=>s.weight===0&&s.complete===false&&s.notes==='  raw note\n'&&s.pain===1&&s.rpe===7&&!s.sessionId));assert(!replay.document.catalog.aliases.some(a=>a.label===skip));
      await p.reload();await p.waitForFunction(()=>document.getElementById('accountStatus').textContent==='Account restored.');await p.locator('#cloudConnect').click();await p.waitForFunction(()=>cloudReady);
      await p.locator('[data-view="inbox"]').click();await p.locator('#inboxRaw').fill(JSON.stringify({...input,importId:'alias-repeat-'+width,sets:[input.sets[0]]}));await p.getByRole('button',{name:'Review import',exact:true}).click();
      assert.match(await p.locator('#inboxResolution').textContent(),/Saved alias: 1/);assert.equal(await p.locator('#inboxResolution select').count(),0);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:path.join(root,'test-results','issue18-signed-'+width+'.png'),fullPage:true});
      check('signed explicit map/create/skip, real committed-response loss/retry, full values and alias reload at '+width+'px');
    }
    // Capture a normal prepared packet without sending, then exercise real SQL rejection.
    async function prepare(initial,input){let packet;const capturing={rpc:async(name,args)=>{if(name==='gymbro_workout_mutate'){packet=plain(args.packet);return {error:{code:'23514'}};}return clients[0].rpc(name,args);}};
      const controller=f.get('WorkoutCloud').create({client:capturing,ownerId:owner,initial,recoveryStorage:storage()});assert.equal((await controller.execute('commitImport',input)).code,'VALIDATION_ERROR');assert(packet);return packet;}
    const make=(id,label,destination)=>({...f.get('normalizeInboxPayload')({importId:id,date:'2026-11-07',sets:[{exercise:label,weight:0,unit:'lb',reps:7}]}),resolutions:[{label,kind:'map',exerciseId:destination}]});
    const before=await repos[0].load(),bad=await prepare(before,make('sql-rejection','Reject alias',target));bad.next.sets.at(-1).reps=0;
    const denied=await clients[0].rpc('gymbro_workout_mutate',{packet:bad});assert(denied.error||denied.data?.code==='VALIDATION_ERROR');const after=await repos[0].load();assert.equal(after.revision,before.revision);assert(f.lifecycle.equalRows(after.rows,before.rows));
    check('actual PostgreSQL rejection rolls back alias, sets, import and revision');
    const other=before.document.catalog.exercises.find(e=>e.id!==target).id,label='Conflicting exact alias';
    const packets=await Promise.all([prepare(before,make('race-a',label,target)),prepare(before,make('race-b',label,other))]);
    const replies=await Promise.all(packets.map(packet=>clients[0].rpc('gymbro_workout_mutate',{packet})));assert(replies.every(r=>!r.error));assert.deepEqual(replies.map(r=>r.data.code).sort(),['CONFLICT','OK']);
    const raced=await repos[0].load(),winner=replies.findIndex(r=>r.data.code==='OK');assert.equal(raced.rows.sets.length,before.rows.sets.length+1);assert.equal(f.identity.resolveLabel(raced.document.catalog,label),winner===0?target:other);
    check('concurrent signed conflicting alias imports: one atomic OK and one CONFLICT');
    const foreignBefore=await repos[1].load(),foreign=await clients[1].from('gymbro_exercise_aliases').select().eq('owner_id',owner);assert(!foreign.error);assert.deepEqual(foreign.data,[]);
    const foreignWrite=await clients[1].rpc('gymbro_workout_mutate',{packet:packets[0]});assert(foreignWrite.error||foreignWrite.data?.code==='AUTHORIZATION_ERROR');
    assert(f.lifecycle.equalRows((await repos[1].load()).rows,foreignBefore.rows));assert(f.lifecycle.equalRows((await repos[0].load()).rows,raced.rows));check('cross-owner alias invisibility and foreign-owner mutation denial');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'test-results/issue18-signed-preview.json'),JSON.stringify({sha,preview,build:require('../app-version.js').version,project,checks,unexpectedErrors:errors},null,2));
  }finally{for(const context of contexts)await context.close();await browser.close();for(const client of clients)await client.auth.signOut({scope:'local'});}
}
if(require.main===module)main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:'Signed #18 verification failed; private details withheld.');process.exitCode=1;});
