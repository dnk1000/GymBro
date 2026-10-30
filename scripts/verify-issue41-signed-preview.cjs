// Real permanent signed accounts, exact protected Preview assets and actual RPCs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {read,preview,guard}=require('./issue41-preview.cjs');
const {sdk,validate}=require('./issue41-staging-fixtures.cjs');
const {setup}=require('../tests/lifecycle-fixture.cjs');
const {storage}=require('../tests/protocol-fixture.cjs');
const root=path.resolve(__dirname,'..');
async function textOf(download){const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);return Buffer.concat(chunks).toString();}
async function main(){if(process.argv.length!==2)throw Error('No arbitrary flags.');const sha=guard();
  const state=validate(JSON.parse(fs.readFileSync(path.join(root,'.env.issue41-fixtures.json'),'utf8'))),config=JSON.parse(await read('/api/lifecycle-config'));
  assert(config.enabled&&config.configured);assert.equal(config.fixtureTag,state.tag);assert.deepEqual(config.allowedOwners,state.accounts.map(a=>a.id));
  const f=await setup(),clients=[],repos=[],cache=new Map(),checks=[],errors=[];
  for(const account of state.accounts){const client=sdk().createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const reply=await client.auth.signInWithPassword({email:account.email,password:account.password});assert(!reply.error);assert.equal(reply.data.user.id,account.id);assert.equal(reply.data.user.is_anonymous,false);
    clients.push(client);repos.push(f.lifecycle.createRepository({client,ownerId:account.id}));}
  for(const file of ['app-version.js','workout-concurrency.js','workout-repository.js','workout-lifecycle.js','workout-lifecycle-panel.js','lifecycle-test.js']){
    const body=await read('/'+file);assert.equal(body.toString().replaceAll('\r\n','\n'),fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));cache.set('/'+file,body);}
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),contexts=[];
  const upload=(p,selector,name,text)=>p.locator(selector).setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
  const wait=(p,text)=>p.waitForFunction(text=>document.querySelector('[data-status]')?.textContent.includes(text),text);
  try{for(const width of [1280,390,320]){
    const context=await browser.newContext({viewport:{width,height:844}});contexts.push(context);const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
    await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
      if(url.origin===config.url)return route.continue();if(url.origin==='https://vercel.live'&&req.method()==='GET')return route.continue();
      if(url.origin!==preview||req.method()!=='GET'){errors.push('Unexpected network destination/method.');return route.abort();}
      let body=cache.get(url.pathname);if(!body){body=await read(url.pathname+url.search);cache.set(url.pathname,body);}
      await route.fulfill({body,contentType:url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.startsWith('/api/')?'application/json':'text/html'});
    });
    await page.goto(preview+'/lifecycle-test.html');await page.waitForFunction(()=>!document.getElementById('access').disabled);
    await page.locator('#email').fill(state.accounts[0].email);await page.locator('#password').fill(state.accounts[0].password);await page.locator('#signIn').click();await page.locator('[data-review]').waitFor();
    const original=await repos[0].load();assert.equal(original.document.data.extension.lifecycleFixture,state.tag);
    const dl=page.waitForEvent('download');await page.locator('[data-export]').click();const safety=await textOf(await dl);
    assert(f.lifecycle.equalRows(f.repository.project((await f.lifecycle.parse(safety,state.accounts[0].id)).document,state.accounts[0].id,original.bodyweightIds,original.signatureSchemes),original.rows));
    const incoming=JSON.parse(safety);incoming.payload.document.data.sets[0].notes=`signed replacement ${width}`;
    await upload(page,'[data-incoming]','B.json',JSON.stringify(incoming));await page.locator('[data-review]').click();await wait(page,'File validated.');
    await page.locator('[data-commit]').click();await wait(page,'Verify the saved');assert.equal((await repos[0].load()).revision,original.revision);
    await upload(page,'[data-safety]','A.json',safety);await page.locator('[data-verify]').click();await wait(page,'recovery file verified');
    page.once('dialog',d=>d.dismiss());await page.locator('[data-commit]').click();assert.equal((await repos[0].load()).revision,original.revision);
    await page.locator('#loseAcknowledgement').check();page.once('dialog',d=>d.accept());await page.locator('[data-commit]').click();await wait(page,'Save confirmation was lost');
    assert.equal(await page.locator('[data-incoming]').evaluate(e=>e.files[0].name),'B.json');
    await page.locator('[data-retry]').click();await wait(page,'Cloud request REPLAY');
    const after=await repos[0].load();assert.equal(after.document.data.sets[0].notes,`signed replacement ${width}`);assert.equal(BigInt(after.revision),BigInt(original.revision)+1n);
    // Rehearse B -> A recovery through another explicit reviewed operation.
    const bfile=f.lifecycle.backup(after),controller=f.lifecycle.createController({initial:after,repository:repos[0],recoveryStorage:storage()});
    const recovered=await controller.execute('restoreCompleteBackup',{text:safety,safety:f.lifecycle.verifySafety(JSON.stringify(bfile),after),confirmed:true});assert.equal(recovered.code,'OK');
    assert(f.lifecycle.equalRows((await repos[0].load()).rows,original.rows));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('[data-local-delete]').isDisabled(),true);
    // Pure local cleanup uses disposable browser storage only and sends no cloud RPC.
    let rpc=0;const count=()=>rpc++;page.on('request',count);
    assert.equal(await page.evaluate(()=>{const s=localStorage;s.setItem('daveGymTrackerV1','{raw synthetic recovery');s.setItem('unrelated','keep');
      const local=WorkoutLifecycle.localRecovery({storage:s,cutoverAccepted:true});const raw=local.capture();local.verify(raw);local.remove({confirmed:true,oldTabsClosed:true});local.dispose();
      return s.getItem('daveGymTrackerV1')===null&&s.getItem('unrelated')==='keep';}),true);
    page.off('request',count);assert.equal(rpc,0);assert(f.lifecycle.equalRows((await repos[0].load()).rows,original.rows));
    if(width===320){fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/lifecycle-signed-320.png'),fullPage:true});}
    checks.push({width,exportReopen:true,confirmationCancel:true,lostAckRetry:true,recoveryA:true,localCleanupNoCloud:true});
  }
  const source=await repos[0].load(),cloud=JSON.stringify(f.lifecycle.backup(source));
  await assert.rejects(f.lifecycle.parse(cloud,state.accounts[1].id),/different account/);
  const otherBefore=await repos[1].load();assert.equal(otherBefore.document.data.extension.lifecycleFixture,state.tag);
  const forged=repos[1].prepare(otherBefore,{...source,sourceOwnerId:state.accounts[0].id,safety:{ownerId:state.accounts[1].id,revision:otherBefore.revision,fingerprint:otherBefore.fingerprint}},
    {action:'restoreCompleteBackup',operation:['restoreCompleteBackup','foreign-cloud'],result:{}});
  assert.equal((await repos[1].submit(forged)).code,'AUTHORIZATION_ERROR');assert(f.lifecycle.equalRows((await repos[1].load()).rows,otherBefore.rows));
  // Cross-owner diagnostics/receipt reads remain empty and DML remains forbidden.
  const foreign=await clients[1].from('gymbro_mutation_receipts').select('*').eq('owner_id',state.accounts[0].id);assert(!foreign.error);assert.deepEqual(foreign.data,[]);
  const direct=await clients[0].from('gymbro_sets').delete().eq('owner_id',state.accounts[0].id);assert(direct.error);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'test-results/lifecycle-signed-preview.json'),JSON.stringify({sha,preview,build:f.get('APP_VERSION.version'),checks,accountMismatch:true,sqlDenial:true,consoleErrors:errors},null,2));
  console.log('Signed exact Preview: desktop/390/320 export/reopen/cancel/lost-ack/recovery/local-cleanup plus same-account/RLS/bypass checks PASS; console clean.');
  }finally{for(const c of contexts)await c.close();await browser.close();for(const client of clients)await client.auth.signOut({scope:'local'});}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
