const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require("playwright-core");
const handler = require("../api/supabase-probe-config.js");
const { createServer } = require("../scripts/serve-probe.cjs");
const project = "loowxditqikcwyeftfgx";
const env = { VERCEL_ENV: "preview", GYMBRO_SUPABASE_PROBE: "true",
  SUPABASE_URL: `https://${project}.supabase.co`,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_public_value_only" };
const configured = handler.probeConfig(env);
const KEY = "daveGymTrackerV1";
let server, browser, origin;

test("probe configuration is disabled in Production regardless of local/test toggles", () => {
  for (const environment of ["production", "development", "staging"]) {
    assert.deepEqual(handler.probeConfig({ ...env, VERCEL_ENV: environment,
      GYMBRO_PROBE_LOCAL: "true" }), { enabled: false });
  }
  assert.deepEqual(handler.probeConfig({ ...env, GYMBRO_SUPABASE_PROBE: "false" }), { enabled: false });
  assert.deepEqual(handler.probeConfig({ ...env, VERCEL_ENV: "" }), { enabled: false });
  assert.equal(handler.probeConfig({ ...env, VERCEL_ENV: "", GYMBRO_PROBE_LOCAL: "true" }).environment, "local");
  assert.deepEqual(handler.probeConfig({ ...env, VERCEL: "1", VERCEL_ENV: "", GYMBRO_PROBE_LOCAL: "true" }), { enabled: false });
});

test("public configuration validates URL/key and never emits rejected or unrelated credentials", () => {
  assert.equal(configured.projectRef, project);
  assert.equal(configured.configured, true);
  for (const url of ["", "http://example.com", `${env.SUPABASE_URL}/path`, `${env.SUPABASE_URL}?key=x`,
    `https://user:password@${project}.supabase.co`, "https://example.com", `${env.SUPABASE_URL}.evil.invalid`]) {
    assert.equal(handler.probeConfig({ ...env, SUPABASE_URL: url }).configured, false);
  }
  for (const key of ["", "sb_secret_private_fixture", "eyJ_legacy_JWT_fixture"]) {
    const response = handler.probeConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: key });
    assert.equal(response.configured, false);
    assert.equal("publishableKey" in response, false);
    assert.equal(JSON.stringify(response).includes("private_fixture"), false);
  }
  const response = handler.probeConfig({ ...env, SUPABASE_SERVICE_ROLE_KEY: "private_unrelated_fixture" });
  assert.equal(JSON.stringify(response).includes("private_unrelated_fixture"), false);
});

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

test("local server serves the real config handler but excludes private files and API source", async () => {
  const response = await fetch(`${origin}/api/supabase-probe-config`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), handler.probeConfig(process.env));
  assert.equal((await fetch(`${origin}/api/supabase-probe-config`, { method: "POST" })).status, 405);
  for (const privatePath of ["/.env.local", "/.git/config", "/.local-development/README.md", "/api/supabase-probe-config.js", "/scripts/serve-probe.cjs", "/node_modules/playwright-core/package.json", "/vendor/%2e%2e%2f.env.local"]) {
    assert.equal((await fetch(origin + privatePath)).status, 404, privatePath);
  }
  assert.equal((await fetch(`${origin}/vendor/supabase-2.118.0.js`)).status, 200);
});

function localRaw() {
  const runtime = vm.createContext({ structuredClone });
  for (const file of ["seed.js", "workout-data.js", "workout-sessions.js", "guided-workouts.js"])
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), runtime);
  return vm.runInContext(`JSON.stringify((() => {
    const state = migrateData(seed);
    state.preferences.probeTest = "preserve custom local preference";
    state.sets[0].complete = false;
    state.probeFixtureMetadata = { untouched: true };
    return state;
  })())`, runtime);
}

async function fixture(t, options = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  t.after(() => assert.deepEqual(pageErrors, []));
  const raw = localRaw();
  await context.addInitScript(({ key, raw }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw);
  }, { key: KEY, raw });
  const id = options.id || "11111111-1111-4111-8111-111111111111";
  const user = { id, aud: "authenticated", role: "authenticated", is_anonymous: true,
    app_metadata: { provider: "anonymous", providers: [] }, user_metadata: {}, identities: [],
    created_at: "2026-10-27T00:00:00Z" };
  const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", role: "authenticated", is_anonymous: true,
      exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "fixture"].join(".");
  const rows = options.rows || new Map();
  const calls = { signups: 0, reads: 0, writes: 0, sdk: 0 };
  await page.route("**/api/supabase-probe-config", route => route.fulfill({
    contentType: "application/json", body: JSON.stringify(options.config || configured),
  }));
  await page.route("**/vendor/supabase-2.118.0.js", async route => { calls.sdk++; await route.continue(); });
  await page.route(`${env.SUPABASE_URL}/**`, async route => {
    const request = route.request(), url = new URL(request.url());
    const fulfill = (body, status = 200) => route.fulfill({ status,
      contentType: "application/json", body: JSON.stringify(body),
      headers: { "access-control-allow-origin": "*" } });
    if (url.pathname.endsWith("/signup")) {
      calls.signups++;
      if (options.authError) return fulfill({ code: "anonymous_provider_disabled", msg: "disabled" }, 422);
      return fulfill({ access_token: token, refresh_token: "fixture_refresh", token_type: "bearer",
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    }
    if (url.pathname.endsWith("/user")) return fulfill(user);
    if (url.pathname === "/rest/v1/gymbro_connection_probe") {
      if (request.method() === "POST") {
        calls.writes++;
        if (options.beforeWrite) await options.beforeWrite();
        if (options.tableError) return fulfill({ code: options.tableError, message: "fixture rejected" }, 403);
        const row = request.postDataJSON();
        assert.equal(row.owner_id, id);
        assert.deepEqual(Object.keys(row).sort(), ["owner_id", "value"]);
        rows.set(id, row.value);
        return route.fulfill({ status: 201, body: "" });
      }
      calls.reads++;
      if (options.readError) return fulfill({ code: "42501", message: "fixture denied" }, 403);
      assert.equal(url.searchParams.get("owner_id"), `eq.${id}`);
      assert.equal(url.searchParams.get("select"), "value");
      return fulfill(rows.has(id) ? [{ value: rows.get(id) }] : []);
    }
    throw Error(`Unexpected fixture request: ${url.pathname}`);
  });
  await page.goto(origin);
  await page.locator('[data-view="data"]').click();
  return { page, raw, rows, calls, id, context };
}

test("disabled or incomplete config cannot load the SDK or create test identities", async t => {
  for (const config of [{ enabled: false }, { enabled: true, configured: false, message: "Set Preview variables." }]) {
    const f = await fixture(t, { config });
    if (!config.enabled) assert.equal(await f.page.locator("#supabaseProbe").isVisible(), false);
    else {
      await f.page.locator("#supabaseProbe").waitFor({ state: "visible" });
      assert.match(await f.page.locator("#probeStatus").textContent(), /Not configured/);
      assert.equal(await f.page.locator("#probeSave").isEnabled(), false);
    }
    assert.deepEqual(f.calls, { signups: 0, reads: 0, writes: 0, sdk: 0 });
    assert.equal(await f.page.evaluate(key => localStorage.getItem(key), KEY), f.raw);
  }
});

test("actual SDK saves one value; reload and every Read use the remote response without touching workouts", async t => {
  const f = await fixture(t), p = f.page;
  await p.locator("#probeSave").waitFor({ state: "visible" });
  assert.equal(f.calls.signups, 0);
  await p.locator("#probeValue").fill("<b>literal diagnostic value</b>");
  await p.getByRole("button", { name: "Save test value", exact: true }).click();
  await p.waitForFunction(() => document.getElementById("probeStatus").textContent.startsWith("Saved in Supabase"));
  assert.equal(await p.locator("#probeResult").textContent(), "");
  assert.equal(f.calls.reads, 0);
  await p.getByRole("button", { name: "Read test value", exact: true }).click();
  await p.waitForFunction(() => document.getElementById("probeStatus").textContent.startsWith("Read succeeded"));
  assert.equal(await p.locator("#probeResult").textContent(), "<b>literal diagnostic value</b>");
  assert.equal(await p.locator("#probeResult b").count(), 0);
  f.rows.set(f.id, "changed remotely");
  await p.getByRole("button", { name: "Read test value", exact: true }).click();
  await p.waitForFunction(() => document.getElementById("probeResult").textContent === "changed remotely");
  await p.reload();
  await p.locator('[data-view="data"]').click();
  await p.getByRole("button", { name: "Read test value", exact: true }).click();
  await p.waitForFunction(() => document.getElementById("probeResult").textContent === "changed remotely");
  assert.equal(f.calls.signups, 1);
  assert.equal(f.calls.reads, 3);
  assert.equal(await p.evaluate(key => localStorage.getItem(key), KEY), f.raw);
  const storedKeys = await p.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(storedKeys.sort(), [KEY, `gymbro-probe-auth-${project}`].sort());
  for (const width of [320, 390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
});

test("auth/table failures retain input and local workouts remain writable", async t => {
  for (const options of [{ authError: true }, { tableError: "PGRST205" }, { tableError: "42501" }]) {
    const f = await fixture(t, options), p = f.page;
    await p.locator("#probeValue").fill("retain this test input");
    await p.getByRole("button", { name: "Save test value", exact: true }).click();
    await p.waitForFunction(() => !document.getElementById("probeSave").disabled);
    assert.doesNotMatch(await p.locator("#probeStatus").textContent(), /^Saved/);
    assert.equal(await p.locator("#probeValue").inputValue(), "retain this test input");
    assert.equal(await p.evaluate(key => localStorage.getItem(key), KEY), f.raw);
    const before = { ...f.calls };
    await p.locator('[data-view="workout"]').click();
    await p.locator("#fExercise").fill("Bench Press");
    await p.locator("#fWeight").fill("1");
    await p.locator("#fReps").fill("1");
    await p.getByRole("button", { name: "Add set", exact: true }).click();
    assert.equal(JSON.parse(await p.evaluate(key => localStorage.getItem(key), KEY)).sets.length, JSON.parse(f.raw).sets.length + 1);
    assert.deepEqual(f.calls, before, "normal workout saves make no diagnostic requests");
  }
});

test("a failed fresh Read clears previous result and does not echo unsaved input", async t => {
  const options = {};
  const f = await fixture(t, options), p = f.page;
  f.rows.set(f.id, "previously retrieved value");
  await p.getByRole("button", { name: "Read test value", exact: true }).click();
  await p.waitForFunction(() => document.getElementById("probeResult").textContent === "previously retrieved value");
  options.readError = true;
  await p.locator("#probeValue").fill("unsaved text must not appear as retrieved");
  await p.getByRole("button", { name: "Read test value", exact: true }).click();
  await p.waitForFunction(() => !document.getElementById("probeRead").disabled);
  assert.match(await p.locator("#probeStatus").textContent(), /denied access/);
  assert.equal(await p.locator("#probeResult").textContent(), "");
  assert.equal(f.calls.reads, 2);
  assert.equal(f.calls.writes, 0);
  assert.equal(await p.evaluate(key => localStorage.getItem(key), KEY), f.raw);
});

test("a different SDK identity reads only its own diagnostic value", async t => {
  const rows = new Map();
  const first = await fixture(t, { rows });
  rows.set(first.id, "first identity's test");
  const second = await fixture(t, { rows, id: "22222222-2222-4222-8222-222222222222" });
  await second.page.getByRole("button", { name: "Read test value", exact: true }).click();
  await second.page.waitForFunction(() => document.getElementById("probeStatus").textContent.startsWith("No test value"));
  assert.equal(await second.page.locator("#probeResult").textContent(), "");
  await second.page.locator("#probeValue").fill("second identity's test");
  await second.page.getByRole("button", { name: "Save test value", exact: true }).click();
  await second.page.waitForFunction(() => document.getElementById("probeStatus").textContent.startsWith("Saved in Supabase"));
  assert.equal(rows.size, 2);
  assert.equal(rows.get(first.id), "first identity's test");
  assert.equal(rows.get(second.id), "second identity's test");
});

test("rapid test actions commit once and blank input creates no identity", async t => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { beforeWrite: () => waiting }), p = f.page;
  await p.getByRole("button", { name: "Save test value", exact: true }).click();
  assert.equal(f.calls.signups, 0);
  await p.locator("#probeValue").fill("single pending write");
  await p.evaluate(() => {
    document.getElementById("probeSave").click();
    document.getElementById("probeSave").click();
    document.getElementById("probeRead").click();
  });
  await p.waitForFunction(() => document.getElementById("probeSave").disabled);
  assert.equal(await p.locator("#probeRead").isEnabled(), false);
  release();
  await p.waitForFunction(() => document.getElementById("probeStatus").textContent.startsWith("Saved in Supabase"));
  assert.equal(f.calls.writes, 1);
  assert.equal(f.calls.reads, 0);
});
