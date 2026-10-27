// Exercise the shipped local config/SDK server, not fixture replacements for those routes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const { chromium } = require("playwright-core");
async function server(t, bindings = {}) {
  const child = spawn(process.execPath, ["scripts/serve.cjs"], {
    cwd: require("node:path").resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "0",
      SUPABASE_URL: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      ...bindings,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
  });
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Development server did not start")),
      10000,
    );
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.stdout.on("data", (data) => {
      const origin = /http:\/\/127\.0\.0\.1:\d+/.exec(data.toString());
      if (origin) {
        clearTimeout(timer);
        resolve(origin[0]);
      }
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(Error("Development server exited before readiness"));
    });
  });
}
test("real config endpoint allows only public configuration and packages the installed SDK", async (t) => {
  const url = "https://synthetic.supabase.co";
  for (const [bindings, status, expected] of [
    [{}, 200, { enabled: false }],
    [
      {
        SUPABASE_URL: url,
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_test",
      },
      200,
      { enabled: true, url, key: "sb_publishable_synthetic_test" },
    ],
    [{ SUPABASE_URL: url }, 503, null],
    [
      {
        SUPABASE_URL: url,
        SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic_never_expose",
      },
      503,
      null,
    ],
  ]) {
    const origin = await server(t, bindings);
    const response = await fetch(origin + "/api/config");
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    if (expected) assert.deepEqual(body, expected);
    else {
      assert.equal(body.enabled, true);
      assert.equal(body.key, undefined);
    }
    assert.equal(
      (await fetch(origin + "/api/config", { method: "POST" })).status,
      405,
    );
    assert.equal((await fetch(origin + "/.env")).status, 404);
    const sdk = await fetch(origin + "/api/supabase-sdk");
    assert.equal(sdk.status, 200);
    assert.match(sdk.headers.get("content-type"), /javascript/);
    assert.equal(
      await sdk.text(),
      await fs.readFile(
        "node_modules/@supabase/supabase-js/dist/umd/supabase.js",
        "utf8",
      ),
    );
  }
});
test("actual development server boots legacy mode with all seven views and no browser errors", async (t) => {
  const origin = await server(t);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.evaluate(() => databaseStartup);
  assert.match(
    await page.locator("#databaseStatus").innerText(),
    /Legacy local mode/,
  );
  assert.equal(await page.locator(".tab[data-view]").count(), 7);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of [
      "dashboard",
      "program",
      "workout",
      "history",
      "inbox",
      "exercises",
      "data",
    ]) {
      await page.locator(`[data-view="${view}"]`).click();
      assert(await page.locator("#" + view).isVisible());
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        view + " overflow at " + width,
      );
    }
  }
  assert.deepEqual(errors, []);
});
