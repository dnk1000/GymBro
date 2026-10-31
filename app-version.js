// Canonical application release metadata. Update once per deployable commit,
// never from the browser clock. Persistence compatibility uses DATA_VERSION.
const APP_VERSION = (() => {
  const major = 3;
  const minor = 13;
  const patch = 0;
  const build = "20261031T003411Z";
  return Object.freeze({
    major,
    minor,
    patch,
    build,
    version: `${major}.${minor}.${patch}-${build}`,
  });
})();

// Complete backup metadata is export-only; do not mutate committed state.
// `version` is the existing data/schema version, independent of APP_VERSION.
function createCompleteBackup(data) {
  return {
    ...JSON.parse(JSON.stringify(data)),
    appVersion: APP_VERSION.version,
  };
}
