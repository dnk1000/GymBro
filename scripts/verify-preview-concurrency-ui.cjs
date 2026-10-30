// Read-only exact-branch Preview smoke using the operator's native Vercel CLI.
// Deployment protection stays enabled. No Auth/SQL request or fixture account.
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const preview='https://gymbro-git-codex-issue-40-implementation-dnk-9999.vercel.app';
const root=path.resolve(__dirname,'..');
const cli=process.env.GYMBRO_VERCEL_CLI_JS || (process.env.APPDATA&&path.join(process.env.APPDATA,'npm','node_modules','vercel','dist','index.js'));
async function read(resource) {
  if(!cli||!fs.existsSync(cli)) throw Error('Configure the installed Vercel CLI JavaScript path.');
  return new Promise((resolve,reject)=> {
    const child=spawn(process.execPath,[cli,'curl',resource,'--deployment',preview,'--scope','dnk-9999','--','--silent','--show-error','--fail'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
    const data=[];child.stdout.on('data',d=>data.push(d));
    child.on('error',()=>reject(Error('Vercel Preview read could not start.')));
    child.on('close',code=>code===0?resolve(Buffer.concat(data)):reject(Error('Authenticated Preview read failed; no pass claimed.')));
  });
}
async function main() {
  if(process.argv.length!==2) throw Error('This read-only check takes no arguments.');
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const config=JSON.parse((await read('/api/concurrency-config')).toString('utf8'));
  if(config.enabled&&config.configured) throw Error('This smoke requires the fixture page to be disabled/unconfigured; no account was opened.');
  const cache=new Map();
  for(const file of ['app-version.js','workout-concurrency.js','workout-repository.js','concurrency-test.js']) {
    const body=await read('/'+file);cache.set('/'+file,body);
    assert.equal(body.toString('utf8').replace(/\r\n/g,'\n'),fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),file+' exact Preview runtime');
  }
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const results=[];
  try {
    for(const width of [1280,390,320]) {
      const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
      await context.addInitScript(()=>{window.normalWorkoutReads=0;const original=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='daveGymTrackerV1')window.normalWorkoutReads++;return original.call(this,key);};});
      await context.route('**/*',async route=> {
        const request=route.request(),url=new URL(request.url());
        // The protected Preview injects Vercel's feedback toolbar. Let that
        // provider-owned GET load normally; all application GETs remain exact
        // native-CLI reads, and unexpected hosts/methods still fail this smoke.
        if(url.origin==='https://vercel.live'&&request.method()==='GET') return route.continue();
        if(url.origin!==preview||request.method()!=='GET') {errors.push('Unexpected network operation: '+request.method()+' '+url.origin+url.pathname);return route.abort();}
        const resource=url.pathname+url.search;
        try {
          let body=cache.get(resource);if(!body){body=await read(resource);cache.set(resource,body);}
          const type=url.pathname.endsWith('.js')?'text/javascript':url.pathname.startsWith('/api/')?'application/json':'text/html';
          await route.fulfill({body,contentType:type});
        } catch {errors.push('Preview resource failed: '+url.pathname);await route.abort();}
      });
      await page.goto(preview+'/concurrency-test.html');
      await page.waitForFunction(()=>document.getElementById('status').textContent.includes('disabled or unconfigured'));
      assert.equal(await page.locator('#submit').isDisabled(),true);
      assert.equal(await page.evaluate(()=>window.normalWorkoutReads),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);
      const build=await page.locator('#build').textContent();
      fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
      await page.screenshot({path:path.join(root,'test-results',`preview-concurrency-${width}.png`),fullPage:true});
      results.push({width,build,consoleErrors:0,normalWorkoutReads:0,fixtureMutations:0,guard:'disabled/unconfigured'});
      await context.close();
    }
    fs.writeFileSync(path.join(root,'test-results','preview-concurrency-readonly.json'),JSON.stringify({preview,sourceRevision:sha,transport:'authenticated native Vercel curl; protection preserved; no tokens printed',results},null,2));
    console.log(JSON.stringify({preview,sourceRevision:sha,results}));
  } finally {await browser.close();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={read,preview};
