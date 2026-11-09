// Canonical application release metadata. Update once per deployable commit,
// never from the browser clock. Persistence compatibility uses DATA_VERSION.
const APP_VERSION = (() => {
  const major = 3;
  const minor = 19;
  const patch = 10;
  const build = "20261109T114711Z";
  return Object.freeze({
    major,
    minor,
    patch,
    build,
    version: `${major}.${minor}.${patch}-${build}`,
  });
})();

// Statically traceable server dependency; the browser uses the same frozen value.
if (typeof module === 'object' && module.exports) module.exports = APP_VERSION;

// Complete backup metadata is export-only; do not mutate committed state.
// `version` is the existing data/schema version, independent of APP_VERSION.
function createCompleteBackup(data) {
  return {
    ...JSON.parse(JSON.stringify(data)),
    appVersion: APP_VERSION.version,
  };
}
