// Vercel: exit 0 skips the build. Existing V2 projects must not deploy this branch.
const { stagingConfig } = require("../server/config.cjs");
try {
  stagingConfig();
  process.exitCode = 1;
} catch {
  console.log(
    "Skipping deployment: explicit V3 staging configuration is required.",
  );
  process.exitCode = 0;
}
