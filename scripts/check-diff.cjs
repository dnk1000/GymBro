const { execFileSync } = require("node:child_process");
const path = require("node:path");
function checkDiff(root, base) {
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  if (!base) base = git(["merge-base", "origin/main", "HEAD"]).trim();
  if (!/^[a-f0-9]{40}$/.test(base))
    throw Error("Whitespace comparison requires a full base commit SHA.");
  // Initial branch creation has no before commit. Compare with the empty tree.
  if (/^0{40}$/.test(base))
    base = git(["hash-object", "-w", "-t", "tree", "--stdin"]).trim();
  git(["diff", "--check", base, "HEAD", "--"]);
  git(["diff", "--check", "--"]);
  git(["diff", "--cached", "--check", "--"]);
  return base;
}
if (require.main === module) {
  try {
    const base = checkDiff(
      path.resolve(__dirname, ".."),
      process.argv[2] || process.env.DIFF_BASE,
    );
    console.log(
      `Whitespace passed against ${base}, plus staged/unstaged edits.`,
    );
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exitCode = 1;
  }
}
module.exports = { checkDiff };
