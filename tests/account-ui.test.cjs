const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { domain } = require("../server/domain.cjs");
const { digest } = require("../server/integrity.cjs");
let browser, server, origin;
before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const p = new URL(req.url, "http://test").pathname;
      const file = path.join(__dirname, "..", p === "/" ? "index.html" : p);
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  await new Promise((r) => server.close(r));
});
async function fixture(t) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, []));
  page.on("dialog", (d) => d.accept());
  let state = null,
    revision = 0,
    preview = null,
    unavailable = false,
    readbackFail = false,
    writes = 0;
  await page.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://synthetic.supabase.co",
        key: "public-test",
      },
    }),
  );
  await page.route("**/api/sdk", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: `globalThis.supabase={createClient(){let listener;const session={access_token:'synthetic-test-token',user:{id:'test-user',email:'test@example.test'}};return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(fn){listener=fn;},signInWithPassword:async()=>{listener(session);return {data:{session}};},signUp:async()=>({data:{session:null}}),signOut:async()=>{listener(null);return {};}}};}};`,
    }),
  );
  await page.route("**/api/gymbro", async (route) => {
    const b = route.request().postDataJSON();
    if (unavailable) return route.abort();
    if (b.op === "state") {
      if (readbackFail) return route.abort();
      return route.fulfill({
        json: { state, revision, digest: state ? digest(state) : null },
      });
    }
    if (b.op === "import-preview") {
      preview = JSON.parse(JSON.stringify(b.state));
      return route.fulfill({
        json: {
          previewId: "test-preview",
          state: preview,
          digest: digest(preview),
          revision,
          summary: {
            sets: preview.sets.length,
            sessions: preview.sessions.length,
            bodyweights: preview.bodyweights.length,
            imports: preview.imports.length,
            schema: 7,
          },
        },
      });
    }
    if (b.op === "import-commit") {
      state = preview;
      revision++;
      writes++;
      return route.fulfill({
        json: { ok: true, revision, digest: digest(state) },
      });
    }
    if (b.op === "action") {
      const d = domain();
      const actions = d.createWorkoutActions({
        getState: () => state,
        setState: (s) => (state = s),
        persist: async () => {
          writes++;
          revision++;
          return { ok: true };
        },
        createId: () => crypto.randomUUID(),
      });
      const result = await actions[b.action](...b.args);
      return route.fulfill({ json: { ...result, revision } });
    }
    if (b.op === "grants")
      return route.fulfill({
        json: {
          grants: [
            {
              client_id: "test-client",
              name: "Trainer test",
              scopes: ["training:read"],
              revoked_at: null,
            },
          ],
        },
      });
    if (b.op === "revoke")
      return route.fulfill({ json: { ok: true, upstreamRevoked: true } });
    return route.fulfill({
      status: 400,
      json: { message: "unexpected operation" },
    });
  });
  await page.goto(origin);
  await page.evaluate(() => accountReady);
  await page.locator(".account-panel summary").click();
  return {
    page,
    getState: () => state,
    setUnavailable: (v) => {
      unavailable = v;
    },
    setReadbackFail: (v) => {
      readbackFail = v;
    },
    writes: () => writes,
  };
}
async function signin(page) {
  await page.locator("#accountEmail").fill("test@example.test");
  await page.locator("#accountPassword").fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForFunction(() => connection.session !== null);
}
async function migrate(page) {
  await page.getByRole("button", { name: "Preview local V2 import" }).click();
  await page.locator("#accountImportSummary").waitFor();
  await page
    .getByRole("button", {
      name: "Commit reviewed import and use verified connected data",
    })
    .click();
  await page.waitForFunction(
    () => connection.status === "connected/server-authoritative",
  );
}
test("account UI preserves local history through import, signout, reload and explicit local return", async (t) => {
  const f = await fixture(t),
    p = f.page;
  const original = await p.evaluate(() => JSON.stringify(db));
  assert.equal(f.writes(), 0);
  await signin(p);
  assert.equal(f.writes(), 0);
  await migrate(p);
  assert.equal(f.writes(), 1);
  await p.evaluate(() =>
    workoutActions.logSet({
      date: "2026-10-25",
      exercise: "Bench Press",
      weight: 10,
      reps: 2,
    }),
  );
  const connected = await p.evaluate(() => JSON.stringify(db));
  assert.notEqual(connected, original);
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.waitForFunction(() => connection.session === null);
  assert.equal(await p.evaluate(() => JSON.stringify(db)), connected);
  assert.match(await p.locator("#authorityStatus").innerText(), /cached/);
  await p.reload();
  await p.evaluate(() => accountReady);
  assert.equal(await p.evaluate(() => JSON.stringify(db)), connected);
  await p.locator(".account-panel summary").click();
  await p
    .getByRole("button", { name: "Use local-only GymBro", exact: true })
    .click();
  await p.waitForFunction(() => connection.isLocal());
  assert.equal(await p.evaluate(() => JSON.stringify(db)), original);
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
});
test("failed read-back leaves local authority and original local storage unchanged", async (t) => {
  const f = await fixture(t),
    p = f.page;
  await signin(p);
  const before = await p.evaluate(() => ({
    state: JSON.stringify(db),
    raw: localStorage.getItem(KEY),
  }));
  await p.getByRole("button", { name: "Preview local V2 import" }).click();
  await p.locator("#accountImportSummary").waitFor();
  f.setReadbackFail(true);
  await p
    .getByRole("button", {
      name: "Commit reviewed import and use verified connected data",
    })
    .click();
  await p.waitForFunction(() => !connection.busy);
  assert.equal(await p.evaluate(() => connection.isLocal()), true);
  assert.deepEqual(
    await p.evaluate(() => ({
      state: JSON.stringify(db),
      raw: localStorage.getItem(KEY),
    })),
    before,
  );
});
test("connected failed save preserves form input; trainer revocation does not alter dataset", async (t) => {
  const f = await fixture(t),
    p = f.page;
  await signin(p);
  await migrate(p);
  await p.getByRole("button", { name: "Show trainer authorizations" }).click();
  await p.getByRole("button", { name: "Revoke access", exact: true }).click();
  assert.equal(f.getState().version, 7);
  await p.locator("[data-view=workout]").click();
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("42");
  await p.locator("#fReps").fill("8");
  f.setUnavailable(true);
  const before = JSON.stringify(f.getState());
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  await p.waitForFunction(() => !connection.busy);
  assert.equal(await p.locator("#fReps").inputValue(), "8");
  assert.equal(JSON.stringify(f.getState()), before);
});
