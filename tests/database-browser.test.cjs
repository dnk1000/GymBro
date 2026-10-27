// Actual pinned Supabase browser SDK; Auth/PostgREST responses are simulated, not live acceptance.
const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict");
const http = require("node:http"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { chromium } = require("playwright-core");
let browser, server, origin;
before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://test");
      if (url.pathname === "/api/supabase-sdk") {
        res.setHeader("Content-Type", "application/javascript");
        res.end(
          await fs.readFile(
            "node_modules/@supabase/supabase-js/dist/umd/supabase.js",
          ),
        );
        return;
      }
      const file = path.join(
        __dirname,
        "..",
        url.pathname === "/" ? "index.html" : url.pathname,
      );
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
async function fixture(t, localRaw = null) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
    storageState:
      localRaw === null
        ? undefined
        : {
            cookies: [],
            origins: [
              {
                origin,
                localStorage: [{ name: "daveGymTrackerV1", value: localRaw }],
              },
            ],
          },
  });
  t.after(() => context.close());
  const p = await context.newPage();
  p.setDefaultTimeout(15000);
  const errors = [],
    dialogs = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.accept();
  });
  t.after(() => assert.deepEqual(errors, []));
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    email: "synthetic@example.test",
    role: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-10-25T00:00:00Z",
  };
  const now = Math.floor(Date.now() / 1000);
  const token = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      iat: now,
      exp: now + 3600,
      aud: "authenticated",
      role: "authenticated",
      session_id: "22222222-2222-4222-8222-222222222222",
    },
  ]
    .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
    .concat("c3ludGhldGlj")
    .join(".");
  let row = null,
    offline = false,
    failRead = false,
    loseResponse = false;
  const writes = [],
    receipts = new Map();
  await p.route("**/api/config", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://synthetic.supabase.co",
        key: "sb_publishable_synthetic_test",
      },
    }),
  );
  await p.route("https://synthetic.supabase.co/**", async (route) => {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-headers":
        "authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const url = new URL(req.url());
    if (url.pathname.endsWith("/token"))
      return route.fulfill({
        headers,
        json: {
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: "synthetic-refresh-token",
          user,
        },
      });
    if (url.pathname.endsWith("/logout"))
      return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith("/user"))
      return route.fulfill({ headers, json: user });
    if (url.pathname.endsWith("/gymbro_workout_state")) {
      if (offline || failRead) return route.abort();
      return route.fulfill({ headers, json: row ? [row] : [] });
    }
    if (url.pathname.endsWith("/rpc/gymbro_save")) {
      const b = req.postDataJSON();
      writes.push(b);
      if (offline) return route.abort();
      const prior = receipts.get(b.p_request_id);
      let result;
      if (prior)
        result =
          JSON.stringify(prior.body) === JSON.stringify(b)
            ? {
                ...prior.result,
                code: "REPLAY",
                current_revision: row.revision,
              }
            : { ok: false, code: "REQUEST_CONFLICT" };
      else if ((row?.revision || 0) !== b.p_expected_revision)
        result = { ok: false, code: "REVISION_CONFLICT" };
      else {
        row = {
          state: structuredClone(b.p_state),
          revision: b.p_expected_revision + 1,
        };
        result = {
          ok: true,
          code: "OK",
          revision: row.revision,
          current_revision: row.revision,
        };
        receipts.set(b.p_request_id, { body: b, result });
      }
      if (loseResponse) {
        loseResponse = false;
        return route.abort();
      }
      return route.fulfill({ headers, json: result });
    }
    return route.fulfill({
      status: 404,
      headers,
      json: { message: "not found" },
    });
  });
  await p.goto(origin);
  await p.evaluate(() => databaseStartup);
  await p.locator("#databaseAccount summary").click();
  return {
    p,
    dialogs,
    writes,
    row: () => row,
    setOffline: (v) => (offline = v),
    setFailRead: (v) => (failRead = v),
    loseResponse: () => (loseResponse = true),
    advance: () => {
      row.revision++;
      row.state.preferences.external = "retained";
    },
  };
}
async function signin(p) {
  await p.locator("#databaseEmail").fill("synthetic@example.test");
  await p.locator("#databasePassword").fill("synthetic-password");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForFunction(() => databaseStore?.ready && !databaseUIBusy);
}
async function initialize(p) {
  await p.getByRole("button", { name: "Preview V2 local import" }).click();
  await p.locator("#databasePreviewSummary").waitFor();
  await p
    .getByRole("button", { name: "Confirm import and use database" })
    .click();
  await p.waitForFunction(() =>
    document
      .getElementById("databaseMessage")
      .textContent.includes("read-back verified"),
  );
}
async function logForm(p) {
  await p.locator("[data-view=workout]").click();
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("42");
  await p.locator("#fReps").fill("8");
  await p.locator("#fNotes").fill("synthetic cloud set");
  await p.locator("#saveSetBtn").click();
  await p.waitForFunction(() => !uiSaveBusy);
}
test("real SDK bootstrap, sign-in, reviewed migration, database write/reload and signout retain original local bytes", async (t) => {
  const f = await fixture(t),
    p = f.p;
  const original = await p.evaluate(() => ({
    raw: localStorage.getItem(KEY),
    state: JSON.stringify(db),
  }));
  assert.equal(f.writes.length, 0);
  await signin(p);
  assert.equal(f.writes.length, 0);
  await initialize(p);
  assert.equal(f.row().state.version, 7);
  await logForm(p);
  assert.equal(f.row().state.sets.length, 85);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), original.raw);
  await p.reload();
  await p.evaluate(() => databaseStartup);
  assert.equal(await p.evaluate(() => db.sets.length), 85);
  await p.locator("#databaseAccount summary").click();
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.waitForFunction(() => databaseUser === null);
  await p.reload();
  await p.evaluate(() => databaseStartup);
  assert.equal(await p.evaluate(() => db.sets.length), 85);
  assert.match(await p.locator("#databaseStatus").innerText(), /read-only/);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), original.raw);
});
test("lost-response save preserves form; explicit resolution reuses request ID without a duplicate set", async (t) => {
  const f = await fixture(t),
    p = f.p;
  await signin(p);
  await initialize(p);
  f.loseResponse();
  await logForm(p);
  assert.equal(f.row().state.sets.length, 85);
  assert.equal(await p.locator("#fReps").inputValue(), "8");
  await p.getByRole("button", { name: "Resolve save", exact: true }).click();
  await p.waitForFunction(() =>
    document
      .getElementById("databaseMessage")
      .textContent.includes("Save resolved"),
  );
  assert.equal(f.row().state.sets.length, 85);
  assert.equal(f.writes.at(-1).p_request_id, f.writes.at(-2).p_request_id);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), null);
});
test("stale database revision cannot overwrite another device and preserves unsaved form input", async (t) => {
  const f = await fixture(t),
    p = f.p;
  await signin(p);
  await initialize(p);
  f.advance();
  await logForm(p);
  assert.equal(f.row().state.sets.length, 84);
  assert.equal(f.row().state.preferences.external, "retained");
  assert.equal(await p.locator("#fReps").inputValue(), "8");
  assert(f.dialogs.some((x) => x.includes("Another tab or device")));
});
test("migration readback failure retains displayed local snapshot and original local data", async (t) => {
  const f = await fixture(t),
    p = f.p;
  await signin(p);
  const before = await p.evaluate(() => JSON.stringify(db));
  await p.getByRole("button", { name: "Preview V2 local import" }).click();
  await p.locator("#databasePreviewSummary").waitFor();
  f.setFailRead(true);
  await p
    .getByRole("button", { name: "Confirm import and use database" })
    .click();
  await p.waitForFunction(() => !databaseUIBusy);
  assert.equal(await p.evaluate(() => JSON.stringify(db)), before);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), null);
  assert.equal(await p.evaluate(() => databaseStore.ready), false);
});
test("database backup export, explicit restore/merge and repeated initial import refusal", async (t) => {
  const f = await fixture(t),
    p = f.p;
  await signin(p);
  await initialize(p);
  await logForm(p);
  await p.getByRole("button", { name: "Preview V2 local import" }).click();
  assert.match(
    await p.locator("#databaseMessage").innerText(),
    /already contains/,
  );
  await p.locator("[data-view=data]").click();
  const download = p.waitForEvent("download");
  await p.getByRole("button", { name: "Export JSON", exact: true }).click();
  const raw = await fs.readFile(await (await download).path(), "utf8");
  assert.equal(JSON.parse(raw).version, 7);
  for (const mode of ["restore", "merge"]) {
    await p.locator("#backupMode").selectOption(mode);
    await p.locator("#importFile").setInputFiles({
      name: "cloud-copy.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    });
    const alert = p.waitForEvent("dialog", (d) => d.type() === "alert");
    await p.getByRole("button", { name: "Import JSON", exact: true }).click();
    await alert;
    assert.equal(f.row().state.sets.length, 85);
  }
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), null);
});
test("empty account stays empty and guided session lifecycle persists through reload", async (t) => {
  const f = await fixture(t),
    p = f.p;
  await signin(p);
  await p
    .getByRole("button", { name: "Preview empty account", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Confirm import and use database" })
    .click();
  await p.waitForFunction(() => !databaseUIBusy);
  assert.equal(f.row().state.sets.length, 0);
  assert.equal(f.row().state.bodyweights.length, 0);
  await p.locator("[data-view=workout]").click();
  await p.locator("#guidedTemplate").selectOption("push");
  await p.locator("#guidedDate").fill("2026-10-27");
  await p.locator("#guidedDuration").selectOption("30");
  await p.getByRole("button", { name: "Start workout", exact: true }).click();
  await p.waitForFunction(() => !uiSaveBusy);
  const snapshot = structuredClone(f.row().state.sessions[0].planSnapshot);
  await p.locator("#fWeight").fill("40");
  await p.locator("#fReps").fill("8");
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  await p.waitForFunction(() => !uiSaveBusy);
  const savedSet = structuredClone(f.row().state.sets[0]);
  await p.reload();
  await p.evaluate(() => databaseStartup);
  await p.locator("[data-view=workout]").click();
  await p.getByRole("button", { name: "Finish workout", exact: true }).click();
  await p.waitForFunction(() => !uiSaveBusy);
  assert.equal(f.row().state.activeSessionId, null);
  assert.equal(f.row().state.sessions[0].status, "completed");
  assert.deepEqual(f.row().state.sessions[0].planSnapshot, snapshot);
  assert.deepEqual(f.row().state.sets[0], savedSet);
  await p.locator("[data-view=history]").click();
  assert.equal(await p.locator("[data-session-id]").count(), 1);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), null);
});
test("explicit cloud reset refreshes signed-out cache without mutating original local data", async (t) => {
  const f = await fixture(t),
    p = f.p;
  await signin(p);
  await initialize(p);
  await p.locator("[data-view=data]").click();
  await p
    .getByRole("button", { name: "Erase all account data", exact: true })
    .click();
  await p.waitForFunction(() => !uiSaveBusy);
  assert.equal(f.row().state.sets.length, 0);
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p.waitForFunction(() => databaseUser === null);
  await p.reload();
  await p.evaluate(() => databaseStartup);
  assert.equal(await p.evaluate(() => db.sets.length), 0);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), null);
});
test("migration preserves existing V2 raw bytes, active sessions and historical metadata exactly", async (t) => {
  const original = await fs.readFile("tests/fixtures/history-v6.json", "utf8");
  const f = await fixture(t, original),
    p = f.p;
  const reviewed = await p.evaluate(() => structuredClone(db));
  await signin(p);
  assert.equal(f.writes.length, 0);
  await initialize(p);
  assert.deepEqual(f.row().state, reviewed);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), original);
  const download = p.waitForEvent("download");
  await p
    .getByRole("button", { name: "Download original local data", exact: true })
    .click();
  assert.equal(
    await fs.readFile(await (await download).path(), "utf8"),
    original,
  );
  await p.locator("[data-view=data]").click();
  await p
    .getByRole("button", { name: "Erase all account data", exact: true })
    .click();
  await p.waitForFunction(() => !uiSaveBusy);
  assert.equal(f.row().state.sets.length, 0);
  assert.equal(await p.evaluate(() => localStorage.getItem(KEY)), original);
});
