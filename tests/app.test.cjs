const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright-core");

let browser, server, origin;
const KEY = "daveGymTrackerV1";
before(async () => {
  const root = path.resolve(__dirname, "..");
  server = http.createServer(async (req, res) => {
    try {
      const file = path.join(root, req.url === "/" ? "index.html" : req.url);
      if (!file.startsWith(root + path.sep)) throw Error("Invalid path");
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".png")
              ? "image/png"
              : "text/html",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function app(t, options = {}) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(origin);
  t.after(() => assert.deepEqual(errors, [], "Uncaught browser errors"));
  return page;
}
// Existing detail regressions explicitly reveal the newly collapsed cards.
async function showHistoryDetails(page) {
  await page.locator('[data-view="history"]').click();
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await page.locator('.history-exercise').evaluateAll(els => els.forEach(el => { el.open = true; }));
}
async function stored(page) {
  return page.evaluate((key) => localStorage.getItem(key), KEY);
}
async function backup(page) {
  return page.evaluate(() => structuredClone(db));
}
async function importBackup(page, data, mode = "restore") {
  await page.locator('[data-view="data"]').click();
  await page.locator("#backupMode").selectOption(mode);
  await page.locator("#importFile").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  // Successful imports show a confirmation followed by a result alert; rejected
  // files show only a result alert. Wait for that result rather than a timer.
  const completed = new Promise((resolve) => {
    function onDialog(dialog) {
      if (dialog.type() === "alert") {
        page.off("dialog", onDialog);
        resolve();
      }
    }
    page.on("dialog", onDialog);
  });
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await completed;
}
async function stage(page, payload) {
  await page.locator('[data-view="inbox"]').click();
  await page.locator("#inboxRaw").fill(JSON.stringify(payload));
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
}
const workout = (sets, extra = {}) => ({ date: "2026-10-23", sets, ...extra });
const set = (extra = {}) => ({
  exercise: "Bench Press",
  weight: 100,
  reps: 8,
  ...extra,
});

test("GymBro boots, navigates all tabs, saves a set, reloads and exports it", async (t) => {
  const p = await app(t);
  assert.equal(
    await p.title(),
    await p.evaluate(() => `GymBro ${APP_VERSION.version}`),
  );
  for (const view of [
    "dashboard",
    "program",
    "workout",
    "history",
    "inbox",
    "exercises",
    "data",
  ]) {
    await p.locator(`[data-view="${view}"]`).click();
    assert.equal(await p.locator(`#${view}`).isVisible(), true);
  }
  await p.locator('[data-view="workout"]').click();
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("100");
  await p.locator("#fReps").fill("8");
  await p.locator("#fNotes").fill("persist me");
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  assert.equal((await backup(p)).sets.length, 85);
  await p.reload();
  assert.equal((await backup(p)).sets.at(-1).notes, "persist me");
  const downloading = p.waitForEvent("download");
  await p.getByRole("button", { name: "Backup", exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await fs.readFile(await download.path(), "utf8"));
  assert.equal(exported.sets.at(-1).notes, "persist me");
  assert.equal(exported.version, 8);
});

test("corrupt, malformed and future-version storage remains byte-for-byte intact", async (t) => {
  const p = await app(t);
  for (const raw of [
    "{broken",
    JSON.stringify({ version: 99, sets: [], bodyweights: [] }),
    JSON.stringify({ version: 4, sets: [null], bodyweights: [] }),
  ]) {
    await p.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [KEY, raw],
    );
    await p.reload();
    assert.equal(await stored(p), raw);
    assert.equal(await p.locator("#storageNotice").isVisible(), true);
    assert.equal(
      await p.evaluate(
        () =>
          workoutActions.logBodyweight({ date: "2026-10-23", value: 210 }).ok,
      ),
      false,
    );
    assert.equal(await stored(p), raw);
  }
});

test("unavailable storage reports recovery state without crashing startup", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Unavailable", "SecurityError");
      },
    }),
  );
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(origin);
  assert.equal(await p.locator("#storageNotice").isVisible(), true);
  assert.match(await p.locator("#storageMessage").innerText(), /Unavailable/);
  assert.deepEqual(errors, []);
});

test("failed storage write rolls back state and keeps input available", async (t) => {
  const p = await app(t);
  const initial = await backup(p);
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await p.locator('[data-view="workout"]').click();
  await p.locator("#fExercise").fill("Seated Row");
  await p.locator("#fWeight").fill("90");
  await p.locator("#fReps").fill("10");
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  assert.deepEqual(await backup(p), initial);
  assert.equal(await p.locator("#fReps").inputValue(), "10");
  assert.match(await p.locator("#storageMessage").innerText(), /not saved/);
});

test("V1.5 migration preserves customized program, history and preferences", async (t) => {
  const p = await app(t);
  const legacy = await p.evaluate(() => structuredClone(seed));
  legacy.program.templates[0].slots.pop();
  legacy.preferences.custom = "my preference";
  const raw = JSON.stringify(legacy);
  await p.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [KEY, raw],
  );
  await p.reload();
  assert.equal(await stored(p), raw, "startup does not rewrite data");
  const migrated = await backup(p);
  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.program, legacy.program);
  assert.deepEqual(migrated.sets, legacy.sets);
  assert.equal(migrated.preferences.custom, "my preference");
});

test("complete backup restores configuration, notes and explicit incomplete records", async (t) => {
  const p = await app(t);
  const data = await backup(p);
  data.program.name = "My edited split";
  data.program.templates[0].slots.pop();
  data.preferences.custom = "keep";
  data.exerciseLibrary.Custom = {
    primary: "Back",
    secondary: [],
    pattern: "Pull",
    type: "Compound",
    status: "new",
  };
  data.sets[0].complete = false;
  data.imports = [
    {
      importId: "old-import",
      batch: "old",
      date: "2026-10-23",
      setCount: 0,
      notes: "session note",
    },
  ];
  await importBackup(p, data);
  assert.deepEqual(await backup(p), data);
  await p.reload();
  assert.deepEqual(await backup(p), data);
});

test("invalid backup does not partially mutate or persist data", async (t) => {
  const p = await app(t);
  const initial = await backup(p);
  const invalid = structuredClone(initial);
  invalid.sets.push({ ...invalid.sets[0] });
  await importBackup(p, invalid);
  assert.deepEqual(await backup(p), initial);
  assert.equal(await stored(p), null);
  invalid.sets.at(-1).id = "new";
  invalid.sets.at(-1).date = "2026-02-31";
  await importBackup(p, invalid);
  assert.deepEqual(await backup(p), initial);
});

test("explicit restore recovers unreadable data and merge stays idempotent", async (t) => {
  const p = await app(t);
  const data = await backup(p);
  data.sets = [{ ...data.sets[0], id: "new-history", exercise: "Custom Move" }];
  data.program.name = "restored";
  await p.evaluate((key) => localStorage.setItem(key, "broken"), KEY);
  await p.reload();
  await importBackup(p, data);
  assert.deepEqual(await backup(p), data);
  const incoming = structuredClone(data);
  incoming.program.name = "do not merge";
  incoming.preferences.other = "skip";
  incoming.sets.push({ ...incoming.sets[0], id: "second" });
  await importBackup(p, incoming, "merge");
  await importBackup(p, incoming, "merge");
  const result = await backup(p);
  assert.equal(result.sets.length, 2);
  assert.equal(result.program.name, "restored");
  assert.equal(result.preferences.other, undefined);
});

test("invalid dates, loads, effort, bodyweight and units block import commits", async (t) => {
  const p = await app(t);
  const initial = await backup(p);
  const invalid = [
    workout([set()], { date: "2026-02-31" }),
    workout([set({ weight: "bad" })]),
    workout([set({ reps: -3 })]),
    workout([set({ reps: 2.5 })]),
    workout([set({ rpe: 11 })]),
    workout([set({ rir: 1.5 })]),
    workout([set({ pain: -1 })]),
    workout([set({ unit: "kg" })]),
    workout([set()], { bodyweight: -1 }),
    workout([set()], { duration: -5 }),
  ];
  for (const payload of invalid) {
    await stage(p, payload);
    assert.equal(await p.locator("#commitInboxBtn").isDisabled(), true);
    await p.evaluate(() => commitInbox());
    assert.deepEqual(await backup(p), initial);
  }
});

test("incomplete imports and session notes survive commit/reload; duplicate blocked", async (t) => {
  const p = await app(t);
  const payload = workout([set({ complete: false }), set({ weight: null })], {
    importId: "incomplete",
    notes: "Recovery day",
  });
  await stage(p, payload);
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), false);
  await p.locator("#commitInboxBtn").click();
  let result = await backup(p);
  assert.equal(result.sets.at(-2).complete, false);
  assert.equal(result.sets.at(-1).complete, false);
  assert.equal(result.imports.at(-1).notes, "Recovery day");
  await p.reload();
  result = await backup(p);
  assert.equal(result.imports.at(-1).notes, "Recovery day");
  await stage(p, payload);
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), true);
  await p.evaluate(() => commitInbox());
  assert.equal((await backup(p)).sets.length, 86);
});

test("review corrections and excluded invalid rows update commit readiness", async (t) => {
  const p = await app(t);
  await stage(p, workout([set({ reps: -1 }), set()]));
  await p.getByLabel("Set 1 Reps", { exact: true }).fill("6");
  await p.getByLabel("Set 1 Reps", { exact: true }).blur();
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), false);
  await p.getByLabel("Set 1 Reps", { exact: true }).fill("-1");
  await p.getByLabel("Set 1 Reps", { exact: true }).blur();
  await p.getByLabel("Include set 1", { exact: true }).uncheck();
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), false);
  await p.locator("#commitInboxBtn").click();
  assert.equal((await backup(p)).sets.length, 85);
});

test("analytics exclude incomplete, assisted, bodyweight and incompatible loads", async (t) => {
  const p = await app(t);
  const result = await p.evaluate(() => {
    db.sets = [
      {
        exercise: "Test",
        date: "2026-10-20",
        weight: 999,
        reps: 10,
        complete: false,
        unit: "lb",
      },
      {
        exercise: "Test",
        date: "2026-10-21",
        weight: 999,
        reps: 10,
        complete: true,
        unit: "assist lb",
      },
      {
        exercise: "Test",
        date: "2026-10-22",
        weight: 30,
        reps: 10,
        complete: true,
        unit: "lb",
      },
      {
        exercise: "Test",
        date: "2026-10-23",
        weight: 20,
        reps: 10,
        complete: true,
        unit: "lb/side",
      },
      {
        exercise: "Test",
        date: "2026-10-24",
        weight: 100,
        reps: 10,
        complete: true,
        unit: "bodyweight",
      },
    ];
    return bestByDate("Test").map((x) => ({ date: x.date, score: x.score }));
  });
  assert.deepEqual(result, [{ date: "2026-10-23", score: 200 }]);
});

test("quotes and markup in exercise names, IDs and metadata are rendered safely", async (t) => {
  const p = await app(t);
  const name = `Trainer's "row" <img src=x onerror="window.hacked=1">`;
  await stage(
    p,
    workout([set({ exercise: name })], {
      importId: `x'");window.hacked=1;//`,
      notes: '<img src=x onerror="window.hacked=1">',
    }),
  );
  await p.locator("#commitInboxBtn").click();
  await p.locator('[data-view="exercises"]').click();
  await p.locator("#exerciseTable tr").filter({ hasText: name }).click();
  assert.equal(await p.locator("#exerciseDetailTitle").innerText(), name);
  await showHistoryDetails(p);
  await p
    .locator("#historyTable tr")
    .filter({ hasText: name })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  assert.equal(await p.locator("#fExercise").inputValue(), name);
  assert.equal(await p.evaluate(() => window.hacked), undefined);
  assert.equal(
    await p
      .locator("#historyTable img, #importHistory img, #exerciseTable img")
      .count(),
    0,
  );
});

test("editing and deleting imported sets preserves import deduplication metadata", async (t) => {
  const p = await app(t);
  await stage(p, workout([set({ complete: false })], { importId: "edit-me" }));
  await p.locator("#commitInboxBtn").click();
  await showHistoryDetails(p);
  await p
    .locator("#historyTable tr")
    .filter({ hasText: "chatgpt" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  assert.equal(await p.locator("#fApproximate").isChecked(), true);
  await p.locator("#fReps").fill("12");
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal((await backup(p)).sets.at(-1).reps, 12);
  assert.equal((await backup(p)).sets.at(-1).complete, false);
  await showHistoryDetails(p);
  await p
    .locator("#historyTable tr")
    .filter({ hasText: "chatgpt" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  assert.equal((await backup(p)).imports.at(-1).setCount, 0);
  await stage(p, workout([set()], { importId: "edit-me" }));
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), true);
});

test("program edits persist and exercise detail refreshes after a logged set", async (t) => {
  const p = await app(t);
  const before = (await backup(p)).program.templates[0].slots[0].short;
  await p.locator('[data-view="program"]').click();
  await p.locator(".template-card").first().click();
  await p
    .locator("#templateEditor")
    .getByRole("button", { name: "30m", exact: true })
    .first()
    .click();
  await p.reload();
  assert.equal((await backup(p)).program.templates[0].slots[0].short, !before);
  await p.evaluate(() => {
    selectedExercise = "Bench Press";
    renderExercises();
  });
  await p.locator('[data-view="workout"]').click();
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("200");
  await p.locator("#fReps").fill("20");
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  assert.match(await p.locator("#exerciseDetail").innerText(), /200 lb × 20/);
});

test("a second tab pauses stale writes and leaves its committed data intact", async (t) => {
  const p = await app(t);
  const other = await p.context().newPage();
  await other.goto(origin);
  await other.evaluate(() =>
    workoutActions.logBodyweight({ date: "2026-10-23", value: 212.1 }),
  );
  await p.waitForFunction(() => storageState.stale);
  const raw = await stored(p);
  assert.equal(
    await p.evaluate(
      () => workoutActions.logBodyweight({ date: "2026-10-23", value: 213 }).ok,
    ),
    false,
  );
  assert.equal(await stored(p), raw);
  await p.reload();
  assert.equal((await backup(p)).bodyweights.at(-1).value, 212.1);
});

test("local workout date remains local when UTC has advanced to tomorrow", async (t) => {
  const p = await app(t, { timezoneId: "America/New_York" });
  const result = await p.evaluate(() => {
    const RealDate = Date;
    const fixed = RealDate.parse("2026-10-24T01:00:00Z");
    window.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }
    };
    return today();
  });
  assert.equal(result, "2026-10-23");
});

test("generated import IDs match V1.5 for complete and incomplete payloads", async (t) => {
  const p = await app(t);
  // Captured from the original V1.5 normalizer, so old committed imports stay blocked.
  const payloads = [
    workout([set()]),
    workout([set({ weight: null })]),
    workout([set({ complete: false })]),
  ];
  const ids = await p.evaluate(
    (values) => values.map((value) => normalizeInboxPayload(value).importId),
    payloads,
  );
  assert.deepEqual(ids, ["62886416", "71a6094d", "ed88363d"]);
});

test("nested exercise imports retain zero values, notes and pain area", async (t) => {
  const p = await app(t);
  await stage(p, {
    schema: "gym-tracker-chatgpt-v1",
    date: "2026-10-23",
    importId: "nested",
    exercises: [
      {
        exercise: "Seated Row",
        sets: [
          {
            weight: 0,
            reps: 5,
            rir: 0,
            pain: 0,
            painArea: "shoulder",
            notes: "warmup",
          },
        ],
      },
    ],
  });
  await p.locator("#commitInboxBtn").click();
  const row = (await backup(p)).sets.at(-1);
  assert.equal(row.weight, 0);
  assert.equal(row.rir, 0);
  assert.equal(row.pain, 0);
  assert.equal(row.notes, "warmup");
  assert.equal(row.painArea, "shoulder");
  assert.equal(row.complete, true);
});

test("CSV export quotes text and neutralizes formula-like cells", async (t) => {
  const p = await app(t);
  await stage(p, workout([set({ notes: '=HYPERLINK("x")' })]));
  await p.locator("#commitInboxBtn").click();
  await p.locator('[data-view="data"]').click();
  const downloading = p.waitForEvent("download");
  await p.getByRole("button", { name: "Export sets CSV", exact: true }).click();
  const download = await downloading;
  const text = await fs.readFile(await download.path(), "utf8");
  assert(text.includes(`"'=HYPERLINK(""x"")"`));
  assert.equal((await backup(p)).sets.at(-1).notes, '=HYPERLINK("x")');
});

test("opening index.html directly still loads the app and its assets", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (error) => errors.push(error.message));
  try {
    await p.goto(
      require("node:url").pathToFileURL(
        path.resolve(__dirname, "../index.html"),
      ).href,
    );
  } catch (error) {
    if (!error.message.includes("ERR_BLOCKED_BY_ADMINISTRATOR")) throw error;
    t.skip(
      "Managed Chromium policy blocks file URLs; HTTP workflow is tested separately.",
    );
    return;
  }
  assert.equal(await p.locator("#kpis .kpi").count(), 4);
  assert.equal(
    await p.locator(".brand-logo").evaluate((image) => image.naturalWidth > 0),
    true,
  );
  assert.deepEqual(errors, []);
});

test("logging from a plan cancels edit mode before creating a new set", async (t) => {
  const p = await app(t);
  const original = (await backup(p)).sets[0];
  await p.evaluate((id) => {
    editSet(id);
    loadExerciseToForm("Seated Row");
  }, original.id);
  assert.equal(await p.locator("#saveSetBtn").innerText(), "Add set");
  await p.locator("#fReps").fill("6");
  await p.locator("#saveSetBtn").click();
  const result = await backup(p);
  assert.deepEqual(result.sets[0], original);
  assert.equal(result.sets.length, 85);
  assert.equal(result.sets.at(-1).exercise, "Seated Row");
});

test("mobile layout keeps the primary form within the viewport", async (t) => {
  const p = await app(t, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await p.locator('[data-view="workout"]').click();
  const bounds = await p.locator("#fExercise").boundingBox();
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await stage(p, workout([set()]));
  assert.equal(await p.locator("#commitInboxBtn").isVisible(), true);
});

test("all views fit narrow phone widths without page overflow", async (t) => {
  const p = await app(t, { isMobile: true, hasTouch: true });
  for (const width of [320, 375, 390, 430]) {
    await p.setViewportSize({ width, height: 844 });
    for (const view of [
      "dashboard",
      "program",
      "workout",
      "history",
      "inbox",
      "exercises",
      "data",
    ]) {
      await p.locator(`[data-view="${view}"]`).click();
      const pageWidth = await p.evaluate(
        () => document.documentElement.scrollWidth,
      );
      assert(pageWidth <= width, `${view}: ${pageWidth}px exceeds ${width}px`);
    }
  }
});

test("Latest shows assisted, bodyweight and zero-load history without ranking it", async (t) => {
  const p = await app(t);
  await p.locator('[data-view="exercises"]').click();
  await p
    .locator("#exerciseTable tr")
    .filter({ hasText: "Dip Machine" })
    .click();
  const latest = p
    .locator("#exerciseDetail .grid > div")
    .filter({ has: p.locator(".label", { hasText: /^Latest$/ }) });
  assert.match(await latest.innerText(), /75 assist lb × 8/);
  assert.deepEqual(await p.evaluate(() => bestByDate("Dip Machine")), []);
  for (const [unit, weight] of [
    ["bodyweight", 0],
    ["lb", 0],
    ["assist lb", 50],
  ]) {
    await stage(
      p,
      workout([set({ exercise: "Latest check", unit, weight })], {
        importId: `latest-${unit}`,
      }),
    );
    await p.locator("#commitInboxBtn").click();
    await p.locator('[data-view="exercises"]').click();
    await p
      .locator("#exerciseTable tr")
      .filter({ hasText: "Latest check" })
      .click();
    assert.match(await latest.innerText(), new RegExp(`${weight} ${unit} × 8`));
    assert.deepEqual(await p.evaluate(() => bestByDate("Latest check")), []);
  }
  await p.reload();
  await p.locator('[data-view="exercises"]').click();
  await p
    .locator("#exerciseTable tr")
    .filter({ hasText: "Latest check" })
    .click();
  assert.match(await latest.innerText(), /50 assist lb × 8/);
});

test("action API uses real persistence without rendering or alerts and returns detached state", async (t) => {
  const p = await app(t);
  const result = await p.evaluate(() => {
    // Disabling effects catches accidental coupling without altering the DOM itself.
    const realRender = renderAll,
      realNotice = renderStorageNotice,
      realAlert = window.alert;
    renderAll =
      renderStorageNotice =
      window.alert =
        () => {
          throw Error("UI effect in action");
        };
    try {
      const before = getWorkoutState();
      const logged = workoutActions.logSet({
        date: "2026-10-23",
        exercise: "Bench Press",
        weight: 95,
        reps: 6,
        notes: "API",
      });
      const inspected = getWorkoutState();
      inspected.sets.length = 0;
      return {
        logged,
        length: getWorkoutState().sets.length,
        beforeLength: before.sets.length,
        persisted: JSON.parse(localStorage.getItem(KEY)),
      };
    } finally {
      renderAll = realRender;
      renderStorageNotice = realNotice;
      window.alert = realAlert;
    }
  });
  assert.equal(result.logged.ok, true);
  assert.equal(result.length, result.beforeLength + 1);
  assert.equal(result.persisted.sets.at(-1).id, result.logged.setId);
  assert.deepEqual(result.persisted, result.logged.state);
});

test("failed import and edit writes retain their review/form inputs and committed data", async (t) => {
  const p = await app(t);
  await stage(
    p,
    workout([set({ exercise: "New failed exercise" })], {
      importId: "write-failure",
      notes: "keep draft",
    }),
  );
  const before = await backup(p);
  const draft = await p.evaluate(() => structuredClone(inboxDraft));
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await p.locator("#commitInboxBtn").click();
  assert.deepEqual(await backup(p), before);
  assert.deepEqual(await p.evaluate(() => structuredClone(inboxDraft)), draft);
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), false);
  assert.equal(await stored(p), null);
  await p.evaluate((id) => editSet(id), before.sets[0].id);
  await p.locator("#fNotes").fill("unsaved correction");
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal(await p.locator("#fNotes").inputValue(), "unsaved correction");
  assert.equal(await p.locator("#saveSetBtn").innerText(), "Save changes");
  assert.deepEqual(await backup(p), before);
});

test("v5 storage migrates without writing or changing old records; failed first session write keeps raw v5 intact", async (t) => {
  const p = await app(t);
  const legacy = await backup(p);
  legacy.version = 5;
  delete legacy.sessions;
  delete legacy.activeSessionId;
  legacy.sets[0].customMetadata = { retained: ["all fields", 0] };
  const raw = JSON.stringify(legacy);
  await p.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [KEY, raw],
  );
  await p.reload();
  const migrated = await backup(p);
  assert.equal(migrated.version, 8);
  assert.deepEqual(migrated.sets, legacy.sets);
  assert.deepEqual(migrated.sessions, []);
  assert.equal(migrated.activeSessionId, null);
  assert.equal(await stored(p), raw);
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  const failed = await p.evaluate(() =>
    workoutActions.createSession({ date: "2026-10-23", templateId: "push" }),
  );
  assert.equal(failed.code, "PERSISTENCE_ERROR");
  assert.equal(await stored(p), raw);
  assert.deepEqual(await backup(p), migrated);
  await p.reload();
  const created = await p.evaluate(() =>
    workoutActions.createSession({ date: "2026-10-23", templateId: "push" }),
  );
  assert.equal(created.ok, true);
  assert.equal(JSON.parse(await stored(p)).version, 8);
  assert.deepEqual((await backup(p)).sets, legacy.sets);
});

test("active session and manual set links survive reload and reopening; completion and second same-day session persist", async (t) => {
  let p = await app(t);
  const created = await p.evaluate(() =>
    workoutActions.createSession({
      date: "2026-10-23",
      templateId: "push",
      duration: 30,
    }),
  );
  assert.equal(created.ok, true);
  await p.locator('[data-view="workout"]').click();
  await p.locator("#fDate").fill("2026-10-23");
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("100");
  await p.locator("#fReps").fill("8");
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  const set = (await backup(p)).sets.at(-1);
  assert.equal(set.sessionId, created.sessionId);
  await p.reload();
  assert.equal(
    await p.evaluate(() => workoutActions.getActiveSession().id),
    created.sessionId,
  );
  const context = p.context();
  await p.close();
  p = await context.newPage();
  await p.goto(origin);
  assert.equal(
    await p.evaluate(() => workoutActions.getActiveSession().id),
    created.sessionId,
  );
  assert.deepEqual(
    await p.evaluate(() => workoutActions.getActiveSession().setIds),
    [set.id],
  );
  const completed = await p.evaluate(
    (id) => workoutActions.completeSession(id),
    created.sessionId,
  );
  assert.equal(completed.ok, true);
  await p.reload();
  assert.equal(await p.evaluate(() => workoutActions.getActiveSession()), null);
  const storedSession = await p.evaluate(
    (id) => workoutActions.getSession(id),
    created.sessionId,
  );
  assert.equal(storedSession.status, "completed");
  assert(storedSession.completedAt);
  const second = await p.evaluate(() =>
    workoutActions.createSession({
      date: "2026-10-23",
      templateId: "pull",
      duration: 60,
    }),
  );
  assert.equal(second.ok, true);
  assert.notEqual(second.sessionId, created.sessionId);
  assert.equal((await backup(p)).sessions.length, 2);
});

test("JSON export/restore/export preserves sessions and active pointer exactly; old V1.6 backup restores sessionless", async (t) => {
  const p = await app(t);
  await p.evaluate(() => {
    workoutActions.createSession({
      date: "2026-10-23",
      templateId: "push",
      duration: 30,
    });
    workoutActions.logSet({
      date: "2026-10-23",
      exercise: "Smith Press",
      weight: 50,
      reps: 8,
      unit: "lb/side",
      planSlotId: "slot-1",
    });
  });
  async function exported() {
    await p.locator('[data-view="data"]').click();
    const pending = p.waitForEvent("download");
    await p.getByRole("button", { name: "Export JSON", exact: true }).click();
    return JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
  }
  const first = await exported();
  assert.equal(first.sessions.length, 1);
  assert.equal(first.activeSessionId, first.sessions[0].id);
  await p
    .getByRole("button", { name: "Erase all local data", exact: true })
    .click();
  assert.deepEqual((await backup(p)).sessions, []);
  await importBackup(p, first);
  assert.deepEqual(await exported(), first);
  const legacy = structuredClone(first);
  legacy.version = 5;
  delete legacy.sessions;
  delete legacy.activeSessionId;
  legacy.sets = legacy.sets.filter((set) => !set.sessionId);
  await importBackup(p, legacy);
  const restored = await backup(p);
  assert.equal(restored.version, 8);
  assert.deepEqual(restored.sessions, []);
  assert.equal(restored.activeSessionId, null);
  assert.deepEqual(restored.sets, legacy.sets);
});

test("session create, completion and attachment retain stale-tab and write-failure protections", async (t) => {
  const p = await app(t);
  const manual = await p.evaluate(() =>
    workoutActions.logSet({
      date: "2026-10-23",
      exercise: "Bench Press",
      weight: 100,
      reps: 8,
    }),
  );
  const created = await p.evaluate(() =>
    workoutActions.createSession({ date: "2026-10-23" }),
  );
  const initial = await backup(p),
    raw = await stored(p);
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  const completed = await p.evaluate(
    (id) => workoutActions.completeSession(id),
    created.sessionId,
  );
  assert.equal(completed.code, "PERSISTENCE_ERROR");
  assert.deepEqual(await backup(p), initial);
  assert.equal(await stored(p), raw);
  await p.reload();
  const other = await p.context().newPage();
  await other.goto(origin);
  const otherCompletion = await other.evaluate(
    (id) => workoutActions.completeSession(id),
    created.sessionId,
  );
  assert.equal(otherCompletion.ok, true);
  await p.waitForFunction(() => storageState.stale);
  const updated = await stored(p);
  for (const result of await p.evaluate(
    ({ sessionId, setId }) => [
      workoutActions.completeSession(sessionId),
      workoutActions.attachSetToSession({ sessionId, setId }),
      workoutActions.logSet({
        date: "2026-10-23",
        exercise: "Bench Press",
        weight: 100,
        reps: 8,
      }),
    ],
    { sessionId: created.sessionId, setId: manual.setId },
  ))
    assert.equal(result.code, "PERSISTENCE_ERROR");
  assert.equal(await stored(p), updated);
  assert.deepEqual(await backup(p), initial);
  await p.reload();
  assert.equal(await p.evaluate(() => workoutActions.getActiveSession()), null);
});

test("malformed v6 sessions and future v9 storage remain untouched and block session writes", async (t) => {
  const p = await app(t);
  const valid = await backup(p);
  const malformed = structuredClone(valid);
  malformed.activeSessionId = "missing";
  const future = structuredClone(valid);
  future.version = 9;
  const missing = structuredClone(valid);
  delete missing.sessions;
  for (const data of [malformed, future, missing]) {
    const raw = JSON.stringify(data);
    await p.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [KEY, raw],
    );
    await p.reload();
    assert.equal(await stored(p), raw);
    assert.equal(await p.locator("#storageNotice").isVisible(), true);
    const result = await p.evaluate(() =>
      workoutActions.createSession({ date: "2026-10-23" }),
    );
    assert.equal(result.ok, false);
    assert.equal(await stored(p), raw);
  }
});

test("session history merge is atomic on conflicts and preserves all session links on success", async (t) => {
  const p = await app(t);
  const created = await p.evaluate(() =>
    workoutActions.createSession({ date: "2026-10-23", templateId: "push" }),
  );
  await p.evaluate(() =>
    workoutActions.logSet({
      date: "2026-10-23",
      exercise: "Bench Press",
      weight: 100,
      reps: 8,
    }),
  );
  const sessionBackup = await backup(p);
  await p.locator('[data-view="data"]').click();
  await p
    .getByRole("button", { name: "Erase all local data", exact: true })
    .click();
  await importBackup(p, sessionBackup, "merge");
  assert.deepEqual((await backup(p)).sessions, sessionBackup.sessions);
  assert.equal((await backup(p)).activeSessionId, created.sessionId);
  const before = await backup(p),
    raw = await stored(p),
    conflict = structuredClone(sessionBackup);
  conflict.sessions[0].planSnapshot.name = "conflicting intent";
  await importBackup(p, conflict, "merge");
  assert.deepEqual(await backup(p), before);
  assert.equal(await stored(p), raw);
});

test("a stale tab cannot create a competing session over another tab's persisted active session", async (t) => {
  const p = await app(t),
    initial = await backup(p),
    other = await p.context().newPage();
  await other.goto(origin);
  const created = await other.evaluate(() =>
    workoutActions.createSession({ date: "2026-10-23" }),
  );
  assert.equal(created.ok, true);
  await p.waitForFunction(() => storageState.stale);
  const raw = await stored(p);
  const result = await p.evaluate(() =>
    workoutActions.createSession({ date: "2026-10-23" }),
  );
  assert.equal(result.code, "PERSISTENCE_ERROR");
  assert.deepEqual(await backup(p), initial);
  assert.equal(await stored(p), raw);
  await p.reload();
  assert.equal(
    await p.evaluate(() => workoutActions.getActiveSession().id),
    created.sessionId,
  );
});

test("published synthetic iPhone fixture restores and logs through the existing mobile form", async (t) => {
  const p = await app(t, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const fixture = JSON.parse(
    await fs.readFile(path.join(__dirname, "fixtures/session-v6.json"), "utf8"),
  );
  await importBackup(p, fixture);
  assert.deepEqual(await backup(p), { ...fixture, version: 8, noteScopes: { session: [], exerciseSession: [], exercise: [] } });
  await p.locator('[data-view="workout"]').click();
  await p.locator("#fDate").fill(fixture.sessions[0].date);
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("100");
  await p.locator("#fReps").fill("8");
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  await p.reload();
  const saved = await backup(p),
    set = saved.sets[0];
  assert.equal(set.sessionId, fixture.activeSessionId);
  assert.equal(Object.hasOwn(set, "planSlotId"), false);
  assert.deepEqual(saved.sessions[0].setIds, [set.id]);
});

test("canonical version is visible across phone/desktop views and complete exports", async (t) => {
  const p = await app(t);
  const version = await p.evaluate(() => APP_VERSION.version);
  for (const width of [320, 390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    for (const view of [
      "dashboard",
      "program",
      "workout",
      "history",
      "inbox",
      "exercises",
      "data",
    ]) {
      await p.locator(`[data-view="${view}"]`).click();
      const footer = p.locator("#appVersion");
      assert.equal(await footer.textContent(), `GymBro ${version}`);
      await footer.scrollIntoViewIfNeeded();
      assert.equal(await footer.isVisible(), true);
      const box = await footer.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    }
  }
  assert.equal(await p.title(), `GymBro ${version}`);
  const original = await backup(p);
  const raw = await stored(p);
  const downloading = p.waitForEvent("download");
  await p.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(
    await fs.readFile(await (await downloading).path(), "utf8"),
  );
  assert.equal(exported.appVersion, version);
  assert.equal(exported.version, 8);
  const { appVersion, ...content } = exported;
  assert.deepEqual(content, original);
  assert.deepEqual(await backup(p), original);
  assert.equal(await stored(p), raw);
  await p.reload();
  assert.equal(
    await p.locator("#appVersion").textContent(),
    `GymBro ${version}`,
  );
});

test("restore accepts missing and differing application metadata using schema only", async (t) => {
  const p = await app(t);
  const legacy = await backup(p);
  legacy.version = 5;
  delete legacy.sessions;
  delete legacy.activeSessionId;
  delete legacy.appVersion;
  await importBackup(p, legacy);
  assert.equal((await backup(p)).version, 8);
  assert.deepEqual((await backup(p)).sets, legacy.sets);
  for (const appVersion of [
    undefined,
    "1.6.0-old-build",
    "99.8.7-20990101T000000Z",
  ]) {
    const compatible = await backup(p);
    if (appVersion === undefined) delete compatible.appVersion;
    else compatible.appVersion = appVersion;
    await importBackup(p, compatible);
    assert.deepEqual(await backup(p), compatible);
  }
});

test("history dates remain on one line at phone and desktop widths without page overflow", async (t) => {
  const p = await app(t);
  for (const width of [320, 390, 778, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    await showHistoryDetails(p);
    const measurements = await p
      .locator("#historyTable tbody td:first-child")
      .evaluateAll((cells) =>
        cells.map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return {
            date: cell.textContent,
            lines: range.getClientRects().length,
            width: cell.getBoundingClientRect().width,
          };
        }),
      );
    assert.ok(measurements.length > 0);
    for (const cell of measurements) {
      assert.match(cell.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(cell.lines, 1, `${cell.date} wraps at ${width}px`);
      assert.ok(cell.width >= 100);
    }
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(
      await p
        .locator("#historyTable")
        .evaluate((el) => getComputedStyle(el).overflowX),
      "auto",
    );
  }
});

test("application Help opens, scrolls and closes without changing workout state", async (t) => {
  const p = await app(t);
  const original = await backup(p);
  const raw = await stored(p);
  for (const width of [320, 390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    await p.getByRole("button", { name: "Help", exact: true }).click();
    const dialog = p.getByRole("dialog", { name: "GymBro help" });
    assert.equal(await dialog.isVisible(), true);
    for (const heading of [
      "Dashboard",
      "Program",
      "Workout",
      "History",
      "ChatGPT Inbox",
      "Exercises",
      "Data and backups",
    ]) {
      assert.equal(
        await dialog
          .getByRole("heading", { name: heading, exact: true })
          .count(),
        1,
      );
    }
    assert.equal(
      await p.locator("#helpVersion").textContent(),
      await p.evaluate(() => `GymBro ${APP_VERSION.version}`),
    );
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    assert.ok(box.y >= 0 && box.height <= 844);
    await p.locator("#helpVersion").scrollIntoViewIfNeeded();
    assert.ok(await dialog.evaluate((el) => el.scrollTop > 0));
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await dialog.isVisible(), false);
    assert.equal(
      await p
        .getByRole("button", { name: "Help", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
  }
  await p.getByRole("button", { name: "Help", exact: true }).click();
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("#helpDialog").isVisible(), false);
  assert.deepEqual(await backup(p), original);
  assert.equal(await stored(p), raw);
});

test("History icon actions stay together, preserve accessible names and confirm deletion", async (t) => {
  const p = await app(t);
  await showHistoryDetails(p);
  for (const width of [320, 390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    const row = p.locator("#historyTable tbody tr").first();
    const edit = row.getByRole("button", { name: "Edit", exact: true });
    const remove = row.getByRole("button", { name: "Delete", exact: true });
    assert.equal(await edit.textContent(), "");
    assert.equal(await remove.textContent(), "");
    const a = await edit.boundingBox(),
      b = await remove.boundingBox();
    assert.equal(a.y, b.y);
    assert.ok(b.x + b.width - a.x <= 60, "Actions fit within 60px");
    assert.ok(
      a.width === 28 && a.height === 28 && b.width === 28 && b.height === 28,
    );
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  const original = await backup(p);
  // Cancel the existing confirmation: no set is removed.
  p.removeAllListeners("dialog");
  p.once("dialog", (dialog) => dialog.dismiss());
  await p
    .locator("#historyTable tbody tr")
    .first()
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  assert.deepEqual(await backup(p), original);
  p.on("dialog", (dialog) => dialog.accept());
  // Existing edit/delete regression tests also exercise these labelled icons.
  await p
    .locator("#historyTable tbody tr")
    .first()
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  assert.equal(
    await p
      .getByRole("button", { name: "Save changes", exact: true })
      .isVisible(),
    true,
  );
});

test("acronym hover explanations are limited to workout and import entry labels", async (t) => {
  const p = await app(t);
  await p.evaluate(() => {
    workoutActions.logSet({
      date: "2026-10-23",
      exercise: "Bench Press",
      weight: 100,
      reps: 8,
      unit: "lb",
      rpe: 8,
    });
    renderHistory();
  });
  assert.match(
    await p.locator('label[for="fRpe"] abbr').getAttribute("title"),
    /Rating of Perceived Exertion/,
  );
  assert.match(
    await p.locator('label[for="fRir"] abbr').getAttribute("title"),
    /Repetitions in Reserve/,
  );
  await showHistoryDetails(p);
  assert.equal(await p.locator("#historyTable abbr").count(), 0);
  await p.evaluate(() => renderHistory());
  assert.equal(await p.locator("#historyTable abbr").count(), 0);
  assert.equal(
    await p.locator("#todaySets abbr, #helpDialog abbr, #data abbr").count(),
    0,
  );
  assert.equal(await p.locator("#data button[title]").count(), 0);
  await stage(p, workout([set({ rpe: 8, rir: 2 })]));
  assert.match(
    await p
      .locator("#inboxReview abbr")
      .filter({ hasText: /^RPE$/ })
      .first()
      .getAttribute("title"),
    /Rating/,
  );
  assert.match(
    await p
      .locator("#inboxReview abbr")
      .filter({ hasText: /^RIR$/ })
      .first()
      .getAttribute("title"),
    /Repetitions/,
  );
  assert.equal(await p.locator("abbr abbr").count(), 0);
});

test("corrected incomplete imports can be explicitly completed without losing metadata or dedup protection", async (t) => {
  const p = await app(t);
  await stage(
    p,
    workout(
      [set({ reps: null, complete: false, notes: "uncertain reps", rpe: 7 })],
      { importId: "correct-incomplete" },
    ),
  );
  await p.locator("#commitInboxBtn").click();
  const original = (await backup(p)).sets.at(-1);
  await showHistoryDetails(p);
  await p
    .locator("#historyTable tbody tr")
    .filter({ hasText: "uncertain reps" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  assert.equal(await p.locator("#incompleteEditNotice").isVisible(), true);
  assert.equal(await p.locator("#fApproximate").isChecked(), true);
  await p.getByRole("button", { name: "Mark complete", exact: true }).click();
  assert.equal(await p.locator("#fApproximate").isChecked(), true);
  assert.match(
    await p.locator("#incompleteEditMessage").textContent(),
    /positive whole-number reps/,
  );
  assert.deepEqual((await backup(p)).sets.at(-1), original);
  await p.locator("#fReps").fill("12");
  await p.getByRole("button", { name: "Mark complete", exact: true }).click();
  assert.equal(await p.locator("#fApproximate").isChecked(), false);
  assert.deepEqual((await backup(p)).sets.at(-1), original);
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  const corrected = (await backup(p)).sets.at(-1);
  assert.deepEqual(corrected, { ...original, reps: 12, complete: true });
  await p.reload();
  assert.deepEqual((await backup(p)).sets.at(-1), corrected);
  await showHistoryDetails(p);
  assert.doesNotMatch(
    await p
      .locator("#historyTable tbody tr")
      .filter({ hasText: "uncertain reps" })
      .innerText(),
    /incomplete/,
  );
  await stage(p, workout([set()], { importId: "correct-incomplete" }));
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), true);
});

test("marking an incomplete edit complete retains rollback on failed persistence", async (t) => {
  const p = await app(t);
  await stage(
    p,
    workout([set({ complete: false, notes: "keep approximate" })]),
  );
  await p.locator("#commitInboxBtn").click();
  const original = await backup(p),
    raw = await stored(p);
  await showHistoryDetails(p);
  await p
    .locator("#historyTable tbody tr")
    .filter({ hasText: "keep approximate" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await p.getByRole("button", { name: "Mark complete", exact: true }).click();
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
  });
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.deepEqual(await backup(p), original);
  assert.equal(await stored(p), raw);
  assert.equal(await p.locator("#fApproximate").isChecked(), false);
  assert.equal(
    await p
      .getByRole("button", { name: "Save changes", exact: true })
      .isVisible(),
    true,
  );
});

async function sessionHistoryFixture(p) {
  return p.evaluate(() => {
    const requireOk = (result) => {
      if (!result.ok) throw Error(JSON.stringify(result));
      return result;
    };
    const date = "2026-10-23";
    const first = requireOk(
      workoutActions.createSession({ date, templateId: "push", duration: 60 }),
    ).sessionId;
    const a = requireOk(
      workoutActions.logSet({
        date,
        exercise: "Seated Row",
        weight: 100,
        unit: "lb",
        reps: 8,
        rpe: 8,
        rir: 2,
        pain: 3,
        painArea: "elbow",
        notes: "session-first",
      }),
    ).setId;
    const b = requireOk(
      workoutActions.logSet({
        date,
        exercise: "Bench Press",
        weight: 50,
        unit: "lb",
        reps: 10,
        complete: false,
        notes: "session-second",
      }),
    ).setId;
    requireOk(workoutActions.completeSession(first));
    const second = requireOk(
      workoutActions.createSession({ date, templateId: "push", duration: 30 }),
    ).sessionId;
    const c = requireOk(
      workoutActions.logSet({
        date,
        exercise: "Bench Press",
        weight: 60,
        unit: "lb",
        reps: 6,
        notes: "other-session",
      }),
    ).setId;
    requireOk(
      workoutActions.logSet({
        date,
        sessionId: null,
        exercise: "Bench Press",
        weight: 0,
        unit: "bodyweight",
        reps: 12,
        notes: "manual-sessionless",
      }),
    );
    requireOk(
      workoutActions.commitImport(
        normalizeInboxPayload({
          date,
          importId: "m3-legacy-import",
          sets: [
            {
              exercise: "Bench Press",
              weight: 25,
              unit: "lb",
              reps: null,
              complete: false,
              notes: "legacy-import-only",
            },
          ],
        }),
      ),
    );
    renderAll();
    return { first, second, a, b, c };
  });
}

async function exerciseHistoryFixture(p) {
  return p.evaluate(() => {
    const ok = result => { if (!result.ok) throw Error(JSON.stringify(result)); return result; };
    const date = "2026-10-24";
    const sessionId = ok(workoutActions.createSession({ date, templateId: "push", duration: 60 })).sessionId;
    const inputs = [
      { exercise: "Seated Row", weight: 100, unit: "lb", reps: 8 },
      { exercise: "Seated Row", weight: 0, unit: "bodyweight", reps: 10 },
      { exercise: "Bench Press", weight: 45, unit: "lb/side", reps: 6 },
      { exercise: "Seated Row", weight: 25, unit: "assist lb", reps: null, complete: false },
    ];
    const ids = inputs.map(input => ok(workoutActions.logSet({ date, ...input })).setId);
    ok(workoutActions.completeSession(sessionId));
    const legacyIds = inputs.map(input => ok(workoutActions.logSet({ date, sessionId: null, ...input })).setId);
    // Deliberately hide the intervening B and the first A under the manual filter.
    for (const id of [ids[0], ids[2], legacyIds[0], legacyIds[2]]) db.sets.find(set => set.id === id).source = "chatgpt";
    // Explicit session order must come from setIds, not physical array order.
    db.sets = [...db.sets.filter(set => !ids.includes(set.id)), ...ids.slice().reverse().map(id => db.sets.find(set => set.id === id))];
    renderAll();
    return { sessionId, ids, legacyIds };
  });
}

test("exercise disclosure preserves consecutive occurrences, source/state boundaries and data without writes", async (t) => {
  const p = await app(t);
  const { sessionId, ids, legacyIds } = await exerciseHistoryFixture(p);
  const original = await backup(p), raw = await stored(p);
  await p.evaluate(() => {
    window.disclosureWrites = 0;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) { window.disclosureWrites++; return write.apply(this, args); };
  });
  await p.locator('[data-view="history"]').click();
  const session = p.locator(`[data-session-id="${sessionId}"]`);
  await session.locator(':scope > details > summary').click();
  const runs = session.locator('.history-exercise');
  assert.equal(await runs.count(), 3);
  assert.equal(await session.locator('tbody tr:visible').count(), 0);
  assert.deepEqual(await runs.locator(':scope > summary > strong').allTextContents(), ['Seated Row', 'Bench Press', 'Seated Row']);
  assert.match(await runs.nth(0).locator(':scope > summary').innerText(), /2 sets · 100 lb × 8 · 0 bodyweight × 10/);
  assert.match(await runs.nth(2).locator(':scope > summary').innerText(), /25 assist lb × — \(incomplete\)/);
  await runs.nth(0).locator(':scope > summary').click();
  assert.deepEqual(await session.locator('tbody tr:visible').evaluateAll(rows => rows.map(row => row.dataset.setId)), ids.slice(0, 2));
  await runs.nth(2).locator(':scope > summary').click();
  assert.equal(await runs.nth(0).evaluate(el => el.open), true);
  await runs.nth(2).locator(':scope > summary').click();
  assert.equal(await runs.nth(2).evaluate(el => el.open), false);
  await p.locator('#historyFilter').selectOption('manual');
  assert.equal(await runs.count(), 2, 'hidden intervening exercise never combines repeated A');
  assert.equal(await runs.nth(0).evaluate(el => el.open), true, 'key survives filtering out first set');
  assert.deepEqual(await session.locator('tbody tr').evaluateAll(rows => rows.map(row => row.dataset.setId)), [ids[1], ids[3]]);
  await p.locator('#historyFilter').selectOption('imported');
  await p.locator('#historyFilter').selectOption('all');
  assert.equal(await runs.nth(0).evaluate(el => el.open), true);
  await p.evaluate(() => { renderAll(); renderHistory(); });
  assert.equal(await runs.nth(0).evaluate(el => el.open), true);
  await session.locator(':scope > details > summary').click();
  await session.locator(':scope > details > summary').click();
  assert.equal(await runs.nth(0).evaluate(el => el.open), true, 'outer disclosure retains inner choice');
  const legacy = p.locator('[data-legacy-date="2026-10-24"]');
  await legacy.locator(':scope > details > summary').click();
  assert.equal(await legacy.locator('.history-exercise').count(), 3);
  assert.deepEqual(await legacy.locator('tbody tr').evaluateAll(rows => rows.map(row => row.dataset.setId)), legacyIds);
  assert.match(await legacy.locator('tbody tr').nth(2).textContent(), /3\. Bench Press/);
  assert.deepEqual(await session.locator('tbody tr').evaluateAll(rows => rows.map(row => row.dataset.setId)), ids);
  await p.getByRole('button', { name: 'Expand all', exact: true }).click();
  assert.equal(await runs.nth(1).evaluate(el => el.open), false, 'session bulk control preserves exercise choices');
  await p.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await p.locator('[data-view="dashboard"]').click();
  await p.locator('[data-view="history"]').click();
  assert.equal(await p.locator('.history-exercise[open]').count(), 0);
  assert.equal(await p.evaluate(() => window.disclosureWrites), 0);
  assert.deepEqual(await backup(p), original);
  assert.equal(await stored(p), raw);
  await p.reload();
  await p.locator('[data-view="history"]').click();
  assert.equal(await p.locator('.history-exercise[open]').count(), 0);
});

for (const width of [320, 390, 1280]) {
  test(`exercise disclosure supports full-summary touch, keyboard and escaped text at ${width}px`, async (t) => {
    const p = await app(t, { viewport: { width, height: 900 }, hasTouch: true });
    const { sessionId, ids } = await exerciseHistoryFixture(p);
    await p.evaluate(id => {
      db.sets.find(set => set.id === id).exercise = '<img src=x onerror="window.exerciseXss=1">' + 'LongExerciseName'.repeat(8);
      renderHistory();
    }, ids[2]);
    await p.locator('[data-view="history"]').click();
    const session = p.locator(`[data-session-id="${sessionId}"] > details`);
    await session.locator(':scope > summary').click();
    const run = session.locator('.history-exercise').nth(1), summary = run.locator(':scope > summary');
    assert.equal(await p.locator('#historyTable img').count(), 0);
    assert.equal(await p.evaluate(() => window.exerciseXss), undefined);
    assert.match(await summary.innerText(), /<img src=x/);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const box = await summary.boundingBox();
    assert.ok(box.height >= 44 && box.width >= 150);
    await summary.tap({ position: { x: box.width - 8, y: box.height - 8 } });
    assert.equal(await run.evaluate(el => el.open), true);
    assert.equal(await session.evaluate(el => el.open), true);
    assert.ok(await run.getByRole('button', { name: 'Edit', exact: true }).isVisible());
    await run.locator('.set-record > summary').click();
    assert.equal(await run.evaluate(el => el.open), true);
    await summary.focus();
    await p.keyboard.press('Enter');
    assert.equal(await run.evaluate(el => el.open), false);
    await p.keyboard.press('Space');
    assert.equal(await run.evaluate(el => el.open), true);
    assert.match(await summary.evaluate(el => getComputedStyle(el, '::after').transform), /matrix\(0, 1, -1, 0/);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.locator('#history').screenshot({ path: `test-results/issue21-${width}.png` });
  });
}

test("History disclosure preserves independent session/date state through filters and rerenders without writing", async (t) => {
  const p = await app(t);
  const ids = await sessionHistoryFixture(p);
  const original = await backup(p), raw = await stored(p);
  await p.evaluate(() => {
    window.historyWrites = 0;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      window.historyWrites++;
      return write.apply(this, args);
    };
  });
  await p.locator('[data-view="history"]').click();
  const first = p.locator(`[data-session-id="${ids.first}"] .history-disclosure`);
  const second = p.locator(`[data-session-id="${ids.second}"] .history-disclosure`);
  const legacy = p.locator('[data-legacy-date="2026-10-23"] .history-disclosure');
  assert.equal(await p.locator('.history-disclosure[open]').count(), 0);
  assert.equal(await p.locator('#historyTable tbody tr:visible').count(), 0);
  assert.match(await first.locator(':scope > summary').innerText(), /2 sets · 2 exercises/);
  assert.match(await first.locator(':scope > summary').innerText(), /Seated Row · Bench Press/);
  assert.match(await legacy.locator(':scope > summary').innerText(), /Legacy \/ sessionless/);
  assert.doesNotMatch(await legacy.locator(':scope > summary').innerText(), /no saved session identity/);
  assert.equal(await first.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
  await first.locator(':scope > summary').click();
  assert.equal(await first.evaluate(el => el.open), true);
  assert.deepEqual(await first.locator('tbody tr').evaluateAll(rows => rows.map(row => row.dataset.setId)), [ids.a, ids.b]);
  await second.locator(':scope > summary').click();
  await first.locator(':scope > summary').click();
  assert.equal(await first.evaluate(el => el.open), false);
  assert.equal(await second.evaluate(el => el.open), true);
  await legacy.locator(':scope > summary').click();
  assert.match(await legacy.locator('h3').getAttribute('title'), /no saved session identity/);
  assert.doesNotMatch(await legacy.locator('.history-details').innerText(), /Grouped by date|Open an exercise|Import IDs remain|Exercises shown:/);
  await legacy.locator('.history-exercise > summary').first().click();
  await legacy.locator('.set-record summary').first().click();
  assert.equal(await legacy.evaluate(el => el.open), true, 'nested metadata does not toggle its card');
  await p.evaluate(() => { renderAll(); renderHistory(); });
  assert.equal(await first.evaluate(el => el.open), false);
  assert.equal(await second.evaluate(el => el.open), true);
  assert.equal(await legacy.evaluate(el => el.open), true);
  await p.locator('#historyFilter').selectOption('imported');
  assert.equal(await p.locator('[data-session-id]').count(), 0);
  await p.locator('#historyFilter').selectOption('all');
  assert.equal(await first.evaluate(el => el.open), false);
  assert.equal(await second.evaluate(el => el.open), true);
  assert.equal(await legacy.evaluate(el => el.open), true);
  await p.getByRole('button', { name: 'Expand all', exact: true }).click();
  assert.equal(await p.locator('.history-disclosure:not([open])').count(), 0);
  await p.locator('[data-view="history"]').click();
  assert.equal(await p.locator('.history-disclosure:not([open])').count(), 0, 'same-view click keeps state');
  await p.getByRole('button', { name: 'Collapse all', exact: true }).click();
  assert.equal(await p.locator('.history-disclosure[open]').count(), 0);
  await second.locator(':scope > summary').click();
  await p.locator('[data-view="dashboard"]').click();
  await p.locator('[data-view="history"]').click();
  assert.equal(await p.locator('.history-disclosure[open]').count(), 0, 'new visit starts collapsed');
  assert.equal(await p.evaluate(() => window.historyWrites), 0);
  assert.deepEqual(await backup(p), original);
  assert.equal(await stored(p), raw);
  await first.locator(':scope > summary').click();
  await p.reload();
  await p.locator('[data-view="history"]').click();
  assert.equal(await p.locator('.history-disclosure[open]').count(), 0, 'reload starts collapsed');
  assert.equal(await stored(p), raw);
});

for (const width of [320, 390, 1280]) {
  test(`History full-header touch and keyboard disclosure fits ${width}px with escaped summaries`, async (t) => {
    const p = await app(t, { viewport: { width, height: 900 }, hasTouch: true });
    const ids = await sessionHistoryFixture(p);
    await p.evaluate((id) => {
      const session = db.sessions.find(row => row.id === id);
      db.sessions.find(row => row.id !== id).planSnapshot.name = 'Push';
      session.planSnapshot.name = '<img src=x onerror="window.historyXss=1"> ' + 'LongWorkoutName'.repeat(12);
      db.noteScopes.session.push({ sessionId: id, text: 'Session context preserved' });
      renderAll();
    }, ids.first);
    const original = await backup(p), raw = await stored(p);
    await p.locator('[data-view="history"]').click();
    const card = p.locator(`[data-session-id="${ids.first}"] .history-disclosure`);
    const summary = card.locator(':scope > summary');
    assert.equal(await p.locator('#historyTable img').count(), 0);
    assert.equal(await p.evaluate(() => window.historyXss), undefined);
    assert.match(await summary.innerText(), /<img src=x/);
    const compact = p.locator('[data-legacy-date="2026-10-21"]');
    const preview = compact.locator('.history-exercise-preview');
    assert.match(await preview.innerText(), /Seated Row · Lat Pulldown.*\+5/s);
    assert.doesNotMatch(await preview.innerText(), /Rope Triceps Pushdown/);
    assert.equal(await preview.locator('span').first().evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
    assert.equal(await preview.locator('.history-more').isVisible(), true);
    assert.equal(await compact.locator('.history-details').isVisible(), false);
    const short = p.locator('[data-session-id="' + ids.second + '"] > details > summary');
    const shortBox = await short.boundingBox();
    assert.ok(shortBox.height >= 80 && shortBox.height <= 100, 'ordinary short-title row stays compact');
    assert.equal(await short.locator('.history-badges').count(), 0);
    assert.equal(await summary.evaluate(el => getComputedStyle(el).paddingTop), '10px');
    await compact.locator(':scope > details > summary').click();
    assert.match(await compact.locator('.history-exercise > summary').allTextContents().then(text => text.join(' ')), /Rope Triceps Pushdown/);
    assert.equal(await compact.locator('.history-exercises').count(), 0);
    assert.match(await compact.locator('h3').getAttribute('title'), /no saved session identity/);
    assert.doesNotMatch(await compact.locator('.history-details').innerText(), /Grouped by date|Open an exercise|Import IDs remain|Exercises shown:/);
    await compact.locator(':scope > details > summary').click();
    const box = await summary.boundingBox();
    assert.ok(box.height >= 44 && box.width >= 150);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.locator('#history').screenshot({ path: `test-results/issue20-collapsed-${width}.png` });
    // The lower-right padding is part of the full header tap target.
    await summary.tap({ position: { x: box.width - 10, y: box.height - 8 } });
    assert.equal(await card.evaluate(el => el.open), true);
    assert.match(await card.locator('.history-details').innerText(), /Session context preserved/);
    await summary.focus();
    await p.keyboard.press('Enter');
    assert.equal(await card.evaluate(el => el.open), false);
    await p.keyboard.press('Space');
    assert.equal(await card.evaluate(el => el.open), true);
    await card.locator('.history-exercise > summary').first().click();
    assert.ok(await card.getByRole('button', { name: 'Edit', exact: true }).first().isVisible());
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const name of ['Expand all', 'Collapse all']) {
      const control = p.getByRole('button', { name, exact: true });
      assert.ok((await control.boundingBox()).height >= 44);
    }
    await p.locator('#history').screenshot({ path: `test-results/issue20-expanded-${width}.png` });
    assert.deepEqual(await backup(p), original);
    assert.equal(await stored(p), raw);
  });
}

test("History shows same-day sessions, saved intent, ordered sets and separate legacy records without writing", async (t) => {
  const p = await app(t);
  const ids = await sessionHistoryFixture(p);
  const original = await backup(p),
    raw = await stored(p);
  await showHistoryDetails(p);
  const first = p.locator(`[data-session-id="${ids.first}"]`);
  const second = p.locator(`[data-session-id="${ids.second}"]`);
  assert.equal(await first.isVisible(), true);
  assert.equal(await second.isVisible(), true);
  assert.match(await first.innerText(), /60-minute mode/);
  assert.match(await first.innerText(), /completed/);
  assert.match(await second.innerText(), /30-minute mode/);
  assert.match(await second.innerText(), /active/);
  const savedName = original.sessions.find(
    (session) => session.id === ids.first,
  ).planSnapshot.name;
  assert.equal(
    await first.locator("h3").innerText(),
    `2026-10-23 · ${savedName}`,
  );
  assert.deepEqual(
    await first
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((row) => row.dataset.setId)),
    [ids.a, ids.b],
  );
  const row = first.locator(`[data-set-id="${ids.a}"]`);
  assert.match(await row.innerText(), /RPE 8 · 2 RIR/);
  assert.match(await row.innerText(), /3\/10 elbow/);
  assert.match(await row.innerText(), /session-first/);
  assert.match(
    await first.locator(`[data-set-id="${ids.b}"]`).innerText(),
    /incomplete/,
  );
  const legacy = p.locator('[data-legacy-date="2026-10-23"]');
  assert.match(await legacy.innerText(), /display only/);
  assert.match(await legacy.innerText(), /manual-sessionless/);
  assert.match(await legacy.innerText(), /legacy-import-only/);
  const imported = legacy
    .locator("tbody tr")
    .filter({ hasText: "legacy-import-only" });
  assert.match(await imported.innerText(), /chatgpt • incomplete/);
  await imported.locator("summary").click();
  const record = JSON.parse(await imported.locator("pre").textContent());
  assert.deepEqual(
    record,
    original.sets.find((set) => set.id === record.id),
  );
  assert.ok(record.importBatch);
  assert.equal(
    await p.locator("#historyTable tbody tr").count(),
    original.sets.length,
  );
  await p.evaluate(() => renderHistory());
  assert.deepEqual(await backup(p), original);
  assert.equal(await stored(p), raw);
});

test("session and legacy source filters retain all existing options and matching session order", async (t) => {
  const p = await app(t);
  const ids = await sessionHistoryFixture(p);
  await showHistoryDetails(p);
  const data = await backup(p);
  for (const source of ["imported", "manual", "chatgpt", "all"]) {
    await p.locator("#historyFilter").selectOption(source);
    const expected = data.sets
      .filter((set) => source === "all" || set.source === source)
      .map((set) => set.id)
      .sort();
    assert.deepEqual(
      (
        await p
          .locator("#historyTable tbody tr")
          .evaluateAll((rows) => rows.map((row) => row.dataset.setId))
      ).sort(),
      expected,
    );
    assert.equal(await p.locator("#historyTable abbr").count(), 0);
  }
  await p.locator("#historyFilter").selectOption("manual");
  assert.deepEqual(
    await p
      .locator(`[data-session-id="${ids.first}"] tbody tr`)
      .evaluateAll((rows) => rows.map((row) => row.dataset.setId)),
    [ids.a, ids.b],
  );
  await p.locator("#historyFilter").selectOption("chatgpt");
  assert.equal(await p.locator("[data-session-id]").count(), 0);
  assert.equal(await p.locator("[data-legacy-date]").count(), 1);
});

test("linked History edits/deletes preserve session identity, completion and authoritative ordering", async (t) => {
  const p = await app(t);
  const ids = await sessionHistoryFixture(p);
  const original = (await backup(p)).sessions.find(
    (session) => session.id === ids.first,
  );
  await showHistoryDetails(p);
  await p
    .locator(`[data-set-id="${ids.a}"]`)
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await p.locator("#fReps").fill("9");
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.deepEqual(
    (await backup(p)).sessions.find((session) => session.id === ids.first),
    original,
  );
  await showHistoryDetails(p);
  assert.match(
    await p.locator(`[data-set-id="${ids.a}"]`).innerText(),
    /session-first/,
  );
  await p
    .locator(`[data-set-id="${ids.a}"]`)
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  const saved = await backup(p);
  assert.deepEqual(
    saved.sessions.find((session) => session.id === ids.first),
    { ...original, setIds: [ids.b] },
  );
  assert.equal(
    saved.sets.some((set) => set.id === ids.a),
    false,
  );
  assert.deepEqual(
    await p
      .locator(`[data-session-id="${ids.first}"] tbody tr`)
      .evaluateAll((rows) => rows.map((row) => row.dataset.setId)),
    [ids.b],
  );
  await p
    .locator(`[data-set-id="${ids.b}"]`)
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  assert.match(
    await p.locator(`[data-session-id="${ids.first}"]`).innerText(),
    /No sets logged/,
  );
  assert.equal(
    (await backup(p)).sessions.find((session) => session.id === ids.first)
      .status,
    "completed",
  );
  await p.reload();
  await showHistoryDetails(p);
  assert.equal(
    await p.locator(`[data-session-id="${ids.first}"]`).isVisible(),
    true,
  );
});

test("History session cards and expanded record metadata fit narrow phones and desktop", async (t) => {
  const p = await app(t);
  await sessionHistoryFixture(p);
  await showHistoryDetails(p);
  await p.locator(".set-record summary").first().click();
  for (const width of [320, 390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const regions = await p
      .locator(".history-set-scroll")
      .evaluateAll((items) =>
        items.map((el) => ({
          width: el.clientWidth,
          overflow: getComputedStyle(el).overflowX,
        })),
      );
    assert.ok(regions.length > 1);
    assert.ok(
      regions.every((item) => item.width <= width && item.overflow === "auto"),
    );
  }
});

test("backup presentation and confirmation distinguish complete replacement from history merge; cancellation writes nothing", async (t) => {
  const p = await app(t);
  await sessionHistoryFixture(p);
  const original = await backup(p),
    raw = await stored(p);
  const incoming = structuredClone(original);
  incoming.preferences = { "Bench Press": "incoming preference" };
  incoming.program.name = "Replacement program";
  incoming.appVersion = "99.0.0-20990101T000000Z";
  await p.locator('[data-view="data"]').click();
  assert.match(await p.locator("#data").innerText(), /CSV contains sets only/);
  p.removeAllListeners("dialog");
  for (const mode of ["restore", "merge"]) {
    await p.locator("#backupMode").selectOption(mode);
    const effect = await p.locator("#backupEffect").innerText();
    assert.match(
      effect,
      mode === "restore" ? /replaces ALL/ : /Current program/,
    );
    assert.match(effect, /active|Active/);
    await p.locator("#importFile").setInputFiles({
      name: "review-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    const pending = p.waitForEvent("dialog");
    const clicking = p
      .getByRole("button", { name: "Import JSON", exact: true })
      .click();
    const dialog = await pending;
    assert.equal(dialog.type(), "confirm");
    assert.match(dialog.message(), /review-backup.json/);
    assert.match(dialog.message(), /Data schema: 8/);
    assert.match(dialog.message(), /99.0.0-20990101T000000Z/);
    assert.match(
      dialog.message(),
      mode === "restore"
        ? /COMPLETE RESTORE replaces ALL/
        : /HISTORY MERGE adds 0 sets/,
    );
    await dialog.dismiss();
    await clicking;
    assert.deepEqual(await backup(p), original);
    assert.equal(await stored(p), raw);
  }
});

test("complete export restore export preserves every supported section and metadata", async (t) => {
  const p = await app(t);
  await sessionHistoryFixture(p);
  const incoming = await backup(p);
  incoming.preferences = { "Bench Press": "custom preference" };
  incoming.program.name = "Custom full program";
  incoming.exerciseLibrary["Bench Press"].primary = "Custom muscle";
  incoming.bodyweights.push({ date: "2026-10-23", value: 202.5 });
  incoming.sets[0].customImportMetadata = {
    originalLine: 17,
    exporter: "legacy source",
  };
  incoming.additionalMetadata = { preserved: true };
  incoming.appVersion = "2.2.5-20261023T194400Z";
  await importBackup(p, incoming);
  assert.deepEqual(await backup(p), incoming);
  async function exportComplete() {
    const pending = p.waitForEvent("download");
    await p.getByRole("button", { name: "Export JSON", exact: true }).click();
    return JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
  }
  const first = await exportComplete();
  assert.deepEqual(first, {
    ...incoming,
    appVersion: await p.evaluate(() => APP_VERSION.version),
  });
  await p
    .getByRole("button", { name: "Erase all local data", exact: true })
    .click();
  assert.equal((await backup(p)).sets.length, 0);
  await importBackup(p, first);
  assert.deepEqual(await exportComplete(), first);
  assert.deepEqual(await backup(p), first);
  assert.equal(first.version, 8);
  assert.equal(first.sessions.length, 2);
  assert.ok(first.activeSessionId);
  assert.ok(first.imports.length > 0);
  assert.ok(first.bodyweights.length > 0);
});

test("history merge adds compatible records but preserves current program/library/preferences and existing IDs", async (t) => {
  const p = await app(t);
  await sessionHistoryFixture(p);
  const current = await backup(p),
    incoming = structuredClone(current);
  incoming.preferences = { "Bench Press": "do not replace current" };
  incoming.program.name = "Do not adopt incoming program";
  incoming.exerciseLibrary["Bench Press"].primary =
    "Do not adopt incoming definition";
  incoming.sets[0].notes = "Incoming duplicate ID must not overwrite";
  incoming.sets.push({
    ...current.sets.find((set) => set.sessionId == null),
    id: "m3-history-merge-new",
    date: "2026-10-24",
    exercise: "M3 new movement",
    notes: "compatible merged legacy record",
  });
  incoming.bodyweights.push({ date: "2026-10-24", value: 203 });
  await importBackup(p, incoming, "merge");
  const saved = await backup(p);
  assert.deepEqual(saved.program, current.program);
  assert.deepEqual(saved.preferences, current.preferences);
  assert.deepEqual(
    saved.exerciseLibrary["Bench Press"],
    current.exerciseLibrary["Bench Press"],
  );
  assert.ok(saved.exerciseLibrary["M3 new movement"]);
  assert.deepEqual(
    saved.sets.find((set) => set.id === current.sets[0].id),
    current.sets[0],
  );
  assert.deepEqual(saved.sessions, current.sessions);
  assert.equal(saved.activeSessionId, current.activeSessionId);
  assert.equal(saved.sets.length, current.sets.length + 1);
  assert.equal(saved.bodyweights.length, current.bodyweights.length + 1);
  await showHistoryDetails(p);
  assert.match(
    await p.locator('[data-legacy-date="2026-10-24"]').innerText(),
    /compatible merged legacy record/,
  );
  await importBackup(p, incoming, "merge");
  assert.deepEqual(await backup(p), saved);
});

test("filtering linked imports and deleting through History retains duplicate protection and session order", async (t) => {
  const p = await app(t);
  const ids = await sessionHistoryFixture(p);
  const linked = await p.evaluate(({ second }) => {
    const set = db.sets.find((row) => row.notes === "legacy-import-only");
    const result = workoutActions.attachSetToSession({
      setId: set.id,
      sessionId: second,
    });
    if (!result.ok) throw Error(JSON.stringify(result));
    renderAll();
    return set.id;
  }, ids);
  await showHistoryDetails(p);
  await p.locator("#historyFilter").selectOption("chatgpt");
  const group = p.locator(`[data-session-id="${ids.second}"]`);
  assert.match(await group.innerText(), /1 matching set · 2 sets in session/);
  assert.deepEqual(
    await group
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((row) => row.dataset.setId)),
    [linked],
  );
  assert.match(await group.locator("tbody td").nth(1).innerText(), /^2\./);
  await group.getByRole("button", { name: "Delete", exact: true }).click();
  const saved = await backup(p);
  assert.deepEqual(
    saved.sessions.find((session) => session.id === ids.second).setIds,
    [ids.c],
  );
  assert.equal(
    saved.imports.find((row) => row.importId === "m3-legacy-import").setCount,
    0,
  );
  await stage(p, workout([set()], { importId: "m3-legacy-import" }));
  assert.equal(await p.locator("#commitInboxBtn").isDisabled(), true);
});

test("published History fixture renders session order and legacy records on an iPhone-sized preview", async (t) => {
  const p = await app(t, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const fixture = JSON.parse(
    await fs.readFile(path.join(__dirname, "fixtures/history-v6.json"), "utf8"),
  );
  await importBackup(p, fixture);
  assert.deepEqual(await backup(p), { ...fixture, version: 8, noteScopes: { session: [], exerciseSession: [], exercise: [] } });
  const raw = await stored(p);
  await showHistoryDetails(p);
  assert.equal(await p.locator("[data-session-id]").count(), 2);
  assert.equal(await p.locator("[data-legacy-date]").count(), 1);
  const first = p.locator('[data-session-id="ws_history_demo_first"]');
  assert.deepEqual(
    await first
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((row) => row.dataset.setId)),
    ["history-demo-1", "history-demo-2"],
  );
  assert.match(await first.locator("h3").innerText(), /Saved demo workout/);
  assert.doesNotMatch(
    await first.locator("h3").innerText(),
    /Current editable demo plan/,
  );
  assert.equal(await p.locator("#historyTable tbody tr").count(), 4);
  await p.locator("#historyFilter").selectOption("imported");
  assert.equal(await p.locator("[data-session-id]").count(), 0);
  assert.equal(await p.locator("#historyTable tbody tr").count(), 1);
  assert.equal(await stored(p), raw);
  assert.deepEqual(await backup(p), { ...fixture, version: 8, noteScopes: { session: [], exerciseSession: [], exercise: [] } });
});

async function startGuide(p, duration = "30") {
  await p.locator('[data-view="workout"]').click();
  await p.locator("#guidedTemplate").selectOption("push");
  await p.locator("#guidedDate").fill("2026-10-23");
  await p.locator("#guidedDuration").selectOption(duration);
  await p.getByRole("button", { name: "Start workout", exact: true }).click();
}
async function guideReady(p) {
  await p.waitForFunction(() => Date.now() >= guidedActionUntil);
}

test("guided UI starts correct plans atomically, logs multiple sets and suppresses double taps", async (t) => {
  for (const duration of ["60", "30"]) {
    const p = await app(t, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const before = await backup(p);
    await startGuide(p, duration);
    let state = await p.evaluate(() => workoutActions.getGuidedWorkoutState());
    assert.equal(state.session.duration, Number(duration));
    assert.equal(state.slots.length, duration === "60" ? 6 : 3);
    assert.equal(state.currentExercise.actualExercise, "Smith Press");
    assert.equal(state.session.guided.revision, 0);
    await p.locator("#fWeight").fill("40");
    await p.locator("#fUnit").selectOption("lb/side");
    await p.locator("#fReps").fill("8");
    await p
      .getByRole("button", { name: "Log guided set", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Log guided set", exact: true })
      .click();
    assert.equal((await backup(p)).sets.length, before.sets.length + 1);
    await p.locator("#fWeight").fill("40");
    await p.locator("#fReps").fill("8");
    await p
      .getByRole("button", { name: "Log guided set", exact: true })
      .click();
    state = await p.evaluate(() => workoutActions.getGuidedWorkoutState());
    assert.equal(state.currentExercise.sets.length, 2);
    assert.equal(state.currentExercise.status, "pending");
    assert.equal(
      new Set(state.session.guided.requests.map((row) => row.id)).size,
      2,
    );
    await p.evaluate(() => {
      guidedCommand("move", "next");
      guidedCommand("move", "next");
    });
    assert.equal(
      (await p.evaluate(() => workoutActions.getGuidedWorkoutState()))
        .currentExercise.actualExercise,
      "Lateral Raise",
    );
    assert.ok(
      (
        await p.evaluate(() => workoutActions.getGuidedWorkoutState())
      ).slots.every((slot) => slot.status === "pending"),
    );
  }
});

test("guide substitutions retain older sets and permanent plans, with factual unit-separated performance", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const plan = (await backup(p)).program;
  await p.locator("#fWeight").fill("40");
  await p.locator("#fUnit").selectOption("lb/side");
  await p.locator("#fReps").fill("8");
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  const original = (await backup(p)).sets.at(-1);
  await p.locator("#guidedSubstitute").selectOption("Bench Press");
  await p.getByRole("button", { name: "Use substitute", exact: true }).click();
  assert.equal(await p.locator("#fExercise").inputValue(), "Bench Press");
  await p.locator("#fWeight").fill("90");
  await p.locator("#fUnit").selectOption("lb");
  await p.locator("#fReps").fill("10");
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  const saved = await backup(p),
    current = await p.evaluate(() => workoutActions.getGuidedWorkoutState());
  assert.deepEqual(saved.program, plan);
  assert.deepEqual(
    saved.sets.find((set) => set.id === original.id),
    original,
  );
  assert.deepEqual(
    current.currentExercise.sets.map((set) => set.exercise),
    ["Smith Press", "Bench Press"],
  );
  assert.ok(
    current.currentExercise.sets.every((set) => set.planSlotId === "slot-1"),
  );
  await p
    .getByText("Previous performance · informational only", { exact: true })
    .click();
  assert.match(
    await p.locator(".guided-previous").first().innerText(),
    /external load/,
  );
  assert.equal(
    await p
      .locator("#guidedWorkout")
      .getByText(/recommended weight|target reps/i)
      .count(),
    0,
  );
  await showHistoryDetails(p);
  await p.getByText("Guided exercise status", { exact: true }).click();
  assert.match(
    await p.locator(".guided-history").innerText(),
    /Smith Press → current selection: Bench Press · pending/,
  );
});

test("guided position/status/substitutions resume after reload and reopening; finish keeps pending slots", async (t) => {
  const p = await app(t);
  await startGuide(p);
  await p.getByRole("button", { name: "Done", exact: true }).click();
  await guideReady(p);
  await p.getByRole("button", { name: "Next", exact: true }).click();
  await guideReady(p);
  await p.getByRole("button", { name: "Skip", exact: true }).click();
  const original = await p.evaluate(() =>
    workoutActions.getGuidedWorkoutState(),
  );
  await p.reload();
  await p.locator('[data-view="workout"]').click();
  assert.equal(
    await p.locator("#guidedSlot").inputValue(),
    original.currentSlotId,
  );
  const reopened = await p.context().newPage();
  await reopened.goto(origin);
  await reopened.locator('[data-view="workout"]').click();
  assert.deepEqual(
    await reopened.evaluate(() => workoutActions.getGuidedWorkoutState()),
    original,
  );
  await reopened
    .getByRole("button", { name: "Log current exercise", exact: true })
    .click();
  assert.equal(
    await reopened.locator("#fExercise").inputValue(),
    "Lateral Raise",
  );
  const dialogs = [];
  reopened.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await reopened
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  assert.ok(dialogs.some((message) => /unfinished exercises/.test(message)));
  const saved = await backup(reopened),
    session = saved.sessions[0];
  assert.equal(saved.activeSessionId, null);
  assert.equal(session.status, "completed");
  assert.deepEqual(
    session.guided.slots.map((slot) => slot.status),
    ["completed", "skipped", "pending"],
  );
  await reopened.close();
});

test("guided navigation protects unsaved input; manual form remains available and no draft is persisted", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const raw = await stored(p);
  await p.locator("#fWeight").fill("40");
  await p.locator("#fReps").fill("8");
  p.removeAllListeners("dialog");
  p.once("dialog", (dialog) => dialog.dismiss());
  await p.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(await p.locator("#fWeight").inputValue(), "40");
  assert.equal(
    (await p.evaluate(() => workoutActions.getGuidedWorkoutState()))
      .currentSlotId,
    "slot-1",
  );
  assert.equal(await stored(p), raw);
  p.on("dialog", (dialog) => dialog.accept());
  await p
    .getByRole("button", { name: "Use manual logging", exact: true })
    .click();
  await p.locator("#fDate").fill("2026-10-23");
  await p.locator("#fExercise").fill("Bench Press");
  await p.locator("#fWeight").fill("90");
  await p.locator("#fReps").fill("8");
  await p.getByRole("button", { name: "Add set", exact: true }).click();
  const set = (await backup(p)).sets.at(-1);
  assert.equal(set.exercise, "Bench Press");
  assert.ok(set.sessionId);
  assert.equal(set.planSlotId, undefined);
  assert.equal(
    (await p.evaluate(() => workoutActions.getGuidedWorkoutState()))
      .currentExercise.sets.length,
    0,
  );
});

test("guided schema-7 backups round trip; schema-6 active sessions require explicit Enable guidance", async (t) => {
  const p = await app(t);
  const fixture = JSON.parse(
    await fs.readFile(path.join(__dirname, "fixtures/session-v6.json"), "utf8"),
  );
  await importBackup(p, fixture);
  await p.locator('[data-view="workout"]').click();
  assert.equal(
    await p.evaluate(() => workoutActions.getGuidedWorkoutState()),
    null,
  );
  assert.equal(
    await p
      .getByRole("button", { name: "Enable guidance", exact: true })
      .isVisible(),
    true,
  );
  await p.getByRole("button", { name: "Enable guidance", exact: true }).click();
  await p.locator("#fWeight").fill("100");
  await p.locator("#fReps").fill("8");
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  await p.locator('[data-view="data"]').click();
  const exporting = p.waitForEvent("download");
  await p.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(
    await fs.readFile(await (await exporting).path(), "utf8"),
  );
  assert.equal(exported.version, 8);
  assert.ok(exported.sessions[0].guided.requests.length);
  await importBackup(p, exported);
  assert.deepEqual(await backup(p), exported);
  const second = p.waitForEvent("download");
  await p.getByRole("button", { name: "Export JSON", exact: true }).click();
  assert.deepEqual(
    JSON.parse(await fs.readFile(await (await second).path(), "utf8")),
    exported,
  );
});

test("guided failures and stale tabs retain prior committed state and unsaved input", async (t) => {
  const p = await app(t);
  await startGuide(p);
  await p.locator("#fWeight").fill("40");
  await p.locator("#fReps").fill("8");
  const before = await backup(p),
    raw = await stored(p);
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("quota");
    };
  });
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  assert.deepEqual(await backup(p), before);
  assert.equal(await stored(p), raw);
  assert.equal(await p.locator("#fReps").inputValue(), "8");
  await p.reload();
  const stale = await p.context().newPage();
  await stale.goto(origin);
  await p.evaluate(() => {
    const state = workoutActions.getGuidedWorkoutState();
    workoutActions.moveGuidedSlot({
      sessionId: state.sessionId,
      expectedRevision: state.revision,
      direction: "next",
    });
  });
  const staleBefore = await backup(stale);
  const result = await stale.evaluate(() => {
    const state = workoutActions.getGuidedWorkoutState();
    return workoutActions.setGuidedSlotStatus({
      sessionId: state.sessionId,
      expectedRevision: state.revision,
      planSlotId: state.currentSlotId,
      status: "completed",
    });
  });
  assert.equal(result.code, "PERSISTENCE_ERROR");
  assert.deepEqual(await backup(stale), staleBefore);
  assert.equal((await backup(p)).sessions[0].guided.slots[0].status, "pending");
  await stale.close();
});

test("guided controls fit phone/desktop widths with useful touch targets and canonical version", async (t) => {
  const p = await app(t);
  await startGuide(p);
  for (const width of [320, 390, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const buttons = await p
      .locator(".guided-controls button")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    assert.ok(buttons.every((height) => height >= 44));
    assert.equal(
      await p.locator("#appVersion").textContent(),
      await p.evaluate(() => `GymBro ${APP_VERSION.version}`),
    );
  }
});

test("corrupt persisted guided position blocks recovery without guessing or overwriting", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const invalid = await backup(p);
  invalid.sessions[0].guided.currentSlotId = "invalid-slot";
  const raw = JSON.stringify(invalid);
  await p.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [KEY, raw],
  );
  await p.reload();
  assert.equal(await p.locator("#storageNotice").isVisible(), true);
  assert.equal(await stored(p), raw);
  assert.equal(
    (
      await p.evaluate(() =>
        workoutActions.startGuidedSession({
          date: "2026-10-23",
          templateId: "push",
          duration: 30,
        }),
      )
    ).code,
    "PERSISTENCE_ERROR",
  );
  assert.equal(await stored(p), raw);
});

test("trainer evidence APIs compose guided state and run without storage writes or rendered form state", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const original = await backup(p),
    raw = await stored(p);
  const inspection = await p.evaluate(() => {
    const state = workoutActions.getGuidedWorkoutState();
    const context = workoutActions.getTrainerWorkoutContext({
      asOfDate: "2026-10-23",
    });
    const exercise = workoutActions.getExercisePerformanceContext({
      exercise: "Smith Press",
      asOfDate: "2026-10-23",
      unit: "lb/side",
    });
    return { state, context, exercise };
  });
  assert.equal(inspection.context.ok, true);
  assert.equal(inspection.exercise.ok, true);
  assert.deepEqual(inspection.context.result.guidedWorkout, inspection.state);
  assert.equal(
    inspection.context.result.preferences.actual.recordedText,
    original.preferences["Smith Press"],
  );
  assert.equal(inspection.context.result.structuredConstraints, null);
  assert.equal(await stored(p), raw);
  assert.deepEqual(await backup(p), original);
  await p.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("writes forbidden for selectors");
    };
  });
  assert.equal(
    (
      await p.evaluate(() =>
        workoutActions.getTrainerWorkoutContext({ asOfDate: "2026-10-23" }),
      )
    ).ok,
    true,
  );
  assert.equal(await stored(p), raw);
});

test("trainer context follows domain logging even when the guided DOM has not been rerendered", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const inspection = await p.evaluate(() => {
    const g = workoutActions.getGuidedWorkoutState();
    const saved = workoutActions.logGuidedSet({
      sessionId: g.sessionId,
      planSlotId: g.currentSlotId,
      expectedRevision: g.revision,
      requestId: "trainer-no-dom",
      weight: 40,
      unit: "lb/side",
      reps: 8,
      rpe: 7,
      pain: 2,
      painArea: "shoulder",
      notes: "Synthetic trainer API evidence",
    });
    return {
      saved,
      context: workoutActions.getTrainerWorkoutContext({
        asOfDate: "2026-10-23",
      }),
    };
  });
  assert.equal(inspection.saved.ok, true);
  assert.equal(inspection.context.ok, true);
  assert.equal(inspection.context.result.currentSlotSets.length, 1);
  assert.equal(
    inspection.context.result.currentPainContext[0].references.setId,
    inspection.saved.setId,
  );
  assert.match(
    await p.locator("#guidedWorkout").innerText(),
    /0 sets recorded/,
  );
  assert.equal(
    inspection.context.result.guidedWorkout.currentExercise.status,
    "pending",
  );
});

test("derived evidence is not persisted and reproduces across complete backup restore", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const before = await p.evaluate(() =>
    workoutActions.getTrainerWorkoutContext({ asOfDate: "2026-10-23" }),
  );
  await p.locator('[data-view="data"]').click();
  const pending = p.waitForEvent("download");
  await p.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(
    await fs.readFile(await (await pending).path(), "utf8"),
  );
  assert.equal(exported.version, 8);
  assert.equal(
    exported.appVersion,
    await p.evaluate(() => APP_VERSION.version),
  );
  assert.equal(Object.hasOwn(exported, "trainerEvidence"), false);
  assert.equal(Object.hasOwn(exported, "progressionState"), false);
  await importBackup(p, exported);
  assert.deepEqual(
    await p.evaluate(() =>
      workoutActions.getTrainerWorkoutContext({ asOfDate: "2026-10-23" }),
    ),
    before,
  );
  assert.deepEqual(await backup(p), exported);
});

test("exercise library counts session identities and sessionless date groups", async (t) => {
  const p = await app(t);
  const result = await p.evaluate(() => {
    db.sets = [
      { exercise: "Bench Press", date: "2026-10-23", sessionId: "one" },
      { exercise: "Bench Press", date: "2026-10-23", sessionId: "one" },
      { exercise: "Bench Press", date: "2026-10-23", sessionId: "two" },
      { exercise: "Bench Press", date: "2026-10-23" },
      { exercise: "Bench Press", date: "2026-10-23" },
      { exercise: "Bench Press", date: "2026-10-22", complete: false },
    ];
    const before = JSON.stringify(db);
    renderExercises();
    return {
      unchanged: before === JSON.stringify(db),
      empty: exerciseSessionCount([]),
    };
  });
  await p.locator('[data-view="exercises"]').click();
  const row = p
    .locator("#exerciseTable .exercise-row")
    .filter({ hasText: "Bench Press" });
  assert.equal(await row.locator("td").nth(3).textContent(), "6");
  assert.equal(await row.locator("td").nth(4).textContent(), "4");
  assert.match(
    await p.locator("#exerciseTable").textContent(),
    /not inferred sessions/,
  );
  await row.click();
  assert.match(await p.locator("#exerciseDetail").textContent(), /Sessions4/);
  assert.deepEqual(result, { unchanged: true, empty: 0 });
});

test("restored/foreground pages detect missed storage events without adopting or overwriting progress", async (t) => {
  for (const event of ["pageshow", "visibilitychange"]) {
    const p = await app(t);
    await startGuide(p);
    await p.locator("#fNotes").fill("keep unsaved notes");
    const before = await backup(p);
    const newer = structuredClone(before);
    newer.sessions[0].guided.revision++;
    newer.sessions[0].guided.currentSlotId =
      newer.sessions[0].guided.slots[1].planSlotId;
    const raw = JSON.stringify(newer);
    // Same-document writes do not deliver a storage event. Model a missed event
    // during suspension, then dispatch only the lifecycle notification.
    await p.evaluate(
      ([key, value, event]) => {
        localStorage.setItem(key, value);
        if (event === "pageshow")
          window.dispatchEvent(
            new PageTransitionEvent("pageshow", { persisted: true }),
          );
        else document.dispatchEvent(new Event("visibilitychange"));
      },
      [KEY, raw, event],
    );
    assert.equal(await p.locator("#storageNotice").isVisible(), true);
    assert.match(
      await p.locator("#storageMessage").textContent(),
      /Another tab/,
    );
    assert.deepEqual(await backup(p), before);
    assert.equal(await p.locator("#fNotes").inputValue(), "keep unsaved notes");
    const result = await p.evaluate(() => {
      const s = workoutActions.getGuidedWorkoutState();
      return workoutActions.moveGuidedSlot({
        sessionId: s.sessionId,
        expectedRevision: s.revision,
        direction: "next",
      });
    });
    assert.equal(result.code, "PERSISTENCE_ERROR");
    assert.equal(await stored(p), raw);
    await p.reload();
    assert.deepEqual(await backup(p), newer);
    assert.equal(await p.locator("#storageNotice").isVisible(), false);
  }
});

test("mobile entry text avoids Safari focus zoom and primary logging controls have 44px targets", async (t) => {
  const p = await app(t);
  await startGuide(p);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await p.setViewportSize(viewport);
    const sizes = await p
      .locator(
        "#workout input:not([type=checkbox]), #workout select, #workout textarea",
      )
      .evaluateAll((els) =>
        els.map((el) => ({
          id: el.id,
          font: parseFloat(getComputedStyle(el).fontSize),
        })),
      );
    assert.ok(
      sizes.every((s) => s.font >= 16),
      JSON.stringify(sizes),
    );
    const heights = await p
      .locator(
        "#workout .actions button, #guidedEntryActions button, .guided-controls button",
      )
      .evaluateAll((els) =>
        els.map((el) => ({
          text: el.textContent,
          height: el.getBoundingClientRect().height,
        })),
      );
    assert.ok(
      heights.every((s) => s.height >= 44),
      JSON.stringify(heights),
    );
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
});

test("resume checks are read-only and storage read exceptions pause editing without offering an empty reset", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const before = await backup(p),
    raw = await stored(p);
  await p.evaluate(() => {
    for (let i = 0; i < 3; i++) {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
      document.dispatchEvent(new Event("visibilitychange"));
    }
  });
  assert.deepEqual(await backup(p), before);
  assert.equal(await stored(p), raw);
  assert.equal(await p.locator("#storageNotice").isVisible(), false);
  await p.evaluate(() => {
    window.originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  assert.equal(await p.locator("#storageNotice").isVisible(), true);
  assert.equal(await p.locator("#recoverStorage").isVisible(), false);
  assert.deepEqual(await backup(p), before);
  await p.evaluate(() => {
    Storage.prototype.getItem = window.originalGetItem;
  });
  assert.equal(await stored(p), raw);
  const result = await p.evaluate(() => {
    const s = workoutActions.getGuidedWorkoutState();
    return workoutActions.setGuidedSlotStatus({
      sessionId: s.sessionId,
      planSlotId: s.currentSlotId,
      expectedRevision: s.revision,
      status: "completed",
    });
  });
  assert.equal(result.code, "PERSISTENCE_ERROR");
  assert.equal(await stored(p), raw);
  await p.reload();
  assert.equal(await p.locator("#storageNotice").isVisible(), false);
  assert.deepEqual(await backup(p), before);
});

test("committed workout and trainer context survive navigation, reload and a reopened tab without lifecycle saves", async (t) => {
  const p = await app(t);
  await startGuide(p);
  const submitted = await p.evaluate(() => {
    let s = workoutActions.getGuidedWorkoutState();
    const input = {
      sessionId: s.sessionId,
      planSlotId: s.currentSlotId,
      expectedRevision: s.revision,
      requestId: "interrupt-safe",
      weight: 40,
      unit: "lb/side",
      reps: 8,
    };
    if (!workoutActions.logGuidedSet(input).ok) throw Error("Log failed");
    s = workoutActions.getGuidedWorkoutState();
    workoutActions.setGuidedSlotStatus({
      sessionId: s.sessionId,
      planSlotId: s.currentSlotId,
      expectedRevision: s.revision,
      status: "skipped",
    });
    s = workoutActions.getGuidedWorkoutState();
    workoutActions.moveGuidedSlot({
      sessionId: s.sessionId,
      expectedRevision: s.revision,
      direction: "next",
    });
    s = workoutActions.getGuidedWorkoutState();
    workoutActions.substituteGuidedExercise({
      sessionId: s.sessionId,
      planSlotId: s.currentSlotId,
      expectedRevision: s.revision,
      exercise: "Bench Press",
    });
    s = workoutActions.getGuidedWorkoutState();
    workoutActions.logGuidedSet({
      ...input,
      requestId: "after-substitution",
      planSlotId: s.currentSlotId,
      expectedRevision: s.revision,
      unit: "lb",
    });
    workoutActions.logSet({
      date: "2026-10-23",
      exercise: "Bench Press",
      weight: 50,
      reps: 8,
    });
    return input;
  });
  const before = await backup(p),
    raw = await stored(p);
  const context = await p.evaluate(() =>
    workoutActions.getTrainerWorkoutContext({ asOfDate: "2026-10-23" }),
  );
  assert.equal(context.ok, true);
  // Browser history restoration is exercised, but is not a physical lock/unlock.
  await p.goto(origin + "/README.md");
  await p.goBack();
  assert.deepEqual(await backup(p), before);
  await p.goForward();
  await p.goBack();
  await p.reload();
  assert.deepEqual(await backup(p), before);
  const reopened = await p.context().newPage();
  reopened.on("dialog", (d) => d.accept());
  await reopened.goto(origin);
  await p.close();
  assert.deepEqual(await backup(reopened), before);
  assert.equal(await stored(reopened), raw);
  assert.deepEqual(
    await reopened.evaluate(() =>
      workoutActions.getTrainerWorkoutContext({ asOfDate: "2026-10-23" }),
    ),
    context,
  );
  const replay = await reopened.evaluate(
    (input) => workoutActions.logGuidedSet(input),
    submitted,
  );
  assert.equal(replay.code, "REPLAY");
  assert.equal(await stored(reopened), raw);
  await reopened.locator('[data-view="workout"]').click();
  assert.match(
    await reopened.locator("#guidedWorkout").innerText(),
    /Bench Press/,
  );
  assert.equal(
    await reopened
      .getByRole("button", { name: "Start workout", exact: true })
      .count(),
    0,
  );
  await reopened.close();
});

test("rapid guided UI commands commit once per burst and preserve pending slots on finish", async (t) => {
  const p = await app(t);
  await startGuide(p);
  for (const [command, value] of [
    ["move", "next"],
    ["move", "previous"],
    ["status", "completed"],
    ["status", "skipped"],
    ["substitute", null],
  ]) {
    await guideReady(p);
    if (command === "substitute")
      await p.locator("#guidedSubstitute").selectOption("Bench Press");
    const before = await p.evaluate(() =>
      workoutActions.getGuidedWorkoutState(),
    );
    await p.evaluate(
      ([command, value]) => {
        for (let i = 0; i < 8; i++) guidedCommand(command, value);
      },
      [command, value],
    );
    const after = await p.evaluate(() =>
      workoutActions.getGuidedWorkoutState(),
    );
    assert.equal(after.revision, before.revision + 1, command);
    assert.equal(after.sessionId, before.sessionId);
  }
  await guideReady(p);
  const before = await backup(p);
  await p.evaluate(() => {
    for (let i = 0; i < 8; i++) guidedCommand("finish");
  });
  const done = await backup(p);
  assert.equal(done.activeSessionId, null);
  assert.equal(done.sessions.length, 1);
  assert.equal(done.sessions[0].status, "completed");
  assert.deepEqual(
    done.sessions[0].guided.slots,
    before.sessions[0].guided.slots,
  );
  assert.deepEqual(done.sets, before.sets);
  await p.reload();
  assert.deepEqual(await backup(p), done);
});

test("real quota exceptions retain guided form and request identity for intentional retry", async (t) => {
  const p = await app(t);
  await startGuide(p);
  await p.locator("#fWeight").fill("40");
  await p.locator("#fReps").fill("8");
  const before = await backup(p),
    raw = await stored(p);
  const requestId = await p.evaluate(() => guidedFormContext.requestId);
  await p.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exhausted", "QuotaExceededError");
    };
  });
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  assert.equal(await p.locator("#fReps").inputValue(), "8");
  assert.deepEqual(await backup(p), before);
  assert.equal(await stored(p), raw);
  assert.equal(await p.evaluate(() => guidedFormContext.requestId), requestId);
  assert.equal(await p.evaluate(() => guidedFormContext.committed), false);
  await p.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
  });
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  await p.getByRole("button", { name: "Log guided set", exact: true }).click();
  const saved = await backup(p);
  assert.equal(saved.sets.length, before.sets.length + 1);
  assert.equal(saved.sessions[0].guided.requests.length, 1);
  assert.equal(saved.sessions[0].guided.requests[0].id, requestId);
  await p.reload();
  assert.deepEqual(await backup(p), saved);
});

for (const width of [320, 390, 1280]) {
  test(`scoped notes save, render, and roundtrip separately at ${width}px`, async (t) => {
    const p = await app(t, { viewport: { width, height: 900 } });
    await startGuide(p);
    const original = await backup(p);
    const sessionId = original.activeSessionId;
    const target = JSON.parse(await p.locator('#noteOccurrence').inputValue());
    const sessionText = '  Hotel gym; only 35 minutes\n<svg onload="window.noteXss=1">  ';
    await p.locator('#sessionNote').fill(sessionText);
    await p.getByRole('button', { name: 'Save session note', exact: true }).click();
    await p.locator('#occurrenceNote').fill('Seat position 6 today');
    await p.getByRole('button', { name: 'Save exercise/session note', exact: true }).click();
    await p.locator('[data-view="exercises"]').click();
    await p.evaluate((ex) => showExercise(ex), target.exercise);
    await p.locator('#setupNote').fill('Usual seat 4');
    await p.getByRole('button', { name: 'Save durable setup note', exact: true }).click();
    const detail = p.locator('#exerciseDetail');
    await detail.getByText('Session and set observations', { exact: true }).click();
    assert.match(await detail.innerText(), /Seat position 6 today/);
    assert.match(await detail.innerText(), /Session note/);
    assert.equal(await p.evaluate(() => window.noteXss), undefined);
    const recorded = await backup(p);
    assert.equal(recorded.noteScopes.session[0].text, sessionText);
    assert.deepEqual(recorded.sessions, original.sessions, 'notes preserve all workout facts');
    await showHistoryDetails(p);
    const group = p.locator(`[data-session-id="${sessionId}"]`);
    assert.match(await group.innerText(), /Session note/);
    assert.match(await group.innerText(), /Seat position 6 today/);
    assert.doesNotMatch(await group.innerText(), /Usual seat 4/, 'current setup is not historical context');
    await p.reload();
    assert.deepEqual(await backup(p), recorded);
    const downloading = p.waitForEvent("download");
    await p.getByRole("button", { name: "Backup", exact: true }).click();
    const exported = JSON.parse(await fs.readFile(await (await downloading).path(), "utf8"));
    assert.deepEqual(exported.noteScopes, recorded.noteScopes);
    await importBackup(p, exported);
    assert.deepEqual(await backup(p), exported);
    await p.locator('[data-view="workout"]').click();
    assert.equal(await p.locator('#sessionNote').inputValue(), sessionText);
    assert.equal(await p.locator('#occurrenceNote').inputValue(), 'Seat position 6 today');
    assert(await p.locator('#sessionNote').isVisible());
    const box = await p.getByRole('button', { name: 'Save session note', exact: true }).boundingBox();
    assert(box.height >= 44);
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.locator('#workoutNotes').screenshot({ path: `test-results/issue25-notes-${width}.png` });
  });
}

test('note drafts survive quota failure, unrelated renders and context changes until a successful retry', async (t) => {
  const p = await app(t);
  await startGuide(p);
  const before = await backup(p), raw = await stored(p);
  await p.locator('#sessionNote').fill('  unsaved session\n');
  await p.locator('#occurrenceNote').fill('unsaved occurrence');
  const selected = await p.locator('#noteOccurrence').inputValue();
  await p.evaluate(() => {
    window.originalNoteSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  });
  await p.getByRole('button', { name: 'Save session note', exact: true }).click();
  assert.deepEqual(await backup(p), before);
  assert.equal(await stored(p), raw);
  assert.equal(await p.locator('#sessionNote').inputValue(), '  unsaved session\n');
  assert.equal(await p.locator('#sessionNoteStatus').innerText(), 'Unsaved');
  await p.evaluate(() => renderAll());
  assert.equal(await p.locator('#sessionNote').inputValue(), '  unsaved session\n');
  const other = await p.locator('#noteOccurrence option').nth(1).getAttribute('value');
  await p.locator('#noteOccurrence').selectOption(other);
  assert.equal(await p.locator('#occurrenceNote').inputValue(), '');
  await p.locator('#noteOccurrence').selectOption(selected);
  assert.equal(await p.locator('#occurrenceNote').inputValue(), 'unsaved occurrence');
  await p.evaluate(() => { Storage.prototype.setItem = window.originalNoteSetItem; });
  await p.getByRole('button', { name: 'Save session note', exact: true }).click();
  assert.equal(await p.locator('#sessionNoteStatus').innerText(), 'Saved');
  assert.equal((await backup(p)).noteScopes.session[0].text, '  unsaved session\n');
  assert.equal(await p.locator('#occurrenceNote').inputValue(), 'unsaved occurrence');
});

test('schema-7 note upgrade never writes at startup and stale-tab note save preserves newer data and draft', async (t) => {
  const p = await app(t);
  await startGuide(p);
  const old = await backup(p);
  old.version = 7;
  old.noteScopes = { raw: 'unknown old note field' };
  const raw = JSON.stringify(old);
  await p.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, raw]);
  await p.reload();
  assert.equal(await stored(p), raw);
  assert.deepEqual((await backup(p)).noteScopes.legacyValue, old.noteScopes);
  const sessionId = old.activeSessionId;
  await p.locator('[data-view="workout"]').click();
  await p.locator('#sessionNote').fill('my draft');
  const newer = await backup(p);
  newer.noteScopes.session.push({ sessionId, text: 'newer tab' });
  const newerRaw = JSON.stringify(newer);
  await p.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, newerRaw]);
  await p.getByRole('button', { name: 'Save session note', exact: true }).click();
  assert.equal(await stored(p), newerRaw);
  assert.equal(await p.locator('#sessionNote').inputValue(), 'my draft');
  assert.equal((await backup(p)).noteScopes.session.length, 0);
});

for (const width of [320, 390, 1280]) {
  test(`History search controls intersect, reset, explain empty results and never save at ${width}px`, async (t) => {
    const p = await app(t, { viewport: { width, height: 900 } });
    const fixture = await sessionHistoryFixture(p);
    await p.evaluate(({first, second}) => {
      db.sessions.find(s => s.id === first).planSnapshot.name = 'Saved Alpha <test>';
      db.sessions.find(s => s.id === second).planSnapshot.name = 'Saved Beta';
      renderAll();
      window.filterWrites = 0;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(...args) { window.filterWrites++; return original.apply(this, args); };
    }, fixture);
    const before = await backup(p), raw = await stored(p);
    await p.locator('[data-view="history"]').click();
    const allCount = await p.locator('.history-group').count();
    await p.locator('#historyExercise').selectOption('Bench Press');
    assert.equal(await p.locator('[data-session-id="' + fixture.first + '"]').count(), 1);
    assert.equal(await p.locator('[data-session-id="' + fixture.second + '"]').count(), 1);
    await p.locator('#historyFrom').fill('2026-10-23'); await p.locator('#historyFrom').dispatchEvent('change');
    await p.locator('#historyTo').fill('2026-10-23'); await p.locator('#historyTo').dispatchEvent('change');
    await p.locator('#historyWorkout').selectOption('session:Saved Alpha <test>');
    assert.equal(await p.locator('.history-group').count(), 1);
    await p.getByRole('button', {name:'Expand all', exact:true}).click();
    await p.locator('.history-exercise > summary').first().click();
    assert.deepEqual(await p.locator('#historyTable tr[data-set-id]').evaluateAll(els => els.map(el => el.dataset.setId)), [fixture.b]);
    assert.match(await p.locator('.history-counts').first().innerText(), /1 matching set.*2 sets in session/);
    await p.locator('#historyWorkout').selectOption('legacy');
    assert.equal(await p.locator('[data-session-id]').count(), 0);
    await p.locator('#historyFrom').fill('2099-01-01'); await p.locator('#historyFrom').dispatchEvent('change');
    assert.match(await p.locator('#historyFilterStatus').innerText(), /From date must/);
    await p.locator('#historyTo').fill('2099-12-31'); await p.locator('#historyTo').dispatchEvent('change');
    assert.match(await p.locator('#historyTable').innerText(), /No history matches these filters/);
    await p.locator('#historyFilter').selectOption('manual');
    await p.getByRole('button', {name:'Reset filters', exact:true}).click();
    assert.equal(await p.locator('.history-group').count(), allCount);
    for (const id of ['historyExercise','historyWorkout','historyFrom','historyTo']) assert.equal(await p.locator('#'+id).inputValue(), '');
    assert.equal(await p.locator('#historyFilter').inputValue(), 'all');
    assert.deepEqual(await backup(p), before); assert.equal(await stored(p), raw);
    assert.equal(await p.evaluate(() => window.filterWrites), 0);
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.locator('.history-filters').screenshot({path: 'test-results/issue22-filters-' + width + '.png'});
  });
}
