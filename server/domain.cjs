// Load the same browser domain sources, once per isolated request context.
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const files = [
  "seed.js",
  "workout-data.js",
  "workout-sessions.js",
  "guided-workouts.js",
  "performance-context.js",
  "workout-actions.js",
];
const sources = files.map((file) => [
  file,
  fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
]);
function domain() {
  const context = vm.createContext({ structuredClone });
  for (const [filename, source] of sources)
    vm.runInContext(source, context, { filename });
  return vm.runInContext(
    "({createWorkoutActions, validateData, migrateData, mergeHistoryData, emptyData})",
    context,
  );
}
module.exports = { domain };
