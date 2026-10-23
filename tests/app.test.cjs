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
  assert.equal(exported.version, 6);
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
  assert.equal(migrated.version, 6);
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
  await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
  assert.equal(migrated.version, 6);
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
  assert.equal(JSON.parse(await stored(p)).version, 6);
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
  assert.equal(restored.version, 6);
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

test("malformed v6 sessions and future v7 storage remain untouched and block session writes", async (t) => {
  const p = await app(t);
  const valid = await backup(p);
  const malformed = structuredClone(valid);
  malformed.activeSessionId = "missing";
  const future = structuredClone(valid);
  future.version = 7;
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
  assert.deepEqual(await backup(p), fixture);
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
  assert.equal(exported.version, 6);
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
  assert.equal((await backup(p)).version, 6);
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
    await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
  await p.locator('[data-view="history"]').click();
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
