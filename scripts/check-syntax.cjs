const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const files = [
  ...new Set(
    execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
      cwd: root,
      encoding: "utf8",
    }).split("\0"),
  ),
].filter((file) => /\.(?:js|cjs|mjs)$/.test(file));
for (const file of files)
  execFileSync(process.execPath, ["--check", path.join(root, file)], {
    stdio: "inherit",
  });
console.log(`Syntax passed: ${files.length} JavaScript files.`);
