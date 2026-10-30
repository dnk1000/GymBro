const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

function checkRelease(root) {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const source = read("app-version.js");
  const runtime = vm.createContext({});
  vm.runInContext(source, runtime, { timeout: 1000 });
  const version = vm.runInContext("APP_VERSION", runtime);
  assert.deepEqual(
    [version.major, version.minor, version.patch],
    [3, 7, 1],
    "Expected issue #20 History disclosure application version 3.7.1",
  );
  assert.ok(Object.isFrozen(version), "Canonical version must be immutable");
  assert.match(version.build, /^\d{8}T\d{6}Z$/);
  assert.ok(
    source.includes(`const build = "${version.build}"`),
    "Build must be a committed timestamp literal",
  );
  const b = version.build;
  const iso = `${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6, 8)}T${b.slice(9, 11)}:${b.slice(11, 13)}:${b.slice(13, 15)}Z`;
  assert.equal(
    new Date(iso).toISOString(),
    iso.replace("Z", ".000Z"),
    "Build must be a valid UTC date/time",
  );
  assert.equal(version.version, `3.7.1-${b}`);
  const schemaRuntime = vm.createContext({});
  vm.runInContext(read("workout-data.js"), schemaRuntime, { timeout: 1000 });
  const schema = vm.runInContext("DATA_VERSION", schemaRuntime);
  assert.equal(schema, 8, "Note-scope schema #25 must match the approved migration");
  const release = read("docs/V3_RELEASE.md");
  assert.ok(
    release.includes(`Application version: \`${version.version}\``),
    "Release artifact has a stale application version",
  );
  assert.ok(
    release.includes(`Data schema: \`${schema}\``),
    "Release artifact has a stale schema",
  );
  assert.match(release, /^Release status: \*\*(preparation|released)\*\*$/m);
  assert.ok(
    read("docs/RELEASE_HISTORY.md").includes(`\`${version.version}\``),
    "Release history is missing this build",
  );
  assert.match(
    read("docs/CHANGELOG.md"),
    /^## 3\.7\.1\b/m,
    "Changelog is missing the History disclosure release",
  );
  const html = read("index.html");
  assert.equal(
    (html.match(/src="app-version\.js"/g) || []).length,
    1,
    "Load the canonical version exactly once",
  );
  assert.ok(
    html.indexOf('src="app-version.js"') < html.indexOf('src="app.js"'),
    "Load metadata before UI",
  );
  assert.match(html, /id="appVersion"/);
  // Full build literals belong in documentation, never duplicated runtime assets.
  for (const file of fs
    .readdirSync(root)
    .filter((file) => /\.(js|html)$/.test(file) && file !== "app-version.js")) {
    assert.doesNotMatch(
      read(file),
      /\b\d+\.\d+\.\d+-\d{8}T\d{6}Z\b/,
      `Hard-coded application build in ${file}`,
    );
  }
  return { version: version.version, schema };
}
if (require.main === module) {
  try {
    const release = checkRelease(path.resolve(__dirname, ".."));
    console.log(
      `Release metadata passed: ${release.version}, schema ${release.schema}. UI/export matching is covered by browser tests.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { checkRelease };
