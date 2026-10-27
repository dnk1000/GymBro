const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { chromium } = require("playwright-core");
const { accountConfig } = require("../api/account-config.js");
const { createServer } = require("../scripts/serve-probe.cjs");
const ref = "obebuvpsqapgevwivwho", url = `https://${ref}.supabase.co`;
const env = { VERCEL_ENV: "preview", GYMBRO_ACCOUNT_ACCESS: "true", GYMBRO_CLOUD_ENV: "preview",
  SUPABASE_PROJECT_REF: ref, SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_public_value_only" };
const KEY = "daveGymTrackerV1";
let server, origin, browser;
before(async () => {
  server = createServer(); await new Promise(r => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true });
});
after(async () => { await browser?.close(); if (server) await new Promise(r => server.close(r)); });

test("accounts reuse staging guards and cannot be enabled in Production or leak privileged credentials", () => {
  assert.equal(accountConfig(env).configured, true);
  for (const change of [{ VERCEL_ENV: "production" }, { VERCEL_ENV: "development" }, { GYMBRO_ACCOUNT_ACCESS: "" }])
    assert.deepEqual(accountConfig({ ...env, ...change }), { enabled: false });
  for (const change of [{ SUPABASE_PROJECT_REF: "loowxditqikcwyeftfgx" }, { SUPABASE_URL: "https://loowxditqikcwyeftfgx.supabase.co" },
    { SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" }, { GYMBRO_CLOUD_ENV: "production" }]) {
    const config = accountConfig({ ...env, ...change });
    assert.equal(config.configured, false); assert.equal('publishableKey' in config, false);
  }
  assert.equal(JSON.stringify(accountConfig({ ...env, SUPABASE_SERVICE_ROLE_KEY: "private-fixture" })).includes("private-fixture"), false);
});

function rawWorkout() {
  const runtime = vm.createContext({ structuredClone });
  for (const f of ["seed.js", "workout-data.js", "workout-sessions.js", "guided-workouts.js"])
    vm.runInContext(fs.readFileSync(f, 'utf8'), runtime);
  return vm.runInContext('JSON.stringify(migrateData(seed))', runtime);
}
async function fixture(t, options = {}) {
  const context = await browser.newContext(); t.after(() => context.close());
  const page = await context.newPage(), raw = rawWorkout(), calls = [];
  const errors = []; page.on('pageerror', e => errors.push(e.message)); t.after(() => assert.deepEqual(errors, []));
  await context.addInitScript(({raw,KEY}) => { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, raw); }, {raw,KEY});
  await context.route('**/api/account-config', r => r.fulfill({contentType:'application/json',body:JSON.stringify(options.config || accountConfig(env))}));
  const id = '33333333-3333-4333-8333-333333333333';
  const user = {id,email:'access-fixture@example.invalid',is_anonymous:false,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-10-27T00:00:00Z'};
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,is_anonymous:false})).toString('base64url')}.fixture`;
  let value;
  await context.route(`${url}/**`, async route => {
    const request = route.request(), u = new URL(request.url()); calls.push({path:u.pathname,method:request.method()});
    const respond = (body,status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
    if (u.pathname.endsWith('/otp')) { if(options.rateLimit) return respond({code:'over_email_send_rate_limit'},429); return respond({}); }
    if (u.pathname.endsWith('/user')) return options.userError ? respond({msg:'offline'},503) : respond(user);
    if (u.pathname.endsWith('/logout')) return options.logoutError ? respond({msg:'offline'},503) : respond({});
    if (u.pathname === '/rest/v1/gymbro_private_access') {
      if (options.beforeCheck) await options.beforeCheck();
      if (options.checkError) return respond({code:'42501'},403);
      if(request.method() === 'POST') { assert.deepEqual(request.postDataJSON(),{owner_id:id,value:'Account access verified'}); value = 'Account access verified'; return route.fulfill({status:201,body:''}); }
      return respond({value});
    }
    throw Error('Unexpected request '+u.pathname);
  });
  await page.goto(origin); await page.locator('[data-view="data"]').click();
  if(options.config?.enabled === false) return {page,context,calls,raw,options};
  await page.locator('#accountRequest').waitFor({state:'visible'});
  if(!options.config) await page.waitForFunction(() => !document.getElementById('accountRequest').disabled);
  return {page,context,calls,raw,options,callback:`${origin}/#access_token=${token}&refresh_token=fixture-refresh&expires_in=3600&token_type=bearer&type=magiclink`};
}
async function signIn(f) {
  await f.page.locator('#accountEmail').fill('access-fixture@example.invalid');
  await f.page.locator('#accountRequest').click();
  await f.page.waitForFunction(() => document.getElementById('accountStatus').textContent.startsWith('Check your email'));
  await f.page.goto(f.callback);
  await f.page.waitForFunction(() => document.getElementById('accountStatus').textContent === 'Account restored.', null, {timeout:10000});
}
test('disabled account access makes no auth requests and preserves raw local workouts', async t => {
  const f = await fixture(t,{config:{enabled:false}});
  assert.equal(await f.page.locator('#accountAccess').isVisible(),false);
  assert.deepEqual(f.calls,[]); assert.equal(await f.page.evaluate(k=>localStorage.getItem(k),KEY),f.raw);
});
test('actual SDK email callback, private check, reload, sign-out and recovery preserve workouts', async t => {
  const f = await fixture(t); assert.deepEqual(f.calls,[]); await signIn(f);
  await f.page.locator('#accountCheck').click();
  await f.page.waitForFunction(() => document.getElementById('accountCheckResult').textContent === 'Account access verified');
  await f.page.reload(); await f.page.locator('[data-view="data"]').click();
  await f.page.waitForFunction(() => document.getElementById('accountStatus').textContent === 'Account restored.');
  await f.page.locator('#accountSignOut').click();
  await f.page.waitForFunction(() => document.getElementById('accountStatus').textContent.startsWith('Signed out of this browser'));
  await signIn(f);
  assert.equal(await f.page.evaluate(k=>localStorage.getItem(k),KEY),f.raw);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/otp')).length,2);
  assert.equal(new URL(f.page.url()).hash,'', 'SDK removes bearer tokens from callback URL');
  assert.deepEqual(await f.page.evaluate(()=>Object.keys(localStorage).sort()),[KEY,`gymbro-account-auth-${ref}`].sort());
  for(const width of [320,390,1280]) { await f.page.setViewportSize({width,height:844}); assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)); }
});
test('rate limits retain visible email and allow retry', async t => {
  const options={rateLimit:true}; const f=await fixture(t,options);
  await f.page.locator('#accountEmail').fill('access-fixture@example.invalid');
  await f.page.locator('#accountRequest').click();
  await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.startsWith('Too many requests'));
  assert.equal(await f.page.locator('#accountEmail').inputValue(),'access-fixture@example.invalid');
  assert.equal(await f.page.evaluate(k=>localStorage.getItem(k),KEY),f.raw);
  options.rateLimit=false; await signIn(f);
});
test('failed sign-out is not reported as success and failed access check clears prior result', async t => {
  const options={}; const f=await fixture(t,options); await signIn(f);
  await f.page.locator('#accountCheck').click(); await f.page.waitForFunction(()=>document.getElementById('accountCheckResult').textContent !== '');
  options.checkError=true; await f.page.locator('#accountCheck').click();
  await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.startsWith('Account request failed'));
  assert.equal(await f.page.locator('#accountCheckResult').textContent(),'');
  options.logoutError=true; await f.page.locator('#accountSignOut').click();
  await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('revocation could not be confirmed'));
  assert.equal(await f.page.locator('#accountIdentity').textContent(),'Signed out');
  assert.equal(await f.page.evaluate(k=>localStorage.getItem(k),`gymbro-account-auth-${ref}`),null);
  assert.equal(await f.page.evaluate(k=>localStorage.getItem(k),KEY),f.raw);
});
test('cross-tab sign-out clears identity and private result in the other tab', async t => {
  const f=await fixture(t); await signIn(f);
  const second=await f.context.newPage(); await second.goto(origin); await second.locator('[data-view="data"]').click();
  await second.waitForFunction(()=>document.getElementById('accountStatus').textContent === 'Account restored.');
  await f.page.locator('#accountSignOut').click();
  await second.waitForFunction(()=>document.getElementById('accountIdentity').textContent === 'Signed out');
  assert.equal(await second.locator('#accountCheckResult').textContent(),'');
});
test('an expired callback offers a fresh link and never displays authenticated access', async t => {
  const f=await fixture(t);
  await f.page.goto(`${origin}/?callback-error#${new URLSearchParams({error:'access_denied',error_code:'otp_expired',error_description:'expired'})}`);
  await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.includes('invalid or expired'));
  assert.equal(await f.page.locator('#accountIdentity').textContent(),'Signed out');
  assert.equal(await f.page.locator('#accountCheck').isVisible(),false);
  assert.equal(await f.page.evaluate(k=>localStorage.getItem(k),KEY),f.raw);
});
test('a failed server identity verification never presents the callback as signed in', async t => {
  const f=await fixture(t,{userError:true});
  await f.page.goto(f.callback);
  await f.page.waitForFunction(()=>document.getElementById('accountStatus').textContent.startsWith('Account request failed'));
  assert.equal(await f.page.locator('#accountIdentity').textContent(),'Signed out');
  assert.equal(await f.page.locator('#accountCheck').isVisible(),false);
});
