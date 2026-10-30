const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

test("canonical application version is fixed, immutable and independent of schema", () => {
  const runtime = vm.createContext({});
  const source = fs.readFileSync(
    path.join(__dirname, "..", "app-version.js"),
    "utf8",
  );
  vm.runInContext(source, runtime);
  const version = vm.runInContext("APP_VERSION", runtime);
  assert.deepEqual([version.major, version.minor, version.patch], [3, 6, 4]);
  assert.match(version.build, /^\d{8}T\d{6}Z$/);
  assert.equal(version.version, `3.6.4-${version.build}`);
  assert.equal(Object.isFrozen(version), true);
  const second = vm.createContext({});
  vm.runInContext(source, second);
  assert.equal(vm.runInContext("APP_VERSION.version", second), version.version);
  const data = {
    version: 6,
    sets: [{ id: "unchanged", notes: "keep" }],
    appVersion: "other-build",
  };
  const backup = vm.runInContext("createCompleteBackup", runtime)(data);
  assert.equal(backup.appVersion, version.version);
  assert.equal(backup.version, 6);
  backup.sets[0].notes = "detached";
  assert.equal(data.sets[0].notes, "keep");
  assert.equal(data.appVersion, "other-build");
});
