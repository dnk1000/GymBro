const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { checkRelease } = require("../scripts/check-release.cjs");
const { checkDiff } = require("../scripts/check-diff.cjs");
const root = path.resolve(__dirname, "..");
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gymbro-release-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function releaseCopy(t) {
  const dir = temporary(t);
  fs.mkdirSync(path.join(dir, "docs"));
  for (const file of [
    "app-version.js",
    "workout-data.js",
    "index.html",
    "app.js",
    "docs/V3_RELEASE.md",
    "docs/RELEASE_HISTORY.md",
    "docs/CHANGELOG.md",
  ])
    fs.copyFileSync(path.join(root, file), path.join(dir, file));
  return dir;
}
function replace(dir, file, change) {
  const target = path.join(dir, file);
  fs.writeFileSync(target, change(fs.readFileSync(target, "utf8")));
}

test("current release metadata validates independently from historical version references", () => {
  const result = checkRelease(root);
  assert.match(result.version, /^3\.10\.1-\d{8}T\d{6}Z$/);
  assert.equal(result.schema, 8);
});

test("stale current release documentation fails validation", (t) => {
  for (const file of [
    "docs/V3_RELEASE.md",
    "docs/RELEASE_HISTORY.md",
    "docs/CHANGELOG.md",
  ]) {
    const dir = releaseCopy(t);
    replace(dir, file, (source) => source.replaceAll("3.10.1", "3.0.0"));
    assert.throws(() => checkRelease(dir), undefined, file);
  }
});

test("runtime-generated or invalid UTC build identifiers are rejected", (t) => {
  for (const replacement of [
    '["20261027T214344Z"].join("")',
    '"20261301T250000Z"',
  ]) {
    const dir = releaseCopy(t);
    replace(dir, "app-version.js", (source) =>
      source.replace(/const build = .*;/, `const build = ${replacement};`),
    );
    assert.throws(() => checkRelease(dir));
  }
});

test("wrong release and unapproved schema changes fail the release check", (t) => {
  for (const [file, from, to] of [
    ["app-version.js", "const minor = 10", "const minor = 11"],
    ["workout-data.js", "const DATA_VERSION = 8", "const DATA_VERSION = 9"],
  ]) {
    const dir = releaseCopy(t);
    replace(dir, file, (source) => source.replace(from, to));
    assert.throws(() => checkRelease(dir));
  }
});

test("independently hard-coded runtime builds cannot ship unnoticed", (t) => {
  const dir = releaseCopy(t);
  fs.appendFileSync(
    path.join(dir, "app.js"),
    '\nconst oldBuild = "2.6.0-20261023T220541Z";\n',
  );
  assert.throws(() => checkRelease(dir), /Hard-coded application build/);
});

test("whitespace validation detects staged and committed defects with a clean checkout", (t) => {
  const dir = temporary(t);
  const git = (args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  const commit = () =>
    git([
      "-c",
      "user.name=Test Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--no-gpg-sign",
      "-qm",
      "fixture",
    ]);
  git(["init", "-q"]);
  fs.writeFileSync(path.join(dir, "file.txt"), "clean\n");
  git(["add", "file.txt"]);
  commit();
  const base = git(["rev-parse", "HEAD"]).trim();
  assert.equal(checkDiff(dir, base), base);
  fs.appendFileSync(path.join(dir, "file.txt"), "bad trailing whitespace \n");
  assert.throws(() => checkDiff(dir, base));
  git(["add", "file.txt"]);
  assert.throws(() => checkDiff(dir, base));
  commit();
  assert.equal(git(["status", "--porcelain"]), "");
  assert.throws(
    () => checkDiff(dir, base),
    "Committed-range checks must catch defects even when the checkout is clean",
  );
});

test("initial-push whitespace comparison supports an empty before SHA and rejects invalid refs", (t) => {
  const dir = temporary(t);
  const git = (args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git(["init", "-q"]);
  fs.writeFileSync(path.join(dir, "file.txt"), "clean\n");
  git(["add", "file.txt"]);
  git([
    "-c",
    "user.name=Test Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--no-gpg-sign",
    "-qm",
    "fixture",
  ]);
  assert.match(checkDiff(dir, "0".repeat(40)), /^[a-f0-9]{40}$/);
  assert.throws(() => checkDiff(dir, "--invalid"), /full base commit SHA/);
});

test("V2 public action and selector inventory remains available without DOM or persistence", () => {
  const runtime = vm.createContext({ structuredClone });
  for (const file of [
    "seed.js",
    "workout-data.js",
    "workout-sessions.js",
    "guided-workouts.js",
    "performance-context.js",
    "workout-actions.js",
  ])
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), runtime);
  const names = vm.runInContext(
    `Object.keys(createWorkoutActions({
    getState: () => migrateData(seed),
    setState: () => { throw Error("Unexpected commit"); },
    persist: () => { throw Error("Unexpected write"); },
    createId: () => "unused"
  })).sort()`,
    runtime,
  );
  assert.deepEqual(Array.from(names), [
    "addSlot",
    "attachSetToSession",
    "clearPlan",
    "commitImport",
    "compareExercisePerformance",
    "completeSession",
    "createSession",
    "cycleSlotRole",
    "deleteSet",
    "editSet",
    "enableGuidance",
    "finishGuidedSession",
    "getActiveSession",
    "getExercisePerformanceContext",
    "getGuidedWorkoutState",
    "getSession",
    "getTrainerWorkoutContext",
    "getWorkoutState",
    "logBodyweight",
    "logGuidedSet",
    "logSet",
    "moveGuidedSlot",
    "removeSlot",
    "saveScopedNote",
    "selectGuidedSlot",
    "selectPlan",
    "setGuidedSlotStatus",
    "startGuidedSession",
    "substituteGuidedExercise",
    "toggleSlotShort",
  ]);
});
